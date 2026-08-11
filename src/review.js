import { CLAIM_KINDS, SCHEMA_VERSION } from "./contracts.js";
import {
  TOP_LEVEL_FIELDS,
  canonicalValue,
  compactObject,
  isObject,
  issue,
  normalizeClaimsInput,
  normalizeCollection,
  normalizeDate,
  normalizeInitiative,
  normalizePolicy,
  normalizeSource,
  normalizeTimelineItems,
  optionalString,
  reportUnsupportedFields,
  trimTerminalPunctuation,
  unique,
  uniqueBy,
  uniqueIssues,
  humanDate
} from "./normalize.js";
import { timelineDiff } from "./timeline-diff.js";

export function reviewTruth(input = {}) {
  assertObject(input, "Input must be a JSON object.");
  if (!input.as_of) throw new Error("as_of is required so evidence-age checks are reproducible.");

  const issues = [];
  const deprecations = [];
  reportUnsupportedFields(input, TOP_LEVEL_FIELDS, "unsupported_top_level_field", "input", issues);

  const asOf = normalizeDate(input.as_of, "as_of");
  const policy = normalizePolicy(input.policy, issues, deprecations);
  const initiative = normalizeInitiative(input.initiative, issues);
  const sourceResult = normalizeSources(input.sources, { asOf, policy, issues, deprecations });
  const claims = normalizeClaimsInput(input.claims, {
    sourceIds: sourceResult.sourceIds,
    issues,
    deprecations
  });
  const conflicts = findConflicts(claims);
  const timeline = normalizeTimelineItems(input.timeline, issues, deprecations);
  const baselineTimeline = normalizeTimelineItems(input.baseline_timeline, issues, deprecations);

  let timelineDrift;
  if (input.baseline_timeline !== undefined && input.timeline !== undefined) {
    timelineDrift = timelineDiff(baselineTimeline, timeline);
  }

  // Program health and contradiction checks consider only active claims;
  // superseded and historical claims are reported but never judged.
  const activeClaims = claims.filter((claim) => claim.state === "active");

  const facts = claims.filter((claim) => claim.kind === "fact");
  const blockers = claims.filter((claim) => claim.kind === "blocker");
  const risks = claims.filter((claim) => claim.kind === "risk");
  const unknowns = claims.filter((claim) => claim.kind === "unknown");

  const artifactQuality = determineArtifactQuality({ conflicts, issues });
  const programHealth = determineProgramHealth(activeClaims);

  return {
    kind: "truth_review",
    schema_version: SCHEMA_VERSION,
    initiative,
    as_of: asOf,
    policy,
    artifact_quality: artifactQuality,
    program_health: programHealth,
    summary: {
      sources: sourceResult.sources.length,
      claims: claims.length,
      facts: facts.length,
      blockers: blockers.length,
      risks: risks.length,
      unknowns: unknowns.length,
      conflicts: conflicts.length,
      issues: issues.length,
      deprecations: deprecations.length
    },
    sources: sourceResult.sources,
    claims,
    ...(timeline.length > 0 ? { timeline } : {}),
    ...(timelineDrift ? { timeline_drift: timelineDrift } : {}),
    findings: {
      facts,
      blockers,
      risks,
      unknowns,
      conflicts,
      issues,
      deprecations
    },
    recommended_actions: recommendActions({ blockers, risks, unknowns, conflicts, issues })
  };
}

export function doctorTruthTools() {
  const sample = reviewTruth({
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Doctor sample" },
    sources: [
      {
        id: "status-note",
        type: "note",
        observed_at: "2026-08-10T00:00:00.000Z"
      }
    ],
    claims: [
      {
        id: "claim-1",
        kind: "fact",
        subject: "release.scope",
        value: "phase-1",
        text: "Phase 1 is the current release scope.",
        source_refs: [{ source_id: "status-note", locator: "https://example.com/notes/status" }]
      }
    ]
  });

  const reviewOk = sample.artifact_quality === "pass" && sample.program_health === "on_track" && sample.summary.facts === 1;
  const rawPolicyOk = sample.findings.issues.every((item) => item.type !== "raw_source_content");
  const schemaVersionOk = sample.schema_version === SCHEMA_VERSION;
  const locatorOk = sample.claims[0].source_refs.every((ref) => Boolean(ref.locator));

  return {
    ok: reviewOk && rawPolicyOk && schemaVersionOk && locatorOk,
    checks: [
      { name: "review", ok: reviewOk, message: "Deterministic review completed with pass quality and on-track health." },
      { name: "raw-content-policy", ok: rawPolicyOk, message: "Structured sources contain metadata only." },
      { name: "schema-version", ok: schemaVersionOk, message: `Review output carries schema_version ${SCHEMA_VERSION}.` },
      { name: "source-ref-locator", ok: locatorOk, message: "Reviewed claims cite source_refs with a concrete locator." }
    ]
  };
}

function normalizeSources(sources, { asOf, policy, issues, deprecations }) {
  const values = normalizeCollection(sources, "sources", issues);
  const seen = new Set();
  const sourceIds = new Set();
  const normalized = [];

  if (values.length === 0) {
    issues.push(issue("no_sources", "blocking", "sources", "Add at least one source record."));
  }

  values.forEach((source, index) => {
    const location = `sources[${index}]`;
    // A source id is known to the artifact even when the source itself fails
    // normalization (raw body, missing timestamp): citation integrity checks
    // the reference, not the source's fitness.
    const rawId = isObject(source) ? optionalString(source.id) ?? optionalString(source.sourceId) : undefined;
    if (rawId) {
      if (seen.has(rawId)) {
        issues.push(issue("duplicate_source_id", "blocking", location, `Source id '${rawId}' is duplicated.`));
      } else {
        seen.add(rawId);
        sourceIds.add(rawId);
      }
    }

    const normalizedSource = normalizeSource(source, { index, asOf, policy, issues, deprecations });
    if (!normalizedSource) return;
    normalized.push(normalizedSource);
  });

  return { sources: normalized, sourceIds };
}

function findConflicts(claims) {
  const bySubject = new Map();

  // Active contradiction checks apply only to active fact claims that carry a
  // normalized subject and a typed scalar value. A blocker or risk sharing a
  // subject with a fact is a health signal, not a contradiction; superseded
  // and historical claims are reported but never judged.
  for (const claim of claims) {
    if (claim.kind !== "fact") continue;
    if (claim.state !== "active") continue;
    if (!claim.subject || claim.value === undefined) continue;
    const key = claim.subject.trim().toLowerCase();
    const entries = bySubject.get(key) ?? [];
    entries.push(claim);
    bySubject.set(key, entries);
  }

  const conflicts = [];
  for (const [subject, entries] of bySubject) {
    const values = new Map();
    for (const entry of entries) {
      const key = canonicalValue(entry.value);
      const bucket = values.get(key) ?? [];
      bucket.push(entry);
      values.set(key, bucket);
    }
    if (values.size < 2) continue;

    conflicts.push({
      subject,
      values: Array.from(values.values()).map((bucket) => ({
        value: bucket[0].value,
        claim_ids: bucket.map((claim) => claim.id).filter(Boolean),
        source_refs: uniqueBy(bucket.flatMap((claim) => claim.source_refs), (ref) => JSON.stringify(ref))
      })),
      action: `Reconcile '${subject}' with the accountable owner before publishing status.`
    });
  }

  return conflicts;
}

export function determineArtifactQuality({ conflicts, issues }) {
  if (conflicts.length > 0 || issues.some((item) => item.severity === "blocking")) return "fail";
  if (issues.length > 0) return "needs_review";
  return "pass";
}

export function determineProgramHealth(activeClaims) {
  if (activeClaims.some((claim) => claim.kind === "blocker")) return "blocked";
  if (activeClaims.some((claim) => claim.kind === "risk" || claim.kind === "unknown")) return "at_risk";
  if (activeClaims.some((claim) => claim.kind === "fact")) return "on_track";
  return "unknown";
}

function recommendActions({ blockers, risks, unknowns, conflicts, issues }) {
  const actions = [];

  for (const item of blockers) {
    actions.push({
      priority: "P0",
      type: "resolve_blocker",
      claim_id: item.id,
      action: blockerAction(item)
    });
  }

  for (const conflict of conflicts) {
    actions.push({ priority: "P0", type: "reconcile_conflict", subject: conflict.subject, action: conflict.action });
  }

  for (const item of uniqueIssues(issues.filter((entry) => entry.severity === "blocking"))) {
    actions.push({ priority: "P0", type: "fix_evidence", action: item.message, location: item.location });
  }

  for (const item of risks) {
    actions.push({
      priority: "P1",
      type: "mitigate_risk",
      claim_id: item.id,
      action: item.owner && item.mitigation
        ? `Track mitigation for risk '${trimTerminalPunctuation(item.text)}' with ${item.owner}.`
        : `Assign an owner and mitigation for risk '${trimTerminalPunctuation(item.text)}'.`
    });
  }

  for (const item of unknowns) {
    actions.push({
      priority: "P1",
      type: "close_unknown",
      claim_id: item.id,
      action: item.owner
        ? `Resolve unknown '${trimTerminalPunctuation(item.text)}' with ${item.owner}, or explicitly accept it.`
        : `Assign an owner and resolve unknown '${trimTerminalPunctuation(item.text)}', or explicitly accept it.`
    });
  }

  for (const item of uniqueIssues(issues.filter((entry) => entry.severity !== "blocking"))) {
    actions.push({ priority: "P2", type: "improve_evidence", action: item.message, location: item.location });
  }

  return uniqueBy(actions, (item) =>
    [item.priority, item.type, item.claim_id, item.subject, item.location, item.action].map((part) => part ?? "").join("|")
  );
}

function blockerAction(item) {
  const text = trimTerminalPunctuation(item.text);
  if (item.owner && item.due_at) return `Resolve blocker '${text}' with ${item.owner} by ${humanDate(item.due_at)}.`;
  if (item.owner) return `Set a resolution date and resolve blocker '${text}' with ${item.owner}.`;
  if (item.due_at) return `Assign an owner and resolve blocker '${text}' by ${humanDate(item.due_at)}.`;
  return `Assign an owner and resolution date for blocker '${text}'.`;
}

function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
}

export { CLAIM_KINDS, optionalString, compactObject };
