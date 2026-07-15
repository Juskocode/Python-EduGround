import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
globalThis.window = {};

for (const file of ["exercise-data.js", "solution-code.js", "learning-content.js", "learning-toolbox.js"]) {
  await import(pathToFileURL(path.join(repoRoot, file)));
}

const errors = [];
let tutorialCount = 0;
let runbookCount = 0;
let mentalModelStepCount = 0;
let guidedPracticeCount = 0;
let glossaryTermCount = 0;
let debugCheckCount = 0;
let checkpointCount = 0;
let coachExchangeCount = 0;
let documentationLinkCount = 0;
let toolboxCount = 0;
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
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
  const toolbox = window.LEARNING_TOOLBOX?.[String(chapter.id)];
  if (!Array.isArray(toolbox) || toolbox.length < 3 || toolbox.length > 4) {
    errors.push(`${chapter.id}: expected three or four Python toolbox entries.`);
  } else {
    toolboxCount += toolbox.length;
    const chapterToolSyntax = new Set();
    toolbox.forEach((tool, index) => {
      const label = `${chapter.id}/toolbox-${index + 1}`;
      for (const field of ["kind", "syntax", "description", "useWhen", "result", "caution", "example"]) {
        if (!isNonEmptyString(tool?.[field])) {
          errors.push(`${label}: missing ${field}.`);
        }
      }
      if (isNonEmptyString(tool?.syntax)) {
        if (chapterToolSyntax.has(tool.syntax.trim())) {
          errors.push(`${label}: duplicate toolbox syntax.`);
        }
        chapterToolSyntax.add(tool.syntax.trim());
      }
      if (String(tool?.kind || "").startsWith("Standard library")) {
        const importCode = String(tool?.importCode || "").trim();
        if (!/^(?:import\s+|from\s+\S+\s+import\s+)/u.test(importCode)) {
          errors.push(`${label}: standard-library tools need an explicit importCode.`);
        }
      }
      if (String(tool?.importCode || "").includes("import *")) {
        errors.push(`${label}: wildcard imports are not allowed in teaching examples.`);
      }
      if (isNonEmptyString(tool?.example)) {
        const source = [tool.importCode, tool.example].filter(isNonEmptyString).join("\n\n");
        const compilation = spawnSync(
          process.env.PYTHON_BIN || "python3",
          ["-c", "import sys; compile(sys.stdin.read(), '<toolbox-example>', 'exec')"],
          { encoding: "utf8", input: source },
        );
        if (compilation.error) {
          errors.push(`${label}: could not start Python to compile the example (${compilation.error.message}).`);
        } else if (compilation.status !== 0) {
          const detail = compilation.stderr.trim().split("\n").at(-1) || "Python compilation failed";
          errors.push(`${label}: example is not valid Python (${detail}).`);
        }
      }
      for (const line of String(tool?.example || "").split("\n").map((value) => value.trim())) {
        if (
          line.length >= 18 &&
          !line.startsWith("import ") &&
          !line.startsWith("from ") &&
          !line.startsWith("def ") &&
          allSolutionLines.has(line)
        ) {
          errors.push(`${label}: example reuses a repository solution line (${line}).`);
        }
      }
    });
  }
  if (!Array.isArray(content.coachConversation) || content.coachConversation.length < 3) {
    errors.push(`${chapter.id}: expected at least three learner/coach exchanges.`);
  } else {
    coachExchangeCount += content.coachConversation.length;
    content.coachConversation.forEach((exchange, index) => {
      if (!isNonEmptyString(exchange?.learner) || !isNonEmptyString(exchange?.coach)) {
        errors.push(`${chapter.id}/coach-${index + 1}: missing learner question or coaching reply.`);
      }
      for (const message of [exchange?.learner, exchange?.coach]) {
        if (isNonEmptyString(message) && allSolutionLines.has(message.trim())) {
          errors.push(`${chapter.id}/coach-${index + 1}: coaching text reuses a repository solution line.`);
        }
      }
    });
  }
  if (!Array.isArray(content.documentation) || content.documentation.length < 3 || content.documentation.length > 4) {
    errors.push(`${chapter.id}: expected three or four official Python documentation links.`);
  } else {
    const chapterDocumentationUrls = new Set();
    documentationLinkCount += content.documentation.length;
    content.documentation.forEach((resource, index) => {
      if (!isNonEmptyString(resource?.label) || !isNonEmptyString(resource?.description) || !isNonEmptyString(resource?.url)) {
        errors.push(`${chapter.id}/documentation-${index + 1}: missing label, description, or URL.`);
      } else {
        try {
          const url = new URL(resource.url.trim());
          if (url.origin !== "https://docs.python.org" || !url.pathname.startsWith("/3/") || url.username || url.password) {
            errors.push(`${chapter.id}/documentation-${index + 1}: link must use the official HTTPS Python 3 documentation.`);
          }
          if (chapterDocumentationUrls.has(url.href)) {
            errors.push(`${chapter.id}/documentation-${index + 1}: duplicate documentation URL.`);
          }
          chapterDocumentationUrls.add(url.href);
        } catch {
          errors.push(`${chapter.id}/documentation-${index + 1}: invalid documentation URL.`);
        }
      }
    });
  }
  const deepDive = content.deepDive;
  if (!deepDive || typeof deepDive !== "object") {
    errors.push(`${chapter.id}: missing deep-dive learning material.`);
  } else {
    const mentalSteps = deepDive.mentalModel?.steps;
    const practices = deepDive.guidedPractice;
    const glossary = deepDive.glossary;
    const debugChecklist = deepDive.debugChecklist;
    const checkpoint = deepDive.checkpoint;

    if (!deepDive.mentalModel?.title || !deepDive.mentalModel?.body || !Array.isArray(mentalSteps) || mentalSteps.length < 3) {
      errors.push(`${chapter.id}: mental model needs a title, explanation, and at least three steps.`);
    } else {
      mentalModelStepCount += mentalSteps.length;
    }
    if (!Array.isArray(practices) || practices.length !== 2) {
      errors.push(`${chapter.id}: expected two guided practices.`);
    } else {
      guidedPracticeCount += practices.length;
      practices.forEach((practice, index) => {
        if (!practice.title || !practice.prompt || !practice.starterCode || !practice.reveal) {
          errors.push(`${chapter.id}/practice-${index + 1}: missing guided-practice teaching material.`);
        }
        if (!Array.isArray(practice.questions) || practice.questions.length < 2) {
          errors.push(`${chapter.id}/practice-${index + 1}: expected at least two prediction questions.`);
        }
      });
    }
    if (!Array.isArray(glossary) || glossary.length < 5) {
      errors.push(`${chapter.id}: expected at least five glossary terms.`);
    } else {
      glossaryTermCount += glossary.length;
    }
    if (!Array.isArray(debugChecklist) || debugChecklist.length < 5) {
      errors.push(`${chapter.id}: expected at least five debugging checks.`);
    } else {
      debugCheckCount += debugChecklist.length;
    }
    if (
      !checkpoint ||
      !checkpoint.question ||
      !Array.isArray(checkpoint.options) ||
      checkpoint.options.length < 3 ||
      !Number.isInteger(checkpoint.answerIndex) ||
      checkpoint.answerIndex < 0 ||
      checkpoint.answerIndex >= checkpoint.options.length ||
      !checkpoint.explanation
    ) {
      errors.push(`${chapter.id}: checkpoint needs a valid question, options, zero-based answer, and explanation.`);
    } else {
      checkpointCount += 1;
    }
  }

  tutorialCount += content.tutorial.length;
  runbookCount += content.runbook.length;
  content.runbook.forEach((step, index) => {
    if (!step.why || !step.whenStuck) {
      errors.push(`${chapter.id}/runbook-${index + 1}: add why and whenStuck guidance.`);
    }
  });
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

const firstProgramsText = JSON.stringify(window.LEARNING_CONTENT.chapters.py01);
if (!firstProgramsText.includes("int(input())")) {
  errors.push("py01: show the direct int(input()) conversion pattern.");
}
if (!firstProgramsText.includes("ValueError")) {
  errors.push("py01: explain that invalid integer text raises ValueError.");
}
for (const concept of ["input()", "float", "str", "prompt"]) {
  if (!firstProgramsText.includes(concept)) {
    errors.push(`py01: input-boundary teaching must mention ${concept}.`);
  }
}

const toolboxText = Object.values(window.LEARNING_TOOLBOX || {})
  .flat()
  .flatMap((tool) => Object.values(tool || {}))
  .join("\n");
for (const concept of ["casting", "int(text)", "float(text_or_number)", "str(value)", "bool(value)"]) {
  if (!toolboxText.includes(concept)) {
    errors.push(`toolbox: conversion teaching must mention ${concept}.`);
  }
}
for (const concept of ["round(number, ndigits=None)", "f\"{value:.2f}\"", "exact ties use the even candidate"]) {
  if (!toolboxText.includes(concept)) {
    errors.push(`toolbox: rounding teaching must mention ${concept}.`);
  }
}
for (const concept of ["import module", "standard-library modules", "third-party packages", "Import does not install packages"]) {
  if (!toolboxText.includes(concept)) {
    errors.push(`toolbox: import and library teaching must mention ${concept}.`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${tutorialCount} solution-free tutorials, ${runbookCount} runbook phases, ` +
      `${mentalModelStepCount} mental-model steps, ${guidedPracticeCount} guided practices, ` +
      `${glossaryTermCount} glossary terms, ${debugCheckCount} debugging checks, and ` +
      `${checkpointCount} checkpoints. Checked ${coachExchangeCount} coaching exchanges and ` +
      `${documentationLinkCount} official Python documentation links plus ${toolboxCount} Python toolbox cards.`,
  );
}
