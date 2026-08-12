import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const COMPONENTS = ["capture-truth", "timeline-truth", "program-truth"];
const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function readSuiteLock(path = new URL("../suite-lock.json", import.meta.url)) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function verifySuiteLock({ lock = readSuiteLock(), componentRoot, verifyCheckouts = false, requireCommitted = false } = {}) {
  const failures = [];
  const components = lock && typeof lock === "object" ? lock.components : undefined;
  if (!lock || lock.$schema !== "https://truth-tools.dev/schemas/suite-lock.schema.json") failures.push("malformed schema identifier");
  if (lock?.schema_version !== "1.0.0") failures.push("malformed schema_version");
  if (lock?.suite !== "truth-suite") failures.push("malformed suite name");
  if (!components || typeof components !== "object" || Array.isArray(components)) failures.push("missing components");
  for (const name of COMPONENTS) {
    const entry = components?.[name];
    if (!entry || typeof entry !== "object") { failures.push(`${name}: missing lock entry`); continue; }
    if (!REPOSITORY.test(entry.repository ?? "")) failures.push(`${name}: malformed repository`);
    if (!SHA.test(entry.ref ?? "")) failures.push(`${name}: ref must be an exact 40-character SHA`);
    if (!VERSION.test(entry.version ?? "")) failures.push(`${name}: malformed version`);
    if (requireCommitted && entry.provisional === true) failures.push(`${name}: provisional ref is not releaseable`);
    if (entry.repository !== `hilmimuktitama/${name}`) failures.push(`${name}: repository identity must be hilmimuktitama/${name}`);
    if (verifyCheckouts) verifyCheckout(name, entry, componentRoot, failures);
  }
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
    if (packageJson.version !== entry.version) failures.push(`${name}: package version ${packageJson.version} does not match lock ${entry.version}`);
  } catch (error) { failures.push(`${name}: package contract unavailable (${error.message})`); }
  const contractFile = name === "program-truth" ? join(directory, "examples", "status-artifact.json") : join(directory, "package.json");
  try { readFileSync(contractFile); } catch { failures.push(`${name}: expected public contract file is missing`); }
}

export function githubOutputs(lock = readSuiteLock()) {
  return COMPONENTS.map((name) => `${name.replaceAll("-", "_")}_ref=${lock.components[name].ref}`).join("\n");
}

const VALUE_FLAGS = new Set(["--lock", "--component-root"]);
const BOOLEAN_FLAGS = new Set(["--github-output", "--verify-checkouts", "--release"]);

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
      requireCommitted: options.flags.has("--release")
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
