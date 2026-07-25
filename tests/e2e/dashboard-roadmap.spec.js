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

async function openRoadmap(page) {
  await page.goto("/#home");
  await expect(page.locator("#home-roadmap-title")).toBeVisible();
}

test("the curriculum presents four assessed routes and a final game studio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openRoadmap(page);

  const stages = page.locator("[data-roadmap-stage]");
  await expect(stages).toHaveCount(5);
  await expect(page.locator("[data-chapter-node]")).toHaveCount(13);
  await expect(page.locator("[data-stage-recap]")).toHaveCount(4);
  await expect(page.locator("[data-stage-checkpoint]")).toHaveCount(4);
  await expect(page.locator("[data-final-stage-badge]")).toHaveCount(1);

  for (let index = 0; index < 4; index += 1) {
    const stage = stages.nth(index);
    await expect(stage.locator("[data-chapter-node]")).toHaveCount(3);
    await expect(stage.locator(".learning-stage__route-track")).toHaveCount(1);
    await expect(stage.locator(".learning-stage__route-progress")).toHaveCount(1);
    await expect(stage.locator(".learning-stage__progress progress")).toHaveCount(1);
    await expect(stage.locator("[data-stage-recap]")).toHaveCount(1);
    await expect(stage.locator("[data-stage-checkpoint]")).toHaveCount(1);
  }

  const gameStudio = page.locator(
    '[data-roadmap-stage="game-project-studio"]'
  );
  await expect(gameStudio).toHaveCount(1);
  await expect(gameStudio.locator("[data-chapter-node]")).toHaveCount(1);
  await expect(gameStudio.locator("[data-stage-recap]")).toHaveCount(0);
  await expect(gameStudio.locator("[data-stage-checkpoint]")).toHaveCount(0);

  await expect(stages.first()).toHaveAttribute("data-stage-state", "current");
  await expect(page.locator('[data-chapter-node][data-node-state="current"]')).toHaveCount(1);
  await expect(
    page.locator('[data-chapter-node][data-node-state="current"]')
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.locator('[data-chapter-node][data-node-state="upcoming"]')
  ).toHaveCount(12);

  const geometry = await page.evaluate(() => {
    const firstStage = document.querySelector("[data-roadmap-stage]");
    const firstNode = firstStage.querySelector("[data-chapter-node]");
    const secondNode = firstStage.querySelectorAll("[data-chapter-node]")[1];
    const thirdNode = firstStage.querySelectorAll("[data-chapter-node]")[2];
    const recap = firstStage.querySelector("[data-stage-recap]");
    const checkpoint = firstStage.querySelector("[data-stage-checkpoint]");
    const route = firstStage.querySelector(".learning-stage__route-track");
    const firstBox = firstNode.getBoundingClientRect();
    const secondBox = secondNode.getBoundingClientRect();
    const thirdBox = thirdNode.getBoundingClientRect();
    const recapBox = recap.getBoundingClientRect();
    const checkpointBox = checkpoint.getBoundingClientRect();
    const routeBox = route.getBoundingClientRect();
    const routeProgress = firstStage.querySelector(".learning-stage__route-progress");
    return {
      firstX: firstBox.x,
      secondX: secondBox.x,
      thirdX: thirdBox.x,
      recapX: recapBox.x,
      checkpointX: checkpointBox.x,
      routeWidth: routeBox.width,
      routeHeight: routeBox.height,
      routeAnimationDuration: getComputedStyle(routeProgress).animationDuration,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(geometry.firstX).toBeLessThan(geometry.secondX);
  expect(geometry.secondX).toBeLessThan(geometry.thirdX);
  expect(geometry.thirdX).toBeLessThan(geometry.recapX);
  expect(geometry.recapX).toBeLessThan(geometry.checkpointX);
  expect(geometry.routeWidth).toBeGreaterThan(geometry.routeHeight);
  expect(Number.parseFloat(geometry.routeAnimationDuration)).toBeGreaterThan(0);
  expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});

test("completed, current, and upcoming stops update from saved learning progress", async ({
  page,
}) => {
  await openRoadmap(page);
  await page.evaluate(() => {
    const chapter = window.COURSE_DATA.chapters.find((candidate) => candidate.id === "py01");
    const learning = window.LEARNING_CONTENT.chapters.py01;
    const learningItems = learning.tutorial.map((section) => section.id);
    if (window.LEARNING_CLINICS?.py01) {
      learningItems.push("concept-clinic");
    }
    const roomTasks = window.CLASS_MATERIALS?.py01?.roomTasks || [];
    learningItems.push(...roomTasks.map((task) => `room:${task.id}`));
    learningItems.push("runbook");
    localStorage.setItem(
      "fp-playground.passed.v2",
      JSON.stringify(chapter.exercises.map((exercise) => exercise.id))
    );
    localStorage.setItem(
      "fp-playground.learning.v1",
      JSON.stringify({ py01: learningItems })
    );
  });
  await page.reload();

  const completed = page.locator('[data-chapter-node="py01"]');
  const current = page.locator('[data-chapter-node="py02"]');
  const upcoming = page.locator('[data-chapter-node="py04"]');

  await expect(completed).toHaveAttribute("data-node-state", "completed");
  await expect(current).toHaveAttribute("data-node-state", "current");
  await expect(current).toHaveAttribute("aria-current", "step");
  await expect(upcoming).toHaveAttribute("data-node-state", "upcoming");
  await expect(page.locator('[aria-current="step"][data-chapter-node]')).toHaveCount(1);
  await expect(page.locator('[data-roadmap-stage="py01-py03"]')).toHaveAttribute(
    "data-stage-state",
    "current"
  );
  await expect(page.locator('[data-roadmap-stage="py04-py06"]')).toHaveAttribute(
    "data-stage-state",
    "upcoming"
  );
});

test("the roadmap becomes a usable vertical path on mobile and reduces motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openRoadmap(page);

  const firstStage = page.locator("[data-roadmap-stage]").first();
  const firstNode = firstStage.locator("[data-chapter-node]").nth(0);
  const secondNode = firstStage.locator("[data-chapter-node]").nth(1);
  const recap = firstStage.locator("[data-stage-recap]");
  const checkpoint = firstStage.locator("[data-stage-checkpoint]");
  await expect(firstNode).toBeVisible();
  await expect(secondNode).toBeVisible();
  await expect(recap).toBeVisible();
  await expect(checkpoint).toBeVisible();

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector("[data-roadmap-stage]");
    const nodes = stage.querySelectorAll("[data-chapter-node]");
    const firstBox = nodes[0].getBoundingClientRect();
    const secondBox = nodes[1].getBoundingClientRect();
    const routeBox = stage
      .querySelector(".learning-stage__route-track")
      .getBoundingClientRect();
    const animatedElements = [
      stage,
      stage.querySelector(".learning-stage__route-progress"),
      stage.querySelector('[data-node-state="current"] .path-chapter__marker'),
      stage.querySelector("[data-stage-recap]"),
    ].filter(Boolean);
    return {
      firstTop: firstBox.top,
      secondTop: secondBox.top,
      routeWidth: routeBox.width,
      routeHeight: routeBox.height,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationDurations: animatedElements.map(
        (element) => getComputedStyle(element).animationDuration
      ),
    };
  });

  expect(geometry.firstTop).toBeLessThan(geometry.secondTop);
  expect(geometry.routeHeight).toBeGreaterThan(geometry.routeWidth);
  expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.reducedMotion).toBe(true);
  expect(
    geometry.animationDurations.every((duration) =>
      duration
        .split(",")
        .every((value) => Number.parseFloat(value) <= 0.001)
    ),
    "Reduced-motion mode should make every roadmap animation effectively instant"
  ).toBe(true);

  await checkpoint.focus();
  await expect(checkpoint).toBeFocused();
  await recap.focus();
  await expect(recap).toBeFocused();
});
