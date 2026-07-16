import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modelSource = await readFile(resolve(REPOSITORY_ROOT, "rounding-model.js"), "utf8");
const labSource = await readFile(resolve(REPOSITORY_ROOT, "rounding-lab.js"), "utf8");
const context = vm.createContext({
  Array,
  Math,
  Number,
  Object,
  String,
  TypeError,
  window: {},
});

vm.runInContext(modelSource, context, { filename: "rounding-model.js" });
vm.runInContext(labSource, context, { filename: "rounding-lab.js" });

const model = context.window.ROUNDING_MODEL;
const lab = context.window.ROUNDING_LAB;

test("deriveState exposes the negative-number boundary model used by the view", () => {
  const state = lab.deriveState(model, -2.3, -5, 5);

  assert.equal(state.value, -2.3);
  assert.equal(state.displayValue, "-2.3");
  assert.equal(state.comparison.floor, -3);
  assert.equal(state.comparison.round, -2);
  assert.equal(state.comparison.ceil, -2);
  assert.equal(state.comparison.trunc, -2);
  assert.equal(state.axis.min, -4);
  assert.equal(state.axis.max, -1);
  assert.match(state.observation, /lower boundary is more negative/u);
  assert.equal(
    state.summary,
    "For -2.3: floor -3, round -2, ceiling -2, and truncation -2.",
  );
});

test("deriveState clamps input to normalized lab bounds", () => {
  const upper = lab.deriveState(model, 12, -5, 5);
  const swappedBounds = lab.deriveState(model, -12, 5, -5);

  assert.equal(upper.value, 5);
  assert.equal(upper.min, -5);
  assert.equal(upper.max, 5);
  assert.equal(swappedBounds.value, -5);
  assert.equal(swappedBounds.min, -5);
  assert.equal(swappedBounds.max, 5);
});

test("integer values create a symmetric axis and collapse both boundary markers", () => {
  const state = lab.deriveState(model, 2, -5, 5);

  assert.equal(state.isInteger, true);
  assert.equal(state.axis.min, 0);
  assert.equal(state.axis.max, 4);
  assert.deepEqual(
    Array.from(state.axis.ticks, (tick) => tick.value),
    [0, 1, 2, 3, 4],
  );
  assert.equal(state.axis.floorLeft, 50);
  assert.equal(state.axis.ceilLeft, 50);
  assert.match(state.observation, /already an integer/u);
});

test("halfway values explain Python ties-to-even instead of generic rounding", () => {
  const evenLower = lab.deriveState(model, 2.5, -5, 5);
  const evenUpper = lab.deriveState(model, 3.5, -5, 5);

  assert.equal(evenLower.comparison.round, 2);
  assert.equal(evenUpper.comparison.round, 4);
  assert.match(evenLower.observation, /exactly halfway/u);
  assert.match(evenLower.observation, /even neighbour, 2/u);
  assert.match(evenUpper.observation, /even neighbour, 4/u);
});

test("deriveState is pure, frozen, and rejects invalid inputs", () => {
  const state = lab.deriveState(model, 1.2, -5, 5);

  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.axis), true);
  assert.equal(Object.isFrozen(state.axis.ticks), true);
  assert.throws(() => lab.deriveState(model, Number.NaN, -5, 5), /finite number/u);
  assert.throws(() => lab.deriveState({}, 1, -5, 5), /comparison model/u);
});
