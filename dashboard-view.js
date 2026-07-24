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

  function progress(value, max, label) {
    var element = el("progress", "progress-bar");
    element.max = Math.max(Number(max) || 0, 1);
    element.value = Math.min(Math.max(Number(value) || 0, 0), element.max);
    element.setAttribute("aria-label", label);
    return element;
  }

  function pad(value) {
    return String(Number(value) || 0).padStart(2, "0");
  }

  function render(model) {
    var wrapper = el("div", "page-shell dashboard-page home-page");
    wrapper.append(
      renderHeader(model),
      renderResume(model.resume),
      renderMilestones(model.milestones),
      renderOverview(model.overview),
      renderRoadmap(model.stages)
    );
    if (model.note) {
      wrapper.append(renderSourceDisclosure(model.note));
    }
    return wrapper;
  }

  function renderHeader(model) {
    var header = el("header", "home-header");
    var copy = el("div", "home-header__copy");
    var title = el("h1", null, model.heading);
    var rank = el("aside", "home-rank");
    var rankLevel = el("span", "home-rank__level", "L" + model.rank.level);
    var rankCopy = el("div");
    title.id = "home-title";
    header.setAttribute("aria-labelledby", title.id);
    copy.append(
      el("p", "eyebrow", "Learning dashboard"),
      title,
      el("p", "home-header__lede", model.introduction),
      renderHeaderMeta(model)
    );
    rank.style.setProperty("--rank-accent", model.rank.accent);
    rankCopy.append(
      el("span", null, "Current rank"),
      el("strong", null, model.rank.name),
      el("small", null, model.nextRank
        ? model.nextRank.starsRemaining + " stars to L" + model.nextRank.level + " · " + model.nextRank.name
        : "Highest rank achieved")
    );
    rank.append(rankLevel, rankCopy);
    header.append(copy, rank);
    return header;
  }

  function renderHeaderMeta(model) {
    var meta = el("div", "home-header__meta");
    var overview = model.overview || {};
    [
      (overview.chapters || 0) + " chapters",
      (Array.isArray(model.stages) ? model.stages.length : 0) + " learning stages",
      "Practice + timed proof"
    ].forEach(function (label) {
      meta.append(el("span", null, label));
    });
    return meta;
  }

  function renderResume(resume) {
    var section = el("section", "home-resume");
    var art = renderResumeArt(resume.chapter);
    var body = el("div", "home-resume__body");
    var actions = el("div", "home-resume__actions");
    var chapter = resume.chapter;
    var exerciseProgress = chapter && chapter.exercises ? chapter.exercises : { done: 0, total: 0 };
    var guideProgress = chapter && chapter.guide ? chapter.guide : { done: 0, total: 0 };
    var metrics = el("dl", "home-resume__metrics");

    section.setAttribute("aria-labelledby", "home-resume-title");
    body.append(
      el("p", "eyebrow", resume.eyebrow),
      el("h2", null, resume.title),
      el("p", "home-resume__description", resume.description)
    );
    body.querySelector("h2").id = "home-resume-title";

    if (chapter) {
      [
        ["Exercise progress", exerciseProgress.done + " / " + exerciseProgress.total],
        ["Guide progress", guideProgress.done + " / " + guideProgress.total],
        ["Chapter state", chapter.state.label]
      ].forEach(function (metric) {
        var item = el("div");
        item.append(el("dt", null, metric[0]), el("dd", null, metric[1]));
        metrics.append(item);
      });
      body.append(
        metrics,
        renderDualProgress(chapter)
      );
    }

    actions.append(link(resume.href, "button button--primary", resume.action));
    if (chapter) {
      actions.append(
        link(
          "#chapter/" + encodeURIComponent(chapter.id),
          "button button--quiet",
          "Chapter overview"
        )
      );
    }
    body.append(actions);
    if (Array.isArray(resume.steps) && resume.steps.length > 0) {
      body.append(renderResumeSteps(resume.steps));
    }
    section.append(art, body);
    return section;
  }

  function renderResumeSteps(steps) {
    var nav = el("nav", "home-resume__steps");
    var heading = el("span", "home-resume__steps-label", "Recommended sequence");
    var list = el("ol");
    nav.setAttribute("aria-label", "Recommended learning sequence");
    steps.forEach(function (step, index) {
      var item = el("li", "home-resume-step home-resume-step--" + step.state.id);
      var stepLink = link(step.href, null);
      var marker = el(
        "span",
        "home-resume-step__marker",
        step.state.id === "complete" ? "✓" : index + 1
      );
      var copy = el("span", "home-resume-step__copy");
      copy.append(
        el("strong", null, step.label),
        el("small", null, step.detail)
      );
      stepLink.append(
        marker,
        copy,
        el("span", "home-resume-step__state", step.state.label)
      );
      item.append(stepLink);
      list.append(item);
    });
    nav.append(heading, list);
    return nav;
  }

  function renderResumeArt(chapter) {
    var art = el("div", "home-resume__art");
    if (!chapter) {
      art.append(el("span", "home-resume__art-code", ">>>"));
      art.setAttribute("aria-hidden", "true");
      return art;
    }
    var number = Math.max(1, Math.min(12, Number(chapter.number) || 1));
    var index = number - 1;
    var column = index % 4;
    var row = Math.floor(index / 4);
    art.style.backgroundPosition = "0 0, " + (column * 100 / 3) + "% " + (row * 100 / 2) + "%";
    art.setAttribute("aria-hidden", "true");
    art.append(
      el("span", "home-resume__art-code", "PY" + pad(number)),
      el("span", "home-resume__art-label", chapter.title)
    );
    return art;
  }

  function renderDualProgress(chapter) {
    var block = el("div", "home-resume__progress");
    var exercise = el("div");
    var guide = el("div");
    exercise.append(
      el("span", null, "Exercises"),
      progress(
        chapter.exercises.done,
        chapter.exercises.total,
        chapter.title + ": " + chapter.exercises.done + " of " + chapter.exercises.total + " exercises passed"
      )
    );
    guide.append(
      el("span", null, "Learning guide"),
      progress(
        chapter.guide.done,
        chapter.guide.total,
        chapter.title + ": " + chapter.guide.done + " of " + chapter.guide.total + " guide sections understood"
      )
    );
    block.append(exercise, guide);
    return block;
  }

  function renderMilestones(milestones) {
    var section = el("section", "home-milestones");
    var heading = el("h2", "visually-hidden", "Overall learning milestones");
    var list = el("ul");
    (Array.isArray(milestones) ? milestones : []).forEach(function (milestone) {
      var item = el("li");
      item.append(
        el("span", null, milestone.label),
        el("strong", null, milestone.value),
        el("small", null, milestone.detail)
      );
      list.append(item);
    });
    section.append(heading, list);
    return section;
  }

  function renderOverview(overview) {
    var section = el("section", "home-overview");
    var heading = el("header", "home-overview__heading");
    var grid = el("div", "home-overview__grid");
    var journey = el("article", "home-overview-card home-overview-card--journey");
    var skills = el("article", "home-overview-card home-overview-card--skills");
    var progressValue = overview && overview.progress ? overview.progress : {
      done: 0,
      total: 0,
      percent: 0
    };

    section.setAttribute("aria-labelledby", "home-overview-title");
    heading.append(
      el("p", "eyebrow", "Learning compass"),
      el("h2", null, "See the whole path without losing your next step."),
      el("p", null, "Use progress as a signal, not a score: revisit the model, practise from memory, then prove recall under time.")
    );
    heading.querySelector("h2").id = "home-overview-title";

    var journeyTop = el("div", "home-overview-card__top");
    var percent = el("strong", "home-overview-card__percent", progressValue.percent + "%");
    var journeyCopy = el("div");
    journeyCopy.append(
      el("span", "eyebrow", "Whole-path progress"),
      el("h3", null, progressValue.done + " of " + progressValue.total + " milestones")
    );
    journeyTop.append(percent, journeyCopy);
    journey.append(
      journeyTop,
      progress(
        progressValue.done,
        progressValue.total,
        progressValue.done + " of " + progressValue.total + " learning milestones complete"
      ),
      renderOverviewMetrics(overview)
    );
    if (overview && overview.currentStage) {
      var currentStage = el("div", "home-overview-card__stage");
      var currentCopy = el("span");
      currentCopy.append(
        el("small", null, "Current stage"),
        el("strong", null, "Stage " + pad(overview.currentStage.number) + " · " + overview.currentStage.title)
      );
      currentStage.append(
        currentCopy,
        el("span", null, overview.currentStage.status.label)
      );
      journey.append(currentStage);
    }

    var focus = overview && overview.focus ? overview.focus : null;
    skills.append(
      el("span", "eyebrow", "Skills in focus"),
      el("h3", null, focus ? focus.title : "Choose a chapter to begin"),
      el(
        "p",
        null,
        focus
          ? "These are the ideas behind your recommended next action."
          : "Each chapter introduces a small set of ideas and a place to prove them."
      )
    );
    var topicList = el("ul", "home-overview-card__topics");
    (focus && Array.isArray(focus.topics) ? focus.topics : []).forEach(function (topic) {
      topicList.append(el("li", null, topic));
    });
    skills.append(topicList);
    if (overview && overview.nextChapter) {
      var next = link(
        "#chapter/" + encodeURIComponent(overview.nextChapter.id),
        "home-overview-card__next"
      );
      var nextCopy = el("span");
      nextCopy.append(
        el("small", null, "On the horizon · Chapter " + pad(overview.nextChapter.number)),
        el("strong", null, overview.nextChapter.title)
      );
      next.append(nextCopy, el("span", null, "Preview →"));
      skills.append(next);
    }

    grid.append(journey, skills);
    section.append(heading, grid);
    return section;
  }

  function renderOverviewMetrics(overview) {
    var metrics = el("dl", "home-overview-card__metrics");
    [
      ["Mastered", overview ? overview.mastered : 0],
      ["In progress", overview ? overview.active : 0],
      ["To explore", overview ? overview.upcoming : 0]
    ].forEach(function (metric) {
      var item = el("div");
      item.append(el("dt", null, metric[0]), el("dd", null, metric[1]));
      metrics.append(item);
    });
    return metrics;
  }

  function renderRoadmap(stages) {
    var section = el("section", "home-roadmap");
    var heading = el("header", "home-roadmap__heading");
    heading.append(
      el("div", null),
      el(
        "span",
        "section-heading__count",
        stages.reduce(function (total, stage) {
          return total + stage.chapters.length;
        }, 0) + " chapters · " + stages.length + " stages"
      )
    );
    heading.firstElementChild.append(
      el("p", "eyebrow", "Curriculum roadmap"),
      el("h2", null, "Choose a chapter by skill, then prove what you learned."),
      el("p", null, "Every chapter pairs a solution-free class with executable exercises. The cards expose skills and progress before you commit to the next lesson.")
    );
    var list = el("ol", "learning-stage-list");
    stages.forEach(function (stage) {
      list.append(renderStage(stage));
    });
    section.append(heading, list);
    return section;
  }

  function renderStage(stage) {
    var item = el("li", "learning-stage learning-stage--" + stage.status.tone);
    var header = el("header", "learning-stage__header");
    var marker = el("span", "learning-stage__number", pad(stage.number));
    var copy = el("div", "learning-stage__copy");
    var stageProgress = el("div", "learning-stage__progress");
    var status = el("span", "learning-stage__status", stage.status.label);
    copy.append(
      el("span", "eyebrow", "Stage " + pad(stage.number)),
      el("h3", null, stage.title),
      el("p", null, stage.chapters.length + " chapters · " + stage.progress.done + " of " + stage.progress.total + " milestones")
    );
    stageProgress.append(
      progress(
        stage.progress.done,
        stage.progress.total,
        stage.title + ": " + stage.progress.done + " of " + stage.progress.total + " milestones complete"
      ),
      el("strong", null, stage.progress.percent + "%")
    );
    header.append(marker, copy, stageProgress, status);

    var chapterNav = el("nav", "learning-stage__chapters");
    var chapterList = el("ol");
    chapterNav.setAttribute("aria-label", stage.title + " chapters");
    stage.chapters.forEach(function (chapter) {
      chapterList.append(renderChapterItem(chapter));
    });
    chapterNav.append(chapterList);

    item.append(header, chapterNav);
    if (stage.assessment && stage.assessment.id) {
      var assessment = link(
        "#assessment/" + encodeURIComponent(stage.assessment.id),
        "learning-stage__assessment"
      );
      var assessmentCopy = el("span");
      assessmentCopy.append(
        el("span", "eyebrow", "Timed checkpoint"),
        el("strong", null, stage.assessment.title),
        el("small", null, stage.assessment.passedModes + " / " + stage.assessment.totalModes + " rooms passed · 60/100 required")
      );
      assessment.append(
        el("span", "learning-stage__assessment-icon", "◷"),
        assessmentCopy,
        el("span", "learning-stage__assessment-open", stage.status.id === "checkpoint" ? "Start checkpoint →" : "Open rooms →")
      );
      item.append(assessment);
    }
    return item;
  }

  function renderChapterItem(chapter) {
    var item = el("li");
    var chapterLink = link(
      "#chapter/" + encodeURIComponent(chapter.id),
      "path-chapter path-chapter--" + chapter.state.tone
    );
    var top = el("span", "path-chapter__top");
    var marker = el("span", "path-chapter__marker", "PY" + pad(chapter.number));
    var copy = el("span", "path-chapter__copy");
    var topics = el("span", "path-chapter__topics");
    var metrics = el("span", "path-chapter__metrics");
    var chapterProgress = el("span", "path-chapter__progress");
    var progressLabel = el("span", "path-chapter__progress-label");
    var footer = el("span", "path-chapter__footer");
    var state = el("span", "path-chapter__state", chapter.state.label);
    copy.append(
      el("strong", null, chapter.title),
      el("small", null, chapter.summary)
    );
    chapter.topics.forEach(function (topic) {
      topics.append(el("span", null, topic));
    });
    metrics.append(
      el("span", null, chapter.exercises.done + "/" + chapter.exercises.total + " exercises"),
      el("span", null, chapter.guide.done + "/" + chapter.guide.total + " guide")
    );
    progressLabel.append(
      el("span", null, "Chapter progress"),
      el("strong", null, chapter.combined.percent + "%")
    );
    chapterProgress.append(
      progressLabel,
      progress(
        chapter.combined.done,
        chapter.combined.total,
        chapter.title + ": " + chapter.combined.done + " of " + chapter.combined.total + " learning milestones complete"
      )
    );
    top.append(marker, state);
    footer.append(metrics, el("span", "path-chapter__open", "Open chapter →"));
    chapterLink.append(top, copy, topics, chapterProgress, footer);
    item.append(chapterLink);
    return item;
  }

  function renderSourceDisclosure(note) {
    var details = el("details", "home-source");
    var summary = el("summary", null, "About the reconstructed exercise material");
    details.append(summary, el("p", null, note));
    return details;
  }

  window.DASHBOARD_VIEW = Object.freeze({
    render: render
  });
})();
