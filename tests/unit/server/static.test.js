import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveRequestedFile } from "../../../dist/server/http/static-files.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, "public");
const REAL_PUBLIC_ROOT = await realpath(PUBLIC_ROOT);

async function resolvePath(pathname) {
  return resolveRequestedFile(PUBLIC_ROOT, REAL_PUBLIC_ROOT, pathname);
}

test("required playground assets remain public from their organized URLs", async () => {
  for (const pathname of [
    "/",
    "/favicon.svg",
    "/app/bootstrap/theme-bootstrap.js",
    "/app/feedback/audio-feedback.js",
    "/features/exercise/solution-shape.js",
    "/app/course-app.js",
    "/styles/course-ui.css",
    "/styles/geospace-ui.css",
    "/features/exercise/workbench-mode.css",
    "/features/landing/landing-snake.css",
    "/features/landing/landing-snake.js",
    "/features/landing/landing-ui.css",
    "/features/landing/landing-view.js",
    "/features/progress/progress-snake.css",
    "/features/progress/progress-snake-view.js",
    "/features/dashboard/dashboard-model.js",
    "/features/dashboard/dashboard-view.js",
    "/features/dashboard/dashboard-ui.css",
    "/features/stage-recap/stage-recap-view.js",
    "/features/stage-recap/stage-recap-ui.css",
    "/features/clinic/concept-clinic.js",
    "/features/clinic/learning-clinic.css",
    "/features/classroom/class-page.js",
    "/features/classroom/class-page.css",
    "/features/pygame/pygame-labs.js",
    "/features/pygame/pygame-labs.css",
    "/features/rounding/rounding-model.js",
    "/features/rounding/rounding-lab.js",
    "/features/rounding/rounding-lab.css",
    "/features/assessment/assessment-engine.js",
    "/features/assessment/assessment-room.js",
    "/features/assessment/assessment-ui.css",
    "/content/exercise-data.js",
    "/content/class-materials.js",
    "/content/learning-content.js",
    "/content/learning-toolbox.js",
    "/content/learning-clinics.js",
    "/content/stage-recaps.js",
    "/content/assessment-data.js",
    "/content/generated/starter-code.js",
    "/content/exercise-tests/tests-py01-03.js",
    "/content/exercise-tests/tests-py12.js",
    "/content/exercise-tests/tests-py13.js",
    "/workers/python-runner-worker.js",
    "/assets/vendor/ace/ace.js",
    "/assets/illustrations/problem-solving/decomposition-roadmap.svg",
    "/assets/illustrations/problem-solving/dynamic-programming-table.svg",
    "/assets/illustrations/problem-solving/knapsack-choice.svg",
    "/assets/illustrations/problem-solving/problem-pattern-map.svg",
  ]) {
    const result = await resolvePath(pathname);
    assert.equal(result.error, undefined, `${pathname} should be public`);
    assert.equal(result.fileStats.isFile(), true);
  }
});

test("the toolbox data loads before the application reads it", async () => {
  const index = await readFile(resolve(PUBLIC_ROOT, "index.html"), "utf8");
  const learningContentPosition = index.indexOf('src="/content/learning-content.js"');
  const toolboxPosition = index.indexOf('src="/content/learning-toolbox.js"');
  const clinicsPosition = index.indexOf('src="/content/learning-clinics.js"');
  const clinicViewPosition = index.indexOf('src="/features/clinic/concept-clinic.js"');
  const classMaterialsPosition = index.indexOf('src="/content/class-materials.js"');
  const classPagePosition = index.indexOf('src="/features/classroom/class-page.js"');
  const pygameLabsPosition = index.indexOf('src="/features/pygame/pygame-labs.js"');
  const roundingModelPosition = index.indexOf('src="/features/rounding/rounding-model.js"');
  const roundingLabPosition = index.indexOf('src="/features/rounding/rounding-lab.js"');
  const dashboardModelPosition = index.indexOf('src="/features/dashboard/dashboard-model.js"');
  const progressSnakePosition = index.indexOf(
    'src="/features/progress/progress-snake-view.js"',
  );
  const stageRecapsPosition = index.indexOf('src="/content/stage-recaps.js"');
  const landingSnakePosition = index.indexOf('src="/features/landing/landing-snake.js"');
  const landingViewPosition = index.indexOf('src="/features/landing/landing-view.js"');
  const stageRecapViewPosition = index.indexOf(
    'src="/features/stage-recap/stage-recap-view.js"',
  );
  const dashboardViewPosition = index.indexOf('src="/features/dashboard/dashboard-view.js"');
  const solutionShapePosition = index.indexOf(
    'src="/features/exercise/solution-shape.js"',
  );
  const applicationPosition = index.indexOf('src="/app/course-app.js"');

  assert.ok(learningContentPosition >= 0, "index should load learning-content.js");
  assert.ok(toolboxPosition > learningContentPosition, "toolbox data should load after the core learning content");
  assert.ok(clinicsPosition > toolboxPosition, "concept-clinic data should load after the core learning data");
  assert.ok(clinicViewPosition > clinicsPosition, "the concept-clinic view should load after its data");
  assert.ok(classMaterialsPosition > clinicViewPosition, "class materials should load after the core learning components");
  assert.ok(classPagePosition > classMaterialsPosition, "the class-page view should load after its materials");
  assert.ok(pygameLabsPosition > classPagePosition, "the Pygame labs should load after the class-page components");
  assert.ok(roundingModelPosition > pygameLabsPosition, "the rounding model should load after the Pygame labs");
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
  const index = await readFile(resolve(PUBLIC_ROOT, "index.html"), "utf8");
  const courseUiPosition = index.indexOf('href="/styles/course-ui.css"');
  const dashboardUiPosition = index.indexOf('href="/features/dashboard/dashboard-ui.css"');
  const clinicUiPosition = index.indexOf('href="/features/clinic/learning-clinic.css"');
  const roundingLabPosition = index.indexOf('href="/features/rounding/rounding-lab.css"');
  const classPagePosition = index.indexOf('href="/features/classroom/class-page.css"');
  const pygameLabsPosition = index.indexOf('href="/features/pygame/pygame-labs.css"');
  const assessmentUiPosition = index.indexOf('href="/features/assessment/assessment-ui.css"');
  const geospaceUiPosition = index.indexOf('href="/styles/geospace-ui.css"');
  const progressSnakePosition = index.indexOf(
    'href="/features/progress/progress-snake.css"',
  );
  const landingSnakePosition = index.indexOf('href="/features/landing/landing-snake.css"');
  const workbenchModePosition = index.indexOf(
    'href="/features/exercise/workbench-mode.css"',
  );

  assert.ok(courseUiPosition >= 0, "index should load course-ui.css");
  assert.ok(dashboardUiPosition > courseUiPosition, "dashboard UI should load after shared course styles");
  assert.ok(clinicUiPosition > dashboardUiPosition, "concept-clinic styles should load after the shared dashboard layer");
  assert.ok(roundingLabPosition > clinicUiPosition, "rounding lab styles should load after the learning clinic");
  assert.ok(classPagePosition > roundingLabPosition, "class-page styles should be able to refine embedded learning components");
  assert.ok(pygameLabsPosition > classPagePosition, "Pygame lab styles should refine the classroom shell");
  assert.ok(assessmentUiPosition > pygameLabsPosition, "assessment UI should remain the final feature stylesheet");
  assert.ok(geospaceUiPosition > assessmentUiPosition, "the shared geospace layer should refine every feature stylesheet");
  assert.ok(progressSnakePosition > geospaceUiPosition, "progress Snake styles should refine the shared geospace layer");
  assert.ok(landingSnakePosition > geospaceUiPosition, "the playable landing game should refine the shared geospace layer");
  assert.ok(landingSnakePosition > progressSnakePosition, "the playable game should remain above decorative progress styles");
  assert.ok(workbenchModePosition > landingSnakePosition, "the route-specific workbench shell should remain the final layout refinement");
});

test("the production image copies the complete explicit public boundary", async () => {
  const [dockerfile, dockerignore] = await Promise.all([
    readFile(resolve(REPOSITORY_ROOT, "Dockerfile"), "utf8"),
    readFile(resolve(REPOSITORY_ROOT, ".dockerignore"), "utf8"),
  ]);

  assert.match(
    dockerfile,
    /COPY\s+(?:--chown=\S+\s+)?public\s+\.\/public/u,
    "Dockerfile should copy the public tree as one release unit",
  );
  assert.match(dockerignore, /^!public\/$/mu, ".dockerignore should include the public directory");
  assert.match(dockerignore, /^!public\/\*\*$/mu, ".dockerignore should include every public asset");
});

test("assessment data, engine, and room controller load before the application", async () => {
  const index = await readFile(resolve(PUBLIC_ROOT, "index.html"), "utf8");
  const dataPosition = index.indexOf('src="/content/assessment-data.js"');
  const enginePosition = index.indexOf('src="/features/assessment/assessment-engine.js"');
  const roomPosition = index.indexOf('src="/features/assessment/assessment-room.js"');
  const applicationPosition = index.indexOf('src="/app/course-app.js"');

  assert.ok(dataPosition >= 0, "index should load assessment-data.js");
  assert.ok(enginePosition > dataPosition, "assessment engine should load after its data");
  assert.ok(roomPosition > enginePosition, "assessment room should load after its engine");
  assert.ok(applicationPosition > roomPosition, "assessment scripts should load before course-app.js");
});

test("solutions, backend source, database files, and repository configuration are not served", async () => {
  for (const pathname of [
    "/solution-code.js",
    "/Py01%20First%20Programs/First%20Programs.py",
    "/curriculum/generated/solution-code.js",
    "/curriculum/solutions/Py01%20First%20Programs/First%20Programs.py",
    "/curriculum/solutions/Py12%20Problem%20Solving%20%26%20Dynamic%20Programming/Zero%20One%20Knapsack.py",
    "/scripts/database/migrate.js",
    "/src/server/main.js",
    "/src/server/api/handler.js",
    "/src/server/security/credentials.js",
    "/database/migrations/001_initial.sql",
    "/package.json",
    "/package-lock.json",
    "/docker-compose.yml",
    "/submissions/learner/Py01%20First%20Programs/ex00.py",
    "/.env",
    "/docs/CLASSROOM.md",
    "/docs/ROADMAP.md",
    "/docs/screenshots/dashboard.jpg",
  ]) {
    const result = await resolvePath(pathname);
    assert.ok(result.error === 403 || result.error === 404, `${pathname} should be private`);
  }
});

test("encoded traversal and symlink escapes cannot leave the public root", async () => {
  for (const pathname of [
    "/assets/%2e%2e/package.json",
    "/assets/%2e%2e%2fpackage.json",
    "/%00",
  ]) {
    const result = await resolvePath(pathname);
    assert.ok(result.error >= 400, `${pathname} should be rejected`);
  }
});
