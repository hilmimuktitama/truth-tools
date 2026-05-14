import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(ROOT, "..");

const captureTruth = await importTruthModule(
  "capture-truth/src/evidence-pack.js",
  "capture-truth/src/evidence-pack.js"
);
const timelineTruth = await importTruthModule(
  "timeline-truth/src/timeline.js",
  "timeline-truth/src/timeline.js"
);

export const createEvidencePack = captureTruth.createEvidencePack;
export const renderEvidencePack = captureTruth.renderEvidencePack;
export const validateEvidencePack = captureTruth.validateEvidencePack;
export const createTimeline = timelineTruth.createTimeline;
export const renderTimeline = timelineTruth.renderTimeline;
export const validateTimeline = timelineTruth.validateTimeline;

async function importTruthModule(packageSpecifier, siblingRelativePath) {
  try {
    return await import(packageSpecifier);
  } catch (packageError) {
    if (!isMissingPackage(packageError, packageSpecifier)) {
      throw packageError;
    }

    const siblingUrl = pathToFileURL(resolve(WORKSPACE_ROOT, siblingRelativePath)).href;
    try {
      return await import(siblingUrl);
    } catch (siblingError) {
      const message = [
        `Unable to load ${packageSpecifier}.`,
        `Install package dependencies or keep the sibling checkout at ../${siblingRelativePath}.`,
        `Package import failed: ${formatError(packageError)}.`,
        `Sibling import failed: ${formatError(siblingError)}.`
      ].join(" ");
      throw new Error(message, { cause: siblingError });
    }
  }
}

function isMissingPackage(error, packageSpecifier) {
  const packageName = packageSpecifier.split("/")[0];
  return (
    error instanceof Error &&
    error.code === "ERR_MODULE_NOT_FOUND" &&
    error.message.includes(`Cannot find package '${packageName}'`)
  );
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
