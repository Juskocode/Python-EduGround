import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/content/onboarding-content.js"),
  "utf8",
);
const context = vm.createContext({ Object, window: {} });
vm.runInContext(source, context, { filename: "onboarding-content.js" });

const onboarding = context.window.ONBOARDING_CONTENT;
const python = process.env.PYTHON_BIN || "python3";

function assertDeeplyFrozen(value, path = "ONBOARDING_CONTENT", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  Object.entries(value).forEach(([key, child]) => {
    assertDeeplyFrozen(child, `${path}.${key}`, seen);
  });
}

function runPython(code) {
  return spawnSync(python, ["-c", code], {
    encoding: "utf8",
    timeout: 5_000,
  });
}

test("Chapter 0 is a deeply frozen, ungraded onboarding contract", () => {
  assertDeeplyFrozen(onboarding);
  assert.equal(onboarding.chapter.id, "py00");
  assert.equal(onboarding.chapter.number, "00");
  assert.equal(onboarding.chapter.kind, "onboarding");
  assert.equal(onboarding.material.id, "py00-launch-python-class");
  assert.equal(onboarding.material.estimatedMinutes, 40);
  assert.equal(onboarding.handoff.href, "#chapter/py01/tutorials");

  for (const forbidden of [
    "exercises",
    "stars",
    "maxStars",
    "rank",
    "assessment",
  ]) {
    assert.equal(
      Object.hasOwn(onboarding.chapter, forbidden),
      false,
      `Chapter 0 must not expose graded field ${forbidden}`,
    );
  }
});

test("Chapter 0 provides a complete beginner route with stable checkpoints", () => {
  const tasks = onboarding.material.roomTasks;
  const taskIds = Array.from(tasks, (task) => task.id);
  assert.deepEqual(taskIds, [
    "py00-choose-a-goal",
    "py00-browser-or-local",
    "py00-workspace-interpreter",
    "py00-first-signal",
    "py00-read-the-error",
    "py00-run-before-check",
  ]);
  assert.equal(new Set(taskIds).size, taskIds.length);
  assert.equal(tasks.filter((task) => task.kind === "code").length, 1);
  assert.equal(onboarding.learning.tutorial.length, 5);
  assert.equal(onboarding.learning.runbook.length, 5);
  assert.ok(onboarding.material.pageSummary.length >= 4);
  assert.ok(onboarding.material.recapQuestions.length >= 8);

  const browserTask = tasks.find((task) => task.id === "py00-browser-or-local");
  assert.ok(browserTask.acceptedAnswers.includes("browser"));
  assert.match(onboarding.material.prerequisites.join(" "), /internet connection/iu);
  assert.match(onboarding.material.preparation.join(" "), /http or https/iu);
});

test("the editable first run and code checkpoint match their labelled output", () => {
  const demo = onboarding.material.lectureDemo;
  const demoResult = runPython(demo.code);
  assert.ifError(demoResult.error);
  assert.equal(demoResult.status, 0, demoResult.stderr);
  assert.equal(demoResult.stdout.trimEnd(), demo.expectedOutput);
  assert.equal(demoResult.stderr, "");

  const task = onboarding.material.roomTasks.find(
    (candidate) => candidate.id === "py00-first-signal",
  );
  const completedSource = `${task.starterCode}\nprint(message)\n`;
  const taskResult = runPython(completedSource);
  assert.ifError(taskResult.error);
  assert.equal(taskResult.status, 0, taskResult.stderr);
  assert.equal(taskResult.stdout.trimEnd(), task.expectedOutput);
  assert.match(completedSource, new RegExp(task.sourceRules[0].pattern, "u"));
  assert.doesNotMatch(completedSource, new RegExp(task.sourceRules[1].pattern, "u"));
});

test("all Chapter 0 references use official Python documentation", () => {
  assert.ok(onboarding.learning.documentation.length >= 4);
  onboarding.learning.documentation.forEach((reference) => {
    const url = new URL(reference.url);
    assert.equal(url.origin, "https://docs.python.org");
    assert.match(url.pathname, /^\/3\//u);
  });
});
