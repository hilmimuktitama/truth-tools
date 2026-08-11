# Truth Suite release plan

This is a coordination plan only: no releases, tags, publishes, or workflow
actions have been executed.

## Release set and ownership

| Component | Version | Owner |
| --- | --- | --- |
| `capture-truth` | `0.5.0` | Capture maintainer |
| `timeline-truth` | `0.3.0` | Timeline maintainer |
| `program-truth` | `0.2.0` | Program maintainer |
| `truth-tools` | `0.3.0` | Suite/release maintainer |

`capture-truth@0.5.0` is the rewrite release and supersedes the proposed
`0.4` line. Each component owner owns its changelog, version, tests, tag, and
published-package verification. The suite maintainer coordinates shared
fixtures, order, and final verification.

## Order and preconditions

Release components first, then the flagship `truth-tools` package. Flagship CI
checks the components' default branches, so compatible component changes must
be merged there before the flagship release commit is merged. The Capture
owner must first confirm that the `capture-truth` rewrite is prepared from a
clean working tree; do not release from a dirty worktree.

Before tagging or publishing, confirm all versions and changelogs, compatible
APIs and fixtures on component default branches, focused component checks and
pack dry-runs, and trusted npm publishing through GitHub Actions OIDC
(`id-token: write`, with no stored registry token).

## Flagship flow

Merge the verified `truth-tools` release commit to `main`, wait for CI, tag that
exact commit as `v0.3.0`, and create the GitHub Release from that tag. Publishing
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
published-package and provenance checks. No actions are executed by this plan.
