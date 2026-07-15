# Python EduGround

Python EduGround turns the 11 exercise chapters in this repository into a local-first, game-like Python learning path. Learners can study solution-free tutorials, work through practical runbooks, write code in a Monokai editor, run Python in the browser, enter four timed assessment blocks, and optionally sync their own work to PostgreSQL.

## Product tour

### Chapter dashboard

![Dark Python EduGround dashboard with chapter progress, stars, rank, and badges](docs/screenshots/dashboard.jpg)

### Deep, solution-free learning guide

![First Programs learning guide showing its mental model and guided-practice flow](docs/screenshots/learning-guide.jpg)

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
| Curriculum | 11 chapters, 92 exercises, 281 exercise tests, and 239 collectible difficulty stars |
| Guided learning | 44 tutorials, 55 runbook phases, 55 mental-model steps, 22 guided practices, 37 learner/coach exchanges, and 40 choose-by-intent toolbox cards |
| Timed assessments | Four chapter blocks, each with 15 theory questions in 20 minutes and five practical tasks in 60 minutes; theory and practical pass independently at 60/100 |
| Reference material | 66 glossary terms, 66 debugging checks, one checkpoint per chapter, and 60 curated official Python documentation links: 40 in chapter guides and 20 in assessments |
| Exercise support | Rewritten teaching prompts, contracts, success criteria, visible examples, and progressive hints |
| Editor | Vendored Ace with a persistent Sublime or Vim keymap, fixed Monokai theme, Python highlighting, autocomplete, search, folding, line numbers, and copy/paste controls |
| Files | Automatic browser drafts, explicit **Save**, full-test submission snapshots, canonical chapter `exNN.py` files, and **Download .py** |
| Runner | Pyodide in an isolated browser worker; **Run** checks visible examples and **Run tests** adds hidden cases |
| Feedback | Per-test pass/fail state, inputs, expected output, actual output, captured streams, and complete tracebacks |
| Motivation | Chapter progress, difficulty stars, eight Pythonic ranks, ten badges, achievement toasts, and optional sound cues |
| Persistence | Local browser storage by default; optional PostgreSQL account sync plus a durable per-user submission-file volume |
| Preferences | Responsive light/dark interface, reduced-motion support, persistent theme, mute state, and editor mode |

Every chapter guide combines six layers:

1. Four concept tutorials with unrelated examples, checklists, takeaways, and common pitfalls.
2. A visual mental model that explains how values or control move through the chapter's topic.
3. Two guided prediction practices with copyable safe starters and revealable coaching notes.
4. A glossary, debugging checklist, and knowledge checkpoint.
5. A chapter-specific Python toolbox that explains syntax, return values, type conversions, imports, appropriate use, and common traps through copyable analogous examples.
6. A five-phase runbook with a conversational Python coach, **why it matters**, **what to try when stuck**, inspectable evidence, and topic-specific links to the official Python documentation.

Guide sections can be marked understood. Their progress persists separately from graded exercise passes, so reading a tutorial never awards exercise stars.

The assessment map groups chapters 1–3, 4–6, 7–9, and a final chapters 10–11 capstone. Each room keeps its own active deadline, drafts, recent attempts, and best score; assessment results do not award exercise stars. See [docs/ASSESSMENTS.md](docs/ASSESSMENTS.md) for the room rules, source transparency, scoring, official references, and client-side security limitations.

## Run locally

Requirements: a modern browser and Node.js 18 or newer.

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

The shortest Docker-backed setup is:

```bash
docker-compose up --build
```

The Compose stack creates durable PostgreSQL and submission-file volumes, applies the checked-in migrations, and serves the app. For a manually managed or hosted database:

```bash
export DATABASE_URL='postgresql://eduground:change-this-password@127.0.0.1:5432/eduground'
npm run migrate
npm run serve
```

Database-backed saving is opt-in from the profile menu. Unsigned learners remain local-only. See [docs/PERSISTENCE.md](docs/PERSISTENCE.md) for the complete data model, environment reference, deployment, backup, restore, security, and deletion guidance.

## Upgrade without losing progress

`git pull` changes application files, not browser `localStorage` or PostgreSQL data. Local-only progress remains visible when the updated app is served from the same browser origin. Signed-in progress follows the PostgreSQL database and is merged with the account's locally cached workspace after sign-in.

For an in-place Compose update, keep the same `COMPOSE_PROJECT_NAME` and named volumes, back up PostgreSQL, then rebuild:

```bash
git pull --ff-only
docker-compose up -d --build
curl --fail http://127.0.0.1:8000/readyz
```

The Compose file has a stable default project name, `fundamentos-de-programacao-playground`, so the historical `postgres_data` and `submissions_data` volumes continue to be selected even if the checkout directory is renamed. If an existing deployment used `-p` or a custom `COMPOSE_PROJECT_NAME`, continue using that exact value. The app service runs `npm run migrate` before startup; manually managed deployments must run it before routing traffic to the new release. Do not use `docker-compose down -v` during an upgrade. Follow the [upgrade, backup, and restore runbook](docs/PERSISTENCE.md#upgrade-an-existing-installation) before a production pull.

## Navigation

The app uses bookmarkable hash routes:

| Route | View |
| --- | --- |
| `#home` | Chapter dashboard and current-learning cue |
| `#chapter/py01` | Chapter hub |
| `#chapter/py01/exercises` | Exercise catalogue |
| `#chapter/py01/tutorials` | Tutorials, deep dive, checkpoint, and runbook |
| `#exercise/py01-first-programs` | Prompt, examples, hints, IDE, tests, and results |
| `#assessments` | Four-block timed-assessment map and saved best scores |
| `#assessment/py01-py03` | One block's theory/practical choices and official references |
| `#assessment/py01-py03/theory` | Theory room landing, active attempt, or latest result |
| `#assessment/py01-py03/practical` | Practical room landing, active coding attempt, or latest result |
| `#profile/badges` | Rank ladder and badge gallery |

Legacy routes such as `#py01` redirect to the corresponding chapter hub.

## Editor controls

- Choose **Sublime** or **Vim** from the **Keys** selector. The selection persists; the visual theme remains Monokai.
- `Shift + Enter` runs the visible examples.
- `Ctrl/Command + Enter` runs the complete visible and hidden suite and, when signed in, saves that exact submitted snapshot.
- `Ctrl/Command + S` performs the same explicit save as the **Save** button.
- **Save** always flushes the browser draft and, when signed in, stores the source in PostgreSQL and its canonical chapter file.
- **Download .py** creates a normal Python file through the browser, whether signed in or not.
- **Copy** and **Paste** complement normal editor or Vim/Sublime clipboard commands.
- **Restart** restores the clean, solution-free starter for the current exercise.

The practical assessment editor uses the same Sublime/Vim selection, Monokai theme, copy/paste controls, and `Shift + Enter` visible-check shortcut. Its five drafts belong to the timed attempt and do not create canonical chapter `exNN.py` files; use **Download .py** for a separate copy.

Typing is auto-saved to browser storage after a short delay. Signed-in progress and drafts are also synchronized in the background. Explicit **Save** and every complete **Run tests** attempt upsert the exact editor snapshot and materialize it under a stable zero-based name:

```text
submissions/<user UUID>/
├── Py01 First Programs/
│   ├── ex00.py
│   ├── ex01.py
│   └── ...
├── Py02 Simple data/
│   └── ...
└── Py11 Divide and Conquer/
    ├── ex00.py
    ├── ex01.py
    └── ex02.py
```

The server owns this 92-file mapping. Learner input cannot select a path, and these files never share the repository's original `Py*/` solution directories. PostgreSQL remains authoritative; reading a saved account file recreates a missing mirror.

## What is saved

| Data | Unsigned learner | Signed-in learner |
| --- | --- | --- |
| Draft code | Browser storage | Browser storage and account state |
| Explicit Save or complete test submission | Browser draft; optional `.py` download | PostgreSQL `user_files`, browser draft, and `<chapter>/exNN.py` mirror |
| Passed exercises and stars | Browser storage | Browser storage and PostgreSQL account state |
| Guide markers | Browser storage | Browser storage and PostgreSQL account state |
| Timed assessment deadlines, answers, practical drafts, and recent results | Browser storage | Browser storage and PostgreSQL account state |
| Editor keymap | Browser storage | Browser storage and PostgreSQL account state |
| Complete run details | Current page memory only | PostgreSQL run-history record; current UI does not yet reload this history |
| Theme and sound | Browser storage | Browser storage only |

Local storage is scoped to the exact browser origin. For example, `127.0.0.1:8000` and `localhost:8000` have different local drafts. Within one origin, the app keeps an anonymous workspace and a separate local cache per account, so signing out does not expose one account's work to the next learner. Account data is attached to the PostgreSQL database and can follow a learner to another deployment after they sign in there with the same account credentials.

## Validate the repository

```bash
npm run validate
npm run validate:links
node --check python-runner-worker.mjs
git diff --check
```

`npm run validate` performs the deterministic offline checks for application and backend syntax/tests, all 11 chapter definitions, all 92 exercise definitions, all 281 exercise tests, every solution-free starter, every tutorial and runbook phase, all 40 toolbox cards, coaching conversations, and the complete deep-learning schema. It also checks all four assessment blocks, 60 theory questions, 20 practical tasks, 60 practical tests, absolute 20/60-minute limits, stable IDs, solution-free assessment starters, and official-link allowlisting. `npm run validate:links` is the optional network check that verifies all 60 curated Python documentation references and fragment anchors still exist.

The release smoke flow also covers:

- Dashboard → chapter → guide and exercise routes.
- Persistent tutorial-understanding markers.
- Guided-practice reveal and chapter checkpoint feedback.
- Safe starter code with no repository answer loaded into the page.
- Sublime/Vim switching, Monokai styling, and editor keyboard shortcuts.
- Local saving plus signed-in PostgreSQL and canonical chapter-file persistence.
- All-green execution across visible and hidden tests.
- Failure output with expected/actual fields and Python tracebacks.
- Four assessment blocks with resumable absolute deadlines, exact-set theory scoring, five-task practical grading, automatic expiry submission, and saved attempt history.
- Dark mode, copy/paste controls, ranks, badges, and local persistence.

## Repository map

| Path | Responsibility |
| --- | --- |
| `index.html` | Stable application shell and vendored asset loading order |
| `course-ui.css` | Responsive light/dark UI, learning guide, account panel, runbook, and IDE layout |
| `course-app.js` | Router, views, local/account persistence, profile, editor adapter, runner controls, and result rendering |
| `learning-content.js` | Ranks, badges, tutorials, deep dives, checkpoints, and runbooks |
| `learning-toolbox.js` | Per-chapter Python functionality guide with conversions, imports, results, cautions, and copyable examples |
| `assessment-data.js` | Four assessment blocks, theory questions, practical contracts/tests, source notes, and official references |
| `assessment-engine.js` | Assessment scoring, deadline, sanitization, history, and conflict-merge rules |
| `assessment-room.js` | Assessment routes, timed-room controller, practical editor, submission flow, and results |
| `assessment-ui.css` | Responsive light/dark assessment hub, room, editor, and result styling |
| `exercise-data.js` | Chapters, prompts, topics, source paths, and hints |
| `test-data/` | 186 visible and 95 hidden learning checks |
| `starter-code.js` | Generated solution-free starters and public function signatures |
| `solution-code.js` | Build-time repository artifact that is deliberately not loaded by the learner page |
| `audio-feedback.js` | Synthesized click, result, and achievement cues |
| `python-runner-worker.mjs` | Isolated Python execution, output capture, timeout handling, and traceback capture |
| `assets/vendor/ace/` | Pinned Ace 1.44.0 runtime, Monokai theme, Sublime/Vim keymaps, and license |
| `server/` | Same-origin HTTP API, authentication, PostgreSQL access, security helpers, and static serving |
| `server/exercise-manifest.mjs` | Stable 92-exercise mapping to chapter directories and zero-based `exNN.py` names |
| `server/submission-files.mjs` | Atomic, private per-user filesystem mirror with traversal and symlink protection |
| `db/migrations/` | Ordered, checksum-protected PostgreSQL schema migrations |
| `scripts/migrate.mjs` | Migration command used locally and during deployment |
| `scripts/validate-assessment-data.mjs` | Assessment structure, timing, stable-ID, syntax, test, solution-leak, and official-link validation |
| `docs/ASSESSMENTS.md` | Timed-room rules, chapter/PDF mapping, scoring, references, persistence, and security boundaries |
| `docs/PERSISTENCE.md` | Account sync, deployment durability, backup/restore, and security guide |

## Content, privacy, and assessment transparency

The repository contains Python solutions but not the original problem statements or tests. The teaching prompts, contracts, hints, tutorial content, and tests are learning-oriented reconstructions inferred from visible filenames, signatures, inputs, and solution behaviour. They are not official or verbatim course questions.

Hidden cases stay masked in the interface until a complete run returns. Their JavaScript definitions remain inspectable in the browser, so they are useful learning checks rather than secure assessment secrets. A genuinely secret assessment would require server-side execution and server-held tests.

The assessment practical prompts are independently paraphrased from four PDFs supplied by the project owner. PDF wording, screenshots, and reference solutions are excluded; the public examples and tests are independently authored. Theory questions and explanations are original course material. Assessment question data, answer indexes, hidden tests, scores, and timers are client-side and therefore inspectable or modifiable. These rooms are educational practice, not proctored or tamper-resistant examinations.

`solution-code.js` supports local generation and validation only. It is not requested by `index.html`, `window.SOLUTION_CODE` is not created in the learner page, and editor resets restore a safe starter rather than an answer. The server uses a public-file allowlist, so the solution bundle, original `Py*/` sources, migrations, backend modules, and deployment secrets are not downloadable from the web application.

Unsigned use sends no learner code or progress to the application API. Creating an account opts into syncing drafts, saved files, progress, editor mode, and detailed test results to PostgreSQL, plus the configured private submission-file mirror. Python code still executes in the browser, not on the Node server. See [the persistence security notes](docs/PERSISTENCE.md#security-limitations) before exposing account sync publicly.

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

The prioritized, issue-ready backlog is in [docs/ROADMAP.md](docs/ROADMAP.md). It now treats editor modes, file downloads, and optional PostgreSQL sync as delivered foundations and focuses future work on production account security, conflict visibility, run-history UX, CI, accessibility, performance, offline use, data portability, and curriculum authoring.
