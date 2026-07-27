(function (global) {
  "use strict";

  if (!global) {
    return;
  }

  var DIRECTIONS = Object.freeze({
    up: Object.freeze({ x: 0, y: -1 }),
    right: Object.freeze({ x: 1, y: 0 }),
    down: Object.freeze({ x: 0, y: 1 }),
    left: Object.freeze({ x: -1, y: 0 }),
  });
  var DIRECTION_NAMES = Object.freeze(["up", "right", "down", "left"]);
  var OPPOSITES = Object.freeze({
    up: "down",
    right: "left",
    down: "up",
    left: "right",
  });
  var POWER_UP_DETAILS = Object.freeze({
    shield: Object.freeze({
      name: "Shield",
      effect: "blocks 1 asteroid",
      glyph: "S",
    }),
    boost: Object.freeze({
      name: "2× Core",
      effect: "doubles the next 3 cores",
      glyph: "2×",
    }),
    stasis: Object.freeze({
      name: "Freeze",
      effect: "stops rocks and meteors for 40 moves",
      glyph: "F",
    }),
  });
  var POWER_UP_TYPES = Object.freeze(Object.keys(POWER_UP_DETAILS));
  var DEFAULT_ASTEROIDS = Object.freeze([
    Object.freeze([4, 2]),
    Object.freeze([17, 2]),
    Object.freeze([15, 9]),
    Object.freeze([21, 12]),
  ]);
  var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  var BEST_SCORE_KEY = "fp-playground.snake.best.v1";
  var MAX_SCORE = 1000;
  var BASE_CORE_POINTS = 10;
  var MAX_SPLITS = 3;
  var SPLIT_PHASE_TICKS = 10;
  var DEFAULT_ASTEROID_CADENCE = 24;
  var MAX_ASTEROIDS = 8;
  var METEOR_WARNING_TICKS = 12;
  var METEOR_DESCENT_TICKS = 7;
  var METEOR_IMPACT_TICKS = 6;
  var METEOR_RETRY_TICKS = 24;
  var METEOR_MIN_GAP = 52;
  var METEOR_GAP_JITTER = 36;
  var POWER_UP_LIFETIME = 72;
  var POWER_UP_TIMER_CIRCUMFERENCE = 3.08;
  var FALLING_STAR_LIFETIME = 14;
  var COMBO_WINDOW_TICKS = 36;
  var MAX_COMBO_MULTIPLIER = 3;
  var SEGMENT_POOL_SIZE = 3 + MAX_SCORE / BASE_CORE_POINTS;
  var SWIPE_THRESHOLD = 18;

  function clampInteger(value, fallback, minimum, maximum) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
  }

  function cellIndex(x, y, width) {
    return y * width + x;
  }

  function coordinates(index, width) {
    return {
      x: index % width,
      y: Math.floor(index / width),
    };
  }

  function normalizeCell(value, width, height) {
    var candidate = value && typeof value === "object" && !Array.isArray(value)
      ? value.cell
      : value;
    if (Number.isInteger(candidate) && candidate >= 0 && candidate < width * height) {
      return candidate;
    }
    if (Array.isArray(candidate) && candidate.length >= 2) {
      var x = clampInteger(candidate[0], -1, -1, width);
      var y = clampInteger(candidate[1], -1, -1, height);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        return cellIndex(x, y, width);
      }
    }
    return null;
  }

  function nextSeed(seed) {
    return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  }

  function resolveSwipeDirection(startPoint, currentPoint, threshold) {
    if (!startPoint || !currentPoint) {
      return null;
    }
    var horizontal = Number(currentPoint.x) - Number(startPoint.x);
    var vertical = Number(currentPoint.y) - Number(startPoint.y);
    if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) {
      return null;
    }
    var minimum = clampInteger(threshold, SWIPE_THRESHOLD, 8, 80);
    if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < minimum) {
      return null;
    }
    if (Math.abs(horizontal) > Math.abs(vertical)) {
      return horizontal > 0 ? "right" : "left";
    }
    return vertical > 0 ? "down" : "up";
  }

  function powerUpLabel(type) {
    return POWER_UP_DETAILS[type] ? POWER_UP_DETAILS[type].name : "Power-up";
  }

  function powerUpEffect(type) {
    return POWER_UP_DETAILS[type]
      ? POWER_UP_DETAILS[type].effect
      : "adds a temporary effect";
  }

  function powerUpGlyph(type) {
    return POWER_UP_DETAILS[type] ? POWER_UP_DETAILS[type].glyph : "?";
  }

  function toroidalDistance(first, second, width, height) {
    var firstPoint = coordinates(first, width);
    var secondPoint = coordinates(second, width);
    var horizontal = Math.abs(firstPoint.x - secondPoint.x);
    var vertical = Math.abs(firstPoint.y - secondPoint.y);
    return Math.min(horizontal, width - horizontal) +
      Math.min(vertical, height - vertical);
  }

  function fairSpawnCells(state, candidates, segments) {
    var trail = Array.isArray(segments) && segments.length
      ? segments
      : state.segments;
    var head = trail[0];
    var asteroidSafe = candidates.filter(function (cell) {
      return state.asteroids.every(function (asteroid) {
        return toroidalDistance(cell, asteroid, state.width, state.height) > 1;
      });
    });
    var routeSafe = asteroidSafe.filter(function (cell) {
      return toroidalDistance(cell, head, state.width, state.height) > 1;
    });
    if (routeSafe.length) return routeSafe;
    if (asteroidSafe.length) return asteroidSafe;
    return candidates;
  }

  function availableCells(state, segments, energy, excludedCell) {
    var occupied = new Set(segments || state.segments);
    state.asteroids.forEach(function (cell) {
      occupied.add(cell);
    });
    if (Number.isInteger(energy)) {
      occupied.add(energy);
    }
    if (Number.isInteger(excludedCell)) {
      occupied.add(excludedCell);
    }
    if (
      state.meteorWarning &&
      Number.isInteger(state.meteorWarning.cell)
    ) {
      occupied.add(state.meteorWarning.cell);
    }
    var available = [];
    for (var cell = 0; cell < state.width * state.height; cell += 1) {
      if (!occupied.has(cell)) {
        available.push(cell);
      }
    }
    return available;
  }

  function chooseEnergy(state, segments) {
    var powerUpCell = state.powerUp && Number.isInteger(state.powerUp.cell)
      ? state.powerUp.cell
      : null;
    var candidates = availableCells(state, segments, null, powerUpCell);
    if (!candidates.length) {
      return {
        energy: null,
        seed: state.seed,
      };
    }
    candidates = fairSpawnCells(state, candidates, segments);
    var seed = nextSeed(state.seed);
    return {
      energy: candidates[seed % candidates.length],
      seed: seed,
    };
  }

  function defaultSegments(width, height) {
    var y = Math.floor(height / 2);
    var headX = Math.min(width - 3, Math.max(4, Math.floor(width * 0.29)));
    return [
      cellIndex(headX, y, width),
      cellIndex(headX - 1, y, width),
      cellIndex(headX - 2, y, width),
    ];
  }

  function normalizeSegments(values, width, height) {
    var source = Array.isArray(values) && values.length ? values : defaultSegments(width, height);
    var seen = new Set();
    var segments = [];
    source.forEach(function (value) {
      var cell = normalizeCell(value, width, height);
      if (cell !== null && !seen.has(cell)) {
        seen.add(cell);
        segments.push(cell);
      }
    });
    return segments.length ? segments : defaultSegments(width, height);
  }

  function normalizeAsteroids(values, width, height, segments) {
    var source = Array.isArray(values) ? values : DEFAULT_ASTEROIDS;
    var occupied = new Set(segments);
    var asteroids = [];
    source.forEach(function (value) {
      var cell = normalizeCell(value, width, height);
      if (cell !== null && !occupied.has(cell)) {
        occupied.add(cell);
        asteroids.push(cell);
      }
    });
    return asteroids;
  }

  function normalizeEffects(value) {
    var source = value && typeof value === "object" ? value : {};
    return {
      shield: clampInteger(source.shield, 0, 0, 1),
      boostCores: clampInteger(source.boostCores, 0, 0, 3),
      stasisTicks: clampInteger(source.stasisTicks, 0, 0, 80),
    };
  }

  function createState(options) {
    var settings = options && typeof options === "object" ? options : {};
    var width = clampInteger(settings.width, 24, 10, 40);
    var height = clampInteger(settings.height, 14, 8, 28);
    var segments = normalizeSegments(settings.segments, width, height);
    var asteroids = normalizeAsteroids(settings.asteroids, width, height, segments);
    var seed = clampInteger(settings.seed, 0x50f17e, 0, 0xffffffff) >>> 0;
    var worldSeed = clampInteger(
      settings.worldSeed,
      nextSeed(seed ^ 0xa5a5a5a5),
      0,
      0xffffffff
    ) >>> 0;
    var eventSeed = clampInteger(
      settings.eventSeed,
      nextSeed(seed ^ 0x1f2e3d4c),
      0,
      0xffffffff
    ) >>> 0;
    var hazardSeed = clampInteger(
      settings.hazardSeed,
      nextSeed(seed ^ 0xc0ffee11),
      0,
      0xffffffff
    ) >>> 0;
    var direction = Object.prototype.hasOwnProperty.call(DIRECTIONS, settings.direction)
      ? settings.direction
      : "right";
    var ticks = clampInteger(settings.ticks, 0, 0, Number.MAX_SAFE_INTEGER);
    var splitUses = clampInteger(settings.splitUses, 0, 0, MAX_SPLITS);
    var score = clampInteger(settings.score, 0, 0, MAX_SCORE);
    var comboCount = clampInteger(
      settings.comboCount,
      0,
      0,
      Number.MAX_SAFE_INTEGER
    );
    var comboExpiresAt = clampInteger(
      settings.comboExpiresAt,
      0,
      0,
      Number.MAX_SAFE_INTEGER
    );
    if (!comboCount || comboExpiresAt <= ticks || score >= MAX_SCORE) {
      comboCount = 0;
      comboExpiresAt = 0;
    }
    var state = {
      width: width,
      height: height,
      initialSeed: seed,
      seed: seed,
      worldSeed: worldSeed,
      eventSeed: eventSeed,
      hazardSeed: hazardSeed,
      phase: score >= MAX_SCORE ? "won" : "idle",
      segments: segments,
      initialSegments: segments.slice(),
      direction: direction,
      queuedDirection: direction,
      turnQueued: false,
      energy: null,
      initialEnergy: null,
      asteroids: asteroids,
      initialAsteroids: asteroids.slice(),
      maxAsteroids: Math.max(
        asteroids.length,
        clampInteger(
          settings.maxAsteroids,
          Math.max(MAX_ASTEROIDS, asteroids.length),
          0,
          width * height
        )
      ),
      asteroidCadence: clampInteger(
        settings.asteroidCadence,
        DEFAULT_ASTEROID_CADENCE,
        6,
        60
      ),
      score: score,
      maxScore: MAX_SCORE,
      comboCount: comboCount,
      comboMultiplier: comboCount
        ? Math.min(MAX_COMBO_MULTIPLIER, comboCount)
        : 1,
      comboExpiresAt: comboExpiresAt,
      bestCombo: Math.max(
        comboCount,
        clampInteger(settings.bestCombo, 0, 0, Number.MAX_SAFE_INTEGER)
      ),
      lastAward: 0,
      ticks: ticks,
      lastEvent: score >= MAX_SCORE ? "won" : "ready",
      collision: null,
      splitUses: splitUses,
      splitsRemaining: MAX_SPLITS - splitUses,
      phaseTicks: clampInteger(settings.phaseTicks, 0, 0, SPLIT_PHASE_TICKS),
      splitEchoes: [],
      effects: normalizeEffects(settings.effects),
      powerUp: null,
      powerUpCount: clampInteger(settings.powerUpCount, 0, 0, Number.MAX_SAFE_INTEGER),
      nextPowerUpTick: clampInteger(
        settings.nextPowerUpTick,
        ticks + 24 + (eventSeed % 12),
        0,
        Number.MAX_SAFE_INTEGER
      ),
      fallingStar: null,
      fallingStars: [],
      nextFallingStarTick: clampInteger(
        settings.nextFallingStarTick,
        ticks + 58 + (worldSeed % 34),
        0,
        Number.MAX_SAFE_INTEGER
      ),
      meteorWarning: null,
      meteorImpact: null,
      hazardEvent: null,
      nextMeteorTick: clampInteger(
        settings.nextMeteorTick,
        ticks + 30 + (hazardSeed % 18),
        0,
        Number.MAX_SAFE_INTEGER
      ),
    };

    var requestedEnergy = normalizeCell(settings.energy, width, height);
    var occupied = new Set(segments.concat(asteroids));
    var headPoint = coordinates(segments[0], width);
    var friendlyEnergy = cellIndex(
      Math.min(width - 2, headPoint.x + 5),
      headPoint.y,
      width
    );
    if (requestedEnergy !== null && !occupied.has(requestedEnergy)) {
      state.energy = requestedEnergy;
    } else if (!occupied.has(friendlyEnergy)) {
      state.energy = friendlyEnergy;
    } else {
      var selection = chooseEnergy(state, segments);
      state.energy = selection.energy;
      state.seed = selection.seed;
    }
    state.initialEnergy = state.energy;

    if (settings.powerUp && typeof settings.powerUp === "object") {
      var powerCell = normalizeCell(settings.powerUp.cell, width, height);
      var powerType = POWER_UP_TYPES.includes(settings.powerUp.type)
        ? settings.powerUp.type
        : "shield";
      if (
        powerCell !== null &&
        !occupied.has(powerCell) &&
        powerCell !== state.energy
      ) {
        state.powerUp = {
          type: powerType,
          cell: powerCell,
          spawnedAt: clampInteger(
            settings.powerUp.spawnedAt,
            ticks,
            0,
            ticks
          ),
          expiresAt: clampInteger(
            settings.powerUp.expiresAt,
            ticks + POWER_UP_LIFETIME,
            ticks + 1,
            Number.MAX_SAFE_INTEGER
          ),
        };
      }
    }

    if (Array.isArray(settings.splitEchoes)) {
      state.splitEchoes = settings.splitEchoes.map(function (echo) {
        return {
          cell: normalizeCell(echo && echo.cell, width, height),
          expiresAt: clampInteger(
            echo && echo.expiresAt,
            ticks + SPLIT_PHASE_TICKS,
            ticks + 1,
            Number.MAX_SAFE_INTEGER
          ),
        };
      }).filter(function (echo) {
        return echo.cell !== null;
      });
    }

    if (settings.fallingStar && typeof settings.fallingStar === "object") {
      state.fallingStar = {
        column: clampInteger(settings.fallingStar.column, 0, 0, width - 1),
        drift: clampInteger(settings.fallingStar.drift, 1, -4, 4),
        startedAt: clampInteger(settings.fallingStar.startedAt, ticks, 0, ticks),
        expiresAt: clampInteger(
          settings.fallingStar.expiresAt,
          ticks + FALLING_STAR_LIFETIME,
          ticks + 1,
          Number.MAX_SAFE_INTEGER
        ),
      };
      state.fallingStars = [state.fallingStar];
    }

    if (settings.meteorWarning && typeof settings.meteorWarning === "object") {
      var warningCell = normalizeCell(settings.meteorWarning.cell, width, height);
      var warningOccupied = new Set(state.segments.concat(state.asteroids));
      if (Number.isInteger(state.energy)) warningOccupied.add(state.energy);
      if (state.powerUp) warningOccupied.add(state.powerUp.cell);
      if (warningCell !== null && !warningOccupied.has(warningCell)) {
        state.meteorWarning = {
          cell: warningCell,
          warnedAt: clampInteger(
            settings.meteorWarning.warnedAt,
            ticks,
            0,
            ticks
          ),
          impactsAt: clampInteger(
            settings.meteorWarning.impactsAt,
            ticks + METEOR_WARNING_TICKS,
            ticks + 1,
            Number.MAX_SAFE_INTEGER
          ),
        };
      }
    }

    if (settings.meteorImpact && typeof settings.meteorImpact === "object") {
      var impactCell = normalizeCell(settings.meteorImpact.cell, width, height);
      if (impactCell !== null) {
        state.meteorImpact = {
          cell: impactCell,
          expiresAt: clampInteger(
            settings.meteorImpact.expiresAt,
            ticks + METEOR_IMPACT_TICKS,
            ticks + 1,
            Number.MAX_SAFE_INTEGER
          ),
        };
      }
    }

    if (score >= MAX_SCORE) {
      state.energy = null;
    }
    if (state.energy === null || score >= MAX_SCORE) {
      state.phase = "won";
      state.lastEvent = "won";
    }
    if (
      state.phase !== "won" &&
      settings.phase &&
      ["idle", "running", "paused", "lost"].includes(settings.phase)
    ) {
      state.phase = settings.phase;
    }
    return state;
  }

  function start(state) {
    if (!state || !["idle", "paused"].includes(state.phase)) {
      return state;
    }
    return Object.assign({}, state, {
      phase: "running",
      lastEvent: state.phase === "paused" ? "resumed" : "started",
      collision: null,
    });
  }

  function pause(state) {
    if (!state || state.phase !== "running") {
      return state;
    }
    return Object.assign({}, state, {
      phase: "paused",
      lastEvent: "paused",
    });
  }

  function queueTurn(state, direction) {
    if (
      !state ||
      !Object.prototype.hasOwnProperty.call(DIRECTIONS, direction) ||
      state.turnQueued ||
      OPPOSITES[state.direction] === direction
    ) {
      return state;
    }
    return Object.assign({}, state, {
      queuedDirection: direction,
      turnQueued: true,
    });
  }

  function nextHead(state, direction) {
    var head = coordinates(state.segments[0], state.width);
    var vector = DIRECTIONS[direction];
    var x = (head.x + vector.x + state.width) % state.width;
    var y = (head.y + vector.y + state.height) % state.height;
    return cellIndex(x, y, state.width);
  }

  function splitTrail(state) {
    if (
      !state ||
      state.phase !== "running" ||
      state.splitsRemaining <= 0 ||
      state.segments.length < 3
    ) {
      return state;
    }
    var keepCount = Math.max(2, Math.ceil(state.segments.length / 2));
    var removed = state.segments.slice(keepCount);
    if (!removed.length) {
      removed = [state.segments[state.segments.length - 1]];
      keepCount = state.segments.length - 1;
    }
    var expiresAt = state.ticks + SPLIT_PHASE_TICKS;
    return Object.assign({}, state, {
      segments: state.segments.slice(0, keepCount),
      splitUses: state.splitUses + 1,
      splitsRemaining: state.splitsRemaining - 1,
      phaseTicks: SPLIT_PHASE_TICKS,
      splitEchoes: removed.map(function (cell) {
        return { cell: cell, expiresAt: expiresAt };
      }),
      comboCount: 0,
      comboMultiplier: 1,
      comboExpiresAt: 0,
      lastAward: 0,
      lastEvent: "split",
      collision: null,
    });
  }

  function applyPowerUp(effects, type) {
    var nextEffects = Object.assign({}, effects);
    if (type === "shield") {
      nextEffects.shield = 1;
    } else if (type === "boost") {
      nextEffects.boostCores = 3;
    } else if (type === "stasis") {
      nextEffects.stasisTicks = 40;
    }
    return nextEffects;
  }

  function moveAsteroids(state, tick) {
    if (
      !state ||
      tick % state.asteroidCadence !== 0 ||
      state.effects.stasisTicks > 0 ||
      !state.asteroids.length
    ) {
      return state;
    }
    var blocked = new Set(state.segments);
    if (Number.isInteger(state.energy)) blocked.add(state.energy);
    if (state.powerUp) blocked.add(state.powerUp.cell);
    if (state.meteorWarning) blocked.add(state.meteorWarning.cell);
    var occupied = new Set(state.asteroids);
    var seed = state.worldSeed;
    var moved = state.asteroids.map(function (cell, index) {
      occupied.delete(cell);
      seed = nextSeed(seed + index);
      var point = coordinates(cell, state.width);
      var vector = DIRECTIONS[DIRECTION_NAMES[seed % DIRECTION_NAMES.length]];
      var target = cellIndex(
        (point.x + vector.x + state.width) % state.width,
        (point.y + vector.y + state.height) % state.height,
        state.width
      );
      var nextCell = blocked.has(target) || occupied.has(target) ? cell : target;
      occupied.add(nextCell);
      return nextCell;
    });
    return Object.assign({}, state, {
      asteroids: moved,
      worldSeed: seed,
      lastEvent: state.lastEvent === "moved" ? "asteroids-moved" : state.lastEvent,
    });
  }

  function meteorSpawnCells(state) {
    var powerUpCell = state.powerUp ? state.powerUp.cell : null;
    return availableCells(
      state,
      state.segments,
      state.energy,
      powerUpCell
    ).filter(function (candidate) {
      if (
        toroidalDistance(
          candidate,
          state.segments[0],
          state.width,
          state.height
        ) <= 3
      ) {
        return false;
      }
      return state.asteroids.every(function (asteroid) {
        return toroidalDistance(
          candidate,
          asteroid,
          state.width,
          state.height
        ) > 1;
      });
    });
  }

  function advanceMeteor(state, tick) {
    if (!state) {
      return state;
    }
    var next = state.hazardEvent
      ? Object.assign({}, state, { hazardEvent: null })
      : state;
    if (next.meteorImpact && tick >= next.meteorImpact.expiresAt) {
      next = Object.assign({}, next, {
        meteorImpact: null,
      });
    }
    if (next.effects.stasisTicks > 0) {
      return Object.assign({}, next, {
        meteorWarning: next.meteorWarning
          ? Object.assign({}, next.meteorWarning, {
              warnedAt: next.meteorWarning.warnedAt + 1,
              impactsAt: next.meteorWarning.impactsAt + 1,
            })
          : null,
        nextMeteorTick: next.nextMeteorTick + 1,
        hazardEvent: null,
      });
    }

    if (next.meteorWarning && tick >= next.meteorWarning.impactsAt) {
      var target = next.meteorWarning.cell;
      var occupied = new Set(next.segments.concat(next.asteroids));
      if (Number.isInteger(next.energy)) occupied.add(next.energy);
      if (next.powerUp) occupied.add(next.powerUp.cell);
      var canLand =
        !occupied.has(target) &&
        next.asteroids.length < next.maxAsteroids;
      var landedAsteroids = canLand
        ? next.asteroids.concat(target)
        : next.asteroids;
      var playerDodged = !canLand && next.segments.includes(target);
      var impactSeed = nextSeed(next.hazardSeed ^ tick);
      return Object.assign({}, next, {
        asteroids: landedAsteroids,
        hazardSeed: impactSeed,
        meteorWarning: null,
        meteorImpact: canLand
          ? {
              cell: target,
              expiresAt: tick + METEOR_IMPACT_TICKS,
            }
          : null,
        nextMeteorTick: canLand
          ? tick + METEOR_MIN_GAP + (impactSeed % METEOR_GAP_JITTER)
          : tick + METEOR_RETRY_TICKS,
        hazardEvent: canLand
          ? "meteor-impact"
          : playerDodged
            ? "meteor-dodged"
            : "meteor-delayed",
      });
    }

    if (
      next.meteorWarning ||
      tick < next.nextMeteorTick ||
      next.asteroids.length >= next.maxAsteroids
    ) {
      return next;
    }

    var candidates = meteorSpawnCells(next);
    var warningSeed = nextSeed(next.hazardSeed);
    if (!candidates.length) {
      return Object.assign({}, next, {
        hazardSeed: warningSeed,
        nextMeteorTick: tick + METEOR_RETRY_TICKS,
        hazardEvent: "meteor-delayed",
      });
    }
    return Object.assign({}, next, {
      hazardSeed: warningSeed,
      meteorWarning: {
        cell: candidates[warningSeed % candidates.length],
        warnedAt: tick,
        impactsAt: tick + METEOR_WARNING_TICKS,
      },
      hazardEvent: "meteor-warning",
    });
  }

  function advancePowerUp(state, tick) {
    var next = state;
    if (next.powerUp && tick >= next.powerUp.expiresAt) {
      next = Object.assign({}, next, {
        powerUp: null,
        lastEvent: next.lastEvent === "moved" ? "powerup-expired" : next.lastEvent,
      });
    }
    if (next.powerUp || tick < next.nextPowerUpTick) {
      return next;
    }
    var seed = nextSeed(next.eventSeed);
    var candidates = availableCells(next, next.segments, next.energy);
    if (!candidates.length) {
      return Object.assign({}, next, {
        eventSeed: seed,
        nextPowerUpTick: tick + 48,
      });
    }
    candidates = fairSpawnCells(next, candidates, next.segments);
    var cell = candidates[seed % candidates.length];
    var type = POWER_UP_TYPES[next.powerUpCount % POWER_UP_TYPES.length];
    return Object.assign({}, next, {
      eventSeed: seed,
      powerUp: {
        type: type,
        cell: cell,
        spawnedAt: tick,
        expiresAt: tick + POWER_UP_LIFETIME,
      },
      powerUpCount: next.powerUpCount + 1,
      nextPowerUpTick: tick + 64 + (seed % 44),
      lastEvent: next.lastEvent === "moved" ? "powerup-spawned" : next.lastEvent,
    });
  }

  function advanceFallingStar(state, tick) {
    var current = state.fallingStar;
    if (current && tick < current.expiresAt) {
      return state;
    }
    if (current) {
      state = Object.assign({}, state, {
        fallingStar: null,
        fallingStars: [],
      });
    }
    if (tick < state.nextFallingStarTick) {
      return state;
    }
    var seed = nextSeed(state.eventSeed ^ 0x5a17f00d);
    var fallingStar = {
      column: seed % state.width,
      drift: seed % 2 ? 2 : -2,
      startedAt: tick,
      expiresAt: tick + FALLING_STAR_LIFETIME,
    };
    return Object.assign({}, state, {
      eventSeed: seed,
      fallingStar: fallingStar,
      fallingStars: [fallingStar],
      nextFallingStarTick: tick + 150 + (seed % 151),
    });
  }

  function advanceWorldEvents(state, tick) {
    var next = moveAsteroids(state, tick);
    next = advanceMeteor(next, tick);
    next = advancePowerUp(next, tick);
    return advanceFallingStar(next, tick);
  }

  function lostState(state, direction, tick, collision) {
    return Object.assign({}, state, {
      phase: "lost",
      direction: direction,
      queuedDirection: direction,
      turnQueued: false,
      ticks: tick,
      lastEvent: "lost",
      lastAward: 0,
      collision: collision,
      splitEchoes: state.splitEchoes.filter(function (echo) {
        return echo.expiresAt > tick;
      }),
    });
  }

  function step(state) {
    if (!state || state.phase !== "running") {
      return state;
    }

    var tick = state.ticks + 1;
    var direction = state.queuedDirection;
    var head = nextHead(state, direction);
    var collectedEnergy = head === state.energy;
    var collectedPowerUp = state.powerUp && head === state.powerUp.cell
      ? state.powerUp
      : null;
    var bodyToCheck = collectedEnergy
      ? state.segments
      : state.segments.slice(0, -1);
    var asteroidCollision = state.asteroids.includes(head);
    var trailCollision = bodyToCheck.includes(head);
    var asteroidList = state.asteroids.slice();
    var effects = Object.assign({}, state.effects);
    var event = "moved";
    var collision = null;

    if (asteroidCollision) {
      if (state.phaseTicks > 0) {
        asteroidList = asteroidList.filter(function (cell) {
          return cell !== head;
        });
        event = "phase-break";
      } else if (effects.shield > 0) {
        effects.shield = 0;
        asteroidList = asteroidList.filter(function (cell) {
          return cell !== head;
        });
        event = "shielded";
      } else {
        collision = "asteroid";
      }
    }
    if (!collision && trailCollision) {
      if (state.phaseTicks > 0) {
        bodyToCheck = bodyToCheck.filter(function (cell) {
          return cell !== head;
        });
        event = "phase-cross";
      } else {
        collision = "trail";
      }
    }
    if (collision) {
      return lostState(state, direction, tick, collision);
    }

    var sourceSegments = state.phaseTicks > 0 && trailCollision
      ? state.segments.filter(function (cell) {
          return cell !== head;
        })
      : state.segments;
    var segments = [head].concat(sourceSegments);
    if (!collectedEnergy) {
      segments.pop();
    }

    var powerUp = state.powerUp;
    if (collectedPowerUp) {
      effects = applyPowerUp(effects, collectedPowerUp.type);
      powerUp = null;
      event = "powerup-" + collectedPowerUp.type;
    }

    var score = state.score;
    var energy = state.energy;
    var seed = state.seed;
    var phase = "running";
    var comboCount = state.comboCount;
    var comboMultiplier = state.comboMultiplier;
    var comboExpiresAt = state.comboExpiresAt;
    var bestCombo = state.bestCombo;
    var lastAward = 0;
    if (collectedEnergy) {
      var continuedCombo = comboCount > 0 && tick < comboExpiresAt;
      comboCount = continuedCombo ? comboCount + 1 : 1;
      comboMultiplier = Math.min(MAX_COMBO_MULTIPLIER, comboCount);
      comboExpiresAt = tick + COMBO_WINDOW_TICKS;
      bestCombo = Math.max(bestCombo, comboCount);
      var boostMultiplier = effects.boostCores > 0 ? 2 : 1;
      var awardedPoints =
        BASE_CORE_POINTS * comboMultiplier * boostMultiplier;
      if (effects.boostCores > 0) {
        effects.boostCores -= 1;
      }
      lastAward = Math.min(awardedPoints, MAX_SCORE - score);
      score += lastAward;
      event = score >= MAX_SCORE ? "won" : "collected";
      var selectionState = Object.assign({}, state, {
        asteroids: asteroidList,
        powerUp: powerUp,
        seed: seed,
      });
      var selection = chooseEnergy(selectionState, segments);
      energy = selection.energy;
      seed = selection.seed;
      if (score >= MAX_SCORE || energy === null) {
        phase = "won";
        energy = null;
        event = "won";
      }
    } else if (comboCount > 0 && tick >= comboExpiresAt) {
      comboCount = 0;
      comboMultiplier = 1;
      comboExpiresAt = 0;
      if (event === "moved") {
        event = "combo-lost";
      }
    }

    var next = Object.assign({}, state, {
      phase: phase,
      segments: segments,
      asteroids: asteroidList,
      direction: direction,
      queuedDirection: direction,
      turnQueued: false,
      energy: energy,
      seed: seed,
      score: score,
      comboCount: comboCount,
      comboMultiplier: comboMultiplier,
      comboExpiresAt: comboExpiresAt,
      bestCombo: bestCombo,
      lastAward: lastAward,
      ticks: tick,
      lastEvent: event,
      collision: null,
      phaseTicks: Math.max(0, state.phaseTicks - 1),
      splitEchoes: state.splitEchoes.filter(function (echo) {
        return echo.expiresAt > tick;
      }),
      effects: {
        shield: effects.shield,
        boostCores: effects.boostCores,
        stasisTicks: effects.stasisTicks,
      },
      powerUp: powerUp,
      hazardEvent: null,
    });

    if (next.phase === "running") {
      next = advanceWorldEvents(next, tick);
      if (
        next.effects.stasisTicks > 0 &&
        !(collectedPowerUp && collectedPowerUp.type === "stasis")
      ) {
        next = Object.assign({}, next, {
          effects: Object.assign({}, next.effects, {
            stasisTicks: next.effects.stasisTicks - 1,
          }),
        });
      }
    }
    return next;
  }

  function reset(state, options) {
    var settings = options && typeof options === "object" ? options : {};
    return createState({
      width: state && state.width,
      height: state && state.height,
      seed: settings.seed === undefined ? state && state.initialSeed : settings.seed,
      segments: state && state.initialSegments,
      asteroids: state && state.initialAsteroids,
      maxAsteroids: state && state.maxAsteroids,
      asteroidCadence: state && state.asteroidCadence,
      energy: state && state.initialEnergy,
      direction: "right",
    });
  }

  function cellLabel(index, width) {
    var point = coordinates(index, width);
    return "column " + (point.x + 1) + ", row " + (point.y + 1);
  }

  function describe(state) {
    if (!state) {
      return "The orbital grid is not available.";
    }
    var head = cellLabel(state.segments[0], state.width);
    var energy = state.energy === null
      ? "no energy core remains"
      : "the energy core is at " + cellLabel(state.energy, state.width);
    var headPoint = coordinates(state.segments[0], state.width);
    var nearby = state.asteroids.filter(function (cell) {
      var point = coordinates(cell, state.width);
      var dx = Math.min(
        Math.abs(point.x - headPoint.x),
        state.width - Math.abs(point.x - headPoint.x)
      );
      var dy = Math.min(
        Math.abs(point.y - headPoint.y),
        state.height - Math.abs(point.y - headPoint.y)
      );
      return dx + dy <= 5;
    });
    var asteroidCopy = nearby.length
      ? "Nearby moving asteroids: " + nearby.map(function (cell) {
          return cellLabel(cell, state.width);
        }).join("; ") + "."
      : "No asteroids are within five grid moves.";
    var powerCopy = state.powerUp
      ? " The " + powerUpLabel(state.powerUp.type) + " power-up, which " +
        powerUpEffect(state.powerUp.type) + ", is at " +
        cellLabel(state.powerUp.cell, state.width) + " for " +
        Math.max(0, state.powerUp.expiresAt - state.ticks) + " more moves."
      : "";
    var meteorCopy = state.meteorWarning
      ? " Red meteor warning at " +
        cellLabel(state.meteorWarning.cell, state.width) + "; impact in " +
        Math.max(0, state.meteorWarning.impactsAt - state.ticks) + " moves."
      : "";
    var effectCopy = state.phaseTicks > 0
      ? " Split phase is active for " + state.phaseTicks + " more moves."
      : "";
    var comboCopy = state.comboCount > 0
      ? " The core chain is " + state.comboMultiplier + " times with " +
        Math.max(0, state.comboExpiresAt - state.ticks) + " moves left."
      : " Collect the next core to start a score chain.";
    return "Python Snake is at " + head + ", facing " + state.direction + "; " +
      energy + ". " + asteroidCopy + powerCopy + meteorCopy + effectCopy + " " +
      state.splitsRemaining + " of " + MAX_SPLITS + " splits remain." + comboCopy;
  }

  function svgElement(name, className) {
    var element = global.document.createElementNS(SVG_NAMESPACE, name);
    if (className) {
      element.setAttribute("class", className);
    }
    return element;
  }

  function setAttributes(element, attributes) {
    Object.keys(attributes).forEach(function (name) {
      element.setAttribute(name, String(attributes[name]));
    });
    return element;
  }

  function setVisible(element, visible) {
    element.hidden = !visible;
    element.style.display = visible ? "" : "none";
  }

  function ensureLayer(root, selector, dataName, beforeLayer) {
    var layer = root.querySelector(selector);
    if (layer) {
      return layer;
    }
    var board = root.querySelector("[data-snake-board]");
    if (!board) {
      return null;
    }
    layer = setAttributes(svgElement("g"), {});
    layer.setAttribute(dataName, "");
    if (beforeLayer) {
      board.insertBefore(layer, beforeLayer);
    } else {
      board.append(layer);
    }
    return layer;
  }

  function createAsteroidNode(index) {
    var group = setAttributes(svgElement("g", "landing-snake__asteroid"), {
      "data-snake-asteroid-id": index,
    });
    group.append(
      setAttributes(svgElement("polygon"), {
        points: index % 2
          ? "0.17,0.13 0.77,0.05 0.96,0.48 0.72,0.91 0.2,0.83 0.04,0.4"
          : "0.31,0.04 0.84,0.2 0.93,0.7 0.54,0.96 0.09,0.71 0.07,0.25",
      }),
      setAttributes(svgElement("circle", "landing-snake__crater"), {
        cx: index % 2 ? 0.35 : 0.62,
        cy: index % 2 ? 0.56 : 0.39,
        r: 0.13,
      })
    );
    return group;
  }

  function createEnergyNode() {
    var group = svgElement("g", "landing-snake__energy");
    group.append(
      setAttributes(svgElement("circle", "landing-snake__energy-fruit"), {
        cx: 0.5,
        cy: 0.57,
        r: 0.29,
      }),
      setAttributes(svgElement("path", "landing-snake__energy-leaf"), {
        d: "M 0.48 0.3 C 0.56 0.13 0.73 0.13 0.78 0.19 C 0.7 0.31 0.59 0.34 0.48 0.3",
      })
    );
    return group;
  }

  function createPowerUpNode() {
    var group = svgElement("g", "landing-snake__powerup");
    group.append(
      setAttributes(svgElement("circle", "landing-snake__powerup-halo"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.47,
      }),
      setAttributes(svgElement("circle", "landing-snake__powerup-timer"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.49,
        "stroke-dasharray": POWER_UP_TIMER_CIRCUMFERENCE,
        "stroke-dashoffset": 0,
      }),
      setAttributes(svgElement("circle", "landing-snake__powerup-core"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.32,
      }),
      setAttributes(svgElement("text", "landing-snake__powerup-label"), {
        x: 0.5,
        y: 0.62,
        "text-anchor": "middle",
      })
    );
    return group;
  }

  function createFallingStarNode() {
    var group = svgElement("g", "landing-snake__falling-star");
    group.append(
      setAttributes(svgElement("path", "landing-snake__falling-star-streak"), {
        d: "M -2 -1 L 0 1",
      }),
      setAttributes(svgElement("circle", "landing-snake__falling-star-core"), {
        cx: 0,
        cy: 1,
        r: 0.11,
      })
    );
    return group;
  }

  function createMeteorWarningNode() {
    var group = svgElement("g", "landing-snake__meteor-warning");
    group.append(
      setAttributes(svgElement("circle", "landing-snake__meteor-warning-ring"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.43,
      }),
      setAttributes(svgElement("path", "landing-snake__meteor-warning-cross"), {
        d: "M 0.5 0.08 V 0.24 M 0.5 0.76 V 0.92 M 0.08 0.5 H 0.24 M 0.76 0.5 H 0.92",
      }),
      setAttributes(svgElement("text", "landing-snake__meteor-warning-count"), {
        x: 0.5,
        y: 0.63,
        "text-anchor": "middle",
      })
    );
    return group;
  }

  function createMeteorNode() {
    var group = svgElement("g", "landing-snake__meteor");
    group.append(
      setAttributes(svgElement("path", "landing-snake__meteor-trail"), {
        d: "M 0.5 -1.15 L 0.5 -0.18",
      }),
      setAttributes(svgElement("polygon", "landing-snake__meteor-rock"), {
        points: "0.2,0.18 0.62,0.05 0.9,0.33 0.82,0.77 0.42,0.94 0.1,0.64",
      }),
      setAttributes(svgElement("circle", "landing-snake__meteor-crater"), {
        cx: 0.55,
        cy: 0.43,
        r: 0.12,
      })
    );
    return group;
  }

  function createMeteorImpactNode() {
    var group = svgElement("g", "landing-snake__meteor-impact");
    group.append(
      setAttributes(svgElement("circle", "landing-snake__meteor-impact-ring"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.34,
      }),
      setAttributes(svgElement("path", "landing-snake__meteor-impact-burst"), {
        d: "M 0.5 0.02 V 0.2 M 0.5 0.8 V 0.98 M 0.02 0.5 H 0.2 M 0.8 0.5 H 0.98 M 0.16 0.16 L 0.29 0.29 M 0.71 0.71 L 0.84 0.84 M 0.84 0.16 L 0.71 0.29 M 0.29 0.71 L 0.16 0.84",
      })
    );
    return group;
  }

  function createSegmentNode(index) {
    var isHead = index === 0;
    var group = svgElement(
      "g",
      isHead ? "landing-snake__head" : "landing-snake__segment"
    );
    group.append(setAttributes(svgElement("rect"), {
      x: 0.08,
      y: 0.08,
      width: 0.84,
      height: 0.84,
      rx: isHead ? 0.34 : 0.28,
    }));
    if (isHead) {
      group.append(
        setAttributes(svgElement("circle", "landing-snake__head-eye"), {
          cx: 0.72,
          cy: 0.34,
          r: 0.075,
        }),
        setAttributes(svgElement("circle", "landing-snake__head-eye"), {
          cx: 0.72,
          cy: 0.66,
          r: 0.075,
        })
      );
    }
    return group;
  }

  function createEchoNode() {
    var group = svgElement("g", "landing-snake__echo");
    group.append(setAttributes(svgElement("rect"), {
      x: 0.12,
      y: 0.12,
      width: 0.76,
      height: 0.76,
      rx: 0.2,
    }));
    return group;
  }

  function createRenderer(root, state) {
    var segmentLayer = root.querySelector("[data-snake-segment-layer]");
    var board = root.querySelector("[data-snake-board]");
    if (!segmentLayer || !board) {
      return null;
    }
    var asteroidLayer = ensureLayer(
      root,
      "[data-snake-asteroid-layer]",
      "data-snake-asteroid-layer",
      segmentLayer
    );
    var energyLayer = ensureLayer(
      root,
      "[data-snake-energy-layer]",
      "data-snake-energy-layer",
      segmentLayer
    );
    var powerUpLayer = ensureLayer(
      root,
      "[data-snake-powerup-layer]",
      "data-snake-powerup-layer",
      segmentLayer
    );
    var echoLayer = ensureLayer(
      root,
      "[data-snake-echo-layer]",
      "data-snake-echo-layer",
      segmentLayer
    );
    var fallingStarLayer = ensureLayer(
      root,
      "[data-snake-falling-star-layer]",
      "data-snake-falling-star-layer",
      asteroidLayer
    );
    var meteorLayer = ensureLayer(
      root,
      "[data-snake-meteor-layer]",
      "data-snake-meteor-layer",
      asteroidLayer
    );
    if (
      !asteroidLayer ||
      !energyLayer ||
      !powerUpLayer ||
      !echoLayer ||
      !fallingStarLayer ||
      !meteorLayer
    ) {
      return null;
    }

    var asteroidNodes = [];
    var asteroidPoolSize = Math.max(
      state.maxAsteroids || 0,
      state.asteroids.length
    );
    for (var asteroidIndex = 0; asteroidIndex < asteroidPoolSize; asteroidIndex += 1) {
      var asteroidNode = createAsteroidNode(asteroidIndex);
      asteroidNodes.push(asteroidNode);
      asteroidLayer.append(asteroidNode);
    }
    var energyNode = createEnergyNode();
    var powerUpNode = createPowerUpNode();
    var fallingStarNode = createFallingStarNode();
    var meteorWarningNode = createMeteorWarningNode();
    var meteorNode = createMeteorNode();
    var meteorImpactNode = createMeteorImpactNode();
    energyLayer.append(energyNode);
    powerUpLayer.append(powerUpNode);
    fallingStarLayer.append(fallingStarNode);
    meteorLayer.append(meteorWarningNode, meteorNode, meteorImpactNode);

    var segmentNodes = [];
    var segmentPoolSize = Math.max(SEGMENT_POOL_SIZE, state.segments.length);
    for (var segmentIndex = 0; segmentIndex < segmentPoolSize; segmentIndex += 1) {
      var segmentNode = createSegmentNode(segmentIndex);
      segmentNodes.push(segmentNode);
      segmentLayer.append(segmentNode);
    }
    var echoNodes = [];
    var echoPoolSize = Math.max(64, state.segments.length);
    for (var echoIndex = 0; echoIndex < echoPoolSize; echoIndex += 1) {
      var echoNode = createEchoNode();
      echoNodes.push(echoNode);
      echoLayer.append(echoNode);
    }

    return {
      asteroidLayer: asteroidLayer,
      asteroidNodes: asteroidNodes,
      energyNode: energyNode,
      powerUpNode: powerUpNode,
      fallingStarNode: fallingStarNode,
      meteorWarningNode: meteorWarningNode,
      meteorNode: meteorNode,
      meteorImpactNode: meteorImpactNode,
      segmentNodes: segmentNodes,
      echoNodes: echoNodes,
    };
  }

  function render(root, state) {
    if (!root || !state || !global.document) {
      return;
    }
    var renderer = root.__landingSnakeRenderer;
    if (!renderer) {
      renderer = createRenderer(root, state);
      root.__landingSnakeRenderer = renderer;
    }
    if (!renderer) {
      return;
    }

    while (renderer.asteroidNodes.length < state.asteroids.length) {
      var asteroidNode = createAsteroidNode(renderer.asteroidNodes.length);
      renderer.asteroidNodes.push(asteroidNode);
      renderer.asteroidLayer.append(asteroidNode);
    }
    renderer.asteroidNodes.forEach(function (node, index) {
      var cell = state.asteroids[index];
      var visible = Number.isInteger(cell);
      setVisible(node, visible);
      if (visible) {
        var point = coordinates(cell, state.width);
        node.setAttribute("transform", "translate(" + point.x + " " + point.y + ")");
        node.setAttribute("data-snake-asteroid", cell);
      } else {
        node.removeAttribute("data-snake-asteroid");
      }
    });

    setVisible(renderer.energyNode, state.energy !== null);
    if (state.energy !== null) {
      var energyPoint = coordinates(state.energy, state.width);
      renderer.energyNode.setAttribute(
        "transform",
        "translate(" + energyPoint.x + " " + energyPoint.y + ")"
      );
      renderer.energyNode.setAttribute("data-snake-energy", state.energy);
    } else {
      renderer.energyNode.removeAttribute("data-snake-energy");
    }

    setVisible(renderer.powerUpNode, Boolean(state.powerUp));
    if (state.powerUp) {
      var powerPoint = coordinates(state.powerUp.cell, state.width);
      renderer.powerUpNode.setAttribute(
        "transform",
        "translate(" + powerPoint.x + " " + powerPoint.y + ")"
      );
      renderer.powerUpNode.setAttribute("data-snake-powerup", state.powerUp.type);
      renderer.powerUpNode.setAttribute(
        "class",
        "landing-snake__powerup landing-snake__powerup--" + state.powerUp.type
      );
      var powerUpRemaining = Math.max(
        0,
        state.powerUp.expiresAt - state.ticks
      );
      var powerUpDuration = Math.max(
        1,
        state.powerUp.expiresAt - state.powerUp.spawnedAt
      );
      var timer = renderer.powerUpNode.querySelector(
        ".landing-snake__powerup-timer"
      );
      timer.setAttribute(
        "stroke-dashoffset",
        (
          POWER_UP_TIMER_CIRCUMFERENCE *
          (1 - powerUpRemaining / powerUpDuration)
        ).toFixed(2)
      );
      renderer.powerUpNode.querySelector("text").textContent =
        powerUpGlyph(state.powerUp.type);
    } else {
      renderer.powerUpNode.removeAttribute("data-snake-powerup");
    }

    setVisible(renderer.fallingStarNode, Boolean(state.fallingStar));
    if (state.fallingStar) {
      var starLifetime = Math.max(
        1,
        state.fallingStar.expiresAt - state.fallingStar.startedAt
      );
      var starProgress = Math.min(
        1,
        Math.max(0, (state.ticks - state.fallingStar.startedAt) / starLifetime)
      );
      var starX = state.fallingStar.column + state.fallingStar.drift * starProgress;
      var starY = -1 + 16 * starProgress;
      renderer.fallingStarNode.setAttribute(
        "transform",
        "translate(" + starX.toFixed(2) + " " + starY.toFixed(2) + ")"
      );
      renderer.fallingStarNode.setAttribute("data-snake-falling-star", "");
    } else {
      renderer.fallingStarNode.removeAttribute("data-snake-falling-star");
    }

    setVisible(renderer.meteorWarningNode, Boolean(state.meteorWarning));
    setVisible(renderer.meteorNode, false);
    if (state.meteorWarning) {
      var warningPoint = coordinates(state.meteorWarning.cell, state.width);
      var meteorMoves = Math.max(
        0,
        state.meteorWarning.impactsAt - state.ticks
      );
      renderer.meteorWarningNode.setAttribute(
        "transform",
        "translate(" + warningPoint.x + " " + warningPoint.y + ")"
      );
      renderer.meteorWarningNode.setAttribute(
        "data-snake-meteor-warning",
        state.meteorWarning.cell
      );
      renderer.meteorWarningNode.querySelector("text").textContent =
        String(meteorMoves);
      if (meteorMoves <= METEOR_DESCENT_TICKS) {
        var meteorProgress = Math.min(
          1,
          Math.max(0, (METEOR_DESCENT_TICKS - meteorMoves) / METEOR_DESCENT_TICKS)
        );
        var meteorY =
          -1.2 + (warningPoint.y + 1.2) * meteorProgress;
        setVisible(renderer.meteorNode, true);
        renderer.meteorNode.setAttribute(
          "transform",
          "translate(" + warningPoint.x + " " + meteorY.toFixed(2) + ")"
        );
        renderer.meteorNode.setAttribute("data-snake-meteor", "falling");
      }
    } else {
      renderer.meteorWarningNode.removeAttribute("data-snake-meteor-warning");
      renderer.meteorNode.removeAttribute("data-snake-meteor");
    }

    setVisible(renderer.meteorImpactNode, Boolean(state.meteorImpact));
    if (state.meteorImpact) {
      var impactPoint = coordinates(state.meteorImpact.cell, state.width);
      renderer.meteorImpactNode.setAttribute(
        "transform",
        "translate(" + impactPoint.x + " " + impactPoint.y + ")"
      );
      renderer.meteorImpactNode.setAttribute(
        "data-snake-meteor-impact",
        state.meteorImpact.cell
      );
    } else {
      renderer.meteorImpactNode.removeAttribute("data-snake-meteor-impact");
    }

    renderer.echoNodes.forEach(function (node, index) {
      var echo = state.splitEchoes[index];
      setVisible(node, Boolean(echo));
      if (echo) {
        var echoPoint = coordinates(echo.cell, state.width);
        node.setAttribute(
          "transform",
          "translate(" + echoPoint.x + " " + echoPoint.y + ")"
        );
        node.setAttribute("data-snake-echo", echo.cell);
      } else {
        node.removeAttribute("data-snake-echo");
      }
    });

    renderer.segmentNodes.forEach(function (node, index) {
      var cell = state.segments[index];
      var visible = Number.isInteger(cell);
      setVisible(node, visible);
      node.removeAttribute("data-snake-segment");
      node.removeAttribute("data-snake-head");
      if (visible) {
        var point = coordinates(cell, state.width);
        node.setAttribute("transform", "translate(" + point.x + " " + point.y + ")");
        node.setAttribute("data-snake-segment", cell);
        if (index === 0) {
          node.setAttribute("data-snake-head", cell);
          var eyes = node.querySelectorAll(".landing-snake__head-eye");
          var eyePositions = state.queuedDirection === "up"
            ? [[0.34, 0.28], [0.66, 0.28]]
            : state.queuedDirection === "down"
              ? [[0.34, 0.72], [0.66, 0.72]]
              : state.queuedDirection === "left"
                ? [[0.28, 0.34], [0.28, 0.66]]
                : [[0.72, 0.34], [0.72, 0.66]];
          eyes.forEach(function (eye, eyeIndex) {
            eye.setAttribute("cx", eyePositions[eyeIndex][0]);
            eye.setAttribute("cy", eyePositions[eyeIndex][1]);
          });
        }
      }
    });

    root.dataset.snakePhase = state.phase;
    root.dataset.snakeScore = String(state.score);
    root.dataset.snakeCombo = String(state.comboMultiplier);
    root.dataset.snakeComboMoves = String(
      Math.max(0, state.comboExpiresAt - state.ticks)
    );
    root.dataset.snakeLastAward = String(state.lastAward);
    root.dataset.snakeTicks = String(state.ticks);
    root.dataset.snakeHead = String(state.segments[0]);
    root.dataset.snakeDirection = state.queuedDirection;
    root.dataset.snakeSplits = String(state.splitsRemaining);
    root.dataset.snakeRenderer = "stable";
    root.dataset.snakePowerup = state.powerUp ? state.powerUp.type : "none";
    root.dataset.snakePowerupUrgency = state.powerUp &&
      state.powerUp.expiresAt - state.ticks <= 16
      ? "expiring"
      : "steady";
    root.dataset.snakeMeteor = state.meteorWarning
      ? "warning"
      : state.meteorImpact
        ? "impact"
        : "none";
    root.dataset.snakeMeteorMoves = state.meteorWarning
      ? String(Math.max(0, state.meteorWarning.impactsAt - state.ticks))
      : "0";
    root.dataset.snakeEffect = state.phaseTicks > 0
      ? "split-phase"
      : state.effects.shield
        ? "shield"
        : state.effects.boostCores
          ? "boost"
          : state.effects.stasisTicks
            ? "stasis"
            : "none";
  }

  function safeReadBestScore() {
    try {
      return clampInteger(global.localStorage.getItem(BEST_SCORE_KEY), 0, 0, MAX_SCORE);
    } catch (_error) {
      return 0;
    }
  }

  function safeWriteBestScore(score) {
    try {
      global.localStorage.setItem(
        BEST_SCORE_KEY,
        String(clampInteger(score, 0, 0, MAX_SCORE))
      );
    } catch (_error) {
      // The game remains playable when local storage is unavailable.
    }
  }

  function cloneState(state) {
    return Object.assign({}, state, {
      segments: state.segments.slice(),
      asteroids: state.asteroids.slice(),
      splitEchoes: state.splitEchoes.map(function (echo) {
        return Object.assign({}, echo);
      }),
      effects: Object.assign({}, state.effects),
      powerUp: state.powerUp ? Object.assign({}, state.powerUp) : null,
      fallingStar: state.fallingStar ? Object.assign({}, state.fallingStar) : null,
      meteorWarning: state.meteorWarning
        ? Object.assign({}, state.meteorWarning)
        : null,
      meteorImpact: state.meteorImpact
        ? Object.assign({}, state.meteorImpact)
        : null,
      fallingStars: state.fallingStars.map(function (star) {
        return Object.assign({}, star);
      }),
    });
  }

  function mount(root, options) {
    if (!root || !global.document) {
      return null;
    }
    var settings = options && typeof options === "object" ? options : {};
    var audio = settings.audio || {};
    var state = createState(settings.state);
    var bestScore = safeReadBestScore();
    var destroyed = false;
    var frameId = 0;
    var lastFrameAt = 0;
    var accumulator = 0;
    var stepDuration = clampInteger(settings.stepDuration, 132, 80, 260);
    var playfield = root.querySelector("[data-snake-playfield]");
    var toggleButton = root.querySelector("[data-snake-action='toggle']");
    var restartButton = root.querySelector("[data-snake-action='restart']");
    var describeButton = root.querySelector("[data-snake-action='describe']");
    var splitButton = root.querySelector("[data-snake-action='split']");
    var scoreOutput = root.querySelector("[data-snake-score]");
    var bestOutput = root.querySelector("[data-snake-best]");
    var comboOutput = root.querySelector("[data-snake-combo]");
    var splitOutput = root.querySelector("[data-snake-splits]");
    var phaseOutput = root.querySelector("[data-snake-phase-label]");
    var progressOutput = root.querySelector("[data-snake-progress]");
    var powerUpOutput = root.querySelector("[data-snake-powerup-status]");
    var effectOutput = root.querySelector("[data-snake-effect-status]");
    var hazardOutput = root.querySelector("[data-snake-hazard-status]");
    var overlay = root.querySelector("[data-snake-overlay]");
    var eventToast = root.querySelector("[data-snake-event-toast]");
    var swipeCue = root.querySelector("[data-snake-swipe-cue]");
    var announcement = root.querySelector("[data-snake-announcement]");
    var hazardAnnouncement = root.querySelector(
      "[data-snake-hazard-announcement]"
    );
    var reducedMotionQuery = typeof global.matchMedia === "function"
      ? global.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    var abortController = typeof global.AbortController === "function"
      ? new global.AbortController()
      : null;
    var listenerOptions = abortController ? { signal: abortController.signal } : undefined;
    var observer = null;
    var pointerStart = null;
    var eventToastTimer = 0;
    var swipeCueTimer = 0;

    function callAudio(name) {
      if (audio && typeof audio[name] === "function") {
        audio[name]();
      }
    }

    function announce(message) {
      if (!announcement) {
        return;
      }
      announcement.textContent = "";
      global.requestAnimationFrame(function () {
        if (!destroyed) {
          announcement.textContent = message;
        }
      });
    }

    function announceHazard(message) {
      if (!hazardAnnouncement) {
        return;
      }
      hazardAnnouncement.textContent = "";
      global.requestAnimationFrame(function () {
        if (!destroyed) {
          hazardAnnouncement.textContent = message;
        }
      });
    }

    function showEventToast(message, kind) {
      if (!eventToast) {
        return;
      }
      if (eventToastTimer) {
        global.clearTimeout(eventToastTimer);
      }
      eventToast.textContent = message;
      eventToast.dataset.snakeEventKind = kind || "info";
      eventToast.hidden = false;
      eventToastTimer = global.setTimeout(function () {
        if (!destroyed) {
          eventToast.hidden = true;
        }
      }, 1450);
    }

    function showSwipeCue(direction) {
      if (!swipeCue) {
        return;
      }
      if (swipeCueTimer) {
        global.clearTimeout(swipeCueTimer);
      }
      var arrows = {
        up: "↑",
        right: "→",
        down: "↓",
        left: "←",
      };
      swipeCue.textContent = arrows[direction] + " " + direction;
      swipeCue.dataset.snakeSwipeDirection = direction;
      swipeCue.hidden = false;
      root.dataset.snakeSwipe = direction;
      swipeCueTimer = global.setTimeout(function () {
        if (!destroyed) {
          swipeCue.hidden = true;
          root.dataset.snakeSwipe = "none";
        }
      }, 440);
    }

    function focusPlayfield() {
      if (!playfield) {
        return;
      }
      try {
        playfield.focus({ preventScroll: true });
      } catch (_error) {
        playfield.focus();
      }
    }

    function phaseCopy() {
      if (state.phase === "running") {
        if (state.meteorWarning) {
          return "Meteor inbound · " +
            Math.max(0, state.meteorWarning.impactsAt - state.ticks);
        }
        if (state.phaseTicks > 0) return "Split phase";
        if (state.effects.stasisTicks > 0) return "Stasis field";
        if (state.effects.shield > 0) return "Shield ready";
        if (state.effects.boostCores > 0) return "Core boost";
        return "In flight";
      }
      if (state.phase === "paused") return "Paused";
      if (state.phase === "lost") {
        return state.collision === "trail" ? "Trail collision" : "Asteroid collision";
      }
      if (state.phase === "won") return "1000 · sector cleared";
      return "Ready";
    }

    function overlayCopy() {
      if (state.phase === "paused") return "Mission paused";
      if (state.phase === "lost") return "Signal lost · press R or Play again";
      if (state.phase === "won") return "1000 points · sector cleared";
      return "Press Start, Enter, or a direction";
    }

    function buttonCopy() {
      if (state.phase === "running") return "Pause";
      if (state.phase === "paused") return "Resume mission";
      if (state.phase === "lost" || state.phase === "won") return "Play again";
      return "Start mission";
    }

    function comboCopy() {
      if (state.comboCount <= 0) return "Ready";
      return state.comboMultiplier + "× · " +
        Math.max(0, state.comboExpiresAt - state.ticks) + " moves";
    }

    function powerUpCopy() {
      if (state.powerUp) {
        return powerUpLabel(state.powerUp.type) + " · " +
          powerUpEffect(state.powerUp.type) + " · " +
          Math.max(0, state.powerUp.expiresAt - state.ticks) + " moves";
      }
      return "Power-up in " +
        Math.max(0, state.nextPowerUpTick - state.ticks) +
        " · S Shield · 2× Core · F Freeze";
    }

    function effectCopy() {
      if (state.phaseTicks > 0) {
        return "Phase protection · " + state.phaseTicks + " moves";
      }
      if (state.effects.shield > 0) return "Shield armed · absorbs 1 asteroid";
      if (state.effects.boostCores > 0) {
        return "Core boost · " + state.effects.boostCores + " double cores";
      }
      if (state.effects.stasisTicks > 0) {
        return "Stasis · " + state.effects.stasisTicks + " moves";
      }
      return "No active effect";
    }

    function hazardCopy() {
      if (state.meteorWarning) {
        return "RED ZONE · impact in " +
          Math.max(0, state.meteorWarning.impactsAt - state.ticks) +
          " moves";
      }
      if (state.meteorImpact) {
        return "Meteor landed · " + state.asteroids.length + " rocks";
      }
      return "Sky clear · " + state.asteroids.length + " / " +
        state.maxAsteroids + " rocks";
    }

    function syncView(message) {
      if (state.score > bestScore) {
        bestScore = state.score;
        safeWriteBestScore(bestScore);
      }
      render(root, state);
      if (scoreOutput) {
        scoreOutput.textContent =
          String(state.score).padStart(4, "0") + " / " + MAX_SCORE;
      }
      if (bestOutput) bestOutput.textContent = String(bestScore).padStart(4, "0");
      if (comboOutput) comboOutput.textContent = comboCopy();
      if (splitOutput) {
        splitOutput.textContent = state.splitsRemaining + " / " + MAX_SPLITS;
      }
      if (phaseOutput) phaseOutput.textContent = phaseCopy();
      if (progressOutput) {
        progressOutput.value = state.score;
        progressOutput.setAttribute("aria-valuetext", state.score + " of " + MAX_SCORE);
      }
      if (powerUpOutput) {
        powerUpOutput.textContent = powerUpCopy();
        powerUpOutput.dataset.powerupType = state.powerUp
          ? state.powerUp.type
          : "waiting";
      }
      if (effectOutput) {
        effectOutput.textContent = effectCopy();
        effectOutput.dataset.effectType = root.dataset.snakeEffect || "none";
      }
      if (hazardOutput) {
        hazardOutput.textContent = hazardCopy();
        hazardOutput.dataset.hazardType = state.meteorWarning
          ? "warning"
          : state.meteorImpact
            ? "impact"
            : "clear";
      }
      if (toggleButton) {
        toggleButton.textContent = buttonCopy();
        toggleButton.setAttribute("aria-pressed", String(state.phase === "running"));
      }
      if (splitButton) {
        splitButton.textContent = "Split trail · " + state.splitsRemaining;
        splitButton.disabled =
          state.phase !== "running" ||
          state.splitsRemaining <= 0 ||
          state.segments.length < 3;
      }
      if (overlay) {
        overlay.hidden = state.phase === "running";
        overlay.textContent = overlayCopy();
      }
      if (playfield) {
        playfield.setAttribute(
          "aria-label",
          "Python Snake orbital grid. " + phaseCopy() + ". Score " +
          state.score + " of " + MAX_SCORE + ". " +
          state.splitsRemaining + " splits remain. Chain " +
          comboCopy() + ". " + hazardCopy() + "."
        );
      }
      if (message) {
        announce(message);
      }
    }

    function stopLoop() {
      if (frameId) {
        global.cancelAnimationFrame(frameId);
      }
      frameId = 0;
      lastFrameAt = 0;
      accumulator = 0;
    }

    function processStep() {
      var previousScore = state.score;
      var previousPowerUp = state.powerUp;
      var previousEffect = state.phaseTicks;
      state = step(state);
      if (
        ["powerup-shield", "powerup-boost", "powerup-stasis"].includes(state.lastEvent) &&
        previousPowerUp
      ) {
        callAudio("playAchievement");
        showEventToast(
          powerUpLabel(previousPowerUp.type).toUpperCase() + " READY · " +
          powerUpEffect(previousPowerUp.type),
          previousPowerUp.type
        );
        syncView(
          powerUpLabel(previousPowerUp.type) +
          " collected. " + phaseCopy() + "."
        );
      } else if (state.lastEvent === "collected" && state.score > previousScore) {
        callAudio("playRunComplete");
        showEventToast(
          "+" + state.lastAward + " · " + state.comboMultiplier + "× CORE CHAIN",
          "core"
        );
        syncView(
          "Energy collected. " + state.comboMultiplier + " times chain. Plus " +
          state.lastAward + " points. Score " + state.score + " of " +
          MAX_SCORE + "."
        );
      } else if (
        state.lastEvent === "powerup-spawned" &&
        !previousPowerUp &&
        state.powerUp
      ) {
        callAudio("playCheck");
        showEventToast(
          powerUpLabel(state.powerUp.type).toUpperCase() + " · " +
          powerUpEffect(state.powerUp.type),
          state.powerUp.type
        );
        syncView(
          powerUpLabel(state.powerUp.type) + " available for " +
          (state.powerUp.expiresAt - state.ticks) + " moves."
        );
      } else if (state.lastEvent === "lost") {
        callAudio("playFailure");
        syncView(
          (state.collision === "trail" ? "Trail collision." : "Asteroid collision.") +
          " Final score " + state.score + "."
        );
      } else if (state.lastEvent === "won") {
        callAudio("playTaskComplete");
        syncView("Maximum score reached. Sector cleared with 1000 points.");
      } else if (state.lastEvent === "shielded") {
        callAudio("playCheck");
        syncView("Shield absorbed an asteroid.");
      } else if (previousEffect > 0 && state.lastEvent.indexOf("phase-") === 0) {
        callAudio("playCheck");
        syncView("Split phase carried the snake safely through the collision.");
      } else if (state.hazardEvent === "meteor-warning") {
        callAudio("playCheck");
        syncView();
      } else if (state.hazardEvent === "meteor-impact") {
        callAudio("playClick");
        syncView("Meteor landed. The asteroid field now has " +
          state.asteroids.length + " rocks.");
      } else if (state.hazardEvent === "meteor-dodged") {
        callAudio("playCheck");
        syncView("Nice dodge. The meteor landing zone was safely cleared.");
      } else if (state.hazardEvent === "meteor-delayed") {
        syncView("Meteor flight path delayed until a fair landing zone opens.");
      } else {
        syncView();
      }
      if (state.hazardEvent === "meteor-warning" && state.meteorWarning) {
        var warningMessage =
          "Meteor warning. Avoid the red zone for " +
          (state.meteorWarning.impactsAt - state.ticks) + " moves.";
        showEventToast(
          "⚠ RED ZONE · meteor lands in " +
          (state.meteorWarning.impactsAt - state.ticks) + " moves",
          "warning"
        );
        announceHazard(warningMessage);
      } else if (state.hazardEvent === "meteor-impact" && state.meteorImpact) {
        showEventToast("METEOR LANDED · asteroid field grew", "impact");
      } else if (state.hazardEvent === "meteor-dodged") {
        showEventToast("NICE DODGE · landing zone cleared", "success");
      } else if (state.hazardEvent === "meteor-delayed") {
        showEventToast("METEOR DELAYED · waiting for a fair zone", "info");
      }
    }

    function frame(timestamp) {
      frameId = 0;
      if (destroyed || state.phase !== "running") {
        return;
      }
      if (!lastFrameAt) {
        lastFrameAt = timestamp;
      }
      accumulator += Math.min(250, timestamp - lastFrameAt);
      lastFrameAt = timestamp;
      var updates = 0;
      while (accumulator >= stepDuration && updates < 2 && state.phase === "running") {
        accumulator -= stepDuration;
        processStep();
        updates += 1;
      }
      if (state.phase === "running") {
        frameId = global.requestAnimationFrame(frame);
      }
    }

    function startLoop() {
      if (!frameId && !destroyed && state.phase === "running") {
        frameId = global.requestAnimationFrame(frame);
      }
    }

    function begin() {
      if (state.phase === "lost" || state.phase === "won") {
        state = reset(state);
      }
      state = start(state);
      callAudio("playRun");
      syncView(state.lastEvent === "resumed" ? "Mission resumed." : "Mission started.");
      startLoop();
    }

    function pauseGame(message) {
      if (state.phase !== "running") {
        return;
      }
      state = pause(state);
      stopLoop();
      syncView(message || "Mission paused.");
    }

    function toggleGame() {
      if (state.phase === "running") {
        pauseGame();
        callAudio("playCheck");
      } else {
        begin();
      }
    }

    function restartGame() {
      stopLoop();
      state = reset(state);
      callAudio("playClick");
      syncView("Mission reset. Three splits restored. Press Start when you are ready.");
    }

    function steer(direction) {
      if (state.phase === "lost" || state.phase === "won") {
        return false;
      }
      var queued = queueTurn(state, direction);
      if (queued === state) {
        return false;
      }
      state = queued;
      if (state.phase === "idle" || state.phase === "paused") {
        begin();
      } else {
        syncView();
      }
      return true;
    }

    function useSplit() {
      var next = splitTrail(state);
      if (next === state) {
        var reason = state.splitsRemaining <= 0
          ? "No splits remain in this mission."
          : state.phase !== "running"
            ? "Start the mission before splitting."
            : "The trail needs at least three segments before it can split.";
        announce(reason);
        return;
      }
      state = next;
      callAudio("playCheck");
      syncView(
        "Trail split. Phase protection active; the score chain reset. " +
        state.splitsRemaining + " splits remain."
      );
    }

    function handlePointerDown(event) {
      if (!event.isPrimary || event.button > 0) {
        return;
      }
      pointerStart = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        consumed: false,
        rejectedDirection: null,
      };
      root.dataset.snakeTouch = "tracking";
      if (playfield && typeof playfield.setPointerCapture === "function") {
        try {
          playfield.setPointerCapture(event.pointerId);
        } catch (_error) {
          // Synthetic pointer events may not have an active browser pointer.
        }
      }
    }

    function commitSwipe(event) {
      if (!pointerStart || pointerStart.id !== event.pointerId) {
        return false;
      }
      if (pointerStart.consumed) {
        return true;
      }
      var direction = resolveSwipeDirection(
        pointerStart,
        { x: event.clientX, y: event.clientY },
        SWIPE_THRESHOLD
      );
      if (!direction) {
        return false;
      }
      event.preventDefault();
      focusPlayfield();
      if (!steer(direction)) {
        if (pointerStart.rejectedDirection !== direction) {
          pointerStart.rejectedDirection = direction;
          showEventToast("NO REVERSE · swipe up or down", "info");
          announce("The snake cannot reverse directly. Choose a side turn.");
        }
        return false;
      }
      pointerStart.consumed = true;
      showSwipeCue(direction);
      return true;
    }

    function handlePointerMove(event) {
      commitSwipe(event);
    }

    function clearPointer() {
      pointerStart = null;
      root.dataset.snakeTouch = "idle";
    }

    function handlePointerUp(event) {
      if (!pointerStart || pointerStart.id !== event.pointerId) {
        return;
      }
      commitSwipe(event);
      clearPointer();
    }

    function handleKeydown(event) {
      var key = String(event.key || "").toLowerCase();
      var directionByKey = {
        arrowup: "up",
        w: "up",
        arrowright: "right",
        d: "right",
        arrowdown: "down",
        s: "down",
        arrowleft: "left",
        a: "left",
      };
      if (directionByKey[key]) {
        event.preventDefault();
        steer(directionByKey[key]);
        return;
      }
      if (key === " " || key === "enter" || key === "p") {
        event.preventDefault();
        toggleGame();
        return;
      }
      if (key === "x") {
        event.preventDefault();
        useSplit();
        return;
      }
      if (key === "r") {
        event.preventDefault();
        restartGame();
      }
    }

    if (playfield) {
      playfield.addEventListener("keydown", handleKeydown, listenerOptions);
      playfield.addEventListener("pointerdown", handlePointerDown, listenerOptions);
      playfield.addEventListener("pointermove", handlePointerMove, listenerOptions);
      playfield.addEventListener("pointerup", handlePointerUp, listenerOptions);
      playfield.addEventListener("pointercancel", clearPointer, listenerOptions);
      playfield.addEventListener("lostpointercapture", clearPointer, listenerOptions);
    }
    if (toggleButton) {
      toggleButton.addEventListener("click", toggleGame, listenerOptions);
    }
    if (restartButton) {
      restartButton.addEventListener("click", restartGame, listenerOptions);
    }
    if (splitButton) {
      splitButton.addEventListener("click", useSplit, listenerOptions);
    }
    if (describeButton) {
      describeButton.addEventListener("click", function () {
        callAudio("playClick");
        announce(describe(state));
      }, listenerOptions);
    }
    root.querySelectorAll("[data-snake-direction]").forEach(function (button) {
      button.addEventListener("click", function () {
        focusPlayfield();
        if (steer(button.dataset.snakeDirection)) {
          showSwipeCue(button.dataset.snakeDirection);
        }
      }, listenerOptions);
    });
    global.document.addEventListener("visibilitychange", function () {
      if (global.document.hidden) {
        pauseGame("Mission paused because this tab is hidden.");
      }
    }, listenerOptions);
    if (reducedMotionQuery) {
      var syncMotion = function () {
        root.dataset.snakeMotion = reducedMotionQuery.matches ? "reduced" : "full";
      };
      syncMotion();
      if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", syncMotion, listenerOptions);
      }
    }
    if (typeof global.IntersectionObserver === "function") {
      observer = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            pauseGame("Mission paused because the game left the screen.");
          }
        });
      }, { threshold: 0.05 });
      observer.observe(root);
    }

    syncView();

    return Object.freeze({
      destroy: function () {
        destroyed = true;
        stopLoop();
        if (eventToastTimer) global.clearTimeout(eventToastTimer);
        if (swipeCueTimer) global.clearTimeout(swipeCueTimer);
        if (observer) observer.disconnect();
        if (abortController) abortController.abort();
      },
      pause: pauseGame,
      split: useSplit,
      getState: function () {
        return cloneState(state);
      },
    });
  }

  global.LANDING_SNAKE = Object.freeze({
    MAX_SCORE: MAX_SCORE,
    MAX_SPLITS: MAX_SPLITS,
    MAX_ASTEROIDS: MAX_ASTEROIDS,
    createState: createState,
    start: start,
    pause: pause,
    queueTurn: queueTurn,
    splitTrail: splitTrail,
    split: splitTrail,
    resolveSwipeDirection: resolveSwipeDirection,
    moveAsteroids: moveAsteroids,
    advanceMeteor: advanceMeteor,
    advanceWorldEvents: advanceWorldEvents,
    step: step,
    reset: reset,
    describe: describe,
    render: render,
    mount: mount,
  });
})(typeof window !== "undefined" ? window : null);
