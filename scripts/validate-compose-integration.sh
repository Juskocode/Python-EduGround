#!/usr/bin/env bash

set -Eeuo pipefail

repository_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repository_root"

fail() {
  printf 'Compose integration gate failed: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_command docker
require_command curl
require_command node

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  fail "Docker Compose v2 is required"
fi

docker info >/dev/null 2>&1 || fail "the Docker daemon is not available"

gate_suffix=${COMPOSE_GATE_ID:-"$(date +%s)-$$"}
gate_suffix=$(printf '%s' "$gate_suffix" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_-' '-')
gate_suffix=${gate_suffix#-}
gate_suffix=${gate_suffix%-}
[ -n "$gate_suffix" ] || fail "COMPOSE_GATE_ID must contain a letter or number"

project_name="eduground-compose-gate-${gate_suffix}"
case "$project_name" in
  eduground-compose-gate-[a-z0-9]* ) ;;
  * ) fail "the generated Compose project name is unsafe" ;;
esac

# Docker Desktop and Colima reliably share the checked-out repository with their
# VM, while an operating-system temporary directory may not be mounted there.
work_directory=$(mktemp -d "${repository_root}/.compose-gate.XXXXXX")
secret_directory="$work_directory/secrets"
cookie_jar="$work_directory/cookies.txt"
app_image="python-eduground-compose-gate:${gate_suffix}"
wait_timeout=${COMPOSE_GATE_WAIT_TIMEOUT_SECONDS:-240}

if [ -n "${COMPOSE_GATE_PORT:-}" ]; then
  app_port=$COMPOSE_GATE_PORT
else
  app_port=$(node --input-type=module -e '
    import net from "node:net";
    const server = net.createServer();
    server.unref();
    server.listen(0, "127.0.0.1", () => {
      console.log(server.address().port);
      server.close();
    });
  ')
fi

case "$app_port" in
  ''|*[!0-9]*) fail "COMPOSE_GATE_PORT must be an integer" ;;
esac
if [ "$app_port" -lt 1024 ] || [ "$app_port" -gt 65535 ]; then
  fail "COMPOSE_GATE_PORT must be between 1024 and 65535"
fi

export COMPOSE_PROJECT_NAME="$project_name"
export APP_IMAGE="$app_image"
export APP_BIND_ADDRESS=127.0.0.1
export PORT="$app_port"
export APP_ORIGIN="http://127.0.0.1:${app_port}"
export POSTGRES_DB=eduground_gate
export POSTGRES_USER=eduground_gate_owner
export POSTGRES_PASSWORD_FILE="$secret_directory/postgres_password"
export APP_DATABASE_PASSWORD_FILE="$secret_directory/app_database_password"

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e

  if [ "$status" -ne 0 ]; then
    printf '\nCompose service state at failure:\n' >&2
    "${compose[@]}" ps --all >&2
    printf '\nBounded Compose logs at failure:\n' >&2
    "${compose[@]}" logs --no-color --tail 200 >&2
  fi

  "${compose[@]}" down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1
  docker image rm --force "$app_image" >/dev/null 2>&1
  rm -rf "$work_directory"
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

expect_status() {
  local actual=$1
  local expected=$2
  local operation=$3
  if [ "$actual" != "$expected" ]; then
    if [ -n "${4:-}" ] && [ -f "$4" ]; then
      printf 'Response body: ' >&2
      sed -n '1,20p' "$4" >&2
    fi
    fail "$operation returned HTTP $actual instead of $expected"
  fi
}

printf 'Generating isolated file-backed secrets for %s.\n' "$project_name"
SECRET_DIR="$secret_directory" sh scripts/init-secrets.sh
[ "$(stat -c '%a' "$POSTGRES_PASSWORD_FILE" 2>/dev/null || stat -f '%Lp' "$POSTGRES_PASSWORD_FILE")" = "600" ] \
  || fail "the owner secret must be mode 600"
[ "$(stat -c '%a' "$APP_DATABASE_PASSWORD_FILE" 2>/dev/null || stat -f '%Lp' "$APP_DATABASE_PASSWORD_FILE")" = "600" ] \
  || fail "the runtime secret must be mode 600"
if cmp -s "$POSTGRES_PASSWORD_FILE" "$APP_DATABASE_PASSWORD_FILE"; then
  fail "owner and runtime database secrets must differ"
fi

printf 'Building and booting the real Compose topology.\n'
"${compose[@]}" config --quiet
"${compose[@]}" up --build --detach --wait --wait-timeout "$wait_timeout"

postgres_id=$("${compose[@]}" ps --all --quiet postgres)
bootstrap_id=$("${compose[@]}" ps --all --quiet database-bootstrap)
migrate_id=$("${compose[@]}" ps --all --quiet migrate)
app_id=$("${compose[@]}" ps --all --quiet app)

[ -n "$postgres_id" ] || fail "PostgreSQL container was not created"
[ -n "$bootstrap_id" ] || fail "database-bootstrap container was not created"
[ -n "$migrate_id" ] || fail "migrate container was not created"
[ -n "$app_id" ] || fail "app container was not created"

[ "$(docker inspect --format '{{.State.ExitCode}}' "$bootstrap_id")" = "0" ] \
  || fail "database-bootstrap did not complete successfully"
[ "$(docker inspect --format '{{.State.ExitCode}}' "$migrate_id")" = "0" ] \
  || fail "migrate did not complete successfully"

bootstrap_finished=$(docker inspect --format '{{.State.FinishedAt}}' "$bootstrap_id")
bootstrap_started=$(docker inspect --format '{{.State.StartedAt}}' "$bootstrap_id")
migrate_finished=$(docker inspect --format '{{.State.FinishedAt}}' "$migrate_id")
app_started=$(docker inspect --format '{{.State.StartedAt}}' "$app_id")
node - "$migrate_finished" "$bootstrap_started" "$bootstrap_finished" "$app_started" <<'NODE'
const [migrateFinished, bootstrapStarted, bootstrapFinished, appStarted] = process.argv
  .slice(2)
  .map((value) => Date.parse(value));
if (
  [migrateFinished, bootstrapStarted, bootstrapFinished, appStarted].some(Number.isNaN) ||
  migrateFinished > bootstrapStarted ||
  bootstrapFinished > appStarted
) {
  throw new Error("migration, grant bootstrap, and application startup ordering is invalid");
}
NODE

printf 'Checking container isolation and the restricted runtime database role.\n'
[ "$(docker inspect --format '{{.Config.User}}' "$app_id")" = "node" ] \
  || fail "the application image must declare USER node"
[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$app_id")" = "true" ] \
  || fail "the application root filesystem must be read-only"

cap_drop=$(docker inspect --format '{{json .HostConfig.CapDrop}}' "$app_id")
security_options=$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$app_id")
port_bindings=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$postgres_id")
node - "$cap_drop" "$security_options" "$port_bindings" <<'NODE'
const [capDropJson, securityOptionsJson, portBindingsJson] = process.argv.slice(2);
const capDrop = JSON.parse(capDropJson || "[]");
const securityOptions = JSON.parse(securityOptionsJson || "[]");
const portBindings = JSON.parse(portBindingsJson || "{}");
if (!capDrop.includes("ALL")) throw new Error("the application must drop every Linux capability");
if (!securityOptions.some((value) => value.startsWith("no-new-privileges"))) {
  throw new Error("the application must prevent privilege escalation");
}
if (Object.values(portBindings).some((bindings) => Array.isArray(bindings) && bindings.length > 0)) {
  throw new Error("PostgreSQL must not publish a host port");
}
NODE

[ "$(docker network inspect --format '{{.Internal}}' "${project_name}_database")" = "true" ] \
  || fail "the Compose database network must be internal"
"${compose[@]}" exec --no-TTY app sh -ec '
  test "$(id -u)" -ne 0
  if touch /app/compose-rootfs-write-check 2>/dev/null; then
    rm -f /app/compose-rootfs-write-check
    exit 1
  fi
'

"${compose[@]}" exec --no-TTY app node --input-type=module -e '
  import pg from "pg";
  import { databaseConnectionOptions } from "./server/database-config.mjs";

  const client = new pg.Client(
    databaseConnectionOptions(process.env, {
      applicationName: "compose-security-gate",
      required: true,
    })
  );
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT current_user,
             rolsuper,
             rolcreatedb,
             rolcreaterole,
             rolreplication
        FROM pg_catalog.pg_roles
       WHERE rolname = current_user
    `);
    const role = rows[0];
    if (
      role?.current_user !== "eduground_app" ||
      role.rolsuper ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolreplication
    ) {
      throw new Error(`unexpected runtime role: ${JSON.stringify(role)}`);
    }

    const expectedTablePrivileges = {
      users: new Set(["SELECT", "INSERT"]),
      sessions: new Set(["SELECT", "INSERT", "DELETE"]),
      user_state: new Set(["SELECT", "INSERT", "UPDATE"]),
      user_files: new Set(["SELECT", "INSERT", "UPDATE"]),
      test_runs: new Set(["SELECT", "INSERT", "DELETE"]),
      schema_migrations: new Set(["SELECT"]),
    };
    for (const [table, expected] of Object.entries(expectedTablePrivileges)) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        const { rows: privilegeRows } = await client.query(
          "SELECT has_table_privilege(current_user, $1, $2) AS allowed",
          [`public.${table}`, privilege]
        );
        if (privilegeRows[0]?.allowed !== expected.has(privilege)) {
          throw new Error(
            `unexpected ${privilege} privilege on ${table}: ${privilegeRows[0]?.allowed}`
          );
        }
      }
    }
    for (const privilege of ["USAGE", "SELECT", "UPDATE"]) {
      const { rows: sequenceRows } = await client.query(
        "SELECT has_sequence_privilege(current_user, $1, $2) AS allowed",
        ["public.test_runs_id_seq", privilege]
      );
      if (sequenceRows[0]?.allowed !== (privilege === "USAGE")) {
        throw new Error(
          `unexpected ${privilege} privilege on test_runs_id_seq: ${sequenceRows[0]?.allowed}`
        );
      }
    }

    let createWasDenied = false;
    try {
      await client.query("CREATE TABLE public.compose_gate_forbidden (id integer)");
      await client.query("DROP TABLE public.compose_gate_forbidden");
    } catch (error) {
      createWasDenied = error?.code === "42501";
    }
    if (!createWasDenied) {
      throw new Error("the runtime role unexpectedly has schema mutation privileges");
    }

    let migrationLedgerWriteWasDenied = false;
    try {
      await client.query("UPDATE public.schema_migrations SET checksum = checksum");
    } catch (error) {
      migrationLedgerWriteWasDenied = error?.code === "42501";
    }
    if (!migrationLedgerWriteWasDenied) {
      throw new Error("the runtime role unexpectedly modified the migration ledger");
    }
  } finally {
    await client.end();
  }
'

base_url=$APP_ORIGIN
ready_status=$(curl --silent --show-error \
  --output "$work_directory/ready.json" \
  --dump-header "$work_directory/ready.headers" \
  --write-out '%{http_code}' \
  "$base_url/readyz")
expect_status "$ready_status" 200 "readiness" "$work_directory/ready.json"
node --input-type=module - "$work_directory/ready.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const body = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(body.status, "ok");
assert.equal(body.database?.available, true);
assert.equal(body.database?.schemaReady, true);
NODE
grep -Eqi '^content-security-policy:' "$work_directory/ready.headers" \
  || fail "readiness responses must include a Content-Security-Policy"
grep -Eqi '^x-frame-options:[[:space:]]*DENY' "$work_directory/ready.headers" \
  || fail "readiness responses must deny framing"

printf 'Exercising secure-cookie authentication and persisted learner state.\n'
register_status=$(curl --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"email":"compose-gate@example.test","displayName":"Compose Gate","password":"compose-gate-strong-password"}' \
  --cookie-jar "$cookie_jar" \
  --output "$work_directory/register.json" \
  --dump-header "$work_directory/register.headers" \
  --write-out '%{http_code}' \
  "$base_url/api/auth/register")
expect_status "$register_status" 201 "account registration" "$work_directory/register.json"
node --input-type=module - "$work_directory/register.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const body = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(body.user?.email, "compose-gate@example.test");
assert.equal(Object.hasOwn(body, "token"), false);
assert.match(body.clientCapability, /^[A-Za-z0-9_-]{32,256}$/u);
NODE
client_capability=$(node -e '
  const { readFileSync } = require("node:fs");
  process.stdout.write(JSON.parse(readFileSync(process.argv[1], "utf8")).clientCapability);
' "$work_directory/register.json")
grep -Eqi '^set-cookie:[[:space:]]*eduground_session=.*HttpOnly.*SameSite=Strict' \
  "$work_directory/register.headers" \
  || fail "registration must issue an HttpOnly SameSite=Strict session cookie"

missing_origin_status=$(curl --silent --show-error \
  --request PUT \
  --header 'Content-Type: application/json' \
  --header "X-EduGround-Client-Capability: $client_capability" \
  --data '{"state":{"passedIds":["py01-first-programs"]}}' \
  --cookie "$cookie_jar" \
  --output "$work_directory/missing-origin.json" \
  --write-out '%{http_code}' \
  "$base_url/api/state")
expect_status "$missing_origin_status" 403 "cookie-authenticated mutation without Origin" "$work_directory/missing-origin.json"
node --input-type=module - "$work_directory/missing-origin.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const body = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(body.error?.code, "ORIGIN_REQUIRED");
NODE

save_state_status=$(curl --silent --show-error \
  --request PUT \
  --header 'Content-Type: application/json' \
  --header "Origin: $APP_ORIGIN" \
  --header "X-EduGround-Client-Capability: $client_capability" \
  --data '{"state":{"passedIds":["py01-first-programs"],"editorMode":"vim","composeGate":true}}' \
  --cookie "$cookie_jar" \
  --output "$work_directory/save-state.json" \
  --write-out '%{http_code}' \
  "$base_url/api/state")
expect_status "$save_state_status" 200 "state persistence" "$work_directory/save-state.json"

save_file_status=$(curl --silent --show-error \
  --request PUT \
  --header 'Content-Type: application/json' \
  --header "Origin: $APP_ORIGIN" \
  --header "X-EduGround-Client-Capability: $client_capability" \
  --data '{"content":"print(\"compose persistence\")\n"}' \
  --cookie "$cookie_jar" \
  --output "$work_directory/save-file.json" \
  --write-out '%{http_code}' \
  "$base_url/api/files/py01-first-programs")
expect_status "$save_file_status" 200 "submission-file persistence" "$work_directory/save-file.json"

old_app_id=$app_id
printf 'Recreating the application container while preserving database and submission volumes.\n'
"${compose[@]}" up --detach --no-deps --force-recreate --wait --wait-timeout "$wait_timeout" app
app_id=$("${compose[@]}" ps --all --quiet app)
[ -n "$app_id" ] || fail "the recreated application container is missing"
[ "$app_id" != "$old_app_id" ] || fail "the application container was not recreated"

state_status=$(curl --silent --show-error \
  --cookie "$cookie_jar" \
  --header "X-EduGround-Client-Capability: $client_capability" \
  --output "$work_directory/state-after-recreate.json" \
  --write-out '%{http_code}' \
  "$base_url/api/state")
expect_status "$state_status" 200 "state retrieval after app recreation" "$work_directory/state-after-recreate.json"
node --input-type=module - "$work_directory/state-after-recreate.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const body = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.deepEqual(body.state?.passedIds, ["py01-first-programs"]);
assert.equal(body.state?.editorMode, "vim");
assert.equal(body.state?.composeGate, true);
NODE

file_status=$(curl --silent --show-error \
  --cookie "$cookie_jar" \
  --header "X-EduGround-Client-Capability: $client_capability" \
  --output "$work_directory/file-after-recreate.json" \
  --write-out '%{http_code}' \
  "$base_url/api/files/py01-first-programs")
expect_status "$file_status" 200 "submission retrieval after app recreation" "$work_directory/file-after-recreate.json"
node --input-type=module - "$work_directory/file-after-recreate.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const body = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(body.file?.filename, "ex00.py");
assert.equal(body.file?.content, 'print("compose persistence")\n');
assert.equal(body.file?.mirrorStatus, "saved");
NODE

printf 'Compose integration gate passed: ordering, isolation, restricted DB access, auth, state, and recreation persistence.\n'
