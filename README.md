# Python EduGround

Python EduGround turns the 12 exercise chapters in this repository into a local-first Python class. Learners can follow structured, solution-free class notes, join guided activities, work through practical runbooks, write code in a Monokai editor, run Python in the browser, enter four timed assessment blocks, and optionally sync their own work to PostgreSQL. The repository also ships a hardened container topology, secure-cookie account boundary, mandatory PostgreSQL and browser/accessibility gates, and a reviewable CI/release pipeline.

## Product tour

### Chapter dashboard

![Dark Python EduGround dashboard with chapter progress, stars, rank, and badges](docs/screenshots/dashboard.jpg)

### Full, solution-free chapter class

![First Programs class material showing its mental model and guided-practice flow](docs/screenshots/learning-guide.jpg)

### Evidence-driven problem-solving runbook

![Problem-solving runbook with a learner and Python-coach conversation about input, integer conversion, and test debugging](docs/screenshots/runbook.jpg)

### Browser IDE and test feedback

![Dark Python editor with safe starter code, visible examples, hidden tests, and run controls](docs/screenshots/editor.jpg)

![All tests passed with expected and actual output visible](docs/screenshots/test-results.jpg)

### Timed theory and practical rooms

![Dark practical assessment room with a persistent deadline, five-task map, and solution-free contract](docs/screenshots/assessment-practical.png)

### Optional account sync

![Local-first profile with opt-in PostgreSQL registration and sign-in controls](docs/screenshots/account-sync.jpg)

## Current learning experience

| Area | Included |
| --- | --- |
| Curriculum | 12 chapters, 102 exercises, 316 exercise tests, and 274 collectible difficulty stars |
| Classroom material | Twelve distinct 90-minute classes: 1,080 planned minutes, 48 summary outcomes, 60 lesson-plan blocks, 12 editable lecture demonstrations with separate input and terminal output, 24 collaborative activities, 48 independent-practice prompts, 60 recap questions, and 12 transfer-focused homework briefs |
| Guided learning | Eleven answer-or-code room tasks across Chapters 1–3, editable lesson-note examples, 48 lesson-note sections, 60 runbook phases, 60 mental-model steps, 24 guided practices, 12 concept clinics with 72 worked trace rows, 36 misconception probes, and 36 transfer prompts, plus one interactive number-line lab, 42 coaching exchanges, and 47 toolbox cards |
| Timed assessments | Four chapter blocks, each with 15 theory questions in 20 minutes and five practical tasks in 60 minutes; theory and practical pass independently at 60/100 |
| Reference material | 77 glossary terms, 73 debugging checks, one checkpoint per chapter, and 67 curated official Python documentation links: 46 in chapter guides and 21 in assessments |
| Exercise support | Rewritten teaching prompts, contracts, success criteria, visible examples, progressive hints, and selected technique contracts that coach the intended Python construct |
| Editor | Vendored Ace with persistent Sublime or Vim keys, Monokai styling, Python highlighting, autocomplete, search, folding, line numbers, copy/paste controls, and resizable lesson, editor, and feedback panes |
| Files | Automatic browser drafts, explicit **Save**, full-test submission snapshots, canonical chapter `exNN.py` files, and **Download .py** |
| Runner | Pyodide in a dedicated browser worker; account APIs additionally require a tab-only capability never sent to that worker |
| Feedback | Per-test pass/fail state, inputs, expected output, actual output, captured streams, and complete tracebacks |
| Motivation | A dedicated welcome page, chapter progress, four stage recaps, difficulty stars, eight Pythonic ranks, ten badges, the final animated Python Pathforger award, achievement toasts, crisp action-specific coding cues, and a geometric space-navigation motion system |
| Persistence | Local browser storage by default; optional PostgreSQL sync with HttpOnly cookie sessions, bounded per-exercise run history, and a durable per-user submission-file volume |
| Preferences | Responsive light/dark interface, reduced-motion support, persistent theme, mute state, and editor mode |

Every chapter is presented as a complete class:

1. A summary-first masthead states the audience, duration, format, prerequisites, preparation, and measurable chapter outcomes.
2. A five-part, 90-minute lesson plan explains what the teacher and learners should accomplish in each segment.
3. An original instructor demonstration provides editable Python, a separate sample-input panel, a real browser-Python terminal, teaching points, and prediction questions.
4. Chapters 1–3 add eleven guided room tasks immediately after the demonstration: read a short explanation, answer a theory prompt or complete a small program, then use specific feedback before continuing.
5. Four written lesson sections use unrelated examples, checklists, takeaways, and common pitfalls; their Python examples are also editable and runnable.
6. Collaborative class activities end with concrete evidence another learner or teacher can inspect.
7. A visual mental model, concept clinic, guided prediction practice, glossary, debugging checklist, and knowledge checkpoint deepen the core notes.
8. Independent practice, retrieval questions, and transfer-focused homework turn reading into active learning.
9. A chapter-specific toolbox, five-phase runbook, official Python references, exercise handoff, and previous/next navigation support practice after class.

Chapter 1 assumes no previous programming experience and first names the editor,
sample-input panel, **Run** control, and terminal. It then introduces the complete
input boundary: `input()` waits for one line and returns a `str`; `int(...)`
creates a whole-number value; `float(...)` keeps a fractional measurement; and an
invalid conversion produces a readable `ValueError`. The examples preserve the raw
text in one variable and place converted values in new variables so beginners can
see that a cast creates a value rather than changing what the keyboard sent.

The guided-room rhythm is deliberately active: theory, a short answer or incomplete
program, immediate coaching, and a saved completion marker. In code tasks, **Run**
uses the learner's current sample input for experimentation and never changes room
progress. **Check task** runs the current code against the task's original
canonical input, compares exact output, and applies small source-shape rules that
confirm the taught construct—such as `input()`, `int()`, or `float()`—without
rendering a solution or the matching rule in the page.

The bare site URL now opens a focused welcome page before the chapter dashboard.
It explains the understand → experiment → prove learning loop, previews all four
stages, and uses saved progress to offer a useful continue action. The dashboard
presents the curriculum as four animated module paths. Each path connects three
chapter stops to a bookmarkable stage recap and its timed checkpoint, deriving
preview, learning, ready, and complete states from existing saved progress.
Recaps combine chapter progress, retrieval prompts, cross-chapter synthesis,
checkpoint evidence, and official Python references without introducing another
graded score. The final route shows the Python Pathforger award; it unlocks only
after every chapter and all four checkpoints are complete. On narrow screens the
same path becomes a vertical timeline, while reduced-motion preferences disable
route and badge motion without hiding completion state.

The code-native geospace layer makes those surfaces feel like one navigation
console: orbit geometry and a scanning Python terminal introduce the welcome page,
waypoint traces guide the learning loop, the current roadmap stage carries a
luminous route beacon, recap rooms use restrained radar geometry, and the final
badge earns a one-shot arrival burst. The effects pause while off-screen or while
the tab is hidden, use only transform and opacity for animation, and disappear or
become static under reduced-motion, forced-colours, small-screen, and
high-contrast preferences.

Concepts that benefit from direct manipulation can also include a focused lab. Chapter 2 provides an accessible number-line explorer for comparing `round`, `math.floor`, `math.ceil`, `int`, and `math.trunc` across positive values, negative values, exact integers, and ties-to-even.

Chapter 12 adds a complete problem-solving track: decomposition and counterexamples, justified greedy selection, memoization, bottom-up tabulation, capacity and reachability states, and paired-sequence tables. Its ten exercises progress from Two Sum and interval scheduling through climbing stairs, grid paths, 0/1 knapsack, coin change, maximum non-adjacent sum, subset sum, longest common subsequence, and edit distance. Four original local SVG diagrams support the class and each exercise reuses a relevant visual reasoning cue without exposing its solution.

Lesson notes, concept clinics, runbooks, and guided room tasks keep learning
markers separately from graded exercise passes, so classroom completion never
awards exercise stars. Editable classroom code and sample input use their own
bounded draft store and do not create canonical chapter `exNN.py` files. The
desktop class view includes a course rail and an on-page contents rail; both
collapse into keyboard-accessible disclosures on smaller screens.

The assessment map groups chapters 1–3, 4–6, 7–9, and a final chapters 10–12 capstone. Each room keeps its own active deadline, drafts, recent attempts, and best score; assessment results do not award exercise stars. See [docs/ASSESSMENTS.md](docs/ASSESSMENTS.md) for the room rules, source transparency, scoring, official references, and client-side security limitations.

## Run locally

Requirements: a modern browser plus Node.js `22.23.1` through Node 26. CI validates
the lowest supported Node 22 release and the Node 24 production line.

### Local-only mode

No database is required for the complete curriculum, editor, browser runner, assessment rooms, local drafts, or local progress:

```bash
npm ci
npm run serve
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). A different host or port can be selected when needed:

```bash
node scripts/serve.mjs --port 4173
PORT=4173 node scripts/serve.mjs
node scripts/serve.mjs --help
```

HTTP serving is required for the module-based Python worker. Ace is checked into the repository. The first Python run downloads a pinned Pyodide runtime from jsDelivr, with a separately pinned UNPKG fallback, so the initial run needs an internet connection.

### PostgreSQL account sync

Copy the environment template, generate two different file-backed secrets, and set
the exact browser origin:

```bash
cp .env.example .env
npm run secrets:init
```

The generated owner and runtime credentials live in the Git-ignored `secrets/`
directory with mode `0600`; move their durable copies into an approved secret
manager. Set `APP_ORIGIN` in `.env`, then start the stack:

```bash
docker compose config --quiet
docker compose up -d --build
curl --fail http://127.0.0.1:8000/readyz
```

The database is private, migrations run as a one-shot owner process, and the
long-running app uses restricted role `eduground_app`. For a managed database,
prefer `PG*` fields so reserved password characters need no URL encoding:

```bash
export PGHOST='db.example.net'
export PGPORT='5432'
export PGDATABASE='eduground'
export PGUSER='eduground_owner'
export PGPASSWORD_FILE='/run/secrets/eduground-owner-password'
export DATABASE_SSL='require'
export DATABASE_SSL_CA_FILE='/run/secrets/provider-root-ca.pem'
npm run migrate

export PGUSER='eduground_app'
export PGPASSWORD_FILE='/run/secrets/eduground-runtime-password'
export APP_ORIGIN='https://learn.example.com'
npm run serve
```

Database-backed saving is opt-in from the profile menu. Unsigned learners remain
local-only. See [docs/PERSISTENCE.md](docs/PERSISTENCE.md) for the data model and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment, backup,
restore, proxy, and rollback procedures.

## Upgrade without losing progress

`git pull` changes application files, not browser `localStorage` or PostgreSQL data. Local-only progress remains visible when the updated app is served from the same browser origin. Signed-in progress follows the PostgreSQL database and is merged with the account's locally cached workspace after sign-in.

For an in-place Compose update, keep the same `COMPOSE_PROJECT_NAME` and named volumes, back up PostgreSQL, then rebuild:

```bash
git pull --ff-only
docker compose up -d --build --force-recreate
curl --fail http://127.0.0.1:8000/readyz
```

The Compose file has a stable default project name,
`fundamentos-de-programacao-playground`, so the historical `postgres_data` and
`submissions_data` volumes continue to be selected even if the checkout directory
is renamed. If an existing deployment used `-p` or a custom
`COMPOSE_PROJECT_NAME`, continue using that exact value. The one-shot `migrate`
service must succeed before the restricted app starts. Do not use
`docker compose down -v` during an upgrade. Follow the complete
[upgrade and recovery runbook](docs/DEPLOYMENT.md#upgrade-without-losing-learner-progress)
before a production pull.

## Navigation

The app uses bookmarkable hash routes:

| Route | View |
| --- | --- |
| `/` or `#welcome` | Course welcome, learning loop, stage previews, and saved-progress continue action |
| `#home` | Chapter dashboard and current-learning cue |
| `#stage/py01-py03/recap` | Three-chapter synthesis, retrieval prompts, checkpoint evidence, and official references |
| `#chapter/py01` | Chapter hub |
| `#chapter/py01/exercises` | Exercise catalogue |
| `#chapter/py01/tutorials` | Full class: setup, schedule, runnable lecture demo, guided room tasks, editable lesson examples, activities, recap, homework, references, and exercise handoff |
| `#exercise/py01-first-programs` | Prompt, examples, hints, IDE, tests, and results |
| `#assessments` | Four-block timed-assessment map and saved best scores |
| `#assessment/py01-py03` | One block's theory/practical choices and official references |
| `#assessment/py01-py03/theory` | Theory room landing, active attempt, or latest result |
| `#assessment/py01-py03/practical` | Practical room landing, active coding attempt, or latest result |
| `#profile/badges` | Rank ladder and badge gallery |

Legacy routes such as `#py01` redirect to the corresponding chapter hub.

## Editor controls

- Choose **Sublime** or **Vim** from the **Keys** selector. The selection persists; the visual theme remains Monokai.
- Drag the vertical divider to resize the lesson and coding workspace. Drag the horizontal divider to resize the editor and feedback dock.
- Focus either divider and use the arrow keys for precise resizing, **Home** or **End** for its limits, or **Reset layout** to restore the balanced default. Layout sizes persist in this browser.
- `Shift + Enter` runs the visible examples.
- `Ctrl/Command + Enter` runs the complete visible and hidden suite and, when signed in, saves that exact submitted snapshot.
- `Ctrl/Command + S` performs the same explicit save as the **Save** button.
- **Save** always flushes the browser draft and, when signed in, stores the source in PostgreSQL and its canonical chapter file.
- **Download .py** creates a normal Python file through the browser, whether signed in or not.
- **Copy** and **Paste** complement normal editor or Vim/Sublime clipboard commands.
- **Restart** restores the clean, solution-free starter for the current exercise.

The practical assessment editor uses the same Sublime/Vim selection, Monokai theme, copy/paste controls, and `Shift + Enter` visible-check shortcut. Its five drafts belong to the timed attempt and do not create canonical chapter `exNN.py` files; use **Download .py** for a separate copy.

Classroom lecture demonstrations, lesson-note examples, and guided code tasks have
lighter embedded workspaces:

- edit the Python and the separate sample-input lines, then choose **Run** or press
  `Shift + Enter` to execute that experiment in the classroom terminal;
- inspect standard output, errors, and complete tracebacks, then change either
  panel and run again;
- use **Reset** to restore the authored example and original input;
- for a guided code task, choose **Check task** when ready: Check ignores edited
  sample input, uses the canonical task fixture, compares exact output, and checks
  the required technique before awarding room completion.

Selected exercises also show a **Technique contract**. These checks use small
source-shape rules after the normal output tests—for example, requiring two
assignments and string concatenation in the first chapter's FIXME exercise. They
provide educational coaching without rendering matching patterns or a repository
solution in the learning interface. As client-side teaching aids, the rules remain
inspectable in downloaded application assets; they are intentionally heuristic
rather than a secure grading boundary or a substitute for Python execution and
instructor review.

Typing is auto-saved to browser storage after a short delay. Signed-in progress and drafts are also synchronized in the background. Explicit **Save** and every complete **Run tests** attempt upsert the exact editor snapshot and materialize it under a stable zero-based name:

```text
submissions/<user UUID>/
├── Py01 First Programs/
│   ├── ex00.py
│   ├── ex01.py
│   └── ...
├── Py02 Simple data/
│   └── ...
└── Py12 Problem Solving & Dynamic Programming/
    ├── ex00.py
    ├── ...
    └── ex09.py
```

The server owns this 102-file mapping. Learner input cannot select a path, and these files never share the repository's original `Py*/` solution directories. PostgreSQL remains authoritative; reading a saved account file recreates a missing mirror.

## What is saved

| Data | Unsigned learner | Signed-in learner |
| --- | --- | --- |
| Exercise draft code | Browser storage | Browser storage and account state |
| Classroom lab code and sample-input drafts | Browser storage under the scoped `fp-playground.class-labs.v1` key | Browser storage and PostgreSQL account state; no `exNN.py` mirror |
| Explicit Save or complete test submission | Browser draft; optional `.py` download | PostgreSQL `user_files`, browser draft, and `<chapter>/exNN.py` mirror |
| Passed exercises and stars | Browser storage | Browser storage and PostgreSQL account state |
| Class lesson, runbook, and guided-room markers | Browser storage | Browser storage and PostgreSQL account state |
| Timed assessment deadlines, answers, practical drafts, and recent results | Browser storage | Browser storage and PostgreSQL account state |
| Editor keymap | Browser storage | Browser storage and PostgreSQL account state |
| Normalized run results | Current page memory only | PostgreSQL run-history record plus an exercise-page history view |
| Theme and sound | Browser storage | Browser storage only |

Local storage is scoped to the exact browser origin. For example, `127.0.0.1:8000` and `localhost:8000` have different local drafts. Within one origin, the app keeps an anonymous workspace and a separate local cache per account, but it selects an account cache only after the cookie and the tab-only capability are validated. Signing out or a failed session restore returns to the anonymous workspace instead of exposing the previous learner's drafts. Account data is attached to PostgreSQL and can follow a learner to another deployment after they sign in there with the same account credentials.

## Validate the repository

```bash
npm run validate
npm run validate:browser
npm run validate:links
node --check python-runner-worker.mjs
git diff --check
```

After local browser runs, remove generated reports and disposable operating-system
or Python cache files without touching dependencies, submissions, backups, or
database data:

```bash
npm run clean
```

`npm run validate` performs the deterministic offline checks for application and
backend syntax/tests, the security policy, all 12 chapter definitions, all 102
exercise definitions, all 316 exercise tests, every solution-free starter, every
lesson section and runbook phase, all concept clinics, the rounding lab, toolbox
cards, and the complete classroom/assessment schema. It also verifies cookie/origin
helpers, database TLS configuration, migration manifests, public-file isolation,
and hardened container/workflow policy. `npm run validate:links` is the optional
network check for curated Python documentation references.

Database and release candidates must additionally use an isolated PostgreSQL
database:

```bash
export TEST_DATABASE_URL='postgresql://eduground_test:test-only@127.0.0.1:5432/eduground_test'
npm run validate:integration
# Before a release, use the complete gate:
npm run validate:release
```

`validate:integration` fails closed when `TEST_DATABASE_URL` is missing, applies the
real migrations, and tests cookie-plus-tab-capability sessions, worker-style
capability rejection, origin enforcement, concurrent state and file persistence,
canonical mirrors, run normalization, and bounded history.
`validate:release` combines the deterministic and database gates with a
high-severity dependency audit.

`validate:browser` starts the local application, runs the required Chromium
learner journeys, and scans representative routes and the open profile with Axe.
CI and the release workflow retain screenshots, traces, reports, and accessibility
evidence only when the browser gate fails.

Validation coverage includes:

- All 12 dashboard → chapter → class and exercise routes, plus representative
  mobile overflow checks.
- Four animated module paths, saved completed/current/upcoming states, keyboard
  access, vertical mobile layout, and reduced-motion behavior.
- Persistent class-section understanding markers.
- Worked concept clinics, guided-practice reveal, the Chapter 2 rounding lab, and chapter checkpoint feedback.
- Safe starter code with no repository answer loaded into the page.
- Sublime/Vim switching, Monokai styling, editor keyboard shortcuts, pointer and
  keyboard pane resizing, layout persistence/reset, and responsive fallback.
- Output grading plus source-shape technique contracts, including non-disclosure
  of matching patterns and canonical private-solution compatibility.
- Local saving plus signed-in PostgreSQL and canonical chapter-file persistence.
- Signed-in, newest-first exercise run history with reopen and per-field Copy
  controls.
- All-green execution across visible and hidden tests.
- Failure output with expected/actual fields and Python tracebacks.
- Four assessment blocks with resumable absolute deadlines, exact-set theory scoring, five-task practical grading, automatic expiry submission, and saved attempt history.
- Dark mode, copy/paste controls, ranks, badges, and local persistence.

CI requires the Chromium learner-journey and automated accessibility baseline. It
also boots the actual restricted Compose topology, verifies persistence across app
recreation, smoke-tests the production image, and retains bounded failure and scan
evidence. CDN-failure, complete timed-room, authenticated multi-device, and sync-
conflict journeys remain explicit roadmap items.

## Repository map

| Path | Responsibility |
| --- | --- |
| `index.html` | Stable application shell and vendored asset loading order |
| `course-ui.css` | Shared responsive light/dark UI, account panel, runbook, and IDE layout |
| `course-app.js` | Router and application orchestration for persistence, profile, editor, runner controls, and shared result rendering |
| `workbench-mode.css` | Exercise-route-only compact application chrome that gives the lesson and IDE more viewport space |
| `dashboard-model.js` | Pure resume-target, stage-status, and milestone derivation for the home learning path |
| `dashboard-view.js` / `dashboard-ui.css` | Focused stage-based home renderer and responsive presentation |
| `landing-view.js` / `landing-ui.css` | Course welcome page, learning-loop preview, and progress-aware entry action |
| `landing-snake.js` / `landing-snake.css` | Deterministic, keyboard/touch-accessible Python Snake arcade with fair asteroid layouts and local best-score persistence |
| `stage-recaps.js` | Solution-free synthesis content for the four stable three-chapter stages |
| `stage-recap-view.js` / `stage-recap-ui.css` | Stage recap pages and the accessible animated final-course award |
| `class-materials.js` | Twelve deeply frozen 90-minute class syllabi plus the Chapters 1–3 beginner-room explanations, answer tasks, code tasks, canonical inputs, and technique rules |
| `class-page.js` / `class-page.css` | Reusable documentation renderer with course navigation, contents rail, editable lecture/lesson labs, guided room tasks, terminal feedback, and mobile disclosures |
| `learning-content.js` | Ranks, badges, tutorials, deep dives, checkpoints, and runbooks |
| `learning-toolbox.js` | Per-chapter Python functionality guide with conversions, imports, results, cautions, and copyable examples |
| `learning-clinics.js` | Twelve immutable, solution-free worked traces, misconception probes, and transfer sets |
| `concept-clinic.js` / `learning-clinic.css` | Accessible clinic component and its isolated responsive styling |
| `rounding-model.js` | Tested Python-compatible floor, ceiling, truncation, and ties-to-even comparisons for the Chapter 2 lab |
| `rounding-lab.js` / `rounding-lab.css` | Self-contained interactive number-line controller, derived view state, listeners, and styling |
| `assessment-data.js` | Four assessment blocks, theory questions, practical contracts/tests, source notes, and official references |
| `assessment-engine.js` | Assessment scoring, deadline, sanitization, history, and conflict-merge rules |
| `assessment-room.js` | Assessment routes, timed-room controller, practical editor, submission flow, and results |
| `assessment-ui.css` | Responsive light/dark assessment hub, room, editor, and result styling |
| `exercise-data.js` | Chapters, prompts, topics, source paths, and hints |
| `test-data/` | 206 visible and 110 hidden learning checks |
| `starter-code.js` | Generated solution-free starters and public function signatures |
| `solution-code.js` | Build-time repository artifact that is deliberately not loaded by the learner page |
| `audio-feedback.js` | Synthesized click, run, full-suite, task-completion, failure, and achievement cues |
| `python-runner-worker.mjs` | Dedicated-worker Python execution, output capture, timeout handling, and traceback capture |
| `assets/vendor/ace/` | Pinned Ace 1.44.0 runtime, Monokai theme, Sublime/Vim keymaps, and license |
| `assets/illustrations/problem-solving/` | Original accessible SVG field guide for decomposition, state tables, knapsack choices, and strategy recognition |
| `server/` | Same-origin HTTP API, authentication, PostgreSQL access, security helpers, and static serving |
| `server/exercise-manifest.mjs` | Stable 102-exercise mapping to chapter directories and zero-based `exNN.py` names |
| `server/submission-files.mjs` | Atomic, private per-user filesystem mirror with traversal and symlink protection |
| `server/runtime-security.mjs` | Cookie, origin, trusted-proxy, browser-header, and HTTP resource policy |
| `server/database-config.mjs` | Bounded `PG*`/URL configuration and verified PostgreSQL TLS |
| `db/migrations/` | Ordered, checksum-protected PostgreSQL schema migrations |
| `scripts/migrate.mjs` | Migration command used locally and during deployment |
| `docker-compose.yml` / `docker/` | Private database, split owner/runtime roles, one-shot migration, and restricted app runtime |
| `.github/workflows/` | CI, PostgreSQL integration, CodeQL, supply-chain, container, documentation, and release workflows |
| `scripts/validate-assessment-data.mjs` | Assessment structure, timing, stable-ID, syntax, test, solution-leak, and official-link validation |
| `server/tests/class-materials.test.mjs` | Classroom coverage, timing, executable demos with supplied input, immutability, and solution/prompt leakage validation |
| `server/tests/class-room-data.test.mjs` | Guided-room schema, beginner-topic coverage, runnable fixtures, source-rule enforcement, and prompt-echo isolation |
| `e2e/class-room.spec.mjs` | Answer feedback, room progress, editable labs, Run/Check separation, draft restore, keyboard use, and responsive classroom checks |
| `server/tests/class-page.test.mjs` | Deterministic class-page hierarchy, navigation, accessibility, and fallback rendering validation |
| `docs/CLASSROOM.md` | Learner-facing class sequence, authoring contract, solution boundary, rendering integration, and validation guide |
| `docs/ASSESSMENTS.md` | Timed-room rules, chapter/PDF mapping, scoring, references, persistence, and security boundaries |
| `docs/PERSISTENCE.md` | Account sync, data model, storage bounds, migrations, and deletion behavior |
| `docs/DEPLOYMENT.md` | First deploy, proxy, upgrade, backup/restore drill, image promotion, and rollback runbook |
| `docs/SECURE_SDLC.md` | Trust boundaries, local/CI gates, release policy, incident response, and residual risks |

## Content, privacy, and assessment transparency

The repository contains Python solutions but not the original problem statements or tests. The teaching prompts, contracts, hints, tutorial content, and tests are learning-oriented reconstructions inferred from visible filenames, signatures, inputs, and solution behaviour. They are not official or verbatim course questions.

Hidden cases stay masked in the interface until a complete run returns. Their JavaScript definitions remain inspectable in the browser, so they are useful learning checks rather than secure assessment secrets. A genuinely secret assessment would require server-side execution and server-held tests.

The assessment practical prompts are independently paraphrased from four PDFs supplied by the project owner. PDF wording, screenshots, and reference solutions are excluded; the public examples and tests are independently authored. Theory questions and explanations are original course material. Assessment question data, answer indexes, hidden tests, scores, and timers are client-side and therefore inspectable or modifiable. These rooms are educational practice, not proctored or tamper-resistant examinations.

`solution-code.js` supports local generation and validation only. It is not requested by `index.html`, `window.SOLUTION_CODE` is not created in the learner page, and editor resets restore a safe starter rather than an answer. The server uses a public-file allowlist, so the solution bundle, original `Py*/` sources, migrations, backend modules, and deployment secrets are not downloadable from the web application.

Unsigned use sends no learner code or progress to the application API. Creating an account opts into syncing drafts, saved files, progress, editor mode, and detailed test results to PostgreSQL, plus the configured private submission-file mirror. Python code still executes in a browser worker, not on the Node server. The worker is not a safe sandbox for untrusted pasted code; it has a JavaScript bridge and network access to the CSP-allowed runtime origins. Account APIs require a separate tab capability that is never sent to the worker. Persisted run claims are explicitly labelled as learner-device evidence. The history view can reopen and copy recorded expected output, actual output, streams, and tracebacks, but the history API does not return source code or original test inputs. See the [secure-SDLC trust boundaries](docs/SECURE_SDLC.md#security-objective) before exposing account sync publicly.

## Refresh generated or vendored artifacts

After intentionally changing a Python solution:

```bash
node scripts/build-solution-bundle.mjs
npm run build:starters
```

After intentionally changing the pinned Ace dependency:

```bash
npm install
npm run vendor:ace
```

## Future improvements

The prioritized, issue-ready backlog is in [docs/ROADMAP.md](docs/ROADMAP.md). It
treats the cookie-plus-tab-capability boundary, PostgreSQL TLS, hardened Compose,
required browser/accessibility checks, scanning, SBOM, and attested-release
foundations as delivered, then focuses on account lifecycle, shared abuse controls,
deeper failure-path journeys, automated recovery evidence, conflict UX,
performance, offline use, and secure hosted assessment.
