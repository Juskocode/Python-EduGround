# Python EduGround

Python EduGround turns the 11 exercise chapters in this repository into a local, game-like Python learning path. Learners can study solution-free tutorials, follow a practical debugging runbook, write code in a full editor, execute Python in the browser, and earn stars only when every visible and hidden learning check passes.

## Product tour

### Chapter dashboard

![Dark Python EduGround dashboard with chapter progress, stars, rank, and badges](docs/screenshots/dashboard.jpg)

### Deep, solution-free learning guide

![First Programs learning guide showing its mental model and guided-practice flow](docs/screenshots/learning-guide.jpg)

### Evidence-driven problem-solving runbook

![Problem-solving runbook with why it matters, what to try when stuck, and evidence for every phase](docs/screenshots/runbook.jpg)

### Browser IDE and test feedback

![Dark Python editor with safe starter code, visible examples, hidden tests, and run controls](docs/screenshots/editor.jpg)

![All tests passed with expected and actual output visible](docs/screenshots/test-results.jpg)

## Current learning experience

| Area | Included |
| --- | --- |
| Curriculum | 11 chapters, 92 exercises, 281 tests, and 239 collectible difficulty stars |
| Guided learning | 44 tutorials, 55 runbook phases, 55 mental-model steps, and 22 guided practices |
| Reference material | 66 glossary terms, 66 debugging checks, and one checkpoint per chapter |
| Exercise support | Rewritten teaching prompts, contracts, success criteria, visible examples, and progressive hints |
| Editor | Vendored Ace editor with Python highlighting, autocomplete, search, folding, line numbers, saved drafts, and copy/paste controls |
| Runner | Pyodide in an isolated browser worker with visible-only Run and complete Run tests actions |
| Feedback | Per-test pass/fail state, inputs, expected output, actual output, captured streams, and complete tracebacks |
| Motivation | Chapter progress, difficulty stars, eight Pythonic ranks, ten badges, achievement toasts, and optional sound cues |
| Preferences | Responsive light/dark interface, reduced-motion support, persistent theme, and persistent mute state |
| Privacy | Drafts, guide progress, exercise progress, ranks, and preferences stay in local browser storage |

Every chapter guide now combines five layers:

1. Four concept tutorials with unrelated examples, checklists, takeaways, and common pitfalls.
2. A visual mental model that explains how values or control move through the chapter's topic.
3. Two guided prediction practices with copyable safe starters and revealable coaching notes.
4. A glossary, debugging checklist, and knowledge checkpoint.
5. A five-phase runbook where every phase explains **why it matters**, **what to try when stuck**, and **what evidence proves the phase is complete**.

Guide sections can be marked understood. Their progress persists separately from graded exercise passes so reading a tutorial never awards exercise stars.

## Run locally

Requirements: a modern browser and Node.js 18 or newer.

```bash
npm ci
npm run serve
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

The development server has no runtime dependencies, binds to the local machine by default, serves JavaScript modules with the correct MIME types, and disables caching. A different host or port can be selected when needed:

```bash
node scripts/serve.mjs --port 4173
PORT=4173 node scripts/serve.mjs
node scripts/serve.mjs --help
```

HTTP serving is required for the module-based Python worker. Ace is checked into the repository. The first Python run downloads a pinned Pyodide runtime from jsDelivr, with a separately pinned UNPKG fallback, so the initial run needs an internet connection.

## Navigation

The app uses bookmarkable hash routes, so every view works with the local static server.

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

- **Run** executes only the visible examples.
- **Run tests** adds the hidden learning checks and awards stars after a completely green run.
- **Copy** and **Paste** provide explicit clipboard controls alongside normal editor shortcuts.
- **Restart** restores the clean solution-free starter for the current exercise.
- `Ctrl/Command + Enter` runs the complete suite.
- `Ctrl/Command + S` saves the current draft immediately.

## Validate the repository

```bash
npm run validate
node --check python-runner-worker.mjs
git diff --check
```

`npm run validate` checks application syntax, all 11 chapter definitions, all 92 exercise definitions, all 281 tests, every solution-free starter, every tutorial and runbook phase, and the complete deep-learning schema.

The release smoke flow also covers:

- Dashboard → chapter → guide and exercise routes.
- Persistent tutorial-understanding markers.
- Guided-practice reveal and chapter checkpoint feedback.
- Safe starter code with no repository answer loaded into the page.
- All-green execution across visible and hidden tests.
- Failure output with expected/actual fields and Python tracebacks.
- Dark mode, copy/paste controls, ranks, badges, and local persistence.

## Repository map

| Path | Responsibility |
| --- | --- |
| `index.html` | Stable application shell and asset loading order |
| `course-ui.css` | Responsive light/dark UI, learning guide, runbook, and IDE layout |
| `course-app.js` | Router, views, persistence, profile, editor adapter, runner controls, and result rendering |
| `learning-content.js` | Ranks, badges, tutorials, deep dives, checkpoints, and runbooks |
| `exercise-data.js` | Chapters, prompts, topics, source paths, and hints |
| `test-data/` | 186 visible and 95 hidden learning checks |
| `starter-code.js` | Generated solution-free starters and public function signatures |
| `solution-code.js` | Build-time repository artifact that is deliberately not loaded by the learner page |
| `audio-feedback.js` | Synthesized click, result, and achievement cues |
| `python-runner-worker.mjs` | Isolated Python execution, output capture, timeout handling, and traceback capture |
| `assets/vendor/ace/` | Pinned Ace 1.44.0 runtime and license |
| `scripts/validate-learning-content.mjs` | Tutorial, deep-dive, checkpoint, and solution-isolation validation |

## Content and assessment transparency

The repository contains Python solutions but not the original problem statements or tests. The teaching prompts, contracts, hints, tutorial content, and tests are learning-oriented reconstructions inferred from visible filenames, signatures, inputs, and solution behaviour. They are not official or verbatim course questions.

Hidden cases stay masked in the interface until a complete run returns. Because this is a static local application, their JavaScript definitions remain inspectable; they are useful learning checks, not secure assessment secrets. A future hosted assessment mode would need server-side execution and server-held tests.

`solution-code.js` supports local generation and validation only. It is not requested by `index.html`, `window.SOLUTION_CODE` is not created in the learner page, and editor resets restore a safe starter rather than an answer.

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

The prioritized, issue-ready backlog is in [docs/ROADMAP.md](docs/ROADMAP.md). It covers release hygiene, continuous browser testing, accessibility, runnable micro-labs, safer draft handling, performance, offline support, data portability, and curriculum authoring.
