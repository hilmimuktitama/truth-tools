import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { callTruthTool } from "./mcp-tools.js";
import { renderReviewMarkdown } from "./report.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const REVIEW_FLAGS = new Set(["--input", "--format", "--out", "--fail-on"]);

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
  const input = readJsonInput(options.input);
  const review = callTruthTool("truth.review", input);
  const output = formatReview(review, options.format ?? "markdown");
  const exitCode = exitCodeFor(review.readiness, options.failOn);

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
  return flag.slice(2);
}

function readJsonInput(inputPath) {
  const text = inputPath ? readFileSync(inputPath, "utf8") : readStdin();
  if (!text.trim()) throw new Error("No input. Pass --input <file> or pipe JSON to stdin.");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function readStdin() {
  if (process.stdin.isTTY) return "";
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function formatReview(review, format) {
  if (format === "json") return `${JSON.stringify(review, null, 2)}\n`;
  if (format === "markdown" || format === "md") return renderReviewMarkdown(review);
  throw new Error("--format must be markdown or json.");
}

function exitCodeFor(readiness, failOn) {
  if (!failOn) return 0;
  if (failOn === "blocked") return readiness === "blocked" ? 2 : 0;
  if (failOn === "needs_review") return readiness === "ready" ? 0 : 2;
  throw new Error("--fail-on must be blocked or needs_review.");
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
  truth-tools review --input status.json --fail-on blocked
  truth-tools doctor
  truth-tools example
  truth-tools --version

Input model:
  as_of     required review timestamp
  sources[] metadata only: id, type, url, captured_at
  claims[]  explicit kind, text, optional subject/value, and source_refs

The tool does not infer facts from prose or fetch source bodies. It checks
citation integrity, freshness, contradictions, blockers, risks, and unknowns.
`;
}

function exampleInput() {
  return {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: {
      name: "Checkout migration",
      owner: "Platform TPM",
      objective: "Move checkout traffic without unresolved rollout risk."
    },
    policy: { max_source_age_days: 14 },
    sources: [
      {
        id: "jira-release",
        type: "jira",
        url: "https://example.atlassian.net/browse/PLAT-123",
        captured_at: "2026-08-10T08:00:00.000Z"
      }
    ],
    claims: [
      {
        id: "launch-date",
        kind: "fact",
        subject: "launch.date",
        value: "2026-08-20",
        text: "Target launch date is August 20, 2026.",
        source_refs: ["jira-release"]
      }
    ]
  };
}
