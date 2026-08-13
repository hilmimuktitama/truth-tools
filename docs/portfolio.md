# Truth Tools — Portfolio Case Study

## Summary

Truth Tools is the deterministic review and orchestration component for
generated project-status artifacts. It verifies citation integrity, source freshness, typed
contradictions, and explicit blockers/risks/unknowns — then reports two
independent verdicts: **artifact quality** (pass/needs_review/fail) and
**program health** (on_track/at_risk/blocked/unknown). CLI, MCP, canonical
 JSON Schema contracts, a static demo, and a repeatable evaluation harness all
 use the same core.

Truth Tools is an evidence-first technical-program reliability toolkit combining provenance-preserving evidence intake, defensible timeline compilation, agent-guided status synthesis, and deterministic pre-publication review.

That sentence frames the wider Truth Suite: sibling/operator components provide
evidence intake, timeline compilation, and agent-guided synthesis; Truth Tools
owns the metadata-only review boundary and orchestration of those outputs.

## Problem

Cross-team updates flatten conflicting evidence into one confident status: a
tracker names one date, a decision log names another, and an unresolved
blocker disappears from the leadership summary. The original repository
tried to solve too many jobs at once — capture, timeline parsing, program
reconciliation, exports, a web workflow, and nine MCP tools — which made it
hard to explain and easy for an agent to misuse.

The 0.3 plan had one further flaw, which this convergence corrects: it kept a
single `readiness` value that mixed "is the evidence sound?" with "is the
program OK?". A clean artifact with a blocker and a broken artifact both said
"blocked", which tells you nothing about which problem to fix.

## Product reset

The new version answers one narrower question:

> Does this status artifact have a reviewable evidence trail, or an obvious
> gap that should block publication?

| Before | After |
| --- | --- |
| Nine MCP tools and several intermediate artifacts | Two MCP tools: `truth.review` and `truth.doctor` |
| Claim type partly inferred from wording | Explicit `fact`, `blocker`, `risk`, `unknown` |
| Raw source bodies accepted by the workflow | Portable input rejects raw source bodies |
| Single `readiness` verdict | `artifact_quality` and `program_health` as independent dimensions |
| `captured_at` with ambiguous meaning | `observed_at` + `source_updated_at` (ADR-0003) |
| String source refs | Structured `{ "source_id": ... }` refs with deprecated string form (ADR-0004) |
| Implicit shapes | Canonical JSON Schema Draft 2020-12 contracts, drift-verified (ADR-0001) |
| Web workflow | Static no-login, no-telemetry browser demo |
| No evaluation | Hand-written + seeded-synthetic cases with metrics |

## The corrected core

The flagship demo is built on the corrected pair:

- **broken evidence** → `artifact_quality: fail` + `program_health: blocked` —
  raw Jira body embedded, a missing `observed_at`, a stale snapshot, two
  sources contradicting `launch.date`, and an ownerless rollback blocker;
- **fixed evidence** → `artifact_quality: pass` + `program_health: blocked` —
  metadata only, every source timestamped, the launch date reconciled, the
  blocker cited with an owner and due date.

Fixing the evidence did not fix the program; it made the blocker visible and
trustworthy. That distinction is the product.

## Workflow

```text
source systems
      |
      v
capture agent / adapter (canonical standalone packages, not here)
      |
      v
StatusArtifact (validated against status-artifact.schema.json)
      |
      v
truth.review  (same core for CLI and MCP)
      |
      +---- artifact_quality: pass | needs_review | fail
      +---- program_health:   on_track | at_risk | blocked | unknown
      +---- Markdown report for humans, JSON for automation
      +---- exit codes for CI (quality gates; explicit health gates)
```

## Demo

```bash
npm install
npm run demo        # verify every generated output against the engine
npm run demo:dev    # static browser demo at http://127.0.0.1:4173/
```

The demo toggles broken vs fixed evidence and shows freshness dimensions
(observation age, content age, and source-update snapshot gaps), claim categories,
conflicts, recommended actions, and timeline drift (the launch moved from
August 17 to August 20, the load test slipped, a rollback-owner item was
added — drift is reported, never judged). It is responsive, keyboard- and
screen-reader-friendly, and makes no network requests.

CI usage:

```bash
truth-tools review --input status.json --fail-on needs_review          # quality gate
truth-tools review --input status.json --fail-on-health blocked        # health gate
```

## Engineering decisions

- **One contract across CLI and MCP.** An agent makes one review call, not
  nine choreographed steps.
- **Two verdicts, exact policies (ADR-0002).** Quality fails on blocking
  issues or contradictions; health comes from claim kinds. Exit codes depend
  only on quality unless `--fail-on-health` is passed.
- **Reproducible time boundary.** `as_of` is required; ambiguous or
  timezone-free dates are rejected.
- **Freshness split (ADR-0003).** Observation age, content age, and snapshot gap;
  `captured_at` is a tolerated, flagged deprecation.
- **Typed contradiction keys.** `1` and `"1"` remain different; object and
  null values are rejected rather than guessed.
- **Metadata-only source records.** Raw bodies stay in their systems of
  record; the contract rejects them.
- **Strict contracts.** Unsupported fields block the review instead of being
  silently dropped; unnormalizable entities are omitted from output and
  reported with their input location.
- **Compatibility without silence.** Legacy `captured_at`, `sourceId`, and
  string refs normalize and produce explicit deprecation findings.
- **Drift verification everywhere.** Contract parity, generated reports,
  demo data, and `dist/` are all re-verified by automation.

## Validation

The suite (80+ tests) covers the review engine, exact exit-code policy, CLI
behavior, MCP shapes and a real stdio round-trip, schema conformance of
engine output (including failing artifacts), timeline drift, demo fixtures,
and evaluation repeatability. `npm run contracts:verify` checks schema
parity and conformance; `npm run demo` fails on any drift between the engine
and checked-in outputs; `npm run eval` reports 100% pass rate on the policy
matrix plus seeded synthetic cases. CI runs all of it, then `npm pack
--dry-run` enforces the package allowlist.

## Resume wording

See `docs/resume.md` for copy-ready bullets. The honest frame: the tool
verifies artifact structure deterministically; it does not prove truth or
measure real-world effectiveness.

## Limits and next proof

Input claims must already be structured; contradiction matching is exact
rather than semantic; and there is no external-adoption metric. The next
useful proof is running anonymized real status reports through the harness,
labeling misses and false positives with a second labeler, then adding one
adapter for a real source format. Adding more generic commands would be
avoidance, not progress.
