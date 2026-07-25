# Contributing to Python EduGround

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The repository is
organized by runtime boundary, then by feature or domain.

## Before editing

```bash
npm ci
npm run validate
```

Use Node.js `22.23.1` through Node 26. Keep unrelated local changes intact and
make focused commits whose message explains one coherent change.

## Choose the correct home

- Browser-downloadable code or content: `public/`
- Cross-feature browser orchestration: `public/app/`
- One page or interaction: `public/features/<feature>/`
- Shared styles: `public/styles/`
- Server code: `src/server/<domain>/`
- Private reference solutions: `curriculum/solutions/`
- Database schema or grants: `database/`
- Maintainer tooling: `scripts/<purpose>/`
- Automated checks: `tests/<level>/`
- Product, operator, or security guidance: `docs/`

Do not add implementation files at repository root. New server contracts should
use strict `.ts`; existing server `.js` modules are compiled through the same
NodeNext lane while they migrate incrementally. Browser code remains ordered
classic `.js` until a feature has an explicit TypeScript output design.

## Protect the learning boundary

- Never load a Python reference solution or private solution bundle in the
  browser.
- Keep public starters incomplete and solution-free.
- Do not render hidden-test inputs before the complete suite returns.
- Preserve chapter IDs, exercise IDs, routes, storage keys, API paths, migration
  checksums, and canonical `PyXX.../exNN.py` submission names.
- Treat client-side source-shape checks and assessment answers as educational
  guidance, not secure grading.

After changing a Python reference implementation:

```bash
npm run build:solutions
npm run build:starters
npm run validate:content
```

Review the public starter diff for answer leakage.

## Validate the change

All changes:

```bash
npm run validate
git diff --check
```

`npm run validate` type-checks and compiles the server before testing the emitted
`dist/server` artifact.

Browser UI or interaction changes:

```bash
npm run validate:browser
```

Database, migration, account-state, or submission-file changes:

```bash
export TEST_DATABASE_URL='postgresql://eduground_test:test-only@127.0.0.1:5432/eduground_test'
npm run validate:integration
```

External documentation-link changes can also use:

```bash
npm run validate:links
```

## Pull requests

A reviewable pull request should include:

- the learner or operator outcome;
- the boundary changed and why that location is correct;
- compatibility or migration impact;
- exact validation performed;
- screenshots for material UI changes;
- security implications for auth, public files, learner data, tests, or solutions.

See [docs/SECURE_SDLC.md](docs/SECURE_SDLC.md) for release gates and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.
