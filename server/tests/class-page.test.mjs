import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(REPOSITORY_ROOT, "class-page.js"), "utf8");

class FakeElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.className = "";
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.id = "";
    this.href = "";
    this.type = "";
    this._textContent = "";
    this.classList = {
      add: (...tokens) => {
        const classes = new Set(this.className.split(/\s+/u).filter(Boolean));
        tokens.filter(Boolean).forEach((token) => classes.add(token));
        this.className = Array.from(classes).join(" ");
      },
    };
  }

  append(...nodes) {
    nodes.forEach((node) => {
      if (node !== undefined && node !== null) {
        this.children.push(node);
      }
    });
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") {
      this.id = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  querySelector(selector) {
    const tags = selector
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean);
    return walk(this).find((node) => node !== this && tags.includes(node.tagName)) || null;
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    return this._textContent + this.children
      .map((child) => child && typeof child.textContent === "string" ? child.textContent : "")
      .join("");
  }
}

function walk(root) {
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    nodes.push(node);
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  };
  visit(root);
  return nodes;
}

function findByText(root, tagName, text) {
  return walk(root).find((node) => (
    node.tagName === tagName.toUpperCase() && node.textContent === text
  ));
}

const document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
};

const context = vm.createContext({
  Array,
  Boolean,
  Map,
  Math,
  Number,
  Object,
  Set,
  String,
  encodeURIComponent,
  document,
  window: {},
});
vm.runInContext(source, context, { filename: "class-page.js" });
const classPage = context.window.CLASS_PAGE;

function canonicalMaterial() {
  return {
    title: "Decisions and Loops",
    subtitle: "Control which statements run and prove that repetition stops.",
    audience: "Beginning Python learners",
    prerequisites: ["Assignments", "Boolean expressions"],
    estimatedMinutes: 90,
    preparation: ["Open a Python 3 editor.", "Bring a notebook for traces."],
    pageSummary: [
      "Trace a branch before execution.",
      "State a loop invariant.",
      "Diagnose an off-by-one error.",
    ],
    lessonPlan: [
      { label: "Branch model", minutes: 20, purpose: "Trace mutually exclusive paths." },
      { label: "Loop model", minutes: 30, purpose: "Track state across iterations." },
      { label: "Practice", minutes: 40, purpose: "Transfer both models." },
    ],
    lectureDemo: {
      title: "Trace a bounded counter",
      setup: "Predict every printed number before running the code.",
      code: "count = 1\nwhile count < 4:\n    print(count)\n    count += 1",
      expectedOutput: "1\n2\n3",
      teachingPoints: ["The condition is checked before each iteration."],
      questions: ["What changes if the comparison becomes <=?"],
    },
    classActivities: [
      {
        title: "Branch trace",
        format: "Pairs",
        minutes: 12,
        prompt: "Trace three inputs through one if/elif/else chain.",
        evidence: "A path table with exactly one selected branch per input.",
      },
    ],
    independentPractice: [
      "Write a loop whose progress variable is visible.",
      "State why the loop must terminate.",
    ],
    recapQuestions: [
      "When is an elif condition evaluated?",
      "What proves that a loop makes progress?",
    ],
    homework: {
      brief: "Build and explain one bounded repetition program.",
      deliverables: ["A runnable file.", "A hand trace."],
      selfReview: ["Does every path terminate?", "Did I test a boundary value?"],
    },
    nextSteps: "Complete the chapter exercises.",
    tutorial: [
      { title: "Choose one path" },
      { title: "Repeat with progress" },
    ],
  };
}

test("the public API exposes rendering and deterministic data helpers", () => {
  assert.equal(typeof classPage.render, "function");
  assert.equal(typeof classPage.normalizeMaterial, "function");
  assert.equal(typeof classPage.buildSectionPlan, "function");
  assert.equal(classPage.slugify("  Capítulo 03: Loops! "), "capitulo-03-loops");
  assert.equal(Object.isFrozen(classPage), true);
});

test("canonical class material is normalized without losing instructional detail", () => {
  const normalized = classPage.normalizeMaterial(
    canonicalMaterial(),
    { id: "py03", title: "Decisions and Loops" },
    2,
  );

  assert.equal(normalized.estimatedMinutes, 90);
  assert.equal(normalized.audience, "Beginning Python learners");
  assert.equal(normalized.lessonPlan.length, 3);
  assert.equal(normalized.lessonPlan[1].purpose, "Track state across iterations.");
  assert.equal(normalized.lectureDemo.expectedOutput, "1\n2\n3");
  assert.equal(normalized.classActivities[0].evidence, "A path table with exactly one selected branch per input.");
  assert.equal(normalized.independentPractice.length, 2);
  assert.equal(normalized.homework.selfReview.length, 2);
  assert.deepEqual(Array.from(normalized.nextSteps), ["Complete the chapter exercises."]);
});

test("the section plan is stable, scoped, ordered, and reflects optional supplied sections", () => {
  const plan = classPage.buildSectionPlan({}, {
    scope: "class-py03",
    hasLessons: true,
    hasDeepDive: true,
    hasRunbook: true,
    hasOfficialDocs: true,
  });

  assert.deepEqual(
    Array.from(plan, (section) => section.key),
    [
      "overview",
      "lesson-plan",
      "lecture-demo",
      "lesson-notes",
      "class-activities",
      "independent-practice",
      "deep-dive",
      "runbook",
      "recap",
      "homework",
      "official-docs",
      "exercises",
    ],
  );
  assert.equal(plan.every((section) => section.id.startsWith("class-py03-")), true);
  assert.equal(new Set(plan.map((section) => section.id)).size, plan.length);
});

test("render builds a complete accessible class page from canonical material and DOM slots", () => {
  const lessonOne = document.createElement("section");
  const lessonOneHeading = document.createElement("h2");
  lessonOneHeading.textContent = "Choose one path";
  lessonOne.append(lessonOneHeading);
  const lessonTwo = document.createElement("section");
  const lessonTwoHeading = document.createElement("h2");
  lessonTwoHeading.textContent = "Repeat with progress";
  lessonTwo.append(lessonTwoHeading);
  const progress = document.createElement("progress");
  const classAction = document.createElement("button");
  const deepDive = document.createElement("section");
  const runbook = document.createElement("section");
  const officialDocs = document.createElement("section");

  const page = classPage.render({
    chapter: {
      id: "py03",
      number: 3,
      title: "Decisions and Loops",
      summary: "Choose paths and repeat deliberately.",
    },
    chapters: [
      { id: "py01", number: 1, title: "First Programs" },
      { id: "py03", number: 3, title: "Decisions and Loops" },
      { id: "py04", number: 4, title: "Functions" },
    ],
    material: canonicalMaterial(),
    progressNode: progress,
    classAction,
    lessonNodes: [lessonOne, lessonTwo],
    deepDiveNode: deepDive,
    runbookNode: runbook,
    officialDocsNode: officialDocs,
    exerciseHref: "#chapter/py03/exercises",
    previousChapter: { id: "py02", number: 2, title: "Numbers" },
    nextChapter: { id: "py04", number: 4, title: "Functions" },
  });

  const nodes = walk(page);
  const headings = nodes.filter((node) => /^H[1-6]$/u.test(node.tagName));
  const ids = nodes.map((node) => node.id).filter(Boolean);
  const tocButtons = nodes.filter((node) => node.dataset && node.dataset.scrollTarget);
  const currentChapterLinks = nodes.filter((node) => node.getAttribute("aria-current") === "page");
  const copyButton = nodes.find((node) => node.dataset && node.dataset.copySnippet === "true");
  const sectionFragmentLinks = nodes.filter((node) => (
    node.tagName === "A" && /^#class-py03-/u.test(node.href)
  ));

  assert.equal(page.getAttribute("aria-labelledby"), "class-py03-title");
  assert.equal(headings.filter((heading) => heading.tagName === "H1").length, 1);
  assert.equal(findByText(page, "H1", "Decisions and Loops").id, "class-py03-title");
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes("class-py03-lesson-1"), true);
  assert.equal(ids.includes("class-py03-official-docs"), true);
  assert.equal(tocButtons.length >= 14, true);
  assert.equal(tocButtons.every((button) => button.type === "button"), true);
  assert.equal(sectionFragmentLinks.length, 0);
  assert.equal(currentChapterLinks.some((node) => node.dataset.chapterId === "py03"), true);
  assert.equal(copyButton.type, "button");
  assert.equal(copyButton.dataset.copyRestingLabel, "Copy demo");
  assert.ok(findByText(page, "STRONG", "Expected output"));
  assert.ok(findByText(page, "H2", "Class activities"));
  assert.ok(findByText(page, "H2", "Independent practice"));
  assert.ok(findByText(page, "H2", "Class recap"));
  assert.ok(findByText(page, "H2", "Homework"));
  assert.equal(nodes.includes(progress), true);
  assert.equal(nodes.includes(classAction), true);
  assert.equal(nodes.includes(deepDive), true);
  assert.equal(nodes.includes(runbook), true);
  assert.equal(nodes.includes(officialDocs), true);
});

test("render supplies useful class defaults when optional instructional arrays are absent", () => {
  const page = classPage.render({
    chapter: { id: "py01", number: 1, title: "First Programs" },
    chapters: [{ id: "py01", number: 1, title: "First Programs" }],
    material: {},
    lessonNodes: [],
    exerciseHref: "#chapter/py01/exercises",
  });
  const nodes = walk(page);

  assert.ok(findByText(page, "H2", "Lesson plan"));
  assert.ok(findByText(page, "H2", "In this class"));
  assert.ok(findByText(page, "H2", "Lecture demonstration"));
  assert.ok(findByText(page, "H2", "Class activities"));
  assert.ok(findByText(page, "H2", "Independent practice"));
  assert.ok(findByText(page, "H2", "Class recap"));
  assert.ok(findByText(page, "H2", "Homework"));
  assert.equal(
    new Set(nodes
      .filter((node) => node.dataset && node.dataset.scrollTarget)
      .map((node) => node.dataset.scrollTarget)).size,
    8,
  );
  assert.equal(
    nodes.some((node) => node.tagName === "A" && node.href === "#chapter/py01/exercises"),
    true,
  );
});
