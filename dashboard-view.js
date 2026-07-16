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
      el("p", "eyebrow", "Your Python learning path"),
      title,
      el("p", "home-header__lede", model.introduction)
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
    section.append(art, body);
    return section;
  }

  function renderResumeArt(chapter) {
    var art = el("div", "home-resume__art");
    if (!chapter) {
      art.append(el("span", "home-resume__art-code", ">>>"));
      art.setAttribute("aria-hidden", "true");
      return art;
    }
    var number = Math.max(1, Math.min(11, Number(chapter.number) || 1));
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

  function renderRoadmap(stages) {
    var section = el("section", "home-roadmap");
    var heading = el("header", "home-roadmap__heading");
    heading.append(
      el("div", null),
      el("span", "section-heading__count", stages.length + " stages")
    );
    heading.firstElementChild.append(
      el("p", "eyebrow", "Curriculum roadmap"),
      el("h2", null, "Learn in stages, prove it at each checkpoint."),
      el("p", null, "Each chapter combines a solution-free guide and executable exercises. Complete a stage, then test recall and practical fluency under time.")
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
    var status = el("span", "learning-stage__status", stage.status.label);
    copy.append(
      el("span", "eyebrow", "Stage " + pad(stage.number)),
      el("h3", null, stage.title),
      el("p", null, stage.progress.done + " of " + stage.progress.total + " learning milestones complete")
    );
    header.append(marker, copy, status);

    var chapterNav = el("nav", "learning-stage__chapters");
    var chapterList = el("ol");
    chapterNav.setAttribute("aria-label", stage.title + " chapters");
    stage.chapters.forEach(function (chapter) {
      chapterList.append(renderChapterItem(chapter));
    });
    chapterNav.append(chapterList);

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
    item.append(header, chapterNav, assessment);
    return item;
  }

  function renderChapterItem(chapter) {
    var item = el("li");
    var chapterLink = link(
      "#chapter/" + encodeURIComponent(chapter.id),
      "path-chapter path-chapter--" + chapter.state.tone
    );
    var marker = el("span", "path-chapter__marker", pad(chapter.number));
    var copy = el("span", "path-chapter__copy");
    var topics = el("span", "path-chapter__topics");
    var metrics = el("span", "path-chapter__metrics");
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
    chapterLink.append(marker, copy, topics, metrics, state, el("span", "path-chapter__open", "→"));
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
