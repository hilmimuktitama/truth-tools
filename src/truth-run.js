import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createEvidencePack, createTimeline, validateEvidencePack, validateTimeline } from "./dependencies.js";
import { renderForExportProfile } from "./exports.js";
import { reconcileProgram } from "./program.js";
import { normalizeTimeline } from "./schemas.js";
import { attachSourceMetadata, normalizeSourceInput, SOURCE_PROFILES } from "./source-normalization.js";

const DEFAULT_RAW_LOCAL_PATH = ".truth-tools/runs";

export function runTruthReview(input = {}) {
  const createdAt = stringOr(input.created_at ?? input.createdAt, new Date().toISOString());
  const initiative = normalizeInitiative(input.initiative);
  const id = stringOr(input.id, `truth-run-${slugify(initiative.name || "review")}-${slugify(createdAt)}`);
  const notes = normalizeNotes(input.notes);
  const sourceInput = normalizeSourceInput(
    {
      ...input,
      captured_at: createdAt
    },
    { forTimeline: false }
  );
  const sources = Array.isArray(sourceInput.sources) ? sourceInput.sources : [];

  if (sources.length === 0) {
    throw new Error("truth.run requires at least one source.");
  }

  const agentSteps = [];
  const rawLocalPath = stringOr(input.raw_local_path ?? input.rawLocalPath, `${DEFAULT_RAW_LOCAL_PATH}/${id}/raw-local`);

  const captureStep = startStep("capture", "Create evidence pack", "capture.create", createdAt);
  const evidencePack = attachSourceMetadata(createEvidencePack({ ...sourceInput, sources }), sources);
  const evidenceValidation = validateEvidencePack(evidencePack);
  completeStep(captureStep, createdAt);
  agentSteps.push(captureStep);

  const timelineStep = startStep("timeline", "Create evidence timeline", "timeline.create", createdAt);
  const timelineResult = createTimeline(normalizeSourceInput({ ...input, captured_at: createdAt, sources }, { forTimeline: true }));
  const timeline = normalizeTimeline(timelineResult.timeline ?? timelineResult);
  const timelineValidation = validateTimeline(timeline);
  completeStep(timelineStep, createdAt);
  agentSteps.push(timelineStep);

  const programStep = startStep("program", "Reconcile program status", "program.reconcile", createdAt);
  const programStatus = reconcileProgram({
    evidence_pack: evidencePack,
    timeline,
    notes
  });
  completeStep(programStep, createdAt);
  agentSteps.push(programStep);

  const renderStep = startStep("repo_safe_summary", "Render repo-safe summary", "capture.render + timeline.render", createdAt);
  const evidenceSummary = renderForExportProfile({
    artifact: evidencePack,
    profile: "repo-safe-summary",
    includeClaims: false
  }).content;
  const timelineSummary = renderForExportProfile({
    artifact: { timeline },
    profile: "repo-safe-summary"
  }).content;
  const repoSafeSummary = renderRepoSafeSummary({ evidenceSummary, timelineSummary, programStatus });
  completeStep(renderStep, createdAt);
  agentSteps.push(renderStep);

  const metrics = summarizeRun({
    sources,
    evidencePack,
    evidenceValidation,
    timeline,
    timelineValidation,
    programStatus
  });
  const quality = evaluateQuality({
    sources,
    evidenceValidation,
    timeline,
    timelineValidation,
    programStatus
  });

  return {
    id,
    created_at: createdAt,
    initiative,
    sources: sources.map(sourceSummary),
    agent_steps: agentSteps,
    artifacts: {
      evidence_pack: stripRawContent(evidencePack),
      evidence_validation: evidenceValidation,
      timeline: stripRawContent(timeline),
      timeline_validation: stripRawContent(timelineValidation),
      program_status: stripRawContent(programStatus)
    },
    metrics,
    quality,
    repo_safe_summary: repoSafeSummary,
    raw_local_policy: {
      mode: "raw-local-only",
      path: rawLocalPath
    }
  };
}

export function writeTruthRunOutputs(run, input = {}, outDir) {
  if (!outDir) return run;

  const resolvedOutDir = resolve(outDir);
  const rawLocalPath = join(resolvedOutDir, "raw-local");
  const sourcesDir = join(rawLocalPath, "sources");
  mkdirSync(sourcesDir, { recursive: true });

  const savedRun = {
    ...run,
    raw_local_policy: {
      ...run.raw_local_policy,
      path: rawLocalPath
    }
  };

  for (const source of Array.isArray(input.sources) ? input.sources : []) {
    const id = slugify(source.id ?? source.name ?? "source");
    const extension = sourceExtension(source);
    writeFileSync(join(sourcesDir, `${id}.${extension}`), String(source.content ?? ""), "utf8");
  }

  writeFileSync(join(resolvedOutDir, "truth_run.json"), `${JSON.stringify(savedRun, null, 2)}\n`, "utf8");
  writeFileSync(join(resolvedOutDir, "repo-safe-summary.md"), savedRun.repo_safe_summary, "utf8");
  return savedRun;
}

function normalizeInitiative(initiative = {}) {
  return {
    name: stringOr(initiative.name, "Untitled initiative"),
    owner: stringOr(initiative.owner, "unknown"),
    objective: stringOr(initiative.objective, "Reconstruct program truth.")
  };
}

function normalizeNotes(notes = []) {
  if (Array.isArray(notes)) return notes.map((note) => String(note).trim()).filter(Boolean);
  const text = String(notes ?? "").trim();
  return text ? text.split(/\r?\n/).map((note) => note.trim()).filter(Boolean) : [];
}

function startStep(id, title, tool, timestamp) {
  return {
    id,
    title,
    tool,
    status: "running",
    started_at: timestamp
  };
}

function completeStep(step, timestamp) {
  step.status = "complete";
  step.completed_at = timestamp;
}

function sourceSummary(source = {}) {
  const { content, ...summary } = source;
  return summary;
}

function summarizeRun({ sources, evidencePack, evidenceValidation, timeline, timelineValidation, programStatus }) {
  return {
    sources: sources.length,
    claims: countArray(evidencePack.claims),
    evidence_gaps: countArray(evidenceValidation.gaps),
    evidence_conflicts: countArray(evidencePack.conflicts) + countArray(evidenceValidation.conflicts),
    timeline_items: countArray(timeline.items),
    timeline_gaps: countArray(timeline.gaps) + countArray(timelineValidation.gaps),
    program_unknowns: countArray(programStatus.unknowns),
    program_conflicts: countArray(programStatus.conflicts)
  };
}

function evaluateQuality({ sources, evidenceValidation, timeline, timelineValidation, programStatus }) {
  const warnings = [];
  const blockingGaps = [];

  for (const source of sources) {
    if (!source.profile || source.profile === "unknown") {
      warnings.push({
        type: "source_profile_missing",
        source_id: source.id,
        message: `Source '${source.id}' has no agent source profile.`
      });
    } else if (!SOURCE_PROFILES.includes(source.profile)) {
      warnings.push({
        type: "source_profile_unsupported",
        source_id: source.id,
        profile: source.profile,
        message: `Source '${source.id}' uses unsupported profile '${source.profile}'.`
      });
    }
  }

  for (const gap of [...arrayOf(timeline.gaps), ...arrayOf(timelineValidation.gaps)]) {
    if (!["start", "end", "exact_date", "owner"].includes(gap.field)) continue;
    blockingGaps.push({
      type: "timeline_gap",
      item_title: gap.itemTitle,
      field: gap.field,
      question: gap.question
    });
  }

  for (const gap of arrayOf(evidenceValidation.gaps)) {
    if (!["missing_source_identity", "missing_captured_at", "duplicate_source_id"].includes(gap.type)) continue;
    blockingGaps.push({
      type: gap.type,
      source_id: gap.source_id,
      question: gap.message
    });
  }

  const conflicts = countArray(programStatus.conflicts);
  const readiness = conflicts > 0 || blockingGaps.some((gap) => gap.type === "missing_source_identity")
    ? "blocked"
    : blockingGaps.length > 0 || warnings.length > 0
      ? "needs_review"
      : "ready";

  return {
    readiness,
    blocking_gaps: dedupeBy(blockingGaps, (gap) =>
      [gap.type, gap.item_title, gap.source_id, gap.field, gap.question].map((value) => String(value ?? "").toLowerCase()).join("|")
    ),
    warnings: dedupeBy(warnings, (warning) =>
      [warning.type, warning.source_id, warning.profile].map((value) => String(value ?? "").toLowerCase()).join("|")
    )
  };
}

function renderRepoSafeSummary({ evidenceSummary, timelineSummary, programStatus }) {
  const lines = [
    "# Repo-safe Summary",
    "",
    trimHeading(evidenceSummary),
    "",
    trimHeading(timelineSummary),
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
  if (entries.length === 0) return [`### ${title}`, "- None captured."];

  return [
    `### ${title}`,
    ...entries.map((entry) => {
      if (typeof entry === "string") return `- ${entry}`;
      return `- ${entry.claim ?? entry.text ?? JSON.stringify(entry)}`;
    })
  ];
}

function trimHeading(value) {
  return String(value ?? "").replace(/^# Repo-safe Summary\s*/i, "").trim();
}

function stripRawContent(value) {
  if (Array.isArray(value)) return value.map(stripRawContent);
  if (typeof value === "string") return redactSensitiveText(value);
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "content") {
      next.content_redacted = true;
      continue;
    }
    next[key] = stripRawContent(entry);
  }
  return next;
}

function redactSensitiveText(value) {
  return String(value)
    .replace(/\b(?:secret|token|password|api[_-]?key)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/\bAuthorization\s*:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "Authorization: [redacted]");
}

function sourceExtension(source = {}) {
  const type = String(source.type ?? "").toLowerCase();
  const name = String(source.name ?? source.path ?? "").toLowerCase();
  if (type.includes("markdown") || name.endsWith(".md")) return "md";
  if (type.includes("json") || name.endsWith(".json")) return "json";
  if (type.includes("csv") || name.endsWith(".csv")) return "csv";
  return "txt";
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function dedupeBy(values, keyFn) {
  const seen = new Set();
  const deduped = [];

  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

function stringOr(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function slugify(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "truth-run";
}
