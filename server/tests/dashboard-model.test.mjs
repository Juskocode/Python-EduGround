import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(REPOSITORY_ROOT, "dashboard-model.js"), "utf8");
const context = vm.createContext({
  Array,
  Boolean,
  Map,
  Math,
  Number,
  Object,
  String,
  window: {},
});
vm.runInContext(source, context, { filename: "dashboard-model.js" });
const dashboard = context.window.DASHBOARD_MODEL;

function makeChapter(id, number, overrides = {}) {
  const exercises = overrides.exercises || { done: 0, total: 2, stars: 0, maxStars: 3 };
  const guide = overrides.guide || { done: 0, total: 5 };
  return {
    id,
    number,
    title: overrides.title || `Chapter ${number}`,
    summary: overrides.summary || "A focused Python chapter.",
    topics: overrides.topics || ["values", "tracing"],
    exercises,
    guide,
    exerciseItems: overrides.exerciseItems || [
      { id: `${id}-one`, title: `${id} first exercise`, passed: exercises.done >= 1 },
      { id: `${id}-two`, title: `${id} second exercise`, passed: exercises.done >= 2 },
    ],
  };
}

function makeInput(chapters, overrides = {}) {
  return {
    chapters,
    assessmentBlocks: overrides.assessmentBlocks || [
      {
        id: "stage-one",
        number: 1,
        title: "Stage one checkpoint",
        chapters: chapters.map((chapter) => chapter.id),
        passedModes: 0,
        totalModes: 2,
      },
    ],
    stats: {
      passedExercises: 0,
      totalExercises: chapters.reduce((total, chapter) => total + chapter.exercises.total, 0),
      earnedStars: 0,
      maxStars: chapters.reduce((total, chapter) => total + chapter.exercises.maxStars, 0),
      ...overrides.stats,
    },
    rank: { level: 1, name: "PEP Explorer", accent: "#3ccf91" },
    nextRank: { level: 2, name: "Indent Apprentice", minStars: 8 },
    unlockedBadges: 0,
    totalBadges: 8,
    passedAssessmentModes: 0,
    totalAssessmentModes: 2,
    lastExerciseId: overrides.lastExerciseId || "",
    note: "Solution-free teaching prompts.",
  };
}

test("a fresh learner starts with the first chapter learning guide", () => {
  const model = dashboard.build(makeInput([
    makeChapter("py01", 1),
    makeChapter("py02", 2),
  ]));

  assert.equal(model.resume.chapter.id, "py01");
  assert.equal(model.resume.href, "#chapter/py01/tutorials");
  assert.equal(model.resume.action, "Start learning");
  assert.equal(model.stages[0].status.id, "upcoming");
});

test("an unfinished last exercise resumes directly in the editor", () => {
  const py01 = makeChapter("py01", 1, {
    exercises: { done: 1, total: 2, stars: 1, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const model = dashboard.build(makeInput([py01, makeChapter("py02", 2)], {
    lastExerciseId: "py01-two",
    stats: { passedExercises: 1, totalExercises: 4, earnedStars: 1, maxStars: 6 },
  }));

  assert.equal(model.resume.chapter.id, "py01");
  assert.equal(model.resume.href, "#exercise/py01-two");
  assert.equal(model.resume.action, "Resume exercise");
  assert.equal(model.stages[0].status.id, "active");
});

test("a passed last exercise advances to the first chapter that is not mastered", () => {
  const py01 = makeChapter("py01", 1, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const py02 = makeChapter("py02", 2);
  const model = dashboard.build(makeInput([py01, py02], {
    lastExerciseId: "py01-two",
    stats: { passedExercises: 2, totalExercises: 4, earnedStars: 3, maxStars: 6 },
  }));

  assert.equal(model.resume.chapter.id, "py02");
  assert.equal(model.resume.href, "#chapter/py02/tutorials");
  assert.equal(model.resume.action, "Start learning");
});

test("mastering every chapter exposes the stage checkpoint", () => {
  const mastered = makeChapter("py01", 1, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const model = dashboard.build(makeInput([mastered], {
    stats: { passedExercises: 2, totalExercises: 2, earnedStars: 3, maxStars: 3 },
  }));

  assert.equal(model.stages[0].status.id, "checkpoint");
  assert.equal(model.stages[0].status.label, "Checkpoint ready");
  assert.equal(model.resume.kind, "assessment");
  assert.equal(model.resume.href, "#assessment/stage-one");
  assert.equal(model.resume.action, "Open checkpoint");
  assert.equal(model.heading, "Your next checkpoint is ready.");
});

test("passing both assessment rooms completes a mastered stage", () => {
  const mastered = makeChapter("py01", 1, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const input = makeInput([mastered], {
    stats: { passedExercises: 2, totalExercises: 2, earnedStars: 3, maxStars: 3 },
  });
  input.assessmentBlocks[0].passedModes = 2;
  const model = dashboard.build(input);

  assert.equal(model.stages[0].status.id, "complete");
  assert.equal(model.stages[0].progress.percent, 100);
  assert.equal(model.resume.href, "#profile/badges");
});

test("a fully mastered and assessed path routes the learner to achievements", () => {
  const mastered = makeChapter("py01", 1, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const input = makeInput([mastered], {
    lastExerciseId: "py01-two",
    stats: { passedExercises: 2, totalExercises: 2, earnedStars: 3, maxStars: 3 },
  });
  input.assessmentBlocks[0].passedModes = 2;
  const model = dashboard.build(input);

  assert.equal(model.resume.eyebrow, "Path complete");
  assert.equal(model.resume.href, "#profile/badges");
  assert.equal(model.resume.action, "View achievements");
});
