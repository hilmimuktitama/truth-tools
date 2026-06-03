export const EXPORT_PROFILES = ["repo-safe-summary", "internal-evidence-pack", "raw-local-only"];

export const PROGRAM_STATUS_SECTIONS = [
  "kind",
  "schema_version",
  "confirmed_facts",
  "blockers",
  "risks",
  "unknowns",
  "conflicts",
  "readiness_reasons",
  "assumptions",
  "recommended_write_back"
];

const DATE_STATUS_VALUES = new Set(["exact", "range", "earliest", "tbc", "conflicting"]);
const BLOCKS_NEXT_VALUES = new Set(["true", "false", "unknown"]);

export function normalizeConflict(conflict = {}) {
  return {
    claim: stringOrDefault(conflict.claim, conflict.message || "Unspecified conflicting claim"),
    source_a: normalizeConflictSource(conflict.source_a ?? conflict.sourceA ?? conflict.left),
    source_b: normalizeConflictSource(conflict.source_b ?? conflict.sourceB ?? conflict.right),
    conflict_type: stringOrDefault(conflict.conflict_type ?? conflict.type, "source_conflict"),
    recommended_owner_action: stringOrDefault(
      conflict.recommended_owner_action,
      "Assign an owner to reconcile the source disagreement and update the system of record."
    )
  };
}

export function normalizeTimelineItem(item = {}) {
  const dateStatus = normalizeDateStatus(item);
  return {
    ...item,
    date_status: dateStatus,
    blocks_next_milestone: normalizeBlocksNextMilestone(item.blocks_next_milestone),
    start: dateStatus === "tbc" && !item.start ? undefined : item.start,
    end: dateStatus === "tbc" && !item.end ? undefined : item.end
  };
}

export function normalizeTimeline(timeline = {}) {
  return {
    ...timeline,
    items: Array.isArray(timeline.items) ? timeline.items.map(normalizeTimelineItem) : [],
    milestones: Array.isArray(timeline.milestones) ? timeline.milestones.map(normalizeTimelineItem) : [],
    assumptions: Array.isArray(timeline.assumptions) ? timeline.assumptions : [],
    gaps: Array.isArray(timeline.gaps) ? timeline.gaps : [],
    issues: Array.isArray(timeline.issues) ? timeline.issues : []
  };
}

export function normalizeProgramStatus(status = {}) {
  return {
    kind: status.kind || "program_status",
    schema_version: status.schema_version || "0.2.0",
    confirmed_facts: normalizeArray(status.confirmed_facts),
    blockers: normalizeArray(status.blockers),
    risks: normalizeArray(status.risks),
    unknowns: normalizeArray(status.unknowns),
    conflicts: normalizeArray(status.conflicts).map(normalizeConflict),
    readiness_reasons: normalizeArray(status.readiness_reasons),
    assumptions: normalizeArray(status.assumptions),
    recommended_write_back: {
      repo: normalizeArray(status.recommended_write_back?.repo),
      tmp: normalizeArray(status.recommended_write_back?.tmp),
      systems_of_record: normalizeArray(status.recommended_write_back?.systems_of_record)
    }
  };
}

export function assertExportProfile(profile = "repo-safe-summary") {
  if (!EXPORT_PROFILES.includes(profile)) {
    throw new Error(`Unsupported export profile: ${profile}`);
  }
  return profile;
}

function normalizeDateStatus(item) {
  if (DATE_STATUS_VALUES.has(item.date_status)) return item.date_status;
  if (item.conflicting || item.conflicts?.length > 0) return "conflicting";
  if (item.time_window && item.start && item.end) return "range";
  if (item.start && !item.end && !item.duration) return "earliest";
  if (item.start || item.end || item.duration) return "exact";

  const dateText = String(item.date_text ?? item.time_window ?? "").trim().toLowerCase();
  if (["tbc", "tbd", "unknown", ""].includes(dateText)) return "tbc";
  return "tbc";
}

function normalizeBlocksNextMilestone(value) {
  if (value === true) return true;
  if (value === false) return false;
  const normalized = String(value ?? "unknown").toLowerCase();
  return BLOCKS_NEXT_VALUES.has(normalized) ? normalized : "unknown";
}

function normalizeConflictSource(source = {}) {
  if (typeof source === "string") {
    return { system: "unknown", value: source };
  }
  return compactObject({
    system: stringOrDefault(source.system ?? source.source ?? source.id, "unknown"),
    value: stringOrDefault(source.value ?? source.claim ?? source.text, "unspecified"),
    captured_at: source.captured_at,
    freshness: source.freshness
  });
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stringOrDefault(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
