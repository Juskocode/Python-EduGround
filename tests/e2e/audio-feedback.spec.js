import { expect, test } from "@playwright/test";

const CLASS_ROUTE = "/#chapter/py01/tutorials";
const CLASS_TASK_ID = "py01-int-conversion";
const EXERCISE_ID = "py01-first-programs";
const EXERCISE_ROUTE = `/#exercise/${EXERCISE_ID}`;

let unexpectedBrowserErrors;

async function installAudioSpyAndPythonWorker(page) {
  await page.addInitScript(({ passedExerciseId }) => {
    window.__audioFeedbackCalls = [];
    window.__audioWorkerMessages = [];

    let wrappedAudio = null;
    Object.defineProperty(window, "APP_AUDIO", {
      configurable: true,
      get() {
        return wrappedAudio;
      },
      set(audioApi) {
        const wrapper = {};
        Object.keys(audioApi || {}).forEach((name) => {
          const member = audioApi[name];
          wrapper[name] = typeof member === "function"
            ? function (...args) {
                if (name.startsWith("play")) {
                  window.__audioFeedbackCalls.push(name);
                }
                return member.apply(audioApi, args);
              }
            : member;
        });
        wrappedAudio = Object.freeze(wrapper);
      },
    });

    // Avoid unrelated first-pass achievement cues while exercising Run tests.
    window.localStorage.setItem(
      "fp-playground.passed.v2",
      JSON.stringify([passedExerciseId])
    );

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
        window.__audioWorkerMessages.push(payload);
        const results = (payload.tests || []).map((testCase) => {
          const expectedOutput = String(testCase.expectedOutput || "");
          const expected = Object.hasOwn(testCase, "expected")
            ? String(testCase.expected)
            : JSON.stringify(expectedOutput);
          return {
            id: testCase.id || "mock-test",
            name: testCase.name || "Mock test",
            hidden: Boolean(testCase.hidden),
            passed: true,
            expected,
            actual: expected,
            stdout: expectedOutput,
            stderr: "",
            traceback: "",
          };
        });

        queueMicrotask(() => {
          this.emit("message", {
            data: {
              type: "result",
              id: payload.id,
              results,
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
  }, { passedExerciseId: EXERCISE_ID });
}

async function resetAudioCalls(page) {
  await page.evaluate(() => {
    window.__audioFeedbackCalls.length = 0;
  });
}

async function expectAudioCalls(page, expected) {
  await expect
    .poll(() => page.evaluate(() => window.__audioFeedbackCalls.slice()))
    .toEqual(expected);

  // Catch delayed generic clicks or an accidental second reward cue.
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__audioFeedbackCalls.slice())).toEqual(
    expected
  );
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
  await installAudioSpyAndPythonWorker(page);
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("classroom Run and Check task use one semantic cue pair each", async ({
  page,
}) => {
  await page.goto(CLASS_ROUTE);
  const lab = page.locator(
    `[data-class-lab="${CLASS_TASK_ID}"][data-class-chapter="py01"]`
  );
  const run = lab.locator('button[data-class-lab-run-mode="run"]');
  const check = lab.locator('button[data-class-lab-run-mode="check"]');
  const editor = lab.locator("textarea[data-class-lab-code]");
  const status = lab.locator("[data-class-lab-status]");

  await expect(lab).toBeVisible();
  await resetAudioCalls(page);
  await run.click();
  await expect(status).toContainText("did not change task progress");
  await expectAudioCalls(page, ["playRun", "playRunComplete"]);

  await editor.fill([
    "raw_badge_count = input()",
    "badge_count = int(raw_badge_count)",
    "print(badge_count + 2)",
  ].join("\n"));
  await resetAudioCalls(page);
  await check.click();
  await expect(status).toContainText(
    "converted count supports numeric addition"
  );
  await expectAudioCalls(page, ["playCheck", "playTaskComplete"]);
});

test("exercise controls distinguish visible Run from the full test suite", async ({
  page,
}) => {
  await page.goto(EXERCISE_ROUTE);
  const editor = page.locator(`[data-ace-host="${EXERCISE_ID}"]`);
  const results = page.locator(`[data-test-results="${EXERCISE_ID}"]`);

  await expect(editor).toBeVisible();
  await editor.click();

  await resetAudioCalls(page);
  await page.keyboard.press("Shift+Enter");
  await expect(results.locator(".results-summary")).toContainText(
    "All visible examples passed"
  );
  await expect(results.locator(".results-summary__count")).toHaveText("2 / 2");
  await expectAudioCalls(page, ["playRun", "playRunComplete"]);

  await resetAudioCalls(page);
  await page.locator(
    `button[data-run-exercise="${EXERCISE_ID}"][data-run-scope="all"]`
  ).click();
  await expect(results.locator(".results-summary")).toContainText(
    "All tests passed"
  );
  await expect(results.locator(".results-summary__count")).toHaveText("3 / 3");
  await expectAudioCalls(page, ["playRunAll", "playTestComplete"]);

  const workerScopes = await page.evaluate(() =>
    window.__audioWorkerMessages.map((message) =>
      message.tests.map((testCase) => Boolean(testCase.hidden))
    )
  );
  expect(workerScopes).toEqual([
    [false, false],
    [false, false, true],
  ]);
});
