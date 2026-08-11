# ADR-0001: Suite boundaries — what Truth Tools owns

- Status: accepted
- Date: 2026-08-11
- Applies to: repository layout and package boundaries

## Context

The pre-reset repository tried to own evidence capture, timeline parsing,
program reconciliation, exports, a web workflow, and nine MCP tools under one
package. That made the product hard to explain and hard for agents to call.

## Decision

The flagship repository is **multi-repository-first**. Truth Tools owns exactly
four things:

1. **Canonical contracts** — the JSON Schema Draft 2020-12 schemas in
   `packages/contracts/schemas/`, published as the dependency-free
   `truth-tools-contracts` npm package.
2. **Deterministic review** — the CLI, the `truth.review` / `truth.doctor`
   MCP surface, strict-field normalization, artifact quality, program health,
   and timeline drift.
3. **Demo** — the launch-readiness fixtures and the static, no-login,
   no-telemetry browser demo.
4. **Evaluation** — the hand-written and seeded-synthetic cases with
   repeatable metrics.

Everything else is explicitly **not** owned here: capture agents, source
adapters, timeline parsers, and program reconciliation tools live in their own
canonical packages or repositories (see ADR-0006).

## Consequences

- New feature requests that expand Truth Tools beyond contracts/review/demo/
  evaluation are rejected by default.
- Adjacent packages that need the canonical shapes import the contracts
  package or copy schemas with drift verification (ADR-0006).
- The public MCP surface stays at two tools.
