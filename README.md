# Python Foundations Playground

This repository contains Python solutions grouped into 11 chapters. The root web app turns them into a local, LeetCode-style learning path with separate dashboard, chapter, tutorial, exercise catalogue, IDE, profile, and badge views.

## What is included

- A light/dark chapter dashboard with overall progress and per-chapter progress bars.
- 92 exercises and 239 collectible difficulty stars. An exercise awards its 1–5 stars only after every visible and hidden test passes.
- Eight Pythonic ranks, from **PEP Explorer** to **Pythonic Grandmaster**.
- Ten computed badges with clickable requirements and a full badge gallery.
- A dedicated chapter hub where the learner chooses **Exercises** or **Runbook & tutorials**.
- Four in-depth, solution-free tutorials and a five-phase practical runbook for every chapter. Every code sample teaches the same concept through an unrelated scenario.
- Improved exercise descriptions, contracts, visible input/output examples, success criteria, and progressive hints.
- A large, locally vendored Ace editor with the Monokai theme, Python highlighting, line numbers, folding, search, autocomplete, saved drafts, keyboard shortcuts, and explicit copy/paste controls.
- Clean starter templates for every exercise. Script exercises begin with guidance only; function exercises expose only the public names and parameters required by the tests. Repository solutions are not loaded by the page.
- Separate **Run** and **Run tests** actions: Run checks visible examples, while Run tests includes hidden cases and can award progress.
- Per-test green checks or red crosses, expected and actual values, captured output, stderr, and complete Python tracebacks.
- Browser-local theme, drafts, passed exercises, stars, ranks, badges, and the sound preference.
- Synthesized click, submission, failure, success, and achievement sounds with a persistent mute control—no audio files or autoplay.
- Achievement toasts for newly unlocked badges and Pythonic ranks.

## Run locally

From the repository root:

```bash
npm run serve
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The server is zero-dependency, binds only to the local machine by default, uses the correct JavaScript module MIME types, and disables caching during development.

Choose another port or host when needed:

```bash
node scripts/serve.mjs --port 4173
PORT=4173 node scripts/serve.mjs
node scripts/serve.mjs --help
```

Serving over HTTP is required for the module-based Python worker. Ace itself is checked into the repository. The first Python run downloads a pinned Pyodide runtime, so that first run needs an internet connection. The worker tries a pinned jsDelivr source first and a separately pinned UNPKG source if the first CDN is unavailable.

## Navigation

The app uses bookmarkable hash routes so all views work with the static local server:

| Route | View |
| --- | --- |
| `#home` | Main chapter dashboard |
| `#chapter/py01` | Chapter hub |
| `#chapter/py01/exercises` | Exercise catalogue |
| `#chapter/py01/tutorials` | Deep tutorials and runbook |
| `#exercise/py01-first-programs` | Question, examples, hints, editor, tests, and results |
| `#profile/badges` | Rank ladder and badge gallery |

Legacy links such as `#py01` are redirected to the matching chapter hub.

## Exercise wording and hidden tests

The repository stores solutions, but not the original problem statements or tests. The prompts, descriptions, contracts, hints, tutorial content, and tests are learning-oriented reconstructions inferred from the visible solution behaviour. They are not official or verbatim course questions.

Hidden cases stay masked in the interface until a full run returns. Because this is a static local app, their definitions remain inspectable in the downloaded JavaScript; they are learning checks, not secure assessment secrets. Some boundary cases intentionally reveal limitations in the repository solutions.

The repository solution bundle is used only by the local build and validation scripts. `index.html` does not request it, `window.SOLUTION_CODE` is never created in the learner page, and editor resets restore a solution-free starter rather than an answer.

## Important files

- `index.html` contains the stable application shell and asset loading order.
- `course-ui.css` implements the responsive light/dark product UI and large IDE layout.
- `course-app.js` contains the hash router, views, profile, ranks, badges, saved state, Ace adapter, and test-result renderer.
- `learning-content.js` defines eight ranks, ten badges, and the deep tutorial/runbook material for all 11 chapters.
- `exercise-data.js` defines chapters, exercises, prompts, topics, source paths, and progressive hints.
- `test-data/` defines 186 visible and 95 hidden tests.
- `starter-code.js` contains generated solution-free script templates and tested public function signatures.
- `solution-code.js` is a build-time repository artifact and is deliberately not loaded by `index.html`.
- `audio-feedback.js` creates the interaction, result, and achievement cues with the Web Audio API.
- `python-runner-worker.mjs` executes tests in a fresh Python namespace and captures stdout, stderr, and tracebacks.
- `assets/vendor/ace/` contains the pinned Ace 1.44.0 runtime, Python mode, Monokai theme, and license.
- `assets/learning-visuals/python-chapter-sprite.png` supplies the chapter illustrations.
- `scripts/serve.mjs` is the dedicated local web server.

## Editor shortcuts

- `Ctrl/Command + Enter`: run all visible and hidden tests.
- `Ctrl/Command + S`: immediately save the current browser draft.
- Ace search, folding, keyboard accessibility, and autocomplete commands remain available.

**Restart** restores the clean starter for only the current exercise. It never inserts the repository answer. A passing exercise remains part of the learner's collected progress.

## Refresh generated or vendored files

After changing a Python solution, rebuild the browser source bundle:

```bash
node scripts/build-solution-bundle.mjs
npm run build:starters
```

To refresh the vendored Ace files after intentionally changing its pinned dependency:

```bash
npm install
npm run vendor:ace
```

## Validate

```bash
npm run validate
```

The validation command checks the application, audio, and learning-content syntax; verifies all 11 chapters, 92 exercises, and 281 tests; and confirms every exercise has a non-solution starter.

For a browser smoke test, verify both themes and these flows:

1. Dashboard → chapter → exercises → exercise IDE.
2. Dashboard → chapter → runbook and tutorial.
3. Run visible examples, then run the full hidden suite.
4. Confirm a full green run adds difficulty stars, progress, rank credit, and badge credit.
5. Introduce an error and confirm expected output, actual output, and the full traceback appear.
6. Reload and confirm the selected theme, draft, and passed progress remain.
7. Copy and paste code, toggle sound, and confirm the choice survives reload.
