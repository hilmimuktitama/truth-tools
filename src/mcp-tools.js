import { renderReviewMarkdown } from "./report.js";
import { doctorTruthTools, reviewTruth } from "./review.js";

export function listTruthTools() {
  return [
    {
      name: "truth.review",
      title: "Review project-status evidence",
      description:
        "Check a structured project-status artifact for citation integrity, source freshness, typed contradictions, blockers, risks, and unknowns. Returns artifact_quality (pass/needs_review/fail) and program_health (on_track/at_risk/blocked/unknown).",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: reviewInputSchema(),
      outputSchema: reviewOutputSchema()
    },
    {
      name: "truth.doctor",
      title: "Check Truth Tools",
      description: "Run a deterministic smoke test of the Truth Tools review contract.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", additionalProperties: false },
      outputSchema: {
        type: "object",
        required: ["ok", "checks"],
      properties: {
          ok: { type: "boolean" },
          checks: { type: "array", items: { type: "object" } }
        }
      }
    }
  ];
}

export function callTruthTool(name, args = {}) {
  if (name === "truth.review") return reviewTruth(args);
  if (name === "truth.doctor") return doctorTruthTools();
  throw new Error(`Unknown truth tool: ${name}`);
}

export function callTruthToolForMcp(name, args = {}) {
  const result = callTruthTool(name, args);
  return {
    structuredContent: result,
    content: [
      {
        type: "text",
        text: name === "truth.review" ? renderReviewMarkdown(result) : JSON.stringify(result, null, 2)
      }
    ]
  };
}

function sourceMetadataSchema() {
  return { "$ref": "#/$defs/source_metadata_object" };
}

function sourceMetadataValueSchema() {
  return { "$ref": "#/$defs/source_metadata_value" };
}

function sourceMetadataDefinitions() {
  return {
    source_metadata_object: {
      type: "object",
      maxProperties: 100,
      propertyNames: {
        not: {
          anyOf: [
            {
              pattern: "^[^A-Za-z0-9]*(?:[Cc][Oo][Nn][Tt][Ee][Nn][Tt][Ss]?|[Bb][Oo][Dd][Yy]|[Rr][Aa][Ww](?:[^A-Za-z0-9]*(?:[Bb][Oo][Dd][Yy]|[Cc][Oo][Nn][Tt][Ee][Nn][Tt]|[Dd][Aa][Tt][Aa]))?|[Pp][Aa][Yy][Ll][Oo][Aa][Dd]|[Dd][Oo][Cc][Uu][Mm][Ee][Nn][Tt]|[Dd][Ee][Ss][Cc][Rr][Ii][Pp][Tt][Ii][Oo][Nn](?:[^A-Za-z0-9]*[Mm][Aa][Rr][Kk][Dd][Oo][Ww][Nn])?|[Mm][Ee][Ss][Ss][Aa][Gg][Ee]|[Hh][Tt][Mm][Ll]|[Mm][Aa][Rr][Kk][Dd][Oo][Ww][Nn]|[Pp][Rr][Oo][Ss][Ee]|[Bb][Ll][Oo][Bb]|[Tt][Ee][Xx][Tt]|[Dd][Aa][Tt][Aa])[^A-Za-z0-9]*$"
            },
            { pattern: "^(?:__[Pp][Rr][Oo][Tt][Oo]__|[Pp][Rr][Oo][Tt][Oo][Tt][Yy][Pp][Ee]|[Cc][Oo][Nn][Ss][Tt][Rr][Uu][Cc][Tt][Oo][Rr])$" }
          ]
        }
      },
      additionalProperties: { "$ref": "#/$defs/source_metadata_value" }
    },
    source_metadata_value: {
      anyOf: [
        { type: ["string", "number", "boolean", "null"], maxLength: 2048 },
        sourceMetadataSchema(),
        { type: "array", maxItems: 100, items: sourceMetadataValueSchema() }
      ]
    }
  };
}

function canonicalSourceRefSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["source_id", "locator"],
    properties: {
      source_id: { type: "string", minLength: 1, maxLength: 2048 },
      locator: { type: "string", minLength: 1, maxLength: 2048 },
      note: { type: "string", minLength: 1, maxLength: 2048 },
      path: { type: ["string", "null"], maxLength: 2048 },
      url: { type: ["string", "null"], maxLength: 2048 },
      observed_at: {
        type: ["string", "null"],
        pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,9})?(Z|[+-]\\d{2}:\\d{2})$"
      },
      source_updated_at: {
        type: ["string", "null"],
        pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,9})?(Z|[+-]\\d{2}:\\d{2})$"
      },
      revision: { type: ["string", "number", "null"], maxLength: 2048 },
      content_hash: { type: ["string", "null"], pattern: "^(?:sha256:)?[a-f0-9]{64}$" },
      heading: { type: "string", minLength: 1, maxLength: 2048 },
      tableRow: { type: "integer", minimum: 1 },
      line: { type: "integer", minimum: 1 }
    }
  };
}

function reviewInputSchema() {
  // Mirrors what the engine accepts: the canonical StatusArtifact shape plus
  // the compatibility normalizers (captured_at, sourceId, plain-string
  // source refs, max_source_age_days alias) and missing/empty collections, so
  // engine findings such as no_sources, missing_observed_at, or deprecations
  // are reachable through MCP instead of being rejected at the boundary. Raw
  // source bodies and undocumented fields are still rejected here; the
  // boundary stays read-only and safe. When both an alias and the canonical
  // field are present, the canonical field wins.
  return {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    type: "object",
     required: ["kind", "schema_version", "as_of"],
    additionalProperties: false,
    properties: {
      kind: { const: "status_artifact" },
      schema_version: { const: "2.0.0" },
      as_of: { type: "string", description: "ISO date or datetime used as the reproducible review cutoff." },
      initiative: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1 },
          owner: { type: "string", minLength: 1 },
          objective: { type: "string", minLength: 1 }
        }
      },
      health_assessment: {
        type: "object",
        additionalProperties: false,
        required: ["state", "owner", "rationale", "source_refs"],
        properties: {
          state: { type: "string", enum: ["on_track", "at_risk", "blocked", "unknown"] },
          owner: { type: "string", minLength: 1, maxLength: 2048 },
          rationale: { type: "string", minLength: 1, maxLength: 4096 },
           source_refs: {
             type: "array",
             minItems: 1,
             maxItems: 20,
              items: canonicalSourceRefSchema()
           }
         }
      },
      policy: {
        type: "object",
        additionalProperties: false,
        properties: {
          max_observation_age_days: { type: "integer", minimum: 0, default: 14 },
          max_source_content_age_days: { type: "integer", minimum: 0, default: 14 },
          max_source_age_days: { type: "integer", minimum: 0, description: "Deprecated alias; engine normalizes it to both canonical fields and reports a deprecation finding." }
        }
      },
      sources: {
        type: "array",
        maxItems: 1000,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            sourceId: { type: "string", minLength: 1, description: "Deprecated alias for id; engine normalizes it and reports a deprecation finding." },
            kind: { type: "string", enum: ["document", "record"] },
            type: { type: "string", minLength: 1 },
            adapter: { type: "string", minLength: 1 },
            key: { type: "string", minLength: 1 },
            url: { type: "string", minLength: 1 },
            path: { type: "string", minLength: 1 },
            observed_at: { type: "string", minLength: 1 },
            captured_at: { type: "string", minLength: 1, description: "Deprecated alias for observed_at; engine normalizes it and reports a deprecation finding." },
            source_updated_at: { type: "string", minLength: 1 },
            owner: { type: "string", minLength: 1 },
             revision: { type: ["string", "number", "null"], maxLength: 2048 },
            content_hash: { type: "string", minLength: 1 },
            locator: { type: "string", minLength: 1 },
            access_caveats: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 512 } },
             fields: sourceMetadataSchema(),
             metadata: sourceMetadataSchema(),
            raw_included: { type: "boolean", description: "Optional provenance metadata; raw bodies are never accepted." }
          }
        }
      },
      claims: {
        type: "array",
        maxItems: 5000,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            kind: { type: "string", enum: ["fact", "blocker", "risk", "unknown"] },
            state: { type: "string", enum: ["active", "superseded", "historical"], default: "active" },
            subject: { type: "string", minLength: 1 },
            value: {
              oneOf: [{ type: "string", maxLength: 2048 }, { type: "number" }, { type: "boolean" }]
            },
            text: { type: "string", minLength: 1, maxLength: 4096 },
            owner: { type: "string", minLength: 1 },
            due_at: { type: "string", minLength: 1 },
            mitigation: { type: "string", minLength: 1 },
            source_refs: {
              type: "array",
              maxItems: 20,
              items: {
                oneOf: [
                  { type: "string", minLength: 1, description: "Deprecated plain-string source reference; engine normalizes it and reports a deprecation finding." },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                       source_id: { type: "string", minLength: 1, maxLength: 2048 },
                       sourceId: { type: "string", minLength: 1, maxLength: 2048, description: "Deprecated alias for source_id." },
                       locator: { type: "string", minLength: 1, maxLength: 2048 },
                       note: { type: "string", minLength: 1, maxLength: 2048 },
                       path: { type: "string", minLength: 1, maxLength: 2048 },
                      url: { type: "string", minLength: 1 },
                      observed_at: { type: "string", minLength: 1 },
                      source_updated_at: { type: "string", minLength: 1 },
                       revision: { type: ["string", "number", "null"], maxLength: 2048 },
                       content_hash: { type: "string", minLength: 1 },
                       heading: { type: "string", minLength: 1, maxLength: 2048 },
                       tableRow: { type: "integer", minimum: 1 },
                       line: { type: "integer", minimum: 1 },
                    }
                  }
                ]
              }
            }
          }
        }
      },
      timeline: {
        type: "array",
        maxItems: 500,
        items: timelineItemsSchema()
      },
      baseline_timeline: {
        type: "array",
        maxItems: 500,
        items: timelineItemsSchema()
      }
    },
    "$defs": sourceMetadataDefinitions()
  };
}

function timelineItemsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1, maxLength: 2048 },
      title: { type: "string", minLength: 1, maxLength: 2048 },
      type: { type: "string", enum: ["task", "milestone"] },
      start: { type: "string", minLength: 1 },
      end: { type: "string", minLength: 1 },
      duration: { type: "string", minLength: 1, maxLength: 2048 },
      time_window: { type: "string", minLength: 1, maxLength: 2048 },
      date_text: { type: "string", minLength: 1, maxLength: 2048 },
      date_derivation: { type: "string", enum: ["explicit", "natural", "none"] },
      evidence_grade: { type: "string", enum: ["exact", "derived", "fuzzy", "missing"] },
      evidence_reason: { type: "string", minLength: 1, maxLength: 2048 },
      exact_date_needed: { type: "boolean" },
      missing_title: { type: "boolean" },
      dangerous_fields: { type: "array", items: { type: "string", minLength: 1 } },
      owner: { type: "string", minLength: 1, maxLength: 2048 },
      status: { type: "string", minLength: 1, maxLength: 2048 },
      dependencies: { type: "array", maxItems: 50, items: { type: "string", minLength: 1, maxLength: 2048 } },
      source_refs: {
        type: "array",
        maxItems: 20,
        items: {
          oneOf: [
            { type: "string", minLength: 1, description: "Deprecated plain-string source reference." },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                source_id: { type: "string", minLength: 1 },
                sourceId: { type: "string", minLength: 1, description: "Deprecated alias for source_id." },
                locator: { type: "string", minLength: 1 },
                note: { type: "string", minLength: 1 },
                path: { type: "string", minLength: 1 },
                url: { type: "string", minLength: 1 },
                observed_at: { type: "string", minLength: 1 },
                source_updated_at: { type: "string", minLength: 1 },
                 revision: { type: ["string", "number", "null"], maxLength: 2048 },
                 content_hash: { type: "string", minLength: 1 },
                 heading: { type: "string", minLength: 1 },
                 tableRow: { type: "integer", minimum: 1 },
                 line: { type: "integer", minimum: 1 },
              }
            }
          ]
        }
      }
    }
  };
}

function reviewOutputSchema() {
  return {
    type: "object",
    required: [
      "kind",
      "schema_version",
      "initiative",
      "as_of",
      "policy",
      "artifact_quality",
      "reported_program_health",
      "claim_health_floor",
      "program_health",
      "health_consistency",
      "summary",
      "sources",
      "claims",
      "findings",
      "recommended_actions"
    ],
    properties: {
      kind: { const: "truth_review" },
      schema_version: { type: "string" },
      initiative: { type: "object" },
      as_of: { type: "string" },
      policy: { type: "object" },
      artifact_quality: { type: "string", enum: ["pass", "needs_review", "fail"] },
      health_assessment: { type: "object" },
      reported_program_health: { type: ["string", "null"], enum: ["on_track", "at_risk", "blocked", "unknown", null] },
      claim_health_floor: { type: "string", enum: ["none", "at_risk", "blocked"] },
      program_health: { type: "string", enum: ["on_track", "at_risk", "blocked", "unknown"] },
      health_consistency: { type: "string", enum: ["consistent", "missing", "understated", "unsupported", "conflicting"] },
      summary: { type: "object" },
      sources: { type: "array", items: { type: "object" } },
      claims: { type: "array", items: { type: "object" } },
      timeline: { type: "array", items: { type: "object" } },
      timeline_drift: { type: "object" },
      findings: { type: "object" },
      recommended_actions: {
        type: "array",
        maxItems: 200,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "type", "action"],
          properties: {
            priority: { type: "string", enum: ["P0", "P1", "P2"] },
            type: { type: "string", enum: ["resolve_blocker", "reconcile_conflict", "fix_evidence", "mitigate_risk", "close_unknown", "improve_evidence"] },
            claim_id: { type: "string", minLength: 1 },
            subject: { type: "string", minLength: 1 },
            location: { type: "string", minLength: 1 },
            action: { type: "string", minLength: 1, maxLength: 4096 }
          }
        }
      }
    }
  };
}
