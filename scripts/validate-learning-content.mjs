import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
globalThis.window = {};

for (const file of ["exercise-data.js", "solution-code.js", "learning-content.js", "learning-toolbox.js", "learning-clinics.js"]) {
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
let interactiveLabCount = 0;
let conceptClinicCount = 0;
let clinicTraceCount = 0;
let misconceptionCount = 0;
let transferPromptCount = 0;
const conceptClinicIds = new Set();
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
  const clinic = window.LEARNING_CLINICS?.[String(chapter.id)];
  if (!clinic || typeof clinic !== "object") {
    errors.push(`${chapter.id}: missing concept clinic.`);
  } else {
    conceptClinicCount += 1;
    if (!new RegExp(`^${chapter.id}-[a-z0-9]+(?:-[a-z0-9]+)*-clinic$`, "u").test(String(clinic.id || ""))) {
      errors.push(`${chapter.id}/concept-clinic: expected a stable chapter-scoped ID.`);
    } else if (conceptClinicIds.has(clinic.id)) {
      errors.push(`${chapter.id}/concept-clinic: duplicate stable ID.`);
    } else {
      conceptClinicIds.add(clinic.id);
    }
    for (const field of ["title", "description", "exampleCode"]) {
      if (!isNonEmptyString(clinic[field])) {
        errors.push(`${chapter.id}/concept-clinic: missing ${field}.`);
      }
    }
    if (!Array.isArray(clinic.trace) || clinic.trace.length < 6) {
      errors.push(`${chapter.id}/concept-clinic: expected at least six worked trace rows.`);
    } else {
      clinicTraceCount += clinic.trace.length;
      clinic.trace.forEach((row, index) => {
        for (const field of ["step", "state", "reasoning"]) {
          if (!isNonEmptyString(row?.[field])) {
            errors.push(`${chapter.id}/concept-clinic/trace-${index + 1}: missing ${field}.`);
          }
        }
      });
    }
    if (!Array.isArray(clinic.misconceptions) || clinic.misconceptions.length < 3) {
      errors.push(`${chapter.id}/concept-clinic: expected at least three misconceptions.`);
    } else {
      misconceptionCount += clinic.misconceptions.length;
      clinic.misconceptions.forEach((item, index) => {
        for (const field of ["belief", "correction", "probe"]) {
          if (!isNonEmptyString(item?.[field])) {
            errors.push(`${chapter.id}/concept-clinic/misconception-${index + 1}: missing ${field}.`);
          }
        }
      });
    }
    if (!Array.isArray(clinic.transferPrompts) || clinic.transferPrompts.length < 3) {
      errors.push(`${chapter.id}/concept-clinic: expected at least three transfer prompts.`);
    } else {
      transferPromptCount += clinic.transferPrompts.length;
      clinic.transferPrompts.forEach((prompt, index) => {
        if (!isNonEmptyString(prompt)) {
          errors.push(`${chapter.id}/concept-clinic/transfer-${index + 1}: prompt is empty.`);
        }
      });
    }
  }
  if (!Array.isArray(content.tutorial) || content.tutorial.length !== 4) {
    errors.push(`${chapter.id}: expected four tutorial sections.`);
    continue;
  }
  if (!Array.isArray(content.runbook) || content.runbook.length !== 5) {
    errors.push(`${chapter.id}: expected five runbook phases.`);
  }
  const toolbox = window.LEARNING_TOOLBOX?.[String(chapter.id)];
  const expectedToolboxRange = String(chapter.id) === "py02" ? [7, 7] : [3, 4];
  if (
    !Array.isArray(toolbox) ||
    toolbox.length < expectedToolboxRange[0] ||
    toolbox.length > expectedToolboxRange[1]
  ) {
    errors.push(
      `${chapter.id}: expected ${String(chapter.id) === "py02" ? "seven" : "three or four"} Python toolbox entries.`
    );
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
  const expectedDocumentationRange = String(chapter.id) === "py02" ? [6, 6] : [3, 4];
  if (
    !Array.isArray(content.documentation) ||
    content.documentation.length < expectedDocumentationRange[0] ||
    content.documentation.length > expectedDocumentationRange[1]
  ) {
    errors.push(
      `${chapter.id}: expected ${String(chapter.id) === "py02" ? "six" : "three or four"} official Python documentation links.`
    );
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
    const interactiveLab = deepDive.interactiveLab;

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
    if (String(chapter.id) === "py02") {
      if (!interactiveLab || interactiveLab.kind !== "rounding-boundaries") {
        errors.push(`${chapter.id}: expected the directed-rounding interactive lab.`);
      } else {
        interactiveLabCount += 1;
        for (const field of ["title", "description"]) {
          if (!isNonEmptyString(interactiveLab[field])) {
            errors.push(`${chapter.id}/interactive-lab: missing ${field}.`);
          }
        }
        const min = Number(interactiveLab.min);
        const max = Number(interactiveLab.max);
        const defaultValue = Number(interactiveLab.defaultValue);
        if (![min, max, defaultValue].every(Number.isFinite) || min >= max || defaultValue < min || defaultValue > max) {
          errors.push(`${chapter.id}/interactive-lab: expected finite ordered bounds and an in-range default value.`);
        }
        if (!Array.isArray(interactiveLab.scenarios) || interactiveLab.scenarios.length < 4) {
          errors.push(`${chapter.id}/interactive-lab: expected at least four labelled scenarios.`);
        } else {
          const scenarioValues = new Set();
          interactiveLab.scenarios.forEach((scenario, index) => {
            const value = Number(scenario?.value);
            if (!isNonEmptyString(scenario?.label) || !isNonEmptyString(scenario?.note) || !Number.isFinite(value) || value < min || value > max) {
              errors.push(`${chapter.id}/interactive-lab/scenario-${index + 1}: expected a label, note, and in-range finite value.`);
            }
            if (scenarioValues.has(value)) {
              errors.push(`${chapter.id}/interactive-lab/scenario-${index + 1}: duplicate scenario value.`);
            }
            scenarioValues.add(value);
          });
          for (const tieValue of [2.5, 3.5]) {
            if (!scenarioValues.has(tieValue)) {
              errors.push(`${chapter.id}/interactive-lab: include ${tieValue} to demonstrate both sides of ties-to-even.`);
            }
          }
        }
        if (!Array.isArray(interactiveLab.rules) || interactiveLab.rules.length < 4) {
          errors.push(`${chapter.id}/interactive-lab: expected at least four choose-by-intent rules.`);
        } else {
          interactiveLab.rules.forEach((rule, index) => {
            for (const field of ["intent", "operation", "reason"]) {
              if (!isNonEmptyString(rule?.[field])) {
                errors.push(`${chapter.id}/interactive-lab/rule-${index + 1}: missing ${field}.`);
              }
            }
          });
        }
        if (!Array.isArray(interactiveLab.invariants) || interactiveLab.invariants.length < 3 || interactiveLab.invariants.some((item) => !isNonEmptyString(item))) {
          errors.push(`${chapter.id}/interactive-lab: expected at least three non-empty invariants.`);
        }
      }
    } else if (interactiveLab) {
      errors.push(`${chapter.id}: interactive labs require an explicit validator before release.`);
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
    if (!/^[a-z0-9][a-z0-9-]{2,159}$/u.test(String(tutorial.id || ""))) {
      errors.push(`${chapter.id}/tutorial-${index + 1}: missing stable tutorial ID.`);
    }
    if (content.tutorial.some((candidate, candidateIndex) => candidateIndex !== index && candidate.id === tutorial.id)) {
      errors.push(`${chapter.id}/tutorial-${index + 1}: duplicate stable tutorial ID.`);
    }
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
for (const concept of ["math.floor(value)", "math.ceil(value)", "math.trunc(value)", "negative infinity", "positive infinity", "math.trunc(-2.3)"]) {
  if (!toolboxText.includes(concept)) {
    errors.push(`toolbox: directed-rounding teaching must mention ${concept}.`);
  }
}
for (const concept of ["import module", "standard-library modules", "third-party packages", "Import does not install packages"]) {
  if (!toolboxText.includes(concept)) {
    errors.push(`toolbox: import and library teaching must mention ${concept}.`);
  }
}

const simpleDataText = JSON.stringify(window.LEARNING_CONTENT.chapters.py02);
for (const concept of ["math.floor", "math.ceil", "floor(-2.3) is -3", "ceil(-2.3) is -2", "upper bound", "lower bound", "math.floor(value) <= value <= math.ceil(value)"]) {
  if (!simpleDataText.includes(concept)) {
    errors.push(`py02: directed-rounding material must mention ${concept}.`);
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
      `${checkpointCount} checkpoints plus ${interactiveLabCount} interactive lab. Checked ${coachExchangeCount} coaching exchanges and ` +
      `${documentationLinkCount} official Python documentation links plus ${toolboxCount} Python toolbox cards. ` +
      `Validated ${conceptClinicCount} concept clinics with ${clinicTraceCount} trace rows, ` +
      `${misconceptionCount} misconceptions, and ${transferPromptCount} transfer prompts.`,
  );
}
