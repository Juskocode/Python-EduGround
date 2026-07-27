import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/features/landing/landing-snake.js"),
  "utf8",
);
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

function asteroidCells(state) {
  return (state.asteroids || []).map((asteroid) =>
    Number.isInteger(asteroid) ? asteroid : asteroid.cell
  );
}

function echoCells(state) {
  const echoes = state.splitEchoes || state.echoes || [];
  return echoes.map((echo) => Number.isInteger(echo) ? echo : echo.cell);
}

function powerUpCell(state) {
  if (!state.powerUp) return null;
  return Number.isInteger(state.powerUp) ? state.powerUp : state.powerUp.cell;
}

function splitTrail(state) {
  const split = snake.splitTrail || snake.split;
  assert.equal(typeof split, "function", "the public model should expose the split mechanic");
  return split(state);
}

function point(cell, width) {
  return {
    x: cell % width,
    y: Math.floor(cell / width),
  };
}

function cell(x, y, width) {
  return y * width + x;
}

function wrappedDistance(first, second, width, height) {
  const start = point(first, width);
  const end = point(second, width);
  const horizontal = Math.abs(start.x - end.x);
  const vertical = Math.abs(start.y - end.y);
  return Math.min(horizontal, width - horizontal) +
    Math.min(vertical, height - vertical);
}

function findSafeHorizontalRun(state, length = 4) {
  const occupied = new Set(asteroidCells(state));
  const activePowerUp = powerUpCell(state);
  if (Number.isInteger(activePowerUp)) occupied.add(activePowerUp);

  for (let y = 0; y < state.height; y += 1) {
    for (let headX = length - 1; headX < state.width - 1; headX += 1) {
      const cells = Array.from(
        { length },
        (_, index) => cell(headX - index, y, state.width),
      );
      const next = cell(headX + 1, y, state.width);
      if (!cells.some((candidate) => occupied.has(candidate)) && !occupied.has(next)) {
        return { cells, next };
      }
    }
  }
  throw new Error("The test fixture could not find a safe horizontal flight path.");
}

function safeEnergyCell(state, excluded) {
  const occupied = new Set([
    ...asteroidCells(state),
    ...state.segments,
    ...(excluded || []),
  ]);
  const activePowerUp = powerUpCell(state);
  if (Number.isInteger(activePowerUp)) occupied.add(activePowerUp);
  for (let candidate = 0; candidate < state.width * state.height; candidate += 1) {
    if (!occupied.has(candidate)) return candidate;
  }
  return null;
}

function prepareSafeStep(state, collectCore = false) {
  const flight = findSafeHorizontalRun(state);
  const fixture = Object.assign({}, state, {
    phase: "running",
    segments: flight.cells.slice(0, 3),
    direction: "right",
    queuedDirection: "right",
    turnQueued: false,
    collision: null,
  });
  fixture.energy = collectCore
    ? flight.next
    : safeEnergyCell(fixture, [flight.next]);
  return fixture;
}

test("the public Snake model is frozen and deterministic", () => {
  assert.equal(Object.isFrozen(snake), true);
  const first = snake.createState({ seed: 20260724 });
  const second = snake.createState({ seed: 20260724 });
  assert.deepEqual(plain(first), plain(second));
});

test("touch swipes resolve on their dominant axis after a deliberate move", () => {
  const resolveSwipe = snake.resolveSwipeDirection;
  assert.equal(typeof resolveSwipe, "function");
  const start = { x: 100, y: 100 };

  assert.equal(resolveSwipe(start, { x: 100, y: 83 }, 18), null);
  assert.equal(resolveSwipe(start, { x: 100, y: 80 }, 18), "up");
  assert.equal(resolveSwipe(start, { x: 122, y: 104 }, 18), "right");
  assert.equal(resolveSwipe(start, { x: 96, y: 124 }, 18), "down");
  assert.equal(resolveSwipe(start, { x: 76, y: 95 }, 18), "left");
  assert.equal(resolveSwipe(null, { x: 80, y: 80 }, 18), null);
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

test("quick core routes build a capped score chain with explicit awards", () => {
  let state = running({ asteroids: [], seed: 1848 });
  const snapshots = [];

  for (let core = 0; core < 4; core += 1) {
    state = snake.step(prepareSafeStep(state, true));
    snapshots.push({
      award: state.lastAward,
      combo: state.comboMultiplier,
      score: state.score,
    });
  }

  assert.deepEqual(snapshots, [
    { award: 10, combo: 1, score: 10 },
    { award: 20, combo: 2, score: 30 },
    { award: 30, combo: 3, score: 60 },
    { award: 30, combo: 3, score: 90 },
  ]);
  assert.equal(state.comboCount, 4);
  assert.equal(state.bestCombo, 4);
  assert.ok(state.comboExpiresAt > state.ticks);
});

test("a score chain expires naturally and splitting trades it for safety", () => {
  let state = running({ asteroids: [], seed: 2772 });
  state = snake.step(prepareSafeStep(state, true));
  state = snake.step(prepareSafeStep(state, true));
  assert.equal(state.comboMultiplier, 2);

  const split = splitTrail(state);
  assert.equal(split.comboCount, 0);
  assert.equal(split.comboMultiplier, 1);
  assert.equal(split.comboExpiresAt, 0);
  assert.equal(split.lastEvent, "split");

  while (state.ticks < state.comboExpiresAt - 1) {
    state = snake.step(prepareSafeStep(state));
  }
  assert.equal(state.comboMultiplier, 2, "the chain should survive until its final move");
  state = snake.step(prepareSafeStep(state));
  assert.equal(state.comboCount, 0);
  assert.equal(state.comboMultiplier, 1);
  assert.equal(state.comboExpiresAt, 0);
  assert.equal(state.lastEvent, "combo-lost");
});

test("core boost compounds with the chain for exactly three core collections", () => {
  let state = running({
    width: 12,
    height: 10,
    asteroids: [],
    segments: [[3, 4], [2, 4], [1, 4]],
    direction: "right",
    energy: [9, 9],
    powerUp: {
      type: "boost",
      cell: [4, 4],
      expiresAt: 20,
    },
  });

  state = snake.step(state);
  assert.equal(state.effects.boostCores, 3);

  const awards = [];
  for (let core = 0; core < 4; core += 1) {
    state = snake.step(prepareSafeStep(state, true));
    awards.push(state.lastAward);
  }

  assert.deepEqual(awards, [20, 40, 60, 30]);
  assert.equal(state.effects.boostCores, 0);
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

test("score is capped at 1000 and reaching the cap clears the sector", () => {
  const state = Object.assign({}, running({
    width: 10,
    height: 8,
    segments: [[2, 2], [1, 2], [0, 2]],
    direction: "right",
    asteroids: [],
    energy: [3, 2],
  }), {
    score: 995,
  });

  const completed = snake.step(state);
  assert.equal(completed.score, 1000);
  assert.equal(completed.lastAward, 5, "the final announcement should report the effective award");
  assert.equal(completed.phase, "won");
  assert.ok(["won", "score-cap", "completed"].includes(completed.lastEvent));
  assert.equal(snake.step(completed), completed, "a completed mission should not exceed the cap");
});

test("completed state cannot be revived with contradictory phase or combo options", () => {
  const completed = snake.createState({
    score: 1000,
    phase: "running",
    comboCount: 9,
    comboExpiresAt: 100,
  });

  assert.equal(completed.phase, "won");
  assert.equal(completed.energy, null);
  assert.equal(completed.comboCount, 0);
  assert.equal(completed.comboMultiplier, 1);
  assert.equal(completed.comboExpiresAt, 0);
  assert.equal(snake.start(completed), completed);
});

test("split sheds the rear trail, grants only three uses, and reset restores them", () => {
  let state = running({
    width: 24,
    height: 14,
    segments: Array.from({ length: 24 }, (_, index) => 47 - index),
    direction: "right",
    asteroids: [],
    energy: 100,
  });
  const initialLength = state.segments.length;
  const observedLengths = [];

  for (let use = 1; use <= 3; use += 1) {
    const before = state;
    state = splitTrail(state);
    assert.notDeepEqual(plain(state), plain(before), `split ${use} should change the state`);
    assert.ok(state.segments.length < before.segments.length, `split ${use} should shed trail cells`);
    assert.ok(echoCells(state).length > 0, `split ${use} should leave a visual echo`);
    observedLengths.push(state.segments.length);
  }

  assert.ok(observedLengths[0] < initialLength);
  const afterLimit = splitTrail(state);
  assert.deepEqual(plain(afterLimit), plain(state), "a fourth split in one mission must be rejected");

  const reset = snake.reset(state);
  assert.equal(echoCells(reset).length, 0);
  const firstSplitAfterReset = splitTrail(snake.start(reset));
  assert.notDeepEqual(
    plain(firstSplitAfterReset),
    plain(snake.start(reset)),
    "reset should restore the split allowance",
  );
});

test("split echoes are non-colliding during their temporary immunity window", () => {
  const splitState = splitTrail(running({
    width: 12,
    height: 10,
    segments: [30, 29, 28, 27, 26, 25, 24, 23],
    direction: "right",
    asteroids: [],
    energy: 90,
  }));
  const echoes = echoCells(splitState);
  assert.ok(echoes.length > 0);

  const target = echoes[0];
  const targetPoint = point(target, splitState.width);
  const head = cell(
    (targetPoint.x - 1 + splitState.width) % splitState.width,
    targetPoint.y,
    splitState.width,
  );
  const safeBody = [
    head,
    cell(head % splitState.width, (targetPoint.y + 2) % splitState.height, splitState.width),
    cell(head % splitState.width, (targetPoint.y + 3) % splitState.height, splitState.width),
  ];
  const crossing = Object.assign({}, splitState, {
    phase: "running",
    segments: safeBody,
    direction: "right",
    queuedDirection: "right",
    turnQueued: false,
    asteroids: [],
    energy: cell(
      (targetPoint.x + 3) % splitState.width,
      (targetPoint.y + 3) % splitState.height,
      splitState.width,
    ),
  });

  const advanced = snake.step(crossing);
  assert.equal(advanced.segments[0], target);
  assert.equal(advanced.phase, "running");
  assert.equal(advanced.collision, null);
});

test("asteroid drift is slow, fair, and deterministic for an equal seed", () => {
  let first = running({ seed: 7411 });
  let second = running({ seed: 7411 });
  let priorSignature = asteroidCells(first).join(",");
  let changes = 0;

  for (let tick = 0; tick < 80; tick += 1) {
    first = snake.step(prepareSafeStep(first));
    second = snake.step(prepareSafeStep(second));
    assert.deepEqual(plain(first.asteroids), plain(second.asteroids));

    const cells = asteroidCells(first);
    const signature = cells.join(",");
    if (signature !== priorSignature) changes += 1;
    priorSignature = signature;

    assert.equal(new Set(cells).size, cells.length, "asteroids must not overlap each other");
    assert.equal(
      cells.some((asteroid) => first.segments.includes(asteroid)),
      false,
      "an asteroid must not drift into the player",
    );
    assert.equal(cells.includes(first.energy), false, "an asteroid must not cover the energy core");
    const activePowerUp = powerUpCell(first);
    if (Number.isInteger(activePowerUp)) {
      assert.equal(cells.includes(activePowerUp), false, "an asteroid must not cover a power-up");
    }
  }

  assert.ok(changes > 0, "the asteroid field should eventually move");
  assert.ok(changes < 27, "asteroids should move substantially slower than the snake");
});

test("warned meteors land deterministically on fair cells and grow the field once", () => {
  function firstImpact(seed) {
    let state = running({
      seed,
      nextMeteorTick: 1,
      maxAsteroids: 8,
    });
    const initialAsteroids = asteroidCells(state);
    state = snake.advanceMeteor(state, 1);
    assert.equal(state.hazardEvent, "meteor-warning");
    assert.ok(state.meteorWarning);
    assert.equal(state.meteorWarning.impactsAt - state.meteorWarning.warnedAt, 12);

    const target = state.meteorWarning.cell;
    assert.equal(state.segments.includes(target), false);
    assert.notEqual(state.energy, target);
    assert.ok(
      wrappedDistance(target, state.segments[0], state.width, state.height) > 3,
      "the warning should leave the player a meaningful escape route",
    );
    assert.ok(
      initialAsteroids.every((asteroid) =>
        wrappedDistance(target, asteroid, state.width, state.height) > 1
      ),
      "the landing cell should not create an overlapping asteroid cluster",
    );

    for (let tick = 2; tick < state.meteorWarning.impactsAt; tick += 1) {
      const priorCount = state.asteroids.length;
      state = snake.advanceMeteor(state, tick);
      assert.equal(state.asteroids.length, priorCount);
      assert.ok(state.meteorWarning, "the red warning should persist until impact");
    }
    state = snake.advanceMeteor(state, state.meteorWarning.impactsAt);
    assert.equal(state.hazardEvent, "meteor-impact");
    assert.equal(state.asteroids.length, initialAsteroids.length + 1);
    assert.ok(state.meteorImpact);
    assert.equal(state.meteorWarning, null);
    return state;
  }

  const first = firstImpact(7719);
  const second = firstImpact(7719);
  assert.deepEqual(plain(first.asteroids), plain(second.asteroids));
  assert.deepEqual(plain(first.meteorImpact), plain(second.meteorImpact));
});

test("meteor impacts reward a safe dodge when their warned cell becomes occupied", () => {
  let state = running({
    seed: 8211,
    asteroids: [],
    maxAsteroids: 2,
    nextMeteorTick: 1,
  });
  state = snake.advanceMeteor(state, 1);
  const target = state.meteorWarning.cell;
  const impactsAt = state.meteorWarning.impactsAt;
  state = Object.assign({}, state, {
    segments: [target].concat(state.segments.slice(0, 2)),
  });

  const dodged = snake.advanceMeteor(state, impactsAt);
  assert.equal(dodged.phase, "running");
  assert.equal(dodged.hazardEvent, "meteor-dodged");
  assert.equal(dodged.meteorWarning, null);
  assert.equal(dodged.meteorImpact, null);
  assert.equal(dodged.asteroids.length, 0);
  assert.equal(dodged.nextMeteorTick, impactsAt + 24);
});

test("freeze pauses meteor deadlines and the asteroid cap remains strict", () => {
  const collectedFreeze = snake.step(running({
    width: 12,
    height: 10,
    asteroids: [],
    maxAsteroids: 2,
    segments: [[3, 4], [2, 4], [1, 4]],
    direction: "right",
    energy: [9, 9],
    powerUp: {
      type: "stasis",
      cell: [4, 4],
      expiresAt: 20,
    },
  }));
  assert.equal(collectedFreeze.effects.stasisTicks, 40);

  const frozen = running({
    asteroids: [],
    maxAsteroids: 2,
    meteorWarning: {
      cell: [9, 2],
      warnedAt: 2,
      impactsAt: 14,
    },
    nextMeteorTick: 50,
    effects: { stasisTicks: 10 },
  });
  const paused = snake.advanceMeteor(frozen, 7);
  assert.equal(
    paused.meteorWarning.warnedAt,
    frozen.meteorWarning.warnedAt + 1
  );
  assert.equal(paused.meteorWarning.impactsAt, 15);
  assert.equal(paused.nextMeteorTick, 51);
  assert.equal(paused.asteroids.length, 0);

  const finalFrozenMove = snake.step(running({
    width: 12,
    height: 10,
    ticks: 5,
    asteroidCadence: 6,
    asteroids: [[8, 1]],
    maxAsteroids: 1,
    segments: [[3, 4], [2, 4], [1, 4]],
    direction: "right",
    energy: [9, 9],
    effects: { stasisTicks: 1 },
  }));
  assert.deepEqual(plain(finalFrozenMove.asteroids), [
    cell(8, 1, finalFrozenMove.width),
  ]);
  assert.equal(finalFrozenMove.effects.stasisTicks, 0);

  const expiredImpact = snake.advanceMeteor(running({
    ticks: 4,
    asteroids: [],
    maxAsteroids: 2,
    effects: { stasisTicks: 10 },
    meteorImpact: {
      cell: [8, 2],
      expiresAt: 5,
    },
  }), 5);
  assert.equal(expiredImpact.meteorImpact, null);

  const capped = running({
    width: 10,
    height: 8,
    asteroids: [[4, 1], [7, 5]],
    maxAsteroids: 2,
    nextMeteorTick: 0,
  });
  const afterCap = snake.advanceMeteor(capped, 20);
  assert.equal(afterCap.meteorWarning, null);
  assert.equal(afterCap.asteroids.length, 2);
  assert.equal(afterCap.asteroids.length, afterCap.maxAsteroids);
});

test("power-up spawning and placement remain deterministic and collectible", () => {
  function runUntilPowerUp(seed) {
    let state = running({ seed, asteroids: [] });
    for (let attempt = 0; attempt < 120 && !state.powerUp; attempt += 1) {
      state = snake.step(prepareSafeStep(state, true));
    }
    assert.ok(state.powerUp, "a long successful mission should eventually receive a power-up");
    return state;
  }

  const first = runUntilPowerUp(4404);
  const second = runUntilPowerUp(4404);
  assert.deepEqual(plain(first.powerUp), plain(second.powerUp));
  assert.ok(first.powerUp.spawnedAt <= first.ticks);
  assert.ok(first.powerUp.expiresAt > first.ticks);

  const target = powerUpCell(first);
  assert.equal(first.segments.includes(target), false);
  assert.equal(asteroidCells(first).includes(target), false);
  assert.notEqual(first.energy, target);

  const targetPoint = point(target, first.width);
  const head = cell((targetPoint.x - 1 + first.width) % first.width, targetPoint.y, first.width);
  const beforeEffects = plain(first.effects || {});
  const collecting = Object.assign({}, first, {
    phase: "running",
    segments: [
      head,
      cell(head % first.width, (targetPoint.y + 2) % first.height, first.width),
      cell(head % first.width, (targetPoint.y + 3) % first.height, first.width),
    ],
    direction: "right",
    queuedDirection: "right",
    turnQueued: false,
    asteroids: [],
    energy: cell(
      (targetPoint.x + 3) % first.width,
      (targetPoint.y + 3) % first.height,
      first.width,
    ),
  });
  const collected = snake.step(collecting);

  assert.notEqual(powerUpCell(collected), target, "the collected power-up should leave its cell");
  assert.notDeepEqual(
    plain(collected.effects || {}),
    beforeEffects,
    "collection should activate a deterministic gameplay effect",
  );
});

test("core and power-up spawns avoid asteroid-adjacent cells when room exists", () => {
  for (let seed = 1; seed <= 24; seed += 1) {
    const collected = snake.step(running({
      width: 12,
      height: 10,
      seed,
      segments: [[3, 4], [2, 4], [1, 4]],
      direction: "right",
      asteroids: [[8, 1], [9, 6], [2, 8]],
      energy: [4, 4],
    }));
    assert.ok(
      asteroidCells(collected).every((asteroid) =>
        wrappedDistance(
          collected.energy,
          asteroid,
          collected.width,
          collected.height,
        ) > 1
      ),
      `seed ${seed} should place the next core outside asteroid danger cells`,
    );
  }

  let state = running({ seed: 9029 });
  for (let move = 0; move < 80 && !state.powerUp; move += 1) {
    state = snake.step(prepareSafeStep(state));
  }
  assert.ok(state.powerUp);
  assert.ok(
    asteroidCells(state).every((asteroid) =>
      wrappedDistance(
        powerUpCell(state),
        asteroid,
        state.width,
        state.height,
      ) > 1
    ),
  );
});

test("falling stars follow a rare deterministic schedule and expire", () => {
  function firstFallingStar(seed) {
    let state = running({ seed, asteroids: [], energy: 0 });
    for (let tick = 1; tick <= 1_000; tick += 1) {
      state = snake.step(prepareSafeStep(state));
      if (Array.isArray(state.fallingStars) && state.fallingStars.length) {
        return { state, tick };
      }
    }
    throw new Error("No falling star appeared within the deterministic test horizon.");
  }

  const first = firstFallingStar(90210);
  const second = firstFallingStar(90210);
  assert.equal(first.tick, second.tick);
  assert.deepEqual(plain(first.state.fallingStars), plain(second.state.fallingStars));
  assert.ok(first.tick >= 50, "falling stars should remain a rare event");

  let state = first.state;
  let lifetime = 0;
  while (state.fallingStars.length && lifetime < 120) {
    state = snake.step(prepareSafeStep(state));
    lifetime += 1;
  }
  assert.ok(lifetime > 0);
  assert.ok(lifetime < 120, "falling stars should expire instead of accumulating");
  assert.equal(state.fallingStars.length, 0);
});
