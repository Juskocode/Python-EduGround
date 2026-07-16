import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function startServer(extraEnvironment = {}) {
  const child = spawn(process.execPath, ["scripts/serve.mjs", "--port", "0"], {
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: "",
      ...extraEnvironment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const url = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server start timed out. ${output}`)), 5_000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = /Local server: (http:\/\/[^\s]+)/u.exec(output);
      if (match) {
        clearTimeout(timer);
        resolveUrl(match[1]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}. ${output}`));
    });
  });
  return { child, url };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("exit", resolveExit));
}

test("static learning remains available while cloud saving reports unavailable", async (context) => {
  const { child, url } = await startServer({ APP_ORIGIN: "http://allowed.example" });
  context.after(() => stopServer(child));

  const home = await fetch(`${url}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-security-policy"), /frame-ancestors 'none'/u);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("referrer-policy"), "no-referrer");
  assert.match(home.headers.get("permissions-policy"), /camera=\(\)/u);
  assert.match(await home.text(), /Python EduGround/u);

  const themeBootstrap = await fetch(`${url}/theme-bootstrap.js`);
  assert.equal(themeBootstrap.status, 200);
  assert.match(await themeBootstrap.text(), /prefers-color-scheme/u);

  const liveness = await fetch(`${url}/healthz`);
  assert.equal(liveness.status, 200);
  assert.deepEqual(await liveness.json(), { status: "ok" });

  const readiness = await fetch(`${url}/api/health`);
  assert.equal(readiness.status, 503);
  assert.equal((await readiness.json()).database.configured, false);

  const register = await fetch(`${url}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "learner@example.com",
      displayName: "Learner",
      password: "long-enough-password",
    }),
  });
  assert.equal(register.status, 503);
  assert.equal((await register.json()).error.code, "DATABASE_UNAVAILABLE");

  const rejectedOrigin = await fetch(`${url}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({
      email: "learner@example.com",
      displayName: "Learner",
      password: "long-enough-password",
    }),
  });
  assert.equal(rejectedOrigin.status, 403);
  assert.equal((await rejectedOrigin.json()).error.code, "ORIGIN_NOT_ALLOWED");

  const allowedOrigin = await fetch(`${url}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://allowed.example" },
    body: JSON.stringify({
      email: "learner@example.com",
      displayName: "Learner",
      password: "long-enough-password",
    }),
  });
  assert.equal(allowedOrigin.status, 503);

  for (const privatePath of [
    "/solution-code.js",
    "/Py01%20First%20Programs/First%20Programs.py",
    "/package.json",
    "/server/api.mjs",
  ]) {
    assert.ok([403, 404].includes((await fetch(`${url}${privatePath}`)).status));
  }
});
