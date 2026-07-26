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
  assert.equal(typeof labs.runPlatformerCollisionDrill, "function");
  assert.equal(typeof labs.stepSystems, "function");
  assert.equal(typeof labs.createProgressTracker, "function");
  assert.equal(typeof labs.deriveFrameTrace, "function");
  assert.equal(Object.isFrozen(labs), true);
  const controller = labs.create();
  assert.equal(typeof controller.renderFrameTracer, "function");
  assert.equal(typeof controller.activate, "function");
  assert.equal(typeof controller.deactivate, "function");
  assert.equal(typeof controller.destroy, "function");

  const snake = labs.createSnakeState();
  const platformer = labs.createPlatformerState();

  assert.equal(Object.isFrozen(snake), true);
  assert.equal(Object.isFrozen(snake.snake), true);
  assert.equal(Object.isFrozen(platformer), true);
  assert.equal(snake.snake.length, 3);
  assert.equal(platformer.grounded, true);
});

test("frame trace controls derive scenario-specific snapshots", () => {
  const snakeRight = labs.deriveFrameTrace(
    { id: "snake-food" },
    { direction: "right", elapsedMs: 50, jump: "off", wrap: "on" },
  );
  const snakeUp = labs.deriveFrameTrace(
    { id: "snake-food" },
    { direction: "up", elapsedMs: 50, jump: "off", wrap: "on" },
  );

  assert.equal(Object.isFrozen(snakeRight), true);
  assert.match(snakeRight.candidate, /food contact=True/u);
  assert.match(snakeRight.committed, /length=4/u);
  assert.match(snakeUp.candidate, /food contact=False/u);
  assert.match(snakeUp.committed, /length=3/u);
  assert.notEqual(snakeRight.candidate, snakeUp.candidate);

  const shortFall = labs.deriveFrameTrace(
    { id: "platform-land" },
    { direction: "right", elapsedMs: 10, jump: "off" },
  );
  const longFall = labs.deriveFrameTrace(
    { id: "platform-land" },
    { direction: "left", elapsedMs: 250, jump: "on" },
  );
  assert.match(shortFall.committed, /grounded=False/u);
  assert.match(longFall.committed, /grounded=True/u);
  assert.notEqual(shortFall.intent, longFall.intent);

  const activePower = labs.deriveFrameTrace(
    { id: "power-expiry" },
    { elapsedMs: 100 },
  );
  const expiredPower = labs.deriveFrameTrace(
    { id: "power-expiry" },
    { elapsedMs: 250 },
  );
  assert.match(activePower.committed, /effect remains active/u);
  assert.match(expiredPower.committed, /effect-expired event emitted once/u);
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

test("Snake commits at most one queued direction per frame", () => {
  const initial = labs.createSnakeState();
  const queued = labs.queueSnakeDirection(initial, "up");
  const ignored = labs.queueSnakeDirection(queued, "left");

  assert.equal(ignored.queuedDirection, "up");
  assert.match(ignored.lastEvent, /one direction is already queued/u);

  const next = labs.stepSnake(ignored);
  const nextQueued = labs.queueSnakeDirection(next, "left");
  assert.equal(nextQueued.queuedDirection, "left");
});

test("studio progress callbacks persist discoveries and whole-lab completion", () => {
  const savedDiscoveries = new Set(["snake-event"]);
  const savedLabs = new Set();
  const discoveryWrites = [];
  const labWrites = [];
  const activeWrites = [];
  const tracker = labs.createProgressTracker({
    activeLab: "snake",
    isDiscoveryComplete: (id) => savedDiscoveries.has(id),
    isLabComplete: (id) => savedLabs.has(id),
    onDiscoveryComplete: (id) => {
      discoveryWrites.push(id);
      savedDiscoveries.add(id);
    },
    onLabComplete: (id) => {
      labWrites.push(id);
      savedLabs.add(id);
    },
    onActiveLabChange: (id) => activeWrites.push(id),
  });

  assert.equal(tracker.getActiveLab(), "snake");
  assert.equal(tracker.isDiscoveryComplete("snake-event"), true);
  assert.equal(tracker.complete("snake-event"), false);
  assert.equal(tracker.complete("snake-update"), true);
  assert.equal(tracker.complete("snake-food"), true);
  assert.deepEqual(discoveryWrites, ["snake-update", "snake-food"]);
  assert.deepEqual(labWrites, ["snake"]);
  assert.equal(tracker.isLabComplete("snake"), true);

  assert.equal(tracker.select("systems"), true);
  assert.equal(tracker.select("systems"), false);
  assert.deepEqual(activeWrites, ["systems"]);
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

test("Snake normalizes initial food off its body and safely steps without food", () => {
  const baseline = labs.createSnakeState();
  const normalized = labs.createSnakeState({ food: baseline.snake[0] });

  assert.equal(
    normalized.snake.some(
      (segment) => segment.x === normalized.food.x && segment.y === normalized.food.y,
    ),
    false,
  );

  const withoutFood = Object.freeze({
    ...baseline,
    food: null,
  });
  const stepped = labs.stepSnake(withoutFood);
  assert.equal(stepped.food, null);
  assert.equal(stepped.score, baseline.score);
  assert.equal(stepped.snake.length, baseline.snake.length);
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
  assert.equal(labs.normalizePlatformerParameters().jumpStrength, 11.5);
  assert.equal(labs.normalizePlatformerParameters().delta, 0.09);
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

test("the reachable default jump can land feet-first on the first platform", () => {
  const parameters = labs.normalizePlatformerParameters();
  let state = labs.createPlatformerState({ x: 5 });
  state = labs.stepPlatformer(
    state,
    { horizontal: 1, jump: true },
    parameters,
  );

  let landed = false;
  for (let frame = 0; frame < 40 && !landed; frame += 1) {
    state = labs.stepPlatformer(
      state,
      { horizontal: 1, jump: false },
      parameters,
    );
    landed = state.contacts.feet === "platform-1";
  }

  assert.equal(landed, true);
  assert.equal(state.y, 2.2);
  assert.equal(state.vy, 0);
  assert.equal(state.grounded, true);
  assert.match(state.lastCollision, /^FEET/u);
});

test("platformer collision drills identify and freeze every contacted body part", () => {
  const baseline = labs.createPlatformerState();
  const expected = {
    feet: "platform-1",
    head: "platform-1",
    left: "platform-1",
    right: "platform-1",
  };

  Object.entries(expected).forEach(([part, platform]) => {
    const state = labs.runPlatformerCollisionDrill(part, baseline);
    assert.equal(state.contacts[part], platform);
    assert.equal(Object.isFrozen(state), true);
    assert.equal(Object.isFrozen(state.contacts), true);
    assert.match(state.lastCollision, new RegExp(`^${part.toUpperCase()}`, "u"));
    if (part === "feet") {
      assert.equal(state.grounded, true);
      assert.equal(state.vy, 0);
    }
    if (part === "head") {
      assert.equal(state.grounded, false);
      assert.equal(state.vy, 0);
    }
    if (part === "left" || part === "right") {
      assert.equal(state.vx, 0);
    }
  });
});

test("side-collision drills stay deterministic across the full speed range", () => {
  const baseline = labs.createPlatformerState();
  [
    { gravity: 4, jumpStrength: 3, moveSpeed: 1, delta: 0.04 },
    labs.normalizePlatformerParameters(),
    { gravity: 32, jumpStrength: 20, moveSpeed: 10, delta: 0.25 },
  ].forEach((parameters) => {
    const left = labs.runPlatformerCollisionDrill(
      "left",
      baseline,
      parameters,
    );
    const right = labs.runPlatformerCollisionDrill(
      "right",
      baseline,
      parameters,
    );
    assert.equal(left.contacts.left, "platform-1");
    assert.equal(right.contacts.right, "platform-1");
    assert.equal(left.vx, 0);
    assert.equal(right.vx, 0);
  });
});

test("part contacts clear on the next free frame", () => {
  const contacted = labs.runPlatformerCollisionDrill(
    "head",
    labs.createPlatformerState(),
  );
  const clear = labs.stepPlatformer(
    {
      ...contacted,
      x: 14,
      y: 3,
      vy: 1,
      grounded: false,
    },
    { horizontal: 0, jump: false },
    { gravity: 4, jumpStrength: 11.5, moveSpeed: 5, delta: 0.04 },
  );

  assert.deepEqual(
    {
      feet: clear.contacts.feet,
      head: clear.contacts.head,
      left: clear.contacts.left,
      right: clear.contacts.right,
    },
    { feet: null, head: null, left: null, right: null },
  );
  assert.match(clear.lastCollision, /No player body part/u);
});

test("world boundaries resolve against the player's left and right body edges", () => {
  const parameters = {
    gravity: 4,
    jumpStrength: 11.5,
    moveSpeed: 10,
    delta: 0.25,
  };
  const leftStart = labs.createPlatformerState({ x: -100 });
  const left = labs.stepPlatformer(
    leftStart,
    { horizontal: -1, jump: false },
    parameters,
  );
  assert.equal(left.x, 0.42);
  assert.equal(left.contacts.left, "world boundary");
  assert.equal(left.vx, 0);

  const rightStart = labs.createPlatformerState({ x: 100 });
  const right = labs.stepPlatformer(
    rightStart,
    { horizontal: 1, jump: false },
    parameters,
  );
  assert.equal(right.x, right.worldWidth - 0.42);
  assert.equal(right.contacts.right, "world boundary");
  assert.equal(right.vx, 0);
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
  assert.equal(state.baseSpawnSeed, 4);
  assert.equal(state.spawnSeed, 5);
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
  assert.equal(state.baseSpawnSeed, 4);
  assert.equal(state.spawnSeed, 4);
  assert.equal(state.spawnCell, initialSpawn);
});

test("systems lab rejects collection when no deterministic spawn is available", () => {
  let state = labs.createSystemsState({
    cellCount: 8,
    occupiedCells: [0, 1, 2, 3, 4, 5, 6, 7],
    spawnSeed: 12,
  });

  assert.equal(state.spawnCell, null);
  state = labs.stepSystems(state, "start");
  const rejected = labs.stepSystems(state, "collect");

  assert.equal(rejected.score, 0);
  assert.equal(rejected.boostRemainingMs, 0);
  assert.equal(rejected.spawnSeed, 12);
  assert.equal(rejected.baseSpawnSeed, 12);
  assert.match(rejected.lastTransition, /no free power-up cell/u);
});
