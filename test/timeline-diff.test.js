import assert from "node:assert/strict";
import test from "node:test";

import { renderTimelineDriftMarkdown, timelineDiff, timelineDriftSectionLines } from "../src/timeline-diff.js";

function item(id, title, start, status) {
  return { id, title, start, end: start, duration: "1d", type: "task", owner: "Platform TPM", status, dependencies: [] };
}

function baseline() {
  return [
    item("t1", "Rollback drill", "2026-07-27", "planned"),
    item("t2", "Load test", "2026-08-03", "planned"),
    item("t3", "Freeze", "2026-08-10", "planned"),
    item("t4", "Launch", "2026-08-17", "planned")
  ];
}

test("detects added, removed, changed, and unchanged items by id", () => {
  const drift = timelineDiff(baseline(), [
    item("t1", "Rollback drill", "2026-07-27", "done"),
    item("t2", "Load test", "2026-08-14", "in_progress"),
    item("t3", "Freeze", "2026-08-10", "planned"),
    item("t5", "Launch", "2026-08-20", "planned")
  ]);

  assert.equal(drift.added.length, 1);
  assert.equal(drift.added[0].item.id, "t5");
  assert.equal(drift.removed.length, 1);
  assert.equal(drift.removed[0].item.id, "t4");
  assert.equal(drift.changed.length, 2);
  assert.equal(drift.unchanged.length, 1);
  assert.equal(drift.unchanged[0].item.id, "t3");
});

test("changed entries list fields with from and to values", () => {
  const drift = timelineDiff(baseline(), [
    item("t2", "Load test", "2026-08-14", "in_progress")
  ]);

  const change = drift.changed[0];
  assert.deepEqual(change.changes.sort(), ["end", "start", "status"]);
  assert.equal(change.from.start, "2026-08-03");
  assert.equal(change.to.start, "2026-08-14");
  assert.equal(change.from.status, "planned");
  assert.equal(change.to.status, "in_progress");
  assert.equal(change.title, "Load test");
});

test("keys fall back to start plus title when id is absent", () => {
  const drift = timelineDiff(
    [{ start: "2026-08-10", title: "Freeze", status: "planned" }],
    [{ start: "2026-08-10", title: "Freeze", status: "done" }]
  );

  assert.equal(drift.changed.length, 1);
  assert.deepEqual(drift.changed[0].changes, ["status"]);
});

test("identical timelines are fully unchanged", () => {
  const items = baseline();
  const drift = timelineDiff(items, items);

  assert.equal(drift.added.length, 0);
  assert.equal(drift.removed.length, 0);
  assert.equal(drift.changed.length, 0);
  assert.equal(drift.unchanged.length, 4);
  assert.deepEqual(drift.summary, { baseline: 4, current: 4, added: 0, removed: 0, changed: 0, unchanged: 4 });
});

test("empty inputs produce an empty drift", () => {
  const drift = timelineDiff([], []);
  assert.deepEqual(drift.summary, { baseline: 0, current: 0, added: 0, removed: 0, changed: 0, unchanged: 0 });
  assert.equal(Object.hasOwn(drift, "issues"), false, "the dead issues field is removed");
});

test("drift carries no issue findings by design", () => {
  const drift = timelineDiff(baseline(), [item("t6", "Launch", "2026-08-20", "planned")]);
  assert.equal(Object.hasOwn(drift, "issues"), false);
  assert.deepEqual(Object.keys(drift).sort(), ["added", "changed", "removed", "summary", "unchanged"]);
});

test("renders a standalone drift report", () => {
  const drift = timelineDiff(baseline(), [
    item("t2", "Load test", "2026-08-14", "in_progress"),
    item("t5", "Launch", "2026-08-20", "planned")
  ]);
  const markdown = renderTimelineDriftMarkdown(drift);

  assert.match(markdown, /^# Timeline Drift/);
  assert.match(markdown, /\*\*Added:\*\* 1/);
  assert.match(markdown, /\*\*Changed:\*\* 1/);
  assert.match(markdown, /### Added/);
  assert.match(markdown, /### Changed/);
  assert.match(markdown, /start 2026-08-03 -> 2026-08-14/);
  assert.match(markdown, /status planned -> in_progress/);
});

test("section lines work inside a larger document", () => {
  const drift = timelineDiff(baseline(), baseline());
  const section = timelineDriftSectionLines(drift);

  assert.equal(section[0], "## Timeline Drift");
  assert.equal(section.includes("### Changed"), true);
});
