import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const [index, courseApp] = await Promise.all([
  readFile(resolve(REPOSITORY_ROOT, "public/index.html"), "utf8"),
  readFile(resolve(REPOSITORY_ROOT, "public/app/course-app.js"), "utf8"),
]);

test("classic runtime dependencies load before the course composition root", () => {
  const routerIndex = index.indexOf('src="/app/routing/course-router.js"');
  const runnerIndex = index.indexOf('src="/workers/python-runner-client.js"');
  const appIndex = index.indexOf('src="/app/course-app.js"');

  assert.ok(routerIndex >= 0, "course router script is missing");
  assert.ok(runnerIndex >= 0, "Python runner client script is missing");
  assert.ok(appIndex >= 0, "course app script is missing");
  assert.ok(routerIndex < appIndex, "router must load before the composition root");
  assert.ok(runnerIndex < appIndex, "runner client must load before the composition root");
  assert.match(
    index.slice(routerIndex, appIndex),
    /\bdefer\b/gu,
    "classic runtime dependencies must preserve deferred execution",
  );
});

test("course app consumes extracted runtime namespaces without private copies", () => {
  assert.match(courseApp, /window\.COURSE_ROUTER/u);
  assert.match(courseApp, /window\.PYTHON_RUNNER_CLIENT/u);
  assert.doesNotMatch(courseApp, /function parseRoute\s*\(/u);
  assert.doesNotMatch(courseApp, /function getRouteAnnouncement\s*\(/u);
  assert.doesNotMatch(courseApp, /function createPythonRunner\s*\(/u);
  assert.match(
    courseApp,
    /courseRouter\.parseRoute\(window\.location\.hash, routeRegistries\)/u,
  );
});
