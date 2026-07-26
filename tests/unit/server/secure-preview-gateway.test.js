import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

import {
  PREVIEW_COOKIE_NAME,
  PREVIEW_LOGIN_PATH,
  createSecurePreviewGateway,
} from "../../../dist/server/security/secure-preview-gateway.js";

const ACCESS_TOKEN = "A".repeat(43);

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

function cookiePair(response) {
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";", 1)[0];
}

async function login(baseUrl, token = ACCESS_TOKEN, headers = {}) {
  return fetch(`${baseUrl}${PREVIEW_LOGIN_PATH}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({ token }),
  });
}

async function createFixture(t, options = {}) {
  const received = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    received.push({
      body: Buffer.concat(chunks).toString("utf8"),
      headers: { ...request.headers },
      method: request.method,
      url: request.url,
    });
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Set-Cookie": "eduground_session=upstream-session; Path=/; HttpOnly",
      Connection: "close",
    });
    response.end("upstream ok");
  });
  const upstreamUrl = await listen(upstream);
  const gateway = createSecurePreviewGateway({
    upstream: upstreamUrl,
    accessToken: ACCESS_TOKEN,
    ...options,
  });
  const gatewayUrl = await listen(gateway.server);

  t.after(async () => {
    await gateway.close();
    await new Promise((resolve) => upstream.close(resolve));
  });
  return { gateway, gatewayUrl, received };
}

test("every app route, including health, is gated behind the preview login", async (t) => {
  const { gatewayUrl } = await createFixture(t);

  const health = await fetch(`${gatewayUrl}/healthz`, { redirect: "manual" });
  assert.equal(health.status, 303);
  assert.equal(health.headers.get("location"), PREVIEW_LOGIN_PATH);

  const loginPage = await fetch(`${gatewayUrl}${PREVIEW_LOGIN_PATH}`);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Private phone preview/u);
  assert.equal(loginPage.headers.get("cache-control")?.includes("no-store"), true);
  assert.equal(loginPage.headers.get("x-frame-options"), "DENY");
  assert.match(
    loginPage.headers.get("content-security-policy") || "",
    /default-src 'none'/u
  );
});

test("valid access creates a separate secure session and proxies bodies safely", async (t) => {
  const { gatewayUrl, received } = await createFixture(t);
  const response = await login(gatewayUrl, ACCESS_TOKEN, {
    "CF-Connecting-IP": "198.51.100.25",
  });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  const setCookie = response.headers.get("set-cookie") || "";
  assert.match(setCookie, new RegExp(`^${PREVIEW_COOKIE_NAME}=`, "u"));
  assert.match(setCookie, /;\s*Secure/u);
  assert.match(setCookie, /;\s*HttpOnly/u);
  assert.match(setCookie, /;\s*SameSite=Strict/u);
  assert.doesNotMatch(setCookie, new RegExp(ACCESS_TOKEN, "u"));
  const sessionCookie = cookiePair(response);

  const proxied = await fetch(`${gatewayUrl}/api/example?mode=phone`, {
    method: "POST",
    headers: {
      Cookie: `${sessionCookie}; learner_theme=dark`,
      "Content-Type": "text/plain",
      Origin: "https://phone-preview.example",
      "CF-Connecting-IP": "198.51.100.25",
      "X-Forwarded-For": "203.0.113.99",
      "Proxy-Authorization": "must-not-pass",
    },
    body: "learner code",
  });
  assert.equal(proxied.status, 200);
  assert.equal(await proxied.text(), "upstream ok");
  assert.match(
    proxied.headers.get("set-cookie") || "",
    /^eduground_session=upstream-session/u
  );

  assert.equal(received.length, 1);
  assert.equal(received[0].url, "/api/example?mode=phone");
  assert.equal(received[0].method, "POST");
  assert.equal(received[0].body, "learner code");
  assert.equal(received[0].headers.origin, "https://phone-preview.example");
  assert.equal(received[0].headers["x-forwarded-for"], "198.51.100.25");
  assert.equal(received[0].headers["x-forwarded-proto"], "https");
  assert.equal(received[0].headers["cf-connecting-ip"], undefined);
  assert.equal(received[0].headers["proxy-authorization"], undefined);
  assert.equal(received[0].headers.cookie, "learner_theme=dark");
});

test("failed token attempts are bounded without reflecting the token", async (t) => {
  const { gatewayUrl } = await createFixture(t, {
    maximumFailedAttempts: 2,
    attemptWindowSeconds: 30,
  });
  const headers = { "CF-Connecting-IP": "203.0.113.8" };

  const first = await login(gatewayUrl, "wrong-token", headers);
  assert.equal(first.status, 401);
  assert.doesNotMatch(await first.text(), /wrong-token/u);

  const second = await login(gatewayUrl, "another-wrong-token", headers);
  assert.equal(second.status, 401);

  const limited = await login(gatewayUrl, ACCESS_TOKEN, headers);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "30");
  assert.doesNotMatch(await limited.text(), new RegExp(ACCESS_TOKEN, "u"));
});

test("logout revokes the preview session and clears its host cookie", async (t) => {
  const { gatewayUrl, received } = await createFixture(t);
  const authenticated = await login(gatewayUrl);
  const sessionCookie = cookiePair(authenticated);

  const logout = await fetch(`${gatewayUrl}/__preview/logout`, {
    method: "POST",
    redirect: "manual",
    headers: { Cookie: sessionCookie },
  });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get("location"), PREVIEW_LOGIN_PATH);
  assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/u);

  const denied = await fetch(`${gatewayUrl}/`, {
    redirect: "manual",
    headers: { Cookie: sessionCookie },
  });
  assert.equal(denied.status, 303);
  assert.equal(denied.headers.get("location"), PREVIEW_LOGIN_PATH);
  assert.equal(received.length, 0);
});

test("the gateway rejects oversized login bodies and non-loopback upstreams", async (t) => {
  const { gatewayUrl } = await createFixture(t);
  const oversized = await fetch(`${gatewayUrl}${PREVIEW_LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `token=${"x".repeat(5_000)}`,
  });
  assert.equal(oversized.status, 413);

  assert.throws(
    () =>
      createSecurePreviewGateway({
        upstream: "https://public.example",
        accessToken: ACCESS_TOKEN,
      }),
    /loopback origin/u
  );
});

test("preview expiry closes access even when a session cookie still exists", async (t) => {
  let timestamp = 1_000;
  const { gatewayUrl } = await createFixture(t, {
    now: () => timestamp,
    previewLifetimeSeconds: 60,
    sessionLifetimeSeconds: 60,
  });
  const authenticated = await login(gatewayUrl);
  const sessionCookie = cookiePair(authenticated);

  timestamp += 61_000;
  const expired = await fetch(`${gatewayUrl}/`, {
    redirect: "manual",
    headers: { Cookie: sessionCookie },
  });
  assert.equal(expired.status, 410);
  assert.match(await expired.text(), /preview has expired/u);
});
