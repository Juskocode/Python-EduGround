#!/usr/bin/env node

import { access, readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

import {
  GENERATED_CURRICULUM_ROOT,
  PUBLIC_ROOT,
  REPOSITORY_ROOT,
} from "../lib/paths.js";

const failures = [];
const ignoredWalkDirectories = new Set([
  "backups",
  "dist",
  "node_modules",
  "playwright-report",
  "secrets",
  "submissions",
  "test-results",
]);
const obsoleteDirectories = [
  "assets",
  "db",
  "docker",
  "e2e",
  "server",
  "test-data",
];
const requiredDirectories = [
  "curriculum",
  "database",
  "docs",
  "public",
  "scripts",
  "src/server",
  "tests/e2e",
  "tests/integration",
  "tests/unit/client",
  "tests/unit/server",
];
const requiredTypeScriptFiles = [
  "src/server/curriculum/exercise-manifest.ts",
  "src/server/http/responses.ts",
  "src/server/http/static-files.ts",
  "src/server/paths.ts",
  "tsconfig.server.json",
];

async function exists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory, visit) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ignoredWalkDirectories.has(entry.name)) continue;
    const candidate = join(directory, entry.name);
    if (entry.isDirectory()) await walk(candidate, visit);
    else if (entry.isFile()) visit(candidate);
  }
}

for (const directory of requiredDirectories) {
  if (!(await exists(resolve(REPOSITORY_ROOT, directory)))) {
    failures.push(`Required architecture directory is missing: ${directory}`);
  }
}
for (const sourceFile of requiredTypeScriptFiles) {
  if (!(await exists(resolve(REPOSITORY_ROOT, sourceFile)))) {
    failures.push(`Required TypeScript contract is missing: ${sourceFile}`);
  }
}
for (const directory of obsoleteDirectories) {
  if (await exists(resolve(REPOSITORY_ROOT, directory))) {
    failures.push(`Obsolete top-level directory still exists: ${directory}`);
  }
}

const rootEntries = await readdir(REPOSITORY_ROOT, { withFileTypes: true });
for (const entry of rootEntries) {
  if (!entry.isFile()) continue;
  const extension = extname(entry.name);
  if ([".css", ".mjs", ".ts"].includes(extension)) {
    failures.push(`Loose runtime file is not allowed at repository root: ${entry.name}`);
  }
  if (extension === ".js" && entry.name !== "playwright.config.js") {
    failures.push(`Loose JavaScript file is not allowed at repository root: ${entry.name}`);
  }
}

await walk(REPOSITORY_ROOT, (file) => {
  const pathFromRoot = relative(REPOSITORY_ROOT, file);
  if (
    extname(file) === ".mjs" &&
    !pathFromRoot.startsWith("node_modules/") &&
    !pathFromRoot.startsWith("public/assets/vendor/")
  ) {
    failures.push(`Native ESM should use package .js files, not .mjs: ${pathFromRoot}`);
  }
});

await walk(PUBLIC_ROOT, (file) => {
  const pathFromPublic = relative(PUBLIC_ROOT, file);
  if (extname(file) === ".py" || /solution-code|solutions\.generated/iu.test(pathFromPublic)) {
    failures.push(`Private solution material leaked into public/: ${pathFromPublic}`);
  }
});

const index = await readFile(join(PUBLIC_ROOT, "index.html"), "utf8");
for (const match of index.matchAll(/\b(?:href|src)="(\/[^"#?]+)"/gu)) {
  const publicPath = join(PUBLIC_ROOT, match[1].slice(1));
  if (!(await exists(publicPath))) {
    failures.push(`public/index.html references a missing asset: ${match[1]}`);
  }
}

if (!(await exists(join(GENERATED_CURRICULUM_ROOT, "solution-code.js")))) {
  failures.push("Private generated solution bundle is missing from curriculum/generated.");
}

if (failures.length > 0) {
  console.error("Repository structure validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Repository structure is organized and public/private boundaries are intact.");
