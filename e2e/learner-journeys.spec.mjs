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

test("a learner can navigate from the roadmap into class materials", async ({ page }) => {
  await page.goto("/#home");
  await expect(
    page.getByRole("heading", {
      name: "Learn in stages, prove it at each checkpoint.",
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
