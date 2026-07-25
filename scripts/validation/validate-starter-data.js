import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  GENERATED_CURRICULUM_ROOT,
  PUBLIC_ROOT,
} from "../lib/paths.js";

globalThis.window = {};

for (const file of [
  path.join(PUBLIC_ROOT, "content/exercise-data.js"),
  path.join(GENERATED_CURRICULUM_ROOT, "solution-code.js"),
  path.join(PUBLIC_ROOT, "content/generated/starter-code.js"),
]) {
  await import(pathToFileURL(file));
}

const ids = window.COURSE_DATA.chapters.flatMap((chapter) => chapter.exercises.map((exercise) => String(exercise.id)));
const errors = [];

for (const id of ids) {
  const starter = window.STARTER_CODE[id];
  const solution = window.SOLUTION_CODE[id];
  if (typeof starter !== "string" || starter.trim() === "") {
    errors.push(`${id}: missing starter code.`);
  } else if (starter === solution || starter.includes(solution)) {
    errors.push(`${id}: starter exposes repository solution code.`);
  }
}

if (window.STARTER_CODE["py01-first-programs"].includes("Hello world!")) {
  errors.push("py01-first-programs: starter exposes the expected greeting.");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${ids.length} solution-free starter files.`);
}
