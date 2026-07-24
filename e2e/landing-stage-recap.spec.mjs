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

test("the bare URL opens a focused course welcome before the chapter dashboard", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Learn Python · Python EduGround/u);
  await expect(page.locator(".landing-page")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Learn Python by understanding what every line does.",
    })
  ).toBeVisible();
  await expect(page.locator("[data-landing-stage]")).toHaveCount(4);
  await expect(page.locator('.topbar-home[href="#welcome"]')).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("link", { name: "Explore the roadmap" })).toHaveAttribute(
    "href",
    "#home"
  );

  await page.getByRole("link", { name: "Explore the roadmap" }).click();
  await expect(page).toHaveURL(/#home$/u);
  await expect(page.locator("#home-roadmap-title")).toBeVisible();
});

test("each stage recap reconnects three chapters before the timed checkpoint", async ({
  page,
}) => {
  await page.goto("/#stage/py01-py03/recap");

  const recap = page.locator('[data-stage-recap-page="py01-py03-recap"]');
  await expect(recap).toBeVisible();
  await expect(recap.locator("[data-recap-chapter]")).toHaveCount(3);
  await expect(recap.locator("[data-retrieval-prompt]")).toHaveCount(3);
  await expect(recap.locator(".stage-recap-recall-card")).toHaveCount(3);
  await expect(recap.locator("[data-assessment-mode]")).toHaveCount(2);
  await expect(recap.locator(".stage-recap-reference")).toHaveCount(5);
  await expect(
    recap.locator('[data-assessment-mode="theory"] .stage-recap-mode__link')
  ).toHaveAttribute("href", "#assessment/py01-py03/theory");

  const firstRecall = recap.locator(".stage-recap-recall-card").first();
  await expect(firstRecall).not.toHaveAttribute("open", "");
  await firstRecall.locator("summary").click();
  await expect(firstRecall).toHaveAttribute("open", "");
});

test("the final animated award unlocks only after the complete course path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#home");

  const lockedAward = page.locator("[data-final-stage-badge]");
  await expect(lockedAward).toHaveCount(1);
  await expect(lockedAward).toHaveAttribute("data-award-state", "locked");
  await expect(lockedAward).toContainText("Locked");

  await page.evaluate(() => {
    const passed = window.COURSE_DATA.chapters.flatMap((chapter) =>
      chapter.exercises.map((exercise) => exercise.id)
    );
    const learning = {};
    for (const chapter of window.COURSE_DATA.chapters) {
      const chapterId = chapter.id;
      const chapterLearning = window.LEARNING_CONTENT.chapters[chapterId];
      const items = chapterLearning.tutorial.map(
        (section, index) => section.id || `tutorial-${index}`
      );
      const roomTasks = window.CLASS_MATERIALS?.[chapterId]?.roomTasks || [];
      items.push(...roomTasks.map((task) => `room:${task.id}`));
      if (window.LEARNING_CLINICS?.[chapterId]) {
        items.push("concept-clinic");
      }
      items.push("runbook");
      learning[chapterId] = items;
    }
    const blocks = {};
    for (const block of window.ASSESSMENT_DATA.blocks) {
      blocks[block.id] = {
        theory: {
          active: null,
          history: [],
          bestScore: 100,
          completed: true,
        },
        practical: {
          active: null,
          history: [],
          bestScore: 100,
          completed: true,
        },
      };
    }
    localStorage.setItem("fp-playground.passed.v2", JSON.stringify(passed));
    localStorage.setItem("fp-playground.learning.v1", JSON.stringify(learning));
    localStorage.setItem(
      "fp-playground.assessments.v1",
      JSON.stringify({ version: window.ASSESSMENT_DATA.version, blocks })
    );
  });
  await page.reload();

  const unlockedAward = page.locator("[data-final-stage-badge]");
  await expect(unlockedAward).toHaveAttribute("data-award-state", "unlocked");
  await expect(unlockedAward).toContainText("Earned");
  await expect(unlockedAward).toHaveAttribute("href", "#profile/badges");
  const animationDuration = await unlockedAward
    .locator(".stage-award__visual")
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeGreaterThan(0);
});

test("welcome, recap, and award stay usable on mobile with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#stage/py10-py11/recap");

  const award = page.locator("[data-final-stage-badge]");
  await expect(award).toBeVisible();
  const recapGeometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    animations: Array.from(
      document.querySelectorAll(
        "[data-final-stage-badge], [data-final-stage-badge] *"
      )
    ).map((element) => getComputedStyle(element).animationDuration),
  }));
  expect(recapGeometry.scrollWidth).toBeLessThanOrEqual(recapGeometry.viewportWidth + 1);
  expect(
    recapGeometry.animations.every((duration) =>
      duration
        .split(",")
        .every((value) => Number.parseFloat(value) <= 0.001)
    )
  ).toBe(true);

  await page.goto("/#welcome");
  await expect(page.locator(".landing-page")).toBeVisible();
  const landingGeometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(landingGeometry.scrollWidth).toBeLessThanOrEqual(
    landingGeometry.viewportWidth + 1
  );
});
