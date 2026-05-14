import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEvidencePack, createTimeline } from "./dependencies.js";
import { renderForExportProfile } from "./exports.js";
import { listTruthTools } from "./mcp-tools.js";
import { reconcileProgram } from "./program.js";
import { normalizeConflict, normalizeTimelineItem } from "./schemas.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(ROOT, "..");

export function runDoctor() {
  const checks = [
    checkInstall(),
    checkSchema(),
    checkRender(),
    checkMcp()
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function checkInstall() {
  const required = [resolve(ROOT, "package.json")];
  const missing = required.filter((path) => !existsSync(path));
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  const missingDeps = ["capture-truth", "timeline-truth", "@modelcontextprotocol/sdk"].filter(
    (name) => !pkg.dependencies?.[name]
  );
  const runtimeLoaded = typeof createEvidencePack === "function" && typeof createTimeline === "function";

  return {
    name: "install",
    ok:
      missing.length === 0 &&
      missingDeps.length === 0 &&
      nodeMajor >= 22 &&
      Boolean(pkg.bin?.["truth-tools-mcp"]) &&
      runtimeLoaded,
    message:
      missing.length === 0 && missingDeps.length === 0 && runtimeLoaded
        ? `Node ${process.versions.node}; runtime truth packages available`
        : `Missing: ${[...missing, ...missingDeps].join(", ")}`
  };
}

function checkSchema() {
  const conflict = normalizeConflict({
    claim: "Start date",
    source_a: { system: "local", value: "2026-05-27" },
    source_b: { system: "jira", value: "2026-06-02" },
    conflict_type: "date_mismatch"
  });
  const timelineItem = normalizeTimelineItem({ title: "Phase 2", date_text: "TBC" });
  const programStatus = reconcileProgram({ evidence_pack: { claims: [], conflicts: [conflict] } });

  return {
    name: "schema",
    ok:
      conflict.recommended_owner_action.length > 0 &&
      timelineItem.date_status === "tbc" &&
      Array.isArray(programStatus.confirmed_facts),
    message: "Conflict, timeline unknown, and program-status schemas are available"
  };
}

function checkRender() {
  const evidencePack = createEvidencePack({
    sources: [
      {
        id: "doctor-note",
        type: "text",
        captured_at: "2026-05-14T00:00:00Z",
        freshness: "fresh",
        content: "Doctor smoke source."
      }
    ]
  });
  const timeline = createTimeline({
    sources: [
      {
        id: "doctor-plan",
        type: "text",
        content: "Smoke milestone milestone on 2026-06-01 owner TPM"
      }
    ]
  });
  const renderedEvidence = renderForExportProfile({ artifact: evidencePack, profile: "repo-safe-summary" });
  const renderedTimeline = renderForExportProfile({ artifact: timeline, profile: "repo-safe-summary" });

  return {
    name: "render",
    ok: renderedEvidence.content.includes("Evidence Pack") && renderedTimeline.content.includes("Timeline"),
    message: "Repo-safe evidence and timeline renders succeeded"
  };
}

function checkMcp() {
  const expected = [
    "capture.create",
    "capture.validate",
    "capture.render",
    "program.reconcile",
    "timeline.create",
    "timeline.validate",
    "timeline.render",
    "doctor.all"
  ];
  const actual = listTruthTools().map((tool) => tool.name);
  const missing = expected.filter((name) => !actual.includes(name));

  return {
    name: "mcp",
    ok: missing.length === 0,
    message: missing.length === 0 ? "Dotted MCP tool surface is available" : `Missing tools: ${missing.join(", ")}`
  };
}
