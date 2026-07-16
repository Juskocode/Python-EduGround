# Python EduGround improvement backlog

This backlog starts from the delivered classroom, browser IDE, timed practice rooms,
local-first workspaces, PostgreSQL sync, secure-cookie baseline, hardened Compose
stack, and CI/release workflows. Each open section is issue-ready. Priorities are
recommended order, not a delivery commitment.

## Delivered security and delivery foundation

The current repository includes:

- HttpOnly, strict same-site sessions with Secure `__Host-` cookies on HTTPS plus a
  hashed, tab-only client capability unavailable to the Python worker;
- capability enforcement for every authenticated API request and exact-origin
  enforcement for cookie-authenticated state changes;
- CSP and browser security headers, bounded request/server settings, and graceful
  shutdown;
- verified PostgreSQL TLS with custom-CA support and password-safe `PG*`
  configuration;
- bounded/normalized learner-device run records and retained-history limits;
- a digest-pinned, non-root production image with explicit copied assets;
- a private Compose database, required secrets, owner/runtime role separation,
  one-shot migrations, a read-only app filesystem, dropped capabilities, and
  schema-aware readiness;
- deterministic/unit/security validation, mandatory PostgreSQL integration,
  dependency review/audit, CodeQL, container smoke/scan, SBOM generation, and
  optional attested GHCR publication;
- secure-SDLC, deployment, persistence, vulnerability-reporting, and repository
  enforcement runbooks.

The open work below should extend these controls rather than bypass them.

## 1. Choose a public license and complete provenance

**Priority:** P0
**Suggested labels:** `release`, `documentation`, `legal-review`

Acceptance criteria:

- A maintainer-approved root `LICENSE` is added.
- `NOTICE` distinguishes original solutions, reconstructed prompts/tests, generated
  artifacts, supplied PDF inspiration, and vendored dependencies.
- `CONTRIBUTING.md` documents solution isolation, analogous-example rules, stable
  IDs, security review, and migration policy.
- Historical author identity/email exposure is reviewed before history is mirrored
  elsewhere.

## 2. Complete the account lifecycle and shared abuse controls

**Priority:** P0
**Suggested labels:** `security`, `backend`, `accounts`

The cookie/session boundary is delivered; public identity lifecycle controls are
not.

Acceptance criteria:

- Email verification and safe password change/reset flows are implemented.
- Learners can list and revoke sessions, revoke all other sessions, and delete an
  account with explicit confirmation.
- MFA or passkey support is evaluated for public deployments.
- Registration, login, state writes, file writes, and run submissions use shared
  rate limits across replicas with abuse alerts.
- Session and account security events are auditable without logging cookies,
  passwords, learner code, or result payloads.
- Account deletion is tracked through mirrors, replicas, and backup retention.

## 3. Add browser end-to-end and accessibility release gates

**Priority:** P0
**Suggested labels:** `testing`, `ci`, `accessibility`

The current CI deeply validates data, backend behavior, PostgreSQL, container
startup, supply chain, and static security policy. It does not yet exercise the full
browser UI.

Acceptance criteria:

- Browser flows cover home → class/exercise, Sublime/Vim switching, keyboard
  shortcuts, local save, signed-in sync, session restoration, sign-out isolation,
  and pass/fail output.
- Assessment flows cover absolute deadlines, reload/resume, automatic expiry,
  exact-set theory scoring, practical checks, and cross-account workspace isolation.
- Worker startup, syntax/runtime failures, timeout recovery, CDN fallback, offline
  status, and database unavailability are tested.
- Automated accessibility checks have no serious/critical findings.
- Failure screenshots, traces, console output, and sanitized server logs are
  retained as bounded CI artifacts.

## 4. Automate observability, backups, and recovery evidence

**Priority:** P0
**Suggested labels:** `operations`, `database`, `reliability`, `security`

The repository now has executable backup/restore and incident runbooks; production
automation remains operator-owned.

Acceptance criteria:

- Encrypted off-host backups have retention, immutability, success/failure alerts,
  and documented RPO/RTO.
- A scheduled isolated restore drill proves the current release can restore a known
  account, state row, source file, and new run.
- Deployment gates migration success, attestation verification, `/readyz`, account
  smoke, and file smoke before traffic.
- Metrics cover pool saturation, statement timeouts, auth failures, rate limiting,
  sync failures, disk/database growth, backup age, and restore-drill age.
- Logs and metrics are reviewed to guarantee that learner source, tracebacks,
  credentials, cookies, and request bodies are not exported accidentally.
- Forward-migration compatibility and emergency rollback decisions are rehearsed.

## 5. Make sync conflicts and run history visible

**Priority:** P1
**Suggested labels:** `sync`, `ux`, `data`

Acceptance criteria:

- Drafts and account state carry explicit revisions or timestamps.
- A conflict view compares local and remote drafts before replacement.
- Learners can keep local, keep remote, download both, or save a new copy.
- The exercise page lists and reopens the bounded persisted run history and clearly
  labels it as learner-device evidence.
- Sync status distinguishes pending, synced, offline, conflict, expired session,
  rate limited, and server error.
- Multi-tab and two-device behavior has deterministic tests.

## 6. Make mastery evidence-based

**Priority:** P1
**Suggested labels:** `education`, `progress`, `ux`

Acceptance criteria:

- The UI separates **read**, **practised**, and **mastered** states.
- Guided-practice and checkpoint attempts persist locally and in account state.
- Correct checkpoint state, evidence, and retries survive reloads.
- Existing state versions migrate without loss.
- Dashboard, chapter hub, profile, and exports use one documented mastery model.
- Client-side mastery remains explicitly educational unless verified server-side.

## 7. Turn guided practices into runnable micro-labs

**Priority:** P1
**Suggested labels:** `education`, `enhancement`, `runner`

Acceptance criteria:

- Each guided practice has an editable Run/Reset workspace.
- Learners predict, execute, inspect output/traceback, and then reveal coaching.
- Practice drafts persist separately from graded exercises and can optionally sync.
- Examples stay unrelated to graded answers and pass solution-leak validation.
- Every action is keyboard and screen-reader accessible.

## 8. Complete a WCAG keyboard, focus, and contrast pass

**Priority:** P1
**Suggested labels:** `accessibility`, `ui`

Acceptance criteria:

- Route changes consistently move focus to the new page heading or main landmark.
- Tutorial navigation exposes the active section with `aria-current`.
- Profile/account overlays have predictable focus entry, Escape/outside dismissal,
  and focus return.
- Vim mode provides accessible mode guidance and an obvious escape path.
- Text and controls meet WCAG AA contrast in both themes.
- Test announcements summarize failures without repeatedly reading full tracebacks.

## 9. Improve draft and failure recovery

**Priority:** P1
**Suggested labels:** `editor`, `ux`, `runner`

Acceptance criteria:

- Restart confirms only when code differs from the starter.
- An undo action restores the most recently discarded draft.
- Expected, actual, streams, and traceback sections each have Copy controls.
- Python line references jump to and highlight the editor line.
- Learners can filter failures or rerun one failed case without losing suite state.
- Save/download/sync failures remain truthful and never imply a cloud save
  succeeded.

## 10. Lazy-load exercise assets and set performance budgets

**Priority:** P2
**Suggested labels:** `performance`, `frontend`

Acceptance criteria:

- Home and class routes do not download Ace, keymaps, or exercise-test bundles.
- Exercise assets load only when an IDE opens, with an accessible loading state.
- Chapter artwork uses responsive compressed assets and useful alternatives.
- Initial-home JavaScript, CSS, image, and interaction budgets are documented.
- Mobile performance measurements run in CI and retain trend evidence.

## 11. Add search and portable learner-data controls

**Priority:** P2
**Suggested labels:** `navigation`, `privacy`, `data-portability`

Acceptance criteria:

- Search covers exercise title, topic, chapter, and prompt; filters cover
  difficulty, pass state, and saved draft.
- Search/filter state is keyboard accessible and represented in the URL.
- A versioned JSON export contains selected local/account progress and drafts.
- Signed-in learners can list/download their canonical file tree without exposing
  another account.
- Imports validate, preview, and explain merge/replace behavior.
- Learners can reset one exercise/chapter and request complete account deletion.

## 12. Add offline, localization, and a secure-assessment architecture

**Priority:** P2
**Suggested labels:** `offline`, `i18n`, `architecture`, `security`

Acceptance criteria:

- A cached or vendored Pyodide runtime can execute offline with explicit status for
  offline, CDN failure, timeout, and learner-code failure.
- Chapter content moves toward deterministic structured modules or Markdown with
  unique-ID and solution-isolation validation.
- English copy is separated from presentation so Portuguese can be added without
  duplicating runner logic.
- Local learning mode and hosted verified-assessment mode have an explicit product
  and code boundary.
- Verified assessments keep tests, execution, scoring, and time authority on the
  server with isolation, quotas, retention, privacy, and abuse controls.
- Threat modeling covers arbitrary Python execution, grading integrity, denial of
  service, solution leakage, and personal data.
