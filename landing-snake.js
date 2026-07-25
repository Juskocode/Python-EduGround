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
  var POWER_UP_TYPES = Object.freeze(["shield", "boost", "stasis"]);
  var DEFAULT_ASTEROIDS = Object.freeze([
    Object.freeze([4, 2]),
    Object.freeze([17, 2]),
    Object.freeze([13, 4]),
    Object.freeze([20, 5]),
    Object.freeze([15, 9]),
    Object.freeze([3, 10]),
    Object.freeze([10, 11]),
    Object.freeze([21, 12]),
  ]);
  var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  var BEST_SCORE_KEY = "fp-playground.snake.best.v1";
  var MAX_SCORE = 1000;
  var BASE_CORE_POINTS = 10;
  var MAX_SPLITS = 3;
  var SPLIT_PHASE_TICKS = 10;
  var DEFAULT_ASTEROID_CADENCE = 18;
  var POWER_UP_LIFETIME = 72;
  var FALLING_STAR_LIFETIME = 14;
  var SEGMENT_POOL_SIZE = 3 + MAX_SCORE / BASE_CORE_POINTS;

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

  function powerUpLabel(type) {
    if (type === "shield") return "shield";
    if (type === "boost") return "double-core boost";
    if (type === "stasis") return "asteroid stasis";
    return "power-up";
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
    var direction = Object.prototype.hasOwnProperty.call(DIRECTIONS, settings.direction)
      ? settings.direction
      : "right";
    var ticks = clampInteger(settings.ticks, 0, 0, Number.MAX_SAFE_INTEGER);
    var splitUses = clampInteger(settings.splitUses, 0, 0, MAX_SPLITS);
    var score = clampInteger(settings.score, 0, 0, MAX_SCORE);
    var state = {
      width: width,
      height: height,
      initialSeed: seed,
      seed: seed,
      worldSeed: worldSeed,
      eventSeed: eventSeed,
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
      asteroidCadence: clampInteger(
        settings.asteroidCadence,
        DEFAULT_ASTEROID_CADENCE,
        6,
        60
      ),
      score: score,
      maxScore: MAX_SCORE,
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

    if (state.energy === null || score >= MAX_SCORE) {
      state.phase = "won";
      state.lastEvent = "won";
    }
    if (settings.phase && ["idle", "running", "paused", "lost", "won"].includes(settings.phase)) {
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
    var cell = candidates[seed % candidates.length];
    var type = POWER_UP_TYPES[next.powerUpCount % POWER_UP_TYPES.length];
    return Object.assign({}, next, {
      eventSeed: seed,
      powerUp: {
        type: type,
        cell: cell,
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
    if (collectedEnergy) {
      var awardedPoints = effects.boostCores > 0
        ? BASE_CORE_POINTS * 2
        : BASE_CORE_POINTS;
      if (effects.boostCores > 0) {
        effects.boostCores -= 1;
      }
      score = Math.min(MAX_SCORE, score + awardedPoints);
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
        stasisTicks: Math.max(0, effects.stasisTicks - 1),
      },
      powerUp: powerUp,
    });

    if (next.phase === "running") {
      next = advanceWorldEvents(next, tick);
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
      ? " A " + powerUpLabel(state.powerUp.type) + " power-up is at " +
        cellLabel(state.powerUp.cell, state.width) + "."
      : "";
    var effectCopy = state.phaseTicks > 0
      ? " Split phase is active for " + state.phaseTicks + " more moves."
      : "";
    return "Python Snake is at " + head + ", facing " + state.direction + "; " +
      energy + ". " + asteroidCopy + powerCopy + effectCopy + " " +
      state.splitsRemaining + " of " + MAX_SPLITS + " splits remain.";
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
      setAttributes(svgElement("polygon"), {
        points: "0.5,0.02 0.64,0.35 0.98,0.5 0.64,0.65 0.5,0.98 0.36,0.65 0.02,0.5 0.36,0.35",
      }),
      setAttributes(svgElement("circle", "landing-snake__energy-core"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.13,
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
        r: 0.43,
      }),
      setAttributes(svgElement("circle", "landing-snake__powerup-core"), {
        cx: 0.5,
        cy: 0.5,
        r: 0.27,
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
      rx: isHead ? 0.25 : 0.18,
    }));
    if (isHead) {
      var label = setAttributes(svgElement("text", "landing-snake__head-label"), {
        x: 0.5,
        y: 0.62,
        "text-anchor": "middle",
      });
      label.textContent = "PY";
      group.append(label);
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
    if (!asteroidLayer || !energyLayer || !powerUpLayer || !echoLayer || !fallingStarLayer) {
      return null;
    }

    var asteroidNodes = [];
    for (var asteroidIndex = 0; asteroidIndex < state.asteroids.length; asteroidIndex += 1) {
      var asteroidNode = createAsteroidNode(asteroidIndex);
      asteroidNodes.push(asteroidNode);
      asteroidLayer.append(asteroidNode);
    }
    var energyNode = createEnergyNode();
    var powerUpNode = createPowerUpNode();
    var fallingStarNode = createFallingStarNode();
    energyLayer.append(energyNode);
    powerUpLayer.append(powerUpNode);
    fallingStarLayer.append(fallingStarNode);

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
      renderer.powerUpNode.querySelector("text").textContent =
        state.powerUp.type === "shield"
          ? "S"
          : state.powerUp.type === "boost"
            ? "2×"
            : "‖";
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
        }
      }
    });

    root.dataset.snakePhase = state.phase;
    root.dataset.snakeScore = String(state.score);
    root.dataset.snakeTicks = String(state.ticks);
    root.dataset.snakeHead = String(state.segments[0]);
    root.dataset.snakeSplits = String(state.splitsRemaining);
    root.dataset.snakeRenderer = "stable";
    root.dataset.snakePowerup = state.powerUp ? state.powerUp.type : "none";
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
    var splitOutput = root.querySelector("[data-snake-splits]");
    var phaseOutput = root.querySelector("[data-snake-phase-label]");
    var overlay = root.querySelector("[data-snake-overlay]");
    var announcement = root.querySelector("[data-snake-announcement]");
    var reducedMotionQuery = typeof global.matchMedia === "function"
      ? global.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    var abortController = typeof global.AbortController === "function"
      ? new global.AbortController()
      : null;
    var listenerOptions = abortController ? { signal: abortController.signal } : undefined;
    var observer = null;

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

    function phaseCopy() {
      if (state.phase === "running") {
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
      if (splitOutput) {
        splitOutput.textContent = state.splitsRemaining + " / " + MAX_SPLITS;
      }
      if (phaseOutput) phaseOutput.textContent = phaseCopy();
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
          state.splitsRemaining + " splits remain."
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
        syncView(
          powerUpLabel(previousPowerUp.type) +
          " collected. " + phaseCopy() + "."
        );
      } else if (state.lastEvent === "collected" && state.score > previousScore) {
        callAudio("playRunComplete");
        syncView("Energy collected. Score " + state.score + " of " + MAX_SCORE + ".");
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
      } else {
        syncView();
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
        return;
      }
      state = queueTurn(state, direction);
      if (state.phase === "idle" || state.phase === "paused") {
        begin();
      } else {
        syncView();
      }
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
        "Trail split. Phase protection active. " +
        state.splitsRemaining + " splits remain."
      );
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
      if (key === " " || key === "enter") {
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
        if (playfield) playfield.focus();
        steer(button.dataset.snakeDirection);
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
    createState: createState,
    start: start,
    pause: pause,
    queueTurn: queueTurn,
    splitTrail: splitTrail,
    split: splitTrail,
    moveAsteroids: moveAsteroids,
    advanceWorldEvents: advanceWorldEvents,
    step: step,
    reset: reset,
    describe: describe,
    render: render,
    mount: mount,
  });
})(typeof window !== "undefined" ? window : null);
