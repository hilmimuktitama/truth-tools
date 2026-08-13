import { timelineDriftSectionLines } from "./timeline-diff.js";

export function renderReviewMarkdown(review) {
  const lines = [
    `# Truth Review: ${inline(review.initiative.name)}`,
    "",
    `**Artifact quality:** ${inline(review.artifact_quality)}`,
    `**Program health:** ${inline(review.program_health)}`,
    `**Reported health:** ${inline(review.reported_program_health ?? "missing")}`,
    `**Claim health floor:** ${inline(review.claim_health_floor)}`,
    `**Health consistency:** ${inline(review.health_consistency)}`,
    `**As of:** ${inline(review.as_of)}`,
    "",
    "## Scorecard",
    "",
    "| Sources | Claims | Facts | Blockers | Risks | Unknowns | Conflicts | Evidence issues | Deprecations |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${review.summary.sources} | ${review.summary.claims} | ${review.summary.facts} | ${review.summary.blockers} | ${review.summary.risks} | ${review.summary.unknowns} | ${review.summary.conflicts} | ${review.summary.issues} | ${review.summary.deprecations} |`,
    "",
    ...renderClaims("Facts", review.findings.facts),
    ...renderClaims("Blockers", review.findings.blockers),
    ...renderClaims("Risks", review.findings.risks),
    ...renderClaims("Unknowns", review.findings.unknowns),
    ...renderConflicts(review.findings.conflicts),
    ...(review.timeline_drift ? timelineDriftSectionLines(review.timeline_drift) : []),
    ...renderIssues(review.findings.issues),
    ...renderDeprecations(review.findings.deprecations),
    ...renderActions(review.recommended_actions),
    "",
    "## Evidence",
    "",
    ...renderSources(review.sources)
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function renderClaims(title, claims = []) {
  const lines = [`## ${title}`, ""];
  if (claims.length === 0) return [...lines, "- None.", ""];

  for (const claim of claims) {
    const owner = claim.owner ? ` Owner: ${inline(claim.owner)}.` : "";
    const dueAt = claim.due_at ? ` Due: ${inline(humanDate(claim.due_at))}.` : "";
    lines.push(
      `- **${code(claim.id ?? "missing-id")}:** ${inline(claim.text)}${owner}${dueAt} Sources: ${formatRefs(claim.source_refs)}.`
    );
  }
  lines.push("");
  return lines;
}

function renderConflicts(conflicts = []) {
  const lines = ["## Conflicts", ""];
  if (conflicts.length === 0) return [...lines, "- None.", ""];

  for (const conflict of conflicts) {
    const values = conflict.values.map((entry) => inline(JSON.stringify(entry.value))).join(" vs ");
    lines.push(`- **${inline(conflict.subject)}:** ${values}. ${inline(conflict.action)}`);
  }
  lines.push("");
  return lines;
}

function renderIssues(issues = []) {
  const lines = ["## Evidence Issues", ""];
  if (issues.length === 0) return [...lines, "- None.", ""];

  for (const item of issues) {
    lines.push(
      `- **${inline(item.severity.toUpperCase())} — ${inline(item.type)}** at ${code(item.location)}: ${inline(item.message)}`
    );
  }
  lines.push("");
  return lines;
}

function renderDeprecations(deprecations = []) {
  const lines = ["## Deprecations", ""];
  if (deprecations.length === 0) return [...lines, "- None.", ""];

  for (const item of deprecations) {
    const suggested = item.suggested ? ` Suggested: ${code(item.suggested)}.` : "";
    lines.push(`- **${inline(item.type)}** at ${code(item.location)}: ${inline(item.message)}${suggested}`);
  }
  lines.push("");
  return lines;
}

function renderActions(actions = []) {
  const lines = ["## Next Actions", ""];
  if (actions.length === 0) return [...lines, "- No follow-up required.", ""];

  for (const item of actions) lines.push(`- **${inline(item.priority)}** ${inline(item.action)}`);
  lines.push("");
  return lines;
}

function renderSources(sources = []) {
  if (sources.length === 0) return ["- None."];
  return sources.map((source) => {
    const location = source.url ? ` — ${inline(source.url)}` : "";
    const updated = source.source_updated_at ? `, source updated ${inline(humanDate(source.source_updated_at))}` : "";
    return `- ${code(source.id ?? "missing-id")} (${inline(source.type)}) observed ${inline(humanDate(source.observed_at ?? "unknown"))}${updated}${location}`;
  });
}

function formatRefs(refs = []) {
  return refs.map((ref) => code(ref.source_id ?? ref)).join(", ") || "none";
}

function code(value) {
  return `\`${inline(value).replace(/`/g, "'")}\``;
}

// Markdown is often rendered to HTML, so text that carries HTML metacharacters
// must be escaped in addition to the existing single-line/table-cell
// normalization. <, >, and & become entities so they cannot be interpreted as
// markup; markdown emphasis markers are escaped so user text is never treated
// as formatting.
function inline(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/`/g, "'")
    .trim();
}

function humanDate(value) {
  const text = String(value ?? "");
  return text.endsWith("T00:00:00.000Z") ? text.slice(0, 10) : text;
}
