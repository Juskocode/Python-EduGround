import { expect, test } from "@playwright/test";

const EXERCISE_ID = "py01-first-programs";
const CLIENT_CAPABILITY = "browser-history-capability-123456789012345678901";

const accountState = {
  schemaVersion: 2,
  contentVersion: "2026-07-assessments-v1",
  passedIds: [],
  drafts: {},
  learningProgress: {},
  assessmentProgress: { schemaVersion: 1, blocks: {} },
  editorMode: "sublime",
};

const failedRun = {
  id: "42",
  exerciseId: EXERCISE_ID,
  scope: "all",
  passedCount: 0,
  totalCount: 1,
  allPassed: false,
  verification: "learner-device",
  createdAt: "2026-07-17T09:30:00.000Z",
  results: [
    {
      id: "case-1",
      name: "Historic greeting mismatch",
      hidden: false,
      passed: false,
      expected: "Hello world!",
      actual: "Hello World!",
      stdout: "captured diagnostic line",
      stderr: "",
      traceback: "AssertionError: expected an exact greeting",
    },
  ],
};

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

  await page.addInitScript(
    ({ capability }) => {
      window.sessionStorage.setItem(
        "fp-playground.auth-client-capability.v1",
        capability
      );
      window.localStorage.removeItem("fp-playground.auth-signed-out.v1");
      Object.defineProperty(window.Document.prototype, "execCommand", {
        configurable: true,
        value: (command) => {
          if (command !== "copy") return false;
          const selectedControl = window.document.activeElement;
          window.__copiedRunHistoryText = selectedControl?.value || "";
          return true;
        },
      });
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__copiedRunHistoryText = String(value);
          },
        },
      });
    },
    { capability: CLIENT_CAPABILITY }
  );

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (status, body) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify(body),
      });

    if (request.method() === "GET" && url.pathname === "/api/me") {
      return json(200, {
        user: {
          id: "history-learner",
          email: "history@example.test",
          displayName: "History Learner",
          createdAt: "2026-07-01T08:00:00.000Z",
        },
      });
    }
    if (request.method() === "GET" && url.pathname === "/api/state") {
      return json(200, { state: accountState, updatedAt: null });
    }
    if (request.method() === "PUT" && url.pathname === "/api/state") {
      return json(200, {
        state: JSON.parse(request.postData() || "{}").state || accountState,
        updatedAt: "2026-07-17T09:31:00.000Z",
      });
    }
    if (request.method() === "GET" && url.pathname.startsWith("/api/files/")) {
      return json(200, { file: null });
    }
    if (request.method() === "GET" && url.pathname === "/api/runs") {
      expect(url.searchParams.get("exerciseId")).toBe(EXERCISE_ID);
      return json(200, { runs: [failedRun] });
    }
    return json(404, {
      error: { code: "NOT_FOUND", message: `Unexpected mocked API request: ${url.pathname}` },
    });
  });
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("a signed-in learner can reopen and copy persisted run evidence", async ({ page }) => {
  const history = page.locator(`[data-run-history="${EXERCISE_ID}"]`);

  await page.goto(`/#exercise/${EXERCISE_ID}`);
  await expect(history).toBeVisible();
  await expect(history).toContainText(/learner-device evidence/iu);

  const historicRun = history.locator("[data-run-history-item]");
  await expect(historicRun).toHaveCount(1);
  await expect(historicRun).toContainText("Historic greeting mismatch");

  await page.reload();
  await expect(history).toBeVisible();
  await expect(history.locator("[data-run-history-item]")).toHaveCount(1);

  const reloadedRun = history.locator("[data-run-history-item]");
  await expect(reloadedRun.getByText("Hello world!", { exact: true })).toBeHidden();
  await expect(reloadedRun.getByText("Hello World!", { exact: true })).toBeHidden();
  await expect(
    reloadedRun.getByText("AssertionError: expected an exact greeting", { exact: true })
  ).toBeHidden();

  await reloadedRun.locator("summary").click();
  await expect(reloadedRun.getByText("Hello world!", { exact: true })).toBeVisible();
  await expect(reloadedRun.getByText("Hello World!", { exact: true })).toBeVisible();
  await expect(
    reloadedRun.getByText("AssertionError: expected an exact greeting", { exact: true })
  ).toBeVisible();

  const copyButton = reloadedRun.locator("button[data-copy-result]").first();
  await expect(copyButton).toBeVisible();
  const targetId = await copyButton.getAttribute("data-copy-result");
  expect(targetId).toBeTruthy();
  const copyTarget = page.locator(`#${targetId}`);
  await expect(copyTarget).toBeVisible();
  const expectedClipboardText = await copyTarget.textContent();

  await copyButton.click();
  await expect
    .poll(() => page.evaluate(() => window.__copiedRunHistoryText || ""))
    .toBe(expectedClipboardText || "");
});
