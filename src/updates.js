import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";
const TRUTH_PACKAGES = ["truth-tools", "capture-truth", "timeline-truth"];

export function readPackageJson() {
  return JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
}

export function getUpdateTargets(pkg = readPackageJson()) {
  return TRUTH_PACKAGES.flatMap((name) => {
    const current = name === pkg.name ? pkg.version : versionFromRange(pkg.dependencies?.[name]);
    return current ? [{ name, current }] : [];
  });
}

export async function checkForUpdates({
  targets = getUpdateTargets(),
  fetchImpl = globalThis.fetch,
  registryUrl = DEFAULT_REGISTRY_URL,
  timeoutMs = 2500
} = {}) {
  const updates = [];
  const checked = [];
  const errors = [];

  if (typeof fetchImpl !== "function") {
    return {
      ok: true,
      checked,
      updates,
      errors: targets.map((target) => ({ name: target.name, message: "fetch unavailable" }))
    };
  }

  for (const target of targets) {
    try {
      const latest = await fetchLatestVersion(target.name, { fetchImpl, registryUrl, timeoutMs });
      checked.push({ ...target, latest });
      if (isNewerVersion(latest, target.current)) {
        updates.push({ ...target, latest });
      }
    } catch (error) {
      errors.push({
        name: target.name,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { ok: true, checked, updates, errors };
}

export function formatUpdateCheck(result) {
  if (result.updates.length > 0) {
    return `updates available: ${result.updates
      .map((update) => `${update.name} ${update.current} -> ${update.latest}`)
      .join("; ")}`;
  }

  if (result.errors.length > 0) {
    const names = result.errors.map((error) => error.name).join(", ");
    return result.checked.length > 0
      ? `all checked truth packages are current; update check unavailable for ${names}`
      : `update check unavailable for ${names}`;
  }

  return "all truth packages are current";
}

async function fetchLatestVersion(name, { fetchImpl, registryUrl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${registryUrl.replace(/\/$/, "")}/${encodePackageName(name)}/latest`, {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`registry returned ${response.status ?? "non-ok response"}`);
    }
    const body = await response.json();
    if (!body.version || typeof body.version !== "string") {
      throw new Error("registry response did not include a version");
    }
    return body.version;
  } finally {
    clearTimeout(timeout);
  }
}

function encodePackageName(name) {
  return encodeURIComponent(name).replace("%40", "@");
}

function versionFromRange(range) {
  if (!range) return null;
  return String(range).match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0] ?? null;
}

function isNewerVersion(candidate, current) {
  const next = parseVersion(candidate);
  const existing = parseVersion(current);
  if (!next || !existing) return false;

  for (let index = 0; index < 3; index += 1) {
    if (next[index] > existing[index]) return true;
    if (next[index] < existing[index]) return false;
  }
  return false;
}

function parseVersion(value) {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map((part) => Number.parseInt(part, 10)) : null;
}
