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

test("the Pygame class connects game-loop theory to two interactive labs", async ({
  page,
}) => {
  await page.goto("/#chapter/py13/tutorials");

  await expect(
    page.getByRole("heading", { name: "Pygame Game Lab", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Interactive game systems studio" }),
  ).toBeVisible();
  await expect(page.getByText("One loop, two game genres")).toBeVisible();

  const snakeLab = page.locator('[data-pygame-lab="snake"]');
  const snakeBoard = snakeLab.getByRole("region", { name: "Snake state board" });
  const snakeStatus = snakeLab.locator(".pygame-lab__status");
  await expect(snakeLab).toBeVisible();
  await expect(snakeStatus).toContainText("Frame 0");
  await snakeBoard.focus();
  await page.keyboard.press("ArrowUp");
  await snakeLab.getByRole("button", { name: "Step frame" }).click();
  await expect(snakeStatus).toContainText("Frame 1");
  await expect(snakeStatus).toContainText("Direction up");
  await expect(
    snakeLab.locator('[data-discovery="snake-event"]'),
  ).toHaveClass(/is-complete/u);
  await expect(
    snakeLab.locator('[data-discovery="snake-update"]'),
  ).toHaveClass(/is-complete/u);

  const platformerLab = page.locator('[data-pygame-lab="platformer"]');
  const platformerStage = platformerLab.getByRole("region", {
    name: "Platformer simulation viewport",
  });
  const platformerStatus = platformerLab.locator(".pygame-lab__status");
  await expect(platformerLab).toBeVisible();
  await platformerStage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(platformerStatus).toContainText("Frame 1");
  await page.keyboard.press("Space");
  await expect(platformerStatus).toContainText("Frame 2");
  await expect(
    platformerLab.locator('[data-discovery="platform-move"]'),
  ).toHaveClass(/is-complete/u);
  await expect(
    platformerLab.locator('[data-discovery="platform-jump"]'),
  ).toHaveClass(/is-complete/u);

  const gravity = platformerLab.locator('[data-platform-parameter="gravity"]');
  await gravity.fill("24");
  await expect(
    platformerLab.locator('[data-platform-parameter-output="gravity"]'),
  ).toHaveText("24");

  await expect(page.getByRole("link", {
    name: /Pygame events.*official documentation/u,
  })).toBeVisible();
  await expect(page.getByRole("link", {
    name: /Pygame Rect.*official documentation/u,
  })).toBeVisible();

});

test("the game-project hub reaches all eight exercises through the standard editor", async ({
  page,
}) => {
  await page.goto("/#chapter/py13");
  await expect(
    page.getByRole("heading", { name: "Pygame Game Lab", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Interactive game studio")).toBeVisible();
  await expect(page.getByText("Game-logic challenges")).toBeVisible();

  await page.locator('a[href="#chapter/py13/exercises"]').click();
  await expect(page).toHaveURL(/#chapter\/py13\/exercises$/u);
  await expect(page.locator(".exercise-list > li")).toHaveCount(8);

  await page.locator('a[href="#exercise/py13-direction-step"]').click();
  await expect(page).toHaveURL(/#exercise\/py13-direction-step$/u);
  await expect(
    page.getByRole("heading", { name: "One Grid Step", level: 1 }),
  ).toBeVisible();
  await expect(
    page.locator('[data-ace-host="py13-direction-step"]'),
  ).toBeVisible();
});

test("the interactive studio remains usable without horizontal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#chapter/py13/tutorials");

  await expect(page.locator('[data-pygame-lab="snake"]')).toBeVisible();
  await expect(page.locator('[data-pygame-lab="platformer"]')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("reduced motion keeps manual game stepping and disables continuous play", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#chapter/py13/tutorials");

  const unavailablePlay = page.getByRole("button", { name: "Play unavailable" });
  await expect(unavailablePlay).toHaveCount(2);
  await expect(unavailablePlay.first()).toBeDisabled();
  await expect(
    page.locator('[data-pygame-lab="snake"]').getByRole("button", {
      name: "Step frame",
    }),
  ).toBeEnabled();
  await expect(
    page.locator('[data-pygame-lab="platformer"]').getByRole("button", {
      name: "Step frame",
    }),
  ).toBeEnabled();
});
