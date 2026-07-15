import assert from "node:assert/strict";
import test from "node:test";

import { mergeLearnerState } from "../learner-state.mjs";

test("learner state preserves future fields and unions monotonic progress", () => {
  const current = {
    schemaVersion: 4,
    futureFeature: { enabled: true, records: ["keep-me"] },
    passedIds: ["py02-hypotenuse", "py01-first-programs"],
    learningProgress: {
      py01: ["runbook", "tutorial-input"],
      py02: ["tutorial-numbers"],
    },
    drafts: { "py01-first-programs": "print('older')\n" },
    editorMode: "vim",
  };
  const incoming = {
    schemaVersion: 2,
    passedIds: ["py01-first-programs", "py03-divisors"],
    learningProgress: {
      py01: ["tutorial-input", "tutorial-output"],
      py03: ["runbook"],
    },
    drafts: { "py03-divisors": "def divisors(value):\n    pass\n" },
    editorMode: "sublime",
  };

  const merged = mergeLearnerState(current, incoming);

  assert.deepEqual(merged.futureFeature, current.futureFeature);
  assert.equal(merged.schemaVersion, 4);
  assert.deepEqual(merged.passedIds, [
    "py01-first-programs",
    "py02-hypotenuse",
    "py03-divisors",
  ]);
  assert.deepEqual(merged.learningProgress, {
    py01: ["runbook", "tutorial-input", "tutorial-output"],
    py02: ["tutorial-numbers"],
    py03: ["runbook"],
  });
  assert.deepEqual(merged.drafts, incoming.drafts);
  assert.equal(merged.editorMode, "sublime");
});

test("assessment progress retains submitted attempts and merges immutable history by id", () => {
  const current = {
    assessmentProgress: {
      version: 2,
      blocks: {
        "py01-py03": {
          theory: {
            active: { id: "active-old", status: "active", answers: { q1: ["a"] } },
            completed: true,
            bestScore: 80,
            coachMetadata: { source: "2019-paper" },
            history: [
              {
                id: "theory-1",
                blockId: "py01-py03",
                mode: "theory",
                status: "submitted",
                startedAt: "2026-07-15T08:00:00.000Z",
                submittedAt: "2026-07-15T08:10:00.000Z",
                score: 80,
                passed: true,
                results: [{ questionId: "q1", correct: true, expected: "A" }],
              },
            ],
          },
        },
      },
    },
  };
  const incoming = {
    assessmentProgress: {
      version: 1,
      blocks: {
        "py01-py03": {
          theory: {
            active: { id: "active-new", status: "active", answers: { q2: ["b"] } },
            completed: false,
            bestScore: 60,
            history: [
              {
                id: "theory-1",
                status: "active",
                score: 50,
                passed: false,
                feedback: "reviewed",
                results: [],
              },
              {
                id: "theory-2",
                blockId: "py01-py03",
                mode: "theory",
                status: "submitted",
                startedAt: "2026-07-15T09:00:00.000Z",
                submittedAt: "2026-07-15T09:12:00.000Z",
                score: 60,
                passed: true,
                results: [{ questionId: "q2", correct: true }],
              },
            ],
          },
          practical: {
            active: null,
            history: [],
          },
        },
      },
    },
  };

  const merged = mergeLearnerState(current, incoming).assessmentProgress;
  const theory = merged.blocks["py01-py03"].theory;

  assert.equal(merged.version, 2);
  assert.deepEqual(theory.active, incoming.assessmentProgress.blocks["py01-py03"].theory.active);
  assert.equal(theory.completed, true);
  assert.equal(theory.bestScore, 80);
  assert.deepEqual(theory.coachMetadata, { source: "2019-paper" });
  assert.equal(theory.history.length, 2);
  assert.deepEqual(theory.history.map((attempt) => attempt.id), ["theory-2", "theory-1"]);
  const retainedAttempt = theory.history.find((attempt) => attempt.id === "theory-1");
  assert.equal(retainedAttempt.status, "submitted");
  assert.equal(retainedAttempt.score, 80);
  assert.equal(retainedAttempt.passed, true);
  assert.equal(retainedAttempt.feedback, "reviewed");
  assert.deepEqual(retainedAttempt.results, [
    { questionId: "q1", correct: true, expected: "A" },
  ]);
  assert.deepEqual(merged.blocks["py01-py03"].practical, {
    active: null,
    history: [],
    bestScore: 0,
    completed: false,
  });
});

test("top-level assessment histories and completions cannot be erased by stale snapshots", () => {
  const current = {
    assessmentAttempts: {
      block1: [{ id: "attempt-1", status: "submitted", score: 75, passed: true }],
    },
    assessmentCompletions: {
      block1: { theory: true, practical: false },
      completedBlockIds: ["block1"],
    },
  };
  const incoming = {
    assessmentAttempts: {
      block1: [{ id: "attempt-2", status: "submitted", score: 65, passed: true }],
    },
    assessmentCompletions: {
      block1: { theory: false, practical: true },
      completedBlockIds: [],
    },
  };

  const merged = mergeLearnerState(current, incoming);

  assert.deepEqual(
    merged.assessmentAttempts.block1.map((attempt) => attempt.id),
    ["attempt-1", "attempt-2"]
  );
  assert.deepEqual(merged.assessmentCompletions, {
    block1: { theory: true, practical: true },
    completedBlockIds: ["block1"],
  });
  assert.deepEqual(
    mergeLearnerState(merged, incoming),
    merged,
    "replaying a snapshot must be idempotent"
  );
});

test("assessment histories retain only the ten newest attempts", () => {
  const current = {
    assessmentProgress: {
      blocks: {
        block1: {
          theory: {
            history: Array.from({ length: 8 }, (_, index) => ({
              id: `older-${index}`,
              status: "submitted",
              submittedAt: 1_000 + index,
              score: index === 0 ? 100 : index,
              passed: index === 0,
            })),
          },
        },
      },
    },
  };
  const incoming = {
    assessmentProgress: {
      blocks: {
        block1: {
          theory: {
            history: Array.from({ length: 8 }, (_, index) => ({
              id: `newer-${index}`,
              status: "submitted",
              submittedAt: 2_000 + index,
              score: 50 + index,
            })),
          },
        },
      },
    },
  };

  const history = mergeLearnerState(current, incoming)
    .assessmentProgress.blocks.block1.theory.history;

  assert.equal(history.length, 10);
  assert.deepEqual(
    history.map((attempt) => attempt.submittedAt),
    history.map((attempt) => attempt.submittedAt).slice().sort((left, right) => right - left)
  );
  assert.ok(history.every((attempt) => attempt.id.startsWith("newer-") || attempt.id === "older-7" || attempt.id === "older-6"));
  const theory = mergeLearnerState(current, incoming)
    .assessmentProgress.blocks.block1.theory;
  assert.equal(theory.bestScore, 100);
  assert.equal(theory.completed, true);
  assert.equal(theory.history.some((attempt) => attempt.passed), false);
});

test("repeated assessment snapshots remain bounded and keep monotonic achievement facts", () => {
  let stored = {};
  for (let index = 0; index < 25; index += 1) {
    const attempt = {
      id: `attempt-${String(index).padStart(2, "0")}`,
      status: "submitted",
      submittedAt: 10_000 + index,
      score: index === 0 ? 100 : 20,
      passed: index === 0,
    };
    const priorHistory = stored.assessmentProgress?.blocks?.block1?.theory?.history || [];
    stored = mergeLearnerState(stored, {
      schemaVersion: 2,
      assessmentProgress: {
        blocks: {
          block1: {
            theory: {
              history: [...priorHistory, attempt],
            },
          },
        },
      },
    });
  }

  const theory = stored.assessmentProgress.blocks.block1.theory;
  assert.equal(theory.history.length, 10);
  assert.deepEqual(
    theory.history.map((attempt) => attempt.id),
    Array.from({ length: 10 }, (_, index) => `attempt-${String(24 - index).padStart(2, "0")}`)
  );
  assert.equal(theory.history.some((attempt) => attempt.passed), false);
  assert.equal(theory.bestScore, 100);
  assert.equal(theory.completed, true);
  assert.equal(stored.schemaVersion, 2);
});

test("merge is pure and an explicit incoming unknown field may replace its prior value", () => {
  const current = {
    unknownPreference: { density: "comfortable" },
    passedIds: ["py01-first-programs"],
  };
  const incoming = {
    unknownPreference: { density: "compact" },
    passedIds: ["py01-fixme"],
  };
  const currentSnapshot = structuredClone(current);
  const incomingSnapshot = structuredClone(incoming);

  const merged = mergeLearnerState(current, incoming);

  assert.deepEqual(merged.unknownPreference, { density: "compact" });
  assert.deepEqual(current, currentSnapshot);
  assert.deepEqual(incoming, incomingSnapshot);
});

test("untrusted state keys cannot modify object prototypes", () => {
  const incoming = JSON.parse(
    '{"__proto__":{"polluted":true},"assessmentProgress":{"blocks":{"constructor":{"history":[]}}}}'
  );

  const merged = mergeLearnerState({}, incoming);

  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(merged, "__proto__"), false);
  assert.deepEqual(merged.assessmentProgress, { blocks: {} });
});
