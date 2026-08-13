import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { callTruthTool } from "./mcp-tools.js";
import { renderReviewMarkdown } from "./report.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const REVIEW_FLAGS = new Set(["--input", "--format", "--out", "--fail-on", "--fail-on-health"]);

export async function runCli(argv = []) {
  const [command, ...args] = argv;

  if (!command || ["help", "--help", "-h"].includes(command)) {
    write(usage());
    return 0;
  }

  if (["version", "--version", "-v"].includes(command)) {
    write(pkg.version);
    return 0;
  }

  if (command === "doctor") {
    assertNoArguments(args, "doctor");
    const result = callTruthTool("truth.doctor", {});
    write(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "example") {
    assertNoArguments(args, "example");
    write(JSON.stringify(exampleInput(), null, 2));
    return 0;
  }

  if (command !== "review") throw new Error(`Unknown command: ${command}`);
  if (args.some((arg) => ["--help", "-h"].includes(arg))) {
    write(usage());
    return 0;
  }

  const options = parseReviewFlags(args);
  const input = await readJsonInput(options.input);
  const review = callTruthTool("truth.review", input);
  const output = formatReview(review, options.format ?? "markdown");
  const exitCode = exitCodeFor(review, options.failOn, options.failOnHealth);

  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, output, "utf8");
  } else {
    write(output);
  }

  return exitCode;
}

function parseReviewFlags(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (!REVIEW_FLAGS.has(flag)) {
      throw new Error(`Unknown review argument: ${flag ?? "<missing>"}`);
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }

    const key = flagName(flag);
    if (Object.hasOwn(options, key)) throw new Error(`${flag} may only be provided once.`);
    options[key] = value;
  }

  return options;
}

function flagName(flag) {
  if (flag === "--fail-on") return "failOn";
  if (flag === "--fail-on-health") return "failOnHealth";
  return flag.slice(2);
}

async function readJsonInput(inputPath) {
  const text = inputPath ? readFileSync(inputPath, "utf8") : await readStdin();
  if (!text.trim()) throw new Error("No input. Pass --input <file> or pipe JSON to stdin.");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

function formatReview(review, format) {
  if (format === "json") return `${JSON.stringify(review, null, 2)}\n`;
  if (format === "markdown" || format === "md") return renderReviewMarkdown(review);
  throw new Error("--format must be markdown or json.");
}

export function exitCodeFor(review, failOn, failOnHealth) {
  let code = 0;

  if (failOn === "fail") {
    code = review.artifact_quality === "fail" ? 2 : code;
  } else if (failOn === "needs_review") {
    code = review.artifact_quality !== "pass" ? 2 : code;
  } else if (failOn !== undefined) {
    throw new Error("--fail-on must be fail or needs_review.");
  }

  if (failOnHealth === "blocked") {
    code = review.program_health === "blocked" ? 2 : code;
  } else if (failOnHealth === "at_risk") {
    code = review.program_health !== "on_track" ? 2 : code;
  } else if (failOnHealth !== undefined) {
    throw new Error("--fail-on-health must be blocked or at_risk.");
  }

  return code;
}

function assertNoArguments(args, command) {
  if (args.length > 0) throw new Error(`${command} does not accept arguments.`);
}

function write(text) {
  const value = String(text);
  process.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
}

function usage() {
  return `truth-tools — audit the evidence structure of a project-status report

Usage:
  truth-tools review --input status.json [--format markdown|json] [--out report.md]
  cat status.json | truth-tools review --format json
  truth-tools review --input status.json --fail-on needs_review
  truth-tools review --input status.json --fail-on-health blocked
  truth-tools doctor
  truth-tools example
  truth-tools --version

Input model (StatusArtifact):
  as_of             required review cutoff timestamp
  sources[]         metadata only: id, type, observed_at, source_updated_at, url, owner
  claims[]          explicit kind, text, optional subject/value, source_refs
  timeline[]        optional plan items; baseline_timeline[] enables drift reporting

Output:
  artifact_quality  pass | needs_review | fail
  program_health    on_track | at_risk | blocked | unknown

Exit codes:
  0  review completed and no gate is triggered
  1  usage, input, or engine error
  2  a gate is triggered

Gates (independent, combinable, each exits 2 when triggered):
  --fail-on fail           artifact_quality is fail
  --fail-on needs_review   artifact_quality is needs_review or fail
  --fail-on-health blocked program_health is blocked
  --fail-on-health at_risk program_health is at_risk, blocked, or unknown

Program health never changes the exit code by itself; gate it explicitly with
--fail-on-health if you want CI to fail on a blocked or at-risk program.

Deprecated compatibility forms are accepted and flagged in findings.deprecations:
  captured_at (use observed_at), sourceId (use id), plain-string source_refs
  (use { "source_id": "..." }).

The tool does not infer facts from prose or fetch source bodies. It checks
citation integrity, freshness, contradictions, blockers, risks, and unknowns.
`;
}

function exampleInput() {
  return {
    kind: "status_artifact",
   schema_version: "2.0.0",
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: {
      name: "Checkout migration",
      owner: "Platform TPM",
      objective: "Move checkout traffic without unresolved rollout risk."
    },
    policy: { max_observation_age_days: 14, max_source_content_age_days: 14 },
    sources: [
      {
        id: "jira-release",
        type: "jira",
        url: "https://example.atlassian.net/browse/PLAT-123",
        observed_at: "2026-08-10T08:00:00.000Z",
        source_updated_at: "2026-08-10T08:00:00.000Z"
      }
    ],
    health_assessment: {
      state: "on_track",
      owner: "Platform TPM",
      rationale: "All active claims are facts and the supplied evidence is current.",
      source_refs: [{ source_id: "jira-release", locator: "https://example.atlassian.net/browse/PLAT-123" }]
    },
    claims: [
      {
        id: "launch-date",
        kind: "fact",
        subject: "launch.date",
        value: "2026-08-20",
        text: "Target launch date is August 20, 2026.",
        source_refs: [{ source_id: "jira-release", locator: "https://example.atlassian.net/browse/PLAT-123" }]
      }
    ]
  };
}
