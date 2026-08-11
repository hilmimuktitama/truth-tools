# ADR-0004: Structured source references

- Status: accepted
- Date: 2026-08-11
- Applies to: claim `source_refs` entries

## Context

Claims cited sources with plain strings (`"source_refs": ["jira-123"]`).
String references cannot carry context and are easy to mistype or confuse
with other identifiers.

## Decision

The canonical `SourceRef` is an object:

```json
{
  "source_id": "jira-123",
  "note": "What this source supports"
}
```

`note` is optional; `additionalProperties` is false in the schema. Plain
strings remain accepted as a deprecated compatibility form: they normalize to
`{ "source_id": "..." }` and produce a `deprecated_string_source_ref` finding.
The legacy `sourceId` field (on sources and on reference objects) normalizes
to `id` / `source_id` with a `deprecated_source_id` finding.

## Consequences

- Citation-integrity checks (`unknown_source_ref`) run against the normalized
  `source_id` regardless of input form.
- Normalized claims always carry object refs, so downstream consumers never
  handle the legacy forms.
- Deprecation findings keep migration visible without failing the review.
