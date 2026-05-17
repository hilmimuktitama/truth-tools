import assert from "node:assert/strict";
import test from "node:test";

import { renderForExportProfile } from "../src/exports.js";
import { callTruthTool } from "../src/mcp-tools.js";
import { reconcileProgram } from "../src/program.js";
import { DUMMY_PROJECT_CAPTURED_AT, dummyProjectSources } from "./fixtures/dummy-project-sources.js";

test("local source intake stamps captured_at before capture validation", () => {
  const evidencePack = callTruthTool("capture.create", {
    captured_at: DUMMY_PROJECT_CAPTURED_AT,
    sources: dummyProjectSources
  });
  const validation = callTruthTool("capture.validate", { evidence_pack: evidencePack });

  assert.equal(evidencePack.sources.every((source) => source.captured_at === DUMMY_PROJECT_CAPTURED_AT), true);
  assert.equal(validation.gaps.some((gap) => gap.type === "missing_captured_at"), false);
});

test("timeline creation ignores markdown metadata and extracts project date rows", () => {
  const result = callTruthTool("timeline.create", {
    captured_at: DUMMY_PROJECT_CAPTURED_AT,
    sources: dummyProjectSources
  });
  const titles = result.timeline.items.map((item) => item.title);

  assert.equal(titles.includes("Generated"), false);
  assert.equal(titles.includes("Timezone"), false);
  assert.equal(titles.includes("Initial objective for each dummy project"), false);
  assert.equal(titles.includes("Current progress snapshot for each dummy project"), false);
  assert.deepEqual(titles, ["Atlas CRM Cleanup", "Beacon Inventory Pilot", "CivicPay Portal Refresh"]);
  assert.equal(result.timeline.items.every((item) => item.time_window || item.start || item.end), true);
});

test("program reconciliation deduplicates repeated timeline unknowns", () => {
  const status = reconcileProgram({
    evidence_pack: { claims: [] },
    timeline: {
      gaps: [
        { itemTitle: "Atlas CRM Cleanup", field: "owner", question: "Missing accountable owner." },
        { itemTitle: "Atlas CRM Cleanup", field: "owner", question: "Missing accountable owner." },
        { itemTitle: "Generated", field: "owner", question: "Missing accountable owner." },
        { itemTitle: "Timezone", field: "owner", question: "Missing accountable owner." }
      ]
    }
  });

  assert.deepEqual(
    status.unknowns.map((unknown) => unknown.claim),
    ["Atlas CRM Cleanup: Missing accountable owner."]
  );
});

test("repo-safe raw report deduplicates gaps and keeps raw bodies out", () => {
  const rendered = renderForExportProfile({
    artifact: {
      kind: "evidence_pack",
      sources: [
        {
          id: "dummy-project-estimated-datetimes-md",
          type: "markdown",
          captured_at: DUMMY_PROJECT_CAPTURED_AT,
          freshness: "unknown",
          content: "Customer token secret=abc123"
        }
      ],
      claims: [{ text: "Atlas CRM Cleanup target is May 29, 2026.", source_refs: [{ source_id: "dummy-project-estimated-datetimes-md" }] }],
      gaps: [
        { type: "missing_owner", message: "Atlas CRM Cleanup owner is missing." },
        { type: "missing_owner", message: "Atlas CRM Cleanup owner is missing." }
      ],
      conflicts: []
    },
    profile: "repo-safe-summary"
  });

  assert.equal(rendered.content.match(/Atlas CRM Cleanup owner is missing/g).length, 1);
  assert.doesNotMatch(rendered.content, /abc123/);
  assert.equal(rendered.redaction.blocked_terms.length > 0, true);
});
