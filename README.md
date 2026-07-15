# Python EduGround

Python EduGround turns the 11 exercise chapters in this repository into a local-first, game-like Python learning path. Learners can study solution-free tutorials, work through practical runbooks, write code in a Monokai editor, run Python in the browser, and optionally sync their own work to PostgreSQL.

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

### Optional account sync

![Local-first profile with opt-in PostgreSQL registration and sign-in controls](docs/screenshots/account-sync.jpg)

## Current learning experience

| Area | Included |
| --- | --- |
| Curriculum | 11 chapters, 92 exercises, 281 tests, and 239 collectible difficulty stars |
| Guided learning | 44 tutorials, 55 runbook phases, 55 mental-model steps, 22 guided practices, 37 learner/coach exchanges, and 40 choose-by-intent toolbox cards |
| Reference material | 66 glossary terms, 66 debugging checks, one checkpoint per chapter, and 40 curated official Python documentation links |
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

## Run locally

Requirements: a modern browser and Node.js 18 or newer.

### Local-only mode

No database is required for the complete curriculum, editor, browser runner, local drafts, or local progress:

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

## Navigation

The app uses bookmarkable hash routes:

| Route | View |
| --- | --- |
| `#home` | Chapter dashboard and current-learning cue |
| `#chapter/py01` | Chapter hub |
| `#chapter/py01/exercises` | Exercise catalogue |
| `#chapter/py01/tutorials` | Tutorials, deep dive, checkpoint, and runbook |
| `#exercise/py01-first-programs` | Prompt, examples, hints, IDE, tests, and results |
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
| Editor keymap | Browser storage | Browser storage and PostgreSQL account state |
| Complete run details | Current page memory only | PostgreSQL run-history record; current UI does not yet reload this history |
| Theme and sound | Browser storage | Browser storage only |

Local storage is scoped to the exact browser origin. For example, `127.0.0.1:8000` and `localhost:8000` have different local drafts. Account data is attached to the PostgreSQL database and can follow a learner to another deployment after they sign in there with the same account credentials.

## Validate the repository

```bash
npm run validate
npm run validate:links
node --check python-runner-worker.mjs
git diff --check
```

`npm run validate` performs the deterministic offline checks for application and backend syntax/tests, all 11 chapter definitions, all 92 exercise definitions, all 281 tests, every solution-free starter, every tutorial and runbook phase, all 40 toolbox cards, coaching conversations, official-link allowlisting, and the complete deep-learning schema. `npm run validate:links` is the optional network check that verifies the curated Python documentation pages and fragment anchors still exist.

The release smoke flow also covers:

- Dashboard → chapter → guide and exercise routes.
- Persistent tutorial-understanding markers.
- Guided-practice reveal and chapter checkpoint feedback.
- Safe starter code with no repository answer loaded into the page.
- Sublime/Vim switching, Monokai styling, and editor keyboard shortcuts.
- Local saving plus signed-in PostgreSQL and canonical chapter-file persistence.
- All-green execution across visible and hidden tests.
- Failure output with expected/actual fields and Python tracebacks.
- Dark mode, copy/paste controls, ranks, badges, and local persistence.

## Repository map

| Path | Responsibility |
| --- | --- |
| `index.html` | Stable application shell and vendored asset loading order |
| `course-ui.css` | Responsive light/dark UI, learning guide, account panel, runbook, and IDE layout |
| `course-app.js` | Router, views, local/account persistence, profile, editor adapter, runner controls, and result rendering |
| `learning-content.js` | Ranks, badges, tutorials, deep dives, checkpoints, and runbooks |
| `learning-toolbox.js` | Per-chapter Python functionality guide with conversions, imports, results, cautions, and copyable examples |
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
| `docs/PERSISTENCE.md` | Account sync, deployment durability, backup/restore, and security guide |

## Content, privacy, and assessment transparency

The repository contains Python solutions but not the original problem statements or tests. The teaching prompts, contracts, hints, tutorial content, and tests are learning-oriented reconstructions inferred from visible filenames, signatures, inputs, and solution behaviour. They are not official or verbatim course questions.

Hidden cases stay masked in the interface until a complete run returns. Their JavaScript definitions remain inspectable in the browser, so they are useful learning checks rather than secure assessment secrets. A genuinely secret assessment would require server-side execution and server-held tests.

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
