import { renderReviewMarkdown } from "./report.js";
import { doctorTruthTools, reviewTruth } from "./review.js";

export function listTruthTools() {
  return [
    {
      name: "truth.review",
      title: "Review project-status evidence",
      description: "Check a structured project-status artifact for citation integrity, stale sources, contradictions, blockers, risks, and unknowns.",
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
  return {
    type: "object",
    required: ["as_of", "sources", "claims"],
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
          max_source_age_days: { type: "integer", minimum: 0, default: 14 }
        }
      },
      sources: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["id", "captured_at"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            type: { type: "string", minLength: 1 },
            url: { type: "string", minLength: 1 },
            captured_at: { type: "string", minLength: 1 },
            owner: { type: "string", minLength: 1 }
          }
        }
      },
      claims: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["id", "kind", "text", "source_refs"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            kind: { type: "string", enum: ["fact", "blocker", "risk", "unknown"] },
            subject: { type: "string", minLength: 1 },
            value: {
              oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }]
            },
            text: { type: "string", minLength: 1 },
            owner: { type: "string", minLength: 1 },
            due_at: { type: "string", minLength: 1 },
            source_refs: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
          }
        }
      }
    }
  };
}

function reviewOutputSchema() {
  return {
    type: "object",
    required: ["kind", "schema_version", "initiative", "as_of", "policy", "readiness", "summary", "sources", "claims", "findings", "recommended_actions"],
    properties: {
      kind: { const: "truth_review" },
      schema_version: { type: "string" },
      initiative: { type: "object" },
      as_of: { type: "string" },
      policy: { type: "object" },
      readiness: { type: "string", enum: ["ready", "needs_review", "blocked"] },
      summary: { type: "object" },
      sources: { type: "array", items: { type: "object" } },
      claims: { type: "array", items: { type: "object" } },
      findings: { type: "object" },
      recommended_actions: { type: "array", items: { type: "object" } }
    }
  };
}
