(function () {
  "use strict";

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
      renderLearningLoop(),
      renderStagePreview(safeModel.stages),
      renderTrustStrip(safeModel)
    );
    return wrapper;
  }

  function renderHero(model) {
    var section = el("section", "landing-hero");
    var copy = el("div", "landing-hero__copy");
    var title = el("h1", null, "Learn Python by understanding what every line does.");
    var actions = el("div", "landing-hero__actions");
    var resume = model.resume || {};
    var primaryLabel = resume.kind === "achievement"
      ? "Review your achievements"
      : resume.action || "Start learning";

    title.id = "landing-title";
    section.setAttribute("aria-labelledby", title.id);
    section.append(renderHeroGeometry());
    copy.append(
      el("p", "eyebrow", "A complete browser-based Python class"),
      title,
      el(
        "p",
        "landing-hero__lede",
        "Begin with input(), variables, and exact output. Build through functions and collections, then finish with recursion, divide and conquer, knapsack, and dynamic programming."
      )
    );
    actions.append(
      link(resume.href || "#chapter/py01/tutorials", "button button--primary", primaryLabel),
      link("#home", "button button--quiet", "Explore the roadmap")
    );
    copy.append(actions, renderHeroMetrics(model));
    section.append(copy, renderTerminalPreview());
    return section;
  }

  function renderHeroGeometry() {
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
      el("span", "landing-hero__coordinates", "PY / 12 · 04 · 102")
    );
    return geometry;
  }

  function renderHeroMetrics(model) {
    var list = el("ul", "landing-hero__metrics");
    var stages = Array.isArray(model.stages) ? model.stages : [];
    var chapterCount = stages.reduce(function (total, stage) {
      return total + (Array.isArray(stage.chapters) ? stage.chapters.length : 0);
    }, 0);
    var exerciseMilestone = (Array.isArray(model.milestones) ? model.milestones : []).find(function (item) {
      return item.label === "Exercises";
    });
    var exerciseTotal = exerciseMilestone
      ? String(exerciseMilestone.value).split("/").pop().trim()
      : "102";
    [
      [chapterCount || 12, "chapters"],
      [stages.length || 4, "learning stages"],
      [exerciseTotal, "exercise suites"],
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
    section.setAttribute("aria-labelledby", "landing-stages-title");
    var headingCopy = el("div");
    headingCopy.append(
      el("p", "eyebrow", "Four connected stages"),
      el("h2", null, "A path with a recap after every three chapters."),
      el("p", null, "Use each recap to reconnect the ideas before opening its timed checkpoint.")
    );
    headingCopy.querySelector("h2").id = "landing-stages-title";
    heading.append(headingCopy, link("#home", "landing-stages__roadmap-link", "Open full roadmap →"));
    safeStages.forEach(function (stage) {
      var item = el("li", "landing-stage-card landing-stage-card--" + stage.status.tone);
      var recap = stage.recap || {};
      var stageLink = link(
        "#stage/" + encodeURIComponent(stage.id) + "/recap",
        "landing-stage-card__link"
      );
      stageLink.dataset.landingStage = String(stage.id);
      var chapterNumbers = (Array.isArray(stage.chapters) ? stage.chapters : []).map(function (chapter) {
        return pad(chapter.number);
      }).join(" · ");
      stageLink.append(
        el("span", "landing-stage-card__number", pad(stage.number)),
        el("span", "landing-stage-card__chapters", "Chapters " + chapterNumbers),
        el("h3", null, stage.title),
        el("p", null, recap.title || "Stage recap"),
        el("span", "landing-stage-card__status", stage.status.label),
        el("span", "landing-stage-card__action", "Open recap →")
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
