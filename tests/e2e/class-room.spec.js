import { expect, test } from "@playwright/test";

const CLASS_ROUTE = "/#chapter/py01/tutorials";
const INPUT_TYPE_TASK = "py01-input-returns-str";
const LECTURE_LAB = "lecture-demo";
const CLASS_LAB_STORAGE = "fp-playground.class-labs.v1";
const LEARNING_STORAGE = "fp-playground.learning.v1";

let unexpectedBrowserErrors;

async function installMockPythonWorker(page) {
  await page.addInitScript(() => {
    window.__classRoomWorkerMessages = [];

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
        window.__classRoomWorkerMessages.push(payload);
        const testCase = Array.isArray(payload.tests) ? payload.tests[0] || {} : {};
        const stdout = payload.code.includes("print-before-error")
          ? "printed first\n"
          : payload.code.includes("shortcut-output")
          ? "shortcut-output\n"
          : `${String(testCase.expectedOutput || "")}\n`;
        const traceback = payload.code.includes("print-before-error")
          ? "Traceback (most recent call last):\nValueError: classroom failure"
          : "";
        const expected = String(testCase.expectedOutput || "");
        const respond = () => {
          this.emit("message", {
            data: {
              type: "result",
              id: payload.id,
              results: [{
                id: testCase.id || "classroom-test",
                name: testCase.name || "Classroom run",
                hidden: false,
                passed: !traceback &&
                  stdout.replace(/\n+$/u, "") === expected.replace(/\n+$/u, ""),
                expected: JSON.stringify(expected),
                actual: JSON.stringify(stdout),
                stdout,
                stderr: "",
                traceback,
              }],
            },
          });
        };
        if (payload.code.includes("slow-run")) {
          setTimeout(respond, 300);
        } else {
          queueMicrotask(respond);
        }
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

async function openClassRoom(page) {
  await page.goto(CLASS_ROUTE);
  await expect(
    page.getByRole("heading", { name: "First Programs", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Guided room tasks", level: 2 }),
  ).toBeVisible();
}

function roomTask(page, taskId) {
  return page.locator(
    `[data-class-task="${taskId}"][data-class-chapter="py01"]`,
  );
}

function classLab(page, labId) {
  return page.locator(
    `[data-class-lab="${labId}"][data-class-chapter="py01"]`,
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
  await installMockPythonWorker(page);
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("the first class reads as a beginner room and keeps answer keys out of its controls", async ({
  page,
}) => {
  await openClassRoom(page);

  await expect(
    page.getByText(
      "Complete beginners who may be using a code editor, terminal, and programming language for the very first time.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The editor is where you write Python instructions, Run asks Python to follow them, and the terminal shows what the program prints or why it stopped.",
      { exact: true },
    ),
  ).toBeVisible();

  const room = page.locator("#class-py01-room-tasks");
  const tasks = room.locator("[data-class-task]");
  await expect(tasks).toHaveCount(5);
  for (const taskId of [
    "py01-computer-basics",
    INPUT_TYPE_TASK,
    "py01-int-conversion",
    "py01-float-conversion",
    "py01-conversion-failure",
  ]) {
    await expect(roomTask(page, taskId)).toHaveCount(1);
  }

  const answerInput = page.locator(
    `input[data-class-answer="${INPUT_TYPE_TASK}"]`,
  );
  const answerInputId = await answerInput.getAttribute("id");
  await expect(
    page.locator(`label[for="${answerInputId}"]`),
  ).toContainText("what Python type name");
  await expect(
    page.locator(`[data-class-feedback="${INPUT_TYPE_TASK}"]`),
  ).toHaveAttribute("role", "status");
  await expect(
    page.locator(`[data-class-feedback="${INPUT_TYPE_TASK}"]`),
  ).toHaveAttribute("aria-live", "polite");

  const lab = classLab(page, LECTURE_LAB);
  const editor = lab.locator("textarea[data-class-lab-code]");
  const stdin = lab.locator("textarea[data-class-lab-stdin]");
  const editorId = await editor.getAttribute("id");
  const stdinId = await stdin.getAttribute("id");
  await expect(lab.locator(`label[for="${editorId}"]`)).toHaveText("Python editor");
  await expect(lab.locator(`label[for="${stdinId}"]`)).toContainText("Program input");
  await expect(lab.locator("button[data-class-lab-run]")).toHaveAttribute(
    "aria-keyshortcuts",
    "Shift+Enter",
  );
  await expect(lab.locator("[data-class-lab-status]")).toHaveAttribute(
    "role",
    "status",
  );
  await expect(lab.locator("[data-class-lab-status]")).toHaveAttribute(
    "aria-live",
    "polite",
  );

  await expect(room.locator("[data-answer-index]")).toHaveCount(0);
  await expect(room.locator("[data-accepted-answer]")).toHaveCount(0);
  await expect(page.locator("[data-answer-index]")).toHaveCount(0);
  await expect(page.locator("[data-checkpoint-explanation]")).toHaveCount(0);
  const roomMarkup = await room.evaluate((node) => node.outerHTML);
  expect(roomMarkup).not.toContain("acceptedAnswers");
  expect(roomMarkup).not.toContain("data-answer-index");
});

test("wrong feedback does not complete a task, while a trimmed correct answer persists", async ({
  page,
}) => {
  await openClassRoom(page);

  const task = roomTask(page, INPUT_TYPE_TASK);
  const input = page.locator(`input[data-class-answer="${INPUT_TYPE_TASK}"]`);
  const feedback = page.locator(`[data-class-feedback="${INPUT_TYPE_TASK}"]`);
  const progress = page.locator('[data-class-room-progress="py01"]');

  await expect(progress.locator("strong")).toHaveText("0 / 5 room tasks complete");
  await input.fill("int");
  await page.locator(`button[data-class-room-check="${INPUT_TYPE_TASK}"]`).click();

  await expect(feedback).toHaveClass(/is-incorrect/u);
  await expect(feedback).toContainText("Not yet.");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(task).not.toHaveClass(/is-complete/u);
  await expect(
    task.locator(`[data-class-task-status="${INPUT_TYPE_TASK}"]`),
  ).toHaveText("Ready");
  await expect(progress.locator("strong")).toHaveText("0 / 5 room tasks complete");
  expect(
    await page.evaluate(
      ({ key, item }) => {
        const stored = JSON.parse(localStorage.getItem(key) || "{}");
        return Array.isArray(stored.py01) && stored.py01.includes(item);
      },
      { key: LEARNING_STORAGE, item: `room:${INPUT_TYPE_TASK}` },
    ),
  ).toBe(false);

  await input.fill("  str  ");
  await input.press("Enter");

  await expect(feedback).toHaveClass(/is-correct/u);
  await expect(feedback).toContainText("typed characters remain a textual value");
  await expect(input).not.toHaveAttribute("aria-invalid");
  await expect(task).toHaveClass(/is-complete/u);
  await expect(
    task.locator(`[data-class-task-status="${INPUT_TYPE_TASK}"]`),
  ).toHaveText("Completed ✓");
  await expect(progress.locator("strong")).toHaveText("1 / 5 room tasks complete");
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, item }) => {
          const stored = JSON.parse(localStorage.getItem(key) || "{}");
          return Array.isArray(stored.py01) && stored.py01.includes(item);
        },
        { key: LEARNING_STORAGE, item: `room:${INPUT_TYPE_TASK}` },
      )
    )
    .toBe(true);

  await page.reload();
  await expect(roomTask(page, INPUT_TYPE_TASK)).toHaveClass(/is-complete/u);
  await expect(
    roomTask(page, INPUT_TYPE_TASK).locator(
      `[data-class-task-status="${INPUT_TYPE_TASK}"]`,
    ),
  ).toHaveText("Completed ✓");
  await expect(
    page.locator('[data-class-room-progress="py01"] strong'),
  ).toHaveText("1 / 5 room tasks complete");
  await expect(
    page.locator(`[data-class-feedback="${INPUT_TYPE_TASK}"]`),
  ).toContainText("typed characters remain a textual value");
});

test("classroom code and program input are editable and Reset restores the starter", async ({
  page,
}) => {
  await openClassRoom(page);

  const lab = classLab(page, LECTURE_LAB);
  const editor = lab.locator("textarea[data-class-lab-code]");
  const stdin = lab.locator("textarea[data-class-lab-stdin]");
  const initialCode = await editor.inputValue();
  const initialInput = await stdin.inputValue();

  await editor.fill('print("changed classroom code")');
  await stdin.fill("changed input");
  await expect(editor).toHaveValue('print("changed classroom code")');
  await expect(stdin).toHaveValue("changed input");
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const stored = JSON.parse(localStorage.getItem(key) || "{}");
        return stored["py01/lecture-demo"] || null;
      }, CLASS_LAB_STORAGE)
    )
    .toEqual({
      code: 'print("changed classroom code")',
      stdin: "changed input",
    });

  await lab.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(editor).toHaveValue(initialCode);
  await expect(stdin).toHaveValue(initialInput);
  await expect(editor).toBeFocused();
  await expect(lab.locator("[data-class-lab-output]")).toHaveText(
    "Run the code to see its output here.",
  );
  await expect(lab.locator("[data-class-lab-status]")).toContainText(
    "Reset to the classroom starter",
  );
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const stored = JSON.parse(localStorage.getItem(key) || "{}");
        return Object.hasOwn(stored, "py01/lecture-demo");
      }, CLASS_LAB_STORAGE)
    )
    .toBe(false);
});

test("Shift+Enter dispatches the classroom program and displays terminal stdout", async ({
  page,
}) => {
  await openClassRoom(page);

  const lab = classLab(page, "py01-int-conversion");
  const editor = lab.locator("textarea[data-class-lab-code]");
  const stdin = lab.locator("textarea[data-class-lab-stdin]");
  const terminal = lab.locator("[data-class-lab-output]");

  await editor.fill('print("shortcut-output")');
  await stdin.fill("keyboard-input");
  await editor.press("Shift+Enter");

  await expect(terminal).toHaveText("shortcut-output");
  await expect(editor).toHaveValue('print("shortcut-output")');
  await expect(lab.locator("[data-class-lab-status]")).toContainText(
    "experiment, so it did not change task progress",
  );
  await expect(lab).not.toHaveAttribute("aria-busy");
  await expect(
    lab.locator('button[data-class-lab-run-mode="run"]'),
  ).toBeEnabled();
  await expect(editor).toBeFocused();
  await expect(lab.locator("[data-class-lab-terminal-context]")).toHaveText(
    'Run input: "keyboard-input"',
  );

  const messages = await page.evaluate(() => window.__classRoomWorkerMessages);
  expect(messages).toHaveLength(1);
  expect(messages[0].code).toBe('print("shortcut-output")');
  expect(messages[0].mode).toBe("script");
  expect(messages[0].tests[0].input).toEqual(["keyboard-input"]);
  expect(messages[0].tests[0].echoInputPrompts).toBe(true);
});

test("lesson-note examples use the same editable runner and retain sample input", async ({
  page,
}) => {
  await openClassRoom(page);

  const lessonLab = classLab(
    page,
    "lesson-tutorial-understand-the-input-boundary",
  );
  const editor = lessonLab.locator("textarea[data-class-lab-code]");
  const stdin = lessonLab.locator("textarea[data-class-lab-stdin]");

  await expect(lessonLab).toHaveCount(1);
  await expect(stdin).toHaveValue("3\n1.5");
  await editor.fill('print("shortcut-output")');
  await editor.press("Shift+Enter");
  await expect(lessonLab.locator("[data-class-lab-output]")).toHaveText(
    "shortcut-output",
  );
  await expect(lessonLab.locator("[data-class-lab-status]")).toContainText(
    "change the code or sample input",
  );
  await expect(
    lessonLab.getByRole("button", { name: "Check task", exact: true }),
  ).toHaveCount(0);
});

test("Run supports experiments while Check task enforces technique and locks pending inputs", async ({
  page,
}) => {
  await openClassRoom(page);

  const task = roomTask(page, "py01-int-conversion");
  const lab = task.locator("[data-class-lab='py01-int-conversion']");
  const editor = lab.locator("textarea[data-class-lab-code]");
  const stdin = lab.locator("textarea[data-class-lab-stdin]");
  const run = lab.getByRole("button", { name: "Run code", exact: true });
  const check = lab.getByRole("button", { name: "Check task", exact: true });

  await editor.fill("print(99)");
  await stdin.fill("custom experiment");
  await run.click();
  await expect(lab.locator("[data-class-lab-status]")).toContainText(
    "did not change task progress",
  );
  await expect(task).not.toHaveClass(/is-complete/u);

  await editor.fill("print(7)");
  await check.click();
  await expect(lab.locator("[data-class-lab-status]")).toContainText(
    "taught Python idea is still missing",
  );
  await expect(task).not.toHaveClass(/is-complete/u);

  await editor.fill([
    "raw_badge_count = input()",
    "badge_count = int(raw_badge_count)",
    "print(badge_count + 2)",
    "# slow-run",
  ].join("\n"));
  await stdin.fill("999");
  await check.click();
  await expect(lab).toHaveAttribute("aria-busy", "true");
  await expect(editor).toBeDisabled();
  await expect(stdin).toBeDisabled();
  await expect(lab.locator("[data-class-lab-status]")).toContainText(
    "converted count supports numeric addition",
  );
  await expect(editor).toBeEnabled();
  await expect(stdin).toBeEnabled();
  await expect(task).toHaveClass(/is-complete/u);
  await expect(lab.locator("[data-class-lab-terminal-context]")).toHaveText(
    'Checked input: "5"',
  );

  const messages = await page.evaluate(() => window.__classRoomWorkerMessages);
  expect(messages).toHaveLength(3);
  expect(messages[0].tests[0].input).toEqual(["custom experiment"]);
  expect(messages[1].tests[0].input).toEqual(["5"]);
  expect(messages[2].tests[0].input).toEqual(["5"]);
});

test("answer checks collapse accidental internal whitespace", async ({ page }) => {
  await openClassRoom(page);

  const task = roomTask(page, "py01-computer-basics");
  const input = task.locator("input[data-class-answer]");
  await input.fill("  code     editor  ");
  await input.press("Enter");

  await expect(task).toHaveClass(/is-complete/u);
  await expect(input).not.toHaveAttribute("aria-invalid");
  await expect(task.locator("[data-class-feedback]")).toContainText(
    "distinguish the place where code is written",
  );
});

test("the terminal keeps output printed before a full traceback", async ({ page }) => {
  await openClassRoom(page);

  const lab = classLab(page, LECTURE_LAB);
  const editor = lab.locator("textarea[data-class-lab-code]");
  await editor.fill('print("print-before-error")\nraise ValueError("classroom failure")');
  await lab.getByRole("button", { name: "Run code", exact: true }).click();

  await expect(lab.locator("[data-class-lab-output]")).toContainText(
    "Output before the error:\nprinted first",
  );
  await expect(lab.locator("[data-class-lab-output]")).toContainText(
    "Traceback:\nTraceback (most recent call last):\nValueError: classroom failure",
  );
  await expect(lab.locator("[data-class-lab-status]")).toContainText(
    "Python stopped with an error",
  );
});

test("the chapter tutor stays scoped, renders citations as text, and carries correlation only", async ({
  page,
}) => {
  const requests = [];
  const clientHeaders = [];
  await page.route("**/api/tutor/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    clientHeaders.push(route.request().headers()["x-eduground-tutor-client"]);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: requests.length === 1
          ? "input() returns a str. Convert only when the program needs numeric operations. <img src=x onerror=alert(1)>"
          : "Exactly: conversion creates a number from compatible text.",
        citations: [{
          title: "<strong>Reading keyboard input</strong>",
          section: "The input() return value",
        }],
        conversationId: "correlation-py01",
        model: "llama3.1:8b",
      }),
    });
  });
  await openClassRoom(page);

  const tutor = page.locator('[data-chapter-tutor="py01"]');
  const transcript = tutor.locator("[data-chapter-tutor-transcript]");
  const question = tutor.locator("textarea[data-chapter-tutor-question]");
  const ask = tutor.getByRole("button", { name: "Ask tutor", exact: true });

  await expect(tutor.getByText("Learning boundary", { exact: true })).toBeVisible();
  await expect(tutor).toContainText("restricted to the current chapter");
  await expect(transcript).toHaveAttribute("role", "log");
  await expect(transcript).toHaveAttribute("aria-live", "polite");
  await expect(question).toHaveAttribute("maxlength", "1200");
  await expect(question).toHaveAttribute("aria-keyshortcuts", "Control+Enter");

  await tutor.getByRole("button", {
    name: "Explain the main idea in beginner-friendly language.",
    exact: true,
  }).click();
  await expect(question).toHaveValue(
    "Explain the main idea in beginner-friendly language.",
  );
  await ask.click();

  await expect(tutor).toHaveAttribute("aria-busy", "true");
  await expect(tutor.getByRole("button", { name: "Thinking…", exact: true })).toBeDisabled();
  await expect(tutor.locator("[data-chapter-tutor-status]")).toContainText(
    "Searching this chapter",
  );
  await expect(transcript).toContainText("input() returns a str");
  await expect(transcript).toContainText("<img src=x onerror=alert(1)>");
  await expect(transcript.locator("img")).toHaveCount(0);
  await expect(transcript).toContainText("<strong>Reading keyboard input</strong>");
  await expect(transcript.locator("strong").filter({
    hasText: "<strong>Reading keyboard input</strong>",
  })).toHaveCount(0);
  await expect(tutor).toHaveAttribute("aria-busy", "false");
  await expect(tutor.locator("[data-chapter-tutor-status]")).toContainText(
    "Answer ready with 1 chapter source",
  );
  expect(requests[0]).toEqual({
    chapterId: "py01",
    message: "Explain the main idea in beginner-friendly language.",
  });

  await question.fill("So conversion changes compatible text into a number?");
  await question.press("Control+Enter");
  await expect(transcript).toContainText("Exactly: conversion creates a number");
  expect(requests[1]).toEqual({
    chapterId: "py01",
    message: "So conversion changes compatible text into a number?",
    conversationId: "correlation-py01",
  });
  expect(clientHeaders[0]).toMatch(/^[a-f0-9-]{32,80}$/iu);
  expect(clientHeaders[1]).toBe(clientHeaders[0]);
  await expect
    .poll(() => page.evaluate(() =>
      sessionStorage.getItem("fp-playground.tutor-client.v1")
    ))
    .toBe(clientHeaders[0]);

  await tutor.getByRole("button", { name: "Clear chat", exact: true }).click();
  await expect(transcript.locator(".chapter-tutor__message")).toHaveCount(1);
  await expect(tutor.locator("[data-chapter-tutor-status]")).toContainText(
    "Conversation cleared",
  );
});

test("the chapter tutor exposes bounded rate-limit feedback and preserves the question", async ({
  page,
}) => {
  await page.route("**/api/tutor/chat", (route) => route.fulfill({
    status: 429,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code: "TUTOR_RATE_LIMITED",
        message: "Internal capacity details should not be shown.",
        retryAfterSeconds: 9,
      },
    }),
  }));
  await openClassRoom(page);

  const tutor = page.locator('[data-chapter-tutor="py01"]');
  const transcript = tutor.locator("[data-chapter-tutor-transcript]");
  const question = tutor.locator("textarea[data-chapter-tutor-question]");
  await question.fill("Why does input return text?");
  await tutor.getByRole("button", { name: "Ask tutor", exact: true }).click();

  await expect(tutor.locator("[data-chapter-tutor-status]")).toHaveText(
    "The classroom request limit is active. Try again in about 9 seconds.",
  );
  await expect(tutor.locator("[data-chapter-tutor-status]")).not.toContainText(
    "Internal capacity",
  );
  await expect(question).toHaveValue("Why does input return text?");
  await expect(transcript.locator(".chapter-tutor__message")).toHaveCount(1);
  await expect(tutor).toHaveAttribute("aria-busy", "false");
  unexpectedBrowserErrors = unexpectedBrowserErrors.filter(
    (message) => !message.includes("status of 429"),
  );
});

test("the interactive room remains stacked and free of horizontal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openClassRoom(page);

  const lab = classLab(page, LECTURE_LAB);
  await expect(lab.locator("button[data-class-lab-run]")).toBeVisible();
  await expect(
    page.locator(`button[data-class-room-check="${INPUT_TYPE_TASK}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-chapter-tutor="py01"]')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const lab = document.querySelector(
      '[data-class-lab="lecture-demo"][data-class-chapter="py01"]',
    );
    const editor = lab.querySelector(".class-room-lab__editor-panel")
      .getBoundingClientRect();
    const input = lab.querySelector(".class-room-lab__input-panel")
      .getBoundingClientRect();
    return {
      editorBottom: editor.bottom,
      inputTop: input.top,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      tutorRight: document.querySelector('[data-chapter-tutor="py01"]')
        .getBoundingClientRect().right,
    };
  });

  expect(geometry.inputTop).toBeGreaterThanOrEqual(geometry.editorBottom - 2);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.tutorRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});
