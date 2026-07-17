import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { MIGRATION_LOCK_ID, runMigrations } from "../migrate.mjs";

const { Client } = pg;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
const sessionCapabilities = new Map();

async function startServer(extraEnvironment = {}) {
  const child = spawn(process.execPath, ["scripts/serve.mjs", "--port", "0"], {
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      APP_ORIGIN: "",
      ...extraEnvironment,
    },
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

async function request(
  url,
  path,
  { method = "GET", cookie, capability, origin, body } = {}
) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  const clientCapability =
    typeof capability === "string"
      ? capability
      : capability === false
        ? ""
        : sessionCapabilities.get(cookie);
  if (clientCapability) {
    headers["X-EduGround-Client-Capability"] = clientCapability;
  }
  if (
    cookie &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    origin !== false
  ) {
    headers.Origin = typeof origin === "string" ? origin : new URL(url).origin;
  }
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? null : await response.json();
  const setCookie = response.headers.get("set-cookie") || "";
  const responseCookie = setCookie ? setCookie.split(";", 1)[0] : "";
  if (responseCookie && payload?.clientCapability) {
    sessionCapabilities.set(responseCookie, payload.clientCapability);
  }
  return {
    response,
    payload,
    cookie: responseCookie,
    setCookie,
  };
}

test(
  "PostgreSQL stores accounts, progress, files, test runs, and revocable sessions",
  { skip: !TEST_DATABASE_URL, timeout: 45_000 },
  async (context) => {
    await runMigrations({ environment: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } });
    const submissionsDirectory = await mkdtemp(join(tmpdir(), "eduground-integration-files-"));
    const { child, url } = await startServer({
      SUBMISSIONS_DIR: submissionsDirectory,
      RUN_HISTORY_LIMIT: "10",
    });
    context.after(async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await new Promise((resolveExit) => child.once("exit", resolveExit));
      }
      await rm(submissionsDirectory, { recursive: true, force: true });
    });

    const readiness = await request(url, "/readyz");
    assert.equal(readiness.response.status, 200);
    assert.equal(readiness.payload.database.available, true);
    assert.equal(readiness.payload.database.schemaReady, true);

    const email = `integration-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const cleanupEmails = [email];
    const cleanupClient = new Client({ connectionString: TEST_DATABASE_URL });
    context.after(async () => {
      await cleanupClient.connect();
      await cleanupClient.query("DELETE FROM users WHERE email = ANY($1::text[])", [cleanupEmails]);
      await cleanupClient.end();
    });

    const registered = await request(url, "/api/auth/register", {
      method: "POST",
      body: { email: email.toUpperCase(), displayName: "Test Learner", password: "strong-test-password" },
    });
    assert.equal(registered.response.status, 201);
    assert.equal(registered.payload.user.email, email);
    assert.equal(Object.hasOwn(registered.payload, "token"), false);
    assert.match(registered.payload.clientCapability, /^[A-Za-z0-9_-]{32,256}$/u);
    assert.match(registered.setCookie, /^eduground_session=/u);
    assert.match(registered.setCookie, /HttpOnly/u);
    assert.match(registered.setCookie, /SameSite=Strict/u);
    const userId = registered.payload.user.id;
    const cookie = registered.cookie;

    const workerStyleRead = await request(url, "/api/state", {
      cookie,
      capability: false,
    });
    assert.equal(workerStyleRead.response.status, 403);
    assert.equal(
      workerStyleRead.payload.error.code,
      "CLIENT_CAPABILITY_REQUIRED"
    );
    assert.doesNotMatch(workerStyleRead.setCookie, /Max-Age=0/u);

    const wrongCapability = await request(url, "/api/me", {
      cookie,
      capability: "A".repeat(43),
    });
    assert.equal(wrongCapability.response.status, 403);
    assert.equal(
      wrongCapability.payload.error.code,
      "CLIENT_CAPABILITY_REQUIRED"
    );

    const me = await request(url, "/api/me", { cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.user.displayName, "Test Learner");

    const missingOrigin = await request(url, "/api/state", {
      method: "PUT",
      cookie,
      origin: false,
      body: { state: { passedIds: ["py01-first-programs"] } },
    });
    assert.equal(missingOrigin.response.status, 403);
    assert.equal(missingOrigin.payload.error.code, "ORIGIN_REQUIRED");

    const state = { passedIds: ["py01-first-programs"], editorMode: "vim" };
    const savedState = await request(url, "/api/state", {
      method: "PUT",
      cookie,
      body: { state },
    });
    assert.equal(savedState.response.status, 200);
    assert.deepEqual(savedState.payload.state, state);
    assert.deepEqual((await request(url, "/api/state", { cookie })).payload.state, state);

    const assessmentProgress = {
      version: 1,
      blocks: {
        "py01-py03": {
          theory: {
            active: null,
            bestScore: 80,
            completed: true,
            history: [
              {
                id: "integration-attempt-1",
                status: "submitted",
                score: 80,
                passed: true,
              },
            ],
          },
        },
      },
    };
    assert.equal(
      (
        await request(url, "/api/state", {
          method: "PUT",
          cookie,
          body: {
            state: {
              assessmentProgress,
              passedIds: ["py01-first-programs", "py01-fixme"],
            },
          },
        })
      ).response.status,
      200
    );

    const concurrentStateUpdates = await Promise.all([
      request(url, "/api/state", {
        method: "PUT",
        cookie,
        body: {
          state: {
            passedIds: ["py01-diagram"],
            learningProgress: { py01: ["tutorial-0"] },
          },
        },
      }),
      request(url, "/api/state", {
        method: "PUT",
        cookie,
        body: {
          state: {
            passedIds: ["py01-avoid-sums"],
            learningProgress: { py01: ["runbook"] },
          },
        },
      }),
    ]);
    concurrentStateUpdates.forEach(({ response }) => assert.equal(response.status, 200));
    const mergedState = (await request(url, "/api/state", { cookie })).payload.state;
    assert.deepEqual(mergedState.passedIds, [
      "py01-avoid-sums",
      "py01-diagram",
      "py01-first-programs",
      "py01-fixme",
    ]);
    assert.deepEqual(mergedState.learningProgress, { py01: ["runbook", "tutorial-0"] });
    assert.deepEqual(mergedState.assessmentProgress, assessmentProgress);

    const savedFile = await request(url, "/api/files/py01-first-programs", {
      method: "PUT",
      cookie,
      body: { filename: "first-programs.py", content: "print('practice')\n" },
    });
    assert.equal(savedFile.response.status, 200);
    assert.equal(savedFile.payload.file.content, "print('practice')\n");
    assert.equal(savedFile.payload.file.filename, "ex00.py");
    assert.equal(savedFile.payload.file.relativePath, "Py01 First Programs/ex00.py");
    assert.equal(savedFile.payload.file.mirrorStatus, "saved");
    const mirroredFile = join(
      submissionsDirectory,
      userId,
      "Py01 First Programs",
      "ex00.py"
    );
    assert.equal(await readFile(mirroredFile, "utf8"), "print('practice')\n");
    const verificationClient = new Client({ connectionString: TEST_DATABASE_URL });
    await verificationClient.connect();
    const databaseFile = await verificationClient.query(
      "SELECT filename FROM user_files WHERE user_id = $1 AND exercise_id = $2",
      [userId, "py01-first-programs"]
    );
    assert.equal(databaseFile.rows[0].filename, "ex00.py");

    const concurrentContents = Array.from(
      { length: 12 },
      (_, index) => `# concurrent snapshot ${index}\nvalue = ${index}\n`
    );
    const concurrentSaves = await Promise.all(
      concurrentContents.map((concurrentContent) =>
        request(url, "/api/files/py01-fixme", {
          method: "PUT",
          cookie,
          body: { content: concurrentContent },
        })
      )
    );
    concurrentSaves.forEach(({ response }) => assert.equal(response.status, 200));
    const concurrentDatabaseFile = await verificationClient.query(
      "SELECT content FROM user_files WHERE user_id = $1 AND exercise_id = $2",
      [userId, "py01-fixme"]
    );
    assert.equal(
      await readFile(join(submissionsDirectory, userId, "Py01 First Programs", "ex01.py"), "utf8"),
      concurrentDatabaseFile.rows[0].content
    );

    await verificationClient.query(
      "UPDATE user_files SET filename = $3 WHERE user_id = $1 AND exercise_id = $2",
      [userId, "py01-first-programs", "legacy-first-programs.py"]
    );
    await rm(mirroredFile);
    const restoredFile = await request(url, "/api/files/py01-first-programs", { cookie });
    assert.equal(restoredFile.response.status, 200);
    assert.equal(restoredFile.payload.file.mirrorStatus, "saved");
    assert.equal(await readFile(mirroredFile, "utf8"), "print('practice')\n");
    assert.equal(
      (await request(url, "/api/files/py01-first-programs", { cookie })).payload.file.filename,
      "ex00.py"
    );
    const canonicalizedDatabaseFile = await verificationClient.query(
      "SELECT filename FROM user_files WHERE user_id = $1 AND exercise_id = $2",
      [userId, "py01-first-programs"]
    );
    assert.equal(canonicalizedDatabaseFile.rows[0].filename, "ex00.py");

    const unknownExercise = await request(url, "/api/files/py99-not-real", {
      method: "PUT",
      cookie,
      body: { filename: "../../escape.py", content: "unsafe\n" },
    });
    assert.equal(unknownExercise.response.status, 404);
    assert.equal(unknownExercise.payload.error.code, "EXERCISE_NOT_FOUND");

    const run = await request(url, "/api/runs", {
      method: "POST",
      cookie,
      body: {
        exerciseId: "py01-first-programs",
        scope: "all",
        passedCount: 1,
        totalCount: 1,
        allPassed: true,
        results: [{ name: "greeting", passed: true, ignored: "not persisted" }],
      },
    });
    assert.equal(run.response.status, 201);
    assert.equal(run.payload.run.allPassed, true);
    assert.equal(run.payload.run.verification, "learner-device");
    const storedRun = await verificationClient.query(
      "SELECT results FROM test_runs WHERE id = $1 AND user_id = $2",
      [run.payload.run.id, userId]
    );
    assert.deepEqual(storedRun.rows[0].results, [
      {
        id: "case-1",
        name: "greeting",
        hidden: false,
        passed: true,
      },
    ]);

    const concurrentRuns = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        request(url, "/api/runs", {
          method: "POST",
          cookie,
          body: {
            exerciseId: "py01-first-programs",
            scope: "all",
            passedCount: index % 2,
            totalCount: 1,
            allPassed: index % 2 === 1,
            results: [{ name: `bounded run ${index}`, passed: index % 2 === 1 }],
          },
        })
      )
    );
    concurrentRuns.forEach(({ response }) => assert.equal(response.status, 201));

    const failedEvidence = await request(url, "/api/runs", {
      method: "POST",
      cookie,
      body: {
        exerciseId: "py01-first-programs",
        scope: "all",
        passedCount: 0,
        totalCount: 1,
        allPassed: false,
        results: [
          {
            name: "historic failure",
            passed: false,
            expected: "expected line",
            actual: "actual line",
            stdout: "diagnostic output",
            stderr: "warning output",
            traceback: "Traceback: historic failure",
          },
        ],
      },
    });
    assert.equal(failedEvidence.response.status, 201);

    const history = await request(
      url,
      "/api/runs?exerciseId=py01-first-programs&limit=3",
      { cookie }
    );
    assert.equal(history.response.status, 200);
    assert.equal(history.response.headers.get("cache-control"), "no-store");
    assert.equal(history.payload.runs.length, 3);
    assert.equal(history.payload.runs[0].id, failedEvidence.payload.run.id);
    assert.equal(history.payload.runs[0].verification, "learner-device");
    assert.equal(Object.hasOwn(history.payload.runs[0], "code"), false);
    assert.deepEqual(history.payload.runs[0].results[0], {
      id: "case-1",
      name: "historic failure",
      hidden: false,
      passed: false,
      expected: "expected line",
      actual: "actual line",
      stdout: "diagnostic output",
      stderr: "warning output",
      traceback: "Traceback: historic failure",
    });
    assert.ok(
      history.payload.runs.every(
        (item, index, items) => index === 0 || Number(items[index - 1].id) > Number(item.id)
      )
    );

    const workerStyleHistory = await request(
      url,
      "/api/runs?exerciseId=py01-first-programs",
      { cookie, capability: false }
    );
    assert.equal(workerStyleHistory.response.status, 403);
    assert.equal(workerStyleHistory.payload.error.code, "CLIENT_CAPABILITY_REQUIRED");

    for (const invalidPath of [
      "/api/runs?exerciseId=py01-first-programs&limit=0",
      "/api/runs?exerciseId=py01-first-programs&limit=26",
      "/api/runs?exerciseId=py01-first-programs&extra=true",
      "/api/runs?exerciseId=py01-first-programs&exerciseId=py01-fixme",
    ]) {
      const invalidHistory = await request(url, invalidPath, { cookie });
      assert.equal(invalidHistory.response.status, 400);
      assert.equal(invalidHistory.payload.error.code, "INVALID_INPUT");
    }

    const unknownHistory = await request(
      url,
      "/api/runs?exerciseId=py99-not-real",
      { cookie }
    );
    assert.equal(unknownHistory.response.status, 404);
    assert.equal(unknownHistory.payload.error.code, "EXERCISE_NOT_FOUND");

    const secondEmail = `integration-second-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    cleanupEmails.push(secondEmail);
    const secondUser = await request(url, "/api/auth/register", {
      method: "POST",
      body: {
        email: secondEmail,
        displayName: "Second Learner",
        password: "second-strong-test-password",
      },
    });
    assert.equal(secondUser.response.status, 201);
    const isolatedHistory = await request(
      url,
      "/api/runs?exerciseId=py01-first-programs",
      { cookie: secondUser.cookie }
    );
    assert.equal(isolatedHistory.response.status, 200);
    assert.deepEqual(isolatedHistory.payload.runs, []);

    const retainedRuns = await verificationClient.query(
      "SELECT COUNT(*)::integer AS count FROM test_runs WHERE user_id = $1",
      [userId]
    );
    assert.equal(retainedRuns.rows[0].count, 10);

    const migrationLockClient = new Client({ connectionString: TEST_DATABASE_URL });
    await migrationLockClient.connect();
    await migrationLockClient.query("SELECT pg_advisory_lock($1)", [
      MIGRATION_LOCK_ID,
    ]);
    try {
      await assert.rejects(
        runMigrations({
          environment: {
            ...process.env,
            DATABASE_URL: TEST_DATABASE_URL,
            MIGRATION_LOCK_TIMEOUT_MS: "1000",
          },
        }),
        /Could not acquire the migration lock within 1000ms/u
      );
    } finally {
      await migrationLockClient.query("SELECT pg_advisory_unlock($1)", [
        MIGRATION_LOCK_ID,
      ]);
      await migrationLockClient.end();
    }

    await verificationClient.query(
      "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
      ["999_future_release.sql", "0".repeat(64)]
    );
    try {
      await assert.rejects(
        runMigrations({
          environment: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        }),
        /migrations not present in this release/u
      );
      const schemaAhead = await request(url, "/readyz");
      assert.equal(schemaAhead.response.status, 503);
      assert.equal(schemaAhead.payload.database.schemaReady, false);
    } finally {
      await verificationClient.query(
        "DELETE FROM schema_migrations WHERE name = $1",
        ["999_future_release.sql"]
      );
    }
    assert.equal((await request(url, "/readyz")).response.status, 200);
    await verificationClient.end();

    const logout = await request(url, "/api/auth/logout", { method: "POST", cookie });
    assert.equal(logout.response.status, 204);
    assert.match(logout.setCookie, /Max-Age=0/u);
    const expiredSession = await request(url, "/api/me", { cookie });
    assert.equal(expiredSession.response.status, 401);
    assert.match(expiredSession.setCookie, /Max-Age=0/u);

    const login = await request(url, "/api/auth/login", {
      method: "POST",
      body: { email, password: "strong-test-password" },
    });
    assert.equal(login.response.status, 200);
    assert.equal(Object.hasOwn(login.payload, "token"), false);
    assert.match(login.payload.clientCapability, /^[A-Za-z0-9_-]{32,256}$/u);
    assert.notEqual(login.cookie, cookie);
  }
);
