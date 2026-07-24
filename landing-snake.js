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
  var OPPOSITES = Object.freeze({
    up: "down",
    right: "left",
    down: "up",
    left: "right",
  });
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
    if (Number.isInteger(value) && value >= 0 && value < width * height) {
      return value;
    }
    if (Array.isArray(value) && value.length >= 2) {
      var x = clampInteger(value[0], -1, -1, width);
      var y = clampInteger(value[1], -1, -1, height);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        return cellIndex(x, y, width);
      }
    }
    return null;
  }

  function nextSeed(seed) {
    return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  }

  function availableCells(state, segments, energy) {
    var occupied = new Set(segments || state.segments);
    state.asteroids.forEach(function (cell) {
      occupied.add(cell);
    });
    if (Number.isInteger(energy)) {
      occupied.add(energy);
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
    var candidates = availableCells(state, segments);
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

  function createState(options) {
    var settings = options && typeof options === "object" ? options : {};
    var width = clampInteger(settings.width, 24, 10, 40);
    var height = clampInteger(settings.height, 14, 8, 28);
    var segments = normalizeSegments(settings.segments, width, height);
    var asteroids = normalizeAsteroids(settings.asteroids, width, height, segments);
    var seed = clampInteger(settings.seed, 0x50f17e, 0, 0xffffffff) >>> 0;
    var direction = Object.prototype.hasOwnProperty.call(DIRECTIONS, settings.direction)
      ? settings.direction
      : "right";
    var state = {
      width: width,
      height: height,
      initialSeed: seed,
      seed: seed,
      phase: "idle",
      segments: segments,
      initialSegments: segments.slice(),
      direction: direction,
      queuedDirection: direction,
      turnQueued: false,
      energy: null,
      initialEnergy: null,
      asteroids: asteroids,
      initialAsteroids: asteroids.slice(),
      score: 0,
      ticks: 0,
      lastEvent: "ready",
      collision: null,
    };
    var requestedEnergy = normalizeCell(settings.energy, width, height);
    var occupied = new Set(segments.concat(asteroids));
    var friendlyEnergy = cellIndex(Math.min(width - 2, segments[0] % width + 5), Math.floor(segments[0] / width), width);
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
    if (state.energy === null) {
      state.phase = "won";
      state.lastEvent = "won";
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

  function step(state) {
    if (!state || state.phase !== "running") {
      return state;
    }

    var direction = state.queuedDirection;
    var head = nextHead(state, direction);
    var collected = head === state.energy;
    var bodyToCheck = collected
      ? state.segments
      : state.segments.slice(0, -1);
    var collision = state.asteroids.includes(head)
      ? "asteroid"
      : bodyToCheck.includes(head)
        ? "trail"
        : null;

    if (collision) {
      return Object.assign({}, state, {
        phase: "lost",
        direction: direction,
        queuedDirection: direction,
        turnQueued: false,
        ticks: state.ticks + 1,
        lastEvent: "lost",
        collision: collision,
      });
    }

    var segments = [head].concat(state.segments);
    if (!collected) {
      segments.pop();
      return Object.assign({}, state, {
        segments: segments,
        direction: direction,
        queuedDirection: direction,
        turnQueued: false,
        ticks: state.ticks + 1,
        lastEvent: "moved",
        collision: null,
      });
    }

    var selection = chooseEnergy(state, segments);
    var won = selection.energy === null;
    return Object.assign({}, state, {
      phase: won ? "won" : "running",
      segments: segments,
      direction: direction,
      queuedDirection: direction,
      turnQueued: false,
      energy: selection.energy,
      seed: selection.seed,
      score: state.score + 10,
      ticks: state.ticks + 1,
      lastEvent: won ? "won" : "collected",
      collision: null,
    });
  }

  function reset(state, options) {
    var settings = options && typeof options === "object" ? options : {};
    return createState({
      width: state && state.width,
      height: state && state.height,
      seed: settings.seed === undefined ? state && state.initialSeed : settings.seed,
      segments: state && state.initialSegments,
      asteroids: state && state.initialAsteroids,
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
      ? "Nearby asteroids: " + nearby.map(function (cell) {
          return cellLabel(cell, state.width);
        }).join("; ") + "."
      : "No asteroids are within five grid moves.";
    return "Python Snake is at " + head + ", facing " + state.direction + "; " + energy + ". " + asteroidCopy;
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

  function render(root, state) {
    if (!root || !state) {
      return;
    }
    var asteroidLayer = root.querySelector("[data-snake-asteroid-layer]");
    var energyLayer = root.querySelector("[data-snake-energy-layer]");
    var snakeLayer = root.querySelector("[data-snake-segment-layer]");
    if (!asteroidLayer || !energyLayer || !snakeLayer) {
      return;
    }

    asteroidLayer.replaceChildren();
    state.asteroids.forEach(function (cell, index) {
      var point = coordinates(cell, state.width);
      var group = setAttributes(svgElement("g", "landing-snake__asteroid"), {
        transform: "translate(" + point.x + " " + point.y + ")",
        "data-snake-asteroid": cell,
      });
      var rock = setAttributes(svgElement("polygon"), {
        points: index % 2
          ? "0.17,0.13 0.77,0.05 0.96,0.48 0.72,0.91 0.2,0.83 0.04,0.4"
          : "0.31,0.04 0.84,0.2 0.93,0.7 0.54,0.96 0.09,0.71 0.07,0.25",
      });
      var crater = setAttributes(svgElement("circle", "landing-snake__crater"), {
        cx: index % 2 ? 0.35 : 0.62,
        cy: index % 2 ? 0.56 : 0.39,
        r: 0.13,
      });
      group.append(rock, crater);
      asteroidLayer.append(group);
    });

    energyLayer.replaceChildren();
    if (state.energy !== null) {
      var energyPoint = coordinates(state.energy, state.width);
      var energy = setAttributes(svgElement("g", "landing-snake__energy"), {
        transform: "translate(" + energyPoint.x + " " + energyPoint.y + ")",
        "data-snake-energy": state.energy,
      });
      energy.append(
        setAttributes(svgElement("polygon"), {
          points: "0.5,0.02 0.64,0.35 0.98,0.5 0.64,0.65 0.5,0.98 0.36,0.65 0.02,0.5 0.36,0.35",
        }),
        setAttributes(svgElement("circle", "landing-snake__energy-core"), {
          cx: 0.5,
          cy: 0.5,
          r: 0.13,
        })
      );
      energyLayer.append(energy);
    }

    snakeLayer.replaceChildren();
    state.segments.slice().reverse().forEach(function (cell, reversedIndex) {
      var segmentIndex = state.segments.length - 1 - reversedIndex;
      var point = coordinates(cell, state.width);
      var isHead = segmentIndex === 0;
      var group = setAttributes(svgElement("g", isHead ? "landing-snake__head" : "landing-snake__segment"), {
        transform: "translate(" + point.x + " " + point.y + ")",
        "data-snake-segment": cell,
      });
      if (isHead) {
        group.setAttribute("data-snake-head", cell);
      }
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
      snakeLayer.append(group);
    });

    root.dataset.snakePhase = state.phase;
    root.dataset.snakeScore = String(state.score);
    root.dataset.snakeTicks = String(state.ticks);
    root.dataset.snakeHead = String(state.segments[0]);
  }

  function safeReadBestScore() {
    try {
      return Math.max(0, Number(global.localStorage.getItem(BEST_SCORE_KEY)) || 0);
    } catch (_error) {
      return 0;
    }
  }

  function safeWriteBestScore(score) {
    try {
      global.localStorage.setItem(BEST_SCORE_KEY, String(score));
    } catch (_error) {
      // The game remains playable when local storage is unavailable.
    }
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
    var scoreOutput = root.querySelector("[data-snake-score]");
    var bestOutput = root.querySelector("[data-snake-best]");
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
      if (state.phase === "running") return "In flight";
      if (state.phase === "paused") return "Paused";
      if (state.phase === "lost") return state.collision === "trail" ? "Trail collision" : "Asteroid collision";
      if (state.phase === "won") return "Sector cleared";
      return "Ready";
    }

    function overlayCopy() {
      if (state.phase === "paused") return "Mission paused";
      if (state.phase === "lost") return "Signal lost · press R or Play again";
      if (state.phase === "won") return "Sector cleared · perfect flight";
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
      if (scoreOutput) scoreOutput.textContent = String(state.score).padStart(3, "0");
      if (bestOutput) bestOutput.textContent = String(bestScore).padStart(3, "0");
      if (phaseOutput) phaseOutput.textContent = phaseCopy();
      if (toggleButton) {
        toggleButton.textContent = buttonCopy();
        toggleButton.setAttribute("aria-pressed", String(state.phase === "running"));
      }
      if (overlay) {
        overlay.hidden = state.phase === "running";
        overlay.textContent = overlayCopy();
      }
      if (playfield) {
        playfield.setAttribute(
          "aria-label",
          "Python Snake orbital grid. " + phaseCopy() + ". Score " + state.score + "."
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
      state = step(state);
      if (state.lastEvent === "collected" && state.score > previousScore) {
        callAudio("playRunComplete");
        syncView("Energy collected. Score " + state.score + ".");
      } else if (state.lastEvent === "lost") {
        callAudio("playFailure");
        syncView(
          (state.collision === "trail" ? "Trail collision." : "Asteroid collision.") +
          " Final score " + state.score + "."
        );
      } else if (state.lastEvent === "won") {
        callAudio("playTaskComplete");
        syncView("Sector cleared. Final score " + state.score + ".");
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
      syncView("Mission reset. Press Start when you are ready.");
    }

    function steer(direction) {
      if (state.phase === "lost" || state.phase === "won") {
        return;
      }
      var nextState = queueTurn(state, direction);
      state = nextState;
      if (state.phase === "idle" || state.phase === "paused") {
        begin();
      } else {
        syncView();
      }
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
      getState: function () {
        return Object.assign({}, state, {
          segments: state.segments.slice(),
          asteroids: state.asteroids.slice(),
        });
      },
    });
  }

  global.LANDING_SNAKE = Object.freeze({
    createState: createState,
    start: start,
    pause: pause,
    queueTurn: queueTurn,
    step: step,
    reset: reset,
    describe: describe,
    render: render,
    mount: mount,
  });
})(typeof window !== "undefined" ? window : null);
