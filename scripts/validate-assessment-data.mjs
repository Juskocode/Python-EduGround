#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
globalThis.window = {};
await import(pathToFileURL(path.join(repoRoot, "solution-code.js")));
await import(pathToFileURL(path.join(repoRoot, "assessment-data.js")));

const data = window.ASSESSMENT_DATA;
const errors = [];
const ids = new Set();
const expectedBlocks = [
  ["py01-py03", ["py01", "py02", "py03"]],
  ["py04-py06", ["py04", "py05", "py06"]],
  ["py07-py09", ["py07", "py08", "py09"]],
  ["py10-py11", ["py10", "py11"]],
];
const solutionLines = new Set(
  Object.values(window.SOLUTION_CODE || {})
    .flatMap((source) => source.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.length >= 18 && !line.startsWith("#") && !line.startsWith("def ")),
);

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function uniqueId(id, label) {
  if (!/^[a-z0-9][a-z0-9-]{2,127}$/u.test(String(id || ""))) {
    errors.push(`${label}: invalid stable ID.`);
    return;
  }
  if (ids.has(id)) errors.push(`${label}: duplicate ID ${id}.`);
  ids.add(id);
}

function compilePython(source, mode, label) {
  const command = mode === "eval"
    ? "import sys; compile(sys.stdin.read(), '<assessment>', 'eval')"
    : "import sys; compile(sys.stdin.read(), '<assessment>', 'exec')";
  const result = spawnSync(process.env.PYTHON_BIN || "python3", ["-c", command], {
    encoding: "utf8",
    input: source,
  });
  if (result.error) {
    errors.push(`${label}: could not start Python (${result.error.message}).`);
  } else if (result.status !== 0) {
    const detail = result.stderr.trim().split("\n").at(-1) || "compilation failed";
    errors.push(`${label}: invalid Python (${detail}).`);
  }
}

if (!data || typeof data !== "object") {
  errors.push("assessment-data.js did not define ASSESSMENT_DATA.");
} else {
  if (Number(data.passingScore) !== 60) errors.push("global pass score must be 60/100.");
  if (Number(data.theoryDurationMinutes) !== 20) errors.push("theory duration must be 20 minutes.");
  if (Number(data.practicalDurationMinutes) !== 60) errors.push("practical duration must be 60 minutes.");
  if (!Array.isArray(data.blocks) || data.blocks.length !== 4) errors.push("expected exactly four assessment blocks.");
}

(data?.blocks || []).forEach((block, blockIndex) => {
  const expected = expectedBlocks[blockIndex];
  const label = `block-${blockIndex + 1}`;
  uniqueId(block.id, label);
  if (!expected || block.id !== expected[0]) errors.push(`${label}: unexpected block ID or order.`);
  if (JSON.stringify(block.chapters) !== JSON.stringify(expected?.[1])) errors.push(`${label}: incorrect chapter coverage.`);
  if (!nonEmpty(block.title) || !nonEmpty(block.sourceNote) || !block.sourceNote.toLowerCase().includes("solution")) {
    errors.push(`${label}: title/source note must explain that solutions are excluded.`);
  }
  if (Number(block.theory?.durationSeconds) !== 1200 || Number(block.practical?.durationSeconds) !== 3600) {
    errors.push(`${label}: expected absolute 1200/3600-second room limits.`);
  }
  if (Number(block.theory?.passPercent) !== 60 || Number(block.practical?.passPercent) !== 60) {
    errors.push(`${label}: both rooms must pass at 60 percent.`);
  }

  const references = Array.isArray(block.references) ? block.references : [];
  if (references.length < 4 || references.length > 6) errors.push(`${label}: expected four to six official references.`);
  references.forEach((reference, index) => {
    const referenceLabel = `${label}/reference-${index + 1}`;
    if (!nonEmpty(reference.label) || !nonEmpty(reference.description) || !nonEmpty(reference.url)) {
      errors.push(`${referenceLabel}: incomplete documentation metadata.`);
      return;
    }
    try {
      const url = new URL(reference.url);
      if (url.origin !== "https://docs.python.org" || !url.pathname.startsWith("/3/")) {
        errors.push(`${referenceLabel}: only official Python 3 documentation is allowed.`);
      }
    } catch {
      errors.push(`${referenceLabel}: invalid URL.`);
    }
  });

  const theory = Array.isArray(block.theory?.questions) ? block.theory.questions : [];
  if (theory.length !== 15) errors.push(`${label}: expected 15 theory questions.`);
  let multiCorrect = 0;
  let codeQuestions = 0;
  theory.forEach((question, index) => {
    const questionLabel = `${label}/theory-${index + 1}`;
    uniqueId(question.id, questionLabel);
    if (!nonEmpty(question.prompt) || !nonEmpty(question.explanation)) errors.push(`${questionLabel}: prompt/explanation missing.`);
    if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some((option) => !nonEmpty(option))) {
      errors.push(`${questionLabel}: expected four non-empty options.`);
    }
    if (!Array.isArray(question.correct) || question.correct.length < 1 || new Set(question.correct).size !== question.correct.length) {
      errors.push(`${questionLabel}: correct answer indexes must be a non-empty unique array.`);
    } else if (question.correct.some((answer) => !Number.isInteger(answer) || answer < 0 || answer >= question.options.length)) {
      errors.push(`${questionLabel}: correct answer index out of range.`);
    }
    if (question.correct?.length > 1) multiCorrect += 1;
    if (nonEmpty(question.code)) {
      codeQuestions += 1;
      compilePython(question.code, "exec", `${questionLabel}/code`);
    }
  });
  if (multiCorrect < 5) errors.push(`${label}: expected at least five genuinely multiple-answer questions.`);
  if (codeQuestions < 5) errors.push(`${label}: expected at least five code-reading questions.`);

  const practical = Array.isArray(block.practical?.questions) ? block.practical.questions : [];
  if (practical.length !== 5) errors.push(`${label}: expected five practical questions.`);
  practical.forEach((question, index) => {
    const questionLabel = `${label}/practical-${index + 1}`;
    uniqueId(question.id, questionLabel);
    for (const field of ["title", "prompt", "starterCode", "mode"]) {
      if (!nonEmpty(question[field])) errors.push(`${questionLabel}: missing ${field}.`);
    }
    if (!(nonEmpty(question.contract) || (Array.isArray(question.contract) && question.contract.length > 0 && question.contract.every(nonEmpty)))) {
      errors.push(`${questionLabel}: missing contract.`);
    }
    if (Number(question.points) !== 20) errors.push(`${questionLabel}: each practical must be worth 20 points.`);
    if (question.mode !== "function") errors.push(`${questionLabel}: practical tests must use function mode.`);
    if (!Array.isArray(question.constraints) || question.constraints.length < 1) errors.push(`${questionLabel}: constraints missing.`);
    if (!Array.isArray(question.examples) || question.examples.length < 1) errors.push(`${questionLabel}: public examples missing.`);
    compilePython(String(question.starterCode || ""), "exec", `${questionLabel}/starter`);
    String(question.starterCode || "").split("\n").map((line) => line.trim()).forEach((line) => {
      if (line.length >= 18 && solutionLines.has(line)) errors.push(`${questionLabel}: starter reuses a repository solution line.`);
    });
    (question.examples || []).forEach((example, exampleIndex) => {
      if (!nonEmpty(example.call) || !nonEmpty(example.expected)) errors.push(`${questionLabel}/example-${exampleIndex + 1}: call/expected missing.`);
      else {
        compilePython(example.call, "eval", `${questionLabel}/example-${exampleIndex + 1}/call`);
        compilePython(example.expected, "eval", `${questionLabel}/example-${exampleIndex + 1}/expected`);
      }
    });
    const tests = Array.isArray(question.tests) ? question.tests : [];
    if (tests.length < 3 || !tests.some((test) => test.hidden) || !tests.some((test) => !test.hidden)) {
      errors.push(`${questionLabel}: expected at least three tests with visible and hidden coverage.`);
    }
    tests.forEach((test, testIndex) => {
      const testLabel = `${questionLabel}/test-${testIndex + 1}`;
      if (!nonEmpty(test.id) || !nonEmpty(test.name) || !nonEmpty(test.call) || !nonEmpty(test.expected)) {
        errors.push(`${testLabel}: incomplete test definition.`);
      } else {
        compilePython(test.call, "eval", `${testLabel}/call`);
        compilePython(test.expected, "eval", `${testLabel}/expected`);
      }
    });
  });
});

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  const theoryCount = data.blocks.reduce((total, block) => total + block.theory.questions.length, 0);
  const practicalCount = data.blocks.reduce((total, block) => total + block.practical.questions.length, 0);
  const testCount = data.blocks.reduce((total, block) => total + block.practical.questions.reduce((sum, question) => sum + question.tests.length, 0), 0);
  const referenceCount = data.blocks.reduce((total, block) => total + block.references.length, 0);
  console.log(`Validated ${data.blocks.length} timed assessment blocks, ${theoryCount} theory questions, ${practicalCount} practical tasks, ${testCount} practical tests, and ${referenceCount} official references.`);
}
