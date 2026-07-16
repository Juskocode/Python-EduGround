# Deployment and recovery runbook

This runbook covers a first deployment, upgrades that preserve progress, verified
PostgreSQL connections, health checks, backup/restore drills, and rollback.
Security design and release policy are documented in
[SECURE_SDLC.md](SECURE_SDLC.md).

Commands below use Docker Compose v2 as `docker compose`. If the workstation exposes
the same plugin as `docker-compose`, substitute that command without changing the
arguments.

## Supported topology

The normal deployment has one public reverse proxy, one private Node app, and one
private PostgreSQL database:

```text
browser -> HTTPS reverse proxy -> app:8000 -> PostgreSQL:5432
                                  |
                                  +-> private submissions_data volume
```

PostgreSQL has no host-published port in `docker-compose.yml`. The application port
binds to `127.0.0.1` by default. Keep that default when a reverse proxy runs on the
host; do not expose the Node or database port directly to the internet.

## First Compose deployment

Requirements:

- Docker Engine with Compose v2;
- an exact public origin;
- two different generated, file-backed database passwords;
- HTTPS and a trusted reverse proxy for a public deployment.

Create the untracked environment file and secret files:

```bash
cp .env.example .env
npm run secrets:init
```

`npm run secrets:init` creates distinct owner and runtime credentials in the
Git-ignored `secrets/` directory with mode `0600`. Back up the values in an approved
secret manager. The command intentionally refuses to overwrite existing files:
database credentials must be rotated in PostgreSQL before their mounted files are
replaced. Set `APP_ORIGIN` to the exact browser origin:

```dotenv
APP_ORIGIN=https://learn.example.com
POSTGRES_PASSWORD_FILE=./secrets/postgres_password
APP_DATABASE_PASSWORD_FILE=./secrets/app_database_password
APP_BIND_ADDRESS=127.0.0.1
PORT=8000
TRUST_PROXY_HOPS=1
```

For a workstation-only HTTP deployment, use
`APP_ORIGIN=http://127.0.0.1:8000` and `TRUST_PROXY_HOPS=0`.

Validate interpolation before starting:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Startup is deliberately ordered:

| Service | Credential and purpose |
| --- | --- |
| `postgres` | Holds the durable database on the private `database` network |
| `migrate` | One-shot owner process that applies checksum-protected migrations |
| `database-bootstrap` | Runs after migration, creates/rotates `eduground_app`, revokes legacy broad grants, and applies the reviewed per-table privilege matrix |
| `app` | Long-running restricted `eduground_app` process; cannot create roles or databases |

Confirm the one-shot services exited successfully and the app is ready:

```bash
docker compose ps -a
docker compose logs --no-color database-bootstrap migrate
curl --fail --silent --show-error http://127.0.0.1:8000/healthz
curl --fail --silent --show-error http://127.0.0.1:8000/readyz
```

`/healthz` is process liveness and does not query PostgreSQL. `/readyz` verifies
connectivity, required relations, and the checksum of every checked-in migration.
Do not route learner traffic to an instance whose readiness check is failing.

## Reverse proxy contract

For HTTPS termination:

- set `APP_ORIGIN` to the exact external HTTPS origin, without a path;
- set `TRUST_PROXY_HOPS` to the exact number of trusted proxies between the browser
  and Node, usually `1`;
- have the final trusted proxy replace, rather than append untrusted values to,
  `X-Forwarded-For` and `X-Forwarded-Proto`;
- forward the original `Host` and set `X-Forwarded-Proto: https`;
- keep the Node port unreachable except through the trusted proxy;
- set proxy body/header/time limits at least as strict as the application limits.

The app uses the trusted protocol to issue the `Secure`,
`__Host-eduground_session` cookie and HSTS. Never set `TRUST_PROXY_HOPS` above the
real topology; doing so lets an untrusted forwarded value influence client IP and
secure-request detection.

HSTS defaults to one year with `includeSubDomains`. Confirm every subdomain is HTTPS
before using that policy on a shared parent domain. Set
`HSTS_MAX_AGE_SECONDS=0` during a deliberate HSTS rollout if necessary.

## Rotate Compose database credentials

Never replace an existing secret file before changing the matching PostgreSQL role:
the existing volume keeps its database password and initialization variables do not
rotate it. Schedule a maintenance window, take a verified backup, retain protected
copies of the old files until readiness passes, and use the default secret paths
below:

```bash
current_owner_file="$(pwd)/secrets/postgres_password"
rotation_dir="$(mktemp -d "$(pwd)/.credential-rotation.XXXXXX")"
SECRET_DIR="$rotation_dir" sh scripts/init-secrets.sh
new_owner_file="$rotation_dir/postgres_password"
new_app_file="$rotation_dir/app_database_password"

docker compose stop app

# Rotate the restricted runtime role while the current owner credential works.
POSTGRES_PASSWORD_FILE="$current_owner_file" \
APP_DATABASE_PASSWORD_FILE="$new_app_file" \
  docker compose run --rm database-bootstrap

# Rotate the owner through the private local database socket. The generated
# base64 value contains no SQL quote characters and is passed on stdin.
new_owner_password="$(tr -d '\r\n' < "$new_owner_file")"
printf "\\set new_password '%s'\nALTER ROLE CURRENT_USER PASSWORD :'new_password';\n" \
  "$new_owner_password" |
  docker compose exec -T postgres sh -ec \
    'exec psql --set=ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
unset new_owner_password

install -m 600 "$new_owner_file" secrets/postgres_password
install -m 600 "$new_app_file" secrets/app_database_password

docker compose run --rm migrate
docker compose run --rm database-bootstrap
docker compose up -d --wait app
curl --fail --silent --show-error http://127.0.0.1:8000/readyz
rm -rf "$rotation_dir"
```

Use `docker-compose` in place of `docker compose` where only the standalone command
is installed. If any step fails, keep traffic stopped and restore both database
role passwords and files from the protected old credentials before retrying. Record
the rotation and delete retired secret-manager versions according to policy only
after the observation window.

## Managed PostgreSQL

Use separate owner/migration and restricted runtime credentials. Prefer `PG*`
variables because a password containing `@`, `:`, `/`, `?`, or `#` does not need URL
encoding:

```bash
export PGHOST='db.example.net'
export PGPORT='5432'
export PGDATABASE='eduground'
export PGUSER='eduground_owner'
export PGPASSWORD_FILE='/run/secrets/eduground-owner-password'
export DATABASE_SSL='require'
export DATABASE_SSL_CA_FILE='/run/secrets/provider-root-ca.pem'

npm ci --ignore-scripts --omit=dev --no-audit --no-fund
npm run migrate
```

After migration, start the app with the restricted role:

```bash
export PGUSER='eduground_app'
export PGPASSWORD_FILE='/run/secrets/eduground-runtime-password'
export APP_ORIGIN='https://learn.example.com'
export TRUST_PROXY_HOPS='1'
export SUBMISSIONS_DIR='/var/lib/python-eduground/submissions'
export HOST='127.0.0.1'
export PORT='8000'

npm run serve
```

Have the database administrator create `eduground_app` as `NOSUPERUSER`,
`NOCREATEDB`, `NOCREATEROLE`, run migrations first, and then apply only the reviewed
per-table and sequence operations. Do not grant future tables by default.
[`docker/bootstrap-app-role.sql`](../docker/bootstrap-app-role.sql) is the executable
Compose implementation and a reference for managed-database grants.

`DATABASE_SSL=true` and `DATABASE_SSL=require` both enable certificate verification.
Set `DATABASE_SSL_CA_FILE` when the provider CA is not in the host trust store.
`DATABASE_SSL_CA` also accepts a PEM value, including literal `\n` sequences, for
secret managers that cannot mount files. All query parameters and fragments in
`DATABASE_URL` are rejected so parsed URL options cannot override TLS or bounded
timeout policy.
`DATABASE_SSL_ALLOW_INSECURE=true` is a development-only diagnostic escape hatch
and production startup rejects it.

## Upgrade without losing learner progress

Progress survives `git pull` when storage identity is preserved:

- local-only progress requires the same browser origin;
- signed-in progress requires the same PostgreSQL database or `postgres_data`
  volume;
- physical `exNN.py` mirrors require the same `submissions_data` volume or managed
  `SUBMISSIONS_DIR`;
- Compose deployments must keep the same `COMPOSE_PROJECT_NAME`.

Before updating, record the current revision and volume names:

```bash
git rev-parse HEAD
docker compose config --volumes
docker volume ls
```

Create and verify a backup using the procedure below. Then update and force a new
bootstrap/migration/app cycle without deleting volumes:

```bash
git pull --ff-only
npm ci --ignore-scripts --no-audit --no-fund
npm run validate
docker compose up -d --build --force-recreate
docker compose ps -a
docker compose logs --no-color database-bootstrap migrate
curl --fail --silent --show-error http://127.0.0.1:8000/readyz
```

If the deployment was created with `-p` or a custom `COMPOSE_PROJECT_NAME`, provide
the same value to every command. A new project name selects new empty named volumes;
it does not migrate the old data.

Never run these against the active deployment during an upgrade:

```text
docker compose down -v
docker volume rm <active-volume>
docker volume prune
```

## Backup

Named volumes survive container replacement but are not backups. Stop application
writes, create a dated custom-format dump, validate its table of contents, and start
the app again:

```bash
mkdir -p backups
backup="backups/python-eduground-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose stop app
docker compose exec -T postgres sh -ec \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
  > "$backup"
docker compose start app

test -s "$backup"
docker compose exec -T postgres pg_restore --list < "$backup" > /dev/null
```

Encrypt and copy production backups off the application host. Define retention,
access, deletion propagation, and recovery objectives. Back up `submissions_data`
as well when an immediately complete file tree matters; PostgreSQL `user_files`
remains the authoritative source and can re-materialize missing mirror files.

## Restore an active Compose database

Restoring with `--clean` replaces current objects and data. Stop writes, confirm the
target project, and test the dump in an isolated drill first:

```bash
backup='backups/python-eduground-YYYYMMDDTHHMMSSZ.dump'
RESTORE_CONFIRM=replace-eduground-data npm run db:restore -- "$backup"
```

The restore command requires and verifies `${backup}.sha256`, validates the archive
table of contents before stopping the app, and applies the clean restore in one
transaction. Session rows are deliberately excluded so a restore cannot resurrect
a session revoked after the backup; all users sign in again. If restore fails,
PostgreSQL rolls back the transaction and the script attempts to restart the
previous app only when the restore has not committed. If bootstrap, migration, or
readiness fails after the restore commits, the app deliberately remains stopped.
Recover forward or restore the previous backup before serving traffic. Treat either
case as an incident and keep learner traffic disabled until `/readyz` passes.

Complete a sign-in, state-sync, saved-file read, and new test-run smoke check after
readiness succeeds.

## Isolated restore drill

Run the drill under an unmistakably separate Compose project and port:

```bash
export COMPOSE_PROJECT_NAME='python-eduground-restore-drill'
export PORT='18000'
export APP_BIND_ADDRESS='127.0.0.1'
export APP_ORIGIN='http://127.0.0.1:18000'
export TRUST_PROXY_HOPS='0'
export SECRET_DIR="$(mktemp -d "$(pwd)/.restore-drill-secrets.XXXXXX")"
export POSTGRES_PASSWORD_FILE="$SECRET_DIR/postgres_password"
export APP_DATABASE_PASSWORD_FILE="$SECRET_DIR/app_database_password"
sh scripts/init-secrets.sh

docker compose up -d postgres
docker compose exec -T postgres sh -ec \
  'pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --exit-on-error' \
  < backups/python-eduground-YYYYMMDDTHHMMSSZ.dump
docker compose run --rm migrate
docker compose run --rm database-bootstrap
docker compose up -d app

curl --fail --silent --show-error http://127.0.0.1:18000/readyz
```

Verify a known test account and saved file, document the recovery time and recovered
backup timestamp, then destroy only the drill project:

```bash
docker compose -p python-eduground-restore-drill down -v
unset COMPOSE_PROJECT_NAME PORT APP_BIND_ADDRESS APP_ORIGIN TRUST_PROXY_HOPS
rm -rf "$SECRET_DIR"
unset SECRET_DIR POSTGRES_PASSWORD_FILE APP_DATABASE_PASSWORD_FILE
```

## Image release and deployment

The manual GitHub `Release container` workflow validates, scans, generates an SBOM,
and optionally publishes an attested GHCR image. Publication must be dispatched
from the matching `vX.Y.Z` Git tag, refuses to overwrite either the version or
commit-SHA image tag, and never deploys.

Deploy an approved immutable digest rather than rebuilding unreviewed source on the
production host:

```text
ghcr.io/juskocode/python-eduground@sha256:<approved-digest>
```

For the Compose topology, select and pull that exact image for both the one-shot
migrator and the app, then start without a local build:

```bash
export APP_IMAGE='ghcr.io/juskocode/python-eduground@sha256:<approved-digest>'
docker login ghcr.io
docker pull "$APP_IMAGE"
docker compose up -d --no-build --force-recreate
curl --fail --silent --show-error http://127.0.0.1:8000/readyz
```

Before traffic moves:

1. Verify the digest and provenance.
2. Confirm a current backup and restore-drill result.
3. Run migrations once with the owner role.
4. Start the app with `eduground_app`.
5. Require `/readyz` to pass.
6. Run account, file, and browser smoke checks.
7. Retain the previous compatible digest until the observation window closes.

## Rollback constraints

Database migrations are forward-only. Never edit an applied SQL file, remove its
`schema_migrations` row, or restore only the migration metadata.

An application-only rollback is allowed only when the previous image is compatible
with the already-migrated schema. If a release performs an incompatible migration,
the recovery choices are:

- deploy a forward fix; or
- stop writes and restore the complete pre-release database backup, accepting loss
  of changes made after that backup.

The submission volume is derived data and must match PostgreSQL after a database
restore. Missing files are rebuilt as learners open saved exercises; remove or
rebuild inconsistent mirror files only through a planned maintenance procedure.

## Operational checks

At minimum, monitor:

- `/healthz` and `/readyz`;
- app/container restarts and graceful-shutdown failures;
- PostgreSQL connection, statement-timeout, and pool errors;
- authentication failures and rate-limit responses without logging passwords,
  cookies, learner code, or full result payloads;
- database, backup, and submission-volume growth;
- failed migration, dependency, CodeQL, and container-scan workflows;
- backup age and the date/result of the latest restore drill.

Use [SECURE_SDLC.md](SECURE_SDLC.md#incident-response) for containment and recovery
when a security boundary is suspected to be compromised.
