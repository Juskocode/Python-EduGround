import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(REPOSITORY_ROOT, "landing-snake.js"), "utf8");
const context = vm.createContext({
  Array,
  Boolean,
  Map,
  Math,
  Number,
  Object,
  Set,
  String,
  window: {},
});
vm.runInContext(source, context, { filename: "landing-snake.js" });
const snake = context.window.LANDING_SNAKE;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function running(options) {
  return snake.start(snake.createState(options));
}

test("the public Snake model is frozen and deterministic", () => {
  assert.equal(Object.isFrozen(snake), true);
  const first = snake.createState({ seed: 20260724 });
  const second = snake.createState({ seed: 20260724 });
  assert.deepEqual(plain(first), plain(second));
});

test("the initial ship, data core, and asteroid field never overlap", () => {
  const state = snake.createState();
  const occupied = new Set([...state.segments, ...state.asteroids]);
  assert.equal(occupied.size, state.segments.length + state.asteroids.length);
  assert.equal(occupied.has(state.energy), false);
  assert.equal(state.phase, "idle");
  assert.equal(state.score, 0);
});

test("one legal turn is queued per tick and direct reversal is rejected", () => {
  const state = running({ asteroids: [], energy: [18, 12] });
  assert.equal(snake.queueTurn(state, "left"), state);

  const turned = snake.queueTurn(state, "up");
  assert.notEqual(turned, state);
  assert.equal(turned.queuedDirection, "up");
  assert.equal(snake.queueTurn(turned, "left"), turned);

  const advanced = snake.step(turned);
  assert.equal(advanced.direction, "up");
  assert.equal(advanced.turnQueued, false);
  assert.equal(advanced.ticks, 1);
});

test("the friendly opening line collects energy and grows the trail", () => {
  let state = running({ asteroids: [], seed: 42 });
  const initialLength = state.segments.length;
  for (let index = 0; index < 5; index += 1) {
    state = snake.step(state);
  }
  assert.equal(state.score, 10);
  assert.equal(state.segments.length, initialLength + 1);
  assert.equal(state.lastEvent, "collected");
  assert.notEqual(state.energy, state.segments[0]);
});

test("crossing the orbital edge wraps to the opposite side", () => {
  const state = running({
    width: 10,
    height: 8,
    segments: [[0, 3], [1, 3], [2, 3]],
    direction: "left",
    asteroids: [],
    energy: [5, 7],
  });
  const advanced = snake.step(state);
  assert.equal(advanced.segments[0], 39);
  assert.equal(advanced.phase, "running");
});

test("asteroid and trail collisions end the mission", () => {
  const asteroidState = running({
    width: 10,
    height: 8,
    segments: [[2, 2], [1, 2], [0, 2]],
    asteroids: [[3, 2]],
    energy: [7, 7],
  });
  const asteroidCrash = snake.step(asteroidState);
  assert.equal(asteroidCrash.phase, "lost");
  assert.equal(asteroidCrash.collision, "asteroid");

  const trailState = running({
    width: 10,
    height: 8,
    segments: [[1, 1], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]],
    direction: "down",
    asteroids: [],
    energy: [7, 7],
  });
  const trailCrash = snake.step(trailState);
  assert.equal(trailCrash.phase, "lost");
  assert.equal(trailCrash.collision, "trail");
});

test("moving into a vacating tail cell remains legal", () => {
  const state = running({
    width: 10,
    height: 8,
    segments: [[1, 1], [2, 1], [2, 0], [1, 0]],
    direction: "up",
    asteroids: [],
    energy: [7, 7],
  });
  const advanced = snake.step(state);
  assert.equal(advanced.phase, "running");
  assert.equal(advanced.segments[0], 1);
  assert.equal(advanced.segments.length, 4);
});

test("collecting the last free cell clears the sector", () => {
  const width = 10;
  const height = 8;
  const open = new Set([0, 1, 2, 10]);
  const asteroids = Array.from({ length: width * height }, (_, index) => index)
    .filter((index) => !open.has(index));
  const state = running({
    width,
    height,
    segments: [0, 1, 2],
    direction: "down",
    asteroids,
    energy: 10,
  });
  const won = snake.step(state);
  assert.equal(won.phase, "won");
  assert.equal(won.energy, null);
  assert.equal(won.score, 10);
});

test("pause freezes state and reset restores the same fair opening", () => {
  const state = running({ seed: 8128 });
  const paused = snake.pause(state);
  assert.equal(paused.phase, "paused");
  assert.equal(snake.step(paused), paused);

  const advanced = snake.step(state);
  const reset = snake.reset(advanced);
  const fresh = snake.createState({ seed: 8128 });
  assert.deepEqual(plain(reset), plain(fresh));
});

test("the field description reports meaningful coordinates without visual access", () => {
  const description = snake.describe(snake.createState());
  assert.match(description, /Python Snake is at column \d+, row \d+/u);
  assert.match(description, /energy core is at column \d+, row \d+/u);
  assert.match(description, /asteroid/iu);
});
