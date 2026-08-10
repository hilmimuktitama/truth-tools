const CLAIM_KINDS = new Set(["fact", "blocker", "risk", "unknown"]);
const TOP_LEVEL_FIELDS = new Set(["as_of", "initiative", "policy", "sources", "claims"]);
const INITIATIVE_FIELDS = new Set(["name", "owner", "objective"]);
const POLICY_FIELDS = new Set(["max_source_age_days"]);
const SOURCE_FIELDS = new Set(["id", "type", "url", "captured_at", "owner"]);
const CLAIM_FIELDS = new Set(["id", "kind", "subject", "value", "text", "owner", "due_at", "source_refs"]);
const RAW_SOURCE_KEYS = new Set(["content", "body", "raw", "raw_content", "rawContent", "payload", "document", "data"]);

export function reviewTruth(input = {}) {
  assertObject(input, "Input must be a JSON object.");
  if (!input.as_of) throw new Error("as_of is required so evidence-age checks are reproducible.");

  const issues = [];
  reportUnsupportedFields(input, TOP_LEVEL_FIELDS, "unsupported_top_level_field", "input", issues);

  const asOf = normalizeDate(input.as_of, "as_of");
  const policyResult = normalizePolicy(input.policy);
  const initiativeResult = normalizeInitiative(input.initiative);
  const sourceResult = normalizeSources(input.sources, { asOf, policy: policyResult.value });
  const claimResult = normalizeClaims(input.claims, sourceResult.sourceIds);
  const conflicts = findConflicts(claimResult.claims);

  issues.push(...policyResult.issues, ...initiativeResult.issues, ...sourceResult.issues, ...claimResult.issues);

  const facts = claimResult.claims.filter((claim) => claim.kind === "fact");
  const blockers = claimResult.claims.filter((claim) => claim.kind === "blocker");
  const risks = claimResult.claims.filter((claim) => claim.kind === "risk");
  const unknowns = claimResult.claims.filter((claim) => claim.kind === "unknown");
  const readiness = determineReadiness({ blockers, risks, unknowns, conflicts, issues });

  return {
    kind: "truth_review",
    schema_version: "1.0.0",
    initiative: initiativeResult.value,
    as_of: asOf,
    policy: policyResult.value,
    readiness,
    summary: {
      sources: sourceResult.sources.length,
      claims: claimResult.claims.length,
      facts: facts.length,
      blockers: blockers.length,
      risks: risks.length,
      unknowns: unknowns.length,
      conflicts: conflicts.length,
      issues: issues.length
    },
    sources: sourceResult.sources,
    claims: claimResult.claims,
    findings: {
      facts,
      blockers,
      risks,
      unknowns,
      conflicts,
      issues
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
        captured_at: "2026-08-10T00:00:00.000Z"
      }
    ],
    claims: [
      {
        id: "claim-1",
        kind: "fact",
        subject: "release.scope",
        value: "phase-1",
        text: "Phase 1 is the current release scope.",
        source_refs: ["status-note"]
      }
    ]
  });

  const reviewOk = sample.readiness === "ready" && sample.summary.facts === 1;
  const rawPolicyOk = sample.findings.issues.every((item) => item.type !== "raw_source_content");

  return {
    ok: reviewOk && rawPolicyOk,
    checks: [
      { name: "review", ok: reviewOk, message: "Deterministic review completed." },
      { name: "raw-content-policy", ok: rawPolicyOk, message: "Structured sources contain metadata only." }
    ]
  };
}

function normalizePolicy(policy) {
  const issues = [];
  if (policy !== undefined && !isObject(policy)) {
    issues.push(issue("invalid_policy", "blocking", "policy", "policy must be an object."));
    return { value: { max_source_age_days: 14 }, issues };
  }

  const value = policy ?? {};
  reportUnsupportedFields(value, POLICY_FIELDS, "unsupported_policy_field", "policy", issues);

  const maxSourceAgeDays = value.max_source_age_days ?? 14;
  if (!Number.isInteger(maxSourceAgeDays) || maxSourceAgeDays < 0) {
    issues.push(
      issue(
        "invalid_max_source_age_days",
        "blocking",
        "policy.max_source_age_days",
        "policy.max_source_age_days must be a non-negative integer."
      )
    );
    return { value: { max_source_age_days: 14 }, issues };
  }

  return { value: { max_source_age_days: maxSourceAgeDays }, issues };
}

function normalizeInitiative(initiative) {
  const issues = [];
  if (initiative !== undefined && !isObject(initiative)) {
    issues.push(issue("invalid_initiative", "blocking", "initiative", "initiative must be an object."));
    return { value: { name: "Untitled initiative" }, issues };
  }

  const value = initiative ?? {};
  reportUnsupportedFields(value, INITIATIVE_FIELDS, "unsupported_initiative_field", "initiative", issues);

  return {
    value: compactObject({
      name: stringOr(value.name, "Untitled initiative"),
      owner: optionalString(value.owner),
      objective: optionalString(value.objective)
    }),
    issues
  };
}

function normalizeSources(sources, { asOf, policy }) {
  const issues = [];
  const values = normalizeCollection(sources, "sources", issues);
  const seen = new Set();
  const sourceIds = new Set();
  const normalized = [];

  if (values.length === 0) {
    issues.push(issue("no_sources", "blocking", "sources", "Add at least one source record."));
  }

  values.forEach((source, index) => {
    const location = `sources[${index}]`;
    const value = isObject(source) ? source : {};

    if (!isObject(source)) {
      issues.push(issue("invalid_source", "blocking", location, "Each source must be an object."));
    }

    const unsupportedFields = Object.keys(value).filter((key) => !SOURCE_FIELDS.has(key));
    const rawKeys = unsupportedFields.filter((key) => RAW_SOURCE_KEYS.has(key));
    const otherUnsupportedFields = unsupportedFields.filter((key) => !RAW_SOURCE_KEYS.has(key));

    if (rawKeys.length > 0) {
      issues.push(
        issue(
          "raw_source_content",
          "blocking",
          location,
          `Remove raw source fields (${rawKeys.join(", ")}); keep source bodies in their system of record.`
        )
      );
    }
    for (const field of otherUnsupportedFields) {
      issues.push(
        issue(
          "unsupported_source_field",
          "blocking",
          `${location}.${field}`,
          `Unsupported field '${field}'.`,
          { field }
        )
      );
    }

    const id = optionalString(value.id);
    if (!id) {
      issues.push(issue("missing_source_id", "blocking", location, "Add a stable source id."));
    } else if (seen.has(id)) {
      issues.push(issue("duplicate_source_id", "blocking", location, `Source id '${id}' is duplicated.`));
    } else {
      seen.add(id);
      sourceIds.add(id);
    }

    const capturedAt = normalizeCapturedAt(value.captured_at, { id, index, location, asOf, policy, issues });
    const url = normalizeOptionalUrl(value.url, location, issues);

    normalized.push(
      compactObject({
        id,
        type: optionalString(value.type) ?? "unknown",
        url,
        captured_at: capturedAt,
        owner: optionalString(value.owner)
      })
    );
  });

  return { sources: normalized, sourceIds, issues };
}

function normalizeCapturedAt(rawValue, { id, index, location, asOf, policy, issues }) {
  if (!rawValue) {
    issues.push(issue("missing_captured_at", "blocking", location, "Add captured_at so evidence age can be checked."));
    return undefined;
  }

  try {
    const capturedAt = normalizeDate(rawValue, `${location}.captured_at`);
    const capturedTime = new Date(capturedAt).getTime();
    const asOfTime = new Date(asOf).getTime();

    if (capturedTime > asOfTime) {
      issues.push(
        issue("future_source", "blocking", location, `Source '${id || index + 1}' is captured after as_of.`, {
          source_id: id
        })
      );
      return capturedAt;
    }

    const ageDays = differenceInDays(capturedAt, asOf);
    if (ageDays > policy.max_source_age_days) {
      issues.push(
        issue(
          "stale_source",
          "review",
          location,
          `Source '${id || index + 1}' is ${ageDays} days old; policy allows ${policy.max_source_age_days}.`,
          { source_id: id, age_days: ageDays }
        )
      );
    }
    return capturedAt;
  } catch (error) {
    issues.push(issue("invalid_captured_at", "blocking", location, error.message));
    return undefined;
  }
}

function normalizeClaims(claims, sourceIds) {
  const issues = [];
  const values = normalizeCollection(claims, "claims", issues);
  const seen = new Set();
  const normalized = [];

  if (values.length === 0) {
    issues.push(issue("no_claims", "blocking", "claims", "Add at least one claim to review."));
  }

  values.forEach((claim, index) => {
    const location = `claims[${index}]`;
    const value = isObject(claim) ? claim : {};

    if (!isObject(claim)) {
      issues.push(issue("invalid_claim", "blocking", location, "Each claim must be an object."));
    }

    reportUnsupportedFields(value, CLAIM_FIELDS, "unsupported_claim_field", location, issues);

    const id = optionalString(value.id);
    const kind = optionalString(value.kind)?.toLowerCase();
    const text = optionalString(value.text);
    const sourceRefs = normalizeSourceRefs(value.source_refs, location, issues);
    const subject = optionalString(value.subject);
    const claimValue = normalizeClaimValue(value.value, location, issues);

    if (!id) {
      issues.push(issue("missing_claim_id", "blocking", location, "Add a stable claim id."));
    } else if (seen.has(id)) {
      issues.push(issue("duplicate_claim_id", "blocking", location, `Claim id '${id}' is duplicated.`));
    } else {
      seen.add(id);
    }

    if (!kind) {
      issues.push(issue("missing_claim_kind", "blocking", location, "Set kind to fact, blocker, risk, or unknown."));
    } else if (!CLAIM_KINDS.has(kind)) {
      issues.push(
        issue(
          "unsupported_claim_kind",
          "blocking",
          location,
          `Unsupported kind '${kind}'. Use fact, blocker, risk, or unknown.`
        )
      );
    }

    if (!text) {
      issues.push(issue("missing_claim_text", "blocking", location, "Add a human-readable claim text."));
    }

    if (sourceRefs.length === 0) {
      issues.push(issue("missing_source_ref", "blocking", location, "Cite at least one source id."));
    }

    for (const sourceId of sourceRefs) {
      if (!sourceIds.has(sourceId)) {
        issues.push(
          issue(
            "unknown_source_ref",
            "blocking",
            location,
            `Claim '${id || index + 1}' cites unknown source '${sourceId}'.`,
            { claim_id: id, source_id: sourceId }
          )
        );
      }
    }

    if ((subject && claimValue === undefined) || (!subject && claimValue !== undefined)) {
      issues.push(
        issue(
          "incomplete_conflict_key",
          "review",
          location,
          "Provide both subject and value, or neither; contradiction checks require the pair."
        )
      );
    }

    normalized.push(
      compactObject({
        id,
        kind,
        subject,
        value: claimValue,
        text,
        owner: optionalString(value.owner),
        due_at: normalizeOptionalDate(value.due_at, `${location}.due_at`, issues, location),
        source_refs: sourceRefs
      })
    );
  });

  return { claims: normalized, issues };
}

function normalizeSourceRefs(value, location, issues) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(issue("invalid_source_refs", "blocking", location, "source_refs must be an array of source ids."));
    return [];
  }

  const refs = [];
  for (const [index, entry] of value.entries()) {
    const ref = optionalString(entry);
    if (!ref) {
      issues.push(
        issue("invalid_source_ref", "blocking", `${location}.source_refs[${index}]`, "Source references must be non-empty strings.")
      );
      continue;
    }
    refs.push(ref);
  }
  return unique(refs);
}

function normalizeClaimValue(value, location, issues) {
  if (value === undefined) return undefined;
  if (value === null) {
    issues.push(
      issue(
        "unsupported_claim_value",
        "blocking",
        location,
        "Claim value must be a non-empty string, finite number, or boolean so contradictions remain deterministic."
      )
    );
    return undefined;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    issues.push(
      issue(
        "unsupported_claim_value",
        "blocking",
        location,
        "Claim value must be a finite number so contradictions remain deterministic."
      )
    );
    return undefined;
  }
  if (typeof value === "string") {
    if (value.trim()) return value;
    issues.push(issue("unsupported_claim_value", "blocking", location, "Claim value must not be an empty string."));
    return undefined;
  }
  if (typeof value === "boolean") return value;

  issues.push(
    issue(
      "unsupported_claim_value",
      "blocking",
      location,
      "Claim value must be a non-empty string, finite number, or boolean so contradictions remain deterministic."
    )
  );
  return undefined;
}

function findConflicts(claims) {
  const bySubject = new Map();

  for (const claim of claims) {
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
        source_refs: unique(bucket.flatMap((claim) => claim.source_refs))
      })),
      action: `Reconcile '${subject}' with the accountable owner before publishing status.`
    });
  }

  return conflicts;
}

function determineReadiness({ blockers, risks, unknowns, conflicts, issues }) {
  if (blockers.length > 0 || conflicts.length > 0 || issues.some((item) => item.severity === "blocking")) {
    return "blocked";
  }
  if (risks.length > 0 || unknowns.length > 0 || issues.length > 0) return "needs_review";
  return "ready";
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
      action: item.owner
        ? `Record mitigation for risk '${trimTerminalPunctuation(item.text)}' with ${item.owner}.`
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

function humanDate(value) {
  const text = String(value ?? "");
  return text.endsWith("T00:00:00.000Z") ? text.slice(0, 10) : text;
}

function normalizeCollection(value, field, issues) {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  issues.push(issue(`invalid_${field}`, "blocking", field, `${field} must be an array.`));
  return [];
}

function normalizeOptionalDate(value, field, issues, location) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    return normalizeDate(value, field);
  } catch (error) {
    issues.push(issue("invalid_due_at", "review", location, error.message));
    return undefined;
  }
}

function normalizeOptionalUrl(value, location, issues) {
  const raw = optionalString(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("unsupported protocol");
    return url.toString();
  } catch {
    issues.push(issue("invalid_source_url", "review", location, "Source url must be an absolute HTTP or HTTPS URL."));
    return undefined;
  }
}

function normalizeDate(value, field) {
  const raw = String(value ?? "").trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    assertCalendarDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), field);
    return `${raw}T00:00:00.000Z`;
  }

  if (/^\d{4}-\d{2}-\d{2}T/i.test(raw) && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
    throw new Error(`${field} must be an ISO datetime with Z/UTC offset.`);
  }

  const dateTime = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/i
  );
  if (!dateTime) {
    throw new Error(`${field} must be YYYY-MM-DD or an ISO datetime with Z/UTC offset.`);
  }

  assertCalendarDate(Number(dateTime[1]), Number(dateTime[2]), Number(dateTime[3]), field);
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field} must be a valid ISO datetime with Z/UTC offset.`);
  }
  return new Date(timestamp).toISOString();
}

function assertCalendarDate(year, month, day, field) {
  const days = daysInMonth(year, month);
  if (month < 1 || month > 12 || day < 1 || day > days) {
    throw new Error(`${field} contains an invalid calendar date.`);
  }
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  if (month >= 1 && month <= 12) return 31;
  return 0;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function differenceInDays(earlierIso, laterIso) {
  const days = (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 86_400_000;
  return Number(days.toFixed(3));
}

function canonicalValue(value) {
  if (typeof value === "string") return `string:${value.trim().toLowerCase()}`;
  return `${typeof value}:${String(value)}`;
}

function reportUnsupportedFields(value, allowedFields, type, location, issues) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value)) {
    if (allowedFields.has(field)) continue;
    issues.push(issue(type, "blocking", `${location}.${field}`, `Unsupported field '${field}'.`, { field }));
  }
}

function issue(type, severity, location, message, details = {}) {
  return { type, severity, location, message, ...details };
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function uniqueIssues(values) {
  return uniqueBy(values, (item) => `${item.type}|${item.location}|${item.message}`);
}

function trimTerminalPunctuation(value) {
  return String(value ?? "").trim().replace(/[.!?]+$/, "");
}

function optionalString(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function stringOr(value, fallback) {
  return optionalString(value) ?? fallback;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value, message) {
  if (!isObject(value)) throw new Error(message);
}
