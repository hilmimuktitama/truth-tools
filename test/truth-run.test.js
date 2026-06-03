import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../src/cli.js";
import { callTruthTool, listTruthTools } from "../src/mcp-tools.js";

const CAPTURED_AT = "2026-05-17T14:57:23.445Z";

test("truth.run is exposed as the high-level agent contract", () => {
  assert.equal(listTruthTools().some((tool) => tool.name === "truth.run"), true);
});

test("truth.run returns a canonical artifact and repo-safe summary without source bodies", () => {
  const run = callTruthTool("truth.run", atlasRunInput());

  assert.match(run.id, /^truth-run-/);
  assert.equal(run.created_at, CAPTURED_AT);
  assert.equal(run.initiative.name, "Atlas MCP");
  assert.deepEqual(
    run.agent_steps.map((step) => [step.id, step.status]),
    [
      ["capture", "complete"],
      ["timeline", "complete"],
      ["program", "complete"],
      ["repo_safe_summary", "complete"]
    ]
  );
  assert.equal(run.sources.every((source) => source.content === undefined), true);
  assert.equal(run.raw_local_policy.mode, "raw-local-only");
  assert.equal(run.quality.readiness, "needs_review");
  assert.equal(Array.isArray(run.quality.reasons), true);
  assert.equal(run.quality.reasons.some((reason) => reason.type === "timeline_gap"), true);
  assert.equal(run.quality.blocking_gaps.some((gap) => gap.field === "owner"), true);
  assert.equal(run.artifacts.evidence_pack.schema_version, "0.2.0");
  assert.equal(Array.isArray(run.artifacts.evidence_pack.diagnostics.sources), true);
  assert.equal(run.artifacts.timeline.schema_version, "0.2.0");
  assert.equal(Array.isArray(run.artifacts.timeline.diagnostics.sources), true);
  assert.equal(Array.isArray(run.artifacts.program_status.readiness_reasons), true);
  assert.equal(run.artifacts.timeline.items.some((item) => item.title === "Atlas MCP need to be delivered"), true);
  assert.equal(
    run.artifacts.timeline.items.find((item) => item.title === "Atlas MCP need to be delivered")?.start,
    "2026-12-09"
  );
  assert.doesNotMatch(JSON.stringify(run), /secret=abc123/);
  assert.doesNotMatch(run.repo_safe_summary, /secret=abc123/);
  assert.doesNotMatch(run.repo_safe_summary, /^- Generated:/m);
  assert.doesNotMatch(run.repo_safe_summary, /^- Timezone:/m);
});

test("truth.run uses source profiles to turn chunked Markdown notes into meaningful timeline items", () => {
  const run = callTruthTool("truth.run", atlasRunInput());
  const titles = run.artifacts.timeline.items.map((item) => item.title);
  const gapTitles = run.artifacts.timeline.gaps.map((gap) => gap.itemTitle);

  assert.equal(titles.includes("Project"), false);
  assert.equal(titles.some((title) => title.startsWith("Chunked estimate notes")), false);
  assert.equal(titles.includes("Atlas CRM Cleanup Estimate 1"), true);
  assert.equal(titles.includes("Atlas CRM Cleanup Estimate 3"), true);
  assert.equal(titles.includes("Atlas CRM Cleanup Progress 4"), true);
  assert.equal(gapTitles.includes("Project"), false);
  assert.equal(gapTitles.some((title) => title?.startsWith("Chunked progress notes")), false);
});

test("truth run CLI writes the canonical artifact and Markdown summary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "truth-run-"));
  const inputPath = join(dir, "run-input.json");
  const outDir = join(dir, "out");
  writeFileSync(inputPath, `\uFEFF${JSON.stringify(atlasRunInput(), null, 2)}`);

  const { code } = await captureStdout(() => runCli(["truth", "run", "--input", inputPath, "--out", outDir]));

  assert.equal(code, 0);
  const savedRun = JSON.parse(readFileSync(join(outDir, "truth_run.json"), "utf8"));
  const savedSummary = readFileSync(join(outDir, "repo-safe-summary.md"), "utf8");
  const savedRawSource = readFileSync(join(outDir, "raw-local", "sources", "paste-1.txt"), "utf8");

  assert.equal(savedRun.id, "truth-run-atlas-mcp-2026-05-17t14-57-23-445z");
  assert.match(savedSummary, /^# Repo-safe Summary/);
  assert.match(savedRawSource, /Atlas MCP need to be delivered/);
  assert.doesNotMatch(savedSummary, /secret=abc123/);
});

function atlasRunInput() {
  return {
    id: "truth-run-atlas-mcp-2026-05-17t14-57-23-445z",
    created_at: CAPTURED_AT,
    initiative: {
      name: "Atlas MCP",
      owner: "Platform TPM",
      objective: "Reconstruct current delivery truth."
    },
    notes: ["No source is automatically authoritative."],
    sources: [
      {
        id: "paste-1",
        type: "text",
        profile: "status_note",
        freshness: "unknown",
        content: "Atlas MCP need to be delivered on December 9th 2026. Customer token secret=abc123"
      },
      {
        id: "atlas-estimate-notes",
        type: "markdown",
        profile: "estimate_table",
        freshness: "unknown",
        content: `Generated: May 17, 2026
Timezone: Asia/Bangkok (ICT)
Project: Atlas CRM Cleanup

Chunked estimate notes for the same simulated work project. These notes preserve the original commitment and later forecast changes.

| Note Date | Chunk | Estimated Datetime Note |
| --- | --- | --- |
| Apr 8, 2026 | Estimate 1 | Original committed delivery datetime is Apr 29, 2026, 17:00 ICT. |
| Apr 27, 2026 | Estimate 2 | Forecast changes to May 15, 2026, 17:00 ICT. |
| May 17, 2026 | Estimate 3 | Forecast changes again to June 1, 2026, 17:00 ICT. |
| May 24, 2026 | Estimate 4 | Final tracked estimate remains June 1, 2026, 17:00 ICT. |
`
      },
      {
        id: "atlas-objective-notes",
        type: "markdown",
        profile: "objective_table",
        freshness: "unknown",
        content: `Generated: May 17, 2026
Timezone: Asia/Bangkok (ICT)
Project: Atlas CRM Cleanup

Chunked objective notes for one simulated work project. These notes capture how the initial target and scope were recorded over time.

| Note Date | Chunk | Objective Note |
| --- | --- | --- |
| Apr 1, 2026 | Objective 1 | Initial goal is to clean duplicate CRM accounts, normalize customer fields, and prepare records for migration. |
| Apr 8, 2026 | Objective 2 | Delivery target is stated as Apr 29, 2026, 17:00 ICT. |
`
      },
      {
        id: "atlas-progress-notes",
        type: "markdown",
        profile: "progress_table",
        freshness: "unknown",
        content: `Generated: May 17, 2026
Timezone: Asia/Bangkok (ICT)
Project: Atlas CRM Cleanup

Chunked progress notes for the same simulated work project. These notes show that the original delivery target moved as blockers appeared.

| Note Date | Chunk | Progress Note |
| --- | --- | --- |
| Apr 18, 2026 | Progress 1 | 30% complete; duplicate detection rules are drafted. |
| May 10, 2026 | Progress 3 | 55% complete; cleanup is progressing but blocked by missing regional account owners. |
| May 24, 2026 | Progress 4 | Updated delivery expectation is June 1, 2026, 17:00 ICT. |
`
      }
    ]
  };
}

async function captureStdout(fn) {
  const originalWrite = process.stdout.write;
  let stdout = "";
  process.stdout.write = (chunk, ...args) => {
    stdout += String(chunk);
    const callback = args.find((arg) => typeof arg === "function");
    if (callback) callback();
    return true;
  };

  try {
    return {
      code: await fn(),
      stdout
    };
  } finally {
    process.stdout.write = originalWrite;
  }
}
