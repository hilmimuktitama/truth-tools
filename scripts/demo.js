import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { validateStatusArtifact } from "../src/contracts.js";
import { normalizeDate, RAW_SOURCE_KEYS } from "../src/normalize.js";
import { renderReviewMarkdown } from "../src/report.js";
import { reviewTruth } from "../src/review.js";
import { renderTimelineDriftMarkdown, timelineDiff } from "../src/timeline-diff.js";
import { buildDemo, verifyDist } from "./demo-build.js";

// The payload version always mirrors package.json so the demo data never
// drifts from the package it ships with.
const require = createRequire(import.meta.url);
const PACKAGE_VERSION = require("../package.json").version;

// Sibling component repos live beside truth-tools in the workspace and are
// loaded with real dynamic imports: capture-truth captureSources, timeline-truth
// createTimeline/diffTimelines, and the program-truth canonical status artifact.
// They are optional at runtime (a missing sibling is reported, never fatal).
const SIBLING_URLS = {
  capture: new URL("../../capture-truth/src/capture.js", import.meta.url),
  timeline: new URL("../../timeline-truth/src/timeline.js", import.meta.url),
  diff: new URL("../../timeline-truth/src/diff.js", import.meta.url)
};
const PROGRAM_TRUTH_EXAMPLE = new URL("../../program-truth/examples/status-artifact.json", import.meta.url);

const EXAMPLES = new URL("../examples/launch-readiness/", import.meta.url);
const DATA_URL = new URL("../apps/demo/data.js", import.meta.url);
const DEMO_AS_OF = "2026-08-11T00:00:00.000Z";

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
function stripRawBodies(value) {
  if (Array.isArray(value)) return value.map(stripRawBodies);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (RAW_SOURCE_KEYS.has(key)) continue;
      out[key] = stripRawBodies(entry);
    }
    return out;
  }
  return value;
}

function findRawBodies(value, path = "$") {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => hits.push(...findRawBodies(entry, `${path}[${index}]`)));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (RAW_SOURCE_KEYS.has(key)) hits.push(`${path}.${key}`);
      else hits.push(...findRawBodies(entry, `${path}.${key}`));
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

// Loads the sibling component repos beside truth-tools. A missing sibling is
// reported as a failed demo check, never a crash: the rest of the demo stays
// usable without them.
async function loadSiblings() {
  try {
    const [capture, timelineMod, diffMod] = await Promise.all([
      import(SIBLING_URLS.capture.href),
      import(SIBLING_URLS.timeline.href),
      import(SIBLING_URLS.diff.href)
    ]);
    return { capture, timelineMod, diffMod, program: readJsonFile(PROGRAM_TRUTH_EXAMPLE) };
  } catch {
    return null;
  }
}

function programTimestamp(value, fallback = DEMO_AS_OF) {
  const text = value ? String(value) : fallback;
  if (text.includes("T")) return normalizeDate(text) ?? `${text.slice(0, 10)}T00:00:00.000Z`;
  return `${text.slice(0, 10)}T00:00:00.000Z`;
}

// Maps a Program Truth status artifact into a Truth Tools status artifact
// (kind: "status_artifact", schema_version: "1.0.0"). Program Truth now emits
// the canonical shape directly, so it is passed through byte-for-byte with a
// structured clone (the review engine owns validation). The legacy pre-canonical
// shape (facts/blockers/risks/unknowns with per-claim source systems) is still
// mapped explicitly for historical artifacts that predate the alignment.
export function mapProgramArtifact(program) {
  if (!program || typeof program !== "object" || Array.isArray(program)) {
    throw new Error("Program Truth status artifact must be a JSON object.");
  }
  if (program.kind === "status_artifact" && program.schema_version === "1.0.0") {
    return structuredClone(program);
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
    schema_version: "1.0.0",
    as_of: programTimestamp(program.generated_at),
    initiative: {
      name: program.initiative?.name ?? "Program Truth status",
      objective: program.initiative?.objective
    },
    policy: { max_observation_age_days: 14, max_source_content_age_days: 14 },
    sources,
    claims
  };
}

// Cross-component demo sections: capture-truth normalizes the evidence-pack
// sources, timeline-truth builds and diffs the plan timelines, and Program
// Truth's canonical status artifact is mapped and reviewed by our engine.
// Every projection is deterministic and public-safe (no raw source bodies).
export async function siblingSections() {
  const siblings = await loadSiblings();
  if (!siblings) return null;
  const { capture, timelineMod, diffMod, program } = siblings;
  const fixed = readJson("evidence-pack.json");
  const baseline = readJson("baseline-plan.json");
  const current = readJson("current-plan.json");

  const captureResult = capture.captureSources({
    sources: fixed.sources,
    now: () => new Date(DEMO_AS_OF)
  });
  const timelineResult = timelineMod.createTimeline({
    sources: [{ id: "current-plan", type: "json", profile: "plan", content: current.timeline }]
  });
  const diffResult = diffMod.diffTimelines({ items: baseline.timeline }, { items: current.timeline });
  const artifact = mapProgramArtifact(program);
  const programReview = reviewTruth(artifact);

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
      claims: captureResult.claims,
      summary: captureResult.summary
    },
    timeline: timelineResult.timeline,
    diff: diffResult,
    program: { artifact, review: programReview, report: renderReviewMarkdown(programReview) }
  };
}

async function demoPayload() {
  const broken = readJson("status-artifact-broken.json");
  const fixed = readJson("evidence-pack.json");
  const baseline = readJson("baseline-plan.json");
  const current = readJson("current-plan.json");

  const brokenReview = reviewTruth(broken);
  const fixedReview = reviewTruth(fixed);
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
    ...(sibling ? { sibling } : {})
  };
}

export async function runDemo({ write = false, verbose = true } = {}) {
  const steps = [];
  const step = (name, ok, detail = "") => steps.push({ name, ok, detail });

  const broken = readJson("status-artifact-broken.json");
  const fixedArtifact = readJson("evidence-pack.json");
  const fixedCopy = readJson("status-artifact-fixed.json");
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

  step(
    "engine:broken-is-fail-and-blocked",
    brokenReview.artifact_quality === "fail" && brokenReview.program_health === "blocked",
    `got ${brokenReview.artifact_quality}/${brokenReview.program_health}`
  );
  step(
    "engine:fixed-is-pass-and-blocked",
    fixedReview.artifact_quality === "pass" && fixedReview.program_health === "blocked",
    `got ${fixedReview.artifact_quality}/${fixedReview.program_health}`
  );

  const brokenJson = `${JSON.stringify(brokenReview, null, 2)}\n`;
  const fixedJson = `${JSON.stringify(fixedReview, null, 2)}\n`;
  const brokenMd = renderReviewMarkdown(brokenReview);
  const fixedMd = renderReviewMarkdown(fixedReview);

  const drift = timelineDiff(baseline.timeline, current.timeline);
  const driftJson = `${JSON.stringify(drift, null, 2)}\n`;
  const driftMd = renderTimelineDriftMarkdown(drift);

  const payload = await demoPayload();

  const sibling = payload.sibling ?? null;
  step("sibling:components-present", Boolean(sibling), "capture-truth, timeline-truth, and program-truth must sit beside truth-tools in the workspace");
  if (sibling) {
    step(
      "sibling:capture-sources",
      sibling.capture.kind === "capture_truth_capture" &&
        sibling.capture.summary.sources === fixedArtifact.sources.length,
      `capture-truth normalized ${sibling.capture.summary.sources} evidence-pack sources`
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

  if (write) {
    writeFileSync(new URL("truth-review-broken.json", EXAMPLES), brokenJson);
    writeFileSync(new URL("truth-review-broken.md", EXAMPLES), brokenMd);
    writeFileSync(new URL("truth-review-fixed.json", EXAMPLES), fixedJson);
    writeFileSync(new URL("truth-review-fixed.md", EXAMPLES), fixedMd);
    writeFileSync(new URL("timeline-drift.json", EXAMPLES), driftJson);
    writeFileSync(new URL("timeline-drift.md", EXAMPLES), driftMd);
    writeFileSync(DATA_URL, `${DATA_HEADER}export const TRUTH_DEMO = ${JSON.stringify(payload, null, 2)};\n`);
    buildDemo({ verbose: false });
    step("write:reports", true, "regenerated review reports and timeline drift");
    step("write:demo-data", true, "regenerated apps/demo/data.js and dist");
  }

  step("drift:broken-json", jsonFile("truth-review-broken.json") === brokenJson);
  step("drift:broken-md", jsonFile("truth-review-broken.md") === brokenMd);
  step("drift:fixed-json", jsonFile("truth-review-fixed.json") === fixedJson);
  step("drift:fixed-md", jsonFile("truth-review-fixed.md") === fixedMd);
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
    console.log("Story: broken evidence is FAIL + BLOCKED; fixed evidence is PASS + BLOCKED.");
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
