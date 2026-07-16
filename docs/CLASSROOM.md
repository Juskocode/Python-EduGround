# Classroom content and authoring guide

Each chapter route at `#chapter/<chapter id>/tutorials` is a complete, solution-free class rather than a loose collection of cards. The presentation borrows the useful teaching rhythm of the [Google Python Class](https://developers.google.com/edu/python)—summary-first notes, short examples, a stable course navigation, and an explicit exercise handoff—without copying its wording, branding, code, or visual chrome.

## Learner-facing class sequence

Every chapter uses the same predictable sequence:

1. **In this class** — audience, duration, format, summary, prerequisites, and preparation.
2. **Lesson plan** — five timed blocks totalling 90 minutes.
3. **Lecture demonstration** — independently authored Python, labelled expected output, teaching points, and prediction questions.
4. **Lesson notes** — the existing concept explanations, analogous examples, checks, takeaways, and common mistakes.
5. **Class activities** — collaborative tasks that end with inspectable evidence.
6. **Independent practice** — ordered transfer prompts completed without copying the lecture example.
7. **Deep dive** — mental model, execution trace, misconception clinic, guided practice, glossary, debugging reference, and checkpoint.
8. **Problem-solving runbook** — toolbox, coaching conversation, and evidence-driven five-phase workflow.
9. **Class recap and homework** — retrieval questions, deliverables, and a self-review checklist.
10. **Official reading and exercises** — authoritative Python references followed by the chapter exercise handoff.

The desktop presentation uses a course rail, a focused reading column, and an on-page contents rail. The navigation rails become native `<details>` disclosures on smaller screens. Contents controls are buttons rather than fragment links because the application already uses the URL hash for routing.

## Classroom data contract

`class-materials.js` exports one deeply frozen entry for each course chapter through `window.CLASS_MATERIALS`.

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
    expectedOutput,
    teachingPoints,
    questions
  },
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

Authoring requirements:

- Keep the stable material ID once published.
- Make every class specific to its chapter; avoid boilerplate copied between entries.
- Keep each schedule at 90 minutes and exactly five lesson-plan blocks.
- Use a fresh lecture domain that does not resemble a repository exercise.
- Make the demonstration executable and keep `expectedOutput` synchronized with its real stdout.
- Ask questions that require prediction or explanation, not recognition alone.
- End activities with evidence a teacher or peer can inspect.
- Treat homework as far transfer: a new context, a written model, tests, and self-review.
- Preserve the boundary between teaching the concept and disclosing an exercise implementation.

## Rendering and progress

`class-page.js` owns the documentation shell and accepts the existing learning components as DOM slots. `course-app.js` supplies:

- persistent class progress;
- four lesson-note sections;
- the chapter deep dive and concept clinic;
- the problem-solving runbook;
- official Python references;
- exercise, previous-class, and next-class routes.

The existing progress IDs remain stable. Reading material can be marked understood, but it never awards exercise stars or silently marks an exercise as passed.

## Validation

Run:

```bash
npm run validate
npm run validate:links
git diff --check
```

The classroom tests verify:

- exact coverage of all 11 chapters and 990 planned minutes;
- stable IDs and deeply frozen content;
- complete preparation, schedule, activity, practice, recap, and homework fields;
- Python compilation, execution, and exact labelled output for every lecture demonstration;
- no reuse of repository solution lines or exercise prompt text;
- one class-page `h1`, stable scoped section IDs, router-safe contents controls, copy support, exercise handoff, and navigation fallbacks.
