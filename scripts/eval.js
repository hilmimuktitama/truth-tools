import { readFileSync } from "node:fs";

import { reviewTruth } from "../src/review.js";

const CASES_URL = new URL("../evaluation/cases.json", import.meta.url);
const SYNTHETIC_SEED = 0x74727574; // "truth"

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const BASE_ARTIFACT = {
  as_of: "2026-08-11T00:00:00.000Z",
  schema_version: "2.0.0",
  initiative: { name: "Synthetic case" },
  policy: { max_observation_age_days: 14, max_source_content_age_days: 14 },
  sources: [
    { id: "s1", type: "jira", observed_at: "2026-08-10T00:00:00.000Z" },
    { id: "s2", type: "note", observed_at: "2026-08-09T00:00:00.000Z" }
  ],
  health_assessment: {
    state: "on_track",
    owner: "Platform TPM",
    rationale: "The active claims are facts only.",
    source_refs: [{ source_id: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }]
  },
  claims: [
    {
      id: "c1",
      kind: "fact",
      subject: "scope.phase",
      value: "phase-1",
      text: "Phase 1 is the current scope.",
      source_refs: [{ source_id: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }]
    },
    {
      id: "c2",
      kind: "fact",
      subject: "team.ready",
      value: true,
      text: "The team is ready.",
      source_refs: [{ source_id: "s2", locator: "https://example.com/notes/status" }]
    }
  ]
};

const MUTATIONS = [
  {
    name: "blocker-claim",
    category: "valid-health",
    apply: (artifact) => {
      artifact.claims.push({
        id: "b1",
        kind: "blocker",
        text: "Rollback owner is missing.",
        owner: "Platform TPM",
        due_at: "2026-08-14",
        source_refs: [{ source_id: "s2", locator: "https://example.com/notes/status" }]
      });
    },
    expect: { artifact_quality: "pass", program_health: "blocked" }
  },
  {
    name: "risk-claim",
    category: "valid-health",
    apply: (artifact) => {
      artifact.claims.push({
        id: "r1",
        kind: "risk",
        text: "Capacity unverified.",
        owner: "Platform Engineering",
        mitigation: "Run load test at 200% peak before release.",
        source_refs: [{ source_id: "s2", locator: "https://example.com/notes/status" }]
      });
    },
    expect: { artifact_quality: "pass", program_health: "at_risk" }
  },
  {
    name: "unknown-claim",
    category: "valid-health",
    apply: (artifact) => {
      artifact.claims.push({
        id: "u1",
        kind: "unknown",
        text: "Owner TBD.",
        owner: "Platform TPM",
        source_refs: [{ source_id: "s2", locator: "https://example.com/notes/status" }]
      });
    },
    expect: { artifact_quality: "pass", program_health: "at_risk" }
  },
  {
    name: "contradiction",
    apply: (artifact) => {
      artifact.claims.push({
        id: "c3",
        kind: "fact",
        subject: "scope.phase",
        value: "phase-2",
        text: "Phase 2 is now the scope.",
        source_refs: [{ source_id: "s2", locator: "https://example.com/notes/status" }]
      });
    },
    expect: { artifact_quality: "fail", program_health: "on_track" }
  },
  {
    name: "typed-contradiction-1-vs-string-1",
    apply: (artifact) => {
      artifact.claims.push({
        id: "c3",
        kind: "fact",
        subject: "team.ready",
        value: 1,
        text: "Team readiness scored 1.",
        source_refs: [{ source_id: "s2", locator: "https://example.com/notes/status" }]
      });
    },
    expect: { artifact_quality: "fail", program_health: "on_track" }
  },
  {
    name: "stale-source",
    apply: (artifact) => {
      artifact.sources[0].observed_at = "2026-07-01T00:00:00.000Z";
    },
    expect: { artifact_quality: "needs_review", program_health: "on_track", issues: ["stale_observation"] }
  },
  {
    name: "future-source",
    apply: (artifact) => {
      artifact.sources[0].observed_at = "2026-08-12T00:00:00.000Z";
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["future_source"] }
  },
  {
    name: "raw-source-content",
    apply: (artifact) => {
      artifact.sources[0].content = "Customer secret.";
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["raw_source_content"] }
  },
  {
    name: "unknown-source-ref",
    apply: (artifact) => {
      artifact.claims[0].source_refs = [{ source_id: "ghost", locator: "https://example.atlassian.net/browse/PLAT-999" }];
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["unknown_source_ref"] }
  },
  {
    name: "missing-observed-at",
    apply: (artifact) => {
      delete artifact.sources[0].observed_at;
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["missing_observed_at"] }
  },
  {
    name: "duplicate-source-id",
    apply: (artifact) => {
      artifact.sources.push({ ...artifact.sources[0], id: "s1" });
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["duplicate_source_id"] }
  },
  {
    name: "object-claim-value",
    apply: (artifact) => {
      artifact.claims[0].value = { phase: "phase-1" };
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["unsupported_claim_value","incomplete_conflict_key"] }
  },
  {
    name: "incomplete-conflict-key",
    apply: (artifact) => {
      delete artifact.claims[0].value;
    },
    expect: { artifact_quality: "needs_review", program_health: "on_track", issues: ["incomplete_conflict_key"] }
  },
  {
    name: "deprecated-compat-forms",
    apply: (artifact) => {
      artifact.sources[0].captured_at = artifact.sources[0].observed_at;
      delete artifact.sources[0].observed_at;
      artifact.claims[0].source_refs = ["s1"];
      artifact.claims[1].source_refs = [{ sourceId: "s2" }];
    },
    expect: {
      artifact_quality: "needs_review",
      program_health: "on_track",
      issues: ["missing_source_ref_locator"],
      deprecations: ["deprecated_captured_at", "deprecated_string_source_ref", "deprecated_source_id"]
    }
  },
  {
    name: "unsupported-field",
    apply: (artifact) => {
      artifact.claims[0].confidence = 0.9;
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["unsupported_claim_field"] }
  },
  {
    name: "invalid-source-url",
    apply: (artifact) => {
      artifact.sources[0].url = "not a url";
    },
    expect: { artifact_quality: "needs_review", program_health: "on_track", issues: ["invalid_source_url"] }
  },
  {
    name: "source-updated-after-as-of",
    apply: (artifact) => {
      artifact.sources[0].source_updated_at = "2026-08-12T00:00:00.000Z";
    },
    expect: { artifact_quality: "needs_review", program_health: "on_track", issues: ["source_updated_after_as_of"] }
  },
  {
    name: "source-updated-after-observation",
    apply: (artifact) => {
      artifact.sources[0].source_updated_at = "2026-08-10T12:00:00.500Z";
    },
    expect: { artifact_quality: "needs_review", program_health: "on_track", issues: ["source_updated_after_observation"] }
  },
  {
    name: "empty-claims",
    apply: (artifact) => {
      artifact.claims = [];
    },
    expect: { artifact_quality: "fail", program_health: "unknown", issues: ["no_claims"] }
  },
  {
    name: "invalid-claim-kind",
    apply: (artifact) => {
      artifact.claims.push({
        id: "x1",
        kind: "definitely",
        text: "Bad kind.",
        source_refs: [{ source_id: "s1", locator: "https://example.atlassian.net/browse/PLAT-1" }]
      });
    },
    expect: { artifact_quality: "fail", program_health: "on_track", issues: ["unsupported_claim_kind"] }
  },
  {
    name: "invalid-due-at",
    apply: (artifact) => {
      artifact.claims[0].due_at = "not-a-date";
    },
    expect: { artifact_quality: "needs_review", program_health: "on_track", issues: ["invalid_due_at"] }
  },
  {
    name: "timeline-drift-tolerated",
    category: "valid-tolerance",
    apply: (artifact) => {
      artifact.timeline = [
        { id: "t1", title: "Launch", type: "milestone", start: "2026-08-20", end: "2026-08-20", status: "planned" }
      ];
      artifact.baseline_timeline = [
        { id: "t1", title: "Launch", type: "milestone", start: "2026-08-17", end: "2026-08-17", status: "planned" }
      ];
    },
    expect: { artifact_quality: "pass", program_health: "on_track" }
  }
];

function generateSyntheticCases(count) {
  const random = mulberry32(SYNTHETIC_SEED);
  const cases = [];
  for (let index = 0; index < count; index += 1) {
    const mutation = MUTATIONS[Math.floor(random() * MUTATIONS.length)];
    const artifact = deepClone(BASE_ARTIFACT);
    mutation.apply(artifact);
    artifact.health_assessment.state = mutation.expect.program_health;
    cases.push({
      id: `synth-${String(index + 1).padStart(3, "0")}`,
      description: `synthetic: ${mutation.name}`,
      category: mutation.category ?? "defect",
      input: artifact,
      expect: mutation.expect
    });
  }
  return cases;
}

function mergeBase(base, overrides) {
  const merged = { ...(base ?? {}), ...(overrides ?? {}) };
  // Handwritten cases intentionally replace the claims collection. Keep the
  // fixture's explicit health assessment synchronized with that replacement so
  // evaluation isolates the declared defect instead of accidentally adding a
  // health-consistency defect to every health case.
  if (overrides?.claims !== undefined && overrides.health_assessment === undefined) {
    const kinds = new Set((overrides.claims ?? [])
      .filter((claim) => claim.state !== "superseded" && claim.state !== "historical")
      .map((claim) => claim.kind));
    const state = kinds.has("blocker") ? "blocked" : kinds.has("risk") || kinds.has("unknown") ? "at_risk" : kinds.has("fact") ? "on_track" : "unknown";
    merged.health_assessment = { ...(base?.health_assessment ?? {}), state };
  }
  return merged;
}

export function evaluateCase(testCase) {
  const actual = reviewTruth(mergeBase(BASE_ARTIFACT, testCase.input));
  const expected = testCase.expect;
  const problems = [];

  if (actual.artifact_quality !== expected.artifact_quality) {
    problems.push(`artifact_quality ${expected.artifact_quality} expected, got ${actual.artifact_quality}`);
  }
  if (actual.program_health !== expected.program_health) {
    problems.push(`program_health ${expected.program_health} expected, got ${actual.program_health}`);
  }

  const actualIssueTypes = new Set(actual.findings.issues.map((item) => item.type));
  const actualDeprecationTypes = new Set(actual.findings.deprecations.map((item) => item.type));
  const expectedIssues = expected.issues ?? [];
  const expectedDeprecations = expected.deprecations ?? [];

  // expect.issues and expect.deprecations are COMPLETE specs: any finding the
  // engine produces that the case did not declare is an unexpected finding
  // (a false positive) and fails the case.
  const missingIssues = expectedIssues.filter((type) => !actualIssueTypes.has(type));
  const unexpectedIssues = [...actualIssueTypes].filter((type) => !expectedIssues.includes(type));
  const missingDeprecations = expectedDeprecations.filter((type) => !actualDeprecationTypes.has(type));
  const unexpectedDeprecations = [...actualDeprecationTypes].filter((type) => !expectedDeprecations.includes(type));

  if (missingIssues.length > 0) {
    problems.push(`missing issue types: ${missingIssues.join(", ")}`);
  }
  if (unexpectedIssues.length > 0) {
    problems.push(`unexpected issue types: ${unexpectedIssues.join(", ")}`);
  }
  if (missingDeprecations.length > 0) {
    problems.push(`missing deprecation types: ${missingDeprecations.join(", ")}`);
  }
  if (unexpectedDeprecations.length > 0) {
    problems.push(`unexpected deprecation types: ${unexpectedDeprecations.join(", ")}`);
  }

  return {
    id: testCase.id,
    description: testCase.description,
    category: testCase.category ?? "defect",
    ok: problems.length === 0,
    problems,
    unexpectedCount: unexpectedIssues.length + unexpectedDeprecations.length,
    expected,
    actual: {
      artifact_quality: actual.artifact_quality,
      program_health: actual.program_health,
      issues: [...actualIssueTypes],
      deprecations: [...actualDeprecationTypes]
    }
  };
}

export function summarize(results) {
  const total = results.length;
  const passed = results.filter((result) => result.ok).length;
  const qualityMatches = results.filter((result) => result.expected.artifact_quality === result.actual.artifact_quality).length;
  const healthMatches = results.filter((result) => result.expected.program_health === result.actual.program_health).length;

  // False positives are counted on EVERY case, including clean cases with an
  // empty expected list: any finding the spec did not declare is a false
  // positive, so a noisy engine cannot hide behind sparse expectations.
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const result of results) {
    const expected = new Set(result.expected.issues ?? []);
    const actual = new Set(result.actual.issues);
    for (const type of expected) {
      if (actual.has(type)) truePositive += 1;
      else falseNegative += 1;
    }
    for (const type of actual) {
      if (!expected.has(type)) falsePositive += 1;
    }
  }
  const precision = truePositive + falsePositive > 0 ? truePositive / (truePositive + falsePositive) : null;
  const recall = truePositive + falseNegative > 0 ? truePositive / (truePositive + falseNegative) : null;

  return {
    total,
    passed,
    passRate: total > 0 ? passed / total : 0,
    qualityAccuracy: total > 0 ? qualityMatches / total : 0,
    healthAccuracy: total > 0 ? healthMatches / total : 0,
    issuePrecision: precision,
    issueRecall: recall,
    truePositive,
    falsePositive,
    falseNegative
    ,overallConformance: total > 0 ? passed / total : 0
  };
}

export function defectMetrics(syntheticResults) {
  // Each seeded synthetic case injects exactly one documented defect (or
  // tolerance case). Detection is honest: a defect is detected only when the
  // engine's findings match the defect's complete spec. Cases whose findings
  // include anything the spec did not declare count as unexpected findings
  // (false positives). The fixed seed makes every run repeatable.
  const defectResults = syntheticResults.filter((result) => result.category === "defect");
  const defects = defectResults.length;
  const detected = defectResults.filter((result) => result.ok).length;
  const withUnexpected = defectResults.filter((result) => result.unexpectedCount > 0).length;
  const unexpectedFindings = defectResults.reduce((sum, result) => sum + result.unexpectedCount, 0);

  return {
    defects,
    detected,
    detectionRecall: defects > 0 ? detected / defects : null,
    casesWithUnexpectedFindings: withUnexpected,
    unexpectedFindings
  };
}

export function runEvaluation({ syntheticCount = 0, verbose = true, list = false } = {}) {
  const raw = JSON.parse(readFileSync(CASES_URL, "utf8"));
  const base = raw.base ?? {};
  const cases = (raw.cases ?? []).map((testCase) => ({
    ...testCase,
    input: mergeBase(base, testCase.input)
  }));
  const synthetic = generateSyntheticCases(syntheticCount);

  if (list) {
    for (const testCase of [...cases, ...synthetic]) {
      console.log(`${testCase.id}  ${testCase.description}  expect ${testCase.expect.artifact_quality}/${testCase.expect.program_health}`);
    }
  }

  const handwrittenResults = cases.map(evaluateCase);
  const syntheticResults = synthetic.map(evaluateCase);
  const allResults = [...handwrittenResults, ...syntheticResults];
  const metrics = summarize(allResults);
  const defect = defectMetrics(syntheticResults);
  const ok = handwrittenResults.every((result) => result.ok) && syntheticResults.every((result) => result.ok);

  if (verbose) {
    console.log(`Truth Tools evaluation (${raw.version ?? "1.0.0"}):`);
    console.log(`  handwritten cases: ${cases.length}, synthetic cases: ${synthetic.length}`);
    console.log(`  overall conformance: ${(metrics.overallConformance * 100).toFixed(1)}%`);
    console.log(
      `  pass rate: ${metrics.passed}/${metrics.total} (${(metrics.passRate * 100).toFixed(1)}%)`
    );
    console.log(
      `  artifact_quality accuracy: ${(metrics.qualityAccuracy * 100).toFixed(1)}%  ` +
        `program_health accuracy: ${(metrics.healthAccuracy * 100).toFixed(1)}%`
    );
    console.log(
      `  issue findings: precision ${formatRate(metrics.issuePrecision)}  recall ${formatRate(metrics.issueRecall)}  ` +
        `(TP ${metrics.truePositive}, FP ${metrics.falsePositive}, FN ${metrics.falseNegative})`
    );
    if (synthetic.length > 0) {
      console.log(
        `  seeded defect detection: ${defect.detected}/${defect.defects} defects detected ` +
          `(recall ${formatRate(defect.detectionRecall)}), ` +
          `${defect.casesWithUnexpectedFindings} cases had unexpected findings (${defect.unexpectedFindings} findings total), ` +
          "repeatable via fixed seed 0x74727574"
      );
    }
    for (const result of allResults.filter((item) => !item.ok)) {
      console.log(`  FAIL ${result.id} (${result.description}): ${result.problems.join("; ")}`);
    }
  }

  return { ok, metrics, defect, results: allResults, handwritten: handwrittenResults, synthetic: syntheticResults };
}

function formatRate(value) {
  return value === null ? "n/a" : (value * 100).toFixed(1) + "%";
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const argv = process.argv.slice(2);
  const syntheticArg = argv.find((arg) => arg.startsWith("--synthetic="));
  const syntheticCount = syntheticArg ? Number(syntheticArg.slice("--synthetic=".length)) : 0;
  if (!Number.isInteger(syntheticCount) || syntheticCount < 0) {
    const given = syntheticArg?.slice("--synthetic=".length) ?? "0";
    process.stderr.write(`truth-tools eval: --synthetic requires a non-negative integer, got '${given}'.\n`);
    process.exitCode = 1;
  } else {
    const result = runEvaluation({ syntheticCount, list: argv.includes("--list") });
    process.exitCode = result.ok ? 0 : 1;
  }
}
