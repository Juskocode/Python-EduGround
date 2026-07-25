import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DatabaseConfigurationError,
  databaseConnectionOptions,
  databasePoolOptions,
  databaseTlsOptions,
  parseBoundedDatabaseInteger,
} from "../database-config.mjs";

test("database configuration remains optional when no connection settings exist", () => {
  assert.equal(databaseConnectionOptions({}), null);
});

test("enabled database TLS verifies server certificates by default", () => {
  assert.deepEqual(databaseTlsOptions({ DATABASE_SSL: "require" }), {
    rejectUnauthorized: true,
  });
  assert.deepEqual(
    databaseTlsOptions({
      DATABASE_SSL: "true",
      DATABASE_SSL_CA:
        "-----BEGIN CERTIFICATE-----\\ntrusted-ca\\n-----END CERTIFICATE-----",
    }),
    {
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----",
    }
  );
});

test("insecure database TLS is explicit, development-only, and cannot ignore a CA", () => {
  assert.deepEqual(
    databaseTlsOptions({
      DATABASE_SSL: "true",
      DATABASE_SSL_ALLOW_INSECURE: "true",
      NODE_ENV: "development",
    }),
    { rejectUnauthorized: false }
  );
  assert.throws(
    () =>
      databaseTlsOptions({
        DATABASE_SSL: "true",
        DATABASE_SSL_ALLOW_INSECURE: "true",
        NODE_ENV: "production",
      }),
    /development-only escape hatch.*forbidden in production/u
  );
  assert.throws(
    () =>
      databaseTlsOptions({
        DATABASE_SSL: "true",
        DATABASE_SSL_ALLOW_INSECURE: "true",
        DATABASE_SSL_CA: "trusted-ca",
      }),
    /cannot be combined/u
  );
  assert.throws(
    () =>
      databaseTlsOptions({
        DATABASE_SSL: "false",
        DATABASE_SSL_CA: "trusted-ca",
      }),
    /cannot be used when DATABASE_SSL is disabled/u
  );
});

test("PG environment settings preserve special-character passwords without URL parsing", () => {
  const password = "p@ss:/?#% with spaces and $variables";
  const options = databaseConnectionOptions({
    PGHOST: "postgres.internal",
    PGPORT: "6543",
    PGDATABASE: "education",
    PGUSER: "education_app",
    PGPASSWORD: password,
    DATABASE_CONNECT_TIMEOUT_MS: "7000",
  });

  assert.equal(options.connectionString, undefined);
  assert.equal(options.host, "postgres.internal");
  assert.equal(options.port, 6543);
  assert.equal(options.database, "education");
  assert.equal(options.user, "education_app");
  assert.equal(options.password, password);
  assert.equal(options.connectionTimeoutMillis, 7000);
  assert.equal(options.application_name, "python-eduground");
  assert.equal(options.ssl, false);
});

test("database passwords and certificate authorities can come from mounted secret files", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "eduground-db-secrets-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const passwordFile = join(directory, "password");
  const certificateFile = join(directory, "ca.pem");
  await writeFile(passwordFile, "file:p@ssword#with spaces\n", { mode: 0o600 });
  await writeFile(certificateFile, "trusted certificate\n", { mode: 0o600 });

  const options = databaseConnectionOptions({
    PGHOST: "postgres.internal",
    PGDATABASE: "education",
    PGUSER: "education_app",
    PGPASSWORD_FILE: passwordFile,
    DATABASE_SSL: "true",
    DATABASE_SSL_CA_FILE: certificateFile,
  });
  assert.equal(options.password, "file:p@ssword#with spaces");
  assert.deepEqual(options.ssl, {
    rejectUnauthorized: true,
    ca: "trusted certificate",
  });

  assert.throws(
    () =>
      databaseConnectionOptions({
        PGHOST: "postgres.internal",
        PGDATABASE: "education",
        PGUSER: "education_app",
        PGPASSWORD: "inline",
        PGPASSWORD_FILE: passwordFile,
      }),
    /Set only one of PGPASSWORD or PGPASSWORD_FILE/u
  );
});

test("DATABASE_URL takes precedence over ambient PG settings", () => {
  const options = databaseConnectionOptions({
    DATABASE_URL: "postgres://app:secret@database/education",
    PGHOST: "ignored",
    PGPASSWORD: "ignored",
  });
  assert.equal(
    options.connectionString,
    "postgres://app:secret@database/education"
  );
  assert.equal(options.host, undefined);
  assert.equal(options.password, undefined);
});

test("DATABASE_URL cannot override explicit TLS or timeout policy", () => {
  for (const query of [
    "sslmode=no-verify",
    "s%73lmode=no-verify",
    "%73slmode=no-verify",
    "ssl%6dode=no-verify",
    "sslmode=verify-full",
    "ssl=0",
    "sslrootcert=%2Frun%2Fsecrets%2Fca.pem",
    "statement_timeout=0",
    "options=-c%20statement_timeout%3D0",
  ]) {
    assert.throws(
      () =>
        databaseConnectionOptions({
          DATABASE_URL: `postgres://app:secret@database/education?${query}`,
        }),
      /Configure PostgreSQL TLS with DATABASE_SSL/u
    );
  }
  assert.throws(
    () =>
      databaseConnectionOptions({
        DATABASE_URL: "https://database.example/education",
      }),
    /postgres:\/\/ or postgresql:\/\//u
  );
});

test("partial PG configuration and invalid numeric limits fail closed", () => {
  assert.throws(
    () => databaseConnectionOptions({ PGHOST: "database" }),
    (error) =>
      error instanceof DatabaseConfigurationError &&
      /PGDATABASE, PGUSER/u.test(error.message)
  );
  assert.throws(
    () =>
      databaseConnectionOptions({
        PGHOST: "database",
        PGDATABASE: "education",
        PGUSER: "app",
        PGPORT: "70000",
      }),
    /PGPORT must be between 1 and 65535/u
  );
  assert.throws(
    () =>
      databaseConnectionOptions({
        DATABASE_URL: "postgres://database/education",
        DATABASE_CONNECT_TIMEOUT_MS: "unbounded",
      }),
    /DATABASE_CONNECT_TIMEOUT_MS must be an integer/u
  );
  assert.throws(
    () => databasePoolOptions({ DATABASE_POOL_SIZE: "0" }),
    /DATABASE_POOL_SIZE must be between 1 and 100/u
  );
  assert.throws(
    () =>
      parseBoundedDatabaseInteger(
        { LIMIT: "9007199254740992" },
        "LIMIT",
        { defaultValue: 10, minimum: 1, maximum: 100 }
      ),
    /LIMIT must be between 1 and 100/u
  );
});

test("database pool settings have safe defaults and bounded overrides", () => {
  assert.deepEqual(databasePoolOptions({}), {
    max: 10,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
  });
  assert.deepEqual(
    databasePoolOptions({
      DATABASE_POOL_SIZE: "24",
      DATABASE_IDLE_TIMEOUT_MS: "60000",
      DATABASE_STATEMENT_TIMEOUT_MS: "15000",
    }),
    {
      max: 24,
      idleTimeoutMillis: 60_000,
      statement_timeout: 15_000,
    }
  );
});
