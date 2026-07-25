import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_SESSION_COOKIE,
  SECURE_SESSION_COOKIE,
  RequestPolicyError,
  assertSameOrigin,
  clearSessionCookies,
  configureHttpServer,
  createSessionCookie,
  createSessionCookies,
  isSecureRequest,
  parseAllowedOrigins,
  readBooleanSetting,
  readIntegerSetting,
  readSessionCookie,
  requestClientIp,
  securityHeaders,
  validateRuntimeEnvironment,
} from "../runtime-security.mjs";

const TOKEN = "a".repeat(48);

function request({ headers = {}, encrypted = false, remoteAddress = "127.0.0.1" } = {}) {
  return {
    headers,
    socket: { encrypted, remoteAddress },
  };
}

test("runtime settings reject ambiguous or unsafe production values", () => {
  assert.equal(readBooleanSetting({ FEATURE: "true" }, "FEATURE"), true);
  assert.equal(readBooleanSetting({ FEATURE: "off" }, "FEATURE"), false);
  assert.throws(
    () => readBooleanSetting({ FEATURE: "sometimes" }, "FEATURE"),
    /must be true or false/u
  );
  assert.equal(
    readIntegerSetting({ LIMIT: "25" }, "LIMIT", {
      fallback: 10,
      minimum: 1,
      maximum: 50,
    }),
    25
  );
  assert.throws(
    () =>
      readIntegerSetting({ LIMIT: "25.5" }, "LIMIT", {
        fallback: 10,
        minimum: 1,
        maximum: 50,
      }),
    /whole number/u
  );
  assert.throws(
    () => validateRuntimeEnvironment({ NODE_ENV: "Production" }),
    /APP_ORIGIN is required/u
  );
  assert.equal(
    validateRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ORIGIN: "https://learn.example.test",
    }),
    true
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        NODE_ENV: "production",
        APP_ORIGIN: "https://learn.example.test",
        ALLOW_BEARER_SESSION_TOKENS: "true",
      }),
    /development-only compatibility option/u
  );
});

test("allowed origins are normalized and paths or credentials are rejected", () => {
  assert.deepEqual(
    [...parseAllowedOrigins({ APP_ORIGIN: "https://learn.example.test,http://localhost:8000" })],
    ["https://learn.example.test", "http://localhost:8000"]
  );
  assert.throws(
    () => parseAllowedOrigins({ APP_ORIGIN: "https://learn.example.test/course" }),
    /without paths/u
  );
  assert.throws(
    () => parseAllowedOrigins({ APP_ORIGIN: "https://user:secret@example.test" }),
    /without paths/u
  );
});

test("same-origin policy requires evidence for cookie-authenticated mutations", () => {
  const environment = { APP_ORIGIN: "https://learn.example.test" };
  assert.doesNotThrow(() =>
    assertSameOrigin(
      request({ headers: { origin: "https://learn.example.test" } }),
      environment,
      { required: true }
    )
  );
  assert.throws(
    () => assertSameOrigin(request(), environment, { required: true }),
    (error) =>
      error instanceof RequestPolicyError &&
      error.status === 403 &&
      error.code === "ORIGIN_REQUIRED"
  );
  assert.throws(
    () =>
      assertSameOrigin(
        request({ headers: { origin: "https://attacker.example" } }),
        environment
      ),
    (error) =>
      error instanceof RequestPolicyError &&
      error.status === 403 &&
      error.code === "ORIGIN_NOT_ALLOWED"
  );
});

test("trusted proxy hops select the bounded forwarded client and protocol", () => {
  const proxied = request({
    headers: {
      "x-forwarded-for": "198.51.100.10, 10.0.0.5",
      "x-forwarded-proto": "http, https",
    },
    remoteAddress: "10.0.0.9",
  });
  assert.equal(requestClientIp(proxied, { TRUST_PROXY_HOPS: "1" }), "10.0.0.5");
  assert.equal(requestClientIp(proxied, { TRUST_PROXY_HOPS: "2" }), "198.51.100.10");
  assert.equal(requestClientIp(proxied, { TRUST_PROXY_HOPS: "0" }), "10.0.0.9");
  assert.equal(isSecureRequest(proxied, { TRUST_PROXY_HOPS: "1" }), true);
  assert.equal(isSecureRequest(proxied, { TRUST_PROXY_HOPS: "0" }), false);
});

test("session cookies are HttpOnly, strict, host-bound on HTTPS, and revocable", () => {
  const localCookie = createSessionCookie(TOKEN, {
    maximumAgeSeconds: 3_600,
    secure: false,
  });
  assert.match(localCookie, new RegExp(`^${LOCAL_SESSION_COOKIE}=`, "u"));
  assert.match(localCookie, /HttpOnly/u);
  assert.match(localCookie, /SameSite=Strict/u);
  assert.doesNotMatch(localCookie, /;\s*Secure/u);
  assert.equal(
    readSessionCookie(request({ headers: { cookie: `${localCookie}; theme=dark` } })),
    TOKEN
  );

  const secureCookie = createSessionCookie(TOKEN, {
    maximumAgeSeconds: 3_600,
    secure: true,
  });
  assert.match(secureCookie, new RegExp(`^${SECURE_SESSION_COOKIE}=`, "u"));
  assert.match(secureCookie, /;\s*Secure/u);
  const upgradedCookies = createSessionCookies(TOKEN, {
    maximumAgeSeconds: 3_600,
    secure: true,
  });
  assert.equal(upgradedCookies.length, 2);
  assert.match(upgradedCookies[0], new RegExp(`^${SECURE_SESSION_COOKIE}=`, "u"));
  assert.match(upgradedCookies[1], new RegExp(`^${LOCAL_SESSION_COOKIE}=;`, "u"));
  assert.match(upgradedCookies[1], /Max-Age=0/u);
  assert.match(upgradedCookies[1], /;\s*Secure/u);
  assert.throws(
    () => createSessionCookie("invalid token", { maximumAgeSeconds: 3_600 }),
    /token is invalid/u
  );

  const cleared = clearSessionCookies({ secure: true });
  assert.equal(cleared.length, 2);
  cleared.forEach((cookie) => assert.match(cookie, /Max-Age=0/u));
});

test("responses receive a CSP and browser isolation headers", () => {
  const headers = securityHeaders(request());
  assert.match(headers["Content-Security-Policy"], /default-src 'self'/u);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/u);
  assert.doesNotMatch(headers["Content-Security-Policy"], /script-src[^;]*'unsafe-inline'/u);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Permissions-Policy"].includes("camera=()"), true);
  assert.equal(headers["Strict-Transport-Security"], undefined);

  const secureHeaders = securityHeaders(
    request({ encrypted: true }),
    { HSTS_MAX_AGE_SECONDS: "31536000" }
  );
  assert.equal(
    secureHeaders["Strict-Transport-Security"],
    "max-age=31536000; includeSubDomains"
  );
});

test("HTTP server limits are applied from bounded settings", () => {
  const server = {};
  const values = configureHttpServer(server, {
    SERVER_REQUEST_TIMEOUT_MS: "20000",
    SERVER_HEADERS_TIMEOUT_MS: "8000",
    SERVER_KEEP_ALIVE_TIMEOUT_MS: "4000",
    SERVER_MAX_HEADERS: "80",
    SERVER_MAX_REQUESTS_PER_SOCKET: "500",
  });
  assert.deepEqual(values, {
    requestTimeout: 20_000,
    headersTimeout: 8_000,
    keepAliveTimeout: 4_000,
    maxHeadersCount: 80,
    maxRequestsPerSocket: 500,
  });
});
