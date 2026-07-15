(function () {
  "use strict";

  var STORAGE_KEYS = {
    passed: "fp-playground.passed.v2",
    drafts: "fp-playground.drafts.v2",
    theme: "fp-playground.theme.v1",
    lastExercise: "fp-playground.last-exercise.v2",
    learning: "fp-playground.learning.v1",
    editorMode: "fp-playground.editor-mode.v1",
    authToken: "fp-playground.auth-token.v1"
  };

  var elements = {
    main: document.getElementById("app-main"),
    status: document.getElementById("app-status"),
    themeToggle: document.getElementById("theme-toggle"),
    soundToggle: document.getElementById("sound-toggle"),
    achievementToasts: document.getElementById("achievement-toasts"),
    profileButton: document.getElementById("profile-button"),
    profilePanel: document.getElementById("profile-panel"),
    profileLevel: document.getElementById("profile-level-label"),
    profileRank: document.getElementById("profile-rank-label")
  };

  var course = window.COURSE_DATA;
  var testData = window.EXERCISE_TESTS || {};
  var starterCode = window.STARTER_CODE || {};
  var learning = window.LEARNING_CONTENT || {};
  var audio = window.APP_AUDIO || createSilentAudio();

  if (!course || !Array.isArray(course.chapters) || course.chapters.length === 0) {
    renderDataError();
    return;
  }

  var chapters = course.chapters.slice().sort(function (a, b) {
    return Number(a.number) - Number(b.number);
  });
  var chapterById = new Map();
  var exerciseById = new Map();
  var chapterForExercise = new Map();
  var validExerciseIds = new Set();

  chapters.forEach(function (chapter) {
    chapterById.set(String(chapter.id), chapter);
    getExercises(chapter).forEach(function (exercise) {
      var exerciseId = String(exercise.id);
      exerciseById.set(exerciseId, exercise);
      chapterForExercise.set(exerciseId, chapter);
      validExerciseIds.add(exerciseId);
    });
  });

  var passed = new Set(readPassedIds().filter(function (exerciseId) {
    return validExerciseIds.has(exerciseId);
  }));
  var drafts = readDrafts();
  var learningProgress = readLearningProgress();
  var editorMode = readEditorMode();
  var authToken = safeRead(STORAGE_KEYS.authToken) || "";
  var currentUser = null;
  var syncState = { kind: "idle", message: authToken ? "Restoring your session…" : "Local-only mode" };
  var revealedHints = new Map();
  var runResults = new Map();
  var draftPersistTimer = null;
  var stateSyncTimer = null;
  var suppressStateSync = false;
  var remoteFilesLoaded = new Set();
  var accountFileSaves = new Map();
  var activeEditor = null;
  var activeRun = null;
  var currentRoute = null;
  var selectedBadgeId = null;
  var pythonRunner = createPythonRunner();

  persistPassed();
  syncThemeButton();
  syncSoundButton();
  renderProfile();
  renderRoute(false);

  window.addEventListener("hashchange", function () {
    renderRoute(true);
  });
  window.addEventListener("pagehide", flushDrafts);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.soundToggle.addEventListener("click", toggleSound);
  elements.profileButton.addEventListener("click", toggleProfile);
  elements.profilePanel.addEventListener("click", handleProfileClick);
  elements.profilePanel.addEventListener("submit", handleProfileSubmit);
  elements.main.addEventListener("click", handleMainClick);
  elements.main.addEventListener("change", handleMainChange);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("keydown", handleDocumentKeydown);
  restoreAuthenticatedSession();

  function renderRoute(announceChange) {
    var parsed = parseRoute();

    if (parsed.redirect) {
      window.history.replaceState(null, "", parsed.redirect);
      parsed = parseRoute();
    }

    disposeActiveEditor();
    currentRoute = parsed;
    closeProfile();

    var view;
    if (parsed.name === "chapter") {
      view = renderChapterHub(parsed.chapter);
      document.title = parsed.chapter.title + " · Python EduGround";
    } else if (parsed.name === "exercises") {
      view = renderExerciseCatalogue(parsed.chapter);
      document.title = "Exercises · " + parsed.chapter.title;
    } else if (parsed.name === "tutorial") {
      view = renderTutorial(parsed.chapter);
      document.title = "Runbook · " + parsed.chapter.title;
    } else if (parsed.name === "exercise") {
      view = renderExerciseWorkspace(parsed.exercise, parsed.chapter);
      document.title = parsed.exercise.title + " · Python Exercise";
    } else if (parsed.name === "badges") {
      view = renderBadgesPage();
      document.title = "Badges · Python EduGround";
    } else {
      view = renderDashboard();
      document.title = "Python EduGround · Learning Path";
    }

    elements.main.replaceChildren(view);
    renderProfile();

    if (parsed.name === "exercise") {
      window.requestAnimationFrame(function () {
        initializeExerciseEditor(parsed.exercise);
      });
    }

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (announceChange) {
      announce(getRouteAnnouncement(parsed));
    }
  }

  function parseRoute() {
    var rawHash = window.location.hash.slice(1);
    var decoded;
    try {
      decoded = decodeURIComponent(rawHash);
    } catch (error) {
      decoded = rawHash;
    }

    decoded = decoded.replace(/^\/+|\/+$/g, "");
    if (!decoded || decoded === "home") {
      return { name: "home" };
    }

    if (chapterById.has(decoded)) {
      return { redirect: "#chapter/" + encodeURIComponent(decoded) };
    }

    var parts = decoded.split("/");
    if (parts[0] === "chapter" && chapterById.has(parts[1])) {
      var chapter = chapterById.get(parts[1]);
      if (!parts[2]) {
        return { name: "chapter", chapter: chapter };
      }
      if (parts[2] === "exercises") {
        return { name: "exercises", chapter: chapter };
      }
      if (parts[2] === "tutorials" || parts[2] === "tutorial" || parts[2] === "runbook") {
        return { name: "tutorial", chapter: chapter };
      }
    }

    if (parts[0] === "exercise" && exerciseById.has(parts[1])) {
      return {
        name: "exercise",
        exercise: exerciseById.get(parts[1]),
        chapter: chapterForExercise.get(parts[1])
      };
    }

    if (decoded === "profile/badges") {
      return { name: "badges" };
    }

    return { redirect: "#home" };
  }

  function getRouteAnnouncement(route) {
    if (route.name === "chapter") {
      return "Opened " + route.chapter.title + ".";
    }
    if (route.name === "exercises") {
      return "Opened the " + route.chapter.title + " exercise list.";
    }
    if (route.name === "tutorial") {
      return "Opened the " + route.chapter.title + " tutorial and runbook.";
    }
    if (route.name === "exercise") {
      return "Opened " + route.exercise.title + ".";
    }
    if (route.name === "badges") {
      return "Opened all badges.";
    }
    return "Opened the chapter dashboard.";
  }

  function renderDashboard() {
    var wrapper = el("div", "page-shell dashboard-page");
    var stats = getOverallStats();
    var rank = getCurrentRank(stats);
    var nextRank = getNextRank(rank);
    var continueChapter = getContinueChapter();
    var continueChapterProgress = getChapterProgress(continueChapter);
    var continueLearningProgress = getChapterLearningProgress(continueChapter);
    var hero = el("section", "dashboard-hero");
    var heroCopy = el("div", "dashboard-hero__copy");
    var eyebrow = el("p", "eyebrow", "Python learning path");
    var title = el("h1", null, "Build fluency, one green test at a time.");
    var lede = el(
      "p",
      "dashboard-hero__lede",
      "Explore 11 focused chapters, learn from practical runbooks, then solve every exercise in a real Python editor."
    );
    var heroActions = el("div", "button-row");
    var continueLink = anchor(
      "#chapter/" + encodeURIComponent(String(continueChapter.id)),
      "button button--primary",
      stats.passedExercises > 0 ? "Continue learning" : "Start the path"
    );
    var badgeLink = anchor("#profile/badges", "button button--quiet", "View badges");
    var heroProgress = el("section", "dashboard-progress");
    var currentLearning = anchor(
      "#chapter/" + encodeURIComponent(String(continueChapter.id)),
      "dashboard-current-learning"
    );
    var currentLearningMarker = el("span", "dashboard-current-learning__marker", "→");
    var currentLearningCopy = el("span", "dashboard-current-learning__copy");
    currentLearningMarker.setAttribute("aria-hidden", "true");
    currentLearningCopy.append(
      el("span", "dashboard-current-learning__label", stats.passedExercises ? "Continue your current chapter" : "Recommended starting point"),
      el("strong", null, "Chapter " + padChapter(continueChapter.number) + " · " + continueChapter.title),
      el(
        "span",
        "dashboard-current-learning__meta",
        continueChapterProgress.done + " / " + continueChapterProgress.total + " exercises · " +
          continueLearningProgress.done + " / " + continueLearningProgress.total + " guide sections"
      )
    );
    currentLearning.append(currentLearningMarker, currentLearningCopy, el("span", "dashboard-current-learning__open", "Open →"));
    var progressTop = el("div", "dashboard-progress__top");
    var progressLabel = el("div");
    var progressEyebrow = el("span", "dashboard-progress__label", "Overall progress");
    var progressTitle = el("strong", null, rank.name);
    var progressPercent = el("strong", "dashboard-progress__percent", stats.progressPercent + "%");
    var progress = progressElement(
      stats.passedExercises,
      stats.totalExercises,
      stats.passedExercises + " of " + stats.totalExercises + " exercises passed"
    );
    var statGrid = el("div", "dashboard-stat-grid");

    title.id = "dashboard-title";
    hero.setAttribute("aria-labelledby", title.id);
    heroActions.append(continueLink, badgeLink);
    heroCopy.append(eyebrow, title, lede, currentLearning, heroActions);

    progressLabel.append(progressEyebrow, progressTitle);
    progressTop.append(progressLabel, progressPercent);
    heroProgress.append(progressTop, progress);
    statGrid.append(
      renderStat("Collected stars", stats.earnedStars + " / " + stats.maxStars, "★"),
      renderStat("Exercises passed", stats.passedExercises + " / " + stats.totalExercises, "✓"),
      renderStat("Chapters mastered", stats.completedChapters + " / " + chapters.length, "◆")
    );
    heroProgress.append(statGrid);
    if (nextRank) {
      heroProgress.append(
        el(
          "p",
          "dashboard-progress__next",
          Math.max(0, nextRank.minStars - stats.earnedStars) + " stars to Level " + nextRank.level + " · " + nextRank.name
        )
      );
    } else {
      heroProgress.append(el("p", "dashboard-progress__next", "The full constellation is yours."));
    }
    hero.append(heroCopy, heroProgress);

    var section = el("section", "chapter-map");
    var headingRow = el("header", "section-heading section-heading--row");
    var headingCopy = el("div");
    var chapterTitle = el("h2", null, "Choose a chapter");
    var chapterCopy = el("p", null, "Open a chapter to choose its exercises or guided runbook.");
    var courseCount = el("span", "section-heading__count", chapters.length + " chapters");
    var grid = el("div", "chapter-grid");

    headingCopy.append(chapterTitle, chapterCopy);
    headingRow.append(headingCopy, courseCount);
    section.append(headingRow);
    chapters.forEach(function (chapter, index) {
      grid.append(renderChapterCard(chapter, index));
    });
    section.append(grid);

    var note = el("aside", "source-note");
    note.append(
      el("span", "source-note__icon", "i"),
      el("p", null, course.note || "Exercises are reconstructed from the solution files in this repository.")
    );

    wrapper.append(hero, section, note);
    return wrapper;
  }

  function renderChapterCard(chapter, index) {
    var progress = getChapterProgress(chapter);
    var card = anchor(
      "#chapter/" + encodeURIComponent(String(chapter.id)),
      "chapter-card" + (progress.done === progress.total && progress.total ? " is-complete" : "")
    );
    var art = renderChapterArt(chapter, "chapter-card__art");
    var body = el("div", "chapter-card__body");
    var top = el("div", "chapter-card__top");
    var number = el("span", "chapter-number", "Chapter " + padChapter(chapter.number));
    var starCount = el("span", "chapter-card__stars", "★ " + progress.stars + " / " + progress.maxStars);
    var title = el("h3", null, chapter.title);
    var summary = el("p", "chapter-card__summary", chapter.summary);
    var tags = renderTags(chapter.topics, 3);
    var progressRow = el("div", "chapter-card__progress-row");
    var progressLabel = el("span", null, progress.done + " / " + progress.total + " passed");
    var progressPercent = el("strong", null, progress.percent + "%");
    var open = el("span", "chapter-card__open", progress.done ? "Continue chapter →" : "Open chapter →");

    card.style.setProperty("--card-delay", Math.min(index * 35, 280) + "ms");
    top.append(number, starCount);
    progressRow.append(progressLabel, progressPercent);
    body.append(
      top,
      title,
      summary,
      tags,
      progressRow,
      progressElement(progress.done, progress.total, chapter.title + ": " + progress.done + " of " + progress.total + " passed"),
      open
    );
    card.append(art, body);
    return card;
  }

  function renderStat(label, value, symbol) {
    var item = el("div", "dashboard-stat");
    var icon = el("span", "dashboard-stat__icon", symbol);
    icon.setAttribute("aria-hidden", "true");
    item.append(icon, el("strong", null, value), el("span", null, label));
    return item;
  }

  function renderChapterHub(chapter) {
    var wrapper = el("div", "page-shell chapter-page");
    var progress = getChapterProgress(chapter);
    var hero = el("section", "chapter-hero");
    var art = renderChapterArt(chapter, "chapter-hero__art");
    var content = el("div", "chapter-hero__content");
    var eyebrow = el("p", "eyebrow", "Chapter " + padChapter(chapter.number));
    var title = el("h1", null, chapter.title);
    var summary = el("p", "chapter-hero__summary", chapter.summary);
    var progressPanel = el("div", "chapter-hero__progress");
    var progressText = el("div", "chapter-hero__progress-text");

    wrapper.append(renderBreadcrumbs([
      { label: "Chapters", href: "#home" },
      { label: chapter.title }
    ]));

    progressText.append(
      el("strong", null, progress.percent + "% complete"),
      el("span", null, progress.done + " of " + progress.total + " exercises · " + progress.stars + " of " + progress.maxStars + " stars")
    );
    progressPanel.append(
      progressText,
      progressElement(progress.done, progress.total, chapter.title + " progress")
    );
    content.append(eyebrow, title, summary, renderTags(chapter.topics), progressPanel);
    hero.append(art, content);

    var choiceSection = el("section", "chapter-choices");
    var choiceHeading = el("header", "section-heading");
    choiceHeading.append(
      el("h2", null, "What would you like to do?"),
      el("p", null, "Study the ideas first or jump into the exercises. Progress saves locally, with optional account sync.")
    );
    var choiceGrid = el("div", "choice-grid");
    var exercisesChoice = renderChoiceCard({
      href: "#chapter/" + encodeURIComponent(String(chapter.id)) + "/exercises",
      icon: ">_",
      eyebrow: progress.done ? "Continue practising" : "Start practising",
      title: "Exercises",
      copy: "Solve " + progress.total + " challenges in the full Python editor, with visible examples and hidden tests.",
      meta: progress.done + " passed · " + progress.stars + " stars earned",
      action: "Browse exercises"
    });
    var chapterLearning = getChapterLearning(chapter);
    var tutorialCount = chapterLearning && Array.isArray(chapterLearning.tutorial)
      ? chapterLearning.tutorial.length
      : 0;
    var guideProgress = getChapterLearningProgress(chapter);
    var runbookChoice = renderChoiceCard({
      href: "#chapter/" + encodeURIComponent(String(chapter.id)) + "/tutorials",
      icon: "{ }",
      eyebrow: "Learn the concepts",
      title: "Runbook & tutorials",
      copy: "Build a mental model with worked Python examples, common pitfalls, and a practical problem-solving sequence.",
      meta: guideProgress.done + " / " + guideProgress.total + " guide sections understood · " + tutorialCount + " tutorials",
      action: "Open learning guide"
    });
    choiceGrid.append(exercisesChoice, runbookChoice);
    choiceSection.append(choiceHeading, choiceGrid);

    var nextExercise = getExercises(chapter).find(function (exercise) {
      return !passed.has(String(exercise.id));
    }) || getExercises(chapter)[0];
    if (nextExercise) {
      var continueStrip = el("aside", "continue-strip");
      var continueCopy = el("div");
      continueCopy.append(
        el("span", "continue-strip__label", progress.done ? "Next exercise" : "Recommended first step"),
        el("strong", null, nextExercise.title),
        el("span", null, nextExercise.prompt)
      );
      continueStrip.append(
        continueCopy,
        anchor("#exercise/" + encodeURIComponent(String(nextExercise.id)), "button button--primary", "Open editor")
      );
      wrapper.append(hero, choiceSection, continueStrip);
    } else {
      wrapper.append(hero, choiceSection);
    }
    return wrapper;
  }

  function renderChoiceCard(config) {
    var card = anchor(config.href, "choice-card");
    var icon = el("span", "choice-card__icon", config.icon);
    var copy = el("div", "choice-card__copy");
    var action = el("span", "choice-card__action", config.action + " →");
    icon.setAttribute("aria-hidden", "true");
    copy.append(
      el("span", "eyebrow", config.eyebrow),
      el("h3", null, config.title),
      el("p", null, config.copy),
      el("span", "choice-card__meta", config.meta),
      action
    );
    card.append(icon, copy);
    return card;
  }

  function renderExerciseCatalogue(chapter) {
    var wrapper = el("div", "page-shell catalogue-page");
    var progress = getChapterProgress(chapter);
    var header = el("header", "catalogue-header");
    var heading = el("div", "catalogue-header__copy");
    var title = el("h1", null, chapter.title + " exercises");
    var progressBox = el("div", "catalogue-progress");

    wrapper.append(renderBreadcrumbs([
      { label: "Chapters", href: "#home" },
      { label: chapter.title, href: "#chapter/" + encodeURIComponent(String(chapter.id)) },
      { label: "Exercises" }
    ]));

    heading.append(
      el("p", "eyebrow", "Chapter " + padChapter(chapter.number) + " · Practice"),
      title,
      el("p", null, "A green star means every visible and hidden test passed. Difficulty controls how many stars you collect.")
    );
    progressBox.append(
      el("strong", null, progress.done + " / " + progress.total + " passed"),
      el("span", null, "★ " + progress.stars + " / " + progress.maxStars),
      progressElement(progress.done, progress.total, chapter.title + " exercise progress")
    );
    header.append(heading, progressBox);
    wrapper.append(header);

    var list = el("ol", "exercise-list");
    getExercises(chapter).forEach(function (exercise, index) {
      list.append(renderExerciseRow(exercise, chapter, index));
    });
    wrapper.append(list);
    return wrapper;
  }

  function renderExerciseRow(exercise, chapter, index) {
    var exerciseId = String(exercise.id);
    var isPassed = passed.has(exerciseId);
    var testSpec = testData[exerciseId] || {};
    var tests = Array.isArray(testSpec.tests) ? testSpec.tests : [];
    var visibleCount = tests.filter(function (test) { return !test.hidden; }).length;
    var hiddenCount = tests.length - visibleCount;
    var item = el("li", "exercise-list__item");
    var card = anchor(
      "#exercise/" + encodeURIComponent(exerciseId),
      "exercise-row" + (isPassed ? " is-passed" : "")
    );
    var number = el("span", "exercise-row__number", String(index + 1).padStart(2, "0"));
    var status = el("span", "exercise-row__status");
    var copy = el("div", "exercise-row__copy");
    var titleRow = el("div", "exercise-row__title-row");
    var title = el("h2", null, exercise.title);
    var meta = el("div", "exercise-row__meta");
    var open = el("span", "exercise-row__open", "Open IDE →");
    var statusStar = el("span", "exercise-row__status-star", isPassed ? "★" : "☆");
    statusStar.setAttribute("aria-hidden", "true");
    status.append(statusStar, el("span", null, isPassed ? "Passed" : drafts.has(exerciseId) ? "Draft saved" : "Not passed"));
    titleRow.append(title, renderDifficultyStars(exercise, isPassed));
    meta.append(
      status,
      el("span", null, visibleCount + " examples"),
      el("span", null, hiddenCount + " hidden " + (hiddenCount === 1 ? "test" : "tests"))
    );
    copy.append(titleRow, el("p", null, exercise.prompt), renderTags(exercise.topics, 4), meta);
    card.append(number, copy, open);
    item.append(card);
    return item;
  }

  function renderTutorial(chapter) {
    var content = getChapterLearning(chapter);
    var tutorials = content && Array.isArray(content.tutorial) ? content.tutorial : [];
    var runbook = content && Array.isArray(content.runbook) ? content.runbook : [];
    var objectives = content && Array.isArray(content.objectives) ? content.objectives : [];
    var deepDive = content && content.deepDive && typeof content.deepDive === "object" ? content.deepDive : null;
    var wrapper = el("div", "page-shell tutorial-page");

    wrapper.append(renderBreadcrumbs([
      { label: "Chapters", href: "#home" },
      { label: chapter.title, href: "#chapter/" + encodeURIComponent(String(chapter.id)) },
      { label: "Runbook & tutorials" }
    ]));

    var hero = el("header", "tutorial-hero");
    var heroCopy = el("div", "tutorial-hero__copy");
    heroCopy.append(
      el("p", "eyebrow", "Chapter " + padChapter(chapter.number) + " · Learning guide"),
      el("h1", null, content && content.title ? content.title : chapter.title),
      el("p", "tutorial-hero__subtitle", content && content.subtitle ? content.subtitle : chapter.summary)
    );
    var objectiveBox = el("section", "objective-box");
    objectiveBox.append(el("h2", null, "You will learn to"));
    var objectiveList = el("ul");
    objectives.forEach(function (objective) {
      objectiveList.append(el("li", null, objective));
    });
    if (!objectives.length) {
      objectiveList.append(el("li", null, "Apply this chapter's ideas with a clear trace and a tested result."));
    }
    objectiveBox.append(objectiveList, renderLearningProgressPanel(chapter));
    hero.append(heroCopy, objectiveBox);
    var boundary = el("aside", "tutorial-boundary");
    boundary.append(
      el("span", "tutorial-boundary__icon", "◌"),
      el("div", null),
      anchor("#chapter/" + encodeURIComponent(String(chapter.id)) + "/exercises", "button button--quiet", "Open exercises")
    );
    boundary.children[1].append(
      el("strong", null, "Learn the idea without seeing the answer"),
      el("p", null, "Every example uses a different situation from the exercises. Transfer the concept yourself, then use hints and tests for feedback.")
    );
    var learningLoop = el("ol", "learning-loop");
    [
      ["1", "Understand", "Name the input, output, and rule."],
      ["2", "Predict", "Trace a fresh example by hand."],
      ["3", "Build", "Write the smallest working step."],
      ["4", "Explain", "Use each test result as evidence."]
    ].forEach(function (step) {
      var item = el("li");
      item.append(el("span", null, step[0]), el("strong", null, step[1]), el("small", null, step[2]));
      learningLoop.append(item);
    });
    wrapper.append(hero, boundary, learningLoop);

    var layout = el("div", "tutorial-layout");
    var toc = el("nav", "tutorial-toc");
    var tocTitle = el("strong", null, "On this page");
    var tocList = el("ol");
    toc.setAttribute("aria-label", "Tutorial contents");
    tutorials.forEach(function (tutorial, index) {
      var item = el("li");
      var button = el("button", "tutorial-toc__button", String(index + 1).padStart(2, "0") + " · " + tutorial.title);
      button.type = "button";
      button.dataset.scrollTarget = "tutorial-section-" + index;
      button.dataset.learningToc = "tutorial-" + index;
      button.classList.toggle("is-understood", isLearningUnderstood(chapter, "tutorial-" + index));
      item.append(button);
      tocList.append(item);
    });
    if (hasDeepDiveContent(deepDive)) {
      var deepDiveItem = el("li");
      var deepDiveButton = el("button", "tutorial-toc__button", "Deep dive · Practise the model");
      deepDiveButton.type = "button";
      deepDiveButton.dataset.scrollTarget = "chapter-deep-dive";
      deepDiveItem.append(deepDiveButton);
      tocList.append(deepDiveItem);
    }
    var runbookButtonItem = el("li");
    var runbookButton = el("button", "tutorial-toc__button", "Runbook · Practice loop");
    runbookButton.type = "button";
    runbookButton.dataset.scrollTarget = "chapter-runbook";
    runbookButton.dataset.learningToc = "runbook";
    runbookButton.classList.toggle("is-understood", isLearningUnderstood(chapter, "runbook"));
    runbookButtonItem.append(runbookButton);
    tocList.append(runbookButtonItem);
    toc.append(tocTitle, tocList);

    var article = el("article", "tutorial-article");
    if (!tutorials.length) {
      article.append(renderFallbackTutorial(chapter));
    } else {
      tutorials.forEach(function (tutorial, index) {
        article.append(renderTutorialSection(chapter, tutorial, index));
      });
    }
    if (hasDeepDiveContent(deepDive)) {
      article.append(renderDeepDive(chapter, deepDive));
    }
    article.append(renderDeepRunbook(chapter, runbook, content));
    layout.append(toc, article);
    wrapper.append(layout);

    var cta = el("aside", "tutorial-cta");
    var ctaCopy = el("div");
    ctaCopy.append(
      el("span", "eyebrow", "Put the model to work"),
      el("h2", null, "Ready for the exercises?"),
      el("p", null, "Use the runbook while you trace examples, write code, and interpret failing tests.")
    );
    cta.append(
      ctaCopy,
      anchor("#chapter/" + encodeURIComponent(String(chapter.id)) + "/exercises", "button button--primary", "Browse exercises")
    );
    wrapper.append(cta);
    return wrapper;
  }

  function renderLearningProgressPanel(chapter) {
    var stats = getChapterLearningProgress(chapter);
    var panel = el("section", "tutorial-progress");
    var top = el("div", "tutorial-progress__top");
    var copy = el("div");
    var count = el("strong", "tutorial-progress__count", stats.done + " / " + stats.total);
    var bar = progressElement(stats.done, stats.total, chapter.title + " learning guide progress");
    var status = el(
      "p",
      "tutorial-progress__status",
      stats.done === stats.total ? "Guide complete — revisit any section whenever you need it." : "Mark each concept after you can explain it in your own words."
    );
    panel.dataset.learningProgressPanel = String(chapter.id);
    count.dataset.learningProgressCount = String(chapter.id);
    bar.dataset.learningProgressBar = String(chapter.id);
    status.dataset.learningProgressStatus = String(chapter.id);
    copy.append(el("span", null, "Learning guide"), el("strong", null, stats.percent + "% understood"));
    top.append(copy, count);
    panel.append(top, bar, status);
    return panel;
  }

  function renderLearningToggle(chapter, itemId) {
    var understood = isLearningUnderstood(chapter, itemId);
    var button = el("button", "learning-mark" + (understood ? " is-understood" : ""), understood ? "Understood ✓" : "Mark understood");
    button.type = "button";
    button.dataset.learningToggle = itemId;
    button.dataset.chapterId = String(chapter.id);
    button.setAttribute("aria-pressed", String(understood));
    return button;
  }

  function renderTutorialSection(chapter, tutorial, index) {
    var section = el("section", "tutorial-section");
    var heading = el("header", "tutorial-section__heading");
    var number = el("span", "tutorial-section__number", String(index + 1).padStart(2, "0"));
    var title = el("h2", null, tutorial.title);
    var codeBox = el("div", "tutorial-code");
    var codeHeader = el("div", "tutorial-code__header");
    var pre = el("pre");
    var code = el("code", null, tutorial.exampleCode || "# Try a small example here.");
    var checklist = el("section", "tutorial-checklist");
    var checklistList = el("ul");
    var takeaway = el("aside", "tutorial-takeaway");
    var pitfall = el("aside", "tutorial-pitfall");
    var learningItemId = "tutorial-" + index;

    section.id = "tutorial-section-" + index;
    section.dataset.learningItem = learningItemId;
    section.classList.toggle("is-understood", isLearningUnderstood(chapter, learningItemId));
    heading.append(number, title, renderLearningToggle(chapter, learningItemId));
    var codeMeta = el("span", "tutorial-code__meta");
    var copyButton = el("button", "tutorial-copy-button", "Copy example");
    copyButton.type = "button";
    copyButton.dataset.copySnippet = "true";
    codeMeta.append(el("span", null, "Python 3"), copyButton);
    codeHeader.append(el("span", null, "concept-example.py"), codeMeta);
    pre.append(code);
    codeBox.append(codeHeader, pre);

    checklist.append(el("h3", null, "Check your understanding"));
    (tutorial.checklist || []).forEach(function (item) {
      checklistList.append(el("li", null, item));
    });
    checklist.append(checklistList);

    takeaway.append(el("strong", null, "Key takeaway"), el("p", null, tutorial.takeaway));
    pitfall.append(el("strong", null, "Common pitfall"), el("p", null, tutorial.commonPitfall));
    section.append(heading, el("p", "tutorial-section__explanation", tutorial.explanation), codeBox, checklist, takeaway, pitfall);
    return section;
  }

  function hasDeepDiveContent(deepDive) {
    return Boolean(deepDive && (
      deepDive.mentalModel ||
      (Array.isArray(deepDive.guidedPractice) && deepDive.guidedPractice.length) ||
      (Array.isArray(deepDive.glossary) && deepDive.glossary.length) ||
      (Array.isArray(deepDive.debugChecklist) && deepDive.debugChecklist.length) ||
      deepDive.checkpoint
    ));
  }

  function renderDeepDive(chapter, deepDive) {
    var section = el("section", "tutorial-section deep-dive-section");
    var heading = el("header", "tutorial-section__heading");
    heading.append(el("span", "tutorial-section__number", "DD"), el("h2", null, "Deepen the mental model"));
    section.id = "chapter-deep-dive";
    section.append(
      heading,
      el("p", "tutorial-section__explanation", "Slow down here: trace the model, practise on a fresh situation, then check what you can explain without running code.")
    );

    if (deepDive.mentalModel && typeof deepDive.mentalModel === "object") {
      section.append(renderMentalModel(deepDive.mentalModel));
    }
    if (Array.isArray(deepDive.guidedPractice) && deepDive.guidedPractice.length) {
      section.append(renderGuidedPractice(chapter, deepDive.guidedPractice));
    }
    if (
      (Array.isArray(deepDive.glossary) && deepDive.glossary.length) ||
      (Array.isArray(deepDive.debugChecklist) && deepDive.debugChecklist.length)
    ) {
      section.append(renderReferenceGrid(deepDive.glossary, deepDive.debugChecklist));
    }
    if (deepDive.checkpoint && typeof deepDive.checkpoint === "object") {
      section.append(renderCheckpoint(chapter, deepDive.checkpoint));
    }
    return section;
  }

  function renderMentalModel(model) {
    var block = el("section", "mental-model");
    var title = el("h3", null, model.title || "Mental model");
    block.append(title);
    if (model.body) {
      block.append(el("p", "mental-model__body", model.body));
    }
    if (Array.isArray(model.steps) && model.steps.length) {
      var flow = el("ol", "mental-model__flow");
      model.steps.forEach(function (step, index) {
        var item = el("li");
        var marker = el("span", "mental-model__marker", String(index + 1).padStart(2, "0"));
        var copy = el("div");
        copy.append(el("strong", null, step && step.label ? step.label : "Step " + (index + 1)));
        if (step && step.detail) {
          copy.append(el("p", null, step.detail));
        }
        item.append(marker, copy);
        flow.append(item);
      });
      block.append(flow);
    }
    return block;
  }

  function renderGuidedPractice(chapter, practices) {
    var block = el("section", "guided-practice");
    var heading = el("header", "deep-dive-heading");
    heading.append(el("span", "eyebrow", "Guided practice"), el("h3", null, "Predict before you reveal"));
    block.append(heading);
    var grid = el("div", "guided-practice__grid");
    practices.forEach(function (practice, index) {
      var card = el("article", "guided-practice-card");
      var revealId = "guided-reveal-" + domId(chapter.id) + "-" + index;
      card.append(el("span", "guided-practice-card__number", "Practice " + (index + 1)), el("h4", null, practice.title || "Trace this example"));
      if (practice.prompt) {
        card.append(el("p", "guided-practice-card__prompt", practice.prompt));
      }
      if (practice.starterCode) {
        var codeBox = el("div", "tutorial-code guided-practice-code");
        var codeHeader = el("div", "tutorial-code__header");
        var codeMeta = el("span", "tutorial-code__meta");
        var copyButton = el("button", "tutorial-copy-button", "Copy starter");
        var pre = el("pre");
        copyButton.type = "button";
        copyButton.dataset.copySnippet = "true";
        copyButton.dataset.copyRestingLabel = "Copy starter";
        codeMeta.append(el("span", null, "Python 3"), copyButton);
        codeHeader.append(el("span", null, "practice-starter.py"), codeMeta);
        pre.append(el("code", null, practice.starterCode));
        codeBox.append(codeHeader, pre);
        card.append(codeBox);
      }
      if (Array.isArray(practice.questions) && practice.questions.length) {
        var questions = el("ol", "guided-practice-card__questions");
        practice.questions.forEach(function (question) {
          questions.append(el("li", null, question));
        });
        card.append(questions);
      }
      if (practice.reveal) {
        var revealButton = el("button", "button button--quiet guided-practice-card__reveal", "Reveal coaching note");
        var reveal = el("aside", "guided-practice-card__answer", practice.reveal);
        revealButton.type = "button";
        revealButton.dataset.revealPractice = revealId;
        revealButton.setAttribute("aria-expanded", "false");
        revealButton.setAttribute("aria-controls", revealId);
        reveal.id = revealId;
        reveal.hidden = true;
        card.append(revealButton, reveal);
      }
      grid.append(card);
    });
    block.append(grid);
    return block;
  }

  function renderReferenceGrid(glossary, debuggingChecklist) {
    var grid = el("div", "deep-reference-grid");
    if (Array.isArray(glossary) && glossary.length) {
      var glossarySection = el("section", "glossary-panel");
      var terms = el("dl", "glossary-list");
      glossarySection.append(el("span", "eyebrow", "Language of the chapter"), el("h3", null, "Glossary"));
      glossary.forEach(function (entry) {
        if (!entry) {
          return;
        }
        terms.append(el("dt", null, entry.term || "Term"), el("dd", null, entry.definition || ""));
      });
      glossarySection.append(terms);
      grid.append(glossarySection);
    }
    if (Array.isArray(debuggingChecklist) && debuggingChecklist.length) {
      var debugSection = el("section", "debug-checklist");
      var list = el("ul");
      debugSection.append(el("span", "eyebrow", "When a test is red"), el("h3", null, "Debugging checklist"));
      debuggingChecklist.forEach(function (item) {
        list.append(el("li", null, item));
      });
      debugSection.append(list);
      grid.append(debugSection);
    }
    return grid;
  }

  function renderCheckpoint(chapter, checkpoint) {
    var block = el("section", "knowledge-check");
    var options = Array.isArray(checkpoint.options) ? checkpoint.options : [];
    var feedback = el("p", "knowledge-check__feedback");
    var feedbackId = "checkpoint-feedback-" + domId(chapter.id);
    block.dataset.checkpoint = String(chapter.id);
    block.dataset.checkpointExplanation = checkpoint.explanation || "Review the mental model and explain why the option fits.";
    block.append(el("span", "eyebrow", "Quick checkpoint"), el("h3", null, checkpoint.question || "Which statement best matches the model?"));
    var optionList = el("div", "knowledge-check__options");
    optionList.setAttribute("role", "group");
    optionList.setAttribute("aria-label", "Checkpoint answer choices");
    options.forEach(function (option, index) {
      var button = el("button", "knowledge-check__option", option);
      button.type = "button";
      button.dataset.checkpointOption = String(index);
      button.dataset.answerIndex = String(Number(checkpoint.answerIndex));
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-describedby", feedbackId);
      optionList.append(button);
    });
    feedback.id = feedbackId;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.hidden = true;
    block.append(optionList, feedback);
    return block;
  }

  function renderDeepRunbook(chapter, steps, content) {
    var section = el("section", "runbook-section");
    var heading = el("header", "tutorial-section__heading");
    heading.append(el("span", "tutorial-section__number", "RB"), el("h2", null, "Problem-solving runbook"), renderLearningToggle(chapter, "runbook"));
    section.id = "chapter-runbook";
    section.dataset.learningItem = "runbook";
    section.classList.toggle("is-understood", isLearningUnderstood(chapter, "runbook"));
    section.append(
      heading,
      el("p", "tutorial-section__explanation", "Use this repeatable loop when a problem feels vague or a test fails. Each phase ends with evidence you can inspect.")
    );
    var coachConversation = content && Array.isArray(content.coachConversation) ? content.coachConversation : [];
    var conversation = renderCoachConversation(chapter, coachConversation);
    if (conversation) {
      section.append(conversation);
    }
    var list = el("ol", "runbook-steps");
    var sourceSteps = steps.length ? steps : (chapter.runbook || []).map(function (step, index) {
      return { phase: String(index + 1), action: step.body, evidence: "A written trace or testable claim." };
    });
    sourceSteps.forEach(function (step) {
      var item = el("li", "runbook-step");
      var phase = el("div", "runbook-step__phase", step.phase);
      var body = el("div", "runbook-step__body");
      body.append(el("p", "runbook-step__action", step.action));
      if (step.why) {
        var why = el("aside", "runbook-step__why");
        why.append(el("strong", null, "Why this matters"), el("p", null, step.why));
        body.append(why);
      }
      if (step.whenStuck) {
        var stuck = el("aside", "runbook-step__stuck");
        stuck.append(el("strong", null, "When you are stuck"), el("p", null, step.whenStuck));
        body.append(stuck);
      }
      body.append(el("span", "runbook-step__evidence", "Evidence: " + step.evidence));
      item.append(phase, body);
      list.append(item);
    });
    section.append(list);
    var documentation = content && Array.isArray(content.documentation) ? content.documentation : [];
    var documentationPanel = renderPythonDocumentation(chapter, documentation);
    if (documentationPanel) {
      section.append(documentationPanel);
    }
    return section;
  }

  function renderCoachConversation(chapter, conversation) {
    var exchanges = conversation.filter(function (exchange) {
      return exchange && (exchange.learner || exchange.coach);
    });
    if (!exchanges.length) {
      return null;
    }

    var block = el("section", "runbook-conversation");
    var headingId = "runbook-conversation-" + domId(chapter.id);
    var heading = el("h3", null, "Talk it through with your Python coach");
    var intro = el("p", "runbook-conversation__intro", "A quick question-and-answer exchange to make the idea easier to reuse while you code.");
    var dialogue = el("ol", "runbook-dialogue");
    heading.id = headingId;
    block.setAttribute("aria-labelledby", headingId);
    dialogue.setAttribute("aria-label", "Learner and Python coach conversation");

    exchanges.forEach(function (exchange) {
      var turn = el("li", "runbook-dialogue__exchange");
      if (exchange.learner) {
        turn.append(renderDialogueMessage("learner", "Learner", exchange.learner));
      }
      if (exchange.coach) {
        turn.append(renderDialogueMessage("coach", "Python coach", exchange.coach));
      }
      dialogue.append(turn);
    });

    block.append(el("span", "eyebrow", "Coach conversation"), heading, intro, dialogue);
    return block;
  }

  function renderDialogueMessage(kind, speaker, message) {
    var bubble = el("div", "runbook-dialogue__message runbook-dialogue__message--" + kind);
    var label = el("strong", "runbook-dialogue__speaker", speaker);
    var copy = el("p", null, message);
    bubble.append(label, copy);
    return bubble;
  }

  function renderPythonDocumentation(chapter, documentation) {
    var resources = documentation.reduce(function (items, resource) {
      var safeUrl = resource && getOfficialPythonUrl(resource.url);
      if (!resource || !resource.label || !safeUrl) {
        return items;
      }
      items.push({
        label: String(resource.label),
        description: resource.description ? String(resource.description) : "Read the related topic in Python's official documentation.",
        url: safeUrl
      });
      return items;
    }, []);
    if (!resources.length) {
      return null;
    }

    var block = el("section", "runbook-documentation");
    var headingId = "runbook-documentation-" + domId(chapter.id);
    var heading = el("h3", null, "Continue with the official Python docs");
    var intro = el("p", "runbook-documentation__intro", "These references deepen the chapter without revealing an exercise solution.");
    var grid = el("div", "runbook-documentation__grid");
    heading.id = headingId;
    block.setAttribute("aria-labelledby", headingId);

    resources.forEach(function (resource) {
      var link = anchor(resource.url, "runbook-documentation__card");
      var title = el("strong", null, resource.label);
      var description = el("p", null, resource.description);
      var action = el("span", "runbook-documentation__action", "Open official docs ↗");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", resource.label + " — open the official Python documentation in a new tab");
      action.setAttribute("aria-hidden", "true");
      link.append(title, description, action);
      grid.append(link);
    });

    block.append(el("span", "eyebrow", "Official references"), heading, intro, grid);
    return block;
  }

  function getOfficialPythonUrl(value) {
    if (typeof value !== "string") {
      return null;
    }
    try {
      var url = new URL(value);
      var isOfficialDocs = url.origin === "https://docs.python.org" && url.pathname.startsWith("/3/");
      if (!isOfficialDocs || url.username || url.password) {
        return null;
      }
      return url.href;
    } catch (error) {
      return null;
    }
  }

  function renderFallbackTutorial(chapter) {
    var section = el("section", "tutorial-section");
    section.append(el("h2", null, "Start with a concrete trace"), el("p", null, chapter.summary));
    return section;
  }

  function renderBadgesPage() {
    var wrapper = el("div", "page-shell badges-page");
    var stats = getOverallStats();
    var rank = getCurrentRank(stats);
    var badgeStates = getBadgeStates(stats);
    var unlockedCount = badgeStates.filter(function (item) { return item.unlocked; }).length;

    wrapper.append(renderBreadcrumbs([
      { label: "Chapters", href: "#home" },
      { label: "Badges" }
    ]));

    var hero = el("header", "badges-hero");
    var heroCopy = el("div");
    heroCopy.append(
      el("p", "eyebrow", "Learner profile"),
      el("h1", null, "Your Python constellation"),
      el(
        "p",
        null,
        currentUser
          ? "Ranks and badges come from full test passes and are included in your opt-in account sync."
          : "Ranks and badges come from full test passes and remain in this browser unless you choose to sign in."
      )
    );
    var heroStats = el("div", "badges-hero__stats");
    heroStats.append(
      renderStat("Current rank", "L" + rank.level, "⌁"),
      renderStat("Collected stars", stats.earnedStars + " / " + stats.maxStars, "★"),
      renderStat("Badges unlocked", unlockedCount + " / " + badgeStates.length, "◆")
    );
    hero.append(heroCopy, heroStats);
    wrapper.append(hero);

    var ranksSection = el("section", "rank-section");
    var ranksHeading = el("header", "section-heading");
    ranksHeading.append(el("h2", null, "Rank path"), el("p", null, "Eight Pythonic levels, from your first trace to full mastery."));
    var rankList = el("ol", "rank-ladder");
    getRanks().forEach(function (candidate) {
      var isCurrent = candidate.level === rank.level;
      var isReached = stats.earnedStars >= candidate.minStars && stats.passedExercises >= candidate.minExercises;
      var item = el("li", "rank-card" + (isCurrent ? " is-current" : "") + (isReached ? " is-reached" : ""));
      var level = el("span", "rank-card__level", "L" + candidate.level);
      var copy = el("div", "rank-card__copy");
      copy.append(
        el("strong", null, candidate.name),
        el("p", null, candidate.description),
        el("span", null, candidate.minStars + " stars · " + candidate.minExercises + " exercises")
      );
      item.append(level, copy);
      rankList.append(item);
    });
    ranksSection.append(ranksHeading, rankList);
    wrapper.append(ranksSection);

    var badgeSection = el("section", "badge-section");
    var badgeHeading = el("header", "section-heading section-heading--row");
    var badgeHeadingCopy = el("div");
    badgeHeadingCopy.append(el("h2", null, "Badges"), el("p", null, "Select a badge to see exactly how to unlock it."));
    badgeHeading.append(badgeHeadingCopy, el("span", "section-heading__count", unlockedCount + " unlocked"));
    var badgeGrid = el("div", "badge-grid badge-grid--page");
    badgeStates.forEach(function (badgeState) {
      badgeGrid.append(renderBadgeButton(badgeState, true));
    });
    badgeSection.append(badgeHeading, badgeGrid);
    wrapper.append(badgeSection, renderBadgeDialog());
    return wrapper;
  }

  function renderExerciseWorkspace(exercise, chapter) {
    var exerciseId = String(exercise.id);
    var isPassed = passed.has(exerciseId);
    var testSpec = testData[exerciseId] || {};
    var tests = Array.isArray(testSpec.tests) ? testSpec.tests : [];
    var visibleTests = tests.filter(function (test) { return !test.hidden; });
    var hiddenCount = tests.length - visibleTests.length;
    var chapterExercises = getExercises(chapter);
    var exerciseIndex = chapterExercises.findIndex(function (candidate) {
      return String(candidate.id) === exerciseId;
    });
    var wrapper = el("div", "exercise-page" + (isPassed ? " is-passed" : ""));
    var shell = el("div", "page-shell exercise-page__shell");

    shell.append(renderBreadcrumbs([
      { label: "Chapters", href: "#home" },
      { label: chapter.title, href: "#chapter/" + encodeURIComponent(String(chapter.id)) },
      { label: "Exercises", href: "#chapter/" + encodeURIComponent(String(chapter.id)) + "/exercises" },
      { label: exercise.title }
    ]));

    var problem = el("article", "problem-panel");
    problem.dataset.exerciseRoot = exerciseId;
    var problemHeader = el("header", "problem-panel__header");
    var titleCopy = el("div", "problem-panel__title-copy");
    var titleMeta = el("div", "problem-panel__meta");
    var status = el("span", "pass-status" + (isPassed ? " is-passed" : ""));
    status.dataset.exercisePassStatus = exerciseId;
    status.append(el("span", null, isPassed ? "★" : "☆"), el("strong", null, isPassed ? "Passed" : "Not passed"));
    titleMeta.append(
      el("span", "eyebrow", "Exercise " + String(exerciseIndex + 1).padStart(2, "0") + " of " + chapterExercises.length),
      renderDifficultyStars(exercise, isPassed),
      status
    );
    titleCopy.append(titleMeta, el("h1", null, exercise.title), renderTags(exercise.topics));
    problemHeader.append(titleCopy, renderExercisePager(chapterExercises, exerciseIndex));

    var problemGrid = el("div", "problem-grid");
    var brief = el("section", "problem-brief");
    brief.append(
      el("h2", null, "The challenge"),
      el("p", "problem-brief__description", testSpec.description || exercise.prompt),
      renderSpecBlock("Your task", exercise.prompt),
      renderSpecBlock("Input / output contract", exercise.contract)
    );
    if (Array.isArray(testSpec.success) && testSpec.success.length) {
      var success = el("section", "success-list");
      success.append(el("h3", null, "Done when"));
      var successList = el("ul");
      testSpec.success.forEach(function (criterion) {
        successList.append(el("li", null, criterion));
      });
      success.append(successList);
      brief.append(success);
    }

    var hints = renderHintPanel(exercise);
    problemGrid.append(brief, hints);
    problem.append(problemHeader, problemGrid);

    var examples = el("section", "examples-section");
    var examplesHeading = el("header", "section-heading section-heading--row");
    var examplesCopy = el("div");
    examplesCopy.append(
      el("h2", null, "Visible examples"),
      el("p", null, "Use these to understand the contract before you run the complete hidden suite.")
    );
    examplesHeading.append(examplesCopy, el("span", "section-heading__count", visibleTests.length + " examples"));
    examples.append(examplesHeading);
    var exampleGrid = el("div", "example-grid");
    if (visibleTests.length) {
      visibleTests.forEach(function (test, index) {
        exampleGrid.append(renderExampleCard(test, testSpec.mode, index));
      });
    } else {
      exampleGrid.append(el("p", "empty-state", "No visible examples are available for this exercise."));
    }
    examples.append(exampleGrid);

    var ide = renderIdeWorkspace(exercise, testSpec, visibleTests.length, hiddenCount);
    shell.append(problem, examples, ide, renderExerciseBottomNavigation(chapterExercises, exerciseIndex, chapter));
    wrapper.append(shell);
    safeWrite(STORAGE_KEYS.lastExercise, exerciseId);
    return wrapper;
  }

  function renderSpecBlock(label, value) {
    var block = el("div", "spec-block");
    block.append(el("span", "spec-block__label", label), el("p", null, value));
    return block;
  }

  function renderExercisePager(exercises, index) {
    var nav = el("nav", "exercise-pager");
    nav.setAttribute("aria-label", "Previous and next exercise");
    var previous = exercises[index - 1];
    var next = exercises[index + 1];
    if (previous) {
      nav.append(anchor("#exercise/" + encodeURIComponent(String(previous.id)), "icon-button", "←", "Previous exercise"));
    } else {
      var disabledPrevious = el("span", "icon-button is-disabled", "←");
      disabledPrevious.setAttribute("aria-hidden", "true");
      nav.append(disabledPrevious);
    }
    nav.append(el("span", null, String(index + 1) + " / " + exercises.length));
    if (next) {
      nav.append(anchor("#exercise/" + encodeURIComponent(String(next.id)), "icon-button", "→", "Next exercise"));
    } else {
      var disabledNext = el("span", "icon-button is-disabled", "→");
      disabledNext.setAttribute("aria-hidden", "true");
      nav.append(disabledNext);
    }
    return nav;
  }

  function renderHintPanel(exercise) {
    var exerciseId = String(exercise.id);
    var hints = Array.isArray(exercise.hints) ? exercise.hints : [];
    var count = Math.min(revealedHints.get(exerciseId) || 0, hints.length);
    var panel = el("aside", "hint-panel");
    var heading = el("div", "hint-panel__heading");
    var icon = el("span", "hint-panel__icon", "?");
    var headingCopy = el("div");
    icon.setAttribute("aria-hidden", "true");
    headingCopy.append(el("h2", null, "Need a nudge?"), el("p", null, "Reveal one hint at a time and keep the solution yours."));
    heading.append(icon, headingCopy);
    panel.append(heading);
    panel.dataset.hintsId = exerciseId;

    if (!hints.length) {
      panel.append(el("p", "hint-panel__empty", "No hints are available for this exercise."));
      return panel;
    }

    if (count) {
      var list = el("ol", "hint-list");
      hints.slice(0, count).forEach(function (hint, index) {
        var item = el("li", "hint-list__item");
        item.append(el("span", "hint-list__number", String(index + 1)), el("p", null, hint));
        list.append(item);
      });
      panel.append(list);
    } else {
      panel.append(el("p", "hint-panel__empty", hints.length + " guided hints are available."));
    }

    if (count < hints.length) {
      var button = el("button", "button button--quiet", "Reveal hint " + (count + 1) + " of " + hints.length);
      button.type = "button";
      button.dataset.revealHint = exerciseId;
      panel.append(button);
    } else {
      panel.append(el("p", "hint-panel__complete", "All hints revealed. Trace one example before changing the code."));
    }
    return panel;
  }

  function renderExampleCard(test, mode, index) {
    var card = el("article", "example-card");
    var heading = el("header", "example-card__header");
    heading.append(el("span", null, "Example " + (index + 1)), el("strong", null, test.name || "Visible case"));
    card.append(
      heading,
      renderIoField(mode === "script" ? "Input" : "Call", formatTestInput(test, mode)),
      renderIoField("Expected output", formatPlannedExpected(test, mode))
    );
    return card;
  }

  function renderIoField(label, value) {
    var field = el("section", "io-field");
    var pre = el("pre");
    pre.append(el("code", null, value === "" ? "<empty>" : value));
    field.append(el("span", "io-field__label", label), pre);
    return field;
  }

  function renderIdeWorkspace(exercise, testSpec, visibleCount, hiddenCount) {
    var exerciseId = String(exercise.id);
    var tests = Array.isArray(testSpec.tests) ? testSpec.tests : [];
    var section = el("section", "ide-section");
    var heading = el("header", "section-heading section-heading--row ide-section__heading");
    var headingCopy = el("div");
    headingCopy.append(
      el("p", "eyebrow", "Browser Python workspace"),
      el("h2", null, "Write, run, and inspect"),
      el("p", null, "Start from a clean template. Run checks visible examples; Run tests adds hidden cases and awards stars only when all pass.")
    );
    heading.append(headingCopy, el("span", "section-heading__count", visibleCount + " visible · " + hiddenCount + " hidden"));

    var layout = el("div", "ide-layout");
    var editorShell = el("section", "ide-editor-shell");
    var topbar = el("header", "ide-topbar");
    var windowControls = el("span", "ide-window-controls");
    ["close", "minimize", "zoom"].forEach(function (name) {
      var dot = el("span", "ide-window-dot ide-window-dot--" + name);
      dot.setAttribute("aria-hidden", "true");
      windowControls.append(dot);
    });
    var fileTab = el("span", "ide-file-tab");
    var modified = el("span", "ide-file-tab__modified");
    modified.dataset.editorModified = exerciseId;
    modified.setAttribute("aria-label", "Starter code");
    fileTab.append(el("span", "ide-file-tab__type", "PY"), el("span", null, getExerciseFileName(exercise)), modified);
    var actions = el("div", "ide-actions");
    var modeField = el("label", "ide-mode-field");
    var modeLabel = el("span", null, "Keys");
    var modeSelect = el("select", "ide-mode-select");
    var copyButton = el("button", "ide-button ide-button--quiet", "Copy");
    var pasteButton = el("button", "ide-button ide-button--quiet", "Paste");
    var saveButton = el("button", "ide-button ide-button--quiet", "Save");
    var downloadButton = el("button", "ide-button ide-button--quiet", "Download .py");
    var resetButton = el("button", "ide-button ide-button--quiet", "Restart");
    var runButton = el("button", "ide-button ide-button--run", "Run");
    var testsButton = el("button", "ide-button ide-button--tests", "Run tests");
    modeSelect.dataset.editorMode = exerciseId;
    modeSelect.setAttribute("aria-label", "Editor keyboard mode");
    [
      { value: "sublime", label: "Sublime" },
      { value: "vim", label: "Vim" }
    ].forEach(function (optionData) {
      var option = el("option", null, optionData.label);
      option.value = optionData.value;
      option.selected = optionData.value === editorMode;
      modeSelect.append(option);
    });
    modeField.append(modeLabel, modeSelect);
    copyButton.type = "button";
    copyButton.dataset.copyCode = exerciseId;
    pasteButton.type = "button";
    pasteButton.dataset.pasteCode = exerciseId;
    saveButton.type = "button";
    saveButton.dataset.saveFile = exerciseId;
    saveButton.setAttribute("aria-label", "Save Python file locally and to your account when signed in");
    downloadButton.type = "button";
    downloadButton.dataset.downloadFile = exerciseId;
    downloadButton.setAttribute("aria-label", "Download current Python code as a .py file");
    resetButton.type = "button";
    resetButton.dataset.resetCode = exerciseId;
    runButton.type = "button";
    runButton.dataset.runExercise = exerciseId;
    runButton.dataset.runScope = "visible";
    testsButton.type = "button";
    testsButton.dataset.runExercise = exerciseId;
    testsButton.dataset.runScope = "all";
    runButton.disabled = !tests.some(function (test) { return !test.hidden; });
    testsButton.disabled = !tests.length;
    actions.append(modeField, copyButton, pasteButton, saveButton, downloadButton, resetButton, runButton, testsButton);
    topbar.append(windowControls, fileTab, actions);

    var frame = el("div", "ide-editor-frame");
    var textarea = el("textarea", "code-editor-fallback");
    var aceHost = el("div", "ace-editor-host");
    textarea.value = getStartingCode(exerciseId);
    textarea.spellcheck = false;
    textarea.setAttribute("autocapitalize", "off");
    textarea.setAttribute("autocomplete", "off");
    textarea.setAttribute("aria-label", "Python code editor for " + exercise.title);
    textarea.dataset.codeEditor = exerciseId;
    aceHost.id = "ace-editor-" + domId(exerciseId);
    aceHost.dataset.aceHost = exerciseId;
    aceHost.hidden = true;
    aceHost.setAttribute("aria-label", "Python code editor for " + exercise.title);
    frame.append(textarea, aceHost);

    var statusbar = el("footer", "ide-statusbar");
    var editorState = el("span", "ide-statusbar__state", "Clean starter · solution hidden");
    var details = el("span", "ide-statusbar__details");
    editorState.dataset.editorState = exerciseId;
    details.append(
      el("span", "ide-cursor-position", "Ln 1, Col 1"),
      el("span", null, "Spaces: 4"),
      el("span", null, "Python 3"),
      el("span", "ide-shortcut", "Shift + Enter · run"),
      el("span", "ide-shortcut", "Ctrl/⌘ + Enter · tests")
    );
    statusbar.append(editorState, details);
    editorShell.setAttribute("aria-label", "Python editor for " + exercise.title);
    editorShell.append(topbar, frame, statusbar);

    var plan = renderTestPlan(testSpec);
    layout.append(editorShell, plan);

    var runtime = el("p", "runtime-note");
    runtime.append(
      el("span", "runtime-note__dot"),
      document.createTextNode(" Python runs in an isolated browser worker. Drafts stay local by default; after sign-in, your own code and progress sync to your account. Repository solutions are never loaded into this page.")
    );
    var submissionSave = el(
      "p",
      "submission-save submission-save--" + (currentUser ? "ready" : "local"),
      currentUser
        ? "Save or Run tests to store this exact code in your account and create its chapter exNN.py file."
        : "Local draft only. Sign in from your profile to create a durable chapter exNN.py file."
    );
    submissionSave.dataset.submissionSave = exerciseId;
    submissionSave.setAttribute("role", "status");
    submissionSave.setAttribute("aria-live", "polite");
    var results = el("section", "test-results");
    results.dataset.testResults = exerciseId;
    results.setAttribute("aria-live", "polite");
    results.setAttribute("aria-label", "Test results for " + exercise.title);
    if (runResults.has(exerciseId)) {
      renderStoredResults(exercise, testSpec, runResults.get(exerciseId), results);
    } else {
      results.append(renderResultsEmpty());
    }

    section.append(heading, layout, runtime, submissionSave, results);
    return section;
  }

  function renderTestPlan(testSpec) {
    var aside = el("aside", "test-plan-panel");
    var header = el("header", "test-plan-panel__header");
    var tests = Array.isArray(testSpec.tests) ? testSpec.tests : [];
    header.append(el("h3", null, "Test cases"), el("span", null, tests.length + " total"));
    aside.append(header);
    var list = el("ol", "test-plan-list");
    tests.forEach(function (test, index) {
      var item = el("li", "test-plan-case" + (test.hidden ? " is-hidden" : ""));
      var heading = el("div", "test-plan-case__heading");
      var number = el("span", "test-plan-case__number", String(index + 1));
      var copy = el("div");
      copy.append(el("strong", null, test.hidden ? "Hidden test" : test.name), el("span", null, test.hidden ? "Unlocks after Run tests" : "Visible example"));
      heading.append(number, copy, el("span", "test-kind", test.hidden ? "Hidden" : "Visible"));
      item.append(heading);
      if (test.hidden) {
        item.append(el("p", "test-plan-case__masked", "Input and expectation stay masked until the suite returns."));
      } else {
        item.append(
          renderPlanDatum("Input", formatTestInput(test, testSpec.mode)),
          renderPlanDatum("Expected", formatPlannedExpected(test, testSpec.mode))
        );
      }
      list.append(item);
    });
    if (!tests.length) {
      list.append(el("li", "empty-state", "No tests are defined for this exercise."));
    }
    aside.append(list);
    return aside;
  }

  function renderPlanDatum(label, value) {
    var datum = el("div", "test-plan-datum");
    datum.append(el("span", null, label), el("code", null, value));
    return datum;
  }

  function renderResultsEmpty() {
    var empty = el("div", "results-empty");
    empty.append(el("span", "results-empty__icon", "▶"), el("strong", null, "No results yet"), el("p", null, "Run an example or the full suite to see expected output, actual output, errors, and tracebacks here."));
    return empty;
  }

  function renderExerciseBottomNavigation(exercises, index, chapter) {
    var nav = el("nav", "exercise-bottom-nav");
    nav.setAttribute("aria-label", "Exercise navigation");
    var previous = exercises[index - 1];
    var next = exercises[index + 1];
    if (previous) {
      var previousLink = anchor("#exercise/" + encodeURIComponent(String(previous.id)), "exercise-next-card exercise-next-card--previous");
      previousLink.append(el("span", null, "← Previous"), el("strong", null, previous.title));
      nav.append(previousLink);
    }
    if (next) {
      var nextLink = anchor("#exercise/" + encodeURIComponent(String(next.id)), "exercise-next-card exercise-next-card--next");
      nextLink.append(el("span", null, "Next →"), el("strong", null, next.title));
      nav.append(nextLink);
    } else {
      var chapterLink = anchor("#chapter/" + encodeURIComponent(String(chapter.id)) + "/exercises", "exercise-next-card exercise-next-card--next");
      chapterLink.append(el("span", null, "Back to"), el("strong", null, "All exercises"));
      nav.append(chapterLink);
    }
    return nav;
  }

  function handleMainClick(event) {
    var hintButton = event.target.closest("button[data-reveal-hint]");
    var scrollButton = event.target.closest("button[data-scroll-target]");
    var runButton = event.target.closest("button[data-run-exercise]");
    var resetButton = event.target.closest("button[data-reset-code]");
    var copyCodeButton = event.target.closest("button[data-copy-code]");
    var pasteCodeButton = event.target.closest("button[data-paste-code]");
    var saveFileButton = event.target.closest("button[data-save-file]");
    var downloadFileButton = event.target.closest("button[data-download-file]");
    var copySnippetButton = event.target.closest("button[data-copy-snippet]");
    var learningButton = event.target.closest("button[data-learning-toggle]");
    var practiceRevealButton = event.target.closest("button[data-reveal-practice]");
    var checkpointButton = event.target.closest("button[data-checkpoint-option]");
    var badgeButton = event.target.closest("button[data-open-badge]");
    var closeDialogButton = event.target.closest("button[data-close-badge-dialog]");

    if (hintButton) {
      revealNextHint(hintButton.dataset.revealHint);
      return;
    }
    if (scrollButton) {
      var target = document.getElementById(scrollButton.dataset.scrollTarget);
      if (target) {
        target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      }
      return;
    }
    if (runButton) {
      runExerciseTests(runButton.dataset.runExercise, runButton.dataset.runScope, runButton);
      return;
    }
    if (copyCodeButton) {
      copyExerciseCode(copyCodeButton.dataset.copyCode, copyCodeButton);
      return;
    }
    if (pasteCodeButton) {
      pasteIntoExercise(pasteCodeButton.dataset.pasteCode, pasteCodeButton);
      return;
    }
    if (saveFileButton) {
      saveExerciseFile(saveFileButton.dataset.saveFile, saveFileButton);
      return;
    }
    if (downloadFileButton) {
      downloadExerciseFile(downloadFileButton.dataset.downloadFile, downloadFileButton);
      return;
    }
    if (copySnippetButton) {
      copyTutorialSnippet(copySnippetButton);
      return;
    }
    if (learningButton) {
      toggleLearningItem(learningButton);
      return;
    }
    if (practiceRevealButton) {
      togglePracticeReveal(practiceRevealButton);
      return;
    }
    if (checkpointButton) {
      checkKnowledgeAnswer(checkpointButton);
      return;
    }
    if (resetButton) {
      resetExerciseCode(resetButton.dataset.resetCode);
      return;
    }
    if (badgeButton) {
      openBadgeDialog(badgeButton.dataset.openBadge);
      return;
    }
    if (closeDialogButton) {
      closeBadgeDialog();
    }
  }

  function handleMainChange(event) {
    var selector = event.target.closest("select[data-editor-mode]");
    if (!selector) {
      return;
    }
    var nextMode = selector.value === "vim" ? "vim" : "sublime";
    editorMode = nextMode;
    safeWrite(STORAGE_KEYS.editorMode, nextMode);
    if (activeEditor && activeEditor.exerciseId === selector.dataset.editorMode) {
      activeEditor.setKeyboardMode(nextMode);
      activeEditor.focus();
    }
    queueStateSync();
    announce((nextMode === "vim" ? "Vim" : "Sublime") + " keyboard mode enabled. Monokai remains active.");
  }

  function revealNextHint(exerciseId) {
    var exercise = exerciseById.get(exerciseId);
    var container = elements.main.querySelector("[data-hints-id='" + cssEscape(exerciseId) + "']");
    if (!exercise || !container) {
      return;
    }
    var hints = Array.isArray(exercise.hints) ? exercise.hints : [];
    var nextCount = Math.min((revealedHints.get(exerciseId) || 0) + 1, hints.length);
    revealedHints.set(exerciseId, nextCount);
    var replacement = renderHintPanel(exercise);
    container.replaceWith(replacement);
    announce("Hint " + nextCount + " of " + hints.length + " revealed for " + exercise.title + ".");
    window.requestAnimationFrame(function () {
      var nextButton = replacement.querySelector("button[data-reveal-hint]");
      if (nextButton) {
        nextButton.focus();
      } else {
        replacement.scrollIntoView({ block: "nearest" });
      }
    });
  }

  async function copyExerciseCode(exerciseId, button) {
    var code = getActiveCode(exerciseId);
    if (code === null) {
      return;
    }
    try {
      await writeClipboardText(code);
      if (activeEditor && activeEditor.exerciseId === exerciseId) {
        activeEditor.focus();
      }
      showControlFeedback(button, "Copied", "Copy", 1400);
      announce("Code copied to the clipboard.");
    } catch (error) {
      announce("Copy was blocked by the browser. Select the editor and use Ctrl or Command plus C.");
    }
  }

  async function pasteIntoExercise(exerciseId, button) {
    if (!activeEditor || activeEditor.exerciseId !== exerciseId) {
      return;
    }
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
        throw new Error("Clipboard read is unavailable.");
      }
      var text = await promiseWithTimeout(navigator.clipboard.readText(), 1800, "Clipboard read timed out.");
      if (!text) {
        announce("The clipboard does not contain text.");
        activeEditor.focus();
        return;
      }
      activeEditor.insertText(text);
      activeEditor.focus();
      showControlFeedback(button, "Pasted", "Paste", 1400);
      announce("Clipboard text inserted at the cursor.");
    } catch (error) {
      activeEditor.focus();
      announce("Direct paste was blocked. The editor is focused; use Ctrl or Command plus V.");
    }
  }

  async function saveExerciseFile(exerciseId, button) {
    var exercise = exerciseById.get(exerciseId);
    var code = getActiveCode(exerciseId);
    if (!exercise || code === null) {
      return;
    }
    var filename = getSafePythonFilename(exercise);
    scheduleDraftSave(exerciseId, code, true);

    if (!authToken || !currentUser) {
      setSubmissionSaveStatus(
        exerciseId,
        "local",
        "Saved in this browser only. Sign in from your profile to create a durable chapter exNN.py file."
      );
      showControlFeedback(button, "Saved locally", "Save", 1600);
      announce("Draft saved in this browser. Sign in from your profile if you also want it stored in PostgreSQL.");
      return;
    }

    button.disabled = true;
    button.textContent = "Saving…";
    var saveSessionToken = authToken;
    setSyncStatus("working", "Saving your Python file…");
    setSubmissionSaveStatus(exerciseId, "working", "Saving this exact editor snapshot to your account…");
    try {
      var file = await persistAccountExerciseFile(exerciseId, code);
      var savedMessage = describeAccountFileSave(file, filename);
      if (authToken !== saveSessionToken || !currentUser) {
        return;
      }
      setSyncStatus("success", savedMessage);
      setSubmissionSaveStatus(exerciseId, file.mirrorStatus === "saved" ? "success" : "account", savedMessage);
      announce(savedMessage);
    } catch (error) {
      if (authToken !== saveSessionToken || !currentUser) {
        return;
      }
      setSyncStatus("error", "Cloud save failed. Your local draft is safe.");
      setSubmissionSaveStatus(exerciseId, "error", "Account save failed. Your exact code remains saved in this browser.");
      announce("Cloud save failed, but your local draft is safe. " + getErrorMessage(error));
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = "Save";
      }
    }
  }

  function persistAccountExerciseFile(exerciseId, code) {
    if (!authToken || !currentUser) {
      return Promise.reject(new Error("Sign in to save a chapter file to your account."));
    }

    var exercise = exerciseById.get(exerciseId);
    var filename = getSafePythonFilename(exercise);
    var sessionToken = authToken;
    var saveState = accountFileSaves.get(exerciseId);
    if (!saveState) {
      saveState = {
        queuedCode: null,
        queuedPromise: null,
        tail: Promise.resolve()
      };
      accountFileSaves.set(exerciseId, saveState);
    }

    if (saveState.queuedPromise && saveState.queuedCode === code) {
      return saveState.queuedPromise;
    }

    var savePromise = saveState.tail
      .catch(function () {
        // A later snapshot must still be attempted if an earlier save failed.
      })
      .then(function () {
        return apiRequest("/api/files/" + encodeURIComponent(exerciseId), {
          method: "PUT",
          body: { content: code },
          token: sessionToken
        });
      })
      .then(function (response) {
        var file = response && response.file ? response.file : { filename: filename };
        return file;
      });

    saveState.tail = savePromise;
    saveState.queuedCode = code;
    saveState.queuedPromise = savePromise;
    function finishSave() {
      if (saveState.queuedPromise === savePromise) {
        saveState.queuedCode = null;
        saveState.queuedPromise = null;
      }
    }
    savePromise.then(finishSave, finishSave);
    return savePromise;
  }

  function describeAccountFileSave(file, fallbackFilename) {
    if (file && (file.mirrorStatus === "disabled" || file.mirrorStatus === "unavailable")) {
      return "Saved to your PostgreSQL account. The server chapter file is currently unavailable.";
    }
    var relativePath = file && (file.relativePath || file.path);
    if (relativePath) {
      return "Saved to " + relativePath + ".";
    }
    return (file && file.filename ? file.filename : fallbackFilename) + " saved to your account.";
  }

  function describeAccountFileLocation(file, fallbackFilename) {
    if (file && (file.mirrorStatus === "disabled" || file.mirrorStatus === "unavailable")) {
      return "Your PostgreSQL account has a saved snapshot. The server chapter file is currently unavailable.";
    }
    var relativePath = file && (file.relativePath || file.path);
    if (relativePath) {
      return "Account file ready at " + relativePath + ". Save or Run tests to update it.";
    }
    return "Account file ready as " + (file && file.filename ? file.filename : fallbackFilename) + ".";
  }

  function setSubmissionSaveStatus(exerciseId, kind, message) {
    if (!isCurrentExercise(exerciseId)) {
      return;
    }
    var status = elements.main.querySelector("[data-submission-save='" + cssEscape(exerciseId) + "']");
    if (!status) {
      return;
    }
    status.className = "submission-save submission-save--" + kind;
    status.textContent = message;
  }

  function downloadExerciseFile(exerciseId, button) {
    var exercise = exerciseById.get(exerciseId);
    var code = getActiveCode(exerciseId);
    if (!exercise || code === null) {
      return;
    }
    var filename = getSafePythonFilename(exercise);
    scheduleDraftSave(exerciseId, code, true);
    downloadTextFile(filename, code);
    showControlFeedback(button, "Downloaded", "Download .py", 1600);
    announce(filename + " downloaded. Your browser draft is also saved locally.");
  }

  function downloadTextFile(filename, content) {
    var blob = new Blob([content], { type: "text/x-python;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  async function copyTutorialSnippet(button) {
    var code = button.closest(".tutorial-code").querySelector("code");
    if (!code) {
      return;
    }
    try {
      await writeClipboardText(code.textContent);
      var restingLabel = button.dataset.copyRestingLabel || "Copy example";
      showControlFeedback(button, "Copied", restingLabel, 1400);
      announce(restingLabel === "Copy starter" ? "Practice starter copied to the clipboard." : "Concept example copied to the clipboard.");
    } catch (error) {
      announce("Copy was blocked by the browser. Select the example and copy it manually.");
    }
  }

  function toggleLearningItem(button) {
    var chapter = chapterById.get(String(button.dataset.chapterId));
    var itemId = button.dataset.learningToggle;
    if (!chapter || !itemId) {
      return;
    }
    var chapterId = String(chapter.id);
    var items = learningProgress.get(chapterId) || new Set();
    var wasUnderstood = items.has(itemId);
    if (wasUnderstood) {
      items.delete(itemId);
    } else {
      items.add(itemId);
    }
    learningProgress.set(chapterId, items);
    persistLearningProgress();
    syncLearningProgressUI(chapter);
    var stats = getChapterLearningProgress(chapter);
    if (!wasUnderstood && stats.done === stats.total) {
      audio.playAchievement();
      announce(chapter.title + " learning guide complete. You can revisit any section at any time.");
    } else {
      announce(wasUnderstood ? "Section marked for review." : "Section marked understood. " + stats.done + " of " + stats.total + " guide sections complete.");
    }
  }

  function syncLearningProgressUI(chapter) {
    var chapterId = String(chapter.id);
    var stats = getChapterLearningProgress(chapter);
    elements.main.querySelectorAll("button[data-learning-toggle][data-chapter-id='" + cssEscape(chapterId) + "']").forEach(function (button) {
      var understood = isLearningUnderstood(chapter, button.dataset.learningToggle);
      button.classList.toggle("is-understood", understood);
      button.setAttribute("aria-pressed", String(understood));
      button.textContent = understood ? "Understood ✓" : "Mark understood";
    });
    elements.main.querySelectorAll("[data-learning-item]").forEach(function (section) {
      section.classList.toggle("is-understood", isLearningUnderstood(chapter, section.dataset.learningItem));
    });
    elements.main.querySelectorAll("[data-learning-toc]").forEach(function (tocButton) {
      tocButton.classList.toggle("is-understood", isLearningUnderstood(chapter, tocButton.dataset.learningToc));
    });
    var count = elements.main.querySelector("[data-learning-progress-count='" + cssEscape(chapterId) + "']");
    var bar = elements.main.querySelector("[data-learning-progress-bar='" + cssEscape(chapterId) + "']");
    var status = elements.main.querySelector("[data-learning-progress-status='" + cssEscape(chapterId) + "']");
    var panel = elements.main.querySelector("[data-learning-progress-panel='" + cssEscape(chapterId) + "']");
    if (count) {
      count.textContent = stats.done + " / " + stats.total;
    }
    if (bar) {
      bar.max = Math.max(stats.total, 1);
      bar.value = stats.done;
      bar.setAttribute("aria-label", chapter.title + " learning guide: " + stats.done + " of " + stats.total + " sections understood");
    }
    if (status) {
      status.textContent = stats.done === stats.total
        ? "Guide complete — revisit any section whenever you need it."
        : "Mark each concept after you can explain it in your own words.";
    }
    if (panel) {
      panel.classList.toggle("is-complete", stats.done === stats.total);
      var percent = panel.querySelector(".tutorial-progress__top > div > strong");
      if (percent) {
        percent.textContent = stats.percent + "% understood";
      }
    }
  }

  function togglePracticeReveal(button) {
    var target = document.getElementById(button.dataset.revealPractice);
    if (!target) {
      return;
    }
    var expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    button.textContent = expanded ? "Reveal coaching note" : "Hide coaching note";
    target.hidden = expanded;
    if (!expanded) {
      announce("Coaching note revealed. Compare it with your prediction.");
    }
  }

  function checkKnowledgeAnswer(button) {
    var checkpoint = button.closest(".knowledge-check");
    if (!checkpoint) {
      return;
    }
    var selectedIndex = Number(button.dataset.checkpointOption);
    var answerIndex = Number(button.dataset.answerIndex);
    var correct = Number.isInteger(answerIndex) && selectedIndex === answerIndex;
    checkpoint.querySelectorAll("button[data-checkpoint-option]").forEach(function (option) {
      option.classList.remove("is-correct", "is-incorrect");
      option.setAttribute("aria-pressed", String(option === button));
    });
    button.classList.add(correct ? "is-correct" : "is-incorrect");
    var feedback = checkpoint.querySelector(".knowledge-check__feedback");
    if (feedback) {
      feedback.hidden = false;
      feedback.classList.toggle("is-correct", correct);
      feedback.classList.toggle("is-incorrect", !correct);
      feedback.textContent = correct
        ? "Correct. " + checkpoint.dataset.checkpointExplanation
        : "Not quite. Trace the mental-model steps once more, then choose again.";
    }
    announce(correct ? "Checkpoint correct." : "Checkpoint answer is not correct yet. Try again.");
  }

  function writeClipboardText(value) {
    if (legacyCopyText(value)) {
      return Promise.resolve();
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return promiseWithTimeout(navigator.clipboard.writeText(value), 1600, "Clipboard write timed out.");
    }
    return Promise.reject(new Error("Clipboard write is unavailable."));
  }

  function legacyCopyText(value) {
    var helper = el("textarea", "clipboard-helper");
    helper.value = value;
    helper.setAttribute("readonly", "");
    document.body.append(helper);
    helper.select();
    try {
      return Boolean(document.execCommand("copy"));
    } catch (error) {
      return false;
    } finally {
      helper.remove();
    }
  }

  function promiseWithTimeout(promise, delay, message) {
    return Promise.race([
      promise,
      new Promise(function (_resolve, reject) {
        window.setTimeout(function () { reject(new Error(message)); }, delay);
      })
    ]);
  }

  function showControlFeedback(button, temporaryLabel, restingLabel, duration) {
    button.textContent = temporaryLabel;
    window.setTimeout(function () {
      if (button.isConnected) {
        button.textContent = restingLabel;
      }
    }, duration);
  }

  function initializeExerciseEditor(exercise) {
    var exerciseId = String(exercise.id);
    var textarea = elements.main.querySelector("textarea[data-code-editor='" + cssEscape(exerciseId) + "']");
    var host = elements.main.querySelector("[data-ace-host='" + cssEscape(exerciseId) + "']");
    var state = elements.main.querySelector("[data-editor-state='" + cssEscape(exerciseId) + "']");
    var modified = elements.main.querySelector("[data-editor-modified='" + cssEscape(exerciseId) + "']");
    var position = elements.main.querySelector(".ide-cursor-position");
    var runButton = elements.main.querySelector("button[data-run-exercise='" + cssEscape(exerciseId) + "'][data-run-scope='visible']");
    var runTestsButton = elements.main.querySelector("button[data-run-exercise='" + cssEscape(exerciseId) + "'][data-run-scope='all']");
    var saveButton = elements.main.querySelector("button[data-save-file='" + cssEscape(exerciseId) + "']");

    if (!textarea || !host || !state || !modified || !position) {
      return;
    }

    textarea.addEventListener("input", function () {
      scheduleDraftSave(exerciseId, textarea.value);
      updateEditorChrome(exerciseId, textarea.value, state, modified);
      updateTextareaPosition(textarea, position);
    });
    textarea.addEventListener("keyup", function () { updateTextareaPosition(textarea, position); });
    textarea.addEventListener("click", function () { updateTextareaPosition(textarea, position); });
    textarea.addEventListener("keydown", function (event) {
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && event.key === "Enter") {
        event.preventDefault();
        if (runButton && !runButton.disabled) {
          runButton.click();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (runTestsButton && !runTestsButton.disabled) {
          runTestsButton.click();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (saveButton && !saveButton.disabled) {
          saveButton.click();
        }
      }
    });

    updateEditorChrome(exerciseId, textarea.value, state, modified);

    if (!window.ace || typeof window.ace.edit !== "function") {
      activeEditor = createTextareaAdapter(exerciseId, textarea, state, modified, position);
      state.textContent = "Basic editor fallback";
      loadRemoteExerciseFile(exerciseId);
      return;
    }

    var aceEditor;
    try {
      window.ace.config.set("basePath", "assets/vendor/ace");
      host.hidden = false;
      aceEditor = window.ace.edit(host, {
        value: textarea.value,
        mode: "ace/mode/python",
        theme: "ace/theme/monokai",
        keyboardHandler: getAceKeyboardHandler(editorMode),
        fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
        fontSize: window.matchMedia("(max-width: 640px)").matches ? "16px" : "15px",
        tabSize: 4,
        useSoftTabs: true,
        navigateWithinSoftTabs: true,
        useWorker: false,
        useResizeObserver: true,
        showPrintMargin: false,
        showGutter: true,
        displayIndentGuides: true,
        highlightActiveLine: true,
        highlightGutterLine: true,
        highlightIndentGuides: true,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: false,
        enableKeyboardAccessibility: true,
        enableMobileMenu: true,
        scrollPastEnd: 0.12,
        wrap: window.matchMedia("(max-width: 640px)").matches,
        textInputAriaLabel: "Python code editor for " + exercise.title
      });
      aceEditor.session.setUseWorker(false);
      aceEditor.session.setNewLineMode("unix");
      aceEditor.renderer.setPadding(16);
      textarea.hidden = true;

      aceEditor.commands.addCommand({
        name: "runVisibleExerciseExamples",
        bindKey: { win: "Shift-Enter", mac: "Shift-Enter" },
        exec: function () {
          if (runButton && !runButton.disabled) {
            runButton.click();
          }
        }
      });
      aceEditor.commands.addCommand({
        name: "runAllExerciseTests",
        bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
        exec: function () {
          if (runTestsButton && !runTestsButton.disabled) {
            runTestsButton.click();
          }
        }
      });
      aceEditor.commands.addCommand({
        name: "saveExerciseDraft",
        bindKey: { win: "Ctrl-S", mac: "Command-S" },
        exec: function () {
          if (saveButton && !saveButton.disabled) {
            saveButton.click();
          }
        }
      });

      function syncValue() {
        var value = aceEditor.getValue();
        textarea.value = value;
        scheduleDraftSave(exerciseId, value);
        updateEditorChrome(exerciseId, value, state, modified);
      }

      function syncPosition() {
        var cursor = aceEditor.getCursorPosition();
        position.textContent = "Ln " + (cursor.row + 1) + ", Col " + (cursor.column + 1);
      }

      aceEditor.session.on("change", syncValue);
      aceEditor.selection.on("changeCursor", syncPosition);
      syncPosition();

      activeEditor = {
        exerciseId: exerciseId,
        getValue: function () { return aceEditor.getValue(); },
        setValue: function (value) {
          aceEditor.setValue(value, -1);
          textarea.value = value;
          updateEditorChrome(exerciseId, value, state, modified);
          syncPosition();
        },
        insertText: function (value) {
          aceEditor.insert(value);
          syncValue();
          syncPosition();
        },
        focus: function () { aceEditor.focus(); },
        setKeyboardMode: function (mode) {
          aceEditor.setKeyboardHandler(getAceKeyboardHandler(mode));
        },
        destroy: function () {
          var value = aceEditor.getValue();
          textarea.value = value;
          scheduleDraftSave(exerciseId, value, true);
          aceEditor.destroy();
          host.replaceChildren();
        }
      };
      aceEditor.resize(true);
      loadRemoteExerciseFile(exerciseId);
    } catch (error) {
      if (aceEditor && typeof aceEditor.destroy === "function") {
        aceEditor.destroy();
      }
      host.replaceChildren();
      host.hidden = true;
      textarea.hidden = false;
      activeEditor = createTextareaAdapter(exerciseId, textarea, state, modified, position);
      state.textContent = "Basic editor fallback";
      loadRemoteExerciseFile(exerciseId);
    }
  }

  function createTextareaAdapter(exerciseId, textarea, state, modified, position) {
    return {
      exerciseId: exerciseId,
      getValue: function () { return textarea.value; },
      setValue: function (value) {
        textarea.value = value;
        updateEditorChrome(exerciseId, value, state, modified);
        updateTextareaPosition(textarea, position);
      },
      insertText: function (value) {
        var start = textarea.selectionStart || 0;
        var end = textarea.selectionEnd || start;
        textarea.setRangeText(value, start, end, "end");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      },
      focus: function () { textarea.focus(); },
      setKeyboardMode: function () {},
      destroy: function () {
        scheduleDraftSave(exerciseId, textarea.value, true);
      }
    };
  }

  function disposeActiveEditor() {
    if (activeEditor) {
      activeEditor.destroy();
      activeEditor = null;
    }
    flushDrafts();
  }

  function getActiveCode(exerciseId) {
    if (activeEditor && activeEditor.exerciseId === exerciseId) {
      return activeEditor.getValue();
    }
    var textarea = elements.main.querySelector("textarea[data-code-editor='" + cssEscape(exerciseId) + "']");
    return textarea ? textarea.value : null;
  }

  function resetExerciseCode(exerciseId) {
    if (!Object.prototype.hasOwnProperty.call(starterCode, exerciseId)) {
      return;
    }
    var value = starterCode[exerciseId];
    if (activeEditor && activeEditor.exerciseId === exerciseId) {
      activeEditor.setValue(value);
      activeEditor.focus();
    }
    discardDraft(exerciseId);
    runResults.delete(exerciseId);
    var results = elements.main.querySelector("[data-test-results='" + cssEscape(exerciseId) + "']");
    if (results) {
      results.replaceChildren(renderResultsEmpty());
    }
    announce("Clean starter restored for " + exerciseById.get(exerciseId).title + ".");
  }

  async function runExerciseTests(exerciseId, scope, button) {
    var exercise = exerciseById.get(exerciseId);
    var testSpec = testData[exerciseId];
    var code = getActiveCode(exerciseId);
    var allTests = testSpec && Array.isArray(testSpec.tests) ? testSpec.tests : [];
    var selectedTests = scope === "visible"
      ? allTests.filter(function (test) { return !test.hidden; })
      : allTests;
    var resultsContainer = elements.main.querySelector("[data-test-results='" + cssEscape(exerciseId) + "']");

    if (!exercise || !testSpec || code === null || !selectedTests.length || !resultsContainer || button.disabled) {
      return;
    }
    if (activeRun) {
      announce("Wait for the current Python run to finish before starting another one.");
      return;
    }

    var runToken = String(Date.now()) + "-" + exerciseId;
    activeRun = { token: runToken, exerciseId: exerciseId };
    var runSessionToken = authToken && currentUser ? authToken : "";
    var submissionSavePromise = null;
    if (scope === "all") {
      scheduleDraftSave(exerciseId, code, true);
      if (authToken && currentUser) {
        var submissionFilename = getSafePythonFilename(exercise);
        var submissionSessionToken = authToken;
        setSyncStatus("working", "Saving the submitted code…");
        setSubmissionSaveStatus(exerciseId, "working", "Saving this exact test submission to your account…");
        submissionSavePromise = persistAccountExerciseFile(exerciseId, code).then(
          function (file) {
            var message = describeAccountFileSave(file, submissionFilename);
            if (authToken === submissionSessionToken && currentUser) {
              setSyncStatus("success", message);
              setSubmissionSaveStatus(exerciseId, file.mirrorStatus === "saved" ? "success" : "account", message);
              announce("Test submission " + message.charAt(0).toLowerCase() + message.slice(1));
            }
            return { file: file };
          },
          function (error) {
            if (authToken === submissionSessionToken && currentUser) {
              setSyncStatus("error", "Submission file could not sync. Your local draft is safe.");
              setSubmissionSaveStatus(
                exerciseId,
                "error",
                "Tests will still run, but the account file could not be saved. Your exact code remains local."
              );
              announce("The submitted code remains local because its account file could not sync. " + getErrorMessage(error));
            }
            return { error: error };
          }
        );
      } else {
        setSubmissionSaveStatus(
          exerciseId,
          "local",
          "This test submission is saved in this browser only. Sign in to create a durable chapter exNN.py file."
        );
      }
    }
    audio.playSubmit();
    setIdeControlsLocked(true);
    button.textContent = scope === "visible" ? "Running…" : "Running tests…";
    resultsContainer.setAttribute("aria-busy", "true");
    renderRunStatus(
      resultsContainer,
      scope === "visible"
        ? "Running " + selectedTests.length + " visible examples…"
        : "Running " + selectedTests.length + " visible and hidden tests…",
      false
    );

    try {
      var results = await pythonRunner.run(code, testSpec.mode, selectedTests);
      var stored = { scope: scope, results: results, tests: selectedTests, completedAt: Date.now() };
      runResults.set(exerciseId, stored);

      if (isCurrentExercise(exerciseId)) {
        resultsContainer = elements.main.querySelector("[data-test-results='" + cssEscape(exerciseId) + "']");
        if (resultsContainer) {
          renderStoredResults(exercise, testSpec, stored, resultsContainer);
        }
      }

      var allPassed = results.length === selectedTests.length && results.every(function (result) {
        return result.passed;
      });
      if (allPassed) {
        audio.playSuccess();
      } else {
        audio.playFailure();
      }
      if (scope === "all" && allPassed && selectedTests.length === allTests.length) {
        markExercisePassed(exerciseId);
      }
      if (submissionSavePromise) {
        await submissionSavePromise;
      }
      if (runSessionToken) {
        try {
          await persistRunDetails(exerciseId, scope, results, allPassed, stored.completedAt, runSessionToken);
        } catch (syncError) {
          if (authToken === runSessionToken && currentUser) {
            setSyncStatus("error", "Run finished locally, but its history could not sync.");
            announce("Tests finished and remain valid locally. Run history could not sync: " + getErrorMessage(syncError));
          }
        }
      }
    } catch (error) {
      audio.playFailure();
      if (isCurrentExercise(exerciseId)) {
        resultsContainer = elements.main.querySelector("[data-test-results='" + cssEscape(exerciseId) + "']");
        if (resultsContainer) {
          renderRunStatus(resultsContainer, error instanceof Error ? error.message : String(error), true);
        }
      }
    } finally {
      if (activeRun && activeRun.token === runToken) {
        activeRun = null;
      }
      if (isCurrentExercise(exerciseId)) {
        resultsContainer = elements.main.querySelector("[data-test-results='" + cssEscape(exerciseId) + "']");
        if (resultsContainer) {
          resultsContainer.removeAttribute("aria-busy");
        }
        setIdeControlsLocked(false);
      }
      if (button.isConnected) {
        button.textContent = scope === "visible" ? "Run" : "Run tests";
      }
    }
  }

  function isCurrentExercise(exerciseId) {
    return currentRoute && currentRoute.name === "exercise" && String(currentRoute.exercise.id) === exerciseId;
  }

  function setIdeControlsLocked(locked) {
    elements.main.querySelectorAll("button[data-run-exercise], button[data-reset-code], button[data-paste-code]").forEach(function (control) {
      var exerciseId = control.dataset.runExercise || control.dataset.resetCode || control.dataset.pasteCode;
      var testSpec = testData[exerciseId];
      if (control.dataset.runExercise) {
        var scope = control.dataset.runScope;
        var tests = testSpec && Array.isArray(testSpec.tests) ? testSpec.tests : [];
        var available = scope === "visible" ? tests.some(function (test) { return !test.hidden; }) : tests.length > 0;
        control.disabled = locked || !available;
      } else {
        control.disabled = locked;
      }
    });
  }

  function renderRunStatus(container, message, isError) {
    var status = el("div", "runner-status" + (isError ? " runner-status--error" : ""));
    status.append(el("span", "runner-status__spinner", isError ? "!" : ""), el("strong", null, isError ? "Python could not finish the run" : message));
    if (isError) {
      var retry = el("button", "button button--primary", "Retry Python tests");
      retry.type = "button";
      if (currentRoute && currentRoute.name === "exercise") {
        retry.dataset.runExercise = String(currentRoute.exercise.id);
        retry.dataset.runScope = "all";
      }
      status.append(
        el("p", null, message),
        el(
          "p",
          null,
          window.location.protocol === "file:"
            ? "Start the documented local server and open http://127.0.0.1:8000 so the Python worker can load."
            : "The runner will try a second pinned Python source automatically. Retry after checking the connection; infinite loops are stopped and restarted safely."
        ),
        retry
      );
    }
    container.replaceChildren(status);
  }

  function renderStoredResults(exercise, testSpec, stored, container) {
    var results = stored.results || [];
    var passedCount = results.filter(function (result) { return result.passed; }).length;
    var allPassed = results.length > 0 && passedCount === results.length;
    var awardsProgress = stored.scope === "all";
    var summary = el("header", "results-summary " + (allPassed ? "results-summary--pass" : "results-summary--fail"));
    var icon = el("span", "results-summary__icon", allPassed ? "✓" : "×");
    var copy = el("div", "results-summary__copy");
    var title = allPassed
      ? awardsProgress ? "All tests passed" : "All visible examples passed"
      : passedCount + " of " + results.length + " tests passed";
    var message = allPassed
      ? awardsProgress
        ? "Green result: this exercise now awards its difficulty stars."
        : "The examples are green. Run the full suite to check hidden cases and collect stars."
      : "Open each failed case to compare the expected value, actual value, and traceback.";
    icon.setAttribute("aria-hidden", "true");
    copy.append(el("strong", null, title), el("span", null, message));
    summary.append(icon, copy, el("span", "results-summary__count", passedCount + " / " + results.length));
    container.replaceChildren(summary);

    var list = el("div", "result-list");
    results.forEach(function (result, index) {
      var definition = (stored.tests || []).find(function (test) { return test.id === result.id; }) || (stored.tests || [])[index];
      list.append(renderTestResult(result, definition, testSpec.mode, index));
    });
    container.append(list);
    announce(passedCount + " of " + results.length + " tests passed for " + exercise.title + ".");
  }

  function renderTestResult(result, definition, mode, index) {
    var details = el("details", "test-result " + (result.passed ? "test-result--pass" : "test-result--fail"));
    var summary = el("summary");
    var icon = el("span", "test-result__icon", result.passed ? "✓" : "×");
    var title = el("strong", null, result.name || "Test " + (index + 1));
    var kind = el("span", "test-kind", result.hidden ? "Hidden" : "Visible");
    var body = el("div", "test-result__body");
    var expectedValue = result.expected;
    if (expectedValue === "Not produced" && definition) {
      expectedValue = formatPlannedExpected(definition, mode);
    }
    icon.setAttribute("aria-hidden", "true");
    summary.append(icon, title, kind);
    details.open = !result.passed;
    details.append(summary);

    body.append(
      renderResultField("Test input", formatTestInput(definition || {}, mode)),
      renderResultField("Expected", expectedValue),
      renderResultField("Actual", result.actual)
    );
    if (mode !== "script" && result.stdout) {
      body.append(renderResultField("Captured stdout", result.stdout));
    }
    if (result.stderr) {
      body.append(renderResultField("Captured stderr", result.stderr));
    }
    if (result.traceback) {
      body.append(renderResultField("Traceback", result.traceback, true));
    }
    details.append(body);
    return details;
  }

  function renderResultField(label, value, traceback) {
    var field = el("section", "result-field" + (traceback ? " result-field--traceback" : ""));
    var pre = el("pre");
    pre.append(el("code", null, value === "" ? "<empty>" : value));
    field.append(el("h4", null, label), pre);
    return field;
  }

  function markExercisePassed(exerciseId) {
    var wasPassed = passed.has(exerciseId);
    var beforeStats = getOverallStats();
    var beforeRank = getCurrentRank(beforeStats);
    var beforeBadges = getBadgeStates(beforeStats);
    passed.add(exerciseId);
    persistPassed();
    renderProfile();
    if (!wasPassed) {
      updateCurrentPassedUi(exerciseId);
      var exercise = exerciseById.get(exerciseId);
      var awardedStars = getDifficulty(exercise);
      announce(exercise.title + " passed. You collected " + awardedStars + " " + pluralize(awardedStars, "star") + ".");
      celebrateNewAchievements(beforeRank, beforeBadges);
    }
  }

  function celebrateNewAchievements(beforeRank, beforeBadges) {
    var stats = getOverallStats();
    var nextRank = getCurrentRank(stats);
    var nextBadges = getBadgeStates(stats);
    var unlockedBefore = new Set(beforeBadges.filter(function (state) {
      return state.unlocked;
    }).map(function (state) {
      return state.badge.id;
    }));
    var achievements = nextBadges.filter(function (state) {
      return state.unlocked && !unlockedBefore.has(state.badge.id);
    }).map(function (state) {
      return { icon: state.badge.icon, eyebrow: "Achievement unlocked", title: state.badge.name, detail: state.badge.description };
    });

    if (nextRank.level > beforeRank.level) {
      achievements.unshift({
        icon: "L" + nextRank.level,
        eyebrow: "New Pythonic rank",
        title: nextRank.name,
        detail: nextRank.description
      });
    }

    achievements.forEach(function (achievement, index) {
      window.setTimeout(function () {
        showAchievementToast(achievement);
        audio.playAchievement();
      }, 380 + index * 720);
    });
  }

  function showAchievementToast(achievement) {
    if (!elements.achievementToasts) {
      return;
    }
    var toast = el("section", "achievement-toast");
    var icon = el("span", "achievement-toast__icon", achievement.icon);
    var copy = el("div");
    var close = el("button", "achievement-toast__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss achievement notification");
    copy.append(
      el("small", null, achievement.eyebrow),
      el("strong", null, achievement.title),
      el("p", null, achievement.detail)
    );
    close.addEventListener("click", function () { dismissAchievementToast(toast); });
    toast.append(icon, copy, close);
    elements.achievementToasts.append(toast);
    window.requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    window.setTimeout(function () { dismissAchievementToast(toast); }, 6200);
  }

  function dismissAchievementToast(toast) {
    if (!toast || !toast.isConnected) {
      return;
    }
    toast.classList.remove("is-visible");
    window.setTimeout(function () { toast.remove(); }, prefersReducedMotion() ? 0 : 240);
  }

  function updateCurrentPassedUi(exerciseId) {
    var page = elements.main.querySelector(".exercise-page");
    var status = elements.main.querySelector("[data-exercise-pass-status='" + cssEscape(exerciseId) + "']");
    if (page) {
      page.classList.add("is-passed", "is-celebrating");
      window.setTimeout(function () {
        if (page.isConnected) {
          page.classList.remove("is-celebrating");
        }
      }, 900);
    }
    if (status) {
      status.classList.add("is-passed");
      status.replaceChildren(el("span", null, "★"), el("strong", null, "Passed"));
    }
    elements.main.querySelectorAll(".difficulty-stars").forEach(function (stars) {
      stars.classList.add("is-passed");
    });
  }

  function renderProfile() {
    var stats = getOverallStats();
    var rank = getCurrentRank(stats);
    var nextRank = getNextRank(rank);
    var badgeStates = getBadgeStates(stats);
    var unlocked = badgeStates.filter(function (state) { return state.unlocked; }).length;
    elements.profileLevel.textContent = "Level " + rank.level;
    elements.profileRank.textContent = rank.name;

    var panel = elements.profilePanel;
    var header = el("header", "profile-panel__header");
    var avatar = el("span", "profile-panel__avatar", "L" + rank.level);
    var title = el("div");
    title.append(el("span", null, "Current rank"), el("strong", null, rank.name), el("small", null, rank.description));
    header.append(avatar, title);

    var progress = el("section", "profile-panel__progress");
    var progressTop = el("div");
    progressTop.append(el("strong", null, stats.progressPercent + "% complete"), el("span", null, stats.passedExercises + " / " + stats.totalExercises));
    progress.append(
      progressTop,
      progressElement(stats.passedExercises, stats.totalExercises, "Overall exercise progress"),
      el("p", null, nextRank
        ? Math.max(0, nextRank.minStars - stats.earnedStars) + " stars and " + Math.max(0, nextRank.minExercises - stats.passedExercises) + " exercises remain to " + nextRank.name + "."
        : "Every rank requirement is complete.")
    );

    var metrics = el("div", "profile-panel__metrics");
    metrics.append(
      renderProfileMetric("★", stats.earnedStars + " / " + stats.maxStars, "Stars"),
      renderProfileMetric("◆", unlocked + " / " + badgeStates.length, "Badges"),
      renderProfileMetric("✓", stats.completedChapters + " / " + chapters.length, "Chapters")
    );

    var badges = el("section", "profile-panel__badges");
    var badgesHeading = el("div", "profile-panel__section-heading");
    badgesHeading.append(el("strong", null, "Badges"), anchor("#profile/badges", null, "View all"));
    var grid = el("div", "profile-badge-grid");
    badgeStates.slice(0, 8).forEach(function (state) {
      grid.append(renderBadgeButton(state, false));
    });
    var detail = el("div", "profile-badge-detail");
    detail.setAttribute("aria-live", "polite");
    var selected = badgeStates.find(function (state) { return state.badge.id === selectedBadgeId; });
    if (!selected) {
      selected = badgeStates.find(function (state) { return state.unlocked; }) || badgeStates[0];
    }
    if (selected) {
      selectedBadgeId = selected.badge.id;
      detail.append(
        el("strong", null, selected.badge.name + (selected.unlocked ? " · Unlocked" : " · Locked")),
        el("p", null, selected.badge.description)
      );
    }
    badges.append(badgesHeading, grid, detail);

    var syncPanel = renderAccountSyncPanel();
    var localNote = el(
      "p",
      "profile-panel__local-note",
      currentUser
        ? "Signed-in sync uploads only your own drafts, files, progress, editor mode, and run results. Repository solutions are never included."
        : "Unsigned use is local-only. Nothing is uploaded until you create an account or sign in."
    );
    panel.replaceChildren(header, progress, metrics, badges, syncPanel, localNote);
  }

  function renderAccountSyncPanel() {
    var section = el("section", "profile-sync");
    var heading = el("div", "profile-panel__section-heading");
    var status = el("p", "profile-sync__status profile-sync__status--" + syncState.kind, syncState.message);
    status.dataset.syncStatus = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    heading.append(el("strong", null, "Account & sync"), el("span", "profile-sync__mode", currentUser ? "Cloud on" : "Local only"));
    section.append(heading);

    if (currentUser) {
      var identity = el("div", "profile-sync__identity");
      identity.append(
        el("span", "profile-sync__avatar", getUserInitials(currentUser)),
        el("div", null)
      );
      identity.children[1].append(
        el("strong", null, currentUser.displayName || "Python learner"),
        el("span", null, currentUser.email || "Signed in")
      );
      var actions = el("div", "profile-sync__actions");
      var syncButton = el("button", "button button--primary", "Sync now");
      var signOutButton = el("button", "button button--quiet", "Sign out");
      syncButton.type = "button";
      syncButton.dataset.syncNow = "true";
      signOutButton.type = "button";
      signOutButton.dataset.signOut = "true";
      actions.append(syncButton, signOutButton);
      section.append(identity, status, actions);
      return section;
    }

    section.append(
      el("p", "profile-sync__disclosure", "Create an account or sign in to opt in. Your local work remains usable if the server is unavailable.")
    );
    var form = el("form", "profile-sync__form");
    form.dataset.authForm = "true";
    var nameLabel = el("label", "profile-sync__field");
    var nameInput = el("input", "profile-sync__input");
    nameInput.type = "text";
    nameInput.name = "displayName";
    nameInput.autocomplete = "name";
    nameInput.maxLength = 80;
    nameLabel.append(el("span", null, "Display name (new accounts)"), nameInput);
    var emailLabel = el("label", "profile-sync__field");
    var emailInput = el("input", "profile-sync__input");
    emailInput.type = "email";
    emailInput.name = "email";
    emailInput.autocomplete = "email";
    emailInput.required = true;
    emailInput.maxLength = 320;
    emailLabel.append(el("span", null, "Email"), emailInput);
    var passwordLabel = el("label", "profile-sync__field");
    var passwordInput = el("input", "profile-sync__input");
    passwordInput.type = "password";
    passwordInput.name = "password";
    passwordInput.autocomplete = "current-password";
    passwordInput.required = true;
    passwordInput.minLength = 10;
    passwordInput.maxLength = 256;
    passwordLabel.append(el("span", null, "Password (10+ characters)"), passwordInput);
    var actions = el("div", "profile-sync__actions");
    var loginButton = el("button", "button button--primary", "Sign in");
    var registerButton = el("button", "button button--quiet", "Create account");
    loginButton.type = "submit";
    loginButton.dataset.authAction = "login";
    registerButton.type = "submit";
    registerButton.dataset.authAction = "register";
    actions.append(loginButton, registerButton);
    form.append(nameLabel, emailLabel, passwordLabel, actions);
    section.append(form, status);
    return section;
  }

  function renderProfileMetric(icon, value, label) {
    var metric = el("div", "profile-metric");
    metric.append(el("span", "profile-metric__icon", icon), el("strong", null, value), el("small", null, label));
    return metric;
  }

  function renderBadgeButton(state, large) {
    var badge = state.badge;
    var button = el("button", (large ? "badge-card" : "profile-badge") + (state.unlocked ? " is-unlocked" : " is-locked"));
    button.type = "button";
    if (large) {
      button.dataset.openBadge = badge.id;
      button.append(
        el("span", "badge-card__icon", badge.icon),
        el("span", "badge-card__copy", badge.name),
        el("span", "badge-card__status", state.unlocked ? "Unlocked" : "Locked")
      );
      button.setAttribute("aria-label", badge.name + ", " + (state.unlocked ? "unlocked" : "locked") + ". Open details.");
    } else {
      button.dataset.profileBadge = badge.id;
      button.setAttribute("aria-pressed", String(selectedBadgeId === badge.id));
      button.append(el("span", null, badge.icon), el("small", null, badge.name));
      button.setAttribute("aria-label", badge.name + ", " + (state.unlocked ? "unlocked" : "locked"));
    }
    return button;
  }

  function handleProfileClick(event) {
    var syncButton = event.target.closest("button[data-sync-now]");
    var signOutButton = event.target.closest("button[data-sign-out]");
    if (syncButton) {
      manualSync(syncButton);
      return;
    }
    if (signOutButton) {
      signOut();
      return;
    }
    var badgeButton = event.target.closest("button[data-profile-badge]");
    if (!badgeButton) {
      if (event.target.closest("a")) {
        closeProfile();
      }
      return;
    }
    selectedBadgeId = badgeButton.dataset.profileBadge;
    var states = getBadgeStates(getOverallStats());
    var selected = states.find(function (state) { return state.badge.id === selectedBadgeId; });
    if (!selected) {
      return;
    }
    elements.profilePanel.querySelectorAll("button[data-profile-badge]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button === badgeButton));
    });
    var detail = elements.profilePanel.querySelector(".profile-badge-detail");
    detail.replaceChildren(
      el("strong", null, selected.badge.name + (selected.unlocked ? " · Unlocked" : " · Locked")),
      el("p", null, selected.badge.description)
    );
  }

  function handleProfileSubmit(event) {
    var form = event.target.closest("form[data-auth-form]");
    if (!form) {
      return;
    }
    event.preventDefault();
    var action = event.submitter && event.submitter.dataset.authAction === "register" ? "register" : "login";
    authenticate(form, action);
  }

  async function authenticate(form, action) {
    var buttons = form.querySelectorAll("button[type='submit']");
    var formData = new FormData(form);
    var email = String(formData.get("email") || "").trim();
    var password = String(formData.get("password") || "");
    var displayName = String(formData.get("displayName") || "").trim();
    buttons.forEach(function (button) { button.disabled = true; });
    setSyncStatus("working", action === "register" ? "Creating your account…" : "Signing in…");
    try {
      var body = { email: email, password: password };
      if (action === "register") {
        var fallbackName = email.split("@")[0] || "";
        body.displayName = displayName || (fallbackName.length >= 2 ? fallbackName : "Python learner");
      }
      var response = await apiRequest("/api/auth/" + action, {
        method: "POST",
        body: body,
        authenticated: false
      });
      authToken = String(response.token || "");
      currentUser = response.user || null;
      if (!authToken || !currentUser) {
        throw new Error("The server did not return a usable session.");
      }
      accountFileSaves.clear();
      safeWrite(STORAGE_KEYS.authToken, authToken);
      try {
        await syncFromServerAndPush();
      } catch (syncError) {
        setSyncStatus("error", "Signed in, but sync is temporarily unavailable. Local work is safe.");
      }
      renderRoute(false);
      openProfile();
      announce("Signed in as " + (currentUser.displayName || currentUser.email) + ". Account sync is now enabled.");
    } catch (error) {
      authToken = "";
      currentUser = null;
      accountFileSaves.clear();
      safeRemove(STORAGE_KEYS.authToken);
      setSyncStatus("error", getErrorMessage(error));
      buttons.forEach(function (button) { button.disabled = false; });
    }
  }

  async function restoreAuthenticatedSession() {
    if (!authToken) {
      return;
    }
    try {
      var response = await apiRequest("/api/me");
      currentUser = response.user || null;
      if (!currentUser) {
        throw new Error("The saved session is no longer valid.");
      }
      await syncFromServerAndPush();
      renderRoute(false);
    } catch (error) {
      if (error && error.status === 401) {
        authToken = "";
        currentUser = null;
        accountFileSaves.clear();
        safeRemove(STORAGE_KEYS.authToken);
        setSyncStatus("error", "Your session expired. Local work is still safe; sign in again to resume sync.");
      } else {
        setSyncStatus("error", "Cloud sync is unavailable. Local mode remains fully usable.");
      }
      renderProfile();
    }
  }

  async function manualSync(button) {
    if (!authToken || !currentUser) {
      return;
    }
    button.disabled = true;
    setSyncStatus("working", "Merging local and account progress…");
    flushDrafts();
    try {
      await syncFromServerAndPush();
      renderRoute(false);
      openProfile();
      announce("Sync complete. Passed exercises and learning progress were merged safely.");
    } catch (error) {
      setSyncStatus("error", "Sync failed. No local work was removed. " + getErrorMessage(error));
      if (button.isConnected) {
        button.disabled = false;
      }
    }
  }

  async function signOut() {
    window.clearTimeout(stateSyncTimer);
    stateSyncTimer = null;
    setSyncStatus("working", "Signing out…");
    try {
      if (authToken) {
        await apiRequest("/api/auth/logout", { method: "POST", timeoutMs: 3000 });
      }
    } catch (error) {
      // Local sign-out must still succeed if the API is offline.
    } finally {
      authToken = "";
      currentUser = null;
      remoteFilesLoaded.clear();
      accountFileSaves.clear();
      safeRemove(STORAGE_KEYS.authToken);
      if (currentRoute && currentRoute.name === "exercise") {
        setSubmissionSaveStatus(
          String(currentRoute.exercise.id),
          "local",
          "Local draft only. Sign in from your profile to create a durable chapter exNN.py file."
        );
      }
      setSyncStatus("idle", "Local-only mode");
      renderProfile();
      announce("Signed out. Your browser drafts and progress remain available locally.");
    }
  }

  async function syncFromServerAndPush() {
    var response = await apiRequest("/api/state");
    mergeRemoteState(response && response.state);
    await pushLocalState();
    setSyncStatus("success", "Synced just now");
  }

  function mergeRemoteState(remoteState) {
    if (!remoteState || typeof remoteState !== "object" || Array.isArray(remoteState)) {
      return;
    }
    suppressStateSync = true;
    try {
      if (Array.isArray(remoteState.passedIds)) {
        remoteState.passedIds.map(String).forEach(function (exerciseId) {
          if (validExerciseIds.has(exerciseId)) {
            passed.add(exerciseId);
          }
        });
      }
      if (remoteState.drafts && typeof remoteState.drafts === "object" && !Array.isArray(remoteState.drafts)) {
        Object.keys(remoteState.drafts).forEach(function (exerciseId) {
          var value = remoteState.drafts[exerciseId];
          if (validExerciseIds.has(exerciseId) && !drafts.has(exerciseId) && typeof value === "string" && value !== starterCode[exerciseId]) {
            drafts.set(exerciseId, value);
          }
        });
      }
      if (remoteState.learningProgress && typeof remoteState.learningProgress === "object" && !Array.isArray(remoteState.learningProgress)) {
        Object.keys(remoteState.learningProgress).forEach(function (chapterId) {
          var chapter = chapterById.get(chapterId);
          var remoteItems = remoteState.learningProgress[chapterId];
          if (!chapter || !Array.isArray(remoteItems)) {
            return;
          }
          var validItems = new Set(getLearningItemIds(chapter));
          var mergedItems = learningProgress.get(chapterId) || new Set();
          remoteItems.map(String).forEach(function (itemId) {
            if (validItems.has(itemId)) {
              mergedItems.add(itemId);
            }
          });
          learningProgress.set(chapterId, mergedItems);
        });
      }
      if (!safeRead(STORAGE_KEYS.editorMode) && (remoteState.editorMode === "vim" || remoteState.editorMode === "sublime")) {
        editorMode = remoteState.editorMode;
        safeWrite(STORAGE_KEYS.editorMode, editorMode);
      }
      persistPassed();
      flushDrafts();
      persistLearningProgress();
    } finally {
      suppressStateSync = false;
    }
  }

  function serializeLocalState() {
    var serializedDrafts = {};
    var serializedLearning = {};
    drafts.forEach(function (value, exerciseId) {
      serializedDrafts[exerciseId] = value;
    });
    learningProgress.forEach(function (items, chapterId) {
      serializedLearning[chapterId] = Array.from(items).sort();
    });
    return {
      passedIds: Array.from(passed).sort(),
      drafts: serializedDrafts,
      learningProgress: serializedLearning,
      editorMode: editorMode
    };
  }

  async function pushLocalState() {
    if (!authToken || !currentUser) {
      return null;
    }
    return apiRequest("/api/state", {
      method: "PUT",
      body: { state: serializeLocalState() }
    });
  }

  function queueStateSync() {
    if (suppressStateSync || !authToken || !currentUser) {
      return;
    }
    window.clearTimeout(stateSyncTimer);
    stateSyncTimer = window.setTimeout(async function () {
      stateSyncTimer = null;
      setSyncStatus("working", "Saving account progress…");
      try {
        await pushLocalState();
        setSyncStatus("success", "Changes synced");
      } catch (error) {
        setSyncStatus("error", "Cloud sync paused. Local changes are safe.");
      }
    }, 900);
  }

  async function loadRemoteExerciseFile(exerciseId) {
    if (!authToken || !currentUser || remoteFilesLoaded.has(exerciseId)) {
      return;
    }
    try {
      var response = await apiRequest("/api/files/" + encodeURIComponent(exerciseId));
      var file = response && response.file;
      if (!file || typeof file.content !== "string") {
        remoteFilesLoaded.add(exerciseId);
        return;
      }
      setSubmissionSaveStatus(
        exerciseId,
        file.mirrorStatus === "saved" ? "account" : "ready",
        describeAccountFileLocation(file, getSafePythonFilename(exerciseById.get(exerciseId)))
      );
      if (drafts.has(exerciseId)) {
        remoteFilesLoaded.add(exerciseId);
        return;
      }
      if (!activeEditor || activeEditor.exerciseId !== exerciseId) {
        return;
      }
      remoteFilesLoaded.add(exerciseId);
      if (file.content !== starterCode[exerciseId]) {
        activeEditor.setValue(file.content);
        scheduleDraftSave(exerciseId, file.content, true);
        var state = elements.main.querySelector("[data-editor-state='" + cssEscape(exerciseId) + "']");
        if (state) {
          state.textContent = "Synced file restored";
        }
        announce("Your saved account file was restored without replacing a local draft.");
      }
    } catch (error) {
      if (error && error.status === 404) {
        remoteFilesLoaded.add(exerciseId);
        return;
      }
      setSyncStatus("error", "Could not load the account file. Your local draft is unchanged.");
    }
  }

  function persistRunDetails(exerciseId, scope, results, allPassed, completedAt, sessionToken) {
    var passedCount = results.filter(function (result) { return result.passed; }).length;
    return apiRequest("/api/runs", {
      method: "POST",
      token: sessionToken,
      body: {
        exerciseId: exerciseId,
        scope: scope,
        passedCount: passedCount,
        totalCount: results.length,
        allPassed: allPassed,
        completedAt: new Date(completedAt).toISOString(),
        results: results.map(function (result) {
          return {
            id: result.id,
            name: result.name,
            hidden: Boolean(result.hidden),
            passed: Boolean(result.passed),
            expected: result.expected,
            actual: result.actual,
            stdout: result.stdout,
            stderr: result.stderr,
            traceback: result.traceback
          };
        })
      }
    });
  }

  async function apiRequest(path, options) {
    var config = options || {};
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, config.timeoutMs || 10000);
    var headers = { Accept: "application/json" };
    if (config.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    var requestToken = Object.prototype.hasOwnProperty.call(config, "token") ? config.token : authToken;
    if (config.authenticated !== false && requestToken) {
      headers.Authorization = "Bearer " + requestToken;
    }
    try {
      var response = await fetch(path, {
        method: config.method || "GET",
        headers: headers,
        body: config.body === undefined ? undefined : JSON.stringify(config.body),
        signal: controller.signal
      });
      var payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }
      if (!response.ok) {
        var message = payload && payload.error && payload.error.message
          ? payload.error.message
          : "Request failed with status " + response.status + ".";
        var requestError = new Error(message);
        requestError.status = response.status;
        requestError.code = payload && payload.error ? payload.error.code : "REQUEST_FAILED";
        throw requestError;
      }
      return payload || {};
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("The server took too long to respond.");
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setSyncStatus(kind, message) {
    syncState = { kind: kind, message: message };
    var status = elements.profilePanel.querySelector("[data-sync-status]");
    if (status) {
      status.className = "profile-sync__status profile-sync__status--" + kind;
      status.textContent = message;
    }
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error || "Unknown error");
  }

  function getUserInitials(user) {
    var source = String(user.displayName || user.email || "PY").trim();
    var parts = source.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
  }

  function renderBadgeDialog() {
    var dialog = el("dialog", "badge-dialog");
    dialog.id = "badge-dialog";
    var card = el("div", "badge-dialog__card");
    var close = el("button", "icon-button badge-dialog__close", "×");
    close.type = "button";
    close.dataset.closeBadgeDialog = "true";
    close.setAttribute("aria-label", "Close badge details");
    var content = el("div", "badge-dialog__content");
    content.dataset.badgeDialogContent = "true";
    card.append(close, content);
    dialog.append(card);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    return dialog;
  }

  function openBadgeDialog(badgeId) {
    var dialog = document.getElementById("badge-dialog");
    var content = dialog && dialog.querySelector("[data-badge-dialog-content]");
    var state = getBadgeStates(getOverallStats()).find(function (candidate) {
      return candidate.badge.id === badgeId;
    });
    if (!dialog || !content || !state) {
      return;
    }
    content.replaceChildren(
      el("span", "badge-dialog__icon " + (state.unlocked ? "is-unlocked" : "is-locked"), state.badge.icon),
      el("p", "eyebrow", state.unlocked ? "Badge unlocked" : "Badge locked"),
      el("h2", null, state.badge.name),
      el("p", null, state.badge.description),
      el("strong", "badge-dialog__requirement", getBadgeRequirementText(state.badge))
    );
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeBadgeDialog() {
    var dialog = document.getElementById("badge-dialog");
    if (!dialog) {
      return;
    }
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function getBadgeRequirementText(badge) {
    var criteria = badge.criteria || {};
    if (criteria.metric === "passedExercises") {
      return "Requirement: pass " + criteria.value + " exercise" + (criteria.value === 1 ? "" : "s") + ".";
    }
    if (criteria.metric === "completedChapters") {
      return "Requirement: complete " + criteria.value + " chapter" + (criteria.value === 1 ? "" : "s") + ".";
    }
    if (criteria.metric === "earnedStars") {
      return "Requirement: collect " + criteria.value + " difficulty stars.";
    }
    if (criteria.metric === "highestPassedDifficulty") {
      return "Requirement: pass a difficulty " + criteria.value + " exercise.";
    }
    if (criteria.metric === "progressPercent") {
      return "Requirement: reach " + criteria.value + "% overall completion.";
    }
    if (criteria.metric === "chaptersComplete") {
      return "Requirement: complete the listed collection chapters.";
    }
    if (criteria.metric === "chapterComplete") {
      var chapter = chapterById.get(criteria.chapterId);
      return "Requirement: complete " + (chapter ? chapter.title : criteria.chapterId) + ".";
    }
    return "Requirement: continue passing the full exercise suites.";
  }

  function toggleProfile() {
    var open = elements.profilePanel.hidden;
    elements.profilePanel.hidden = !open;
    elements.profileButton.setAttribute("aria-expanded", String(open));
    if (open) {
      renderProfile();
    }
  }

  function openProfile() {
    renderProfile();
    elements.profilePanel.hidden = false;
    elements.profileButton.setAttribute("aria-expanded", "true");
  }

  function closeProfile() {
    elements.profilePanel.hidden = true;
    elements.profileButton.setAttribute("aria-expanded", "false");
  }

  function handleDocumentClick(event) {
    if (event.target.closest("a, button, summary")) {
      audio.playClick();
    }
    if (!elements.profilePanel.hidden && !event.target.closest(".profile-menu")) {
      closeProfile();
    }
  }

  function handleDocumentKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }
    if (!elements.profilePanel.hidden) {
      closeProfile();
      elements.profileButton.focus();
    }
  }

  function toggleTheme() {
    var current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    safeWrite(STORAGE_KEYS.theme, next);
    syncThemeButton();
    announce(next === "dark" ? "Dark mode enabled." : "Light mode enabled.");
  }

  async function toggleSound() {
    var enabled = audio.toggle();
    syncSoundButton();
    if (enabled) {
      await audio.unlock();
      audio.playClick();
    }
    announce(enabled ? "Interface sounds enabled." : "Interface sounds muted.");
  }

  function syncSoundButton() {
    var enabled = audio.enabled();
    elements.soundToggle.setAttribute("aria-pressed", String(enabled));
    elements.soundToggle.setAttribute("aria-label", enabled ? "Mute interface sounds" : "Enable interface sounds");
  }

  function unlockAudio() {
    audio.unlock();
  }

  function syncThemeButton() {
    var dark = document.documentElement.dataset.theme === "dark";
    elements.themeToggle.setAttribute("aria-pressed", String(dark));
    elements.themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  function getOverallStats() {
    var totalExercises = validExerciseIds.size;
    var passedExercises = passed.size;
    var maxStars = Array.from(exerciseById.values()).reduce(function (sum, exercise) {
      return sum + getDifficulty(exercise);
    }, 0);
    var earnedStars = Array.from(exerciseById.entries()).reduce(function (sum, entry) {
      return sum + (passed.has(entry[0]) ? getDifficulty(entry[1]) : 0);
    }, 0);
    var completedChapterIds = chapters.filter(function (chapter) {
      var progress = getChapterProgress(chapter);
      return progress.total > 0 && progress.done === progress.total;
    }).map(function (chapter) { return String(chapter.id); });
    var highestPassedDifficulty = Array.from(exerciseById.entries()).reduce(function (max, entry) {
      return passed.has(entry[0]) ? Math.max(max, getDifficulty(entry[1])) : max;
    }, 0);
    return {
      totalExercises: totalExercises,
      passedExercises: passedExercises,
      maxStars: maxStars,
      earnedStars: earnedStars,
      completedChapters: completedChapterIds.length,
      completedChapterIds: completedChapterIds,
      highestPassedDifficulty: highestPassedDifficulty,
      progressPercent: totalExercises ? Math.round((passedExercises / totalExercises) * 100) : 0
    };
  }

  function getChapterProgress(chapter) {
    var exercises = getExercises(chapter);
    var done = 0;
    var stars = 0;
    var maxStars = 0;
    exercises.forEach(function (exercise) {
      var difficulty = getDifficulty(exercise);
      maxStars += difficulty;
      if (passed.has(String(exercise.id))) {
        done += 1;
        stars += difficulty;
      }
    });
    return {
      done: done,
      total: exercises.length,
      percent: exercises.length ? Math.round((done / exercises.length) * 100) : 0,
      stars: stars,
      maxStars: maxStars
    };
  }

  function getRanks() {
    var fallback = [
      { level: 1, name: "PEP Explorer", minStars: 0, minExercises: 0, description: "Begin with precise traces and small programs." },
      { level: 2, name: "Indent Apprentice", minStars: 8, minExercises: 3, description: "Build dependable first programs." },
      { level: 3, name: "Loop Tamer", minStars: 27, minExercises: 10, description: "Control repetition with intention." },
      { level: 4, name: "Function Forger", minStars: 55, minExercises: 22, description: "Shape reusable contracts." },
      { level: 5, name: "Collection Alchemist", minStars: 91, minExercises: 36, description: "Transform Python collections cleanly." },
      { level: 6, name: "Recursion Ranger", minStars: 132, minExercises: 52, description: "Navigate self-similar problems." },
      { level: 7, name: "Algorithm Architect", minStars: 181, minExercises: 72, description: "Design with invariants and complexity in mind." },
      { level: 8, name: "Pythonic Grandmaster", minStars: 239, minExercises: 92, description: "Every challenge is green." }
    ];
    var source = Array.isArray(learning.ranks) && learning.ranks.length === 8 ? learning.ranks : fallback;
    return source.slice().sort(function (a, b) { return Number(a.level) - Number(b.level); }).map(function (rank, index) {
      return {
        level: Number(rank.level) || index + 1,
        name: rank.name || fallback[index].name,
        minStars: Number(rank.minStars) || 0,
        minExercises: Number(rank.minExercises) || 0,
        description: rank.description || fallback[index].description,
        accent: rank.accent || null
      };
    });
  }

  function getCurrentRank(stats) {
    return getRanks().reduce(function (current, candidate) {
      if (stats.earnedStars >= candidate.minStars && stats.passedExercises >= candidate.minExercises) {
        return candidate;
      }
      return current;
    }, getRanks()[0]);
  }

  function getNextRank(rank) {
    return getRanks().find(function (candidate) {
      return candidate.level === rank.level + 1;
    }) || null;
  }

  function getBadgeStates(stats) {
    var badges = Array.isArray(learning.badges) ? learning.badges : [];
    return badges.map(function (badge) {
      return { badge: badge, unlocked: evaluateBadge(badge, stats) };
    });
  }

  function evaluateBadge(badge, stats) {
    var criteria = badge.criteria || {};
    var actual;
    if (criteria.metric === "passedExercises") {
      actual = stats.passedExercises;
    } else if (criteria.metric === "completedChapters") {
      actual = stats.completedChapters;
    } else if (criteria.metric === "earnedStars") {
      actual = stats.earnedStars;
    } else if (criteria.metric === "highestPassedDifficulty") {
      actual = stats.highestPassedDifficulty;
    } else if (criteria.metric === "progressPercent") {
      actual = stats.progressPercent;
    } else if (criteria.metric === "chaptersComplete") {
      actual = stats.completedChapterIds;
    } else if (criteria.metric === "chapterComplete") {
      actual = stats.completedChapterIds.indexOf(String(criteria.chapterId)) >= 0;
    } else {
      return false;
    }

    if (criteria.operator === ">=") {
      return Number(actual) >= Number(criteria.value);
    }
    if (criteria.operator === "==") {
      return actual === criteria.value;
    }
    if (criteria.operator === "containsAll") {
      return Array.isArray(actual) && Array.isArray(criteria.value) && criteria.value.every(function (item) {
        return actual.indexOf(String(item)) >= 0;
      });
    }
    return false;
  }

  function getContinueChapter() {
    var lastExerciseId = safeRead(STORAGE_KEYS.lastExercise);
    if (lastExerciseId && chapterForExercise.has(lastExerciseId)) {
      return chapterForExercise.get(lastExerciseId);
    }
    return chapters.find(function (chapter) {
      var progress = getChapterProgress(chapter);
      return progress.done < progress.total;
    }) || chapters[0];
  }

  function getChapterLearning(chapter) {
    return learning.chapters && learning.chapters[String(chapter.id)]
      ? learning.chapters[String(chapter.id)]
      : null;
  }

  function getLearningItemIds(chapter) {
    var content = getChapterLearning(chapter);
    var tutorials = content && Array.isArray(content.tutorial) ? content.tutorial : [];
    var itemIds = tutorials.map(function (_tutorial, index) {
      return "tutorial-" + index;
    });
    itemIds.push("runbook");
    return itemIds;
  }

  function getChapterLearningProgress(chapter) {
    var itemIds = getLearningItemIds(chapter);
    var understood = learningProgress && learningProgress.get(String(chapter.id));
    var done = itemIds.reduce(function (count, itemId) {
      return count + (understood && understood.has(itemId) ? 1 : 0);
    }, 0);
    return {
      done: done,
      total: itemIds.length,
      percent: itemIds.length ? Math.round((done / itemIds.length) * 100) : 0
    };
  }

  function isLearningUnderstood(chapter, itemId) {
    var items = learningProgress && learningProgress.get(String(chapter.id));
    return Boolean(items && items.has(itemId));
  }

  function readLearningProgress() {
    var result = new Map();
    var raw = safeRead(STORAGE_KEYS.learning);
    if (!raw) {
      return result;
    }
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return result;
      }
      Object.keys(parsed).forEach(function (chapterId) {
        if (!chapterById.has(chapterId) || !Array.isArray(parsed[chapterId])) {
          return;
        }
        var validIds = new Set(getLearningItemIds(chapterById.get(chapterId)));
        result.set(chapterId, new Set(parsed[chapterId].map(String).filter(function (itemId) {
          return validIds.has(itemId);
        })));
      });
      return result;
    } catch (error) {
      return new Map();
    }
  }

  function persistLearningProgress() {
    var serialized = {};
    learningProgress.forEach(function (items, chapterId) {
      serialized[chapterId] = Array.from(items).sort();
    });
    safeWrite(STORAGE_KEYS.learning, JSON.stringify(serialized));
    queueStateSync();
  }

  function renderBreadcrumbs(items) {
    var nav = el("nav", "breadcrumbs");
    var list = el("ol");
    nav.setAttribute("aria-label", "Breadcrumb");
    items.forEach(function (item, index) {
      var entry = el("li");
      if (item.href) {
        entry.append(anchor(item.href, null, item.label));
      } else {
        var current = el("span", null, item.label);
        current.setAttribute("aria-current", "page");
        entry.append(current);
      }
      if (index < items.length - 1) {
        entry.append(el("span", "breadcrumbs__separator", "/"));
      }
      list.append(entry);
    });
    nav.append(list);
    return nav;
  }

  function renderChapterArt(chapter, className) {
    var number = Math.max(1, Math.min(11, Number(chapter.number) || 1));
    var index = number - 1;
    var column = index % 4;
    var row = Math.floor(index / 4);
    var art = el("div", className);
    var label = el("span", "chapter-art__label", "PY" + padChapter(number));
    art.style.backgroundPosition = (column * 100 / 3) + "% " + (row * 100 / 2) + "%";
    art.setAttribute("role", "img");
    art.setAttribute("aria-label", "Illustration for " + chapter.title);
    art.append(label);
    return art;
  }

  function renderTags(topics, limit) {
    var list = el("ul", "tag-list");
    var values = Array.isArray(topics) ? topics : [];
    if (limit) {
      values = values.slice(0, limit);
    }
    values.forEach(function (topic) {
      list.append(el("li", "tag", topic));
    });
    return list;
  }

  function renderDifficultyStars(exercise, isPassed) {
    var difficulty = getDifficulty(exercise);
    var wrapper = el("span", "difficulty-stars" + (isPassed ? " is-passed" : ""));
    wrapper.setAttribute("role", "img");
    wrapper.setAttribute(
      "aria-label",
      "Difficulty " + difficulty + " out of 5" + (isPassed ? ", " + difficulty + " " + pluralize(difficulty, "star") + " collected" : "")
    );
    for (var index = 1; index <= 5; index += 1) {
      var star = el("span", index <= difficulty ? "is-filled" : "is-empty", index <= difficulty ? "★" : "☆");
      star.setAttribute("aria-hidden", "true");
      wrapper.append(star);
    }
    return wrapper;
  }

  function progressElement(value, max, label) {
    var progress = el("progress", "progress-bar");
    progress.max = Math.max(Number(max) || 0, 1);
    progress.value = Math.min(Number(value) || 0, progress.max);
    progress.setAttribute("aria-label", label);
    return progress;
  }

  function getExercises(chapter) {
    return chapter && Array.isArray(chapter.exercises) ? chapter.exercises : [];
  }

  function getDifficulty(exercise) {
    return Math.min(5, Math.max(1, Number(exercise && exercise.difficulty) || 1));
  }

  function getExerciseFileName(exercise) {
    var parts = String(exercise.file || "solution.py").split("/");
    return parts[parts.length - 1] || "solution.py";
  }

  function getSafePythonFilename(exercise) {
    var base = String(exercise && exercise.id ? exercise.id : getExerciseFileName(exercise || {}))
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return (base || "python-exercise") + ".py";
  }

  function readEditorMode() {
    return safeRead(STORAGE_KEYS.editorMode) === "vim" ? "vim" : "sublime";
  }

  function getAceKeyboardHandler(mode) {
    return mode === "vim" ? "ace/keyboard/vim" : "ace/keyboard/sublime";
  }

  function getStartingCode(exerciseId) {
    if (drafts.has(exerciseId)) {
      return drafts.get(exerciseId);
    }
    if (Object.prototype.hasOwnProperty.call(starterCode, exerciseId)) {
      return starterCode[exerciseId];
    }
    return "# Write your solution here.\n";
  }

  function updateEditorChrome(exerciseId, value, state, modified) {
    var source = Object.prototype.hasOwnProperty.call(starterCode, exerciseId) ? starterCode[exerciseId] : "";
    var changed = value !== source;
    state.textContent = changed ? "Draft saved locally" : "Clean starter · solution hidden";
    modified.classList.toggle("is-visible", changed);
    modified.setAttribute("aria-label", changed ? "Draft differs from starter code" : "Starter code");
  }

  function updateTextareaPosition(textarea, position) {
    var beforeCursor = textarea.value.slice(0, textarea.selectionStart || 0).split("\n");
    position.textContent = "Ln " + beforeCursor.length + ", Col " + (beforeCursor[beforeCursor.length - 1].length + 1);
  }

  function formatTestInput(test, mode) {
    if (mode === "script") {
      var inputs = Array.isArray(test.input) ? test.input : [];
      return inputs.length ? inputs.join("\n") : "<no input>";
    }
    return test.call || "<no call defined>";
  }

  function formatPlannedExpected(test, mode) {
    if (mode === "script") {
      return test.expectedOutput === undefined ? "<not defined>" : visibleWhitespace(String(test.expectedOutput));
    }
    return test.expected === undefined ? "<not defined>" : String(test.expected);
  }

  function visibleWhitespace(value) {
    return value.endsWith("\n") ? value.slice(0, -1) + " ↵" : value;
  }

  function readPassedIds() {
    var raw = safeRead(STORAGE_KEYS.passed);
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (error) {
      return [];
    }
  }

  function persistPassed() {
    safeWrite(STORAGE_KEYS.passed, JSON.stringify(Array.from(passed).sort()));
    queueStateSync();
  }

  function readDrafts() {
    var raw = safeRead(STORAGE_KEYS.drafts);
    var result = new Map();
    if (!raw) {
      return result;
    }
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return result;
      }
      Object.keys(parsed).forEach(function (exerciseId) {
        if (
          validExerciseIds.has(exerciseId) &&
          typeof parsed[exerciseId] === "string" &&
          parsed[exerciseId] !== starterCode[exerciseId]
        ) {
          result.set(exerciseId, parsed[exerciseId]);
        }
      });
    } catch (error) {
      return new Map();
    }
    return result;
  }

  function scheduleDraftSave(exerciseId, value, flushImmediately) {
    window.clearTimeout(draftPersistTimer);
    if (value === starterCode[exerciseId]) {
      drafts.delete(exerciseId);
    } else {
      drafts.set(exerciseId, value);
    }
    if (flushImmediately) {
      flushDrafts();
      return;
    }
    draftPersistTimer = window.setTimeout(flushDrafts, 250);
  }

  function discardDraft(exerciseId) {
    drafts.delete(exerciseId);
    flushDrafts();
  }

  function flushDrafts() {
    window.clearTimeout(draftPersistTimer);
    draftPersistTimer = null;
    var serialized = {};
    drafts.forEach(function (value, exerciseId) {
      serialized[exerciseId] = value;
    });
    safeWrite(STORAGE_KEYS.drafts, JSON.stringify(serialized));
    queueStateSync();
  }

  function safeRead(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function createSilentAudio() {
    return {
      enabled: function () { return false; },
      setEnabled: function () { return false; },
      toggle: function () { return false; },
      unlock: function () { return Promise.resolve(false); },
      playClick: function () { return false; },
      playSubmit: function () { return false; },
      playFailure: function () { return false; },
      playSuccess: function () { return false; },
      playAchievement: function () { return false; }
    };
  }

  function safeWrite(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // The app remains usable without persistent storage.
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // Signing out still clears the in-memory token when storage is unavailable.
    }
  }

  function announce(message) {
    elements.status.textContent = "";
    window.setTimeout(function () {
      elements.status.textContent = message;
    }, 0);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function padChapter(value) {
    return String(value).padStart(2, "0");
  }

  function pluralize(value, singular) {
    return Number(value) === 1 ? singular : singular + "s";
  }

  function domId(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/["'\\]/g, "\\$&");
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

  function anchor(href, className, textContent, ariaLabel) {
    var link = el("a", className, textContent);
    link.href = href;
    if (ariaLabel) {
      link.setAttribute("aria-label", ariaLabel);
    }
    return link;
  }

  function createPythonRunner() {
    var worker = null;
    var readyPromise = null;
    var readyResolve = null;
    var readyReject = null;
    var startupTimer = null;
    var requestCounter = 0;
    var pending = new Map();

    function ensureReady() {
      if (window.location.protocol === "file:") {
        return Promise.reject(new Error("Python execution needs the local web server; module workers cannot start from a file:// page."));
      }
      if (readyPromise) {
        return readyPromise;
      }
      readyPromise = new Promise(function (resolve, reject) {
        readyResolve = resolve;
        readyReject = reject;
      });
      try {
        worker = new Worker("python-runner-worker.mjs", { type: "module" });
      } catch (error) {
        var failedReadyPromise = readyPromise;
        readyReject(error);
        resetWorker();
        return failedReadyPromise;
      }
      startupTimer = window.setTimeout(function () {
        var error = new Error("Python took too long to load. Check the network connection and try again.");
        if (readyReject) {
          readyReject(error);
        }
        resetWorker(error);
      }, 90000);
      worker.addEventListener("message", handleWorkerMessage);
      worker.addEventListener("error", function (event) {
        var error = new Error(event.message || "The Python worker could not start.");
        if (readyReject) {
          readyReject(error);
        }
        resetWorker(error);
      });
      return readyPromise;
    }

    function handleWorkerMessage(event) {
      var message = event.data || {};
      if (message.type === "ready") {
        window.clearTimeout(startupTimer);
        startupTimer = null;
        if (readyResolve) {
          readyResolve();
        }
        readyResolve = null;
        readyReject = null;
        return;
      }
      if (message.type === "startup-error") {
        var startupError = new Error("Python could not load: " + message.error);
        if (readyReject) {
          readyReject(startupError);
        }
        resetWorker(startupError);
        return;
      }
      var request = pending.get(message.id);
      if (!request) {
        return;
      }
      window.clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.type === "result") {
        request.resolve(message.results || []);
      } else {
        request.reject(new Error("Python runner error: " + (message.error || "Unknown error")));
      }
    }

    function resetWorker(error) {
      window.clearTimeout(startupTimer);
      startupTimer = null;
      if (worker) {
        worker.terminate();
      }
      worker = null;
      pending.forEach(function (request) {
        window.clearTimeout(request.timer);
        request.reject(error || new Error("The Python runner was restarted."));
      });
      pending.clear();
      readyPromise = null;
      readyResolve = null;
      readyReject = null;
    }

    async function run(code, mode, tests) {
      await ensureReady();
      requestCounter += 1;
      var requestId = "run-" + requestCounter;
      return new Promise(function (resolve, reject) {
        var timer = window.setTimeout(function () {
          pending.delete(requestId);
          var timeoutError = new Error("The test run exceeded 12 seconds. The runner restarted to stop a possible infinite loop.");
          reject(timeoutError);
          resetWorker(timeoutError);
        }, 12000);
        pending.set(requestId, { resolve: resolve, reject: reject, timer: timer });
        worker.postMessage({ id: requestId, code: code, mode: mode, tests: tests });
      });
    }

    return { run: run };
  }

  function renderDataError() {
    var shell = el("div", "page-shell error-page");
    var card = el("section", "error-card");
    card.append(
      el("span", "error-card__icon", "!"),
      el("h1", null, "The course data could not be loaded"),
      el("p", null, "Make sure exercise-data.js is beside index.html, then refresh the page.")
    );
    shell.append(card);
    elements.main.replaceChildren(shell);
    document.title = "Data unavailable · Python EduGround";
  }
})();
