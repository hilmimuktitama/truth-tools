import { assertExportProfile } from "./schemas.js";

const SENSITIVE_PATTERNS = [
  { name: "authorization_header", pattern: /\bAuthorization\s*:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/i },
  { name: "secret_assignment", pattern: /\b(?:secret|token|password|api[_-]?key)\s*[:=]\s*\S+/i },
  { name: "private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { name: "customer_marker", pattern: /\b(?:customer|client)\s+(?:token|secret|credential|data)\b/i }
];

const SENSITIVE_KEYS = [
  { name: "authorization_header", pattern: /^authorization$/i, valuePattern: /^(?:Basic|Bearer)\s+\S+/i },
  { name: "secret_assignment", pattern: /^(?:secret|token|password|api[_-]?key)$/i, valuePattern: /\S/ }
];

export function renderForExportProfile({ artifact, profile = "repo-safe-summary", includeClaims = true } = {}) {
  const exportProfile = assertExportProfile(profile);
  const redaction = checkRedaction(artifact);

  if (exportProfile === "raw-local-only") {
    return {
      profile: exportProfile,
      redaction,
      content: JSON.stringify(artifact, null, 2)
    };
  }

  if (exportProfile === "internal-evidence-pack") {
    const content = renderInternalEvidencePack(artifact);
    assertSafeExportContent({ profile: exportProfile, content });
    return {
      profile: exportProfile,
      redaction,
      content
    };
  }

  const content = renderRepoSafeSummary(artifact, { includeClaims });
  assertSafeExportContent({ profile: exportProfile, content });
  return {
    profile: exportProfile,
    redaction,
    content
  };
}

export function checkRedaction(value) {
  const blockedTerms = new Set();

  inspectForSensitiveTerms(value, blockedTerms);

  return {
    ok: blockedTerms.size === 0,
    blocked_terms: Array.from(blockedTerms)
  };
}

export function assertSafeExportContent({ profile = "repo-safe-summary", content } = {}) {
  const redaction = checkRedaction(content);
  if (!redaction.ok) {
    throw new Error(`Unsafe ${profile} export blocked: ${redaction.blocked_terms.join(", ")}`);
  }
  return redaction;
}

function inspectForSensitiveTerms(value, blockedTerms, key = "") {
  if (typeof value === "string") {
    inspectSensitiveKeyValue(key, value, blockedTerms);
    inspectSensitiveText(value, blockedTerms);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) inspectForSensitiveTerms(entry, blockedTerms);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [entryKey, entryValue] of Object.entries(value)) {
    inspectForSensitiveTerms(entryValue, blockedTerms, entryKey);
  }
}

function inspectSensitiveText(text, blockedTerms) {
  for (const item of SENSITIVE_PATTERNS) {
    if (item.pattern.test(text)) {
      blockedTerms.add(item.name);
    }
  }
}

function inspectSensitiveKeyValue(key, value, blockedTerms) {
  for (const item of SENSITIVE_KEYS) {
    if (item.pattern.test(key) && item.valuePattern.test(value)) {
      blockedTerms.add(item.name);
    }
  }
}

function renderRepoSafeSummary(artifact = {}, { includeClaims = true } = {}) {
  if (artifact.timeline || Array.isArray(artifact.items)) {
    return renderTimelineSummary(artifact.timeline ?? artifact);
  }

  return renderEvidenceSummary(artifact, { includeClaims });
}

function renderEvidenceSummary(pack = {}, { includeClaims }) {
  const sources = Array.isArray(pack.sources) ? pack.sources : [];
  const claims = Array.isArray(pack.claims) ? pack.claims : [];
  const gaps = dedupeObjects(Array.isArray(pack.gaps) ? pack.gaps : [], gapKey);
  const conflicts = dedupeObjects(Array.isArray(pack.conflicts) ? pack.conflicts : [], conflictKey);
  const assumptions = dedupeScalars(Array.isArray(pack.assumptions) ? pack.assumptions : []);
  const lines = ["# Evidence Pack", "", "## Summary"];

  lines.push(`- Sources: ${sources.length}`);
  lines.push(`- Claims: ${claims.length}`);
  lines.push(`- Gaps: ${gaps.length}`);
  lines.push(`- Conflicts: ${conflicts.length}`);

  lines.push("", "## Sources");
  if (sources.length === 0) {
    lines.push("- No sources captured.");
  } else {
    for (const source of sources) {
      lines.push(
        `- ${source.id ?? "source"} (${source.type ?? "unknown"}) - captured: ${
          source.captured_at ?? "unknown"
        }, freshness: ${source.freshness ?? "unknown"}`
      );
    }
  }

  if (includeClaims) {
    lines.push("", "## Claims");
    if (claims.length === 0) {
      lines.push("- No claims extracted.");
    } else {
      for (const claim of claims) {
        lines.push(`- ${claim.text ?? claim.claim ?? "Unspecified claim"}`);
      }
    }
  }

  if (gaps.length > 0) {
    lines.push("", "## Gaps");
    for (const gap of gaps) {
      lines.push(`- ${gap.type ?? gap.field ?? "gap"}: ${gap.message ?? gap.question ?? "Follow-up needed."}`);
    }
  }

  if (conflicts.length > 0) {
    lines.push("", "## Conflicts");
    for (const conflict of conflicts) {
      lines.push(`- ${conflict.claim ?? conflict.message ?? conflict.type ?? "Unspecified conflict"}`);
    }
  }

  if (assumptions.length > 0) {
    lines.push("", "## Assumptions");
    for (const assumption of assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderTimelineSummary(timeline = {}) {
  const items = Array.isArray(timeline.items) ? timeline.items : [];
  const gaps = dedupeObjects(Array.isArray(timeline.gaps) ? timeline.gaps : [], timelineGapKey).filter((gap) => !isMetadataGap(gap));
  const assumptions = dedupeScalars(Array.isArray(timeline.assumptions) ? timeline.assumptions : []);
  const lines = ["# Timeline", ""];

  for (const item of items) {
    const dateLabel = item.start
      ? `${item.start}${item.end ? ` to ${item.end}` : item.duration ? ` for ${item.duration}` : ""}`
      : item.date_status === "tbc"
        ? "TBC"
        : "date needed";
    lines.push(`- **${item.title}** (${item.date_status ?? "tbc"}) - ${dateLabel}`);
  }

  if (gaps.length > 0) {
    lines.push("", "## Gaps");
    for (const gap of gaps) {
      lines.push(`- ${gap.itemTitle ?? "Timeline item"}: ${gap.field ?? "gap"} - ${gap.question ?? "Follow-up needed."}`);
    }
  }

  if (assumptions.length > 0) {
    lines.push("", "## Assumptions");
    for (const assumption of assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderInternalEvidencePack(artifact = {}) {
  const sanitized = cloneWithoutRawContent(artifact);
  return JSON.stringify(sanitized, null, 2);
}

function cloneWithoutRawContent(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutRawContent);
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "content") {
      next.content_redacted = true;
      continue;
    }
    next[key] = cloneWithoutRawContent(entry);
  }
  return next;
}

function dedupeObjects(values, keyFn) {
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

function dedupeScalars(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function gapKey(gap = {}) {
  return [
    String(gap.type ?? gap.field ?? "gap").toLowerCase(),
    String(gap.source_id ?? gap.itemTitle ?? "").toLowerCase(),
    String(gap.message ?? gap.question ?? "").toLowerCase()
  ].join("|");
}

function timelineGapKey(gap = {}) {
  return [
    String(gap.itemTitle ?? "Timeline item").toLowerCase(),
    String(gap.field ?? "gap").toLowerCase(),
    String(gap.question ?? "Follow-up needed.").toLowerCase()
  ].join("|");
}

function conflictKey(conflict = {}) {
  return [
    String(conflict.claim ?? conflict.message ?? conflict.type ?? "conflict").toLowerCase(),
    JSON.stringify(conflict.source_a ?? conflict.sourceA ?? {}),
    JSON.stringify(conflict.source_b ?? conflict.sourceB ?? {})
  ].join("|");
}

function isMetadataGap(gap = {}) {
  const title = String(gap.itemTitle ?? "").trim().toLowerCase();
  return ["generated", "timezone", "time zone"].includes(title);
}
