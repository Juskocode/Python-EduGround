import { expect, test } from "@playwright/test";

const EXERCISE_ID = "py01-first-programs";
const EXERCISE_ROUTE = `/#exercise/${EXERCISE_ID}`;

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

async function openEditor(page) {
  await page.goto(EXERCISE_ROUTE);
  await expect(page.locator(`[data-ace-host="${EXERCISE_ID}"]`)).toBeVisible();
}

function ideTab(page, name) {
  return page.locator(`[data-ide-tab="${name}"]`);
}

function idePanel(page, name) {
  return page.locator(`[data-ide-panel="${name}"]`);
}

async function expectSelectedTab(page, name) {
  await expect(ideTab(page, name)).toHaveAttribute("aria-selected", "true");
  await expect(idePanel(page, name)).toBeVisible();

  for (const otherName of ["tests", "results", "history"].filter(
    (candidate) => candidate !== name
  )) {
    await expect(ideTab(page, otherName)).toHaveAttribute("aria-selected", "false");
    await expect(idePanel(page, otherName)).toBeHidden();
  }
}

test("the full-width editor places test cases in an accessible bottom dock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);

  const tablist = page.locator(
    '[role="tablist"]:has([data-ide-tab="tests"]):has([data-ide-tab="results"]):has([data-ide-tab="history"])'
  );
  const editor = page.locator(".ide-editor-shell");
  const layout = page.locator(".ide-layout");
  const testsPanel = idePanel(page, "tests");

  await expect(tablist).toHaveCount(1);
  await expect(tablist.locator("[data-ide-tab]")).toHaveCount(3);
  await expectSelectedTab(page, "tests");

  for (const name of ["tests", "results", "history"]) {
    const tab = ideTab(page, name);
    const panel = idePanel(page, name);
    const tabId = await tab.getAttribute("id");
    const panelId = await panel.getAttribute("id");

    await expect(tab).toHaveAttribute("role", "tab");
    await expect(tab).toHaveAttribute("aria-controls", panelId || "__missing-panel-id__");
    await expect(panel).toHaveAttribute("role", "tabpanel");
    await expect(panel).toHaveAttribute("aria-labelledby", tabId || "__missing-tab-id__");
  }

  const geometry = await page.evaluate(() => {
    const editorBox = document.querySelector(".ide-editor-shell").getBoundingClientRect();
    const layoutBox = document.querySelector(".ide-layout").getBoundingClientRect();
    const testsBox = document
      .querySelector('[data-ide-panel="tests"]')
      .getBoundingClientRect();

    return {
      editorWidth: editorBox.width,
      layoutWidth: layoutBox.width,
      editorBottom: editorBox.bottom,
      dockTop: testsBox.top,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(geometry.editorWidth / geometry.layoutWidth).toBeGreaterThan(0.9);
  expect(geometry.dockTop).toBeGreaterThanOrEqual(geometry.editorBottom - 2);
  expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  await expect(editor).toBeVisible();
  await expect(layout).toBeVisible();
  await expect(testsPanel.getByText(/Choose one case/iu)).toBeVisible();
});

test("the case picker shows one contract at a time and keeps hidden data masked", async ({
  page,
}) => {
  await openEditor(page);

  const caseTabs = page.locator("button[data-test-case]");
  const casePanels = page.locator("[data-test-case-panel]");
  const firstCase = page.locator('button[data-test-case="0"]');
  const firstPanel = page.locator('[data-test-case-panel="0"]');
  const secondCase = page.locator('button[data-test-case="1"]');
  const secondPanel = page.locator('[data-test-case-panel="1"]');
  await expect(caseTabs).toHaveCount(3);
  await expect(casePanels).toHaveCount(3);
  await expect(firstCase).toHaveAttribute("aria-selected", "true");
  await expect(firstPanel).toBeVisible();
  await expect(secondPanel).toBeHidden();

  await secondCase.click();
  await expect(secondCase).toHaveAttribute("aria-selected", "true");
  await expect(secondPanel).toBeVisible();
  await expect(firstPanel).toBeHidden();

  const hiddenCase = page.locator("button[data-test-case].is-locked");
  await hiddenCase.click();
  const hiddenPanel = page.locator("[data-test-case-panel].is-hidden");
  await expect(hiddenCase).toHaveAttribute("aria-selected", "true");
  await expect(hiddenPanel).toBeVisible();
  await expect(hiddenPanel).toContainText("Locked case");
  await expect(hiddenPanel.locator(".test-plan-datum")).toHaveCount(0);

  await hiddenCase.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(secondCase).toBeFocused();
  await expect(secondCase).toHaveAttribute("aria-selected", "true");
});

test("dock tabs support arrow-key navigation and history remains selectable", async ({
  page,
}) => {
  await openEditor(page);

  const testsTab = ideTab(page, "tests");
  const resultsTab = ideTab(page, "results");
  const historyTab = ideTab(page, "history");

  await testsTab.focus();
  await expect(testsTab).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(resultsTab).toBeFocused();
  await expectSelectedTab(page, "results");

  await page.keyboard.press("ArrowRight");
  await expect(historyTab).toBeFocused();
  await expectSelectedTab(page, "history");
  await expect(idePanel(page, "history").getByText("Run history", { exact: true })).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(resultsTab).toBeFocused();
  await expectSelectedTab(page, "results");

  await historyTab.click();
  await expectSelectedTab(page, "history");
});

test("running code automatically opens the Results dock tab", async ({ page }) => {
  await openEditor(page);
  await expectSelectedTab(page, "tests");

  await page.locator('button[data-run-scope="visible"]').click();

  await expectSelectedTab(page, "results");
  await expect(idePanel(page, "results")).toHaveAttribute("aria-live", /polite|assertive/u);
});

test("focus mode hides the lesson and Escape restores the learning context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);

  const focusToggle = page.locator("[data-ide-focus]");
  const lesson = page.locator(".exercise-workbench__lesson");
  const codeWorkspace = page.locator(".exercise-workbench__code");

  await expect(focusToggle).toHaveAttribute("aria-pressed", "false");
  await expect(lesson).toBeVisible();
  await focusToggle.click();

  await expect(focusToggle).toHaveAttribute("aria-pressed", "true");
  await expect(lesson).toBeHidden();
  await expect(codeWorkspace).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(focusToggle).toHaveAttribute("aria-pressed", "false");
  await expect(lesson).toBeVisible();
  await expect(focusToggle).toBeFocused();
});

test("the bottom dock remains usable without page overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);

  const tablist = page.locator(
    '[role="tablist"]:has([data-ide-tab="tests"]):has([data-ide-tab="results"]):has([data-ide-tab="history"])'
  );
  await expect(tablist).toBeVisible();
  await expectSelectedTab(page, "tests");

  for (const name of ["results", "history", "tests"]) {
    await ideTab(page, name).click();
    await expectSelectedTab(page, name);
  }

  const mobileGeometry = await page.evaluate(() => {
    const tablistBox = document
      .querySelector('[role="tablist"]:has([data-ide-tab="tests"])')
      .getBoundingClientRect();

    return {
      tablistLeft: tablistBox.left,
      tablistRight: tablistBox.right,
      tablistWidth: tablistBox.width,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(mobileGeometry.tablistWidth).toBeGreaterThan(0);
  expect(mobileGeometry.tablistLeft).toBeGreaterThanOrEqual(0);
  expect(mobileGeometry.tablistRight).toBeLessThanOrEqual(
    mobileGeometry.viewportWidth + 1
  );
  expect(mobileGeometry.pageScrollWidth).toBeLessThanOrEqual(
    mobileGeometry.viewportWidth + 1
  );
});
