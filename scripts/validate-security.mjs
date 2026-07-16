#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return readFile(resolve(REPOSITORY_ROOT, relativePath), "utf8");
}

const [
  dockerfile,
  dockerignore,
  compose,
  environmentExample,
  index,
  runtimeSecurity,
  roleBootstrap,
  ciWorkflow,
  composeIntegrationGate,
  courseApp,
  api,
  migrationRunner,
  sessionCapabilityMigration,
  pythonWorker,
  initializeSecrets,
  backupScript,
  restoreScript,
  releaseWorkflow,
] = await Promise.all([
  read("Dockerfile"),
  read(".dockerignore"),
  read("docker-compose.yml"),
  read(".env.example"),
  read("index.html"),
  read("server/runtime-security.mjs"),
  read("docker/bootstrap-app-role.sql"),
  read(".github/workflows/ci.yml"),
  read("scripts/validate-compose-integration.sh"),
  read("course-app.js"),
  read("server/api.mjs"),
  read("server/migrate.mjs"),
  read("db/migrations/002_session_client_capability.sql"),
  read("python-runner-worker.mjs"),
  read("scripts/init-secrets.sh"),
  read("scripts/backup-postgres.sh"),
  read("scripts/restore-postgres.sh"),
  read(".github/workflows/release.yml"),
]);

const fromLines = dockerfile.match(/^FROM .+$/gmu) || [];
check(fromLines.length >= 2, "Dockerfile must use explicit dependency and runtime stages.");
check(
  fromLines.every((line) => /@sha256:[0-9a-f]{64}(?:\s|$)/u.test(line)),
  "Every Dockerfile base image must be pinned by digest."
);
check(/\nUSER node\n/u.test(dockerfile), "The production image must run as the node user.");
check(
  /CMD \["node", "scripts\/serve\.mjs"/u.test(dockerfile),
  "The production image must launch Node directly for correct signal handling."
);
check(!/COPY\s+(?:--chown=\S+\s+)?\.\s+\./u.test(dockerfile), "Dockerfile must not copy the entire repository.");
check(dockerignore.trimStart().startsWith("*"), ".dockerignore must remain an allowlist.");

const postgresBlock =
  /  postgres:\n(?<block>[\s\S]*?)\n  database-bootstrap:/u.exec(compose)?.groups?.block || "";
const appBlock =
  /  app:\n(?<block>[\s\S]*?)\nvolumes:/u.exec(compose)?.groups?.block || "";
check(!/\n    ports:/u.test(postgresBlock), "PostgreSQL must not publish a host port.");
check(
  /postgres_password:\n    file: "\$\{POSTGRES_PASSWORD_FILE/u.test(compose),
  "Compose must mount the PostgreSQL owner password from a secret file."
);
check(
  /app_database_password:\n    file: "\$\{APP_DATABASE_PASSWORD_FILE/u.test(compose),
  "Compose must mount the runtime database password from a separate secret file."
);
check(
  compose.includes("${APP_ORIGIN:?"),
  "Compose must require an explicit public application origin."
);
check(
  /  database-bootstrap:\n[\s\S]*?depends_on:\n      migrate:\n        condition: service_completed_successfully/u.test(
    compose
  ) &&
    /  migrate:\n[\s\S]*?depends_on:\n      postgres:\n        condition: service_healthy/u.test(
      compose
    ) &&
    /  app:\n[\s\S]*?depends_on:\n      database-bootstrap:\n        condition: service_completed_successfully/u.test(
      compose
    ),
  "Compose must migrate, apply reviewed runtime grants, and only then start the app."
);
check(/PGUSER: eduground_app/u.test(appBlock), "The app must use the restricted runtime database role.");
check(/read_only: true/u.test(appBlock), "The app root filesystem must be read-only.");
check(/cap_drop:\n      - ALL/u.test(appBlock), "The app must drop Linux capabilities.");
check(
  /no-new-privileges:true/u.test(appBlock),
  "The app must prevent privilege escalation."
);

check(!environmentExample.includes("change-me"), ".env.example must not advertise a known password.");
check(
  /^POSTGRES_PASSWORD_FILE=\.\/secrets\/postgres_password$/mu.test(environmentExample) &&
    /^APP_DATABASE_PASSWORD_FILE=\.\/secrets\/app_database_password$/mu.test(environmentExample),
  "Compose must use distinct ignored secret files for owner and runtime credentials."
);
check(
  !/<script(?![^>]*\bsrc=)[^>]*>/iu.test(index),
  "Inline scripts are forbidden by the production content security policy."
);
check(
  runtimeSecurity.includes("\"frame-ancestors 'none'\"") &&
    runtimeSecurity.includes("\"X-Content-Type-Options\": \"nosniff\""),
  "The runtime security header baseline is incomplete."
);
check(
  /ALTER ROLE eduground_app[\s\S]*NOSUPERUSER[\s\S]*NOCREATEDB[\s\S]*NOCREATEROLE/u.test(
    roleBootstrap
  ) &&
    !/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES/u.test(roleBootstrap) &&
    /GRANT SELECT ON TABLE public\.schema_migrations TO eduground_app/u.test(
      roleBootstrap
    ) &&
    /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM eduground_app/u.test(
      roleBootstrap
    ),
  "The runtime database role must remain non-privileged and use explicit per-table grants."
);
check(
  /compose-integration:[\s\S]*npm run validate:compose/u.test(ciWorkflow),
  "CI must exercise the complete hardened Compose topology."
);
check(
  composeIntegrationGate.includes("scripts/init-secrets.sh") &&
    composeIntegrationGate.includes("--force-recreate") &&
    composeIntegrationGate.includes("eduground_app") &&
    composeIntegrationGate.includes("has_table_privilege") &&
    composeIntegrationGate.includes("migration ledger") &&
    composeIntegrationGate.includes("PostgreSQL must not publish a host port"),
  "The Compose integration gate must cover file secrets, restricted access, isolation, and persistence."
);
check(
  courseApp.includes("safeSessionWrite(STORAGE_KEYS.authClientCapability") &&
    courseApp.includes('headers["X-EduGround-Client-Capability"]'),
  "The trusted page must keep the client capability in sessionStorage and attach it to authenticated requests."
);
check(
  api.includes('const CLIENT_CAPABILITY_HEADER = "x-eduground-client-capability"') &&
    api.includes("requestClientCapability(request)") &&
    api.includes("sessions.client_capability_hash"),
  "The API must require a database-bound client capability in addition to the cookie."
);
check(
  migrationRunner.includes("pg_try_advisory_lock") &&
    migrationRunner.includes("MIGRATION_LOCK_TIMEOUT_MS") &&
    migrationRunner.includes('toLowerCase() === "eduground_app"'),
  "Migrations must have a bounded lock wait and reject the reserved runtime role."
);
check(
  sessionCapabilityMigration.includes("client_capability_hash") &&
    sessionCapabilityMigration.includes("DELETE FROM sessions"),
  "The capability migration must invalidate unsafe cookie-only sessions."
);
check(
  !pythonWorker.includes("X-EduGround-Client-Capability") &&
    !pythonWorker.includes("authClientCapability"),
  "The learner-code worker must never receive the authenticated client capability."
);
check(
  !initializeSecrets.includes("--force") &&
    initializeSecrets.includes("refusing to overwrite active database credentials"),
  "Secret initialization must not overwrite credentials for an existing database volume."
);
check(
  backupScript.includes("pg_restore --list") &&
    backupScript.includes('.sha256"'),
  "Backups must be archive-validated and checksummed before publication."
);
check(
  restoreScript.includes("required checksum file") &&
    restoreScript.includes("--single-transaction") &&
    restoreScript.includes("--use-list") &&
    restoreScript.includes('"public" && $7 == "sessions"') &&
    restoreScript.includes("restore_committed") &&
    restoreScript.includes("compose stop app"),
  "Restore must verify integrity, omit session data, remain transactional, and hold traffic closed after post-commit failures."
);
check(
  releaseWorkflow.includes('GITHUB_REF" != "refs/tags/$RELEASE_VERSION"') &&
    releaseWorkflow.includes('sha_tag="sha-${GITHUB_SHA}"') &&
    !releaseWorkflow.includes("GITHUB_SHA:0:12") &&
    releaseWorkflow.includes("docker manifest inspect") &&
    releaseWorkflow.includes("refusing to overwrite existing image tag"),
  "Published images must come from a matching release tag and must never overwrite version or full-SHA tags."
);

const workflowDirectory = resolve(REPOSITORY_ROOT, ".github/workflows");
for (const filename of await readdir(workflowDirectory)) {
  if (!/\.ya?ml$/u.test(filename)) continue;
  const source = await readFile(resolve(workflowDirectory, filename), "utf8");
  for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)) {
    const reference = match[1];
    if (reference.startsWith("./")) continue;
    check(
      /@[0-9a-f]{40}$/u.test(reference),
      `${filename} action is not pinned to a full commit SHA: ${reference}`
    );
  }
}

if (failures.length > 0) {
  console.error("Security policy validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Security policy validation passed.");
