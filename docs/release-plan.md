# Truth Suite release history and final target plan

The published `0.4.0` coordinated patch set is historical: it came from the
old-generation exact lock. The final coordinated component target is
`capture-truth@0.5.1`, `timeline-truth@0.4.0`, and `program-truth@0.3.1`.
Those target component releases are not represented by the staged historical
lock until their exact committed refs are available.

## Historical release set and ownership

| Component | Version | Owner |
| --- | --- | --- |
| `capture-truth` | `0.4.1` | Capture maintainer |
| `timeline-truth` | `0.3.1` | Timeline maintainer |
| `program-truth` | `0.2.1` | Program maintainer |
| `truth-tools` | `0.4.0` (published old-generation lock) | Suite/release maintainer |

This is the historical set recorded by `suite-lock.json`; the lock remains
unchanged and must not be rewritten as part of planning.

## Planned final target set

| Component | Target version | Owner |
| --- | --- | --- |
| `capture-truth` | `0.5.1` | Capture maintainer |
| `timeline-truth` | `0.4.0` | Timeline maintainer |
| `program-truth` | `0.3.1` | Program maintainer |
| `truth-tools` | `0.4.0` workflow target | Suite/release maintainer |

The release verifier enforces the three component target versions in
`--release` mode. A historical lock therefore fails release mode by design.

## Release order and controls

For the published 0.4.0 history, components were released first, followed by
the flagship `truth-tools` package. Flagship CI and release workflows read
`suite-lock.json` and check out exact component SHAs. The checked-in refs
identify the old-generation released component commits. For the final target
set, the exact committed component refs and package versions must be verified
before the flagship is tagged.

The release gates confirmed all versions and changelogs, compatible
APIs and fixtures on the locked component commits, focused component checks and
pack dry-runs, and trusted npm publishing through GitHub Actions OIDC
(`id-token: write`, with no stored registry token).

## Flagship flow

The verified historical Truth Tools release commit was merged to `main`, passed
CI, and was tagged `v0.4.0`. Publishing the GitHub Release started the
`release.published` workflow, which checked the tag and package version, ran the
full gates and pack dry-runs, and published with npm provenance.

The planned flow is to complete and verify the final target component set,
update the exact suite lock in its release change, merge and tag the flagship,
then publish from that exact tag. Until those steps complete, the target set
remains planned rather than published.

## Stop conditions and verification

Stop without tagging, publishing, or advancing if a worktree is dirty, a
version/tag mismatches, a sibling API or fixture check fails, CI fails, a pack
dry-run contains unexpected files, the workflow resolves another commit, or
OIDC/provenance verification is unavailable. Correct the owning branch and
restart its gates.

Final flagship verification for the corrected release is `npm test`, `npm run check`,
`npm run contracts:verify`, `npm run demo`, `npm run demo:build`, both eval
commands, doctor, and root/contracts `npm pack --dry-run`, followed by
published-package and provenance checks. This history is not an executable
release mechanism; the workflows remain authoritative.

- **Planned post-release requirement:** once the final target release is
  published, consumers must use its exact package/tag and matching complete
  lock; never resume with the historical 0.4.0 old-generation lock or a
  floating sibling reference.
