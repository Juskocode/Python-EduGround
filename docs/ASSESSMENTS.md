# Timed assessments

Python EduGround includes four assessment blocks that sit alongside the normal chapter exercises. Each block has a theory room and a practical room. The rooms are intended for self-assessment after the related tutorials and runbooks; they do not award exercise stars or replace the chapter exercises.

Open `#assessments` from the top navigation to see every block and the learner's best saved scores.

## Assessment map

| Block | Chapters | Theory | Practical source |
| --- | --- | --- | --- |
| 1 · Core Python Control Flow | 1–3: First Programs; Simple Data; Flow, Conditionals & Iteration | 15 questions · 20 minutes | Independently paraphrased from supplied PE01, 17 October 2019 |
| 2 · Functions and Sequences | 4–6: Functions; Strings & Tuples; Lists | 15 questions · 20 minutes | Independently paraphrased from supplied PE02, 7 November 2019 |
| 3 · Mappings, Sets, and Recursion | 7–9: Dictionaries & Sets; Recursion; FP with Collections | 15 questions · 20 minutes | Independently paraphrased from supplied PE03, 29 November 2019 |
| 4 · Functional Tools and Lazy Algorithms | 10–11: Effect-Free Programming; Divide and Conquer | 15 questions · 20 minutes | Independently paraphrased from supplied PE04, 19 December 2019 |

The supplied source-file order was `2019.pdf` (PE01), `2019 (1).pdf` (PE02), `2019 (2).pdf` (PE03), and `2019 (3).pdf` (PE04). Those PDFs are source material only and are not published by the web app.

Every practical room contains five independent Python tasks and lasts 60 minutes. The fourth block is a two-chapter capstone because the course contains 11 chapters.

## Rules and scoring

Theory and practical are passed independently. A block is shown as passed only after both rooms have a passing result.

| Room | Scoring | Pass mark |
| --- | --- | --- |
| Theory | 15 equally weighted questions. Some have one correct option and some require several. A question scores only when the selected set exactly matches the complete answer set; there is no partial credit. | 60/100, which requires 9 of 15 fully correct answers |
| Practical | Five tasks worth 20 points each. A task earns its 20 points only when every visible and hidden test passes; there is no partial credit within a task. | 60/100, which requires 3 of 5 fully passing tasks |

Theory explanations are revealed after submission. Practical rooms provide a solution-free function contract, constraints, public examples, an auto-saving Monokai editor, visible checks, and a final run that includes hidden cases. `Shift + Enter` runs the visible checks for the current practical task. The editor supports the same Sublime and Vim keymaps, copy/paste controls, reset, and `.py` download as the exercise workspace.

The app keeps the most recent ten completed attempts per room and displays the latest and best results. A separate monotonic `completed` flag and `bestScore` summary preserve achievement evidence after an older attempt rolls out of that review window, so retaking a room never removes a previous pass.

## Timer behaviour

- The theory deadline is created when the learner presses **Start**.
- The practical room first prepares the browser Python runtime. Its deadline is created only after that preparation succeeds, so a slow first Pyodide download does not consume exam time.
- A deadline is stored as an absolute timestamp. Refreshing the page, changing routes, closing the tab, or updating the application does not pause or restart it.
- Answers and practical drafts are saved after each change. Returning to the same active room resumes against the original deadline.
- At zero, the room submits automatically. A practical submission runs all five complete test suites and may take a short additional period to finish.
- Opening an official documentation link does not pause the room.

These timers use the learner's browser clock and browser storage. They are useful practice constraints, not tamper-resistant proctoring controls. Changing the device clock or editing client storage can affect them.

## What is saved

Assessment state includes the active attempt ID, start and deadline timestamps, theory selections, practical code drafts, visible-check summaries, recent submitted/expired results, and monotonic pass/best-score summaries. It is stored in the current browser workspace and, when the learner is signed in, inside the PostgreSQL `user_state` record.

One anonymous workspace and one locally cached workspace per account prevent one signed-in learner's drafts and results from appearing to another learner on the same browser. The first sign-in merges anonymous work into that account and clears the transferred anonymous workspace. Signing out returns to a fresh or existing anonymous workspace without exposing account data. Future sign-ins merge the account's local cache with its server state.

Assessment practical drafts are not written to `user_files` and do not create chapter `exNN.py` files. That canonical file workflow belongs only to the 92 normal exercises. Use **Download .py** in the assessment editor when a separate local copy of a practical answer is needed.

See [Persistence and PostgreSQL operations](PERSISTENCE.md) for deployment upgrades, merge behaviour, backups, and browser-origin limitations.

## Official Python references

Each block page links directly to focused sections of the official Python 3 documentation. Review them before starting a room; the same links remain available from the room landing page.

### Chapters 1–3

- [`input()`](https://docs.python.org/3/library/functions.html#input) — reading a line of user input as text.
- [Numeric types](https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex) — integer and floating-point operations and conversions.
- [Arithmetic expressions](https://docs.python.org/3/reference/expressions.html#binary-arithmetic-operations) — division, remainder, powers, and operator semantics.
- [Control-flow tools](https://docs.python.org/3/tutorial/controlflow.html) — conditions, loops, `range`, `break`, and `continue`.
- [`round()`](https://docs.python.org/3/library/functions.html#round) — precision, return types, and tie behaviour.

### Chapters 4–6

- [Defining functions](https://docs.python.org/3/tutorial/controlflow.html#defining-functions) — parameters, local names, and return values.
- [Common sequence operations](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations) — indexing, slicing, concatenation, membership, and length.
- [String methods](https://docs.python.org/3/library/stdtypes.html#string-methods) — official behaviour for common text transformations.
- [Tuples and sequences](https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences) — packing, unpacking, and sequence use.
- [Sorting HOWTO](https://docs.python.org/3/howto/sorting.html) — key functions, compound keys, direction, and stability.

### Chapters 7–9

- [`dict` mapping type](https://docs.python.org/3/library/stdtypes.html#mapping-types-dict) — lookup, views, insertion order, and standard methods.
- [`set` and `frozenset`](https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset) — membership and set algebra.
- [Data structures tutorial](https://docs.python.org/3/tutorial/datastructures.html) — lists, tuples, sets, dictionaries, and looping techniques.
- [Defining functions](https://docs.python.org/3/tutorial/controlflow.html#defining-functions) — calls, parameters, return values, and recursive definitions.
- [Recursion-depth safeguard](https://docs.python.org/3/library/sys.html#sys.getrecursionlimit) — the interpreter's recursion limit.

### Chapters 10–11

- [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) — iterators, generators, mapping, filtering, and composable functions.
- [List comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions) — readable transformations and filters.
- [Generators](https://docs.python.org/3/tutorial/classes.html#generators) — lazy functions that preserve local state.
- [`itertools`](https://docs.python.org/3/library/itertools.html) — efficient iterator building blocks.
- [`functools.reduce()`](https://docs.python.org/3/library/functools.html#functools.reduce) — cumulative reduction into one result.

## Source and security transparency

The practical prompts are independently written, learning-oriented paraphrases based on the four PDFs supplied by the project owner. PDF wording, screenshots, and reference solutions are not embedded in or served by the app. The public examples and tests were authored for Python EduGround rather than copied from an answer key. Theory questions were authored from the course topics and include original explanations and code-reading examples.

The complete assessment data, theory answer indexes, practical hidden tests, scoring logic, and timer logic are delivered to the browser. A learner with developer tools can inspect or modify them. The rooms therefore provide structured educational practice, not confidential or certified examination evidence. Secure grading would require server-held questions and tests, server-side execution, an authoritative server clock, stronger identity controls, and audit/proctoring safeguards.

## Maintainer validation

Run the deterministic assessment and application checks before release:

```bash
node scripts/validate-assessment-data.mjs
npm run validate
```

The assessment validator enforces the four chapter ranges, 15/5 room sizes, 20/60-minute limits, 60% pass marks, solution-free starters, Python syntax, visible/hidden test coverage, stable IDs, and official `docs.python.org/3/` references. The optional network check verifies that every chapter and assessment documentation page and fragment still resolves:

```bash
npm run validate:links
```
