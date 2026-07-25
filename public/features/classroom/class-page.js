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

  function asInputLines(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .slice(0, 24)
      .map((item) => String(item === undefined || item === null ? "" : item).slice(0, 1000));
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
      stdin: asInputLines(source.stdin || source.sampleInput),
      teachingPoints: asStringList(source.teachingPoints || source.observations),
      questions: asStringList(source.questions),
    };
  }

  function normalizeRoomTasks(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.reduce((tasks, item, index) => {
      if (!item || typeof item !== "object") {
        return tasks;
      }
      const id = slugify(item.id || `task-${index + 1}`);
      const kind = item.kind === "code" ? "code" : "answer";
      const explanation = asStringList(item.explanation);
      tasks.push({
        id,
        title: asText(item.title, `Guided task ${index + 1}`),
        summary: asText(
          item.summary,
          "Read the idea, make a prediction, and check your understanding.",
        ),
        explanation: explanation.length
          ? explanation
          : ["Use the example as evidence, then explain the rule in your own words."],
        kind,
        prompt: asText(item.prompt, "What should the learner do next?"),
        placeholder: asText(item.placeholder, "Type your answer"),
        starterCode: typeof item.starterCode === "string"
          ? item.starterCode
          : "# Edit this example, then run it.\n",
        stdin: asInputLines(item.stdin),
        expectedOutput: typeof item.expectedOutput === "string" ? item.expectedOutput : "",
        requirements: asStringList(item.requirements),
        hint: asText(item.hint, "Return to the explanation and trace one line at a time."),
        success: asText(item.success, "Correct. You can now explain this step."),
      });
      return tasks;
    }, []);
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
      roomTasks: normalizeRoomTasks(source.roomTasks),
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
    if (state.hasRoomTasks) {
      sections.push({ key: "room-tasks", label: "Guided room tasks" });
    }
    if (state.hasLessons) {
      sections.push({ key: "lesson-notes", label: "Lesson notes" });
    }
    sections.push(
      { key: "tutor", label: "Ask the chapter tutor" },
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
    const roomTaskEntries = material.roomTasks.map((task, index) => ({
      id: `${scope}-room-${slugify(task.id)}`,
      label: `Task ${index + 1} · ${task.title}`,
    }));
    const sections = buildSectionPlan(material, {
      scope,
      hasLessons: Boolean(lessonNodes.length),
      hasRoomTasks: Boolean(material.roomTasks.length),
      hasDeepDive: Boolean(deepDiveNode),
      hasRunbook: Boolean(runbookNode),
      hasOfficialDocs: Boolean(officialDocsNode),
    });
    const sectionByKey = new Map(sections.map((section) => [section.key, section]));
    const lessonEntries = lessonNodes.map((node, index) => ({
      id: `${scope}-lesson-${index + 1}`,
      label: getLessonLabel(node, settings.material, index),
    }));
    const tocEntries = sections.map((section) => {
      if (section.key === "lesson-notes") {
        return { ...section, children: lessonEntries };
      }
      if (section.key === "room-tasks") {
        return { ...section, children: roomTaskEntries };
      }
      return section;
    });

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
      renderLectureDemo(sectionByKey.get("lecture-demo"), material.lectureDemo, {
        chapterId: String(chapter.id || ""),
        draft: settings.labDrafts && settings.labDrafts["lecture-demo"],
      }),
    );

    if (material.roomTasks.length) {
      article.append(renderRoomTasks(
        sectionByKey.get("room-tasks"),
        material.roomTasks,
        roomTaskEntries,
        {
          chapterId: String(chapter.id || ""),
          completedIds: new Set(
            Array.isArray(settings.completedRoomTaskIds)
              ? settings.completedRoomTaskIds.map(String)
              : [],
          ),
          labDrafts: settings.labDrafts && typeof settings.labDrafts === "object"
            ? settings.labDrafts
            : {},
        },
      ));
    }

    if (lessonNodes.length) {
      article.append(
        renderLessonNotes(sectionByKey.get("lesson-notes"), lessonNodes, lessonEntries),
      );
    }

    article.append(
      renderChapterTutor(sectionByKey.get("tutor"), chapter, material),
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

  function renderLectureDemo(section, demo, options) {
    const settings = options && typeof options === "object" ? options : {};
    const block = renderSectionHeader(
      section,
      "Instructor-led",
      "Lecture demonstration",
      "Predict first, then edit and run the example. Sample input is kept separate from the Python editor so you can see exactly what input() receives.",
    );
    const demoHeader = createElement("div", "class-page__demo-introduction");
    const teachingGrid = createElement("div", "class-page__teaching-grid");

    demoHeader.append(createElement("h3", null, demo.title), createElement("p", null, demo.setup));
    block.append(
      demoHeader,
      renderRunnableLab({
        id: "lecture-demo",
        filename: demo.filename,
        starterCode: demo.code,
        stdin: demo.stdin,
        expectedOutput: demo.expectedOutput,
      }, {
        chapterId: settings.chapterId,
        draft: settings.draft,
        taskId: "",
      }),
    );
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

  function renderRunnableLab(lab, options) {
    const settings = options && typeof options === "object" ? options : {};
    const draft = settings.draft && typeof settings.draft === "object"
      ? settings.draft
      : {};
    const labId = slugify(lab.id || "class-lab");
    const chapterId = String(settings.chapterId || "");
    const codeValue = typeof draft.code === "string" ? draft.code : lab.starterCode;
    const inputValue = typeof draft.stdin === "string"
      ? draft.stdin
      : asInputLines(lab.stdin).join("\n");
    const scope = `class-lab-${slugify(chapterId)}-${labId}`;
    const workspace = createElement("section", "class-room-lab");
    const toolbar = createElement("header", "class-room-lab__toolbar");
    const actions = createElement("div", "class-room-lab__actions");
    const copyButton = createElement("button", "button button--quiet", "Copy code");
    const resetButton = createElement("button", "button button--quiet", "Reset");
    const runButton = createElement("button", "button button--primary", "Run code");
    const checkButton = settings.taskId
      ? createElement("button", "button button--primary", "Check task")
      : null;
    const panes = createElement("div", "class-room-lab__panes");
    const editorPanel = createElement("div", "class-room-lab__editor-panel");
    const editorLabel = createElement("label", "class-room-lab__label", "Python editor");
    const editor = createElement("textarea", "class-room-lab__editor");
    const inputPanel = createElement("div", "class-room-lab__input-panel");
    const inputLabel = createElement(
      "label",
      "class-room-lab__label",
      "Program input · one line for each input() call",
    );
    const input = createElement("textarea", "class-room-lab__stdin");
    const terminal = createElement("section", "class-room-lab__terminal");
    const terminalHeader = createElement("header");
    const terminalContext = createElement(
      "span",
      "class-room-lab__terminal-context",
      "Input source appears after each run",
    );
    const terminalOutput = createElement("pre", null, "Run the code to see its output here.");
    const status = createElement(
      "p",
      "class-room-lab__status",
      "Ready. Press Shift + Enter from either editor to run.",
    );

    workspace.dataset.classLab = labId;
    workspace.dataset.classChapter = chapterId;
    workspace.dataset.classTaskId = String(settings.taskId || "");
    workspace.dataset.expectedOutput = typeof lab.expectedOutput === "string"
      ? lab.expectedOutput
      : "";
    workspace.setAttribute("aria-labelledby", `${scope}-title`);

    toolbar.append(
      createElement("strong", null, lab.filename || `${labId}.py`),
      createElement("span", "class-room-lab__runtime", "Python 3 · isolated runner"),
    );
    copyButton.type = "button";
    copyButton.dataset.classLabCopy = labId;
    resetButton.type = "button";
    resetButton.dataset.classLabReset = labId;
    runButton.type = "button";
    runButton.dataset.classLabRun = labId;
    runButton.dataset.classLabRunMode = "run";
    runButton.setAttribute("aria-keyshortcuts", "Shift+Enter");
    actions.append(copyButton, resetButton, runButton);
    if (checkButton) {
      checkButton.type = "button";
      checkButton.dataset.classLabRun = labId;
      checkButton.dataset.classLabRunMode = "check";
      actions.append(checkButton);
    }
    toolbar.append(actions);
    toolbar.querySelector("strong").id = `${scope}-title`;

    editor.id = `${scope}-code`;
    editor.value = codeValue;
    editor.rows = Math.max(7, Math.min(18, String(codeValue).split("\n").length + 2));
    editor.maxLength = 12000;
    editor.spellcheck = false;
    editor.wrap = "off";
    editor.dataset.classLabCode = labId;
    editor.dataset.classChapter = chapterId;
    editor.setAttribute("autocomplete", "off");
    editor.setAttribute("autocapitalize", "off");
    editor.setAttribute("aria-describedby", `${scope}-status`);
    editorLabel.htmlFor = editor.id;
    editorPanel.append(editorLabel, editor);

    input.id = `${scope}-stdin`;
    input.value = inputValue;
    input.rows = Math.max(3, Math.min(7, String(inputValue || "").split("\n").length + 1));
    input.maxLength = 2000;
    input.spellcheck = false;
    input.dataset.classLabStdin = labId;
    input.dataset.classChapter = chapterId;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-describedby", `${scope}-input-help`);
    inputLabel.htmlFor = input.id;
    inputPanel.append(
      inputLabel,
      createElement(
        "p",
        "class-room-lab__input-help",
        settings.taskId
          ? "Run uses these editable lines. Check task uses the original task input restored by Reset."
          : "These lines act like text typed into the terminal after the program pauses at input().",
      ),
      input,
    );
    inputPanel.querySelector("p").id = `${scope}-input-help`;

    panes.append(editorPanel, inputPanel);
    terminalHeader.append(
      createElement("strong", null, "Terminal"),
      terminalContext,
    );
    terminalContext.dataset.classLabTerminalContext = labId;
    terminalOutput.dataset.classLabOutput = labId;
    terminalOutput.tabIndex = 0;
    status.id = `${scope}-status`;
    status.dataset.classLabStatus = labId;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    terminal.append(terminalHeader, terminalOutput, status);
    workspace.append(toolbar, panes, terminal);

    if (lab.expectedOutput) {
      workspace.append(renderExpectedOutput(lab.expectedOutput));
    }
    return workspace;
  }

  function renderRoomTasks(section, tasks, entries, options) {
    const settings = options && typeof options === "object" ? options : {};
    const completed = settings.completedIds instanceof Set
      ? settings.completedIds
      : new Set();
    const block = renderSectionHeader(
      section,
      "Interactive classroom",
      "Guided room tasks",
      "Work in order: read one small idea, answer or run it, inspect the feedback, then continue. Nothing here reveals an exercise solution.",
    );
    const progress = createElement("div", "class-room-progress");
    const completeCount = tasks.reduce(
      (count, task) => count + (completed.has(task.id) ? 1 : 0),
      0,
    );
    const progressBar = createElement("progress");
    const list = createElement("ol", "class-room-tasks");

    progress.dataset.classRoomProgress = settings.chapterId;
    progress.append(
      createElement("strong", null, `${completeCount} / ${tasks.length} room tasks complete`),
      progressBar,
    );
    progressBar.max = Math.max(tasks.length, 1);
    progressBar.value = completeCount;
    progressBar.setAttribute(
      "aria-label",
      `${completeCount} of ${tasks.length} guided room tasks complete`,
    );

    tasks.forEach((task, index) => {
      const entry = entries[index];
      const done = completed.has(task.id);
      const item = createElement("li", `class-room-task${done ? " is-complete" : ""}`);
      const article = createElement("article");
      const header = createElement("header", "class-room-task__header");
      const copy = createElement("div");
      const state = createElement(
        "span",
        "class-room-task__state",
        done ? "Completed ✓" : "Ready",
      );
      const explanation = createElement("div", "class-room-task__theory");

      item.id = entry.id;
      item.dataset.classTask = task.id;
      item.dataset.classChapter = settings.chapterId;
      copy.append(
        createElement("span", "eyebrow", `Task ${index + 1} of ${tasks.length}`),
        createElement("h3", null, task.title),
        createElement("p", null, task.summary),
      );
      state.dataset.classTaskStatus = task.id;
      header.append(copy, state);
      task.explanation.forEach((paragraph) => explanation.append(createElement("p", null, paragraph)));
      article.append(header, explanation);

      if (task.kind === "code") {
        const challenge = createElement("section", "class-room-task__challenge");
        challenge.append(
          createElement("h4", null, "Try it in Python"),
          createElement("p", null, task.prompt),
        );
        if (task.requirements.length) {
          const contract = createElement("aside", "class-room-task__contract");
          const contractList = createElement("ul");
          task.requirements.forEach((requirement) => {
            contractList.append(createElement("li", null, requirement));
          });
          contract.append(
            createElement("strong", null, "To complete this task"),
            contractList,
          );
          challenge.append(contract);
        }
        challenge.append(
          renderRunnableLab({
            id: task.id,
            filename: `${task.id}.py`,
            starterCode: task.starterCode,
            stdin: task.stdin,
            expectedOutput: task.expectedOutput,
          }, {
            chapterId: settings.chapterId,
            taskId: task.id,
            draft: settings.labDrafts[task.id],
          }),
        );
        article.append(challenge);
      } else {
        article.append(renderRoomAnswer(task, settings.chapterId, done));
      }

      const hint = createElement("details", "class-room-task__hint");
      hint.append(
        createElement("summary", null, "Need a hint?"),
        createElement("p", null, task.hint),
      );
      article.append(hint);
      item.append(article);
      list.append(item);
    });

    block.append(progress, list);
    return block;
  }

  function renderRoomAnswer(task, chapterId, done) {
    const form = createElement("form", "class-room-answer");
    const label = createElement("label", null, task.prompt);
    const row = createElement("div", "class-room-answer__row");
    const input = createElement("input");
    const button = createElement("button", "button button--primary", done ? "Check again" : "Check answer");
    const feedback = createElement(
      "p",
      `class-room-answer__feedback${done ? " is-correct" : ""}`,
      done ? task.success : "Your feedback will appear here.",
    );
    const inputId = `class-room-answer-${slugify(chapterId)}-${slugify(task.id)}`;

    form.dataset.classRoomForm = task.id;
    form.dataset.classChapter = chapterId;
    input.id = inputId;
    input.name = "answer";
    input.type = "text";
    input.placeholder = task.placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.classAnswer = task.id;
    input.dataset.classChapter = chapterId;
    input.setAttribute("aria-describedby", `${inputId}-feedback`);
    label.htmlFor = inputId;
    button.type = "submit";
    button.dataset.classRoomCheck = task.id;
    feedback.id = `${inputId}-feedback`;
    feedback.dataset.classFeedback = task.id;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    row.append(input, button);
    form.append(label, row, feedback);
    return form;
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

  function renderChapterTutor(section, chapter, material) {
    const chapterId = String(chapter && chapter.id || "");
    const scope = `${section.id}-workspace`;
    const block = renderSectionHeader(
      section,
      "Chapter-grounded study coach",
      "Ask the chapter tutor",
      "Ask for a simpler explanation, a fresh example to trace, or a short knowledge check. The tutor searches only this chapter’s published class material before answering.",
    );
    const panel = createElement("div", "chapter-tutor");
    const boundary = createElement("aside", "chapter-tutor__boundary");
    const boundaryCopy = createElement("div");
    const toolbar = createElement("header", "chapter-tutor__toolbar");
    const toolbarCopy = createElement("div");
    const clearButton = createElement("button", "button button--quiet", "Clear chat");
    const transcript = createElement("div", "chapter-tutor__transcript");
    const welcome = createElement(
      "article",
      "chapter-tutor__message chapter-tutor__message--assistant",
    );
    const welcomeHeader = createElement("header");
    const form = createElement("form", "chapter-tutor__form");
    const label = createElement("label", null, `Ask about ${material.title}`);
    const textarea = createElement("textarea");
    const promptList = createElement("div", "chapter-tutor__prompts");
    const formFooter = createElement("div", "chapter-tutor__form-footer");
    const help = createElement(
      "p",
      "chapter-tutor__help",
      "Ask one focused question. Include what you already tried so the coach can meet you at the right step.",
    );
    const status = createElement(
      "p",
      "chapter-tutor__status",
      "Ready for a chapter question.",
    );
    const submit = createElement("button", "button button--primary", "Ask tutor");
    const prompts = [
      "Explain the main idea in beginner-friendly language.",
      "Give me a new example to trace without solving an exercise.",
      "Quiz me with one question, then wait for my answer.",
    ];

    panel.dataset.chapterTutor = chapterId;
    panel.dataset.tutorConversationId = "";
    panel.setAttribute("aria-labelledby", `${scope}-title`);
    panel.setAttribute("aria-busy", "false");

    boundaryCopy.append(
      createElement("strong", null, "Learning boundary"),
      createElement(
        "p",
        null,
        "This coach is restricted to the current chapter. It should explain ideas and create similar examples, but it will not reveal exercise solutions, answer keys, or hidden tests. AI can make mistakes—verify important details against the cited class notes.",
      ),
    );
    boundary.append(createElement("span", "chapter-tutor__boundary-icon", "◎"), boundaryCopy);

    toolbarCopy.append(
      createElement("span", "eyebrow", "Local classroom assistant"),
      createElement("strong", null, "Llama 3.1 · chapter RAG"),
    );
    clearButton.type = "button";
    clearButton.dataset.chapterTutorClear = chapterId;
    toolbar.append(toolbarCopy, clearButton);

    transcript.dataset.chapterTutorTranscript = chapterId;
    transcript.setAttribute("role", "log");
    transcript.setAttribute("aria-live", "polite");
    transcript.setAttribute("aria-relevant", "additions");
    transcript.setAttribute("aria-label", `${material.title} tutor conversation`);
    transcript.tabIndex = 0;
    welcomeHeader.append(
      createElement("strong", null, "Chapter tutor"),
      createElement("span", null, "Study coach"),
    );
    welcome.append(
      welcomeHeader,
      createElement(
        "p",
        null,
        `I can help you understand ${material.title} using this chapter’s class material. Ask me to explain, compare, trace, or quiz you.`,
      ),
    );
    transcript.append(welcome);

    form.dataset.chapterTutorForm = chapterId;
    textarea.id = `${scope}-question`;
    textarea.name = "question";
    textarea.rows = 3;
    textarea.maxLength = 1200;
    textarea.placeholder = "For example: What does input() return, and why might I convert it with int()?";
    textarea.dataset.chapterTutorQuestion = chapterId;
    textarea.setAttribute("aria-describedby", `${scope}-help ${scope}-status`);
    textarea.setAttribute("aria-keyshortcuts", "Control+Enter");
    label.htmlFor = textarea.id;
    help.id = `${scope}-help`;
    prompts.forEach((prompt) => {
      const button = createElement("button", null, prompt);
      button.type = "button";
      button.dataset.chapterTutorPrompt = prompt;
      promptList.append(button);
    });
    status.id = `${scope}-status`;
    status.dataset.chapterTutorStatus = chapterId;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    submit.type = "submit";
    submit.setAttribute("aria-keyshortcuts", "Control+Enter");
    formFooter.append(
      createElement(
        "small",
        null,
        "Ctrl + Enter to send · conversation stays in this browser tab",
      ),
      submit,
    );
    form.append(
      label,
      textarea,
      help,
      promptList,
      formFooter,
      status,
    );

    panel.append(boundary, toolbar, transcript, form);
    block.append(panel);
    return block;
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
    renderChapterTutor,
    renderRunnableLab,
    slugify,
  });
})();
