import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { demoPayload, findRawBodies, loadSiblings, mapProgramArtifact, readProgramArtifact, runDemo, siblingSections, stripRawBodies } from "../scripts/demo.js";
import { readSuiteLock, verifySuiteLock } from "../scripts/suite-lock-verify.js";
import { reviewTruth } from "../src/review.js";
import { timelineDiff } from "../src/timeline-diff.js";
import { freshnessRows } from "../apps/demo/app.js";

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const OSS_ROOT = path.resolve(new URL("../../", import.meta.url).pathname);
const COMPONENT_ROOT = process.env.TRUTH_SUITE_COMPONENT_ROOT ?? OSS_ROOT;
const COMPONENTS = ["capture-truth", "timeline-truth", "program-truth"];

function withSiblingEnvironment(root, callback, { required = false } = {}) {
  const names = ["TRUTH_SUITE_COMPONENT_ROOT", "TRUTH_SUITE_REQUIRE_SIBLINGS"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.TRUTH_SUITE_COMPONENT_ROOT = root;
  if (required) process.env.TRUTH_SUITE_REQUIRE_SIBLINGS = "1";
  else delete process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
  return Promise.resolve(callback()).finally(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}

function temporaryRoot(prefix = "truth-tools-demo-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function linkCurrentSiblings(root) {
  for (const name of COMPONENTS) symlinkSync(path.join(COMPONENT_ROOT, name), path.join(root, name), "dir");
}

function fakeWorkspace({ program = readJson("../examples/launch-readiness/status-artifact-fixed.json"), version = null } = {}) {
  const root = temporaryRoot();
  const versions = Object.fromEntries(COMPONENTS.map((name) => [name, version ?? JSON.parse(readFileSync(path.join(COMPONENT_ROOT, name, "package.json"), "utf8")).version]));
  mkdirSync(path.join(root, "capture-truth", "src"), { recursive: true });
  mkdirSync(path.join(root, "timeline-truth", "src"), { recursive: true });
  mkdirSync(path.join(root, "program-truth", "examples"), { recursive: true });
  writeFileSync(path.join(root, "capture-truth", "package.json"), JSON.stringify({ version: versions["capture-truth"] }));
  writeFileSync(path.join(root, "timeline-truth", "package.json"), JSON.stringify({ version: versions["timeline-truth"] }));
  writeFileSync(path.join(root, "program-truth", "package.json"), JSON.stringify({ version: versions["program-truth"] }));
  writeFileSync(path.join(root, "capture-truth", "src", "capture.js"), "export const notCapture = true;\n");
  writeFileSync(path.join(root, "timeline-truth", "src", "timeline.js"), "export function createTimeline() {}\n");
  writeFileSync(path.join(root, "timeline-truth", "src", "diff.js"), "export function diffTimelines() {}\n");
  writeFileSync(path.join(root, "program-truth", "examples", "status-artifact.json"), JSON.stringify(program));
  return root;
}

test("demo verification passes for the checked-in fixtures", async () => {
  const result = await withSiblingEnvironment(temporaryRoot(), () => runDemo({ write: false, verbose: false }));
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
    sources: [{ id: "s1", type: "note", observed_at: "2026-08-10T00:00:00.000Z", source_updated_at: "2026-08-10T12:00:00.500Z" },
      { id: "s2", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }]
  };
  const rows = freshnessRows(review);
  assert.equal(rows[0].obsAgeDays, 1);
  assert.equal(rows[0].obsMax, 7);
  assert.equal(rows[0].contentAgeDays, 0.5);
  assert.equal(rows[0].contentMax, 3);
  assert.equal(rows[1].contentAgeDays, null);
  assert.equal(rows[0].snapshotGapDays, 0.5);
  assert.equal(rows[1].snapshotGapDays, null);
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

test("the facts-only demo scenario has exact safe output and unknown health", async () => {
  const factsOnly = readJson("../examples/launch-readiness/status-artifact-facts-only.json");
  const review = reviewTruth(factsOnly);
  const payload = await withSiblingEnvironment(temporaryRoot(), () => demoPayload());

  assert.equal(factsOnly.kind, "status_artifact");
  assert.equal(factsOnly.schema_version, "2.0.0");
  assert.equal(factsOnly.health_assessment, undefined);
  assert.deepEqual(factsOnly.claims.map(({ kind, subject, value }) => ({ kind, subject, value })), [
    { kind: "fact", subject: "release.ready", value: false }
  ]);
  assert.equal(review.artifact_quality, "needs_review");
  assert.equal(review.reported_program_health, null);
  assert.equal(review.claim_health_floor, "none");
  assert.equal(review.program_health, "unknown");
  assert.equal(review.health_consistency, "missing");
  assert.deepEqual(review.findings.issues.map((item) => item.type), ["missing_health_assessment"]);
  assert.deepEqual(payload.factsOnly, factsOnly);
  assert.deepEqual(payload.factsOnlyReview, review);
  assert.equal(/raw/i.test(JSON.stringify(payload.factsOnly)), false);
  assert.equal(/raw|source_ref/i.test(factsOnly.claims.map((claim) => claim.text).join(" ")), false);
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

test("demo sanitizer strips case-insensitive raw aliases in source metadata but keeps claim text", () => {
  const input = { claims: [{ text: "Keep this claim text." }], sources: [{ fields: { RAWContent: "secret", status: "ready" }, metadata: { nested: { Data: "secret" } } }] };
  const safe = stripRawBodies(input);
  assert.equal(safe.claims[0].text, "Keep this claim text.");
  assert.equal(findRawBodies(safe).length, 0);
  assert.equal(safe.sources[0].fields.status, "ready");
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
  const settings = readFileSync(new URL("../docs/github-settings.md", import.meta.url), "utf8");
  assert.equal(settings.includes("hilmmkttm/"), false, "github-settings.md contains the stale owner");
  for (const repository of ["capture-truth", "timeline-truth", "program-truth"]) {
    assert.equal(settings.includes(`hilmimuktitama/${repository}`), true, `settings documents ${repository}`);
  }
});

test("release workflow uses a published release and validates the exact tag", () => {
  const contents = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  assert.match(contents, /release:\n\s+types: \[published\]/);
  assert.match(contents, /workflow_dispatch:[\s\S]*?tag:[\s\S]*?required: true/);
  assert.match(contents, /github\.event\.release\.tag_name \|\| inputs\.tag/);
  assert.match(contents, /grep -Eq '\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\(-\[0-9A-Za-z\.\-\]\+\)\?\$'/);
  assert.match(contents, /ref: \$\{\{ steps\.release-tag\.outputs\.tag \}\}/);
  assert.match(contents, /fetch-depth: 0/);
  assert.match(contents, /git rev-parse "refs\/tags\/\$RELEASE_TAG\^\{commit\}"/);
  assert.match(contents, /test "\$head_commit" = "\$tag_commit"/);
  assert.match(contents, /test "\$\{RELEASE_TAG#v\}" = "\$version"/);
  assert.equal(contents.includes('test "$version" = "0.3.0"'), false);
  assert.equal(contents.includes("push:\n    tags:"), false);
  assert.equal(contents.includes("NODE_AUTH_TOKEN"), false);
  assert.equal(contents.includes("NPM_TOKEN"), false);
  assert.equal(contents.includes("ref: 0db8cc1"), false);
  assert.match(contents, /steps\.suite-lock\.outputs\.capture_truth_ref/);
  assert.match(contents, /steps\.suite-lock\.outputs\.timeline_truth_ref/);
  assert.match(contents, /steps\.suite-lock\.outputs\.program_truth_ref/);
  assert.match(contents, /--github-output --release/);
  assert.match(contents, /- run: npm run demo\n/);
  assert.equal(contents.includes("npm run demo:write"), false);
});

test("workflow YAML command steps have valid indentation and CI is verify-only", () => {
  for (const workflow of ["ci.yml", "release.yml"]) {
    const contents = readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    assert.equal(contents.includes("npm run demo:write"), false, `${workflow} must not write demo fixtures`);
    assert.match(contents, /^name: \S+/m);
    assert.match(contents, /^jobs:/m);
    const malformedSteps = contents.split("\n").filter((line) => /^(\s+)- (?:run|name|uses):/.test(line) && line.match(/^\s*/)[0].length !== 6);
    assert.deepEqual(malformedSteps, [], `${workflow} has malformed step indentation`);
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
  const siblings = await withSiblingEnvironment(temporaryRoot(), () => loadSiblings());
  if (siblings.mode !== "live") {
    assert.equal(siblings.sibling.capture.kind, "capture_truth_evidence_pack");
    return;
  }
  const { capture, timelineMod, diffMod } = siblings;
  const fixed = readJson("../examples/launch-readiness/evidence-pack.json");
  const baseline = readJson("../examples/launch-readiness/baseline-plan.json");
  const current = readJson("../examples/launch-readiness/current-plan.json");

  assert.equal(typeof capture.createEvidencePack, "function", "Capture Truth must export createEvidencePack");
  const captureResult = capture.createEvidencePack({
    sources: fixed.sources,
    now: () => new Date("2026-08-11T00:00:00.000Z")
  });
  assert.equal(captureResult.kind, "capture_truth_evidence_pack");
  assert.equal(captureResult.summary.source_count, fixed.sources.length);
  assert.equal(Array.isArray(captureResult.candidate_claims), true);
  assert.equal(captureResult.candidate_claims.every((claim) => claim.review_status === "unreviewed"), true);
  assert.equal(Array.isArray(captureResult.diagnostics), true);
  const candidateInput = {
    sources: [{
      id: "candidate-note",
      type: "note",
      locator: "https://example.com/candidate-note",
      observed_at: "2026-08-10T00:00:00.000Z",
      source_updated_at: "2026-08-10T00:00:00.000Z",
      content: "Launch is scheduled for August 20."
    }],
    now: () => new Date("2026-08-11T00:00:00.000Z")
  };
  const candidateResult = capture.createEvidencePack(candidateInput);
  assert.ok(candidateResult.candidate_claims.length > 0);
  assert.equal(candidateResult.candidate_claims.every((claim) => claim.review_status === "unreviewed"), true);
  assert.deepEqual(candidateResult, capture.createEvidencePack(candidateInput));
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
  assert.equal(artifact.schema_version, "2.0.0");
  assert.equal(artifact.as_of, "2026-08-11T09:00:00.000Z");
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

  const sections = JSON.parse(JSON.stringify(await withSiblingEnvironment(temporaryRoot(), () => siblingSections())));
  assert.equal(sections.capture.summary.source_count, 4);
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
     assert.equal((await siblingSections()).capture.kind, "capture_truth_evidence_pack");
    assert.equal(statSync(dataPath).mtimeMs, before);
  } finally {
    if (previousRoot === undefined) delete process.env.TRUTH_SUITE_COMPONENT_ROOT;
    else process.env.TRUTH_SUITE_COMPONENT_ROOT = previousRoot;
    if (previousRequired === undefined) delete process.env.TRUTH_SUITE_REQUIRE_SIBLINGS;
    else process.env.TRUTH_SUITE_REQUIRE_SIBLINGS = previousRequired;
  }
});

test("required mode uses the live sibling checkouts and preserves Program Truth v2", async (context) => {
  const componentRoot = COMPONENT_ROOT;
  const liveCheck = verifySuiteLock({ componentRoot, verifyCheckouts: true, verifyContracts: true });
  if (!liveCheck.ok) {
    if (process.env.TRUTH_SUITE_COMPONENT_ROOT) assert.fail(`configured sibling checkouts are not suite-lock exact: ${liveCheck.failures.join("; ")}`);
    return context.skip(`current sibling checkouts are not suite-lock exact: ${liveCheck.failures.join("; ")}`);
  }
  await withSiblingEnvironment(componentRoot, async () => {
    const siblings = await loadSiblings();
    assert.equal(siblings.mode, "live");
    assert.deepEqual(siblings.program, JSON.parse(readFileSync(path.join(componentRoot, "program-truth", "examples", "status-artifact.json"), "utf8")));
    const sections = await siblingSections();
    assert.deepEqual(sections.program.artifact, siblings.program);
    assert.equal(sections.program.review.program_health, "blocked");
  }, { required: true });
});

test("required mode rejects a Program Truth v1 example instead of substituting a fixture", async () => {
  const v1 = { kind: "status_artifact", schema_version: "1.0.0", claims: [] };
  const root = fakeWorkspace({ program: v1 });
  await withSiblingEnvironment(root, () => assert.rejects(
    () => loadSiblings(),
    /program-truth: expected examples\/status-artifact\.json to be a v2 status artifact/
  ), { required: true });
});

test("required mode reports missing Capture Truth function", async () => {
  const root = fakeWorkspace();
  writeFileSync(path.join(root, "capture-truth", "src", "capture.js"), "export const incompatible = true;\n");
  await withSiblingEnvironment(root, () => assert.rejects(
    () => loadSiblings(),
    /capture-truth: missing public function createEvidencePack/
  ), { required: true });
});

test("required mode reports package versions that do not match suite-lock", async () => {
  const root = fakeWorkspace();
  writeFileSync(path.join(root, "timeline-truth", "package.json"), JSON.stringify({ version: "9.9.9" }));
  await withSiblingEnvironment(root, () => assert.rejects(
    () => loadSiblings(),
    /timeline-truth: package version 9\.9\.9 does not match suite-lock 0\.4\.0/
  ), { required: true });
});

test("optional mode uses a fixture only when all sibling repositories are absent", async () => {
  const root = temporaryRoot();
  await withSiblingEnvironment(root, async () => {
    const siblings = await loadSiblings();
    assert.equal(siblings.mode, "fixture");
    assert.equal(siblings.reason, "using checked-in fixture projection");
  });
});

test("optional mode fails clearly for partial sibling presence", async () => {
  const root = temporaryRoot();
  symlinkSync(path.join(COMPONENT_ROOT, "capture-truth"), path.join(root, "capture-truth"), "dir");
  await withSiblingEnvironment(root, () => assert.rejects(
    () => loadSiblings(),
    /Truth Suite siblings unavailable or incompatible in optional mode[\s\S]*timeline-truth/
  ));
});

test("suite-lock verification remains independent of demo sibling loading", () => {
  const result = verifySuiteLock({ lock: readSuiteLock() });
  assert.equal(result.ok, true, result.failures.join("\n"));
});
