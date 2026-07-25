import { isIP } from "node:net";

export const LOCAL_SESSION_COOKIE = "eduground_session";
export const SECURE_SESSION_COOKIE = "__Host-eduground_session";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;

const DEFAULT_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

function isProduction(environment) {
  return String(environment.NODE_ENV || "").trim().toLowerCase() === "production";
}

function splitHeader(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeForwardedAddress(value) {
  const candidate = String(value || "").trim().replace(/^"|"$/gu, "");
  if (isIP(candidate)) return candidate;

  const bracketed = /^\[([^\]]+)\](?::\d+)?$/u.exec(candidate);
  if (bracketed && isIP(bracketed[1])) return bracketed[1];

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/u.exec(candidate);
  if (ipv4WithPort && isIP(ipv4WithPort[1])) return ipv4WithPort[1];
  return "";
}

export function readBooleanSetting(environment, name, fallback = false) {
  const raw = environment[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error(`${name} must be true or false.`);
}

export function readIntegerSetting(
  environment,
  name,
  { fallback, minimum, maximum }
) {
  const raw = environment[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    if (
      !Number.isSafeInteger(fallback) ||
      fallback < minimum ||
      fallback > maximum
    ) {
      throw new Error(`${name} has an invalid application default.`);
    }
    return fallback;
  }
  if (!/^\d+$/u.test(String(raw).trim())) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return value;
}

export function trustedProxyHops(environment = process.env) {
  const explicit = environment.TRUST_PROXY_HOPS;
  if (explicit !== undefined && String(explicit).trim() !== "") {
    return readIntegerSetting(environment, "TRUST_PROXY_HOPS", {
      fallback: 0,
      minimum: 0,
      maximum: 5,
    });
  }
  return readBooleanSetting(environment, "TRUST_PROXY", false) ? 1 : 0;
}

function trustedForwardedValue(headerValue, hops) {
  if (hops <= 0) return "";
  const values = splitHeader(headerValue);
  const index = values.length - hops;
  return index >= 0 ? values[index] : "";
}

export function requestClientIp(request, environment = process.env) {
  const hops = trustedProxyHops(environment);
  const forwarded = normalizeForwardedAddress(
    trustedForwardedValue(request.headers["x-forwarded-for"], hops)
  );
  return forwarded || normalizeForwardedAddress(request.socket?.remoteAddress) || "unknown";
}

export function isSecureRequest(request, environment = process.env) {
  if (request.socket?.encrypted) return true;
  const protocol = trustedForwardedValue(
    request.headers["x-forwarded-proto"],
    trustedProxyHops(environment)
  );
  return protocol.toLowerCase() === "https";
}

export function parseAllowedOrigins(environment = process.env) {
  const origins = new Set();
  const configured = String(environment.APP_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const value of configured) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`APP_ORIGIN contains an invalid URL: ${value}`);
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(`APP_ORIGIN must contain only http(s) origins without paths: ${value}`);
    }
    origins.add(url.origin);
  }

  if (isProduction(environment) && origins.size === 0) {
    throw new Error("APP_ORIGIN is required when NODE_ENV=production.");
  }
  return origins;
}

export class RequestPolicyError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "RequestPolicyError";
    this.status = status;
    this.code = code;
  }
}

export function assertSameOrigin(
  request,
  environment = process.env,
  { required = false } = {}
) {
  const origin = request.headers.origin;
  if (!origin) {
    if (required) {
      throw new RequestPolicyError(
        403,
        "ORIGIN_REQUIRED",
        "Authenticated browser changes require a same-origin request."
      );
    }
    return;
  }

  const allowed = parseAllowedOrigins(environment);
  if (allowed.size === 0) {
    const protocol = isSecureRequest(request, environment) ? "https" : "http";
    const host = request.headers.host;
    if (host) allowed.add(`${protocol}://${host}`);
  }

  let normalizedOrigin = "";
  try {
    normalizedOrigin = new URL(String(origin)).origin;
  } catch {
    // Invalid and opaque origins are rejected below.
  }
  if (origin === "null" || !allowed.has(normalizedOrigin)) {
    throw new RequestPolicyError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed.");
  }
}

export function securityHeaders(request, environment = process.env) {
  const headers = {
    "Content-Security-Policy":
      environment.CONTENT_SECURITY_POLICY?.trim() || DEFAULT_CONTENT_SECURITY_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1",
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-DNS-Prefetch-Control": "off",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
  };

  if (isSecureRequest(request, environment)) {
    const maxAge = readIntegerSetting(environment, "HSTS_MAX_AGE_SECONDS", {
      fallback: 31_536_000,
      minimum: 0,
      maximum: 63_072_000,
    });
    if (maxAge > 0) {
      headers["Strict-Transport-Security"] = `max-age=${maxAge}; includeSubDomains`;
    }
  }
  return headers;
}

function parseCookies(request) {
  const cookies = new Map();
  for (const pair of String(request.headers.cookie || "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name && !cookies.has(name)) cookies.set(name, value);
  }
  return cookies;
}

export function readSessionCookie(request) {
  const cookies = parseCookies(request);
  const token = cookies.get(SECURE_SESSION_COOKIE) || cookies.get(LOCAL_SESSION_COOKIE) || "";
  return SESSION_TOKEN_PATTERN.test(token) ? token : "";
}

function cookieAttributes({ maximumAgeSeconds, secure }) {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maximumAgeSeconds}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function createSessionCookie(token, options) {
  if (!SESSION_TOKEN_PATTERN.test(String(token || ""))) {
    throw new Error("Session cookie token is invalid.");
  }
  const secure = Boolean(options?.secure);
  const maximumAgeSeconds = Number(options?.maximumAgeSeconds);
  if (!Number.isSafeInteger(maximumAgeSeconds) || maximumAgeSeconds <= 0) {
    throw new Error("Session cookie lifetime must be a positive whole number.");
  }
  const name = secure ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
  return `${name}=${token}; ${cookieAttributes({ maximumAgeSeconds, secure })}`;
}

export function createSessionCookies(token, options) {
  const secure = Boolean(options?.secure);
  const cookies = [createSessionCookie(token, options)];
  if (secure) {
    cookies.push(clearSessionCookies({ secure })[0]);
  }
  return cookies;
}

export function clearSessionCookies({ secure = false } = {}) {
  const expired = "Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
  return [
    `${LOCAL_SESSION_COOKIE}=; ${expired}${secure ? "; Secure" : ""}`,
    `${SECURE_SESSION_COOKIE}=; ${expired}; Secure`,
  ];
}

export function validateRuntimeEnvironment(environment = process.env) {
  parseAllowedOrigins(environment);
  trustedProxyHops(environment);
  readIntegerSetting(environment, "SESSION_TTL_SECONDS", {
    fallback: 30 * 24 * 60 * 60,
    minimum: 3_600,
    maximum: 180 * 24 * 60 * 60,
  });
  readIntegerSetting(environment, "SERVER_REQUEST_TIMEOUT_MS", {
    fallback: 30_000,
    minimum: 5_000,
    maximum: 120_000,
  });
  readIntegerSetting(environment, "SERVER_HEADERS_TIMEOUT_MS", {
    fallback: 10_000,
    minimum: 2_000,
    maximum: 60_000,
  });
  readIntegerSetting(environment, "SERVER_KEEP_ALIVE_TIMEOUT_MS", {
    fallback: 5_000,
    minimum: 1_000,
    maximum: 30_000,
  });
  readIntegerSetting(environment, "SERVER_MAX_HEADERS", {
    fallback: 100,
    minimum: 20,
    maximum: 500,
  });
  readIntegerSetting(environment, "SERVER_MAX_REQUESTS_PER_SOCKET", {
    fallback: 1_000,
    minimum: 10,
    maximum: 10_000,
  });
  readIntegerSetting(environment, "HSTS_MAX_AGE_SECONDS", {
    fallback: 31_536_000,
    minimum: 0,
    maximum: 63_072_000,
  });
  const allowBearerSessionTokens = readBooleanSetting(
    environment,
    "ALLOW_BEARER_SESSION_TOKENS",
    false
  );
  if (isProduction(environment) && allowBearerSessionTokens) {
    throw new Error(
      "ALLOW_BEARER_SESSION_TOKENS is a development-only compatibility option."
    );
  }
  return true;
}

export function configureHttpServer(server, environment = process.env) {
  const requestTimeout = readIntegerSetting(environment, "SERVER_REQUEST_TIMEOUT_MS", {
    fallback: 30_000,
    minimum: 5_000,
    maximum: 120_000,
  });
  const headersTimeout = readIntegerSetting(environment, "SERVER_HEADERS_TIMEOUT_MS", {
    fallback: Math.min(10_000, requestTimeout),
    minimum: 2_000,
    maximum: Math.min(60_000, requestTimeout),
  });
  server.requestTimeout = requestTimeout;
  server.headersTimeout = headersTimeout;
  server.keepAliveTimeout = readIntegerSetting(environment, "SERVER_KEEP_ALIVE_TIMEOUT_MS", {
    fallback: 5_000,
    minimum: 1_000,
    maximum: 30_000,
  });
  server.maxHeadersCount = readIntegerSetting(environment, "SERVER_MAX_HEADERS", {
    fallback: 100,
    minimum: 20,
    maximum: 500,
  });
  server.maxRequestsPerSocket = readIntegerSetting(environment, "SERVER_MAX_REQUESTS_PER_SOCKET", {
    fallback: 1_000,
    minimum: 10,
    maximum: 10_000,
  });
  return {
    requestTimeout: server.requestTimeout,
    headersTimeout: server.headersTimeout,
    keepAliveTimeout: server.keepAliveTimeout,
    maxHeadersCount: server.maxHeadersCount,
    maxRequestsPerSocket: server.maxRequestsPerSocket,
  };
}
