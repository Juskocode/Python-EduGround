# Secure delivery configuration

The repository contains the reviewable workflow definitions, but GitHub repository
settings must enforce them. Apply this checklist before treating `main` as a
production-ready release branch.

## Required repository settings

1. Protect `main` with a ruleset that requires pull requests, one approving review,
   CODEOWNER review, resolved conversations, and a linear history.
2. Require branches to be current before merge and require these checks:
   - `CI / Offline validation (Node 22.23.1)`
   - `CI / Offline validation (Node 24.18.0)`
   - `CI / PostgreSQL integration`
   - `CI / Compose secure-stack integration`
   - `Supply-chain security / Dependency review`
   - `Supply-chain security / npm audit`
   - `CodeQL / Analyze (actions)`
   - `CodeQL / Analyze (javascript-typescript)`
   - `Container security / Build, smoke, and scan`
3. Do not require `Documentation links / Check external learning links`. It is a
   scheduled network monitor rather than a deterministic merge gate.
4. Set the default `GITHUB_TOKEN` permission to read-only. Do not allow Actions to
   create or approve pull requests unless a reviewed workflow explicitly needs it.
5. Restrict allowed actions to GitHub-owned actions plus the SHA-pinned Trivy action,
   and require full-length commit SHA references.
6. Enable the dependency graph, Dependabot alerts, Dependabot security updates,
   secret scanning, push protection, and private vulnerability reporting.
7. Use the checked-in CodeQL workflow as advanced setup; do not leave a competing
   default-setup CodeQL configuration enabled.
8. Prevent force pushes and branch deletion on `main`. Include administrators in
   the ruleset after confirming the emergency recovery path.

## Environments and releases

`Release container` is manual and defaults to validation only. Selecting `publish`
promotes the already validated image to GHCR only after its `production` environment
job is approved. Publication must be dispatched from the matching `vX.Y.Z` Git tag,
refuses to overwrite existing version or full commit-SHA image tags, publishes
provenance, and never deploys the image.

Before enabling publication:

1. Create the `production` GitHub Environment.
2. Require at least one reviewer, prevent self-review, and restrict deployment
   branches/tags to protected release tags matching the repository's `vX.Y.Z`
   convention.
3. Scope future deployment secrets to that environment, never to ordinary
   pull-request jobs. GHCR publication itself uses the short-lived `GITHUB_TOKEN`.
4. Keep the release image artifact retention short. Its scan evidence and SBOM have
   a longer but bounded retention period.
5. Verify the published image attestation before any downstream deployment.
6. Keep migrations as an explicit downstream release step with a tested backup and
   rollback plan. Never make `docker compose down -v` part of an upgrade.

## Operating rhythm

- Triage Dependabot and code-scanning alerts weekly.
- Review action SHA updates as supply-chain changes, not routine formatting.
- Investigate scheduled container-scan failures even when application code did not
  change; the base image or vulnerability database may have changed.
- Exercise PostgreSQL backup and restore before a release that changes persistence.
- Review public static assets for answer leakage whenever exercises, starters,
  hidden tests, or server allowlists change.
