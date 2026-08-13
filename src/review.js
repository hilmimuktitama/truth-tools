import { CLAIM_KINDS, SCHEMA_VERSION } from "./contracts.js";
import {
  TOP_LEVEL_FIELDS,
  ARTIFACT_INPUT_LIMITS,
  canonicalValue,
  compactObject,
  isObject,
  issue,
  normalizeClaimsInput,
  normalizeCollection,
  normalizeDate,
  normalizeInitiative,
  normalizeHealthAssessment,
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
  reportUnsupportedFields(input, TOP_LEVEL_FIELDS, "unsupported_top_level_field", "input", issues, {
    maxProperties: ARTIFACT_INPUT_LIMITS.max_unsupported_top_level_fields,
    maxFields: ARTIFACT_INPUT_LIMITS.max_unsupported_top_level_fields
  });

  const asOf = normalizeDate(input.as_of, "as_of");
  const policy = normalizePolicy(input.policy, issues, deprecations);
  const initiative = normalizeInitiative(input.initiative, issues);
  const sourceResult = normalizeSources(input.sources, { asOf, policy, issues, deprecations });
  normalizeArtifactVersion(input, issues, deprecations);
  const claims = normalizeClaimsInput(input.claims, {
    sourceIds: sourceResult.sourceIds,
    issues,
    deprecations
  });
  const conflicts = findConflicts(claims);
  const timeline = normalizeTimelineItems(input.timeline, issues, deprecations);
  const baselineTimeline = normalizeTimelineItems(input.baseline_timeline, issues, deprecations, ARTIFACT_INPUT_LIMITS.max_baseline_timeline_items);
  const healthResult = normalizeHealthAssessment(input.health_assessment, {
    sourceIds: sourceResult.sourceIds,
    issues,
    deprecations
  });

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
  const activeBlockers = activeClaims.filter((claim) => claim.kind === "blocker");
  const activeRisks = activeClaims.filter((claim) => claim.kind === "risk");
  const activeUnknowns = activeClaims.filter((claim) => claim.kind === "unknown");

  const health = determineHealthResolution(activeClaims, healthResult.reportedState, issues);
  const recommendedActions = recommendActions({ blockers: activeBlockers, risks: activeRisks, unknowns: activeUnknowns, conflicts, issues });
  const artifactQuality = determineArtifactQuality({ conflicts, issues });

  return {
    kind: "truth_review",
    schema_version: SCHEMA_VERSION,
    initiative,
    as_of: asOf,
    policy,
    ...(healthResult.assessment ? { health_assessment: healthResult.assessment } : {}),
    artifact_quality: artifactQuality,
    reported_program_health: health.reportedProgramHealth,
    claim_health_floor: health.claimHealthFloor,
    program_health: health.programHealth,
    health_consistency: health.healthConsistency,
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
     recommended_actions: recommendedActions
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
    health_assessment: {
      state: "on_track",
      owner: "Platform TPM",
      rationale: "The scoped doctor fixture has no active blocker, risk, or unknown claims.",
      source_refs: [{ source_id: "status-note", locator: "note:doctor-health" }]
    },
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

export function determineProgramHealth(activeClaims, reportedProgramHealth) {
  return determineHealthResolution(activeClaims, reportedProgramHealth, []).programHealth;
}

export function determineHealthResolution(activeClaims, reportedProgramHealth, issues) {
  const hasFact = activeClaims.some((claim) => claim.kind === "fact");
  const hasBlocker = activeClaims.some((claim) => claim.kind === "blocker");
  const hasRiskSignal = activeClaims.some((claim) => claim.kind === "risk" || claim.kind === "unknown");
  const claimHealthFloor = hasBlocker ? "blocked" : hasRiskSignal ? "at_risk" : "none";
  let healthConsistency = reportedProgramHealth ? "consistent" : "missing";

  if (hasBlocker && reportedProgramHealth !== undefined && reportedProgramHealth !== "blocked") {
    healthConsistency = "conflicting";
    issues.push(
      issue(
        "health_assessment_conflicts_with_blocker",
        "blocking",
        "health_assessment.state",
        `Reported health '${reportedProgramHealth}' conflicts with an active blocker; final health is blocked.`
      )
    );
  } else if (!hasBlocker && hasRiskSignal && ["on_track", "unknown"].includes(reportedProgramHealth)) {
    healthConsistency = "understated";
    issues.push(
      issue(
        "health_assessment_understates_active_signals",
        "review",
        "health_assessment.state",
        `Reported health '${reportedProgramHealth}' understates active blocker, risk, or unknown claims.`
      )
    );
  } else if (reportedProgramHealth === "blocked" && !hasBlocker) {
    healthConsistency = "unsupported";
    issues.push(
      issue(
        "blocked_health_without_blocker_claim",
        "review",
        "health_assessment.state",
        "Reported blocked health has no active blocker claim; final health remains blocked."
      )
    );
  } else if (reportedProgramHealth === "at_risk" && !hasBlocker && !hasRiskSignal) {
    healthConsistency = "unsupported";
    issues.push(
      issue(
        "at_risk_health_without_supporting_claim",
        "review",
        "health_assessment.state",
        "Reported at-risk health has no active blocker, risk, or unknown claim; final health remains at_risk."
      )
    );
  }

  const programHealth = claimHealthFloor === "blocked"
    ? "blocked"
    : reportedProgramHealth === "blocked"
      ? "blocked"
      : claimHealthFloor === "at_risk"
        ? "at_risk"
        : hasFact && reportedProgramHealth === "on_track" ? "on_track" : "unknown";

  return {
    reportedProgramHealth: reportedProgramHealth ?? null,
    claimHealthFloor,
    programHealth,
    healthConsistency
  };
}

function normalizeArtifactVersion(input, issues, deprecations) {
  if (input.schema_version === "2.0.0") return;
  if (input.schema_version === undefined || input.schema_version === "1.0.0") {
    deprecations.push({
      type: "deprecated_status_artifact_v1",
      severity: "deprecated",
      location: "schema_version",
      message: "StatusArtifact v1 is accepted only through the compatibility path.",
      suggested: "Migrate to schema_version 2.0.0 and add health_assessment."
    });
    return;
  }
  issues.push(
    issue(
      "unsupported_status_artifact_version",
      "blocking",
      "schema_version",
      `Unsupported StatusArtifact schema_version '${String(input.schema_version)}'.`
    )
  );
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

  const uniqueActions = uniqueBy(actions, (item) =>
    [item.priority, item.type, item.claim_id, item.subject, item.location, item.action].map((part) => part ?? "").join("|")
  );
  if (uniqueActions.length > ARTIFACT_INPUT_LIMITS.max_recommended_actions) {
    issues.push(issue(
      "recommended_actions_truncated",
      "blocking",
      "recommended_actions",
      `recommended_actions exceeds the maximum of ${ARTIFACT_INPUT_LIMITS.max_recommended_actions} entries; remaining actions were omitted.`
    ));
  }
  return uniqueActions
    .slice(0, ARTIFACT_INPUT_LIMITS.max_recommended_actions)
    .map((item) => ({ ...item, action: boundRecommendedAction(item.action) }));
}

function boundRecommendedAction(value) {
  // Keep generated guidance safe for single-line renderers and within the
  // truth-review action contract regardless of claim text layout.
  const singleLine = String(value ?? "").replace(/\s+/gu, " ").trim();
  let bounded = singleLine.slice(0, 4096);
  // Do not leave a lone high surrogate at the schema boundary.
  if (bounded.length > 0 && /[\uD800-\uDBFF]/u.test(bounded.at(-1))) bounded = bounded.slice(0, -1);
  return bounded;
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
