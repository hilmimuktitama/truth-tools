# ADR-0003: Observation time vs content freshness

- Status: accepted
- Date: 2026-08-11
- Applies to: source records and freshness checks

## Context

The 0.2 line used `captured_at` for source timestamps. It was ambiguous
whether that meant "when the snapshot was taken" or "when the source last
changed", so freshness checks could silently compare the wrong value.

## Decision

Source records carry two timestamps and one derived interval:

- **`observed_at`** (required) — when the evidence was observed or
  snapshotted. This is the value the stale-source policy ages against
  `as_of`.
- **`source_updated_at`** (optional) — the last-modified time reported by the
  source system. Content age is `as_of - source_updated_at` and is checked
  independently of observation age.
- **Snapshot gap** (derived) — `source_updated_at - observed_at` when
  `observed_at < source_updated_at <= as_of`. It raises a review-level
  `source_updated_after_observation` finding with source id and timestamps.
  An update after `as_of` instead raises `source_updated_after_as_of`.

`captured_at` is a deprecated compatibility form: it is normalized to
`observed_at` and reported as a deprecation finding. Deprecations never change
quality.

## Consequences

- Freshness has three visible dimensions: observation age (`as_of` −
  `observed_at`), content age (`as_of` − `source_updated_at`), and snapshot
  gap (`source_updated_at` − `observed_at`). These dimensions are independent;
  stale content and a snapshot gap may occur together.
