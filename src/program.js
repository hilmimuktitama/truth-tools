import { normalizeConflict, normalizeProgramStatus } from "./schemas.js";

export function reconcileProgram({ evidence_pack: evidencePack = {}, timeline = {}, notes = [] } = {}) {
  const sourceById = new Map((Array.isArray(evidencePack.sources) ? evidencePack.sources : []).map((source) => [source.id, source]));
  const claims = (Array.isArray(evidencePack.claims) ? evidencePack.claims : [])
    .filter((claim) => !isProgramNoiseClaim(claim, sourceById))
    .map((claim) => sanitizeProgramClaim(claim, sourceById));
  const timelineGaps = dedupeTimelineGaps(Array.isArray(timeline.gaps) ? timeline.gaps : []);
  const conflicts = [
    ...normalizeEvidenceConflicts(evidencePack.conflicts),
    ...normalizeTimelineConflicts(timeline.issues)
  ];

  const status = normalizeProgramStatus({
    confirmed_facts: claims.filter(isConfirmedFact).map(claimToStatusItem),
    blockers: claims.filter(isBlocker).map(claimToStatusItem),
    risks: claims.filter(isRisk).map(claimToStatusItem),
    unknowns: [
      ...claims.filter((claim) => !isBlocker(claim) && !isRisk(claim) && isUnknown(claim)).map(claimToStatusItem),
      ...timelineGaps.map((gap) => ({
        claim: `${gap.itemTitle ?? "Timeline item"}: ${gap.question ?? gap.field ?? "unknown"}`,
        source_refs: gap.source_refs ?? []
      }))
    ],
    conflicts,
    assumptions: [
      ...normalizeStrings(evidencePack.assumptions),
      ...normalizeStrings(timeline.assumptions),
      ...normalizeStrings(notes)
    ],
    recommended_write_back: {
      repo: [
        "Commit repo-safe-summary status, conflict list, unresolved unknowns, and recommended owner actions."
      ],
      tmp: [
        "Keep raw Jira/Confluence/Notion bodies, customer details, and internal evidence packs under .tmp/ or another non-repo location."
      ],
      systems_of_record: [
        "Write reconciled owner/date/status changes back to Jira, Confluence, or the source system after human review."
      ]
    }
  });

  return {
    ...status,
    confirmed_facts: dedupeStatusItems(status.confirmed_facts),
    blockers: dedupeStatusItems(status.blockers),
    risks: dedupeStatusItems(status.risks),
    unknowns: dedupeStatusItems(status.unknowns)
  };
}

function normalizeEvidenceConflicts(conflicts = []) {
  if (!Array.isArray(conflicts)) return [];
  return conflicts.map((conflict) => {
    if (conflict.claim && conflict.source_a && conflict.source_b) {
      return normalizeConflict(conflict);
    }
    return normalizeConflict({
      claim: conflict.message ?? conflict.type ?? "Evidence conflict",
      source_a: { system: "source-a", value: Array.isArray(conflict.claim_ids) ? conflict.claim_ids[0] : "unspecified" },
      source_b: { system: "source-b", value: Array.isArray(conflict.claim_ids) ? conflict.claim_ids[1] : "unspecified" },
      conflict_type: conflict.type
    });
  });
}

function normalizeTimelineConflicts(issues = []) {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((issue) => ["impossible_sequence", "circular_dependency"].includes(issue.type))
    .map((issue) =>
      normalizeConflict({
        claim: issue.message,
        source_a: { system: "timeline", value: issue.itemTitle ?? issue.items?.[0] ?? "timeline item" },
        source_b: { system: "timeline", value: issue.dependency ?? issue.items?.[1] ?? "dependency" },
        conflict_type: issue.type,
        recommended_owner_action:
          "Confirm the dependency order with the delivery owner and update the timeline source before publishing."
      })
    );
}

function dedupeTimelineGaps(gaps = []) {
  const seen = new Set();
  const deduped = [];

  for (const gap of gaps) {
    if (isMetadataGap(gap)) continue;
    const key = [
      String(gap.itemTitle ?? "Timeline item").toLowerCase(),
      String(gap.field ?? "unknown").toLowerCase(),
      String(gap.question ?? gap.message ?? "").toLowerCase()
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(gap);
  }

  return deduped;
}

function isMetadataGap(gap = {}) {
  const title = String(gap.itemTitle ?? "").trim().toLowerCase();
  return ["generated", "timezone", "time zone"].includes(title);
}

function isProgramNoiseClaim(claim, sourceById) {
  const text = claimText(claim);
  if (!text) return true;
  if (/^(?:generated|timezone|time\s*zone|project)\s*:/i.test(text)) return true;
  if (/^chunked\s+(?:estimate|objective|progress)\s+notes\b/i.test(text)) return true;
  if (isMarkdownTableSeparator(text)) return true;
  if (isMarkdownTableRow(text) && isMarkdownTableHeader(text, sourceForClaim(claim, sourceById))) return true;
  return false;
}

function sanitizeProgramClaim(claim, sourceById) {
  const source = sourceForClaim(claim, sourceById);
  const text = claimText(claim);
  const cleanedText = isMarkdownTableRow(text) ? cleanProfileTableClaim(text, source) : text;

  return {
    ...claim,
    text: cleanedText
  };
}

function cleanProfileTableClaim(text, source = {}) {
  const profile = source?.profile;
  if (!["estimate_table", "objective_table", "progress_table"].includes(profile)) return text;

  const cells = splitMarkdownTableRow(text);
  if (cells.length < 3) return text;

  const project = source?.metadata?.project || "Project";
  const chunk = cells[1] || "Note";
  const note = cells[2] || cells.at(-1);
  return `${project} ${chunk}: ${note}`;
}

function isMarkdownTableHeader(text, source = {}) {
  const cells = splitMarkdownTableRow(text).map((cell) => cell.toLowerCase());
  if (cells.length === 0) return false;
  if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return true;
  if (["estimate_table", "objective_table", "progress_table"].includes(source?.profile)) {
    return cells.some((cell) => cell === "note date") && cells.some((cell) => cell === "chunk");
  }
  return cells.some((cell) => ["project", "name", "title"].includes(cell)) && cells.some((cell) => /date|datetime|target|progress|objective/.test(cell));
}

function isMarkdownTableSeparator(text) {
  const cells = splitMarkdownTableRow(text);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isMarkdownTableRow(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function splitMarkdownTableRow(text) {
  return String(text ?? "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function sourceForClaim(claim, sourceById) {
  const sourceId = claim?.source_refs?.[0]?.source_id ?? claim?.source_refs?.[0]?.sourceId;
  return sourceById.get(sourceId) ?? {};
}

function claimToStatusItem(claim) {
  return {
    claim: redactSensitiveText(claim.text ?? claim.claim ?? String(claim)),
    source_refs: claim.source_refs ?? []
  };
}

function isConfirmedFact(claim) {
  return !isBlocker(claim) && !isRisk(claim) && !isUnknown(claim);
}

function isBlocker(claim) {
  const text = claimText(claim);
  return claim.classification === "blocker" || /\b(blocked|blocker|blocking)\b/i.test(text);
}

function isRisk(claim) {
  const text = claimText(claim);
  return claim.classification === "risk" || /\brisk\b/i.test(text);
}

function isUnknown(claim) {
  const text = claimText(claim);
  return claim.category === "unknown" || /\b(unknown|tbc|tbd|missing|unclear)\b/i.test(text);
}

function claimText(claim) {
  return String(claim.text ?? claim.claim ?? "");
}

function normalizeStrings(values) {
  return (Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim());
}

function redactSensitiveText(text) {
  return String(text)
    .replace(/\b(?:secret|token|password|api[_-]?key)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/\bAuthorization\s*:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "Authorization: [redacted]");
}

function dedupeStatusItems(values = []) {
  const seen = new Set();
  const deduped = [];

  for (const value of values) {
    const key = String(value.claim ?? value.text ?? value).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}
