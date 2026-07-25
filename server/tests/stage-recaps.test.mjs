import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(REPOSITORY_ROOT, "stage-recaps.js"), "utf8");
const context = vm.createContext({ Object, window: {} });
vm.runInContext(source, context, { filename: "stage-recaps.js" });
const recaps = context.window.STAGE_RECAPS;
const expectedStageIds = ["py01-py03", "py04-py06", "py07-py09", "py10-py11"];

test("every three-chapter assessment stage has a frozen educational recap", () => {
  assert.deepEqual(Object.keys(recaps), expectedStageIds);
  assert.equal(Object.isFrozen(recaps), true);

  for (const stageId of expectedStageIds) {
    const recap = recaps[stageId];
    assert.equal(Object.isFrozen(recap), true, `${stageId} should be immutable`);
    assert.match(recap.id, /-recap$/u);
    assert.ok(recap.title.length >= 12);
    assert.ok(recap.summary.length >= 80);
    assert.equal(recap.outcomes.length, 3);
    assert.equal(recap.recall.length, 3);
    assert.ok(recap.recall.every((item) => item.prompt.length >= 20));
    assert.ok(recap.recall.every((item) => item.answer.length >= 40));
    assert.ok(recap.bridge.length >= 50);
  }
});

test("recaps teach transferable models without shipping exercise solutions", () => {
  const serialized = JSON.stringify(recaps).toLowerCase();
  for (const forbiddenKey of [
    '"solution"',
    '"solutioncode"',
    '"startercode"',
    '"expectedoutput"',
  ]) {
    assert.equal(
      serialized.includes(forbiddenKey),
      false,
      `recaps should not contain the solution-oriented field ${forbiddenKey}`
    );
  }
});

test("the legacy final-stage id owns the one completion award", () => {
  const awards = Object.entries(recaps)
    .filter(([, recap]) => recap.award)
    .map(([stageId, recap]) => ({ stageId, award: recap.award }));

  assert.equal(awards.length, 1);
  assert.equal(awards[0].stageId, "py10-py11");
  assert.equal(awards[0].award.id, "python-pathforger");
  assert.equal(awards[0].award.name, "Python Pathforger");
});
