import { normalizeConflict, normalizeProgramStatus } from "./schemas.js";

export function reconcileProgram({ evidence_pack: evidencePack = {}, timeline = {}, notes = [] } = {}) {
  const claims = Array.isArray(evidencePack.claims) ? evidencePack.claims : [];
  const timelineGaps = Array.isArray(timeline.gaps) ? timeline.gaps : [];
  const conflicts = [
    ...normalizeEvidenceConflicts(evidencePack.conflicts),
    ...normalizeTimelineConflicts(timeline.issues)
  ];

  const status = normalizeProgramStatus({
    confirmed_facts: claims.filter(isConfirmedFact).map(claimToStatusItem),
    blockers: claims.filter(isBlocker).map(claimToStatusItem),
    risks: claims.filter(isRisk).map(claimToStatusItem),
    unknowns: [
      ...claims.filter(isUnknown).map(claimToStatusItem),
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

  return status;
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

function claimToStatusItem(claim) {
  return {
    claim: claim.text ?? claim.claim ?? String(claim),
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
