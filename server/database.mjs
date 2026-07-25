import pg from "pg";
import {
  databaseConnectionOptions,
  databasePoolOptions,
} from "./database-config.mjs";
import { loadMigrationManifest } from "./migration-manifest.mjs";

const { Pool } = pg;

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "57P01",
  "57P02",
  "57P03",
  "53300",
]);
const REQUIRED_SCHEMA_RELATIONS = [
  "schema_migrations",
  "sessions",
  "test_runs",
  "user_files",
  "user_state",
  "users",
];

export class DatabaseUnavailableError extends Error {
  constructor(message = "Persistent storage is unavailable.", options = {}) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

function isConnectionError(error) {
  return (
    CONNECTION_ERROR_CODES.has(error?.code) ||
    (typeof error?.code === "string" && error.code.startsWith("08"))
  );
}

function unavailableDatabase() {
  const fail = async () => {
    throw new DatabaseUnavailableError(
      "Persistent storage is not configured. Set DATABASE_URL or PostgreSQL PG* settings, then run the migrations."
    );
  };

  return {
    configured: false,
    query: fail,
    transaction: fail,
    async health() {
      return {
        configured: false,
        available: false,
        schemaReady: false,
        message:
          "PostgreSQL is not configured. Set DATABASE_URL or PGHOST, PGDATABASE, and PGUSER.",
      };
    },
    async close() {},
  };
}

export function createDatabase(environment = process.env, logger = console) {
  const connection = databaseConnectionOptions(environment);
  if (!connection) {
    return unavailableDatabase();
  }

  const pool = new Pool({
    ...connection,
    ...databasePoolOptions(environment),
  });

  pool.on("error", (error) => {
    logger.error("Unexpected PostgreSQL pool error:", error?.message || error);
  });

  async function execute(operation) {
    try {
      return await operation();
    } catch (error) {
      if (isConnectionError(error)) {
        throw new DatabaseUnavailableError("Persistent storage is temporarily unavailable.", {
          cause: error,
        });
      }
      if (error?.code === "42P01") {
        throw new DatabaseUnavailableError(
          "Persistent storage has not been initialized. Run npm run migrate.",
          { cause: error }
        );
      }
      throw error;
    }
  }

  return {
    configured: true,
    query(text, parameters) {
      return execute(() => pool.query(text, parameters));
    },
    transaction(callback) {
      return execute(async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await callback(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            logger.error("Could not roll back PostgreSQL transaction:", rollbackError?.message || rollbackError);
          }
          throw error;
        } finally {
          client.release();
        }
      });
    },
    async health() {
      try {
        const relationQuery = `SELECT ${REQUIRED_SCHEMA_RELATIONS.map(
          (name, index) => `to_regclass($${index + 1}) IS NOT NULL AS "${name}"`
        ).join(", ")}`;
        const relationResult = await execute(() =>
          pool.query(
            relationQuery,
            REQUIRED_SCHEMA_RELATIONS.map((name) => `public.${name}`)
          )
        );
        const missingRelations = REQUIRED_SCHEMA_RELATIONS.filter(
          (name) => relationResult.rows[0]?.[name] !== true
        );
        if (missingRelations.length > 0) {
          return {
            configured: true,
            available: false,
            schemaReady: false,
            message: "PostgreSQL is reachable, but the required schema is incomplete. Run npm run migrate.",
          };
        }

        const requiredMigrations = await loadMigrationManifest();
        const migrationResult = await execute(() =>
          pool.query("SELECT name, checksum FROM schema_migrations ORDER BY name")
        );
        const appliedMigrations = new Map(
          migrationResult.rows.map((row) => [row.name, row.checksum])
        );
        const migrationsCurrent =
          appliedMigrations.size === requiredMigrations.length &&
          requiredMigrations.every(
            ({ name, checksum }) => appliedMigrations.get(name) === checksum
          );
        if (!migrationsCurrent) {
          return {
            configured: true,
            available: false,
            schemaReady: false,
            message:
              "PostgreSQL is reachable, but required migrations are missing or do not match the repository. Run npm run migrate.",
          };
        }

        return {
          configured: true,
          available: true,
          schemaReady: true,
          message: "PostgreSQL and the required schema are ready.",
        };
      } catch (error) {
        return {
          configured: true,
          available: false,
          schemaReady: false,
          message: error instanceof DatabaseUnavailableError ? error.message : "PostgreSQL health check failed.",
        };
      }
    },
    async close() {
      await pool.end();
    },
  };
}
