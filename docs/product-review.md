# Product and Code Review Behind Truth Tools 0.3

This review is based on pre-reset repository commit `c8fade8bd7cdc1d0100c260597029f7fc82a47f3`, from the `0.1.x` repository line. npm `0.2.0` kept the same umbrella-product direction.

## Verdict

The problem is real: project updates routinely hide stale evidence, conflicting dates, unresolved blockers, and unsupported confidence. The repository was weak as a product because it tried to package several adjacent products under one name.

The old version combined evidence capture, timeline parsing, program reconciliation, rendering, update checks, a web workflow, and nine MCP tools. That made it hard to explain, hard for an agent to call correctly, and hard to demonstrate in one minute. For a portfolio project, unproven breadth is not impressive. It reads as unfinished architecture.

## Post-review correction (prepared current source)

The first 0.3 simplification kept one flaw from the legacy line: a single
`readiness` value that mixed evidence quality with program state. This
convergence corrects it — see ADR-0002. The review now returns two
independent dimensions:

- `artifact_quality` (pass / needs_review / fail): the structure of the
  supplied evidence, including contradictions;
- `program_health` (on_track / at_risk / blocked / unknown): the state the
  claims report.

Exit codes depend on `artifact_quality` only, via `--fail-on fail` /
`--fail-on needs_review`; program health requires an explicit
`--fail-on-health blocked` / `--fail-on-health at_risk` gate. The flagship
demo is built on the corrected pair: broken evidence is fail + blocked,
fixed evidence is pass + blocked.

## Findings

### P0 — No single user job

The MCP server exposed nine tools across capture, timeline, program, rendering, full-run orchestration, and diagnostics. A user had to understand the repository’s internal package boundaries before getting value.

**Why it matters:** a reviewer should understand the product after one sentence and one command.

**Decision:** reduce the public MCP surface to `truth.review` and `truth.doctor`.

### P0 — Claim classification was not trustworthy enough

The program reconciliation path partly classified claims by matching words such as `blocked`, `risk`, `unknown`, `tbc`, or `missing`. A sentence that did not match those words could fall through as a confirmed fact.

**Why it matters:** wording is not evidence. A tool named Truth Tools cannot turn the absence of a risk keyword into confirmation.

**Decision:** require every claim to declare `fact`, `blocker`, `risk`, or `unknown`. The engine never infers the class from prose.

### P1 — Correctness depended on agent choreography

The old workflow required multiple calls and intermediate artifacts. Each step created another chance to skip validation, pass the wrong shape, or publish the wrong output.

**Decision:** accept one structured artifact and return one result containing both machine-readable findings and a human-readable review.

### P1 — The privacy boundary was too easy to misunderstand

The full workflow could write source bodies into a local `raw-local` output area while separately producing repo-safe exports.

**Why it matters:** “local-only” is a directory convention, not a hard safety control. A user can still commit, upload, or attach the wrong output.

**Decision:** reject raw body fields in the portable review contract. Source bodies stay in Jira, Confluence, meeting-note systems, or other systems of record.

### P1 — Package ownership overlapped

Truth Tools wrapped adjacent packages while those packages also exposed similar CLI/MCP entry points and moved at different release speeds.

**Why it matters:** users cannot tell which package owns the workflow, and maintainers inherit dependency drift and duplicate command surfaces.

**Decision:** Truth Tools owns only evidence-structure review. Capture and source-specific parsing belong in adapters or their existing packages.

### P2 — The repository demonstrated architecture better than utility

The old README documented many commands and internals, but it lacked a compact case study, checked-in result, and CI-enforceable example proving the core job.

**Decision:** ship one deliberately broken launch example, its generated Markdown report, automated tests, a portfolio case study, and CI readiness gates.

## What version 0.3 keeps

- explicit source references;
- evidence-age policy;
- conflicts and unknowns as first-class findings;
- Markdown output for humans;
- JSON output for automation;
- a small MCP interface for agents.

## What version 0.3 removes

- source-body ingestion;
- timeline parsing;
- program compilation;
- web-server workflow;
- package update orchestration;
- heuristic fact classification;
- multi-call agent choreography.

Those capabilities are not inherently bad. They are removed because they obscure the one job this repository can credibly own.

## Honest product boundary

Truth Tools does not prove truth. It validates the structure of a supplied status artifact:

- cited source IDs exist;
- evidence timestamps are usable and current enough;
- typed claims do not contradict each other;
- blockers, risks, and unknowns remain visible;
- raw source bodies are not embedded in the portable artifact.

It cannot prove that a URL supports the claim, that the source itself is correct, or that an upstream agent extracted the claim faithfully. Calling out that boundary is part of the product, not a disclaimer to hide after the demo.

## Next proof, in order

Do not add another generic command. Prove the narrow workflow first:

1. run at least five anonymized real status artifacts through it;
2. record missed findings and false positives;
3. add one source adapter only after a repeated manual pattern appears;
4. publish the synthetic evaluation results and examples;
5. claim adoption or time savings only after measuring them.
