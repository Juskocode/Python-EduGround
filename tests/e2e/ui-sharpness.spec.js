import { expect, test } from "@playwright/test";

async function surfaceStyle(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderRadius: style.borderRadius,
      minHeight: style.minHeight,
    };
  });
}

test("the shared precision grammar reaches the primary learner routes", async ({
  page,
}) => {
  await page.goto("/#welcome");

  await expect(page.locator(".landing-hero")).toBeVisible();
  expect(await surfaceStyle(page.locator(".landing-hero"))).toMatchObject({
    borderRadius: "16px",
  });
  expect(await surfaceStyle(page.locator(".landing-terminal"))).toMatchObject({
    borderRadius: "10px",
  });
  expect(await surfaceStyle(page.locator(".landing-loop li").first())).toMatchObject({
    borderRadius: "10px",
  });
  expect(
    await surfaceStyle(page.locator(".landing-hero__actions .button").first()),
  ).toMatchObject({
    borderRadius: "8px",
    minHeight: "44px",
  });

  await page.goto("/#home");

  await expect(page.locator(".home-onboarding")).toBeVisible();
  expect(await surfaceStyle(page.locator(".home-onboarding"))).toMatchObject({
    borderRadius: "10px",
  });
  expect(await surfaceStyle(page.locator(".home-resume"))).toMatchObject({
    borderRadius: "16px",
  });
  expect(await surfaceStyle(page.locator(".learning-stage").first())).toMatchObject({
    borderRadius: "10px",
  });

  await page.goto("/#chapter/py00/tutorials");

  await expect(page.locator(".class-page--onboarding")).toBeVisible();
  expect(
    await surfaceStyle(page.locator(".class-page--onboarding .class-page__header")),
  ).toMatchObject({
    borderRadius: "12px",
  });
  expect(await surfaceStyle(page.locator(".class-page__start-panel"))).toMatchObject({
    borderRadius: "10px",
  });

  await page.goto("/#exercise/py01-first-programs");

  await expect(page.locator(".exercise-workbench")).toBeVisible();
  expect(await surfaceStyle(page.locator(".exercise-workbench__lesson"))).toMatchObject({
    borderRadius: "10px",
  });
  expect(await surfaceStyle(page.locator(".exercise-workbench__code"))).toMatchObject({
    borderRadius: "10px",
  });
  expect(await surfaceStyle(page.locator(".ide-button").first())).toMatchObject({
    borderRadius: "6px",
  });
});
