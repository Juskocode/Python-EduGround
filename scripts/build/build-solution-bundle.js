import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GENERATED_CURRICULUM_ROOT,
} from "../lib/paths.js";
import {
  collectSolutionCode,
  loadCourseData,
  renderSolutionBundle,
} from "../lib/curriculum-bundles.js";

const course = await loadCourseData();
const solutionCode = await collectSolutionCode(course);
const output = renderSolutionBundle(solutionCode);

await writeFile(
  path.join(GENERATED_CURRICULUM_ROOT, "solution-code.js"),
  output,
  "utf8",
);
console.log(`Bundled ${Object.keys(solutionCode).length} Python solutions.`);
