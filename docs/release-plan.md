# Truth Suite release plan

This is the current prepared `0.3.1` patch source and release history. It is
not published until the exact release tag and trusted workflow gates pass.

## Release set and ownership

| Component | Version | Owner |
| --- | --- | --- |
| `capture-truth` | `0.4.1` | Capture maintainer |
| `timeline-truth` | `0.3.1` | Timeline maintainer |
| `program-truth` | `0.2.1` | Program maintainer |
| `truth-tools` | `0.3.1` | Suite/release maintainer |

`capture-truth@0.4.1` provides evidence-pack intake and normalized, deterministic
capture output; it is not a truth linter. Each component owner owns its changelog, version, tests, tag, and
published-package verification. The suite maintainer coordinates shared
fixtures, order, and final verification.

## Order and preconditions

Release components first, then the flagship `truth-tools` package. Flagship CI
and release workflows read `suite-lock.json` and check out exact component
SHAs. The checked-in refs identify the reviewed component patch commits; before
release, verify those same commits are merged and released without modification.

Before tagging or publishing, confirm all versions and changelogs, compatible
APIs and fixtures on the locked component commits, focused component checks and
pack dry-runs, and trusted npm publishing through GitHub Actions OIDC
(`id-token: write`, with no stored registry token).

## Flagship flow

Merge the verified `truth-tools` release commit to `main`, wait for CI, tag that
exact commit as `v0.3.1`, and create the GitHub Release from that tag. Publishing
the release starts the `release.published` workflow, which checks the tag and
package version, runs the full gates and pack dry-runs, and publishes with npm
provenance. Verify the published package and provenance afterward.

## Stop conditions and verification

Stop without tagging, publishing, or advancing if a worktree is dirty, a
version/tag mismatches, a sibling API or fixture check fails, CI fails, a pack
dry-run contains unexpected files, the workflow resolves another commit, or
OIDC/provenance verification is unavailable. Correct the owning branch and
restart its gates.

Final flagship verification is `npm test`, `npm run check`,
`npm run contracts:verify`, `npm run demo`, `npm run demo:build`, both eval
commands, doctor, and root/contracts `npm pack --dry-run`, followed by
published-package and provenance checks. This plan does not itself publish.
