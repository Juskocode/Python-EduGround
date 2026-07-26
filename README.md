# Python EduGround

Python EduGround turns the 13 exercise chapters in this repository into a local-first Python class. Learners can follow structured, solution-free class notes, join guided activities, work through practical runbooks, write code in a Monokai editor, run Python in the browser, enter four timed assessment blocks, build game systems in a final Pygame studio, and optionally sync their own work to PostgreSQL. The repository also ships a hardened container topology, secure-cookie account boundary, mandatory PostgreSQL and browser/accessibility gates, and a reviewable CI/release pipeline.

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
| Curriculum | 13 chapters, 110 exercises, 341 exercise tests, and 294 collectible difficulty stars |
| Classroom material | Thirteen distinct 90-minute classes: 1,170 planned minutes, 52 summary outcomes, 65 lesson-plan blocks, 13 editable lecture demonstrations with separate input and terminal output, 26 collaborative activities, 52 independent-practice prompts, 65 recap questions, and 13 transfer-focused homework briefs |
| Guided learning | Eleven answer-or-code room tasks across Chapters 1–3, editable lesson-note examples, 52 lesson-note sections, 65 runbook phases, 65 mental-model steps, 26 guided practices, 13 concept clinics with 78 worked trace rows, 39 misconception probes, and 39 transfer prompts, plus one interactive number-line lab, two browser game-system labs, 46 coaching exchanges, and 51 toolbox cards |
| Timed assessments | Four chapter blocks, each with 15 theory questions in 20 minutes and five practical tasks in 60 minutes; theory and practical pass independently at 60/100 |
| Reference material | 84 glossary terms, 80 debugging checks, one checkpoint per chapter, and 71 curated official Python or Pygame documentation links: 50 in chapter guides and 21 in assessments |
| Exercise support | Rewritten teaching prompts, contracts, success criteria, visible examples, progressive hints, and selected technique contracts that coach the intended Python construct |
| Editor | Vendored Ace with persistent Sublime or Vim keys, Monokai styling, Python highlighting, autocomplete, search, folding, line numbers, copy/paste controls, and resizable lesson, editor, and feedback panes |
| Files | Automatic browser drafts, explicit **Save**, full-test submission snapshots, canonical chapter `exNN.py` files, and **Download .py** |
| Runner | Pyodide in a dedicated browser worker; account APIs additionally require a tab-only capability never sent to that worker |
| Feedback | Per-test pass/fail state, inputs, expected output, actual output, captured streams, and complete tracebacks |
| Motivation | A focused welcome page with an optional Python Snake arcade, completion-driven green/blue/yellow snake fleets, chapter progress, four assessed-stage recaps, a final game-project studio, difficulty stars, eight Pythonic ranks, ten badges, the final animated Python Pathforger award, achievement toasts, crisp action-specific coding cues, and a geometric space-navigation motion system |
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
9. A chapter-specific toolbox, five-phase runbook, official Python or Pygame references, exercise handoff, and previous/next navigation support practice after class.

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
stages, and uses saved progress to offer a useful continue action. Its compact
Python Snake preview opens an optional dialog only when selected; the deterministic
arcade caps its score at 1,000, includes three collision-avoidance splits, slow
asteroid drift, rare falling stars, and shield, boost, and stasis power-ups. The
stable pooled SVG renderer updates existing nodes instead of rebuilding the board
on every tick, preventing animation flicker. The dashboard presents the assessed
curriculum as four animated module paths. Each path connects three
chapter stops to a bookmarkable stage recap and its timed checkpoint, deriving
preview, learning, ready, and complete states from existing saved progress.
Recaps combine chapter progress, retrieval prompts, cross-chapter synthesis,
checkpoint evidence, and official Python references without introducing another
graded score. The final route shows the Python Pathforger award; it unlocks only
after every chapter and all four checkpoints are complete. A separate final
project stage then applies the same state-and-feedback habits to Snake and
platformer systems. On narrow screens each path becomes a vertical timeline,
while reduced-motion preferences disable route and badge motion without hiding
completion state.

The code-native geospace layer makes those surfaces feel like one navigation
console: orbit geometry and a scanning Python terminal introduce the welcome page,
waypoint traces guide the learning loop, the current roadmap stage carries a
luminous route beacon, recap rooms use restrained radar geometry, and the final
badge earns a one-shot arrival burst. The effects pause while off-screen or while
the tab is hidden, use only transform and opacity for animation, and disappear or
become static under reduced-motion, forced-colours, small-screen, and
high-contrast preferences.

Saved mastery also grows a decorative fleet across the welcome page, roadmap,
stage recaps, and completed chapter headers: green snakes represent mastered
chapters, blue snakes represent completed stages, and yellow snakes represent
passed timed rooms. These snakes are visual progress rewards only; they never
enter the playable board's collision state and remain pointer-inert and hidden
from assistive technology.

Concepts that benefit from direct manipulation can also include a focused lab. Chapter 2 provides an accessible number-line explorer for comparing `round`, `math.floor`, `math.ceil`, `int`, and `math.trunc` across positive values, negative values, exact integers, and ties-to-even.

Chapter 12 adds a complete problem-solving track: decomposition and counterexamples, justified greedy selection, memoization, bottom-up tabulation, capacity and reachability states, and paired-sequence tables. Its ten exercises progress from Two Sum and interval scheduling through climbing stairs, grid paths, 0/1 knapsack, coin change, maximum non-adjacent sum, subset sum, longest common subsequence, and edit distance. Four original local SVG diagrams support the class and each exercise reuses a relevant visual reasoning cue without exposing its solution.

Chapter 13 is a game-project studio motivated by the welcome-page Snake. Its class
traces the Pygame event → update → draw loop, rectangle collisions, elapsed-time
animation, Snake growth, platformer intent, gravity, landing, and camera state.
Two accessible browser labs let learners step the same state transitions with a
keyboard or pointer before attempting eight solution-free Python game-logic
exercises. The browser labs intentionally model game rules without opening an SDL
window; the class also explains how to install Pygame and run the graphical loop
locally.

Lesson notes, concept clinics, runbooks, and guided room tasks keep learning
markers separately from graded exercise passes, so classroom completion never
awards exercise stars. Editable classroom code and sample input use their own
bounded draft store and do not create canonical chapter `exNN.py` files. The
desktop class view includes a course rail and an on-page contents rail; both
collapse into keyboard-accessible disclosures on smaller screens.

Before those 13 graded chapters, **Chapter 0 · Launch Python** provides a
40-minute ungraded setup and motivation room. A completely new learner chooses a
reason to learn, compares browser and optional local Python, maps the editor /
interpreter / terminal workflow, edits and runs a first program, practises
traceback recovery, and then hands off directly to Chapter 1. Its learning
markers and classroom drafts use the normal local/account persistence path, but
it never changes exercise totals, stars, ranks, badges, or timed assessments.

The assessment map groups chapters 1–3, 4–6, 7–9, and a final chapters 10–12 capstone. Chapter 13 remains an untimed project studio rather than changing those four assessment contracts. Each room keeps its own active deadline, drafts, recent attempts, and best score; assessment results do not award exercise stars. See [docs/ASSESSMENTS.md](docs/ASSESSMENTS.md) for the room rules, source transparency, scoring, official references, and client-side security limitations.

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
npm run serve -- --port 4173
PORT=4173 npm run serve
npm run serve -- --help
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
npm run migrate:build

export PGUSER='eduground_app'
export PGPASSWORD_FILE='/run/secrets/eduground-runtime-password'
export APP_ORIGIN='https://learn.example.com'
npm start
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
| `#chapter/py00/tutorials` | Ungraded Chapter 0 setup, motivation, editable first run, recovery habits, and Chapter 1 handoff |
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

Short routes such as `#start` and `#py00` redirect to Chapter 0; legacy routes
such as `#py01` redirect to the corresponding graded chapter hub.

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
├── Py12 Problem Solving & Dynamic Programming/
│   ├── ex00.py
│   ├── ...
│   └── ex09.py
└── Py13 Pygame Game Lab/
    ├── ex00.py
    ├── ...
    └── ex07.py
```

The server owns this 110-file mapping. Learner input cannot select a path, and these files never share the repository's original `Py*/` solution directories. PostgreSQL remains authoritative; reading a saved account file recreates a missing mirror.

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
npm run validate:syntax
git diff --check
```

After local browser runs, remove generated reports and disposable operating-system
or Python cache files without touching dependencies, submissions, backups, or
database data:

```bash
npm run clean
```

`npm run validate` performs the deterministic offline checks for application and
backend TypeScript, emitted JavaScript, unit tests, the security policy, all 13
chapter definitions, all 110
exercise definitions, all 341 exercise tests, every solution-free starter, every
lesson section and runbook phase, all concept clinics, the rounding lab, toolbox
cards, both Pygame game-system labs, and the complete classroom/assessment schema. It also verifies cookie/origin
helpers, database TLS configuration, migration manifests, public-file isolation,
and hardened container/workflow policy. `npm run validate:links` is the optional
network check for curated official Python and Pygame documentation references.

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

- All 13 dashboard → chapter → class and exercise routes, plus representative
  mobile overflow checks.
- Four animated module paths, saved completed/current/upcoming states, keyboard
  access, vertical mobile layout, and reduced-motion behavior.
- Persistent class-section understanding markers.
- Worked concept clinics, guided-practice reveal, the Chapter 2 rounding lab, the
  Chapter 13 Snake and platformer labs, and chapter checkpoint feedback.
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
| `public/` | The complete and only HTTP-served browser application |
| `public/app/` | Application composition with dedicated bootstrap, feedback, and routing modules |
| `public/content/` | Solution-free curriculum data, generated starters, and visible/hidden learning checks |
| `public/features/` | Vertical UI features, including exercise-only grading and route layout |
| `public/styles/` | Shared responsive visual system used across multiple routes |
| `public/workers/` | Testable main-thread runner client plus the dedicated browser-Python worker execution boundary |
| `public/assets/` | Vendored Ace runtime, original illustrations, sprites, and other static media |
| `src/server/` | NodeNext server source; strict TypeScript is introduced here incrementally |
| `src/server/api/` | Same-origin API composition plus narrow typed route modules |
| `src/server/curriculum/` | Stable exercise manifest and private submission-file mirror |
| `src/server/http/` | Static-file and HTTP response helpers |
| `src/server/persistence/` | PostgreSQL configuration, migrations, and learner-state operations |
| `src/server/rag/` | Chapter-scoped retrieval, guarded prompts, bounded Ollama adapter, and tutor admission |
| `src/server/security/` | Credentials, cookies, origin checks, CSP, proxy policy, and runtime guards |
| `curriculum/solutions/` | Private Python reference solutions, grouped by the 13 course chapters |
| `curriculum/generated/` | Private generated solution bundle used only by build-time validation |
| `database/` | Ordered migrations and the restricted application-role bootstrap |
| `scripts/build/` | Starter/solution generation and vendored dependency refresh |
| `scripts/database/` | Migration, backup, restore, and secret-initialization commands |
| `scripts/maintenance/` | Safe cleanup utilities |
| `scripts/validation/` | Structure, syntax, content, security, integration, and link gates |
| `tests/unit/` | Fast client and server unit tests |
| `tests/integration/` | PostgreSQL-backed persistence and account integration tests |
| `tests/e2e/` | Chromium learner journeys, responsive behavior, and accessibility checks |
| `dist/server/` | Git-ignored JavaScript emitted from `src/server/` and executed by tests and production |
| `docker-compose.ai.yml` | Optional local-only Ollama overlay with one-shot model seeding and isolated inference |
| `.github/workflows/` | CI, PostgreSQL integration, CodeQL, supply-chain, container, documentation, and release workflows |
| `artifacts/` | Git-ignored browser results and generated validation evidence |
| `docs/ARCHITECTURE.md` | Detailed boundaries, runtime flow, change map, and extension rules |
| `docs/CLASSROOM.md` | Learner-facing class sequence, authoring contract, solution boundary, rendering integration, and validation guide |
| `docs/ASSESSMENTS.md` | Timed-room rules, chapter/PDF mapping, scoring, references, persistence, and security boundaries |
| `docs/PERSISTENCE.md` | Account sync, data model, storage bounds, migrations, and deletion behavior |
| `docs/DEPLOYMENT.md` | First deploy, proxy, upgrade, backup/restore drill, image promotion, and rollback runbook |
| `docs/AI_CLASSROOM_OPERATIONS.md` | Ollama isolation, resource bounds, classroom capacity plan, and incident procedures |
| `docs/SECURE_SDLC.md` | Trust boundaries, local/CI gates, release policy, incident response, and residual risks |

The browser deliberately remains a small ordered classic-script application, so
adding TypeScript to the server does not introduce a frontend bundler or change
learner asset URLs. `npm run build:server` compiles NodeNext source into
`dist/server/`; `npm run validate:types` performs the strict no-emit check.

## Content, privacy, and assessment transparency

The repository contains Python solutions but not the original problem statements or tests. The teaching prompts, contracts, hints, tutorial content, and tests are learning-oriented reconstructions inferred from visible filenames, signatures, inputs, and solution behaviour. They are not official or verbatim course questions.

Hidden cases stay masked in the interface until a complete run returns. Their JavaScript definitions remain inspectable in the browser, so they are useful learning checks rather than secure assessment secrets. A genuinely secret assessment would require server-side execution and server-held tests.

The assessment practical prompts are independently paraphrased from four PDFs supplied by the project owner. PDF wording, screenshots, and reference solutions are excluded; the public examples and tests are independently authored. Theory questions and explanations are original course material. Assessment question data, answer indexes, hidden tests, scores, and timers are client-side and therefore inspectable or modifiable. These rooms are educational practice, not proctored or tamper-resistant examinations.

`curriculum/generated/solution-code.js` supports local generation and validation
only. It is not requested by `public/index.html`,
`window.SOLUTION_CODE` is not created in the learner page, and editor resets
restore a safe starter rather than an answer. The server exposes exactly the
`public/` tree, so the solution bundle, `curriculum/solutions/` sources,
migrations, backend modules, and deployment secrets are not downloadable from the
web application.

Unsigned use sends no learner code or progress to the application API. Creating an account opts into syncing drafts, saved files, progress, editor mode, and detailed test results to PostgreSQL, plus the configured private submission-file mirror. Python code still executes in a browser worker, not on the Node server. The worker is not a safe sandbox for untrusted pasted code; it has a JavaScript bridge and network access to the CSP-allowed runtime origins. Account APIs require a separate tab capability that is never sent to the worker. Persisted run claims are explicitly labelled as learner-device evidence. The history view can reopen and copy recorded expected output, actual output, streams, and tracebacks, but the history API does not return source code or original test inputs. See the [secure-SDLC trust boundaries](docs/SECURE_SDLC.md#security-objective) before exposing account sync publicly.

## Refresh generated or vendored artifacts

After intentionally changing a Python solution:

```bash
npm run build:solutions
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
