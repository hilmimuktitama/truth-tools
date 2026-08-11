import assert from "node:assert/strict";
import test from "node:test";

import { callTruthToolForMcp, listTruthTools } from "../src/mcp-tools.js";

function reviewInput() {
  return {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "MCP sample" },
    sources: [{ id: "release-note", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }],
    claims: [
      {
        id: "release-scope",
        kind: "fact",
        subject: "release.scope",
        value: "phase-1",
        text: "Phase 1 is the current release scope.",
        source_refs: [{ source_id: "release-note", locator: "https://example.com/notes/status" }]
      }
    ]
  };
}

test("MCP exposes only review and doctor", () => {
  const tools = listTruthTools();

  assert.deepEqual(tools.map((tool) => tool.name), ["truth.review", "truth.doctor"]);
  assert.deepEqual(tools[0].inputSchema.required, ["as_of"]);
  assert.equal(tools[0].inputSchema.additionalProperties, false);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools.every((tool) => tool.annotations.openWorldHint === false), true);
  assert.equal(tools[0].inputSchema.properties.sources.items.properties.note, undefined);
});

test("MCP input schema reaches engine findings: aliases and empty collections are allowed", () => {
  const [reviewTool] = listTruthTools();
  const sourcesItems = reviewTool.inputSchema.properties.sources.items;
  const claimsItems = reviewTool.inputSchema.properties.claims.items;

  // Missing/empty collections reach the engine so no_sources/no_claims
  // findings surface through MCP instead of being rejected at the boundary.
  assert.equal(reviewTool.inputSchema.properties.sources.minItems, undefined);
  assert.equal(reviewTool.inputSchema.properties.claims.minItems, undefined);
  assert.equal(sourcesItems.required, undefined);
  assert.equal(claimsItems.required, undefined);

  // Compatibility aliases are permitted and documented as deprecated.
  assert.ok(sourcesItems.properties.captured_at);
  assert.ok(sourcesItems.properties.sourceId);
  assert.ok(sourcesItems.properties.observed_at);
  const refItems = claimsItems.properties.source_refs.items;
  assert.equal(refItems.oneOf.length, 2);
  assert.ok(refItems.oneOf[1].properties.sourceId, "ref-level sourceId alias is permitted");

  // Raw source bodies and undocumented fields stay rejected at the boundary.
  assert.equal(sourcesItems.properties.content, undefined);
  assert.equal(sourcesItems.additionalProperties, false);
  assert.ok(sourcesItems.properties.raw_included);
  assert.ok(refItems.oneOf[1].properties.heading);
  assert.ok(refItems.oneOf[1].properties.tableRow);
  assert.ok(refItems.oneOf[1].properties.line);
  assert.ok(refItems.oneOf[1].properties.text);
});

test("MCP advertises artifact_quality and program_health output", () => {
  const [reviewTool, doctorTool] = listTruthTools();
  assert.deepEqual(reviewTool.outputSchema.properties.artifact_quality.enum, ["pass", "needs_review", "fail"]);
  assert.deepEqual(reviewTool.outputSchema.properties.program_health.enum, ["on_track", "at_risk", "blocked", "unknown"]);
  assert.deepEqual(doctorTool.outputSchema.required, ["ok", "checks"]);
});

test("MCP returns matching structured and human-readable output", () => {
  const result = callTruthToolForMcp("truth.review", reviewInput());

  assert.equal(result.structuredContent.artifact_quality, "pass");
  assert.equal(result.structuredContent.program_health, "on_track");
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /^# Truth Review: MCP sample/);
  assert.match(result.content[0].text, /\*\*Artifact quality:\*\* pass/);
  assert.match(result.content[0].text, /\*\*Program health:\*\* on\\_track/);
});

test("MCP surfaces engine errors for missing as_of", () => {
  const input = reviewInput();
  delete input.as_of;

  assert.throws(() => callTruthToolForMcp("truth.review", input), /as_of is required/);
});
