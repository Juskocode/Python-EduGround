# Python EduGround improvement backlog

This backlog is written so each section can be copied into a GitHub issue. Priorities describe the recommended order, not a delivery commitment.

## 1. Choose a public license and document content provenance

**Priority:** P0
**Suggested labels:** `release`, `documentation`, `legal-review`

The repository has no root project license. Before broader reuse, choose the intended license and make the origin of the reconstructed learning material explicit.

Acceptance criteria:

- A maintainer-approved root `LICENSE` is added.
- `NOTICE` or an equivalent provenance section distinguishes original solutions, reconstructed prompts/tests, generated artifacts, and vendored Ace assets.
- `CONTRIBUTING.md` explains solution-isolation and analogous-example rules.
- `SECURITY.md` explains that browser-visible hidden tests are not secure assessment secrets.
- Historical author identity and email exposure are reviewed before mirroring or importing history elsewhere.

## 2. Add CI, browser smoke tests, and accessibility gates

**Priority:** P0
**Suggested labels:** `testing`, `ci`, `accessibility`

Acceptance criteria:

- GitHub Actions runs `npm ci`, `npm run validate`, worker syntax checks, and `git diff --check` on pushes and pull requests.
- Automated flows cover home → chapter → guide/exercise, light/dark themes, drafts, guide progress, passing tests, failing tests, achievements, and persistence.
- Worker startup, syntax errors, runtime exceptions, CDN fallback, and timeout recovery are tested.
- Automated accessibility checks report no serious or critical violations.
- Failure screenshots and runner logs are uploaded as workflow artifacts.

## 3. Make mastery evidence-based

**Priority:** P1
**Suggested labels:** `education`, `progress`, `ux`

The current guide progress records four tutorials and the runbook. Deep dives, guided practices, and checkpoints should become distinct evidence rather than being silently treated as read material.

Acceptance criteria:

- The UI clearly separates **read**, **practised**, and **mastered** states.
- Guided-practice completion and checkpoint attempts persist locally.
- Correct checkpoint state and retries survive reloads.
- Existing `fp-playground.learning.v1` data migrates without loss.
- Dashboard, chapter hub, and profile use one documented mastery calculation.

## 4. Turn guided practices into runnable micro-labs

**Priority:** P1
**Suggested labels:** `education`, `enhancement`, `runner`

Acceptance criteria:

- Each guided practice has an editable Run/Reset workspace.
- Learners can predict, execute, inspect stdout or a traceback, and only then reveal coaching.
- Practice drafts persist separately from graded exercise drafts.
- Examples stay unrelated to graded answers and pass solution-leakage validation.
- Every action is keyboard and screen-reader accessible.

## 5. Complete a WCAG keyboard, focus, and contrast pass

**Priority:** P1
**Suggested labels:** `accessibility`, `ui`

Acceptance criteria:

- Route changes move focus to the new page heading or main landmark.
- Tutorial navigation reflects the active section with `aria-current` and focuses the target heading.
- The profile popover supports predictable entry, Escape, outside-click dismissal, and focus return.
- All normal text reaches at least WCAG AA contrast.
- Test announcements stay concise and do not repeatedly read complete tracebacks.
- Reduced-motion and muted-sound preferences remain respected.

## 6. Protect drafts and improve failure navigation

**Priority:** P1
**Suggested labels:** `editor`, `ux`, `runner`

Acceptance criteria:

- Restart asks for confirmation only when code differs from the starter.
- A short undo action restores the most recently discarded draft.
- Expected output, actual output, captured streams, and tracebacks each have Copy actions.
- Recognized Python line numbers can jump to and highlight the corresponding editor line.
- Learners can filter failures or rerun one failed case without losing the complete suite result.

## 7. Lazy-load exercise assets and optimize chapter artwork

**Priority:** P1
**Suggested labels:** `performance`, `frontend`

Ace, test bundles, and the large chapter sprite currently load on routes that do not need all of them.

Acceptance criteria:

- Home and tutorial routes do not download Ace or exercise-test bundles.
- Exercise assets load only when an IDE route opens.
- Chapter artwork uses responsive, compressed assets with useful alternative text.
- An initial-home performance budget is documented.
- Mobile Lighthouse measurements are recorded in CI.

## 8. Add global exercise search and filters

**Priority:** P2
**Suggested labels:** `navigation`, `ui`, `enhancement`

Acceptance criteria:

- Search covers title, topic, chapter, and prompt text.
- Filters cover difficulty, passed, not passed, and saved draft.
- Search and filter state is keyboard accessible and reflected in the URL.
- Empty results provide an obvious reset action.
- A recommended-next result respects chapter progression without hiding other choices.

## 9. Add learner-data export, import, and granular reset

**Priority:** P2
**Suggested labels:** `progress`, `privacy`, `data-portability`

Acceptance criteria:

- Export downloads versioned JSON containing progress, learning markers, settings, and drafts.
- Import validates and previews changes before merge or replace.
- Learners can reset one exercise, one chapter, or the complete profile.
- Destructive actions require explicit confirmation.
- No learner code or progress leaves the browser automatically.

## 10. Build an offline-capable Python runtime path

**Priority:** P2
**Suggested labels:** `runner`, `reliability`, `offline`

Acceptance criteria:

- Runtime status distinguishes offline mode, CDN failure, startup timeout, and learner-code failure.
- Retry does not require a full page reload.
- A service-worker or vendored-runtime proposal documents storage and download-size tradeoffs.
- A previously cached runtime can execute while offline.
- Network, fallback, and offline paths have automated tests.

## 11. Modularize curriculum authoring and add localization seams

**Priority:** P2
**Suggested labels:** `maintainability`, `education`, `i18n`

Acceptance criteria:

- Chapter learning content lives in separate structured modules or Markdown files.
- A deterministic build produces the browser bundle and validates unique IDs.
- Contributor guidance documents tone, reading level, analogous scenarios, and solution isolation.
- English copy can be separated from presentation without changing runner data.
- A Portuguese translation can be added chapter by chapter without duplicating application logic.

## 12. Offer an optional secure hosted-assessment mode

**Priority:** P2
**Suggested labels:** `architecture`, `security`, `assessment`

The local app should remain usable, but a genuinely secret assessment cannot ship its hidden tests to the browser.

Acceptance criteria:

- The local learning mode and hosted assessment mode have a documented boundary.
- Hosted tests and execution stay server-side with resource limits and isolation.
- The client receives only result details intentionally disclosed to the learner.
- No repository solutions are sent to the learner runtime.
- Threat modelling covers arbitrary Python, abuse limits, data retention, and privacy.
