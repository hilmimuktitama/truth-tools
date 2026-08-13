# ADR 0008: Portable source metadata boundary

- Status: accepted
- Date: 2026-08-13
- Applies to: Source, SourceRef, CandidateClaim provenance, normalization,
  CLI/MCP boundaries, generated reports, and demo data

## Context

Source bodies can contain credentials, personal data, or confidential material.
A convention such as a `raw-local` directory is not a safety boundary because
the resulting file can still be committed, uploaded, or attached. A JSON Schema
shape check also cannot fully express recursive key policy, credential-bearing
URL semantics, cycles, or resource bounds.

## Decision

Portable artifacts carry source metadata and concrete locators only. Bodies stay
in the source system of record and are never accepted as `content`, `body`,
`raw`, `payload`, `document`, `data`, or equivalent raw-like fields, including
recursively nested metadata. `raw_included` is an explicit provenance boolean:
it records that a capture record held a body in its system of record, but it is
not the body and never authorizes transport of one.

SourceRef is locator-only with bounded provenance metadata and has no verbatim
`text` property. CandidateClaim retains extraction-stage privacy metadata,
including `source_material`, so a downstream promotion step can distinguish
portable structured/metadata derivations from raw or mixed derivations. A
CandidateClaim is not a final Claim and cannot carry a final `kind`.

The runtime normalizer is mandatory at the trust boundary, in addition to JSON
Schema validation. It recursively bounds depth, entries, arrays, strings, and
serialized size; rejects dangerous prototype keys and credential-bearing URLs;
strips raw-like fields; and emits blocking path findings. Consumers must use the
sanitized normalized output, not the original input. Schema-only validation is
not sufficient sanitization.

## Consequences

- Confidential source bodies remain in their systems of record and do not enter
  CLI, MCP, reports, fixtures, or shipped demo data.
- Privacy violations fail deterministically with an input path, making the
  boundary reviewable rather than dependent on operator memory.
- Capture provenance remains useful without weakening the body prohibition.
- Normalization is part of every adapter/integration boundary and adds bounded
  work instead of permitting unbounded recursive input.

## Alternatives considered

- Allow bodies for local-only workflows: rejected because locality is not a
  durable safety control.
- Rely on `additionalProperties: false` alone: rejected because recursive
  metadata and URL credential semantics require runtime checks.
- Preserve raw-like fields and redact only in reports: rejected because unsafe
  data would already have crossed the portable boundary.
