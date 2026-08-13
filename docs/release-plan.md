# Truth Suite release history and final target plan

The published `0.4.0` coordinated patch set is historical: it came from the
old-generation exact lock. The final coordinated component target is
`capture-truth@0.5.1`, `timeline-truth@0.4.0`, and `program-truth@0.3.1`.
Those component releases are represented below by their exact committed refs.

## Historical release set and ownership

| Component | Version | Owner |
| --- | --- | --- |
| `capture-truth` | `0.4.1` | Capture maintainer |
| `timeline-truth` | `0.3.1` | Timeline maintainer |
| `program-truth` | `0.2.1` | Program maintainer |
| `truth-tools` | `0.4.0` (published old-generation lock) | Suite/release maintainer |

This historical set remains recorded at tag `v0.4.0` and commit
`e558a5b607e8be220f2dba44d27829c1d8183277`. The current `suite-lock.json`
now records the corrected 0.4.1 target set; no historical tag was moved.

## Final component release set

| Component | Target version | Owner |
| --- | --- | --- |
| `capture-truth` | `0.5.1` | Capture maintainer |
| `timeline-truth` | `0.4.0` | Timeline maintainer |
| `program-truth` | `0.3.1` | Program maintainer |
| `truth-tools` | `0.4.1` release candidate | Suite/release maintainer |

The release verifier enforces the three component release versions in
`--release` mode.

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

The component releases are complete. The remaining flow is to verify the exact
suite lock, merge and tag the flagship, then publish from that exact tag. Until
those Truth Tools steps complete, the flagship remains unpublished.

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

- **Post-release requirement:** once the final target release is
  published, consumers must use its exact package/tag and matching complete
  lock; never resume with the historical 0.4.0 old-generation lock or a
  floating sibling reference.
