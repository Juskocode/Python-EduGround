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

test("exercise mode compacts the shell while preserving every essential control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#exercise/py01-fixme");

  await expect(page.locator("body")).toHaveAttribute("data-route", "exercise");
  await expect(page.locator(".ace_editor")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".site-topbar");
    const workbench = document.querySelector(".exercise-workbench");
    const lesson = document.querySelector(".exercise-workbench__lesson");
    const code = document.querySelector(".exercise-workbench__code");
    return {
      header: header.getBoundingClientRect().height,
      workbenchTop: workbench.getBoundingClientRect().top,
      workbenchBottom: workbench.getBoundingClientRect().bottom,
      lessonHeight: lesson.getBoundingClientRect().height,
      codeHeight: code.getBoundingClientRect().height,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.header).toBeLessThanOrEqual(58);
  expect(geometry.workbenchTop).toBeLessThanOrEqual(108);
  expect(geometry.workbenchBottom).toBeLessThanOrEqual(900);
  expect(Math.abs(geometry.lessonHeight - geometry.codeHeight)).toBeLessThanOrEqual(2);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

  await expect(page.getByRole("link", { name: "Open chapter dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open timed assessment rooms" })).toBeVisible();
  await expect(page.getByRole("button", { name: /mode/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /interface sounds/u })).toBeVisible();
  await expect(page.locator("#profile-button")).toBeVisible();

  await page.locator("#profile-button").click();
  await expect(page.locator("#profile-panel")).toBeVisible();
  const profile = await page.locator("#profile-panel").boundingBox();
  expect(profile.x).toBeGreaterThanOrEqual(0);
  expect(profile.x + profile.width).toBeLessThanOrEqual(1440);
});

test("route changes restore the full shell and reapply compact mode on return", async ({
  page,
}) => {
  await page.goto("/#exercise/py01-fixme");
  const compactHeight = await page.locator(".site-topbar").evaluate(
    (element) => element.getBoundingClientRect().height
  );

  await page.goto("/#home");
  await expect(page.locator("body")).toHaveAttribute("data-route", "home");
  const fullHeight = await page.locator(".site-topbar").evaluate(
    (element) => element.getBoundingClientRect().height
  );
  expect(fullHeight).toBeGreaterThan(compactHeight);
  expect(fullHeight).toBeGreaterThanOrEqual(70);

  await page.goto("/#exercise/py01-fixme");
  await expect(page.locator("body")).toHaveAttribute("data-route", "exercise");
  await expect(page.locator(".site-topbar")).toHaveCSS("position", "sticky");
});

test("mobile exercise mode stays stacked without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#exercise/py01-fixme");

  await expect(page.locator("body")).toHaveAttribute("data-route", "exercise");
  await expect(page.locator(".ace_editor")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open chapter dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open timed assessment rooms" })).toBeVisible();
  await expect(page.locator("#theme-toggle")).toBeVisible();
  await expect(page.locator("#sound-toggle")).toBeVisible();
  await expect(page.locator("#profile-button")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".site-topbar");
    const lesson = document.querySelector(".exercise-workbench__lesson");
    const code = document.querySelector(".exercise-workbench__code");
    return {
      header: header.getBoundingClientRect().height,
      lessonBottom: lesson.getBoundingClientRect().bottom,
      codeTop: code.getBoundingClientRect().top,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.header).toBeLessThanOrEqual(56);
  expect(geometry.codeTop).toBeGreaterThanOrEqual(geometry.lessonBottom);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});
