# Resume wording

Resume bullets for Truth Tools. They are kept honest: they describe this
package's deterministic review and orchestration role, not suite-level intake,
compilation, synthesis, or proof claims. Each bullet is one line and can be
trimmed for space.

Truth Tools is an evidence-first technical-program reliability toolkit combining provenance-preserving evidence intake, defensible timeline compilation, agent-guided status synthesis, and deterministic pre-publication review.

## Lead bullet

> Designed and implemented Truth Tools, an open-source deterministic review
> gate for project-status artifacts: canonical JSON Schema Draft 2020-12
> contracts, a CLI and MCP interface (two tools: `truth.review`,
> `truth.doctor`), artifact-quality vs program-health verdicts, a static
> no-login browser demo with timeline-drift and freshness visualization, and
> a repeatable synthetic evaluation harness — all shipped with CI, trusted
> publishing, and 80+ automated tests.

The broader Truth Suite framing includes sibling/operator components for
provenance-preserving intake, timeline compilation, and agent-guided synthesis;
this package reviews and orchestrates their metadata-only outputs.

## Supporting bullets

- Reset a nine-tool umbrella product into one focused contract: canonical
  contracts in `packages/contracts` (Draft 2020-12, drift-verified),
  strict-field normalization, explicit claim classification, and a two-tool
  MCP surface.
- Separated two previously conflated verdicts — `artifact_quality`
  (pass/needs_review/fail) and `program_health` (on_track/at_risk/blocked/
  unknown) — with exact policies and independent CLI exit gates
  (`--fail-on`, `--fail-on-health`).
- Built an integrated launch-readiness showcase: a broken evidence pack
  (fail + blocked) and a fixed one (pass + blocked) prove that clean evidence
  does not fix a blocked program — it makes the blocker trustworthy.
- Shipped a static, responsive, accessible browser demo with no login and no
  telemetry, a deterministic timeline-drift diff, and freshness dimensions
  (`observed_at` vs `source_updated_at`).
- Added a repeatable evaluation harness: 30 hand-written policy cases plus a
  seeded synthetic generator reporting pass rate, per-dimension accuracy, and
  issue precision/recall.
- Released via trusted publishing with npm provenance and explicit package
  allowlists; documented the product reset, migration path, architecture,
  and six ADRs.

## Honesty note

Do not claim adoption, time savings, or that the tool prevents real-world
failures — none of that is measured. The evaluation harness measures the
engine against its own specification.
