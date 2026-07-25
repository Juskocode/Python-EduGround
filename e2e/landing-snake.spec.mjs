import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

let unexpectedBrowserErrors;

async function openSnakeDialog(page) {
  const launcher = page.getByRole("button", { name: /Launch Python Snake/u });
  const dialog = page.getByRole("dialog", { name: /snake\.py \/\/ orbital loop/u });

  await launcher.click();
  await expect(dialog).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "true");

  return {
    arcade: dialog.locator("[data-landing-snake]"),
    dialog,
    launcher,
    playfield: dialog.locator("[data-snake-playfield]"),
  };
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
});

test.afterEach(async () => {
  expect(unexpectedBrowserErrors).toEqual([]);
});

test("the calm welcome keeps Snake closed and restores launcher focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#welcome");

  const hero = page.locator(".landing-hero--calm");
  const terminal = hero.locator(".landing-terminal");
  const launcher = page.getByRole("button", { name: /Launch Python Snake/u });
  const dialog = page.locator("[data-snake-dialog]");
  const arcade = dialog.locator("[data-landing-snake]");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Learn Python by understanding what every line does.",
    })
  ).toBeVisible();
  await expect(terminal).toBeVisible();
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(dialog).toBeHidden();
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(arcade).not.toHaveAttribute("data-snake-phase", /.+/u);

  await page.waitForTimeout(350);
  await expect(dialog).toBeHidden();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");

  const opened = await openSnakeDialog(page);
  await expect(opened.arcade).toHaveAttribute("data-snake-phase", "idle");
  await expect(opened.arcade).toHaveAttribute("data-snake-score", "0");
  await expect(opened.arcade).toHaveAttribute("data-snake-ticks", "0");
  await page.waitForTimeout(350);
  await expect(opened.arcade).toHaveAttribute("data-snake-ticks", "0");

  await opened.dialog.getByRole("button", { name: "Close Python Snake" }).click();
  await expect(opened.dialog).toBeHidden();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(launcher).toBeFocused();

  await openSnakeDialog(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(launcher).toBeFocused();

  const geometry = await hero.evaluate((element) => {
    const title = element.querySelector("h1");
    return {
      height: element.getBoundingClientRect().height,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
    };
  });
  expect(geometry.height).toBeLessThan(760);
  expect(geometry.titleSize).toBeLessThanOrEqual(63);
});

test("Snake supports keyboard play, pausing, restart, and field narration", async ({
  page,
}) => {
  await page.goto("/#welcome");

  const { arcade, playfield } = await openSnakeDialog(page);
  await expect(
    arcade.getByRole("button", { name: "Start mission" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await expect(arcade).toHaveAttribute("data-snake-score", "10", {
    timeout: 2_500,
  });

  await expect(playfield).toBeFocused();
  await page.keyboard.press("Space");
  await expect(arcade).toHaveAttribute("data-snake-phase", "paused");
  const pausedTick = await arcade.getAttribute("data-snake-ticks");
  await page.waitForTimeout(350);
  await expect(arcade).toHaveAttribute("data-snake-ticks", pausedTick);

  await page.keyboard.press("r");
  await expect(arcade).toHaveAttribute("data-snake-phase", "idle");
  await expect(arcade).toHaveAttribute("data-snake-score", "0");

  await page.keyboard.press("ArrowUp");
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await arcade.getByRole("button", { name: "Pause" }).click();
  await expect(arcade).toHaveAttribute("data-snake-phase", "paused");

  await arcade.getByRole("button", { name: "Describe field" }).click();
  await expect(arcade.locator("[data-snake-announcement]")).toContainText(
    /Python Snake is at column \d+, row \d+/u
  );
});

test("ordinary ticks reuse renderer nodes and asteroids move on their cadence", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#welcome");

  const { arcade } = await openSnakeDialog(page);
  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await expect
    .poll(async () => Number(await arcade.getAttribute("data-snake-ticks")))
    .toBeGreaterThanOrEqual(2);

  const initialAsteroidTransforms = await arcade.evaluate((root) => {
    const layers = [
      "[data-snake-falling-star-layer]",
      "[data-snake-asteroid-layer]",
      "[data-snake-energy-layer]",
      "[data-snake-powerup-layer]",
      "[data-snake-echo-layer]",
      "[data-snake-segment-layer]",
    ].map((selector) => root.querySelector(selector));
    const observer = new MutationObserver((records) => {
      window.__snakeChildListChanges += records.filter(
        (record) => record.type === "childList"
      ).length;
    });

    window.__snakeChildListChanges = 0;
    window.__snakeStableNodes = {
      asteroid: root.querySelector(".landing-snake__asteroid"),
      energy: root.querySelector(".landing-snake__energy"),
      head: root.querySelector(".landing-snake__head"),
    };
    window.__snakeStableObserver = observer;
    layers.forEach((layer) => observer.observe(layer, { childList: true }));

    return Array.from(root.querySelectorAll(".landing-snake__asteroid")).map(
      (node) => node.getAttribute("transform")
    );
  });

  await expect
    .poll(async () => Number(await arcade.getAttribute("data-snake-ticks")))
    .toBeGreaterThanOrEqual(5);
  await expect(arcade).toHaveAttribute("data-snake-renderer", "stable");

  const ordinaryTickSnapshot = await arcade.evaluate((root) => ({
    childListChanges: window.__snakeChildListChanges,
    sameAsteroid: root
      .querySelector(".landing-snake__asteroid")
      .isSameNode(window.__snakeStableNodes.asteroid),
    sameEnergy: root
      .querySelector(".landing-snake__energy")
      .isSameNode(window.__snakeStableNodes.energy),
    sameHead: root
      .querySelector(".landing-snake__head")
      .isSameNode(window.__snakeStableNodes.head),
    transforms: Array.from(root.querySelectorAll(".landing-snake__asteroid")).map(
      (node) => node.getAttribute("transform")
    ),
  }));
  expect(ordinaryTickSnapshot).toMatchObject({
    childListChanges: 0,
    sameAsteroid: true,
    sameEnergy: true,
    sameHead: true,
  });
  expect(ordinaryTickSnapshot.transforms).toEqual(initialAsteroidTransforms);

  await expect
    .poll(async () => Number(await arcade.getAttribute("data-snake-ticks")), {
      timeout: 5_000,
    })
    .toBeGreaterThanOrEqual(18);
  await expect
    .poll(
      () =>
        arcade.evaluate((root) =>
          Array.from(root.querySelectorAll(".landing-snake__asteroid")).map(
            (node) => node.getAttribute("transform")
          )
        ),
      { timeout: 2_000 }
    )
    .not.toEqual(initialAsteroidTransforms);

  const finalRendererSnapshot = await arcade.evaluate((root) => {
    window.__snakeStableObserver.disconnect();
    return {
      childListChanges: window.__snakeChildListChanges,
      sameAsteroid: root
        .querySelector(".landing-snake__asteroid")
        .isSameNode(window.__snakeStableNodes.asteroid),
      sameEnergy: root
        .querySelector(".landing-snake__energy")
        .isSameNode(window.__snakeStableNodes.energy),
      sameHead: root
        .querySelector(".landing-snake__head")
        .isSameNode(window.__snakeStableNodes.head),
    };
  });
  expect(finalRendererSnapshot).toEqual({
    childListChanges: 0,
    sameAsteroid: true,
    sameEnergy: true,
    sameHead: true,
  });

  await arcade.getByRole("button", { name: "Pause" }).click();
});

test("the split button and X consume the visible three-use HUD", async ({ page }) => {
  await page.goto("/#welcome");

  const opened = await openSnakeDialog(page);
  await opened.arcade.evaluate((root) => {
    const replacement = root.cloneNode(true);
    [
      "[data-snake-falling-star-layer]",
      "[data-snake-asteroid-layer]",
      "[data-snake-energy-layer]",
      "[data-snake-powerup-layer]",
      "[data-snake-echo-layer]",
      "[data-snake-segment-layer]",
    ].forEach((selector) => replacement.querySelector(selector).replaceChildren());
    root.replaceWith(replacement);
    window.__snakeE2EController = window.LANDING_SNAKE.mount(replacement, {
      state: {
        asteroids: [],
        direction: "right",
        energy: [23, 13],
        segments: [
          [10, 7],
          [9, 7],
          [8, 7],
          [7, 7],
          [6, 7],
          [5, 7],
          [4, 7],
          [3, 7],
          [2, 7],
        ],
      },
      stepDuration: 260,
    });
  });

  const arcade = opened.dialog.locator("[data-landing-snake]");
  const playfield = arcade.locator("[data-snake-playfield]");
  const split = arcade.locator("[data-snake-action='split']");
  await expect(arcade.locator("[data-snake-splits]")).toHaveText("3 / 3");
  await expect(split).toHaveText("Split trail · 3");
  await expect(split).toBeDisabled();

  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(split).toBeEnabled();
  await split.click();
  await expect(arcade.locator("[data-snake-splits]")).toHaveText("2 / 3");
  await expect(arcade).toHaveAttribute("data-snake-effect", "split-phase");

  await playfield.focus();
  await page.keyboard.press("x");
  await expect(arcade.locator("[data-snake-splits]")).toHaveText("1 / 3");
  await page.keyboard.press("X");
  await expect(arcade.locator("[data-snake-splits]")).toHaveText("0 / 3");
  await expect(split).toHaveText("Split trail · 0");
  await expect(split).toBeDisabled();
  await expect(arcade.locator("[data-snake-echo]")).not.toHaveCount(0);

  const state = await arcade.evaluate(() =>
    window.__snakeE2EController.getState()
  );
  expect(state).toMatchObject({
    splitUses: 3,
    splitsRemaining: 0,
  });
  await arcade.evaluate(() => {
    window.__snakeE2EController.destroy();
    delete window.__snakeE2EController;
  });
});

test("the Snake dialog is touch-sized, motion-aware, and accessible on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#welcome");

  const launcher = page.getByRole("button", { name: /Launch Python Snake/u });
  const launcherBox = await launcher.boundingBox();
  expect(launcherBox.height).toBeGreaterThanOrEqual(44);

  const { arcade, dialog } = await openSnakeDialog(page);
  const close = dialog.getByRole("button", { name: "Close Python Snake" });
  const closeBox = await close.boundingBox();
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);

  const directionButtons = arcade.locator("[data-snake-direction]");
  await expect(directionButtons).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const box = await directionButtons.nth(index).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const motion = await arcade.evaluate((element) => ({
    arcade: getComputedStyle(element).animationName,
    accent: getComputedStyle(element, "::before").animationName,
    asteroid: getComputedStyle(
      element.querySelector(".landing-snake__asteroid polygon")
    ).animationName,
    echo: getComputedStyle(
      element.querySelector(".landing-snake__echo rect")
    ).animationName,
    energy: getComputedStyle(
      element.querySelector(".landing-snake__energy")
    ).animationName,
    fallingStarDisplay: getComputedStyle(
      element.querySelector(".landing-snake__falling-star")
    ).display,
    powerUp: getComputedStyle(
      element.querySelector(".landing-snake__powerup")
    ).animationName,
  }));
  expect(motion).toEqual({
    arcade: "none",
    accent: "none",
    asteroid: "none",
    echo: "none",
    energy: "none",
    fallingStarDisplay: "none",
    powerUp: "none",
  });
  await expect(arcade).toHaveAttribute("data-snake-motion", "reduced");

  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

  const accessibility = await new AxeBuilder({ page })
    .include("[data-snake-dialog]")
    .analyze();
  await testInfo.attach("axe-landing-snake.json", {
    body: Buffer.from(JSON.stringify(accessibility.violations, null, 2)),
    contentType: "application/json",
  });
  const summary = accessibility.violations
    .flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(", ")}`)
    )
    .join("\n");
  expect(accessibility.violations, summary).toEqual([]);
});

test("leaving the welcome page destroys the running dialog arcade cleanly", async ({
  page,
}) => {
  await page.goto("/#welcome");
  const { arcade, dialog } = await openSnakeDialog(page);
  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");

  await page.evaluate(() => {
    window.location.hash = "#home";
  });
  await expect(page).toHaveURL(/#home$/u);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-landing-snake]")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-route", "home");
});
