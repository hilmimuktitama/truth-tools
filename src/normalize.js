import { CLAIM_KINDS, CLAIM_STATES, DATE_DERIVATIONS, EVIDENCE_GRADES, TIMELINE_TYPES } from "./contracts.js";

// Raw source bodies are never part of the contract; content, body, raw,
// payload, document, and data keys always fail review. raw_included is
// provenance metadata only (the capture record held a body in its system of
// record) and is preserved, never treated as a body itself.
export const RAW_SOURCE_KEYS = new Set([
  "content",
  "body",
  "raw",
  "raw_content",
  "rawContent",
  "payload",
  "document",
  "data"
]);

export const TOP_LEVEL_FIELDS = new Set([
  "kind",
  "schema_version",
  "as_of",
  "initiative",
  "policy",
  "sources",
  "claims",
  "timeline",
  "baseline_timeline"
]);
export const INITIATIVE_FIELDS = new Set(["name", "owner", "objective"]);
export const POLICY_FIELDS = new Set(["max_observation_age_days", "max_source_content_age_days", "max_source_age_days"]);
export const SOURCE_FIELDS = new Set([
  "id",
  "sourceId",
  "kind",
  "type",
  "adapter",
  "key",
  "url",
  "path",
  "observed_at",
  "captured_at",
  "source_updated_at",
  "owner",
  "revision",
  "content_hash",
  "locator",
  "access_caveats",
  "fields",
  "metadata",
  "raw_included"
]);
export const CLAIM_FIELDS = new Set([
  "id",
  "kind",
  "state",
  "subject",
  "value",
  "text",
  "owner",
  "due_at",
  "mitigation",
  "source_refs"
]);
export const TIMELINE_FIELDS = new Set([
  "id",
  "title",
  "type",
  "start",
  "end",
  "duration",
  "time_window",
  "date_text",
  "date_derivation",
  "evidence_grade",
  "evidence_reason",
  "exact_date_needed",
  "missing_title",
  "dangerous_fields",
  "owner",
  "status",
  "dependencies",
  "source_refs"
]);
export const SOURCE_REF_FIELDS = new Set([
  "source_id",
  "sourceId",
  "locator",
  "note",
  "path",
  "url",
  "observed_at",
  "source_updated_at",
  "revision",
  "content_hash",
  "heading",
  "tableRow",
  "line",
  "text"
]);

export const DEFAULT_MAX_OBSERVATION_AGE_DAYS = 14;
export const DEFAULT_MAX_SOURCE_CONTENT_AGE_DAYS = 14;

export const CONTENT_HASH_PATTERN = /^(?:sha256:)?[a-f0-9]{64}$/;
export const DURATION_PATTERN = /^\d+[dwmy]$/;
export const DANGEROUS_FIELD_NAMES = [
  "__proto__",
  "prototype",
  "constructor",
  "eval",
  "exec",
  "command",
  "shell",
  "script",
  "spawn",
  "require",
  "import",
  "fetch",
  "child_process",
  "os"
];

export const EVIDENCE_REASONS = {
  exact: "Exact date evidence (YYYY-MM-DD) found in source text.",
  derived: "Date converted deterministically from natural language (for example, 'June 17, 2026').",
  fuzzy: "Fuzzy time window preserved for human review; exact date needed.",
  missing: "No date evidence found; timeline placement needs human follow-up."
};

export function issue(type, severity, location, message, details = {}) {
  return { type, severity, location, message, ...details };
}

export function deprecation(type, location, message, suggested) {
  return { type, severity: "deprecated", location, message, suggested };
}

export function normalizePolicy(policy, issues, deprecations) {
  if (policy !== undefined && !isObject(policy)) {
    issues.push(issue("invalid_policy", "blocking", "policy", "policy must be an object."));
    return defaultPolicy();
  }

  reportUnsupportedFields(policy ?? {}, POLICY_FIELDS, "unsupported_policy_field", "policy", issues);

  if (policy?.max_source_age_days !== undefined) {
    deprecations.push(
      deprecation(
        "deprecated_policy_max_source_age_days",
        "policy.max_source_age_days",
        "policy.max_source_age_days is deprecated.",
        "Use max_observation_age_days and max_source_content_age_days."
      )
    );
  }

  // Canonical fields win over the deprecated alias when both are present.
  const maxObservationAgeDays = policy?.max_observation_age_days ?? policy?.max_source_age_days;
  const maxSourceContentAgeDays = policy?.max_source_content_age_days ?? policy?.max_source_age_days;

  let observationAge = DEFAULT_MAX_OBSERVATION_AGE_DAYS;
  let contentAge = DEFAULT_MAX_SOURCE_CONTENT_AGE_DAYS;
  let valid = true;

  if (maxObservationAgeDays !== undefined) {
    if (Number.isInteger(maxObservationAgeDays) && maxObservationAgeDays >= 0) {
      observationAge = maxObservationAgeDays;
    } else {
      issues.push(
        issue(
          "invalid_max_observation_age_days",
          "blocking",
          "policy.max_observation_age_days",
          "policy.max_observation_age_days must be a non-negative integer."
        )
      );
      valid = false;
    }
  }

  if (maxSourceContentAgeDays !== undefined) {
    if (Number.isInteger(maxSourceContentAgeDays) && maxSourceContentAgeDays >= 0) {
      contentAge = maxSourceContentAgeDays;
    } else {
      issues.push(
        issue(
          "invalid_max_source_content_age_days",
          "blocking",
          "policy.max_source_content_age_days",
          "policy.max_source_content_age_days must be a non-negative integer."
        )
      );
      valid = false;
    }
  }

  // The deprecated alias keeps its historical issue name for compatibility.
  if (policy?.max_source_age_days !== undefined && !Number.isInteger(policy.max_source_age_days)) {
    issues.push(
      issue(
        "invalid_max_source_age_days",
        "blocking",
        "policy.max_source_age_days",
        "policy.max_source_age_days must be a non-negative integer."
      )
    );
    valid = false;
  }

  if (!valid) return defaultPolicy();
  return { max_observation_age_days: observationAge, max_source_content_age_days: contentAge };
}

function defaultPolicy() {
  return {
    max_observation_age_days: DEFAULT_MAX_OBSERVATION_AGE_DAYS,
    max_source_content_age_days: DEFAULT_MAX_SOURCE_CONTENT_AGE_DAYS
  };
}

export function normalizeInitiative(initiative, issues) {
  if (initiative !== undefined && !isObject(initiative)) {
    issues.push(issue("invalid_initiative", "blocking", "initiative", "initiative must be an object."));
    return { name: "Untitled initiative" };
  }

  reportUnsupportedFields(initiative ?? {}, INITIATIVE_FIELDS, "unsupported_initiative_field", "initiative", issues);

  return compactObject({
    name: stringOr(initiative?.name, "Untitled initiative"),
    owner: optionalString(initiative?.owner),
    objective: optionalString(initiative?.objective)
  });
}

export function normalizeSource(raw, { index, asOf, policy, issues, deprecations }) {
  const location = `sources[${index}]`;
  if (!isObject(raw)) {
    issues.push(issue("invalid_source", "blocking", location, "Each source must be an object."));
    return null;
  }

  const unsupportedFields = Object.keys(raw).filter((key) => !SOURCE_FIELDS.has(key));
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
      issue("unsupported_source_field", "blocking", `${location}.${field}`, `Unsupported field '${field}'.`, { field })
    );
  }

  let id = optionalString(raw.id);
  if (!id) {
    const legacyId = optionalString(raw.sourceId);
    if (legacyId) {
      deprecations.push(
        deprecation(
          "deprecated_source_id",
          `${location}.sourceId`,
          "Source field 'sourceId' is deprecated.",
          "Use 'id'."
        )
      );
      id = legacyId;
    }
  }

  const sourceKind = optionalString(raw.kind)?.toLowerCase();
  if (sourceKind !== undefined && !["document", "record"].includes(sourceKind)) {
    issues.push(
      issue("invalid_source_kind", "blocking", `${location}.kind`, "Source kind must be document or record; invalid values are omitted.", {
        source_id: id
      })
    );
  }
  if (!id) {
    issues.push(issue("missing_source_id", "blocking", location, "Add a stable source id."));
    return null;
  }

  let observedAt;
  if (raw.captured_at !== undefined) {
    // The deprecation finding is emitted whenever the legacy field appears,
    // even when the canonical observed_at is also present.
    deprecations.push(
      deprecation(
        "deprecated_captured_at",
        `${location}.captured_at`,
        "Source field 'captured_at' is deprecated.",
        "Use 'observed_at'."
      )
    );
  }
  if (raw.observed_at !== undefined) {
    observedAt = normalizeSourceTimestamp(raw.observed_at, `${location}.observed_at`, "invalid_observed_at", issues);
  } else if (raw.captured_at !== undefined) {
    observedAt = normalizeSourceTimestamp(raw.captured_at, `${location}.captured_at`, "invalid_observed_at", issues);
  }

  if (!observedAt) {
    issues.push(
      issue(
        "missing_observed_at",
        "blocking",
        location,
        "Add observed_at so evidence age can be checked. 'captured_at' is deprecated."
      )
    );
    return null;
  }

  const asOfTime = new Date(asOf).getTime();
  const observedTime = new Date(observedAt).getTime();
  if (observedTime > asOfTime) {
    issues.push(
      issue("future_source", "blocking", location, `Source '${id}' is observed after as_of.`, { source_id: id })
    );
  } else {
    const ageDays = differenceInDays(observedAt, asOf);
    if (ageDays > policy.max_observation_age_days) {
      issues.push(
        issue(
          "stale_observation",
          "review",
          location,
          `Source '${id}' was observed ${ageDays} days ago; policy allows ${policy.max_observation_age_days} (stale_observation).`,
          { source_id: id, age_days: ageDays }
        )
      );
    }
  }

  let sourceUpdatedAt;
  if (raw.source_updated_at !== undefined) {
    sourceUpdatedAt = normalizeSourceTimestamp(
      raw.source_updated_at,
      `${location}.source_updated_at`,
      "invalid_source_updated_at",
      issues,
      "review"
    );
    if (sourceUpdatedAt) {
      const updatedTime = new Date(sourceUpdatedAt).getTime();
      if (updatedTime > asOfTime) {
        issues.push(
          issue(
            "source_updated_after_as_of",
            "review",
            location,
            `Source '${id}' reports an update after as_of; the snapshot may be stale relative to the source.`,
            { source_id: id }
          )
        );
      } else {
        const contentAgeDays = differenceInDays(sourceUpdatedAt, asOf);
        if (contentAgeDays > policy.max_source_content_age_days) {
          issues.push(
            issue(
              "stale_source_content",
              "review",
              location,
              `Source '${id}' content was last updated ${contentAgeDays} days ago; policy allows ${policy.max_source_content_age_days} (stale_source_content).`,
              { source_id: id, age_days: contentAgeDays }
            )
          );
        }
      }
    }
  }

  const contentHash = normalizeContentHash(raw.content_hash, `${location}.content_hash`, issues);
  const revision = normalizeRevision(raw.revision, `${location}.revision`, issues);
  const accessCaveats = normalizeStringArray(raw.access_caveats, `${location}.access_caveats`, issues);
  const fields = isObject(raw.fields) ? raw.fields : undefined;
  const metadata = isObject(raw.metadata) ? raw.metadata : undefined;

  return compactObject({
    id,
    kind: ["document", "record"].includes(sourceKind) ? sourceKind : undefined,
    type: optionalString(raw.type) ?? "unknown",
    adapter: optionalString(raw.adapter),
    key: optionalString(raw.key),
    url: normalizeOptionalUrl(raw.url, location, issues),
    path: optionalString(raw.path),
    observed_at: observedAt,
    source_updated_at: sourceUpdatedAt,
    owner: optionalString(raw.owner),
    revision,
    content_hash: contentHash,
    locator: optionalString(raw.locator),
    access_caveats: accessCaveats,
    fields,
    metadata,
    // Provenance metadata only: raw_included records that a capture held a
    // body in its system of record. It never makes the body part of the
    // artifact, so it is preserved here but never validated against bodies.
    raw_included: typeof raw.raw_included === "boolean" ? raw.raw_included : undefined
  });
}

// Positive integer provenance fields (tableRow, line on SourceRefs): only
// positive integers are canonical; anything else is dropped from the
// normalized output, never guessed.
function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizeContentHash(value, location, issues) {
  const text = optionalString(value);
  if (!text) return undefined;
  if (!CONTENT_HASH_PATTERN.test(text)) {
    issues.push(
      issue(
        "invalid_content_hash",
        "review",
        location,
        "content_hash must be a sha256 hex digest (64 hex chars), with or without a sha256: prefix."
      )
    );
    return undefined;
  }
  return text;
}

function normalizeRevision(value, location, issues) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = optionalString(value);
  if (text) return text;
  if (value !== undefined && value !== null) {
    issues.push(issue("invalid_revision", "review", location, "revision must be a string or a finite number."));
  }
  return undefined;
}

function normalizeStringArray(value, location, issues) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    issues.push(issue("invalid_field", "review", location, "Expected an array of strings."));
    return undefined;
  }
  const strings = value.map((entry) => optionalString(entry)).filter(Boolean);
  if (strings.length !== value.length) {
    issues.push(issue("invalid_field", "review", location, "Expected an array of strings."));
  }
  return strings.length > 0 ? strings : undefined;
}

function normalizeSourceTimestamp(value, location, issueType, issues, severity = "blocking") {
  try {
    assertRfc3339Timestamp(value, location);
    return normalizeDate(value, location);
  } catch (error) {
    issues.push(issue(issueType, severity, location, error.message));
    return undefined;
  }
}

function normalizeSourceRefTimestamp(value, location, issues) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    assertRfc3339Timestamp(value, location);
    return normalizeDate(value, location);
  } catch (error) {
    issues.push(issue("invalid_source_ref_timestamp", "review", location, error.message));
    return undefined;
  }
}

function assertRfc3339Timestamp(value, field) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
    throw new Error(`${field} must be a full RFC3339 datetime with Z/UTC offset.`);
  }
}

export function normalizeClaimsInput(claims, { sourceIds, issues, deprecations }) {
  const values = normalizeCollection(claims, "claims", issues);
  const seen = new Set();
  const normalized = [];

  if (values.length === 0) {
    issues.push(issue("no_claims", "blocking", "claims", "Add at least one claim to review."));
  }

  values.forEach((claim, index) => {
    const normalizedClaim = normalizeClaim(claim, { index, sourceIds, issues, deprecations });
    if (!normalizedClaim) return;

    if (seen.has(normalizedClaim.id)) {
      issues.push(
        issue("duplicate_claim_id", "blocking", `claims[${index}]`, `Claim id '${normalizedClaim.id}' is duplicated.`)
      );
      return;
    }
    seen.add(normalizedClaim.id);
    normalized.push(normalizedClaim);
  });

  return normalized;
}

export function normalizeClaim(raw, { index, sourceIds, issues, deprecations }) {
  const location = `claims[${index}]`;
  if (!isObject(raw)) {
    issues.push(issue("invalid_claim", "blocking", location, "Each claim must be an object."));
    return null;
  }

  reportUnsupportedFields(raw, CLAIM_FIELDS, "unsupported_claim_field", location, issues);

  const id = optionalString(raw.id);
  const kind = optionalString(raw.kind)?.toLowerCase();
  const state = normalizeClaimState(raw.state, location, issues);
  const text = optionalString(raw.text);
  const sourceRefs = normalizeSourceRefs(raw.source_refs, location, issues, deprecations);
  const subject = optionalString(raw.subject);
  const claimValue = normalizeClaimValue(raw.value, location, issues);
  const mitigation = optionalString(raw.mitigation);

  if (!id) issues.push(issue("missing_claim_id", "blocking", location, "Add a stable claim id."));
  if (!kind) {
    issues.push(issue("missing_claim_kind", "blocking", location, "Set kind to fact, blocker, risk, or unknown."));
  } else if (!CLAIM_KINDS.includes(kind)) {
    issues.push(
      issue(
        "unsupported_claim_kind",
        "blocking",
        location,
        `Unsupported kind '${kind}'. Use fact, blocker, risk, or unknown.`
      )
    );
  }
  if (!text) issues.push(issue("missing_claim_text", "blocking", location, "Add a human-readable claim text."));

  if (sourceRefs.length === 0) {
    issues.push(issue("missing_source_ref", "blocking", location, "Cite at least one source id."));
  }

  for (const ref of sourceRefs) {
    if (!sourceIds.has(ref.source_id)) {
      issues.push(
        issue(
          "unknown_source_ref",
          "blocking",
          location,
          `Claim '${id ?? index + 1}' cites unknown source '${ref.source_id}'.`,
          { claim_id: id, source_id: ref.source_id }
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
        "Provide both subject and value, or neither; active contradiction checks require the pair."
      )
    );
  }

  if (!id || !kind || !CLAIM_KINDS.includes(kind) || !text || !state) return null;

  const normalized = compactObject({
    id,
    kind,
    state,
    subject,
    value: claimValue,
    text,
    owner: optionalString(raw.owner),
    due_at: normalizeOptionalDate(raw.due_at, `${location}.due_at`, issues, location, "invalid_due_at"),
    mitigation,
    source_refs: sourceRefs
  });

  // Quality rules apply to active claims only; superseded and historical
  // claims are records of the past and are reported but not judged.
  if (state === "active") {
    if (kind === "blocker") {
      if (!normalized.owner) {
        issues.push(
          issue(
            "blocker_missing_owner",
            "blocking",
            location,
            `Active blocker '${id}' has no accountable owner; add owner and due_at.`
          )
        );
      }
      if (!normalized.due_at) {
        issues.push(
          issue(
            "blocker_missing_due",
            "blocking",
            location,
            `Active blocker '${id}' has no resolution date; add owner and due_at.`
          )
        );
      }
    } else if (kind === "risk") {
      if (!normalized.owner) {
        issues.push(
          issue(
            "risk_missing_owner",
            "review",
            location,
            `Active risk '${id}' has no accountable owner; add owner and mitigation.`
          )
        );
      }
      if (!normalized.mitigation) {
        issues.push(
          issue(
            "risk_missing_mitigation",
            "review",
            location,
            `Active risk '${id}' has no mitigation; add owner and mitigation.`
          )
        );
      }
    } else if (kind === "unknown") {
      if (!normalized.owner) {
        issues.push(
          issue(
            "unknown_missing_owner",
            "review",
            location,
            `Active unknown '${id}' is actionable but has no owner; assign an owner or explicitly accept it.`
          )
        );
      }
    }
  }

  return normalized;
}

export function normalizeClaimState(value, location, issues) {
  if (value === undefined) return "active";
  const state = optionalString(value)?.toLowerCase();
  if (!state || !CLAIM_STATES.includes(state)) {
    issues.push(
      issue(
        "unsupported_claim_state",
        "blocking",
        location,
        `Unsupported state '${String(value)}'. Use active, superseded, or historical.`
      )
    );
    return undefined;
  }
  return state;
}

export function normalizeSourceRefs(value, location, issues, deprecations) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(issue("invalid_source_refs", "blocking", location, "source_refs must be an array of source references."));
    return [];
  }

  const refs = [];
  for (const [index, entry] of value.entries()) {
    const refLocation = `${location}.source_refs[${index}]`;
    let ref;
    if (typeof entry === "string") {
      const sourceId = optionalString(entry);
      if (!sourceId) {
        issues.push(
          issue("invalid_source_ref", "blocking", refLocation, "Source references must be non-empty strings or objects with a source_id.")
        );
        continue;
      }
      deprecations.push(
        deprecation(
          "deprecated_string_source_ref",
          refLocation,
          "Plain-string source references are deprecated.",
          `Use { "source_id": "${sourceId}", "locator": "<pointer>" }.`
        )
      );
      ref = { source_id: sourceId };
    } else if (isObject(entry)) {
      const unsupportedRefFields = Object.keys(entry).filter((key) => !SOURCE_REF_FIELDS.has(key));
      for (const field of unsupportedRefFields) {
        issues.push(
          issue("unsupported_source_ref_field", "blocking", `${refLocation}.${field}`, `Unsupported field '${field}'.`, { field })
        );
      }

      let sourceId = optionalString(entry.source_id);
      if (!sourceId) {
        const legacyId = optionalString(entry.sourceId);
        if (legacyId) {
          deprecations.push(
            deprecation(
              "deprecated_source_id",
              `${refLocation}.sourceId`,
              "Source reference field 'sourceId' is deprecated.",
              "Use 'source_id'."
            )
          );
          sourceId = legacyId;
        }
      }
      if (!sourceId) {
        issues.push(issue("invalid_source_ref", "blocking", refLocation, "Source reference objects require a source_id."));
        continue;
      }

      ref = compactObject({
        source_id: sourceId,
        locator: optionalString(entry.locator),
        note: optionalString(entry.note),
        path: optionalString(entry.path),
        url: optionalString(entry.url),
        observed_at: normalizeSourceRefTimestamp(entry.observed_at, `${refLocation}.observed_at`, issues),
        source_updated_at: normalizeSourceRefTimestamp(entry.source_updated_at, `${refLocation}.source_updated_at`, issues),
        revision: entry.revision === undefined ? undefined : entry.revision,
        content_hash: normalizeContentHash(entry.content_hash, `${refLocation}.content_hash`, issues),
        // Timeline Truth provenance passthrough: section heading, table row or
        // line numbers (positive integers), and verbatim quoted text. These
        // locate the evidence inside the source; they never change the
        // required source_id + locator contract.
        heading: optionalString(entry.heading),
        tableRow: positiveInteger(entry.tableRow),
        line: positiveInteger(entry.line),
        text: optionalString(entry.text)
      });
    } else {
      issues.push(
        issue("invalid_source_ref", "blocking", refLocation, "Source references must be non-empty strings or objects with a source_id.")
      );
      continue;
    }

    if (!ref.locator) {
      issues.push(
        issue(
          "missing_source_ref_locator",
          "review",
          refLocation,
          "Source reference has no locator; add the concrete pointer (url, path, key, or stable id) to the evidence."
        )
      );
    }

    refs.push(ref);
  }

  return uniqueBy(refs, (ref) => JSON.stringify(ref));
}

export function normalizeClaimValue(value, location, issues) {
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

export function normalizeTimelineItems(value, issues, deprecations = []) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(issue("invalid_timeline", "blocking", "timeline", "timeline must be an array of timeline items."));
    return [];
  }

  const items = [];
  value.forEach((rawItem, index) => {
    const location = `timeline[${index}]`;
    const normalized = normalizeTimelineItem(rawItem, location, issues, deprecations, index);
    if (normalized) items.push(normalized);
  });

  return items;
}

export function normalizeTimelineItem(rawItem, location, issues, deprecations = [], index = 0) {
  if (!isObject(rawItem)) {
    issues.push(issue("invalid_timeline_item", "blocking", location, "Each timeline item must be an object."));
    return undefined;
  }

  const unsupportedFields = Object.keys(rawItem).filter((key) => !TIMELINE_FIELDS.has(key));
  const dangerousFields = Object.keys(rawItem).filter((key) => DANGEROUS_FIELD_NAMES.includes(key));
  for (const field of unsupportedFields) {
    if (dangerousFields.includes(field)) continue;
    issues.push(
      issue("unsupported_timeline_field", "blocking", `${location}.${field}`, `Unsupported field '${field}'.`, { field })
    );
  }
  for (const field of dangerousFields) {
    issues.push(
      issue(
        "dangerous_timeline_field",
        "blocking",
        `${location}.${field}`,
        `Unsupported dangerous field '${field}' was dropped.`,
        { field }
      )
    );
  }

  const rawTitle = optionalString(rawItem.title);
  const title = rawTitle ?? "Untitled";
  const missingTitle = rawTitle === undefined;

  const id = optionalString(rawItem.id) ?? (slugify(title) || `timeline-${index + 1}`);
  const type = rawItem.type === "milestone" ? "milestone" : "task";

  const start = normalizeTimelineDate(rawItem.start, `${location}.start`, issues);
  const end = normalizeTimelineDate(rawItem.end, `${location}.end`, issues);
  const timeWindow = optionalString(rawItem.time_window);
  const dateText = optionalString(rawItem.date_text);
  const exactDateNeeded = Boolean(timeWindow !== undefined && start === undefined && end === undefined);
  const duration = normalizeDuration(rawItem.duration, `${location}.duration`, issues);

  const dateDerivation = normalizeDateDerivation(rawItem.date_derivation, { start, end, timeWindow, dateText });
  const evidenceGrade = computeEvidenceGrade({ dateDerivation, timeWindow, dateText, start, end });
  const evidenceReason = optionalString(rawItem.evidence_reason) ?? evidenceReasonFor(evidenceGrade);

  const dependencies = Array.isArray(rawItem.dependencies)
    ? rawItem.dependencies.map((entry) => optionalString(entry)).filter(Boolean)
    : typeof rawItem.dependencies === "string"
      ? rawItem.dependencies.split(/[|,;]/).map((entry) => entry.trim()).filter(Boolean)
      : [];

  return compactObject({
    id,
    title,
    type,
    start,
    end,
    duration,
    time_window: timeWindow,
    date_text: dateText,
    exact_date_needed: exactDateNeeded,
    owner: optionalString(rawItem.owner),
    status: optionalString(rawItem.status) ?? "planned",
    dependencies,
    date_derivation: dateDerivation,
    evidence_grade: evidenceGrade,
    evidence_reason: evidenceReason,
    missing_title: missingTitle,
    dangerous_fields: dangerousFields,
    source_refs: normalizeSourceRefs(rawItem.source_refs, `${location}.source_refs`, issues, deprecations)
  });
}

function normalizeTimelineDate(value, location, issues) {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    issues.push(issue("invalid_timeline_date", "blocking", location, "Timeline item dates must be YYYY-MM-DD."));
    return undefined;
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  try {
    assertCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]), location);
  } catch (error) {
    issues.push(issue("invalid_timeline_date", "blocking", location, error.message));
    return undefined;
  }
  return text;
}

function normalizeDuration(value, location, issues) {
  const text = optionalString(value);
  if (!text) return undefined;
  if (!DURATION_PATTERN.test(text)) {
    issues.push(
      issue(
        "malformed_duration",
        "review",
        location,
        `Duration '${text}' is malformed; expected a number with one of d, w, m, y (for example "5d").`
      )
    );
    return undefined;
  }
  return text;
}

function normalizeDateDerivation(value, { start, end, timeWindow, dateText }) {
  const candidate = optionalString(value)?.toLowerCase();
  if (candidate && DATE_DERIVATIONS.includes(candidate)) return candidate;
  if (start !== undefined || end !== undefined) return "explicit";
  if (timeWindow !== undefined || dateText !== undefined) return "none";
  return "none";
}

function computeEvidenceGrade({ dateDerivation, timeWindow, dateText, start, end }) {
  if (dateDerivation === "explicit" && (start !== undefined || end !== undefined)) return "exact";
  if (dateDerivation === "natural") return "derived";
  if (timeWindow !== undefined || dateText !== undefined) return "fuzzy";
  return "missing";
}

function evidenceReasonFor(grade) {
  return EVIDENCE_REASONS[grade] || EVIDENCE_REASONS.missing;
}

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeCollection(value, field, issues) {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  issues.push(issue(`invalid_${field}`, "blocking", field, `${field} must be an array.`));
  return [];
}

export function normalizeOptionalDate(value, field, issues, location, issueType = "invalid_due_at") {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    return normalizeDate(value, field);
  } catch (error) {
    issues.push(issue(issueType, "review", location, error.message));
    return undefined;
  }
}

export function normalizeOptionalUrl(value, location, issues) {
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

export function normalizeDate(value, field) {
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

export function assertCalendarDate(year, month, day, field) {
  const days = daysInMonth(year, month);
  if (month < 1 || month > 12 || day < 1 || day > days) {
    throw new Error(`${field} contains an invalid calendar date.`);
  }
}

export function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  if (month >= 1 && month <= 12) return 31;
  return 0;
}

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function differenceInDays(earlierIso, laterIso) {
  const days = (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 86_400_000;
  return Number(days.toFixed(3));
}

export function canonicalValue(value) {
  if (typeof value === "string") return `string:${value.trim().toLowerCase()}`;
  return `${typeof value}:${String(value)}`;
}

export function reportUnsupportedFields(value, allowedFields, type, location, issues) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value)) {
    if (allowedFields.has(field)) continue;
    issues.push(issue(type, "blocking", `${location}.${field}`, `Unsupported field '${field}'.`, { field }));
  }
}

export function humanDate(value) {
  const text = String(value ?? "");
  return text.endsWith("T00:00:00.000Z") ? text.slice(0, 10) : text;
}

export function trimTerminalPunctuation(value) {
  return String(value ?? "").trim().replace(/[.!?]+$/, "");
}

export function optionalString(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function stringOr(value, fallback) {
  return optionalString(value) ?? fallback;
}

export function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function unique(values) {
  return [...new Set(values)];
}

export function uniqueBy(values, keyFn) {
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

export function uniqueIssues(values) {
  return uniqueBy(values, (item) => `${item.type}|${item.location}|${item.message}`);
}
