import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluateCase, runEvaluation, summarize } from "../scripts/eval.js";

const EVAL_URL = new URL("../scripts/eval.js", import.meta.url);

test("all handwritten evaluation cases pass", () => {
  const result = runEvaluation({ verbose: false, syntheticCount: 0 });

  assert.equal(result.ok, true, result.results.filter((item) => !item.ok).map((item) => `${item.id}: ${item.problems.join("; ")}`).join("\n"));
  assert.equal(result.handwritten.length >= 20, true);
  assert.equal(result.metrics.passRate, 1);
  assert.equal(result.metrics.qualityAccuracy, 1);
  assert.equal(result.metrics.healthAccuracy, 1);
});

test("synthetic cases are repeatable", () => {
  const first = runEvaluation({ verbose: false, syntheticCount: 50 });
  const second = runEvaluation({ verbose: false, syntheticCount: 50 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.results, second.results);
  assert.equal(first.synthetic.length, 50);
});

test("metrics are reported for every dimension", () => {
  const result = runEvaluation({ verbose: false, syntheticCount: 25 });
  const { metrics } = result;

  assert.equal(Number.isFinite(metrics.passRate), true);
  assert.equal(Number.isFinite(metrics.qualityAccuracy), true);
  assert.equal(Number.isFinite(metrics.healthAccuracy), true);
  assert.equal(Number.isFinite(metrics.issueRecall), true);
  assert.ok(metrics.issuePrecision === null || Number.isFinite(metrics.issuePrecision));
});

test("evaluateCase reports exact problems", () => {
  const passing = evaluateCase({
    id: "probe",
    description: "probe",
    input: {
      as_of: "2026-08-11T00:00:00.000Z",
      sources: [{ id: "s1", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }],
      claims: [
        { id: "c1", kind: "fact", text: "Fine.", source_refs: [{ source_id: "s1", locator: "https://example.com/s1" }] }
      ]
    },
    expect: { artifact_quality: "pass", program_health: "on_track" }
  });
  assert.equal(passing.ok, true);
  assert.deepEqual(passing.problems, []);
});

test("summarize computes pass rate and accuracy", () => {
  const results = [
    { ok: true, expected: { artifact_quality: "pass", program_health: "on_track", issues: [] }, actual: { artifact_quality: "pass", program_health: "on_track", issues: [] } },
    { ok: false, expected: { artifact_quality: "fail", program_health: "blocked", issues: ["x"] }, actual: { artifact_quality: "pass", program_health: "blocked", issues: [] } }
  ];
  const metrics = summarize(results);

  assert.equal(metrics.total, 2);
  assert.equal(metrics.passed, 1);
  assert.equal(metrics.passRate, 0.5);
  assert.equal(metrics.qualityAccuracy, 0.5);
  assert.equal(metrics.healthAccuracy, 1);
  assert.equal(metrics.issueRecall, 0);
  assert.equal(metrics.issuePrecision, null);
  assert.equal(metrics.falseNegative, 1);
  assert.equal(metrics.falsePositive, 0);
});

test("summarize counts false positives on clean cases with no expected issues", () => {
  const results = [
    { ok: false, expected: { artifact_quality: "pass", program_health: "on_track", issues: [] }, actual: { artifact_quality: "pass", program_health: "on_track", issues: ["surprise"] } }
  ];
  const metrics = summarize(results);

  assert.equal(metrics.falsePositive, 1);
  assert.equal(metrics.truePositive, 0);
  assert.equal(metrics.issuePrecision, 0);
});

test("evaluateCase penalizes unexpected issue types", () => {
  const staleInput = {
    as_of: "2026-08-11T00:00:00.000Z",
    sources: [{ id: "s1", type: "note", observed_at: "2026-07-01T00:00:00.000Z" }],
    claims: [
      { id: "c1", kind: "fact", text: "Fine.", source_refs: [{ source_id: "s1", locator: "https://example.com/s1" }] }
    ]
  };
  const result = evaluateCase({
    id: "noisy",
    description: "spec omits the stale_observation finding",
    input: staleInput,
    expect: { artifact_quality: "needs_review", program_health: "on_track" }
  });

  assert.equal(result.ok, false);
  assert.equal(result.unexpectedCount, 1);
  assert.match(result.problems.join("; "), /unexpected issue types: stale_observation/);
});

test("defect metrics report seeded detection recall and false positives", () => {
  const result = runEvaluation({ verbose: false, syntheticCount: 40 });

  assert.equal(result.defect.defects, 40);
  assert.equal(result.defect.detected, 40);
  assert.equal(result.defect.detectionRecall, 1);
  assert.equal(result.defect.casesWithUnexpectedFindings, 0);
  assert.equal(result.defect.unexpectedFindings, 0);
  assert.equal(result.ok, true);
});

test("eval:synthetic runs the deterministic seeded generator in CI", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.scripts["eval:synthetic"], /--synthetic=200/);
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(ci, /eval:synthetic/);
});

test("an invalid synthetic count fails the eval CLI", () => {
  for (const bad of ["--synthetic=abc", "--synthetic=-5", "--synthetic=2.5"]) {
    const run = spawnSync(process.execPath, [EVAL_URL.pathname, bad], { encoding: "utf8" });
    assert.notEqual(run.status, 0, `${bad} must exit non-zero`);
    assert.match(run.stderr, /non-negative integer/, `${bad} must explain the failure`);
  }
  const valid = spawnSync(process.execPath, [EVAL_URL.pathname, "--synthetic=0"], { encoding: "utf8" });
  assert.equal(valid.status, 0);
});

test("the cases file is valid JSON with version and cases", () => {
  const raw = JSON.parse(readFileSync(new URL("../evaluation/cases.json", import.meta.url), "utf8"));
  assert.equal(raw.version, "1.0.0");
  assert.ok(Array.isArray(raw.cases));
  assert.ok(raw.base.as_of);
});
