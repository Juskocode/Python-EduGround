#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

import { PUBLIC_ROOT, REPOSITORY_ROOT, TEST_ROOT } from "../lib/paths.js";

const scanRoots = [
  PUBLIC_ROOT,
  join(REPOSITORY_ROOT, "src"),
  join(REPOSITORY_ROOT, "scripts"),
  TEST_ROOT,
];
const ignoredDirectories = new Set(["node_modules", "vendor"]);
const sourceFiles = [join(REPOSITORY_ROOT, "playwright.config.js")];

async function collectJavaScript(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const candidate = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectJavaScript(candidate);
    } else if (entry.isFile() && extname(entry.name) === ".js") {
      sourceFiles.push(candidate);
    }
  }
}

for (const root of scanRoots) {
  await collectJavaScript(root);
}

const failures = [];
for (const sourceFile of sourceFiles.sort()) {
  const result = spawnSync(process.execPath, ["--check", sourceFile], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(
      `${relative(REPOSITORY_ROOT, sourceFile)}\n${result.stderr || result.stdout}`
    );
  }
}

if (failures.length > 0) {
  console.error(`Syntax validation failed for ${failures.length} file(s):`);
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated JavaScript syntax for ${sourceFiles.length} organized source files.`);
