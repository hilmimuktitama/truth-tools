# Migration guide — legacy 0.2.x through the 0.4.1 current v2 set

0.3.0 was a breaking reset. The published 0.4.0 package is the old-generation
exact-lock line; the published corrected complete-v2 set is 0.4.1. This guide
maps the legacy input and output to the
canonical contract. The engine also accepts the legacy forms with deprecation
findings, so existing artifacts keep working while migrating.

## Input fields

| Legacy | Canonical | Handling |
| --- | --- | --- |
| `sources[].captured_at` | `sources[].observed_at` | Normalized automatically; `deprecated_captured_at` finding |
| `sources[].sourceId` | `sources[].id` | Normalized automatically; `deprecated_source_id` finding |
| `claims[].source_refs[]` as strings | `{ "source_id": "..." }` | Normalized automatically; `deprecated_string_source_ref` finding |
| `claims[].source_refs[]` objects with `sourceId` | `{ "source_id": "..." }` | Normalized automatically; `deprecated_source_id` finding |

Deprecation findings appear under `findings.deprecations` with severity
`deprecated` and a `suggested` replacement. They never change
`artifact_quality`.

### Raw bodies and provenance extensions

Raw source bodies are rejected in both legacy and canonical forms:
`content`, `body`, `raw`, `raw_content`, `rawContent`, `payload`,
`document`, and `data` keys fail review and are stripped from normalized
output. Two provenance extensions are canonical and accepted:

- `sources[].raw_included` — optional boolean metadata from a capture
  component (the capture record held a body in its system of record). It is
  preserved, never treated as a body, and never present on legacy input.
- `claims[].source_refs[].{heading, tableRow, line}` — Timeline Truth
  provenance passthrough (section heading, 1-based table row, and 1-based line
  number). Canonical SourceRef deliberately excludes `text`: verbatim source
  text is never portable. These fields never relax the required `source_id` +
  `locator` contract.

## Output changes

| 0.2.x | 0.3.0 |
| --- | --- |
| `readiness: ready | needs_review | blocked` | `artifact_quality: pass | needs_review | fail` **and** `program_health: on_track | at_risk | blocked | unknown` |
| `sources[].captured_at` | `sources[].observed_at` (plus optional `source_updated_at`) |
| `claims[].source_refs` strings | `claims[].source_refs` objects |

### Mapping the old readiness value

- `ready` → `artifact_quality: pass` and `program_health: on_track`;
- `needs_review` → `artifact_quality: needs_review` (or any health);
- `blocked` → `artifact_quality: fail` **or** `program_health: blocked` —
  check both dimensions; a blocker with clean evidence is now
  `pass` + `blocked`.

## CLI and exit codes

| 0.2.x | 0.3.0 |
| --- | --- |
| `--fail-on blocked` | `--fail-on fail` (quality) and/or `--fail-on-health blocked` (health) |
| `--fail-on needs_review` | `--fail-on needs_review` (quality only) and/or `--fail-on-health at_risk` (health) |

Exit codes: `0` review completed with no gate triggered; `1` usage/input/
engine error; `2` a gate is triggered. Program health never changes the exit
code unless `--fail-on-health` is passed explicitly.

## Normalized output shape

Entities that cannot satisfy the canonical shape are omitted from the
normalized `sources`/`claims` arrays and reported as issues with their input
location (for example `sources[0]`). `summary` counts the normalized
entities.

## Example migration

```jsonc
// 0.2.x
{
  "sources": [{ "id": "jira", "type": "jira", "captured_at": "2026-08-10T08:00:00.000Z" }],
  "claims": [{ "id": "c1", "kind": "fact", "text": "x", "source_refs": ["jira"] }]
}

// 0.3.0 canonical
{
  "sources": [{
    "id": "jira", "type": "jira",
    "observed_at": "2026-08-10T08:00:00.000Z",
    "source_updated_at": "2026-08-10T08:00:00.000Z"
  }],
  "claims": [{ "id": "c1", "kind": "fact", "text": "x",
    "source_refs": [{ "source_id": "jira", "locator": "https://example.atlassian.net/browse/PLAT-123", "note": "What this supports" }] }]
}
```

## Timeline

`timeline` and `baseline_timeline` are new optional arrays of TimelineItem
(`date`, `title`, optional `id`/`category`/`status`/`description`/`links`).
When both are present the review includes `timeline_drift`; drift is
informational and never affects quality.

## Contracts

The canonical schemas ship in the `truth-tools-contracts` package and live in
`packages/contracts/schemas/`. Validate against `status-artifact.schema.json`
for input and `truth-review.schema.json` for output. `npm run
contracts:verify` enforces conformance in CI.
# Migration to the current v2 contract (Truth Tools 0.4.1)

StatusArtifact v2 requires `schema_version: "2.0.0"` and a non-empty
`health_assessment` containing `state`, `owner`, `rationale`, and canonical
`source_refs` whose IDs exist and whose locators are present. Legacy 1.0.0 is
accepted only as a visible compatibility path and emits migration/deprecation
findings.

SourceRef `text` is no longer canonical. Legacy input is stripped and emits
`deprecated_source_ref_text`; it is never copied into notes or reports.

## Exact-lock requirement

Integrations must resolve the exact `0.4.1` package/tag and the
matching complete v2 Truth Suite lock. Do not
mix the published 0.4.0 old-generation lock with current sibling components,
and do not use a floating version when reproducing a release review.
