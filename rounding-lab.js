(function () {
  "use strict";

  function requireModel(model) {
    if (
      !model ||
      typeof model.compare !== "function" ||
      typeof model.format !== "function"
    ) {
      throw new TypeError("The rounding lab requires a comparison model.");
    }
    return model;
  }

  function requireFinite(value, label) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      throw new TypeError((label || "Value") + " must be a finite number.");
    }
    return number;
  }

  function finiteOr(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeBounds(minimum, maximum) {
    var min = finiteOr(minimum, -5);
    var max = finiteOr(maximum, 5);
    if (min > max) {
      return Object.freeze({ min: max, max: min });
    }
    return Object.freeze({ min: min, max: max });
  }

  function format(model, value) {
    return String(model.format(value));
  }

  function getObservation(model, comparison) {
    if (comparison.floor === comparison.ceil) {
      return "This value is already an integer, so floor, ceil, round, and int all preserve it.";
    }
    if (comparison.value - comparison.floor === 0.5) {
      return (
        "The value is exactly halfway. Python round chooses the even neighbour, " +
        format(model, comparison.round) +
        ", while floor and ceil still follow their fixed directions."
      );
    }
    if (comparison.value < 0) {
      return (
        "On the negative side, the lower boundary is more negative. Floor moves left to " +
        format(model, comparison.floor) +
        "; ceil and int move right toward " +
        format(model, comparison.ceil) +
        "."
      );
    }
    return (
      "For this positive value, floor and int agree at " +
      format(model, comparison.floor) +
      ", while ceil reserves the next whole unit at " +
      format(model, comparison.ceil) +
      ". Their agreement is not a rule for negative values."
    );
  }

  function deriveState(model, rawValue, minimum, maximum) {
    var comparisonModel = requireModel(model);
    var bounds = normalizeBounds(minimum, maximum);
    var requestedValue = requireFinite(rawValue, "Rounding lab value");
    var value = Math.min(bounds.max, Math.max(bounds.min, requestedValue));
    var comparison = comparisonModel.compare(value);
    var isInteger = comparison.floor === comparison.ceil;
    var axisMin = isInteger ? comparison.floor - 2 : comparison.floor - 1;
    var axisMax = isInteger ? comparison.ceil + 2 : comparison.ceil + 1;
    var axisSpan = Math.max(axisMax - axisMin, 1);
    var ticks = [];

    for (var tickValue = axisMin; tickValue <= axisMax; tickValue += 1) {
      ticks.push(
        Object.freeze({
          value: tickValue,
          left: (tickValue - axisMin) / axisSpan * 100
        })
      );
    }

    var displayValue = format(comparisonModel, value);
    var summary =
      "For " +
      displayValue +
      ": floor " +
      format(comparisonModel, comparison.floor) +
      ", round " +
      format(comparisonModel, comparison.round) +
      ", ceiling " +
      format(comparisonModel, comparison.ceil) +
      ", and truncation " +
      format(comparisonModel, comparison.trunc) +
      ".";

    return Object.freeze({
      value: value,
      displayValue: displayValue,
      min: bounds.min,
      max: bounds.max,
      comparison: comparison,
      isInteger: isInteger,
      axis: Object.freeze({
        min: axisMin,
        max: axisMax,
        span: axisSpan,
        ticks: Object.freeze(ticks),
        valueLeft: (value - axisMin) / axisSpan * 100,
        floorLeft: (comparison.floor - axisMin) / axisSpan * 100,
        ceilLeft: (comparison.ceil - axisMin) / axisSpan * 100
      }),
      observation: getObservation(comparisonModel, comparison),
      summary: summary
    });
  }

  function domId(value) {
    return String(value || "chapter")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function el(tagName, className, textContent) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent !== undefined && textContent !== null) {
      element.textContent = String(textContent);
    }
    return element;
  }

  function create(options) {
    var settings = options || {};
    var model = requireModel(settings.model);
    var announce = typeof settings.announce === "function" ? settings.announce : function () {};

    function render(chapter, labConfig) {
      var lab = labConfig || {};
      var chapterId = domId(chapter && chapter.id);
      var block = el("section", "rounding-lab");
      var headingId = "rounding-lab-" + chapterId;
      var heading = el("header", "deep-dive-heading rounding-lab__heading");
      var headingTitle = el("h3", null, lab.title || "Move across the number line");
      var intro = el(
        "p",
        "rounding-lab__intro",
        lab.description || "Compare several ways to turn one measurement into a whole number."
      );
      var scenarios = Array.isArray(lab.scenarios) ? lab.scenarios : [];
      var rules = Array.isArray(lab.rules) ? lab.rules : [];
      var invariants = Array.isArray(lab.invariants) ? lab.invariants : [];
      var bounds = normalizeBounds(lab.min, lab.max);
      var defaultValue = finiteOr(lab.defaultValue, -2.3);
      var scenarioControls = [];
      var resultOutputs = {};
      var currentState;

      headingTitle.id = headingId;
      heading.append(el("span", "eyebrow", "Interactive boundary lab"), headingTitle);
      block.dataset.roundingLab = String((chapter && chapter.id) || "chapter");
      block.setAttribute("aria-labelledby", headingId);
      block.append(heading, intro);

      if (scenarios.length) {
        var scenarioList = el("div", "rounding-lab__scenarios");
        scenarioList.setAttribute("role", "group");
        scenarioList.setAttribute("aria-label", "Suggested values to explore");
        scenarios.forEach(function (scenario) {
          if (!scenario || !Number.isFinite(Number(scenario.value))) {
            return;
          }
          var scenarioValue = Number(scenario.value);
          var button = el("button", "rounding-lab__scenario");
          button.type = "button";
          button.dataset.roundingScenario = String(scenarioValue);
          button.append(
            el("strong", null, scenario.label || String(scenarioValue)),
            el("span", null, scenario.note || "Compare the four results.")
          );
          button.setAttribute("aria-pressed", "false");
          scenarioControls.push({ button: button, value: scenarioValue });
          scenarioList.append(button);
        });
        block.append(scenarioList);
      }

      var workspace = el("div", "rounding-lab__workspace");
      var explorer = el("div", "rounding-lab__explorer");
      var controlRow = el("div", "rounding-lab__controls");
      var rangeGroup = el("label", "rounding-lab__range");
      var rangeId = "rounding-range-" + chapterId;
      var range = el("input");
      range.id = rangeId;
      range.type = "range";
      range.min = String(bounds.min);
      range.max = String(bounds.max);
      range.step = "any";
      range.dataset.roundingLabInput = "range";
      rangeGroup.htmlFor = rangeId;
      rangeGroup.append(el("span", null, "Move the value"), range);

      var numberGroup = el("label", "rounding-lab__number");
      var numberId = "rounding-number-" + chapterId;
      var number = el("input");
      number.id = numberId;
      number.type = "number";
      number.min = String(bounds.min);
      number.max = String(bounds.max);
      number.step = "any";
      number.inputMode = "decimal";
      number.dataset.roundingLabInput = "number";
      numberGroup.htmlFor = numberId;
      numberGroup.append(el("span", null, "Exact value"), number);
      controlRow.append(rangeGroup, numberGroup);

      var axis = el("div", "rounding-lab__axis");
      var ticks = el("div", "rounding-lab__ticks");
      var floorMarker = el("span", "rounding-lab__bound rounding-lab__bound--floor");
      var ceilMarker = el("span", "rounding-lab__bound rounding-lab__bound--ceil");
      var valueMarker = el("span", "rounding-lab__value-marker");
      ticks.dataset.roundingTicks = "true";
      floorMarker.dataset.roundingMarker = "floor";
      ceilMarker.dataset.roundingMarker = "ceil";
      valueMarker.dataset.roundingMarker = "value";
      axis.setAttribute("aria-hidden", "true");
      axis.append(ticks, floorMarker, ceilMarker, valueMarker);

      var observation = el("p", "rounding-lab__observation");
      var observationId = "rounding-observation-" + chapterId;
      observation.id = observationId;
      observation.dataset.roundingObservation = "true";
      range.setAttribute("aria-describedby", observationId);
      number.setAttribute("aria-describedby", observationId);
      explorer.append(controlRow, axis, observation);

      var resultPanel = el("section", "rounding-lab__results");
      resultPanel.append(
        el("span", "eyebrow", "Python results"),
        el("h4", null, "Same value, different promise")
      );
      var resultGrid = el("div", "rounding-lab__result-grid");
      [
        ["floor", "Lower boundary", "math.floor(value)", "greatest integer ≤ value"],
        ["round", "Nearest integer", "round(value)", "ties choose the even candidate"],
        ["ceil", "Upper boundary", "math.ceil(value)", "least integer ≥ value"],
        ["trunc", "Toward zero", "int(value)", "same direction as math.trunc(value)"]
      ].forEach(function (operation) {
        var card = el("div", "rounding-lab__result rounding-lab__result--" + operation[0]);
        var output = el("output", "rounding-lab__result-value", "0");
        output.dataset.roundingResult = operation[0];
        output.setAttribute("for", rangeId + " " + numberId);
        resultOutputs[operation[0]] = output;
        card.append(
          el("span", "rounding-lab__result-label", operation[1]),
          el("code", null, operation[2]),
          output,
          el("small", null, operation[3])
        );
        resultGrid.append(card);
      });
      resultPanel.append(resultGrid);
      workspace.append(explorer, resultPanel);
      block.append(workspace);

      if (invariants.length) {
        var invariantPanel = el("section", "rounding-lab__invariants");
        var invariantList = el("ul");
        invariantPanel.append(
          el("span", "eyebrow", "Properties to verify"),
          el("h4", null, "Statements that stay true")
        );
        invariants.forEach(function (invariant) {
          invariantList.append(el("li", null, invariant));
        });
        invariantPanel.append(invariantList);
        block.append(invariantPanel);
      }

      if (rules.length) {
        var decision = el("section", "rounding-lab__decision");
        var decisionGrid = el("ul", "rounding-lab__decision-grid");
        decision.append(
          el("span", "eyebrow", "Choose by intent"),
          el("h4", null, "Start with the guarantee, then select the operation")
        );
        rules.forEach(function (rule) {
          if (!rule) {
            return;
          }
          var item = el("li");
          item.append(
            el("strong", null, rule.intent || "Required behaviour"),
            el("code", null, rule.operation || ""),
            el("p", null, rule.reason || "")
          );
          decisionGrid.append(item);
        });
        decision.append(decisionGrid);
        block.append(decision);
      }

      function update(rawValue, shouldAnnounce) {
        var nextState;
        try {
          nextState = deriveState(model, rawValue, bounds.min, bounds.max);
        } catch (error) {
          return false;
        }
        currentState = nextState;
        range.value = String(nextState.value);
        number.value = nextState.displayValue;
        block.dataset.roundingValue = nextState.displayValue;

        scenarioControls.forEach(function (scenarioControl) {
          var selected = scenarioControl.value === nextState.value;
          scenarioControl.button.classList.toggle("is-selected", selected);
          scenarioControl.button.setAttribute("aria-pressed", String(selected));
        });

        ticks.replaceChildren();
        nextState.axis.ticks.forEach(function (tickState) {
          var tick = el("span", "rounding-lab__tick", String(tickState.value));
          tick.style.left = tickState.left + "%";
          ticks.append(tick);
        });

        valueMarker.style.left = nextState.axis.valueLeft + "%";
        valueMarker.textContent = nextState.displayValue;
        floorMarker.style.left = nextState.axis.floorLeft + "%";
        floorMarker.textContent = nextState.isInteger
          ? "floor = ceil = " + format(model, nextState.comparison.floor)
          : "floor " + format(model, nextState.comparison.floor);
        ceilMarker.hidden = nextState.isInteger;
        ceilMarker.style.left = nextState.axis.ceilLeft + "%";
        ceilMarker.textContent = "ceil " + format(model, nextState.comparison.ceil);

        ["floor", "round", "ceil", "trunc"].forEach(function (operation) {
          resultOutputs[operation].textContent = format(model, nextState.comparison[operation]);
        });
        observation.textContent = nextState.observation;

        if (shouldAnnounce) {
          announce(nextState.summary);
        }
        return true;
      }

      block.addEventListener("click", function (event) {
        var target = event.target;
        var button =
          target && typeof target.closest === "function"
            ? target.closest("button[data-rounding-scenario]")
            : null;
        if (button && block.contains(button)) {
          update(Number(button.dataset.roundingScenario), true);
        }
      });

      block.addEventListener("input", function (event) {
        var control = event.target;
        if (
          control &&
          control.matches("input[data-rounding-lab-input]") &&
          Number.isFinite(control.valueAsNumber)
        ) {
          update(control.valueAsNumber, false);
        }
      });

      block.addEventListener("change", function (event) {
        var control = event.target;
        if (!control || !control.matches("input[data-rounding-lab-input]")) {
          return;
        }
        if (Number.isFinite(control.valueAsNumber)) {
          update(control.valueAsNumber, true);
        } else if (currentState) {
          update(currentState.value, false);
        }
      });

      update(defaultValue, false);
      return block;
    }

    return Object.freeze({
      render: render
    });
  }

  window.ROUNDING_LAB = Object.freeze({
    create: create,
    deriveState: deriveState
  });
})();
