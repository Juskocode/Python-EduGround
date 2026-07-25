import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { REPOSITORY_ROOT } from "../lib/paths.js";

const generatedDirectories = [
  "artifacts",
  "coverage",
  "htmlcov",
  "dist",
  "playwright-report",
  "test-results",
];
const disposableNames = new Set([
  ".coverage",
  ".DS_Store",
  ".mypy_cache",
  ".nyc_output",
  ".pytest_cache",
  ".ruff_cache",
  "__pycache__",
]);
const disposableSuffixes = [
  ".log",
  ".pyc",
  ".swp",
  ".swo",
  ".tsbuildinfo",
];

function isDisposableFile(name) {
  return (
    disposableSuffixes.some((suffix) => name.endsWith(suffix)) ||
    /^(?:npm|pnpm|yarn)-(?:debug|error)\.log(?:\..*)?$/u.test(name) ||
    name.endsWith("~")
  );
}

async function removeDisposableEntries(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (disposableNames.has(entry.name) || isDisposableFile(entry.name)) {
      await rm(target, { force: true, recursive: true });
      continue;
    }
    if (entry.isDirectory()) {
      await removeDisposableEntries(target);
    }
  }
}

for (const relativePath of generatedDirectories) {
  await rm(path.join(REPOSITORY_ROOT, relativePath), {
    force: true,
    recursive: true,
  });
}

await removeDisposableEntries(REPOSITORY_ROOT);
console.log(
  "Removed build/test output, logs, swap files, and disposable language caches.",
);
