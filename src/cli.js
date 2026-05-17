import { readFileSync } from "node:fs";

import { callTruthTool } from "./mcp-tools.js";
import { writeTruthRunOutputs } from "./truth-run.js";
import { checkForUpdates, formatUpdateCheck, getUpdateTargets, readPackageJson } from "./updates.js";

export async function runCli(argv = []) {
  const [domain, command, ...flags] = argv;

  if (!domain || domain === "help" || domain === "--help" || domain === "-h") {
    write(usage());
    return 0;
  }

  if (domain === "doctor") {
    const result = callTruthTool("doctor.all", { all: flags.includes("--all") });
    for (const check of result.checks) {
      write(`${check.ok ? "ok" : "fail"} - ${check.name}: ${check.message}`);
    }
    if (!flags.includes("--no-update-check")) {
      const updates = await checkForUpdates({ targets: getUpdateTargets(readPackageJson()) });
      const updateStatus = updates.updates.length > 0 || updates.errors.length > 0 ? "warn" : "ok";
      write(`${updateStatus} - updates: ${formatUpdateCheck(updates)}`);
    }
    return result.ok ? 0 : 1;
  }

  const input = readJsonInput(flags);
  const exportProfile = getFlagValue(flags, "--export-profile");
  const format = getFlagValue(flags, "--format");
  const outDir = getFlagValue(flags, "--out");
  const toolName = toToolName(domain, command);
  const args = {
    ...input,
    ...(exportProfile ? { export_profile: exportProfile } : {}),
    ...(format ? { format } : {})
  };
  let result = callTruthTool(toolName, args);

  if (toolName === "truth.run" && outDir) {
    result = writeTruthRunOutputs(result, input, outDir);
  }

  if (typeof result === "string") {
    write(result);
  } else {
    write(JSON.stringify(result, null, 2));
  }

  return 0;
}

function toToolName(domain, command) {
  const toolName = `${domain}.${command}`;
  const supported = new Set([
    "capture.create",
    "capture.validate",
    "capture.render",
    "program.reconcile",
    "timeline.create",
    "timeline.validate",
    "timeline.render",
    "truth.run"
  ]);

  if (!supported.has(toolName)) {
    throw new Error(`Unknown command: ${domain} ${command ?? ""}`.trim());
  }

  return toolName;
}

function readJsonInput(flags) {
  const inputPath = getFlagValue(flags, "--input");
  const text = inputPath ? readFileSync(inputPath, "utf8") : readStdin();
  const normalized = text.replace(/^\uFEFF/, "");
  if (!normalized.trim()) return {};
  return JSON.parse(normalized);
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function getFlagValue(flags, name) {
  const index = flags.indexOf(name);
  if (index === -1) return null;
  return flags[index + 1] ?? null;
}

function write(text) {
  const normalized = String(text);
  process.stdout.write(normalized.endsWith("\n") ? normalized : `${normalized}\n`);
}

function usage() {
  return `truth-tools commands:
  truth-tools doctor --all
  truth-tools doctor --all --no-update-check
  truth-tools truth run --input run-input.json --out .truth-tools/runs/<run-id>
  truth-tools capture create --input intake.json
  truth-tools capture validate --input evidence-pack.json
  truth-tools capture render --export-profile repo-safe-summary --input evidence-pack.json
  truth-tools program reconcile --input program-input.json
  truth-tools timeline create --input intake.json
  truth-tools timeline validate --input timeline.json
  truth-tools timeline render --format markdown --input timeline.json
`;
}
