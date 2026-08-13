import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import { callTruthToolForMcp, listTruthTools } from "../src/mcp-tools.js";

function reviewInput() {
  return {
    kind: "status_artifact",
    schema_version: "2.0.0",
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "MCP sample" },
    sources: [{ id: "release-note", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }],
    health_assessment: {
      state: "on_track",
      owner: "Platform TPM",
      rationale: "The active evidence contains facts only.",
      source_refs: [{ source_id: "release-note", locator: "https://example.com/notes/status" }]
    },
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
   assert.deepEqual(tools[0].inputSchema.required, ["kind", "schema_version", "as_of"]);
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
  assert.equal(refItems.oneOf[1].properties.text, undefined);
  assert.deepEqual(refItems.oneOf[1].properties.revision.type, ["string", "number", "null"]);
  assert.equal(refItems.oneOf[1].properties.revision.maxLength, 2048);
  assert.deepEqual(sourcesItems.properties.revision.type, ["string", "number", "null"]);
  assert.equal(sourcesItems.properties.revision.maxLength, 2048);
   });

test("MCP health assessment source_refs require canonical SourceRef provenance", () => {
  const [reviewTool] = listTruthTools();
  const validate = new Ajv2020({ strict: true, allowUnionTypes: true }).compile(reviewTool.inputSchema);
  const healthRefs = reviewTool.inputSchema.properties.health_assessment.properties.source_refs;
  const sourceRef = healthRefs.items;

  assert.deepEqual(sourceRef.required, ["source_id", "locator"]);
  assert.equal(sourceRef.additionalProperties, false);
  assert.equal(sourceRef.properties.source_id.maxLength, 2048);
  assert.equal(sourceRef.properties.locator.maxLength, 2048);
  assert.equal(sourceRef.properties.text, undefined);
  assert.equal(sourceRef.properties.content, undefined);
  assert.equal(sourceRef.properties.raw, undefined);

  const artifact = reviewInput();
  assert.equal(validate(artifact), true);

  for (const candidateRef of [
    { source_id: "release-note" },
    { locator: "https://example.com/notes/status" },
    { source_id: "release-note", locator: "https://example.com/notes/status", text: "verbatim" },
    { source_id: "release-note", locator: "https://example.com/notes/status", content: "verbatim" },
    { source_id: "release-note", locator: "https://example.com/notes/status", raw: "verbatim" },
    { source_id: "release-note", locator: "https://example.com/notes/status", undocumented: true },
    { source_id: "release-note", locator: "x".repeat(2049) },
    { source_id: 42, locator: "https://example.com/notes/status" }
  ]) {
    const candidate = structuredClone(artifact);
    candidate.health_assessment.source_refs = [candidateRef];
    assert.equal(validate(candidate), false, JSON.stringify(candidateRef));
  }

  const canonicalProvenance = structuredClone(artifact);
  canonicalProvenance.health_assessment.source_refs = [{
    source_id: "release-note",
    locator: "source:release-note#status",
    note: "Status section",
    heading: "Release status",
    tableRow: 2,
    line: 14,
    revision: "rev-7",
    observed_at: "2026-08-10T00:00:00Z",
    source_updated_at: null,
    content_hash: "sha256:" + "a".repeat(64)
  }];
  assert.equal(validate(canonicalProvenance), true);
});

test("MCP source metadata rejects recursive raw and dangerous aliases while keeping harmless keys", () => {
  const [reviewTool] = listTruthTools();
  const validate = new Ajv2020({ strict: true, allowUnionTypes: true }).compile(reviewTool.inputSchema);
  const artifact = reviewInput();

  for (const key of ["RAWContent", "RAW__Body", "DescriptionMarkdown", " DATA ", "constructor", "__PROTO__"]) {
    const candidate = structuredClone(artifact);
    candidate.sources[0].metadata = { nested: [{ [key]: "secret" }] };
    assert.equal(validate(candidate), false, key);
  }
  for (const key of ["contentful", "context_id", "status_text", "payload_status", "documentation", "content_hash"]) {
    const candidate = structuredClone(artifact);
    candidate.sources[0].metadata = { nested: [{ [key]: "safe" }] };
    assert.equal(validate(candidate), true, key);
  }
});

test("MCP advertises artifact_quality and program_health output", () => {
  const [reviewTool, doctorTool] = listTruthTools();
  assert.deepEqual(reviewTool.outputSchema.properties.artifact_quality.enum, ["pass", "needs_review", "fail"]);
  assert.deepEqual(reviewTool.outputSchema.properties.program_health.enum, ["on_track", "at_risk", "blocked", "unknown"]);
  assert.deepEqual(doctorTool.outputSchema.required, ["ok", "checks"]);
  assert.equal(reviewTool.outputSchema.properties.recommended_actions.maxItems, 200);
  assert.deepEqual(reviewTool.outputSchema.properties.recommended_actions.items.required, ["priority", "type", "action"]);
});

test("MCP strips object revisions and reports their exact blocking paths", () => {
  const input = reviewInput();
  input.sources[0].revision = { arbitrary: "object" };
  input.claims[0].source_refs[0].revision = { arbitrary: "object" };

  const result = callTruthToolForMcp("truth.review", input).structuredContent;
  assert.equal(Object.hasOwn(result.sources[0], "revision"), false);
  assert.equal(Object.hasOwn(result.claims[0].source_refs[0], "revision"), false);
  assert.deepEqual(
    result.findings.issues.filter((item) => item.type === "invalid_revision").map((item) => item.location),
    ["sources[0].revision", "claims[0].source_refs[0].revision"]
  );
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

test("MCP canonical v2 artifact runs end to end", () => {
  const result = callTruthToolForMcp("truth.review", reviewInput());
  assert.equal(result.structuredContent.schema_version, "2.0.0");
  assert.equal(result.structuredContent.kind, "truth_review");
});
