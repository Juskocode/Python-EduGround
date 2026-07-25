#!/usr/bin/env node

import { access, readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

import {
  GENERATED_CURRICULUM_ROOT,
  PUBLIC_ROOT,
  REPOSITORY_ROOT,
  TEST_ROOT,
} from "../lib/paths.js";

const failures = [];
const ignoredWalkDirectories = new Set([
  "artifacts",
  "backups",
  "coverage",
  "dist",
  "htmlcov",
  "node_modules",
  "playwright-report",
  "secrets",
  "submissions",
  "test-results",
]);
const allowedTopLevelDirectories = new Set([
  ".git",
  ".github",
  ".idea",
  ".mypy_cache",
  ".nyc_output",
  ".openai",
  ".pytest_cache",
  ".ruff_cache",
  ".vscode",
  "__pycache__",
  "artifacts",
  "backups",
  "coverage",
  "curriculum",
  "database",
  "dist",
  "docs",
  "htmlcov",
  "node_modules",
  "playwright-report",
  "public",
  "scripts",
  "secrets",
  "src",
  "submissions",
  "test-results",
  "tests",
]);
const allowedTopLevelFiles = new Set([
  ".dockerignore",
  ".env.example",
  ".gitignore",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "Dockerfile",
  "LICENSE",
  "LICENSE.md",
  "NOTICE",
  "NOTICE.md",
  "README.md",
  "SECURITY.md",
  "docker-compose.ai.yml",
  "docker-compose.yml",
  "package-lock.json",
  "package.json",
  "playwright.config.js",
  "tsconfig.server.json",
]);
const allowedTestSupportExtensions = new Set([
  ".js",
  ".json",
  ".sql",
  ".txt",
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
  "public/app/bootstrap",
  "public/app/feedback",
  "public/app/routing",
  "public/features/exercise",
  "scripts",
  "src/server",
  "src/server/api/routes",
  "tests/e2e",
  "tests/integration",
  "tests/unit/client",
  "tests/unit/server",
];
const requiredTypeScriptFiles = [
  "src/server/api/routes/health-route.ts",
  "src/server/curriculum/exercise-manifest.ts",
  "src/server/http/responses.ts",
  "src/server/http/static-files.ts",
  "src/server/paths.ts",
  "tsconfig.server.json",
];
const requiredBrowserBoundaryFiles = [
  "public/app/bootstrap/theme-bootstrap.js",
  "public/app/course-app.js",
  "public/app/feedback/audio-feedback.js",
  "public/app/routing/course-router.js",
  "public/features/exercise/solution-shape.js",
  "public/features/exercise/workbench-mode.css",
  "public/workers/python-runner-client.js",
  "public/workers/python-runner-worker.js",
];
const legacyServerJavaScriptFiles = new Set([
  "api/handler.js",
  "curriculum/submission-files.js",
  "main.js",
  "persistence/database-config.js",
  "persistence/database.js",
  "persistence/learner-state.js",
  "persistence/migrate.js",
  "persistence/migration-manifest.js",
  "security/credentials.js",
  "security/runtime-policy.js",
]);
const generatedDirectoryContracts = [
  {
    directory: GENERATED_CURRICULUM_ROOT,
    files: new Set(["solution-code.js"]),
  },
  {
    directory: join(PUBLIC_ROOT, "content/generated"),
    files: new Set(["starter-code.js"]),
  },
];

async function exists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function walk(
  directory,
  visit,
  ignoredDirectories = ignoredWalkDirectories,
) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const candidate = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(candidate, visit, ignoredDirectories);
    } else if (entry.isFile()) {
      visit(candidate);
    }
  }
}

function isDisposableTopLevelFile(name) {
  return (
    name === ".coverage" ||
    name === ".DS_Store" ||
    /^\.env(?:\.local|\..+\.local)?$/u.test(name) ||
    /^(?:npm|pnpm|yarn)-(?:debug|error)\.log(?:\..*)?$/u.test(name) ||
    /\.(?:log|swp|swo|tsbuildinfo)$/u.test(name) ||
    name.endsWith("~")
  );
}

function isTransientTopLevelDirectory(name) {
  return [
    ".compose-gate.",
    ".credential-rotation.",
    ".restore-drill-secrets.",
  ].some((prefix) => name.startsWith(prefix));
}

function validateTestFile(file) {
  const pathFromTests = relative(TEST_ROOT, file).replaceAll("\\", "/");
  if (pathFromTests === "README.md") return;

  const parts = pathFromTests.split("/");
  const inSupportDirectory = (
    (parts[0] === "e2e" && parts[1] === "support") ||
    (parts[0] === "integration" && parts[1] === "support") ||
    (
      parts[0] === "unit" &&
      ["client", "server"].includes(parts[1]) &&
      parts[2] === "support"
    )
  );

  if (inSupportDirectory) {
    if (!allowedTestSupportExtensions.has(extname(file))) {
      failures.push(
        `Test support file has an unsupported extension: tests/${pathFromTests}`,
      );
    }
    return;
  }

  const validTestFile = (
    /^e2e\/[^/]+\.spec\.js$/u.test(pathFromTests) ||
    /^integration\/[^/]+\.integration\.js$/u.test(pathFromTests) ||
    /^unit\/(?:client|server)\/[^/]+\.test\.js$/u.test(pathFromTests)
  );
  if (!validTestFile) {
    failures.push(
      "Test files must use the layer suffix and keep helpers under support/: " +
      `tests/${pathFromTests}`,
    );
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
for (const browserFile of requiredBrowserBoundaryFiles) {
  if (!(await exists(resolve(REPOSITORY_ROOT, browserFile)))) {
    failures.push(`Required browser boundary is missing: ${browserFile}`);
  }
}
for (const directory of obsoleteDirectories) {
  if (await exists(resolve(REPOSITORY_ROOT, directory))) {
    failures.push(`Obsolete top-level directory still exists: ${directory}`);
  }
}

const rootEntries = await readdir(REPOSITORY_ROOT, { withFileTypes: true });
for (const entry of rootEntries) {
  if (entry.isDirectory()) {
    if (
      !allowedTopLevelDirectories.has(entry.name) &&
      !obsoleteDirectories.includes(entry.name) &&
      !isTransientTopLevelDirectory(entry.name)
    ) {
      failures.push(`Unexpected top-level directory: ${entry.name}`);
    }
    continue;
  }
  if (!entry.isFile()) {
    failures.push(`Unexpected top-level filesystem entry: ${entry.name}`);
    continue;
  }
  if (
    !allowedTopLevelFiles.has(entry.name) &&
    !isDisposableTopLevelFile(entry.name)
  ) {
    failures.push(`Unexpected top-level file: ${entry.name}`);
    continue;
  }
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

await walk(TEST_ROOT, validateTestFile, new Set());

const serverRoot = resolve(REPOSITORY_ROOT, "src/server");
await walk(serverRoot, (file) => {
  if (extname(file) !== ".js") return;
  const pathFromServer = relative(serverRoot, file).replaceAll("\\", "/");
  if (!legacyServerJavaScriptFiles.has(pathFromServer)) {
    failures.push(
      "New server modules must use strict TypeScript; unexpected JavaScript: " +
      `src/server/${pathFromServer}`,
    );
  }
}, new Set());
for (const legacyFile of legacyServerJavaScriptFiles) {
  if (!(await exists(join(serverRoot, legacyFile)))) {
    failures.push(
      "Remove migrated files from the legacy server JavaScript allowlist: " +
      `src/server/${legacyFile}`,
    );
  }
}

await walk(PUBLIC_ROOT, (file) => {
  const pathFromPublic = relative(PUBLIC_ROOT, file);
  if (extname(file) === ".py" || /solution-code|solutions\.generated/iu.test(pathFromPublic)) {
    failures.push(`Private solution material leaked into public/: ${pathFromPublic}`);
  }
}, new Set());

for (const contract of generatedDirectoryContracts) {
  if (!(await exists(contract.directory))) {
    failures.push(
      "Required generated directory is missing: " +
      relative(REPOSITORY_ROOT, contract.directory),
    );
    continue;
  }
  const entries = await readdir(contract.directory, { withFileTypes: true });
  const presentFiles = new Set();
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isFile() || !contract.files.has(entry.name)) {
      failures.push(
        "Unexpected generated artifact: " +
        relative(REPOSITORY_ROOT, join(contract.directory, entry.name)),
      );
      continue;
    }
    presentFiles.add(entry.name);
  }
  for (const requiredFile of contract.files) {
    if (!presentFiles.has(requiredFile)) {
      failures.push(
        "Required generated artifact is missing: " +
        relative(REPOSITORY_ROOT, join(contract.directory, requiredFile)),
      );
    }
  }
}

const index = await readFile(join(PUBLIC_ROOT, "index.html"), "utf8");
for (const match of index.matchAll(/\b(?:href|src)="(\/[^"#?]+)"/gu)) {
  const publicPath = join(PUBLIC_ROOT, match[1].slice(1));
  if (!(await exists(publicPath))) {
    failures.push(`public/index.html references a missing asset: ${match[1]}`);
  }
}

if (failures.length > 0) {
  console.error("Repository structure validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Repository structure is organized and public/private boundaries are intact.");
