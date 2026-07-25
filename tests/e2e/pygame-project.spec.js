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

test("the Pygame class connects game-loop theory to four interactive missions", async ({
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

  const studio = page.locator(".pygame-studio");
  const snakeTab = studio.getByRole("tab", { name: /Snake loop/u });
  const platformerTab = studio.getByRole("tab", { name: /Platform physics/u });
  const systemsTab = studio.getByRole("tab", { name: /Game systems/u });
  await expect(studio.getByRole("tablist", {
    name: "Pygame studio missions",
  })).toBeVisible();
  await snakeTab.click();
  await expect(snakeTab).toHaveAttribute("aria-selected", "true");
  await expect(platformerTab).toHaveAttribute("aria-selected", "false");
  await expect(studio.locator(".pygame-studio__progress-output")).toContainText(
    "0 /",
  );

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
  await expect(studio.locator(".pygame-studio__progress-output")).toContainText(
    "2 /",
  );

  const platformerLab = page.locator('[data-pygame-lab="platformer"]');
  const platformerStage = platformerLab.getByRole("region", {
    name: "Platformer simulation viewport",
  });
  const platformerStatus = platformerLab.locator(".pygame-lab__status");
  await expect(platformerLab).toBeHidden();
  await snakeTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(platformerTab).toBeFocused();
  await expect(platformerTab).toHaveAttribute("aria-selected", "true");
  await expect(platformerLab).toBeVisible();
  await expect(snakeLab).toBeHidden();
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

  const systemsLab = page.locator('[data-pygame-lab="systems"]');
  await systemsTab.click();
  await expect(systemsLab).toBeVisible();
  await expect(platformerLab).toBeHidden();
  await expect(systemsLab.locator('[data-systems-mode="title"]')).toHaveClass(
    /is-active/u,
  );
  await systemsLab.getByRole("button", { name: "Start run", exact: true }).click();
  await expect(systemsLab.locator('[data-systems-mode="running"]')).toHaveClass(
    /is-active/u,
  );
  await systemsLab.getByRole("button", { name: "Collect power-up" }).click();
  await expect(systemsLab.getByText("1500 ms", { exact: true }).first()).toBeVisible();
  await expect(
    systemsLab.locator('[data-discovery="systems-power"]'),
  ).toHaveClass(/is-complete/u);
  await systemsLab.getByRole("button", { name: "Pause" }).click();
  await systemsLab.getByRole("button", { name: "Advance 250 ms" }).click();
  await expect(
    systemsLab.locator('[data-discovery="systems-paused"]'),
  ).toHaveClass(/is-complete/u);
  await expect(studio.locator(".pygame-studio__progress-output")).toContainText(
    "7 /",
  );

  const tracerTab = studio.getByRole("tab", { name: /Frame tracer/u });
  const hasTracerTab = await tracerTab.count();
  if (hasTracerTab) {
    await tracerTab.click();
  }
  const frameTracer = hasTracerTab
    ? studio.locator('[data-pygame-lab="frame-tracer"]')
    : page.locator('[data-pygame-lab="frame-tracer"]');
  await expect(frameTracer).toBeVisible();
  await expect(
    frameTracer.locator('[data-tracer-snapshot="candidate"]'),
  ).toBeHidden();
  await frameTracer.getByRole("button", { name: "Reveal next phase" }).click();
  await frameTracer.getByRole("button", { name: "Reveal next phase" }).click();
  await expect(
    frameTracer.locator('[data-tracer-snapshot="candidate"]'),
  ).toBeVisible();
  await frameTracer.getByLabel("Scenario").selectOption("power-expiry");
  await expect(frameTracer).toContainText("Temporary boost expires");

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

  await page.getByRole("tab", { name: /Snake loop/u }).click();
  await expect(page.locator('[data-pygame-lab="snake"]')).toBeVisible();
  await expect(page.locator('[data-pygame-lab="platformer"]')).toBeHidden();
  await expect(page.locator('[data-pygame-lab="systems"]')).toBeHidden();
  await page.getByRole("tab", { name: /Game systems/u }).click();
  await expect(page.locator('[data-pygame-lab="systems"]')).toBeVisible();
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

  await page.getByRole("tab", { name: /Snake loop/u }).click();
  const unavailablePlay = page.getByRole("button", { name: "Play unavailable" });
  await expect(unavailablePlay).toHaveCount(1);
  await expect(unavailablePlay).toBeDisabled();
  await expect(
    page.locator('[data-pygame-lab="snake"]').getByRole("button", {
      name: "Step frame",
    }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: /Platform physics/u }).click();
  await expect(unavailablePlay).toHaveCount(1);
  await expect(unavailablePlay).toBeDisabled();
  await expect(
    page.locator('[data-pygame-lab="platformer"]').getByRole("button", {
      name: "Step frame",
    }),
  ).toBeEnabled();
});

test("the frame tracer reacts to timing input and keeps its completed mission", async ({
  page,
}) => {
  await page.goto("/#chapter/py13/tutorials");

  const studio = page.locator(".pygame-studio");
  const tracerTab = studio.getByRole("tab", { name: /Frame tracer/u });
  await expect(
    page.locator('[data-pygame-lab="frame-tracer"]'),
  ).toHaveCount(1);
  await tracerTab.click();

  const tracer = studio.locator('[data-pygame-lab="frame-tracer"]');
  const candidate = tracer.locator('[data-tracer-snapshot="candidate"]');
  const committed = tracer.locator('[data-tracer-snapshot="committed"]');
  const elapsed = tracer.getByLabel("Elapsed milliseconds");
  await tracer.getByLabel("Scenario").selectOption("power-expiry");
  await elapsed.fill("100");

  await tracer.getByRole("button", { name: "Reveal next phase" }).click();
  await tracer.getByRole("button", { name: "Reveal next phase" }).click();
  await tracer.getByRole("button", { name: "Reveal next phase" }).click();
  await expect(candidate).toBeVisible();
  await expect(committed).toBeVisible();
  await expect(candidate).toHaveText("remaining_ms=80");
  await expect(committed).toContainText(
    "boost_remaining_ms=80, multiplier=2",
  );

  await elapsed.fill("250");
  await expect(candidate).toHaveText(
    "remaining_ms=-70 before clamping",
  );
  await expect(committed).toContainText(
    "boost_remaining_ms=0, multiplier=1",
  );
  await expect(committed).toContainText("effect-expired event emitted once");

  await tracer.getByRole("button", { name: "Reveal next phase" }).click();
  await expect(tracerTab).toHaveClass(/is-complete/u);
  await expect(tracerTab.locator(".pygame-studio__tab-count")).toHaveText(
    "1/1",
  );

  await page.goto("/#home");
  await expect(page.locator(".pygame-studio")).toHaveCount(0);
  await page.goto("/#chapter/py13/tutorials");

  const restoredStudio = page.locator(".pygame-studio");
  const restoredTracerTab = restoredStudio.getByRole("tab", {
    name: /Frame tracer/u,
  });
  await expect(restoredTracerTab).toHaveClass(/is-complete/u);
  await expect(
    restoredTracerTab.locator(".pygame-studio__tab-count"),
  ).toHaveText("1/1");
  await expect(
    page.locator('[data-pygame-lab="frame-tracer"]'),
  ).toHaveCount(1);
});

test("Snake continuous play stops as soon as another studio mission activates", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#chapter/py13/tutorials");
  await page.clock.install();

  const studio = page.locator(".pygame-studio");
  const snakeTab = studio.getByRole("tab", { name: /Snake loop/u });
  const platformerTab = studio.getByRole("tab", { name: /Platform physics/u });
  await snakeTab.click();

  const snake = studio.locator('[data-pygame-lab="snake"]');
  const status = snake.locator(".pygame-lab__status");
  await snake.getByLabel("Simulation speed").fill("10");
  await snake.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(350);
  await expect(status).toContainText("Frame 3");

  await platformerTab.click();
  const frameWhenHidden = await status.textContent();
  await page.clock.runFor(1200);
  await expect(status).toHaveText(frameWhenHidden);

  await snakeTab.click();
  await expect(
    snake.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(status).toHaveText(frameWhenHidden);
});
