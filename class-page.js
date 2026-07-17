(() => {
  "use strict";

  function createElement(tagName, className, textContent) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null) {
      node.textContent = String(textContent);
    }
    return node;
  }

  function slugify(value) {
    return String(value || "chapter")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "chapter";
  }

  function isNode(value) {
    return Boolean(value && typeof value === "object" && typeof value.nodeType === "number");
  }

  function asText(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    return text || fallback || "";
  }

  function asStringList(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }
        if (item && typeof item === "object") {
          return asText(item.prompt || item.text || item.label || item.title);
        }
        return "";
      })
      .filter(Boolean);
  }

  function asMinutes(value, fallback) {
    const minutes = Number(value);
    return Number.isFinite(minutes) && minutes > 0
      ? Math.round(minutes)
      : fallback;
  }

  function normalizeLessonPlan(value, estimatedMinutes, lessonCount) {
    const rows = Array.isArray(value) ? value.reduce((items, row, index) => {
      if (!row || typeof row !== "object") {
        return items;
      }
      const label = asText(row.label || row.title, `Class segment ${index + 1}`);
      items.push({
        label,
        minutes: asMinutes(row.minutes || row.duration, 10),
        purpose: asText(
          row.purpose || row.description,
          "Build one piece of the chapter model and make the reasoning visible.",
        ),
      });
      return items;
    }, []) : [];

    if (rows.length) {
      return rows;
    }

    const guidedMinutes = Math.max(15, Math.round(estimatedMinutes * 0.35));
    const lessonMinutes = Math.max(15, Math.round(estimatedMinutes * 0.3));
    const practiceMinutes = Math.max(10, estimatedMinutes - guidedMinutes - lessonMinutes - 10);
    return [
      {
        label: "Opening model",
        minutes: 10,
        purpose: "Connect prior knowledge to the new Python idea and name the class goal.",
      },
      {
        label: "Live lecture demonstration",
        minutes: guidedMinutes,
        purpose: "Predict, trace, and explain a fresh example with the instructor.",
      },
      {
        label: lessonCount > 1 ? "Lesson notes and guided checks" : "Lesson notes",
        minutes: lessonMinutes,
        purpose: "Turn the demonstration into precise rules you can reuse.",
      },
      {
        label: "Class practice and exit check",
        minutes: practiceMinutes,
        purpose: "Apply the model independently and identify what still needs review.",
      },
    ];
  }

  function normalizeLectureDemo(value, chapterTitle) {
    const source = value && typeof value === "object" ? value : {};
    return {
      title: asText(source.title, `Trace a ${chapterTitle} example`),
      setup: asText(
        source.setup || source.introduction,
        "Read the example once, predict each visible result, then trace the state change line by line.",
      ),
      filename: asText(source.filename, "lecture-demo.py"),
      code: asText(
        source.code || source.exampleCode,
        "# Write a small, traceable example here.\n# Predict before you run it.",
      ),
      expectedOutput: typeof source.expectedOutput === "string"
        ? source.expectedOutput
        : "",
      teachingPoints: asStringList(source.teachingPoints || source.observations),
      questions: asStringList(source.questions),
    };
  }

  function normalizeActivities(value) {
    const source = Array.isArray(value) ? value : [];
    const activities = source.reduce((items, activity, index) => {
      if (!activity || typeof activity !== "object") {
        return items;
      }
      const instructions = asStringList(activity.instructions);
      items.push({
        title: asText(activity.title, `Class activity ${index + 1}`),
        format: asText(activity.format || activity.mode, "Pair trace"),
        minutes: asMinutes(activity.minutes || activity.duration, 10),
        prompt: asText(
          activity.prompt,
          instructions.join(" ") || "Trace a fresh example and compare the evidence behind each prediction.",
        ),
        evidence: asText(
          activity.evidence,
          "A written prediction, a short trace, and one sentence explaining the result.",
        ),
      });
      return items;
    }, []);

    return activities.length ? activities : [{
      title: "Predict, trace, explain",
      format: "Pairs",
      minutes: 12,
      prompt: "Create a small example that uses the chapter idea. One learner predicts the result; the other traces each step. Swap roles and resolve any disagreement with a precise rule.",
      evidence: "A line-by-line trace and a corrected explanation of any prediction that changed.",
    }];
  }

  function normalizeIndependentPractice(value, chapterTitle) {
    const prompts = asStringList(value);
    return prompts.length ? prompts : [
      `Write a new ${chapterTitle} example without copying the lecture demonstration.`,
      "Predict the result before running the code, then annotate any difference.",
      "Explain which rule from the class made the final result inevitable.",
    ];
  }

  function normalizeHomework(value, chapterTitle) {
    const source = value && typeof value === "object" ? value : {};
    return {
      brief: asText(
        source.brief || source.description || source.title,
        `Consolidate the ${chapterTitle} model with one fresh example and a short written explanation.`,
      ),
      deliverables: asStringList(source.deliverables || source.tasks).length
        ? asStringList(source.deliverables || source.tasks)
        : [
          "One runnable Python example that is different from the class demonstration.",
          "A prediction and a short execution trace.",
          "A note explaining one mistake you now know how to avoid.",
        ],
      selfReview: asStringList(source.selfReview).length
        ? asStringList(source.selfReview)
        : [
          "Can I explain every line without relying on trial and error?",
          "Did I test an edge case that could expose a weak assumption?",
        ],
    };
  }

  function normalizeMaterial(material, chapter, lessonCount) {
    const source = material && typeof material === "object" ? material : {};
    const chapterTitle = asText(source.title, asText(chapter && chapter.title, "Python chapter"));
    const estimatedMinutes = asMinutes(
      source.estimatedMinutes || (source.classMeta && source.classMeta.duration),
      75,
    );
    const aliases = source.classMeta && typeof source.classMeta === "object"
      ? source.classMeta
      : {};
    const pageSummary = asStringList(source.pageSummary);
    const recapQuestions = asStringList(source.recapQuestions || source.recap);
    const objectives = asStringList(source.objectives);
    const prerequisites = asStringList(source.prerequisites || aliases.prerequisites);
    const preparation = asStringList(source.preparation);
    const nextSteps = asStringList(
      Array.isArray(source.nextSteps) ? source.nextSteps : [source.nextSteps],
    );

    return {
      title: chapterTitle,
      subtitle: asText(
        source.subtitle,
        asText(chapter && chapter.summary, `A complete class on ${chapterTitle}.`),
      ),
      audience: asText(source.audience || aliases.level, "Beginning Python learners"),
      format: asText(aliases.format, "Lecture · guided practice · independent work"),
      estimatedMinutes,
      prerequisites: prerequisites.length
        ? prerequisites
        : ["Comfort reading short Python expressions and following code from top to bottom."],
      preparation: preparation.length
        ? preparation
        : ["Open a Python 3 workspace and keep a notebook ready for hand traces."],
      pageSummary: pageSummary.length
        ? pageSummary
        : objectives.length
          ? objectives
          : [
            `Build a precise mental model for ${chapterTitle}.`,
            "Predict and trace a fresh Python example before running it.",
            "Transfer the model to an exercise without seeing its solution.",
          ],
      objectives,
      lessonPlan: normalizeLessonPlan(
        source.lessonPlan || source.schedule,
        estimatedMinutes,
        lessonCount,
      ),
      lectureDemo: normalizeLectureDemo(source.lectureDemo, chapterTitle),
      classActivities: normalizeActivities(source.classActivities || source.activities),
      independentPractice: normalizeIndependentPractice(
        source.independentPractice && !Array.isArray(source.independentPractice)
          ? source.independentPractice.checklist
          : source.independentPractice,
        chapterTitle,
      ),
      recapQuestions: recapQuestions.length
        ? recapQuestions
        : [
          "What state changes during the chapter's core operation?",
          "Which tempting shortcut produces an incorrect prediction?",
          "How would you prove your explanation with a small test?",
        ],
      homework: normalizeHomework(source.homework, chapterTitle),
      nextSteps: nextSteps.length
        ? nextSteps
        : ["Complete the chapter exercises, then revisit any class question you cannot yet explain aloud."],
    };
  }

  function buildSectionPlan(material, flags) {
    const state = flags && typeof flags === "object" ? flags : {};
    const sections = [
      { key: "overview", label: "Class setup" },
      { key: "lesson-plan", label: "Lesson plan" },
      { key: "lecture-demo", label: "Lecture demonstration" },
    ];
    if (state.hasLessons) {
      sections.push({ key: "lesson-notes", label: "Lesson notes" });
    }
    sections.push(
      { key: "class-activities", label: "Class activities" },
      { key: "independent-practice", label: "Independent practice" },
    );
    if (state.hasDeepDive) {
      sections.push({ key: "deep-dive", label: "Deep dive" });
    }
    if (state.hasRunbook) {
      sections.push({ key: "runbook", label: "Problem-solving runbook" });
    }
    sections.push(
      { key: "recap", label: "Class recap" },
      { key: "homework", label: "Homework" },
    );
    if (state.hasOfficialDocs) {
      sections.push({ key: "official-docs", label: "Official Python reading" });
    }
    sections.push({ key: "exercises", label: "Exercise handoff" });
    return sections.map((section) => ({
      ...section,
      id: `${state.scope || "class-chapter"}-${section.key}`,
    }));
  }

  function render(options) {
    const settings = options && typeof options === "object" ? options : {};
    const chapter = settings.chapter && typeof settings.chapter === "object"
      ? settings.chapter
      : {};
    const chapters = Array.isArray(settings.chapters)
      ? settings.chapters
      : Array.isArray(settings.allChapters)
        ? settings.allChapters
        : [];
    const lessonNodes = (Array.isArray(settings.lessonNodes)
      ? settings.lessonNodes
      : Array.isArray(settings.mainLessonNodes)
        ? settings.mainLessonNodes
        : []).filter(isNode);
    const deepDiveNode = isNode(settings.deepDiveNode || settings.deepDive)
      ? settings.deepDiveNode || settings.deepDive
      : null;
    const runbookNode = isNode(settings.runbookNode || settings.runbook)
      ? settings.runbookNode || settings.runbook
      : null;
    const officialDocsNode = isNode(settings.officialDocsNode || settings.officialDocs)
      ? settings.officialDocsNode || settings.officialDocs
      : null;
    const scope = `class-${slugify(chapter.id || chapter.number || chapter.title)}`;
    const material = normalizeMaterial(settings.material, chapter, lessonNodes.length);
    const sections = buildSectionPlan(material, {
      scope,
      hasLessons: Boolean(lessonNodes.length),
      hasDeepDive: Boolean(deepDiveNode),
      hasRunbook: Boolean(runbookNode),
      hasOfficialDocs: Boolean(officialDocsNode),
    });
    const sectionByKey = new Map(sections.map((section) => [section.key, section]));
    const lessonEntries = lessonNodes.map((node, index) => ({
      id: `${scope}-lesson-${index + 1}`,
      label: getLessonLabel(node, settings.material, index),
    }));
    const tocEntries = sections.map((section) => section.key === "lesson-notes"
      ? { ...section, children: lessonEntries }
      : section);

    const page = createElement("div", "page-shell class-page");
    const mobileNavigation = createElement("div", "class-page__mobile-navigation");
    const layout = createElement("div", "class-page__layout");
    const courseRail = createElement("aside", "class-page__course-rail");
    const tocRail = createElement("aside", "class-page__toc-rail");
    const article = createElement("article", "class-page__article");

    page.dataset.classChapter = String(chapter.id || "");
    page.setAttribute("aria-labelledby", `${scope}-title`);

    mobileNavigation.append(
      renderCollapsibleNavigation(
        "Course chapters",
        renderCourseNavigation(chapters, chapter, "Course chapter navigation"),
      ),
      renderCollapsibleNavigation(
        "On this page",
        renderTocNavigation(tocEntries, "Class page contents"),
      ),
    );

    courseRail.append(
      renderCourseRailHeader(chapters.length),
      renderCourseNavigation(chapters, chapter, "All Python course chapters"),
    );
    tocRail.append(
      createElement("strong", "class-page__rail-title", "On this page"),
      renderTocNavigation(tocEntries, "Class page contents"),
    );

    article.append(
      renderArticleHeader(scope, chapter, material, settings.progressNode, settings.classAction),
      renderClassSetup(sectionByKey.get("overview"), material),
      renderLessonPlan(sectionByKey.get("lesson-plan"), material),
      renderLectureDemo(sectionByKey.get("lecture-demo"), material.lectureDemo),
    );

    if (lessonNodes.length) {
      article.append(
        renderLessonNotes(sectionByKey.get("lesson-notes"), lessonNodes, lessonEntries),
      );
    }

    article.append(
      renderClassActivities(sectionByKey.get("class-activities"), material.classActivities),
      renderIndependentPractice(
        sectionByKey.get("independent-practice"),
        material.independentPractice,
      ),
    );

    if (deepDiveNode) {
      article.append(renderSuppliedSection(
        sectionByKey.get("deep-dive"),
        "Deep dive",
        "Challenge the model with a detailed trace, misconceptions, and transfer questions.",
        deepDiveNode,
        "class-page__supplied-content class-page__supplied-content--deep-dive",
      ));
    }
    if (runbookNode) {
      article.append(renderSuppliedSection(
        sectionByKey.get("runbook"),
        "Problem-solving runbook",
        "Use this repeatable process when the specification feels vague or a test fails.",
        runbookNode,
        "class-page__supplied-content class-page__supplied-content--runbook",
      ));
    }

    article.append(
      renderRecap(sectionByKey.get("recap"), material.recapQuestions),
      renderHomework(sectionByKey.get("homework"), material.homework),
    );

    if (officialDocsNode) {
      article.append(renderSuppliedSection(
        sectionByKey.get("official-docs"),
        "Official Python reading",
        "Use the language reference after class to deepen the same ideas with authoritative examples.",
        officialDocsNode,
        "class-page__supplied-content class-page__supplied-content--documentation",
      ));
    }

    article.append(
      renderExerciseHandoff(
        sectionByKey.get("exercises"),
        material,
        asText(
          settings.exerciseHref,
          `#chapter/${encodeURIComponent(String(chapter.id || ""))}/exercises`,
        ),
      ),
      renderChapterPager(settings.previousChapter, settings.nextChapter),
    );

    layout.append(courseRail, article, tocRail);
    page.append(mobileNavigation, layout);
    return page;
  }

  function renderCourseRailHeader(chapterCount) {
    const header = createElement("header", "class-page__course-heading");
    header.append(
      createElement("span", "eyebrow", "Python foundations"),
      createElement("strong", null, "Course classes"),
      createElement(
        "small",
        null,
        `${chapterCount || 0} ${chapterCount === 1 ? "chapter" : "chapters"} · learn in sequence`,
      ),
    );
    return header;
  }

  function renderCourseNavigation(chapters, currentChapter, label) {
    const nav = createElement("nav", "class-page__course-navigation");
    const list = createElement("ol");
    const currentId = String(currentChapter && currentChapter.id || "");
    nav.setAttribute("aria-label", label);

    chapters.forEach((chapter, index) => {
      if (!chapter || typeof chapter !== "object") {
        return;
      }
      const chapterId = String(chapter.id || "");
      const item = createElement("li");
      const chapterLink = createElement("a", "class-page__chapter-link");
      const number = createElement(
        "span",
        "class-page__chapter-number",
        String(chapter.number || index + 1).padStart(2, "0"),
      );
      const copy = createElement("span", "class-page__chapter-copy");
      const isCurrent = chapterId && chapterId === currentId;
      chapterLink.href = asText(
        chapter.href,
        `#chapter/${encodeURIComponent(chapterId)}/tutorials`,
      );
      if (isCurrent) {
        chapterLink.setAttribute("aria-current", "page");
      }
      chapterLink.dataset.chapterId = chapterId;
      copy.append(
        createElement("strong", null, asText(chapter.title, `Chapter ${index + 1}`)),
        createElement(
          "small",
          null,
          isCurrent ? "Current class" : asText(chapter.statusLabel, "Open class notes"),
        ),
      );
      chapterLink.append(number, copy);
      item.append(chapterLink);
      list.append(item);
    });
    nav.append(list);
    return nav;
  }

  function renderCollapsibleNavigation(label, navigation) {
    const details = createElement("details", "class-page__mobile-disclosure");
    const summary = createElement("summary");
    summary.append(
      createElement("span", null, label),
      createElement("span", "class-page__mobile-disclosure-icon", "+"),
    );
    details.append(summary, navigation);
    return details;
  }

  function renderTocNavigation(entries, label) {
    const nav = createElement("nav", "class-page__toc-navigation");
    const list = createElement("ol");
    nav.setAttribute("aria-label", label);
    entries.forEach((entry, index) => {
      const item = createElement("li");
      const sectionLink = createElement("button");
      sectionLink.type = "button";
      sectionLink.dataset.scrollTarget = entry.id;
      sectionLink.append(
        createElement("span", null, String(index + 1).padStart(2, "0")),
        createElement("strong", null, entry.label),
      );
      item.append(sectionLink);
      if (Array.isArray(entry.children) && entry.children.length) {
        const children = createElement("ol", "class-page__toc-children");
        entry.children.forEach((child) => {
          const childItem = createElement("li");
          const childLink = createElement("button", null, child.label);
          childLink.type = "button";
          childLink.dataset.scrollTarget = child.id;
          childItem.append(childLink);
          children.append(childItem);
        });
        item.append(children);
      }
      list.append(item);
    });
    nav.append(list);
    return nav;
  }

  function renderArticleHeader(scope, chapter, material, progressNode, classAction) {
    const header = createElement("header", "class-page__header");
    const breadcrumbs = createElement("nav", "class-page__breadcrumbs");
    const breadcrumbList = createElement("ol");
    const homeItem = createElement("li");
    const chapterItem = createElement("li");
    const currentItem = createElement("li", null, "Class notes");
    const homeLink = createElement("a", null, "Course");
    const chapterLink = createElement("a", null, asText(chapter.title, material.title));
    const title = createElement("h1", null, material.title);
    const summary = createElement("ul", "class-page__summary");
    const meta = createElement("dl", "class-page__meta");
    const status = createElement("aside", "class-page__status");

    breadcrumbs.setAttribute("aria-label", "Breadcrumb");
    homeLink.href = "#home";
    chapterLink.href = `#chapter/${encodeURIComponent(String(chapter.id || ""))}`;
    currentItem.setAttribute("aria-current", "page");
    homeItem.append(homeLink);
    chapterItem.append(chapterLink);
    breadcrumbList.append(homeItem, chapterItem, currentItem);
    breadcrumbs.append(breadcrumbList);

    title.id = `${scope}-title`;
    material.pageSummary.forEach((item) => summary.append(createElement("li", null, item)));

    [
      ["Class", String(chapter.number || "—").padStart(2, "0")],
      ["Audience", material.audience],
      ["Duration", `${material.estimatedMinutes} minutes`],
      ["Format", material.format],
    ].forEach(([term, value]) => {
      const item = createElement("div");
      item.append(createElement("dt", null, term), createElement("dd", null, value));
      meta.append(item);
    });

    status.setAttribute("aria-label", "Class progress and actions");
    if (isNode(progressNode)) {
      status.append(progressNode);
    }
    if (isNode(classAction)) {
      status.append(classAction);
    }
    if (!status.children.length) {
      status.append(
        createElement(
          "p",
          null,
          "Progress is recorded as you complete the lesson checks and chapter exercises.",
        ),
      );
    }

    header.append(
      breadcrumbs,
      createElement(
        "p",
        "eyebrow",
        `Chapter ${String(chapter.number || "—").padStart(2, "0")} · Full class`,
      ),
      title,
      createElement("p", "class-page__lede", material.subtitle),
      createElement("h2", "class-page__summary-title", "In this class"),
      summary,
      meta,
      status,
    );
    return header;
  }

  function renderSectionHeader(section, kicker, title, introduction) {
    const header = createElement("header", "class-page__section-heading");
    header.append(
      createElement("span", "eyebrow", kicker),
      createElement("h2", null, title),
    );
    if (introduction) {
      header.append(createElement("p", null, introduction));
    }
    const wrapper = createElement("section", "class-page__section");
    wrapper.id = section.id;
    wrapper.setAttribute("aria-labelledby", `${section.id}-title`);
    header.querySelector("h2").id = `${section.id}-title`;
    wrapper.append(header);
    return wrapper;
  }

  function renderClassSetup(section, material) {
    const block = renderSectionHeader(
      section,
      "Before class",
      "Class setup",
      "Arrive ready to connect the new idea to a small amount of prior knowledge.",
    );
    const grid = createElement("div", "class-page__setup-grid");
    grid.append(
      renderChecklist("Prerequisites", material.prerequisites),
      renderChecklist("Preparation", material.preparation),
    );
    block.append(grid);
    return block;
  }

  function renderChecklist(title, items) {
    const block = createElement("section", "class-page__checklist");
    const list = createElement("ul");
    block.append(createElement("h3", null, title));
    items.forEach((item) => list.append(createElement("li", null, item)));
    block.append(list);
    return block;
  }

  function renderLessonPlan(section, material) {
    const block = renderSectionHeader(
      section,
      "Class schedule",
      "Lesson plan",
      `${material.estimatedMinutes} focused minutes from the opening model to an independent exit check.`,
    );
    const list = createElement("ol", "class-page__lesson-plan");
    let elapsed = 0;
    material.lessonPlan.forEach((item, index) => {
      const row = createElement("li");
      const timing = createElement("div", "class-page__lesson-time");
      const copy = createElement("div");
      timing.append(
        createElement("strong", null, `${item.minutes} min`),
        createElement("small", null, elapsed === 0 ? "Start" : `Minute ${elapsed}`),
      );
      copy.append(
        createElement("span", "class-page__lesson-index", `Part ${index + 1}`),
        createElement("h3", null, item.label),
        createElement("p", null, item.purpose),
      );
      row.append(timing, copy);
      list.append(row);
      elapsed += item.minutes;
    });
    block.append(list);
    return block;
  }

  function renderLectureDemo(section, demo) {
    const block = renderSectionHeader(
      section,
      "Instructor-led",
      "Lecture demonstration",
      "Keep the code small enough to trace completely. The goal is explanation, not speed.",
    );
    const demoHeader = createElement("div", "class-page__demo-introduction");
    const codeBox = createElement("div", "tutorial-code class-page__code");
    const codeHeader = createElement("div", "tutorial-code__header");
    const codeMeta = createElement("span", "tutorial-code__meta");
    const copyButton = createElement("button", "tutorial-copy-button", "Copy demo");
    const pre = createElement("pre");
    pre.tabIndex = 0;
    const teachingGrid = createElement("div", "class-page__teaching-grid");

    demoHeader.append(createElement("h3", null, demo.title), createElement("p", null, demo.setup));
    copyButton.type = "button";
    copyButton.dataset.copySnippet = "true";
    copyButton.dataset.copyRestingLabel = "Copy demo";
    codeMeta.append(createElement("span", null, "Python 3"), copyButton);
    codeHeader.append(createElement("span", null, demo.filename), codeMeta);
    pre.append(createElement("code", null, demo.code));
    codeBox.append(codeHeader, pre);
    block.append(demoHeader, codeBox);

    if (demo.expectedOutput) {
      block.append(renderExpectedOutput(demo.expectedOutput));
    }
    if (demo.teachingPoints.length) {
      teachingGrid.append(renderNumberedNotes(
        "Teaching points",
        demo.teachingPoints,
        "class-page__teaching-notes",
      ));
    }
    if (demo.questions.length) {
      teachingGrid.append(renderNumberedNotes(
        "Pause-and-predict questions",
        demo.questions,
        "class-page__teaching-questions",
      ));
    }
    if (teachingGrid.children.length) {
      block.append(teachingGrid);
    }
    return block;
  }

  function renderExpectedOutput(output) {
    const box = createElement("section", "class-page__output");
    const header = createElement("header");
    const pre = createElement("pre");
    pre.tabIndex = 0;
    header.append(
      createElement("strong", null, "Expected output"),
      createElement("span", null, "stdout"),
    );
    pre.append(createElement("code", null, output));
    box.append(header, pre);
    return box;
  }

  function renderNumberedNotes(title, items, className) {
    const block = createElement("section", className);
    const list = createElement("ol");
    block.append(createElement("h3", null, title));
    items.forEach((item) => list.append(createElement("li", null, item)));
    block.append(list);
    return block;
  }

  function renderLessonNotes(section, lessonNodes, lessonEntries) {
    const block = renderSectionHeader(
      section,
      "Core reading",
      "Lesson notes",
      "Read each explanation as a claim you should be able to test, trace, and restate in your own words.",
    );
    const lessons = createElement("div", "class-page__lesson-notes");
    lessonNodes.forEach((node, index) => {
      const slot = createElement("div", "class-page__lesson-slot");
      slot.id = lessonEntries[index].id;
      slot.dataset.classLesson = String(index + 1);
      slot.append(node);
      lessons.append(slot);
    });
    block.append(lessons);
    return block;
  }

  function getLessonLabel(node, material, index) {
    const tutorials = material && Array.isArray(material.tutorial)
      ? material.tutorial
      : [];
    if (tutorials[index] && tutorials[index].title) {
      return String(tutorials[index].title);
    }
    if (node && typeof node.querySelector === "function") {
      const heading = node.querySelector("h2, h3, h4");
      if (heading && heading.textContent) {
        return String(heading.textContent);
      }
    }
    return `Lesson ${index + 1}`;
  }

  function renderClassActivities(section, activities) {
    const block = renderSectionHeader(
      section,
      "In class",
      "Class activities",
      "Make reasoning visible: every activity ends with evidence another learner can inspect.",
    );
    const list = createElement("ol", "class-page__activities");
    activities.forEach((activity, index) => {
      const item = createElement("li");
      const heading = createElement("header");
      const meta = createElement("p", "class-page__activity-meta");
      meta.append(
        createElement("span", null, activity.format),
        createElement("span", null, `${activity.minutes} minutes`),
      );
      heading.append(
        createElement("span", "class-page__activity-number", String(index + 1).padStart(2, "0")),
        createElement("h3", null, activity.title),
        meta,
      );
      item.append(
        heading,
        createElement("p", "class-page__activity-prompt", activity.prompt),
        createElement("p", "class-page__activity-evidence", `Evidence to produce: ${activity.evidence}`),
      );
      list.append(item);
    });
    block.append(list);
    return block;
  }

  function renderIndependentPractice(section, prompts) {
    const block = renderSectionHeader(
      section,
      "Work alone",
      "Independent practice",
      "Close the lecture example. Complete these prompts from the mental model, then use execution only to check your reasoning.",
    );
    const list = createElement("ol", "class-page__practice-list");
    prompts.forEach((prompt) => list.append(createElement("li", null, prompt)));
    block.append(list);
    return block;
  }

  function renderSuppliedSection(section, title, introduction, node, className) {
    const block = renderSectionHeader(
      section,
      "Reference and transfer",
      title,
      introduction,
    );
    const slot = createElement("div", className);
    slot.append(node);
    block.append(slot);
    return block;
  }

  function renderRecap(section, questions) {
    const block = renderSectionHeader(
      section,
      "Exit check",
      "Class recap",
      "Answer these questions without running code. A precise explanation is stronger evidence than recognition.",
    );
    const list = createElement("ol", "class-page__recap-list");
    questions.forEach((question) => list.append(createElement("li", null, question)));
    block.append(list);
    return block;
  }

  function renderHomework(section, homework) {
    const block = renderSectionHeader(
      section,
      "After class",
      "Homework",
      homework.brief,
    );
    const grid = createElement("div", "class-page__homework-grid");
    grid.append(
      renderHomeworkList("Deliverables", homework.deliverables),
      renderHomeworkList("Self-review before submitting", homework.selfReview),
    );
    block.append(grid);
    return block;
  }

  function renderHomeworkList(title, items) {
    const section = createElement("section");
    const list = createElement("ul");
    section.append(createElement("h3", null, title));
    items.forEach((item) => list.append(createElement("li", null, item)));
    section.append(list);
    return section;
  }

  function renderExerciseHandoff(section, material, exerciseHref) {
    const block = renderSectionHeader(
      section,
      "End of class",
      "Turn the lesson into working code",
      "The exercises use different scenarios from the class notes. Transfer the model yourself, run the visible checks, and use failures as evidence.",
    );
    const nextSteps = createElement("ul", "class-page__next-steps");
    const action = createElement("a", "button button--primary", "Open chapter exercises");
    material.nextSteps.forEach((step) => nextSteps.append(createElement("li", null, step)));
    action.href = exerciseHref;
    block.classList.add("class-page__exercise-handoff");
    block.append(nextSteps, action);
    return block;
  }

  function normalizeChapterLink(value) {
    if (!value) {
      return null;
    }
    if (isNode(value)) {
      return { node: value };
    }
    if (typeof value !== "object") {
      return null;
    }
    const id = String(value.id || "");
    return {
      href: asText(value.href, id ? `#chapter/${encodeURIComponent(id)}/tutorials` : "#home"),
      label: asText(value.label || value.title, "Chapter"),
      number: value.number,
    };
  }

  function renderChapterPager(previousValue, nextValue) {
    const previous = normalizeChapterLink(previousValue);
    const next = normalizeChapterLink(nextValue);
    const nav = createElement("nav", "class-page__pager");
    nav.setAttribute("aria-label", "Previous and next class");

    if (previous) {
      nav.append(renderPagerLink(previous, "Previous class", "class-page__pager-link--previous"));
    } else {
      nav.append(createElement("span"));
    }
    if (next) {
      nav.append(renderPagerLink(next, "Next class", "class-page__pager-link--next"));
    }
    return nav;
  }

  function renderPagerLink(link, direction, className) {
    const wrapper = createElement("div", `class-page__pager-link ${className}`);
    if (link.node) {
      wrapper.append(link.node);
      return wrapper;
    }
    const anchor = createElement("a");
    anchor.href = link.href;
    anchor.append(
      createElement("span", null, direction),
      createElement(
        "strong",
        null,
        `${link.number ? `Chapter ${String(link.number).padStart(2, "0")} · ` : ""}${link.label}`,
      ),
    );
    wrapper.append(anchor);
    return wrapper;
  }

  window.CLASS_PAGE = Object.freeze({
    buildSectionPlan,
    normalizeMaterial,
    render,
    slugify,
  });
})();
