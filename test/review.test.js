import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderReviewMarkdown } from "../src/report.js";
import { doctorTruthTools, reviewTruth } from "../src/review.js";

function baseInput() {
  return {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Checkout migration", owner: "Platform TPM" },
    policy: { max_source_age_days: 14 },
    sources: [
      { id: "jira", type: "jira", captured_at: "2026-08-10T00:00:00.000Z" },
      { id: "decision", type: "decision-log", captured_at: "2026-08-09T00:00:00.000Z" }
    ],
    claims: [
      {
        id: "date",
        kind: "fact",
        subject: "launch.date",
        value: "2026-08-20",
        text: "Launch is planned for August 20.",
        source_refs: ["jira"]
      }
    ]
  };
}

test("returns ready only for cited, current, non-conflicting claims", () => {
  const review = reviewTruth(baseInput());

  assert.equal(review.readiness, "ready");
  assert.equal(review.summary.facts, 1);
  assert.equal(review.findings.issues.length, 0);
  assert.equal(review.findings.conflicts.length, 0);
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
  input.claims.push({
    id: "unsupported",
    kind: "fact",
    text: "Production is ready.",
    source_refs: ["missing-source"]
  });

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "unknown_source_ref"), true);
});

test("detects contradictions by subject and typed value", () => {
  const input = baseInput();
  input.claims.push({
    id: "date-decision",
    kind: "fact",
    subject: "launch.date",
    value: "2026-08-22",
    text: "Launch is planned for August 22.",
    source_refs: ["decision"]
  });

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.conflicts.length, 1);
  assert.equal(review.findings.conflicts[0].subject, "launch.date");
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
    source_refs: ["decision"]
  });

  const review = reviewTruth(input);
  assert.equal(review.findings.conflicts.length, 1);
});

test("reports stale and future-dated sources", () => {
  const stale = baseInput();
  stale.policy.max_source_age_days = 3;
  stale.sources[0].captured_at = "2026-08-01T00:00:00.000Z";
  const staleReview = reviewTruth(stale);
  assert.equal(staleReview.readiness, "needs_review");
  assert.equal(staleReview.findings.issues.some((item) => item.type === "stale_source" && item.age_days === 10), true);

  const future = baseInput();
  future.sources[0].captured_at = "2026-08-12T00:00:00.000Z";
  const futureReview = reviewTruth(future);
  assert.equal(futureReview.readiness, "blocked");
  assert.equal(futureReview.findings.issues.some((item) => item.type === "future_source"), true);
});

test("rejects raw source bodies", () => {
  const input = baseInput();
  input.sources[0].content = "Customer secret and internal status body.";

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.sources[0].content, undefined);
  assert.equal(review.findings.issues.filter((item) => item.type === "raw_source_content").length, 1);
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_source_field" && item.field === "content"), false);
});

test("blocks unsupported source and claim fields", () => {
  const input = baseInput();
  input.sources[0].confidence = "high";
  input.claims[0].confidence = 0.7;

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_source_field"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_claim_field"), true);
});

test("blocks object and null claim values", () => {
  const objectInput = baseInput();
  objectInput.claims[0].value = { date: "2026-08-20" };
  assert.equal(reviewTruth(objectInput).findings.issues.some((item) => item.type === "unsupported_claim_value"), true);

  const nullInput = baseInput();
  nullInput.claims[0].value = null;
  assert.equal(reviewTruth(nullInput).findings.issues.some((item) => item.type === "unsupported_claim_value"), true);
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

test("blocks empty reviews", () => {
  const review = reviewTruth({
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Empty review" },
    sources: [],
    claims: []
  });

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "no_sources"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "no_claims"), true);
});

test("flags incomplete contradiction keys for review", () => {
  const input = baseInput();
  delete input.claims[0].value;

  const review = reviewTruth(input);

  assert.equal(review.readiness, "needs_review");
  assert.equal(review.findings.issues.some((item) => item.type === "incomplete_conflict_key"), true);
});

test("requires source_refs to be an array", () => {
  const input = baseInput();
  input.claims[0].source_refs = "jira";

  const review = reviewTruth(input);
  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_source_refs"), true);
});

test("invalid source URLs need review and are omitted from normalized output", () => {
  const input = baseInput();
  input.sources[0].url = "not a URL";

  const review = reviewTruth(input);
  assert.equal(review.readiness, "needs_review");
  assert.equal(review.sources[0].url, undefined);
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_source_url"), true);
});

test("renders facts, blockers, and safe single-line Markdown", () => {
  const input = baseInput();
  input.claims[0].text = "Launch | scope\nconfirmed.";
  input.claims.push({
    id: "rollback",
    kind: "blocker",
    text: "Rollback owner is missing.",
    source_refs: ["decision"]
  });

  const markdown = renderReviewMarkdown(reviewTruth(input));

  assert.match(markdown, /^# Truth Review: Checkout migration/);
  assert.match(markdown, /## Facts/);
  assert.match(markdown, /Launch \\| scope confirmed/);
  assert.match(markdown, /Assign an owner and resolution date/);
});

test("doctor exercises the real review path", () => {
  const doctor = doctorTruthTools();
  assert.equal(doctor.ok, true);
  assert.equal(doctor.checks.every((check) => check.ok), true);
});


test("blocks duplicate source and claim identities", () => {
  const input = baseInput();
  input.sources.push({ ...input.sources[0] });
  input.claims.push({ ...input.claims[0] });

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "duplicate_source_id"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "duplicate_claim_id"), true);
});

test("blocks evidence without a capture timestamp", () => {
  const input = baseInput();
  delete input.sources[0].captured_at;

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "missing_captured_at"), true);
});

test("blocks fields outside the documented top-level and policy contracts", () => {
  const input = baseInput();
  input.debug = true;
  input.policy.max_source_age_days = "14";

  const review = reviewTruth(input);

  assert.equal(review.readiness, "blocked");
  assert.equal(review.findings.issues.some((item) => item.type === "unsupported_top_level_field"), true);
  assert.equal(review.findings.issues.some((item) => item.type === "invalid_max_source_age_days"), true);
});


test("treats fractional source age beyond the policy boundary as stale", () => {
  const input = baseInput();
  input.as_of = "2026-08-11T12:00:00.000Z";
  input.policy.max_source_age_days = 14;
  input.sources[0].captured_at = "2026-07-28T00:00:00.000Z";

  const review = reviewTruth(input);
  const stale = review.findings.issues.find((item) => item.type === "stale_source");

  assert.equal(review.readiness, "needs_review");
  assert.equal(stale.age_days, 14.5);
});

test("keeps the committed example report in sync with the renderer", () => {
  const input = JSON.parse(readFileSync(new URL("../examples/product-launch.json", import.meta.url), "utf8"));
  const expected = readFileSync(new URL("../examples/product-launch-report.md", import.meta.url), "utf8");

  assert.equal(renderReviewMarkdown(reviewTruth(input)), expected);
});
