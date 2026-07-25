import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/features/dashboard/dashboard-model.js"),
  "utf8",
);
const context = vm.createContext({
  Array,
  Boolean,
  Map,
  Math,
  Number,
  Object,
  String,
  encodeURIComponent,
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
    recapQuestions: overrides.recapQuestions || [
      `Explain the central idea from chapter ${number}.`,
    ],
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
        modes: [
          { id: "theory", completed: false, bestScore: 0 },
          { id: "practical", completed: false, bestScore: 0 },
        ],
        references: [
          {
            label: "Python tutorial",
            description: "Official reference.",
            url: "https://docs.python.org/3/tutorial/",
          },
        ],
        recap: {
          id: "stage-one-recap",
          title: "Reconnect stage one",
          summary: "A compact synthesis.",
          outcomes: ["Trace a fresh example."],
          recall: [
            { prompt: "What changed?", answer: "The program state changed." },
          ],
          bridge: "Use the model under time.",
        },
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
  assert.deepEqual(
    Array.from(model.resume.steps, (step) => [step.id, step.state.id]),
    [
      ["guide", "current"],
      ["exercises", "upcoming"],
      ["assessment", "upcoming"],
    ]
  );
  assert.equal(model.overview.chapters, 2);
  assert.equal(model.overview.progress.percent, 0);
  assert.equal(model.overview.focus.id, "py01");
  assert.equal(model.overview.nextChapter.id, "py02");
  assert.equal(model.stages[0].recap.state.id, "preview");
  assert.equal(model.stages[0].recap.chapterPrompts.length, 2);
  assert.equal(model.stages[0].recap.chapterPrompts[0].chapterId, "py01");
  assert.equal(model.stages[0].recap.references.length, 1);
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
  assert.equal(model.stages[0].recap.state.id, "ready");
  assert.equal(model.stages[0].recap.nextAction.href, "#assessment/stage-one/theory");
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
  assert.equal(model.stages[0].recap.state.id, "complete");
  assert.equal(model.resume.href, "#profile/badges");
  assert.deepEqual(
    Array.from(model.snakeAmbience.groups, (group) => [group.tone, group.count]),
    [
      ["green", 1],
      ["blue", 1],
      ["yellow", 2],
    ]
  );
  assert.equal(model.snakeAmbience.totalEarned, 4);
  assert.equal(Object.isFrozen(model.snakeAmbience), true);
  assert.equal(Object.isFrozen(model.snakeAmbience.groups), true);
  assert.equal(Object.isFrozen(model.snakeAmbience.groups[0]), true);
  assert.deepEqual(
    Array.from(model.stages[0].snakeAmbience.groups, (group) => [group.tone, group.count]),
    [
      ["green", 1],
      ["blue", 1],
      ["yellow", 2],
    ]
  );
});

test("progress Snake colors come only from mastered chapters, stages, and passed rooms", () => {
  const fresh = dashboard.build(makeInput([
    makeChapter("py01", 1),
    makeChapter("py02", 2),
  ]));
  assert.deepEqual(
    Array.from(fresh.snakeAmbience.groups, (group) => group.count),
    [0, 0, 0]
  );

  const mastered = makeChapter("py01", 1, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const input = makeInput([mastered, makeChapter("py02", 2)]);
  input.assessmentBlocks[0].passedModes = 9;
  input.assessmentBlocks[0].totalModes = 2;
  const partial = dashboard.build(input);

  assert.equal(partial.stages[0].assessment.passedModes, 2);
  assert.deepEqual(
    Array.from(partial.snakeAmbience.groups, (group) => [group.id, group.count, group.total]),
    [
      ["chapters", 1, 2],
      ["stages", 0, 1],
      ["tests", 2, 2],
    ]
  );
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

test("chapters outside assessment blocks remain discoverable as independent practice", () => {
  const py01 = makeChapter("py01", 1);
  const py12 = makeChapter("py12", 12, {
    title: "Problem Solving Patterns",
    topics: ["dynamic programming", "knapsack", "state transitions"],
  });
  const model = dashboard.build(makeInput([py01, py12], {
    assessmentBlocks: [
      {
        id: "stage-one",
        number: 1,
        title: "Stage one checkpoint",
        chapters: ["py01"],
        passedModes: 0,
        totalModes: 2,
      },
    ],
  }));

  assert.equal(model.stages.length, 2);
  assert.equal(model.stages[1].id, "independent-practice");
  assert.equal(model.stages[1].title, "Independent Problem Solving");
  assert.deepEqual(
    Array.from(model.stages[1].chapters, (chapter) => chapter.id),
    ["py12"]
  );
  assert.equal(model.stages[1].assessment, null);
  assert.equal(model.overview.chapters, 2);
});

test("the final Python Pathforger badge follows whole-course completion", () => {
  const masteredOne = makeChapter("py01", 1, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const masteredFinal = makeChapter("py12", 12, {
    exercises: { done: 2, total: 2, stars: 3, maxStars: 3 },
    guide: { done: 5, total: 5 },
  });
  const award = {
    id: "python-pathforger",
    name: "Python Pathforger",
    monogram: "PY∞",
    description: "Complete the whole path.",
  };
  const blocks = (firstPassed, finalPassed) => [
    {
      id: "py01-py03",
      number: 1,
      title: "Foundations",
      chapters: ["py01"],
      passedModes: firstPassed,
      totalModes: 2,
      recap: { title: "Foundations recap" },
    },
    {
      id: "py10-py11",
      number: 4,
      title: "Algorithms",
      chapters: ["py12"],
      passedModes: finalPassed,
      totalModes: 2,
      recap: { title: "Algorithms recap", award },
    },
  ];

  const ready = dashboard.build(makeInput([masteredOne, masteredFinal], {
    assessmentBlocks: blocks(2, 0),
    stats: { passedExercises: 4, totalExercises: 4, earnedStars: 6, maxStars: 6 },
  }));
  assert.equal(ready.completionAward.state.id, "ready");
  assert.equal(ready.completionAward.href, "#assessment/py10-py11");
  assert.equal(ready.pathComplete, false);

  const unlocked = dashboard.build(makeInput([masteredOne, masteredFinal], {
    assessmentBlocks: blocks(2, 2),
    stats: { passedExercises: 4, totalExercises: 4, earnedStars: 6, maxStars: 6 },
  }));
  assert.equal(unlocked.completionAward.state.id, "unlocked");
  assert.equal(unlocked.completionAward.href, "#profile/badges");
  assert.equal(unlocked.pathComplete, true);
  assert.equal(unlocked.stages[1].id, "py10-py11");

  const finalOutOfOrder = dashboard.build(makeInput([
    makeChapter("py01", 1),
    masteredFinal,
  ], {
    assessmentBlocks: blocks(0, 2),
    stats: { passedExercises: 2, totalExercises: 4, earnedStars: 3, maxStars: 6 },
  }));
  assert.equal(finalOutOfOrder.stages[1].status.id, "complete");
  assert.equal(finalOutOfOrder.completionAward.state.id, "locked");
  assert.equal(finalOutOfOrder.pathComplete, false);
});
