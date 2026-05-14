import { assertExportProfile } from "./schemas.js";

const SENSITIVE_PATTERNS = [
  { name: "authorization_header", pattern: /\bAuthorization\s*:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/i },
  { name: "secret_assignment", pattern: /\b(?:secret|token|password|api[_-]?key)\s*[:=]\s*\S+/i },
  { name: "private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { name: "customer_marker", pattern: /\b(?:customer|client)\s+(?:token|secret|credential|data)\b/i }
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
    return {
      profile: exportProfile,
      redaction,
      content: renderInternalEvidencePack(artifact)
    };
  }

  return {
    profile: exportProfile,
    redaction,
    content: renderRepoSafeSummary(artifact, { includeClaims })
  };
}

export function checkRedaction(value) {
  const text = JSON.stringify(value ?? {});
  const blockedTerms = [];

  for (const item of SENSITIVE_PATTERNS) {
    if (item.pattern.test(text)) {
      blockedTerms.push(item.name);
    }
  }

  return {
    ok: blockedTerms.length === 0,
    blocked_terms: blockedTerms
  };
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
  const gaps = Array.isArray(pack.gaps) ? pack.gaps : [];
  const conflicts = Array.isArray(pack.conflicts) ? pack.conflicts : [];
  const assumptions = Array.isArray(pack.assumptions) ? pack.assumptions : [];
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
  const gaps = Array.isArray(timeline.gaps) ? timeline.gaps : [];
  const assumptions = Array.isArray(timeline.assumptions) ? timeline.assumptions : [];
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
