import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
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
    "/learning-toolbox.js",
    "/assessment-data.js",
    "/assessment-engine.js",
    "/assessment-room.js",
    "/assessment-ui.css",
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

test("the toolbox data loads before the application reads it", async () => {
  const index = await readFile(resolve(REPOSITORY_ROOT, "index.html"), "utf8");
  const learningContentPosition = index.indexOf('src="learning-content.js"');
  const toolboxPosition = index.indexOf('src="learning-toolbox.js"');
  const applicationPosition = index.indexOf('src="course-app.js"');

  assert.ok(learningContentPosition >= 0, "index should load learning-content.js");
  assert.ok(toolboxPosition > learningContentPosition, "toolbox data should load after the core learning content");
  assert.ok(applicationPosition > toolboxPosition, "toolbox data should load before course-app.js");
});

test("assessment data, engine, and room controller load before the application", async () => {
  const index = await readFile(resolve(REPOSITORY_ROOT, "index.html"), "utf8");
  const dataPosition = index.indexOf('src="assessment-data.js"');
  const enginePosition = index.indexOf('src="assessment-engine.js"');
  const roomPosition = index.indexOf('src="assessment-room.js"');
  const applicationPosition = index.indexOf('src="course-app.js"');

  assert.ok(dataPosition >= 0, "index should load assessment-data.js");
  assert.ok(enginePosition > dataPosition, "assessment engine should load after its data");
  assert.ok(roomPosition > enginePosition, "assessment room should load after its engine");
  assert.ok(applicationPosition > roomPosition, "assessment scripts should load before course-app.js");
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
    "/submissions/learner/Py01%20First%20Programs/ex00.py",
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
