#!/usr/bin/env node
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import { reviewTruth } from "../../src/review.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_INPUT_DIR = join(REPO_ROOT, "evaluation/real-world/input");
const DEFAULT_LABEL_DIR = join(REPO_ROOT, "evaluation/real-world/labels");
const DEFAULT_RESULT_DIR = join(REPO_ROOT, "evaluation/private-results");
const DEFAULT_OUTPUT = join(DEFAULT_RESULT_DIR, "private-evaluation.json");

// This harness rejects rather than redacts. The allow-list is deliberately
// limited to the example/local hosts used by repository fixtures.
const CREDENTIAL_VALUE = /^(?:bearer\s+|basic\s+|sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]+\.)/i;
const PRIVATE_URL = /https?:\/\/(?!(?:example\.invalid|example\.com|example\.atlassian\.net|localhost|127\.0\.0\.1)(?=[:/?#]|$))[^\s"'<>]+/i;
const RAW_KEYS = new Set(["content", "contents", "body", "raw", "raw_body", "raw_content", "raw_data", "rawcontent", "payload", "document", "description", "description_markdown", "message", "html", "markdown", "prose", "blob", "text", "data", "all"]);

const fail = (message) => { throw new Error(`private evaluation: ${message}`); };

function readJsonFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const path = join(directory, entry.name);
      const text = readFileSync(path, "utf8");
      try {
        return { name: entry.name, path, text, value: JSON.parse(text) };
      } catch {
        fail(`invalid JSON in ${entry.name}`);
      }
    });
}

export function inspectPrivateFiles(files) {
  for (const file of files) {
    let value;
    try { value = file.value ?? JSON.parse(file.text); } catch { value = undefined; }
    if (containsCredentialMaterial(value)) fail(`credential-like material rejected in ${file.name}`);
    if (PRIVATE_URL.test(file.text)) fail(`identifying URL rejected in ${file.name}`);
    if (containsRawKey(value)) fail(`raw source body rejected in ${file.name}`);
  }
}

function normalizedKey(key) {
  return String(key).replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function containsCredentialMaterial(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsCredentialMaterial);
  return Object.entries(value).some(([key, child]) => {
    const normalized = normalizedKey(key);
    const credentialKey = /(?:^|_)(token|api_key|apikey|access_token|client_secret|secret|password|private_key|authorization|bearer|credential|credentials)(?:$|_)/.test(normalized);
    return credentialKey && (typeof child === "string" ? child.trim().length > 0 : child !== null && child !== undefined) || containsCredentialMaterial(child) || typeof child === "string" && CREDENTIAL_VALUE.test(child.trim());
  });
}

function containsRawKey(value, context = "root") {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsRawKey(entry, context === "sources" ? "source" : context));
  return Object.entries(value).some(([key, child]) => {
    const normalized = normalizedKey(key);
    const childContext = context === "source" || context === "metadata" || context === "claims" || ["sources", "fields", "metadata", "claims"].includes(normalized)
      ? (normalized === "fields" || normalized === "metadata" ? "metadata" : normalized === "sources" ? "sources" : normalized === "claims" ? "claims" : "source")
      : "root";
    const raw = RAW_KEYS.has(normalized) && !(context === "claims" && normalized === "text");
    return raw || containsRawKey(child, childContext);
  });
}

function labelsFrom(files) {
  return files.flatMap(({ value, name }) => {
    const values = Array.isArray(value) ? value : [value];
    return values.map((label) => validateLabel(label, name));
  });
}

function validateLabel(label, fileName) {
  if (!label || typeof label !== "object" || Array.isArray(label)) fail(`label in ${fileName} must be an object`);
  const required = ["id", "reviewer", "defect_types", "health", "compatibility", "tolerated", "artifact_quality"];
  for (const field of required) if (!(field in label)) fail(`label in ${fileName} is missing ${field}`);
  if (typeof label.id !== "string" || label.id.length === 0) fail(`label in ${fileName} has an invalid id`);
  if (!["reviewer_a", "reviewer_b", "adjudicator"].includes(label.reviewer)) fail(`label ${label.id} has an invalid reviewer`);
  if (!Array.isArray(label.defect_types) || label.defect_types.some((type) => typeof type !== "string" || type.length === 0)) fail(`label ${label.id} has invalid defect_types`);
  if (new Set(label.defect_types).size !== label.defect_types.length) fail(`label ${label.id} repeats a defect type`);
  if (!["on_track", "at_risk", "blocked", "unknown"].includes(label.health)) fail(`label ${label.id} has an invalid health`);
  if (!["pass", "needs_review", "fail"].includes(label.artifact_quality)) fail(`label ${label.id} has an invalid artifact_quality`);
  if (typeof label.compatibility !== "boolean" || typeof label.tolerated !== "boolean") fail(`label ${label.id} has invalid boolean fields`);
  return label;
}

function canonicalLabel(label) {
  return JSON.stringify({
    ...label,
    reviewer: undefined,
    defect_types: [...label.defect_types].sort()
  });
}

function findingTypes(review) {
  return new Set(review.findings.issues.map((finding) => finding.type));
}

function compareTypes(expectedTypes, actualTypes) {
  const expected = new Set(expectedTypes);
  const actual = new Set(actualTypes);
  const truePositive = [...expected].filter((type) => actual.has(type));
  const falsePositive = [...actual].filter((type) => !expected.has(type));
  const falseNegative = [...expected].filter((type) => !actual.has(type));
  return {
    true_positive: truePositive.length,
    false_positive: falsePositive.length,
    false_negative: falseNegative.length,
    true_positive_types: truePositive.sort(),
    false_positive_types: falsePositive.sort(),
    false_negative_types: falseNegative.sort()
  };
}

function agreement(groups, field) {
  const pairs = groups;
  const matching = pairs.filter(([a, b]) => field ? a[field] === b[field] : canonicalLabel(a) === canonicalLabel(b)).length;
  return { reviewer_cases: pairs.length, matching, rate: pairs.length ? matching / pairs.length : null };
}

export function evaluatePrivateLabels(artifacts, labels) {
  const labelsById = new Map();
  for (const label of labels) {
    const group = labelsById.get(label.id) ?? {};
    if (group[label.reviewer]) fail(`duplicate ${label.reviewer} label for ${label.id}`);
    group[label.reviewer] = label;
    labelsById.set(label.id, group);
  }

  const groups = [];
  const cases = [];
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let qualityMatches = 0;
  let healthMatches = 0;
  let compatibilityMatches = 0;
  let toleratedMatches = 0;

  for (const artifact of artifacts) {
    const group = labelsById.get(artifact.id);
    if (!group?.reviewer_a || !group.reviewer_b || !group.adjudicator) fail(`case ${artifact.id} requires reviewer_a, reviewer_b, and adjudicator labels`);
    groups.push([group.reviewer_a, group.reviewer_b]);
    const expected = group.adjudicator;
    const review = reviewTruth(artifact.value);
    const typeMetrics = compareTypes(expected.defect_types, findingTypes(review));
    truePositive += typeMetrics.true_positive;
    falsePositive += typeMetrics.false_positive;
    falseNegative += typeMetrics.false_negative;
    const qualityMatch = review.artifact_quality === expected.artifact_quality;
    const healthMatch = review.program_health === expected.health;
    const compatibilityActual = review.summary.deprecations === 0 && review.findings.issues.every((item) => item.type !== "missing_health_assessment");
    const toleratedActual = review.findings.issues.length === 0;
    const compatibilityMatch = compatibilityActual === expected.compatibility;
    const toleratedMatch = toleratedActual === expected.tolerated;
    if (qualityMatch) qualityMatches += 1;
    if (healthMatch) healthMatches += 1;
    if (compatibilityMatch) compatibilityMatches += 1;
    if (toleratedMatch) toleratedMatches += 1;
    cases.push({
      id: artifact.id,
      expected: {
        artifact_quality: expected.artifact_quality,
        program_health: expected.health,
        finding_types: [...new Set(expected.defect_types)].sort()
      },
      actual: {
        artifact_quality: review.artifact_quality,
        program_health: review.program_health,
        finding_types: [...findingTypes(review)].sort()
      },
      artifact_quality_match: qualityMatch,
      program_health_match: healthMatch,
      compatibility_expected: expected.compatibility,
      compatibility_actual: compatibilityActual,
      compatibility_match: compatibilityMatch,
      tolerated_expected: expected.tolerated,
      tolerated_actual: toleratedActual,
      tolerated_match: toleratedMatch,
      ...typeMetrics
    });
  }

  const total = cases.length;
  return {
    ok: cases.every((item) => item.artifact_quality_match && item.program_health_match && item.compatibility_match && item.tolerated_match && item.false_positive === 0 && item.false_negative === 0),
    local_only: true,
    cases: total,
    labels: labels.length,
    findings: {
      compared: true,
      issue_precision: truePositive + falsePositive > 0 ? truePositive / (truePositive + falsePositive) : null,
      issue_recall: truePositive + falseNegative > 0 ? truePositive / (truePositive + falseNegative) : null,
      true_positive: truePositive,
      false_positive: falsePositive,
      false_negative: falseNegative,
      false_positive_types: cases.flatMap((item) => item.false_positive_types),
      false_negative_types: cases.flatMap((item) => item.false_negative_types)
    },
    artifact_quality_accuracy: total ? qualityMatches / total : null,
    program_health_accuracy: total ? healthMatches / total : null,
    compatibility_accuracy: total ? compatibilityMatches / total : null,
    tolerated_accuracy: total ? toleratedMatches / total : null,
    reviewer_agreement: agreement(groups),
    artifact_quality_agreement: agreement(groups, "artifact_quality"),
    program_health_agreement: agreement(groups, "health"),
    case_results: cases,
    disclaimer: "Local-only evaluation; no private inputs were transmitted and no external evaluation was performed."
  };
}

function syntheticFixture() {
  const artifact = {
    schema_version: "2.0.0",
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "Synthetic private-evaluation example" },
    sources: [{ id: "s1", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }],
    claims: [{ id: "c1", kind: "fact", subject: "scope.phase", value: "phase-1", text: "Phase 1 is the current scope.", source_refs: [{ source_id: "s1", locator: "https://example.invalid/status" }] }]
  };
  const baseLabel = {
    id: "synthetic-example",
    defect_types: ["missing_health_assessment"],
    health: "unknown",
    compatibility: false,
    tolerated: false,
    artifact_quality: "needs_review"
  };
  return {
    artifacts: [{ id: baseLabel.id, value: artifact }],
    labels: ["reviewer_a", "reviewer_b", "adjudicator"].map((reviewer) => ({ ...baseLabel, reviewer }))
  };
}

export function runPrivateEvaluation({ inputDir = DEFAULT_INPUT_DIR, labelDir = DEFAULT_LABEL_DIR, mode = "private-local" } = {}) {
  const inputs = readJsonFiles(resolve(inputDir));
  const labelFiles = readJsonFiles(resolve(labelDir));
  if (!inputs.length || !labelFiles.length) fail("separate input and label directories must contain JSON files");
  inspectPrivateFiles([...inputs, ...labelFiles]);
  const artifacts = inputs.map(({ name, value }) => ({ id: name.slice(0, -5), value }));
  const labels = labelsFrom(labelFiles);
  const inputIds = new Set(artifacts.map(({ id }) => id));
  for (const label of labels) if (!inputIds.has(label.id)) fail(`label ${label.id} has no matching input artifact`);
  const result = evaluatePrivateLabels(artifacts, labels);
  return { ...result, mode };
}

export function resolveOutputPath(outputPath = DEFAULT_OUTPUT) {
  const resultPath = resolve(outputPath);
  const relativePath = relative(DEFAULT_RESULT_DIR, resultPath);
  if (isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${join("", "/")}`)) {
    fail("output must remain under evaluation/private-results/");
  }
  return resultPath;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--synthetic") args.synthetic = true;
    else if (["--input-dir", "--label-dir", "--output"].includes(arg)) args[arg.slice(2).replaceAll("-", "_")] = argv[++index] ?? fail(`${arg} requires a path`);
    else fail(`unknown option ${arg}`);
  }
  return args;
}

export function syntheticEvaluation() {
  const fixture = syntheticFixture();
  inspectPrivateFiles([
    { name: "synthetic-artifact.json", value: fixture.artifacts[0].value, text: JSON.stringify(fixture.artifacts[0].value) },
    ...fixture.labels.map((label) => ({ name: "synthetic-label.json", value: label, text: JSON.stringify(label) }))
  ]);
  return evaluatePrivateLabels(fixture.artifacts, fixture.labels, "synthetic");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = args.synthetic
      ? { ...syntheticEvaluation(), mode: "synthetic" }
      : runPrivateEvaluation({ inputDir: args.input_dir, labelDir: args.label_dir });
    const outputPath = resolveOutputPath(args.output ?? DEFAULT_OUTPUT);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
