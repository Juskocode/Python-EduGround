#!/usr/bin/env node

try {
  const { runMigrations } = await import("../../dist/server/persistence/migrate.js");
  await runMigrations();
} catch (error) {
  if (error?.code === "ERR_MODULE_NOT_FOUND") {
    console.error("Migration failed: the compiled server is missing; run npm run build:server first.");
    process.exitCode = 1;
  } else {
    console.error(`Migration failed: ${error?.message || error}`);
    process.exitCode = 1;
  }
}
