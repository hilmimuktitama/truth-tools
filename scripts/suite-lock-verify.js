import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reviewTruth } from "../src/review.js";

export const COMPONENTS = ["capture-truth", "timeline-truth", "program-truth"];
export const CONTRACT_FLOORS = Object.freeze({
  "capture-truth": "0.5.1",
  "timeline-truth": "0.4.0",
  "program-truth": "0.3.1"
});
export const RELEASE_TARGET_VERSIONS = Object.freeze({
  "capture-truth": "0.5.1",
  "timeline-truth": "0.4.0",
  "program-truth": "0.3.1"
});
const RELEASE_TARGET_KEYS = Object.freeze(Object.keys(RELEASE_TARGET_VERSIONS));
const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function readSuiteLock(path = new URL("../suite-lock.json", import.meta.url)) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function verifySuiteLock({ lock = readSuiteLock(), componentRoot, verifyCheckouts = false, verifyContracts = false, requireCommitted = false, targetVersions } = {}) {
  const failures = [];
  const components = lock && typeof lock === "object" ? lock.components : undefined;
  if (targetVersions && JSON.stringify(Object.keys(targetVersions).sort()) !== JSON.stringify(RELEASE_TARGET_KEYS.slice().sort())) failures.push("target versions must specify every Truth Suite component");
  if (!lock || lock.$schema !== "https://truth-tools.dev/schemas/suite-lock.schema.json") failures.push("malformed schema identifier");
  if (lock?.schema_version !== "1.0.0") failures.push("malformed schema_version");
  if (lock?.suite !== "truth-suite") failures.push("malformed suite name");
  if (!components || typeof components !== "object" || Array.isArray(components)) failures.push("missing components");
  if (components && typeof components === "object" && !Array.isArray(components)) {
    for (const name of COMPONENTS) if (!Object.hasOwn(components, name)) failures.push(`${name}: missing lock entry`);
    for (const name of Object.keys(components)) if (!COMPONENTS.includes(name)) failures.push(`${name}: unexpected lock entry`);
  }
  for (const name of COMPONENTS) {
    const entry = components?.[name];
    if (!entry || typeof entry !== "object") { failures.push(`${name}: missing lock entry`); continue; }
    if (!REPOSITORY.test(entry.repository ?? "")) failures.push(`${name}: malformed repository`);
    if (!SHA.test(entry.ref ?? "")) failures.push(`${name}: ref must be an exact 40-character SHA`);
    if (!VERSION.test(entry.version ?? "")) failures.push(`${name}: malformed version`);
    if (VERSION.test(entry.version ?? "") && targetVersions && !atLeast(entry.version, CONTRACT_FLOORS[name])) failures.push(`${name}: lock version ${entry.version} is below contract floor ${CONTRACT_FLOORS[name]}`);
    if (targetVersions?.[name] && entry.version !== targetVersions[name]) failures.push(`${name}: lock version ${entry.version} does not match target ${targetVersions[name]}`);
    if (requireCommitted && entry.provisional === true) failures.push(`${name}: provisional ref is not releaseable`);
    const expectedRepository = name === "program-truth" ? "hilmimuktitama/program-truth" : `hilmimuktitama/${name}`;
    if (entry.repository !== expectedRepository) failures.push(`${name}: repository identity must be ${expectedRepository}`);
    if (verifyCheckouts) verifyCheckout(name, entry, componentRoot, failures);
  }
  if (verifyContracts) failures.push(...verifySiblingContracts({ componentRoot, targetVersions }).failures);
  return { ok: failures.length === 0, failures, lock };
}

function verifyCheckout(name, entry, componentRoot, failures) {
  if (!componentRoot) { failures.push(`${name}: component root is required when verifying checkouts`); return; }
  const directory = resolve(componentRoot, name);
  let actualRef;
  try { actualRef = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch (error) { failures.push(`${name}: checkout missing or unreadable (${error.message})`); return; }
  if (actualRef !== entry.ref) failures.push(`${name}: checkout ref ${actualRef} does not match lock ${entry.ref}`);
  try {
    const packageJson = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    if (entry.provisional === true) {
      if (!atLeast(packageJson.version, CONTRACT_FLOORS[name])) failures.push(`${name}: package version ${packageJson.version} is below staged contract floor ${CONTRACT_FLOORS[name]}`);
    } else if (packageJson.version !== entry.version) failures.push(`${name}: package version ${packageJson.version} does not match lock ${entry.version}`);
  } catch (error) { failures.push(`${name}: package contract unavailable (${error.message})`); }
  const contractFile = name === "program-truth" ? join(directory, "examples", "status-artifact.json") : join(directory, "package.json");
  try { readFileSync(contractFile); } catch { failures.push(`${name}: expected public contract file is missing`); }
}

// This is intentionally a local, dependency-free gate. It checks the public
// contract generated by each checkout rather than trusting package metadata.
// targetVersions is opt-in because the next component release SHAs do not
// exist until the coordinated release has been completed.
export function verifySiblingContracts({ componentRoot, targetVersions } = {}) {
  const failures = [];
  if (!componentRoot) return { ok: false, failures: ["component root is required when verifying sibling contracts"] };
  const root = resolve(componentRoot);
  const packageJson = (name) => readJson(join(root, name, "package.json"), `${name}: package contract unavailable`, failures);
  const versionFor = (name) => packageJson(name)?.version;

  for (const name of COMPONENTS) {
    const version = versionFor(name);
    if (!version || !atLeast(version, CONTRACT_FLOORS[name])) {
      failures.push(`${name}: package version ${version ?? "missing"} is below contract floor ${CONTRACT_FLOORS[name]}`);
    }
    if (targetVersions?.[name] && version !== targetVersions[name]) {
      failures.push(`${name}: package version ${version ?? "missing"} does not match target ${targetVersions[name]}`);
    }
  }

  checkCaptureContract(root, failures);
  checkTimelineContract(root, failures);
  checkProgramContract(root, failures);
  return { ok: failures.length === 0, failures };
}

function checkCaptureContract(root, failures) {
  const dir = join(root, "capture-truth");
  const source = readJson(join(dir, "schemas", "source.schema.json"), "capture-truth: source schema unavailable", failures);
  const sourceRef = readJson(join(dir, "schemas", "source-ref.schema.json"), "capture-truth: source-ref schema unavailable", failures);
  const candidate = readJson(join(dir, "schemas", "candidate-claim.schema.json"), "capture-truth: candidate-claim schema unavailable", failures);
  requireSchema(source, "capture-truth source", failures, ["id", "type", "observed_at"]);
  requireSchema(sourceRef, "capture-truth source-ref", failures, ["source_id", "locator"]);
  requireSchema(candidate, "capture-truth candidate-claim", failures, ["id", "text", "classification_method", "review_status", "source_refs", "derivation_version", "source_material"]);
  requireExactSchemaId(source, "https://truth-tools.dev/schemas/source.schema.json", "capture-truth source", failures);
  requireExactSchemaId(sourceRef, "https://truth-tools.dev/schemas/source-ref.schema.json", "capture-truth source-ref", failures);
  requireExactSchemaId(candidate, "https://truth-tools.dev/schemas/candidate-claim.schema.json", "capture-truth candidate-claim", failures);
  requireExactSchemaParity(source, ["id", "kind", "type", "adapter", "key", "url", "path", "observed_at", "source_updated_at", "owner", "revision", "content_hash", "locator", "access_caveats", "fields", "metadata", "raw_included"], "capture-truth source", failures);
  requireExactSchemaParity(sourceRef, ["source_id", "locator", "note", "path", "url", "observed_at", "source_updated_at", "revision", "content_hash", "heading", "tableRow", "line"], "capture-truth source-ref", failures);
  requireExactSchemaParity(candidate, ["id", "text", "suggested_kind", "classification_method", "review_status", "reviewed_by", "reviewed_at", "source_refs", "extracted_at", "derivation_version", "source_material"], "capture-truth candidate-claim", failures);
  if (sourceRef?.properties?.text || sourceRef?.properties?.source_excerpt) failures.push("capture-truth source-ref: raw text fields are forbidden");
  if (candidate?.properties?.classification_method?.const !== "keyword") failures.push("capture-truth candidate-claim: classification_method must be keyword");
  if (JSON.stringify(candidate?.properties?.review_status?.enum) !== JSON.stringify(["unreviewed", "approved_for_portable", "rejected"])) failures.push("capture-truth candidate-claim: review_status enum drift");
  const derivationVersion = candidate?.properties?.derivation_version?.const;
  if (!atLeast(derivationVersion, CONTRACT_FLOORS["capture-truth"]) || !String(derivationVersion).startsWith("0.5.")) failures.push("capture-truth candidate-claim: derivation_version must be the current 0.5 contract");
  verifyRuntimeExports(join(dir, "src", "index.js"), ["createEvidencePack", "reviewCandidateClaim", "buildProfileExport", "EXPORT_PROFILES", "PORTABLE_PROFILES", "validateEvidencePack", "validateProfileExport", "CONTRACT_VERSION"], "capture-truth", failures);
  if (derivationVersion !== CONTRACT_FLOORS["capture-truth"]) failures.push("capture-truth: derivation_version must equal the contract floor");
}

function checkTimelineContract(root, failures) {
  const dir = join(root, "timeline-truth");
  const schema = readJson(join(dir, "schemas", "timeline-item.schema.json"), "timeline-truth: timeline-item schema unavailable", failures);
  const sourceRef = readJson(join(dir, "schemas", "source-ref.schema.json"), "timeline-truth: source-ref schema unavailable", failures);
  requireSchema(schema, "timeline-truth timeline-item", failures, ["id", "title", "type", "status", "dependencies", "date_derivation", "evidence_grade", "evidence_reason", "exact_date_needed", "missing_title", "dangerous_fields", "source_refs"]);
  requireSchema(sourceRef, "timeline-truth source-ref", failures, ["source_id", "locator"]);
  requireExactSchemaId(schema, "https://truth-tools.dev/schemas/timeline-item.schema.json", "timeline-truth timeline-item", failures);
  requireExactSchemaId(sourceRef, "https://truth-tools.dev/schemas/source-ref.schema.json", "timeline-truth source-ref", failures);
  requireExactSchemaParity(schema, ["id", "title", "type", "start", "end", "duration", "time_window", "date_text", "exact_date_needed", "owner", "status", "dependencies", "date_derivation", "evidence_grade", "evidence_reason", "missing_title", "dangerous_fields", "source_refs"], "timeline-truth timeline-item", failures);
  requireExactSchemaParity(sourceRef, ["source_id", "locator", "note", "path", "url", "observed_at", "source_updated_at", "revision", "content_hash", "heading", "tableRow", "line"], "timeline-truth source-ref", failures);
  if (sourceRef?.properties?.text || sourceRef?.properties?.source_excerpt) failures.push("timeline-truth source-ref: raw text fields are forbidden");
  if (sourceRef?.required?.join(",") !== "source_id,locator") failures.push("timeline-truth source-ref: required keys drift");
  if (schema?.properties?.source_refs?.items?.$ref !== "https://truth-tools.dev/schemas/source-ref.schema.json") failures.push("timeline-truth timeline-item: source_refs must use the canonical SourceRef");
  verifyRuntimeExports(join(dir, "src", "timeline.js"), ["SCHEMA_VERSION", "createTimeline"], "timeline-truth", failures);
  verifyRuntimeExports(join(dir, "src", "diff.js"), ["diffTimelines"], "timeline-truth", failures);
}

function checkProgramContract(root, failures) {
  const dir = join(root, "program-truth");
  const schema = readJson(join(dir, "schemas", "status-artifact.schema.json"), "program-truth: status-artifact schema unavailable", failures);
  const artifact = readJson(join(dir, "examples", "status-artifact.json"), "program-truth: v2 artifact unavailable", failures);
  requireSchema(schema, "program-truth status-artifact", failures, ["kind", "schema_version", "as_of", "initiative", "policy", "sources", "claims", "health_assessment"]);
  requireExactSchemaId(schema, "https://truth-tools.dev/schemas/status-artifact.schema.json", "program-truth status-artifact", failures);
  requireExactSchemaParity(schema, ["kind", "schema_version", "as_of", "initiative", "policy", "sources", "claims", "health_assessment", "timeline", "baseline_timeline"], "program-truth status-artifact", failures);
  if (schema?.properties?.schema_version?.const !== "2.0.0") failures.push("program-truth: status-artifact schema must be v2.0.0");
  if (artifact?.kind !== "status_artifact" || artifact?.schema_version !== "2.0.0") failures.push("program-truth: example is not a v2 status artifact");
  const health = artifact?.health_assessment;
  if (!health || !["on_track", "at_risk", "blocked", "unknown"].includes(health.state) || !health.owner || !health.rationale || !Array.isArray(health.source_refs) || health.source_refs.length === 0) {
    failures.push("program-truth: v2 artifact must carry a source-backed health assessment");
  }
  const healthSchema = readJson(join(dir, "schemas", "health-assessment.schema.json"), "program-truth: health-assessment schema unavailable", failures);
  requireSchema(healthSchema, "program-truth health-assessment", failures, ["state", "owner", "rationale", "source_refs"]);
  requireExactSchemaParity(healthSchema, ["state", "owner", "rationale", "source_refs"], "program-truth health-assessment", failures);
  if (healthSchema?.properties?.state?.enum?.join(",") !== "on_track,at_risk,blocked,unknown") failures.push("program-truth: health state enum drift");
  if (artifact) {
    try {
      const review = reviewTruth(artifact);
      if (review.artifact_quality !== "pass" || review.program_health !== "blocked" || review.health_consistency !== "consistent") {
        failures.push(`program-truth: Truth Tools expected pass/blocked/consistent, got ${review.artifact_quality}/${review.program_health}/${review.health_consistency}`);
      }
    } catch (error) { failures.push(`program-truth: Truth Tools review unavailable (${error.message})`); }
  }
}

function requireSchema(schema, label, failures, required) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type !== "object" || schema.additionalProperties !== false) failures.push(`${label}: schema must be a closed object`);
  for (const key of required) if (!schema.required?.includes(key)) failures.push(`${label}: required key ${key} missing`);
}

function requireExactSchemaId(schema, expected, label, failures) {
  if (schema && schema.$id !== expected) failures.push(`${label}: schema id must be ${expected}`);
}

function requireExactSchemaParity(schema, required, label, failures) {
  if (!schema || typeof schema !== "object") return;
  if (schema.additionalProperties !== false) failures.push(`${label}: schema must reject unknown properties`);
  const actual = Object.keys(schema.properties ?? {}).sort();
  const expected = required.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) failures.push(`${label}: public property set drift`);
}

function verifyRuntimeExports(file, names, label, failures) {
  const moduleUrl = pathToFileURL(file).href;
  const script = `import * as module from ${JSON.stringify(moduleUrl)}; const expected = ${JSON.stringify(names)}; for (const name of expected) if (!(name in module)) throw new Error('missing export ' + name);`;
  try {
    execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    failures.push(`${label}: runtime public contract unavailable (${error.stderr?.trim() || error.message})`);
  }
}

function readJson(path, message, failures) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { failures.push(`${message} (${error.message})`); return undefined; }
}

function readText(path, message, failures) {
  try { return readFileSync(path, "utf8"); }
  catch (error) { failures.push(`${message} (${error.message})`); return ""; }
}

function atLeast(actual, minimum) {
  const left = String(actual).split(".").map(Number);
  const right = String(minimum).split(".").map(Number);
  return left.length === 3 && right.length === 3 && left.every(Number.isFinite) &&
    (left[0] > right[0] || (left[0] === right[0] && (left[1] > right[1] || (left[1] === right[1] && left[2] >= right[2]))));
}

export function githubOutputs(lock = readSuiteLock()) {
  return COMPONENTS.map((name) => `${name.replaceAll("-", "_")}_ref=${lock.components[name].ref}`).join("\n");
}

const VALUE_FLAGS = new Set(["--lock", "--component-root"]);
const BOOLEAN_FLAGS = new Set(["--github-output", "--verify-checkouts", "--verify-contracts", "--release"]);

export function parseArgs(args) {
  const options = { flags: new Set() };
  const errors = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const equals = argument.indexOf("=");
    const name = equals === -1 ? argument : argument.slice(0, equals);
    const inlineValue = equals === -1 ? undefined : argument.slice(equals + 1);
    if (BOOLEAN_FLAGS.has(name)) {
      if (inlineValue !== undefined) errors.push(`${name} does not accept a value`);
      else if (options.flags.has(name)) errors.push(`duplicate argument ${name}`);
      else options.flags.add(name);
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      if (options[name.slice(2)]) errors.push(`duplicate argument ${name}`);
      const value = inlineValue ?? args[++index];
      if (!value || value.startsWith("--")) errors.push(`missing value for ${name}`);
      else options[name.slice(2)] = value;
      continue;
    }
    errors.push(`unknown argument ${argument}`);
  }
  return { options, errors };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const { options, errors } = parseArgs(process.argv.slice(2));
    if (errors.length > 0) throw new Error(errors.join("; "));
    const lock = readSuiteLock(options.lock ? resolve(options.lock) : undefined);
    const result = verifySuiteLock({
      lock,
      componentRoot: options["component-root"],
      verifyCheckouts: options.flags.has("--verify-checkouts"),
      verifyContracts: options.flags.has("--verify-contracts"),
      requireCommitted: options.flags.has("--release"),
      targetVersions: options.flags.has("--release") ? RELEASE_TARGET_VERSIONS : undefined
    });
    if (options.flags.has("--github-output")) {
      if (!result.ok) process.stderr.write(`Suite lock verification: FAIL\n${result.failures.map((failure) => `  FAIL  ${failure}`).join("\n")}\n`);
      else process.stdout.write(`${githubOutputs(lock)}\n`);
    } else {
      process.stderr.write(`Suite lock verification: ${result.ok ? "PASS" : "FAIL"}\n`);
      for (const failure of result.failures) process.stderr.write(`  FAIL  ${failure}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(`Suite lock verification: FAIL — ${error.message}`); process.exitCode = 1; }
}
