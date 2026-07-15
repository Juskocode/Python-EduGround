import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
globalThis.window = {};

for (const file of ["exercise-data.js", "solution-code.js", "learning-content.js"]) {
  await import(pathToFileURL(path.join(repoRoot, file)));
}

const errors = [];
let tutorialCount = 0;
let runbookCount = 0;
const allSolutionLines = new Set(
  Object.values(window.SOLUTION_CODE)
    .flatMap((source) => source.split("\n"))
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 18 &&
      !line.startsWith("#") &&
      !line.startsWith("import ") &&
      !line.startsWith("from ") &&
      !line.startsWith("def ")
    )),
);

for (const chapter of window.COURSE_DATA.chapters) {
  const content = window.LEARNING_CONTENT.chapters[String(chapter.id)];
  if (!content) {
    errors.push(`${chapter.id}: missing learning content.`);
    continue;
  }
  if (!Array.isArray(content.tutorial) || content.tutorial.length !== 4) {
    errors.push(`${chapter.id}: expected four tutorial sections.`);
    continue;
  }
  if (!Array.isArray(content.runbook) || content.runbook.length !== 5) {
    errors.push(`${chapter.id}: expected five runbook phases.`);
  }

  tutorialCount += content.tutorial.length;
  runbookCount += content.runbook.length;
  for (const [index, tutorial] of content.tutorial.entries()) {
    for (const field of ["title", "explanation", "exampleCode", "takeaway", "commonPitfall"]) {
      if (typeof tutorial[field] !== "string" || tutorial[field].trim() === "") {
        errors.push(`${chapter.id}/tutorial-${index + 1}: missing ${field}.`);
      }
    }
    if (!Array.isArray(tutorial.checklist) || tutorial.checklist.length < 3) {
      errors.push(`${chapter.id}/tutorial-${index + 1}: expected at least three learning checks.`);
    }

    for (const line of tutorial.exampleCode.split("\n").map((value) => value.trim())) {
      if (
        line.length >= 18 &&
        !line.startsWith("import ") &&
        !line.startsWith("from ") &&
        !line.startsWith("def ") &&
        allSolutionLines.has(line)
      ) {
        errors.push(`${chapter.id}/tutorial-${index + 1}: example reuses a repository solution line (${line}).`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${tutorialCount} solution-free tutorials and ${runbookCount} runbook phases.`);
}
