export const SOURCE_PROFILES = [
  "status_note",
  "estimate_table",
  "objective_table",
  "progress_table",
  "timeline_note",
  "decision_log",
  "meeting_note",
  "unknown"
];
const SOURCE_SYSTEMS = new Set(["jira", "confluence", "notion", "local", "csv", "markdown", "json", "unknown"]);

const METADATA_LINE_PATTERN = /^(?:generated|timezone|time\s*zone|package|version|created|updated|last\s+updated)\s*:/i;
const PROJECT_HEADER_PATTERN = /^project\s*:\s*(.+)$/i;
const GENERIC_MARKDOWN_INTRO_PATTERN =
  /^(?:estimated completion datetime|initial objective|current progress snapshot)\s+for each .+\.?$|^chunked\s+(?:estimate|objective|progress)\s+notes\b/i;
const DATE_HEADER_PATTERN = /\b(?:estimated\s+datetime|estimated\s+date|completion|complete\s+by|target|target\s+date|date|datetime|when)\b/i;
const TITLE_HEADER_PATTERN = /^(?:project|name)$/i;
const NOTE_TABLE_PROFILES = new Set(["estimate_table", "objective_table", "progress_table"]);
const TARGET_NOTE_PATTERN = /\b(?:committed|delivery|deliver|forecast|target|expectation|estimated|completion|complete)\b/i;
const MONTHS = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"]
]);
const NATURAL_DATE_PATTERN =
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})(?:,\s*\d{1,2}:\d{2}\s*[A-Z]{2,5})?\b/gi;

export function normalizeSourceInput(input = {}, { forTimeline = false } = {}) {
  const capturedAt = stringOr(input.captured_at ?? input.capturedAt, new Date().toISOString());
  const sources = Array.isArray(input.sources) ? input.sources : [];

  return {
    ...input,
    sources: sources.map((source, index) => normalizeSource(source, index, capturedAt, { forTimeline }))
  };
}

export function normalizeSourceProfile(profile) {
  const normalized = String(profile ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return SOURCE_PROFILES.includes(normalized) ? normalized : "unknown";
}

export function attachSourceMetadata(artifact = {}, sources = []) {
  const byId = new Map((Array.isArray(sources) ? sources : []).map((source) => [source.id, source]));
  return {
    ...artifact,
    sources: Array.isArray(artifact.sources)
      ? artifact.sources.map((source) => {
          const original = byId.get(source.id) ?? {};
          return compactObject({
            ...source,
            profile: original.profile,
            metadata: compactObject({
              ...(source.metadata && typeof source.metadata === "object" ? source.metadata : {}),
              ...(original.metadata && typeof original.metadata === "object" ? original.metadata : {})
            })
          });
        })
      : artifact.sources
  };
}

function normalizeSource(source = {}, index, capturedAt, { forTimeline }) {
  const id = stringOr(source.id, slugify(source.name ?? source.path ?? source.url ?? `source-${index + 1}`));
  const type = normalizeType(source);
  const profile = normalizeSourceProfile(source.profile);
  const content = String(source.content ?? "");
  const project = extractProjectName(content);

  return compactObject({
    ...source,
    id,
    type,
    profile,
    source_system: normalizeSourceSystem(source.source_system ?? source.sourceSystem ?? defaultSourceSystem(source, type)),
    adapter: stringOr(source.adapter, defaultAdapter(source)),
    captured_at: stringOr(source.captured_at, capturedAt),
    freshness: stringOr(source.freshness, "unknown"),
    access_caveats: Array.isArray(source.access_caveats) ? source.access_caveats : [],
    metadata: compactObject({
      ...(source.metadata && typeof source.metadata === "object" ? source.metadata : {}),
      project
    }),
    content: forTimeline ? normalizeContentForTimeline(content, { type, profile, project }) : content
  });
}

function normalizeContentForTimeline(content, { type, profile, project }) {
  if (type === "markdown") return cleanMarkdownForTimeline(content, { profile, project });
  return normalizeNaturalDateText(content);
}

export function cleanMarkdownForTimeline(content = "", { profile = "unknown", project } = {}) {
  const lines = String(content).split(/\r?\n/);
  const cleaned = [];
  let currentProject = project;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      cleaned.push(line);
      continue;
    }

    const projectMatch = trimmed.match(PROJECT_HEADER_PATTERN);
    if (projectMatch) {
      currentProject = projectMatch[1].trim();
      continue;
    }

    if (METADATA_LINE_PATTERN.test(trimmed) || GENERIC_MARKDOWN_INTRO_PATTERN.test(trimmed)) {
      continue;
    }

    if (isMarkdownTableLine(trimmed) && isMarkdownSeparatorLine(lines[index + 1]?.trim())) {
      const table = collectTable(lines, index);
      const transformed = transformMarkdownTable(table, { profile, project: currentProject });
      if (transformed.length > 0) cleaned.push(...transformed);
      index = table.endIndex;
      continue;
    }

    cleaned.push(normalizeNaturalDateText(line));
  }

  return cleaned.join("\n");
}

function transformMarkdownTable(table, { profile, project }) {
  if (NOTE_TABLE_PROFILES.has(profile)) {
    const transformed = transformProfileNoteTable(table, { project });
    if (transformed.length > 0) return transformed;
  }

  return transformProjectDateTable(table);
}

function transformProfileNoteTable(table, { project }) {
  const headers = splitTableRow(table.lines[0]);
  const rows = table.lines.slice(2).map(splitTableRow);
  const noteIndex = headers.findIndex(
    (header) => !/^note\s*date$/i.test(header) && /\b(?:note|status|progress|objective|estimate|datetime)\b/i.test(header)
  );
  const chunkIndex = headers.findIndex((header) => /\bchunk\b/i.test(header));
  const titlePrefix = stringOr(project, "Project");
  const transformedRows = [];

  if (noteIndex === -1 || chunkIndex === -1) return [];

  for (const row of rows) {
    const note = stringOr(row[noteIndex], "");
    const chunk = stringOr(row[chunkIndex], "Note");
    if (!TARGET_NOTE_PATTERN.test(note)) continue;

    const target = extractFirstDateIso(note);
    if (!target) continue;

    transformedRows.push(formatTableRow([`${titlePrefix} ${chunk}`, target, "planned"]));
  }

  if (transformedRows.length === 0) return [];
  return [
    formatTableRow(["Title", "Target", "Status"]),
    formatTableRow(["---", "---", "---"]),
    ...transformedRows
  ];
}

function transformProjectDateTable(table) {
  const headers = splitTableRow(table.lines[0]);
  const hasTitle = headers.some((header) => TITLE_HEADER_PATTERN.test(header.trim()));
  const hasDate = headers.some((header) => DATE_HEADER_PATTERN.test(header.trim()));

  if (hasTitle && !hasDate) return [];
  if (!hasTitle || !hasDate) return [];

  const normalizedHeaders = headers.map((header) => {
    if (TITLE_HEADER_PATTERN.test(header.trim())) return "Title";
    if (DATE_HEADER_PATTERN.test(header.trim())) return "Target";
    return header;
  });
  const transformedRows = table.lines.slice(2).map((line) => {
    const cells = splitTableRow(line).map(normalizeNaturalDateText);
    return formatTableRow(cells);
  });

  return [formatTableRow(normalizedHeaders), table.lines[1], ...transformedRows];
}

function extractProjectName(content = "") {
  for (const line of String(content).split(/\r?\n/)) {
    const match = line.trim().match(PROJECT_HEADER_PATTERN);
    if (match) return match[1].trim();
  }
  return undefined;
}

export function normalizeNaturalDateText(text = "") {
  return String(text).replace(NATURAL_DATE_PATTERN, (_match, monthName, day, year) => {
    const month = MONTHS.get(String(monthName).toLowerCase());
    if (!month) return _match;
    return `${year}-${month}-${String(day).padStart(2, "0")}`;
  });
}

function extractFirstDateIso(text = "") {
  const normalized = normalizeNaturalDateText(text);
  return normalized.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
}

function collectTable(lines, startIndex) {
  const tableLines = [];
  let index = startIndex;

  while (index < lines.length && isMarkdownTableLine(lines[index].trim())) {
    tableLines.push(lines[index]);
    index += 1;
  }

  return {
    lines: tableLines,
    endIndex: index - 1
  };
}

function splitTableRow(line) {
  return String(line)
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function formatTableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function isMarkdownTableLine(line) {
  return line.startsWith("|") && line.endsWith("|") && line.includes("|");
}

function isMarkdownSeparatorLine(line = "") {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function normalizeType(source = {}) {
  const declared = String(source.type ?? "").toLowerCase();
  const name = String(source.name ?? source.path ?? source.file_path ?? source.filePath ?? "").toLowerCase();
  if (declared.includes("markdown") || name.endsWith(".md")) return "markdown";
  if (declared.includes("json") || name.endsWith(".json")) return "json";
  if (declared.includes("csv") || name.endsWith(".csv")) return "csv";
  return declared || "text";
}

function defaultAdapter(source = {}) {
  if (source.adapter) return source.adapter;
  if (source.url) return "url";
  if (source.path || source.file_path || source.filePath) return "local-file";
  return "direct";
}

function normalizeSourceSystem(value) {
  const normalized = String(value ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return SOURCE_SYSTEMS.has(normalized) ? normalized : "unknown";
}

function defaultSourceSystem(source = {}, type = "text") {
  if (source.url && String(source.url).includes("atlassian.net/wiki/")) return "confluence";
  if (source.url && String(source.url).includes("atlassian.net/")) return "jira";
  if (source.url && /notion\.(?:so|site)\//i.test(source.url)) return "notion";
  if (source.path) return "local";
  if (["csv", "markdown", "json"].includes(type)) return type;
  return "unknown";
}

function slugify(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "source";
}

function stringOr(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
