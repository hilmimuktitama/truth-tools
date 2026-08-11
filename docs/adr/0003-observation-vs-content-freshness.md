# ADR-0003: Observation time vs content freshness

- Status: accepted
- Date: 2026-08-11
- Applies to: source records and freshness checks

## Context

The 0.2 line used `captured_at` for source timestamps. It was ambiguous
whether that meant "when the snapshot was taken" or "when the source last
changed", so freshness checks could silently compare the wrong value.

## Decision

Source records carry two distinct timestamps:

- **`observed_at`** (required) — when the evidence was observed or
  snapshotted. This is the value the stale-source policy ages against
  `as_of`.
- **`source_updated_at`** (optional) — the last-modified time reported by the
  source system. It is informational unless it is after `as_of`, which raises
  a review-level `source_updated_after_as_of` finding: the snapshot may be
  stale relative to the source.

`captured_at` is a deprecated compatibility form: it is normalized to
`observed_at` and reported as a deprecation finding. Deprecations never change
quality.

## Consequences

- Freshness has two visible dimensions in the demo: evidence age
  (`as_of` − `observed_at`) and the gap between snapshot and source update.
- A source that changed after the snapshot but before `as_of` is not an
  issue; the snapshot is simply older than the source.
