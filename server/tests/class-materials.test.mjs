import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const context = vm.createContext({ Object, window: {} });

for (const filename of ["exercise-data.js", "solution-code.js", "class-materials.js"]) {
  const source = await readFile(resolve(REPOSITORY_ROOT, filename), "utf8");
  vm.runInContext(source, context, { filename });
}

const course = context.window.COURSE_DATA;
const solutionCode = context.window.SOLUTION_CODE;
const materials = context.window.CLASS_MATERIALS;
const expectedChapterIds = [
  "py01",
  "py02",
  "py03",
  "py04",
  "py05",
  "py06",
  "py07",
  "py08",
  "py09",
  "py10",
  "py11",
];
const expectedMaterialIds = Object.fromEntries(expectedChapterIds.map((chapterId) => [
  chapterId,
  `${chapterId}-${({
    py01: "first-programs",
    py02: "simple-data",
    py03: "control-flow",
    py04: "functions",
    py05: "strings-tuples",
    py06: "lists",
    py07: "dictionaries-sets",
    py08: "recursion",
    py09: "functional-collections",
    py10: "effect-free",
    py11: "divide-conquer",
  })[chapterId]}-class`,
]));

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function wordCount(value) {
  return String(value).trim().split(/\s+/u).filter(Boolean).length;
}

function normalizeLine(value) {
  return String(value).trim().replace(/\s+/gu, " ");
}

function significantLines(source) {
  return String(source)
    .split("\n")
    .map(normalizeLine)
    .filter((line) => (
      line.length >= 16
      && !line.startsWith("#")
      && !line.startsWith("import ")
      && !line.startsWith("from ")
      && !/^(?:else:|try:|except(?::|\s)|finally:|break|continue|return\s+(?:True|False|None|0|1))$/u.test(line)
    ));
}

function assertStringList(values, minimum, maximum, label, minimumWords = 8) {
  assert.ok(Array.isArray(values), `${label}: expected an array`);
  assert.ok(values.length >= minimum, `${label}: expected at least ${minimum} items`);
  if (Number.isInteger(maximum)) {
    assert.ok(values.length <= maximum, `${label}: expected no more than ${maximum} items`);
  }

  const normalized = new Set();
  values.forEach((value, index) => {
    const itemLabel = `${label}/${index + 1}`;
    assert.ok(nonEmpty(value), `${itemLabel}: expected non-empty text`);
    assert.ok(
      wordCount(value) >= minimumWords,
      `${itemLabel}: expected at least ${minimumWords} words`,
    );
    const normalizedValue = normalizeLine(value).toLowerCase();
    assert.equal(normalized.has(normalizedValue), false, `${itemLabel}: duplicate item`);
    normalized.add(normalizedValue);
  });
}

function assertDeeplyFrozen(value, path = "CLASS_MATERIALS", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${path}: object must be frozen`);
  Object.entries(value).forEach(([key, child]) => {
    assertDeeplyFrozen(child, `${path}.${key}`, seen);
  });
}

test("class materials cover every chapter with stable IDs and distinct class identities", () => {
  assert.deepEqual(Array.from(Object.keys(materials)), expectedChapterIds);
  assert.deepEqual(
    Array.from(course.chapters.map((chapter) => chapter.id)),
    expectedChapterIds,
    "test fixture should track the exact course chapter order",
  );

  const materialIds = new Set();
  const audiences = new Set();
  const demoTitles = new Set();
  const demoSources = new Set();

  for (const chapterId of expectedChapterIds) {
    const material = materials[chapterId];
    assert.ok(material && typeof material === "object", `${chapterId}: class material is missing`);
    assert.equal(material.id, expectedMaterialIds[chapterId], `${chapterId}: stable material ID changed`);
    assert.equal(materialIds.has(material.id), false, `${chapterId}: duplicate material ID`);
    materialIds.add(material.id);

    assert.ok(nonEmpty(material.audience), `${chapterId}: audience is missing`);
    assert.ok(wordCount(material.audience) >= 12, `${chapterId}: audience should be specific`);
    assert.equal(audiences.has(material.audience), false, `${chapterId}: audience is templated`);
    audiences.add(material.audience);

    assertStringList(material.prerequisites, 2, 4, `${chapterId}/prerequisites`, 7);
    assert.ok(nonEmpty(material.lectureDemo?.title), `${chapterId}: demo title is missing`);
    assert.equal(demoTitles.has(material.lectureDemo.title), false, `${chapterId}: demo title is reused`);
    demoTitles.add(material.lectureDemo.title);
    assert.equal(demoSources.has(material.lectureDemo.code), false, `${chapterId}: demo source is reused`);
    demoSources.add(material.lectureDemo.code);
  }
});

test("every chapter reads as a complete 50 to 90 minute classroom syllabus", () => {
  let plannedMinutes = 0;
  let declaredMinutes = 0;

  for (const chapterId of expectedChapterIds) {
    const material = materials[chapterId];
    assert.ok(
      Number.isInteger(material.estimatedMinutes)
        && material.estimatedMinutes >= 50
        && material.estimatedMinutes <= 90,
      `${chapterId}: estimatedMinutes must be an integer from 50 to 90`,
    );
    assertStringList(material.preparation, 2, 3, `${chapterId}/preparation`, 9);
    assertStringList(material.pageSummary, 3, 4, `${chapterId}/pageSummary`, 18);

    assert.ok(Array.isArray(material.lessonPlan), `${chapterId}: lessonPlan must be an array`);
    assert.equal(material.lessonPlan.length, 5, `${chapterId}: lessonPlan must contain five blocks`);
    const blockLabels = new Set();
    let chapterMinutes = 0;
    material.lessonPlan.forEach((block, index) => {
      const label = `${chapterId}/lessonPlan-${index + 1}`;
      assert.ok(nonEmpty(block?.label), `${label}: label is missing`);
      assert.equal(blockLabels.has(block.label), false, `${label}: duplicate block label`);
      blockLabels.add(block.label);
      assert.ok(
        Number.isInteger(block?.minutes) && block.minutes >= 5,
        `${label}: minutes must be an integer of at least five`,
      );
      assert.ok(nonEmpty(block?.purpose), `${label}: purpose is missing`);
      assert.ok(wordCount(block.purpose) >= 12, `${label}: purpose must describe measurable class work`);
      chapterMinutes += block.minutes;
    });

    assert.equal(
      chapterMinutes,
      material.estimatedMinutes,
      `${chapterId}: lesson blocks must total estimatedMinutes`,
    );
    plannedMinutes += chapterMinutes;
    declaredMinutes += material.estimatedMinutes;

    const demo = material.lectureDemo;
    assert.ok(demo && typeof demo === "object", `${chapterId}: lectureDemo is missing`);
    assert.ok(nonEmpty(demo.title), `${chapterId}: lectureDemo title is missing`);
    assert.ok(nonEmpty(demo.setup), `${chapterId}: lectureDemo setup is missing`);
    assert.ok(wordCount(demo.setup) >= 14, `${chapterId}: lectureDemo setup needs classroom context`);
    assert.ok(nonEmpty(demo.code), `${chapterId}: lectureDemo code is missing`);
    assert.ok(demo.code.split("\n").length >= 7, `${chapterId}: lectureDemo is too short`);
    assert.ok(nonEmpty(demo.expectedOutput), `${chapterId}: lectureDemo expectedOutput is missing`);
    assertStringList(demo.teachingPoints, 3, undefined, `${chapterId}/teachingPoints`, 12);
    assertStringList(demo.questions, 2, undefined, `${chapterId}/demoQuestions`, 9);
    demo.questions.forEach((question, index) => {
      assert.match(question.trim(), /\?$/u, `${chapterId}/demoQuestions-${index + 1}: expected a question`);
    });

    assert.ok(
      Array.isArray(material.classActivities) && material.classActivities.length >= 2,
      `${chapterId}: expected at least two class activities`,
    );
    const activityTitles = new Set();
    material.classActivities.forEach((activity, index) => {
      const label = `${chapterId}/activity-${index + 1}`;
      assert.ok(nonEmpty(activity?.title), `${label}: title is missing`);
      assert.equal(activityTitles.has(activity.title), false, `${label}: duplicate activity title`);
      activityTitles.add(activity.title);
      assert.ok(nonEmpty(activity?.format), `${label}: format is missing`);
      assert.ok(wordCount(activity.format) >= 8, `${label}: format needs concrete grouping or workflow`);
      assert.ok(
        Number.isInteger(activity?.minutes) && activity.minutes >= 10 && activity.minutes <= 30,
        `${label}: minutes must be a realistic 10 to 30 minute activity`,
      );
      assert.ok(nonEmpty(activity?.prompt), `${label}: prompt is missing`);
      assert.ok(wordCount(activity.prompt) >= 14, `${label}: prompt must stand alone`);
      assert.ok(nonEmpty(activity?.evidence), `${label}: evidence is missing`);
      assert.ok(wordCount(activity.evidence) >= 12, `${label}: evidence must be inspectable`);
    });

    assertStringList(
      material.independentPractice,
      3,
      undefined,
      `${chapterId}/independentPractice`,
      12,
    );
    assertStringList(material.recapQuestions, 4, undefined, `${chapterId}/recapQuestions`, 7);
    material.recapQuestions.forEach((question, index) => {
      assert.match(question.trim(), /\?$/u, `${chapterId}/recapQuestions-${index + 1}: expected a question`);
    });

    assert.ok(material.homework && typeof material.homework === "object", `${chapterId}: homework is missing`);
    assert.ok(nonEmpty(material.homework.brief), `${chapterId}: homework brief is missing`);
    assert.ok(wordCount(material.homework.brief) >= 18, `${chapterId}: homework brief needs transfer context`);
    assertStringList(material.homework.deliverables, 3, undefined, `${chapterId}/deliverables`, 10);
    assertStringList(material.homework.selfReview, 3, undefined, `${chapterId}/selfReview`, 8);
    assert.ok(nonEmpty(material.nextSteps), `${chapterId}: nextSteps is missing`);
    assert.ok(wordCount(material.nextSteps) >= 16, `${chapterId}: nextSteps needs a meaningful bridge`);
  }

  assert.equal(plannedMinutes, declaredMinutes);
  assert.equal(declaredMinutes, 990, "eleven 90-minute classes should provide 990 planned minutes");
});

test("all classroom data is deeply immutable", () => {
  assertDeeplyFrozen(materials);
});

test("every analogous lecture demo compiles and produces its labelled output", () => {
  for (const [chapterId, material] of Object.entries(materials)) {
    const demo = material.lectureDemo;
    const compilation = spawnSync(
      process.env.PYTHON_BIN || "python3",
      ["-c", "import sys; compile(sys.stdin.read(), '<class-demo>', 'exec')"],
      {
        encoding: "utf8",
        input: demo.code,
        timeout: 5_000,
      },
    );

    assert.ifError(compilation.error);
    assert.equal(
      compilation.status,
      0,
      `${chapterId}: Python compilation failed\n${compilation.stderr}`,
    );

    const execution = spawnSync(
      process.env.PYTHON_BIN || "python3",
      ["-c", demo.code],
      {
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    assert.ifError(execution.error);
    assert.equal(execution.status, 0, `${chapterId}: Python demo failed\n${execution.stderr}`);
    assert.equal(
      execution.stdout.trimEnd(),
      demo.expectedOutput,
      `${chapterId}: labelled expected output drifted from the executable demo`,
    );
    assert.equal(execution.stderr, "", `${chapterId}: demo should not write to stderr`);
  }
});

test("class demos do not reuse repository solution code", () => {
  const repositorySolutionLines = new Set(
    Object.values(solutionCode).flatMap(significantLines),
  );
  const normalizedSolutions = Object.values(solutionCode).map((source) => (
    significantLines(source).join("\n")
  ));

  for (const [chapterId, material] of Object.entries(materials)) {
    const demoLines = significantLines(material.lectureDemo.code);
    for (const line of demoLines) {
      assert.equal(
        repositorySolutionLines.has(line),
        false,
        `${chapterId}: lecture demo copied a repository solution line: ${line}`,
      );
    }

    const normalizedDemo = demoLines.join("\n");
    for (const solution of normalizedSolutions) {
      assert.equal(
        Boolean(solution) && normalizedDemo === solution,
        false,
        `${chapterId}: lecture demo matches a complete repository solution`,
      );
    }
  }
});

test("classroom prose does not reproduce repository exercise prompts", () => {
  const normalizedMaterialText = normalizeLine(JSON.stringify(materials)).toLowerCase();
  for (const chapter of course.chapters) {
    for (const exercise of chapter.exercises) {
      const prompt = normalizeLine(exercise.prompt).toLowerCase();
      assert.equal(
        prompt.length >= 20 && normalizedMaterialText.includes(prompt),
        false,
        `${chapter.id}: classroom material reproduces the prompt for ${exercise.id}`,
      );
    }
  }
});
