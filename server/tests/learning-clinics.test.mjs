import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const context = vm.createContext({ Object, window: {} });

for (const filename of ["exercise-data.js", "solution-code.js", "learning-clinics.js"]) {
  const source = await readFile(resolve(REPOSITORY_ROOT, filename), "utf8");
  vm.runInContext(source, context, { filename });
}

const course = context.window.COURSE_DATA;
const clinics = context.window.LEARNING_CLINICS;
const solutionCode = context.window.SOLUTION_CODE;
const expectedChapterIds = course.chapters.map((chapter) => String(chapter.id)).sort();

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
      && !/^(?:else:|try:|except(?::|\\s)|finally:|break|continue|return\\s+(?:True|False|None|0|1))$/u.test(line)
    ));
}

test("every course chapter has one deeply structured concept clinic", () => {
  assert.deepEqual(Array.from(Object.keys(clinics)).sort(), Array.from(expectedChapterIds));

  for (const chapterId of expectedChapterIds) {
    const clinic = clinics[chapterId];
    assert.ok(clinic && typeof clinic === "object", `${chapterId}: clinic is missing`);
    assert.match(
      clinic.id,
      new RegExp(`^${chapterId}-[a-z0-9]+(?:-[a-z0-9]+)*-clinic$`, "u"),
      `${chapterId}: clinic ID must be stable and chapter-scoped`,
    );
    assert.ok(nonEmpty(clinic.title), `${chapterId}: title is missing`);
    assert.ok(nonEmpty(clinic.description), `${chapterId}: description is missing`);
    assert.ok(wordCount(clinic.description) >= 45, `${chapterId}: description needs more conceptual depth`);
    assert.ok(nonEmpty(clinic.exampleCode), `${chapterId}: analogous code example is missing`);
    assert.ok(clinic.exampleCode.split("\n").length >= 6, `${chapterId}: example is too small to trace meaningfully`);

    assert.ok(Array.isArray(clinic.trace) && clinic.trace.length >= 4, `${chapterId}: expected at least four trace rows`);
    const traceSteps = new Set();
    clinic.trace.forEach((row, index) => {
      const label = `${chapterId}/trace-${index + 1}`;
      assert.ok(nonEmpty(row?.step), `${label}: step is missing`);
      assert.ok(nonEmpty(row?.state), `${label}: state is missing`);
      assert.ok(nonEmpty(row?.reasoning), `${label}: reasoning is missing`);
      assert.ok(wordCount(row.reasoning) >= 10, `${label}: reasoning should explain why, not merely restate state`);
      assert.equal(traceSteps.has(row.step.trim()), false, `${label}: duplicate trace step`);
      traceSteps.add(row.step.trim());
    });

    assert.ok(
      Array.isArray(clinic.misconceptions) && clinic.misconceptions.length >= 2,
      `${chapterId}: expected at least two misconceptions`,
    );
    clinic.misconceptions.forEach((item, index) => {
      const label = `${chapterId}/misconception-${index + 1}`;
      assert.ok(nonEmpty(item?.belief), `${label}: belief is missing`);
      assert.ok(nonEmpty(item?.correction), `${label}: correction is missing`);
      assert.ok(nonEmpty(item?.probe), `${label}: probe is missing`);
      assert.ok(wordCount(item.correction) >= 12, `${label}: correction needs an explanatory rule`);
      assert.ok(wordCount(item.probe) >= 8, `${label}: probe should be an actionable question or task`);
    });

    assert.ok(
      Array.isArray(clinic.transferPrompts) && clinic.transferPrompts.length >= 3,
      `${chapterId}: expected at least three transfer prompts`,
    );
    clinic.transferPrompts.forEach((prompt, index) => {
      assert.ok(nonEmpty(prompt), `${chapterId}/transfer-${index + 1}: prompt is missing`);
      assert.ok(wordCount(prompt) >= 12, `${chapterId}/transfer-${index + 1}: prompt needs enough context to stand alone`);
    });
  }
});

test("clinic IDs are unique and exported content is immutable", () => {
  const ids = Object.values(clinics).map((clinic) => clinic.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(Object.isFrozen(clinics), true);
  for (const clinic of Object.values(clinics)) {
    assert.equal(Object.isFrozen(clinic), true);
    assert.equal(Object.isFrozen(clinic.trace), true);
    assert.equal(Object.isFrozen(clinic.misconceptions), true);
    assert.equal(Object.isFrozen(clinic.transferPrompts), true);
  }
});

test("every clinic example compiles as Python 3", () => {
  for (const [chapterId, clinic] of Object.entries(clinics)) {
    const compilation = spawnSync(
      process.env.PYTHON_BIN || "python3",
      ["-c", "import sys; compile(sys.stdin.read(), '<concept-clinic>', 'exec')"],
      {
        encoding: "utf8",
        input: clinic.exampleCode,
        timeout: 5_000,
      },
    );

    assert.ifError(compilation.error);
    assert.equal(
      compilation.status,
      0,
      `${chapterId}: Python compilation failed\n${compilation.stderr}`,
    );
  }
});

test("analogous examples do not reuse repository solution code", () => {
  const repositorySolutionLines = new Set(
    Object.values(solutionCode).flatMap(significantLines),
  );
  const normalizedSolutions = Object.values(solutionCode).map((source) => (
    significantLines(source).join("\n")
  ));

  for (const [chapterId, clinic] of Object.entries(clinics)) {
    const clinicLines = significantLines(clinic.exampleCode);
    for (const line of clinicLines) {
      assert.equal(
        repositorySolutionLines.has(line),
        false,
        `${chapterId}: clinic example copied a repository solution line: ${line}`,
      );
    }

    const normalizedClinic = clinicLines.join("\n");
    for (const solution of normalizedSolutions) {
      assert.equal(
        Boolean(solution) && normalizedClinic === solution,
        false,
        `${chapterId}: clinic example matches a complete repository solution`,
      );
    }
  }
});

test("clinic prose does not reproduce an exercise prompt", () => {
  const normalizedClinicText = normalizeLine(JSON.stringify(clinics)).toLowerCase();
  for (const chapter of course.chapters) {
    for (const exercise of chapter.exercises) {
      const prompt = normalizeLine(exercise.prompt).toLowerCase();
      assert.equal(
        prompt.length >= 20 && normalizedClinicText.includes(prompt),
        false,
        `${chapter.id}: clinic content reproduces the prompt for ${exercise.id}`,
      );
    }
  }
});
