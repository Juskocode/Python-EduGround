#!/usr/bin/env node

import { spawn } from "node:child_process";

import { REPOSITORY_ROOT } from "../lib/paths.js";

if (!process.env.TEST_DATABASE_URL?.trim()) {
  console.error(
    "TEST_DATABASE_URL is required. Start an isolated PostgreSQL database before running the integration gate."
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--test", "tests/integration/database.integration.js"],
  {
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      REQUIRE_TEST_DATABASE: "true",
    },
    stdio: "inherit",
  }
);

child.once("error", (error) => {
  console.error(`Could not start the PostgreSQL integration test: ${error.message}`);
  process.exit(1);
});
child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`PostgreSQL integration test stopped by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
