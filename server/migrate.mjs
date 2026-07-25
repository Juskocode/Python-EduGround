import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import {
  databaseConnectionOptions,
  parseBoundedDatabaseInteger,
} from "./database-config.mjs";
import {
  DEFAULT_MIGRATIONS_DIRECTORY,
  loadMigrationManifest,
} from "./migration-manifest.mjs";

const { Client } = pg;
export const MIGRATION_LOCK_ID = 1_947_331_017;

export function assertSafeMigrationRole(roleName) {
  if (String(roleName || "").toLowerCase() === "eduground_app") {
    throw new Error(
      "Migration owner must not be the reserved runtime role eduground_app. Use a separate owner credential for migrations."
    );
  }
}

async function acquireMigrationLock(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const result = await client.query(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [MIGRATION_LOCK_ID]
    );
    if (result.rows[0]?.acquired === true) return;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(
        `Could not acquire the migration lock within ${timeoutMs}ms. Another migration may still be running.`
      );
    }
    await delay(Math.min(250, remainingMs));
  }
}

export async function runMigrations({
  environment = process.env,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  logger = console,
} = {}) {
  const connection = databaseConnectionOptions(environment, {
    applicationName: "python-eduground-migrate",
    connectionTimeoutDefault: 5_000,
    required: true,
  });
  const lockTimeoutMs = parseBoundedDatabaseInteger(
    environment,
    "MIGRATION_LOCK_TIMEOUT_MS",
    {
      defaultValue: 30_000,
      minimum: 1_000,
      maximum: 300_000,
    }
  );
  const migrations = await loadMigrationManifest(migrationsDirectory);
  const client = new Client(connection);

  await client.connect();
  let locked = false;
  try {
    const identity = await client.query("SELECT current_user AS role_name");
    assertSafeMigrationRole(identity.rows[0]?.role_name);
    await acquireMigrationLock(client, lockTimeoutMs);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const knownMigrationNames = migrations.map((migration) => migration.name);
    const unknownMigrations = await client.query(
      `SELECT name
         FROM schema_migrations
        WHERE NOT (name = ANY($1::text[]))
        ORDER BY name`,
      [knownMigrationNames]
    );
    if (unknownMigrations.rowCount > 0) {
      throw new Error(
        `Database contains migrations not present in this release: ${unknownMigrations.rows
          .map((row) => row.name)
          .join(", ")}. Deploy a compatible release instead of rolling the schema backward.`
      );
    }

    let applied = 0;
    for (const { name: filename, sql, checksum } of migrations) {
      const existing = await client.query(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [filename]
      );
      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${filename} changed after it was applied.`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [filename, checksum]
        );
        await client.query("COMMIT");
        applied += 1;
        logger.log(`Applied migration ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    logger.log(`Database is current (${applied} migration${applied === 1 ? "" : "s"} applied).`);
    return { applied, total: migrations.length };
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
      } catch {
        // Closing the session releases the lock as a final fallback.
      }
    }
    await client.end();
  }
}
