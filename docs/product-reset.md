# Product reset — 0.3.0

This document records what the 0.3.0 reset is, why it exists, and how the
flagship product is scoped. It complements the review that drove the reset
(`docs/product-review.md`).

## The product

Truth Tools answers one question about a project-status artifact:

> Does this artifact have a reviewable evidence trail, or an obvious gap
> that should block publication?

It is a deterministic gate **after** evidence collection and **before**
publication. It is not a source connector and not an LLM judge.

## What changed

| Dimension | 0.2.x (legacy umbrella) | 0.3.0 (this branch) |
| --- | --- | --- |
| MCP surface | Nine tools across capture/timeline/program/rendering | Two tools: `truth.review`, `truth.doctor` |
| Review verdict | Single `readiness` value | `artifact_quality` (pass/needs_review/fail) and `program_health` (on_track/at_risk/blocked/unknown) |
| Source timestamps | `captured_at` (ambiguous) | `observed_at` + `source_updated_at` (ADR-0003) |
| Source references | Plain strings | Structured `{ "source_id": ... }` with deprecated string form (ADR-0004) |
| Evidence storage | Source bodies accepted by the workflow | Metadata only; raw bodies rejected |
| Contracts | Implicit shapes | JSON Schema Draft 2020-12 in `packages/contracts` (ADR-0001) |
| Demo | Web workflow, login-adjacent | Static no-login browser demo + integrated launch-readiness fixture |
| Evaluation | None | Hand-written + seeded-synthetic cases with metrics |
| Release | Manual | Tagged trusted publishing with provenance (ADR-0005) |

## The core correction this branch makes

The original 0.3 plan missed one distinction that this convergence fixes:
**artifact quality and program health are different axes.** A report with
perfect evidence can describe a blocked program, and a report with broken
evidence can describe an on-track program — in both cases the artifact tells
you something true. Conflating them (as a single `readiness` value did) made
the tool's headline output meaningless.

The flagship demo is built around the corrected pair:

- broken evidence → `fail` + `blocked` (you cannot trust the status);
- fixed evidence → `pass` + `blocked` (the evidence is trustworthy, and the
  blocker is now visible and actionable).

## What stayed out

Capture agents, timeline parsers, program reconciliation, exports, package
update orchestration, heuristic classification, and multi-call agent
choreography are not part of this product (ADRs 0001 and 0006). The optional
portfolio repositories that once wrapped the suite are absent; this repository
is the flagship on its own.

## Honest boundary

Truth Tools verifies citation integrity, timestamps, explicit
classifications, typed contradictions, and blockers/risks/unknowns inside the
supplied artifact. It does not prove that a source supports a claim, that a
URL is real, or that an upstream agent extracted the claim faithfully. The
evaluation harness measures the engine against its own specification; it does
not measure real-world effectiveness (see `docs/evaluation.md`).
