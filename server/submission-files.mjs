import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { getExerciseFile } from "./exercise-manifest.mjs";

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DISABLED_VALUES = new Set(["", "0", "false", "off", "disabled", "none"]);

function isInside(parentDirectory, candidate) {
  const child = relative(parentDirectory, candidate);
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function requireSafeSegment(value, pattern, label) {
  if (typeof value !== "string" || basename(value) !== value || !pattern.test(value)) {
    throw new Error(`${label} is not a safe directory segment.`);
  }
  return value;
}

async function ensureChildDirectory(parentDirectory, segment) {
  const candidate = resolve(parentDirectory, segment);
  if (!isInside(parentDirectory, candidate)) throw new Error("Submission path left its parent directory.");

  try {
    await mkdir(candidate, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  const stats = await lstat(candidate);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Submission directory must be a real directory, not a link.");
  }
  const actual = await realpath(candidate);
  if (!isInside(parentDirectory, actual)) throw new Error("Submission directory escaped its root.");
  return actual;
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch {
    // Some filesystems do not support fsync on directories. The file was still atomically renamed.
  } finally {
    await handle?.close().catch(() => {});
  }
}

function disabledResult(exercise, status) {
  return { status, relativePath: exercise.relativePath, bytes: null };
}

export function resolveSubmissionsDirectory(environment, defaultDirectory) {
  if (!Object.hasOwn(environment, "SUBMISSIONS_DIR")) return resolve(defaultDirectory);
  const configured = String(environment.SUBMISSIONS_DIR || "").trim();
  if (DISABLED_VALUES.has(configured.toLowerCase())) return null;
  return resolve(configured);
}

export function createSubmissionFileStore({
  rootDirectory,
  forbiddenDirectories = [],
  logger = console,
} = {}) {
  const configuredRoot = rootDirectory ? resolve(rootDirectory) : null;
  const forbiddenRoots = forbiddenDirectories.map((directory) => resolve(directory));
  const saveQueues = new Map();
  let preparedRoot;
  let warned = false;

  async function prepareRoot() {
    if (!configuredRoot) return null;
    if (!preparedRoot) {
      preparedRoot = (async () => {
        for (const forbiddenRoot of forbiddenRoots) {
          if (configuredRoot === forbiddenRoot || isInside(forbiddenRoot, configuredRoot)) {
            throw new Error("SUBMISSIONS_DIR cannot be inside a protected repository directory.");
          }
        }
        await mkdir(configuredRoot, { recursive: true, mode: 0o700 });
        const rootStats = await lstat(configuredRoot);
        if (!rootStats.isDirectory()) throw new Error("SUBMISSIONS_DIR is not a directory.");
        const actualRoot = await realpath(configuredRoot);
        for (const forbiddenRoot of forbiddenRoots) {
          if (actualRoot === forbiddenRoot || isInside(forbiddenRoot, actualRoot)) {
            throw new Error("SUBMISSIONS_DIR cannot be inside a protected repository directory.");
          }
        }
        return actualRoot;
      })();
    }
    return preparedRoot;
  }

  async function writeSubmission({ userId, exerciseId, content }, exercise) {
    let temporaryPath;
    try {
      requireSafeSegment(userId, USER_ID_PATTERN, "User id");
      if (typeof content !== "string") throw new Error("Submission content must be text.");

      const root = await prepareRoot();
      const userDirectory = await ensureChildDirectory(root, userId.toLowerCase());
      const chapterDirectory = await ensureChildDirectory(
        userDirectory,
        requireSafeSegment(exercise.chapterDirectory, /^[A-Za-z0-9 &,\-]+$/u, "Chapter")
      );
      const targetPath = resolve(chapterDirectory, exercise.filename);
      if (!isInside(chapterDirectory, targetPath)) throw new Error("Submission file escaped its chapter.");

      temporaryPath = resolve(
        chapterDirectory,
        `.${exercise.filename}.${process.pid}.${randomUUID()}.tmp`
      );
      if (!isInside(chapterDirectory, temporaryPath)) throw new Error("Temporary file escaped its chapter.");

      const handle = await open(temporaryPath, "wx", 0o600);
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporaryPath, targetPath);
      temporaryPath = null;
      await syncDirectory(chapterDirectory);

      return {
        status: "saved",
        relativePath: exercise.relativePath,
        bytes: Buffer.byteLength(content),
      };
    } catch (error) {
      if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => {});
      if (!warned) {
        warned = true;
        logger.warn("Submission file mirror is unavailable; PostgreSQL remains authoritative.", {
          error: error?.code || error?.name || "Error",
        });
      }
      return disabledResult(exercise, "unavailable");
    }
  }

  async function save({ userId, exerciseId, content }) {
    const exercise = getExerciseFile(exerciseId);
    if (!exercise) throw new Error("Exercise is not present in the trusted server manifest.");
    if (!configuredRoot) return disabledResult(exercise, "disabled");

    const queueKey = `${String(userId).toLowerCase()}:${exerciseId}`;
    const previousSave = saveQueues.get(queueKey) || Promise.resolve();
    const currentSave = previousSave
      .catch(() => {})
      .then(() => writeSubmission({ userId, exerciseId, content }, exercise));
    saveQueues.set(queueKey, currentSave);
    currentSave.then(
      () => {
        if (saveQueues.get(queueKey) === currentSave) saveQueues.delete(queueKey);
      },
      () => {
        if (saveQueues.get(queueKey) === currentSave) saveQueues.delete(queueKey);
      }
    );
    return currentSave;
  }

  return {
    configured: Boolean(configuredRoot),
    rootDirectory: configuredRoot,
    save,
  };
}
