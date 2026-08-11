import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

import { loadSiblings, mapProgramArtifact, readProgramArtifact, runDemo, siblingSections } from "../scripts/demo.js";
import { reviewTruth } from "../src/review.js";
import { timelineDiff } from "../src/timeline-diff.js";
import { freshnessRows } from "../apps/demo/app.js";

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

test("demo verification passes for the checked-in fixtures", async () => {
  const result = await runDemo({ write: false, verbose: false });
  assert.equal(result.ok, true, result.steps.filter((step) => !step.ok).map((step) => step.name).join(", "));
});

test("the broken fixture is fail quality and blocked health", () => {
  const broken = readJson("../examples/launch-readiness/status-artifact-broken.json");
  const review = reviewTruth(broken);

  assert.equal(review.artifact_quality, "fail");
  assert.equal(review.program_health, "blocked");
  const types = review.findings.issues.map((item) => item.type);
  assert.equal(types.includes("raw_source_content"), true);
  assert.equal(types.includes("stale_observation"), true);
  assert.equal(types.includes("stale_source_content"), true);
  assert.equal(types.includes("blocker_missing_owner"), true);
  assert.equal(review.findings.conflicts.length, 1);
});

test("demo freshness separates observation and source-content ages without NaN", () => {
  const review = {
    as_of: "2026-08-11T00:00:00.000Z",
    policy: { max_observation_age_days: 7, max_source_content_age_days: 3 },
    sources: [{ id: "s1", type: "note", observed_at: "2026-08-10T00:00:00.000Z", source_updated_at: "2026-08-01T00:00:00.000Z" },
      { id: "s2", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }]
  };
  const rows = freshnessRows(review);
  assert.equal(rows[0].obsAgeDays, 1);
  assert.equal(rows[0].obsMax, 7);
  assert.equal(rows[0].contentAgeDays, 10);
  assert.equal(rows[0].contentMax, 3);
  assert.equal(rows[1].contentAgeDays, null);
  assert.equal(rows.flatMap((row) => [row.obsAgeDays, row.obsMax, row.contentAgeDays, row.contentMax]).some((value) => Number.isNaN(value)), false);
});

test("the fixed fixture is pass quality and blocked health", () => {
  const fixed = readJson("../examples/launch-readiness/evidence-pack.json");
  const review = reviewTruth(fixed);

  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.program_health, "blocked");
  assert.equal(review.findings.issues.length, 0);
  assert.equal(review.findings.conflicts.length, 0);
  assert.equal(review.summary.deprecations, 0);
});

test("the fixed review reports timeline drift from the evidence pack", () => {
  const fixed = readJson("../examples/launch-readiness/evidence-pack.json");
  const review = reviewTruth(fixed);

  assert.ok(review.timeline_drift, "timeline_drift must be present");
  assert.deepEqual(review.timeline_drift.summary, { baseline: 4, current: 5, added: 1, removed: 0, changed: 4, unchanged: 0 });
  assert.equal(Object.hasOwn(review.timeline_drift, "issues"), false);
});

test("the checked-in drift fixture matches the engine output", () => {
  const baseline = readJson("../examples/launch-readiness/baseline-plan.json");
  const current = readJson("../examples/launch-readiness/current-plan.json");
  const fixture = readJson("../examples/launch-readiness/timeline-drift.json");

  assert.deepEqual(timelineDiff(baseline.timeline, current.timeline), fixture);
});

test("the demo data file mirrors the fixtures and reviews", async () => {
  const { TRUTH_DEMO } = await import("../apps/demo/data.js");
  const broken = readJson("../examples/launch-readiness/status-artifact-broken.json");
  const fixed = readJson("../examples/launch-readiness/evidence-pack.json");

  // The embedded broken fixture is the public-safe copy: raw source bodies
  // are stripped before the browser ever sees the data.
  assert.equal(TRUTH_DEMO.broken.sources[0].content, undefined);
  assert.equal(TRUTH_DEMO.broken.sources[0].body, undefined);
  assert.equal(JSON.stringify(TRUTH_DEMO).includes("Customer secret"), false);
  assert.equal(TRUTH_DEMO.publicSafe, true);
  assert.equal(TRUTH_DEMO.broken.sources[0].id, broken.sources[0].id);
  assert.deepEqual(TRUTH_DEMO.fixed, fixed);
  assert.equal(TRUTH_DEMO.brokenReview.artifact_quality, "fail");
  assert.equal(TRUTH_DEMO.fixedReview.artifact_quality, "pass");
  assert.equal(TRUTH_DEMO.drift.summary.changed, 4);
  assert.equal(TRUTH_DEMO.version, JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
});

test("plan fixtures declare the public-safe marker", () => {
  const baseline = readJson("../examples/launch-readiness/baseline-plan.json");
  const current = readJson("../examples/launch-readiness/current-plan.json");

  assert.equal(baseline.public_safe, true);
  assert.equal(current.public_safe, true);
});

test("workflow sibling checkouts use the canonical GitHub owner", () => {
  for (const workflow of ["ci.yml", "pages.yml", "release.yml"]) {
    const contents = readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    assert.equal(contents.includes("hilmmkttm/"), false, `${workflow} contains the stale owner`);
    for (const repository of ["capture-truth", "timeline-truth", "program-truth"]) {
      assert.equal(contents.includes(`repository: hilmimuktitama/${repository}`), true, `${workflow} checks out ${repository}`);
    }
  }
});

test("dist files match the demo sources byte for byte", () => {
  for (const file of ["index.html", "styles.css", "app.js", "data.js"]) {
    const source = readFileSync(new URL(`../apps/demo/${file}`, import.meta.url));
    const dist = readFileSync(new URL(`../apps/demo/dist/${file}`, import.meta.url));
    assert.ok(source.equals(dist), `${file} must match`);
  }
});

test("sibling components wire in real cross-repo calls", async () => {
  const { capture, timelineMod, diffMod } = await loadSiblings();
  const fixed = readJson("../examples/launch-readiness/evidence-pack.json");
  const baseline = readJson("../examples/launch-readiness/baseline-plan.json");
  const current = readJson("../examples/launch-readiness/current-plan.json");

  const captureResult = capture.captureSources({
    sources: fixed.sources,
    now: () => new Date("2026-08-11T00:00:00.000Z")
  });
  assert.equal(captureResult.kind, "capture_truth_capture");
  assert.equal(captureResult.summary.sources, fixed.sources.length);
  assert.equal(captureResult.sources.every((source) => !source.raw_included), true);

  const timelineResult = timelineMod.createTimeline({
    sources: [{ id: "current-plan", type: "json", profile: "plan", content: current.timeline }]
  });
  assert.equal(timelineResult.timeline.items.length, current.timeline.length);
  assert.equal(timelineResult.timeline.items.every((item) => item.evidence_grade === "exact"), true);

  const diff = diffMod.diffTimelines({ items: baseline.timeline }, { items: current.timeline });
  assert.equal(diff.summary.matched, baseline.timeline.length);
  assert.equal(diff.summary.added, 1);
});

test("the Program Truth example passes through canonical and reviews pass + blocked", async () => {
  const program = readProgramArtifact();

  const artifact = mapProgramArtifact(program);
  assert.equal(artifact.kind, "status_artifact");
  assert.equal(artifact.schema_version, "1.0.0");
  assert.equal(artifact.as_of, "2026-08-11T09:00:00.000Z");
  assert.equal(artifact.sources.length, 5);
  assert.equal(artifact.claims.length, 8);
  assert.equal(artifact.claims.every((claim) => claim.state === "active"), true);
  // Program Truth now emits the canonical shape: the mapper passes it through
  // byte-for-byte (structured clone), it never rewrites it.
  assert.deepEqual(artifact, program);

  const review = reviewTruth(artifact);
  assert.equal(review.artifact_quality, "pass");
  assert.equal(review.program_health, "blocked");
  assert.equal(review.findings.issues.length, 0);
});

test("the embedded sibling sections mirror live sibling output", async () => {
  const { TRUTH_DEMO } = await import("../apps/demo/data.js");
  const { siblingSections } = await import("../scripts/demo.js");

  const sections = JSON.parse(JSON.stringify(await siblingSections()));
  assert.equal(sections.capture.summary.sources, 4);
  assert.equal(sections.timeline.items.length, 5);
  assert.equal(sections.diff.summary.added, 1);
  assert.equal(sections.program.review.artifact_quality, "pass");
  assert.equal(sections.program.review.program_health, "blocked");
  assert.equal(JSON.stringify(sections), JSON.stringify(TRUTH_DEMO.sibling));
});

test("required sibling mode fails when the component root is missing", async () => {
  const previousRoot = process.env.TRUTH_SUITE_COMPONENT_ROOT;
  const previousRequired = process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
  process.env.TRUTH_SUITE_COMPONENT_ROOT = "/tmp/truth-tools-no-siblings";
  process.env.TRUTH_SUITE_REQUIRE_SIBLINGS = "1";
  try {
    await assert.rejects(() => loadSiblings(), /siblings unavailable/);
  } finally {
    if (previousRoot === undefined) delete process.env.TRUTH_SUITE_COMPONENT_ROOT;
    else process.env.TRUTH_SUITE_COMPONENT_ROOT = previousRoot;
    if (previousRequired === undefined) delete process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
    else process.env.TRUTH_SUITE_REQUIRE_SIBLINGS = previousRequired;
  }
});

test("optional sibling mode uses the checked-in projection without mutating demo data", async () => {
  const previousRoot = process.env.TRUTH_SUITE_COMPONENT_ROOT;
  const previousRequired = process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
  const dataPath = new URL("../apps/demo/data.js", import.meta.url);
  const before = statSync(dataPath).mtimeMs;
  process.env.TRUTH_SUITE_COMPONENT_ROOT = "/tmp/truth-tools-no-siblings";
  delete process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
  try {
    const result = await runDemo({ write: false, verbose: false });
    assert.equal(result.ok, true);
    assert.equal((await siblingSections()).capture.kind, "capture_truth_capture");
    assert.equal(statSync(dataPath).mtimeMs, before);
  } finally {
    if (previousRoot === undefined) delete process.env.TRUTH_SUITE_COMPONENT_ROOT;
    else process.env.TRUTH_SUITE_COMPONENT_ROOT = previousRoot;
    if (previousRequired === undefined) delete process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
    else process.env.TRUTH_SUITE_REQUIRE_SIBLINGS = previousRequired;
  }
});
