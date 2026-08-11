# ADR-0006: Standalone package ownership

- Status: accepted
- Date: 2026-08-11
- Applies to: packages outside this repository and copied artifacts

## Context

The reset removed capture and timeline functionality from Truth Tools, but
the flagship still needs to demonstrate and test the boundaries between
review and capture. Downstream packages (capture agents, timeline parsers)
remain canonical owners of their own code.

## Decision

- Capture and timeline tooling remain **canonical standalone packages** in
  their own repositories; Truth Tools does not fork or wrap them, and adds no
  public capture/timeline binaries to this package.
- Where this repository needs the canonical shapes of those packages (for
  example timeline-item records), it either depends on their published
  contracts or keeps **copied/generated schemas** that are verified for drift
  by automation.
- The verified copies in this repository are `packages/contracts/schemas/`
  (owned by Truth Tools itself) and the launch-readiness fixtures
  (`examples/launch-readiness/`) whose generated outputs are regenerated and
  compared by `npm run demo` — a failed comparison is a failed build.
- The contracts workspace is private and ships only through the root
  `truth-tools` package; it is never published as a second npm package.
- Optional portfolio repositories that would wrap the suite are **absent**:
  no meta-repository, no umbrella package, no combined CLI.

## Consequences

- Any drift between copied schemas/fixtures and their generators fails CI,
  which keeps the copies honest without a runtime dependency.
- The package allowlist for `truth-tools` excludes any capture/timeline code;
  `npm pack --dry-run` is part of the release gate to enforce it.
