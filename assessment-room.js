(function () {
  "use strict";

  function createAssessmentRooms(options) {
    var data = options.data || { blocks: [] };
    var engine = options.engine || {};
    var activeEditor = null;
    var timerId = null;
    var saveTimer = null;
    var runInProgress = false;
    var finalizingAttemptId = null;
    var pendingPracticalExpiration = null;

    function element(tagName, className, text) {
      var node = document.createElement(tagName);
      if (className) {
        node.className = className;
      }
      if (text !== undefined && text !== null) {
        node.textContent = text;
      }
      return node;
    }

    function link(href, className, text) {
      var node = element("a", className, text);
      node.href = href;
      return node;
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function workspaceEpoch() {
      return typeof options.getWorkspaceEpoch === "function" ? options.getWorkspaceEpoch() : null;
    }

    function workspaceChanged(capturedEpoch) {
      return capturedEpoch !== null && typeof options.getWorkspaceEpoch === "function" && options.getWorkspaceEpoch() !== capturedEpoch;
    }

    function currentProgress() {
      var progress = options.getProgress();
      return progress && typeof progress === "object"
        ? clone(progress)
        : { version: Number(data.version) || 1, blocks: {} };
    }

    function blockMode(progress, blockId, mode) {
      progress.blocks = progress.blocks && typeof progress.blocks === "object" ? progress.blocks : {};
      progress.blocks[blockId] = progress.blocks[blockId] || {};
      progress.blocks[blockId][mode] = progress.blocks[blockId][mode] || { active: null, history: [] };
      var state = progress.blocks[blockId][mode];
      state.history = Array.isArray(state.history) ? state.history : [];
      return state;
    }

    function readMode(blockId, mode) {
      return blockMode(currentProgress(), blockId, mode);
    }

    function save(progress, immediate) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
      if (immediate) {
        options.saveProgress(progress);
        return;
      }
      saveTimer = window.setTimeout(function () {
        saveTimer = null;
        options.saveProgress(progress);
      }, 180);
    }

    function durationSeconds(block, mode) {
      var modeDefinition = block && block[mode];
      var configured = modeDefinition && modeDefinition.durationSeconds;
      if (!configured) {
        configured = mode === "theory"
          ? data.theoryDurationSeconds || Number(data.theoryDurationMinutes) * 60
          : data.practicalDurationSeconds || Number(data.practicalDurationMinutes) * 60;
      }
      return Number(configured) || (mode === "theory" ? 1200 : 3600);
    }

    function passingScore(block, mode) {
      var modeDefinition = block && block[mode];
      return Number(modeDefinition && modeDefinition.passPercent) || Number(data.passingScore) || 60;
    }

    function modeLabel(mode) {
      return mode === "theory" ? "Theory exam" : "Practical exam";
    }

    function durationLabel(block, mode) {
      var seconds = durationSeconds(block, mode);
      return seconds % 60 === 0 ? Math.floor(seconds / 60) + ":00" : formatTime(seconds);
    }

    function blockChapterLabel(block) {
      var values = Array.isArray(block.chapters) ? block.chapters : [];
      return values.map(function (chapterId) {
        return options.getChapterLabel(chapterId);
      }).join(" · ");
    }

    function bestAttempt(history) {
      return (Array.isArray(history) ? history : []).reduce(function (best, attempt) {
        if (!best || Number(attempt.score) > Number(best.score)) {
          return attempt;
        }
        return best;
      }, null);
    }

    function bestModeResult(state) {
      var recentBest = bestAttempt(state && state.history);
      var savedBest = Number(state && state.bestScore);
      var completed = Boolean(state && state.completed);
      var hasSavedBest = Number.isFinite(savedBest) && (savedBest > 0 || completed);
      if (
        hasSavedBest &&
        (!recentBest || savedBest > Number(recentBest.score) || (completed && !recentBest.passed))
      ) {
        return { score: savedBest, passed: completed, summaryOnly: true };
      }
      return recentBest;
    }

    function latestAttempt(history) {
      return (Array.isArray(history) ? history : []).reduce(function (latest, attempt) {
        var attemptTime = Number(attempt && (attempt.submittedAt || attempt.updatedAt || attempt.deadlineAt || attempt.startedAt)) || 0;
        var latestTime = Number(latest && (latest.submittedAt || latest.updatedAt || latest.deadlineAt || latest.startedAt)) || 0;
        return !latest || attemptTime >= latestTime ? attempt : latest;
      }, null);
    }

    function renderBreadcrumbs(items) {
      var nav = element("nav", "breadcrumbs");
      var list = element("ol");
      nav.setAttribute("aria-label", "Assessment breadcrumbs");
      items.forEach(function (item, index) {
        var entry = element("li");
        if (item.href) {
          entry.append(link(item.href, null, item.label));
        } else {
          var current = element("span", null, item.label);
          current.setAttribute("aria-current", "page");
          entry.append(current);
        }
        if (index < items.length - 1) {
          entry.append(element("span", "breadcrumbs__separator", "/"));
        }
        list.append(entry);
      });
      nav.append(list);
      return nav;
    }

    function renderHub() {
      var page = element("div", "page-shell assessment-hub-page");
      var hero = element("header", "assessment-hub-hero");
      var heroCopy = element("div");
      var rules = element("div", "assessment-rules-grid");
      heroCopy.append(
        element("p", "eyebrow", "Timed assessment rooms"),
        element("h1", null, "Prove the model under exam conditions."),
        element(
          "p",
          "assessment-hub-hero__lede",
          "Four checkpoints group the course into three-chapter stages, with a final chapters 10–11 capstone. Results are saved separately from exercise stars."
        )
      );
      rules.append(
        renderRule("15 questions", "20 minutes", "Theory · exact multiple-answer matching"),
        renderRule("5 coding tasks", "60 minutes", "Practical · 20 points per fully green task"),
        renderRule("60 / 100", "Pass mark", "Retakes keep your best result and recent history")
      );
      hero.append(heroCopy, rules);

      var section = element("section", "assessment-map");
      var heading = element("header", "section-heading section-heading--row");
      var headingCopy = element("div");
      headingCopy.append(
        element("h2", null, "Choose an assessment block"),
        element("p", null, "Complete the related runbooks first, then enter a timed room when you are ready.")
      );
      heading.append(headingCopy, element("span", "section-heading__count", data.blocks.length + " rooms"));
      section.append(heading);
      var grid = element("div", "assessment-block-grid");
      data.blocks.forEach(function (block) {
        grid.append(renderBlockCard(block));
      });
      section.append(grid);
      page.append(renderBreadcrumbs([{ label: "Chapters", href: "#home" }, { label: "Assessments" }]), hero, section);
      return page;
    }

    function renderRule(value, label, detail) {
      var card = element("article", "assessment-rule");
      card.append(element("strong", null, value), element("span", null, label), element("small", null, detail));
      return card;
    }

    function renderBlockCard(block) {
      var progress = currentProgress();
      var theory = blockMode(progress, block.id, "theory");
      var practical = blockMode(progress, block.id, "practical");
      var theoryBest = bestModeResult(theory);
      var practicalBest = bestModeResult(practical);
      var card = link("#assessment/" + encodeURIComponent(block.id), "assessment-block-card");
      var top = element("div", "assessment-block-card__top");
      var scores = element("div", "assessment-block-card__scores");
      top.append(
        element("span", "assessment-block-card__number", "Block " + String(block.number).padStart(2, "0")),
        element("span", "assessment-block-card__status", theory.active || practical.active ? "In progress" : "Ready")
      );
      scores.append(
        renderMiniScore("Theory", theoryBest, theory.active),
        renderMiniScore("Practical", practicalBest, practical.active)
      );
      card.append(
        top,
        element("h2", null, block.title),
        element("p", "assessment-block-card__chapters", blockChapterLabel(block)),
        scores,
        element("span", "assessment-block-card__open", "Open assessment room →")
      );
      return card;
    }

    function renderMiniScore(label, attempt, active) {
      var item = element("div", "assessment-mini-score" + (attempt && attempt.passed ? " is-passed" : ""));
      item.append(
        element("span", null, label),
        element("strong", null, active ? "Active" : attempt ? Number(attempt.score) + "/100" : "Not attempted")
      );
      return item;
    }

    function renderBlock(block) {
      var page = element("div", "page-shell assessment-block-page");
      var header = element("header", "assessment-block-hero");
      var copy = element("div");
      copy.append(
        element("p", "eyebrow", "Assessment block " + String(block.number).padStart(2, "0")),
        element("h1", null, block.title),
        element("p", "assessment-block-hero__chapters", blockChapterLabel(block)),
        element("p", null, "Choose one room. Its clock starts only after you press Start; an active deadline survives refreshes, route changes, and application updates.")
      );
      header.append(copy, renderBlockReadiness(block));
      var choices = element("div", "assessment-mode-grid");
      choices.append(renderModeCard(block, "theory"), renderModeCard(block, "practical"));
      page.append(
        renderBreadcrumbs([
          { label: "Chapters", href: "#home" },
          { label: "Assessments", href: "#assessments" },
          { label: block.title }
        ]),
        header,
        choices,
        renderSourceNote(block),
        renderReferences(block)
      );
      return page;
    }

    function renderBlockReadiness(block) {
      var progress = currentProgress();
      var theoryBest = bestModeResult(blockMode(progress, block.id, "theory"));
      var practicalBest = bestModeResult(blockMode(progress, block.id, "practical"));
      var panel = element("aside", "assessment-readiness");
      panel.append(
        element("span", null, "Overall block status"),
        element(
          "strong",
          null,
          theoryBest && theoryBest.passed && practicalBest && practicalBest.passed ? "Block passed" : "Two passes required"
        ),
        element("small", null, "Theory and practical are scored independently at 60/100.")
      );
      return panel;
    }

    function renderModeCard(block, mode) {
      var state = readMode(block.id, mode);
      var best = bestModeResult(state);
      var theory = mode === "theory";
      var card = link(
        "#assessment/" + encodeURIComponent(block.id) + "/" + mode,
        "assessment-mode-card" + (best && best.passed ? " is-passed" : "")
      );
      var meta = element("div", "assessment-mode-card__meta");
      meta.append(
        element("span", null, theory ? "15 multiple-answer questions" : "5 Python coding tasks"),
        element("strong", null, durationLabel(block, mode))
      );
      card.append(
        element("span", "assessment-mode-card__icon", theory ? "A+B" : ">_"),
        element("p", "eyebrow", theory ? "Knowledge" : "Application"),
        element("h2", null, modeLabel(mode)),
        element(
          "p",
          null,
          theory
            ? "Select every correct option. A question scores only when the complete answer set matches."
            : "Write five independent functions and pass their complete browser test suites."
        ),
        meta,
        element(
          "span",
          "assessment-mode-card__result",
          state.active ? "Resume active attempt →" : best ? "Best " + best.score + "/100 · Open →" : "Enter room →"
        )
      );
      return card;
    }

    function renderMode(block, mode) {
      var state = readMode(block.id, mode);
      if (!state.active) {
        return renderModeLanding(block, mode, state);
      }
      if (mode === "theory") {
        return renderTheoryAttempt(block, state.active);
      }
      return renderPracticalAttempt(block, state.active);
    }

    function renderModeLanding(block, mode, state) {
      var page = element("div", "page-shell assessment-room-page");
      var history = state.history;
      var best = bestModeResult(state);
      var latest = latestAttempt(history);
      var hero = element("header", "assessment-room-landing");
      var copy = element("div");
      var rules = element("ul", "assessment-room-rules");
      var minutes = Math.ceil(durationSeconds(block, mode) / 60);
      var start = element("button", "button button--primary assessment-start-button", mode === "theory"
        ? "Start " + minutes + "-minute theory exam"
        : "Prepare Python and start " + minutes + "-minute practical");
      start.type = "button";
      start.dataset.assessmentStart = mode;
      start.dataset.assessmentBlock = block.id;
      [
        mode === "theory" ? "15 questions; one or more options may be correct." : "5 independent coding tasks worth 20 points each.",
        "The pass mark is 60/100. The timer cannot be paused.",
        "Your active deadline and drafts are saved after every change.",
        mode === "theory" ? "Answers and explanations appear only after submission." : "The clock starts after the browser Python runtime is ready."
      ].forEach(function (rule) {
        rules.append(element("li", null, rule));
      });
      copy.append(
        element("p", "eyebrow", block.title),
        element("h1", null, modeLabel(mode)),
        element("p", "assessment-room-landing__lede", mode === "theory"
          ? "Read each statement and select the complete correct set. Code-reading questions are executed mentally."
          : "Implement the supplied function contracts without using the PDF answer key. Run visible checks, then submit all five for grading."),
        rules,
        start
      );
      hero.append(copy, renderAttemptSnapshot(best, latest));
      page.append(
        renderBreadcrumbs([
          { label: "Assessments", href: "#assessments" },
          { label: block.title, href: "#assessment/" + encodeURIComponent(block.id) },
          { label: modeLabel(mode) }
        ]),
        hero
      );
      if (mode === "practical") {
        page.append(renderSourceNote(block));
      }
      if (latest) {
        page.append(renderLatestResult(block, mode, latest));
      }
      page.append(renderReferences(block));
      return page;
    }

    function renderAttemptSnapshot(best, latest) {
      var panel = element("aside", "assessment-attempt-snapshot");
      panel.append(
        element("span", null, "Saved assessment record"),
        element("strong", null, best ? "Best score · " + best.score + "/100" : "No attempt yet"),
        element("small", null, latest
          ? "Latest: " + latest.score + "/100 · " + (latest.passed ? "passed" : "not passed")
          : "Your recent attempts will appear here and in account sync when signed in.")
      );
      return panel;
    }

    function renderSourceNote(block) {
      if (!block.sourceNote) {
        return document.createDocumentFragment();
      }
      var note = element("aside", "assessment-source-note");
      note.setAttribute("aria-label", "Practical prompt provenance");
      note.append(
        element("span", "assessment-source-note__icon", "i"),
        element("strong", null, "Practical prompt provenance"),
        element("p", null, block.sourceNote)
      );
      note.firstChild.setAttribute("aria-hidden", "true");
      return note;
    }

    function renderReferences(block) {
      var references = Array.isArray(block.references) ? block.references : [];
      var section = element("section", "assessment-reference-section");
      var heading = element("header", "section-heading");
      heading.append(
        element("h2", null, "Official Python references"),
        element("p", null, "Review these before starting. Opening documentation during a timed attempt does not pause the clock.")
      );
      section.append(heading);
      var grid = element("div", "assessment-reference-grid");
      references.forEach(function (reference) {
        var card = link(reference.url, "assessment-reference-card");
        card.target = "_blank";
        card.rel = "noreferrer noopener";
        card.append(
          element("span", "assessment-reference-card__host", "docs.python.org"),
          element("strong", null, reference.label),
          element("p", null, reference.description),
          element("span", "assessment-reference-card__open", "Read official documentation ↗")
        );
        grid.append(card);
      });
      section.append(grid);
      return section;
    }

    function renderAttemptHeader(block, mode, active, answered, total) {
      var header = element("header", "assessment-attempt-header");
      var copy = element("div");
      var seconds = remaining(active);
      var timer = element("time", "assessment-clock", formatTime(seconds));
      timer.dataset.assessmentTimer = "true";
      timer.dateTime = "PT" + seconds + "S";
      timer.setAttribute("role", "timer");
      timer.setAttribute("aria-label", formatTime(seconds) + " remaining");
      var progressCopy = element("p", null, answered + " of " + total + (mode === "theory" ? " questions answered" : " tasks checked in this attempt"));
      progressCopy.dataset.assessmentAttemptProgress = mode;
      copy.append(
        element("p", "eyebrow", block.title + " · " + modeLabel(mode)),
        element("h1", null, mode === "theory" ? "Select the complete answer." : "Build, run, and submit."),
        progressCopy
      );
      var clockPanel = element("div", "assessment-clock-panel");
      clockPanel.append(element("span", null, "Time remaining"), timer, element("small", null, "Saved deadline · no pause"));
      header.append(copy, clockPanel);
      return header;
    }

    function renderTheoryAttempt(block, active) {
      var questions = block.theory.questions;
      var index = boundedIndex(active.currentQuestion, questions.length);
      var question = questions[index];
      var answers = active.answers && typeof active.answers === "object" ? active.answers : {};
      var answered = questions.filter(function (item) {
        return Array.isArray(answers[item.id]) && answers[item.id].length > 0;
      }).length;
      var page = element("div", "page-shell assessment-room-page assessment-room-page--active");
      var layout = element("div", "assessment-attempt-layout");
      layout.append(renderQuestionNavigator(block, "theory", questions, active, answers), renderTheoryQuestion(block, question, index, active));
      page.append(
        renderBreadcrumbs([
          { label: "Assessments", href: "#assessments" },
          { label: block.title, href: "#assessment/" + encodeURIComponent(block.id) },
          { label: "Theory attempt" }
        ]),
        renderAttemptHeader(block, "theory", active, answered, questions.length),
        layout
      );
      return page;
    }

    function renderQuestionNavigator(block, mode, questions, active, answerMap) {
      var aside = element("nav", "assessment-question-nav");
      var list = element("div", "assessment-question-nav__grid");
      aside.setAttribute("aria-label", mode === "theory" ? "Theory question map" : "Practical task map");
      aside.append(element("strong", null, mode === "theory" ? "Question map" : "Task map"));
      questions.forEach(function (question, index) {
        var done = mode === "theory"
          ? Array.isArray(answerMap[question.id]) && answerMap[question.id].length > 0
          : active.checks && active.checks[question.id] && active.checks[question.id].passed;
        var button = element("button", "assessment-question-nav__item" + (done ? " is-complete" : "") + (index === boundedIndex(active.currentQuestion, questions.length) ? " is-current" : ""), String(index + 1));
        button.type = "button";
        button.dataset.assessmentQuestion = String(index);
        button.dataset.assessmentBlock = block.id;
        button.dataset.assessmentMode = mode;
        button.setAttribute("aria-label", (mode === "theory" ? "Question " : "Task ") + (index + 1) + (done ? ", answered" : ", not complete"));
        button.setAttribute("aria-current", index === boundedIndex(active.currentQuestion, questions.length) ? "step" : "false");
        list.append(button);
      });
      aside.append(list, element("p", null, mode === "theory" ? "A filled number has at least one selected option." : "A green number passed every visible check."));
      return aside;
    }

    function renderTheoryQuestion(block, question, index, active) {
      var article = element("article", "assessment-question-card");
      var heading = element("header", "assessment-question-card__header");
      heading.append(
        element("span", "assessment-question-card__number", "Question " + (index + 1) + " / " + block.theory.questions.length),
        element("span", "assessment-question-card__type", question.correct.length > 1 ? "Select all that apply" : "Select the correct answer")
      );
      article.append(heading, element("h2", null, question.prompt));
      if (question.code) {
        var pre = element("pre", "assessment-question-code");
        pre.append(element("code", null, question.code));
        article.append(pre);
      }
      var selected = active.answers && Array.isArray(active.answers[question.id]) ? active.answers[question.id] : [];
      var fieldset = element("fieldset", "assessment-answer-options");
      fieldset.append(element("legend", "visually-hidden", "Answer options"));
      question.options.forEach(function (option, optionIndex) {
        var label = element("label", "assessment-answer-option" + (selected.indexOf(optionIndex) >= 0 ? " is-selected" : ""));
        var input = element("input");
        input.type = "checkbox";
        input.checked = selected.indexOf(optionIndex) >= 0;
        input.dataset.assessmentAnswer = question.id;
        input.dataset.assessmentOption = String(optionIndex);
        input.dataset.assessmentBlock = block.id;
        label.append(input, element("span", "assessment-answer-option__marker", String.fromCharCode(65 + optionIndex)), element("span", null, option));
        fieldset.append(label);
      });
      article.append(fieldset, renderAttemptActions(block, "theory", index, block.theory.questions.length));
      return article;
    }

    function renderAttemptActions(block, mode, index, total) {
      var actions = element("footer", "assessment-attempt-actions");
      var navigation = element("div", "button-row");
      var previous = element("button", "button button--quiet", "← Previous");
      var next = element("button", "button button--quiet", "Next →");
      var submit = element("button", "button button--primary", mode === "theory" ? "Submit theory exam" : "Submit all five tasks");
      previous.type = "button";
      next.type = "button";
      submit.type = "button";
      previous.disabled = index === 0;
      next.disabled = index >= total - 1;
      previous.dataset.assessmentQuestion = String(Math.max(0, index - 1));
      next.dataset.assessmentQuestion = String(Math.min(total - 1, index + 1));
      previous.dataset.assessmentBlock = block.id;
      next.dataset.assessmentBlock = block.id;
      previous.dataset.assessmentMode = mode;
      next.dataset.assessmentMode = mode;
      submit.dataset.assessmentSubmit = mode;
      submit.dataset.assessmentBlock = block.id;
      navigation.append(previous, next);
      actions.append(navigation, submit);
      return actions;
    }

    function renderPracticalAttempt(block, active) {
      var questions = block.practical.questions;
      var index = boundedIndex(active.currentQuestion, questions.length);
      var question = questions[index];
      var checks = active.checks && typeof active.checks === "object" ? active.checks : {};
      var checked = questions.filter(function (item) { return checks[item.id] && checks[item.id].passed; }).length;
      var page = element("div", "page-shell assessment-room-page assessment-room-page--active");
      var layout = element("div", "assessment-attempt-layout");
      layout.append(renderQuestionNavigator(block, "practical", questions, active, {}), renderPracticalQuestion(block, question, index, active));
      page.append(
        renderBreadcrumbs([
          { label: "Assessments", href: "#assessments" },
          { label: block.title, href: "#assessment/" + encodeURIComponent(block.id) },
          { label: "Practical attempt" }
        ]),
        renderAttemptHeader(block, "practical", active, checked, questions.length),
        layout
      );
      return page;
    }

    function renderPracticalQuestion(block, question, index, active) {
      var article = element("article", "assessment-practical-card");
      var heading = element("header", "assessment-practical-card__header");
      var meta = element("div");
      meta.append(
        element("p", "eyebrow", "Task " + (index + 1) + " / " + block.practical.questions.length + " · " + question.points + " points"),
        element("h2", null, question.title)
      );
      heading.append(meta, element("span", "assessment-practical-card__source", "Adapted prompt · solution excluded"));
      article.append(heading, element("p", "assessment-practical-card__prompt", question.prompt));
      var contract = element("section", "assessment-contract");
      contract.append(element("strong", null, "Function contract"));
      if (Array.isArray(question.contract)) {
        var contractList = element("ul");
        question.contract.forEach(function (rule) { contractList.append(element("li", null, rule)); });
        contract.append(contractList);
      } else {
        contract.append(element("p", null, question.contract));
      }
      article.append(contract);
      if (Array.isArray(question.constraints) && question.constraints.length) {
        var constraints = element("ul", "assessment-constraints");
        question.constraints.forEach(function (constraint) { constraints.append(element("li", null, constraint)); });
        article.append(constraints);
      }
      if (Array.isArray(question.examples) && question.examples.length) {
        article.append(renderPracticalExamples(question.examples));
      }
      article.append(renderAssessmentEditor(block, question, active), renderAttemptActions(block, "practical", index, block.practical.questions.length));
      return article;
    }

    function renderPracticalExamples(examples) {
      var section = element("section", "assessment-examples");
      section.append(element("strong", null, "Public examples"));
      var grid = element("div", "assessment-examples__grid");
      examples.forEach(function (example) {
        var card = element("div", "assessment-example");
        card.append(element("code", null, example.call), element("span", null, "→"), element("code", null, example.expected));
        grid.append(card);
      });
      section.append(grid);
      return section;
    }

    function renderAssessmentEditor(block, question, active) {
      var shell = element("section", "assessment-editor");
      var topbar = element("header", "assessment-editor__topbar");
      var tab = element("span", "ide-file-tab");
      tab.append(element("span", "ide-file-tab__type", "PY"), element("span", null, question.id + ".py"));
      var actions = element("div", "assessment-editor__actions");
      var modeLabelNode = element("label", "ide-mode-field");
      var modeSelect = element("select", "ide-mode-select");
      ["sublime", "vim"].forEach(function (mode) {
        var option = element("option", null, mode === "vim" ? "Vim" : "Sublime");
        option.value = mode;
        option.selected = options.getEditorMode() === mode;
        modeSelect.append(option);
      });
      modeSelect.dataset.assessmentEditorMode = "true";
      modeLabelNode.append(element("span", null, "Keys"), modeSelect);
      [
        ["Copy", "assessmentCopy"],
        ["Paste", "assessmentPaste"],
        ["Reset", "assessmentReset"],
        ["Download .py", "assessmentDownload"]
      ].forEach(function (action) {
        var button = element("button", "ide-button ide-button--quiet", action[0]);
        button.type = "button";
        button.dataset[action[1]] = question.id;
        button.dataset.assessmentBlock = block.id;
        actions.append(button);
      });
      var run = element("button", "ide-button ide-button--run", "Run visible checks");
      run.type = "button";
      run.dataset.assessmentRun = question.id;
      run.dataset.assessmentBlock = block.id;
      actions.prepend(modeLabelNode);
      actions.append(run);
      topbar.append(tab, actions);

      var frame = element("div", "assessment-editor__frame");
      var textarea = element("textarea", "code-editor-fallback");
      var host = element("div", "ace-editor-host");
      var code = active.drafts && typeof active.drafts[question.id] === "string" ? active.drafts[question.id] : question.starterCode;
      textarea.value = code;
      textarea.spellcheck = false;
      textarea.readOnly = active.status !== "active";
      textarea.dataset.assessmentCodeEditor = question.id;
      textarea.setAttribute("aria-label", "Python editor for " + question.title);
      host.dataset.assessmentAceHost = question.id;
      frame.append(textarea, host);

      var footer = element("footer", "assessment-editor__footer");
      footer.append(
        element("span", "assessment-editor__saved", "Draft auto-saves · Shift + Enter runs visible checks"),
        element("span", "ide-cursor-position", "Ln 1, Col 1")
      );
      var results = element("section", "assessment-check-results");
      results.dataset.assessmentCheckResults = question.id;
      results.setAttribute("aria-live", "polite");
      results.setAttribute("aria-atomic", "false");
      var prior = active.checks && active.checks[question.id];
      results.append(element("p", "empty-state", prior
        ? prior.passedCount + " / " + prior.totalCount + " visible checks passed on the last run."
        : "Run visible checks for feedback. Final submission also evaluates hidden cases."));
      shell.append(topbar, frame, footer, results);
      return shell;
    }

    function renderLatestResult(block, mode, attempt) {
      var section = element("section", "assessment-result-section " + (attempt.passed ? "is-passed" : "is-failed"));
      var header = element("header", "assessment-result-summary");
      var copy = element("div");
      copy.append(
        element("p", "eyebrow", attempt.passed ? "Assessment passed" : "Keep practising"),
        element("h2", null, attempt.score + " / 100"),
        element("p", null, attempt.passed
          ? "You reached the 60-point pass mark. The result remains saved across application updates."
          : "Review the linked documentation and chapter runbooks, then start a new attempt when ready."),
        element("small", "assessment-result-summary__meta", attempt.status === "expired"
          ? "Submitted automatically when the saved deadline expired."
          : "Submitted before the saved deadline.")
      );
      header.append(element("span", "assessment-result-summary__icon", attempt.passed ? "✓" : "×"), copy);
      section.append(header);
      var results = element("div", "assessment-result-list");
      var definitions = mode === "theory" ? block.theory.questions : block.practical.questions;
      if (!Array.isArray(attempt.results)) {
        section.append(element(
          "p",
          "assessment-result-details-unavailable",
          "The saved score is available, but per-question feedback is not present in this older progress record. Start a new attempt to create a complete review."
        ));
        return section;
      }
      definitions.forEach(function (definition, index) {
        var stored = (attempt.results || []).find(function (result) { return result.questionId === definition.id; });
        results.append(mode === "theory"
          ? renderTheoryResult(definition, stored, index)
          : renderPracticalResult(definition, stored, index));
      });
      section.append(results);
      return section;
    }

    function renderTheoryResult(question, result, index) {
      var details = element("details", "assessment-result-item " + (result && result.correct ? "is-correct" : "is-incorrect"));
      var summary = element("summary");
      summary.append(
        element("span", "assessment-result-item__icon", result && result.correct ? "✓" : "×"),
        element("strong", null, "Question " + (index + 1)),
        element("span", null, result && result.correct ? "Correct" : "Review")
      );
      var body = element("div", "assessment-result-item__body");
      var selected = result && Array.isArray(result.selected) ? result.selected : [];
      var selectedLabels = selected.map(function (optionIndex) { return question.options[optionIndex]; }).filter(Boolean);
      var correctLabels = question.correct.map(function (optionIndex) { return question.options[optionIndex]; }).filter(Boolean);
      body.append(
        element("p", null, question.prompt),
        renderAnswerReview("Your answer", selectedLabels.length ? selectedLabels : ["No answer selected"]),
        renderAnswerReview("Correct answer", correctLabels),
        element("p", "assessment-result-item__explanation", question.explanation)
      );
      details.append(summary, body);
      return details;
    }

    function renderAnswerReview(label, answers) {
      var section = element("section", "assessment-answer-review");
      section.append(element("strong", null, label));
      var list = element("ul");
      answers.forEach(function (answer) { list.append(element("li", null, answer)); });
      section.append(list);
      return section;
    }

    function renderPracticalResult(question, result, index) {
      var passed = result && result.passed;
      var item = element("article", "assessment-result-item " + (passed ? "is-correct" : "is-incorrect"));
      item.append(
        element("span", "assessment-result-item__icon", passed ? "✓" : "×"),
        element("div", null)
      );
      item.children[1].append(
        element("strong", null, "Task " + (index + 1) + " · " + question.title),
        element("p", null, result
          ? result.passedCount + " of " + result.totalCount + " tests passed · " + (passed ? question.points : 0) + " / " + question.points + " points"
          : "No result was produced for this task.")
      );
      if (result && result.runnerError) {
        item.children[1].append(element("p", "assessment-result-item__runner-error", "Runner error: " + result.runnerError));
      }
      return item;
    }

    function startAttempt(block, mode) {
      var progress = currentProgress();
      var state = blockMode(progress, block.id, mode);
      var now = Date.now();
      var active = {
        id: block.id + "-" + mode + "-" + now + "-" + Math.random().toString(36).slice(2, 9),
        blockId: block.id,
        mode: mode,
        status: "active",
        revision: Number(block.revision) || 1,
        startedAt: now,
        deadlineAt: now + durationSeconds(block, mode) * 1000,
        updatedAt: now,
        currentQuestion: 0,
        answers: {},
        drafts: {},
        checks: {}
      };
      if (mode === "practical") {
        block.practical.questions.forEach(function (question) {
          active.drafts[question.id] = question.starterCode;
        });
      }
      state.active = active;
      save(progress, true);
      options.requestRender();
      options.announce(modeLabel(mode) + " started. The deadline is saved and the timer is running.");
    }

    function setCurrentQuestion(blockId, mode, index) {
      flushEditor();
      var progress = currentProgress();
      var state = blockMode(progress, blockId, mode);
      if (!state.active || state.active.status !== "active") {
        return;
      }
      var block = getBlock(blockId);
      if (!block) {
        return;
      }
      if (remaining(state.active) <= 0) {
        if (mode === "theory") submitTheory(block, "expired", state.active.id);
        else requestPracticalExpiration(block, state.active.id);
        return;
      }
      var total = mode === "theory" ? block.theory.questions.length : block.practical.questions.length;
      state.active.currentQuestion = boundedIndex(index, total);
      state.active.updatedAt = Date.now();
      save(progress, true);
      options.requestRender();
    }

    function updateTheoryAnswer(input) {
      var blockId = input.dataset.assessmentBlock;
      var questionId = input.dataset.assessmentAnswer;
      var optionIndex = Number(input.dataset.assessmentOption);
      var progress = currentProgress();
      var state = blockMode(progress, blockId, "theory");
      if (!state.active || state.active.status !== "active" || remaining(state.active) <= 0) {
        input.checked = !input.checked;
        options.announce("The deadline has passed; this answer was not saved.");
        return;
      }
      state.active.answers = state.active.answers || {};
      var selected = new Set(Array.isArray(state.active.answers[questionId]) ? state.active.answers[questionId] : []);
      if (input.checked) {
        selected.add(optionIndex);
      } else {
        selected.delete(optionIndex);
      }
      state.active.answers[questionId] = Array.from(selected).sort(function (left, right) { return left - right; });
      state.active.updatedAt = Date.now();
      input.closest("label").classList.toggle("is-selected", input.checked);
      // Answer sets are incremental. Persist synchronously so checking a second
      // option cannot be based on a stale, debounced snapshot of the first.
      save(progress, true);
      updateAttemptProgressChrome(getBlock(blockId), "theory", state.active, questionId);
      options.announce("Answer saved. " + state.active.answers[questionId].length + " option" + (state.active.answers[questionId].length === 1 ? "" : "s") + " selected.");
    }

    function updateAttemptProgressChrome(block, mode, active, changedQuestionId) {
      if (!block || !active) {
        return;
      }
      var questions = mode === "theory" ? block.theory.questions : block.practical.questions;
      var completed = questions.filter(function (question) {
        return mode === "theory"
          ? active.answers && Array.isArray(active.answers[question.id]) && active.answers[question.id].length > 0
          : active.checks && active.checks[question.id] && active.checks[question.id].passed;
      }).length;
      var progressCopy = document.querySelector("[data-assessment-attempt-progress='" + mode + "']");
      if (progressCopy) {
        progressCopy.textContent = completed + " of " + questions.length + (mode === "theory" ? " questions answered" : " tasks checked in this attempt");
      }
      var changedIndex = questions.findIndex(function (question) { return question.id === changedQuestionId; });
      if (changedIndex < 0) {
        return;
      }
      var done = mode === "theory"
        ? active.answers && Array.isArray(active.answers[changedQuestionId]) && active.answers[changedQuestionId].length > 0
        : active.checks && active.checks[changedQuestionId] && active.checks[changedQuestionId].passed;
      var navigationButton = Array.from(document.querySelectorAll("button[data-assessment-question]")).find(function (button) {
        return button.dataset.assessmentBlock === block.id &&
          button.dataset.assessmentMode === mode &&
          Number(button.dataset.assessmentQuestion) === changedIndex;
      });
      if (navigationButton) {
        navigationButton.classList.toggle("is-complete", Boolean(done));
        navigationButton.setAttribute(
          "aria-label",
          (mode === "theory" ? "Question " : "Task ") + (changedIndex + 1) + (done ? ", answered" : ", not complete")
        );
      }
    }

    function submitTheory(block, reason, expectedAttemptId) {
      var progress = currentProgress();
      var state = blockMode(progress, block.id, "theory");
      var active = state.active;
      if (!active || finalizingAttemptId === active.id) {
        return;
      }
      if (expectedAttemptId && active.id !== expectedAttemptId) {
        options.requestRender();
        return;
      }
      var secondsRemaining = remaining(active);
      if (reason === "expired" && secondsRemaining > 0) {
        // A timer that belonged to a superseded account snapshot must never
        // submit the newer active attempt.
        options.requestRender();
        return;
      }
      reason = secondsRemaining <= 0 ? "expired" : "submitted";
      finalizingAttemptId = active.id;
      window.clearInterval(timerId);
      timerId = null;
      var correctCount = 0;
      var results = block.theory.questions.map(function (question) {
        var selected = active.answers && Array.isArray(active.answers[question.id]) ? active.answers[question.id] : [];
        var correct = sameSet(selected, question.correct);
        if (correct) {
          correctCount += 1;
        }
        return { questionId: question.id, correct: correct, selected: selected.slice() };
      });
      var score = roundPercent(correctCount, block.theory.questions.length);
      var completed = completeAttempt(active, score, score >= passingScore(block, "theory"), results, reason, {
        correctCount: correctCount,
        totalCount: block.theory.questions.length
      });
      state.history = appendHistory(state.history, completed);
      recordModeSummary(state, completed);
      state.active = null;
      save(progress, true);
      finalizingAttemptId = null;
      if (completed.passed) {
        options.audio.playSuccess();
      } else {
        options.audio.playFailure();
      }
      options.requestRender();
      options.announce("Theory exam submitted: " + score + " out of 100, " + (completed.passed ? "passed" : "not passed") + ".");
    }

    async function submitPractical(block, reason) {
      flushEditor();
      var progress = currentProgress();
      var state = blockMode(progress, block.id, "practical");
      var active = state.active;
      if (!active || finalizingAttemptId === active.id) {
        return;
      }
      reason = remaining(active) <= 0 ? "expired" : reason;
      if (runInProgress) {
        if (reason === "expired") {
          requestPracticalExpiration(block, active.id);
        } else {
          options.announce("Wait for the visible checks to finish, then submit the practical exam.");
        }
        return;
      }
      var submissionEpoch = workspaceEpoch();
      finalizingAttemptId = active.id;
      runInProgress = true;
      window.clearInterval(timerId);
      timerId = null;
      if (pendingPracticalExpiration && pendingPracticalExpiration.attemptId === active.id) {
        pendingPracticalExpiration = null;
      }
      active.status = "submitting";
      active.updatedAt = Date.now();
      save(progress, true);
      options.audio.playSubmit();
      options.announce("Submitting all five practical tasks. Keep this page open while Python evaluates them.");
      updateSubmittingUi(true);
      var results = [];
      try {
        for (var index = 0; index < block.practical.questions.length; index += 1) {
          var question = block.practical.questions[index];
          var code = active.drafts && typeof active.drafts[question.id] === "string"
            ? active.drafts[question.id]
            : question.starterCode;
          try {
            var testResults = await options.runPython(code, question.mode || "function", question.tests || []);
            if (workspaceChanged(submissionEpoch)) {
              return;
            }
            var passedCount = testResults.filter(function (result) { return result.passed; }).length;
            results.push({
              questionId: question.id,
              passed: testResults.length > 0 && passedCount === testResults.length,
              passedCount: passedCount,
              totalCount: testResults.length
            });
          } catch (error) {
            if (workspaceChanged(submissionEpoch)) {
              return;
            }
            results.push({
              questionId: question.id,
              passed: false,
              passedCount: 0,
              totalCount: (question.tests || []).length,
              runnerError: error instanceof Error ? error.message : String(error)
            });
          }
        }
        var earnedPoints = results.reduce(function (total, result, index) {
          var configuredPoints = Number(block.practical.questions[index].points);
          var points = Number.isFinite(configuredPoints) ? configuredPoints : 20;
          return total + (result.passed ? points : 0);
        }, 0);
        var maxPoints = block.practical.questions.reduce(function (total, question) {
          var configuredPoints = Number(question.points);
          return total + (Number.isFinite(configuredPoints) ? configuredPoints : 20);
        }, 0);
        var score = roundPercent(earnedPoints, maxPoints);
        if (workspaceChanged(submissionEpoch)) {
          return;
        }
        progress = currentProgress();
        state = blockMode(progress, block.id, "practical");
        if (!state.active || state.active.id !== active.id) {
          return;
        }
        var completed = completeAttempt(active, score, score >= passingScore(block, "practical"), results, reason, {
          passedCount: results.filter(function (result) { return result.passed; }).length,
          totalCount: results.length,
          earnedPoints: earnedPoints,
          maxPoints: maxPoints
        });
        state.history = appendHistory(state.history, completed);
        recordModeSummary(state, completed);
        state.active = null;
        save(progress, true);
        if (completed.passed) {
          options.audio.playSuccess();
        } else {
          options.audio.playFailure();
        }
        options.requestRender();
        options.announce("Practical exam submitted: " + score + " out of 100, " + (completed.passed ? "passed" : "not passed") + ".");
      } finally {
        runInProgress = false;
        finalizingAttemptId = null;
        if (!workspaceChanged(submissionEpoch)) {
          updateSubmittingUi(false);
          finishPendingPracticalExpiration();
        }
      }
    }

    function requestPracticalExpiration(block, attemptId) {
      var progress = currentProgress();
      var state = blockMode(progress, block.id, "practical");
      if (!state.active || state.active.id !== attemptId || finalizingAttemptId === attemptId) {
        return;
      }
      state.active.status = "submitting";
      state.active.updatedAt = Date.now();
      pendingPracticalExpiration = { blockId: block.id, attemptId: attemptId };
      save(progress, true);
      updateSubmittingUi(true);
      if (runInProgress) {
        options.announce("Time is up. The current visible check will finish, then all five saved drafts will be graded automatically.");
        return;
      }
      submitPractical(block, "expired");
    }

    function finishPendingPracticalExpiration() {
      if (!pendingPracticalExpiration || runInProgress) {
        return;
      }
      var pending = pendingPracticalExpiration;
      var block = getBlock(pending.blockId);
      if (!block) {
        pendingPracticalExpiration = null;
        return;
      }
      submitPractical(block, "expired");
    }

    function completeAttempt(active, score, passed, results, reason, summary) {
      var completed = {
        id: active.id,
        blockId: active.blockId,
        mode: active.mode,
        revision: active.revision,
        startedAt: active.startedAt,
        deadlineAt: active.deadlineAt,
        updatedAt: Date.now(),
        submittedAt: Date.now(),
        status: reason === "expired" ? "expired" : "submitted",
        reason: reason === "expired" ? "deadline" : "learner-submit",
        score: score,
        passed: Boolean(passed),
        results: results
      };
      Object.keys(summary || {}).forEach(function (key) { completed[key] = summary[key]; });
      return completed;
    }

    function appendHistory(history, attempt) {
      var merged = (Array.isArray(history) ? history : []).filter(function (item) { return item.id !== attempt.id; });
      merged.push(attempt);
      merged.sort(function (left, right) { return Number(left.submittedAt) - Number(right.submittedAt); });
      return merged.slice(-10);
    }

    function recordModeSummary(state, attempt) {
      state.bestScore = Math.max(Number(state.bestScore) || 0, Number(attempt.score) || 0);
      state.completed = Boolean(state.completed || attempt.passed);
    }

    async function runVisibleChecks(block, questionId) {
      if (runInProgress) {
        options.announce("Wait for the current Python run to finish.");
        return;
      }
      flushEditor();
      var question = block.practical.questions.find(function (item) { return item.id === questionId; });
      var progress = currentProgress();
      var state = blockMode(progress, block.id, "practical");
      if (!question || !state.active || state.active.status !== "active") {
        return;
      }
      if (remaining(state.active) <= 0) {
        requestPracticalExpiration(block, state.active.id);
        return;
      }
      var attemptId = state.active.id;
      var checkEpoch = workspaceEpoch();
      var tests = (question.tests || []).filter(function (test) { return !test.hidden; });
      var code = state.active.drafts[question.id];
      var container = document.querySelector("[data-assessment-check-results='" + cssEscape(question.id) + "']");
      runInProgress = true;
      options.audio.playSubmit();
      if (container) {
        container.replaceChildren(element("p", "assessment-run-status", "Running " + tests.length + " visible checks…"));
        container.setAttribute("aria-busy", "true");
      }
      try {
        var results = await options.runPython(code, question.mode || "function", tests);
        if (workspaceChanged(checkEpoch)) {
          return;
        }
        var passedCount = results.filter(function (result) { return result.passed; }).length;
        progress = currentProgress();
        state = blockMode(progress, block.id, "practical");
        if (state.active && state.active.id === attemptId) {
          state.active.checks = state.active.checks || {};
          state.active.checks[question.id] = {
            passed: results.length > 0 && passedCount === results.length,
            passedCount: passedCount,
            totalCount: results.length,
            checkedAt: Date.now()
          };
          state.active.updatedAt = Date.now();
          save(progress, true);
          updateAttemptProgressChrome(block, "practical", state.active, questionId);
        }
        if (container && container.isConnected) {
          renderCheckResults(container, results, tests);
        }
        if (passedCount === results.length && results.length) {
          options.audio.playSuccess();
        } else {
          options.audio.playFailure();
        }
        options.announce(passedCount + " of " + results.length + " visible checks passed for " + question.title + ".");
      } catch (error) {
        if (workspaceChanged(checkEpoch)) {
          return;
        }
        options.audio.playFailure();
        options.announce("Visible checks could not finish for " + question.title + ". " + (error instanceof Error ? error.message : String(error)));
        if (container && container.isConnected) {
          container.replaceChildren(element("p", "assessment-run-status is-error", error instanceof Error ? error.message : String(error)));
        }
      } finally {
        runInProgress = false;
        var changedWorkspace = workspaceChanged(checkEpoch);
        if (!changedWorkspace && container && container.isConnected) {
          container.removeAttribute("aria-busy");
        }
        if (!changedWorkspace) {
          finishPendingPracticalExpiration();
        } else if (pendingPracticalExpiration && pendingPracticalExpiration.attemptId === attemptId) {
          pendingPracticalExpiration = null;
        }
      }
    }

    function renderCheckResults(container, results, tests) {
      container.replaceChildren();
      var summary = element("header", "assessment-check-summary " + (results.every(function (result) { return result.passed; }) ? "is-passed" : "is-failed"));
      var passedCount = results.filter(function (result) { return result.passed; }).length;
      summary.append(element("strong", null, passedCount + " / " + results.length + " visible checks passed"));
      container.append(summary);
      results.forEach(function (result, index) {
        var details = element("details", "test-result " + (result.passed ? "test-result--pass" : "test-result--fail"));
        var summaryLine = element("summary");
        summaryLine.append(element("span", "test-result__icon", result.passed ? "✓" : "×"), element("strong", null, result.name || "Check " + (index + 1)));
        details.append(summaryLine);
        if (!result.passed) {
          var body = element("div", "test-result__body");
          body.append(renderResult("Call", tests[index] && tests[index].call), renderResult("Expected", result.expected), renderResult("Actual", result.actual));
          if (result.traceback) {
            body.append(renderResult("Traceback", result.traceback));
          }
          details.append(body);
          details.open = true;
        }
        container.append(details);
      });
    }

    function renderResult(label, value) {
      var section = element("section", "result-field");
      var pre = element("pre");
      var rendered = value === undefined || value === null || value === "" ? "<empty>" : String(value);
      pre.append(element("code", null, rendered));
      section.append(element("h4", null, label), pre);
      return section;
    }

    function initializeEditor(block) {
      var state = readMode(block.id, "practical");
      if (!state.active || state.active.status !== "active") {
        return;
      }
      var index = boundedIndex(state.active.currentQuestion, block.practical.questions.length);
      var question = block.practical.questions[index];
      var textarea = document.querySelector("textarea[data-assessment-code-editor='" + cssEscape(question.id) + "']");
      var host = document.querySelector("[data-assessment-ace-host='" + cssEscape(question.id) + "']");
      var position = document.querySelector(".assessment-editor .ide-cursor-position");
      if (!textarea || !host) {
        return;
      }
      function changed(value) {
        var progress = currentProgress();
        var current = blockMode(progress, block.id, "practical");
        if (current.active && current.active.id === state.active.id && current.active.status === "active") {
          if (remaining(current.active) <= 0) {
            if (activeEditor) activeEditor.setReadOnly(true);
            requestPracticalExpiration(block, current.active.id);
            return;
          }
          current.active.drafts = current.active.drafts || {};
          current.active.drafts[question.id] = value;
          current.active.updatedAt = Date.now();
          // Persist accepted edits immediately so expiration always grades the
          // last value entered before the absolute deadline.
          save(progress, true);
        }
      }
      textarea.addEventListener("input", function () { changed(textarea.value); updateTextareaPosition(textarea, position); });
      textarea.addEventListener("keyup", function () { updateTextareaPosition(textarea, position); });
      textarea.addEventListener("click", function () { updateTextareaPosition(textarea, position); });
      textarea.addEventListener("keydown", function (event) {
        if (event.shiftKey && event.key === "Enter") {
          event.preventDefault();
          var button = document.querySelector("button[data-assessment-run='" + cssEscape(question.id) + "']");
          if (button) button.click();
        }
      });
      if (!window.ace || !host) {
        host.hidden = true;
        activeEditor = textareaAdapter(block.id, question.id, textarea, changed, position);
        return;
      }
      var aceEditor;
      try {
        window.ace.config.set("basePath", "assets/vendor/ace");
        aceEditor = window.ace.edit(host, {
          value: textarea.value,
          mode: "ace/mode/python",
          theme: "ace/theme/monokai",
          keyboardHandler: options.getEditorMode() === "vim" ? "ace/keyboard/vim" : "ace/keyboard/sublime",
          fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
          fontSize: window.matchMedia("(max-width: 640px)").matches ? "16px" : "15px",
          tabSize: 4,
          useSoftTabs: true,
          useWorker: false,
          useResizeObserver: true,
          showPrintMargin: false,
          displayIndentGuides: true,
          highlightActiveLine: true,
          enableBasicAutocompletion: true,
          wrap: window.matchMedia("(max-width: 640px)").matches,
          textInputAriaLabel: "Python editor for " + question.title
        });
        aceEditor.session.setUseWorker(false);
        aceEditor.session.setNewLineMode("unix");
        aceEditor.renderer.setPadding(16);
        textarea.hidden = true;
        aceEditor.commands.addCommand({
          name: "runVisibleAssessmentChecks",
          bindKey: { win: "Shift-Enter", mac: "Shift-Enter" },
          exec: function () {
            var button = document.querySelector("button[data-assessment-run='" + cssEscape(question.id) + "']");
            if (button) button.click();
          }
        });
        aceEditor.session.on("change", function () {
          var value = aceEditor.getValue();
          textarea.value = value;
          changed(value);
        });
        aceEditor.selection.on("changeCursor", function () {
          if (position) {
            var cursor = aceEditor.getCursorPosition();
            position.textContent = "Ln " + (cursor.row + 1) + ", Col " + (cursor.column + 1);
          }
        });
        activeEditor = {
          blockId: block.id,
          questionId: question.id,
          getValue: function () { return aceEditor.getValue(); },
          setValue: function (value) { aceEditor.setValue(value, -1); changed(value); },
          insertText: function (value) { aceEditor.insert(value); },
          focus: function () { aceEditor.focus(); },
          setKeyboardMode: function (mode) { aceEditor.setKeyboardHandler(mode === "vim" ? "ace/keyboard/vim" : "ace/keyboard/sublime"); },
          setReadOnly: function (readOnly) { aceEditor.setReadOnly(Boolean(readOnly)); },
          destroy: function () {
            changed(aceEditor.getValue());
            aceEditor.destroy();
            host.replaceChildren();
          }
        };
        aceEditor.resize(true);
      } catch (error) {
        if (aceEditor) aceEditor.destroy();
        host.hidden = true;
        textarea.hidden = false;
        activeEditor = textareaAdapter(block.id, question.id, textarea, changed, position);
      }
    }

    function textareaAdapter(blockId, questionId, textarea, changed, position) {
      return {
        blockId: blockId,
        questionId: questionId,
        getValue: function () { return textarea.value; },
        setValue: function (value) { textarea.value = value; changed(value); updateTextareaPosition(textarea, position); },
        insertText: function (value) {
          var start = textarea.selectionStart || 0;
          var end = textarea.selectionEnd || start;
          textarea.setRangeText(value, start, end, "end");
          changed(textarea.value);
        },
        focus: function () { textarea.focus(); },
        setKeyboardMode: function () {},
        setReadOnly: function (readOnly) { textarea.readOnly = Boolean(readOnly); },
        destroy: function () { changed(textarea.value); }
      };
    }

    function updateTextareaPosition(textarea, position) {
      if (!position) return;
      var before = textarea.value.slice(0, textarea.selectionStart || 0).split("\n");
      position.textContent = "Ln " + before.length + ", Col " + (before[before.length - 1].length + 1);
    }

    function flushEditor() {
      if (!activeEditor) return false;
      var progress = currentProgress();
      var state = blockMode(progress, activeEditor.blockId, "practical");
      if (state.active && state.active.status === "active" && remaining(state.active) > 0) {
        state.active.drafts = state.active.drafts || {};
        state.active.drafts[activeEditor.questionId] = activeEditor.getValue();
        state.active.updatedAt = Date.now();
        save(progress, true);
        return true;
      }
      if (state.active && remaining(state.active) <= 0) {
        activeEditor.setReadOnly(true);
      }
      return false;
    }

    function disposeEditor() {
      if (activeEditor) {
        activeEditor.destroy();
        activeEditor = null;
      }
    }

    function remaining(active) {
      if (typeof engine.remainingSeconds === "function") {
        return engine.remainingSeconds(active.deadlineAt, Date.now());
      }
      return Math.max(0, Math.ceil((Number(active.deadlineAt) - Date.now()) / 1000));
    }

    function startTimer(block, mode, active) {
      window.clearInterval(timerId);
      function tick() {
        var seconds = remaining(active);
        document.querySelectorAll("[data-assessment-timer]").forEach(function (node) {
          node.textContent = formatTime(seconds);
          node.dateTime = "PT" + seconds + "S";
          node.setAttribute("aria-label", formatTime(seconds) + " remaining");
          node.classList.toggle("is-urgent", seconds <= 300);
        });
        if (seconds <= 0) {
          window.clearInterval(timerId);
          timerId = null;
          if (mode === "theory") {
            submitTheory(block, "expired", active.id);
          } else {
            requestPracticalExpiration(block, active.id);
          }
        }
      }
      tick();
      if (remaining(active) > 0) {
        timerId = window.setInterval(tick, 1000);
      }
    }

    function mount(block, mode) {
      var state = readMode(block.id, mode);
      if (!state.active) return;
      if (mode === "practical" && state.active.status === "active") {
        initializeEditor(block);
      }
      startTimer(block, mode, state.active);
      if (state.active.status === "submitting" && mode === "practical") {
        submitPractical(block, remaining(state.active) <= 0 ? "expired" : "submitted");
      }
    }

    function dispose() {
      flushEditor();
      disposeEditor();
      window.clearInterval(timerId);
      window.clearTimeout(saveTimer);
      timerId = null;
      saveTimer = null;
    }

    function flush() {
      flushEditor();
    }

    async function handleClick(event) {
      var start = event.target.closest("button[data-assessment-start]");
      var navigation = event.target.closest("button[data-assessment-question]");
      var submit = event.target.closest("button[data-assessment-submit]");
      var run = event.target.closest("button[data-assessment-run]");
      var copy = event.target.closest("button[data-assessment-copy]");
      var paste = event.target.closest("button[data-assessment-paste]");
      var reset = event.target.closest("button[data-assessment-reset]");
      var download = event.target.closest("button[data-assessment-download]");
      if (start) {
        var startBlock = getBlock(start.dataset.assessmentBlock);
        var startMode = start.dataset.assessmentStart;
        var startEpoch = workspaceEpoch();
        if (!startBlock) return true;
        start.disabled = true;
        if (startMode === "practical") {
          start.textContent = "Preparing browser Python…";
          try {
            await options.preparePython();
          } catch (error) {
            start.disabled = false;
            start.textContent = "Retry Python preparation";
            options.announce("Python could not be prepared, so the exam clock did not start. " + (error instanceof Error ? error.message : String(error)));
            return true;
          }
        }
        if (!start.isConnected || workspaceChanged(startEpoch)) {
          return true;
        }
        startAttempt(startBlock, startMode);
        return true;
      }
      if (navigation) {
        setCurrentQuestion(navigation.dataset.assessmentBlock, navigation.dataset.assessmentMode, Number(navigation.dataset.assessmentQuestion));
        return true;
      }
      if (submit) {
        var submitBlock = getBlock(submit.dataset.assessmentBlock);
        if (!submitBlock) return true;
        if (submit.dataset.assessmentSubmit === "theory") submitTheory(submitBlock, "submitted");
        else submitPractical(submitBlock, "submitted");
        return true;
      }
      if (run) {
        var runBlock = getBlock(run.dataset.assessmentBlock);
        if (runBlock) runVisibleChecks(runBlock, run.dataset.assessmentRun);
        return true;
      }
      if (copy) {
        copyCode(copy);
        return true;
      }
      if (paste) {
        pasteCode(paste);
        return true;
      }
      if (reset) {
        var resetBlock = getBlock(reset.dataset.assessmentBlock);
        if (resetBlock) resetCode(resetBlock, reset.dataset.assessmentReset);
        return true;
      }
      if (download) {
        downloadCode(download.dataset.assessmentDownload);
        return true;
      }
      return false;
    }

    function handleChange(event) {
      var answer = event.target.closest("input[data-assessment-answer]");
      var mode = event.target.closest("select[data-assessment-editor-mode]");
      if (answer) {
        updateTheoryAnswer(answer);
        return true;
      }
      if (mode) {
        var next = mode.value === "vim" ? "vim" : "sublime";
        options.setEditorMode(next);
        if (activeEditor) {
          activeEditor.setKeyboardMode(next);
          activeEditor.focus();
        }
        options.announce((next === "vim" ? "Vim" : "Sublime") + " keyboard mode enabled for the practical editor.");
        return true;
      }
      return false;
    }

    async function copyCode(button) {
      if (!activeEditor) return;
      try {
        await navigator.clipboard.writeText(activeEditor.getValue());
        button.textContent = "Copied";
        window.setTimeout(function () { if (button.isConnected) button.textContent = "Copy"; }, 1200);
      } catch (error) {
        activeEditor.focus();
        options.announce("Clipboard access was blocked. The editor is focused; use Ctrl or Command plus C.");
      }
    }

    async function pasteCode(button) {
      if (!activeEditor) return;
      var pasteEpoch = workspaceEpoch();
      var targetEditor = activeEditor;
      try {
        var text = await navigator.clipboard.readText();
        if (workspaceChanged(pasteEpoch) || activeEditor !== targetEditor) return;
        if (text) targetEditor.insertText(text);
      } catch (error) {
        if (workspaceChanged(pasteEpoch) || activeEditor !== targetEditor) return;
        targetEditor.focus();
        options.announce("Direct paste was blocked. Use Ctrl or Command plus V in the focused editor.");
      }
      if (button && activeEditor === targetEditor) targetEditor.focus();
    }

    function resetCode(block, questionId) {
      var question = block.practical.questions.find(function (item) { return item.id === questionId; });
      if (!question || !activeEditor) return;
      activeEditor.setValue(question.starterCode);
      activeEditor.focus();
      options.announce("Solution-free starter restored for " + question.title + ".");
    }

    function downloadCode(questionId) {
      if (!activeEditor) return;
      var blob = new Blob([activeEditor.getValue()], { type: "text/x-python;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var anchor = element("a");
      anchor.href = url;
      anchor.download = questionId + ".py";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    function updateSubmittingUi(submitting) {
      document.querySelectorAll("button[data-assessment-submit], button[data-assessment-run], button[data-assessment-paste], button[data-assessment-reset], button[data-assessment-question], select[data-assessment-editor-mode]").forEach(function (control) {
        control.disabled = submitting;
      });
      if (activeEditor && typeof activeEditor.setReadOnly === "function") activeEditor.setReadOnly(submitting);
      var submit = document.querySelector("button[data-assessment-submit='practical']");
      if (submit) submit.textContent = submitting ? "Evaluating five tasks…" : "Submit all five tasks";
    }

    function getBlock(blockId) {
      return data.blocks.find(function (block) { return block.id === blockId; }) || null;
    }

    function sameSet(left, right) {
      if (typeof engine.sameAnswerSet === "function") {
        return engine.sameAnswerSet(left, right);
      }
      var a = Array.from(new Set(left)).sort();
      var b = Array.from(new Set(right)).sort();
      return a.length === b.length && a.every(function (value, index) { return value === b[index]; });
    }

    function boundedIndex(value, total) {
      return Math.max(0, Math.min(total - 1, Number(value) || 0));
    }

    function formatTime(seconds) {
      var safe = Math.max(0, Math.ceil(Number(seconds) || 0));
      return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
    }

    function roundPercent(numerator, denominator) {
      if (!denominator) return 0;
      return Math.round((Number(numerator) / Number(denominator)) * 10000) / 100;
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
      return String(value).replace(/['\\]/g, "\\$&");
    }

    return {
      renderHub: renderHub,
      renderBlock: renderBlock,
      renderMode: renderMode,
      mount: mount,
      dispose: dispose,
      flush: flush,
      handleClick: handleClick,
      handleChange: handleChange
    };
  }

  window.ASSESSMENT_ROOMS = { create: createAssessmentRooms };
})();
