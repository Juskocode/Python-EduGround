# Secure SDLC and release policy

This document defines the security boundary, required development gates, review
rules, and release evidence for Python EduGround. It complements the operational
[deployment runbook](DEPLOYMENT.md), [persistence guide](PERSISTENCE.md), and
[vulnerability reporting policy](../SECURITY.md).

## Security objective

The project protects learner accounts, progress, saved source, deployment secrets,
and the software supply chain. It does not claim that browser-side exercise or
assessment results are tamper-resistant.

| Boundary | Trusted responsibility | Important limitation |
| --- | --- | --- |
| Learner browser | Displays course content, executes Python in a worker, and sends account data through the same-origin API | The learner controls the browser, JavaScript, clock, local storage, test data, and reported results; the worker is not a sandbox for untrusted pasted code |
| Node web/API process | Authenticates accounts, enforces account isolation and input bounds, maps exercise IDs to safe paths, and serves an explicit public-file allowlist | It does not execute or independently grade learner Python |
| PostgreSQL | Authoritative account state, saved files, hashed sessions, and bounded run history | Database operators and backups can read learner data; no field-level encryption is provided |
| Submission volume | Derived per-user `exNN.py` mirror | PostgreSQL remains authoritative; the volume is private and must never be served as a static directory |
| CI and release workflows | Reproducible validation, integration testing, scanning, SBOM generation, and provenance | GitHub repository settings must enforce reviews and required checks |
| Pyodide CDNs | Deliver the pinned browser Python runtime on first use | Initial execution depends on external availability; the CSP permits only the configured CDN origins |

Every persisted test run is labelled `verification: learner-device`. Stars,
assessment scores, hidden tests, and timers are educational feedback. Certified or
proctored assessment requires server-held tests, server-side execution, independent
timekeeping, and a separate threat model.

## Runtime controls

The checked-in runtime establishes these controls:

- New sessions use two factors local to the browser tab: an `HttpOnly`,
  `SameSite=Strict` cookie and an independent random client capability held only in
  `sessionStorage`. PostgreSQL stores only hashes of both values. Every
  authenticated API read and write requires both; the Python worker receives
  neither capability nor cookie value.
- HTTPS requests use a `Secure`, `__Host-` cookie and expire the legacy local cookie.
  New bearer tokens are not returned unless an operator deliberately enables the
  development-only `ALLOW_BEARER_SESSION_TOKENS` compatibility option.
- Cookie-authenticated state changes additionally require an `Origin` header
  matching `APP_ORIGIN`. Production startup fails when `APP_ORIGIN` is absent.
- Responses include a CSP, frame denial, MIME sniffing protection, a restrictive
  permissions policy, no-referrer policy, and HSTS on requests recognized as HTTPS.
- Request, header, connection, state, source-file, result-field, result-count, and
  retained-run bounds limit accidental or abusive resource growth.
- Authentication and mutation rate limits exist in process memory. A public
  multi-replica deployment still needs shared gateway or datastore-backed rate
  limiting.
- Passwords use scrypt. Only session-token and client-capability hashes are stored
  in PostgreSQL.
- PostgreSQL queries are parameterized, migrations are ordered and transactionally
  applied under a bounded advisory-lock wait, and applied migration checksums are
  verified by `/readyz`. The migration command refuses the reserved runtime role,
  so a fresh database cannot silently collapse owner and application privileges.
- The runtime database role receives an explicit per-table operation matrix only
  after migrations complete. It can read but cannot modify `schema_migrations`,
  and future tables receive no automatic privileges.
- TLS-enabled PostgreSQL connections verify the certificate. A custom CA can be
  supplied with `DATABASE_SSL_CA_FILE` or `DATABASE_SSL_CA`; insecure verification
  is forbidden when `NODE_ENV=production`.
- The production image is digest-pinned, installs from the lockfile without package
  lifecycle scripts, copies an explicit runtime allowlist, and runs as the
  unprivileged `node` user.
- The Compose application uses a read-only root filesystem, drops Linux
  capabilities, prevents privilege escalation, and writes only to its private
  submission volume and bounded temporary filesystem.

The CSP intentionally permits `'unsafe-eval'` for the browser Python runtime and
`'unsafe-inline'` styles for the current editor integration. That is a narrower
source policy, not a nonce-only CSP. Treat frontend injection prevention and review
as an active security requirement.

The dedicated Python worker is an execution and availability boundary, not a
general-purpose security sandbox. Pyodide exposes a JavaScript bridge, and learner
code can contact origins allowed by the CSP for runtime delivery. Do not paste or
run code from an untrusted source. The tab capability prevents that worker from
reading or mutating authenticated account APIs even though the browser may attach
the HttpOnly cookie to a same-origin fetch.

## Developer gates

Install exactly from the lockfile:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

Run the deterministic local gate before every commit:

```bash
npm run validate
npm run validate:browser
node --check python-runner-worker.mjs
git diff --check
```

`npm run validate` includes application syntax checks, curriculum and assessment
schema checks, backend unit tests, solution-leak checks, migration-manifest checks,
database configuration checks, and the static security-policy validator.
`npm run validate:browser` runs the Chromium learner journeys and Axe scans used by
CI. Install the pinned Playwright Chromium runtime once with
`npx playwright install chromium` when it is not already present.

Database changes and all release candidates must also pass the mandatory PostgreSQL
integration gate against an isolated database:

```bash
export TEST_DATABASE_URL='postgresql://eduground_test:test-only@127.0.0.1:5432/eduground_test'
npm run validate:integration
```

The command fails closed if `TEST_DATABASE_URL` is missing. It applies the real
migrations and tests account creation, cookie-plus-capability restoration and
revocation, denial of worker-style requests without the capability, origin
enforcement, state merging, concurrent file writes, canonical file materialization,
run-result normalization, and history retention.

The local release gate combines the deterministic checks, PostgreSQL integration,
and a high-severity dependency audit:

```bash
export TEST_DATABASE_URL='postgresql://eduground_release:release-only@127.0.0.1:5432/eduground_release'
npm run validate:release
node --check python-runner-worker.mjs
git diff --check
```

Use a disposable test database. Do not point integration or release validation at
learner data. `npm run validate:links` is a useful network check for external
learning references, but it is not a deterministic merge gate.

## Pull-request review

Security-sensitive changes include authentication, cookies, origin or proxy logic,
public static assets, learner-state merge rules, file paths, migrations, database
roles, Docker files, workflows, dependencies, exercise tests, and solution
artifacts.

Every such change should include:

1. The affected trust boundary and abuse case.
2. Tests for the allowed case and the rejected or failure case.
3. Migration, backup, rollback, and compatibility notes when state changes.
4. Evidence that no solution, secret, learner code, or token enters logs or public
   artifacts.
5. An update to the relevant operator or security document.

Do not edit an applied migration. Add the next numbered migration. Do not weaken a
security assertion or required CI check merely to make a failing release pass.

## CI and supply-chain gates

| Workflow | Gate or evidence |
| --- | --- |
| `CI` | Lockfile install, deterministic validation, required Chromium learner journeys and Axe scans, worker syntax, patch hygiene on Node 22 and 24, real PostgreSQL integration, and a full restricted Compose bootstrap/migration/persistence gate |
| `Supply-chain security` | Pull-request dependency review and scheduled/push `npm audit` |
| `CodeQL` | JavaScript/TypeScript and GitHub Actions analysis with extended security queries |
| `Container security` | Production-image build, read-only container smoke test, and Trivy high/critical vulnerability and secret scan |
| `Documentation links` | Scheduled external Python-documentation link monitor; informative rather than a merge gate |
| `Release container` | Manual full release and browser/accessibility validation, build-once image, smoke test, Trivy scan, SPDX JSON SBOM, bounded evidence artifacts, optional GHCR publication, and provenance attestation |

External actions and Docker base images are pinned to immutable commit SHAs or image
digests. Dependabot proposes lockfile, action, and container updates; reviewers must
treat action-SHA and base-image updates as supply-chain changes.

The workflows are necessary but not sufficient. Configure branch protection,
required checks, CODEOWNER review, read-only default workflow permissions, secret
scanning, push protection, CodeQL advanced setup, and the protected `production`
environment as described in
[`.github/SECURE_DELIVERY.md`](../.github/SECURE_DELIVERY.md).

## Release and promotion

The manual `Release container` workflow accepts a semantic version such as
`v1.2.3`. Its default mode validates and creates evidence without publishing.
Publication is allowed only when dispatched from the matching `vX.Y.Z` Git tag,
after the protected `production` environment approves the second job.

The workflow:

1. Runs the complete deterministic and PostgreSQL release gates.
2. Builds the candidate image once with revision/version labels.
3. Runs and smoke-tests that exact image with a read-only filesystem.
4. Fails on fixed high or critical image vulnerabilities and secret findings.
5. Generates an SPDX JSON SBOM and uploads bounded diagnostic evidence.
6. If approved, proves the version and full commit-SHA tags do not already exist,
   loads the validated image artifact, publishes those immutable tags to GHCR, and
   records a provenance attestation.

It does not deploy. A downstream operator must deploy the published digest, run the
explicit migration step with owner credentials, verify `/readyz`, and retain the
previous compatible image digest. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Incident response

For suspected credential, account, database, image, dependency, or workflow
compromise:

1. **Contain.** Stop publication or traffic to the affected revision. Disable a
   compromised workflow or environment and preserve the previous known-good image
   digest.
2. **Preserve evidence.** Record UTC times, commit/image digests, affected routes,
   sanitized logs, CI artifacts, database audit evidence, and the scope of exposed
   data. Do not copy learner source or credentials into public issues.
3. **Revoke access.** Invalidate active application sessions in a controlled
   transaction:

   ```sql
   BEGIN;
   TRUNCATE TABLE sessions;
   COMMIT;
   ```

   Rotate the restricted `eduground_app` password, the database-owner credential,
   environment secrets, and any affected repository or registry credentials.
   Changing `.env` alone does not change passwords inside an existing PostgreSQL
   volume. Follow the tested
   [Compose credential-rotation runbook](DEPLOYMENT.md#rotate-compose-database-credentials)
   so database roles change before their mounted secret files.
4. **Eradicate.** Patch from a clean branch, update compromised pins, run the full
   release gates, and produce a new image/SBOM/attestation. Do not reuse an
   untrusted build artifact.
5. **Recover.** Restore from a verified backup only when integrity requires it,
   apply all migrations, run `/healthz`, `/readyz`, and account/file smoke checks,
   then reintroduce traffic gradually.
6. **Communicate and learn.** Follow `SECURITY.md`, notify affected operators or
   learners when appropriate, document root cause and exposure, and add a
   regression test or policy gate.

## Residual risks

The current release still requires explicit acceptance of these limitations:

- Exercise and assessment answers, hidden tests, client scores, timers, and passed
  states can be inspected or modified by the learner.
- The CSP needs `unsafe-eval` and inline styles for current browser runtime/editor
  compatibility.
- Rate limits are local to one Node process and reset on restart.
- There is no email verification, password reset/change, MFA, account lockout,
  session-management UI, or user-facing account deletion.
- The required Chromium and accessibility baseline does not yet cover CDN failure,
  every timed-room transition, or authenticated multi-device conflict behavior.
- Learner source and progress are readable by database/storage operators and by
  anyone who can restore a backup.
- Backup encryption, off-site retention, restore scheduling, monitoring, and
  deletion propagation are operator responsibilities.
- Rolling back application code after a forward migration is safe only when the old
  code is schema-compatible. Migrations are forward-only.

Track unresolved work in [ROADMAP.md](ROADMAP.md).
