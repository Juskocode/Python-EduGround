import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DEFAULT_MIGRATIONS_DIRECTORY,
  listMigrationNames,
  loadMigrationManifest,
} from "../migration-manifest.mjs";
import { assertSafeMigrationRole, runMigrations } from "../migrate.mjs";

test("the default migration manifest is discovered from the repository", async () => {
  assert.deepEqual(await listMigrationNames(), [
    "001_initial.sql",
    "002_session_client_capability.sql",
  ]);
  assert.match(DEFAULT_MIGRATIONS_DIRECTORY, /db\/migrations$/u);
});

test("migration discovery is deterministic and ignores non-migration entries", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "eduground-migrations-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  await Promise.all([
    writeFile(join(directory, "010_add_runs.sql"), "SELECT 10;\n"),
    writeFile(join(directory, "002_add_users.sql"), "SELECT 2;\n"),
    writeFile(join(directory, "README.md"), "not a migration\n"),
    writeFile(join(directory, "2_bad_name.sql"), "SELECT 2;\n"),
    mkdir(join(directory, "003_directory.sql")),
  ]);

  assert.deepEqual(await listMigrationNames(directory), [
    "002_add_users.sql",
    "010_add_runs.sql",
  ]);
  const manifest = await loadMigrationManifest(directory);
  assert.deepEqual(
    manifest.map(({ name }) => name),
    ["002_add_users.sql", "010_add_runs.sql"]
  );
  assert.match(manifest[0].checksum, /^[a-f0-9]{64}$/u);
  assert.equal(manifest[0].sql, "SELECT 2;\n");
});

test("migration discovery and execution fail early on invalid configuration", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "eduground-empty-migrations-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  await assert.rejects(
    listMigrationNames(directory),
    /No migration files were found/u
  );
  await assert.rejects(
    runMigrations({ environment: {}, migrationsDirectory: directory }),
    /PostgreSQL is not configured/u
  );
});

test("the restricted runtime database role cannot own migrations", () => {
  assert.throws(
    () => assertSafeMigrationRole("eduground_app"),
    /must not be the reserved runtime role eduground_app/u
  );
  assert.throws(
    () => assertSafeMigrationRole("EDUGROUND_APP"),
    /must not be the reserved runtime role eduground_app/u
  );
  assert.doesNotThrow(() => assertSafeMigrationRole("eduground"));
});
