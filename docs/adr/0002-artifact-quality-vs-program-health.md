# ADR-0002: Artifact quality vs program health

- Status: accepted
- Date: 2026-08-11
- Applies to: review output contract and CLI exit gates

## Context

The pre-reset review returned a single `readiness` value (`ready` /
`needs_review` / `blocked`). That conflated two different questions: is the
evidence structure sound, and is the program doing well? The result was a
missing core correction in the 0.3 plan: a clean artifact with a blocker and a
broken artifact both said "blocked", which told the reader nothing about
which problem to fix.

## Decision

The review returns two independent dimensions:

- **`artifact_quality`** — `pass` | `needs_review` | `fail`:
  - `fail` when any blocking issue exists (unknown refs, missing timestamps,
    raw bodies, duplicates, unsupported fields/values, invalid dates, future
    sources, empty sources/claims) **or** any contradiction exists;
  - `needs_review` when no fail trigger exists but review-level issues exist
    (stale sources, incomplete contradiction keys, invalid URLs, invalid due
    dates, sources updated after `as_of`);
  - `pass` when no issues and no contradictions exist.
- **`program_health`** — `on_track` | `at_risk` | `blocked` | `unknown`:
  - `blocked` when at least one `blocker` claim exists;
  - `at_risk` when no blockers exist but a `risk` or `unknown` claim exists;
  - `on_track` when at least one `fact` exists and no blocker/risk/unknown;
  - `unknown` when no claim is kind-classified.

Contradictions are quality failures: an internally inconsistent artifact
cannot be trusted, even when the disagreement is honestly reported.

## Exit codes

Exit codes depend **only** on `artifact_quality`, plus optional explicit
health gates:

- `--fail-on fail` → 2 when `artifact_quality` is `fail`;
- `--fail-on needs_review` → 2 when `artifact_quality` is not `pass`;
- `--fail-on-health blocked` → 2 when `program_health` is `blocked`;
- `--fail-on-health at_risk` → 2 when `program_health` is not `on_track`.

Program health never changes the exit code by itself. A passing artifact with
a blocked program exits 0 unless `--fail-on-health` is given.

## Consequences

- The launch-readiness demo shows the corrected pair: broken evidence is
  `fail` + `blocked`; fixed evidence is `pass` + `blocked`.
- CI configurations that want "don't publish a broken artifact" use the
  quality gates; configurations that want "don't launch a blocked program"
  add the health gate.
