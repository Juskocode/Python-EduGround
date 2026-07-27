import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

let unexpectedBrowserErrors;

async function openSnakeDialog(page) {
  const launcher = page.getByRole("button", { name: /Launch Python Snake/u });
  const dialog = page.getByRole("dialog", { name: /Python Snake/u });

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
  const mission = arcade.getByRole("region", {
    name: "Mission objective and power-up status",
  });
  await expect(mission).toContainText("Collect cores · reach 1000");
  await expect(mission.locator("[data-snake-progress]")).toHaveAttribute(
    "value",
    "0"
  );
  await expect(arcade.locator("[data-snake-combo]")).toHaveText("Ready");
  await expect(arcade.locator("[data-snake-powerup-status]")).toContainText(
    /Power-up in \d+ · S Shield · 2× Core · F Freeze/u
  );
  await expect(
    arcade.getByRole("button", { name: "Start mission" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await expect(arcade).toHaveAttribute("data-snake-score", "10", {
    timeout: 2_500,
  });
  await expect(arcade.locator("[data-snake-combo]")).toContainText("1×");
  await expect(mission.locator("[data-snake-progress]")).toHaveAttribute(
    "value",
    "10"
  );

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
      "[data-snake-meteor-layer]",
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
      "[data-snake-meteor-layer]",
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

test("red-zone meteors warn clearly, land once, and keep renderer nodes stable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#welcome");

  const opened = await openSnakeDialog(page);
  await opened.arcade.evaluate((root) => {
    const replacement = root.cloneNode(true);
    [
      "[data-snake-falling-star-layer]",
      "[data-snake-meteor-layer]",
      "[data-snake-asteroid-layer]",
      "[data-snake-energy-layer]",
      "[data-snake-powerup-layer]",
      "[data-snake-echo-layer]",
      "[data-snake-segment-layer]",
    ].forEach((selector) => replacement.querySelector(selector).replaceChildren());
    root.replaceWith(replacement);
    window.__snakeMeteorController = window.LANDING_SNAKE.mount(replacement, {
      state: {
        asteroids: [],
        direction: "right",
        energy: [23, 13],
        maxAsteroids: 2,
        nextMeteorTick: 1,
        seed: 7_719,
        segments: [[5, 7], [4, 7], [3, 7]],
      },
      stepDuration: 160,
    });
    window.__snakeMeteorChildChanges = 0;
    window.__snakeMeteorObserver = new MutationObserver((records) => {
      window.__snakeMeteorChildChanges += records.filter(
        (record) => record.type === "childList"
      ).length;
    });
    [
      replacement.querySelector("[data-snake-meteor-layer]"),
      replacement.querySelector("[data-snake-asteroid-layer]"),
    ].forEach((layer) => {
      window.__snakeMeteorObserver.observe(layer, { childList: true });
    });
  });

  const arcade = opened.dialog.locator("[data-landing-snake]");
  await expect(arcade.locator(".landing-snake__asteroid")).toHaveCount(2);
  await expect(arcade.locator("[data-snake-asteroid]")).toHaveCount(0);
  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(arcade).toHaveAttribute("data-snake-meteor", "warning");
  await expect(arcade).toHaveAttribute(
    "data-snake-meteor-moves",
    /^(?:[1-9]|1[0-2])$/u
  );
  await expect(arcade.locator("[data-snake-hazard-status]")).toContainText(
    "RED ZONE · impact in"
  );
  await expect(
    arcade.locator("[data-snake-hazard-announcement]")
  ).toContainText("Meteor warning. Avoid the red zone");
  await expect(arcade.locator("[data-snake-meteor-warning]")).toBeVisible();
  await expect(
    arcade.locator(".landing-snake__meteor-warning-count")
  ).toHaveText(
    /^(?:[1-9]|1[0-2])$/u
  );

  const reducedWarning = await arcade.evaluate((root) => ({
    meteorDisplay: getComputedStyle(
      root.querySelector(".landing-snake__meteor")
    ).display,
    warningAnimation: getComputedStyle(
      root.querySelector(".landing-snake__meteor-warning")
    ).animationName,
    warningVisible: getComputedStyle(
      root.querySelector(".landing-snake__meteor-warning")
    ).display !== "none",
  }));
  expect(reducedWarning).toEqual({
    meteorDisplay: "none",
    warningAnimation: "none",
    warningVisible: true,
  });

  await expect(arcade).toHaveAttribute("data-snake-meteor", "impact", {
    timeout: 3_500,
  });
  await expect(arcade.locator("[data-snake-asteroid]")).toHaveCount(1);
  await expect(arcade.locator("[data-snake-hazard-status]")).toContainText(
    "Meteor landed · 1 rocks"
  );

  const renderer = await arcade.evaluate(() => ({
    childListChanges: window.__snakeMeteorChildChanges,
    state: window.__snakeMeteorController.getState(),
  }));
  expect(renderer.childListChanges).toBe(0);
  expect(renderer.state.asteroids).toHaveLength(1);
  expect(renderer.state.meteorWarning).toBeNull();
  expect(renderer.state.meteorImpact).not.toBeNull();

  await arcade.evaluate(() => {
    window.__snakeMeteorObserver.disconnect();
    window.__snakeMeteorController.destroy();
    delete window.__snakeMeteorObserver;
    delete window.__snakeMeteorController;
    delete window.__snakeMeteorChildChanges;
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

  const { arcade, dialog, playfield } = await openSnakeDialog(page);
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
    meteorWarning: getComputedStyle(
      element.querySelector(".landing-snake__meteor-warning")
    ).animationName,
    meteorTransition: getComputedStyle(
      element.querySelector(".landing-snake__meteor")
    ).transitionDuration,
  }));
  expect(motion).toMatchObject({
    arcade: "none",
    accent: "none",
    asteroid: "none",
    echo: "none",
    energy: "none",
    fallingStarDisplay: "none",
    powerUp: "none",
    meteorWarning: "none",
  });
  expect(Number.parseFloat(motion.meteorTransition)).toBeLessThan(0.001);
  await expect(arcade).toHaveAttribute("data-snake-motion", "reduced");

  const playfieldBox = await playfield.boundingBox();
  await playfield.dispatchEvent("pointerdown", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width / 2,
    clientY: playfieldBox.y + playfieldBox.height * 0.7,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await playfield.dispatchEvent("pointermove", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width / 2,
    clientY: playfieldBox.y + playfieldBox.height * 0.25,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await expect(arcade).toHaveAttribute("data-snake-direction", "up");
  await expect(arcade).toHaveAttribute("data-snake-swipe", "up");
  await expect(arcade.locator("[data-snake-swipe-cue]")).toContainText("↑ up");
  await playfield.dispatchEvent("pointerup", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width / 2,
    clientY: playfieldBox.y + playfieldBox.height * 0.25,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await expect(arcade).toHaveAttribute("data-snake-direction", "up");

  const acceptedTurnTick = Number(
    await arcade.getAttribute("data-snake-ticks")
  );
  await expect
    .poll(async () => Number(await arcade.getAttribute("data-snake-ticks")))
    .toBeGreaterThan(acceptedTurnTick);
  await playfield.dispatchEvent("pointerdown", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width / 2,
    clientY: playfieldBox.y + playfieldBox.height / 2,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });
  await playfield.dispatchEvent("pointermove", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width / 2,
    clientY: playfieldBox.y + playfieldBox.height * 0.78,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });
  await expect(arcade).toHaveAttribute("data-snake-direction", "up");
  await expect(arcade.locator("[data-snake-event-toast]")).toContainText(
    "NO REVERSE"
  );
  await playfield.dispatchEvent("pointermove", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width * 0.82,
    clientY: playfieldBox.y + playfieldBox.height / 2,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });
  await expect(arcade).toHaveAttribute("data-snake-direction", "right");
  await expect(arcade).toHaveAttribute("data-snake-swipe", "right");
  await playfield.dispatchEvent("pointerup", {
    button: 0,
    clientX: playfieldBox.x + playfieldBox.width * 0.82,
    clientY: playfieldBox.y + playfieldBox.height / 2,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });

  const geometry = await page.evaluate(() => {
    const board = document.querySelector("[data-snake-board]");
    const playfieldElement = document.querySelector("[data-snake-playfield]");
    const boardBox = board.getBoundingClientRect();
    const playfieldBox = playfieldElement.getBoundingClientRect();
    return {
      boardRatio: boardBox.width / boardBox.height,
      playfieldRatio: playfieldBox.width / playfieldBox.height,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.boardRatio).toBeCloseTo(24 / 14, 1);
  expect(geometry.playfieldRatio).toBeCloseTo(24 / 14, 1);
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

[
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1366, height: 768 },
].forEach((viewport) => {
  test(`Snake stays fixed without internal scrolling at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#welcome");

    const { arcade, dialog, playfield } = await openSnakeDialog(page);
    const frame = dialog.locator(".landing-snake-dialog__frame");
    const close = dialog.getByRole("button", { name: "Close Python Snake" });
    const before = await page.evaluate(() => ({
      frameScrollTop: document.querySelector(".landing-snake-dialog__frame").scrollTop,
      windowScrollY: window.scrollY,
    }));

    const direction = arcade.locator("[data-snake-direction]").first();
    if (await direction.isVisible()) {
      await direction.click();
    } else {
      await arcade.getByRole("button", { name: "Start mission" }).click();
    }
    await arcade.getByRole("button", { name: "Pause" }).click();

    const geometry = await page.evaluate(() => {
      const frameElement = document.querySelector(".landing-snake-dialog__frame");
      const visibleElements = [
        document.querySelector("[data-snake-playfield]"),
        document.querySelector(".landing-snake__controls"),
        document.querySelector("[data-snake-close]"),
      ];
      return {
        frameClientHeight: frameElement.clientHeight,
        frameScrollHeight: frameElement.scrollHeight,
        frameScrollTop: frameElement.scrollTop,
        windowScrollY: window.scrollY,
        playfieldHeight: visibleElements[0].getBoundingClientRect().height,
        allInsideViewport: visibleElements.every((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.top >= -1 &&
            box.left >= -1 &&
            box.right <= window.innerWidth + 1 &&
            box.bottom <= window.innerHeight + 1
          );
        }),
      };
    });

    expect(geometry.frameScrollHeight).toBeLessThanOrEqual(
      geometry.frameClientHeight + 1
    );
    expect(geometry.frameScrollTop).toBe(before.frameScrollTop);
    expect(geometry.windowScrollY).toBe(before.windowScrollY);
    expect(geometry.playfieldHeight).toBeGreaterThanOrEqual(120);
    expect(geometry.allInsideViewport).toBe(true);
    await expect(frame).toBeVisible();
    await expect(playfield).toBeVisible();
    await expect(close).toBeVisible();
  });
});

test("Snake restores page scroll and body styles after button and Escape closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#welcome");
  const launcher = page.getByRole("button", { name: /Launch Python Snake/u });
  await page.evaluate(() => {
    document.body.style.position = "relative";
    document.body.style.top = "0px";
    document.body.style.right = "auto";
    document.body.style.bottom = "auto";
    document.body.style.left = "auto";
    document.body.style.width = "auto";
    document.body.style.overflow = "visible";
  });
  await launcher.evaluate((element) => {
    element.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await expect(launcher).toBeInViewport();
  const initial = await page.evaluate(() => ({
    scrollY: window.scrollY,
    style: document.body.getAttribute("style"),
  }));
  expect(initial.scrollY).toBeGreaterThan(0);

  let opened = await openSnakeDialog(page);
  await opened.dialog.getByRole("button", { name: "Close Python Snake" }).click();
  await expect(opened.dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initial.scrollY);
  await expect.poll(
    () => page.evaluate(() => document.body.getAttribute("style")),
  ).toBe(initial.style);

  opened = await openSnakeDialog(page);
  await page.keyboard.press("Escape");
  await expect(opened.dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initial.scrollY);
  await expect.poll(
    () => page.evaluate(() => document.body.getAttribute("style")),
  ).toBe(initial.style);
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
