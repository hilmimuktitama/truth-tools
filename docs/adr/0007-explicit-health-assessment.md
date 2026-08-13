# ADR 0007: Explicit health assessment

- Status: accepted
- Date: 2026-08-13
- Applies to: StatusArtifact v2 input, TruthReview v2 output, review behavior,
  and CLI health gates

## Context

The old single `readiness` value conflated evidence quality with the state of
the program. That made `blocked` ambiguous: it could mean an untrustworthy
artifact or a trustworthy artifact that honestly reported an unresolved
blocker. Facts alone also cannot establish that a program is on track.

## Decision

StatusArtifact v2 requires an explicit, accountable `health_assessment` with
`state`, `owner`, `rationale`, and at least one canonical `source_refs` entry.
The assessment is reported evidence supplied by an owner; Truth Tools does not
independently determine or prove real-world program health.

TruthReview keeps four related but distinct values:

1. `reported_program_health` is the supplied assessment state, or `null` when
   the assessment is missing or unusable.
2. `claim_health_floor` is derived only from active claims: `blocked` for an
   active blocker, `at_risk` for an active risk or unknown when no blocker
   exists, and `none` otherwise. Superseded and historical claims do not affect
   this floor.
3. `program_health` resolves to `blocked` for a blocked floor or reported
   blocked state; otherwise `at_risk` for an at-risk floor; otherwise it is
   `on_track` only when an active fact exists and the reported state is
   `on_track`; all remaining cases are `unknown`.
4. `health_consistency` records whether the report is `consistent`, `missing`,
   `understated`, `unsupported`, or `conflicting`.

An active blocker reported as `on_track` or `at_risk` is a blocking health
conflict and makes `artifact_quality` fail. Understated, unsupported, or
missing assessments are review findings unless another blocking issue exists.
Health does not alter CLI exit status unless an explicit `--fail-on-health`
gate is requested.

## Consequences

- A fixed evidence artifact can correctly be `pass` quality and `blocked`
  health; fixing evidence does not fix the program.
- Consumers can gate publication on artifact quality and launch decisions on
  health independently.
- Every v2 artifact carries accountable health context, while missing or
  unsupported context remains visible instead of being guessed.

## Alternatives considered

- Keep one `readiness` field: rejected because it hides whether evidence or the
  program needs attention.
- Infer health from claim wording or facts: rejected because prose and absence
  of keywords are not accountable health evidence.
- Make every health concern a quality failure: rejected because a trustworthy
  report may accurately describe an at-risk or blocked program.
