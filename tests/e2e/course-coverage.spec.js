import { expect, test } from "@playwright/test";

const STAGES = [
  {
    name: "Core Python Control Flow",
    chapters: [
      ["py01", "First Programs"],
      ["py02", "Simple Data"],
      ["py03", "Flow, Conditionals & Iteration"],
    ],
  },
  {
    name: "Functions, Text & Collections",
    chapters: [
      ["py04", "Functions"],
      ["py05", "Strings & Tuples"],
      ["py06", "Lists"],
    ],
  },
  {
    name: "Data Structures, Recursion & Functional Tools",
    chapters: [
      ["py07", "Dictionaries & Sets"],
      ["py08", "Recursion"],
      ["py09", "FP with Collections"],
    ],
  },
  {
    name: "Purity, Divide & Conquer, and Dynamic Programming",
    chapters: [
      ["py10", "Effect-Free Programming"],
      ["py11", "Divide and Conquer"],
      ["py12", "Problem Solving & Dynamic Programming"],
    ],
  },
  {
    name: "Game Project Studio",
    chapters: [
      ["py13", "Pygame Game Lab"],
    ],
  },
];

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

for (const stage of STAGES) {
  test(`${stage.name} exposes every hub, exercise catalogue, and class`, async ({
    page,
  }) => {
    for (const [chapterId, chapterTitle] of stage.chapters) {
      await page.goto(`/#chapter/${chapterId}`);
      await expect(
        page.getByRole("heading", { name: chapterTitle, level: 1 })
      ).toBeVisible();
      await expect(
        page.locator(`a.choice-card[href="#chapter/${chapterId}/exercises"]`)
      ).toHaveCount(1);
      await expect(
        page.locator(`a.choice-card[href="#chapter/${chapterId}/tutorials"]`)
      ).toHaveCount(1);

      await page.goto(`/#chapter/${chapterId}/exercises`);
      await expect(
        page.getByRole("heading", {
          name: `${chapterTitle} exercises`,
          level: 1,
        })
      ).toBeVisible();
      await expect(page.locator(".exercise-list > li")).not.toHaveCount(0);

      await page.goto(`/#chapter/${chapterId}/tutorials`);
      await expect(
        page.locator(
          `nav[aria-label="Course chapter navigation"] a[data-chapter-id="${chapterId}"]`
        )
      ).toHaveAttribute("aria-current", "page");
      await expect(page.locator("main h1").first()).toBeVisible();
    }
  });
}

test("the main learning surfaces remain free of horizontal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    "/#home",
    "/#chapter/py00/tutorials",
    "/#chapter/py01",
    "/#chapter/py01/exercises",
    "/#exercise/py01-fixme",
    "/#chapter/py13/tutorials",
    "/#exercise/py13-direction-step",
    "/#assessments",
    "/#profile/badges",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("#app-main")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `${route} should not scroll horizontally`).toBeLessThanOrEqual(
      1
    );
  }
});
