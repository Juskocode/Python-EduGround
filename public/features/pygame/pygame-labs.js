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
      food: point(state.food.x, state.food.y),
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
    if (!state || !DIRECTIONS[direction] || state.status === "collision") {
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
    return { x: 0, y: 0 };
  }

  function stepSnake(state, options) {
    if (!state || state.status === "collision") {
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
    return freezeSnakeState({
      width: state.width,
      height: state.height,
      snake: movedSnake,
      food: ate ? nextFood(state.width, state.height, movedSnake, nextTick) : state.food,
      direction: direction,
      queuedDirection: direction,
      wrap: wrap,
      tick: nextTick,
      score: state.score + (ate ? 1 : 0),
      status: ate ? "ate" : "moving",
      lastEvent: "Handled " + direction + " from the event queue.",
      lastUpdate: ate
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
      var foodCell = cells[state.food.y * state.width + state.food.x];
      if (foodCell) {
        foodCell.classList.add("pygame-snake__cell--food");
      }
      eventOutput.value = state.lastEvent;
      eventOutput.textContent = state.lastEvent;
      updateOutput.value = state.lastUpdate;
      updateOutput.textContent = state.lastUpdate;
      var drawText = (
        "Drew " + state.snake.length + " snake segments and one food item."
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
      if (state.status === "collision") {
        stop();
      }
    }

    function start() {
      if (reducedMotion || running || state.status === "collision") {
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
        "Use A/D or Arrow keys to move and Space to jump. Change one physics value, predict the effect, then compare the state inspector."
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
      ["y", "World y"],
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
        ". World position " + state.x.toFixed(1) + ", " + state.y.toFixed(1) +
        ". Vertical velocity " + state.vy.toFixed(1) +
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

  function create(options) {
    var settings = options || {};
    var announce = typeof settings.announce === "function"
      ? settings.announce
      : function () {};

    return Object.freeze({
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
        root.append(intro, renderSnakeLab(announce), renderPlatformerLab(announce));
        return root;
      }
    });
  }

  window.PYGAME_LABS = Object.freeze({
    create: create,
    createPlatformerState: createPlatformerState,
    createSnakeState: createSnakeState,
    normalizePlatformerParameters: normalizePlatformerParameters,
    queueSnakeDirection: queueSnakeDirection,
    stepPlatformer: stepPlatformer,
    stepSnake: stepSnake
  });
})();
