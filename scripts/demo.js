import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { validateStatusArtifact } from "../src/contracts.js";
import { normalizeDate, RAW_SOURCE_KEYS } from "../src/normalize.js";
import { renderReviewMarkdown } from "../src/report.js";
import { reviewTruth } from "../src/review.js";
import { renderTimelineDriftMarkdown, timelineDiff } from "../src/timeline-diff.js";
import { buildDemo, verifyDist } from "./demo-build.js";
import { readSuiteLock, verifySuiteLock } from "./suite-lock-verify.js";

// The payload version always mirrors package.json so the demo data never
// drifts from the package it ships with.
const require = createRequire(import.meta.url);
const PACKAGE_VERSION = require("../package.json").version;

// The default preserves the local OSS workspace layout. Packaged checkouts and
// CI set TRUTH_SUITE_COMPONENT_ROOT to a directory containing the components.
export function resolveComponentRoot() {
  return path.resolve(process.env.TRUTH_SUITE_COMPONENT_ROOT || path.resolve(new URL("..", import.meta.url).pathname, ".."));
}

function siblingUrls(root = resolveComponentRoot()) {
  return {
    capture: pathToFileURL(path.join(root, "capture-truth", "src", "capture.js")),
    timeline: pathToFileURL(path.join(root, "timeline-truth", "src", "timeline.js")),
    diff: pathToFileURL(path.join(root, "timeline-truth", "src", "diff.js")),
    program: path.join(root, "program-truth", "examples", "status-artifact.json")
  };
}

const EXAMPLES = new URL("../examples/launch-readiness/", import.meta.url);
const DATA_URL = new URL("../apps/demo/data.js", import.meta.url);
const DEMO_AS_OF = "2026-08-11T00:00:00.000Z";
let lastSiblingMode = "unknown";

const DATA_HEADER =
  "// Public-safe demo data: raw source bodies are stripped by scripts/demo.js\n" +
  "// and asserted absent before this file is written or deployed to Pages.\n";

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, EXAMPLES), "utf8"));
}

function jsonFile(relativePath) {
  return readFileSync(new URL(relativePath, EXAMPLES), "utf8");
}

// The browser must never receive raw source bodies, even synthetic ones.
// Fixtures that deliberately contain raw bodies for engine testing are
// stripped before embedding; the review output still reports the finding.
function normalizedKey(key) {
  return String(key).replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function isRawAlias(key) {
  return RAW_SOURCE_KEYS.has(normalizedKey(key));
}

export function stripRawBodies(value, context = "root") {
  if (Array.isArray(value)) return value.map((entry) => stripRawBodies(entry, context === "sources" ? "source" : context));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalized = normalizedKey(key);
      const childContext = context === "source" || context === "metadata" || context === "sources" || normalized === "sources"
        ? (normalized === "sources" ? "sources" : normalized === "fields" || normalized === "metadata" ? "metadata" : "source")
        : "root";
      if ((context === "source" || context === "metadata") && isRawAlias(key)) continue;
      out[key] = stripRawBodies(entry, childContext);
    }
    return out;
  }
  return value;
}

export function findRawBodies(value, path = "$", context = "root") {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => hits.push(...findRawBodies(entry, `${path}[${index}]`, context === "sources" ? "source" : context)));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const normalized = normalizedKey(key);
      const childContext = context === "source" || context === "metadata" || context === "sources" || normalized === "sources"
        ? (normalized === "sources" ? "sources" : normalized === "fields" || normalized === "metadata" ? "metadata" : "source")
        : "root";
      if ((context === "source" || context === "metadata") && isRawAlias(key)) hits.push(`${path}.${key}`);
      else hits.push(...findRawBodies(entry, `${path}.${key}`, childContext));
    }
  }
  return hits;
}

function readJsonFile(url) {
  try {
    return JSON.parse(readFileSync(url, "utf8"));
  } catch {
    return null;
  }
}

function siblingPresence(root) {
  return Object.fromEntries(["capture-truth", "timeline-truth", "program-truth"]
    .map((name) => [name, existsSync(path.join(root, name))]));
}

function fixtureSibling() {
  return import("../apps/demo/data.js").then(({ TRUTH_DEMO }) => {
    if (!TRUTH_DEMO.sibling) throw new Error("checked-in sibling fixture projection is missing");
    return { mode: "fixture", sibling: structuredClone(TRUTH_DEMO.sibling), reason: "using checked-in fixture projection" };
  });
}

function packageVersionFailures(root, lock) {
  const failures = [];
  for (const name of ["capture-truth", "timeline-truth", "program-truth"]) {
    try {
      const packageJson = JSON.parse(readFileSync(path.join(root, name, "package.json"), "utf8"));
      const expected = lock.components[name].version;
      if (packageJson.version !== expected) {
        failures.push(`${name}: package version ${packageJson.version ?? "missing"} does not match suite-lock ${expected}`);
      }
    } catch (error) {
      failures.push(`${name}: package contract unavailable (${error.message})`);
    }
  }
  return failures;
}

export function requireSiblings() {
  return process.env.TRUTH_SUITE_REQUIRE_SIBLINGS === "1";
}

export function readProgramArtifact() {
  return mapProgramArtifact(readJsonFile(siblingUrls().program));
}

function canonicalizeProgramArtifact(program) {
  if (!program || typeof program !== "object" || Array.isArray(program)) return program;
  if (program.kind !== "status_artifact" || program.schema_version !== "1.0.0") return structuredClone(program);

  const artifact = structuredClone(program);
  const activeClaims = (artifact.claims ?? []).filter((claim) => claim.state !== "superseded" && claim.state !== "historical");
  const state = activeClaims.some((claim) => claim.kind === "blocker")
    ? "blocked"
    : activeClaims.some((claim) => claim.kind === "risk" || claim.kind === "unknown")
      ? "at_risk"
      : "on_track";
  const source = (artifact.sources ?? []).find((item) => item.id && (item.locator || item.url || item.path));
  const locator = source?.locator ?? source?.url ?? source?.path ?? `source:${source?.id ?? "program"}`;
  artifact.schema_version = "2.0.0";
  artifact.health_assessment = {
    state,
    owner: artifact.initiative?.owner ?? "Program Operator",
    rationale: "Canonical v2 projection of the checked-in Program Truth status artifact.",
    source_refs: [{ source_id: source?.id ?? "program", locator }]
  };
  return artifact;
}

// Load real sibling components, or the checked-in public-safe projection when
// this package is used without the sibling repositories.
export async function loadSiblings() {
  const root = resolveComponentRoot();
  const presence = siblingPresence(root);

  // Fixtures are an offline convenience only when no sibling checkout exists.
  // Once a checkout is present, silently replacing it would hide a broken or
  // partially provisioned Truth Suite.
  if (!requireSiblings() && Object.values(presence).every((present) => !present)) return fixtureSibling();

  const failures = [];
  let lock;
  try {
    lock = readSuiteLock();
    const lockResult = verifySuiteLock({
      lock,
      componentRoot: root,
      verifyCheckouts: true,
      verifyContracts: true
    });
    failures.push(...lockResult.failures);
    failures.push(...packageVersionFailures(root, lock));
  } catch (error) {
    failures.push(`suite-lock verification unavailable (${error.message})`);
  }

  const urls = siblingUrls(root);
  let capture;
  let timelineMod;
  let diffMod;
  try { capture = await import(urls.capture.href); }
  catch (error) { failures.push(`capture-truth: public module unavailable (${error.message})`); }
  try { timelineMod = await import(urls.timeline.href); }
  catch (error) { failures.push(`timeline-truth: public module unavailable (${error.message})`); }
  try { diffMod = await import(urls.diff.href); }
  catch (error) { failures.push(`timeline-truth diff module unavailable (${error.message})`); }

  if (typeof capture?.createEvidencePack !== "function") failures.push("capture-truth: missing public function createEvidencePack");
  if (typeof timelineMod?.createTimeline !== "function") failures.push("timeline-truth: missing public function createTimeline");
  if (typeof diffMod?.diffTimelines !== "function") failures.push("timeline-truth: missing public function diffTimelines");

  let program;
  try {
    const raw = readFileSync(urls.program, "utf8");
    program = JSON.parse(raw);
  } catch (error) {
    failures.push(`program-truth: malformed or unavailable v2 example (${error.message})`);
  }
  if (program && (program.kind !== "status_artifact" || program.schema_version !== "2.0.0")) {
    failures.push(`program-truth: expected examples/status-artifact.json to be a v2 status artifact, got ${program.schema_version ?? "unknown"}`);
  }

  if (failures.length > 0) {
    const mode = requireSiblings() ? "required" : "optional";
    throw new Error(`Truth Suite siblings unavailable or incompatible in ${mode} mode under ${root}:\n  ${failures.join("\n  ")}`);
  }
  return { mode: "live", capture, timelineMod, diffMod, program };
}

function candidateClaims(result) {
  if (!Array.isArray(result?.candidate_claims) ||
      result.candidate_claims.some((claim) => claim.review_status !== "unreviewed")) {
    throw new Error("incompatible Capture Truth evidence pack: candidate claims must be unreviewed");
  }
  return result.candidate_claims.map((claim) => {
    const safe = { ...claim };
    // Candidate text is extraction output, not portable browser evidence.
    delete safe.text;
    delete safe.raw_body;
    delete safe.mixed;
    if (safe.source_material !== "metadata" && safe.source_material !== "structured_fields") {
      safe.source_material = "metadata";
    }
    return safe;
  });
}

function normalizeSiblingProjection(sibling) {
  // Fixture projections are imported from the checked-in browser payload.
  // Normalize a detached copy so optional sibling mode can never mutate the
  // module-owned projection (or any nested capture/timeline data).
  const projection = structuredClone(sibling);
  const programArtifact = canonicalizeProgramArtifact(projection.program?.artifact);
  const programReview = programArtifact ? reviewTruth(programArtifact) : null;
  return {
    ...projection,
    capture: {
      ...projection.capture,
      candidate_claims: candidateClaims(projection.capture),
      diagnostics: projection.capture.diagnostics ?? {}
    },
    ...(programArtifact ? {
      program: {
        artifact: programArtifact,
        review: programReview,
        report: renderReviewMarkdown(programReview)
      }
    } : {})
  };
}

function programTimestamp(value, fallback = DEMO_AS_OF) {
  const text = value ? String(value) : fallback;
  if (text.includes("T")) return normalizeDate(text) ?? `${text.slice(0, 10)}T00:00:00.000Z`;
  return `${text.slice(0, 10)}T00:00:00.000Z`;
}

// Maps a Program Truth status artifact into a Truth Tools status artifact
  // (kind: "status_artifact", schema_version: "2.0.0"). Program Truth now emits
// the canonical shape directly, so it is passed through byte-for-byte with a
// structured clone (the review engine owns validation). The legacy pre-canonical
// shape (facts/blockers/risks/unknowns with per-claim source systems) is still
// mapped explicitly for historical artifacts that predate the alignment.
export function mapProgramArtifact(program) {
  if (!program || typeof program !== "object" || Array.isArray(program)) {
    throw new Error("Program Truth status artifact must be a JSON object.");
  }
  if (program.kind === "status_artifact" && ["1.0.0", "2.0.0"].includes(program.schema_version)) {
    return program.schema_version === "1.0.0" ? canonicalizeProgramArtifact(program) : structuredClone(program);
  }

  const groups = [
    ...(program.facts ?? []).map((claim) => ({ ...claim, _kind: "fact", _text: claim.statement })),
    ...(program.blockers ?? []).map((claim) => ({ ...claim, _kind: "blocker", _text: claim.what_is_blocked })),
    ...(program.risks ?? []).map((claim) => ({ ...claim, _kind: "risk", _text: claim.risk })),
    ...(program.unknowns ?? []).map((claim) => ({ ...claim, _kind: "unknown", _text: claim.statement }))
  ];
  const sourceSeen = new Set();
  const sources = [];
  for (const claim of groups) {
    const src = claim.source ?? {};
    const sourceId = src.system ? `pgm-${src.system}` : null;
    if (sourceId && !sourceSeen.has(sourceId)) {
      sourceSeen.add(sourceId);
      sources.push({
        id: sourceId,
        type: src.system,
        observed_at: programTimestamp(src.freshness),
        locator: src.artifact ?? null
      });
    }
  }
  const refFor = (src) => (src?.system ? [{ source_id: `pgm-${src.system}`, locator: src.artifact ?? null }] : []);
  const claims = groups.map((claim, index) => {
    const id = `${claim._kind}-${index + 1}`;
    const base = { id, kind: claim._kind, state: "active", text: claim._text, source_refs: refFor(claim.source) };
    if (claim._kind === "blocker") {
      base.text = `${claim.what_is_blocked}. Needed: ${claim.what_is_needed}`;
      base.owner = claim.owner;
      base.due_at = programTimestamp(claim.target_date);
    }
    if (claim._kind === "risk") {
      base.owner = claim.owner;
      base.mitigation = claim.mitigation;
    }
    if (claim._kind === "unknown") base.owner = "Program Operator";
    return base;
  });
  return {
    kind: "status_artifact",
    schema_version: "2.0.0",
    as_of: programTimestamp(program.generated_at),
    initiative: {
      name: program.initiative?.name ?? "Program Truth status",
      objective: program.initiative?.objective
    },
    policy: { max_observation_age_days: 14, max_source_content_age_days: 14 },
    sources,
    claims,
    health_assessment: {
      state: claims.some((claim) => claim.kind === "blocker") ? "blocked" : "on_track",
      owner: "Program Operator",
      rationale: "Mapped from the canonical Program Truth status artifact.",
      source_refs: sources[0]?.locator ? [{ source_id: sources[0].id, locator: sources[0].locator }] : []
    }
  };
}

// Cross-component demo sections: capture-truth normalizes the evidence-pack
// sources, timeline-truth builds and diffs the plan timelines, and Program
// Truth's canonical status artifact is mapped and reviewed by our engine.
// Every projection is deterministic and public-safe (no raw source bodies).
export async function siblingSections() {
  const siblings = await loadSiblings();
  lastSiblingMode = siblings.mode;
  if (siblings.mode === "fixture") return normalizeSiblingProjection(siblings.sibling);
  const { capture, timelineMod, diffMod, program } = siblings;
  const fixed = readJson("evidence-pack.json");
  const baseline = readJson("baseline-plan.json");
  const current = readJson("current-plan.json");

  const captureResult = capture.createEvidencePack({
    sources: fixed.sources,
    now: () => new Date(DEMO_AS_OF)
  });
  const timelineResult = timelineMod.createTimeline({
    sources: [{ id: "current-plan", type: "json", profile: "plan", content: current.timeline }]
  });
  const diffResult = diffMod.diffTimelines({ items: baseline.timeline }, { items: current.timeline });
  const artifact = mapProgramArtifact(program);
  const programReview = reviewTruth(artifact);
  if (process.env.TRUTH_DEBUG_PROJECTION === "1") {
    const expected = (await import("../apps/demo/data.js")).TRUTH_DEMO.sibling;
    const actual = {
      capture: {
        kind: captureResult.kind,
        schema_version: captureResult.schema_version,
        generated_at: captureResult.generated_at,
        sources: captureResult.sources.map((source) => ({ id: source.id, type: source.type, observed_at: source.observed_at, locator: source.locator, content_hash: source.content_hash, raw_included: source.raw_included })),
        candidate_claims: candidateClaims(captureResult),
        diagnostics: captureResult.diagnostics,
        summary: captureResult.summary
      },
      timeline: timelineResult.timeline,
      diff: diffResult,
      program: { artifact, review: programReview, report: renderReviewMarkdown(programReview) }
    };
    process.stderr.write(`debug lengths ${JSON.stringify(actual).length}/${JSON.stringify(expected).length}\n`);
  }
  return {
    capture: {
      kind: captureResult.kind,
      schema_version: captureResult.schema_version,
      generated_at: captureResult.generated_at,
      sources: captureResult.sources.map((source) => ({
        id: source.id,
        type: source.type,
        observed_at: source.observed_at,
        locator: source.locator,
        content_hash: source.content_hash,
        // Provenance metadata only: capture-truth records always carry a
        // boolean raw_included; the body itself never travels in this demo.
        raw_included: source.raw_included
      })),
       candidate_claims: candidateClaims(captureResult),
       diagnostics: captureResult.diagnostics,
       summary: captureResult.summary
    },
    timeline: timelineResult.timeline,
    diff: diffResult,
    program: { artifact, review: programReview, report: renderReviewMarkdown(programReview) }
  };
}

export async function demoPayload() {
  const broken = readJson("status-artifact-broken.json");
  const fixed = readJson("evidence-pack.json");
  const factsOnly = readJson("status-artifact-facts-only.json");
  const baseline = readJson("baseline-plan.json");
  const current = readJson("current-plan.json");

  const brokenReview = reviewTruth(broken);
  const fixedReview = reviewTruth(fixed);
  const factsOnlyReview = reviewTruth(factsOnly);
  const drift = timelineDiff(baseline.timeline, current.timeline);
  const sibling = await siblingSections();

  return {
    version: PACKAGE_VERSION,
    publicSafe: true,
    broken: stripRawBodies(broken),
    brokenReview,
    brokenReport: renderReviewMarkdown(brokenReview),
    fixed,
    fixedReview,
    fixedReport: renderReviewMarkdown(fixedReview),
    baseline,
    current,
    drift,
    driftMarkdown: renderTimelineDriftMarkdown(drift),
    ...(sibling ? { sibling } : {}),
    factsOnly: stripRawBodies(factsOnly),
    factsOnlyReview,
    factsOnlyReport: renderReviewMarkdown(factsOnlyReview)
  };
}

export async function runDemo({ write = false, verbose = true } = {}) {
  const steps = [];
  const step = (name, ok, detail = "") => steps.push({ name, ok, detail });

  const broken = readJson("status-artifact-broken.json");
  const fixedArtifact = readJson("evidence-pack.json");
  const fixedCopy = readJson("status-artifact-fixed.json");
  const factsOnly = readJson("status-artifact-facts-only.json");
  const baseline = readJson("baseline-plan.json");
  const current = readJson("current-plan.json");

  step(
    "fixture:evidence-pack-equals-fixed-copy",
    JSON.stringify(fixedArtifact) === JSON.stringify(fixedCopy),
    "status-artifact-fixed.json must mirror evidence-pack.json"
  );
  step(
    "fixture:evidence-pack-timelines-match-plans",
    JSON.stringify(fixedArtifact.timeline) === JSON.stringify(current.timeline) &&
      JSON.stringify(fixedArtifact.baseline_timeline) === JSON.stringify(baseline.timeline),
    "evidence-pack timelines must mirror current-plan.json and baseline-plan.json"
  );
  step(
    "fixture:public-safe-markers",
    baseline.public_safe === true && current.public_safe === true,
    "plan fixtures embedded into demo data must declare \"public_safe\": true"
  );
  step(
    "fixture:broken-raw-body-is-deliberate",
    findRawBodies(broken).length === 1,
    "the broken fixture must contain exactly one raw body field, for engine testing only"
  );

  const brokenReview = reviewTruth(broken);
  const fixedReview = reviewTruth(fixedArtifact);
  const factsOnlyReview = reviewTruth(factsOnly);

  step(
    "engine:broken-is-fail-and-blocked",
    brokenReview.artifact_quality === "fail" && brokenReview.program_health === "blocked",
    `got ${brokenReview.artifact_quality}/${brokenReview.program_health}`
  );
  step(
    "engine:fixed-is-pass-and-blocked-consistent",
    fixedReview.artifact_quality === "pass" && fixedReview.program_health === "blocked" && fixedReview.health_consistency === "consistent",
    `got ${fixedReview.artifact_quality}/${fixedReview.program_health}`
  );
  step(
    "engine:facts-only-is-needs-review-and-unknown",
    factsOnlyReview.artifact_quality === "needs_review" &&
      factsOnlyReview.reported_program_health === null &&
      factsOnlyReview.claim_health_floor === "none" &&
      factsOnlyReview.program_health === "unknown" &&
      factsOnlyReview.health_consistency === "missing" &&
      factsOnlyReview.findings.issues.length === 1 &&
      factsOnlyReview.findings.issues[0].type === "missing_health_assessment",
    `got ${factsOnlyReview.artifact_quality}/${factsOnlyReview.reported_program_health}/${factsOnlyReview.claim_health_floor}/${factsOnlyReview.program_health}/${factsOnlyReview.health_consistency}`
  );
  step(
    "fixture:facts-only-exact-claim",
    factsOnly.kind === "status_artifact" &&
      factsOnly.schema_version === "2.0.0" &&
      factsOnly.health_assessment === undefined &&
      factsOnly.claims.length === 1 &&
      factsOnly.claims[0].kind === "fact" &&
      factsOnly.claims[0].subject === "release.ready" &&
      factsOnly.claims[0].value === false &&
      !factsOnly.claims.some((claim) => ["blocker", "risk", "unknown"].includes(claim.kind)),
    "facts-only must contain exactly the release.ready=false fact and no health signal claims"
  );
  const factsOnlyReport = renderReviewMarkdown(factsOnlyReview);
  step(
    "fixture:facts-only-no-raw-or-source-ref-text",
    !/raw source|source_ref/i.test(factsOnlyReport) &&
      !factsOnly.claims.some((claim) => /raw source|source_ref/i.test(claim.text)),
    "facts-only report and claim text must not expose raw/source-ref text"
  );

  const brokenJson = `${JSON.stringify(brokenReview, null, 2)}\n`;
  const fixedJson = `${JSON.stringify(fixedReview, null, 2)}\n`;
  const factsOnlyJson = `${JSON.stringify(factsOnlyReview, null, 2)}\n`;
  const brokenMd = renderReviewMarkdown(brokenReview);
  const fixedMd = renderReviewMarkdown(fixedReview);
  const factsOnlyMd = factsOnlyReport;

  const drift = timelineDiff(baseline.timeline, current.timeline);
  const driftJson = `${JSON.stringify(drift, null, 2)}\n`;
  const driftMd = renderTimelineDriftMarkdown(drift);

  const payload = await demoPayload();

  const sibling = payload.sibling ?? null;
  const live = lastSiblingMode === "live";
  step("sibling:components-present", Boolean(sibling), live ? "live Truth Suite components loaded" : "using checked-in public-safe sibling fixture projection");
  if (sibling) {
    step(
      "sibling:capture-sources",
       sibling.capture.kind === "capture_truth_evidence_pack" &&
         sibling.capture.summary.source_count === fixedArtifact.sources.length &&
         sibling.capture.candidate_claims.every((claim) => claim.review_status === "unreviewed"),
       `capture-truth normalized ${sibling.capture.summary.source_count} evidence-pack sources with unreviewed candidate claims`
    );
    step(
      "sibling:capture-raw-inclusion-state",
      sibling.capture.sources.every((source) => source.raw_included === false),
      "capture projection records raw_included provenance state, never bodies"
    );
    step(
      "sibling:create-timeline",
      sibling.timeline.items.length === current.timeline.length &&
        sibling.timeline.items.every((item) => item.evidence_grade === "exact"),
      "timeline-truth rebuilt the current plan with exact evidence grades"
    );
    step(
      "sibling:diff-timelines",
      sibling.diff.summary.matched === baseline.timeline.length && sibling.diff.summary.added === 1,
      `timeline-truth matched ${sibling.diff.summary.matched}/${baseline.timeline.length} baseline items, added ${sibling.diff.summary.added}`
    );
    step(
      "sibling:program-truth-review",
      sibling.program.review.artifact_quality === "pass" && sibling.program.review.program_health === "blocked",
      `mapped Program Truth artifact reviews as ${sibling.program.review.artifact_quality}/${sibling.program.review.program_health}`
    );
  }

  if (write && live) {
    writeFileSync(new URL("truth-review-broken.json", EXAMPLES), brokenJson);
    writeFileSync(new URL("truth-review-broken.md", EXAMPLES), brokenMd);
    writeFileSync(new URL("truth-review-fixed.json", EXAMPLES), fixedJson);
    writeFileSync(new URL("truth-review-fixed.md", EXAMPLES), fixedMd);
    writeFileSync(new URL("truth-review-facts-only.json", EXAMPLES), factsOnlyJson);
    writeFileSync(new URL("truth-review-facts-only.md", EXAMPLES), factsOnlyMd);
    writeFileSync(new URL("timeline-drift.json", EXAMPLES), driftJson);
    writeFileSync(new URL("timeline-drift.md", EXAMPLES), driftMd);
    writeFileSync(DATA_URL, `${DATA_HEADER}export const TRUTH_DEMO = ${JSON.stringify(payload, null, 2)};\n`);
    buildDemo({ verbose: false });
    step("write:reports", true, "regenerated review reports and timeline drift");
    step("write:demo-data", true, "regenerated apps/demo/data.js and dist");
  } else if (write && !live) {
    writeFileSync(new URL("truth-review-broken.json", EXAMPLES), brokenJson);
    writeFileSync(new URL("truth-review-broken.md", EXAMPLES), brokenMd);
    writeFileSync(new URL("truth-review-fixed.json", EXAMPLES), fixedJson);
    writeFileSync(new URL("truth-review-fixed.md", EXAMPLES), fixedMd);
    writeFileSync(new URL("truth-review-facts-only.json", EXAMPLES), factsOnlyJson);
    writeFileSync(new URL("truth-review-facts-only.md", EXAMPLES), factsOnlyMd);
    writeFileSync(new URL("timeline-drift.json", EXAMPLES), driftJson);
    writeFileSync(new URL("timeline-drift.md", EXAMPLES), driftMd);
    writeFileSync(DATA_URL, `${DATA_HEADER}export const TRUTH_DEMO = ${JSON.stringify(payload, null, 2)};\n`);
    buildDemo({ verbose: false });
    step("write:demo-data", true, "regenerated reports, demo data, and dist from fixture projection");
  }

  step("drift:broken-json", jsonFile("truth-review-broken.json") === brokenJson);
  step("drift:broken-md", jsonFile("truth-review-broken.md") === brokenMd);
  step("drift:fixed-json", jsonFile("truth-review-fixed.json") === fixedJson);
  step("drift:fixed-md", jsonFile("truth-review-fixed.md") === fixedMd);
  step("drift:facts-only-json", jsonFile("truth-review-facts-only.json") === factsOnlyJson);
  step("drift:facts-only-md", jsonFile("truth-review-facts-only.md") === factsOnlyMd);
  step("drift:timeline-drift-json", jsonFile("timeline-drift.json") === driftJson);
  step("drift:timeline-drift-md", jsonFile("timeline-drift.md") === driftMd);

  const fixedSchema = validateStatusArtifact(fixedArtifact);
  const brokenSchema = validateStatusArtifact(broken);
  step("contract:fixed-validates", fixedSchema.valid);
  step("contract:broken-rejected", !brokenSchema.valid, "the broken fixture must violate the canonical contract");

  const demoData = await awaitDemoData();
  step("demo:data-present", Boolean(demoData), "apps/demo/data.js missing; run `node scripts/demo.js --write`");
  if (demoData) {
    step(
      "demo:data-synced",
      JSON.stringify(payload) === JSON.stringify(demoData.TRUTH_DEMO),
      "apps/demo/data.js must mirror the fixtures, reviews, drift, and sibling sections"
    );
    step(
      "demo:facts-only-synced",
      JSON.stringify(payload.factsOnly) === JSON.stringify(demoData.TRUTH_DEMO.factsOnly) &&
        JSON.stringify(payload.factsOnlyReview) === JSON.stringify(demoData.TRUTH_DEMO.factsOnlyReview) &&
        payload.factsOnlyReport === demoData.TRUTH_DEMO.factsOnlyReport,
      `facts-only artifact/review/report sync: ${JSON.stringify(payload.factsOnly) === JSON.stringify(demoData.TRUTH_DEMO.factsOnly)}/${JSON.stringify(payload.factsOnlyReview) === JSON.stringify(demoData.TRUTH_DEMO.factsOnlyReview)}/${payload.factsOnlyReport === demoData.TRUTH_DEMO.factsOnlyReport}`
    );
    const rawHits = findRawBodies(payload);
    step(
      "demo:payload-public-safe",
      payload.publicSafe === true && rawHits.length === 0,
      rawHits.length === 0
        ? "no raw source bodies reach the browser demo data"
        : `raw source bodies must not reach Pages data: ${rawHits.join(", ")}`
    );
  }

  const dist = verifyDist({ verbose: false });
  step("demo:dist-matches-sources", dist.ok, dist.mismatches.join(", ") || "all four files identical");

  const failed = steps.filter((item) => !item.ok);
  if (verbose) {
    console.log(`Truth Tools demo: ${steps.length - failed.length}/${steps.length} checks passed`);
    for (const item of steps) console.log(`  ${item.ok ? "ok" : "FAIL"}  ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
    console.log("");
   console.log("Story: broken evidence is FAIL + BLOCKED; fixed evidence is PASS + BLOCKED + CONSISTENT.");
    console.log("Quality and health are independent dimensions: evidence structure vs program state.");
    console.log("Sibling components: capture-truth normalizes sources, timeline-truth builds/diffs plans,");
    console.log("and Program Truth's canonical artifact reviews PASS + BLOCKED through the same engine.");
  }
  return { ok: failed.length === 0, steps };
}

function awaitDemoData() {
  return import("../apps/demo/data.js").catch(() => null);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const write = process.argv.includes("--write");
  runDemo({ write }).then(
    (result) => {
      process.exitCode = result.ok ? 0 : 1;
    },
    (error) => {
      process.stderr.write(`truth-tools demo: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  );
}
