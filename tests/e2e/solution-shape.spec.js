import { expect, test } from "@playwright/test";

const EXERCISE_ID = "py01-fixme";
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
  await page.goto(EXERCISE_ROUTE);
  await expect(page.locator(`[data-ace-host="${EXERCISE_ID}"]`)).toBeVisible();
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

async function setEditorCode(page, code) {
  await page.evaluate(
    ({ exerciseId, nextCode }) => {
      const host = document.querySelector(`[data-ace-host="${exerciseId}"]`);
      window.ace.edit(host).setValue(nextCode, -1);
    },
    { exerciseId: EXERCISE_ID, nextCode: code }
  );
}

test("the technique contract stays solution-free and does not render matching patterns", async ({
  page,
}) => {
  const contract = page.locator(".technique-contract");
  await expect(contract.getByRole("heading", { name: "Show the idea in your code" })).toBeVisible();
  await expect(contract.locator("li")).toHaveCount(2);
  await expect(contract).toContainText("Create two variables");
  await expect(contract).toContainText("Build and print the concatenated value");
  await expect(contract).not.toContainText("pattern");

  const publicReport = await page.evaluate(() => {
    const report = window.SOLUTION_SHAPE.evaluate(
      'print("Hello world!")',
      window.EXERCISE_TESTS["py01-fixme"].sourceRules
    );
    return report.results;
  });
  expect(publicReport).toHaveLength(2);
  expect(publicReport.every((result) => result.passed === false)).toBe(true);
  expect(publicReport.every((result) => !Object.hasOwn(result, "pattern"))).toBe(true);

  const fStringBypass = await page.evaluate(() =>
    window.SOLUTION_SHAPE.evaluate(
      'left = int(input())\nright = int(input())\nprint(f"{left + right}")',
      window.EXERCISE_TESTS["py01-avoid-sums"].sourceRules
    )
  );
  expect(fStringBypass.passed).toBe(false);
});

test("correct output cannot earn stars until the requested code shape is present", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runTests = page.locator(
    `button[data-run-exercise="${EXERCISE_ID}"][data-run-scope="all"]`
  );
  const results = page.locator(`[data-test-results="${EXERCISE_ID}"]`);
  const passStatus = page.locator(`[data-exercise-pass-status="${EXERCISE_ID}"]`);

  await setEditorCode(page, 'print("Hello world!")');
  await runTests.click();

  await expect(results.locator(".results-summary")).toContainText("3 of 5 checks passed", {
    timeout: 45_000,
  });
  await expect(results.locator(".test-result--technique")).toHaveCount(2);
  await expect(results.locator(".test-result--technique.test-result--fail")).toHaveCount(2);
  await expect(results).toContainText("Your output is correct");
  await expect(passStatus).toContainText("Not passed");

  await setEditorCode(
    page,
    [
      "left = 1",
      "right = 2",
      "total = left + right",
      'print("Hello world!")',
    ].join("\n")
  );
  await runTests.click();

  await expect(results.locator(".results-summary")).toContainText("4 of 5 checks passed", {
    timeout: 45_000,
  });
  await expect(results.locator(".test-result--technique.test-result--pass")).toHaveCount(1);
  await expect(results.locator(".test-result--technique.test-result--fail")).toHaveCount(1);
  await expect(passStatus).toContainText("Not passed");

  await setEditorCode(
    page,
    [
      'first = "Hello"',
      'ending = " world!"',
      "greeting = first + ending",
      "print(greeting)",
    ].join("\n")
  );
  await runTests.click();

  await expect(results.locator(".results-summary")).toContainText(
    "Behavior and technique checks passed",
    { timeout: 45_000 }
  );
  await expect(results.locator(".results-summary__count")).toHaveText("5 / 5");
  await expect(results.locator(".test-result--technique.test-result--pass")).toHaveCount(2);
  await expect(passStatus).toContainText("Passed");
});
