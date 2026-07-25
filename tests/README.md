# Test organization

The test tree mirrors the runtime boundary being exercised. Keep executable tests
directly inside their layer so the package scripts and CI discover every test
without a second configuration list.

| Layer | Location | Required suffix | Purpose |
| --- | --- | --- | --- |
| Browser journey | `tests/e2e/` | `.spec.js` | Chromium behavior, responsive layout, and accessibility |
| PostgreSQL integration | `tests/integration/` | `.integration.js` | Behavior that needs a real isolated database |
| Browser unit | `tests/unit/client/` | `.test.js` | Pure models and classic-script browser contracts |
| Server unit | `tests/unit/server/` | `.test.js` | HTTP, persistence, curriculum, RAG, and security contracts |

Reusable helpers and fixtures belong in a `support/` directory immediately below
their layer, for example `tests/e2e/support/`. Support files are not tests and
must not use a test suffix. JavaScript, JSON, SQL, and text fixtures are allowed
there.

Tests must not write reports, screenshots, traces, temporary databases, or
compiled output into this tree. Playwright evidence belongs in
`artifacts/playwright/`; compiled server files belong in `dist/`. Both locations
are generated, Git-ignored, and removed by `npm run clean`.

Run the smallest relevant gate while iterating:

```bash
npm run validate:unit
npm run validate:integration
npm run validate:browser
```

Before handing off any change, run:

```bash
npm run validate
git diff --check
```
