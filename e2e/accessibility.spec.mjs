import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  ["dashboard", "/#home"],
  ["chapter", "/#chapter/py01"],
  ["class materials", "/#chapter/py01/tutorials"],
  ["exercise editor", "/#exercise/py01-first-programs"],
  ["assessment hub", "/#assessments"],
  ["theory room", "/#assessment/py01-py03/theory"],
];

function seriousViolations(results) {
  return results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact)
  );
}

function violationSummary(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .slice(0, 5)
        .join(", ");
      return `${violation.id} (${violation.impact}): ${violation.help}; ${targets}`;
    })
    .join("\n");
}

for (const [name, route] of routes) {
  test(`${name} has no serious or critical accessibility violations`, async ({ page }, testInfo) => {
    await page.goto(route);
    await expect(page.locator("#app-main h1")).toBeVisible();
    // Route views use a bounded entrance animation. Scan only after the visual
    // state learners actually read has settled, avoiding transient opacity.
    await page.waitForTimeout(350);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    await testInfo.attach(`axe-${name.replaceAll(" ", "-")}.json`, {
      body: Buffer.from(JSON.stringify(results.violations, null, 2)),
      contentType: "application/json",
    });

    const failures = seriousViolations(results);
    expect(failures, violationSummary(failures)).toEqual([]);
  });
}

test("the open learner profile has no serious or critical accessibility violations", async ({ page }, testInfo) => {
  await page.goto("/#home");
  await page.locator("#profile-button").click();
  await expect(page.locator("#profile-panel")).toBeVisible();
  await page.waitForTimeout(350);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await testInfo.attach("axe-profile.json", {
    body: Buffer.from(JSON.stringify(results.violations, null, 2)),
    contentType: "application/json",
  });

  const failures = seriousViolations(results);
  expect(failures, violationSummary(failures)).toEqual([]);
});
