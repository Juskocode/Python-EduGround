#!/usr/bin/env node

import { runMigrations } from "../../src/server/persistence/migrate.js";

try {
  await runMigrations();
} catch (error) {
  console.error(`Migration failed: ${error?.message || error}`);
  process.exitCode = 1;
}
