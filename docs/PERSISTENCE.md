# Persistence and PostgreSQL operations

Python EduGround is local-first. The complete learning experience works without an account or database, while account sync is an explicit opt-in for learners who want their code and progress to survive browser-data resets, a new device, or an application redeploy.

## Persistence modes

### Local-only fallback

Without `DATABASE_URL`, the Node server still serves the curriculum and browser Python runner. The following values are stored only in `localStorage` for the current browser origin:

- Exercise drafts.
- Passed exercise IDs, stars, ranks, and badges derived from those passes.
- Tutorial/runbook understanding markers.
- Timed-assessment active deadlines, theory answers, practical drafts/check summaries, and the ten most recent results per room.
- Sublime or Vim editor selection.
- Theme, sound preference, and last exercise.

Typing updates the local draft after a short debounce. **Save** flushes it immediately, and **Download .py** creates a normal file on the learner's computer. A database outage does not delete or disable this local copy.

Local storage is origin-specific. `http://127.0.0.1:8000`, `http://localhost:8000`, and `https://learn.example.com` are three separate browser stores. Clearing site data or using another browser removes access to that local-only copy.

Within one origin, learning data is divided into one anonymous workspace and one locally cached workspace per account. On the first sign-in from an anonymous workspace, its progress and drafts are merged into that account and the transferred anonymous workspace is cleared. This prevents the same anonymous work from being copied into several accounts. Signing out switches back to the anonymous workspace and does not expose the signed-in account's drafts, passes, guide markers, or assessment state. The account workspace remains cached locally and is merged with server state on a future sign-in.

Theme and sound are device-wide preferences for the origin rather than learner-workspace data. During a signed-in session, the raw bearer token and authenticated user ID are also kept in origin-scoped browser storage so the app can restore the correct account workspace after a refresh. Both identity values are removed on sign-out or an authentication failure; the per-account workspace itself remains cached.

### Opt-in account sync

When PostgreSQL is configured, the profile menu offers account registration and sign-in. Nothing is uploaded before the learner chooses one of those actions.

After sign-in:

- Passed exercises and learning markers merge by union, so completed work is not removed by another device.
- A local draft wins when both the current browser and the account contain a draft for the same exercise.
- Drafts, passed IDs, learning markers, and editor mode are pushed as account state after changes.
- Assessment deadlines, answers, practical drafts, visible-check summaries, bounded attempt histories, and monotonic pass/best-score summaries are included in account-state sync.
- Account-state writes are merged while holding a PostgreSQL row lock. Passed IDs, per-chapter learning markers, and assessment histories/completions are unioned; fields from newer releases that an older client does not know about are retained. Incoming drafts, active work, and editor settings may still replace their previous values.
- **Save** upserts the exact editor snapshot under the exercise's server-owned `exNN.py` name.
- Every complete **Run tests** attempt saves the submitted snapshot before its pass/fail run history is recorded.
- Each visible or complete test run records its result details, including expected/actual values, stdout, stderr, and tracebacks.
- Theme and sound remain device-local.

The server never receives repository solution code from the learner UI. Learner Python executes in the Pyodide browser worker, not in Node or PostgreSQL.

### Canonical chapter files

The trusted server manifest assigns all 92 exercises a permanent chapter directory and zero-based filename. The browser supplies only an exercise ID and source text; it cannot choose the server path.

```text
<SUBMISSIONS_DIR>/<user UUID>/
├── Py01 First Programs/
│   ├── ex00.py
│   ├── ex01.py
│   └── ex05.py
├── Py08 Recursion/
│   ├── ex00.py
│   └── ex10.py
└── Py11 Divide and Conquer/
    ├── ex00.py
    ├── ex01.py
    └── ex02.py
```

Directories and files are created lazily when an exercise is explicitly saved or submitted through **Run tests**. Writes use a temporary file, filesystem synchronization, and an atomic rename. PostgreSQL row locking orders writes to the same learner/exercise across tabs and app replicas that share the same volume. Per-user and chapter directories reject symlinks and traversal. The configured root is also rejected when it sits under an original solution folder or a publicly served asset folder.

PostgreSQL `user_files` is authoritative. If a mirror file disappears but the database row remains, `GET /api/files/:exerciseId` recreates the file from PostgreSQL. Set `SUBMISSIONS_DIR=off` when a deployment cannot provide private writable storage; account saving still works in PostgreSQL and the API reports that the physical mirror is disabled.

## Stored data

Migration [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql) creates:

| Table | Purpose | Deletion behaviour |
| --- | --- | --- |
| `users` | Normalized email, display name, scrypt password record, creation time | Parent learner record |
| `sessions` | SHA-256 hashes of bearer tokens and expiry times | Cascades with the user |
| `user_state` | Forward-compatible JSON account state: passes, drafts, learning markers, editor mode, and assessment progress | Cascades with the user |
| `user_files` | One canonical `exNN.py` source snapshot per user/exercise | Cascades with the user |
| `test_runs` | Append-only summaries and detailed result JSON for completed runs | Cascades with the user |
| `schema_migrations` | Applied migration names and checksums | Operational metadata, not learner data |

Current request limits are 384 KiB for both the incoming and merged account state, 256 KiB for one saved source file, and 256 KiB/250 items for one test-result payload. The server accepts one `user_files` row per learner and exercise.

Test runs are persisted for signed-in learners, but the current UI does not retrieve or display historical runs after a reload. They are an operational record for future history UI, not currently a learner-facing archive.

Timed-assessment results are different: their compact recent history and monotonic pass/best-score summary are part of `user_state`, and the assessment UI reloads both latest and lifetime-best status. Assessment practical code remains inside that state and does not create a `user_files` row or canonical chapter `exNN.py` file.

## Start the full stack with Docker Compose

Requirements: Docker with Compose v2. This workstation exposes it as `docker-compose`; installations that provide the Docker CLI plugin can use `docker compose` instead.

1. Copy the development environment template and replace its password:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`. At minimum, replace `POSTGRES_PASSWORD=change-me`. Do not commit `.env`; it is ignored by Git.

3. Build and start both services:

   ```bash
   docker-compose up -d --build
   docker-compose ps
   ```

4. Confirm both the web process and PostgreSQL readiness:

   ```bash
   curl --fail http://127.0.0.1:8000/healthz
   curl --fail http://127.0.0.1:8000/readyz
   ```

5. Open [http://127.0.0.1:8000](http://127.0.0.1:8000), open the profile, and choose **Create account** or **Sign in**.

The `app` service waits for the `postgres` health check, runs `npm run migrate`, and then starts the same-origin web/API server. Re-running the migration command is safe. `/readyz` verifies the required application tables and recorded core migration in addition to testing the PostgreSQL connection, so a reachable but unmigrated database stays out of service.

Compose now has a stable default project name, `fundamentos-de-programacao-playground`. This deliberately matches the historical volume prefix for this repository, so an in-place upgrade keeps using `fundamentos-de-programacao-playground_postgres_data` and `fundamentos-de-programacao-playground_submissions_data` even when the release is started from another directory. If an existing installation was originally launched with `-p`, `COMPOSE_PROJECT_NAME`, or a differently named checkout, keep using that same project name during and after the upgrade:

```bash
COMPOSE_PROJECT_NAME=the-existing-prefix docker-compose config
COMPOSE_PROJECT_NAME=the-existing-prefix docker-compose up -d --build
```

Inspect `docker volume ls` before changing a project name. A new project name creates a separate empty pair of volumes; it does not migrate or delete the old pair.

The Compose file uses `postgres_data` for database records and `submissions_data` for canonical Python files. These commands rebuild or replace the application container without deleting either volume:

```bash
docker-compose up -d --build
docker-compose up -d --build --force-recreate app
docker-compose down
```

Running `docker-compose down -v`, `docker volume rm`, or deleting the Docker/VM storage **does delete both named volumes**. Named volumes provide persistence across container replacement, not a backup.

## Upgrade an existing installation

A source update and a data migration are separate operations. `git pull` replaces tracked application files; it does not modify browser `localStorage`, a managed PostgreSQL database, or Docker named volumes. Progress remains reflected after an update when the deployment keeps the same storage identities:

- Serve the updated app from the same scheme, hostname, and port for local-only browser progress.
- Keep the same `DATABASE_URL` for signed-in account progress.
- Keep the same Compose project name and `postgres_data` volume when PostgreSQL runs under Compose.
- Keep the same `submissions_data` volume or persistent `SUBMISSIONS_DIR` mount when the physical `exNN.py` mirror must survive immediately.
- Run every checked-in database migration before the new application receives traffic.

Stable exercise IDs, stable tutorial marker IDs, and stable assessment block/question IDs let a newer release recognize existing progress. The account-state merge retains unknown top-level fields and completion evidence so an older client cannot silently erase fields introduced by a newer release. Active attempts, drafts, and editor settings are intentionally last-writer-wins; concurrent edits to those fields can still replace one another.

### Local-only update

Stop the old development server, update and validate the checkout, then restart on the same origin:

```bash
git pull --ff-only
npm ci
npm run validate
npm run serve
```

Using another port, changing between `localhost` and `127.0.0.1`, switching HTTP to HTTPS, clearing site data, or using a new browser creates a different local-storage context. A Git checkout alone cannot move that browser-only data. Sign in before a domain change or download important `.py` files when a portable manual copy is needed.

### Docker Compose update

First identify the current Compose project and volumes, then create a PostgreSQL backup using the procedure below. Pull and rebuild without `-v`:

```bash
docker-compose config --format json
docker-compose config --volumes
docker volume ls
git pull --ff-only
docker-compose up -d --build
curl --fail http://127.0.0.1:8000/healthz
curl --fail http://127.0.0.1:8000/readyz
```

The app container runs `npm run migrate` before starting. `/readyz` reports ready only when PostgreSQL is reachable, all required application tables exist, and the core migration is recorded.

If the installation historically used a custom project name, repeat it for every command:

```bash
COMPOSE_PROJECT_NAME=the-existing-prefix docker-compose config --format json
COMPOSE_PROJECT_NAME=the-existing-prefix docker-compose up -d --build
```

Changing that prefix selects a new empty pair of volumes; it does not copy the previous data. Do not run `docker-compose down -v`, `docker volume rm`, or prune the active volumes during an update.

### Managed PostgreSQL update

Back up the database, deploy the new build against the same `DATABASE_URL`, and apply migrations before switching traffic:

```bash
npm ci --omit=dev
npm run migrate
npm run serve
```

Verify both `/healthz` and `/readyz`. Roll back application code only if necessary; never roll back by editing or deleting an applied migration. Add a forward migration for any schema correction.

## Use an existing or managed PostgreSQL database

The app and API are one Node process and should be deployed on the same public origin. Point every application release at the same external PostgreSQL database:

```bash
export DATABASE_URL='postgresql://app_user:encoded-password@db.example.net:5432/eduground'
export DATABASE_SSL='require'
export APP_ORIGIN='https://learn.example.com'
export TRUST_PROXY='true'
export SUBMISSIONS_DIR='/var/lib/python-eduground/submissions'
export HOST='0.0.0.0'
export PORT='8000'

npm ci --omit=dev
npm run migrate
npm run serve
```

Percent-encode reserved characters in connection-string usernames or passwords. Store `DATABASE_URL` in the deployment platform's secret manager, not in source control or an image.

Apply migrations before routing a new release to users. Migrations run in filename order, use a PostgreSQL advisory lock, and record a SHA-256 checksum. Never edit an already-applied migration; add the next numbered file instead.

### Environment reference

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Unset | PostgreSQL connection string; leaving it unset keeps account sync unavailable while local mode continues |
| `DATABASE_SSL` | False | `1`, `true`, or `require` enables TLS with the current driver configuration |
| `DATABASE_POOL_SIZE` | `10` | Maximum PostgreSQL pool connections per app process |
| `DATABASE_IDLE_TIMEOUT_MS` | `30000` | Idle connection timeout used by the pool |
| `DATABASE_CONNECT_TIMEOUT_MS` | `3000` | API connection timeout; migrations default to 5000 ms |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `10000` | PostgreSQL statement timeout for API queries |
| `SUBMISSIONS_DIR` | `./submissions` | Private writable root for per-user chapter files; set `off` to keep source only in PostgreSQL |
| `SESSION_TTL_SECONDS` | `2592000` | Session lifetime; the server constrains it to 1 hour–180 days |
| `APP_ORIGIN` | Unset | Comma-separated allowed browser origins for state-changing requests |
| `TRUST_PROXY` | False | Trust forwarded protocol/IP headers; enable only behind a trusted reverse proxy |
| `HOST` | `127.0.0.1` | Node listening address |
| `PORT` | `8000` | Node listening port |
| `POSTGRES_DB` | `eduground` | Compose PostgreSQL database name |
| `POSTGRES_USER` | `eduground` | Compose PostgreSQL role |
| `POSTGRES_PASSWORD` | `change-me` | Compose-only development default; must be changed |
| `POSTGRES_PORT` | `5432` | Host port published by the Compose PostgreSQL service |
| `COMPOSE_PROJECT_NAME` | `fundamentos-de-programacao-playground` | Stable Compose resource/volume prefix; retain an existing deployment's prior value during upgrades |

For a TLS-terminating reverse proxy, set both `APP_ORIGIN` to the exact public HTTPS origin and `TRUST_PROXY=true`. Only enable `TRUST_PROXY` when the app cannot be reached except through that trusted proxy.

## API contract

The browser uses relative, same-origin endpoints. Authenticated calls carry `Authorization: Bearer <token>`.

| Method and path | Purpose |
| --- | --- |
| `GET /healthz` | Process liveness; does not require PostgreSQL |
| `GET /readyz` or `GET /api/health` | Database connectivity plus required-table and migration readiness |
| `POST /api/auth/register` | Create an account and session; password minimum is 10 characters |
| `POST /api/auth/login` | Create a new session for an existing account |
| `POST /api/auth/logout` | Revoke the current session token |
| `GET /api/me` | Restore the current signed-in identity |
| `GET /api/state` | Read merged learner account state |
| `PUT /api/state` | Transactionally merge learner state while retaining unknown fields and monotonic completion evidence |
| `GET /api/files/:exerciseId` | Read a saved source and re-materialize its canonical chapter file when needed |
| `PUT /api/files/:exerciseId` | Upsert source under the server-owned chapter and `exNN.py` mapping |
| `POST /api/runs` | Append one detailed test-run record |

There is currently no API to list test runs, change/reset a password, verify email, or delete an account.

## Moving to a new deployment or domain

Application containers are disposable; PostgreSQL is the durable boundary. To retain accounts during an upgrade:

1. Keep the same managed `DATABASE_URL`, or keep the Compose project name and `postgres_data` volume.
2. Keep the `submissions_data` volume or attach the same private persistent disk at `SUBMISSIONS_DIR` when physical files must survive directly.
3. Back up the database before the release.
4. Deploy the new code and run `npm run migrate`.
5. Set `APP_ORIGIN` to the new public origin and configure the reverse proxy correctly.
6. Verify `/healthz` and the schema-aware `/readyz` before sending learners to the deployment.

Browser session tokens cannot cross domains because they live in origin-scoped browser storage. On a new hostname, the learner signs in again with the same email and password. The new app then reads the account state from the same PostgreSQL database. In a clean browser it also restores saved exercise files as their exercises are opened. If the physical mirror volume was not moved, opening or re-saving an exercise rebuilds that file from PostgreSQL.

If the new domain already has a local draft for an exercise, that local draft wins the merge. Use **Download .py** before signing in when a learner wants an extra manual copy of either side.

## Backup and restore

### Docker Compose database

Stop application writes, create a custom-format dump, and restart the app:

```bash
docker-compose stop app
docker-compose exec -T postgres sh -c \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
  > python-eduground.dump
docker-compose start app
```

Check that the dump is readable:

```bash
pg_restore --list python-eduground.dump > /dev/null
```

To restore, stop the app, restore into the existing Compose database, then start and check readiness:

```bash
docker-compose stop app
docker-compose exec -T postgres sh -c \
  'pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner' \
  < python-eduground.dump
docker-compose start app
curl --fail http://127.0.0.1:8000/readyz
```

`--clean` replaces existing objects and data. Test restores away from production first and retain multiple dated backups.

### Managed database

Use provider snapshots when available, plus a portable PostgreSQL dump:

```bash
pg_dump --format=custom --file=python-eduground.dump "$DATABASE_URL"
pg_restore --list python-eduground.dump > /dev/null
```

Restore to a new empty database first, point a staging app at it, run the readiness and account checks, and only then decide whether to promote it. Provider-specific connection options and certificates take precedence over these generic commands.

The Python-file volume is a derived mirror, so a verified PostgreSQL backup contains the authoritative source needed to rebuild files as learners open or re-save exercises. Back up `submissions_data` or the managed `SUBMISSIONS_DIR` disk as well when an immediately complete directory tree is operationally important.

## Security limitations

The account backend is intentionally small and is not yet a complete public identity platform:

- Passwords use Node's scrypt and session tokens are stored as SHA-256 hashes in PostgreSQL. The raw bearer token is stored in browser `localStorage`; any successful same-origin script injection could read it. Use HTTPS and a strict content-security policy before public exposure.
- Registration/login rate limits are in process memory. They reset on restart and are not shared across replicas. Put production-grade rate limiting at a trusted gateway or shared store.
- There is no email verification, password reset/change flow, MFA, account lockout, session list, or user-facing account deletion.
- `DATABASE_SSL=require` currently enables encrypted transport with certificate verification disabled. Prefer a private provider network or extend the server to accept a trusted CA before high-assurance deployment.
- Learner source, progress, and detailed result/traceback content are readable by the database operator and backups. When `SUBMISSIONS_DIR` is enabled, source is also readable by operators with access to that private disk. The app does not add field-level encryption or a retention job.
- Submission files use private per-user directories and are excluded from the static-file allowlist. Multiple app replicas must share one suitable persistent filesystem or disable the mirror and rely on PostgreSQL.
- Client-submitted passes and run results are educational records, not tamper-resistant grading evidence.
- Hidden tests are delivered to the browser and remain inspectable. This is not a secure examination system.
- Timed-assessment questions, answer indexes, practical tests, scores, deadlines, and timer logic are client-side. The browser clock and stored deadline can be altered, so the 20/60-minute rooms are practice constraints rather than proctoring controls.
- `APP_ORIGIN` checks help reject unwanted browser origins, but they do not replace authentication, TLS, proxy hardening, secret rotation, monitoring, or database access controls.
- The Compose defaults are for development. Change credentials, restrict the published database port, and use managed secrets before any public deployment.

## Data deletion caveats

**Sign out does not delete learner data.** It revokes the current server session and removes the token from that browser, while local drafts/progress, PostgreSQL account records, and mirrored Python files remain. There is no user-facing deletion endpoint yet; an administrative deletion must remove both the database user and that user's UUID directory under `SUBMISSIONS_DIR`.

To remove local-only data, the learner must clear site data for that exact origin. There is no granular local reset UI yet.

There is also no user-facing account deletion endpoint. A database administrator must first identify the normalized account, then delete its `users` row in a controlled transaction:

```sql
BEGIN;
SELECT id, email, display_name, created_at
FROM users
WHERE email = LOWER('learner@example.com');

DELETE FROM users
WHERE email = LOWER('learner@example.com');
COMMIT;
```

The foreign keys cascade that deletion to sessions, state, files, and test runs. Database dumps, provider snapshots, replica lag, logs, and exported `.py` files remain outside that transaction and must follow the operator's documented retention/deletion process. Take care not to restore a deliberately deleted account from an older backup without handling the deletion request again.
