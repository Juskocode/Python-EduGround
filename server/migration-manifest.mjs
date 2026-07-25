import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_MIGRATIONS_DIRECTORY = resolve(
  SERVER_DIRECTORY,
  "../db/migrations"
);
export const MIGRATION_FILENAME_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/u;

export async function listMigrationNames(
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY
) {
  const filenames = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() && MIGRATION_FILENAME_PATTERN.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort();

  if (filenames.length === 0) {
    throw new Error(`No migration files were found in ${migrationsDirectory}.`);
  }
  return filenames;
}

export async function loadMigrationManifest(
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY
) {
  const filenames = await listMigrationNames(migrationsDirectory);
  return Promise.all(
    filenames.map(async (name) => {
      const sql = await readFile(join(migrationsDirectory, name), "utf8");
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    })
  );
}
