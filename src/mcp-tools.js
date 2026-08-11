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
    type: "object",
    required: ["as_of"],
    additionalProperties: false,
    properties: {
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
            revision: {},
            content_hash: { type: "string", minLength: 1 },
            locator: { type: "string", minLength: 1 },
            access_caveats: { type: "array", items: { type: "string", minLength: 1 } },
            fields: { type: "object" },
            metadata: { type: "object" },
            raw_included: { type: "boolean", description: "Optional provenance metadata; raw bodies are never accepted." }
          }
        }
      },
      claims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            kind: { type: "string", enum: ["fact", "blocker", "risk", "unknown"] },
            state: { type: "string", enum: ["active", "superseded", "historical"], default: "active" },
            subject: { type: "string", minLength: 1 },
            value: {
              oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }]
            },
            text: { type: "string", minLength: 1 },
            owner: { type: "string", minLength: 1 },
            due_at: { type: "string", minLength: 1 },
            mitigation: { type: "string", minLength: 1 },
            source_refs: {
              type: "array",
              items: {
                oneOf: [
                  { type: "string", minLength: 1, description: "Deprecated plain-string source reference; engine normalizes it and reports a deprecation finding." },
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
                      revision: {},
                       content_hash: { type: "string", minLength: 1 },
                       heading: { type: "string", minLength: 1 },
                       tableRow: { type: "integer", minimum: 1 },
                       line: { type: "integer", minimum: 1 },
                       text: { type: "string", minLength: 1 }
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
        items: timelineItemsSchema()
      },
      baseline_timeline: {
        type: "array",
        items: timelineItemsSchema()
      }
    }
  };
}

function timelineItemsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["task", "milestone"] },
      start: { type: "string", minLength: 1 },
      end: { type: "string", minLength: 1 },
      duration: { type: "string", minLength: 1 },
      time_window: { type: "string", minLength: 1 },
      date_text: { type: "string", minLength: 1 },
      date_derivation: { type: "string", enum: ["explicit", "natural", "none"] },
      evidence_grade: { type: "string", enum: ["exact", "derived", "fuzzy", "missing"] },
      evidence_reason: { type: "string", minLength: 1 },
      exact_date_needed: { type: "boolean" },
      missing_title: { type: "boolean" },
      dangerous_fields: { type: "array", items: { type: "string", minLength: 1 } },
      owner: { type: "string", minLength: 1 },
      status: { type: "string", minLength: 1 },
      dependencies: { type: "array", items: { type: "string", minLength: 1 } },
      source_refs: {
        type: "array",
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
                revision: {},
                 content_hash: { type: "string", minLength: 1 },
                 heading: { type: "string", minLength: 1 },
                 tableRow: { type: "integer", minimum: 1 },
                 line: { type: "integer", minimum: 1 },
                 text: { type: "string", minLength: 1 }
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
      "program_health",
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
      program_health: { type: "string", enum: ["on_track", "at_risk", "blocked", "unknown"] },
      summary: { type: "object" },
      sources: { type: "array", items: { type: "object" } },
      claims: { type: "array", items: { type: "object" } },
      timeline: { type: "array", items: { type: "object" } },
      timeline_drift: { type: "object" },
      findings: { type: "object" },
      recommended_actions: { type: "array", items: { type: "object" } }
    }
  };
}
