(function () {
  "use strict";

  var progressSnakeView = window.PROGRESS_SNAKE_VIEW || null;

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

  function link(href, className, textContent) {
    var element = el("a", className, textContent);
    element.href = href;
    return element;
  }

  function pad(value) {
    return String(Number(value) || 0).padStart(2, "0");
  }

  function render(model) {
    var safeModel = model && typeof model === "object" ? model : {};
    var wrapper = el("div", "page-shell landing-page");
    wrapper.append(
      renderHero(safeModel),
      renderSnakeDialog(),
      renderLearningLoop(),
      renderStagePreview(safeModel.stages),
      renderTrustStrip(safeModel)
    );
    return wrapper;
  }

  function renderHero(model) {
    var section = el("section", "landing-hero landing-hero--calm");
    var copy = el("div", "landing-hero__copy");
    var demo = el("div", "landing-hero__demo");
    var metrics = getHeroMetrics(model);
    var title = el("h1", null, "Learn Python by understanding what every line does.");
    var actions = el("div", "landing-hero__actions");
    var resume = model.resume || {};
    var primaryLabel = resume.kind === "achievement"
      ? "Review your achievements"
      : resume.action || "Start learning";

    title.id = "landing-title";
    section.setAttribute("aria-labelledby", title.id);
    section.append(renderHeroGeometry(metrics));
    copy.append(
      el("p", "eyebrow", "A complete browser-based Python class"),
      title,
      el(
        "p",
        "landing-hero__lede",
        "Begin with input(), variables, and exact output. Build through algorithms and dynamic programming, then turn those skills into a playable Snake and a 2D platformer."
      )
    );
    actions.append(
      link(resume.href || "#chapter/py01/tutorials", "button button--primary", primaryLabel),
      link("#home", "button button--quiet", "Explore the roadmap")
    );
    copy.append(actions, renderHeroMetrics(metrics));
    demo.append(renderTerminalPreview(), renderSnakeLauncher());
    section.append(copy, demo);
    if (progressSnakeView && typeof progressSnakeView.render === "function") {
      var ambience = progressSnakeView.render(model.snakeAmbience, {
        variant: "landing",
      });
      if (ambience) {
        section.append(ambience);
      }
    }
    return section;
  }

  function renderHeroGeometry(metrics) {
    var geometry = el("div", "landing-hero__geometry");
    geometry.dataset.geoMotion = "hero-orbits";
    geometry.setAttribute("aria-hidden", "true");
    geometry.append(
      el("span", "landing-hero__orbit landing-hero__orbit--outer"),
      el("span", "landing-hero__orbit landing-hero__orbit--inner"),
      el("span", "landing-hero__axis landing-hero__axis--x"),
      el("span", "landing-hero__axis landing-hero__axis--y"),
      el("span", "landing-hero__node landing-hero__node--one"),
      el("span", "landing-hero__node landing-hero__node--two"),
      el("span", "landing-hero__node landing-hero__node--three"),
      el("span", "landing-hero__node landing-hero__node--four"),
      el(
        "span",
        "landing-hero__coordinates",
        "PY / " + metrics.chapters + " · " + metrics.stages + " · " + metrics.exercises
      )
    );
    return geometry;
  }

  function getHeroMetrics(model) {
    var stages = Array.isArray(model.stages) ? model.stages : [];
    var chapterCount = stages.reduce(function (total, stage) {
      return total + (Array.isArray(stage.chapters) ? stage.chapters.length : 0);
    }, 0);
    var exerciseMilestone = (Array.isArray(model.milestones) ? model.milestones : []).find(function (item) {
      return item.label === "Exercises";
    });
    var exerciseTotal = exerciseMilestone
      ? String(exerciseMilestone.value).split("/").pop().trim()
      : "0";
    return {
      chapters: chapterCount,
      stages: stages.length,
      exercises: exerciseTotal
    };
  }

  function renderHeroMetrics(metrics) {
    var list = el("ul", "landing-hero__metrics");
    [
      [metrics.chapters, "chapters"],
      [metrics.stages, "learning stages"],
      [metrics.exercises, "exercise suites"],
    ].forEach(function (metric) {
      var item = el("li");
      item.append(el("strong", null, metric[0]), el("span", null, metric[1]));
      list.append(item);
    });
    return list;
  }

  function renderTerminalPreview() {
    var visual = el("div", "landing-terminal");
    var chrome = el("div", "landing-terminal__chrome");
    var dots = el("span", "landing-terminal__dots");
    var code = el("div", "landing-terminal__code");
    var output = el("div", "landing-terminal__output");
    visual.setAttribute("aria-hidden", "true");
    visual.dataset.geoMotion = "code-console";
    dots.append(el("i"), el("i"), el("i"));
    chrome.append(dots, el("span", null, "first_steps.py"), el("span", null, "Python 3"));
    [
      ["1", "raw_count = input()"],
      ["2", "count = int(raw_count)"],
      ["3", "next_count = count + 1"],
      ["4", "print(next_count)"],
    ].forEach(function (line, index) {
      var row = el("span", "landing-terminal__line");
      row.style.setProperty("--line-delay", index * 110 + "ms");
      row.append(el("b", null, line[0]), el("code", null, line[1]));
      code.append(row);
    });
    output.append(
      el("span", null, "Program input"),
      el("code", null, "4"),
      el("span", null, "Terminal"),
      el("code", "landing-terminal__result", "5")
    );
    visual.append(chrome, code, output);
    return visual;
  }

  function renderSnakeLauncher() {
    var launcher = el("button", "landing-snake-launcher");
    var visual = el("span", "landing-snake-launcher__visual");
    var body = el("span", "landing-snake-launcher__body");
    var copy = el("span", "landing-snake-launcher__copy");
    launcher.type = "button";
    launcher.dataset.snakeLaunch = "";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-controls", "landing-snake-dialog");
    launcher.setAttribute("aria-expanded", "false");
    [
      "landing-snake-launcher__segment--one",
      "landing-snake-launcher__segment--two",
      "landing-snake-launcher__segment--three",
      "landing-snake-launcher__segment--four",
    ].forEach(function (className) {
      body.append(el("i", "landing-snake-launcher__segment " + className));
    });
    visual.setAttribute("aria-hidden", "true");
    visual.append(
      body,
      el("span", "landing-snake-launcher__head", "PY"),
      el("span", "landing-snake-launcher__core", "✦")
    );
    copy.append(
      el("small", null, "Optional playable preview"),
      el("strong", null, "Launch Python Snake")
    );
    launcher.append(
      visual,
      copy,
      el("span", "landing-snake-launcher__action", "Play ↗")
    );
    return launcher;
  }

  function svgEl(tagName, className) {
    var element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    if (className) {
      element.setAttribute("class", className);
    }
    return element;
  }

  function svgAttributes(element, attributes) {
    Object.keys(attributes).forEach(function (name) {
      element.setAttribute(name, String(attributes[name]));
    });
    return element;
  }

  function renderSnakeBoard() {
    var svg = svgAttributes(svgEl("svg", "landing-snake__board"), {
      viewBox: "0 0 24 14",
      preserveAspectRatio: "xMidYMid meet",
      "aria-hidden": "true",
      focusable: "false",
      "data-snake-board": "",
    });
    var defs = svgEl("defs");
    var pattern = svgAttributes(svgEl("pattern"), {
      id: "landing-snake-grid",
      width: 1,
      height: 1,
      patternUnits: "userSpaceOnUse",
    });
    pattern.append(
      svgAttributes(svgEl("path"), {
        d: "M 1 0 L 0 0 0 1",
        fill: "none",
        "stroke-width": 0.035,
      })
    );
    defs.append(pattern);
    var background = svgAttributes(svgEl("rect", "landing-snake__space"), {
      width: 24,
      height: 14,
      rx: 0.55,
    });
    var grid = svgAttributes(svgEl("rect", "landing-snake__grid"), {
      width: 24,
      height: 14,
      rx: 0.55,
      fill: "url(#landing-snake-grid)",
    });
    var stars = svgEl("g", "landing-snake__stars");
    [
      [1.3, 1.4, 0.05], [2.7, 5.2, 0.035], [4.9, 12.4, 0.055],
      [6.2, 3.4, 0.04], [7.8, 10.7, 0.04], [9.5, 1.1, 0.055],
      [11.2, 6.1, 0.035], [12.6, 12.5, 0.045], [14.4, 1.7, 0.035],
      [16.1, 6.7, 0.05], [18.2, 11.1, 0.04], [19.6, 1.2, 0.05],
      [22.3, 3.4, 0.04], [23.1, 8.5, 0.055], [1.8, 9.8, 0.035],
      [5.5, 7.2, 0.03], [8.6, 5.1, 0.04], [11.8, 9.2, 0.035],
    ].forEach(function (star) {
      stars.append(svgAttributes(svgEl("circle"), {
        cx: star[0],
        cy: star[1],
        r: star[2],
      }));
    });
    svg.append(
      defs,
      background,
      grid,
      stars,
      svgAttributes(svgEl("g"), { "data-snake-falling-star-layer": "" }),
      svgAttributes(svgEl("g"), { "data-snake-asteroid-layer": "" }),
      svgAttributes(svgEl("g"), { "data-snake-energy-layer": "" }),
      svgAttributes(svgEl("g"), { "data-snake-powerup-layer": "" }),
      svgAttributes(svgEl("g"), { "data-snake-echo-layer": "" }),
      svgAttributes(svgEl("g"), { "data-snake-segment-layer": "" })
    );
    return svg;
  }

  function snakeControl(label, className, dataName, dataValue) {
    var button = el("button", className, label);
    button.type = "button";
    if (dataName) {
      button.dataset[dataName] = dataValue;
    }
    return button;
  }

  function renderSnakeArcade() {
    var arcade = el("section", "landing-snake");
    var heading = el("header", "landing-snake__heading");
    var headingCopy = el("div");
    var title = el("h2", null, "snake.py // orbital loop");
    var description = el("p", null, "Reach 1000 by collecting cores. Fast routes build a score chain; splitting creates a safe escape but resets the chain.");
    var hud = el("dl", "landing-snake__hud");
    var mission = el("section", "landing-snake__mission");
    var missionCopy = el("div", "landing-snake__mission-copy");
    var missionMeta = el("div", "landing-snake__mission-meta");
    var missionProgress = el("progress", "landing-snake__progress");
    var playfield = el("div", "landing-snake__playfield");
    var overlay = el("p", "landing-snake__overlay", "Press Start, Enter, or a direction");
    var controls = el("div", "landing-snake__controls");
    var actions = el("div", "landing-snake__actions");
    var dpad = el("div", "landing-snake__dpad");
    var instructions = el("p", "landing-snake__instructions");
    var liveStatus = el("p", "visually-hidden");

    arcade.dataset.landingSnake = "";
    arcade.dataset.geoMotion = "snake-arcade";
    title.id = "landing-snake-title";
    description.id = "landing-snake-dialog-description";
    arcade.setAttribute("aria-labelledby", title.id);
    headingCopy.append(
      el("p", "eyebrow", "Playable Python preview"),
      title,
      description
    );
    [
      ["Score", "0000 / 1000", "snakeScore"],
      ["Chain", "Ready", "snakeCombo"],
      ["Splits", "3 / 3", "snakeSplits"],
      ["Status", "Ready", "snakePhaseLabel"],
    ].forEach(function (metric) {
      var group = el("div");
      var value = el("dd", null, metric[1]);
      value.dataset[metric[2]] = "";
      group.append(el("dt", null, metric[0]), value);
      hud.append(group);
    });
    heading.append(headingCopy, hud);

    mission.setAttribute("aria-label", "Mission objective and power-up status");
    missionProgress.max = 1000;
    missionProgress.value = 0;
    missionProgress.dataset.snakeProgress = "";
    missionProgress.setAttribute("aria-label", "Mission progress");
    var best = el("output", null, "0000");
    best.dataset.snakeBest = "";
    var pickup = el("span", null, "next pickup in 24 moves");
    pickup.dataset.snakePowerupStatus = "";
    var effect = el("span", null, "No active effect");
    effect.dataset.snakeEffectStatus = "";
    missionCopy.append(
      el("span", "landing-snake__mission-kicker", "Mission 01"),
      el("strong", null, "Collect cores · reach 1000")
    );
    missionMeta.append(
      el("span", null, "Best "),
      best,
      pickup,
      effect
    );
    mission.append(missionCopy, missionProgress, missionMeta);

    playfield.tabIndex = 0;
    playfield.dataset.snakePlayfield = "";
    playfield.setAttribute("role", "group");
    playfield.setAttribute("aria-describedby", "landing-snake-instructions");
    playfield.setAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowRight ArrowDown ArrowLeft W A S D Space P X R"
    );
    playfield.append(renderSnakeBoard(), overlay);
    overlay.dataset.snakeOverlay = "";

    var toggle = snakeControl("Start mission", "button button--primary", "snakeAction", "toggle");
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-keyshortcuts", "Space P");
    var split = snakeControl("Split trail · 3", "button button--quiet", "snakeAction", "split");
    split.setAttribute("aria-keyshortcuts", "X");
    var restart = snakeControl("Restart", "button button--quiet", "snakeAction", "restart");
    restart.setAttribute("aria-keyshortcuts", "R");
    var describe = snakeControl("Describe field", "button button--quiet", "snakeAction", "describe");
    actions.append(toggle, split, restart, describe);

    [
      ["↑", "up", "Steer up"],
      ["←", "left", "Steer left"],
      ["↓", "down", "Steer down"],
      ["→", "right", "Steer right"],
    ].forEach(function (control) {
      var button = snakeControl(control[0], "landing-snake__direction", "snakeDirection", control[1]);
      button.setAttribute("aria-label", control[2]);
      dpad.append(button);
    });
    dpad.setAttribute("aria-label", "Touch steering controls");
    dpad.setAttribute("role", "group");

    instructions.id = "landing-snake-instructions";
    instructions.append(
      el("strong", null, "Arrow keys / WASD"),
      document.createTextNode(" or swipe steer · "),
      el("strong", null, "Space / P"),
      document.createTextNode(" pauses · "),
      el("strong", null, "X"),
      document.createTextNode(" splits · "),
      el("strong", null, "R"),
      document.createTextNode(" restarts")
    );
    liveStatus.dataset.snakeAnnouncement = "";
    liveStatus.setAttribute("role", "status");
    liveStatus.setAttribute("aria-live", "polite");
    liveStatus.setAttribute("aria-atomic", "true");
    controls.append(actions, dpad);
    arcade.append(heading, mission, playfield, controls, instructions, liveStatus);
    return arcade;
  }

  function renderSnakeDialog() {
    var dialog = el("dialog", "landing-snake-dialog");
    var frame = el("div", "landing-snake-dialog__frame");
    var topbar = el("header", "landing-snake-dialog__topbar");
    var close = el("button", "landing-snake-dialog__close", "×");
    var topbarCopy = el("div");

    dialog.id = "landing-snake-dialog";
    dialog.dataset.snakeDialog = "";
    dialog.setAttribute("aria-labelledby", "landing-snake-title");
    dialog.setAttribute("aria-describedby", "landing-snake-dialog-description");
    close.type = "button";
    close.dataset.snakeClose = "";
    close.setAttribute("aria-label", "Close Python Snake");
    topbarCopy.append(
      el("span", "eyebrow", "Python logic lab"),
      el("strong", null, "Optional arcade")
    );
    topbar.append(topbarCopy, close);
    frame.append(topbar, renderSnakeArcade());
    dialog.append(frame);
    return dialog;
  }

  function renderLearningLoop() {
    var section = el("section", "landing-loop");
    var heading = el("header", "landing-section-heading");
    var list = el("ol");
    section.setAttribute("aria-labelledby", "landing-loop-title");
    heading.append(
      el("p", "eyebrow", "How the course works"),
      el("h2", null, "Read the model. Run the idea. Prove the skill."),
      el("p", null, "Every chapter separates teaching from the graded exercise, so you learn the reasoning without being handed the repository solution.")
    );
    heading.querySelector("h2").id = "landing-loop-title";
    [
      {
        mark: "01",
        title: "Understand",
        body: "Follow class notes, guided room questions, worked traces, and official Python references.",
        detail: "Beginner-first explanations",
      },
      {
        mark: "02",
        title: "Experiment",
        body: "Edit every classroom example, change its sample input, and inspect stdout or the complete traceback.",
        detail: "Real Python in the browser",
      },
      {
        mark: "03",
        title: "Prove",
        body: "Solve in the full IDE, pass visible and hidden cases, then finish each stage with timed theory and practical rooms.",
        detail: "Tests + timed checkpoints",
      },
    ].forEach(function (step) {
      var item = el("li");
      item.append(
        el("span", "landing-loop__mark", step.mark),
        el("h3", null, step.title),
        el("p", null, step.body),
        el("small", null, step.detail)
      );
      list.append(item);
    });
    section.append(heading, list);
    return section;
  }

  function renderStagePreview(stages) {
    var section = el("section", "landing-stages");
    var heading = el("header", "landing-section-heading landing-section-heading--row");
    var stageList = el("ol", "landing-stage-grid");
    var safeStages = Array.isArray(stages) ? stages : [];
    var assessedStageCount = safeStages.filter(function (stage) {
      return Boolean(stage && stage.assessment);
    }).length;
    var projectStageCount = Math.max(0, safeStages.length - assessedStageCount);
    section.setAttribute("aria-labelledby", "landing-stages-title");
    var headingCopy = el("div");
    headingCopy.append(
      el(
        "p",
        "eyebrow",
        assessedStageCount + " assessed stages" +
          (projectStageCount ? " · " + projectStageCount + " project studio" : "")
      ),
      el("h2", null, "Learn the path, then build something playable."),
      el(
        "p",
        null,
        "Reconnect each assessed stage in its recap, prove it in the timed rooms, then transfer the complete model into the final game studio."
      )
    );
    headingCopy.querySelector("h2").id = "landing-stages-title";
    heading.append(headingCopy, link("#home", "landing-stages__roadmap-link", "Open full roadmap →"));
    safeStages.forEach(function (stage) {
      var item = el("li", "landing-stage-card landing-stage-card--" + stage.status.tone);
      var recap = stage.recap || {};
      var hasRecap = Boolean(stage.recap && stage.recap.href);
      var chapters = Array.isArray(stage.chapters) ? stage.chapters : [];
      var firstChapter = chapters[0] || null;
      var stageLink = link(
        hasRecap
          ? stage.recap.href
          : firstChapter
            ? "#chapter/" + encodeURIComponent(firstChapter.id) + "/tutorials"
            : "#home",
        "landing-stage-card__link"
      );
      stageLink.dataset.landingStage = String(stage.id);
      var chapterNumbers = chapters.map(function (chapter) {
        return pad(chapter.number);
      }).join(" · ");
      stageLink.append(
        el("span", "landing-stage-card__number", pad(stage.number)),
        el(
          "span",
          "landing-stage-card__chapters",
          (chapters.length === 1 ? "Chapter " : "Chapters ") + chapterNumbers
        ),
        el("h3", null, stage.title),
        el(
          "p",
          null,
          hasRecap
            ? recap.title
            : "Build Snake and platformer systems frame by frame."
        ),
        el("span", "landing-stage-card__status", stage.status.label),
        el(
          "span",
          "landing-stage-card__action",
          hasRecap ? "Open recap →" : "Open game studio →"
        )
      );
      item.append(stageLink);
      stageList.append(item);
    });
    section.append(heading, stageList);
    return section;
  }

  function renderTrustStrip(model) {
    var section = el("section", "landing-trust");
    var rank = model.rank || {};
    var copy = el("div", "landing-trust__copy");
    section.append(
      el("div", "landing-trust__mark", ">_"),
      copy,
      link("#chapter/py01/tutorials", "button button--primary", "Meet your first Python program")
    );
    copy.append(
      el("p", "eyebrow", "Local first · progress aware"),
      el("h2", null, "Start without an account. Keep learning with one."),
      el(
        "p",
        null,
        "Code and progress save in this browser by default. Sign in only when you want account sync. Your current rank is " + (rank.name || "PEP Explorer") + "."
      )
    );
    return section;
  }

  window.LANDING_VIEW = Object.freeze({
    render: render,
  });
})();
