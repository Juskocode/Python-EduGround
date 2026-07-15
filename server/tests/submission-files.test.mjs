import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { EXERCISE_COUNT, getExerciseFile, listExerciseFiles } from "../exercise-manifest.mjs";
import {
  createSubmissionFileStore,
  resolveSubmissionsDirectory,
} from "../submission-files.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const USER_ID = "71bf65d1-0875-41a0-91fa-ad943adf7fe8";
const SILENT_LOGGER = { warn() {} };

async function temporaryDirectory(context, name = "eduground-submissions-") {
  const directory = await mkdtemp(join(tmpdir(), name));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("trusted exercise manifest follows every repository chapter and exercise order", async () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(await readFile(resolve(REPOSITORY_ROOT, "exercise-data.js"), "utf8"), context);

  const expected = context.window.COURSE_DATA.chapters.flatMap((chapter) =>
    chapter.exercises.map((exercise, index) => ({
      exerciseId: exercise.id,
      chapterId: chapter.id,
      chapterDirectory: chapter.folder,
      filename: `ex${String(index).padStart(2, "0")}.py`,
      relativePath: `${chapter.folder}/ex${String(index).padStart(2, "0")}.py`,
    }))
  );

  assert.equal(EXERCISE_COUNT, 92);
  assert.deepEqual(listExerciseFiles(), JSON.parse(JSON.stringify(expected)));
  assert.equal(getExerciseFile("py01-first-programs").relativePath, "Py01 First Programs/ex00.py");
  assert.equal(getExerciseFile("py08-knapsack").relativePath, "Py08 Recursion/ex10.py");
  assert.equal(getExerciseFile("not-an-exercise"), null);
});

test("submission mirror writes canonical chapter files atomically", async (context) => {
  const root = await temporaryDirectory(context);
  const store = createSubmissionFileStore({ rootDirectory: root, logger: SILENT_LOGGER });

  const first = await store.save({
    userId: USER_ID,
    exerciseId: "py01-first-programs",
    content: "print('first')\n",
  });
  assert.deepEqual(first, {
    status: "saved",
    relativePath: "Py01 First Programs/ex00.py",
    bytes: 15,
  });

  const second = await store.save({
    userId: USER_ID.toUpperCase(),
    exerciseId: "py01-first-programs",
    content: "print('replacement')\n",
  });
  assert.equal(second.status, "saved");

  const chapter = join(root, USER_ID, "Py01 First Programs");
  assert.equal(await readFile(join(chapter, "ex00.py"), "utf8"), "print('replacement')\n");
  assert.deepEqual(await readdir(chapter), ["ex00.py"]);
});

test("concurrent saves to one exercise preserve request order", async (context) => {
  const root = await temporaryDirectory(context);
  const store = createSubmissionFileStore({ rootDirectory: root, logger: SILENT_LOGGER });

  const firstSave = store.save({
    userId: USER_ID,
    exerciseId: "py08-knapsack",
    content: "version = 'first'\n",
  });
  const secondSave = store.save({
    userId: USER_ID,
    exerciseId: "py08-knapsack",
    content: "version = 'second'\n",
  });
  await Promise.all([firstSave, secondSave]);

  assert.equal(
    await readFile(join(root, USER_ID, "Py08 Recursion", "ex10.py"), "utf8"),
    "version = 'second'\n"
  );
});

test("submission mirror rejects traversal, symlink escapes, and solution directories", async (context) => {
  const root = await temporaryDirectory(context);
  const outside = await temporaryDirectory(context, "eduground-outside-");
  const store = createSubmissionFileStore({ rootDirectory: root, logger: SILENT_LOGGER });

  assert.equal(
    (
      await store.save({
        userId: "../../outside",
        exerciseId: "py01-first-programs",
        content: "unsafe\n",
      })
    ).status,
    "unavailable"
  );

  await symlink(outside, join(root, USER_ID), "dir");
  assert.equal(
    (
      await store.save({
        userId: USER_ID,
        exerciseId: "py01-first-programs",
        content: "unsafe\n",
      })
    ).status,
    "unavailable"
  );
  assert.deepEqual(await readdir(outside), []);

  for (const protectedDirectory of [
    resolve(REPOSITORY_ROOT, "Py01 First Programs"),
    resolve(REPOSITORY_ROOT, "assets"),
  ]) {
    const forbiddenTarget = join(protectedDirectory, "submission-test-must-not-exist");
    const forbiddenStore = createSubmissionFileStore({
      rootDirectory: forbiddenTarget,
      forbiddenDirectories: [protectedDirectory],
      logger: SILENT_LOGGER,
    });
    assert.equal(
      (
        await forbiddenStore.save({
          userId: USER_ID,
          exerciseId: "py01-first-programs",
          content: "unsafe\n",
        })
      ).status,
      "unavailable"
    );
    await assert.rejects(readFile(forbiddenTarget), { code: "ENOENT" });
  }
});

test("submission mirror can be disabled and reports unavailable storage without losing DB semantics", async (context) => {
  const root = await temporaryDirectory(context);
  const blockingFile = join(root, "not-a-directory");
  await writeFile(blockingFile, "file");

  const disabled = createSubmissionFileStore({ rootDirectory: null, logger: SILENT_LOGGER });
  assert.deepEqual(
    await disabled.save({
      userId: USER_ID,
      exerciseId: "py01-first-programs",
      content: "print('db only')\n",
    }),
    { status: "disabled", relativePath: "Py01 First Programs/ex00.py", bytes: null }
  );

  const unavailable = createSubmissionFileStore({
    rootDirectory: blockingFile,
    logger: SILENT_LOGGER,
  });
  assert.equal(
    (
      await unavailable.save({
        userId: USER_ID,
        exerciseId: "py01-first-programs",
        content: "print('still in postgres')\n",
      })
    ).status,
    "unavailable"
  );

  assert.equal(resolveSubmissionsDirectory({}, join(root, "default")), join(root, "default"));
  assert.equal(resolveSubmissionsDirectory({ SUBMISSIONS_DIR: "off" }, join(root, "default")), null);
  assert.equal(resolveSubmissionsDirectory({ SUBMISSIONS_DIR: root }, "ignored"), root);
});
