import fs from "node:fs/promises";
import path from "node:path";

import {
  PUBLIC_ROOT,
} from "../lib/paths.js";
import {
  collectSolutionCode,
  createStarterCode,
  loadCourseData,
  loadExerciseTests,
  renderStarterBundle,
} from "../lib/curriculum-bundles.js";

const course = await loadCourseData();
const solutions = await collectSolutionCode(course);
const specs = await loadExerciseTests();
const starters = createStarterCode(course, solutions, specs);
const output = renderStarterBundle(starters);

await fs.writeFile(
  path.join(PUBLIC_ROOT, "content/generated/starter-code.js"),
  output,
  "utf8"
);
console.log(`Generated safe starter code for ${Object.keys(starters).length} exercises.`);
