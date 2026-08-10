# Truth Tools — Portfolio Case Study

## Summary

Truth Tools is a deterministic CLI and MCP review gate for generated project-status artifacts. It checks citation integrity, source age, internal contradictions, blockers, risks, and unknowns before an update is published.

## Problem

Cross-team updates often flatten conflicting evidence into one confident status. A tracker names one date, a decision log names another, and an unresolved blocker disappears from the leadership summary.

The original repository also tried to solve too many adjacent jobs at once: evidence capture, timeline parsing, program reconciliation, exports, a web workflow, and nine MCP tools. That breadth made the product hard to explain and easy for an agent to misuse.

## Product reset

The new version answers one narrower question:

> Does this status artifact have a reviewable evidence trail, or an obvious gap that should block publication?

| Before | After |
| --- | --- |
| Nine MCP tools and several intermediate artifacts | Two MCP tools: `truth.review` and `truth.doctor` |
| Claim type partly inferred from wording | Explicit `fact`, `blocker`, `risk`, or `unknown` |
| Raw source bodies accepted by the workflow | Portable input rejects raw source bodies |
| Mostly report generation | Markdown/JSON reports plus CI exit gates |
| Umbrella package for adjacent projects | One evidence-review contract |

The core is deliberately deterministic. Claims with the same `subject` and different typed `value` fields become a conflict; the tool reports the disagreement instead of choosing a convenient answer.

## Workflow

```text
source systems
      |
      v
agent / adapter structures claims and source metadata
      |
      v
truth.review
      |
      +---- ready
      +---- needs_review
      +---- blocked
```

Truth Tools is not the source connector and not an LLM judge. It is the small validation layer after collection and before publication.

## Demo

```bash
npm install
npm run example
```

The checked-in example returns `blocked` because two source records disagree about `launch.date` and the rollback decision has no accountable owner. See the [generated report](../examples/product-launch-report.md).

Use the same contract in CI:

```bash
truth-tools review \
  --input generated/status.json \
  --format json \
  --fail-on needs_review
```

## Engineering decisions

- **One contract across CLI and MCP.** An agent makes one review call instead of orchestrating low-level steps.
- **Reproducible time boundary.** `as_of` is required, and ambiguous or timezone-free dates are rejected.
- **Typed contradiction keys.** `1` and `"1"` remain different; object and null values are rejected rather than guessed.
- **Metadata-only source records.** Raw Jira, Confluence, meeting-note, and customer bodies stay in their systems of record.
- **Strict contracts.** Unsupported fields block the review instead of being silently dropped by the CLI while MCP rejects them.
- **Explicit uncertainty.** Risks and unknowns cannot silently become facts because of sentence wording.
- **Honest trust boundary.** The tool validates the supplied artifact; it does not fetch sources or prove semantic support.

## Validation

The automated suite covers the deterministic review engine, CLI behavior, committed example output, MCP result shape, and an end-to-end MCP stdio call. GitHub Actions performs a clean dependency install, runs the full suite, checks syntax, exercises the documented blocked example, and validates the npm package contents.

## Resume wording

> Designed and implemented Truth Tools, an open-source CLI and MCP validation gate for generated project-status artifacts, reducing a nine-tool agent workflow to one deterministic contract with citation checks, typed contradiction detection, Markdown/JSON reporting, automated tests, and CI readiness gates.

## Limits and next proof

The input claims must already be structured, contradiction matching is exact rather than semantic, and the project has no external-adoption metric yet. The next useful proof is to run anonymized real status reports, measure missed findings and false positives, then add one adapter for a real source format. Adding more generic commands would be avoidance, not progress.
