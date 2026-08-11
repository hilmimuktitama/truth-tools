# Changelog

All notable changes to Truth Tools are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Standardized trusted releases on published GitHub Releases: the workflow
  checks out and validates a canonical semantic-version tag, confirms it
  resolves to `HEAD`, and compares it dynamically with `package.json` before
  running gates and publishing with npm provenance.
- Fixed the owner used by CI, Pages, and release workflow checkouts for the
  sibling Truth repositories.
- Made cross-repo demo integration portable with a configurable component root,
  required-sibling CI mode, and a clearly reported checked-in fixture fallback
  for single-repository installs.

### Added (0.3.0, this branch)

- **Strict semantic RFC3339 timestamps.** Canonical Source and SourceRef
  timestamp fields now declare `format: "date-time"` and reject impossible
  calendar dates, times, and UTC offsets without adding ajv-formats.

- **Canonical contracts workspace** (`packages/contracts`, private): JSON Schema
  Draft 2020-12 schemas for Source, SourceRef, CandidateClaim, Claim,
  TimelineItem, StatusArtifact, and TruthReview, shipped through the root
  `truth-tools` package and checked by `npm run contracts:verify`.
- **Artifact quality vs program health.** Reviews now report two independent
  dimensions: `artifact_quality` (`pass` / `needs_review` / `fail`) for the
  evidence structure of the artifact, and `program_health`
  (`on_track` / `at_risk` / `blocked` / `unknown`) for the state the claims
  report. See ADR-0002.
- **Freshness dimensions.** `observed_at` (when evidence was snapshotted) and
  `source_updated_at` (last change reported by the source system) are
  separate fields; a source updated after `as_of` raises a review finding.
   See ADR-0003.
- **Strict canonical timestamps and source kinds.** Canonical Source and
  SourceRef timestamps require full RFC3339 datetimes with timezone; invalid
  Source.kind values block review and are omitted.
- **Structured source references.** `source_refs` entries are
  `{ "source_id": "...", "note"?: "..." }` objects. See ADR-0004.
- **Compatibility normalizers.** `captured_at`, `sourceId`, and plain-string
  source references are accepted, normalized to the canonical forms, and
  reported as explicit deprecation findings. They never change quality.
- **Provenance extensions.** `sources[].raw_included` is optional boolean
  provenance metadata from capture components (the capture record held a body
  in its system of record); it is preserved and never treated as a raw body.
  `source_refs[]` accept Timeline Truth provenance passthrough fields
  (`heading` string, `tableRow` and `line` positive integers, `text` string)
  without relaxing the required `source_id` + `locator`. Raw bodies
  (`content`, `body`, `raw`, `payload`, `document`, `data`) still fail.
- **Timeline drift.** Optional `timeline` and `baseline_timeline` arrays on
  the status artifact produce a deterministic `timeline_drift` report
  (added / removed / changed / unchanged). Drift is reported, never judged.
- **Exit gates are quality-only by default.** `--fail-on fail` and
  `--fail-on needs_review` gate `artifact_quality` only. Program health never
  changes the exit code unless `--fail-on-health blocked` or
  `--fail-on-health at_risk` is passed explicitly.
- **Launch-readiness demo.** `examples/launch-readiness/` contains a broken
  artifact (fail + blocked) and a fixed evidence pack (pass + blocked), their
  generated reviews, a timeline-drift fixture, and a README. `npm run demo`
  regenerates/verifies every output; `npm run demo:dev` serves a static,
  no-login, no-telemetry browser demo; `npm run demo:build` rebuilds
  `apps/demo/dist`.
- **Evaluation harness.** `evaluation/cases.json` (28 hand-written cases) plus
  a seeded synthetic generator; `npm run eval` reports pass rate, per-dimension
  accuracy, and issue precision/recall. Synthetic cases are repeatable.
- **Cross-component demo integration.** When the sibling repos
  (`capture-truth`, `timeline-truth`, `program-truth`) sit beside `truth-tools`
  in the workspace, `npm run demo` runs real sibling calls against the
  launch-readiness fixtures: capture-truth `captureSources` normalizes the
  evidence-pack sources, timeline-truth `createTimeline`/`diffTimelines` builds
  and diffs the plan timelines, and Program Truth's canonical status artifact
  is mapped into a `kind: "status_artifact"`, `schema_version: "1.0.0"`
  artifact and reviewed by this engine (pass quality, blocked health). The
  browser demo gains a "Component truth" section, and the demo payload embeds
  deterministic, public-safe sibling projections verified by
  `test/demo.test.js`.
- **Governance.** ADRs 0001-0006, security policy, contribution guide, bug
  template, PR template, CODEOWNERS, Pages and trusted-publishing release
  workflows, and package allowlists for both npm packages.

### Changed

- `captured_at` is deprecated in favor of `observed_at` on source records.
- Source `sourceId` is deprecated in favor of `id`.
- Plain-string `source_refs` entries are deprecated in favor of
  `{ "source_id": "..." }` objects.
- Review output replaces the single `readiness` value with
  `artifact_quality` and `program_health`; `readiness` is removed.
- Claims with unsupported kinds, sources without `observed_at`, and other
  entities that cannot satisfy the canonical shape are omitted from the
  normalized output and reported as issues with their input location.
- Contradictions are now `artifact_quality: fail` (they were `blocked`
  readiness before); the contradiction itself is unchanged.
- The committed example (`examples/product-launch.json`) uses canonical
  fields and remains a fail + blocked showcase.

### Removed

- Source-body ingestion and raw content fields from the review contract.
- The single `readiness` output field.
- Heuristic claim classification (never existed in this line; the reset
  removed it from the legacy umbrella).

## [0.2.0] — 2026 (legacy umbrella, npm)

Published before the reset. It still exposed the older umbrella workflow
(capture, timeline, program reconciliation, nine MCP tools) and is untagged
in this repository. It is replaced by 0.3.0; see `docs/migration.md` and
`docs/product-reset.md`.

## [0.1.x] — legacy pre-reset line

Repository history before the simplification reset. Superseded.
