import { CLAIM_KINDS, CLAIM_STATES, DATE_DERIVATIONS, EVIDENCE_GRADES, TIMELINE_TYPES } from "./contracts.js";

// Raw source bodies are never part of the contract; content, body, raw,
// payload, document, and data keys always fail review. raw_included is
// provenance metadata only (the capture record held a body in its system of
// record) and is preserved, never treated as a body itself.
export const RAW_SOURCE_KEYS = new Set([
  "content",
  "contents",
  "body",
  "raw",
  "raw_body",
  "raw_content",
  "raw_data",
  "rawcontent",
  "rawbody",
  "payload",
  "document",
  "description",
  "description_markdown",
  "message",
  "html",
  "markdown",
  "prose",
  "blob",
  "text",
  "data"
]);

const NESTED_RAW_SOURCE_KEYS = RAW_SOURCE_KEYS;
const DANGEROUS_SOURCE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export const TOP_LEVEL_FIELDS = new Set([
  "kind",
  "schema_version",
  "as_of",
  "initiative",
  "policy",
  "sources",
  "claims",
  "timeline",
  "baseline_timeline",
  "health_assessment"
]);
export const HEALTH_ASSESSMENT_FIELDS = new Set(["state", "owner", "rationale", "source_refs"]);
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
  "line"
]);

export const SOURCE_METADATA_LIMITS = Object.freeze({
  max_depth: 5,
  max_serialized_bytes: 16 * 1024,
  max_array_length: 100,
  max_object_entries: 100,
  max_string_length: 2048,
  max_total_string_length: 32 * 1024,
  max_traversed_entries: 1000
});

export const ARTIFACT_INPUT_LIMITS = Object.freeze({
  max_sources: 1000,
  max_claims: 5000,
  max_timeline_items: 500,
  max_baseline_timeline_items: 500,
  max_timeline_dependencies: 50,
  max_unsupported_top_level_fields: 200,
  max_recommended_actions: 200
});

// These limits keep review work bounded while leaving ample room for normal
// status artifacts. Values are intentionally shared by the runtime, JSON
// Schema contracts, and MCP boundary.
export const ARTIFACT_FIELD_LIMITS = Object.freeze({
  max_claim_text_length: 4096,
  max_claim_scalar_length: 2048,
  max_access_caveats: 20,
  max_access_caveat_length: 512,
  max_claim_source_refs: 20,
  max_health_source_refs: 20,
  max_timeline_source_refs: 20,
  max_source_ref_string_length: 2048,
  max_timeline_item_string_length: 2048
});

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
  const rawKeys = unsupportedFields.filter((key) => isRawSourceKey(key));
  const otherUnsupportedFields = unsupportedFields.filter((key) => !isRawSourceKey(key));

  if (rawKeys.length > 0) {
    for (const field of rawKeys) {
      issues.push(
        issue(
          "raw_source_content",
          "blocking",
          pathForKey(location, field),
          `Remove raw source field '${field}'; keep source bodies in their system of record.`,
          { field }
        )
      );
    }
  }
  for (const field of otherUnsupportedFields) {
    issues.push(
      issue("unsupported_source_field", "blocking", pathForKey(location, field), `Unsupported field '${field}'.`, { field })
    );
  }

  let id = optionalString(raw.id);
  const legacyId = optionalString(raw.sourceId);
  if (Object.hasOwn(raw, "sourceId")) {
    deprecations.push(
      deprecation(
        "deprecated_source_id",
        pathForKey(location, "sourceId"),
        "Source field 'sourceId' is deprecated.",
        "Use 'id'."
      )
    );
  }
  if (!id) id = legacyId;

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
        pathForKey(location, "captured_at"),
        "Source field 'captured_at' is deprecated.",
        "Use 'observed_at'."
      )
    );
  }
  if (raw.observed_at !== undefined) {
    observedAt = normalizeSourceTimestamp(raw.observed_at, `${location}.observed_at`, "invalid_observed_at", issues);
  } else if (raw.captured_at !== undefined) {
    observedAt = normalizeSourceTimestamp(raw.captured_at, pathForKey(location, "captured_at"), "invalid_observed_at", issues);
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
    const ageMilliseconds = asOfTime - observedTime;
    const ageDays = differenceInDays(observedAt, asOf);
    if (ageMilliseconds > policy.max_observation_age_days * 86_400_000) {
      issues.push(
        issue(
          "stale_observation",
          "review",
          location,
          `Source '${id}' was observed ${ageDays} days ago; policy allows ${policy.max_observation_age_days} (stale_observation).`,
          { source_id: id, age_days: ageDays, age_milliseconds: ageMilliseconds }
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
            { source_id: id, observed_at: observedAt, source_updated_at: sourceUpdatedAt, as_of: asOf }
          )
        );
      } else {
        // A source may have changed after this snapshot while still being
        // inside the review cutoff. This is distinct from source_updated_after_as_of:
        // the latter says the source changed after the review boundary, while
        // this finding says the snapshot predates a known change in the window.
        if (observedTime < updatedTime && updatedTime <= asOfTime) {
          issues.push(
            issue(
              "source_updated_after_observation",
              "review",
              location,
              `Source '${id}' was updated ${differenceInDays(observedAt, sourceUpdatedAt)} days after the snapshot and before or at as_of.`,
              {
                source_id: id,
                observed_at: observedAt,
                source_updated_at: sourceUpdatedAt,
                as_of: asOf,
                gap_days: differenceInDays(observedAt, sourceUpdatedAt),
                gap_milliseconds: updatedTime - observedTime
              }
            )
          );
        }
        const contentAgeMilliseconds = asOfTime - updatedTime;
        const contentAgeDays = differenceInDays(sourceUpdatedAt, asOf);
        if (contentAgeMilliseconds > policy.max_source_content_age_days * 86_400_000) {
          issues.push(
            issue(
              "stale_source_content",
              "review",
              location,
              `Source '${id}' content was last updated ${contentAgeDays} days ago; policy allows ${policy.max_source_content_age_days} (stale_source_content).`,
              { source_id: id, age_days: contentAgeDays, age_milliseconds: contentAgeMilliseconds }
            )
          );
        }
      }
    }
  }

  const contentHash = normalizeContentHash(raw.content_hash, `${location}.content_hash`, issues);
  const revision = normalizeRevision(raw.revision, `${location}.revision`, issues);
  const accessCaveats = normalizeAccessCaveats(raw.access_caveats, `${location}.access_caveats`, issues);
  const fields = normalizeSourceMetadata(raw.fields, `${location}.fields`, "fields", issues);
  const metadata = normalizeSourceMetadata(raw.metadata, `${location}.metadata`, "metadata", issues);

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
    locator: normalizeSourceRefLocator(raw.locator, `${location}.locator`, issues),
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
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = optionalString(value);
  if (text) {
    if (text.length > ARTIFACT_FIELD_LIMITS.max_source_ref_string_length) {
      issues.push(issue(
        "revision_too_large",
        "blocking",
        location,
        `revision exceeds ${ARTIFACT_FIELD_LIMITS.max_source_ref_string_length} characters and was omitted.`
      ));
      return undefined;
    }
    return text;
  }
  if (value !== undefined && value !== null) {
    issues.push(issue("invalid_revision", "blocking", location, "revision must be a string, a finite number, or null; the invalid value was omitted."));
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

function normalizeAccessCaveats(value, location, issues) {
  const caveats = normalizeStringArray(value, location, issues);
  if (!caveats) return caveats;
  if (caveats.length > ARTIFACT_FIELD_LIMITS.max_access_caveats) {
    issues.push(issue(
      "too_many_access_caveats",
      "blocking",
      location,
      `access_caveats exceeds the maximum of ${ARTIFACT_FIELD_LIMITS.max_access_caveats} entries.`
    ));
  }
  const safe = [];
  for (const [index, caveat] of caveats.slice(0, ARTIFACT_FIELD_LIMITS.max_access_caveats).entries()) {
    if (caveat.length > ARTIFACT_FIELD_LIMITS.max_access_caveat_length) {
      issues.push(issue(
        "access_caveat_too_large",
        "blocking",
        `${location}[${index}]`,
        `Access caveat exceeds ${ARTIFACT_FIELD_LIMITS.max_access_caveat_length} characters and was omitted.`
      ));
      continue;
    }
    if (containsCredentialBearingUrl(caveat)) {
      issues.push(
        issue(
          "privacy_source_url",
          "blocking",
          `${location}[${index}]`,
          "Access caveat must not contain a credential-bearing HTTP(S) URL."
        )
      );
      continue;
    }
    safe.push(caveat);
  }
  return safe.length > 0 ? safe : undefined;
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
  const text = boundedString(raw.text, `${location}.text`, ARTIFACT_FIELD_LIMITS.max_claim_text_length, "claim_text_too_large", issues);
  const sourceRefs = normalizeSourceRefs(raw.source_refs, location, issues, deprecations, ARTIFACT_FIELD_LIMITS.max_claim_source_refs);
  const subject = boundedString(raw.subject, `${location}.subject`, ARTIFACT_FIELD_LIMITS.max_claim_scalar_length, "claim_scalar_too_large", issues);
  const claimValue = normalizeClaimValue(raw.value, location, issues);
  const mitigation = boundedString(raw.mitigation, `${location}.mitigation`, ARTIFACT_FIELD_LIMITS.max_claim_text_length, "claim_text_too_large", issues);

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

  if (!id || !kind || !CLAIM_KINDS.includes(kind) || !text || !state || sourceRefs.length === 0) return null;

  const normalized = compactObject({
    id,
    kind,
    state,
    subject,
    value: claimValue,
    text,
    owner: boundedString(raw.owner, `${location}.owner`, ARTIFACT_FIELD_LIMITS.max_source_ref_string_length, "claim_scalar_too_large", issues),
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

export function normalizeHealthAssessment(value, { sourceIds, issues, deprecations }) {
  const location = "health_assessment";
  if (value === undefined) {
    issues.push(
      issue(
        "missing_health_assessment",
        "review",
        location,
        "Add an explicit health assessment with state, owner, rationale, and cited source references; facts alone do not establish on_track health."
      )
    );
    return { assessment: undefined, reportedState: undefined };
  }
  if (!isObject(value)) {
    issues.push(issue("invalid_health_assessment", "blocking", location, "health_assessment must be an object."));
    return { assessment: undefined, reportedState: undefined };
  }

  reportUnsupportedFields(value, HEALTH_ASSESSMENT_FIELDS, "unsupported_health_assessment_field", location, issues);
  const state = optionalString(value.state)?.toLowerCase();
  const owner = boundedString(value.owner, `${location}.owner`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "health_assessment_owner_too_large", issues);
  const rationale = boundedString(value.rationale, `${location}.rationale`, ARTIFACT_FIELD_LIMITS.max_claim_text_length, "health_assessment_rationale_too_large", issues);
  const sourceRefs = normalizeSourceRefs(value.source_refs, location, issues, deprecations, ARTIFACT_FIELD_LIMITS.max_health_source_refs);

  if (!state || !["on_track", "at_risk", "blocked", "unknown"].includes(state)) {
    issues.push(
      issue(
        "invalid_health_assessment_state",
        "blocking",
        `${location}.state`,
        "health_assessment.state must be on_track, at_risk, blocked, or unknown."
      )
    );
  }
  if (!owner) {
    issues.push(issue("health_assessment_missing_owner", "blocking", `${location}.owner`, "Add a non-empty accountable owner."));
  }
  if (!rationale) {
    issues.push(issue("health_assessment_missing_rationale", "blocking", `${location}.rationale`, "Add a non-empty rationale."));
  }
  if (sourceRefs.length === 0) {
    issues.push(
      issue(
        "health_assessment_missing_source_refs",
        "blocking",
        `${location}.source_refs`,
        "Cite at least one canonical source reference."
      )
    );
  }
  for (const [index, ref] of sourceRefs.entries()) {
    if (!ref.locator) {
      issues.push(
        issue(
          "health_assessment_missing_source_ref_locator",
          "blocking",
          `${location}.source_refs[${index}].locator`,
          "Every health assessment source reference requires a locator."
        )
      );
    }
    if (!sourceIds.has(ref.source_id)) {
      issues.push(
        issue(
          "health_assessment_unknown_source_ref",
          "blocking",
          `${location}.source_refs[${index}]`,
          `Health assessment cites unknown source '${ref.source_id}'.`,
          { source_id: ref.source_id }
        )
      );
    }
  }

  const complete = state && ["on_track", "at_risk", "blocked", "unknown"].includes(state) && owner && rationale &&
    sourceRefs.length > 0 && sourceRefs.every((ref) => ref.locator && sourceIds.has(ref.source_id));
  return {
    reportedState: state && ["on_track", "at_risk", "blocked", "unknown"].includes(state) ? state : undefined,
    assessment: complete ? { state, owner, rationale, source_refs: sourceRefs } : undefined
  };
}

export function normalizeSourceRefs(value, location, issues, deprecations, maxItems = ARTIFACT_FIELD_LIMITS.max_timeline_source_refs) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(issue("invalid_source_refs", "blocking", location, "source_refs must be an array of source references."));
    return [];
  }

  if (value.length > maxItems) {
    issues.push(issue("too_many_source_refs", "blocking", location, `source_refs exceeds the maximum of ${maxItems} entries.`));
  }

  const refs = [];
  for (const [index, entry] of value.slice(0, maxItems).entries()) {
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
       const unsupportedRefFields = Object.keys(entry).filter((key) => key !== "text" && !SOURCE_REF_FIELDS.has(key));
      for (const field of unsupportedRefFields) {
        issues.push(
          issue("unsupported_source_ref_field", "blocking", `${refLocation}.${field}`, `Unsupported field '${field}'.`, { field })
        );
      }

      let sourceId = optionalString(entry.source_id);
      if (Object.hasOwn(entry, "text")) {
        deprecations.push(
          deprecation(
            "deprecated_source_ref_text",
            pathForKey(refLocation, "text"),
            "Verbatim SourceRef text is deprecated and was stripped from canonical output.",
            "Use a provenance locator such as heading, line, or tableRow."
          )
        );
      }
      if (Object.hasOwn(entry, "sourceId")) {
        const legacyId = optionalString(entry.sourceId);
        if (legacyId) {
          deprecations.push(
            deprecation(
              "deprecated_source_id",
              pathForKey(refLocation, "sourceId"),
              "Source reference field 'sourceId' is deprecated.",
              "Use 'source_id'."
            )
          );
          if (!sourceId) sourceId = legacyId;
        }
      }
      if (!sourceId) {
        issues.push(issue("invalid_source_ref", "blocking", refLocation, "Source reference objects require a source_id."));
        continue;
      }

       const locator = normalizeSourceRefLocator(entry.locator, `${refLocation}.locator`, issues);

      ref = compactObject({
        source_id: sourceId,
        locator,
        note: boundedString(entry.note, `${refLocation}.note`, ARTIFACT_FIELD_LIMITS.max_source_ref_string_length, "source_ref_string_too_large", issues),
        path: boundedString(entry.path, `${refLocation}.path`, ARTIFACT_FIELD_LIMITS.max_source_ref_string_length, "source_ref_string_too_large", issues),
        url: normalizeOptionalUrl(entry.url, `${refLocation}.url`, issues),
        observed_at: normalizeSourceRefTimestamp(entry.observed_at, `${refLocation}.observed_at`, issues),
        source_updated_at: normalizeSourceRefTimestamp(entry.source_updated_at, `${refLocation}.source_updated_at`, issues),
        revision: normalizeRevision(entry.revision, `${refLocation}.revision`, issues),
        content_hash: normalizeContentHash(entry.content_hash, `${refLocation}.content_hash`, issues),
        // Timeline Truth provenance passthrough: section heading, table row or
        // line numbers (positive integers), and verbatim quoted text. These
        // locate the evidence inside the source; they never change the
        // required source_id + locator contract.
        heading: boundedString(entry.heading, `${refLocation}.heading`, ARTIFACT_FIELD_LIMITS.max_source_ref_string_length, "source_ref_string_too_large", issues),
        tableRow: positiveInteger(entry.tableRow),
        line: positiveInteger(entry.line)
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
    if (value.length > ARTIFACT_FIELD_LIMITS.max_claim_scalar_length) {
      issues.push(issue(
        "claim_scalar_too_large",
        "blocking",
        `${location}.value`,
        `Claim scalar exceeds ${ARTIFACT_FIELD_LIMITS.max_claim_scalar_length} characters and was omitted.`
      ));
      return undefined;
    }
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

export function normalizeTimelineItems(value, issues, deprecations = [], maxItems = ARTIFACT_INPUT_LIMITS.max_timeline_items) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(issue("invalid_timeline", "blocking", "timeline", "timeline must be an array of timeline items."));
    return [];
  }

  if (value.length > maxItems) {
    issues.push(issue("too_many_timeline_items", "blocking", "timeline", `timeline exceeds the maximum of ${maxItems} entries.`));
  }

  const items = [];
  value.slice(0, maxItems).forEach((rawItem, index) => {
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
      issue("unsupported_timeline_field", "blocking", pathForKey(location, field), `Unsupported field '${field}'.`, { field })
    );
  }
  for (const field of dangerousFields) {
    issues.push(
      issue(
        "dangerous_timeline_field",
        "blocking",
        pathForKey(location, field),
        `Unsupported dangerous field '${field}' was dropped.`,
        { field }
      )
    );
  }

  const rawTitle = boundedString(rawItem.title, `${location}.title`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues);
  const title = rawTitle ?? "Untitled";
  const missingTitle = rawTitle === undefined;

  const id = boundedString(rawItem.id, `${location}.id`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues) ?? (slugify(title) || `timeline-${index + 1}`);
  const type = rawItem.type === "milestone" ? "milestone" : "task";

  const start = normalizeTimelineDate(rawItem.start, `${location}.start`, issues);
  const end = normalizeTimelineDate(rawItem.end, `${location}.end`, issues);
  const timeWindow = boundedString(rawItem.time_window, `${location}.time_window`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues);
  const dateText = boundedString(rawItem.date_text, `${location}.date_text`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues);
  const exactDateNeeded = Boolean(timeWindow !== undefined && start === undefined && end === undefined);
  const duration = normalizeDuration(rawItem.duration, `${location}.duration`, issues);

  const dateDerivation = normalizeDateDerivation(rawItem.date_derivation, { start, end, timeWindow, dateText });
  const evidenceGrade = computeEvidenceGrade({ dateDerivation, timeWindow, dateText, start, end });
  const evidenceReason = boundedString(rawItem.evidence_reason, `${location}.evidence_reason`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues) ?? evidenceReasonFor(evidenceGrade);

  const rawDependencies = Array.isArray(rawItem.dependencies)
    ? rawItem.dependencies.slice(0, ARTIFACT_INPUT_LIMITS.max_timeline_dependencies)
    : typeof rawItem.dependencies === "string"
      ? rawItem.dependencies.split(/[|,;]/).slice(0, ARTIFACT_INPUT_LIMITS.max_timeline_dependencies)
      : [];
  if (Array.isArray(rawItem.dependencies) && rawItem.dependencies.length > ARTIFACT_INPUT_LIMITS.max_timeline_dependencies) {
    issues.push(issue("too_many_timeline_dependencies", "blocking", `${location}.dependencies`, `dependencies exceeds the maximum of ${ARTIFACT_INPUT_LIMITS.max_timeline_dependencies} entries.`));
  }
  const dependencies = rawDependencies.map((entry, dependencyIndex) => boundedString(entry, `${location}.dependencies[${dependencyIndex}]`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues)).filter(Boolean);

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
     owner: boundedString(rawItem.owner, `${location}.owner`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues),
     status: boundedString(rawItem.status, `${location}.status`, ARTIFACT_FIELD_LIMITS.max_timeline_item_string_length, "timeline_string_too_large", issues) ?? "planned",
    dependencies,
    date_derivation: dateDerivation,
    evidence_grade: evidenceGrade,
    evidence_reason: evidenceReason,
    missing_title: missingTitle,
    dangerous_fields: dangerousFields,
     source_refs: normalizeSourceRefs(rawItem.source_refs, `${location}.source_refs`, issues, deprecations, ARTIFACT_FIELD_LIMITS.max_timeline_source_refs)
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
  if (Array.isArray(value)) {
    const limit = field === "sources" ? ARTIFACT_INPUT_LIMITS.max_sources : field === "claims" ? ARTIFACT_INPUT_LIMITS.max_claims : undefined;
    if (limit !== undefined && value.length > limit) {
      issues.push(issue(`too_many_${field}`, "blocking", field, `${field} exceeds the maximum of ${limit} entries.`));
      return value.slice(0, limit);
    }
    return value;
  }
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
    if (url.username || url.password) {
      issues.push(
        issue(
          "privacy_source_url",
          "blocking",
          location,
          "Source url must not contain userinfo or credentials."
        )
      );
      return undefined;
    }
    const credentialParameter = [...url.searchParams.keys()].find(isCredentialQueryParameter);
    if (credentialParameter !== undefined || fragmentHasCredentialName(url.hash.slice(1))) {
      issues.push(
        issue(
          "privacy_source_url",
          "blocking",
          location,
          "Source url must not contain credential-like query or fragment parameters."
        )
      );
      return undefined;
    }
    return url.toString();
  } catch {
    issues.push(issue("invalid_source_url", "review", location, "Source url must be an absolute HTTP or HTTPS URL."));
    return undefined;
  }
}

function normalizeSourceRefLocator(value, location, issues) {
  const raw = optionalString(value);
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return normalizeOptionalUrl(raw, location, issues);
    }
  } catch {
    // Locators may also be paths, keys, or stable ids; leave non-URLs alone.
  }
  return raw;
}

function containsCredentialBearingUrl(value) {
  const urls = String(value).match(/https?:\/\/[^\s<>()]+/gi) ?? [];
  return urls.some((candidate) => {
    const normalized = candidate.replace(/[.,;:!?]+$/, "");
    try {
      const url = new URL(normalized);
      return Boolean(url.username || url.password) ||
        [...url.searchParams.keys()].some(isCredentialQueryParameter) ||
        fragmentHasCredentialName(url.hash.slice(1));
    } catch {
      return false;
    }
  });
}

function isCredentialQueryParameter(value) {
  const key = normalizeCredentialName(value);
  if (!key) return false;
  const compact = key.replaceAll("_", "");
  if (["awsaccesskeyid", "clientassertion", "jwt", "apikey", "xapikey"].includes(compact)) return true;
  if (compact.endsWith("apikey")) return true;
  const segments = key.split(/[^a-z0-9]+/).filter(Boolean);
  return segments.some((segment) =>
    ["token", "secret", "auth", "authorization", "password", "signature", "signatures", "sig"].includes(segment)
  ) || segments.includes("session") && segments.includes("id");
}

function normalizeCredentialName(value) {
  return String(value ?? "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function fragmentHasCredentialName(fragment) {
  const candidates = String(fragment ?? "")
    .split(/[&#;,\s]+/)
    .map((part) => part.split("=", 1)[0]);
  return candidates.some((candidate) => isCredentialQueryParameter(candidate));
}

function isRawSourceKey(key) {
  const normalized = String(key)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (normalized === "content_hash") return false;
  // Match only complete normalized aliases. Substring/token matching would
  // reject legitimate structured metadata such as context_id, status_text,
  // documentation, and payload_status. Explicit compound aliases remain
  // blocked (for example description_markdown and raw_content).
  return NESTED_RAW_SOURCE_KEYS.has(normalized);
}

function normalizeSourceMetadata(value, location, fieldName, issues) {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    issues.push(
      issue(
        `invalid_source_${fieldName}`,
        "blocking",
        location,
        `Source ${fieldName} must be an object; the invalid value was omitted.`
      )
    );
    return undefined;
  }

  if (!measureMetadata(value, location, 0, new WeakSet(), { entries: 0, stringLength: 0, bytes: 2 }, issues)) return undefined;

  const activeObjects = new WeakSet();
  const normalizeValue = (entry, entryLocation, depth) => {
    if (depth > SOURCE_METADATA_LIMITS.max_depth) {
      issues.push(
        issue(
          "source_metadata_too_deep",
          "blocking",
          entryLocation,
          `Source metadata exceeds the maximum nesting depth of ${SOURCE_METADATA_LIMITS.max_depth}; the offending value was omitted.`
        )
      );
      return undefined;
    }
    if (typeof entry === "string" && entry.length > SOURCE_METADATA_LIMITS.max_string_length) {
      issues.push(
        issue(
          "source_metadata_string_too_large",
          "blocking",
          entryLocation,
          `Source metadata string exceeds ${SOURCE_METADATA_LIMITS.max_string_length} characters and was omitted.`
        )
      );
      return undefined;
    }
    if (Array.isArray(entry)) {
      if (entry.length > SOURCE_METADATA_LIMITS.max_array_length) {
        issues.push(
          issue(
            "source_metadata_array_too_large",
            "blocking",
            entryLocation,
            `Source metadata array exceeds ${SOURCE_METADATA_LIMITS.max_array_length} entries and was omitted.`
          )
        );
        return undefined;
      }
      if (activeObjects.has(entry)) {
        issues.push(issue("invalid_source_metadata", "blocking", entryLocation, "Cyclic source metadata was omitted."));
        return undefined;
      }
      activeObjects.add(entry);
      const normalizedArray = entry
        .map((item, index) => normalizeValue(item, `${entryLocation}[${index}]`, depth + 1))
        .filter((item) => item !== undefined);
      activeObjects.delete(entry);
      return normalizedArray;
    }
    if (!isObject(entry)) return entry;

    if (activeObjects.has(entry)) {
      issues.push(issue("invalid_source_metadata", "blocking", entryLocation, "Cyclic source metadata was omitted."));
      return undefined;
    }
    activeObjects.add(entry);
    const normalized = {};
    let entries;
    try {
      entries = Object.entries(entry);
    } catch {
      activeObjects.delete(entry);
      issues.push(issue("invalid_source_metadata", "blocking", entryLocation, "Source metadata could not be read and was omitted."));
      return undefined;
    }
    for (const [key, child] of entries) {
      const childLocation = pathForKey(entryLocation, key);
      if (DANGEROUS_SOURCE_KEYS.has(key.toLowerCase())) {
        issues.push(
          issue(
            "dangerous_source_field",
            "blocking",
            childLocation,
            `Dangerous prototype field '${key}' was dropped.`,
            { field: key }
          )
        );
        continue;
      }
      if (isRawSourceKey(key)) {
        issues.push(
          issue(
            "raw_source_content",
            "blocking",
            childLocation,
            `Remove raw source field '${key}'; keep source bodies in their system of record.`,
            { field: key }
          )
        );
        continue;
      }
      const normalizedChild = normalizeValue(child, childLocation, depth + 1);
      if (normalizedChild === undefined) continue;
      Object.defineProperty(normalized, key, {
        value: normalizedChild,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    activeObjects.delete(entry);
    return normalized;
  };

  return normalizeValue(value, location, 0);
}

// Bound hostile metadata before any full stringify. The existing per-value
// limits remain in normalizeValue; this preflight adds aggregate traversal,
// string, entry, cycle, and estimated-byte limits.
function measureMetadata(value, location, depth, activeObjects, budget, issues) {
  if (depth > SOURCE_METADATA_LIMITS.max_depth) {
    issues.push(issue("source_metadata_too_deep", "blocking", location, `Source metadata exceeds the maximum nesting depth of ${SOURCE_METADATA_LIMITS.max_depth}; the offending value was omitted.`));
    return false;
  }
  budget.entries += 1;
  if (budget.entries > SOURCE_METADATA_LIMITS.max_traversed_entries) {
    issues.push(issue("source_metadata_too_many_entries", "blocking", location, `Source metadata exceeds the traversal limit of ${SOURCE_METADATA_LIMITS.max_traversed_entries} entries and was omitted.`));
    return false;
  }
  if (typeof value === "string") {
    if (value.length > SOURCE_METADATA_LIMITS.max_string_length) {
      issues.push(issue("source_metadata_string_too_large", "blocking", location, `Source metadata string exceeds ${SOURCE_METADATA_LIMITS.max_string_length} characters and was omitted.`));
      return false;
    }
    budget.stringLength += value.length;
    budget.bytes += Buffer.byteLength(JSON.stringify(value), "utf8");
  } else if (value === null || typeof value !== "object") {
    budget.bytes += Buffer.byteLength(String(value), "utf8");
  } else if (Array.isArray(value)) {
    if (value.length > SOURCE_METADATA_LIMITS.max_array_length) {
      issues.push(issue("source_metadata_array_too_large", "blocking", location, `Source metadata array exceeds ${SOURCE_METADATA_LIMITS.max_array_length} entries and was omitted.`));
      return false;
    }
    if (activeObjects.has(value)) {
      issues.push(issue("invalid_source_metadata", "blocking", location, "Cyclic source metadata was omitted."));
      return false;
    }
    activeObjects.add(value);
    for (const [index, child] of value.entries()) {
      if (!measureMetadata(child, `${location}[${index}]`, depth + 1, activeObjects, budget, issues)) return false;
    }
    activeObjects.delete(value);
    budget.bytes += value.length + 1;
  } else {
    if (activeObjects.has(value)) {
      issues.push(issue("invalid_source_metadata", "blocking", location, "Cyclic source metadata was omitted."));
      return false;
    }
    let entries;
    try { entries = Object.entries(value); } catch {
      issues.push(issue("invalid_source_metadata", "blocking", location, "Source metadata could not be read and was omitted."));
      return false;
    }
    if (entries.length > SOURCE_METADATA_LIMITS.max_object_entries) {
      issues.push(issue("source_metadata_object_too_large", "blocking", location, `Source metadata object exceeds ${SOURCE_METADATA_LIMITS.max_object_entries} entries and was omitted.`));
      return false;
    }
    activeObjects.add(value);
    budget.bytes += 2;
    for (const [key, child] of entries) {
      const childLocation = pathForKey(location, key);
      budget.bytes += Buffer.byteLength(JSON.stringify(key), "utf8") + 1;
      if (!measureMetadata(child, childLocation, depth + 1, activeObjects, budget, issues)) return false;
    }
    activeObjects.delete(value);
  }
  if (budget.stringLength > SOURCE_METADATA_LIMITS.max_total_string_length || budget.bytes > SOURCE_METADATA_LIMITS.max_serialized_bytes) {
    issues.push(issue("source_metadata_too_large", "blocking", location, `Source metadata exceeds the aggregate ${SOURCE_METADATA_LIMITS.max_serialized_bytes}-byte or ${SOURCE_METADATA_LIMITS.max_total_string_length}-character limit and was omitted.`, {
      estimated_bytes: budget.bytes,
      string_characters: budget.stringLength,
      limit_bytes: SOURCE_METADATA_LIMITS.max_serialized_bytes,
      limit_string_characters: SOURCE_METADATA_LIMITS.max_total_string_length
    }));
    return false;
  }
  return true;
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

export function reportUnsupportedFields(value, allowedFields, type, location, issues, options = {}) {
  if (!isObject(value)) return;
  const maxProperties = options.maxProperties ?? Number.POSITIVE_INFINITY;
  const maxFields = options.maxFields ?? Number.POSITIVE_INFINITY;
  let inspectedProperties = 0;
  let unsupportedFields = 0;
  let truncated = false;

  for (const field in value) {
    if (!Object.hasOwn(value, field)) continue;
    if (inspectedProperties >= maxProperties || unsupportedFields >= maxFields) {
      truncated = true;
      break;
    }
    inspectedProperties += 1;
    if (allowedFields.has(field)) continue;
    unsupportedFields += 1;
    issues.push(issue(type, "blocking", pathForKey(location, field), `Unsupported field '${field}'.`, { field }));
  }

  if (truncated) {
    issues.push(issue(
      `${type}_truncated`,
      "blocking",
      location,
      `Unsupported field scanning was truncated after ${Math.min(maxProperties, maxFields)} entries.`
    ));
  }
}

export function pathForKey(location, key) {
  const text = String(key);
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)
    ? `${location}.${text}`
    : `${location}[${JSON.stringify(text)}]`;
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

function boundedString(value, location, limit, issueType, issues) {
  const normalized = optionalString(value);
  if (normalized === undefined) return undefined;
  if (normalized.length > limit) {
    issues.push(issue(issueType, "blocking", location, `String exceeds ${limit} characters and was omitted.`));
    return undefined;
  }
  return normalized;
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
