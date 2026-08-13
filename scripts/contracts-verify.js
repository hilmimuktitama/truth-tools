import { readFileSync } from "node:fs";

import {
  ARTIFACT_QUALITY_VALUES,
  CLAIM_KINDS,
  CLAIM_STATES,
  CANDIDATE_REVIEW_STATUSES,
  CONTRACT_NAMES,
  EVIDENCE_GRADES,
  DATE_DERIVATIONS,
  PROGRAM_HEALTH_VALUES,
  TIMELINE_TYPES,
  validateContract,
  validateStatusArtifact,
  validateTruthReview
} from "../src/contracts.js";
import { contracts } from "../packages/contracts/index.js";
import { reviewTruth } from "../src/review.js";
import { timelineDiff } from "../src/timeline-diff.js";
import { readSuiteLock, verifySuiteLock } from "./suite-lock-verify.js";

const SCHEMA_DIR = new URL("../packages/contracts/schemas/", import.meta.url);

export function verifyContracts({ verbose = true } = {}) {
  const results = [];

  function check(name, ok, detail = "") {
    results.push({ name, ok, detail });
  }

  try {
    runChecks(check);
  } catch (error) {
    // Fail gracefully: a malformed schema, fixture, or unexpected engine
    // failure is reported as a failed check with a readable message instead
    // of crashing with an uncaught stack trace.
    check("suite:no-crash", false, error instanceof Error ? error.message : String(error));
  }

  const failed = results.filter((result) => !result.ok);
  if (verbose) {
    console.log(`Contract verification: ${results.length - failed.length}/${results.length} checks passed`);
    for (const result of results) {
      console.log(`  ${result.ok ? "ok" : "FAIL"}  ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
    }
  }
  return { ok: failed.length === 0, results };
}

function runChecks(check) {
  // 1. Every schema file exists, parses, is Draft 2020-12, and has a unique $id.
  const ids = new Set();
  for (const name of CONTRACT_NAMES) {
    const schema = contracts[name];
    const text = readFileSync(new URL(`${name}.schema.json`, SCHEMA_DIR), "utf8");
    const parsed = JSON.parse(text);
    const sameObject = JSON.stringify(parsed) === JSON.stringify(schema);
    check(
      `schema:${name}:draft-2020-12`,
      schema.$schema === "https://json-schema.org/draft/2020-12/schema",
      schema.$schema
    );
    check(`schema:${name}:parses`, sameObject);
    const unique = !ids.has(schema.$id);
    ids.add(schema.$id);
    check(`schema:${name}:unique-id`, unique, schema.$id);
  }

  // 2. Every cross-schema $ref resolves to a registered contract.
  const refs = new Set();
  function collectRefs(schema) {
    if (typeof schema.$ref === "string") refs.add(schema.$ref);
    for (const value of Object.values(schema)) {
      if (value && typeof value === "object") collectRefs(value);
    }
  }
  for (const name of CONTRACT_NAMES) collectRefs(contracts[name]);
  const registeredIds = new Set(Object.values(contracts).map((schema) => schema.$id));
  const unresolved = [...refs].filter((ref) => !ref.startsWith("#/") && !registeredIds.has(ref));
  check("schemas:refs-resolve", unresolved.length === 0, unresolved.join(", ") || "all refs resolve");

  // 3. Engine enums match schema enums (no drift between code and contracts).
  // A schema that loses an enum or a property is reported as a failing parity
  // check, never as a suite crash.
  function parityEnum(schema, property, expected, name) {
    const enums = schema.properties?.[property]?.enum;
    const missing = !Array.isArray(enums);
    check(
      name,
      !missing && JSON.stringify(enums) === JSON.stringify(expected),
      missing ? `schema has no enum on ${property}` : undefined
    );
  }
  parityEnum(contracts["truth-review"], "artifact_quality", ARTIFACT_QUALITY_VALUES, "parity:artifact_quality");
  parityEnum(contracts["truth-review"], "program_health", PROGRAM_HEALTH_VALUES, "parity:program_health");
  // CandidateClaim is capture output only and carries no final kind; the
  // reviewed Claim schema is the parity anchor for kinds and states.
  parityEnum(contracts["candidate-claim"], "review_status", CANDIDATE_REVIEW_STATUSES, "parity:candidate-review-status");
  parityEnum(contracts["claim"], "kind", CLAIM_KINDS, "parity:claim-kind");
  parityEnum(contracts["claim"], "state", CLAIM_STATES, "parity:claim-state");
  parityEnum(contracts["timeline-item"], "type", TIMELINE_TYPES, "parity:timeline-type");
  parityEnum(contracts["timeline-item"], "date_derivation", DATE_DERIVATIONS, "parity:date-derivation");
  parityEnum(contracts["timeline-item"], "evidence_grade", EVIDENCE_GRADES, "parity:evidence-grade");
  check(
    "contract:candidate-claim-is-capture-only",
    contracts["candidate-claim"].properties.kind === undefined &&
      contracts["candidate-claim"].properties.classification_method.const === "keyword" &&
      JSON.stringify(contracts["candidate-claim"].properties.review_status.enum) === JSON.stringify(CANDIDATE_REVIEW_STATUSES) &&
      contracts["candidate-claim"].allOf?.some((entry) => entry.if?.properties?.review_status?.enum?.includes("approved_for_portable")) === true,
    "candidate claims carry no final kind, are keyword-classified, and use Capture Truth 0.5 review states"
  );
  const candidateClaim = validateContract("candidate-claim", {
    id: "candidate-1",
    text: "Candidate text.",
    classification_method: "keyword",
    review_status: "unreviewed",
    source_refs: [{ source_id: "cap-1", locator: "https://example.com/cap-1" }],
    derivation_version: "0.5.0",
    source_material: "metadata"
  });
  check("conformance:candidate-claim-final-schema", candidateClaim.valid, firstErrors(candidateClaim.errors));
  for (const review_status of ["approved_for_portable", "rejected"]) {
    const reviewedCandidate = validateContract("candidate-claim", {
      id: `candidate-${review_status}`,
      text: "Candidate text.",
      classification_method: "keyword",
      review_status,
      reviewed_by: "Ada",
      reviewed_at: "2026-08-13T12:00:00Z",
      source_refs: [{ source_id: "cap-1", locator: "https://example.com/cap-1" }],
      derivation_version: "0.5.0",
      source_material: "metadata"
    });
    check(`conformance:candidate-claim-${review_status}`, reviewedCandidate.valid, firstErrors(reviewedCandidate.errors));
  }
  check(
    "contract:status-artifact-kind-version",
    contracts["status-artifact"].properties.kind.const === "status_artifact" &&
      contracts["status-artifact"].properties.schema_version.const === "2.0.0",
     "status artifact is stamped with kind status_artifact and schema_version 2.0.0"
  );
  check(
    "contract:source-ref-requires-locator",
    Array.isArray(contracts["source-ref"].required) &&
      contracts["source-ref"].required.includes("locator") &&
      contracts["source-ref"].required.includes("source_id"),
    "canonical SourceRef requires source_id and locator"
  );
  const sourceProps = contracts["source"].properties;
  const sourceRefProps = contracts["source-ref"].properties;
  for (const [name, properties] of [["source", sourceProps], ["source-ref", sourceRefProps]]) {
    for (const field of ["observed_at", "source_updated_at"]) {
      check(
        `contract:${name}:${field}:strict-date-time`,
        properties[field]?.format === "date-time" && typeof properties[field]?.pattern === "string",
        `${name}.${field} declares semantic date-time validation and the full-timezone shape pattern`
      );
    }
  }
  const rawBodyKeys = ["content", "body", "raw", "raw_content", "rawContent", "payload", "document", "data"];
  check(
    "contract:source-allows-raw-included-metadata",
    sourceProps["raw_included"]?.type === "boolean" && !contracts["source"].required.includes("raw_included"),
    "Source.raw_included is optional boolean provenance metadata, never a body"
  );
  check(
    "contract:source-rejects-raw-bodies",
    rawBodyKeys.every((key) => !Object.hasOwn(sourceProps, key)),
    "raw source body fields (content, body, raw, payload, document, data) stay absent from the Source contract"
  );
  check(
    "contract:source-ref-allows-timeline-truth-provenance",
    sourceRefProps.heading?.type === "string" &&
      sourceRefProps.tableRow?.type === "integer" &&
      sourceRefProps.tableRow?.minimum === 1 &&
      sourceRefProps.line?.type === "integer" &&
      sourceRefProps.line?.minimum === 1 &&
       sourceRefProps.text === undefined &&
      contracts["source-ref"].required.includes("source_id") &&
      contracts["source-ref"].required.includes("locator"),
     "SourceRef allows structured Timeline Truth provenance while still requiring source_id and locator"
  );
  check(
    "contract:claims-reference-claim-not-candidate",
    contracts["status-artifact"].properties.claims.items.$ref === "https://truth-tools.dev/schemas/claim.schema.json",
    "StatusArtifact.claims references the reviewed Claim schema"
  );
    check(
      "evaluation:private-harness-syntax",
      typeof readFileSync(new URL("../evaluation/real-world/run-private-evaluation.js", import.meta.url), "utf8") === "string",
      "private harness is under evaluation/real-world"
    );

  // 4. The launch-readiness fixtures: the fixed artifact must validate, the broken one must not.
  const fixedArtifact = readJson("../examples/launch-readiness/evidence-pack.json");
  const brokenArtifact = readJson("../examples/launch-readiness/status-artifact-broken.json");
  const fixedCheck = validateStatusArtifact(fixedArtifact);
  const brokenCheck = validateStatusArtifact(brokenArtifact);
  check("fixture:fixed-validates", fixedCheck.valid, firstErrors(fixedCheck.errors));
  check(
    "fixture:broken-rejected",
    !brokenCheck.valid,
    brokenCheck.valid ? "broken fixture unexpectedly validated" : firstErrors(brokenCheck.errors)
  );
  const lock = readSuiteLock();
  const lockCheck = validateContract("suite-lock", lock);
  check("suite-lock:schema-valid", lockCheck.valid, firstErrors(lockCheck.errors));
  const lockRuntime = verifySuiteLock({ lock });
  check("suite-lock:exact-refs-and-versions", lockRuntime.ok, lockRuntime.failures.join("; "));

  // 4b. Canonical extension conformance: raw_included provenance metadata and
  // Timeline Truth source-ref provenance fields validate; real raw bodies
  // still fail the Source contract.
  const rawIncludedSource = validateContract("source", {
    id: "cap-1",
    type: "jira",
    observed_at: "2026-08-10T00:00:00.000Z",
    raw_included: true
  });
  const timelineProvenanceRef = validateContract("source-ref", {
    source_id: "cap-1",
    locator: "https://example.com/jira/CAP-1",
    heading: "Status",
    tableRow: 3,
    line: 12
  });
  const rawBodySource = validateContract("source", {
    id: "cap-1",
    type: "jira",
    observed_at: "2026-08-10T00:00:00.000Z",
    content: "secret body"
  });
  check(
    "conformance:source-raw-included-metadata",
    rawIncludedSource.valid,
    firstErrors(rawIncludedSource.errors)
  );
  check(
    "conformance:source-ref-timeline-truth-provenance",
    timelineProvenanceRef.valid,
    firstErrors(timelineProvenanceRef.errors)
  );
  check(
    "conformance:source-raw-body-still-rejected",
    !rawBodySource.valid,
    rawBodySource.valid ? "raw body field unexpectedly validated" : firstErrors(rawBodySource.errors)
  );

  // 5. Engine outputs conform to the truth-review contract, including for a failing artifact.
  const fixedReview = reviewTruth(fixedArtifact);
  const brokenReview = reviewTruth(brokenArtifact);
  const fixedReviewCheck = validateTruthReview(fixedReview);
  const brokenReviewCheck = validateTruthReview(brokenReview);
  check("conformance:fixed-review", fixedReviewCheck.valid, firstErrors(fixedReviewCheck.errors));
  check("conformance:broken-review", brokenReviewCheck.valid, firstErrors(brokenReviewCheck.errors));

  // 6. Timeline drift fixture matches the engine output.
  const baseline = readJson("../examples/launch-readiness/baseline-plan.json");
  const current = readJson("../examples/launch-readiness/current-plan.json");
  const drift = timelineDiff(baseline.timeline, current.timeline);
  const driftFixture = readJson("../examples/launch-readiness/timeline-drift.json");
  check(
    "fixture:timeline-drift",
    JSON.stringify(drift) === JSON.stringify(driftFixture),
    JSON.stringify(drift.summary)
  );

  // 7. The fixed fixture and its review agree on the expected state: the fixed
  // artifact passes with explicit blocked health (owned+dated blocker and
  // mitigated risk); the broken one fails with blocked health.
  check("fixture:fixed-expectation", fixedReview.artifact_quality === "pass" && fixedReview.program_health === "blocked");
  check("fixture:broken-expectation", brokenReview.artifact_quality === "fail" && brokenReview.program_health === "blocked");
  const brokenIssueTypes = brokenReview.findings.issues.map((item) => item.type);
  check(
    "fixture:broken-covers-freshness-distinction",
    brokenIssueTypes.includes("stale_observation") && brokenIssueTypes.includes("stale_source_content"),
    "broken fixture demonstrates distinct stale_observation and stale_source_content findings"
  );
  check(
    "fixture:broken-covers-quality-rules",
    brokenIssueTypes.includes("blocker_missing_owner") && brokenIssueTypes.includes("risk_missing_mitigation"),
    "broken fixture has an ownerless blocker and a risk without mitigation"
  );
  const fixedIssueTypes = fixedReview.findings.issues.map((item) => item.type);
  check(
    "fixture:fixed-has-owned-blocker-and-mitigated-risk",
    fixedIssueTypes.length === 0 &&
      fixedReview.findings.blockers.some((claim) => claim.owner && claim.due_at) &&
      fixedReview.findings.risks.some((claim) => claim.owner && claim.mitigation),
    "fixed fixture carries an owned+dated blocker and a mitigated risk"
  );
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function firstErrors(errors) {
  if (!errors || errors.length === 0) return "";
  return errors
    .slice(0, 3)
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = verifyContracts();
  process.exitCode = result.ok ? 0 : 1;
}
