import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { REPOSITORY_ROOT } from "../lib/paths.js";

const generatedDirectories = [
  "artifacts/playwright",
  "playwright-report",
  "test-results",
];
const disposableNames = new Set([
  ".DS_Store",
  "__pycache__",
]);

async function removeDisposableEntries(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (disposableNames.has(entry.name) || entry.name.endsWith(".pyc")) {
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
console.log("Removed browser reports and disposable operating-system or Python cache files.");
