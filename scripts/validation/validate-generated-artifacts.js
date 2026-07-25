#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  collectSolutionCode,
  createStarterCode,
  loadCourseData,
  loadExerciseTests,
  renderSolutionBundle,
  renderStarterBundle,
} from "../lib/curriculum-bundles.js";
import {
  GENERATED_CURRICULUM_ROOT,
  PUBLIC_ROOT,
  REPOSITORY_ROOT,
} from "../lib/paths.js";

const course = await loadCourseData();
const solutions = await collectSolutionCode(course);
const specs = await loadExerciseTests();
const expectedArtifacts = new Map([
  [
    path.join(GENERATED_CURRICULUM_ROOT, "solution-code.js"),
    renderSolutionBundle(solutions),
  ],
  [
    path.join(PUBLIC_ROOT, "content/generated/starter-code.js"),
    renderStarterBundle(createStarterCode(course, solutions, specs)),
  ],
]);

const staleArtifacts = [];
for (const [file, expected] of expectedArtifacts) {
  const actual = await readFile(file, "utf8");
  if (actual !== expected) {
    staleArtifacts.push(path.relative(REPOSITORY_ROOT, file));
  }
}

if (staleArtifacts.length > 0) {
  console.error("Generated curriculum artifacts are stale:");
  staleArtifacts.forEach((file) => console.error(`- ${file}`));
  console.error(
    "Run npm run build:solutions && npm run build:starters, then review both diffs.",
  );
  process.exit(1);
}

console.log(
  `Validated ${expectedArtifacts.size} generated curriculum artifacts without rewriting them.`,
);
