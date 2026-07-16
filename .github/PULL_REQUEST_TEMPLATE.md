## Summary

<!-- What changes for learners, operators, or maintainers? -->

## Risk and rollback

<!-- Name the highest-risk path and the smallest safe rollback. -->

- Risk level: low / medium / high
- Data or migration impact: none / describe
- Rollback: revert / feature disablement / describe

## Evidence

<!-- Include commands, results, screenshots, or API responses. -->

- [ ] `npm run validate`
- [ ] `node --check python-runner-worker.mjs`
- [ ] PostgreSQL integration test, when persistence or API behavior changes
- [ ] `npm run validate:links`, when curated external references change
- [ ] Responsive light/dark screenshots, when UI behavior changes

## Secure delivery checklist

Delete items that genuinely do not apply and explain why.

- [ ] No credentials, tokens, learner data, or production values are committed.
- [ ] New dependencies are necessary, pinned in the lockfile, and reviewed for provenance and maintenance.
- [ ] Public assets contain no repository solutions, hidden answers, or server-only implementation details.
- [ ] Authentication, authorization, input limits, filesystem boundaries, and error disclosure were considered.
- [ ] Database migrations are additive, ordered, checksum-safe, and tested against an upgrade path.
- [ ] Logs and diagnostics avoid passwords, session tokens, submitted code, and personal data.
- [ ] The change has an observable health signal and a documented rollback.

## Related work

Closes #
