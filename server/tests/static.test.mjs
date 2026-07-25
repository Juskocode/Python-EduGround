import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PUBLIC_ROOT_FILES, resolveRequestedFile } from "../static.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REAL_REPOSITORY_ROOT = await realpath(REPOSITORY_ROOT);

async function resolvePath(pathname) {
  return resolveRequestedFile(REPOSITORY_ROOT, REAL_REPOSITORY_ROOT, pathname);
}

test("required playground assets remain public", async () => {
  for (const pathname of [
    "/",
    "/course-app.js",
    "/geospace-ui.css",
    "/landing-snake.css",
    "/landing-snake.js",
    "/progress-snake.css",
    "/progress-snake-view.js",
    "/workbench-mode.css",
    "/landing-view.js",
    "/landing-ui.css",
    "/dashboard-model.js",
    "/dashboard-view.js",
    "/dashboard-ui.css",
    "/stage-recaps.js",
    "/stage-recap-view.js",
    "/stage-recap-ui.css",
    "/learning-clinics.js",
    "/concept-clinic.js",
    "/learning-clinic.css",
    "/learning-toolbox.js",
    "/class-materials.js",
    "/class-page.js",
    "/class-page.css",
    "/rounding-model.js",
    "/rounding-lab.js",
    "/rounding-lab.css",
    "/assessment-data.js",
    "/assessment-engine.js",
    "/assessment-room.js",
    "/assessment-ui.css",
    "/starter-code.js",
    "/solution-shape.js",
    "/test-data/tests-py01-03.js",
    "/test-data/tests-py12.js",
    "/assets/vendor/ace/ace.js",
    "/assets/illustrations/problem-solving/decomposition-roadmap.svg",
    "/assets/illustrations/problem-solving/dynamic-programming-table.svg",
    "/assets/illustrations/problem-solving/knapsack-choice.svg",
    "/assets/illustrations/problem-solving/problem-pattern-map.svg",
    "/docs/screenshots/dashboard.jpg",
  ]) {
    const result = await resolvePath(pathname);
    assert.equal(result.error, undefined, `${pathname} should be public`);
    assert.equal(result.fileStats.isFile(), true);
  }
});

test("the toolbox data loads before the application reads it", async () => {
  const index = await readFile(resolve(REPOSITORY_ROOT, "index.html"), "utf8");
  const learningContentPosition = index.indexOf('src="learning-content.js"');
  const toolboxPosition = index.indexOf('src="learning-toolbox.js"');
  const clinicsPosition = index.indexOf('src="learning-clinics.js"');
  const clinicViewPosition = index.indexOf('src="concept-clinic.js"');
  const classMaterialsPosition = index.indexOf('src="class-materials.js"');
  const classPagePosition = index.indexOf('src="class-page.js"');
  const roundingModelPosition = index.indexOf('src="rounding-model.js"');
  const roundingLabPosition = index.indexOf('src="rounding-lab.js"');
  const dashboardModelPosition = index.indexOf('src="dashboard-model.js"');
  const progressSnakePosition = index.indexOf('src="progress-snake-view.js"');
  const stageRecapsPosition = index.indexOf('src="stage-recaps.js"');
  const landingSnakePosition = index.indexOf('src="landing-snake.js"');
  const landingViewPosition = index.indexOf('src="landing-view.js"');
  const stageRecapViewPosition = index.indexOf('src="stage-recap-view.js"');
  const dashboardViewPosition = index.indexOf('src="dashboard-view.js"');
  const solutionShapePosition = index.indexOf('src="solution-shape.js"');
  const applicationPosition = index.indexOf('src="course-app.js"');

  assert.ok(learningContentPosition >= 0, "index should load learning-content.js");
  assert.ok(toolboxPosition > learningContentPosition, "toolbox data should load after the core learning content");
  assert.ok(clinicsPosition > toolboxPosition, "concept-clinic data should load after the core learning data");
  assert.ok(clinicViewPosition > clinicsPosition, "the concept-clinic view should load after its data");
  assert.ok(classMaterialsPosition > clinicViewPosition, "class materials should load after the core learning components");
  assert.ok(classPagePosition > classMaterialsPosition, "the class-page view should load after its materials");
  assert.ok(roundingModelPosition > classPagePosition, "the rounding model should load after the class-page components");
  assert.ok(roundingLabPosition > roundingModelPosition, "the rounding lab should load after its arithmetic model");
  assert.ok(stageRecapsPosition > roundingLabPosition, "stage recap content should load after course data");
  assert.ok(dashboardModelPosition > roundingLabPosition, "the dashboard model should load after course data");
  assert.ok(progressSnakePosition > dashboardModelPosition, "progress Snake visuals should load after their dashboard model");
  assert.ok(landingSnakePosition > dashboardModelPosition, "the landing game should load after course data");
  assert.ok(landingSnakePosition > progressSnakePosition, "the playable Snake should load after decorative progress visuals");
  assert.ok(landingViewPosition > landingSnakePosition, "the landing view should load after its game model");
  assert.ok(landingViewPosition > dashboardModelPosition, "the landing view should load after the dashboard model");
  assert.ok(stageRecapViewPosition > landingViewPosition, "the recap view should load after landing dependencies");
  assert.ok(dashboardViewPosition > dashboardModelPosition, "the dashboard view should load after its model");
  assert.ok(solutionShapePosition > dashboardViewPosition, "solution-shape rules should load after exercise data");
  assert.ok(applicationPosition > solutionShapePosition, "solution-shape rules should load before course-app.js");
  assert.ok(applicationPosition > dashboardViewPosition, "learning dependencies should load before course-app.js");
});

test("the dashboard stylesheet can refine the shared course UI", async () => {
  const index = await readFile(resolve(REPOSITORY_ROOT, "index.html"), "utf8");
  const courseUiPosition = index.indexOf('href="course-ui.css"');
  const dashboardUiPosition = index.indexOf('href="dashboard-ui.css"');
  const clinicUiPosition = index.indexOf('href="learning-clinic.css"');
  const roundingLabPosition = index.indexOf('href="rounding-lab.css"');
  const classPagePosition = index.indexOf('href="class-page.css"');
  const assessmentUiPosition = index.indexOf('href="assessment-ui.css"');
  const geospaceUiPosition = index.indexOf('href="geospace-ui.css"');
  const progressSnakePosition = index.indexOf('href="progress-snake.css"');
  const landingSnakePosition = index.indexOf('href="landing-snake.css"');
  const workbenchModePosition = index.indexOf('href="workbench-mode.css"');

  assert.ok(courseUiPosition >= 0, "index should load course-ui.css");
  assert.ok(dashboardUiPosition > courseUiPosition, "dashboard UI should load after shared course styles");
  assert.ok(clinicUiPosition > dashboardUiPosition, "concept-clinic styles should load after the shared dashboard layer");
  assert.ok(roundingLabPosition > clinicUiPosition, "rounding lab styles should load after the learning clinic");
  assert.ok(classPagePosition > roundingLabPosition, "class-page styles should be able to refine embedded learning components");
  assert.ok(assessmentUiPosition > classPagePosition, "assessment UI should remain the final feature stylesheet");
  assert.ok(geospaceUiPosition > assessmentUiPosition, "the shared geospace layer should refine every feature stylesheet");
  assert.ok(progressSnakePosition > geospaceUiPosition, "progress Snake styles should refine the shared geospace layer");
  assert.ok(landingSnakePosition > geospaceUiPosition, "the playable landing game should refine the shared geospace layer");
  assert.ok(landingSnakePosition > progressSnakePosition, "the playable game should remain above decorative progress styles");
  assert.ok(workbenchModePosition > landingSnakePosition, "the route-specific workbench shell should remain the final layout refinement");
});

test("the production image copies every root asset exposed by the static server", async () => {
  const dockerfile = await readFile(resolve(REPOSITORY_ROOT, "Dockerfile"), "utf8");
  for (const asset of PUBLIC_ROOT_FILES) {
    assert.equal(
      dockerfile.includes(asset),
      true,
      `Dockerfile should copy ${asset}`
    );
  }
});

test("assessment data, engine, and room controller load before the application", async () => {
  const index = await readFile(resolve(REPOSITORY_ROOT, "index.html"), "utf8");
  const dataPosition = index.indexOf('src="assessment-data.js"');
  const enginePosition = index.indexOf('src="assessment-engine.js"');
  const roomPosition = index.indexOf('src="assessment-room.js"');
  const applicationPosition = index.indexOf('src="course-app.js"');

  assert.ok(dataPosition >= 0, "index should load assessment-data.js");
  assert.ok(enginePosition > dataPosition, "assessment engine should load after its data");
  assert.ok(roomPosition > enginePosition, "assessment room should load after its engine");
  assert.ok(applicationPosition > roomPosition, "assessment scripts should load before course-app.js");
});

test("solutions and backend or deployment files are not served", async () => {
  for (const pathname of [
    "/solution-code.js",
    "/Py01%20First%20Programs/First%20Programs.py",
    "/Py12%20Problem%20Solving%20%26%20Dynamic%20Programming/Zero%20One%20Knapsack.py",
    "/scripts/serve.mjs",
    "/server/api.mjs",
    "/db/migrations/001_initial.sql",
    "/package.json",
    "/package-lock.json",
    "/docker-compose.yml",
    "/submissions/learner/Py01%20First%20Programs/ex00.py",
    "/.env",
    "/docs/CLASSROOM.md",
    "/docs/ROADMAP.md",
  ]) {
    const result = await resolvePath(pathname);
    assert.ok(result.error === 403 || result.error === 404, `${pathname} should be private`);
  }
});

test("encoded traversal and symlink escapes cannot leave the repository", async () => {
  for (const pathname of ["/assets/%2e%2e/package.json", "/assets/%2e%2e%2fpackage.json", "/%00"]) {
    const result = await resolvePath(pathname);
    assert.ok(result.error >= 400, `${pathname} should be rejected`);
  }
});
