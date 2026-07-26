import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  request as createHttpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import { isIP } from "node:net";

import { createSessionToken, hashSessionToken } from "./credentials.js";

export const PREVIEW_COOKIE_NAME = "__Host-eduground_preview";
export const PREVIEW_LOGIN_PATH = "/__preview/login";
export const PREVIEW_LOGOUT_PATH = "/__preview/logout";

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const MAXIMUM_LOGIN_BODY_BYTES = 4 * 1024;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type Clock = () => number;

interface AttemptState {
  failures: number;
  windowStartedAt: number;
}

export interface SecurePreviewGatewayOptions {
  upstream: URL | string;
  accessToken?: string;
  previewLifetimeSeconds?: number;
  sessionLifetimeSeconds?: number;
  maximumFailedAttempts?: number;
  attemptWindowSeconds?: number;
  maximumTrackedClients?: number;
  maximumSessions?: number;
  now?: Clock;
}

export interface SecurePreviewGateway {
  server: Server;
  accessToken: string;
  expiresAt: number;
  close(): Promise<void>;
}

class PreviewRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PreviewRequestError";
    this.status = status;
  }
}

function boundedWholeNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number {
  const candidate = value ?? fallback;
  if (
    !Number.isSafeInteger(candidate) ||
    candidate < minimum ||
    candidate > maximum
  ) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return candidate;
}

function normalizedIp(value: string | string[] | undefined): string {
  const candidate = String(Array.isArray(value) ? value[0] || "" : value || "")
    .trim()
    .replace(/^"|"$/gu, "");
  if (isIP(candidate)) return candidate;

  const bracketed = /^\[([^\]]+)\](?::\d+)?$/u.exec(candidate);
  if (bracketed?.[1] && isIP(bracketed[1])) return bracketed[1];

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/u.exec(candidate);
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1])) return ipv4WithPort[1];
  return "";
}

function isLoopbackHostname(hostname: string): boolean {
  const unwrapped = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  return (
    unwrapped === "localhost" ||
    unwrapped === "::1" ||
    unwrapped.startsWith("127.")
  );
}

function parseUpstream(value: URL | string): URL {
  const upstream = value instanceof URL ? new URL(value.href) : new URL(value);
  if (
    upstream.protocol !== "http:" ||
    !isLoopbackHostname(upstream.hostname) ||
    upstream.username ||
    upstream.password ||
    upstream.pathname !== "/" ||
    upstream.search ||
    upstream.hash
  ) {
    throw new Error(
      "PREVIEW_UPSTREAM must be an http:// loopback origin without credentials or a path."
    );
  }
  return upstream;
}

function digestMatches(value: string, expectedDigest: string): boolean {
  const actual = Buffer.from(hashSessionToken(value), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return (
    actual.length > 0 &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

function readCookie(request: IncomingMessage, name: string): string {
  for (const pair of String(request.headers.cookie || "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    if (pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return "";
}

function withoutPreviewCookie(value: string | undefined): string {
  return String(value || "")
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .filter((pair) => pair.slice(0, pair.indexOf("=")).trim() !== PREVIEW_COOKIE_NAME)
    .join("; ");
}

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'unsafe-inline'",
    "Permissions-Policy":
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=14400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loginPage(message = ""): string {
  const notice = message
    ? `<p class="notice" role="alert">${escapeHtml(message)}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Python EduGround · Secure preview</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { min-height: 100dvh; margin: 0; display: grid; place-items: center; padding: 24px; color: #edf7f5;
      background: radial-gradient(circle at 20% 10%, #133a3b 0, transparent 34%), #071217; }
    main { width: min(100%, 430px); padding: 30px; border: 1px solid #2b5c5a; border-radius: 18px;
      background: #0d1d24; box-shadow: 0 24px 80px #0009; }
    .mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px;
      color: #06130f; background: #67e6b2; font: 800 22px/1 ui-monospace, monospace; }
    h1 { margin: 22px 0 8px; font-size: clamp(1.7rem, 7vw, 2.35rem); letter-spacing: -.04em; }
    p { color: #abc4c4; line-height: 1.55; }
    label { display: block; margin: 24px 0 8px; color: #d9e7e5; font-weight: 700; }
    input { width: 100%; min-height: 52px; padding: 12px 14px; border: 1px solid #37615f; border-radius: 10px;
      color: #f5fffd; background: #071419; font: 600 16px/1.2 ui-monospace, monospace; }
    input:focus { outline: 3px solid #67e6b244; border-color: #67e6b2; }
    button { width: 100%; min-height: 52px; margin-top: 14px; border: 0; border-radius: 10px;
      color: #06130f; background: #67e6b2; font: 800 16px/1 system-ui, sans-serif; cursor: pointer; }
    .notice { padding: 11px 13px; border: 1px solid #a84e58; border-radius: 9px; color: #ffdce0; background: #4a1d24; }
    small { display: block; margin-top: 18px; color: #789292; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">&gt;_</div>
    <h1>Private phone preview</h1>
    <p>Enter the temporary access token created on your Mac. It is not stored in the page or URL.</p>
    ${notice}
    <form method="post" action="${PREVIEW_LOGIN_PATH}" autocomplete="off">
      <label for="token">Access token</label>
      <input id="token" name="token" type="password" required autofocus inputmode="text"
        autocapitalize="none" autocomplete="off" spellcheck="false">
      <button type="submit">Open Python EduGround</button>
    </form>
    <small>This preview expires automatically. Use it only on a phone you control.</small>
  </main>
</body>
</html>`;
}

function sendHtml(
  response: ServerResponse,
  status: number,
  body: string,
  method = "GET",
  extraHeaders: Record<string, string | string[]> = {}
): void {
  response.writeHead(status, {
    ...securityHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(method === "HEAD" ? undefined : body);
}

function sendRedirect(
  response: ServerResponse,
  location: string,
  extraHeaders: Record<string, string | string[]> = {}
): void {
  response.writeHead(303, {
    ...securityHeaders(),
    "Content-Length": "0",
    Location: location,
    ...extraHeaders,
  });
  response.end();
}

async function readLoginToken(request: IncomingMessage): Promise<string> {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/u.test(contentType)) {
    throw new PreviewRequestError(
      415,
      "The sign-in form must use application/x-www-form-urlencoded."
    );
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAXIMUM_LOGIN_BODY_BYTES
  ) {
    throw new PreviewRequestError(413, "The sign-in request is too large.");
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > MAXIMUM_LOGIN_BODY_BYTES) {
      throw new PreviewRequestError(413, "The sign-in request is too large.");
    }
    chunks.push(buffer);
  }

  const form = new URLSearchParams(
    Buffer.concat(chunks, byteLength).toString("utf8")
  );
  return String(form.get("token") || "");
}

function responseHeadersWithoutHopByHop(
  source: IncomingHttpHeaders
): OutgoingHttpHeaders {
  const headers: OutgoingHttpHeaders = { ...source };
  for (const name of HOP_BY_HOP_HEADERS) delete headers[name];
  return headers;
}

function proxyHeaders(request: IncomingMessage, clientIp: string): OutgoingHttpHeaders {
  const headers: OutgoingHttpHeaders = { ...request.headers };
  for (const name of Object.keys(headers)) {
    if (
      HOP_BY_HOP_HEADERS.has(name) ||
      name.startsWith("cf-") ||
      name.startsWith("proxy-") ||
      name.startsWith("x-forwarded-")
    ) {
      delete headers[name];
    }
  }

  const cookies = withoutPreviewCookie(request.headers.cookie);
  if (cookies) headers.cookie = cookies;
  else delete headers.cookie;

  headers.host = request.headers.host || "localhost";
  headers["x-forwarded-for"] = clientIp;
  headers["x-forwarded-host"] = request.headers.host || "localhost";
  headers["x-forwarded-proto"] = "https";
  return headers;
}

function proxyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  upstream: URL,
  clientIp: string
): void {
  if (
    request.method === "CONNECT" ||
    String(request.headers.upgrade || "").trim() !== ""
  ) {
    sendHtml(response, 405, loginPage("Connection upgrades are not available."));
    return;
  }

  let target: URL;
  try {
    target = new URL(request.url || "/", upstream);
  } catch {
    sendHtml(response, 400, loginPage("The requested URL is invalid."));
    return;
  }
  if (target.origin !== upstream.origin) {
    sendHtml(response, 400, loginPage("Absolute proxy requests are not allowed."));
    return;
  }

  let upstreamResponded = false;
  const upstreamRequest = createHttpRequest(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      method: request.method,
      path: `${target.pathname}${target.search}`,
      headers: proxyHeaders(request, clientIp),
    },
    (upstreamResponse) => {
      upstreamResponded = true;
      response.writeHead(
        upstreamResponse.statusCode || 502,
        responseHeadersWithoutHopByHop(upstreamResponse.headers)
      );
      upstreamResponse.pipe(response);
    }
  );

  upstreamRequest.setTimeout(30_000, () => {
    upstreamRequest.destroy(new Error("Preview upstream timed out."));
  });
  upstreamRequest.on("error", () => {
    if (upstreamResponded || response.headersSent) {
      response.destroy();
      return;
    }
    sendHtml(
      response,
      502,
      loginPage("The local learning app is not ready. Try again in a moment."),
      request.method
    );
  });
  request.on("aborted", () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
}

export function createSecurePreviewGateway(
  options: SecurePreviewGatewayOptions
): SecurePreviewGateway {
  const upstream = parseUpstream(options.upstream);
  const now = options.now || Date.now;
  const previewLifetimeSeconds = boundedWholeNumber(
    options.previewLifetimeSeconds,
    4 * 60 * 60,
    60,
    12 * 60 * 60,
    "previewLifetimeSeconds"
  );
  const sessionLifetimeSeconds = boundedWholeNumber(
    options.sessionLifetimeSeconds,
    previewLifetimeSeconds,
    60,
    previewLifetimeSeconds,
    "sessionLifetimeSeconds"
  );
  const maximumFailedAttempts = boundedWholeNumber(
    options.maximumFailedAttempts,
    5,
    1,
    20,
    "maximumFailedAttempts"
  );
  const attemptWindowSeconds = boundedWholeNumber(
    options.attemptWindowSeconds,
    10 * 60,
    30,
    60 * 60,
    "attemptWindowSeconds"
  );
  const maximumTrackedClients = boundedWholeNumber(
    options.maximumTrackedClients,
    256,
    16,
    2_048,
    "maximumTrackedClients"
  );
  const maximumSessions = boundedWholeNumber(
    options.maximumSessions,
    32,
    1,
    128,
    "maximumSessions"
  );
  const accessToken = options.accessToken || createSessionToken();
  if (!ACCESS_TOKEN_PATTERN.test(accessToken)) {
    throw new Error("The preview access token must be a 256-bit base64url-style token.");
  }

  const accessTokenDigest = hashSessionToken(accessToken);
  const startedAt = now();
  const expiresAt = startedAt + previewLifetimeSeconds * 1_000;
  const attempts = new Map<string, AttemptState>();
  const sessions = new Map<string, number>();
  let expiryTimer: NodeJS.Timeout | undefined;

  function clientIp(request: IncomingMessage): string {
    return (
      normalizedIp(request.headers["cf-connecting-ip"]) ||
      normalizedIp(request.socket.remoteAddress) ||
      "unknown"
    );
  }

  function prune(timestamp: number): void {
    const attemptCutoff = timestamp - attemptWindowSeconds * 1_000;
    for (const [key, state] of attempts) {
      if (state.windowStartedAt < attemptCutoff) attempts.delete(key);
    }
    for (const [digest, expiry] of sessions) {
      if (expiry <= timestamp) sessions.delete(digest);
    }
  }

  function isRateLimited(ip: string, timestamp: number): boolean {
    prune(timestamp);
    const state = attempts.get(ip);
    return Boolean(
      state &&
        state.windowStartedAt + attemptWindowSeconds * 1_000 > timestamp &&
        state.failures >= maximumFailedAttempts
    );
  }

  function recordFailure(ip: string, timestamp: number): void {
    prune(timestamp);
    const current = attempts.get(ip);
    if (
      current &&
      current.windowStartedAt + attemptWindowSeconds * 1_000 > timestamp
    ) {
      current.failures += 1;
      attempts.delete(ip);
      attempts.set(ip, current);
      return;
    }
    if (attempts.size >= maximumTrackedClients) {
      const oldest = attempts.keys().next().value as string | undefined;
      if (oldest) attempts.delete(oldest);
    }
    attempts.set(ip, { failures: 1, windowStartedAt: timestamp });
  }

  function hasSession(request: IncomingMessage, timestamp: number): boolean {
    prune(timestamp);
    const token = readCookie(request, PREVIEW_COOKIE_NAME);
    if (!ACCESS_TOKEN_PATTERN.test(token)) return false;
    const digest = hashSessionToken(token);
    const expiry = sessions.get(digest);
    return Boolean(expiry && expiry > timestamp);
  }

  function createSession(timestamp: number): {
    token: string;
    maximumAgeSeconds: number;
  } {
    prune(timestamp);
    while (sessions.size >= maximumSessions) {
      const oldest = sessions.keys().next().value as string | undefined;
      if (!oldest) break;
      sessions.delete(oldest);
    }
    const token = createSessionToken();
    const expiry = Math.min(
      timestamp + sessionLifetimeSeconds * 1_000,
      expiresAt
    );
    sessions.set(hashSessionToken(token), expiry);
    return {
      token,
      maximumAgeSeconds: Math.max(1, Math.floor((expiry - timestamp) / 1_000)),
    };
  }

  function clearCurrentSession(request: IncomingMessage): void {
    const token = readCookie(request, PREVIEW_COOKIE_NAME);
    if (ACCESS_TOKEN_PATTERN.test(token)) {
      sessions.delete(hashSessionToken(token));
    }
  }

  const server = createServer(async (request, response) => {
    const timestamp = now();
    if (timestamp >= expiresAt) {
      sendHtml(response, 410, loginPage("This private preview has expired."), request.method);
      return;
    }

    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url || "/", "http://preview.local");
    } catch {
      sendHtml(response, 400, loginPage("The requested URL is invalid."), request.method);
      return;
    }

    if (requestUrl.pathname === PREVIEW_LOGIN_PATH) {
      if (request.method === "GET" || request.method === "HEAD") {
        if (hasSession(request, timestamp)) {
          sendRedirect(response, "/");
          return;
        }
        sendHtml(response, 200, loginPage(), request.method);
        return;
      }
      if (request.method !== "POST") {
        sendHtml(response, 405, loginPage("Method not allowed."), request.method, {
          Allow: "GET, HEAD, POST",
        });
        return;
      }

      const ip = clientIp(request);
      if (isRateLimited(ip, timestamp)) {
        request.resume();
        sendHtml(
          response,
          429,
          loginPage("Too many attempts. Wait ten minutes before trying again."),
          request.method,
          { "Retry-After": String(attemptWindowSeconds) }
        );
        return;
      }

      try {
        const candidate = await readLoginToken(request);
        if (!digestMatches(candidate, accessTokenDigest)) {
          recordFailure(ip, timestamp);
          sendHtml(
            response,
            401,
            loginPage("That token is not valid. Check it and try again."),
            request.method
          );
          return;
        }

        attempts.delete(ip);
        const session = createSession(timestamp);
        sendRedirect(response, "/", {
          "Set-Cookie":
            `${PREVIEW_COOKIE_NAME}=${session.token}; Path=/; HttpOnly; Secure; ` +
            `SameSite=Strict; Max-Age=${session.maximumAgeSeconds}`,
        });
      } catch (error) {
        const status = error instanceof PreviewRequestError ? error.status : 400;
        const message =
          error instanceof PreviewRequestError
            ? error.message
            : "The sign-in request could not be read.";
        sendHtml(response, status, loginPage(message), request.method);
      }
      return;
    }

    if (requestUrl.pathname === PREVIEW_LOGOUT_PATH) {
      if (request.method !== "POST") {
        sendHtml(response, 405, loginPage("Method not allowed."), request.method, {
          Allow: "POST",
        });
        return;
      }
      clearCurrentSession(request);
      sendRedirect(response, PREVIEW_LOGIN_PATH, {
        "Set-Cookie":
          `${PREVIEW_COOKIE_NAME}=; Path=/; HttpOnly; Secure; ` +
          "SameSite=Strict; Max-Age=0",
      });
      return;
    }

    if (requestUrl.pathname.startsWith("/__preview/")) {
      sendHtml(response, 404, loginPage("Preview route not found."), request.method);
      return;
    }

    if (!hasSession(request, timestamp)) {
      if (request.method === "GET" || request.method === "HEAD") {
        sendRedirect(response, PREVIEW_LOGIN_PATH);
      } else {
        sendHtml(
          response,
          401,
          loginPage("Your private preview session has expired."),
          request.method
        );
      }
      return;
    }

    proxyRequest(request, response, upstream, clientIp(request));
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 500;
  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  server.once("listening", () => {
    expiryTimer = setTimeout(() => server.close(), previewLifetimeSeconds * 1_000);
    expiryTimer.unref();
  });
  server.once("close", () => {
    if (expiryTimer) clearTimeout(expiryTimer);
    sessions.clear();
    attempts.clear();
  });

  return {
    server,
    accessToken,
    expiresAt,
    async close(): Promise<void> {
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
