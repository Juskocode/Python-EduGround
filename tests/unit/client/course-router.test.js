import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/app/routing/course-router.js"),
  "utf8",
);
const context = vm.createContext({ window: {} });
vm.runInContext(source, context, { filename: "course-router.js" });

const router = context.window.COURSE_ROUTER;
const chapter = { id: "py13", title: "Pygame Game Lab" };
const exercise = {
  id: "py13-snake-advance",
  title: "Advance the Snake",
};
const assessment = {
  id: "py10-py12",
  title: "Algorithms and Problem Solving",
};
const registries = {
  chapterById: new Map([[chapter.id, chapter]]),
  exerciseById: new Map([[exercise.id, exercise]]),
  chapterForExercise: new Map([[exercise.id, chapter]]),
  assessmentById: new Map([[assessment.id, assessment]]),
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("router publishes a small frozen classic-script API", () => {
  assert.equal(Object.isFrozen(router), true);
  assert.equal(typeof router.parseRoute, "function");
  assert.equal(typeof router.getRouteAnnouncement, "function");
  assert.deepEqual(Object.keys(router).sort(), [
    "getRouteAnnouncement",
    "parseRoute",
  ]);
});

test("landing, dashboard, and legacy chapter routes preserve their contracts", () => {
  assert.deepEqual(plain(router.parseRoute("", registries)), { name: "landing" });
  assert.deepEqual(
    plain(router.parseRoute("#/welcome/", registries)),
    { name: "landing" },
  );
  assert.deepEqual(
    plain(router.parseRoute("#home", registries)),
    { name: "home" },
  );
  assert.deepEqual(
    plain(router.parseRoute("#py13", registries)),
    { redirect: "#chapter/py13" },
  );
});

test("chapter and exercise routes retain registry object identity", () => {
  for (const [hash, name] of [
    ["#chapter/py13", "chapter"],
    ["#chapter/py13/exercises", "exercises"],
    ["#chapter/py13/tutorials", "tutorial"],
    ["#chapter/py13/tutorial", "tutorial"],
    ["#chapter/py13/runbook", "tutorial"],
  ]) {
    const route = router.parseRoute(hash, registries);
    assert.equal(route.name, name, hash);
    assert.equal(route.chapter, chapter, hash);
  }

  const route = router.parseRoute("#exercise/py13-snake-advance", registries);
  assert.equal(route.name, "exercise");
  assert.equal(route.exercise, exercise);
  assert.equal(route.chapter, chapter);
});

test("assessment, badge, and recap routes preserve exact mode data", () => {
  assert.deepEqual(
    plain(router.parseRoute("#profile/badges", registries)),
    { name: "badges" },
  );
  assert.deepEqual(
    plain(router.parseRoute("#assessments", registries)),
    { name: "assessments" },
  );

  const block = router.parseRoute("#assessment/py10-py12", registries);
  assert.equal(block.name, "assessment-block");
  assert.equal(block.block, assessment);

  const mode = router.parseRoute("#assessment/py10-py12/practical", registries);
  assert.equal(mode.name, "assessment-mode");
  assert.equal(mode.mode, "practical");
  assert.equal(mode.block, assessment);

  const recap = router.parseRoute("#stage/py10-py12/recap", registries);
  assert.equal(recap.name, "stage-recap");
  assert.equal(recap.block, assessment);
});

test("unknown, extra, and malformed routes fail closed to the dashboard", () => {
  for (const hash of [
    "#chapter/py99",
    "#chapter/py13/solutions",
    "#assessment/py10-py12/answers",
    "#exercise/not-real",
    "#%E0%A4%A",
  ]) {
    assert.deepEqual(
      plain(router.parseRoute(hash, registries)),
      { redirect: "#home" },
      hash,
    );
  }
});

test("route announcements remain learner-facing and route specific", () => {
  assert.equal(
    router.getRouteAnnouncement({ name: "landing" }),
    "Opened the Python EduGround welcome page.",
  );
  assert.equal(
    router.getRouteAnnouncement({ name: "tutorial", chapter }),
    "Opened the Pygame Game Lab class materials.",
  );
  assert.equal(
    router.getRouteAnnouncement({ name: "exercise", exercise }),
    "Opened Advance the Snake.",
  );
  assert.equal(
    router.getRouteAnnouncement({
      name: "assessment-mode",
      block: assessment,
      mode: "practical",
    }),
    "Opened the practical room for Algorithms and Problem Solving.",
  );
  assert.equal(
    router.getRouteAnnouncement({ name: "unknown" }),
    "Opened the chapter dashboard.",
  );
});
