(function () {
  "use strict";

  function asCount(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function el(tagName, className) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    return element;
  }

  function normalizedGroups(ambience) {
    var source = ambience && typeof ambience === "object" ? ambience : {};
    return (Array.isArray(source.groups) ? source.groups : [])
      .filter(function (group) {
        return group && ["green", "blue", "yellow"].includes(group.tone);
      })
      .map(function (group) {
        return {
          id: String(group.id || group.tone),
          tone: String(group.tone),
          count: Math.min(asCount(group.count), asCount(group.total) || asCount(group.count)),
          total: asCount(group.total),
        };
      });
  }

  function renderSnake(tone, index, globalIndex) {
    var snake = el(
      "span",
      "progress-snake__unit progress-snake__unit--" + tone
    );
    var body = el("span", "progress-snake__body");
    var head = el("span", "progress-snake__head");
    var segmentCount = 3 + (globalIndex % 3);

    for (var segment = 0; segment < segmentCount; segment += 1) {
      body.append(el("i", "progress-snake__segment"));
    }
    snake.style.left = 4 + ((globalIndex * 19 + index * 7) % 83) + "%";
    snake.style.top = 8 + ((globalIndex * 31 + index * 11) % 72) + "%";
    snake.style.setProperty("--progress-snake-delay", -(globalIndex * 0.73) + "s");
    snake.style.setProperty("--progress-snake-duration", 8 + (globalIndex % 6) * 1.25 + "s");
    snake.append(body, head);
    return snake;
  }

  function render(ambience, options) {
    var settings = options && typeof options === "object" ? options : {};
    var variant = /^[a-z0-9-]+$/u.test(String(settings.variant || ""))
      ? String(settings.variant)
      : "course";
    var groups = normalizedGroups(ambience);
    var earned = groups.reduce(function (total, group) {
      return total + group.count;
    }, 0);

    if (!earned) {
      return null;
    }

    var layer = el("div", "progress-snake progress-snake--" + variant);
    var globalIndex = 0;
    layer.dataset.progressSnake = variant;
    layer.dataset.greenSnakes = String(
      (groups.find(function (group) { return group.tone === "green"; }) || {}).count || 0
    );
    layer.dataset.blueSnakes = String(
      (groups.find(function (group) { return group.tone === "blue"; }) || {}).count || 0
    );
    layer.dataset.yellowSnakes = String(
      (groups.find(function (group) { return group.tone === "yellow"; }) || {}).count || 0
    );
    layer.dataset.snakeTotal = String(earned);
    layer.setAttribute("aria-hidden", "true");

    groups.forEach(function (group) {
      for (var index = 0; index < group.count; index += 1) {
        layer.append(renderSnake(group.tone, index, globalIndex));
        globalIndex += 1;
      }
    });
    return layer;
  }

  window.PROGRESS_SNAKE_VIEW = Object.freeze({
    render: render,
  });
})();
