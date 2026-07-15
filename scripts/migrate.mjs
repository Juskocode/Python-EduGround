#!/usr/bin/env node

import { runMigrations } from "../server/migrate.mjs";

try {
  await runMigrations();
} catch (error) {
  console.error(`Migration failed: ${error?.message || error}`);
  process.exitCode = 1;
}
