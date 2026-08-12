import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderReviewMarkdown } from "../src/report.js";
import { doctorTruthTools, reviewTruth } from "../src/review.js";

function baseInput() {
  return {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Checkout migration", owner: "Platform TPM" },
    policy: { max_observation_age_days: 14, max_source_content_age_days: 14 },
    sources: [
      { id: "jira", type: "jira", observed_at: "2026-08-10T00:00:00.000Z" },
      { id: "decision", type: "decision-log", observed_at: "2026-08-09T00:00:00.000Z" }
    ],
    claims: [
      {
        id: "date",
        kind: "fact",
        subject: "launch.date",
        value: "2026-08-20",
        text: "Launch is planned for August 20.",
        source_refs: [{ source_id: "jira", locator: "https://example.atlassian.net/browse/PLAT-123" }]
      }
    ]
  };
}

test("returns pass quality and on-track health for a canonical artifact", () => {
  const review = reviewTruth(baseInput());

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.program_health, "on_track");
  assert.equal(review.summary.facts, 1);
  assert.equal(review.findings.issues.length, 0);
  assert.equal(review.findings.conflicts.length, 0);
  assert.equal(review.findings.deprecations.length, 0);
});

test("a blocker claim makes program_health blocked while quality stays pass", () => {
  const input = baseInput();
  input.claims.push({
    id: "b1",
    kind: "blocker",
    text: "Rollback owner is missing.",
    owner: "Platform TPM",
    due_at: "2026-08-14",
    source_refs: [{ source_id: "decision", locator: "https://example.com/decisions/checkout-launch" }]
  });

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.program_health, "blocked");
  assert.equal(review.summary.blockers, 1);
});

test("risks and unknowns make program_health at_risk", () => {
  const risk = baseInput();
  risk.claims[0].kind = "risk";
  assert.equal(reviewTruth(risk).program_health, "at_risk");

  const unknown = baseInput();
  unknown.claims[0].kind = "unknown";
  assert.equal(reviewTruth(unknown).program_health, "at_risk");
});

test("program_health is unknown when no claim is classified", () => {
  const input = baseInput();
  input.claims = [{ id: "x", kind: "maybe", text: "No kind.", source_refs: [{ source_id: "jira" }] }];
  assert.equal(reviewTruth(input).program_health, "unknown");
});

test("does not infer claim kind from prose", () => {
  const input = baseInput();
  input.claims[0].text = "This sounds blocked but is explicitly recorded as a fact.";

  const review = reviewTruth(input);

  assert.equal(review.summary.facts, 1);
  assert.equal(review.summary.blockers, 0);
});

test("blocks claims without valid citations", () => {
  const input = baseInput();
  input.claims.push({ id: "unsupported", kind: "fact", text: "Production is ready.", source_refs: [{ source_id: "missing-source" }] });

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "unknown_source_ref"), true);
});

test("contradictions fail artifact quality", () => {
  const input = baseInput();
  input.claims.push({
    id: "date-decision",
    kind: "fact",
    subject: "launch.date",
    value: "2026-08-22",
    text: "Launch is planned for August 22.",
    source_refs: [{ source_id: "decision" }]
  });

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.conflicts.length, 1);
  assert.equal(review.findings.conflicts[0].subject, "launch.date");
  assert.equal(review.findings.conflicts[0].action.includes("Reconcile"), true);
});

test("a fact and a blocker sharing a subject do not conflict", () => {
  const input = baseInput();
  input.claims.push({
    id: "rollback",
    kind: "blocker",
    subject: "launch.date",
    value: "2026-08-22",
    text: "Launch work is blocked until August 22.",
    source_refs: [{ source_id: "decision" }]
  });

  const review = reviewTruth(input);

  assert.equal(review.findings.conflicts.length, 0, "health claims are not contradiction participants");
  assert.equal(review.program_health, "blocked");
});

test("a fact and a risk sharing a subject do not conflict", () => {
  const input = baseInput();
  input.claims.push({
    id: "capacity",
    kind: "risk",
    subject: "launch.date",
    value: "2026-08-22",
    text: "Launch date may slip to August 22.",
    source_refs: [{ source_id: "decision" }]
  });

  const review = reviewTruth(input);

  assert.equal(review.findings.conflicts.length, 0);
  assert.equal(review.program_health, "at_risk");
});

test("only active fact claims with subject and typed value participate in conflicts", () => {
  const incomplete = baseInput();
  incomplete.claims[0].value = undefined;
  assert.equal(reviewTruth(incomplete).findings.conflicts.length, 0);
  assert.equal(reviewTruth(incomplete).artifact_quality, "needs_review");

  const typed = baseInput();
  typed.claims[0].value = { date: "2026-08-20" };
  assert.equal(reviewTruth(typed).findings.conflicts.length, 0);
});

test("conflict source refs dedupe by full structured identity", () => {
  const input = baseInput();
  input.claims[0].source_refs = [
    { source_id: "jira" },
    { source_id: "jira" },
    { source_id: "jira", note: "Decision log confirms." }
  ];
  input.claims.push({
    id: "date-decision",
    kind: "fact",
    subject: "launch.date",
    value: "2026-08-22",
    text: "Launch is planned for August 22.",
    source_refs: [{ source_id: "jira", note: "Decision log confirms." }]
  });

  const review = reviewTruth(input);
  const conflict = review.findings.conflicts[0];
  assert.equal(conflict.values[0].source_refs.length, 2);
  assert.deepEqual(conflict.values[0].source_refs, [{ source_id: "jira" }, { source_id: "jira", note: "Decision log confirms." }]);
});

test("source refs dedupe by full structured identity, not source_id alone", () => {
  const input = baseInput();
  input.claims[0].source_refs = [
    { source_id: "jira" },
    { source_id: "jira" },
    { source_id: "jira", note: "Primary." },
    { source_id: "jira", note: "Secondary." }
  ];

  const review = reviewTruth(input);
  assert.deepEqual(review.claims[0].source_refs, [
    { source_id: "jira" },
    { source_id: "jira", note: "Primary." },
    { source_id: "jira", note: "Secondary." }
  ]);
});

test("captured_at deprecation is emitted even when observed_at is present", () => {
  const input = baseInput();
  input.sources[0].captured_at = "2026-08-09T00:00:00.000Z";

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.sources[0].observed_at, "2026-08-10T00:00:00.000Z");
  assert.equal(review.summary.deprecations, 1);
  assert.equal(review.findings.deprecations[0].type, "deprecated_captured_at");
});

test("keeps string and number values distinct", () => {
  const input = baseInput();
  input.claims[0].value = 1;
  input.claims.push({
    id: "date-as-string",
    kind: "fact",
    subject: "launch.date",
    value: "1",
    text: "Launch version is the string value 1.",
    source_refs: [{ source_id: "decision" }]
  });

  const review = reviewTruth(input);
  assert.equal(review.findings.conflicts.length, 1);
});

test("reports stale and future-dated sources", () => {
  const stale = baseInput();
  stale.policy.max_observation_age_days = 3;
  stale.sources[0].observed_at = "2026-08-01T00:00:00.000Z";
  const staleReview = reviewTruth(stale);
  assert.equal(staleReview.artifact_quality, "needs_review");
  assert.equal(staleReview.findings.issues.some((item) => item.type === "stale_observation" && item.age_days === 10), true);

  const future = baseInput();
  future.sources[0].observed_at = "2026-08-12T00:00:00.000Z";
  const futureReview = reviewTruth(future);
  assert.equal(futureReview.artifact_quality, "fail");
  assert.equal(futureReview.findings.issues.some((item) => item.type === "future_source"), true);
});

test("rejects raw source bodies and omits them from the output", () => {
  const input = baseInput();
  input.sources[0].content = "Customer secret and internal status body.";

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.sources[0].content, undefined);
  assert.equal(review.findings.issues.filter((item) => item.type === "raw_source_content").length, 1);
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_source_field" && item.field === "content"), false);
});

test("a source id remains citable even when the source fails normalization", () => {
  const input = baseInput();
  input.sources[0].content = "secret";

  const review = reviewTruth(input);

  assert.equal(review.findings.issues.some((item) => item.type === "unknown_source_ref"), false);
  assert.equal(review.findings.issues.some((item) => item.type === "raw_source_content"), true);
});

test("raw_included is provenance metadata, not a raw body", () => {
  const input = baseInput();
  input.sources[0].raw_included = true;

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.findings.issues.some((item) => item.type === "raw_source_content"), false);
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_source_field"), false);
  assert.equal(review.sources[0].raw_included, true);
});

test("a record claiming raw inclusion still never carries a body", () => {
  const input = baseInput();
  input.sources[0].raw_included = true;
  input.sources[0].content = "secret body";

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "raw_source_content"), true);
  assert.equal(review.sources[0].content, undefined);
  assert.equal(review.sources[0].raw_included, true);
});

test("non-boolean raw_included values are dropped, not guessed", () => {
  const input = baseInput();
  input.sources[0].raw_included = "yes";

  const review = reviewTruth(input);

  assert.equal(review.sources[0].raw_included, undefined);
  assert.equal(review.artifact_quality, "pass");
});

test("source refs accept Timeline Truth provenance fields", () => {
  const input = baseInput();
  input.claims[0].source_refs = [
    {
      source_id: "jira",
      locator: "https://example.atlassian.net/browse/PLAT-123",
      heading: "Status",
      tableRow: 3,
      line: 12,
      text: "In Progress"
    }
  ];

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_source_ref_field"), false);
  assert.deepEqual(review.claims[0].source_refs[0], {
    source_id: "jira",
    locator: "https://example.atlassian.net/browse/PLAT-123",
    heading: "Status",
    tableRow: 3,
    line: 12,
    text: "In Progress"
  });
});

test("non-positive integer provenance fields are dropped, not guessed", () => {
  const input = baseInput();
  input.claims[0].source_refs = [
    {
      source_id: "jira",
      locator: "https://example/",
      heading: "Status",
      tableRow: 0,
      line: -1,
      text: "In Progress"
    }
  ];

  const review = reviewTruth(input);

  assert.equal(review.claims[0].source_refs[0].tableRow, undefined);
  assert.equal(review.claims[0].source_refs[0].line, undefined);
  assert.equal(review.claims[0].source_refs[0].heading, "Status");
  assert.equal(review.claims[0].source_refs[0].text, "In Progress");
  assert.equal(review.artifact_quality, "pass");
});

test("blocks unsupported source and claim fields", () => {
  const input = baseInput();
  input.sources[0].confidence = "high";
  input.claims[0].confidence = 0.7;

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_source_field"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_claim_field"), true);
});

test("invalid Source.kind blocks review and is omitted", () => {
  const input = baseInput();
  input.sources[0].kind = "spreadsheet";

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.sources[0].kind, undefined);
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_source_kind"), true);
});

test("source timestamps require full RFC3339 datetimes", () => {
  const input = baseInput();
  input.sources[0].observed_at = "2026-08-10";
  input.sources[0].source_updated_at = "2026-08-10";

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.sources.some((source) => source.id === "jira"), false);
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_observed_at"), true);
});

test("runtime normalization rejects impossible source timestamps", () => {
  for (const field of ["observed_at", "source_updated_at"]) {
    const input = baseInput();
    input.sources[0][field] = "2024-02-29T24:00:00+24:00";
    const review = reviewTruth(input);
    assert.equal(review.artifact_quality, field === "observed_at" ? "fail" : "needs_review");
    assert.equal(review.findings.issues.some((item) => item.type === `invalid_${field}`), true);
  }
});

test("blocks object and null claim values", () => {
  const objectInput = baseInput();
  objectInput.claims[0].value = { date: "2026-08-20" };
  assert.equal(reviewTruth(objectInput).findings.issues.some((item) => item.type === "unsupported_claim_value"), true);

  const nullInput = baseInput();
  nullInput.claims[0].value = null;
  assert.equal(reviewTruth(nullInput).findings.issues.some((item) => item.type === "unsupported_claim_value"), true);
});

test("normalizes captured_at, sourceId, and string refs with deprecation findings", () => {
  const input = {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Legacy input" },
    sources: [{ sourceId: "legacy-source", type: "note", captured_at: "2026-08-10T00:00:00.000Z" }],
    claims: [
      {
        id: "legacy-claim",
        kind: "fact",
        text: "Legacy claim.",
        source_refs: ["legacy-source"]
      }
    ]
  };

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "needs_review");
  assert.equal(review.sources[0].id, "legacy-source");
  assert.equal(review.sources[0].observed_at, "2026-08-10T00:00:00.000Z");
  assert.deepEqual(review.claims[0].source_refs, [{ source_id: "legacy-source" }]);
  assert.equal(
    review.findings.issues.some((item) => item.type === "missing_source_ref_locator"),
    true,
    "deprecated string refs keep working but are flagged for a missing locator"
  );
  const types = review.findings.deprecations.map((item) => item.type).sort();
  assert.deepEqual(types, ["deprecated_captured_at", "deprecated_source_id", "deprecated_string_source_ref"]);
  assert.equal(review.findings.deprecations.every((item) => item.severity === "deprecated"), true);
  assert.equal(review.summary.deprecations, 3);
});

test("deprecations never change artifact quality", () => {
  const input = baseInput();
  input.sources[0].captured_at = input.sources[0].observed_at;
  delete input.sources[0].observed_at;
  input.claims[0].source_refs = [{ sourceId: "jira", locator: "https://example.atlassian.net/browse/PLAT-123" }];

  assert.equal(reviewTruth(input).artifact_quality, "pass");
});

test("blocks duplicate source and claim identities", () => {
  const input = baseInput();
  input.sources.push({ ...input.sources[0] });
  input.claims.push({ ...input.claims[0] });

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "duplicate_source_id"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "duplicate_claim_id"), true);
});

test("blocks evidence without an observation timestamp and drops the source", () => {
  const input = baseInput();
  delete input.sources[0].observed_at;

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "missing_observed_at"), true);
  assert.equal(review.sources.some((source) => source.id === "jira"), false);
});

test("blocks unsupported claim kinds and drops the claim", () => {
  const input = baseInput();
  input.claims.push({ id: "bad", kind: "definitely", text: "Bad kind.", source_refs: [{ source_id: "decision" }] });

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_claim_kind"), true);
  assert.equal(review.claims.some((claim) => claim.id === "bad"), false);
});

test("flags incomplete contradiction keys for review", () => {
  const input = baseInput();
  delete input.claims[0].value;

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "needs_review");
  assert.equal(review.findings.issues.some((item) => item.type === "incomplete_conflict_key"), true);
});

test("requires source_refs to be an array", () => {
  const input = baseInput();
  input.claims[0].source_refs = "jira";

  const review = reviewTruth(input);
  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_source_refs"), true);
});

test("invalid source URLs need review and are omitted from normalized output", () => {
  const input = baseInput();
  input.sources[0].url = "not a URL";

  const review = reviewTruth(input);
  assert.equal(review.artifact_quality, "needs_review");
  assert.equal(review.sources[0].url, undefined);
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_source_url"), true);
});

test("a source updated after as_of needs review", () => {
  const input = baseInput();
  input.sources[0].source_updated_at = "2026-08-12T00:00:00.000Z";

  const review = reviewTruth(input);
  assert.equal(review.artifact_quality, "needs_review");
  assert.equal(review.findings.issues.some((item) => item.type === "source_updated_after_as_of"), true);
});

test("reports a source update after observation and before as_of as a review-level snapshot gap", () => {
  const input = baseInput();
  input.sources[0].observed_at = "2026-08-10T00:00:00.000Z";
  input.sources[0].source_updated_at = "2026-08-10T12:00:00.500Z";

  const review = reviewTruth(input);
  const finding = review.findings.issues.find((item) => item.type === "source_updated_after_observation");

  assert.equal(review.artifact_quality, "needs_review");
  assert.deepEqual(
    { source_id: finding.source_id, observed_at: finding.observed_at, source_updated_at: finding.source_updated_at, as_of: finding.as_of },
    { source_id: "jira", observed_at: "2026-08-10T00:00:00.000Z", source_updated_at: "2026-08-10T12:00:00.500Z", as_of: "2026-08-11T00:00:00.000Z" }
  );
  assert.equal(finding.gap_days, 0.5);
  assert.equal(review.findings.issues.some((item) => item.type === "source_updated_after_as_of"), false);
});

test("does not report a snapshot gap when timestamps are equal", () => {
  const input = baseInput();
  input.sources[0].source_updated_at = input.sources[0].observed_at;
  assert.equal(reviewTruth(input).findings.issues.some((item) => item.type === "source_updated_after_observation"), false);
});

test("reports stale content and snapshot gap simultaneously", () => {
  const input = baseInput();
  input.policy.max_source_content_age_days = 1;
  input.sources[0].observed_at = "2026-08-01T00:00:00.000Z";
  input.sources[0].source_updated_at = "2026-08-09T12:00:00.250Z";

  const review = reviewTruth(input);
  const types = review.findings.issues.map((item) => item.type);
  assert.equal(types.includes("stale_source_content"), true);
  assert.equal(types.includes("source_updated_after_observation"), true);
  assert.equal(types.includes("source_updated_after_as_of"), false);
});

test("requires as_of for reproducible reviews", () => {
  const input = baseInput();
  delete input.as_of;
  assert.throws(() => reviewTruth(input), /as_of is required/);
});

test("rejects ambiguous, timezone-free, and impossible dates", () => {
  const ambiguous = baseInput();
  ambiguous.as_of = "August 11, 2026";
  assert.throws(() => reviewTruth(ambiguous), /must be YYYY-MM-DD or an ISO datetime/);

  const timezoneFree = baseInput();
  timezoneFree.as_of = "2026-08-11T12:00:00";
  assert.throws(() => reviewTruth(timezoneFree), /with Z\/UTC offset/);

  const impossible = baseInput();
  impossible.as_of = "2026-02-30";
  assert.throws(() => reviewTruth(impossible), /invalid calendar date/);
});

test("blocks empty reviews and reports unknown health", () => {
  const review = reviewTruth({
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Empty review" },
    sources: [],
    claims: []
  });

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.program_health, "unknown");
  assert.equal(review.findings.issues.some((item) => item.type === "no_sources"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "no_claims"), true);
});

test("blocks fields outside the documented top-level and policy contracts", () => {
  const input = baseInput();
  input.debug = true;
  input.policy.max_source_age_days = "14";

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_top_level_field"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_max_source_age_days"), true);
});

test("treats fractional source age beyond the policy boundary as stale", () => {
  const input = baseInput();
  input.as_of = "2026-08-11T12:00:00.000Z";
  input.policy.max_observation_age_days = 14;
  input.sources[0].observed_at = "2026-07-28T00:00:00.000Z";

  const review = reviewTruth(input);
  const stale = review.findings.issues.find((item) => item.type === "stale_observation");

  assert.equal(review.artifact_quality, "needs_review");
  assert.equal(stale.age_days, 14.5);
});

test("freshness thresholds use raw milliseconds at equality and plus one millisecond", () => {
  const day = 86_400_000;
  const cases = [
    ["observed_at", "stale_observation"],
    ["source_updated_at", "stale_source_content"]
  ];
  for (const [field, findingType] of cases) {
    const exact = baseInput();
    exact.policy = { max_observation_age_days: 14, max_source_content_age_days: 14 };
    exact.sources[0][field] = new Date(new Date(exact.as_of).getTime() - 14 * day).toISOString();
    assert.equal(reviewTruth(exact).findings.issues.some((item) => item.type === findingType), false, `${field} equality`);

    const plusOne = baseInput();
    plusOne.policy = { max_observation_age_days: 14, max_source_content_age_days: 14 };
    plusOne.sources[0][field] = new Date(new Date(plusOne.as_of).getTime() - 14 * day - 1).toISOString();
    const finding = reviewTruth(plusOne).findings.issues.find((item) => item.type === findingType);
    assert.ok(finding, `${field} +1ms`);
    assert.equal(finding.age_milliseconds, 14 * day + 1);
  }
});

test("snapshot gap uses raw milliseconds while presentation remains rounded", () => {
  const input = baseInput();
  input.sources[0].observed_at = "2026-08-10T00:00:00.000Z";
  input.sources[0].source_updated_at = "2026-08-10T00:00:00.001Z";
  const finding = reviewTruth(input).findings.issues.find((item) => item.type === "source_updated_after_observation");
  assert.ok(finding);
  assert.equal(finding.gap_milliseconds, 1);
  assert.equal(finding.gap_days, 0);
});

test("reports timeline drift when baseline and current timelines are present", () => {
  const input = baseInput();
  input.timeline = [{ id: "t1", title: "Launch", type: "milestone", start: "2026-08-20", end: "2026-08-20", status: "planned" }];
  input.baseline_timeline = [{ id: "t1", title: "Launch", type: "milestone", start: "2026-08-17", end: "2026-08-17", status: "planned" }];

  const review = reviewTruth(input);

  assert.equal(review.timeline.length, 1);
  assert.equal(review.timeline_drift.summary.changed, 1);
  assert.equal(review.timeline_drift.changed[0].changes.includes("start"), true);
  assert.equal(Object.hasOwn(review.timeline_drift, "issues"), false);
});

test("timeline drift is tolerated, not judged", () => {
  const input = baseInput();
  input.timeline = [{ id: "t1", title: "Launch", type: "milestone", start: "2026-08-20", end: "2026-08-20", status: "planned" }];
  input.baseline_timeline = [{ id: "t1", title: "Launch", type: "milestone", start: "2026-08-17", end: "2026-08-17", status: "planned" }];

  const review = reviewTruth(input);

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.findings.issues.some((item) => item.type.includes("timeline")), false);
});

test("normalized claims carry only canonical keys", () => {
  const review = reviewTruth(baseInput());

  for (const claim of review.claims) {
    assert.deepEqual(
      Object.keys(claim).sort(),
      ["id", "kind", "source_refs", "state", "subject", "text", "value"].sort()
    );
    assert.equal(claim.state, "active");
    assert.equal(Array.isArray(claim.source_refs), true);
    assert.equal(typeof claim.source_refs[0].source_id, "string");
    assert.equal(typeof claim.source_refs[0].locator, "string");
  }
});

test("renders quality, health, and safe single-line Markdown", () => {
  const input = baseInput();
  input.claims[0].text = "Launch | scope\nconfirmed.";
  input.claims.push({
    id: "rollback",
    kind: "blocker",
    text: "Rollback owner is missing.",
    owner: "Platform TPM",
    due_at: "2026-08-14",
    source_refs: [{ source_id: "decision", locator: "https://example.com/decisions/checkout-launch" }]
  });
  input.sources[0].captured_at = "2026-08-10T00:00:00.000Z";
  delete input.sources[0].observed_at;

  const markdown = renderReviewMarkdown(reviewTruth(input));

  assert.match(markdown, /^# Truth Review: Checkout migration/);
  assert.match(markdown, /\*\*Artifact quality:\*\* pass/);
  assert.match(markdown, /\*\*Program health:\*\* blocked/);
  assert.match(markdown, /## Facts/);
  assert.match(markdown, /Launch \\| scope confirmed/);
  assert.match(markdown, /Resolve blocker 'Rollback owner is missing' with Platform TPM by 2026-08-14/);
  assert.match(markdown, /## Deprecations/);
  assert.match(markdown, /deprecated\\_captured\\_at/);
});

test("doctor exercises the real review path", () => {
  const doctor = doctorTruthTools();
  assert.equal(doctor.ok, true);
  assert.equal(doctor.checks.every((check) => check.ok), true);
});

test("keeps the committed example report in sync with the renderer", () => {
  const input = JSON.parse(readFileSync(new URL("../examples/product-launch.json", import.meta.url), "utf8"));
  const expected = readFileSync(new URL("../examples/product-launch-report.md", import.meta.url), "utf8");

  assert.equal(renderReviewMarkdown(reviewTruth(input)), expected);
});
