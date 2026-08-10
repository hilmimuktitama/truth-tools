# Truth Tools

[![CI](https://github.com/hilmimuktitama/truth-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/hilmimuktitama/truth-tools/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Release status:** This branch contains the proposed `0.3.0` breaking reset. npm currently serves `0.2.0`, which still exposes the older umbrella workflow, so use this branch checkout until the reset is merged and released.


Truth Tools audits the evidence structure of a project-status report before you send it.

It checks four things deterministically:

1. every claim cites a known source record;
2. source records are recent enough for your policy;
3. claims about the same subject do not disagree;
4. blockers, risks, and unknowns remain explicit.

It does **not** read source bodies or decide what is true. An agent, adapter, or human supplies structured claims and citations. Truth Tools checks whether that artifact has an obvious evidence gap or contradiction.

## Why this exists

Project updates often look cleaner than the underlying evidence. A parent ticket says green, a decision log names another date, a meeting note has an unresolved blocker, and the final status quietly picks whichever version is convenient.

Truth Tools is the deterministic gate after evidence collection and before publication:

```text
Jira / docs / notes
        |
        v
agent or adapter creates status.json
        |
        v
Truth Tools review
        |
        +---- Markdown review for humans
        +---- JSON result for automation
        +---- exit code for CI
```

It is useful before a weekly status update, release-readiness review, leadership memo, or generated program artifact is published.

## Quick start

Requires Node.js 22 or newer. Run the checked-in example from a checkout:

```bash
git clone --branch agent/simplify-truth-tools --single-branch \
  https://github.com/hilmimuktitama/truth-tools.git
cd truth-tools
npm install
npm run example
```

The example deliberately contains a conflicting launch date and an ownerless blocker, so the result is `blocked`.

See the [generated report](examples/product-launch-report.md), the [portfolio case study](docs/portfolio.md), and the [product/code review that drove the reset](docs/product-review.md).

After `0.3.0` is published, the package command will be:

```bash
npm exec --yes --package truth-tools@0.3.0 -- \
  truth-tools review --input status.json
```

## Input

Truth Tools accepts source **metadata**, not raw Jira or document bodies. `as_of` is required so the same input produces the same review. `captured_at` means when the cited evidence was observed or snapshotted; it is not automatically the source page's last-modified time. Dates must use `YYYY-MM-DD` or an ISO datetime with `Z`/UTC offset; locale-dependent or timezone-free dates are rejected.

```json
{
  "as_of": "2026-08-11T00:00:00.000Z",
  "initiative": {
    "name": "Checkout migration",
    "owner": "Platform TPM"
  },
  "policy": {
    "max_source_age_days": 14
  },
  "sources": [
    {
      "id": "jira-release",
      "type": "jira",
      "url": "https://example.atlassian.net/browse/PLAT-123",
      "captured_at": "2026-08-10T08:00:00.000Z"
    }
  ],
  "claims": [
    {
      "id": "launch-date",
      "kind": "fact",
      "subject": "launch.date",
      "value": "2026-08-20",
      "text": "Target launch date is August 20, 2026.",
      "source_refs": ["jira-release"]
    }
  ]
}
```

### Claim kinds

- `fact`: a reported fact with at least one source reference;
- `blocker`: work that prevents readiness;
- `risk`: a credible threat with mitigation still needed;
- `unknown`: a question that remains unresolved.

Classification is explicit. Truth Tools never labels a sentence as a fact just because it does not contain the word “risk” or “blocked.”

### Contradictions

Contradiction checks require a `subject` and scalar `value` pair. Values may be strings, numbers, or booleans. Claims conflict when they share a normalized `subject` but have different typed values.

```json
{
  "id": "date-from-decision-log",
  "kind": "fact",
  "subject": "launch.date",
  "value": "2026-08-22",
  "text": "The decision log records August 22, 2026.",
  "source_refs": ["decision-log"]
}
```

Truth Tools does not choose a winner. It reports the disagreement and asks for owner reconciliation.

## CLI

```bash
truth-tools review --input status.json
cat status.json | truth-tools review --format json
truth-tools review --input status.json --out reports/status.md
truth-tools review --input status.json --fail-on blocked
truth-tools review --input status.json --fail-on needs_review
truth-tools doctor
truth-tools version
truth-tools example
truth-tools --version
```

Readiness values:

- `ready`: the artifact has current source references, no contradictions, and no open blocker, risk, unknown, or validation issue;
- `needs_review`: evidence metadata is stale/incomplete, or the artifact has risks or unknowns;
- `blocked`: there is a blocker, contradiction, invalid citation, duplicate identity, unsupported field/value, or raw source body.

`--fail-on blocked` exits with code `2` only for blocked reviews. `--fail-on needs_review` exits with code `2` for either `needs_review` or `blocked`, which makes the command usable in CI.

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

After `0.3.0` is published, use the package binary:

```json
{
  "mcpServers": {
    "truth-tools": {
      "command": "npx",
      "args": ["-y", "--package=truth-tools@0.3.0", "truth-tools-mcp"]
    }
  }
}
```

The server exposes only two read-only tools:

| Tool | Purpose |
| --- | --- |
| `truth.review` | Run the deterministic evidence-structure audit. |
| `truth.doctor` | Smoke-test the installed review contract. |

The small surface is intentional. An agent should make one review call, not orchestrate nine low-level tools correctly.

## Example result

```text
Readiness: blocked
Sources: 3
Claims: 4
Blockers: 1
Risks: 1
Conflicts: 1

P0 Reconcile launch.date: 2026-08-20 vs 2026-08-22.
P0 Assign an owner and resolution date for the rollback blocker.
P1 Record mitigation for peak-traffic capacity risk.
```

## Trust boundary

Truth Tools verifies citation integrity, timestamps, explicit classifications, and internal consistency **inside the supplied artifact**. It does not fetch a URL, inspect the external source, or prove that the cited source supports the claim. A fabricated or incorrect source reference can still pass if its metadata is internally valid.

It deliberately rejects raw `content`, `body`, `raw`, and `raw_content` fields. Keep confidential source bodies in their systems of record. Claim text is exported verbatim, so it must not contain credentials or confidential source bodies.

## Development

```bash
npm install
npm test
npm run check
npm pack --dry-run
```

The test suite covers valid and invalid citations, stale and future-dated evidence, strict date parsing, typed contradiction values, unsupported fields, explicit claim classification, raw-body rejection, Markdown rendering, CLI output, MCP output, and CI exit codes.

## Portfolio summary

> Built a deterministic CLI and MCP gate that audits generated project-status artifacts for citation integrity, stale source metadata, typed contradictions, blockers, risks, and unresolved unknowns, with Markdown/JSON output and CI-enforceable readiness states.

MIT licensed.
