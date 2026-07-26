import { expect, test } from "@playwright/test";

const ROUTE = "/#chapter/py00/tutorials";
const LEARNING_STORAGE = "fp-playground.learning.v1";
const PASSED_STORAGE = "fp-playground.passed.v2";

let unexpectedBrowserErrors;

async function installMockPythonWorker(page) {
  await page.addInitScript(() => {
    class MockPythonWorker {
      constructor() {
        this.listeners = new Map();
        queueMicrotask(() => {
          this.emit("message", { data: { type: "ready" } });
        });
      }

      addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type, listener) {
        const listeners = this.listeners.get(type);
        if (listeners) {
          listeners.delete(listener);
        }
      }

      postMessage(payload) {
        const testCase = Array.isArray(payload.tests) ? payload.tests[0] || {} : {};
        let stdout = `${String(testCase.expectedOutput || "")}\n`;
        if (payload.code.includes("My Python journey starts here.")) {
          stdout = "My Python journey starts here.\n";
        } else if (payload.code.includes("My Python journey starts now.")) {
          stdout = "My Python journey starts now.\n";
        }
        queueMicrotask(() => {
          this.emit("message", {
            data: {
              type: "result",
              id: payload.id,
              results: [{
                id: testCase.id || "chapter-zero-run",
                name: testCase.name || "Chapter 0 run",
                hidden: false,
                passed: true,
                expected: JSON.stringify(String(testCase.expectedOutput || "")),
                actual: JSON.stringify(stdout),
                stdout,
                stderr: "",
                traceback: "",
              }],
            },
          });
        });
      }

      terminate() {}

      emit(type, event) {
        const listeners = this.listeners.get(type);
        if (listeners) {
          listeners.forEach((listener) => listener(event));
        }
      }
    }

    window.Worker = MockPythonWorker;
  });
}

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
  await installMockPythonWorker(page);
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("a new learner enters the ungraded launch room before Chapter 1", async ({
  page,
}) => {
  await page.goto("/#welcome");

  const primary = page.getByRole("link", { name: "Set up and run Python" });
  await expect(primary).toHaveAttribute("href", "#chapter/py00/tutorials");
  await expect(page.locator(".landing-onboarding-cue")).toContainText(
    "New here? Begin with Chapter 0",
  );
  await expect(page.locator(".landing-hero__metrics")).toContainText("13");

  await primary.click();
  await expect(page).toHaveURL(/#chapter\/py00\/tutorials$/u);
  await expect(
    page.getByRole("heading", { name: "Launch Python", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".class-page--onboarding")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ask the chapter tutor", level: 2 }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Continue to Chapter 1 · First Programs",
      level: 2,
    }),
  ).toBeVisible();

  const curriculumTotals = await page.evaluate(() => ({
    chapters: window.COURSE_DATA.chapters.length,
    exercises: window.COURSE_DATA.chapters.reduce(
      (total, chapter) => total + chapter.exercises.length,
      0,
    ),
  }));
  expect(curriculumTotals).toEqual({ chapters: 13, exercises: 110 });

  await page.goto("/#home");
  const launchCard = page.locator(".home-onboarding");
  await expect(launchCard).toContainText("Before Chapter 1");
  await expect(
    launchCard.getByRole("link", { name: "Start Chapter 0" }),
  ).toHaveAttribute("href", "#chapter/py00/tutorials");
});

test("an existing exercise draft keeps priority over the Chapter 0 invitation", async ({
  page,
}) => {
  await page.goto("/#welcome");
  await page.evaluate(() => {
    localStorage.setItem(
      "fp-playground.last-exercise.v2",
      "py01-first-programs",
    );
    localStorage.setItem(
      "fp-playground.drafts.v2",
      JSON.stringify({ "py01-first-programs": "print('draft')" }),
    );
  });
  await page.reload();

  await expect(
    page.getByRole("link", { name: "Resume exercise" }),
  ).toHaveAttribute("href", "#exercise/py01-first-programs");
  await expect(page.locator(".landing-onboarding-cue")).toHaveCount(0);
});

test("answers, editable code, keyboard runs, and completion survive reload", async ({
  page,
}) => {
  await page.goto(ROUTE);

  const setupTask = page.locator(
    '[data-class-task="py00-browser-or-local"][data-class-chapter="py00"]',
  );
  await setupTask.locator("input[data-class-answer]").fill("browser");
  await setupTask.getByRole("button", { name: "Check answer" }).click();
  await expect(setupTask.locator("[data-class-feedback]")).toContainText(
    "Browser Python is enough to begin",
  );

  const codeTask = page.locator(
    '[data-class-task="py00-first-signal"][data-class-chapter="py00"]',
  );
  const editor = codeTask.locator("textarea[data-class-lab-code]");
  await editor.fill(
    'message = "My Python journey starts now."\nprint(message)',
  );
  await editor.press("Shift+Enter");
  await expect(codeTask.locator("[data-class-lab-output]")).toContainText(
    "My Python journey starts now.",
  );
  await expect(codeTask.locator("[data-class-lab-status]")).toContainText(
    "did not change task progress",
  );
  await codeTask.getByRole("button", { name: "Check task" }).click();
  await expect(codeTask.locator("[data-class-lab-status]")).toContainText(
    "You changed source, ran the program",
  );

  const saved = await page.evaluate((storageKey) => {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  }, LEARNING_STORAGE);
  expect(saved.py00).toEqual(
    expect.arrayContaining([
      "room:py00-browser-or-local",
      "room:py00-first-signal",
    ]),
  );
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), PASSED_STORAGE),
  ).toBeNull();

  await page.reload();
  await expect(setupTask.locator("[data-class-task-status]")).toHaveText(
    "Completed ✓",
  );
  await expect(editor).toHaveValue(
    'message = "My Python journey starts now."\nprint(message)',
  );
});

test("finishing the setup tasks unlocks a direct Chapter 1 handoff", async ({
  page,
}) => {
  await page.goto(ROUTE);
  await page.evaluate((storageKey) => {
    const taskIds = window.ONBOARDING_CONTENT.material.roomTasks.map(
      (task) => `room:${task.id}`,
    );
    localStorage.setItem(storageKey, JSON.stringify({ py00: taskIds }));
  }, LEARNING_STORAGE);
  await page.reload();

  const startAction = page.locator('[data-class-start-action="py00"]');
  await expect(startAction).toHaveText("Start Chapter 1");
  await expect(startAction).toHaveAttribute(
    "data-route-target",
    "#chapter/py01/tutorials",
  );
  await startAction.click();
  await expect(page).toHaveURL(/#chapter\/py01\/tutorials$/u);
  await expect(
    page.getByRole("heading", { name: "First Programs", level: 1 }),
  ).toBeVisible();
});

test("Chapter 0 remains readable and tappable on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ROUTE);

  const startAction = page.locator('[data-class-start-action="py00"]');
  await expect(startAction).toBeVisible();
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    actionHeight: document
      .querySelector('[data-class-start-action="py00"]')
      .getBoundingClientRect().height,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(44);
});
