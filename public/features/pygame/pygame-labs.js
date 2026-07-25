(function () {
  "use strict";

  var DIRECTIONS = Object.freeze({
    up: Object.freeze({ x: 0, y: -1 }),
    down: Object.freeze({ x: 0, y: 1 }),
    left: Object.freeze({ x: -1, y: 0 }),
    right: Object.freeze({ x: 1, y: 0 })
  });
  var KEY_DIRECTIONS = Object.freeze({
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right"
  });

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value)));
  }

  function integer(value, fallback, minimum, maximum) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      number = fallback;
    }
    return Math.round(clamp(number, minimum, maximum));
  }

  function finite(value, fallback, minimum, maximum) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      number = fallback;
    }
    return clamp(number, minimum, maximum);
  }

  function point(x, y) {
    return Object.freeze({ x: x, y: y });
  }

  function freezeSnakeState(state) {
    return Object.freeze({
      width: state.width,
      height: state.height,
      snake: Object.freeze(state.snake.map(function (segment) {
        return point(segment.x, segment.y);
      })),
      food: state.food ? point(state.food.x, state.food.y) : null,
      direction: state.direction,
      queuedDirection: state.queuedDirection,
      wrap: Boolean(state.wrap),
      tick: state.tick,
      score: state.score,
      status: state.status,
      lastEvent: state.lastEvent,
      lastUpdate: state.lastUpdate
    });
  }

  function createSnakeState(options) {
    var settings = options || {};
    var width = integer(settings.width, 12, 8, 18);
    var height = integer(settings.height, 8, 6, 14);
    var headX = Math.floor(width / 2);
    var headY = Math.floor(height / 2);
    var requestedFood = settings.food || {};
    var foodX = integer(requestedFood.x, Math.min(width - 2, headX + 3), 0, width - 1);
    var foodY = integer(requestedFood.y, headY, 0, height - 1);
    return freezeSnakeState({
      width: width,
      height: height,
      snake: [
        { x: headX, y: headY },
        { x: headX - 1, y: headY },
        { x: headX - 2, y: headY }
      ],
      food: { x: foodX, y: foodY },
      direction: "right",
      queuedDirection: "right",
      wrap: settings.wrap !== false,
      tick: 0,
      score: 0,
      status: "ready",
      lastEvent: "No event queued yet.",
      lastUpdate: "The snake is waiting for the first frame."
    });
  }

  function isOpposite(first, second) {
    var a = DIRECTIONS[first];
    var b = DIRECTIONS[second];
    return Boolean(a && b && a.x + b.x === 0 && a.y + b.y === 0);
  }

  function queueSnakeDirection(state, direction) {
    if (
      !state ||
      !DIRECTIONS[direction] ||
      state.status === "collision" ||
      state.status === "complete"
    ) {
      return state;
    }
    if (isOpposite(state.direction, direction)) {
      return freezeSnakeState({
        width: state.width,
        height: state.height,
        snake: state.snake,
        food: state.food,
        direction: state.direction,
        queuedDirection: state.queuedDirection,
        wrap: state.wrap,
        tick: state.tick,
        score: state.score,
        status: state.status,
        lastEvent: "Ignored " + direction + ": a snake cannot reverse into its neck.",
        lastUpdate: state.lastUpdate
      });
    }
    return freezeSnakeState({
      width: state.width,
      height: state.height,
      snake: state.snake,
      food: state.food,
      direction: state.direction,
      queuedDirection: direction,
      wrap: state.wrap,
      tick: state.tick,
      score: state.score,
      status: state.status,
      lastEvent: "Queued " + direction + " for the next update.",
      lastUpdate: state.lastUpdate
    });
  }

  function samePoint(first, second) {
    return first.x === second.x && first.y === second.y;
  }

  function nextFood(width, height, snake, tick) {
    var total = width * height;
    var start = (tick * 17 + 11) % total;
    for (var offset = 0; offset < total; offset += 1) {
      var candidateIndex = (start + offset) % total;
      var candidate = {
        x: candidateIndex % width,
        y: Math.floor(candidateIndex / width)
      };
      if (!snake.some(function (segment) { return samePoint(segment, candidate); })) {
        return candidate;
      }
    }
    return null;
  }

  function stepSnake(state, options) {
    if (!state || state.status === "collision" || state.status === "complete") {
      return state;
    }
    var settings = options || {};
    var wrap = settings.wrap === undefined ? state.wrap : Boolean(settings.wrap);
    var direction = state.queuedDirection;
    var movement = DIRECTIONS[direction];
    var currentHead = state.snake[0];
    var candidate = {
      x: currentHead.x + movement.x,
      y: currentHead.y + movement.y
    };
    var outside = (
      candidate.x < 0 ||
      candidate.x >= state.width ||
      candidate.y < 0 ||
      candidate.y >= state.height
    );

    if (outside && !wrap) {
      return freezeSnakeState({
        width: state.width,
        height: state.height,
        snake: state.snake,
        food: state.food,
        direction: direction,
        queuedDirection: direction,
        wrap: wrap,
        tick: state.tick + 1,
        score: state.score,
        status: "collision",
        lastEvent: "Handled " + direction + " from the event queue.",
        lastUpdate: "Boundary collision stopped the update before draw."
      });
    }

    if (wrap) {
      candidate.x = (candidate.x + state.width) % state.width;
      candidate.y = (candidate.y + state.height) % state.height;
    }

    var ate = samePoint(candidate, state.food);
    var collisionBody = ate ? state.snake : state.snake.slice(0, -1);
    if (collisionBody.some(function (segment) { return samePoint(segment, candidate); })) {
      return freezeSnakeState({
        width: state.width,
        height: state.height,
        snake: state.snake,
        food: state.food,
        direction: direction,
        queuedDirection: direction,
        wrap: wrap,
        tick: state.tick + 1,
        score: state.score,
        status: "collision",
        lastEvent: "Handled " + direction + " from the event queue.",
        lastUpdate: "Self-collision stopped the update before draw."
      });
    }

    var movedSnake = [candidate].concat(state.snake);
    if (!ate) {
      movedSnake.pop();
    }
    var nextTick = state.tick + 1;
    var food = ate
      ? nextFood(state.width, state.height, movedSnake, nextTick)
      : state.food;
    var completed = ate && food === null;
    return freezeSnakeState({
      width: state.width,
      height: state.height,
      snake: movedSnake,
      food: food,
      direction: direction,
      queuedDirection: direction,
      wrap: wrap,
      tick: nextTick,
      score: state.score + (ate ? 1 : 0),
      status: completed ? "complete" : ate ? "ate" : "moving",
      lastEvent: "Handled " + direction + " from the event queue.",
      lastUpdate: completed
        ? "Moved the head, kept the tail, and filled every cell."
        : ate
          ? "Moved the head and kept the tail, so the snake grew."
        : "Moved the head and removed the tail, preserving length."
    });
  }

  function freezePlatformerState(state) {
    return Object.freeze({
      worldWidth: state.worldWidth,
      viewportWidth: state.viewportWidth,
      x: state.x,
      y: state.y,
      vx: state.vx,
      vy: state.vy,
      grounded: Boolean(state.grounded),
      cameraX: state.cameraX,
      tick: state.tick,
      status: state.status,
      lastCollision: state.lastCollision
    });
  }

  function createPlatformerState(options) {
    var settings = options || {};
    var worldWidth = finite(settings.worldWidth, 40, 24, 60);
    var viewportWidth = finite(settings.viewportWidth, 16, 10, 22);
    return freezePlatformerState({
      worldWidth: worldWidth,
      viewportWidth: Math.min(viewportWidth, worldWidth),
      x: finite(settings.x, 2, 0, worldWidth - 1),
      y: 0,
      vx: 0,
      vy: 0,
      grounded: true,
      cameraX: 0,
      tick: 0,
      status: "ready",
      lastCollision: "Standing on the ground."
    });
  }

  function normalizePlatformerParameters(parameters) {
    var source = parameters || {};
    return Object.freeze({
      gravity: finite(source.gravity, 18, 4, 32),
      jumpStrength: finite(source.jumpStrength, 8, 3, 14),
      moveSpeed: finite(source.moveSpeed, 5, 1, 10),
      delta: finite(source.delta, 0.12, 0.04, 0.25)
    });
  }

  function platformHeightAt(x) {
    if (x >= 8 && x <= 12) {
      return 2.2;
    }
    if (x >= 17 && x <= 21) {
      return 3.8;
    }
    if (x >= 27 && x <= 32) {
      return 1.8;
    }
    return 0;
  }

  function stepPlatformer(state, input, parameters) {
    if (!state) {
      return state;
    }
    var controls = input || {};
    var settings = normalizePlatformerParameters(parameters);
    var horizontal = clamp(Number(controls.horizontal) || 0, -1, 1);
    var vx = horizontal * settings.moveSpeed;
    var vy = controls.jump && state.grounded ? settings.jumpStrength : state.vy;
    var previousY = state.y;
    var nextX = clamp(state.x + vx * settings.delta, 0, state.worldWidth - 1);
    var wasGrounded = state.grounded;

    vy -= settings.gravity * settings.delta;
    var nextY = state.y + vy * settings.delta;
    var landingHeight = platformHeightAt(nextX);
    var landed = vy <= 0 && previousY >= landingHeight && nextY <= landingHeight;
    if (landed) {
      nextY = landingHeight;
      vy = 0;
    } else if (nextY < 0) {
      nextY = 0;
      vy = 0;
      landed = true;
      landingHeight = 0;
    }

    var grounded = landed;
    var cameraLimit = Math.max(0, state.worldWidth - state.viewportWidth);
    var cameraX = clamp(
      nextX - state.viewportWidth * 0.42,
      0,
      cameraLimit
    );
    var status = horizontal
      ? "moving"
      : controls.jump && wasGrounded
        ? "jumped"
        : grounded
          ? "grounded"
          : "falling";
    var collision = landed
      ? landingHeight > 0
        ? "The downward path crossed a platform top, so y snapped to the surface."
        : "The downward path reached the ground, so vertical velocity became zero."
      : "No landing surface crossed this frame.";

    return freezePlatformerState({
      worldWidth: state.worldWidth,
      viewportWidth: state.viewportWidth,
      x: nextX,
      y: nextY,
      vx: vx,
      vy: vy,
      grounded: grounded,
      cameraX: cameraX,
      tick: state.tick + 1,
      status: status,
      lastCollision: collision
    });
  }

  function normalizeOccupiedCells(cells, cellCount) {
    var source = Array.isArray(cells) ? cells : [];
    var result = [];
    source.forEach(function (cell) {
      var value = Math.floor(Number(cell));
      if (
        Number.isFinite(value) &&
        value >= 0 &&
        value < cellCount &&
        result.indexOf(value) < 0
      ) {
        result.push(value);
      }
    });
    return result;
  }

  function chooseDeterministicSpawn(cellCount, occupiedCells, seed) {
    var count = integer(cellCount, 12, 1, 64);
    var occupied = normalizeOccupiedCells(occupiedCells, count);
    var start = ((Math.floor(Number(seed) || 0) * 5 + 3) % count + count) % count;
    for (var offset = 0; offset < count; offset += 1) {
      var candidate = (start + offset) % count;
      if (occupied.indexOf(candidate) < 0) {
        return candidate;
      }
    }
    return null;
  }

  function freezeSystemsState(state) {
    return Object.freeze({
      cellCount: state.cellCount,
      occupiedCells: Object.freeze(state.occupiedCells.slice()),
      mode: state.mode,
      tick: state.tick,
      score: state.score,
      boostRemainingMs: state.boostRemainingMs,
      spawnSeed: state.spawnSeed,
      spawnCell: state.spawnCell,
      lastAction: state.lastAction,
      lastTransition: state.lastTransition
    });
  }

  function createSystemsState(options) {
    var settings = options || {};
    var cellCount = integer(settings.cellCount, 12, 8, 24);
    var occupiedCells = normalizeOccupiedCells(
      settings.occupiedCells || [1, 5, 9],
      cellCount
    );
    var spawnSeed = integer(settings.spawnSeed, 4, 0, 9999);
    return freezeSystemsState({
      cellCount: cellCount,
      occupiedCells: occupiedCells,
      mode: "title",
      tick: 0,
      score: 0,
      boostRemainingMs: 0,
      spawnSeed: spawnSeed,
      spawnCell: chooseDeterministicSpawn(cellCount, occupiedCells, spawnSeed),
      lastAction: "No action yet.",
      lastTransition: "Title mode waits for an explicit start event."
    });
  }

  function stepSystems(state, action, elapsedMs) {
    if (!state) {
      return state;
    }
    var next = {
      cellCount: state.cellCount,
      occupiedCells: state.occupiedCells,
      mode: state.mode,
      tick: state.tick,
      score: state.score,
      boostRemainingMs: state.boostRemainingMs,
      spawnSeed: state.spawnSeed,
      spawnCell: state.spawnCell,
      lastAction: String(action || "tick"),
      lastTransition: "No legal state transition for this action."
    };
    var eventName = String(action || "tick");

    if (eventName === "start" && state.mode === "title") {
      next.mode = "running";
      next.lastTransition = "title → running; gameplay updates are now enabled.";
    } else if (eventName === "toggle-pause" && state.mode === "running") {
      next.mode = "paused";
      next.lastTransition = "running → paused; events and drawing continue, gameplay clocks stop.";
    } else if (eventName === "toggle-pause" && state.mode === "paused") {
      next.mode = "running";
      next.lastTransition = "paused → running; the next elapsed value should be clamped.";
    } else if (eventName === "collect" && state.mode === "running") {
      next.score += 50;
      next.boostRemainingMs = 1500;
      next.spawnSeed += 1;
      next.spawnCell = chooseDeterministicSpawn(
        state.cellCount,
        state.occupiedCells.concat(
          state.spawnCell === null ? [] : [state.spawnCell]
        ),
        next.spawnSeed
      );
      next.lastTransition = "Power-up collected: score increased, boost timer started, and the next seeded free cell was selected.";
    } else if (eventName === "collision" && state.mode === "running") {
      next.mode = "game-over";
      next.lastTransition = "running → game-over; movement and effect timers are now disabled.";
    } else if (eventName === "restart" && state.mode === "game-over") {
      next.mode = "running";
      next.tick = 0;
      next.score = 0;
      next.boostRemainingMs = 0;
      next.spawnSeed += 1;
      next.spawnCell = chooseDeterministicSpawn(
        state.cellCount,
        state.occupiedCells,
        next.spawnSeed
      );
      next.lastTransition = "game-over → running; transient state reset with a reproducible next seed.";
    } else if (eventName === "tick" && state.mode === "running") {
      var delta = finite(elapsedMs, 250, 0, 1000);
      next.tick += 1;
      next.boostRemainingMs = Math.max(0, state.boostRemainingMs - delta);
      next.lastTransition = state.boostRemainingMs > 0 && next.boostRemainingMs === 0
        ? "The boost timer crossed zero, so the temporary effect expired once."
        : "Running update advanced timers by " + delta + " ms.";
    } else if (eventName === "tick" && state.mode === "paused") {
      next.lastTransition = "Paused update ignored elapsed time; events and drawing may still continue.";
    }

    return freezeSystemsState(next);
  }

  function el(tagName, className, textContent) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null) {
      node.textContent = String(textContent);
    }
    return node;
  }

  function setPressed(button, pressed) {
    if (button) {
      button.setAttribute("aria-pressed", pressed ? "true" : "false");
    }
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function renderLoopLegend() {
    var legend = el("ol", "pygame-labs__loop");
    [
      ["1", "Event", "Read keyboard, pointer, and quit events."],
      ["2", "Update", "Change state using rules and elapsed time."],
      ["3", "Draw", "Render the new state, then repeat."]
    ].forEach(function (phase) {
      var item = el("li");
      item.append(
        el("span", "pygame-labs__loop-number", phase[0]),
        el("strong", null, phase[1]),
        el("small", null, phase[2])
      );
      legend.append(item);
    });
    return legend;
  }

  function renderDiscoveryList(items) {
    var list = el("ul", "pygame-lab__discoveries");
    items.forEach(function (item) {
      var row = el("li");
      row.dataset.discovery = item.id;
      row.append(
        el("span", "pygame-lab__discovery-mark", "○"),
        el("span", null, item.label)
      );
      list.append(row);
    });
    return list;
  }

  function completeDiscovery(root, id) {
    var item = root.querySelector('[data-discovery="' + id + '"]');
    if (!item || item.classList.contains("is-complete")) {
      return;
    }
    item.classList.add("is-complete");
    var mark = item.querySelector(".pygame-lab__discovery-mark");
    if (mark) {
      mark.textContent = "✓";
    }
  }

  function renderFrameTracer(lab, announce) {
    if (!lab || lab.kind !== "pygame-frame-tracer") {
      return null;
    }
    var phases = Array.isArray(lab.phases) ? lab.phases : [];
    var scenarios = Array.isArray(lab.scenarios) ? lab.scenarios : [];
    if (!phases.length || !scenarios.length) {
      return null;
    }
    var activePhase = 0;
    var block = el("section", "pygame-lab pygame-lab--tracer");
    var heading = el("header", "pygame-lab__heading");
    var title = el("h3", null, lab.title);
    var scenarioLabel = el("label", "pygame-tracer__scenario");
    var scenarioSelect = el("select");
    var phaseNavigation = el("div", "pygame-tracer__phases");
    var phasePrompt = el("p", "pygame-tracer__prompt");
    var parameterFieldset = el("fieldset", "pygame-tracer__parameters");
    var parameterSummary = el("output", "pygame-tracer__parameter-summary");
    var snapshots = el("div", "pygame-tracer__snapshots");
    var snapshotOutputs = {};
    var teachingNote = el("aside", "pygame-tracer__teaching-note");
    var nextButton = el("button", "button button--primary", "Reveal next phase");
    var status = el("p", "pygame-lab__status");
    var invariants = el("ul", "pygame-tracer__invariants");
    var controlInputs = [];

    title.id = "pygame-frame-tracer-title";
    block.dataset.pygameLab = "frame-tracer";
    block.setAttribute("aria-labelledby", title.id);
    heading.append(
      el("span", "eyebrow", "Guided frame tracer"),
      title,
      el("p", null, lab.description)
    );

    scenarioSelect.id = "pygame-frame-tracer-scenario";
    scenarios.forEach(function (scenario) {
      var option = el("option", null, scenario.label);
      option.value = scenario.id;
      option.selected = scenario.id === lab.defaultScenario;
      scenarioSelect.append(option);
    });
    scenarioLabel.htmlFor = scenarioSelect.id;
    scenarioLabel.append(el("span", null, "Scenario"), scenarioSelect);

    phases.forEach(function (phase, index) {
      var button = el("button", "pygame-tracer__phase", phase.label);
      button.type = "button";
      button.dataset.tracerPhase = String(index);
      button.setAttribute("aria-pressed", "false");
      phaseNavigation.append(button);
    });

    parameterFieldset.append(el("legend", null, "Prediction controls"));
    (Array.isArray(lab.controls) ? lab.controls : []).forEach(function (control) {
      var label = el("label");
      var input;
      var valueOutput = el("output");
      if (control.type === "select") {
        input = el("select");
        (Array.isArray(control.values) ? control.values : []).forEach(function (value) {
          var option = el("option", null, value);
          option.value = String(value);
          option.selected = value === control.defaultValue;
          input.append(option);
        });
      } else {
        input = el("input");
        input.type = control.type === "toggle" ? "checkbox" : "range";
        if (control.type === "toggle") {
          input.checked = Boolean(control.defaultValue);
        } else {
          input.min = String(control.min);
          input.max = String(control.max);
          input.step = String(control.step);
          input.value = String(control.defaultValue);
        }
      }
      input.id = "pygame-tracer-control-" + control.id;
      input.dataset.tracerControl = control.id;
      input.dataset.tracerLabel = control.label;
      label.htmlFor = input.id;
      label.append(el("span", null, control.label), valueOutput, input);
      parameterFieldset.append(label);
      controlInputs.push({ definition: control, input: input, output: valueOutput });
    });
    parameterFieldset.append(parameterSummary);

    [
      ["previous", "Previous snapshot"],
      ["intent", "Interpreted intent"],
      ["candidate", "Candidate state"],
      ["committed", "Committed state"]
    ].forEach(function (definition) {
      var card = el("article", "pygame-tracer__snapshot");
      var output = el("output");
      output.dataset.tracerSnapshot = definition[0];
      snapshotOutputs[definition[0]] = { card: card, output: output };
      card.append(el("strong", null, definition[1]), output);
      snapshots.append(card);
    });
    teachingNote.append(
      el("strong", null, "Why this trace matters"),
      el("p")
    );
    (Array.isArray(lab.invariants) ? lab.invariants : []).forEach(function (item) {
      invariants.append(el("li", null, item));
    });
    nextButton.type = "button";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    block.append(
      heading,
      scenarioLabel,
      phaseNavigation,
      phasePrompt,
      parameterFieldset,
      snapshots,
      teachingNote,
      nextButton,
      el("h4", "pygame-tracer__invariants-title", "Rules that stay true"),
      invariants,
      status
    );

    function selectedScenario() {
      return scenarios.find(function (scenario) {
        return scenario.id === scenarioSelect.value;
      }) || scenarios[0];
    }

    function readControlValue(entry) {
      if (entry.definition.type === "toggle") {
        return entry.input.checked ? "on" : "off";
      }
      return entry.input.value;
    }

    function render(speak) {
      var scenario = selectedScenario();
      var phase = phases[activePhase];
      phaseNavigation.querySelectorAll("[data-tracer-phase]").forEach(function (button) {
        var isActive = Number(button.dataset.tracerPhase) === activePhase;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      phasePrompt.textContent = phase.prompt;
      controlInputs.forEach(function (entry) {
        var value = readControlValue(entry);
        entry.output.value = value;
        entry.output.textContent = value;
      });
      var summary = controlInputs.map(function (entry) {
        return entry.definition.label + "=" + readControlValue(entry);
      }).join(" · ");
      parameterSummary.value = summary;
      parameterSummary.textContent = summary;
      ["previous", "intent", "candidate", "committed"].forEach(function (key, index) {
        var entry = snapshotOutputs[key];
        var revealAt = index === 0 ? 0 : index;
        entry.card.hidden = activePhase < revealAt;
        entry.output.value = scenario[key];
        entry.output.textContent = scenario[key];
      });
      teachingNote.hidden = activePhase < phases.length - 1;
      teachingNote.querySelector("p").textContent = scenario.teachingNote;
      nextButton.textContent = activePhase < phases.length - 1
        ? "Reveal next phase"
        : "Restart trace";
      status.textContent = (
        scenario.label + ". " + phase.label + " of " + phases.length +
        ". " + (activePhase < phases.length - 1
          ? "Predict before revealing the next snapshot."
          : "Trace complete; compare every committed field with your prediction.")
      );
      if (speak) {
        announce(status.textContent);
      }
    }

    phaseNavigation.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tracer-phase]");
      if (!button) {
        return;
      }
      activePhase = integer(button.dataset.tracerPhase, 0, 0, phases.length - 1);
      render(true);
    });
    scenarioSelect.addEventListener("change", function () {
      activePhase = 0;
      render(true);
    });
    parameterFieldset.addEventListener("input", function () {
      render(false);
    });
    parameterFieldset.addEventListener("change", function () {
      render(true);
    });
    nextButton.addEventListener("click", function () {
      activePhase = activePhase < phases.length - 1 ? activePhase + 1 : 0;
      render(true);
    });
    render(false);
    return block;
  }

  function renderSnakeLab(announce) {
    var state = createSnakeState();
    var running = false;
    var timer = null;
    var reducedMotion = prefersReducedMotion();
    var discoveries = { event: false, update: false, food: false };
    var block = el("section", "pygame-lab pygame-lab--snake");
    var heading = el("header", "pygame-lab__heading");
    var title = el("h3", null, "Lab 1 · Think like a Snake game loop");
    var workspace = el("div", "pygame-lab__workspace");
    var visual = el("div", "pygame-lab__visual");
    var board = el("div", "pygame-snake");
    var status = el("p", "pygame-lab__status");
    var controls = el("div", "pygame-lab__controls");
    var transport = el("div", "pygame-lab__transport");
    var stepButton = el("button", "button button--quiet", "Step frame");
    var playButton = el(
      "button",
      "button button--primary",
      reducedMotion ? "Play unavailable" : "Play"
    );
    var resetButton = el("button", "button button--quiet", "Reset");
    var directionPad = el("div", "pygame-snake__directions");
    var parameters = el("fieldset", "pygame-lab__parameters");
    var speedLabel = el("label");
    var speed = el("input");
    var wrapLabel = el("label", "pygame-lab__toggle");
    var wrap = el("input");
    var inspector = el("aside", "pygame-lab__inspector");
    var eventOutput = el("output");
    var updateOutput = el("output");
    var drawOutput = el("output");
    var discoveryList = renderDiscoveryList([
      { id: "snake-event", label: "Queue an input event before a frame." },
      { id: "snake-update", label: "Step and observe head/tail state change." },
      { id: "snake-food", label: "Reach food and observe growth." }
    ]);

    title.id = "pygame-snake-lab-title";
    block.setAttribute("aria-labelledby", title.id);
    block.dataset.pygameLab = "snake";
    heading.append(
      el("span", "eyebrow", "Event → update → draw"),
      title,
      el(
        "p",
        null,
        "Focus the board and use Arrow keys or WASD. A key press queues intent; only the next frame changes the snake."
      )
    );

    board.tabIndex = 0;
    board.setAttribute("role", "region");
    board.setAttribute("aria-label", "Snake state board");
    board.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight W A S D");
    board.style.setProperty("--snake-columns", String(state.width));
    for (var cellIndex = 0; cellIndex < state.width * state.height; cellIndex += 1) {
      var cell = el("span", "pygame-snake__cell");
      cell.setAttribute("aria-hidden", "true");
      board.append(cell);
    }

    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    [
      ["up", "↑", "Move up"],
      ["left", "←", "Move left"],
      ["down", "↓", "Move down"],
      ["right", "→", "Move right"]
    ].forEach(function (item) {
      var button = el("button", "pygame-snake__direction", item[1]);
      button.type = "button";
      button.dataset.snakeDirection = item[0];
      button.setAttribute("aria-label", item[2]);
      directionPad.append(button);
    });

    stepButton.type = "button";
    playButton.type = "button";
    resetButton.type = "button";
    if (reducedMotion) {
      playButton.disabled = true;
      playButton.setAttribute(
        "title",
        "Continuous animation is disabled by your reduced-motion preference."
      );
    }
    transport.append(stepButton, playButton, resetButton);

    speed.type = "range";
    speed.min = "180";
    speed.max = "900";
    speed.step = "60";
    speed.value = "480";
    speed.id = "pygame-snake-speed";
    speedLabel.htmlFor = speed.id;
    speedLabel.append(
      el("span", null, "Frame delay"),
      speed,
      el("small", null, "Slow ←→ fast thinking")
    );
    wrap.type = "checkbox";
    wrap.checked = true;
    wrap.id = "pygame-snake-wrap";
    wrapLabel.htmlFor = wrap.id;
    wrapLabel.append(wrap, el("span", null, "Wrap at screen edges"));
    parameters.append(el("legend", null, "Experiment parameters"), speedLabel, wrapLabel);
    controls.append(transport, directionPad, parameters);
    visual.append(board, controls, status);

    inspector.append(
      el("span", "eyebrow", "Frame inspector"),
      el("h4", null, "What happened this frame?"),
      el("strong", null, "1 · Event"),
      eventOutput,
      el("strong", null, "2 · Update"),
      updateOutput,
      el("strong", null, "3 · Draw"),
      drawOutput,
      el("h4", null, "Discoveries"),
      discoveryList
    );
    workspace.append(visual, inspector);
    block.append(heading, workspace);

    function renderState(speak) {
      var cells = board.children;
      Array.prototype.forEach.call(cells, function (cell) {
        cell.className = "pygame-snake__cell";
      });
      state.snake.forEach(function (segment, index) {
        var segmentCell = cells[segment.y * state.width + segment.x];
        if (segmentCell) {
          segmentCell.classList.add(
            index === 0 ? "pygame-snake__cell--head" : "pygame-snake__cell--body"
          );
        }
      });
      if (state.food) {
        var foodCell = cells[state.food.y * state.width + state.food.x];
        if (foodCell) {
          foodCell.classList.add("pygame-snake__cell--food");
        }
      }
      eventOutput.value = state.lastEvent;
      eventOutput.textContent = state.lastEvent;
      updateOutput.value = state.lastUpdate;
      updateOutput.textContent = state.lastUpdate;
      var drawText = (
        "Drew " + state.snake.length + " snake segments and " +
        (state.food ? "one food item." : "no food: the grid is complete.")
      );
      drawOutput.value = drawText;
      drawOutput.textContent = drawText;
      status.textContent = (
        "Frame " + state.tick +
        ". Head at column " + (state.snake[0].x + 1) +
        ", row " + (state.snake[0].y + 1) +
        ". Direction " + state.direction +
        ". Score " + state.score + "."
      );
      if (state.status === "collision") {
        status.textContent += " Collision: reset to continue.";
      } else if (state.status === "complete") {
        status.textContent += " Grid complete: reset to replay.";
      }
      if (discoveries.event) {
        completeDiscovery(block, "snake-event");
      }
      if (discoveries.update) {
        completeDiscovery(block, "snake-update");
      }
      if (discoveries.food) {
        completeDiscovery(block, "snake-food");
      }
      if (speak) {
        announce(status.textContent);
      }
    }

    function stop() {
      running = false;
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      playButton.textContent = reducedMotion ? "Play unavailable" : "Play";
      setPressed(playButton, false);
    }

    function step(speak) {
      var previousScore = state.score;
      state = stepSnake(state, { wrap: wrap.checked });
      discoveries.update = true;
      discoveries.food = discoveries.food || state.score > previousScore;
      renderState(speak);
      if (state.status === "collision" || state.status === "complete") {
        stop();
      }
    }

    function start() {
      if (
        reducedMotion ||
        running ||
        state.status === "collision" ||
        state.status === "complete"
      ) {
        return;
      }
      running = true;
      playButton.textContent = "Pause";
      setPressed(playButton, true);
      timer = window.setInterval(function () {
        if (!block.isConnected || document.visibilityState === "hidden") {
          stop();
          return;
        }
        step(false);
      }, 1080 - Number(speed.value));
      announce("Snake game loop playing. Press Pause to stop.");
    }

    function queue(direction) {
      state = queueSnakeDirection(state, direction);
      discoveries.event = true;
      renderState(true);
    }

    board.addEventListener("keydown", function (event) {
      var direction = KEY_DIRECTIONS[event.key];
      if (!direction) {
        return;
      }
      event.preventDefault();
      queue(direction);
    });
    directionPad.addEventListener("click", function (event) {
      var button = event.target.closest("[data-snake-direction]");
      if (button) {
        queue(button.dataset.snakeDirection);
        board.focus();
      }
    });
    stepButton.addEventListener("click", function () { step(true); });
    playButton.addEventListener("click", function () {
      if (running) {
        stop();
        announce("Snake game loop paused.");
      } else {
        start();
      }
    });
    resetButton.addEventListener("click", function () {
      stop();
      state = createSnakeState({ wrap: wrap.checked });
      renderState(true);
      board.focus();
    });
    speed.addEventListener("input", function () {
      if (running) {
        stop();
        start();
      }
    });
    wrap.addEventListener("change", function () {
      state = freezeSnakeState({
        width: state.width,
        height: state.height,
        snake: state.snake,
        food: state.food,
        direction: state.direction,
        queuedDirection: state.queuedDirection,
        wrap: wrap.checked,
        tick: state.tick,
        score: state.score,
        status: state.status,
        lastEvent: state.lastEvent,
        lastUpdate: "Edge behavior changed; the next update will use the new rule."
      });
      renderState(true);
    });
    renderState(false);
    return block;
  }

  function renderPlatformerLab(announce) {
    var state = createPlatformerState();
    var parameters = normalizePlatformerParameters();
    var input = { horizontal: 0, jump: false };
    var running = false;
    var timer = null;
    var reducedMotion = prefersReducedMotion();
    var block = el("section", "pygame-lab pygame-lab--platformer");
    var heading = el("header", "pygame-lab__heading");
    var title = el("h3", null, "Lab 2 · Tune a 2D platformer");
    var workspace = el("div", "pygame-lab__workspace");
    var visual = el("div", "pygame-lab__visual");
    var stage = el("div", "pygame-platformer");
    var scene = el("div", "pygame-platformer__scene");
    var player = el("span", "pygame-platformer__player");
    var status = el("p", "pygame-lab__status");
    var controls = el("div", "pygame-lab__controls");
    var transport = el("div", "pygame-lab__transport");
    var stepButton = el("button", "button button--quiet", "Step frame");
    var playButton = el(
      "button",
      "button button--primary",
      reducedMotion ? "Play unavailable" : "Play"
    );
    var resetButton = el("button", "button button--quiet", "Reset");
    var movement = el("div", "pygame-platformer__directions");
    var leftButton = el("button", "pygame-platformer__direction", "← Left");
    var jumpButton = el("button", "pygame-platformer__direction", "↑ Jump");
    var rightButton = el("button", "pygame-platformer__direction", "Right →");
    var fieldset = el("fieldset", "pygame-lab__parameters pygame-lab__parameters--grid");
    var inspector = el("aside", "pygame-lab__inspector");
    var outputs = {};
    var discoveryList = renderDiscoveryList([
      { id: "platform-move", label: "Change horizontal velocity with input." },
      { id: "platform-jump", label: "Jump, then watch gravity reverse velocity." },
      { id: "platform-land", label: "Land through a top-surface collision." },
      { id: "platform-camera", label: "Move far enough for the camera to follow." }
    ]);

    title.id = "pygame-platformer-lab-title";
    block.setAttribute("aria-labelledby", title.id);
    block.dataset.pygameLab = "platformer";
    heading.append(
      el("span", "eyebrow", "Input → physics → collision → camera"),
      title,
      el(
        "p",
        null,
        "Use A/D or Arrow keys to move and Space to jump. This lab measures height above ground as positive upward; a local Pygame adapter maps it to downward-growing screen y."
      )
    );

    stage.tabIndex = 0;
    stage.setAttribute("role", "region");
    stage.setAttribute("aria-label", "Platformer simulation viewport");
    stage.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight A D Space");
    scene.setAttribute("aria-hidden", "true");
    [
      [0, 0, 40, "ground"],
      [8, 2.2, 4, "platform"],
      [17, 3.8, 4, "platform"],
      [27, 1.8, 5, "platform"]
    ].forEach(function (platform) {
      var surface = el(
        "span",
        "pygame-platformer__surface pygame-platformer__surface--" + platform[3]
      );
      surface.style.setProperty("--platform-x", String(platform[0]));
      surface.style.setProperty("--platform-y", String(platform[1]));
      surface.style.setProperty("--platform-width", String(platform[2]));
      scene.append(surface);
    });
    scene.append(player);
    stage.append(scene);

    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    stepButton.type = "button";
    playButton.type = "button";
    resetButton.type = "button";
    leftButton.type = "button";
    jumpButton.type = "button";
    rightButton.type = "button";
    leftButton.dataset.platformDirection = "-1";
    rightButton.dataset.platformDirection = "1";
    jumpButton.dataset.platformJump = "true";
    leftButton.setAttribute("aria-label", "Move platformer left");
    rightButton.setAttribute("aria-label", "Move platformer right");
    jumpButton.setAttribute("aria-label", "Jump");
    if (reducedMotion) {
      playButton.disabled = true;
      playButton.setAttribute(
        "title",
        "Continuous animation is disabled by your reduced-motion preference."
      );
    }
    transport.append(stepButton, playButton, resetButton);
    movement.append(leftButton, jumpButton, rightButton);

    [
      ["gravity", "Gravity", 4, 32, 1, parameters.gravity],
      ["jumpStrength", "Jump strength", 3, 14, 0.5, parameters.jumpStrength],
      ["moveSpeed", "Move speed", 1, 10, 0.5, parameters.moveSpeed]
    ].forEach(function (definition) {
      var label = el("label");
      var name = el("span", null, definition[1]);
      var value = el("output", null, definition[5]);
      var range = el("input");
      range.type = "range";
      range.min = String(definition[2]);
      range.max = String(definition[3]);
      range.step = String(definition[4]);
      range.value = String(definition[5]);
      range.dataset.platformParameter = definition[0];
      value.dataset.platformParameterOutput = definition[0];
      label.append(name, value, range);
      fieldset.append(label);
    });
    fieldset.prepend(el("legend", null, "Physics parameters"));
    controls.append(transport, movement, fieldset);
    visual.append(stage, controls, status);

    [
      ["x", "World x"],
      ["y", "Height above ground"],
      ["vx", "Horizontal velocity"],
      ["vy", "Vertical velocity"],
      ["grounded", "Grounded"],
      ["camera", "Camera x"],
      ["collision", "Collision check"]
    ].forEach(function (definition) {
      var row = el("div", "pygame-lab__state-row");
      var output = el("output");
      if (definition[0] === "collision") {
        row.classList.add("pygame-lab__state-row--wide");
      }
      outputs[definition[0]] = output;
      row.append(el("span", null, definition[1]), output);
      inspector.append(row);
    });
    inspector.prepend(
      el("span", "eyebrow", "State inspector"),
      el("h4", null, "Separate world state from screen position")
    );
    inspector.append(el("h4", null, "Discoveries"), discoveryList);
    workspace.append(visual, inspector);
    block.append(heading, workspace);

    function renderState(speak) {
      player.style.setProperty("--player-x", String(state.x));
      player.style.setProperty("--player-y", String(state.y));
      scene.style.setProperty("--camera-x", String(state.cameraX));
      outputs.x.value = state.x.toFixed(2);
      outputs.x.textContent = state.x.toFixed(2);
      outputs.y.value = state.y.toFixed(2);
      outputs.y.textContent = state.y.toFixed(2);
      outputs.vx.value = state.vx.toFixed(2);
      outputs.vx.textContent = state.vx.toFixed(2);
      outputs.vy.value = state.vy.toFixed(2);
      outputs.vy.textContent = state.vy.toFixed(2);
      outputs.grounded.value = state.grounded ? "yes" : "no";
      outputs.grounded.textContent = state.grounded ? "yes" : "no";
      outputs.camera.value = state.cameraX.toFixed(2);
      outputs.camera.textContent = state.cameraX.toFixed(2);
      outputs.collision.value = state.lastCollision;
      outputs.collision.textContent = state.lastCollision;
      status.textContent = (
        "Frame " + state.tick +
        ". World x " + state.x.toFixed(1) +
        ". Height above ground " + state.y.toFixed(1) +
        ". Up-positive velocity " + state.vy.toFixed(1) +
        ". Camera offset " + state.cameraX.toFixed(1) + "."
      );
      if (state.vx !== 0) {
        completeDiscovery(block, "platform-move");
      }
      if (!state.grounded && state.y > 0) {
        completeDiscovery(block, "platform-jump");
      }
      if (state.tick > 1 && state.grounded && /crossed|ground/u.test(state.lastCollision)) {
        completeDiscovery(block, "platform-land");
      }
      if (state.cameraX > 0.5) {
        completeDiscovery(block, "platform-camera");
      }
      if (speak) {
        announce(status.textContent);
      }
    }

    function step(speak) {
      state = stepPlatformer(state, input, parameters);
      input.jump = false;
      renderState(speak);
    }

    function stop() {
      running = false;
      input.horizontal = 0;
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      playButton.textContent = reducedMotion ? "Play unavailable" : "Play";
      setPressed(playButton, false);
    }

    function start() {
      if (reducedMotion || running) {
        return;
      }
      running = true;
      playButton.textContent = "Pause";
      setPressed(playButton, true);
      timer = window.setInterval(function () {
        if (!block.isConnected || document.visibilityState === "hidden") {
          stop();
          return;
        }
        step(false);
      }, 90);
      announce("Platformer simulation playing. Hold a direction and press Jump.");
    }

    function setHorizontal(value, active) {
      input.horizontal = active ? Number(value) : input.horizontal === Number(value) ? 0 : input.horizontal;
      if (active && !running) {
        step(true);
      }
    }

    stage.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        input.horizontal = -1;
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        input.horizontal = 1;
      } else if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        input.jump = true;
      } else {
        return;
      }
      if (!running) {
        step(true);
      }
    });
    stage.addEventListener("keyup", function (event) {
      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "a" ||
        event.key === "A" ||
        event.key === "d" ||
        event.key === "D"
      ) {
        input.horizontal = 0;
      }
    });
    [leftButton, rightButton].forEach(function (button) {
      button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        setHorizontal(button.dataset.platformDirection, true);
      });
      button.addEventListener("pointerup", function () {
        setHorizontal(button.dataset.platformDirection, false);
      });
      button.addEventListener("pointercancel", function () {
        setHorizontal(button.dataset.platformDirection, false);
      });
      button.addEventListener("click", function () {
        stage.focus();
      });
    });
    jumpButton.addEventListener("click", function () {
      input.jump = true;
      if (!running) {
        step(true);
      }
      stage.focus();
    });
    stepButton.addEventListener("click", function () { step(true); });
    playButton.addEventListener("click", function () {
      if (running) {
        stop();
        announce("Platformer simulation paused.");
      } else {
        start();
      }
    });
    resetButton.addEventListener("click", function () {
      stop();
      state = createPlatformerState();
      renderState(true);
      stage.focus();
    });
    fieldset.addEventListener("input", function (event) {
      var key = event.target.dataset.platformParameter;
      if (!key) {
        return;
      }
      var next = {
        gravity: parameters.gravity,
        jumpStrength: parameters.jumpStrength,
        moveSpeed: parameters.moveSpeed
      };
      next[key] = Number(event.target.value);
      parameters = normalizePlatformerParameters(next);
      var output = fieldset.querySelector(
        '[data-platform-parameter-output="' + key + '"]'
      );
      if (output) {
        output.value = String(parameters[key]);
        output.textContent = String(parameters[key]);
      }
      announce(
        key + " changed to " + parameters[key] +
        ". Predict the next frame before stepping."
      );
    });
    renderState(false);
    return block;
  }

  function renderSystemsLab(announce) {
    var state = createSystemsState();
    var block = el("section", "pygame-lab pygame-lab--systems");
    var heading = el("header", "pygame-lab__heading");
    var title = el("h3", null, "Lab 3 · Direct modes, spawns, and power-ups");
    var workspace = el("div", "pygame-lab__workspace");
    var visual = el("div", "pygame-lab__visual");
    var board = el("div", "pygame-systems");
    var modes = el("ol", "pygame-systems__modes");
    var controls = el("div", "pygame-lab__controls");
    var transport = el("div", "pygame-lab__transport");
    var startButton = el("button", "button button--primary", "Start run");
    var tickButton = el("button", "button button--quiet", "Advance 250 ms");
    var pauseButton = el("button", "button button--quiet", "Pause");
    var collectButton = el("button", "button button--quiet", "Collect power-up");
    var collisionButton = el("button", "button button--quiet", "Simulate collision");
    var restartButton = el("button", "button button--quiet", "Restart run");
    var resetButton = el("button", "button button--quiet", "Reset lab");
    var parameters = el("fieldset", "pygame-lab__parameters");
    var seedLabel = el("label");
    var seed = el("input");
    var seedOutput = el("output");
    var status = el("p", "pygame-lab__status");
    var inspector = el("aside", "pygame-lab__inspector");
    var outputs = {};
    var discoveries = {
      running: false,
      paused: false,
      power: false,
      expired: false,
      recovery: false
    };
    var discoveryList = renderDiscoveryList([
      { id: "systems-running", label: "Enter running through an explicit start event." },
      { id: "systems-paused", label: "Prove that a paused tick preserves gameplay timers." },
      { id: "systems-power", label: "Collect a power-up and move the deterministic spawn." },
      { id: "systems-expired", label: "Advance until the temporary boost expires at zero." },
      { id: "systems-recovery", label: "Recover from game-over through one restart transition." }
    ]);

    title.id = "pygame-systems-lab-title";
    block.setAttribute("aria-labelledby", title.id);
    block.dataset.pygameLab = "systems";
    heading.append(
      el("span", "eyebrow", "State machine → seeded spawn → timed effect"),
      title,
      el(
        "p",
        null,
        "Drive the same systems that make arcade gameplay recoverable. Each button is an event; illegal transitions leave state unchanged and explain why."
      )
    );

    board.setAttribute("role", "img");
    board.setAttribute(
      "aria-label",
      "Twelve-cell deterministic spawn board with three occupied cells and one power-up"
    );
    for (var index = 0; index < state.cellCount; index += 1) {
      var cell = el("span", "pygame-systems__cell");
      cell.dataset.systemsCell = String(index);
      cell.setAttribute("aria-hidden", "true");
      board.append(cell);
    }

    ["title", "running", "paused", "game-over"].forEach(function (modeName) {
      var item = el("li", null, modeName);
      item.dataset.systemsMode = modeName;
      modes.append(item);
    });
    visual.append(board, modes);

    [
      startButton,
      tickButton,
      pauseButton,
      collectButton,
      collisionButton,
      restartButton,
      resetButton
    ].forEach(function (button) {
      button.type = "button";
    });
    transport.append(
      startButton,
      tickButton,
      pauseButton,
      collectButton,
      collisionButton,
      restartButton,
      resetButton
    );

    seed.type = "range";
    seed.min = "0";
    seed.max = "20";
    seed.step = "1";
    seed.value = String(state.spawnSeed);
    seed.id = "pygame-systems-seed";
    seed.dataset.systemsSeed = "true";
    seedOutput.dataset.systemsSeedOutput = "true";
    seedLabel.htmlFor = seed.id;
    seedLabel.append(
      el("span", null, "Replay seed"),
      seedOutput,
      seed,
      el("small", null, "The same seed and occupied cells choose the same spawn.")
    );
    parameters.append(el("legend", null, "Deterministic input"), seedLabel);
    controls.append(transport, parameters);
    visual.append(controls, status);

    [
      ["mode", "Scene mode"],
      ["tick", "Gameplay tick"],
      ["score", "Score"],
      ["boost", "Boost remaining"],
      ["seed", "Spawn seed"],
      ["spawn", "Power-up cell"],
      ["transition", "Transition evidence"]
    ].forEach(function (definition) {
      var row = el("div", "pygame-lab__state-row");
      var output = el("output");
      if (definition[0] === "transition") {
        row.classList.add("pygame-lab__state-row--wide");
      }
      outputs[definition[0]] = output;
      row.append(el("span", null, definition[1]), output);
      inspector.append(row);
    });
    inspector.prepend(
      el("span", "eyebrow", "Systems inspector"),
      el("h4", null, "One event, one legal transition")
    );
    inspector.append(el("h4", null, "Studio checks"), discoveryList);
    workspace.append(visual, inspector);
    block.append(heading, workspace);

    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    function renderState(speak) {
      Array.prototype.forEach.call(board.children, function (cell, cellIndex) {
        cell.className = "pygame-systems__cell";
        cell.textContent = "";
        if (state.occupiedCells.indexOf(cellIndex) >= 0) {
          cell.classList.add("pygame-systems__cell--occupied");
        }
        if (state.spawnCell === cellIndex) {
          cell.classList.add("pygame-systems__cell--power");
          cell.textContent = "✦";
        }
      });
      Array.prototype.forEach.call(modes.children, function (item) {
        item.classList.toggle(
          "is-active",
          item.dataset.systemsMode === state.mode
        );
      });
      outputs.mode.value = state.mode;
      outputs.mode.textContent = state.mode;
      outputs.tick.value = String(state.tick);
      outputs.tick.textContent = String(state.tick);
      outputs.score.value = String(state.score);
      outputs.score.textContent = String(state.score);
      outputs.boost.value = state.boostRemainingMs + " ms";
      outputs.boost.textContent = state.boostRemainingMs + " ms";
      outputs.seed.value = String(state.spawnSeed);
      outputs.seed.textContent = String(state.spawnSeed);
      outputs.spawn.value = state.spawnCell === null ? "none free" : String(state.spawnCell);
      outputs.spawn.textContent = state.spawnCell === null ? "none free" : String(state.spawnCell);
      outputs.transition.value = state.lastTransition;
      outputs.transition.textContent = state.lastTransition;
      seedOutput.value = String(state.spawnSeed);
      seedOutput.textContent = String(state.spawnSeed);
      seed.value = String(Math.min(20, state.spawnSeed));
      status.textContent = (
        "Mode " + state.mode +
        ". Tick " + state.tick +
        ". Score " + state.score +
        ". Boost " + state.boostRemainingMs + " ms." +
        " Power-up cell " + (state.spawnCell === null ? "unavailable" : state.spawnCell) + "."
      );
      startButton.disabled = state.mode !== "title";
      tickButton.disabled = state.mode === "title" || state.mode === "game-over";
      pauseButton.disabled = state.mode === "title" || state.mode === "game-over";
      pauseButton.textContent = state.mode === "paused" ? "Resume" : "Pause";
      collectButton.disabled = state.mode !== "running";
      collisionButton.disabled = state.mode !== "running";
      restartButton.disabled = state.mode !== "game-over";
      Object.keys(discoveries).forEach(function (key) {
        if (discoveries[key]) {
          completeDiscovery(block, "systems-" + key);
        }
      });
      if (speak) {
        announce(status.textContent + " " + state.lastTransition);
      }
    }

    function apply(action, elapsedMs) {
      var previous = state;
      state = stepSystems(state, action, elapsedMs);
      discoveries.running = discoveries.running || state.mode === "running";
      discoveries.paused = discoveries.paused || (
        previous.mode === "paused" &&
        action === "tick" &&
        previous.tick === state.tick &&
        previous.boostRemainingMs === state.boostRemainingMs
      );
      discoveries.power = discoveries.power || (
        action === "collect" &&
        state.score > previous.score &&
        state.spawnCell !== previous.spawnCell
      );
      discoveries.expired = discoveries.expired || (
        previous.boostRemainingMs > 0 &&
        state.boostRemainingMs === 0
      );
      discoveries.recovery = discoveries.recovery || (
        previous.mode === "game-over" &&
        action === "restart" &&
        state.mode === "running"
      );
      renderState(true);
    }

    startButton.addEventListener("click", function () { apply("start"); });
    tickButton.addEventListener("click", function () { apply("tick", 250); });
    pauseButton.addEventListener("click", function () { apply("toggle-pause"); });
    collectButton.addEventListener("click", function () { apply("collect"); });
    collisionButton.addEventListener("click", function () { apply("collision"); });
    restartButton.addEventListener("click", function () { apply("restart"); });
    resetButton.addEventListener("click", function () {
      state = createSystemsState({ spawnSeed: Number(seed.value) });
      discoveries = {
        running: false,
        paused: false,
        power: false,
        expired: false,
        recovery: false
      };
      block.querySelectorAll(".pygame-lab__discoveries li").forEach(function (item) {
        item.classList.remove("is-complete");
        var mark = item.querySelector(".pygame-lab__discovery-mark");
        if (mark) {
          mark.textContent = "○";
        }
      });
      renderState(true);
    });
    seed.addEventListener("input", function () {
      state = createSystemsState({ spawnSeed: Number(seed.value) });
      renderState(true);
    });

    renderState(false);
    return block;
  }

  function create(options) {
    var settings = options || {};
    var announce = typeof settings.announce === "function"
      ? settings.announce
      : function () {};

    return Object.freeze({
      renderFrameTracer: function (_chapter, lab) {
        return renderFrameTracer(lab, announce);
      },
      render: function () {
        var root = el("div", "pygame-labs");
        var intro = el("aside", "pygame-labs__intro");
        intro.append(
          el("span", "eyebrow", "Interactive Pygame studio"),
          el("h3", null, "One loop, two game genres"),
          el(
            "p",
            null,
            "These browser models mirror the reasoning used in Pygame without giving away an exercise solution. Predict a frame, manipulate the state, and then transfer the model into Python."
          ),
          renderLoopLegend()
        );
        root.append(
          intro,
          renderSnakeLab(announce),
          renderPlatformerLab(announce),
          renderSystemsLab(announce)
        );
        return root;
      }
    });
  }

  window.PYGAME_LABS = Object.freeze({
    create: create,
    chooseDeterministicSpawn: chooseDeterministicSpawn,
    createPlatformerState: createPlatformerState,
    createSnakeState: createSnakeState,
    createSystemsState: createSystemsState,
    normalizePlatformerParameters: normalizePlatformerParameters,
    queueSnakeDirection: queueSnakeDirection,
    stepPlatformer: stepPlatformer,
    stepSnake: stepSnake,
    stepSystems: stepSystems
  });
})();
