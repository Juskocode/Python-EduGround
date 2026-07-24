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

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeObject(value) {
    return value && typeof value === "object" ? value : {};
  }

  function text(value, fallback) {
    if (value === undefined || value === null || value === "") {
      return fallback || "";
    }
    return String(value);
  }

  function count(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function pad(value) {
    return String(count(value) || 1).padStart(2, "0");
  }

  function normalizeProgress(value) {
    var source = safeObject(value);
    var total = count(source.total);
    var done = Math.min(count(source.done), total);
    return {
      done: done,
      total: total,
      percent: total ? Math.round(done / total * 100) : 0,
    };
  }

  function progress(value, max, label) {
    var element = el("progress", "progress-bar");
    element.max = Math.max(count(max), 1);
    element.value = Math.min(count(value), element.max);
    element.setAttribute("aria-label", label);
    return element;
  }

  function stateId(value, fallback) {
    if (typeof value === "string" && value) {
      return value;
    }
    if (value && typeof value === "object" && value.id) {
      return String(value.id);
    }
    return fallback || "preview";
  }

  function stateLabel(recap, id) {
    var state = safeObject(recap.state);
    var status = safeObject(recap.status);
    if (state.label) {
      return String(state.label);
    }
    if (status.label) {
      return String(status.label);
    }
    return {
      preview: "Preview",
      learning: "Learning in progress",
      ready: "Checkpoint ready",
      complete: "Stage complete",
    }[id] || "Stage recap";
  }

  function getRecap(model) {
    var source = safeObject(model);
    return source.recap && typeof source.recap === "object"
      ? source.recap
      : source;
  }

  function getChapters(model, recap) {
    if (Array.isArray(model && model.chapters)) {
      return model.chapters;
    }
    return safeArray(recap.chapters);
  }

  function getAssessment(model, recap) {
    if (recap.assessment && typeof recap.assessment === "object") {
      return recap.assessment;
    }
    return safeObject(model && model.assessment);
  }

  function getStageNumber(model, recap) {
    return count(recap.number) || count(model && model.number) || 1;
  }

  function getStageTitle(model, recap) {
    return text(recap.stageTitle, text(model && model.title, "Learning stage"));
  }

  function render(model) {
    var source = safeObject(model);
    var recap = getRecap(source);
    var chapters = getChapters(source, recap);
    var assessment = getAssessment(source, recap);
    var stageNumber = getStageNumber(source, recap);
    var recapState = stateId(recap.state, stateId(recap.status, "preview"));
    var wrapper = el(
      "div",
      "page-shell stage-recap-page stage-recap-page--" + recapState
    );

    wrapper.dataset.stageRecapPage = text(recap.id, text(source.id, "stage"));
    wrapper.append(
      renderBreadcrumbs(stageNumber, getStageTitle(source, recap)),
      renderHero(source, recap, chapters, stageNumber, recapState),
      renderOutcomes(recap.outcomes),
      renderChapterReview(chapters),
      renderRetrievalPractice(recap.chapterPrompts, chapters),
      renderRecall(recap.recall, recap.bridge),
      renderCheckpoint(assessment),
      renderReferences(recap.references)
    );

    if (recap.award) {
      wrapper.append(renderAward(recap.award));
    }
    return wrapper;
  }

  function renderBreadcrumbs(stageNumber, stageTitle) {
    var nav = el("nav", "stage-recap-breadcrumbs");
    var list = el("ol");
    var welcome = el("li");
    var roadmap = el("li");
    var current = el(
      "li",
      null,
      "Stage " + pad(stageNumber) + " · " + stageTitle
    );

    nav.setAttribute("aria-label", "Breadcrumb");
    welcome.append(link("#welcome", null, "Welcome"));
    roadmap.append(link("#home", null, "Roadmap"));
    current.setAttribute("aria-current", "page");
    list.append(welcome, roadmap, current);
    nav.append(list);
    return nav;
  }

  function renderHero(model, recap, chapters, stageNumber, recapState) {
    var section = el("header", "stage-recap-hero");
    var copy = el("div", "stage-recap-hero__copy");
    var title = el("h1", null, text(recap.title, "Stage recap"));
    var topicList = el("ul", "stage-recap-topics");
    var state = el(
      "span",
      "stage-recap-state stage-recap-state--" + recapState,
      stateLabel(recap, recapState)
    );
    var topics = safeArray(recap.topics);

    title.id = "stage-recap-title";
    section.setAttribute("aria-labelledby", title.id);
    copy.append(
      el("p", "eyebrow", "Stage " + pad(stageNumber) + " · Connect the ideas"),
      title,
      el(
        "p",
        "stage-recap-hero__summary",
        text(
          recap.summary,
          "Pause, retrieve the main ideas, and decide what needs another pass before the timed checkpoint."
        )
      )
    );

    if (topics.length > 0) {
      topics.forEach(function (topic) {
        topicList.append(el("li", null, text(topic, "Python")));
      });
      copy.append(topicList);
    }

    section.append(
      copy,
      renderStageSnapshot(
        recap.aggregate,
        chapters,
        state,
        safeObject(recap.nextAction)
      )
    );
    return section;
  }

  function aggregateFromChapters(chapters) {
    return safeArray(chapters).reduce(function (result, chapter) {
      var guide = normalizeProgress(chapter && chapter.guide);
      var exercises = normalizeProgress(chapter && chapter.exercises);
      result.guide.done += guide.done;
      result.guide.total += guide.total;
      result.exercises.done += exercises.done;
      result.exercises.total += exercises.total;
      result.stars.done += count(chapter && chapter.exercises && chapter.exercises.stars);
      result.stars.total += count(chapter && chapter.exercises && chapter.exercises.maxStars);
      return result;
    }, {
      guide: { done: 0, total: 0 },
      exercises: { done: 0, total: 0 },
      stars: { done: 0, total: 0 },
    });
  }

  function renderStageSnapshot(aggregate, chapters, statusNode, nextAction) {
    var aside = el("aside", "stage-recap-snapshot");
    var metrics = el("dl", "stage-recap-snapshot__metrics");
    var source = safeObject(aggregate);
    var fallback = aggregateFromChapters(chapters);
    var guide = normalizeProgress(source.guide || fallback.guide);
    var exercises = normalizeProgress(source.exercises || fallback.exercises);
    var starsSource = source.stars && typeof source.stars === "object"
      ? source.stars
      : source.exercises && (
        source.exercises.stars !== undefined ||
        source.exercises.maxStars !== undefined
      )
        ? {
          done: source.exercises.stars,
          total: source.exercises.maxStars,
        }
        : source.stars !== undefined || source.maxStars !== undefined
          ? {
            done: source.stars,
            total: source.maxStars,
          }
          : fallback.stars;
    var stars = normalizeProgress(starsSource);
    var actionHref = text(nextAction.href, text(nextAction.url, ""));
    var actionLabel = text(
      nextAction.label,
      text(nextAction.action, text(nextAction.title, "Continue learning"))
    );

    [
      ["Guide", guide.done + " / " + guide.total],
      ["Exercises", exercises.done + " / " + exercises.total],
      ["Stars", stars.done + " / " + stars.total],
    ].forEach(function (metric) {
      var item = el("div");
      item.append(el("dt", null, metric[0]), el("dd", null, metric[1]));
      metrics.append(item);
    });

    aside.append(statusNode, metrics);
    if (actionHref) {
      var action = link(actionHref, "button button--primary", actionLabel);
      action.dataset.stageRecapAction = "next";
      aside.append(action);
    }
    return aside;
  }

  function renderSectionHeading(eyebrow, title, description, id) {
    var header = el("header", "stage-recap-section__heading");
    var heading = el("h2", null, title);
    heading.id = id;
    header.append(
      el("p", "eyebrow", eyebrow),
      heading,
      el("p", null, description)
    );
    return header;
  }

  function renderOutcomes(outcomes) {
    var section = el("section", "stage-recap-section stage-recap-outcomes");
    var list = el("ol");
    var safeOutcomes = safeArray(outcomes);
    section.setAttribute("aria-labelledby", "stage-recap-outcomes-title");
    section.append(
      renderSectionHeading(
        "Before the clock starts",
        "Make these connections out loud.",
        "A useful recap is active recall: explain the idea, predict a small example, then verify only after committing to an answer.",
        "stage-recap-outcomes-title"
      )
    );
    safeOutcomes.forEach(function (outcome, index) {
      var item = el("li");
      item.append(
        el("span", "stage-recap-outcomes__number", pad(index + 1)),
        el("p", null, text(outcome, "Review this learning outcome."))
      );
      list.append(item);
    });
    section.append(list);
    return section;
  }

  function renderChapterReview(chapters) {
    var section = el("section", "stage-recap-section stage-recap-chapters");
    var grid = el("div", "stage-recap-chapter-grid");
    section.setAttribute("aria-labelledby", "stage-recap-chapters-title");
    section.append(
      renderSectionHeading(
        "Three chapter lenses",
        "Check the model, then check the evidence.",
        "Use the guide when the idea is unclear. Use exercises when the idea is clear but the implementation is not reliable yet.",
        "stage-recap-chapters-title"
      )
    );
    safeArray(chapters).forEach(function (chapter) {
      grid.append(renderChapterCard(chapter));
    });
    section.append(grid);
    return section;
  }

  function renderChapterCard(chapter) {
    var source = safeObject(chapter);
    var card = el("article", "stage-recap-chapter");
    var header = el("header", "stage-recap-chapter__header");
    var chapterState = safeObject(source.state);
    var guide = normalizeProgress(source.guide);
    var exercises = normalizeProgress(source.exercises);
    var chapterId = text(source.id, "");
    var topics = el("ul", "stage-recap-chapter__topics");
    var actions = el("div", "stage-recap-chapter__actions");

    card.dataset.recapChapter = chapterId;
    header.append(
      el("span", "stage-recap-chapter__number", "Chapter " + pad(source.number)),
      el(
        "span",
        "stage-recap-chapter__state stage-recap-chapter__state--" +
          stateId(chapterState, "upcoming"),
        text(chapterState.label, "Not started")
      )
    );
    card.append(
      header,
      el("h3", null, text(source.title, "Python chapter")),
      el("p", "stage-recap-chapter__summary", text(source.summary, "Review the chapter model and practise it from memory.")),
      renderProgressRow("Class guide", guide, text(source.title, "Chapter")),
      renderProgressRow("Exercises", exercises, text(source.title, "Chapter"))
    );

    safeArray(source.topics).forEach(function (topic) {
      topics.append(el("li", null, text(topic, "Python")));
    });
    if (topics.children.length > 0) {
      card.append(topics);
    }

    if (chapterId) {
      actions.append(
        link(
          text(source.guideHref, "#chapter/" + encodeURIComponent(chapterId) + "/tutorials"),
          "stage-recap-chapter__link",
          "Review class notes"
        ),
        link(
          text(source.exercisesHref, "#chapter/" + encodeURIComponent(chapterId) + "/exercises"),
          "stage-recap-chapter__link",
          "Open exercises"
        )
      );
      card.append(actions);
    }
    return card;
  }

  function renderProgressRow(label, value, chapterTitle) {
    var row = el("div", "stage-recap-progress");
    var copy = el("span");
    copy.append(
      el("strong", null, label),
      el("small", null, value.done + " / " + value.total)
    );
    row.append(
      copy,
      progress(
        value.done,
        value.total,
        chapterTitle + ": " + value.done + " of " + value.total + " " + label.toLowerCase() + " complete"
      )
    );
    return row;
  }

  function findChapter(chapters, prompt, index) {
    var chapterId = text(
      prompt && prompt.chapterId,
      text(prompt && prompt.chapter && prompt.chapter.id, "")
    );
    if (chapterId) {
      return safeArray(chapters).find(function (chapter) {
        return String(chapter.id) === chapterId;
      }) || null;
    }
    return safeArray(chapters)[index] || null;
  }

  function renderRetrievalPractice(prompts, chapters) {
    var safePrompts = safeArray(prompts);
    var section = el("section", "stage-recap-section stage-recap-retrieval");
    var list = el("ol", "stage-recap-retrieval__list");
    if (safePrompts.length === 0) {
      return section;
    }
    section.setAttribute("aria-labelledby", "stage-recap-retrieval-title");
    section.append(
      renderSectionHeading(
        "Retrieval practice",
        "One fresh question from each chapter.",
        "Write or say your answer before opening the teaching note. Struggling to retrieve is useful evidence about what to revisit.",
        "stage-recap-retrieval-title"
      )
    );
    safePrompts.forEach(function (promptValue, index) {
      var prompt = typeof promptValue === "object"
        ? promptValue
        : { prompt: String(promptValue) };
      var chapter = findChapter(chapters, prompt, index);
      var item = el("li", "stage-recap-retrieval-card");
      var answer = text(prompt.answer, text(prompt.reveal, text(prompt.explanation, "")));
      var question = text(prompt.prompt, text(prompt.question, text(prompt.title, "Explain the chapter idea from memory.")));

      item.dataset.retrievalPrompt = text(
        prompt.id,
        text(chapter && chapter.id, String(index + 1))
      );
      item.append(
        el(
          "p",
          "eyebrow",
          chapter
            ? "Chapter " + pad(chapter.number) + " · " + text(chapter.title, "Review")
            : "Retrieval " + pad(index + 1)
        ),
        el("h3", null, question)
      );
      if (answer) {
        item.append(renderAnswerDetails(answer, "Reveal the teaching note"));
      } else if (chapter && chapter.id) {
        item.append(
          link(
            "#chapter/" + encodeURIComponent(String(chapter.id)) + "/tutorials",
            "stage-recap-retrieval-card__review",
            "Review the class model →"
          )
        );
      }
      list.append(item);
    });
    section.append(list);
    return section;
  }

  function renderAnswerDetails(answer, label) {
    var details = el("details", "stage-recap-answer");
    var summary = el("summary");
    summary.append(
      el("span", null, label),
      el("span", "stage-recap-answer__icon", "+")
    );
    details.append(summary, el("p", null, answer));
    return details;
  }

  function renderRecall(recall, bridge) {
    var safeRecall = safeArray(recall);
    var section = el("section", "stage-recap-section stage-recap-recall");
    var list = el("div", "stage-recap-recall__list");
    if (safeRecall.length === 0 && !bridge) {
      return section;
    }
    section.setAttribute("aria-labelledby", "stage-recap-recall-title");
    section.append(
      renderSectionHeading(
        "Cross-stage synthesis",
        "Can you explain the hidden connection?",
        "These prompts combine ideas across the three chapters. Reveal an answer only after making a concrete prediction.",
        "stage-recap-recall-title"
      )
    );
    safeRecall.forEach(function (itemValue, index) {
      var item = safeObject(itemValue);
      var details = el("details", "stage-recap-recall-card");
      var summary = el("summary");
      summary.append(
        el("span", "stage-recap-recall-card__number", pad(index + 1)),
        el("strong", null, text(item.prompt, text(item.question, "Connect these ideas."))),
        el("span", "stage-recap-recall-card__icon", "+")
      );
      details.append(
        summary,
        el("p", null, text(item.answer, text(item.explanation, "Return to the chapter models, then try this question again.")))
      );
      list.append(details);
    });
    section.append(list);
    if (bridge) {
      var bridgePanel = el("aside", "stage-recap-bridge");
      bridgePanel.append(
        el("span", "stage-recap-bridge__mark", "→"),
        el("div")
      );
      bridgePanel.querySelector("div").append(
        el("strong", null, "From recap to checkpoint"),
        el("p", null, text(bridge, "Use the timed checkpoint when you can explain the stage without copying an example."))
      );
      section.append(bridgePanel);
    }
    return section;
  }

  function renderCheckpoint(assessment) {
    var source = safeObject(assessment);
    var modes = safeArray(source.modes);
    var section = el("section", "stage-recap-section stage-recap-checkpoint");
    var grid = el("div", "stage-recap-checkpoint__grid");
    var assessmentId = text(source.id, "");
    var passedModes = count(source.passedModes) || modes.filter(function (mode) {
      return Boolean(mode && (mode.completed || mode.passed));
    }).length;
    var totalModes = count(source.totalModes) || modes.length;

    if (!assessmentId && modes.length === 0) {
      return section;
    }
    section.setAttribute("aria-labelledby", "stage-recap-checkpoint-title");
    section.append(
      renderSectionHeading(
        "Checkpoint evidence",
        "Prove recall under realistic constraints.",
        passedModes + " of " + totalModes + " timed rooms passed. A score of 60/100 or higher completes each room.",
        "stage-recap-checkpoint-title"
      )
    );
    modes.forEach(function (mode, index) {
      grid.append(renderAssessmentMode(mode, index, assessmentId));
    });
    if (grid.children.length > 0) {
      section.append(grid);
    }
    if (assessmentId) {
      var open = link(
        "#assessment/" + encodeURIComponent(assessmentId),
        "button button--primary stage-recap-checkpoint__open",
        passedModes === totalModes && totalModes > 0
          ? "Review checkpoint"
          : passedModes > 0
            ? "Continue checkpoint"
            : "Open timed checkpoint"
      );
      open.dataset.stageRecapAssessment = assessmentId;
      section.append(open);
    }
    return section;
  }

  function renderAssessmentMode(modeValue, index, assessmentId) {
    var mode = safeObject(modeValue);
    var completed = Boolean(mode.completed || mode.passed);
    var active = !completed && Boolean(mode.active);
    var attempted = !completed && !active && Boolean(
      mode.attempted || count(mode.attempts) || Number(mode.bestScore) > 0
    );
    var modeState = completed
      ? "passed"
      : active
        ? "active"
        : attempted
          ? "attempted"
          : "not-started";
    var card = el(
      "article",
      "stage-recap-mode stage-recap-mode--" + modeState
    );
    var score = Number(mode.bestScore);
    var label = text(mode.label, text(mode.title, "Room " + (index + 1)));
    var status = completed
      ? "Passed"
      : active
        ? "Active attempt"
        : attempted
          ? "Try again"
          : "Not started";

    card.dataset.assessmentMode = text(mode.id, String(index + 1));
    card.append(
      el("span", "stage-recap-mode__status", status),
      el("h3", null, label),
      el(
        "p",
        null,
        text(
          mode.description,
          index === 0
            ? "Retrieve concepts, read code, and choose every correct answer."
            : "Solve new programming tasks and validate the behaviour with tests."
        )
      ),
      el(
        "strong",
        "stage-recap-mode__score",
        Number.isFinite(score) ? "Best " + Math.max(0, Math.round(score)) + " / 100" : "No score yet"
      )
    );
    if (assessmentId) {
      card.append(
        link(
          text(mode.href, "#assessment/" + encodeURIComponent(assessmentId)),
          "stage-recap-mode__link",
          completed ? "Review room →" : "Open room →"
        )
      );
    }
    return card;
  }

  function renderReferences(references) {
    var safeReferences = safeArray(references);
    var section = el("section", "stage-recap-section stage-recap-references");
    var list = el("ul");
    if (safeReferences.length === 0) {
      return section;
    }
    section.setAttribute("aria-labelledby", "stage-recap-references-title");
    section.append(
      renderSectionHeading(
        "Official references",
        "Keep the language reference within reach.",
        "These Python documentation pages support the stage model without revealing repository exercise solutions.",
        "stage-recap-references-title"
      )
    );
    safeReferences.forEach(function (referenceValue) {
      var reference = typeof referenceValue === "string"
        ? { label: referenceValue, url: referenceValue }
        : safeObject(referenceValue);
      var item = el("li");
      var referenceLink = link(
        text(reference.url, text(reference.href, "#home")),
        "stage-recap-reference"
      );
      referenceLink.target = "_blank";
      referenceLink.rel = "noopener noreferrer";
      referenceLink.append(
        el("span", "stage-recap-reference__mark", "PY"),
        el("span", "stage-recap-reference__copy"),
        el("span", "stage-recap-reference__open", "↗")
      );
      referenceLink.querySelector(".stage-recap-reference__copy").append(
        el("strong", null, text(reference.label, text(reference.title, "Python documentation"))),
        el("small", null, text(reference.description, "Official Python documentation"))
      );
      item.append(referenceLink);
      list.append(item);
    });
    section.append(list);
    return section;
  }

  function awardState(award, options) {
    var state = stateId(
      options && options.state,
      stateId(award && award.state, stateId(award && award.status, ""))
    );
    if (state === "earned" || state === "complete") {
      return "unlocked";
    }
    if (state === "checkpoint") {
      return "ready";
    }
    if (state === "unlocked" || state === "ready" || state === "locked") {
      return state;
    }
    if (award && award.unlocked) {
      return "unlocked";
    }
    if (award && award.ready) {
      return "ready";
    }
    return "locked";
  }

  function renderAward(awardValue, optionsValue) {
    var award = safeObject(awardValue);
    var options = safeObject(optionsValue);
    var state = awardState(award, options);
    var isLink = state === "ready" || state === "unlocked";
    var fallbackHref = state === "ready"
      ? "#assessment/py10-py11"
      : "#profile/badges";
    var root = isLink
      ? link(text(award.href, text(award.actionHref, fallbackHref)), "stage-award")
      : el("section", "stage-award");
    var visual = el("span", "stage-award__visual");
    var seal = el("span", "stage-award__seal");
    var copy = el("span", "stage-award__copy");
    var stateCopy = {
      locked: {
        label: "Locked · finish the full path",
        action: "Complete every stage to unlock",
      },
      ready: {
        label: "Ready · final proof remains",
        action: "Open the final checkpoint",
      },
      unlocked: {
        label: "Earned · full path complete",
        action: "View your achievement",
      },
    }[state];
    var heading = el(
      options.compact ? "strong" : "h2",
      "stage-award__name",
      text(award.name, "Python Pathforger")
    );

    root.className += " stage-award--" + state;
    if (options.compact) {
      root.className += " stage-award--compact";
    }
    root.dataset.pathforgerAward = text(award.id, "python-pathforger");
    root.dataset.finalStageBadge = text(award.id, "python-pathforger");
    root.dataset.awardState = state;
    root.setAttribute(
      "aria-label",
      text(award.name, "Python Pathforger") + ". " + stateCopy.label + (
        isLink ? ". " + stateCopy.action : ""
      )
    );

    visual.setAttribute("aria-hidden", "true");
    seal.append(
      el("span", "stage-award__orbit stage-award__orbit--outer"),
      el("span", "stage-award__orbit stage-award__orbit--inner"),
      el("span", "stage-award__snake stage-award__snake--top", "⌁"),
      el("span", "stage-award__monogram", text(award.monogram, "PY∞")),
      el("span", "stage-award__snake stage-award__snake--bottom", "⌁"),
      el("span", "stage-award__shine")
    );
    [
      ["{", "one"],
      [">", "two"],
      ["_", "three"],
      ["}", "four"],
    ].forEach(function (spark) {
      visual.append(
        el(
          "span",
          "stage-award__spark stage-award__spark--" + spark[1],
          spark[0]
        )
      );
    });
    visual.append(seal);

    copy.append(
      el("span", "eyebrow", "Final-stage achievement"),
      heading,
      el(
        "span",
        "stage-award__description",
        text(
          award.description,
          "Awarded after every chapter guide, exercise suite, and timed checkpoint is complete."
        )
      ),
      el("span", "stage-award__state", stateCopy.label)
    );
    if (isLink) {
      copy.append(el("span", "stage-award__action", stateCopy.action + " →"));
    }
    root.append(visual, copy);
    return root;
  }

  window.STAGE_RECAP_VIEW = Object.freeze({
    render: render,
    renderAward: renderAward,
  });
})();
