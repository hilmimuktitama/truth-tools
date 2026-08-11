# ADR-0005: Release provenance and trusted publishing

- Status: accepted
- Date: 2026-08-11
- Applies to: release workflow and npm publishing

## Context

Releases should be auditable: the artifact a consumer installs should be
provably built from the tagged source. Manual token-based publishing from a
laptop is neither auditable nor transferable.

## Decision

- Releases are cut from tags (`v*`) by the GitHub Actions workflow
  `.github/workflows/release.yml` using **trusted publishing**: `npm publish
  --provenance --access public` with OIDC. No registry token is stored in
  the repository or passed to npm.
- The workflow runs the full verification gate (`npm ci`, `npm test`, `npm
  run check`, `npm run contracts:verify`, and both root and private-workspace
  `npm pack --dry-run` checks) before publishing `truth-tools`.
- Only `truth-tools` is published. The private `packages/contracts` workspace
  has an explicit `files` allowlist — never a deny list — and is validation-only.
- Every release gets a CHANGELOG entry and a `vX.Y.Z` tag created by the
  maintainer; publishing a version requires the tag to exist.

## Consequences

- Consumers can verify provenance via `npm view truth-tools dist.tarball`
  plus the published attestations (see `docs/release-process.md`).
- Publishing from a developer laptop is not a supported path.
