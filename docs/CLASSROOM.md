# Classroom content and authoring guide

Each chapter route at `#chapter/<chapter id>/tutorials` is a complete,
solution-free class rather than a loose collection of cards. The presentation
borrows the useful teaching rhythm of the
[Google Python Class](https://developers.google.com/edu/python)—summary-first
notes, short examples, stable course navigation, and an explicit exercise
handoff—without copying its wording, branding, code, or visual chrome.

Chapters 1–3 also use a guided-room rhythm inspired by interactive learning rooms:
read a small piece of theory, answer or modify code, receive specific feedback, and
continue with a visible completion marker. There are 11 of these room tasks: five
in Chapter 1 and three each in Chapters 2 and 3.

## Learner-facing class sequence

Every chapter uses the same predictable sequence:

1. **In this class** — audience, duration, format, summary, prerequisites, and preparation.
2. **Lesson plan** — five timed blocks totalling 90 minutes.
3. **Lecture demonstration** — independently authored, editable Python with a separate sample-input panel, real terminal output, teaching points, and prediction questions.
4. **Guided room tasks, when supplied** — concise theory followed by an answer check or incomplete program. Chapters 1–3 currently provide 11 tasks in total.
5. **Lesson notes** — concept explanations, analogous examples, checks, takeaways, and common mistakes. Python examples are editable and runnable from the same embedded workspace.
6. **Class activities** — collaborative tasks that end with inspectable evidence.
7. **Independent practice** — ordered transfer prompts completed without copying the lecture example.
8. **Deep dive** — mental model, execution trace, misconception clinic, guided practice, glossary, debugging reference, and checkpoint.
9. **Problem-solving runbook** — toolbox, coaching conversation, and evidence-driven five-phase workflow.
10. **Class recap and homework** — retrieval questions, deliverables, and a self-review checklist.
11. **Official reading and exercises** — authoritative Python references followed by the chapter exercise handoff.

The desktop presentation uses a course rail, a focused reading column, and an
on-page contents rail. The navigation rails become native `<details>` disclosures
on smaller screens. Contents controls are buttons rather than fragment links
because the application already uses the URL hash for routing.

## Chapter 1: teaching the input boundary

Chapter 1 is written for someone who may never have used a code editor or terminal.
It first identifies four visible parts of the room:

- the **editor**, where Python instructions are typed;
- the **Run** control, which asks Python to follow those instructions;
- the **sample-input panel**, whose lines represent text supplied to a waiting program;
- the **terminal**, where printed output, errors, and tracebacks appear.

The material then introduces one boundary at a time:

1. `input()` pauses until one complete line is available and returns those
   characters as a `str`, even when every character is a digit.
2. `int(raw_value)` creates a whole-number value for counts and whole-number
   arithmetic.
3. `float(raw_value)` creates a numeric value that can retain a fractional part,
   which is useful for beginner measurements.
4. A conversion creates a new value; it does not rewrite the original keyboard
   text. The examples therefore keep names such as `raw_bag_count` alongside names
   such as `bag_count`.
5. Invalid text such as `int("four")` ends with a `ValueError`. Learners are taught
   to read the final traceback line before changing the code or input.

This sequence deliberately avoids the misleading shortcut that “typing a number
gives Python a number.” It connects the real-world meaning of a value—count or
measurement—to the conversion chosen for it.

## Guided room interaction

Each room task begins with a short summary and a few explanation lines. The
interaction then branches by task kind.

### Answer tasks

The learner types a short answer and chooses **Check answer**. Input is normalized
for Unicode, surrounding whitespace, repeated spaces, and case before comparison.
An empty or incorrect answer shows a coaching hint and does not mark the task
complete. A correct answer records the task once, updates the room progress bar,
and remains complete after reload.

Accepted answers live in the client-side course data because the application is
local-first, but they are not placed in the rendered DOM. These checks are
learning activities, not secret or tamper-resistant assessments.

### Code tasks

A code task supplies incomplete starter code, original input, exact expected
output, visible technique requirements, and feedback. Its two execution controls
have deliberately different meanings:

- **Run** executes the current editor contents with the currently edited
  sample-input lines. It is a safe place to predict, change values, trigger an
  error, and inspect full output or traceback. A Run never changes room progress.
- **Check task** executes the current editor contents with the task's original,
  canonical input, regardless of what is currently typed in the sample-input
  panel. The output must match exactly and the source must satisfy the authored
  technique rules before the task is marked complete.

For example, a task can require the learner to read a value with `input()` and
convert it with `int()` before arithmetic. Visible requirement text explains that
goal. The source-rule pattern itself and any solution remain absent from the page.
Because the rules ship in client JavaScript, they are inspectable development aids,
not a secure grading boundary; Python execution and exact output remain part of
every Check.

**Reset** restores the authored starter and original input. **Copy** copies the
current source. `Shift + Enter` always performs **Run**, never **Check task**, so
keyboard experimentation cannot accidentally award completion.

## Editable lecture and lesson-note examples

Every lecture demonstration, and every lesson-note section that provides Python,
uses the same small classroom workspace:

- an editable Python area;
- a separate editable sample-input area;
- **Copy**, **Reset**, and **Run** controls;
- an input-context label that records which lines the run consumed;
- a terminal that shows standard output, error output, or the complete traceback;
- an accessible live status while the browser worker is running.

The Python area and sample input are both locked while a run is pending and are
unlocked afterward. Input prompts are echoed only for explicit classroom runs, so
the ordinary graded exercise runner keeps its existing exact-output contract.
Lecture demonstrations can also declare an expected output for authoring tests;
lesson-note experiments are ungraded and do not show a **Check task** control.

## Classroom data contract

[`public/content/class-materials.js`](../public/content/class-materials.js)
exports one deeply frozen entry for each course chapter through
`window.CLASS_MATERIALS`.

```js
{
  id,
  audience,
  prerequisites,
  estimatedMinutes,
  preparation,
  pageSummary,
  lessonPlan,
  lectureDemo: {
    title,
    setup,
    code,
    stdin: ["one line per input() call"],
    expectedOutput,
    teachingPoints,
    questions
  },
  roomTasks: [
    {
      id,
      kind: "answer",
      title,
      summary,
      explanation,
      prompt,
      acceptedAnswers,
      placeholder,
      hint,
      success
    },
    {
      id,
      kind: "code",
      title,
      summary,
      explanation,
      prompt,
      starterCode,
      stdin,
      expectedOutput,
      requirements,
      sourceRules,
      hint,
      success
    }
  ],
  classActivities,
  independentPractice,
  recapQuestions,
  homework: {
    brief,
    deliverables,
    selfReview
  },
  nextSteps
}
```

[`public/content/learning-content.js`](../public/content/learning-content.js)
lesson-note sections can additionally provide `exampleCode` and `sampleInput`.
The renderer derives stable `lesson-<item id>` workspace IDs so code and
sample-input drafts return to the correct example.

Authoring requirements:

- Keep every published material, room-task, and lesson-note ID stable.
- Make every class specific to its chapter; avoid boilerplate copied between entries.
- Keep each schedule at 90 minutes and exactly five lesson-plan blocks.
- Use a fresh lecture domain that does not resemble a repository exercise.
- Make every lecture demonstration executable, provide enough `stdin` lines for
  its `input()` calls, and keep `expectedOutput` synchronized with real stdout.
- Give code tasks incomplete starter code that compiles but does not already pass
  the technique contract.
- Keep task `stdin` deterministic. Treat it as the canonical Check fixture and
  make the displayed `expectedOutput` match its real stdout exactly.
- Phrase `requirements`, hints, pass feedback, and failure feedback as instruction;
  do not expose a solution or render source-rule patterns.
- Use source rules only for a small, visible learning objective. They are
  heuristic coaching, not an attempt to prove semantic correctness.
- Ask questions that require prediction or explanation, not recognition alone.
- End activities with evidence a teacher or peer can inspect.
- Treat homework as far transfer: a new context, a written model, tests, and self-review.
- Preserve the boundary between teaching the concept and disclosing an exercise implementation.

## Progress and draft persistence

[`public/features/classroom/class-page.js`](../public/features/classroom/class-page.js)
owns the documentation shell and embedded workspace markup.
[`public/app/course-app.js`](../public/app/course-app.js) supplies the runner,
answer checks, draft storage, progress, deep dives, runbooks, official references,
and navigation.

Room completions are stored in the existing per-chapter learning-progress set as
`room:<task id>`. They are idempotent and separate from passed exercise IDs, stars,
and timed-assessment scores. Running experimental code alone never creates a
completion marker.

Classroom code and sample-input drafts use the separate base storage key
`fp-playground.class-labs.v1`; account workspaces add their normal
`.user.<user id>` scope. Drafts are keyed by `<chapter id>/<lab id>`, saved after a
250 ms edit delay, and flushed immediately by a run. Default, unchanged content is
not stored, and Reset removes the saved override.

The classroom draft store is intentionally bounded:

| Value | Limit |
| --- | --- |
| Python source in one lab | 12,000 characters |
| Sample input in one lab | 2,000 characters |
| Parsed or merged lab entries | 160 |
| Combined UTF-8 source and input across labs | 64,000 bytes |

When the aggregate budget is exceeded, the oldest edited classroom drafts are
discarded first. Signed-in state serializes the same entries under
`classLabDrafts` in PostgreSQL `user_state`; current local entries win and missing
remote entries are added only while the classroom budget permits. Classroom drafts
never write `user_files` and never create canonical chapter `exNN.py` mirrors.

See [PERSISTENCE.md](PERSISTENCE.md) for workspace switching, account sync, and
upgrade behavior.

## Validation

Run:

```bash
npm run validate
npm run validate:browser
npm run validate:links
git diff --check
```

The classroom checks cover:

- all 12 chapters, 1,080 planned minutes, stable IDs, and deeply frozen content;
- complete preparation, schedules, activities, practice, recap, and homework;
- Python compilation, execution with authored input, and exact output for every
  lecture demonstration;
- room-task schema, the required Chapter 1 beginner topics, normalized answer
  uniqueness, non-passing starters, passing reference fixtures, and source-rule
  enforcement;
- isolation of classroom prompt echo from normal exercise execution;
- answer feedback and reload persistence without accepted-answer DOM metadata;
- editable lecture and lesson-note code/input, Reset, `Shift + Enter`, and
  Run-versus-Check behavior;
- pending-run input locking and responsive mobile layout;
- no reuse of repository solution lines or exercise prompt text;
- one class-page `h1`, stable scoped section IDs, router-safe contents controls,
  copy support, exercise handoff, and navigation fallbacks.
