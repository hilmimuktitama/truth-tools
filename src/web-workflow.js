import { callTruthTool } from "./mcp-tools.js";
import { assertSafeExportContent } from "./exports.js";

export function parseSourceDrafts({ pasted = "", uploads = [], sources = [] } = {}) {
  if (Array.isArray(sources) && sources.length > 0) {
    return sources.map(normalizeSource).filter(Boolean);
  }

  const parsed = [];
  const pastedText = String(pasted ?? "").trim();
  if (pastedText) {
    parsed.push({
      id: "paste-1",
      type: "text",
      content: pastedText,
      freshness: "unknown"
    });
  }

  for (const upload of Array.isArray(uploads) ? uploads : []) {
    const content = String(upload?.content ?? "").trim();
    if (!content) continue;
    parsed.push({
      id: slugify(upload?.name ?? `upload-${parsed.length + 1}`),
      type: upload?.type ?? "text",
      content,
      freshness: upload?.freshness ?? "unknown"
    });
  }

  return parsed;
}

export function runReviewWorkflow(input = {}, { callTool = callTruthTool } = {}) {
  const sources = parseSourceDrafts(input);
  if (sources.length === 0) {
    throw new Error("At least one pasted or uploaded source is required.");
  }

  const notes = normalizeNotes(input.notes);
  const evidencePack = callTool("capture.create", { sources });
  const evidenceValidation = callTool("capture.validate", { evidence_pack: evidencePack });
  const timelineResult = callTool("timeline.create", { sources });
  const timeline = timelineResult.timeline ?? timelineResult;
  const timelineValidation = callTool("timeline.validate", { timeline });
  const programStatus = callTool("program.reconcile", {
    evidence_pack: evidencePack,
    timeline,
    notes
  });
  const evidenceSummary = callTool("capture.render", {
    evidence_pack: evidencePack,
    export_profile: "repo-safe-summary"
  });
  const timelineSummary = callTool("timeline.render", {
    timeline,
    export_profile: "repo-safe-summary"
  });
  const doctor = callTool("doctor.all", { all: true });

  const repoSafeSummary = renderRepoSafeReviewSummary({ evidenceSummary, timelineSummary, programStatus });
  assertSafeExportContent({ profile: "repo-safe-summary", content: repoSafeSummary });

  return {
    generatedAt: new Date().toISOString(),
    inputs: {
      sourceCount: sources.length,
      notes
    },
    evidencePack,
    evidenceValidation,
    timeline,
    timelineValidation,
    programStatus,
    repoSafeSummary,
    doctor,
    metrics: summarizeReview({ sources, evidencePack, evidenceValidation, timeline, timelineValidation, programStatus })
  };
}

function normalizeSource(source) {
  if (!source || typeof source !== "object") return null;
  const content = String(source.content ?? "").trim();
  if (!content) return null;
  return {
    ...source,
    id: source.id ? String(source.id) : slugify(source.name ?? "source"),
    type: source.type ?? "text",
    content,
    freshness: source.freshness ?? "unknown"
  };
}

function normalizeNotes(notes = []) {
  if (Array.isArray(notes)) {
    return notes.map((note) => String(note).trim()).filter(Boolean);
  }

  const text = String(notes ?? "").trim();
  return text ? text.split(/\r?\n/).map((note) => note.trim()).filter(Boolean) : [];
}

function summarizeReview({ sources, evidencePack, evidenceValidation, timeline, timelineValidation, programStatus }) {
  return {
    sources: sources.length,
    claims: Array.isArray(evidencePack.claims) ? evidencePack.claims.length : 0,
    evidenceGaps: countArray(evidenceValidation.gaps),
    evidenceConflicts: countArray(evidencePack.conflicts) + countArray(evidenceValidation.conflicts),
    timelineItems: countArray(timeline.items),
    timelineGaps: countArray(timeline.gaps) + countArray(timelineValidation.gaps),
    programUnknowns: countArray(programStatus.unknowns),
    programConflicts: countArray(programStatus.conflicts)
  };
}

function renderRepoSafeReviewSummary({ evidenceSummary, timelineSummary, programStatus }) {
  const lines = [
    String(evidenceSummary).trim(),
    "",
    String(timelineSummary).trim(),
    "",
    "## Program Status",
    ...renderStatusList("Confirmed facts", programStatus.confirmed_facts),
    ...renderStatusList("Blockers", programStatus.blockers),
    ...renderStatusList("Risks", programStatus.risks),
    ...renderStatusList("Unknowns", programStatus.unknowns),
    ...renderStatusList("Conflicts", programStatus.conflicts?.map((conflict) => conflict.claim)),
    "",
    "## Recommended Write-back",
    ...renderStatusList("Repo", programStatus.recommended_write_back?.repo),
    ...renderStatusList("Temporary local storage", programStatus.recommended_write_back?.tmp),
    ...renderStatusList("Systems of record", programStatus.recommended_write_back?.systems_of_record)
  ];

  return `${lines.filter((line) => line !== undefined).join("\n")}\n`;
}

function renderStatusList(title, values = []) {
  const entries = Array.isArray(values) ? values : [];
  if (entries.length === 0) {
    return [`### ${title}`, "- None captured."];
  }

  return [
    `### ${title}`,
    ...entries.map((entry) => {
      if (typeof entry === "string") return `- ${entry}`;
      return `- ${entry.claim ?? entry.text ?? JSON.stringify(entry)}`;
    })
  ];
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function slugify(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "source";
}
