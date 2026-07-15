import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "../migrate.mjs";

const { Client } = pg;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();

async function startServer() {
  const child = spawn(process.execPath, ["scripts/serve.mjs", "--port", "0"], {
    cwd: REPOSITORY_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, APP_ORIGIN: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const url = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server start timed out. ${output}`)), 8_000);
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
    child.once("exit", (code) => reject(new Error(`Server exited with ${code}. ${output}`)));
  });
  return { child, url };
}

async function request(url, path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? null : await response.json();
  return { response, payload };
}

test(
  "PostgreSQL stores accounts, progress, files, test runs, and revocable sessions",
  { skip: !TEST_DATABASE_URL, timeout: 30_000 },
  async (context) => {
    await runMigrations({ environment: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } });
    const { child, url } = await startServer();
    context.after(async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await new Promise((resolveExit) => child.once("exit", resolveExit));
      }
    });

    const email = `integration-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const cleanupClient = new Client({ connectionString: TEST_DATABASE_URL });
    context.after(async () => {
      await cleanupClient.connect();
      await cleanupClient.query("DELETE FROM users WHERE email = $1", [email]);
      await cleanupClient.end();
    });

    const registered = await request(url, "/api/auth/register", {
      method: "POST",
      body: { email: email.toUpperCase(), displayName: "Test Learner", password: "strong-test-password" },
    });
    assert.equal(registered.response.status, 201);
    assert.equal(registered.payload.user.email, email);
    const token = registered.payload.token;

    const me = await request(url, "/api/me", { token });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.user.displayName, "Test Learner");

    const state = { passedIds: ["py01-first-programs"], editorMode: "vim" };
    const savedState = await request(url, "/api/state", {
      method: "PUT",
      token,
      body: { state },
    });
    assert.equal(savedState.response.status, 200);
    assert.deepEqual(savedState.payload.state, state);
    assert.deepEqual((await request(url, "/api/state", { token })).payload.state, state);

    const savedFile = await request(url, "/api/files/py01-first-programs", {
      method: "PUT",
      token,
      body: { filename: "first-programs.py", content: "print('practice')\n" },
    });
    assert.equal(savedFile.response.status, 200);
    assert.equal(savedFile.payload.file.content, "print('practice')\n");
    assert.equal(
      (await request(url, "/api/files/py01-first-programs", { token })).payload.file.filename,
      "first-programs.py"
    );

    const run = await request(url, "/api/runs", {
      method: "POST",
      token,
      body: {
        exerciseId: "py01-first-programs",
        scope: "all",
        passedCount: 3,
        totalCount: 3,
        allPassed: true,
        results: [{ name: "greeting", passed: true }],
      },
    });
    assert.equal(run.response.status, 201);
    assert.equal(run.payload.run.allPassed, true);

    const logout = await request(url, "/api/auth/logout", { method: "POST", token });
    assert.equal(logout.response.status, 204);
    assert.equal((await request(url, "/api/me", { token })).response.status, 401);

    const login = await request(url, "/api/auth/login", {
      method: "POST",
      body: { email, password: "strong-test-password" },
    });
    assert.equal(login.response.status, 200);
    assert.notEqual(login.payload.token, token);
  }
);
