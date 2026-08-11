const DRIFT_FIELDS = ["start", "end", "duration", "title", "type", "owner", "status", "dependencies", "evidence_grade"];

function keyOf(item) {
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined;
  if (id) return id;
  return `${String(item.start ?? "")}|${String(item.title ?? "")}`;
}

function fieldChanged(from, to, field) {
  const left = from?.[field];
  const right = to?.[field];
  if (left === undefined && right === undefined) return false;
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

export function timelineDiff(baseline = [], current = []) {
  const baseMap = new Map(baseline.map((item) => [keyOf(item), item]));
  const currMap = new Map(current.map((item) => [keyOf(item), item]));

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const [key, item] of currMap) {
    if (!baseMap.has(key)) {
      added.push({ key, item });
      continue;
    }
    const changes = DRIFT_FIELDS.filter((field) => fieldChanged(baseMap.get(key), item, field));
    if (changes.length === 0) {
      unchanged.push({ key, item });
    } else {
      changed.push({
        key,
        title: item.title ?? baseMap.get(key).title,
        changes,
        from: Object.fromEntries(changes.map((field) => [field, baseMap.get(key)[field] ?? null])),
        to: Object.fromEntries(changes.map((field) => [field, item[field] ?? null]))
      });
    }
  }

  for (const [key, item] of baseMap) {
    if (!currMap.has(key)) removed.push({ key, item });
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    summary: {
      baseline: baseline.length,
      current: current.length,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length
    }
  };
}

export function timelineDriftSectionLines(drift) {
  const lines = [
    "## Timeline Drift",
    "",
    `**Baseline:** ${drift.summary.baseline} items — **Current:** ${drift.summary.current} items — ` +
      `**Added:** ${drift.summary.added} — **Removed:** ${drift.summary.removed} — ` +
      `**Changed:** ${drift.summary.changed} — **Unchanged:** ${drift.summary.unchanged}`,
    ""
  ];

  const renderItems = (title, entries, renderEntry) => {
    lines.push(`### ${title}`, "");
    if (entries.length === 0) {
      lines.push("- None.", "");
      return;
    }
    for (const entry of entries) lines.push(`- ${renderEntry(entry)}`);
    lines.push("");
  };

  const renderDate = (item) => {
    const date = item.start ?? item.end ?? item.date;
    return date ? `${date}` : "";
  };

  renderItems("Added", drift.added, ({ item }) => `**${item.title}** (${renderDate(item)}${item.status ? `, ${item.status}` : ""})`);
  renderItems("Removed", drift.removed, ({ item }) => `**${item.title}** (${renderDate(item)}${item.status ? `, ${item.status}` : ""})`);
  renderItems(
    "Changed",
    drift.changed,
    ({ title, changes, from, to }) =>
      `**${title}:** ${changes.map((field) => `${field} ${String(from[field] ?? "none")} -> ${String(to[field] ?? "none")}`).join("; ")}`
  );

  return lines;
}

export function renderTimelineDriftMarkdown(drift) {
  const section = timelineDriftSectionLines(drift);
  const body = section.slice(1).join("\n");
  return `# Timeline Drift\n\n${body}`.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
