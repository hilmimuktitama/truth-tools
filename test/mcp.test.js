import assert from "node:assert/strict";
import test from "node:test";

import { callTruthToolForMcp, listTruthTools } from "../src/mcp-tools.js";

function reviewInput() {
  return {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "MCP sample" },
    sources: [{ id: "release-note", type: "note", captured_at: "2026-08-10T00:00:00.000Z" }],
    claims: [
      {
        id: "release-scope",
        kind: "fact",
        subject: "release.scope",
        value: "phase-1",
        text: "Phase 1 is the current release scope.",
        source_refs: ["release-note"]
      }
    ]
  };
}

test("MCP exposes only review and doctor", () => {
  const tools = listTruthTools();

  assert.deepEqual(tools.map((tool) => tool.name), ["truth.review", "truth.doctor"]);
  assert.deepEqual(tools[0].inputSchema.required, ["as_of", "sources", "claims"]);
  assert.equal(tools[0].inputSchema.additionalProperties, false);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools.every((tool) => tool.annotations.openWorldHint === false), true);
  assert.equal(tools[0].inputSchema.properties.sources.items.properties.note, undefined);
});

test("MCP advertises structured output", () => {
  const [reviewTool, doctorTool] = listTruthTools();
  assert.equal(reviewTool.outputSchema.properties.readiness.enum.includes("blocked"), true);
  assert.deepEqual(doctorTool.outputSchema.required, ["ok", "checks"]);
});

test("MCP returns matching structured and human-readable output", () => {
  const result = callTruthToolForMcp("truth.review", reviewInput());

  assert.equal(result.structuredContent.readiness, "ready");
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /^# Truth Review: MCP sample/);
  assert.match(result.content[0].text, /\*\*Readiness:\*\* ready/);
});
