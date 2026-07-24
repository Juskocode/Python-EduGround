import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/#welcome", "/#home", "/#stage/py10-py11/recap"];

async function expectNoHorizontalOverflow(page) {
  const geometry = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
}

async function animationState(locator, pseudo = null) {
  return locator.evaluate(
    (element, pseudoElement) => {
      const style = getComputedStyle(element, pseudoElement);
      return {
        duration: style.animationDuration,
        name: style.animationName,
      };
    },
    pseudo
  );
}

function expectAnimationDisabled(state) {
  expect(
    state.name
      .split(",")
      .every((name) => name.trim() === "none")
  ).toBe(true);
  expect(
    state.duration
      .split(",")
      .every((duration) => Number.parseFloat(duration) <= 0.001)
  ).toBe(true);
}

test("geometric decorations stay hidden from assistive and pointer interaction", async ({
  page,
}) => {
  const cases = [
    ["/#welcome", ".landing-hero__geometry"],
    ["/#home", ".learning-stage__route-beacon"],
    ["/#stage/py10-py11/recap", ".stage-recap-hero__geometry"],
  ];

  for (const [route, selector] of cases) {
    await page.goto(route);
    const decoration = page.locator(selector);
    await expect(decoration).toHaveCount(1);
    await expect(decoration).toHaveAttribute("aria-hidden", "true");
    await expect(decoration).toHaveCSS("pointer-events", "none");
    await expect(decoration.locator("a, button, input, select, textarea, [tabindex]")).toHaveCount(
      0
    );
  }
});

test("welcome, roadmap, and recap have no horizontal overflow", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("#app-main h1")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
});

test("pointer feedback is brief with motion and absent with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#welcome");

  const target = page.locator(".landing-hero .button--quiet");
  await target.dispatchEvent("pointerdown", {
    button: 0,
    clientX: 220,
    clientY: 180,
  });

  const pulse = page.locator(".geo-click-pulse");
  await expect(pulse).toHaveCount(1);
  await expect(pulse).toHaveAttribute("aria-hidden", "true");
  await expect(pulse).toHaveCSS("pointer-events", "none");
  await expect(pulse).toHaveCount(0, { timeout: 2_000 });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await target.dispatchEvent("pointerdown", {
    button: 0,
    clientX: 220,
    clientY: 180,
  });
  await expect(pulse).toHaveCount(0);
});

test("reduced motion disables the new ambient and reward animations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#welcome");

  for (const [selector, pseudo] of [
    [".site-topbar", "::after"],
    [".landing-hero__orbit--outer", null],
    [".landing-hero__node--one", null],
    [".landing-terminal", null],
    [".landing-terminal", "::before"],
    [".landing-terminal__result", "::after"],
    [".landing-stage-card", null],
  ]) {
    expectAnimationDisabled(await animationState(page.locator(selector).first(), pseudo));
  }

  await page.goto("/#home");
  for (const [selector, pseudo] of [
    [".learning-stage--current", "::after"],
    [".learning-stage__route-beacon", "::before"],
    [".path-chapter--current .path-chapter__marker", "::before"],
  ]) {
    expectAnimationDisabled(await animationState(page.locator(selector).first(), pseudo));
  }

  await page.goto("/#stage/py10-py11/recap");
  for (const [selector, pseudo] of [
    [".stage-recap-hero__ring--outer", null],
    [".stage-recap-hero__beacon", "::after"],
    [".stage-recap-bridge__mark", "::after"],
    ["[data-final-stage-badge]", null],
    ["[data-final-stage-badge] .stage-award__visual", "::before"],
  ]) {
    expectAnimationDisabled(await animationState(page.locator(selector).first(), pseudo));
  }
});

test("forced colors removes decorative geometry while preserving the page", async ({
  page,
}) => {
  let forcedColorsSupported = true;
  try {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  } catch {
    forcedColorsSupported = false;
  }
  test.skip(!forcedColorsSupported, "This Playwright browser does not emulate forced colors.");

  await page.goto("/#welcome");
  await expect(page.locator(".landing-hero h1")).toBeVisible();
  await expect(page.locator(".landing-hero__geometry")).toHaveCSS("display", "none");
  const atmosphereDisplay = await page
    .locator(".app-main")
    .evaluate((element) => getComputedStyle(element, "::before").display);
  expect(atmosphereDisplay).toBe("none");
});

test("the light welcome theme keeps its educational surface color-accessible", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/#welcome");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const results = await new AxeBuilder({ page })
    .include(".landing-page")
    .withRules(["color-contrast"])
    .analyze();
  await testInfo.attach("axe-light-geospace-color.json", {
    body: Buffer.from(JSON.stringify(results.violations, null, 2)),
    contentType: "application/json",
  });

  const summary = results.violations
    .flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(", ")}`)
    )
    .join("\n");
  expect(results.violations, summary).toEqual([]);
});
