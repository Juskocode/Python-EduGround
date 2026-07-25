import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const generatedDirectories = [
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
  await rm(path.join(repositoryRoot, relativePath), {
    force: true,
    recursive: true,
  });
}

await removeDisposableEntries(repositoryRoot);
console.log("Removed browser reports and disposable operating-system or Python cache files.");
