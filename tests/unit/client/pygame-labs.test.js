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
  assert.equal(typeof labs.stepSnake, "function");
  assert.equal(typeof labs.stepPlatformer, "function");
  assert.equal(Object.isFrozen(labs), true);

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
