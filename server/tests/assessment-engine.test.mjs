import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {};
await import("../../assessment-engine.js");

const engine = globalThis.window.ASSESSMENT_ENGINE;
const config = {
  version: 1,
  blocks: [
    {
      id: "py01-py03",
      theory: { durationSeconds: 20 * 60, passPercent: 60 },
      practical: { durationSeconds: 60 * 60, passPercent: 60 },
    },
  ],
};

function theoryQuestions() {
  return Array.from({ length: 15 }, (_, index) => ({
    id: `theory-${index + 1}`,
    correct: index === 0 ? [0, 2] : [1],
  }));
}

function theoryAnswers(correctCount) {
  return Object.fromEntries(theoryQuestions().map((question, index) => [
    question.id,
    index < correctCount ? question.correct.slice().reverse() : [3],
  ]));
}

function practicalQuestions() {
  return Array.from({ length: 5 }, (_, questionIndex) => ({
    id: `practical-${questionIndex + 1}`,
    tests: [
      { id: `practical-${questionIndex + 1}-visible` },
      { id: `practical-${questionIndex + 1}-hidden` },
    ],
  }));
}

function practicalResults(passedQuestions) {
  return Object.fromEntries(practicalQuestions().map((question, index) => [
    question.id,
    {
      results: question.tests.map((definition, testIndex) => ({
        id: definition.id,
        passed: index < passedQuestions || testIndex === 0,
      })),
    },
  ]));
}

function submittedAttempt(id, score, submittedAt) {
  return {
    id,
    status: "submitted",
    startedAt: submittedAt - 1_000,
    deadlineAt: submittedAt,
    submittedAt,
    updatedAt: submittedAt,
    score,
    passed: score >= 60,
    answers: { shouldNotRemainInCompactHistory: [1] },
    results: [
      { questionId: "theory-1", correct: true, selected: [0, 2] },
    ],
  };
}

test("multiple-answer grading requires the exact set without depending on order", () => {
  assert.equal(engine.sameAnswerSet([0, 2], [2, 0]), true);
  assert.equal(engine.sameAnswerSet(["2", "0"], [0, 2]), true);
  assert.equal(engine.sameAnswerSet([0, 0, 2], [0, 2]), true);
  assert.equal(engine.sameAnswerSet([0], [0, 2]), false);
  assert.equal(engine.sameAnswerSet([0, 1, 2], [0, 2]), false);
});

test("theory requires at least 9 of 15 exact answers for 60 percent", () => {
  const passing = engine.scoreTheory(theoryQuestions(), theoryAnswers(9), { passPercent: 60 });
  assert.equal(passing.correctCount, 9);
  assert.equal(passing.totalCount, 15);
  assert.equal(passing.score, 60);
  assert.equal(passing.passed, true);

  const failing = engine.scoreTheory(theoryQuestions(), theoryAnswers(8), { passPercent: 60 });
  assert.equal(failing.correctCount, 8);
  assert.equal(failing.score, 53.33);
  assert.equal(failing.passed, false);
});

test("practical questions award 20 points only when every expected test passes", () => {
  const passing = engine.scorePractical(
    practicalQuestions(),
    practicalResults(3),
    { passPercent: 60, pointsPerQuestion: 20 },
  );
  assert.equal(passing.passedCount, 3);
  assert.equal(passing.earnedPoints, 60);
  assert.equal(passing.score, 60);
  assert.equal(passing.passed, true);
  assert.deepEqual(passing.items.map((item) => item.points), [20, 20, 20, 0, 0]);

  const failing = engine.scorePractical(
    practicalQuestions(),
    practicalResults(2),
    { passPercent: 60, pointsPerQuestion: 20 },
  );
  assert.equal(failing.passedCount, 2);
  assert.equal(failing.earnedPoints, 40);
  assert.equal(failing.score, 40);
  assert.equal(failing.passed, false);

  const wrongTestIds = practicalResults(5);
  wrongTestIds["practical-1"].results[0].id = "another-question-test";
  const mismatched = engine.scorePractical(practicalQuestions(), wrongTestIds);
  assert.equal(mismatched.items[0].passed, false, "passing unrelated test IDs must not earn points");
});

test("absolute 20 and 60 minute deadlines survive serialized reloads", () => {
  const startedAt = Date.UTC(2026, 6, 15, 10, 0, 0);
  const theory = engine.createAttempt(config, {
    id: "theory-reload-attempt",
    blockId: "py01-py03",
    mode: "theory",
    startedAt,
    answers: { "theory-1": [0, 2] },
  });
  const practical = engine.createAttempt(config, {
    id: "practical-reload-attempt",
    blockId: "py01-py03",
    mode: "practical",
    startedAt,
    drafts: { "practical-1": "def solve():\n    return 1\n" },
  });

  assert.equal(theory.deadlineAt, startedAt + 20 * 60 * 1_000);
  assert.equal(practical.deadlineAt, startedAt + 60 * 60 * 1_000);
  assert.equal(engine.remainingSeconds(theory.deadlineAt, startedAt + 5 * 60 * 1_000), 15 * 60);
  assert.equal(engine.remainingSeconds(practical.deadlineAt, startedAt + 5 * 60 * 1_000), 55 * 60);

  const stored = engine.createProgress(config);
  stored.blocks["py01-py03"].theory.active = theory;
  stored.blocks["py01-py03"].practical.active = practical;
  const reloaded = engine.sanitizeProgress(JSON.parse(JSON.stringify(stored)), config);
  assert.equal(reloaded.blocks["py01-py03"].theory.active.deadlineAt, theory.deadlineAt);
  assert.deepEqual(reloaded.blocks["py01-py03"].theory.active.answers, { "theory-1": [0, 2] });
  assert.equal(engine.remainingSeconds(reloaded.blocks["py01-py03"].theory.active.deadlineAt, startedAt + 5 * 60 * 1_000), 900);
  assert.equal(engine.remainingSeconds(theory.deadlineAt, theory.deadlineAt + 1), 0);
});

test("created and sanitized attempts retain unique immutable IDs", () => {
  const first = engine.createAttempt(config, {
    blockId: "py01-py03",
    mode: "theory",
    startedAt: 1_000,
  });
  const second = engine.createAttempt(config, {
    blockId: "py01-py03",
    mode: "theory",
    startedAt: 2_000,
  });
  assert.notEqual(first.id, second.id);
  assert.throws(() => { first.id = "replacement"; }, TypeError);
  assert.notEqual(first.id, "replacement");

  const progress = engine.createProgress(config);
  progress.blocks["py01-py03"].theory.active = first;
  const clean = engine.sanitizeProgress(JSON.parse(JSON.stringify(progress)), config);
  assert.throws(() => { clean.blocks["py01-py03"].theory.active.id = "replacement"; }, TypeError);
  assert.equal(clean.blocks["py01-py03"].theory.active.id, first.id);
});

test("local and remote progress union attempts without losing submitted results", () => {
  const local = engine.createProgress(config);
  const remote = engine.createProgress(config);
  local.blocks["py01-py03"].theory.active = engine.createAttempt(config, {
    id: "shared-active",
    blockId: "py01-py03",
    mode: "theory",
    startedAt: 10_000,
    updatedAt: 12_000,
    answers: { "theory-1": [0, 2], "theory-2": [1] },
    currentQuestionId: "theory-2",
  });
  remote.blocks["py01-py03"].theory.active = engine.createAttempt(config, {
    id: "shared-active",
    blockId: "py01-py03",
    mode: "theory",
    startedAt: 10_000,
    updatedAt: 13_000,
    answers: { "theory-3": [1] },
    flaggedQuestionIds: ["theory-3"],
  });
  local.blocks["py01-py03"].theory.history = [submittedAttempt("local-result", 80, 20_000)];
  remote.blocks["py01-py03"].theory.history = [submittedAttempt("remote-result", 60, 21_000)];

  const merged = engine.mergeProgress(local, remote, config);
  const mode = merged.blocks["py01-py03"].theory;
  assert.equal(mode.active.id, "shared-active");
  assert.deepEqual(mode.active.answers, {
    "theory-1": [0, 2],
    "theory-2": [1],
    "theory-3": [1],
  });
  assert.equal(mode.active.currentQuestionId, "theory-2");
  assert.deepEqual(mode.active.flaggedQuestionIds, ["theory-3"]);
  assert.deepEqual(new Set(mode.history.map((attempt) => attempt.id)), new Set(["local-result", "remote-result"]));
  assert.deepEqual(mode.history.map((attempt) => attempt.score).sort(), [60, 80]);
  assert.equal(Object.hasOwn(mode.history[0], "answers"), false, "submitted history should stay compact");
  assert.deepEqual(mode.history[0].results, [
    { questionId: "theory-1", correct: true, selected: [0, 2] },
  ], "bounded review feedback should survive reload and merge");
});

test("a submitted copy of an attempt wins over a stale active copy and history is capped", () => {
  const local = engine.createProgress(config);
  const remote = engine.createProgress(config);
  local.blocks["py01-py03"].practical.active = engine.createAttempt(config, {
    id: "finished-elsewhere",
    blockId: "py01-py03",
    mode: "practical",
    startedAt: 1_000,
    updatedAt: 2_000,
    drafts: { "practical-1": "print('local draft')\n" },
  });
  remote.blocks["py01-py03"].practical.history = [
    submittedAttempt("finished-elsewhere", 60, 20_000),
    ...Array.from({ length: 12 }, (_, index) => submittedAttempt(
      `remote-${String(index).padStart(2, "0")}`,
      index,
      4_000 + index,
    )),
  ];

  const merged = engine.mergeProgress(local, remote, config);
  const mode = merged.blocks["py01-py03"].practical;
  assert.equal(mode.active, null);
  assert.equal(mode.history.length, engine.HISTORY_LIMIT);
  assert.ok(mode.history.some((attempt) => attempt.id === "finished-elsewhere"), "submitted attempt must survive the merge");
  assert.deepEqual(
    mode.history.map((attempt) => attempt.submittedAt),
    mode.history.map((attempt) => attempt.submittedAt).slice().sort((left, right) => right - left),
  );
});

test("best score and a previous pass survive the recent-history limit", () => {
  const progress = engine.createProgress(config);
  progress.blocks["py01-py03"].theory.history = [
    submittedAttempt("first-pass", 100, 1_000),
    ...Array.from({ length: 10 }, (_, index) => submittedAttempt(
      `later-failure-${index}`,
      20 + index,
      2_000 + index,
    )),
  ];

  const sanitized = engine.sanitizeProgress(progress, config);
  const mode = sanitized.blocks["py01-py03"].theory;

  assert.equal(mode.history.length, engine.HISTORY_LIMIT);
  assert.equal(mode.history.some((attempt) => attempt.id === "first-pass"), false);
  assert.equal(mode.history.some((attempt) => attempt.passed), false);
  assert.equal(mode.bestScore, 100);
  assert.equal(mode.completed, true);

  const staleSnapshot = engine.createProgress(config);
  staleSnapshot.blocks["py01-py03"].theory.history = mode.history;
  const merged = engine.mergeProgress(sanitized, staleSnapshot, config);
  assert.equal(merged.blocks["py01-py03"].theory.bestScore, 100);
  assert.equal(merged.blocks["py01-py03"].theory.completed, true);
});

test("future assessment fields and unknown blocks survive an older client reload and merge", () => {
  const future = engine.createProgress(config);
  future.futureRoot = { season: 2 };
  future.blocks["py01-py03"].futureBadge = "syntax-sage";
  future.blocks["py01-py03"].theory.futureModeSetting = { review: true };
  future.blocks["py12-py14"] = {
    theory: { history: [{ id: "future-result", score: 100 }] },
    customField: "keep-me",
  };

  const reloaded = engine.sanitizeProgress(JSON.parse(JSON.stringify(future)), config);
  assert.deepEqual(reloaded.futureRoot, { season: 2 });
  assert.equal(reloaded.blocks["py01-py03"].futureBadge, "syntax-sage");
  assert.deepEqual(reloaded.blocks["py01-py03"].theory.futureModeSetting, { review: true });
  assert.deepEqual(reloaded.blocks["py12-py14"], future.blocks["py12-py14"]);

  const local = engine.createProgress(config);
  local.localOnly = { retained: true };
  const merged = engine.mergeProgress(local, reloaded, config);
  assert.deepEqual(merged.localOnly, { retained: true });
  assert.deepEqual(merged.futureRoot, { season: 2 });
  assert.deepEqual(merged.blocks["py12-py14"], future.blocks["py12-py14"]);
});
