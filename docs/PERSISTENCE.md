# Persistence and PostgreSQL operations

Python EduGround is local-first. The curriculum, editor, Python worker, exercises,
and assessments work without an account. PostgreSQL sync is an explicit learner
choice for progress that should survive browser-data loss, another device, or an
application redeploy.

Deployment, backup, restore, reverse-proxy, and rollback commands are maintained in
[DEPLOYMENT.md](DEPLOYMENT.md). Security controls and residual risks are in
[SECURE_SDLC.md](SECURE_SDLC.md).

## Persistence modes

### Local-only workspace

Without PostgreSQL, the browser stores these values under the exact current origin:

- exercise drafts and passed exercise IDs;
- tutorial, runbook, and class-material markers;
- timed-assessment deadlines, answers, drafts, summaries, and recent results;
- editor keymap, theme, sound preference, and last route.

Typing saves a draft after a short delay. **Save** flushes it immediately, and
**Download .py** creates a portable local file. A database outage does not remove or
disable this browser copy.

Browser storage is origin-specific. These are different workspaces:

```text
http://127.0.0.1:8000
http://localhost:8000
https://learn.example.com
```

Clearing site data, changing origin, or using another browser loses access to
unsigned local-only data. Download important files or sign in before moving domain.

Within one origin, the app keeps an anonymous workspace and a separate cached
workspace for each account. Signing out returns to the anonymous workspace rather
than showing the previous learner's drafts. The account workspace remains cached
and is merged again after a future sign-in.

### Signed-in account workspace

Registration or sign-in opts into same-origin API sync. The server sends the
session in an `HttpOnly`, `SameSite=Strict` cookie; on recognized HTTPS requests it
uses a `Secure`, `__Host-` cookie. New raw session tokens are not stored in
`localStorage`. Registration and sign-in also return an independent random client
capability stored only in the current tab's `sessionStorage`. Every authenticated
API read and write requires both the cookie and the
`X-EduGround-Client-Capability` header. The Python worker receives neither value.
The app selects an account-scoped local workspace only after `/api/me` validates
both factors; a failed restore switches to the anonymous workspace.

The tab capability survives reloads in the same tab but not a closed tab or a new
tab, so those cases require sign-in again. The browser keeps only a non-secret,
durable session marker for UI state. Operators should leave the development-only
`ALLOW_BEARER_SESSION_TOKENS=false`.

After sign-in:

- passed exercise IDs and learning markers merge by set union;
- assessment histories and completion/best-score evidence merge monotonically;
- fields introduced by a newer release are retained when an older client syncs;
- a current local exercise draft wins when local and account drafts both exist;
- active drafts, active assessments, and editor settings remain last-writer-wins;
- state updates are merged while the learner's PostgreSQL row is locked;
- **Save** stores the exact source in `user_files` and its canonical `exNN.py`
  mirror;
- a complete **Run tests** saves the submitted source, then a normalized bounded
  run record;
- theme and sound remain device-local.

The server does not execute learner Python. Pyodide runs it in a dedicated browser
worker, so reported pass/fail results are labelled as learner-device evidence
rather than certified grading. The worker is not a sandbox for untrusted pasted
code: Pyodide exposes a JavaScript bridge and CSP-permitted runtime network access.
The separate tab capability prevents worker code from using an attached session
cookie to reach account APIs.

## Canonical chapter files

The server owns a stable mapping from all 92 exercise IDs to chapter directories
and zero-based filenames. The browser sends only an exercise ID and source text; it
cannot choose a server path.

```text
<SUBMISSIONS_DIR>/<user UUID>/
├── Py01 First Programs/
│   ├── ex00.py
│   ├── ex01.py
│   └── ...
├── Py08 Recursion/
│   ├── ex00.py
│   └── ex10.py
└── Py11 Divide and Conquer/
    ├── ex00.py
    ├── ex01.py
    └── ex02.py
```

Writes use a temporary file, filesystem synchronization, and atomic rename.
Per-user/chapter paths reject traversal and symlinks. The submission root is also
rejected if it overlaps an original solution directory or a publicly served asset
directory.

PostgreSQL `user_files` is authoritative. Reading a saved file recreates a missing
mirror. Set `SUBMISSIONS_DIR=off` when a deployment cannot provide suitable private
writable storage; account saving still works and the API reports that the mirror is
disabled.

Multiple application replicas must share one filesystem with the required atomic
rename and permission semantics, or disable the mirror. Never mount
`SUBMISSIONS_DIR` below a static-web root.

## Stored PostgreSQL data

Migration [`001_initial.sql`](../db/migrations/001_initial.sql) creates the data
model; [`002_session_client_capability.sql`](../db/migrations/002_session_client_capability.sql)
adds the worker-resistant session capability:

| Table | Purpose | User-deletion behavior |
| --- | --- | --- |
| `users` | Normalized email, display name, scrypt password record, creation time | Parent learner record |
| `sessions` | SHA-256 session-token and client-capability hashes with expiries | Cascades with `users` |
| `user_state` | Forward-compatible JSON progress, drafts, settings, and assessment state | Cascades with `users` |
| `user_files` | One canonical source snapshot per learner/exercise | Cascades with `users` |
| `test_runs` | Bounded normalized run records reported by the learner device | Cascades with `users` |
| `schema_migrations` | Applied migration names, checksums, and timestamps | Operational metadata |

Current API bounds are:

| Data | Bound |
| --- | --- |
| Incoming or merged `user_state` | 384 KiB |
| One source file | 256 KiB |
| One normalized run-result array | 64 KiB |
| Results in one run | 100 |
| Text in one result field | 8 KiB, truncated when needed |
| Retained runs per user | `RUN_HISTORY_LIMIT`, default 500 and constrained to 10–5000 |

The current UI reloads assessment history from `user_state`, but it does not yet
list persisted `test_runs`. Those rows are a bounded future-history record, not
server-verified evidence.

## PostgreSQL connection policy

Use either `DATABASE_URL` or the standard `PG*` variables. `PG*` is preferred for
secret managers because passwords do not require URL encoding:

```bash
export PGHOST='db.example.net'
export PGPORT='5432'
export PGDATABASE='eduground'
export PGUSER='eduground_app'
export PGPASSWORD_FILE='/run/secrets/eduground-runtime-password'
```

For external PostgreSQL, enable verified TLS:

```bash
export DATABASE_SSL='require'
export DATABASE_SSL_CA_FILE='/run/secrets/provider-root-ca.pem'
```

`DATABASE_SSL_CA_FILE` is optional when the server certificate chains to the
operating system trust store. `DATABASE_SSL_CA` also accepts a PEM secret; literal
`\n` sequences are converted into PEM newlines. All `DATABASE_URL` query parameters
and fragments are rejected because the PostgreSQL parser can otherwise override
TLS, timeout, and connection policy. Configure policy through the dedicated
settings, including `DATABASE_SSL`, one CA option, and the development-only
`DATABASE_SSL_ALLOW_INSECURE`.

Compose intentionally uses `DATABASE_SSL=false` only on its private internal Docker
network. Run `npm run secrets:init` once to create two different, Git-ignored
credential files:

- `secrets/postgres_password` for the database owner and one-shot migration;
- `secrets/app_database_password` for restricted runtime role `eduground_app`.

The app must never run with the owner credential.

## Environment reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Unset | Optional PostgreSQL URL; mutually exclusive in practice with `PG*` |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Unset | PostgreSQL connection fields; use `PGPASSWORD_FILE` where files can be mounted |
| `PGPASSWORD_FILE` | Unset | File containing the PostgreSQL password; mutually exclusive with `PGPASSWORD` |
| `DATABASE_SSL` | `false` | `true` or `require` enables verified TLS |
| `DATABASE_SSL_CA` | Unset | Trusted CA PEM for PostgreSQL |
| `DATABASE_SSL_CA_FILE` | Unset | File containing the trusted PostgreSQL CA PEM; mutually exclusive with `DATABASE_SSL_CA` |
| `DATABASE_SSL_ALLOW_INSECURE` | `false` | Non-production diagnostic only; disables certificate verification |
| `DATABASE_POOL_SIZE` | `10` | Pool connections per app process, constrained to 1–100 |
| `DATABASE_CONNECT_TIMEOUT_MS` | `3000` | API connection timeout; migrations default to 5000 ms |
| `DATABASE_IDLE_TIMEOUT_MS` | `30000` | Idle pool connection timeout |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `10000` | PostgreSQL statement timeout |
| `MIGRATION_LOCK_TIMEOUT_MS` | `30000` | Maximum wait for the migration advisory lock, constrained to 1–300 seconds |
| `SUBMISSIONS_DIR` | `./submissions` | Private derived file root; use `off` for PostgreSQL-only storage |
| `SESSION_TTL_SECONDS` | `2592000` | Cookie/session lifetime, constrained to 1 hour–180 days |
| `RUN_HISTORY_LIMIT` | `500` | Retained run rows per learner, constrained to 10–5000 |
| `ALLOW_BEARER_SESSION_TOKENS` | `false` | Legacy/integration escape hatch; leave disabled |
| `APP_ORIGIN` | Required in production | Comma-separated exact allowed origins |
| `TRUST_PROXY_HOPS` | `0` | Exact number of trusted reverse proxies |
| `HSTS_MAX_AGE_SECONDS` | `31536000` | HSTS age on recognized HTTPS requests; `0` disables |
| `POSTGRES_DB` | `eduground` | Compose database name |
| `POSTGRES_USER` | `eduground` | Compose owner/migration role |
| `POSTGRES_PASSWORD_FILE` | `./secrets/postgres_password` | Compose owner-password file; generated by `npm run secrets:init` |
| `APP_DATABASE_PASSWORD_FILE` | `./secrets/app_database_password` | Compose restricted-runtime password file; must differ from owner |
| `COMPOSE_PROJECT_NAME` | `fundamentos-de-programacao-playground` | Stable Compose resource/volume prefix |

HTTP request and connection bounds are documented in `.env.example`.

## Migrations and readiness

Migrations:

- use filenames such as `001_initial.sql`;
- run in lexical order;
- serialize through a PostgreSQL advisory lock with a bounded wait;
- run each new file in a transaction;
- record a SHA-256 checksum;
- fail if an already-applied migration changes.

Never edit an applied migration. Add the next numbered file.
The migration command also refuses to run as the reserved `eduground_app`
runtime role, preventing an accidental fresh deployment from making the
least-privileged app role the schema owner.

`/healthz` only proves the Node process is alive. `/readyz` and `/api/health`
require PostgreSQL connectivity, every required relation, and matching checksums for
all migration files currently in the image. A reachable but stale or modified
schema is not ready.

Compose runs the one-shot owner migration first, then applies the explicit
per-table `eduground_app` grants, then starts the restricted app. The runtime can
read but cannot modify `schema_migrations`; future tables receive no automatic
privileges. Managed deployments must implement the same ordering before traffic is
switched.

## API contract

The browser uses relative same-origin endpoints and sends the session cookie
automatically. Every authenticated request must also send
`X-EduGround-Client-Capability`. Cookie-authenticated `POST`, `PUT`, `PATCH`, and
`DELETE` requests must additionally include a matching `Origin`.

| Method and path | Purpose |
| --- | --- |
| `GET /healthz` | Process liveness |
| `GET /readyz`, `GET /api/health` | Database and migration readiness |
| `POST /api/auth/register` | Create an account and cookie session; password minimum 10 characters |
| `POST /api/auth/login` | Create a new cookie session |
| `POST /api/auth/logout` | Revoke the current session and expire session cookies |
| `GET /api/me` | Restore identity after validating the cookie and tab capability |
| `GET /api/state` | Read account state |
| `PUT /api/state` | Transactionally merge account state |
| `GET /api/files/:exerciseId` | Read saved source and re-materialize its canonical file |
| `PUT /api/files/:exerciseId` | Save source under the server-owned mapping |
| `POST /api/runs` | Store one normalized, bounded learner-device run record |

There is no API yet to list runs, verify email, change/reset a password, list/revoke
other sessions, or delete an account.

## Upgrade and domain changes

`git pull` changes tracked application files; it does not modify browser
`localStorage`, a managed PostgreSQL database, or Docker named volumes. Preserve:

- the browser origin for unsigned progress;
- the database/`postgres_data` volume for account progress;
- the `submissions_data` volume or managed submission mount for immediate file
  mirrors;
- the existing `COMPOSE_PROJECT_NAME`;
- stable exercise, learning-marker, and assessment IDs.

On a new domain, the learner signs in again because cookies are origin-bound. The
same database restores account state and saved sources. If a new-origin local draft
already exists, that local draft wins for the exercise; download both sides before
sign-in when manual comparison is important.

Follow the exact [upgrade procedure](DEPLOYMENT.md#upgrade-without-losing-learner-progress).
Never use `docker compose down -v` during an active upgrade.

Migration `002_session_client_capability.sql` deliberately invalidates older
cookie-only sessions because they do not have the second factor. Learner data is
unchanged; users sign in once to create the hardened session.

## Backup, restore, and deletion

Use the [backup and restore runbook](DEPLOYMENT.md#backup) before every persistence
change. A production process should also provide encrypted off-host copies, bounded
retention, success alerts, and regular isolated restore drills.

The submission volume is a derived mirror. PostgreSQL contains the authoritative
source, but backing up the volume can reduce recovery time for a large installation.

**Sign out does not delete data.** It immediately removes the tab capability,
records an explicit local sign-out, and returns the browser to its anonymous
workspace. When the API is reachable it also revokes the server session. An offline
sign-out cannot contact PostgreSQL, but the remaining cookie alone is insufficient
for authenticated API access. The account cache, PostgreSQL rows, canonical files,
backups, and exported downloads remain.

There is no user-facing account-deletion endpoint. An administrator can delete a
normalized user in a controlled transaction:

```sql
BEGIN;
SELECT id, email, display_name, created_at
FROM users
WHERE email = LOWER('learner@example.com');

DELETE FROM users
WHERE email = LOWER('learner@example.com');
COMMIT;
```

Foreign keys remove sessions, state, saved files, and run rows. The operator must
separately remove that user UUID's directory from `SUBMISSIONS_DIR` and track the
deletion through backup retention, replicas, logs, and exported files. Restoring an
older backup can resurrect deleted data unless deletion requests are replayed.

## Security and consistency limitations

- The learner controls all browser-side grading, hidden tests, scores, timers, and
  client-submitted run evidence.
- Account mutation limits are per Node process, reset on restart, and are not shared
  across replicas.
- Operators and backups can read learner source, progress, result details, and
  tracebacks; there is no field-level encryption.
- Draft and active-attempt conflicts are last-writer-wins and do not yet have a
  comparison UI.
- Account lifecycle features such as email verification, password reset/change,
  MFA, session management, and self-service deletion are not implemented.
- A multi-replica file mirror needs shared storage with safe atomic semantics.
- Backups are only trustworthy after a successful restore drill.
