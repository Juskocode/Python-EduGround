import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/features/pygame/pygame-labs.js"),
  "utf8",
);
const context = vm.createContext({
  Array,
  Boolean,
  Math,
  Number,
  Object,
  String,
  window: {},
});

vm.runInContext(source, context, { filename: "pygame-labs.js" });
const labs = context.window.PYGAME_LABS;

test("the Pygame lab API exposes frozen deterministic models", () => {
  assert.equal(typeof labs.create, "function");
  assert.equal(typeof labs.chooseDeterministicSpawn, "function");
  assert.equal(typeof labs.stepSnake, "function");
  assert.equal(typeof labs.stepPlatformer, "function");
  assert.equal(typeof labs.stepSystems, "function");
  assert.equal(Object.isFrozen(labs), true);
  assert.equal(typeof labs.create().renderFrameTracer, "function");

  const snake = labs.createSnakeState();
  const platformer = labs.createPlatformerState();

  assert.equal(Object.isFrozen(snake), true);
  assert.equal(Object.isFrozen(snake.snake), true);
  assert.equal(Object.isFrozen(platformer), true);
  assert.equal(snake.snake.length, 3);
  assert.equal(platformer.grounded, true);
});

test("Snake keeps input in the event queue until the next frame", () => {
  const initial = labs.createSnakeState();
  const queued = labs.queueSnakeDirection(initial, "up");

  assert.equal(initial.direction, "right");
  assert.equal(queued.direction, "right");
  assert.equal(queued.queuedDirection, "up");
  assert.match(queued.lastEvent, /Queued up/u);

  const next = labs.stepSnake(queued);
  assert.equal(next.direction, "up");
  assert.equal(next.tick, 1);
  assert.equal(next.snake.length, 3);
  assert.equal(next.snake[0].x, initial.snake[0].x);
  assert.equal(next.snake[0].y, initial.snake[0].y - 1);
  assert.match(next.lastUpdate, /removed the tail/u);
});

test("Snake rejects reversal, grows at food, and can disable edge wrapping", () => {
  const initial = labs.createSnakeState({ food: { x: 7, y: 4 } });
  const reversed = labs.queueSnakeDirection(initial, "left");

  assert.equal(reversed.queuedDirection, "right");
  assert.match(reversed.lastEvent, /cannot reverse/u);

  const ate = labs.stepSnake(initial);
  assert.equal(ate.status, "ate");
  assert.equal(ate.score, 1);
  assert.equal(ate.snake.length, 4);

  let bounded = labs.createSnakeState({ wrap: false });
  for (let frame = 0; frame < bounded.width; frame += 1) {
    bounded = labs.stepSnake(bounded, { wrap: false });
  }
  assert.equal(bounded.status, "collision");
  assert.match(bounded.lastUpdate, /Boundary collision/u);
});

test("Snake completes a full grid without respawning food inside its body", () => {
  const width = 8;
  const height = 6;
  const food = { x: 1, y: 0 };
  const cells = Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
  })).filter((cell) => cell.x !== food.x || cell.y !== food.y);
  const head = cells.findIndex((cell) => cell.x === 0 && cell.y === 0);
  cells.unshift(cells.splice(head, 1)[0]);
  const state = Object.freeze({
    width,
    height,
    snake: Object.freeze(cells.map(Object.freeze)),
    food: Object.freeze(food),
    direction: "right",
    queuedDirection: "right",
    wrap: true,
    tick: 10,
    score: 44,
    status: "moving",
    lastEvent: "",
    lastUpdate: "",
  });

  const completed = labs.stepSnake(state);
  assert.equal(completed.status, "complete");
  assert.equal(completed.food, null);
  assert.equal(completed.snake.length, width * height);
  assert.equal(completed.score, 45);
  assert.equal(labs.stepSnake(completed), completed);
});

test("platformer parameters are bounded before entering the physics update", () => {
  const parameters = labs.normalizePlatformerParameters({
    gravity: 100,
    jumpStrength: -10,
    moveSpeed: Number.NaN,
    delta: 2,
  });

  assert.deepEqual(
    {
      gravity: parameters.gravity,
      jumpStrength: parameters.jumpStrength,
      moveSpeed: parameters.moveSpeed,
      delta: parameters.delta,
    },
    {
      gravity: 32,
      jumpStrength: 3,
      moveSpeed: 5,
      delta: 0.25,
    },
  );
  assert.equal(Object.isFrozen(parameters), true);
});

test("platformer jump, gravity, landing, and camera remain separate state transitions", () => {
  const parameters = {
    gravity: 18,
    jumpStrength: 10,
    moveSpeed: 5,
    delta: 0.12,
  };
  let state = labs.createPlatformerState();
  state = labs.stepPlatformer(state, { horizontal: 0, jump: true }, parameters);

  assert.equal(state.grounded, false);
  assert.equal(state.y > 0, true);
  assert.equal(state.vy > 0, true);

  let highestY = state.y;
  for (let frame = 0; frame < 30 && !state.grounded; frame += 1) {
    state = labs.stepPlatformer(state, { horizontal: 0, jump: false }, parameters);
    highestY = Math.max(highestY, state.y);
  }
  assert.equal(highestY > 1, true);
  assert.equal(state.grounded, true);
  assert.equal(state.y, 0);
  assert.equal(state.vy, 0);
  assert.match(state.lastCollision, /ground/u);

  for (let frame = 0; frame < 16; frame += 1) {
    state = labs.stepPlatformer(state, { horizontal: 1, jump: false }, parameters);
  }
  assert.equal(state.x > 8, true);
  assert.equal(state.vx, 5);
  assert.equal(state.cameraX > 0, true);
});

test("deterministic spawn selection avoids occupied cells and replays from one seed", () => {
  const occupied = [1, 5, 9];
  const first = labs.chooseDeterministicSpawn(12, occupied, 4);
  const replay = labs.chooseDeterministicSpawn(12, occupied, 4);

  assert.equal(first, 11);
  assert.equal(replay, first);
  assert.equal(occupied.includes(first), false);
  assert.equal(
    labs.chooseDeterministicSpawn(3, [0, 1, 2], 99),
    null,
  );
});

test("systems lab keeps scene transitions, deterministic spawns, and boost time explicit", () => {
  let state = labs.createSystemsState({ spawnSeed: 4 });
  const initialSpawn = state.spawnCell;

  assert.equal(state.mode, "title");
  assert.equal(state.score, 0);
  assert.equal(Object.isFrozen(state.occupiedCells), true);

  const ignoredCollection = labs.stepSystems(state, "collect");
  assert.equal(ignoredCollection.score, 0);
  assert.equal(ignoredCollection.mode, "title");

  state = labs.stepSystems(state, "start");
  assert.equal(state.mode, "running");

  state = labs.stepSystems(state, "collect");
  assert.equal(state.score, 50);
  assert.equal(state.boostRemainingMs, 1500);
  assert.notEqual(state.spawnCell, initialSpawn);

  state = labs.stepSystems(state, "toggle-pause");
  const paused = labs.stepSystems(state, "tick", 1000);
  assert.equal(paused.mode, "paused");
  assert.equal(paused.tick, state.tick);
  assert.equal(paused.boostRemainingMs, 1500);

  state = labs.stepSystems(paused, "toggle-pause");
  state = labs.stepSystems(state, "tick", 1000);
  state = labs.stepSystems(state, "tick", 800);
  assert.equal(state.tick, 2);
  assert.equal(state.boostRemainingMs, 0);
  assert.match(state.lastTransition, /expired once/u);

  state = labs.stepSystems(state, "collision");
  assert.equal(state.mode, "game-over");
  state = labs.stepSystems(state, "restart");
  assert.equal(state.mode, "running");
  assert.equal(state.tick, 0);
  assert.equal(state.score, 0);
});
