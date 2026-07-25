import { readFileSync } from "node:fs";

const BOOLEAN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const BOOLEAN_FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const SSL_TRUE_VALUES = new Set([...BOOLEAN_TRUE_VALUES, "require"]);
const SSL_FALSE_VALUES = new Set([...BOOLEAN_FALSE_VALUES, "disable"]);

export class DatabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

function normalizedValue(environment, name) {
  const value = environment[name];
  return typeof value === "string" ? value.trim() : "";
}

function readSecretFile(environment, name) {
  const path = normalizedValue(environment, name);
  if (!path) return "";
  try {
    const value = readFileSync(path, "utf8").replace(/\r?\n$/u, "");
    if (!value) throw new Error("secret file is empty");
    return value;
  } catch (error) {
    throw new DatabaseConfigurationError(
      `${name} could not be read: ${error?.message || error}`
    );
  }
}

function parseBooleanValue(environment, name, defaultValue = false) {
  const value = normalizedValue(environment, name).toLowerCase();
  if (!value) return defaultValue;
  if (BOOLEAN_TRUE_VALUES.has(value)) return true;
  if (BOOLEAN_FALSE_VALUES.has(value)) return false;
  throw new DatabaseConfigurationError(
    `${name} must be one of: true, false, 1, 0, yes, no, on, or off.`
  );
}

export function parseBoundedDatabaseInteger(
  environment,
  name,
  { defaultValue, minimum, maximum }
) {
  const value = normalizedValue(environment, name);
  if (!value) return defaultValue;
  if (!/^\d+$/u.test(value)) {
    throw new DatabaseConfigurationError(`${name} must be an integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new DatabaseConfigurationError(
      `${name} must be between ${minimum} and ${maximum}.`
    );
  }
  return parsed;
}

export function databaseTlsOptions(environment = process.env) {
  const sslSetting = normalizedValue(environment, "DATABASE_SSL").toLowerCase();
  const inlineCertificateAuthority = normalizedValue(environment, "DATABASE_SSL_CA");
  const certificateAuthorityFile = normalizedValue(
    environment,
    "DATABASE_SSL_CA_FILE"
  );
  if (inlineCertificateAuthority && certificateAuthorityFile) {
    throw new DatabaseConfigurationError(
      "Set only one of DATABASE_SSL_CA or DATABASE_SSL_CA_FILE."
    );
  }
  const certificateAuthority =
    inlineCertificateAuthority ||
    readSecretFile(environment, "DATABASE_SSL_CA_FILE");
  const allowInsecure = parseBooleanValue(
    environment,
    "DATABASE_SSL_ALLOW_INSECURE",
    false
  );

  let tlsEnabled = Boolean(certificateAuthority || allowInsecure);
  if (sslSetting) {
    if (SSL_TRUE_VALUES.has(sslSetting)) {
      tlsEnabled = true;
    } else if (SSL_FALSE_VALUES.has(sslSetting)) {
      tlsEnabled = false;
    } else {
      throw new DatabaseConfigurationError(
        "DATABASE_SSL must be one of: true, false, 1, 0, yes, no, on, off, require, or disable."
      );
    }
  }

  if (!tlsEnabled) {
    if (certificateAuthority) {
      throw new DatabaseConfigurationError(
        "DATABASE_SSL_CA cannot be used when DATABASE_SSL is disabled."
      );
    }
    if (allowInsecure) {
      throw new DatabaseConfigurationError(
        "DATABASE_SSL_ALLOW_INSECURE cannot be used when DATABASE_SSL is disabled."
      );
    }
    return undefined;
  }

  if (allowInsecure) {
    if (normalizedValue(environment, "NODE_ENV").toLowerCase() === "production") {
      throw new DatabaseConfigurationError(
        "DATABASE_SSL_ALLOW_INSECURE is a development-only escape hatch and is forbidden in production."
      );
    }
    if (certificateAuthority) {
      throw new DatabaseConfigurationError(
        "DATABASE_SSL_CA cannot be combined with DATABASE_SSL_ALLOW_INSECURE."
      );
    }
    return { rejectUnauthorized: false };
  }

  return {
    rejectUnauthorized: true,
    ...(certificateAuthority
      ? { ca: certificateAuthority.replaceAll("\\n", "\n") }
      : {}),
  };
}

function pgEnvironmentConnection(environment) {
  const host = normalizedValue(environment, "PGHOST");
  const database = normalizedValue(environment, "PGDATABASE");
  const user = normalizedValue(environment, "PGUSER");
  const port = normalizedValue(environment, "PGPORT");
  const passwordFile = normalizedValue(environment, "PGPASSWORD_FILE");
  const directPasswordWasProvided = Object.hasOwn(environment, "PGPASSWORD");
  if (directPasswordWasProvided && passwordFile) {
    throw new DatabaseConfigurationError(
      "Set only one of PGPASSWORD or PGPASSWORD_FILE."
    );
  }
  const passwordWasProvided = directPasswordWasProvided || Boolean(passwordFile);
  const password = passwordFile
    ? readSecretFile(environment, "PGPASSWORD_FILE")
    : typeof environment.PGPASSWORD === "string"
      ? environment.PGPASSWORD
      : environment.PGPASSWORD == null
        ? undefined
        : String(environment.PGPASSWORD);
  const supplied = Boolean(host || database || user || port || passwordWasProvided);

  if (!supplied) return null;

  const missing = [
    ["PGHOST", host],
    ["PGDATABASE", database],
    ["PGUSER", user],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new DatabaseConfigurationError(
      `Incomplete PostgreSQL configuration. Set ${missing.join(", ")} or use DATABASE_URL.`
    );
  }

  return {
    host,
    database,
    user,
    ...(port
      ? {
          port: parseBoundedDatabaseInteger(environment, "PGPORT", {
            defaultValue: 5432,
            minimum: 1,
            maximum: 65_535,
          }),
        }
      : {}),
    ...(passwordWasProvided ? { password } : {}),
  };
}

export function databaseConnectionOptions(
  environment = process.env,
  {
    applicationName = "python-eduground",
    connectionTimeoutDefault = 3_000,
    required = false,
  } = {}
) {
  const connectionString = normalizedValue(environment, "DATABASE_URL");
  if (connectionString) {
    let parsedConnectionString;
    try {
      parsedConnectionString = new URL(connectionString);
    } catch {
      throw new DatabaseConfigurationError(
        "DATABASE_URL must be a valid postgres:// or postgresql:// URL."
      );
    }
    if (!["postgres:", "postgresql:"].includes(parsedConnectionString.protocol)) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL must use the postgres:// or postgresql:// scheme."
      );
    }
    if (parsedConnectionString.search || parsedConnectionString.hash) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL query parameters and fragments are not allowed. Configure PostgreSQL TLS with DATABASE_SSL and DATABASE_SSL_CA_FILE, and use the dedicated bounded settings."
      );
    }
  }
  const connection = connectionString
    ? { connectionString }
    : pgEnvironmentConnection(environment);

  if (!connection) {
    if (required) {
      throw new DatabaseConfigurationError(
        "PostgreSQL is not configured. Set DATABASE_URL or PGHOST, PGDATABASE, and PGUSER."
      );
    }
    return null;
  }

  return {
    ...connection,
    connectionTimeoutMillis: parseBoundedDatabaseInteger(
      environment,
      "DATABASE_CONNECT_TIMEOUT_MS",
      {
        defaultValue: connectionTimeoutDefault,
        minimum: 100,
        maximum: 120_000,
      }
    ),
    application_name: applicationName,
    ssl: databaseTlsOptions(environment) ?? false,
  };
}

export function databasePoolOptions(environment = process.env) {
  return {
    max: parseBoundedDatabaseInteger(environment, "DATABASE_POOL_SIZE", {
      defaultValue: 10,
      minimum: 1,
      maximum: 100,
    }),
    idleTimeoutMillis: parseBoundedDatabaseInteger(
      environment,
      "DATABASE_IDLE_TIMEOUT_MS",
      {
        defaultValue: 30_000,
        minimum: 1_000,
        maximum: 600_000,
      }
    ),
    statement_timeout: parseBoundedDatabaseInteger(
      environment,
      "DATABASE_STATEMENT_TIMEOUT_MS",
      {
        defaultValue: 10_000,
        minimum: 100,
        maximum: 300_000,
      }
    ),
  };
}
