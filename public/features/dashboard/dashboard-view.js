(function () {
  "use strict";

  var stageRecapView = window.STAGE_RECAP_VIEW || null;
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
    if (progressSnakeView && typeof progressSnakeView.render === "function") {
      var ambience = progressSnakeView.render(model.snakeAmbience, {
        variant: "dashboard",
      });
      if (ambience) {
        header.append(ambience);
      }
    }
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
    var number = Math.max(1, Number(chapter.number) || 1);
    var spriteNumber = Math.min(12, number);
    var index = spriteNumber - 1;
    var column = index % 4;
    var row = Math.floor(index / 4);
    if (String(chapter.id) === "py13") {
      art.classList.add("home-resume__art--pygame");
    } else {
      art.style.backgroundPosition = "0 0, " + (column * 100 / 3) + "% " + (row * 100 / 2) + "%";
    }
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
    var safeStages = Array.isArray(stages) ? stages : [];
    var currentStageIndex = safeStages.findIndex(function (stage) {
      return stage.status && stage.status.id !== "complete";
    });
    if (currentStageIndex < 0 && safeStages.length) {
      currentStageIndex = safeStages.length - 1;
    }
    section.setAttribute("aria-labelledby", "home-roadmap-title");
    heading.append(
      el("div", null),
      el(
        "span",
        "section-heading__count",
        safeStages.reduce(function (total, stage) {
          return total + stage.chapters.length;
        }, 0) + " chapters · " + safeStages.length + " stages"
      )
    );
    heading.firstElementChild.append(
      el("p", "eyebrow", "Curriculum roadmap"),
      el("h2", null, "Choose a chapter by skill, then prove what you learned."),
      el("p", null, "Move from class material to executable practice, use timed checkpoints for recall, then finish in the independent game studio.")
    );
    heading.querySelector("h2").id = "home-roadmap-title";
    var list = el("ol", "learning-stage-list");
    list.setAttribute("aria-label", "Python curriculum stages");
    safeStages.forEach(function (stage, index) {
      list.append(renderStage(stage, index, currentStageIndex));
    });
    section.append(heading, list);
    return section;
  }

  function renderStage(stage, stageIndex, currentStageIndex) {
    var stageState = getStagePathState(stage, stageIndex, currentStageIndex);
    var item = el(
      "li",
      "learning-stage learning-stage--" + stage.status.tone +
        " learning-stage--" + stageState
    );
    var header = el("header", "learning-stage__header");
    var marker = el("span", "learning-stage__number", pad(stage.number));
    var copy = el("div", "learning-stage__copy");
    var stageProgress = el("div", "learning-stage__progress");
    var status = el(
      "span",
      "learning-stage__status",
      stageState === "completed"
        ? "Completed"
        : stageState === "current"
          ? stage.status.id === "checkpoint" ? "Checkpoint ready" : "Current stage"
          : "Upcoming"
    );
    var progressCopy = el("span", "learning-stage__progress-copy");
    var stageTitleId = "roadmap-stage-" + String(stage.id).replace(/[^a-z0-9-]/giu, "-");
    var currentChapterIndex = getCurrentChapterIndex(stage, stageState);
    var checkpointState = getCheckpointPathState(stage, stageState);
    var routeFill = getStageRouteFill(stage, stageState, currentChapterIndex);
    item.dataset.roadmapStage = String(stage.id);
    item.dataset.stageState = stageState;
    item.setAttribute("aria-labelledby", stageTitleId);
    item.style.setProperty("--stage-route-fill", String(routeFill));
    marker.setAttribute("aria-hidden", "true");
    copy.append(
      el("span", "eyebrow", "Stage " + pad(stage.number)),
      el("h3", null, stage.title),
      el("p", null, stage.chapters.length + " chapters · " + stage.progress.done + " of " + stage.progress.total + " milestones")
    );
    copy.querySelector("h3").id = stageTitleId;
    progressCopy.append(
      el("strong", null, stage.progress.percent + "%"),
      el("small", null, stage.progress.done + " / " + stage.progress.total)
    );
    stageProgress.append(
      progress(
        stage.progress.done,
        stage.progress.total,
        stage.title + ": " + stage.progress.done + " of " + stage.progress.total + " milestones complete"
      ),
      progressCopy
    );
    header.append(marker, copy, stageProgress, status);

    var path = el("div", "learning-stage__path");
    var routeTrack = el("span", "learning-stage__route-track");
    var routeProgress = el("span", "learning-stage__route-progress");
    var routeBeacon = null;
    routeTrack.setAttribute("aria-hidden", "true");
    routeProgress.setAttribute("aria-hidden", "true");
    if (stageState === "current") {
      routeBeacon = el("span", "learning-stage__route-beacon");
      routeBeacon.dataset.geoMotion = "roadmap-beacon";
      routeBeacon.setAttribute("aria-hidden", "true");
    }
    var chapterNav = el("nav", "learning-stage__chapters");
    var chapterList = el("ol");
    chapterList.dataset.chapterCount = String(stage.chapters.length);
    chapterList.style.setProperty(
      "--stage-chapter-columns",
      String(Math.max(1, Math.min(stage.chapters.length, 3)))
    );
    chapterNav.setAttribute("aria-label", stage.title + " chapters");
    stage.chapters.forEach(function (chapter, chapterIndex) {
      chapterList.append(
        renderChapterItem(
          chapter,
          getChapterPathState(chapter, chapterIndex, stageState, currentChapterIndex)
        )
      );
    });
    chapterNav.append(chapterList);
    path.append(routeTrack, routeProgress, chapterNav);
    if (routeBeacon) {
      path.append(routeBeacon);
    }

    if (stage.recap) {
      path.append(renderRecapStop(stage.recap));
    }

    if (stage.assessment && stage.assessment.id) {
      var assessment = link(
        "#assessment/" + encodeURIComponent(stage.assessment.id),
        "learning-stage__assessment learning-stage__assessment--" + checkpointState
      );
      var assessmentCopy = el("span");
      assessment.dataset.stageCheckpoint = String(stage.id);
      assessment.dataset.checkpointState = checkpointState;
      if (checkpointState === "current") {
        assessment.setAttribute("aria-current", "step");
      }
      assessmentCopy.append(
        el("span", "eyebrow", "Timed checkpoint"),
        el("strong", null, stage.assessment.title),
        el("small", null, stage.assessment.passedModes + " / " + stage.assessment.totalModes + " rooms passed · 60/100 required")
      );
      assessment.append(
        el(
          "span",
          "learning-stage__assessment-icon",
          checkpointState === "completed" ? "✓" : "60"
        ),
        assessmentCopy,
        el(
          "span",
          "learning-stage__assessment-open",
          checkpointState === "completed"
            ? "Passed"
            : checkpointState === "current" ? "Start →" : "Preview →"
        )
      );
      path.append(assessment);
    }
    item.append(header, path);
    if (
      stage.recap &&
      stage.recap.award &&
      stageRecapView &&
      typeof stageRecapView.renderAward === "function"
    ) {
      item.append(stageRecapView.renderAward(stage.recap.award, { compact: true }));
    }
    return item;
  }

  function renderRecapStop(recap) {
    var recapLink = link(
      recap.href,
      "learning-stage__recap learning-stage__recap--" + recap.state.id
    );
    var copy = el("span", "learning-stage__recap-copy");
    recapLink.dataset.stageRecap = String(recap.id);
    recapLink.setAttribute(
      "aria-label",
      recap.title + ", " + recap.state.label.toLowerCase()
    );
    copy.append(
      el("span", "eyebrow", "Stage recap"),
      el("strong", null, recap.title),
      el("small", null, "Reconnect the ideas in this stage")
    );
    recapLink.append(
      el("span", "learning-stage__recap-icon", "↻"),
      copy,
      el("span", "learning-stage__recap-open", "Review →")
    );
    return recapLink;
  }

  function getStagePathState(stage, stageIndex, currentStageIndex) {
    if (stage.status && stage.status.id === "complete") {
      return "completed";
    }
    if (stageIndex === currentStageIndex) {
      return "current";
    }
    return stageIndex < currentStageIndex ? "completed" : "upcoming";
  }

  function getCurrentChapterIndex(stage, stageState) {
    if (stageState !== "current") {
      return -1;
    }
    var chapters = Array.isArray(stage.chapters) ? stage.chapters : [];
    var activeIndex = chapters.findIndex(function (chapter) {
      return chapter.state.id === "active" || chapter.state.id === "review";
    });
    if (activeIndex >= 0) {
      return activeIndex;
    }
    return chapters.findIndex(function (chapter) {
      return chapter.state.id !== "mastered";
    });
  }

  function getChapterPathState(chapter, chapterIndex, stageState, currentChapterIndex) {
    if (chapter.state.id === "mastered" || stageState === "completed") {
      return "completed";
    }
    if (stageState === "current" && chapterIndex === currentChapterIndex) {
      return "current";
    }
    return "upcoming";
  }

  function getCheckpointPathState(stage, stageState) {
    if (
      stageState === "completed" ||
      (stage.assessment &&
        stage.assessment.totalModes > 0 &&
        stage.assessment.passedModes === stage.assessment.totalModes)
    ) {
      return "completed";
    }
    if (stageState === "current" && stage.status.id === "checkpoint") {
      return "current";
    }
    return "upcoming";
  }

  function getStageRouteFill(stage, stageState, currentChapterIndex) {
    if (stageState === "completed" || stage.status.id === "checkpoint") {
      return 1;
    }
    var chapterCount = Math.max(stage.chapters.length, 1);
    var currentPosition = currentChapterIndex < 0 ? 0 : currentChapterIndex / chapterCount;
    var progressPosition = Math.min(Math.max(stage.progress.percent, 0), 100) / 100 * 0.75;
    return Math.max(currentPosition, progressPosition);
  }

  function renderChapterItem(chapter, pathState) {
    var item = el("li", "path-chapter-stop path-chapter-stop--" + pathState);
    var chapterLink = link(
      "#chapter/" + encodeURIComponent(chapter.id),
      "path-chapter path-chapter--" + chapter.state.tone +
        " path-chapter--" + pathState
    );
    var marker = el("span", "path-chapter__marker");
    var markerPrefix = el("span", "path-chapter__marker-prefix", "py");
    var markerValue = el(
      "strong",
      null,
      pathState === "completed" ? "✓" : pathState === "current" ? "›" : pad(chapter.number)
    );
    var copy = el("span", "path-chapter__copy");
    var topics = el("span", "path-chapter__topics");
    var footer = el("span", "path-chapter__footer");
    var stateLabel = pathState === "completed"
      ? "Completed"
      : pathState === "current" ? "Current" : "Upcoming";
    var state = el("span", "path-chapter__state", stateLabel);
    chapterLink.dataset.chapterNode = String(chapter.id);
    chapterLink.dataset.nodeState = pathState;
    chapterLink.setAttribute(
      "aria-label",
      "Chapter " + pad(chapter.number) + ", " + chapter.title + ", " +
        stateLabel.toLowerCase() + ", " + chapter.combined.percent + " percent complete"
    );
    if (pathState === "current") {
      chapterLink.setAttribute("aria-current", "step");
    }
    marker.setAttribute("aria-hidden", "true");
    marker.append(markerPrefix, markerValue);
    copy.append(
      el("strong", null, chapter.title),
      el("small", null, chapter.summary)
    );
    chapter.topics.forEach(function (topic) {
      topics.append(el("span", null, topic));
    });
    footer.append(
      state,
      el("span", "path-chapter__percent", chapter.combined.percent + "%")
    );
    chapterLink.append(
      marker,
      copy,
      topics,
      progress(
        chapter.combined.done,
        chapter.combined.total,
        chapter.title + ": " + chapter.combined.done + " of " + chapter.combined.total + " learning milestones complete"
      ),
      footer
    );
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
