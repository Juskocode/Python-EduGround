import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(REPOSITORY_ROOT, "rounding-model.js"), "utf8");
const context = vm.createContext({ Number, Math, Object, TypeError, window: {} });
vm.runInContext(source, context, { filename: "rounding-model.js" });
const model = context.window.ROUNDING_MODEL;

test("Python-compatible integer rounding uses ties to even", () => {
  for (const [value, expected] of [
    [-3.5, -4],
    [-2.5, -2],
    [-0.5, 0],
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
    [3.5, 4],
    [4.5, 4],
  ]) {
    assert.equal(model.roundInteger(value), expected, `round(${value})`);
  }
});

test("values merely close to a tie still round by distance", () => {
  assert.equal(model.roundInteger(2.5000000001), 3);
  assert.equal(model.roundInteger(3.4999999999), 3);
  assert.equal(model.roundInteger(-2.5000000001), -3);
  assert.equal(model.roundInteger(-3.4999999999), -3);
});

test("display text preserves boundary differences used by the calculation", () => {
  for (const [value, expectedRound, expectedCeil] of [
    [2.50001, 3, 3],
    [2.49999, 2, 3],
    [2.00001, 2, 3],
    [1.99999, 2, 2],
  ]) {
    const comparison = model.compare(value);
    assert.equal(model.format(comparison.value), String(value));
    assert.equal(comparison.round, expectedRound);
    assert.equal(comparison.ceil, expectedCeil);
  }
});

test("the comparison model distinguishes floor, ceiling, and truncation for negatives", () => {
  assert.deepEqual(
    { ...model.compare(-2.3) },
    { value: -2.3, floor: -3, round: -2, ceil: -2, trunc: -2 },
  );
  assert.deepEqual(
    { ...model.compare(2.3) },
    { value: 2.3, floor: 2, round: 2, ceil: 3, trunc: 2 },
  );
});

test("the comparison model normalizes negative zero and rejects non-finite values", () => {
  assert.equal(Object.is(model.compare(-0.2).trunc, -0), false);
  assert.equal(model.compare(-0.2).trunc, 0);
  assert.throws(() => model.compare(Number.POSITIVE_INFINITY), /finite number/u);
  assert.throws(() => model.compare(Number.NaN), /finite number/u);
});
