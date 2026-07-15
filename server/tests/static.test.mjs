import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveRequestedFile } from "../static.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REAL_REPOSITORY_ROOT = await realpath(REPOSITORY_ROOT);

async function resolvePath(pathname) {
  return resolveRequestedFile(REPOSITORY_ROOT, REAL_REPOSITORY_ROOT, pathname);
}

test("required playground assets remain public", async () => {
  for (const pathname of [
    "/",
    "/course-app.js",
    "/starter-code.js",
    "/test-data/tests-py01-03.js",
    "/assets/vendor/ace/ace.js",
    "/docs/screenshots/dashboard.jpg",
  ]) {
    const result = await resolvePath(pathname);
    assert.equal(result.error, undefined, `${pathname} should be public`);
    assert.equal(result.fileStats.isFile(), true);
  }
});

test("solutions and backend or deployment files are not served", async () => {
  for (const pathname of [
    "/solution-code.js",
    "/Py01%20First%20Programs/First%20Programs.py",
    "/scripts/serve.mjs",
    "/server/api.mjs",
    "/db/migrations/001_initial.sql",
    "/package.json",
    "/package-lock.json",
    "/docker-compose.yml",
    "/.env",
    "/docs/ROADMAP.md",
  ]) {
    const result = await resolvePath(pathname);
    assert.ok(result.error === 403 || result.error === 404, `${pathname} should be private`);
  }
});

test("encoded traversal and symlink escapes cannot leave the repository", async () => {
  for (const pathname of ["/assets/%2e%2e/package.json", "/assets/%2e%2e%2fpackage.json", "/%00"]) {
    const result = await resolvePath(pathname);
    assert.ok(result.error >= 400, `${pathname} should be rejected`);
  }
});
