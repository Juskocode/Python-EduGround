#!/usr/bin/env node

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const packageRoot = join(repositoryRoot, "node_modules", "ace-builds");
const sourceRoot = join(packageRoot, "src-min-noconflict");
const destinationRoot = join(repositoryRoot, "assets", "vendor", "ace");

const runtimeFiles = [
  "ace.js",
  "ext-language_tools.js",
  "mode-python.js",
  "theme-monokai.js",
];

await mkdir(destinationRoot, { recursive: true });

for (const filename of runtimeFiles) {
  await copyFile(join(sourceRoot, filename), join(destinationRoot, filename));
}

await copyFile(join(packageRoot, "LICENSE"), join(destinationRoot, "LICENSE"));

console.log(`Vendored Ace 1.44.0 (${runtimeFiles.length} runtime files).`);

