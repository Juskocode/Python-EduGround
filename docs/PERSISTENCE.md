# Persistence and PostgreSQL operations

Python EduGround is local-first. The complete learning experience works without an account or database, while account sync is an explicit opt-in for learners who want their code and progress to survive browser-data resets, a new device, or an application redeploy.

## Persistence modes

### Local-only fallback

Without `DATABASE_URL`, the Node server still serves the curriculum and browser Python runner. The following values are stored only in `localStorage` for the current browser origin:

- Exercise drafts.
- Passed exercise IDs, stars, ranks, and badges derived from those passes.
- Tutorial/runbook understanding markers.
- Sublime or Vim editor selection.
- Theme, sound preference, and last exercise.

Typing updates the local draft after a short debounce. **Save** flushes it immediately, and **Download .py** creates a normal file on the learner's computer. A database outage does not delete or disable this local copy.

Local storage is origin-specific. `http://127.0.0.1:8000`, `http://localhost:8000`, and `https://learn.example.com` are three separate browser stores. Clearing site data or using another browser removes access to that local-only copy.

### Opt-in account sync

When PostgreSQL is configured, the profile menu offers account registration and sign-in. Nothing is uploaded before the learner chooses one of those actions.

After sign-in:

- Passed exercises and learning markers merge by union, so completed work is not removed by another device.
- A local draft wins when both the current browser and the account contain a draft for the same exercise.
- Drafts, passed IDs, learning markers, and editor mode are pushed as account state after changes.
- **Save** also upserts a named Python file for the current exercise.
- Each visible or complete test run records its result details, including expected/actual values, stdout, stderr, and tracebacks.
- Theme and sound remain device-local.

The server never receives repository solution code from the learner UI. Learner Python executes in the Pyodide browser worker, not in Node or PostgreSQL.

## Stored data

Migration [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql) creates:

| Table | Purpose | Deletion behaviour |
| --- | --- | --- |
| `users` | Normalized email, display name, scrypt password record, creation time | Parent learner record |
| `sessions` | SHA-256 hashes of bearer tokens and expiry times | Cascades with the user |
| `user_state` | JSON account state: passes, drafts, learning markers, editor mode | Cascades with the user |
| `user_files` | One explicitly saved filename and source file per user/exercise | Cascades with the user |
| `test_runs` | Append-only summaries and detailed result JSON for completed runs | Cascades with the user |
| `schema_migrations` | Applied migration names and checksums | Operational metadata, not learner data |

Current request limits are 384 KiB for account state, 256 KiB for one saved source file, and 256 KiB/250 items for one test-result payload. The server accepts one `user_files` row per learner and exercise.

Test runs are persisted for signed-in learners, but the current UI does not retrieve or display historical runs after a reload. They are an operational record for future history UI, not currently a learner-facing archive.

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

The `app` service waits for the `postgres` health check, runs `npm run migrate`, and then starts the same-origin web/API server. Re-running the migration command is safe.

The Compose file uses the named `postgres_data` volume. These commands rebuild or replace the application container without deleting PostgreSQL data:

```bash
docker-compose up -d --build
docker-compose up -d --build --force-recreate app
docker-compose down
```

Running `docker-compose down -v`, `docker volume rm`, or deleting the Docker/VM storage **does delete the database volume**. A named volume is persistence, not a backup.

## Use an existing or managed PostgreSQL database

The app and API are one Node process and should be deployed on the same public origin. Point every application release at the same external PostgreSQL database:

```bash
export DATABASE_URL='postgresql://app_user:encoded-password@db.example.net:5432/eduground'
export DATABASE_SSL='require'
export APP_ORIGIN='https://learn.example.com'
export TRUST_PROXY='true'
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
| `SESSION_TTL_SECONDS` | `2592000` | Session lifetime; the server constrains it to 1 hour–180 days |
| `APP_ORIGIN` | Unset | Comma-separated allowed browser origins for state-changing requests |
| `TRUST_PROXY` | False | Trust forwarded protocol/IP headers; enable only behind a trusted reverse proxy |
| `HOST` | `127.0.0.1` | Node listening address |
| `PORT` | `8000` | Node listening port |
| `POSTGRES_DB` | `eduground` | Compose PostgreSQL database name |
| `POSTGRES_USER` | `eduground` | Compose PostgreSQL role |
| `POSTGRES_PASSWORD` | `change-me` | Compose-only development default; must be changed |
| `POSTGRES_PORT` | `5432` | Host port published by the Compose PostgreSQL service |

For a TLS-terminating reverse proxy, set both `APP_ORIGIN` to the exact public HTTPS origin and `TRUST_PROXY=true`. Only enable `TRUST_PROXY` when the app cannot be reached except through that trusted proxy.

## API contract

The browser uses relative, same-origin endpoints. Authenticated calls carry `Authorization: Bearer <token>`.

| Method and path | Purpose |
| --- | --- |
| `GET /healthz` | Process liveness; does not require PostgreSQL |
| `GET /readyz` or `GET /api/health` | Database configuration and readiness |
| `POST /api/auth/register` | Create an account and session; password minimum is 10 characters |
| `POST /api/auth/login` | Create a new session for an existing account |
| `POST /api/auth/logout` | Revoke the current session token |
| `GET /api/me` | Restore the current signed-in identity |
| `GET /api/state` | Read merged learner account state |
| `PUT /api/state` | Replace the learner account-state document |
| `GET /api/files/:exerciseId` | Read the account's explicitly saved file for an exercise |
| `PUT /api/files/:exerciseId` | Create or update that saved file |
| `POST /api/runs` | Append one detailed test-run record |

There is currently no API to list test runs, change/reset a password, verify email, or delete an account.

## Moving to a new deployment or domain

Application containers are disposable; PostgreSQL is the durable boundary. To retain accounts during an upgrade:

1. Keep the same managed `DATABASE_URL`, or keep the Compose `postgres_data` volume.
2. Back up the database before the release.
3. Deploy the new code and run `npm run migrate`.
4. Set `APP_ORIGIN` to the new public origin and configure the reverse proxy correctly.
5. Verify `/healthz` and `/readyz` before sending learners to the deployment.

Browser session tokens cannot cross domains because they live in origin-scoped browser storage. On a new hostname, the learner signs in again with the same email and password. The new app then reads the account state from the same PostgreSQL database. In a clean browser it also restores saved exercise files as their exercises are opened.

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

## Security limitations

The account backend is intentionally small and is not yet a complete public identity platform:

- Passwords use Node's scrypt and session tokens are stored as SHA-256 hashes in PostgreSQL. The raw bearer token is stored in browser `localStorage`; any successful same-origin script injection could read it. Use HTTPS and a strict content-security policy before public exposure.
- Registration/login rate limits are in process memory. They reset on restart and are not shared across replicas. Put production-grade rate limiting at a trusted gateway or shared store.
- There is no email verification, password reset/change flow, MFA, account lockout, session list, or user-facing account deletion.
- `DATABASE_SSL=require` currently enables encrypted transport with certificate verification disabled. Prefer a private provider network or extend the server to accept a trusted CA before high-assurance deployment.
- Learner source, progress, and detailed result/traceback content are readable by the database operator and backups. The app does not add field-level encryption or a retention job.
- Client-submitted passes and run results are educational records, not tamper-resistant grading evidence.
- Hidden tests are delivered to the browser and remain inspectable. This is not a secure examination system.
- `APP_ORIGIN` checks help reject unwanted browser origins, but they do not replace authentication, TLS, proxy hardening, secret rotation, monitoring, or database access controls.
- The Compose defaults are for development. Change credentials, restrict the published database port, and use managed secrets before any public deployment.

## Data deletion caveats

**Sign out does not delete learner data.** It revokes the current server session and removes the token from that browser, while local drafts/progress and PostgreSQL account records remain.

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
