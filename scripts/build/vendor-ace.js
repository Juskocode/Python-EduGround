#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PUBLIC_ROOT, REPOSITORY_ROOT } from "../lib/paths.js";

const packageRoot = join(REPOSITORY_ROOT, "node_modules", "ace-builds");
const sourceRoot = join(packageRoot, "src-min-noconflict");
const destinationRoot = join(PUBLIC_ROOT, "assets", "vendor", "ace");

const runtimeFiles = [
  "ace.js",
  "ext-language_tools.js",
  "keybinding-sublime.js",
  "keybinding-vim.js",
  "mode-python.js",
  "theme-monokai.js",
];

await mkdir(destinationRoot, { recursive: true });

for (const filename of runtimeFiles) {
  const sourcePath = join(sourceRoot, filename);
  const destinationPath = join(destinationRoot, filename);

  if (filename.startsWith("keybinding-")) {
    const source = await readFile(sourcePath, "utf8");
    const normalized = source.replace(/[ \t]+$/gm, "").replace(/\n*$/, "\n");
    await writeFile(destinationPath, normalized);
  } else {
    await copyFile(sourcePath, destinationPath);
  }
}

await copyFile(join(packageRoot, "LICENSE"), join(destinationRoot, "LICENSE"));

console.log(`Vendored Ace 1.44.0 (${runtimeFiles.length} runtime files).`);
