# Truth Tools

[![CI](https://github.com/hilmimuktitama/truth-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/hilmimuktitama/truth-tools/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Release status:** `0.4.0` is the published release from the old-generation
> exact lock. The corrected, complete v2 release is planned as `0.4.1` and is
> **not published yet**; do not describe it as available until its exact lock,
> tag, CI gates, and trusted publication are complete.

Truth Tools is a **deterministic evidence gate** for project-status
artifacts. It checks the structure of a supplied status report — every claim
must cite a known source, evidence must be fresh enough for your policy,
typed values must not contradict each other, and blockers, risks, and
unknowns must stay explicit — and returns two independent verdicts:

- **`artifact_quality`**: `pass` | `needs_review` | `fail` — is the evidence
  structure of this artifact sound?
- **`program_health`**: `on_track` | `at_risk` | `blocked` | `unknown` — the
  deterministic resolution of supplied reported health and the active-claim
  health floor. It is not an independent assessment of the program.

Truth Tools is the deterministic review boundary in an evidence-first
technical-program reliability toolkit. Sibling components may provide evidence
intake, timeline compilation, or status synthesis; this package reviews their
metadata-only output and does not own or claim those upstream jobs.

It does **not** read source bodies, fetch URLs, or decide what is true. An
agent, adapter, or human supplies structured claims and citations; Truth
Tools checks whether that artifact has an obvious evidence gap or
contradiction.

## Why this exists

Project updates often look cleaner than the underlying evidence. A parent
ticket says green, a decision log names another date, a meeting note has an
unresolved blocker, and the final status quietly picks whichever version is
convenient.

The 0.4 reset also fixed a flaw in its own plan: a single `readiness` value
conflated "is the evidence sound?" with "is the program OK?". Those are
different questions. The flagship demo is built on the corrected pair:

| Artifact | Verdict | Meaning |
| --- | --- | --- |
| broken evidence | `fail` + `blocked` | You cannot trust the status. |
| fixed evidence | `pass` + `blocked` | The evidence is trustworthy — and the blocker is now visible and actionable. |

Fixing the evidence does not fix the program. It makes the blocker
trustworthy.

The demo can also run the real sibling components against the same fixtures when
they are available. Set `TRUTH_SUITE_COMPONENT_ROOT` to a directory containing
`capture-truth/`, `timeline-truth/`, and `program-truth/`; it defaults to the
parent workspace for the local OSS checkout. Without those repositories the
demo verifies the checked-in public-safe projection and reports fixture
fallback. Set `TRUTH_SUITE_REQUIRE_SIBLINGS=1` to make absence or API drift a
hard failure. The real sibling integration calls capture-truth to normalize the
evidence-pack sources, timeline-truth rebuilds and diffs the plan timelines,
and Program Truth's canonical status artifact is mapped into this engine and
reviewed here (it validates as `pass` quality with `blocked` health). The
browser demo renders a "Component truth" section from those live results.

## Quick start

Requires Node.js 22 or newer.

```bash
git clone --branch main --single-branch \
  https://github.com/hilmimuktitama/truth-tools.git
cd truth-tools
npm ci
npm run demo        # verify every generated output against the engine
npm run demo:dev    # static browser demo at http://127.0.0.1:4173/
```

The integrated launch-readiness showcase lives in
[`examples/launch-readiness/`](examples/launch-readiness/README.md): a broken
artifact that fails review, a fixed evidence pack that passes while the
program stays blocked, generated Markdown/JSON reviews, and a timeline-drift
fixture (the launch moved from August 17 to August 20 — drift is reported,
never judged). The static browser demo at
[`apps/demo/`](apps/demo/index.html) has no login and no telemetry.

See the [portfolio case study](docs/portfolio.md), the
[product reset](docs/product-reset.md), and the
[review that drove it](docs/product-review.md).

The package command is:

```bash
 npm exec --yes --package truth-tools@0.4.0 -- \
  truth-tools review --input status.json
```

## Releases

The coordinated component versions, ownership, merge order, preconditions,
stop conditions, and verification gates are in the
[Truth Suite release plan](docs/release-plan.md). The operational workflow is
in [docs/release-process.md](docs/release-process.md).

The published `0.4.0` release followed the old-generation lock. The planned
corrected release is `0.4.1`; it is not published and must not be presented as
available. When that release is actually cut, maintainers must merge the
release commit to `main`, wait for CI, tag that exact main commit (`v0.4.1`),
and create a GitHub Release from the tag. Publishing the release starts the
trusted `release.published` workflow, which checks out the tag, verifies the
current complete v2 suite against its exact lock, runs the full gates, publishes
only the root package with npm provenance, and then the maintainer verifies the
provenance and published package. Manual dispatch requires the exact tag as its
`tag` input.

## Input

Truth Tools accepts source **metadata**, not raw Jira or document bodies. It is a
review/orchestration boundary for already-produced structured artifacts, not a
source connector, compiler, or multi-step suite workflow.
`as_of` is required so the same input always produces the same review.
`observed_at` is when the evidence was observed or snapshotted;
`source_updated_at` is the last-modified time reported by the source system.
Dates must use `YYYY-MM-DD` or an ISO datetime with `Z`/UTC offset;
locale-dependent or timezone-free dates are rejected.

```json
{
  "kind": "status_artifact",
      "schema_version": "2.0.0",
  "as_of": "2026-08-11T00:00:00.000Z",
  "initiative": {
    "name": "Checkout migration",
    "owner": "Platform TPM"
  },
  "policy": {
    "max_observation_age_days": 14,
    "max_source_content_age_days": 14
  },
  "sources": [
    {
      "id": "jira-release",
      "type": "jira",
      "url": "https://example.atlassian.net/browse/PLAT-123",
      "observed_at": "2026-08-10T08:00:00.000Z",
      "source_updated_at": "2026-08-10T08:00:00.000Z"
    }
  ],
  "health_assessment": {
    "state": "on_track",
    "owner": "Platform TPM",
    "rationale": "The cited launch-date evidence supports the current assessment.",
    "source_refs": [{ "source_id": "jira-release", "locator": "https://example.atlassian.net/browse/PLAT-123" }]
  },
  "claims": [
    {
      "id": "launch-date",
      "kind": "fact",
      "subject": "launch.date",
      "value": "2026-08-20",
      "text": "Target launch date is August 20, 2026.",
      "source_refs": [{ "source_id": "jira-release", "locator": "https://example.atlassian.net/browse/PLAT-123" }]
    }
  ]
}
```

### Compatibility forms

Legacy inputs keep working while you migrate: `captured_at` (use
`observed_at`), `sourceId` (use `id`), and plain-string `source_refs` (use
`{ "source_id": "..." }`) are normalized to the canonical shapes and reported
as explicit deprecation findings under `findings.deprecations`. Deprecations
never change quality. See [docs/migration.md](docs/migration.md).

### Raw bodies vs provenance metadata

Raw source bodies never travel in the artifact: `content`, `body`, `raw`,
`payload`, `document`, and `data` keys always fail review and are stripped
from the normalized output. Two provenance extensions are accepted:

- `sources[].raw_included` — optional boolean metadata from a capture
  component recording that the capture record held a body in its system of
  record. It is preserved on the source and is never treated as a body
  itself.
- `source_refs[]` Timeline Truth provenance fields — `heading` (string),
  `tableRow` and `line` (positive integers) locate the evidence inside the
  source. Truth Tools' canonical SourceRef deliberately excludes `text`:
  source references carry locators and metadata, never
  verbatim source text, and never relax the required `source_id` + `locator`
  contract.

The browser demo displays raw-inclusion state and Timeline Truth provenance
while still stripping actual bodies from the shipped data.

> **Structural-sanitization warning:** JSON Schema describes the portable shape,
> but it does not by itself prove that recursively nested metadata is safe or
> that credential-bearing URLs are absent. Run the Truth Tools normalizer/review
> at the trust boundary and use its sanitized output. Do not treat a schema-only
> validation pass, a `raw_included` flag, or a content hash as permission to
> transport a source body.

### Claim kinds

- `fact`: a reported fact with at least one source reference;
- `blocker`: work that prevents readiness;
- `risk`: a credible threat with mitigation still needed;
- `unknown`: a question that remains unresolved.

Classification is explicit. Truth Tools never labels a sentence as a fact
just because it does not contain the word "risk" or "blocked".

### Capture Truth CandidateClaim

The shared CandidateClaim contract follows Capture Truth 0.5.0. A CandidateClaim
is an extraction-stage candidate, not a reviewed Claim and not a final program
status. It carries enumerable extraction metadata
(`classification_method`, `derivation_version`, and `source_material`) plus a
non-authoritative `suggested_kind`. `review_status` is explicitly
`unreviewed`, `approved_for_portable`, or `rejected`: extraction emits
`unreviewed` without reviewer metadata, while approved or rejected candidates
must carry nonempty `reviewed_by` and RFC3339 `reviewed_at`. CandidateClaim
never contains a final `kind`, and SourceRef never contains source text.

### Contradictions

Active contradiction checks require a `subject` and a scalar `value` pair.
Values may be strings, numbers, or booleans. Claims conflict when they share
a normalized `subject` but have different typed values — so `1` and `"1"`
remain distinct, and objects/null are rejected rather than guessed. A
contradiction makes `artifact_quality: fail`. Truth Tools does not choose a
winner; it reports the disagreement and asks for owner reconciliation.

### Freshness

Observation age is `as_of - observed_at`; content age is `as_of -
source_updated_at`. A snapshot gap is `source_updated_at - observed_at` when
`observed_at < source_updated_at <= as_of`; it raises
`source_updated_after_observation` with source id and timestamps. An update
after `as_of` raises `source_updated_after_as_of`. Thresholds use raw
milliseconds; displayed durations are rounded only for presentation. These
three dimensions and their findings are independent.
See ADR-0003.

## CLI

```bash
truth-tools review --input status.json
cat status.json | truth-tools review --format json
truth-tools review --input status.json --out reports/status.md
truth-tools review --input status.json --fail-on needs_review
truth-tools review --input status.json --fail-on fail
truth-tools review --input status.json --fail-on-health blocked
truth-tools doctor
truth-tools example
truth-tools --version
```

Exit codes: `0` review completed and no gate triggered; `1` usage, input, or
engine error; `2` a gate is triggered.

Gates are **independent** and combinable:

| Gate | Exits 2 when |
| --- | --- |
| `--fail-on fail` | `artifact_quality` is `fail` |
| `--fail-on needs_review` | `artifact_quality` is `needs_review` or `fail` |
| `--fail-on-health blocked` | `program_health` is `blocked` |
| `--fail-on-health at_risk` | `program_health` is `at_risk`, `blocked`, or `unknown` |

Program health never changes the exit code by itself. A clean artifact with a
blocked program exits `0` unless you pass `--fail-on-health` explicitly —
quality gates the artifact, health gates the program, and CI can use either
or both.

## MCP

From a source checkout, configure the stdio server directly:

```json
{
  "mcpServers": {
    "truth-tools": {
      "command": "node",
      "args": ["/absolute/path/to/truth-tools/src/mcp-server.js"]
    }
  }
}
```

Use the package binary:

```json
{
  "mcpServers": {
    "truth-tools": {
      "command": "npx",
      "args": ["-y", "--package=truth-tools@0.4.0", "truth-tools-mcp"]
    }
  }
}
```

The server exposes only two read-only tools, both using the same core as the
CLI:

| Tool | Purpose |
| --- | --- |
| `truth.review` | Run the deterministic evidence-structure audit. |
| `truth.doctor` | Smoke-test the installed review contract. |

The small surface is intentional. An agent should make one review call, not
orchestrate nine low-level tools correctly.

## Contracts

Canonical JSON Schema Draft 2020-12 contracts live in
[`packages/contracts/schemas/`](packages/contracts/schemas/): Source,
SourceRef, CandidateClaim, Claim, TimelineItem, StatusArtifact, and
TruthReview, and the `suite-lock` contract. They are private workspace sources shipped through the root
`truth-tools` npm package and are enforced in this repository by `npm run contracts:verify`
(schema registration, `$ref` resolution, engine/schema enum parity, fixture
validation, and conformance of engine output — including output for failing
artifacts).

## Evaluation

`npm run eval` runs 30 hand-written policy-matrix cases; `npm run
eval:synthetic` adds 200 seeded synthetic cases (both run in CI). Metrics:
pass rate, per-dimension accuracy, and issue precision/recall with false
positives counted on every case — `expect.issues` lists are complete
specifications, so unexpected findings fail the case. Seeded-defect
detection recall and unexpected-finding counts are reported separately, and
the fixed seed makes every synthetic run repeatable. The harness measures
the engine against its own specification — it does not claim real-world
effectiveness. See [docs/evaluation.md](docs/evaluation.md).

## Trust boundary

Truth Tools verifies citation integrity, timestamps, explicit
classifications, typed contradictions, and blockers/risks/unknowns **inside
the supplied artifact**. It does not fetch a URL, inspect the external
source, or prove that the cited source supports the claim. A fabricated or
incorrect source reference can still pass if its metadata is internally
valid.

It deliberately rejects raw `content`, `body`, `raw`, and `raw_content`
fields. Keep confidential source bodies in their systems of record. Claim
text is exported verbatim, so it must not contain credentials or confidential
source bodies. The browser demo renders all dynamic text with `textContent`,
never HTML, and makes no network requests.

## Development

```bash
npm ci
npm test                  # engine, CLI, MCP, contracts, drift, demo, evaluation
npm run check             # syntax-check every JS file
npm run contracts:verify  # schema conformance and parity
npm run demo              # verify generated outputs and demo data against the engine
npm run demo:build        # rebuild apps/demo/dist from sources
npm run demo:dev          # static demo server on 127.0.0.1:4173
npm run eval              # evaluation harness (hand-written cases)
npm run eval:synthetic    # + 200 seeded synthetic cases
  npm run demo:write             # regenerate reports, drift, and demo data
npm pack --dry-run        # inspect the package allowlist
```

The test suite covers valid and invalid citations, stale and future-dated
evidence, strict date parsing, typed contradiction values, unsupported
fields, explicit claim classification, deprecation normalizers, raw-body
rejection, Markdown escaping, the exact exit-code policy for quality and
health gates, CLI output, MCP output and a real stdio round-trip, schema
conformance, timeline drift, demo drift verification, and evaluation
repeatability.

## Portfolio summary

> Built a deterministic CLI and MCP gate that audits generated project-status
> artifacts for citation integrity, source freshness, typed contradictions,
> blockers, risks, and unknowns — with canonical JSON Schema contracts,
> artifact-quality vs program-health verdicts, a static no-login browser
> demo with timeline-drift and freshness visualization, and a repeatable
> synthetic evaluation harness.

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md),
[SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).
