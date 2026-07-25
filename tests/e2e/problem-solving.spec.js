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

test("the roadmap leads into the complete problem-solving class", async ({ page }) => {
  await page.goto("/#home");

  await expect(page.locator(".home-header__meta")).toContainText("13 chapters");
  await expect(page.locator('a.topbar-home[href="#home"]')).toHaveAttribute(
    "aria-current",
    "page"
  );

  const chapterCard = page.locator(
    'nav[aria-label="Functional Tools and Problem-Solving Algorithms chapters"] a[href="#chapter/py12"]'
  );
  await expect(chapterCard).toHaveCount(1);
  await chapterCard.click();

  await expect(page).toHaveURL(/#chapter\/py12$/u);
  await expect(page.getByRole("heading", {
    name: "Problem Solving & Dynamic Programming",
    level: 1,
  })).toBeVisible();

  await page.locator('a.choice-card[href="#chapter/py12/tutorials"]').click();
  await expect(page).toHaveURL(/#chapter\/py12\/tutorials$/u);
  await expect(page.locator(".chapter-visuals")).toBeVisible();

  const diagrams = page.locator(".chapter-visuals img");
  await expect(diagrams).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await diagrams.nth(index).scrollIntoViewIfNeeded();
  }
  await expect.poll(async () => diagrams.evaluateAll((images) =>
    images.every((image) => image.complete && image.naturalWidth > 0)
  )).toBe(true);
  await expect(page.getByRole("link", {
    name: /functools\.cache.*official documentation/u,
  })).toBeVisible();
});

test("a famous dynamic-programming exercise opens in the normal editor workflow", async ({ page }) => {
  const exerciseId = "py12-knapsack";
  await page.goto(`/#exercise/${exerciseId}`);

  await expect(page).toHaveURL(/#exercise\/py12-knapsack$/u);
  await expect(page.getByRole("heading", { name: "0/1 Knapsack", level: 1 })).toBeVisible();
  const reasoningImage = page.locator(".problem-concept-visual img");
  await expect(reasoningImage).toBeVisible();
  await expect.poll(() => reasoningImage.evaluate((image) =>
    image.complete && image.naturalWidth > 0
  )).toBe(true);
  await expect(page.locator(`select[data-editor-mode="${exerciseId}"]`)).toBeVisible();
  await expect(page.locator(`[data-ace-host="${exerciseId}"]`)).toBeVisible();
  await expect(page.locator(".example-card")).toHaveCount(2);
  await expect(page.getByText("2 visible · 2 hidden")).toBeVisible();

  await page.locator('a.topbar-home[href="#assessments"]').click();
  await expect(page).toHaveURL(/#assessments$/u);
  await expect(page.locator('a.topbar-home[href="#assessments"]')).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.locator('a.topbar-home[href="#home"]')).not.toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("adding chapter 12 preserves earlier progress and drafts", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "fp-playground.passed.v2",
      JSON.stringify(["py11-bubble-sort"])
    );
    localStorage.setItem(
      "fp-playground.drafts.v2",
      JSON.stringify({
        "py11-bubble-sort": [
          "def bubble_sort(values):",
          "    # pre-chapter-12 draft",
          "    return values",
          "",
        ].join("\n"),
      })
    );
  });

  await page.goto("/#home");
  await expect(page.locator(".home-milestones")).toContainText("1 / 110");
  await expect(page.locator('a[href="#chapter/py12"]')).toHaveCount(1);

  await page.goto("/#exercise/py11-bubble-sort");
  await expect(page.locator('[data-ace-host="py11-bubble-sort"]')).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => {
      const host = document.querySelector('[data-ace-host="py11-bubble-sort"]');
      return host && window.ace ? window.ace.edit(host).getValue() : "";
    })
  ).toContain("# pre-chapter-12 draft");
});
