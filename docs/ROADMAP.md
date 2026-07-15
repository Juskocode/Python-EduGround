# Python EduGround improvement backlog

This backlog starts after the delivered Sublime/Vim editor modes, fixed Monokai theme, keyboard run/save commands, downloadable `.py` files, local-first drafts, and opt-in PostgreSQL account sync. Each section is structured so it can be copied into a GitHub issue. Priorities describe recommended order, not a delivery commitment.

## 1. Choose a public license and document content provenance

**Priority:** P0
**Suggested labels:** `release`, `documentation`, `legal-review`

The repository has no root project license. Before broader reuse, choose the intended license and make the origin of the reconstructed learning material explicit.

Acceptance criteria:

- A maintainer-approved root `LICENSE` is added.
- `NOTICE` or an equivalent provenance section distinguishes original solutions, reconstructed prompts/tests, generated artifacts, and vendored Ace assets.
- `CONTRIBUTING.md` explains solution-isolation and analogous-example rules.
- `SECURITY.md` documents the browser-visible assessment and account-sync boundaries.
- Historical author identity and email exposure are reviewed before mirroring or importing history elsewhere.

## 2. Add CI, browser smoke tests, and accessibility gates

**Priority:** P0
**Suggested labels:** `testing`, `ci`, `accessibility`

Acceptance criteria:

- GitHub Actions runs `npm ci`, `npm run validate`, worker syntax checks, Docker image construction, and `git diff --check` on pushes and pull requests.
- API tests use an ephemeral PostgreSQL service and apply real migrations.
- Browser flows cover home → guide/exercise, Sublime/Vim switching, all editor shortcuts, local save, signed-in save/sync, pass/fail results, and session restoration.
- Worker startup, syntax errors, runtime exceptions, CDN fallback, timeout recovery, and database unavailability are tested.
- Automated accessibility checks report no serious or critical violations; failure screenshots and logs are retained as workflow artifacts.

## 3. Harden authentication and add account lifecycle controls

**Priority:** P0
**Suggested labels:** `security`, `backend`, `accounts`

The current email/password flow is suitable for an intentional small deployment, not a complete public identity system.

Acceptance criteria:

- Sessions move from JavaScript-readable storage to a reviewed secure-cookie or equivalent design.
- Email verification, password change/reset, session listing/revocation, and user-facing account deletion are implemented.
- Shared rate limiting works across replicas and includes abuse monitoring.
- A strict Content Security Policy and production proxy/header checklist are documented and tested.
- PostgreSQL TLS can validate a configured CA rather than forcing `rejectUnauthorized: false`.
- Threat modelling covers XSS, credential stuffing, token theft, database compromise, and restore of deleted data.

## 4. Make sync conflicts and history visible

**Priority:** P1
**Suggested labels:** `sync`, `ux`, `data`

The current safe merge uses set union for completions and lets a local draft win. Learners should be able to understand and control conflicts instead of relying on an implicit rule.

Acceptance criteria:

- Drafts and state carry revision timestamps or versions.
- A conflict view compares local and account drafts before replace/merge.
- Learners can keep local, keep remote, download both, or create a new copy.
- The exercise page can list and reopen recent persisted test runs.
- Sync status distinguishes pending, synced, offline, conflict, expired session, and server error.
- Multi-tab and two-device behaviour has deterministic automated coverage.

## 5. Make mastery evidence-based

**Priority:** P1
**Suggested labels:** `education`, `progress`, `ux`

The current guide progress records tutorial/runbook reading. Deep dives, guided practices, and checkpoints should become distinct evidence.

Acceptance criteria:

- The UI clearly separates **read**, **practised**, and **mastered** states.
- Guided-practice completion and checkpoint attempts persist locally and in account state.
- Correct checkpoint state and retries survive reloads.
- Existing local/account state versions migrate without loss.
- Dashboard, chapter hub, and profile use one documented mastery calculation.

## 6. Turn guided practices into runnable micro-labs

**Priority:** P1
**Suggested labels:** `education`, `enhancement`, `runner`

Acceptance criteria:

- Each guided practice has an editable Run/Reset workspace.
- Learners can predict, execute, inspect stdout or a traceback, and only then reveal coaching.
- Practice drafts persist separately from graded exercise drafts and can optionally sync.
- Examples stay unrelated to graded answers and pass solution-leakage validation.
- Every action is keyboard and screen-reader accessible.

## 7. Complete a WCAG keyboard, focus, and contrast pass

**Priority:** P1
**Suggested labels:** `accessibility`, `ui`

Acceptance criteria:

- Route changes move focus to the new page heading or main landmark.
- Tutorial navigation reflects the active section with `aria-current` and focuses the target heading.
- The profile/account popover supports predictable entry, Escape, outside-click dismissal, and focus return.
- Vim mode has accessible instructions and an obvious way to leave insert/command modes.
- All normal text reaches WCAG AA contrast; test announcements avoid repeatedly reading full tracebacks.
- Reduced-motion and muted-sound preferences remain respected.

## 8. Add safer draft and failure-recovery tools

**Priority:** P1
**Suggested labels:** `editor`, `ux`, `runner`

Acceptance criteria:

- Restart asks for confirmation only when code differs from the starter.
- A short undo action restores the most recently discarded draft.
- Expected output, actual output, streams, and tracebacks each have Copy actions.
- Recognized Python line numbers jump to and highlight the corresponding editor line.
- Learners can filter failures or rerun one failed case without losing the complete-suite result.
- Save/download errors have actionable accessible feedback and never imply a cloud save succeeded when it did not.

## 9. Automate database operations and recovery drills

**Priority:** P1
**Suggested labels:** `operations`, `database`, `reliability`

Acceptance criteria:

- Production deploys gate readiness on successful migrations and `/readyz`.
- Automated backups have encryption, retention, off-site storage, and success alerts.
- A scheduled restore drill proves a backup can start the current app and restore an account/file.
- Migration rollback/roll-forward policy and recovery objectives are documented.
- Metrics cover pool saturation, query errors, authentication failures, sync errors, and storage growth without logging learner code or credentials.
- Account deletions are tracked across backups according to a documented retention policy.

## 10. Lazy-load exercise assets and optimize chapter artwork

**Priority:** P2
**Suggested labels:** `performance`, `frontend`

Ace, keymaps, test bundles, and the large chapter sprite currently load on routes that do not need all of them.

Acceptance criteria:

- Home and tutorial routes do not download Ace, keymaps, or exercise-test bundles.
- Exercise assets load only when an IDE route opens, with a usable loading state.
- Chapter artwork uses responsive, compressed assets with useful alternative text.
- An initial-home performance budget is documented.
- Mobile Lighthouse measurements are recorded in CI.

## 11. Add search plus portable learner-data controls

**Priority:** P2
**Suggested labels:** `navigation`, `privacy`, `data-portability`

Acceptance criteria:

- Search covers exercise title, topic, chapter, and prompt; filters cover difficulty, passed, not passed, and saved draft.
- Search/filter state is keyboard accessible and reflected in the URL.
- A versioned JSON export includes local or account progress, guide markers, settings, drafts, saved-file metadata, and optional run history.
- A signed-in workspace lists the canonical chapter/`exNN.py` tree and can download one file or a private ZIP without exposing another learner's files.
- Import validates and previews changes before merge or replace.
- Learners can reset one exercise/chapter or delete the complete local/account profile with explicit confirmation.
- Privacy documentation explains exactly what export, reset, and deletion do to database backups.

## 12. Add offline, localization, and secure-assessment seams

**Priority:** P2
**Suggested labels:** `offline`, `i18n`, `architecture`

Acceptance criteria:

- A previously cached or vendored Pyodide runtime can execute while offline, with status that distinguishes offline, CDN failure, timeout, and learner-code failure.
- Chapter content moves to deterministic structured modules/Markdown with unique-ID and solution-isolation validation.
- English copy is separated from presentation, and Portuguese can be added chapter-by-chapter without duplicating runner logic.
- Local learning mode and a future hosted-assessment mode have an explicit boundary.
- Hosted assessment tests/execution stay server-side with resource limits; no repository solution is sent to the learner runtime.
- Threat modelling covers arbitrary Python, abuse limits, grading integrity, data retention, and privacy.
