import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const dataFiles = [
  "exercise-data.js",
  "solution-code.js",
  "test-data/tests-py01-03.js",
  "test-data/tests-py04-07.js",
  "test-data/tests-py08-11.js",
];

globalThis.window = {};
for (const file of dataFiles) {
  await import(pathToFileURL(path.join(repoRoot, file)));
}

const course = globalThis.window.COURSE_DATA;
const specs = globalThis.window.EXERCISE_TESTS;
const solutions = globalThis.window.SOLUTION_CODE;
const errors = [];
const exerciseIds = [];
const testIds = new Set();
let visibleTests = 0;
let hiddenTests = 0;

if (!course || !Array.isArray(course.chapters)) {
  errors.push("COURSE_DATA.chapters is unavailable.");
} else {
  for (const chapter of course.chapters) {
    if (!Array.isArray(chapter.exercises)) {
      errors.push(`${chapter.id}: exercises must be an array.`);
      continue;
    }

    for (const exercise of chapter.exercises) {
      const id = String(exercise.id);
      exerciseIds.push(id);
      const spec = specs && specs[id];

      if (!spec) {
        errors.push(`${id}: missing test specification.`);
        continue;
      }
      if (!Object.hasOwn(solutions || {}, id)) {
        errors.push(`${id}: missing bundled repository code.`);
      }
      if (!spec.description || (spec.description.match(/[.!?](?=\s|$)/g) || []).length < 2) {
        errors.push(`${id}: description must contain at least two teaching sentences.`);
      }
      if (!Array.isArray(spec.success) || spec.success.length < 2) {
        errors.push(`${id}: add at least two success criteria.`);
      }
      if (!['script', 'function'].includes(spec.mode)) {
        errors.push(`${id}: mode must be script or function.`);
      }
      if (!Array.isArray(spec.tests)) {
        errors.push(`${id}: tests must be an array.`);
        continue;
      }

      const visible = spec.tests.filter((test) => !test.hidden).length;
      const hidden = spec.tests.filter((test) => test.hidden).length;
      visibleTests += visible;
      hiddenTests += hidden;

      if (visible < 2 || hidden < 1) {
        errors.push(`${id}: expected at least two visible and one hidden test.`);
      }

      for (const test of spec.tests) {
        if (!test.id || testIds.has(test.id)) {
          errors.push(`${id}: test IDs must be present and globally unique (${test.id || "missing"}).`);
        }
        testIds.add(test.id);

        if (!test.name || typeof test.hidden !== "boolean") {
          errors.push(`${id}/${test.id}: name and hidden flag are required.`);
        }
        if (spec.mode === "script") {
          if (!Array.isArray(test.input) || typeof test.expectedOutput !== "string") {
            errors.push(`${id}/${test.id}: script tests need input[] and expectedOutput.`);
          }
        } else if (typeof test.call !== "string" || typeof test.expected !== "string") {
          errors.push(`${id}/${test.id}: function tests need call and expected expressions.`);
        }
      }
    }
  }
}

const duplicateExercises = exerciseIds.filter((id, index) => exerciseIds.indexOf(id) !== index);
if (duplicateExercises.length > 0) {
  errors.push(`Duplicate exercise IDs: ${[...new Set(duplicateExercises)].join(", ")}.`);
}

const knownIds = new Set(exerciseIds);
for (const id of Object.keys(specs || {})) {
  if (!knownIds.has(id)) {
    errors.push(`${id}: test specification has no matching exercise.`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${course.chapters.length} chapters, ${exerciseIds.length} exercises, ` +
      `${visibleTests + hiddenTests} tests (${visibleTests} visible, ${hiddenTests} hidden).`,
  );
}
