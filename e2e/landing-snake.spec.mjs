import AxeBuilder from "@axe-core/playwright";
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

test("the welcome hero is game-first, compact, and never autoplays", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#welcome");

  const hero = page.locator(".landing-hero");
  const arcade = page.locator("[data-landing-snake]");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Play the logic. Then build it in Python.",
    })
  ).toBeVisible();
  await expect(arcade).toHaveAttribute("data-snake-phase", "idle");
  await expect(arcade).toHaveAttribute("data-snake-score", "0");
  await expect(arcade.locator("[data-snake-head]")).toHaveCount(1);
  await expect(arcade.locator("[data-snake-energy]")).toHaveCount(1);
  await expect(arcade.locator("[data-snake-asteroid]")).toHaveCount(8);

  await page.waitForTimeout(350);
  await expect(arcade).toHaveAttribute("data-snake-ticks", "0");

  const geometry = await hero.evaluate((element) => {
    const title = element.querySelector("h1");
    return {
      height: element.getBoundingClientRect().height,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
    };
  });
  expect(geometry.height).toBeLessThan(760);
  expect(geometry.titleSize).toBeLessThanOrEqual(59);
});

test("Snake supports keyboard play, pausing, restart, and field narration", async ({
  page,
}) => {
  await page.goto("/#welcome");

  const arcade = page.locator("[data-landing-snake]");
  const playfield = arcade.locator("[data-snake-playfield]");
  await playfield.focus();
  await page.keyboard.press("Enter");
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");
  await expect(arcade).toHaveAttribute("data-snake-score", "10", {
    timeout: 2_500,
  });

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

test("the Snake arcade is touch-sized, motion-aware, and accessible on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#welcome");

  const arcade = page.locator("[data-landing-snake]");
  const directionButtons = arcade.locator("[data-snake-direction]");
  await expect(directionButtons).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const box = await directionButtons.nth(index).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const animationNames = await arcade.evaluate((element) => [
    getComputedStyle(element).animationName,
    getComputedStyle(element, "::before").animationName,
    getComputedStyle(element.querySelector(".landing-snake__energy")).animationName,
  ]);
  expect(animationNames.every((name) => name === "none")).toBe(true);

  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

  const accessibility = await new AxeBuilder({ page })
    .include(".landing-hero")
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

test("leaving the welcome page destroys the running arcade cleanly", async ({ page }) => {
  await page.goto("/#welcome");
  const arcade = page.locator("[data-landing-snake]");
  await arcade.getByRole("button", { name: "Start mission" }).click();
  await expect(arcade).toHaveAttribute("data-snake-phase", "running");

  await page.getByRole("link", { name: "Explore the roadmap" }).click();
  await expect(page).toHaveURL(/#home$/u);
  await expect(page.locator("[data-landing-snake]")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-route", "home");
});
