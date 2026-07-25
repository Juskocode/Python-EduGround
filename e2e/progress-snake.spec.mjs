import { expect, test } from "@playwright/test";

async function seedFirstStageCompletion(page) {
  await page.evaluate(() => {
    const stageIds = new Set(["py01", "py02", "py03"]);
    const chapters = window.COURSE_DATA.chapters.filter((chapter) =>
      stageIds.has(chapter.id)
    );
    const passed = chapters.flatMap((chapter) =>
      chapter.exercises.map((exercise) => exercise.id)
    );
    const learning = {};

    for (const chapter of chapters) {
      const chapterId = chapter.id;
      const chapterLearning = window.LEARNING_CONTENT.chapters[chapterId];
      const items = chapterLearning.tutorial.map(
        (section, index) => section.id || `tutorial-${index}`
      );
      const roomTasks = window.CLASS_MATERIALS?.[chapterId]?.roomTasks || [];
      items.push(...roomTasks.map((task) => `room:${task.id}`));
      if (window.LEARNING_CLINICS?.[chapterId]) {
        items.push("concept-clinic");
      }
      items.push("runbook");
      learning[chapterId] = items;
    }

    localStorage.setItem("fp-playground.passed.v2", JSON.stringify(passed));
    localStorage.setItem("fp-playground.learning.v1", JSON.stringify(learning));
    localStorage.setItem(
      "fp-playground.assessments.v1",
      JSON.stringify({
        version: window.ASSESSMENT_DATA.version,
        blocks: {
          "py01-py03": {
            theory: {
              active: null,
              history: [],
              bestScore: 100,
              completed: true,
            },
            practical: {
              active: null,
              history: [],
              bestScore: 100,
              completed: true,
            },
          },
        },
      })
    );
  });
}

test("earned Snake colors grow across landing, roadmap, stage, and chapter views", async ({
  page,
}) => {
  await page.goto("/#welcome");
  await seedFirstStageCompletion(page);
  await page.reload();

  const landingFleet = page.locator('[data-progress-snake="landing"]');
  await expect(landingFleet).toHaveAttribute("data-green-snakes", "3");
  await expect(landingFleet).toHaveAttribute("data-blue-snakes", "1");
  await expect(landingFleet).toHaveAttribute("data-yellow-snakes", "2");
  await expect(landingFleet).toHaveAttribute("data-snake-total", "6");
  await expect(landingFleet).toHaveAttribute("aria-hidden", "true");
  await expect(landingFleet.locator(".progress-snake__unit--green")).toHaveCount(3);
  await expect(landingFleet.locator(".progress-snake__unit--blue")).toHaveCount(1);
  await expect(landingFleet.locator(".progress-snake__unit--yellow")).toHaveCount(2);

  await page.goto("/#home");
  const dashboardFleet = page.locator('[data-progress-snake="dashboard"]');
  await expect(dashboardFleet).toHaveAttribute("data-snake-total", "6");

  await page.goto("/#stage/py01-py03/recap");
  const stageFleet = page.locator('[data-progress-snake="stage"]');
  await expect(stageFleet).toHaveAttribute("data-green-snakes", "3");
  await expect(stageFleet).toHaveAttribute("data-blue-snakes", "1");
  await expect(stageFleet).toHaveAttribute("data-yellow-snakes", "2");

  await page.goto("/#chapter/py01");
  const chapterFleet = page.locator('[data-progress-snake="chapter"]');
  await expect(chapterFleet).toHaveAttribute("data-green-snakes", "1");
  await expect(chapterFleet).toHaveAttribute("data-blue-snakes", "0");
  await expect(chapterFleet).toHaveAttribute("data-yellow-snakes", "0");
});

test("earned Snake fleets become static under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#welcome");
  await seedFirstStageCompletion(page);
  await page.reload();

  const fleet = page.locator('[data-progress-snake="landing"]');
  await expect(fleet).toBeVisible();
  const motion = await fleet.evaluate((element) => ({
    animationNames: Array.from(
      element.querySelectorAll(".progress-snake__unit"),
      (unit) => getComputedStyle(unit).animationName
    ),
    pointerEvents: getComputedStyle(element).pointerEvents,
  }));
  expect(motion.animationNames.every((name) => name === "none")).toBe(true);
  expect(motion.pointerEvents).toBe("none");
});
