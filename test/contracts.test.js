import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ARTIFACT_QUALITY_VALUES,
  CLAIM_KINDS,
  CONTRACT_NAMES,
  PROGRAM_HEALTH_VALUES,
  SCHEMA_VERSION,
  validateContract,
  validateStatusArtifact,
  validateTruthReview
} from "../src/contracts.js";
import { contracts } from "../packages/contracts/index.js";
import { reviewTruth } from "../src/review.js";
import { verifyContracts } from "../scripts/contracts-verify.js";

function canonicalArtifact() {
  return {
    kind: "status_artifact",
    schema_version: "2.0.0",
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Contract sample" },
    policy: { max_observation_age_days: 14, max_source_content_age_days: 14 },
    sources: [
      { id: "s1", type: "jira", observed_at: "2026-08-10T00:00:00.000Z", source_updated_at: "2026-08-10T00:00:00.000Z" }
    ],
    health_assessment: {
      state: "on_track",
      owner: "Platform TPM",
      rationale: "The active evidence contains facts only.",
      source_refs: [{ source_id: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }]
    },
    claims: [
      {
        id: "c1",
        kind: "fact",
        subject: "scope.phase",
        value: "phase-1",
        text: "Phase 1 is current.",
        source_refs: [{ source_id: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }]
      }
    ]
  };
}

test("every contract is Draft 2020-12 with a unique id", () => {
  for (const name of CONTRACT_NAMES) {
    const schema = contracts[name];
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", name);
    assert.ok(schema.$id, name);
    assert.equal(schema.type, "object", name);
  }
  const ids = new Set(CONTRACT_NAMES.map((name) => contracts[name].$id));
  assert.equal(ids.size, CONTRACT_NAMES.length);
});

test("the canonical StatusArtifact validates and its review validates", () => {
  const artifact = canonicalArtifact();
  const artifactCheck = validateStatusArtifact(artifact);
  assert.equal(artifactCheck.valid, true);

  const review = reviewTruth(artifact);
  const reviewCheck = validateTruthReview(review);
  assert.equal(reviewCheck.valid, true, JSON.stringify(reviewCheck.errors));
});

test("the contracts package rejects raw bodies, missing timestamps, and unknown kinds", () => {
  const withRawBody = canonicalArtifact();
  withRawBody.sources[0].content = "secret";
  assert.equal(validateStatusArtifact(withRawBody).valid, false);

  const noTimestamp = canonicalArtifact();
  delete noTimestamp.sources[0].observed_at;
  assert.equal(validateStatusArtifact(noTimestamp).valid, false);

  const badKind = canonicalArtifact();
  badKind.claims[0].kind = "maybe";
  assert.equal(validateStatusArtifact(badKind).valid, false);

  const topLevelJunk = canonicalArtifact();
  topLevelJunk.debug = true;
  assert.equal(validateStatusArtifact(topLevelJunk).valid, false);
});

test("the canonical Claim schema requires at least one source_ref", () => {
  const claim = canonicalArtifact().claims[0];
  const missing = { ...claim };
  delete missing.source_refs;

  assert.equal(validateContract("claim", missing).valid, false);
  assert.equal(validateContract("claim", { ...claim, source_refs: [] }).valid, false);
});

test("the Source schema rejects raw-like keys recursively in fields and metadata", () => {
  const source = canonicalArtifact().sources[0];
  source.fields = { safe: { label: "contentful" }, nested: [{ body: "secret" }] };
  source.metadata = { safe: { note: "payload status" }, nested: { data: "secret" } };

  assert.equal(validateContract("source", source).valid, false);
});

test("the Source schema matches runtime raw aliases case-insensitively without rejecting harmless keys", () => {
  const base = { id: "s1", type: "note", observed_at: "2026-08-10T00:00:00Z" };
  for (const key of ["RAWContent", "RAW__Body", "DESCRIPTIONmarkdown", " DATA ", "Constructor", "__PROTO__"]) {
    assert.equal(validateContract("source", { ...base, fields: { [key]: "secret" } }).valid, false, key);
  }
  for (const key of ["contentful", "context_id", "status_text", "payload_status", "documentation", "content_hash"]) {
    assert.equal(validateContract("source", { ...base, fields: { [key]: "safe" } }).valid, true, key);
  }
});

test("source raw_included is provenance metadata and raw bodies still fail", () => {
  const withMetadata = canonicalArtifact();
  withMetadata.sources[0].raw_included = true;
  assert.equal(validateStatusArtifact(withMetadata).valid, true);

  const withMetadataFalse = canonicalArtifact();
  withMetadataFalse.sources[0].raw_included = false;
  assert.equal(validateStatusArtifact(withMetadataFalse).valid, true);

  const rawBody = canonicalArtifact();
  rawBody.sources[0].raw_included = true;
  rawBody.sources[0].content = "secret";
  assert.equal(validateStatusArtifact(rawBody).valid, false);
});

test("source refs accept Timeline Truth provenance fields but still require locator", () => {
  const artifact = canonicalArtifact();
  artifact.claims[0].source_refs = [
    {
      source_id: "s1",
      locator: "https://example.atlassian.net/browse/PLAT-1",
      heading: "Status",
      tableRow: 3,
      line: 12,
    }
  ];
  assert.equal(validateStatusArtifact(artifact).valid, true);

  // Provenance fields never relax the required source_id + locator contract.
  delete artifact.claims[0].source_refs[0].locator;
  assert.equal(validateStatusArtifact(artifact).valid, false);
});

test("canonical source and source-ref timestamps reject date-only values", () => {
  const source = validateContract("source", {
    id: "s1", type: "jira", observed_at: "2026-08-10"
  });
  const sourceRef = validateContract("source-ref", {
    source_id: "s1", locator: "https://example.com/s1", observed_at: "2026-08-10"
  });
  assert.equal(source.valid, false);
  assert.equal(sourceRef.valid, false);
});

test("Source and SourceRef date-time formats reject impossible values and accept leap-day offsets", () => {
  for (const name of ["source", "source-ref"]) {
    const base = name === "source"
      ? { id: "s1", type: "jira", observed_at: "2024-02-29T00:00:00Z" }
      : { source_id: "s1", locator: "https://example.com/s1" };
    for (const field of ["observed_at", "source_updated_at"]) {
      assert.equal(validateContract(name, { ...base, [field]: "2025-02-29T12:00:00Z" }).valid, false);
      assert.equal(validateContract(name, { ...base, [field]: "2024-02-29T24:00:00Z" }).valid, false);
      assert.equal(validateContract(name, { ...base, [field]: "2024-02-29T12:00:00+24:00" }).valid, false);
      assert.equal(validateContract(name, { ...base, [field]: "2024-02-29T12:34:56.123456789+05:30" }).valid, true);
    }
  }
});

test("engine output conforms even for failing and deprecated inputs", () => {
  const failing = canonicalArtifact();
  failing.sources[0].content = "secret";
  failing.claims.push({
    id: "c2",
    kind: "fact",
    subject: "scope.phase",
    value: "phase-2",
    text: "Phase 2 is current.",
    source_refs: [{ source_id: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }]
  });
  const failingReview = reviewTruth(failing);
  assert.equal(failingReview.artifact_quality, "fail");
  assert.equal(validateTruthReview(failingReview).valid, true);

  const deprecated = canonicalArtifact();
  deprecated.sources[0].captured_at = deprecated.sources[0].observed_at;
  delete deprecated.sources[0].observed_at;
  // Deprecated sourceId refs keep their locator so the normalized review still
  // conforms to the source-ref contract; the deprecation is reported.
  deprecated.claims[0].source_refs = [{ sourceId: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }];
  const deprecatedReview = reviewTruth(deprecated);
  assert.equal(deprecatedReview.artifact_quality, "pass");
  assert.equal(deprecatedReview.summary.deprecations, 2);
  assert.equal(validateTruthReview(deprecatedReview).valid, true);
});

test("engine enums match the schema enums", () => {
  const reviewSchema = contracts["truth-review"];
  const claim = contracts["claim"];
  assert.deepEqual(reviewSchema.properties.artifact_quality.enum, ARTIFACT_QUALITY_VALUES);
  assert.deepEqual(reviewSchema.properties.program_health.enum, PROGRAM_HEALTH_VALUES);
  // The reviewed Claim schema is the parity anchor for kinds; the CandidateClaim
  // is capture output only and intentionally carries no final kind.
  assert.deepEqual(claim.properties.kind.enum, CLAIM_KINDS);
});

test("truth-review schema constrains the container", () => {
  const review = reviewTruth(canonicalArtifact());
  const broken = { ...review, artifact_quality: "maybe" };
  assert.equal(validateTruthReview(broken).valid, false);

  const missingKind = { ...review };
  delete missingKind.kind;
  assert.equal(validateTruthReview(missingKind).valid, false);

  assert.equal(review.schema_version, SCHEMA_VERSION);
});

test("contracts verify script reports a clean suite", () => {
  const result = verifyContracts({ verbose: false });
  assert.equal(result.ok, true);
});

test("source-ref schema accepts objects with source_id and locator, not strings", () => {
  const canonical = validateContract("source-ref", { source_id: "s1", locator: "https://example.com/s1" });
  assert.equal(canonical.valid, true);

  const stringRef = validateContract("source-ref", "s1");
  assert.equal(stringRef.valid, false);

  const missingLocator = validateContract("source-ref", { source_id: "s1" });
  assert.equal(missingLocator.valid, false, "the canonical SourceRef requires a concrete locator");

  const missingId = validateContract("source-ref", { note: "nope" });
  assert.equal(missingId.valid, false);
});

test("CandidateClaim matches Capture Truth 0.5 review semantics", () => {
  const base = {
    id: "candidate-1",
    text: "Candidate text.",
    classification_method: "keyword",
    source_refs: [{ source_id: "s1", locator: "source:s1" }],
    derivation_version: "0.5.1",
    source_material: "metadata"
  };

  assert.equal(validateContract("candidate-claim", { ...base, review_status: "unreviewed" }).valid, true);
  assert.equal(validateContract("candidate-claim", { ...base, review_status: "unreviewed", reviewed_by: null, reviewed_at: null }).valid, true);
  for (const review_status of ["approved_for_portable", "rejected"]) {
    assert.equal(validateContract("candidate-claim", { ...base, review_status }).valid, false);
    assert.equal(validateContract("candidate-claim", {
      ...base,
      review_status,
      reviewed_by: "Ada",
      reviewed_at: "2026-08-13T12:00:00Z"
    }).valid, true);
    assert.equal(validateContract("candidate-claim", {
      ...base,
      review_status,
      reviewed_by: "   ",
      reviewed_at: "2026-08-13T12:00:00Z"
    }).valid, false);
  }
  assert.equal(validateContract("candidate-claim", { ...base, review_status: "unreviewed", kind: "fact" }).valid, false);
  assert.equal(validateContract("candidate-claim", { ...base, review_status: "unreviewed", source_refs: [{ source_id: "s1", locator: "source:s1", text: "verbatim" }] }).valid, false);
});

test("schema files on disk match the exported contracts", () => {
  for (const name of CONTRACT_NAMES) {
    const onDisk = JSON.parse(
      readFileSync(new URL(`../packages/contracts/schemas/${name}.schema.json`, import.meta.url), "utf8")
    );
    assert.deepEqual(onDisk, contracts[name]);
  }
});
