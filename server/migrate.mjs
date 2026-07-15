import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const SERVER_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATIONS_DIRECTORY = resolve(SERVER_DIRECTORY, "../db/migrations");
const MIGRATION_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/u;
const LOCK_ID = 1_947_331_017;

function tlsConfiguration(environment) {
  const value = environment.DATABASE_SSL?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "require"
    ? { rejectUnauthorized: false }
    : undefined;
}

export async function runMigrations({
  environment = process.env,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  logger = console,
} = {}) {
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => MIGRATION_PATTERN.test(filename))
    .sort();
  if (filenames.length === 0) {
    throw new Error(`No migration files were found in ${migrationsDirectory}.`);
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: Number(environment.DATABASE_CONNECT_TIMEOUT_MS || 5_000),
    application_name: "python-eduground-migrate",
    ssl: tlsConfiguration(environment),
  });

  await client.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    let applied = 0;
    for (const filename of filenames) {
      const sql = await readFile(join(migrationsDirectory, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
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
    return { applied, total: filenames.length };
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
      } catch {
        // Closing the session releases the lock as a final fallback.
      }
    }
    await client.end();
  }
}
