import { expect, test } from "@playwright/test";

let unexpectedBrowserErrors;

test.beforeEach(async ({ page }) => {
  unexpectedBrowserErrors = [];
  page.on("pageerror", (error) => {
    unexpectedBrowserErrors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      unexpectedBrowserErrors.push(`console: ${message.text()}`);
    }
  });
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("a clean mobile chapter presents its recommended class action before the choices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#chapter/py01");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const action = page.locator(".chapter-hero__quickstart .button--primary");
  await expect(action).toHaveText("Start learning");
  await expect(action).toHaveAttribute("href", "#chapter/py01/tutorials");

  const geometry = await page.evaluate(() => {
    const actionNode = document.querySelector(
      ".chapter-hero__quickstart .button--primary",
    );
    const recommendation = document.querySelector(
      ".chapter-hero__quickstart",
    );
    const choices = document.querySelector(".chapter-choices");
    const actionBox = actionNode.getBoundingClientRect();
    return {
      actionBottom: Math.round(actionBox.bottom),
      actionHeight: Math.round(actionBox.height),
      recommendationTop: Math.round(
        recommendation.getBoundingClientRect().top,
      ),
      choicesTop: Math.round(choices.getBoundingClientRect().top),
      viewportHeight: window.innerHeight,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.recommendationTop).toBeLessThan(geometry.choicesTop);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
});

test("a learner can navigate from the roadmap into class materials", async ({ page }) => {
  await page.goto("/#home");
  await expect(
    page.getByRole("heading", {
      name: "Choose a chapter by skill, then prove what you learned.",
    })
  ).toBeVisible();

  const firstChapter = page.locator(
    'nav[aria-label="Core Python Control Flow chapters"] a[href="#chapter/py01"]'
  );
  await expect(firstChapter).toHaveCount(1);
  await firstChapter.click();

  await expect(page).toHaveURL(/#chapter\/py01$/u);
  await expect(page.locator("#app-main")).toBeFocused();
  await expect(page.getByRole("heading", { name: "First Programs", level: 1 })).toBeVisible();

  const classLink = page.locator('a.choice-card[href="#chapter/py01/tutorials"]');
  await expect(classLink).toHaveCount(1);
  await classLink.click();

  await expect(page).toHaveURL(/#chapter\/py01\/tutorials$/u);
  await expect(page.locator("#app-main")).toBeFocused();
  await expect(
    page.locator(
      'nav[aria-label="Course chapter navigation"] a.class-page__chapter-link[aria-current="page"]'
    )
  ).toHaveAttribute(
    "data-chapter-id",
    "py01"
  );

  const visibleToc = page.locator('nav[aria-label="Class page contents"]:visible');
  const lessonPlan = visibleToc.locator(
    'button[data-scroll-target="class-py01-lesson-plan"]'
  );
  await expect(lessonPlan).toHaveCount(1);
  await lessonPlan.focus();
  await page.keyboard.press("Enter");
  await expect(lessonPlan).toHaveAttribute("aria-current", "location");
  await expect(page.locator("#class-py01-lesson-plan h2")).toBeFocused();
});

test("profile, theme, and Escape behavior remain keyboard friendly", async ({ page }) => {
  await page.goto("/#home");
  const profileButton = page.locator("#profile-button");
  const profilePanel = page.locator("#profile-panel");

  await profileButton.focus();
  await page.keyboard.press("Enter");
  await expect(profileButton).toHaveAttribute("aria-expanded", "true");
  await expect(profilePanel).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(profilePanel).toBeHidden();
  await expect(profileButton).toBeFocused();

  const themeToggle = page.locator("#theme-toggle");
  const initialLabel = await themeToggle.getAttribute("aria-label");
  await themeToggle.click();
  await expect(themeToggle).not.toHaveAttribute("aria-label", initialLabel || "");
  const selectedTheme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selectedTheme || "dark");
});

test("editor preferences and a local draft survive reload", async ({ page }) => {
  const exerciseId = "py01-first-programs";
  await page.goto(`/#exercise/${exerciseId}`);

  const mode = page.locator(`select[data-editor-mode="${exerciseId}"]`);
  const editorHost = page.locator(`[data-ace-host="${exerciseId}"]`);
  await expect(mode).toBeVisible();
  await expect(editorHost).toBeVisible();

  await mode.selectOption("vim");
  await expect(mode).toHaveValue("vim");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("fp-playground.editor-mode.v1")))
    .toBe("vim");

  await mode.selectOption("sublime");
  await editorHost.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type('print("browser draft")');

  const save = page.locator(`button[data-save-file="${exerciseId}"]`);
  await save.click();
  await expect(page.locator(`[data-editor-modified="${exerciseId}"]`)).toHaveAttribute(
    "aria-label",
    "Draft differs from starter code"
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const drafts = JSON.parse(localStorage.getItem("fp-playground.drafts.v2") || "{}");
        return drafts["py01-first-programs"];
      })
    )
    .toContain('print("browser draft")');

  await page.reload();
  await expect(editorHost).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const host = document.querySelector(`[data-ace-host="${id}"]`);
        return host && window.ace ? window.ace.edit(host).getValue() : "";
      }, exerciseId)
    )
    .toContain('print("browser draft")');
});

test("the exercise workspace separates learning, coding, and file actions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#exercise/py01-first-programs");

  const workbench = page.locator(".exercise-workbench");
  const lesson = page.locator(".exercise-workbench__lesson");
  const code = page.locator(".exercise-workbench__code");
  await expect(workbench).toBeVisible();
  await expect(lesson).toBeVisible();
  await expect(code).toBeVisible();
  await expect(page.locator('button[data-save-file="py01-first-programs"]')).toBeVisible();

  const desktopGeometry = await page.evaluate(() => {
    const lessonBox = document.querySelector(".exercise-workbench__lesson").getBoundingClientRect();
    const codeBox = document.querySelector(".exercise-workbench__code").getBoundingClientRect();
    const runBox = document.querySelector('button[data-run-scope="visible"]').getBoundingClientRect();
    const testsBox = document.querySelector('button[data-run-scope="all"]').getBoundingClientRect();
    return {
      lesson: { x: lessonBox.x, y: lessonBox.y, width: lessonBox.width, height: lessonBox.height },
      code: { x: codeBox.x, y: codeBox.y, width: codeBox.width, height: codeBox.height },
      runY: runBox.y,
      testsY: testsBox.y,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(desktopGeometry.code.x).toBeGreaterThan(
    desktopGeometry.lesson.x + desktopGeometry.lesson.width - 2
  );
  expect(Math.abs(desktopGeometry.code.y - desktopGeometry.lesson.y)).toBeLessThan(2);
  expect(Math.abs(desktopGeometry.runY - desktopGeometry.testsY)).toBeLessThan(2);
  expect(desktopGeometry.overflow).toBe(0);

  const fileMenu = page.locator(".ide-tools > summary");
  await fileMenu.click();
  await expect(page.locator('button[data-copy-code="py01-first-programs"]')).toBeVisible();
  await expect(page.locator('button[data-paste-code="py01-first-programs"]')).toBeVisible();
  await expect(page.locator('button[data-download-file="py01-first-programs"]')).toBeVisible();
  await expect(page.locator('button[data-reset-code="py01-first-programs"]')).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 900 });
  const tabletGeometry = await page.evaluate(() => {
    const lessonBox = document.querySelector(".exercise-workbench__lesson").getBoundingClientRect();
    const codeBox = document.querySelector(".exercise-workbench__code").getBoundingClientRect();
    return {
      lessonRight: lessonBox.x + lessonBox.width,
      codeLeft: codeBox.x,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(tabletGeometry.codeLeft).toBeGreaterThanOrEqual(tabletGeometry.lessonRight - 2);
  expect(tabletGeometry.overflow).toBe(0);

  await page.setViewportSize({ width: 800, height: 900 });
  const narrowGeometry = await page.evaluate(() => {
    const lessonBox = document.querySelector(".exercise-workbench__lesson").getBoundingClientRect();
    const codeBox = document.querySelector(".exercise-workbench__code").getBoundingClientRect();
    return {
      lessonBottom: lessonBox.y + lessonBox.height,
      codeTop: codeBox.y,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(narrowGeometry.codeTop).toBeGreaterThanOrEqual(narrowGeometry.lessonBottom - 2);
  expect(narrowGeometry.overflow).toBe(0);
});

test("a theory assessment deadline survives reload", async ({ page }) => {
  await page.goto("/#assessment/py01-py03/theory");
  const start = page.locator('button[data-assessment-start="theory"]');
  await expect(start).toHaveCount(1);
  await start.click();

  await expect(page.locator("[data-assessment-timer]")).toBeVisible();
  await expect(page.locator('[data-route-focus="assessment-question"]')).toBeFocused();
  await expect(page.locator('button[data-assessment-question][aria-current="step"]')).toHaveCount(1);

  const next = page.getByRole("button", { name: "Next →" });
  await next.click();
  await expect(page.locator('button[data-assessment-question="1"]')).toHaveAttribute(
    "aria-current",
    "step"
  );
  await expect(page.locator('[data-route-focus="assessment-question"]')).toBeFocused();
  const savedDeadline = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("fp-playground.assessments.v1") || "{}");
    return progress.blocks?.["py01-py03"]?.theory?.active?.deadlineAt || 0;
  });
  expect(savedDeadline).toBeGreaterThan(Date.now());

  await page.reload();
  await expect(page.locator("[data-assessment-timer]")).toBeVisible();
  await expect(start).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const progress = JSON.parse(localStorage.getItem("fp-playground.assessments.v1") || "{}");
        return progress.blocks?.["py01-py03"]?.theory?.active?.deadlineAt || 0;
      })
    )
    .toBe(savedDeadline);
});

test("an assessment revision retires stale drafts but preserves the saved score", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fp-playground.assessments.v1", JSON.stringify({
      version: 1,
      blocks: {
        "py10-py11": {
          theory: {
            active: {
              id: "legacy-v1-active",
              blockId: "py10-py11",
              mode: "theory",
              status: "active",
              revision: 1,
              startedAt: Date.now() - 60_000,
              deadlineAt: Date.now() + 600_000,
              updatedAt: Date.now(),
              currentQuestion: 10,
              answers: { "a4-theory-11": [0] },
            },
            history: [{
              id: "legacy-v1-pass",
              blockId: "py10-py11",
              mode: "theory",
              status: "submitted",
              revision: 1,
              startedAt: Date.now() - 180_000,
              deadlineAt: Date.now() - 60_000,
              updatedAt: Date.now() - 60_000,
              submittedAt: Date.now() - 60_000,
              score: 80,
              passed: true,
              results: [{
                questionId: "a4-theory-11",
                correct: true,
                selected: [0],
              }],
            }],
            bestScore: 80,
            completed: true,
          },
          practical: { active: null, history: [] },
        },
      },
    }));
  });

  await page.goto("/#assessment/py10-py11/theory");

  await expect(page.locator("[data-assessment-timer]")).toHaveCount(0);
  await expect(page.locator('button[data-assessment-start="theory"]')).toBeVisible();
  await expect(page.getByText("Best score · 80/100")).toBeVisible();
  await expect(page.getByText(
    "This score is retained from an earlier assessment revision. Its per-question review is hidden because the questions have since changed."
  )).toBeVisible();
  await expect(page.locator(".assessment-result-list")).toHaveCount(0);
});
