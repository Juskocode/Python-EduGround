import { expect, test } from "@playwright/test";

const EXERCISE_ID = "py01-first-programs";
const EXERCISE_ROUTE = `/#exercise/${EXERCISE_ID}`;
const LAYOUT_STORAGE_KEY = "fp-playground.ide-layout.v1";

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

async function openEditor(page, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto(EXERCISE_ROUTE);
  await expect(page.locator(`[data-ace-host="${EXERCISE_ID}"]`)).toBeVisible();
}

function paneResizer(page, dimension) {
  return page.locator(`[data-ide-pane-resizer="${dimension}"]`);
}

async function readDesktopGeometry(page) {
  return page.evaluate(() => {
    const workbench = document.querySelector(".exercise-workbench");
    const lesson = document.querySelector(".exercise-workbench__lesson");
    const code = document.querySelector(".exercise-workbench__code");
    const editor = document.querySelector(".ide-layout");
    const dock = document.querySelector(".ide-dock");
    const lessonBox = lesson.getBoundingClientRect();
    const codeBox = code.getBoundingClientRect();
    const editorBox = editor.getBoundingClientRect();
    const dockBox = dock.getBoundingClientRect();
    const workbenchBox = workbench.getBoundingClientRect();
    return {
      lessonWidth: lessonBox.width,
      codeWidth: codeBox.width,
      editorHeight: editorBox.height,
      dockHeight: dockBox.height,
      workbenchWidth: workbenchBox.width,
      lessonRight: lessonBox.right,
      codeLeft: codeBox.left,
      editorBottom: editorBox.bottom,
      dockTop: dockBox.top,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

test("desktop splitters expose complete separator semantics and preserve pane geometry", async ({
  page,
}) => {
  await openEditor(page);

  const lessonResizer = paneResizer(page, "lesson");
  const editorResizer = paneResizer(page, "editor");
  await expect(lessonResizer).toBeVisible();
  await expect(editorResizer).toBeVisible();

  await expect(lessonResizer).toHaveAttribute("role", "separator");
  await expect(lessonResizer).toHaveAttribute("aria-orientation", "vertical");
  await expect(lessonResizer).toHaveAttribute("aria-valuemin", "25");
  await expect(lessonResizer).toHaveAttribute("aria-valuemax", "60");
  await expect(lessonResizer).toHaveAttribute("aria-valuenow", "36");
  await expect(lessonResizer).toHaveAttribute(
    "aria-controls",
    `exercise-lesson-${EXERCISE_ID} exercise-code-${EXERCISE_ID}`
  );

  await expect(editorResizer).toHaveAttribute("role", "separator");
  await expect(editorResizer).toHaveAttribute("aria-orientation", "horizontal");
  await expect(editorResizer).toHaveAttribute("aria-valuemin", "40");
  await expect(editorResizer).toHaveAttribute("aria-valuemax", "70");
  await expect(editorResizer).toHaveAttribute("aria-valuenow", "55");
  await expect(editorResizer).toHaveAttribute(
    "aria-controls",
    `ide-editor-pane-${EXERCISE_ID} ide-feedback-pane-${EXERCISE_ID}`
  );

  const geometry = await readDesktopGeometry(page);
  expect(geometry.lessonWidth).toBeGreaterThan(300);
  expect(geometry.codeWidth).toBeGreaterThan(500);
  expect(geometry.codeLeft).toBeGreaterThanOrEqual(geometry.lessonRight);
  expect(geometry.dockTop).toBeGreaterThanOrEqual(geometry.editorBottom);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});

test("splitter keyboards resize, clamp, and reset both workspace axes", async ({
  page,
}) => {
  await openEditor(page);

  const lessonResizer = paneResizer(page, "lesson");
  const editorResizer = paneResizer(page, "editor");
  const initial = await readDesktopGeometry(page);

  await lessonResizer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(lessonResizer).toHaveAttribute("aria-valuenow", "38");
  const widerLesson = await readDesktopGeometry(page);
  expect(widerLesson.lessonWidth).toBeGreaterThan(initial.lessonWidth + 10);

  await page.keyboard.press("Home");
  await expect(lessonResizer).toHaveAttribute("aria-valuenow", "25");
  await page.keyboard.press("End");
  await expect(lessonResizer).toHaveAttribute("aria-valuenow", "60");

  const beforeEditorResize = await readDesktopGeometry(page);
  await editorResizer.focus();
  await page.keyboard.press("ArrowDown");
  await expect(editorResizer).toHaveAttribute("aria-valuenow", "57");
  const tallerEditor = await readDesktopGeometry(page);
  expect(tallerEditor.editorHeight).toBeGreaterThan(beforeEditorResize.editorHeight + 5);

  await page.keyboard.press("Home");
  await expect(editorResizer).toHaveAttribute("aria-valuenow", "40");
  await page.keyboard.press("End");
  await expect(editorResizer).toHaveAttribute("aria-valuenow", "70");

  await page.locator("[data-ide-layout-reset]").click();
  await expect(lessonResizer).toHaveAttribute("aria-valuenow", "36");
  await expect(editorResizer).toHaveAttribute("aria-valuenow", "55");
});

test("pointer dragging and double-click reset update both pane axes", async ({
  page,
}) => {
  await openEditor(page);

  const lessonResizer = paneResizer(page, "lesson");
  const workbench = page.locator(".exercise-workbench");
  const workbenchBox = await workbench.boundingBox();
  const resizerBox = await lessonResizer.boundingBox();
  expect(workbenchBox).not.toBeNull();
  expect(resizerBox).not.toBeNull();

  await page.mouse.move(
    resizerBox.x + resizerBox.width / 2,
    resizerBox.y + resizerBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    workbenchBox.x + workbenchBox.width * 0.48,
    resizerBox.y + resizerBox.height / 2,
    { steps: 6 }
  );
  await page.mouse.up();

  const draggedValue = Number(await lessonResizer.getAttribute("aria-valuenow"));
  expect(draggedValue).toBeGreaterThanOrEqual(46);
  expect(draggedValue).toBeLessThanOrEqual(50);

  await lessonResizer.dblclick();
  await expect(lessonResizer).toHaveAttribute("aria-valuenow", "36");

  const editorResizer = paneResizer(page, "editor");
  const stackBox = await page.locator(".ide-stack").boundingBox();
  const editorResizerBox = await editorResizer.boundingBox();
  expect(stackBox).not.toBeNull();
  expect(editorResizerBox).not.toBeNull();

  await page.mouse.move(
    editorResizerBox.x + editorResizerBox.width / 2,
    editorResizerBox.y + editorResizerBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    editorResizerBox.x + editorResizerBox.width / 2,
    stackBox.y + stackBox.height * 0.63,
    { steps: 6 }
  );
  await page.mouse.up();

  const editorValue = Number(await editorResizer.getAttribute("aria-valuenow"));
  expect(editorValue).toBeGreaterThanOrEqual(61);
  expect(editorValue).toBeLessThanOrEqual(65);
  await editorResizer.dblclick();
  await expect(editorResizer).toHaveAttribute("aria-valuenow", "55");
});

test("pane sizes persist across reload and the reset affordance persists defaults", async ({
  page,
}) => {
  await openEditor(page);

  const lessonResizer = paneResizer(page, "lesson");
  const editorResizer = paneResizer(page, "editor");
  await lessonResizer.focus();
  await page.keyboard.press("End");
  await editorResizer.focus();
  await page.keyboard.press("Home");

  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LAYOUT_STORAGE_KEY)
    )
    .toEqual({ lesson: 60, editor: 40 });

  await page.reload();
  await expect(page.locator(`[data-ace-host="${EXERCISE_ID}"]`)).toBeVisible();
  await expect(paneResizer(page, "lesson")).toHaveAttribute("aria-valuenow", "60");
  await expect(paneResizer(page, "editor")).toHaveAttribute("aria-valuenow", "40");

  await page.locator("[data-ide-layout-reset]").click();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LAYOUT_STORAGE_KEY)
    )
    .toEqual({ lesson: 36, editor: 55 });
});

test("focus mode keeps feedback resizing while mobile removes both splitters", async ({
  page,
}) => {
  await openEditor(page);

  const focusToggle = page.locator("[data-ide-focus]");
  await focusToggle.click();
  await expect(page.locator(".exercise-workbench__lesson")).toBeHidden();
  await expect(paneResizer(page, "lesson")).toBeHidden();
  await expect(paneResizer(page, "editor")).toBeVisible();

  const before = await readDesktopGeometry(page);
  await paneResizer(page, "editor").focus();
  await page.keyboard.press("ArrowDown");
  const after = await readDesktopGeometry(page);
  expect(after.editorHeight).toBeGreaterThan(before.editorHeight + 5);

  await page.keyboard.press("Escape");
  await expect(page.locator(".exercise-workbench__lesson")).toBeVisible();
  await expect(paneResizer(page, "lesson")).toBeVisible();

  await page.setViewportSize({ width: 820, height: 900 });
  await expect(paneResizer(page, "lesson")).toBeHidden();
  await expect(paneResizer(page, "editor")).toBeHidden();
  await expect(page.locator("[data-ide-layout-reset]")).toBeHidden();

  const mobileGeometry = await page.evaluate(() => ({
    lessonWidth: document
      .querySelector(".exercise-workbench__lesson")
      .getBoundingClientRect().width,
    codeWidth: document
      .querySelector(".exercise-workbench__code")
      .getBoundingClientRect().width,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(Math.abs(mobileGeometry.lessonWidth - mobileGeometry.codeWidth)).toBeLessThan(2);
  expect(mobileGeometry.scrollWidth).toBeLessThanOrEqual(mobileGeometry.viewportWidth + 1);
});
