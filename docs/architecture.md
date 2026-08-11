# Architecture

Truth Tools is a deterministic evidence gate for project-status artifacts.
This document describes the components, the data flow, and the boundaries of
the repository.

## Repo layout

```text
bin/truth-tools.js          CLI entry point (exit code 0/1/2)
src/
  cli.js                    argument parsing, gates, I/O
  review.js                 review orchestration, quality/health, conflicts
  normalize.js              strict-field normalization and compatibility forms
  contracts.js              Ajv 2020-12 validation over the contracts package
  report.js                 Markdown rendering (escaped, single-line fields)
  mcp-server.js             MCP stdio server (binary truth-tools-mcp)
  mcp-tools.js              truth.review / truth.doctor tool definitions
  timeline-diff.js          deterministic timeline drift + drift Markdown
packages/contracts/         canonical JSON Schema Draft 2020-12 contracts
  schemas/                  source, source-ref, candidate-claim, claim,
                            timeline-item, status-artifact, truth-review
  index.js                  dependency-free schema loader
scripts/
  contracts-verify.js       schema + engine conformance and parity checks
  demo.js                   generate/verify launch-readiness outputs, demo data
  demo-build.js             copy apps/demo -> apps/demo/dist
  demo-dev.js               local static server (127.0.0.1, no telemetry)
  eval.js                   evaluation runner + seeded synthetic generator
examples/
  product-launch.json       committed broken example (fail + blocked)
  launch-readiness/         integrated fixtures, generated reviews, drift
apps/demo/                  static browser demo (source and dist/)
evaluation/
  cases.json                hand-written policy-matrix cases
  README.md                 methodology and metrics
```

## Data flow

```text
source systems (Jira, decision log, meeting notes)
        |
        v
capture agent / adapter         <- canonical standalone packages, not here
        |
        v
StatusArtifact (status-artifact.schema.json)
  as_of, initiative, policy, sources[], claims[], timeline[]?, baseline_timeline[]?
        |
        v
truth.review (CLI and MCP use the same core)
  - normalize + strict-field checks (src/normalize.js)
  - deprecation normalizers: captured_at, sourceId, string refs
  - freshness: observed_at vs as_of, source_updated_at
  - typed scalar contradictions
  - timeline drift (src/timeline-diff.js)
        |
        v
TruthReview (truth-review.schema.json)
  artifact_quality: pass | needs_review | fail
  program_health:   on_track | at_risk | blocked | unknown
  summary, sources, claims, timeline?, timeline_drift?,
  findings { facts, blockers, risks, unknowns, conflicts, issues, deprecations },
  recommended_actions
        |
        +---- Markdown report for humans (escaped)
        +---- JSON for automation
        +---- exit code for CI (quality gates; health needs an explicit gate)
```

## Contracts first

`packages/contracts/schemas/` is the single source of truth for shapes. The
contracts workspace is private and ships only through the root `truth-tools`
package; release automation validates its pack contents but never publishes it
separately.
`src/contracts.js` registers all seven schemas with Ajv (Draft 2020-12) and
exposes `validateStatusArtifact` / `validateTruthReview`. `scripts/
contracts-verify.js` checks, on every run:

1. every schema is Draft 2020-12, parses, and has a unique `$id`;
2. every cross-schema `$ref` resolves;
3. engine enums match schema enums (no code/contract drift);
4. the fixed fixture validates and the broken fixture is rejected;
5. engine outputs conform to `truth-review.schema.json` — including outputs
   for failing artifacts;
6. the checked-in timeline-drift fixture matches `timelineDiff` output.

## Demo and drift verification

`scripts/demo.js` runs the engine over the broken and fixed launch-readiness
artifacts, regenerates the checked-in reports (`truth-review-*.json/md`,
`timeline-drift.json/md`, `apps/demo/data.js`) in `--write` mode, and in
verify mode fails if any checked-in output differs from what the engine
produces. `apps/demo/dist` must be byte-identical to `apps/demo` sources
(`npm run demo:build`). The browser demo is static: no login, no network
requests, no telemetry; it renders claim text with `textContent`, never HTML.

## Cross-component demo integration

When the sibling repos (`capture-truth`, `timeline-truth`, `program-truth`)
sit beside `truth-tools` in the workspace, `scripts/demo.js` loads them with
real dynamic imports and runs them against the same launch-readiness
fixtures: capture-truth `captureSources` normalizes the evidence-pack
sources, timeline-truth `createTimeline`/`diffTimelines` builds and diffs the
plan timelines, and Program Truth's canonical status artifact is mapped
(`mapProgramArtifact`) into a `kind: "status_artifact"`,
`schema_version: "1.0.0"` artifact and reviewed by this engine. The demo
payload embeds deterministic, public-safe projections (a fixed capture clock,
no raw source bodies); a missing sibling is reported as a failed demo step,
never a crash. The browser demo renders these in a "Component truth" section.

## Boundaries (see ADRs 0001-0006)

- Truth Tools owns contracts, review, demo, and evaluation only.
- Capture and timeline tooling stay canonical standalone packages; no public
  capture/timeline binaries ship in this package.
- Raw source bodies are rejected; sources are metadata only.
- The tool never fetches URLs, never reads external sources, and never claims
  semantic proof. It validates the structure of the artifact it is given.
