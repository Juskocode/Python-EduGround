import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const context = vm.createContext({ Object, window: {} });
const classMaterialsSource = await readFile(
  resolve(REPOSITORY_ROOT, "public/content/class-materials.js"),
  "utf8",
);
const solutionShapeSource = await readFile(
  resolve(REPOSITORY_ROOT, "public/features/exercise/solution-shape.js"),
  "utf8",
);
const courseAppSource = await readFile(
  resolve(REPOSITORY_ROOT, "public/app/course-app.js"),
  "utf8",
);
const pythonWorkerSource = await readFile(
  resolve(REPOSITORY_ROOT, "public/workers/python-runner-worker.js"),
  "utf8",
);

vm.runInContext(solutionShapeSource, context, { filename: "solution-shape.js" });
vm.runInContext(classMaterialsSource, context, { filename: "class-materials.js" });

const materials = context.window.CLASS_MATERIALS;
const solutionShape = context.SOLUTION_SHAPE;
const roomChapterIds = ["py01", "py02", "py03", "py13"];
const requiredPy01Concepts = [
  "computer-basics",
  "input-returns-str",
  "int-conversion",
  "float-conversion",
  "conversion-failure",
];
const passingCodeByTaskId = {
  "py01-int-conversion": [
    "raw_badge_count = input()",
    "badge_count = int(raw_badge_count)",
    "print(badge_count + 2)",
  ].join("\n"),
  "py01-float-conversion": [
    "raw_ribbon_length = input()",
    "ribbon_length = float(raw_ribbon_length)",
    "print(ribbon_length / 2)",
  ].join("\n"),
  "py02-room-groups-and-remainder": [
    "total_stickers = int(input())",
    "stickers_per_page = int(input())",
    "print(total_stickers // stickers_per_page, total_stickers % stickers_per_page)",
  ].join("\n"),
  "py02-room-directed-rounding": [
    "import math",
    "depth = float(input())",
    "print(math.floor(depth))",
    "print(math.ceil(depth))",
    "print(f\"{depth:.2f}\")",
  ].join("\n"),
  "py03-room-first-decision": [
    "visitor_age = int(input())",
    "if visitor_age < 16:",
    "    print(\"junior\")",
    "else:",
    "    print(\"standard\")",
  ].join("\n"),
  "py03-room-while-progress": [
    "practice_step = 1",
    "while practice_step <= 3:",
    "    print(\"practice\", practice_step)",
    "    practice_step += 1",
    "print(\"done\")",
  ].join("\n"),
  "py13-delta-time-distance": [
    "speed_px_per_second = 120",
    "elapsed_ms = 50",
    "elapsed_seconds = elapsed_ms / 1000",
    "distance = speed_px_per_second * elapsed_seconds",
    "print(f\"{distance:.1f}\")",
  ].join("\n"),
  "py13-deterministic-spawn": [
    "occupied = {0, 1, 4}",
    "candidates = [1, 4, 7, 2]",
    "spawn_cell = None",
    "for candidate in candidates:",
    "    if candidate not in occupied:",
    "        spawn_cell = candidate",
    "        break",
    "print(spawn_cell)",
  ].join("\n"),
  "py13-power-up-timer": [
    "mode = \"boosted\"",
    "remaining_ms = 900",
    "elapsed_ms = 1200",
    "remaining_ms = max(0, remaining_ms - elapsed_ms)",
    "if remaining_ms == 0:",
    "    mode = \"running\"",
    "print(mode, remaining_ms)",
  ].join("\n"),
  "py13-world-to-screen": [
    "screen_height = 240",
    "sprite_height = 24",
    "height_above_floor = 60",
    "screen_y = screen_height - sprite_height - height_above_floor",
    "print(screen_y)",
  ].join("\n"),
};

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function roomTasksFor(chapterId) {
  const tasks = materials?.[chapterId]?.roomTasks;
  assert.ok(Array.isArray(tasks), `${chapterId}: roomTasks must be an array`);
  return tasks;
}

function wordCount(value) {
  return String(value).trim().split(/\s+/u).filter(Boolean).length;
}

function normalizeAnswer(value) {
  return String(value).trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

function normalizeStdout(value) {
  return String(value)
    .replace(/\r\n?/gu, "\n")
    .replace(/\n$/u, "");
}

function stdinText(lines) {
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function compilePython(source, filename) {
  return spawnSync(
    process.env.PYTHON_BIN || "python3",
    ["-c", `import sys; compile(sys.stdin.read(), ${JSON.stringify(filename)}, 'exec')`],
    {
      encoding: "utf8",
      input: source,
      timeout: 5_000,
    },
  );
}

function runPython(source, stdin) {
  return spawnSync(
    process.env.PYTHON_BIN || "python3",
    ["-c", source],
    {
      encoding: "utf8",
      input: stdinText(stdin),
      timeout: 5_000,
    },
  );
}

test("interactive classroom chapters expose substantive, stable room-task contracts", () => {
  const allTaskIds = new Set();

  for (const chapterId of roomChapterIds) {
    const tasks = roomTasksFor(chapterId);
    assert.ok(tasks.length >= 3, `${chapterId}: expected at least three room tasks`);

    let answerTaskCount = 0;
    let codeTaskCount = 0;

    tasks.forEach((task, index) => {
      const label = `${chapterId}/room-task-${index + 1}`;
      assert.ok(task && typeof task === "object", `${label}: task must be an object`);
      assert.match(
        String(task.id || ""),
        new RegExp(`^${chapterId}-[a-z0-9]+(?:-[a-z0-9]+)*$`, "u"),
        `${label}: id must be stable, lowercase, and chapter-scoped`,
      );
      assert.equal(allTaskIds.has(task.id), false, `${label}: duplicate room-task id`);
      allTaskIds.add(task.id);

      for (const field of [
        "title",
        "summary",
        "prompt",
        "hint",
        "success",
      ]) {
        assert.ok(nonEmpty(task[field]), `${label}: ${field} must be non-empty`);
      }
      assert.ok(
        Array.isArray(task.explanation) &&
          task.explanation.length >= 2 &&
          task.explanation.every(nonEmpty),
        `${label}: explanation must contain at least two teaching paragraphs`,
      );
      assert.ok(
        wordCount(task.summary) >= 5,
        `${label}: summary should state a meaningful learning goal`,
      );
      assert.ok(
        wordCount(task.explanation.join(" ")) >= 12,
        `${label}: explanation should teach the idea, not only name it`,
      );
      assert.ok(
        wordCount(task.hint) >= 5,
        `${label}: hint should offer useful direction`,
      );
      assert.ok(
        wordCount(task.success) >= 5,
        `${label}: success feedback should reinforce the rule`,
      );
      assert.ok(
        task.kind === "answer" || task.kind === "code",
        `${label}: kind must be "answer" or "code"`,
      );

      if (task.kind === "answer") {
        answerTaskCount += 1;
        assert.ok(
          Array.isArray(task.acceptedAnswers) && task.acceptedAnswers.length > 0,
          `${label}: answer tasks need at least one accepted answer`,
        );
        task.acceptedAnswers.forEach((answer, answerIndex) => {
          assert.ok(
            nonEmpty(answer),
            `${label}/accepted-answer-${answerIndex + 1}: answer must be non-empty`,
          );
        });
      } else {
        codeTaskCount += 1;
        assert.ok(nonEmpty(task.starterCode), `${label}: code tasks need starterCode`);
        assert.ok(Array.isArray(task.stdin), `${label}: code tasks need a stdin array`);
        assert.equal(
          task.stdin.every((line) => typeof line === "string"),
          true,
          `${label}: every stdin value must be a string`,
        );
        assert.ok(
          nonEmpty(task.expectedOutput),
          `${label}: code tasks need a non-empty expectedOutput`,
        );
        assert.ok(
          Array.isArray(task.requirements) &&
            task.requirements.length >= 1 &&
            task.requirements.every(nonEmpty),
          `${label}: code tasks need visible learner requirements`,
        );
        const ruleValidation = solutionShape.validateRules(task.sourceRules);
        assert.equal(
          ruleValidation.valid,
          true,
          `${label}: sourceRules are invalid: ${ruleValidation.errors.join("; ")}`,
        );
        assert.equal(
          solutionShape.evaluate(task.starterCode, task.sourceRules).passed,
          false,
          `${label}: starterCode should require a learner edit before completion`,
        );
      }
    });

    assert.ok(answerTaskCount >= 1, `${chapterId}: expected at least one answer task`);
    assert.ok(codeTaskCount >= 1, `${chapterId}: expected at least one code task`);
  }
});

test("chapter one room-task IDs cover the complete beginner input and conversion path", () => {
  const taskIds = new Set(
    roomTasksFor("py01").map((task) => String(task.id).replace(/^py01-/u, "")),
  );

  for (const concept of requiredPy01Concepts) {
    assert.equal(
      taskIds.has(concept),
      true,
      `py01: expected a stable py01-${concept} room task`,
    );
  }
});

test("Pygame room missions form a prediction, evidence, transfer, and access pathway", () => {
  const pygameTaskIds = Array.from(roomTasksFor("py13"), (task) => String(task.id));
  const orderedMilestones = [
    "py13-transition-input",
    "py13-predict-paused-frame",
    "py13-delta-time-distance",
    "py13-deterministic-spawn",
    "py13-power-up-timer",
    "py13-render-committed-state",
    "py13-world-to-screen",
    "py13-redundant-feedback",
  ];

  assert.deepEqual(pygameTaskIds, orderedMilestones);

  const pygameText = JSON.stringify(materials.py13).toLocaleLowerCase("en");
  for (const concept of [
    "predict",
    "committed state",
    "replay",
    "pygame adapter",
    "redundant feedback",
    "reduced motion",
    "keyboard",
  ]) {
    assert.match(
      pygameText,
      new RegExp(concept.replace(/\s+/gu, "\\s+"), "u"),
      `py13: expected the mission pathway to teach ${concept}`,
    );
  }
});

test("accepted room-task answers are unique after learner-facing normalization", () => {
  for (const chapterId of roomChapterIds) {
    for (const task of roomTasksFor(chapterId)) {
      if (task.kind !== "answer") {
        continue;
      }

      const normalizedAnswers = task.acceptedAnswers.map(normalizeAnswer);
      assert.equal(
        new Set(normalizedAnswers).size,
        normalizedAnswers.length,
        `${task.id}: acceptedAnswers contains duplicates after trimming, spacing, and case normalization`,
      );
    }
  }
});

test("every classroom code task compiles and has a passing test-only reference fixture", () => {
  for (const chapterId of roomChapterIds) {
    for (const task of roomTasksFor(chapterId)) {
      if (task.kind !== "code") {
        continue;
      }

      const compilation = compilePython(task.starterCode, `<${task.id}>`);
      assert.ifError(compilation.error);
      assert.equal(
        compilation.status,
        0,
        `${task.id}: starterCode does not compile\n${compilation.stderr}`,
      );

      const passingCode = passingCodeByTaskId[task.id];
      assert.ok(nonEmpty(passingCode), `${task.id}: missing test-only passing fixture`);
      const passingCompilation = compilePython(passingCode, `<${task.id}-passing>`);
      assert.ifError(passingCompilation.error);
      assert.equal(
        passingCompilation.status,
        0,
        `${task.id}: passing fixture does not compile\n${passingCompilation.stderr}`,
      );
      assert.equal(
        solutionShape.evaluate(passingCode, task.sourceRules).passed,
        true,
        `${task.id}: passing fixture does not satisfy the taught technique`,
      );

      const execution = runPython(passingCode, task.stdin);
      assert.ifError(execution.error);
      assert.equal(
        execution.status,
        0,
        `${task.id}: passing fixture did not finish successfully\n${execution.stderr}`,
      );
      assert.equal(
        execution.stderr,
        "",
        `${task.id}: passing fixture should not write to stderr`,
      );
      assert.equal(
        normalizeStdout(execution.stdout),
        normalizeStdout(task.expectedOutput),
        `${task.id}: expectedOutput drifted from the passing fixture`,
      );
    }
  }
});

test("matching output cannot bypass the taught conversion technique", () => {
  const task = roomTasksFor("py01").find((candidate) => (
    candidate.id === "py01-int-conversion"
  ));
  assert.ok(task);
  const review = solutionShape.evaluate("print(7)", task.sourceRules);
  assert.equal(review.passed, false);
  assert.equal(review.results.some((result) => result.id === "uses-input" && !result.passed), true);
  assert.equal(review.results.some((result) => result.id === "uses-int" && !result.passed), true);
});

test("input prompts are echoed only for explicit classroom runs", () => {
  assert.match(
    pythonWorkerSource,
    /case\.get\("echoInputPrompts", False\)/u,
    "the shared runner must gate prompt echo per test case",
  );
  assert.match(
    pythonWorkerSource,
    /if prompt and echo_input_prompts:/u,
    "prompt text must stay silent for normal exercise grading",
  );
  assert.equal(
    Array.from(courseAppSource.matchAll(/echoInputPrompts/gu)).length,
    1,
    "only the classroom run payload may opt into Python prompt echo",
  );
});

test("lecture demonstrations compile and run with their optional stdin fixtures", () => {
  for (const [chapterId, material] of Object.entries(materials)) {
    const demo = material?.lectureDemo;
    assert.ok(demo && nonEmpty(demo.code), `${chapterId}: lecture demo is missing`);
    assert.ok(
      demo.stdin === undefined || Array.isArray(demo.stdin),
      `${chapterId}: lectureDemo.stdin must be an array when supplied`,
    );
    const stdin = demo.stdin || [];
    assert.equal(
      stdin.every((line) => typeof line === "string"),
      true,
      `${chapterId}: every lectureDemo.stdin value must be a string`,
    );

    const compilation = compilePython(demo.code, `<${chapterId}-lecture-demo>`);
    assert.ifError(compilation.error);
    assert.equal(
      compilation.status,
      0,
      `${chapterId}: lecture demo does not compile\n${compilation.stderr}`,
    );

    const execution = runPython(demo.code, stdin);
    assert.ifError(execution.error);
    assert.equal(
      execution.status,
      0,
      `${chapterId}: lecture demo did not finish successfully\n${execution.stderr}`,
    );
    assert.equal(
      execution.stderr,
      "",
      `${chapterId}: lecture demo should not write to stderr`,
    );
    assert.equal(
      normalizeStdout(execution.stdout),
      normalizeStdout(demo.expectedOutput),
      `${chapterId}: lecture-demo expectedOutput drifted from execution`,
    );
  }
});
