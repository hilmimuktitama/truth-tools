import {
  createTimeline,
  createEvidencePack,
  renderEvidencePack,
  renderTimeline,
  validateEvidencePack,
  validateTimeline
} from "./dependencies.js";

import { runDoctor } from "./doctor.js";
import { renderForExportProfile } from "./exports.js";
import { reconcileProgram } from "./program.js";
import { normalizeTimeline } from "./schemas.js";

export function listTruthTools() {
  return [
    {
      name: "capture.create",
      description: "Create an evidence pack from pasted, local, or adapter-produced sources.",
      inputSchema: sourceInputSchema()
    },
    {
      name: "capture.validate",
      description: "Validate an evidence pack for source, freshness, reference, and conflict gaps.",
      inputSchema: evidencePackInputSchema()
    },
    {
      name: "capture.render",
      description: "Render an evidence pack using a repo-safe, internal, or raw-local export profile.",
      inputSchema: renderEvidenceInputSchema()
    },
    {
      name: "program.reconcile",
      description: "Reconcile captured evidence and timelines into a standard program-status object.",
      inputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          evidence_pack: { type: "object", additionalProperties: true },
          timeline: { type: "object", additionalProperties: true },
          notes: { type: "array", items: { type: "string" } }
        }
      }
    },
    {
      name: "timeline.create",
      description: "Create a normalized evidence-preserving timeline from planning sources.",
      inputSchema: sourceInputSchema()
    },
    {
      name: "timeline.validate",
      description: "Validate a normalized timeline for unknowns, missing fields, and dependency issues.",
      inputSchema: {
        type: "object",
        required: ["timeline"],
        additionalProperties: false,
        properties: {
          timeline: { type: "object", additionalProperties: true }
        }
      }
    },
    {
      name: "timeline.render",
      description: "Render a timeline as Mermaid, Markdown, or export-profile-safe summary.",
      inputSchema: {
        type: "object",
        required: ["timeline"],
        additionalProperties: false,
        properties: {
          timeline: { type: "object", additionalProperties: true },
          format: { type: "string", enum: ["mermaid_gantt", "mermaid_timeline", "markdown"], default: "mermaid_gantt" },
          export_profile: { type: "string", enum: ["repo-safe-summary", "internal-evidence-pack", "raw-local-only"] }
        }
      }
    },
    {
      name: "doctor.all",
      description: "Smoke-test install, schema, render, and MCP tool-surface availability.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          all: { type: "boolean", default: true }
        }
      }
    }
  ];
}

export function callTruthTool(name, args = {}) {
  switch (name) {
    case "capture.create":
      return createEvidencePack(args);
    case "capture.validate":
      return validateEvidencePack(args.evidence_pack ?? args);
    case "capture.render":
      return renderCapture(args);
    case "program.reconcile":
      return reconcileProgram(args);
    case "timeline.create":
      return normalizeTimelineResult(createTimeline(args));
    case "timeline.validate":
      return validateTimeline(normalizeTimeline(args.timeline));
    case "timeline.render":
      return renderTimelineResult(args);
    case "doctor.all":
      return runDoctor({ all: true });
    default:
      throw new Error(`Unknown truth tool: ${name}`);
  }
}

export function callTruthToolForMcp(name, args = {}) {
  const result = callTruthTool(name, args);
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function renderCapture(args) {
  const evidencePack = args.evidence_pack ?? args;
  if (args.export_profile) {
    return renderForExportProfile({
      artifact: evidencePack,
      profile: args.export_profile,
      includeClaims: args.export_profile !== "repo-safe-summary"
    }).content;
  }
  return renderEvidencePack(evidencePack, { format: args.format ?? "markdown" });
}

function normalizeTimelineResult(result) {
  return {
    ...result,
    timeline: normalizeTimeline(result.timeline)
  };
}

function renderTimelineResult(args) {
  const timeline = normalizeTimeline(args.timeline);
  if (args.export_profile) {
    return renderForExportProfile({
      artifact: { timeline },
      profile: args.export_profile
    }).content;
  }
  return renderTimeline(timeline, { format: args.format });
}

function sourceInputSchema() {
  return {
    type: "object",
    required: ["sources"],
    additionalProperties: true,
    properties: {
      sources: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["content"],
          additionalProperties: true
        }
      }
    }
  };
}

function evidencePackInputSchema() {
  return {
    type: "object",
    required: ["evidence_pack"],
    additionalProperties: false,
    properties: {
      evidence_pack: { type: "object", additionalProperties: true }
    }
  };
}

function renderEvidenceInputSchema() {
  return {
    type: "object",
    required: ["evidence_pack"],
    additionalProperties: false,
    properties: {
      evidence_pack: { type: "object", additionalProperties: true },
      format: { type: "string", enum: ["markdown", "json"], default: "markdown" },
      export_profile: { type: "string", enum: ["repo-safe-summary", "internal-evidence-pack", "raw-local-only"] }
    }
  };
}
