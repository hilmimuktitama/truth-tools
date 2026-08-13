import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { exitCodeFor, runCli } from "../src/cli.js";

function writeInput(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "truth-tools-"));
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "reports", "truth.md");
  const input = {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "CLI sample" },
    sources: [{ id: "source", type: "note", observed_at: "2026-08-10T00:00:00.000Z" }],
    health_assessment: {
      state: "on_track",
      owner: "Platform TPM",
      rationale: "The active evidence contains facts only.",
      source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
    },
    claims: [
      {
        id: "claim",
        kind: "fact",
        subject: "release.status",
        value: "ready",
        text: "The release is ready.",
        source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
      }
    ],
    ...overrides
  };
  writeFileSync(inputPath, JSON.stringify(input, null, 2));
  return { inputPath, outputPath };
}

test("review writes Markdown and returns zero for pass + on-track", async () => {
  const { inputPath, outputPath } = writeInput();
  const code = await runCli(["review", "--input", inputPath, "--out", outputPath]);

  assert.equal(code, 0);
  assert.match(readFileSync(outputPath, "utf8"), /Artifact quality:\*\* pass/);
  assert.match(readFileSync(outputPath, "utf8"), /Program health:\*\* on\\_track/);
});

test("--format json emits the structured review", async () => {
  const { inputPath } = writeInput();
  const captured = await captureStdout(() => runCli(["review", "--input", inputPath, "--format", "json"]));

  assert.equal(captured.result, 0);
  assert.match(captured.stdout, /"artifact_quality": "pass"/);
  assert.match(captured.stdout, /"program_health": "on_track"/);
});

test("--fail-on-health blocked returns exit code 2 for a blocked program", async () => {
  const { inputPath } = writeInput({
    claims: [
      {
        id: "blocker",
        kind: "blocker",
        text: "Rollback owner is missing.",
        owner: "Platform TPM",
        due_at: "2026-08-14",
        source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
      }
    ]
  });

  const captured = await captureStdout(() =>
    runCli(["review", "--input", inputPath, "--format", "json", "--fail-on-health", "blocked"])
  );
  assert.equal(captured.result, 2);
  assert.match(captured.stdout, /"program_health": "blocked"/);
});

test("program health never changes the exit code without an explicit health gate", async () => {
  const blocked = writeInput({
    health_assessment: {
      state: "blocked",
      owner: "Platform TPM",
      rationale: "The active blocker remains unresolved.",
      source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
    },
    claims: [
      {
        id: "blocker",
        kind: "blocker",
        text: "Rollback owner is missing.",
        owner: "Platform TPM",
        due_at: "2026-08-14",
        source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
      }
    ]
  });
  blocked.inputPath;
  const withoutHealthGate = await captureStdout(() => runCli(["review", "--input", blocked.inputPath, "--format", "json"]));
  assert.equal(withoutHealthGate.result, 0);
  assert.match(withoutHealthGate.stdout, /"program_health": "blocked"/);

  const qualityGateOnly = await captureStdout(() =>
    runCli(["review", "--input", blocked.inputPath, "--fail-on", "fail"])
  );
  assert.equal(qualityGateOnly.result, 0);
  assert.match(qualityGateOnly.stdout, /Artifact quality:\*\* pass/);
});

test("--fail-on fail is a quality gate, not a health alias", async () => {
  const failed = writeInput({
    claims: [{ id: "claim", kind: "fact", text: "Uncitable.", source_refs: [{ source_id: "ghost" }] }]
  });
  const quality = await captureStdout(() => runCli(["review", "--input", failed.inputPath, "--fail-on", "fail"]));
  assert.equal(quality.result, 2);
  assert.match(quality.stdout, /Artifact quality:\*\* fail/);

  const healthGateOnFailedArtifact = await captureStdout(() =>
    runCli(["review", "--input", failed.inputPath, "--fail-on-health", "blocked"])
  );
  assert.equal(healthGateOnFailedArtifact.result, 0);
});

test("--fail-on needs_review gates quality only", async () => {
  const clean = writeInput();
  assert.equal(
    (await captureStdout(() => runCli(["review", "--input", clean.inputPath, "--fail-on", "needs_review"]))).result,
    0
  );

  const stale = writeInput({
    sources: [{ id: "source", type: "note", observed_at: "2026-06-01T00:00:00.000Z" }]
  });
  assert.equal(
    (await captureStdout(() => runCli(["review", "--input", stale.inputPath, "--fail-on", "needs_review"]))).result,
    2
  );

  const atRiskButPassing = writeInput({
    health_assessment: {
      state: "at_risk",
      owner: "Platform TPM",
      rationale: "The active risk is mitigated but remains present.",
      source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
    },
    claims: [
      {
        id: "risk",
        kind: "risk",
        text: "Capacity is unverified.",
        owner: "Platform Engineering",
        mitigation: "Run the load test at 200% peak before release.",
        source_refs: [{ source_id: "source", locator: "https://example.com/notes/status" }]
      }
    ]
  });
  assert.equal(
    (await captureStdout(() => runCli(["review", "--input", atRiskButPassing.inputPath, "--fail-on", "needs_review"]))).result,
    0
  );
  assert.equal(
    (await captureStdout(() => runCli(["review", "--input", atRiskButPassing.inputPath, "--fail-on-health", "at_risk"]))).result,
    2
  );
});

test("exit code policy is exact", () => {
  const onTrack = { artifact_quality: "pass", program_health: "on_track" };
  const atRisk = { artifact_quality: "pass", program_health: "at_risk" };
  const blocked = { artifact_quality: "pass", program_health: "blocked" };
  const unknown = { artifact_quality: "pass", program_health: "unknown" };
  const failed = { artifact_quality: "fail", program_health: "on_track" };
  const needsReview = { artifact_quality: "needs_review", program_health: "blocked" };

  assert.equal(exitCodeFor(onTrack), 0);
  assert.equal(exitCodeFor(blocked), 0, "health alone never gates");
  assert.equal(exitCodeFor(failed), 0, "quality alone never gates without a flag");

  assert.equal(exitCodeFor(onTrack, "fail"), 0);
  assert.equal(exitCodeFor(needsReview, "fail"), 0);
  assert.equal(exitCodeFor(failed, "fail"), 2);
  assert.equal(exitCodeFor(blocked, "fail"), 0, "blocked health with pass quality is not a fail");

  assert.equal(exitCodeFor(onTrack, "needs_review"), 0);
  assert.equal(exitCodeFor(needsReview, "needs_review"), 2);
  assert.equal(exitCodeFor(failed, "needs_review"), 2);
  assert.equal(exitCodeFor(blocked, "needs_review"), 0, "health does not leak into the quality gate");

  assert.equal(exitCodeFor(onTrack, undefined, "blocked"), 0);
  assert.equal(exitCodeFor(blocked, undefined, "blocked"), 2);
  assert.equal(exitCodeFor(atRisk, undefined, "blocked"), 0);
  assert.equal(exitCodeFor(failed, undefined, "blocked"), 0, "a failed artifact with on-track health passes the health gate");

  assert.equal(exitCodeFor(onTrack, undefined, "at_risk"), 0);
  assert.equal(exitCodeFor(atRisk, undefined, "at_risk"), 2);
  assert.equal(exitCodeFor(blocked, undefined, "at_risk"), 2);
  assert.equal(exitCodeFor(unknown, undefined, "at_risk"), 2);

  assert.equal(exitCodeFor(failed, "fail", "blocked"), 2, "gates combine");
  assert.equal(exitCodeFor(blocked, "fail", "blocked"), 2);

  assert.throws(() => exitCodeFor(onTrack, "blocked"), /--fail-on must be fail or needs_review/);
  assert.throws(() => exitCodeFor(onTrack, "anything"), /--fail-on must be fail or needs_review/);
  assert.throws(() => exitCodeFor(onTrack, undefined, "blockedX"), /--fail-on-health must be blocked or at_risk/);
});

test("doctor and version are machine-readable", async () => {
  const doctor = await captureStdout(() => runCli(["doctor"]));
  assert.equal(doctor.result, 0);
  assert.match(doctor.stdout, /"ok": true/);

  const version = await captureStdout(() => runCli(["--version"]));
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(version.result, 0);
  assert.equal(version.stdout, `${pkg.version}\n`);
});

test("example is a canonical stdout artifact that round-trips through JSON review", () => {
  const example = spawnSync(process.execPath, ["bin/truth-tools.js", "example"], { encoding: "utf8" });
  assert.equal(example.status, 0, example.stderr);
  const review = spawnSync(process.execPath, ["bin/truth-tools.js", "review", "--format", "json"], {
    input: example.stdout,
    encoding: "utf8"
  });
  assert.equal(review.status, 0, review.stderr);
  const output = JSON.parse(review.stdout);
  assert.equal(output.artifact_quality, "pass");
  assert.equal(output.program_health, "on_track");
});

test("review rejects unknown, missing, and duplicate flags", async () => {
  await assert.rejects(() => runCli(["review", "--imput", "status.json"]), /Unknown review argument/);
  await assert.rejects(() => runCli(["review", "--input"]), /requires a value/);
  await assert.rejects(
    () => runCli(["review", "--input", "a.json", "--input", "b.json"]),
    /may only be provided once/
  );
});

test("validates fail-on before writing a report", async () => {
  const { inputPath } = writeInput();
  const captured = await captureRejectedStdout(() => runCli(["review", "--input", inputPath, "--fail-on", "anything"]));

  assert.match(captured.error.message, /--fail-on must be fail or needs_review/);
  assert.equal(captured.stdout, "");

  const healthCaptured = await captureRejectedStdout(() =>
    runCli(["review", "--input", inputPath, "--fail-on-health", "anything"])
  );
  assert.match(healthCaptured.error.message, /--fail-on-health must be blocked or at_risk/);
});

test("unknown commands and missing as_of fail with exit 1 style errors", async () => {
  await assert.rejects(() => runCli(["capture"]), /Unknown command/);

  const { inputPath } = writeInput({ as_of: undefined });
  delete JSON.parse(readFileSync(inputPath, "utf8")).as_of;
  writeFileSync(inputPath, JSON.stringify(JSON.parse(readFileSync(inputPath, "utf8"))));

  const { inputPath: noAsOf } = writeInput();
  const parsed = JSON.parse(readFileSync(noAsOf, "utf8"));
  delete parsed.as_of;
  writeFileSync(noAsOf, JSON.stringify(parsed));
  await assert.rejects(() => runCli(["review", "--input", noAsOf]), /as_of is required/);
});

test("the committed broken launch example exits 2 under quality and health gates", async () => {
  const noGate = await captureStdout(() => runCli(["review", "--input", "examples/product-launch.json", "--format", "json"]));
  assert.equal(noGate.result, 0);
  assert.match(noGate.stdout, /"artifact_quality": "fail"/);

  const qualityFail = await captureStdout(() =>
    runCli(["review", "--input", "examples/product-launch.json", "--fail-on", "fail"])
  );
  assert.equal(qualityFail.result, 2);

  const qualityStrict = await captureStdout(() =>
    runCli(["review", "--input", "examples/product-launch.json", "--fail-on", "needs_review"])
  );
  assert.equal(qualityStrict.result, 2);

  const healthBlocked = await captureStdout(() =>
    runCli(["review", "--input", "examples/product-launch.json", "--fail-on-health", "blocked"])
  );
  assert.equal(healthBlocked.result, 2);
});

test("the fixed launch-readiness fixture gates quality and health independently", async () => {
  const qualityGate = await captureStdout(() =>
    runCli(["review", "--input", "examples/launch-readiness/evidence-pack.json", "--fail-on", "fail"])
  );
  assert.equal(qualityGate.result, 0);
  assert.match(qualityGate.stdout, /Artifact quality:\*\* pass/);

  const healthGate = await captureStdout(() =>
    runCli(["review", "--input", "examples/launch-readiness/evidence-pack.json", "--fail-on-health", "blocked"])
  );
  assert.equal(healthGate.result, 2);
  assert.match(healthGate.stdout, /Program health:\*\* blocked/);
});

async function captureRejectedStdout(fn) {
  const original = process.stdout.write;
  let stdout = "";
  process.stdout.write = (chunk, ...args) => {
    stdout += String(chunk);
    const callback = args.find((arg) => typeof arg === "function");
    callback?.();
    return true;
  };
  try {
    await fn();
    throw new Error("Expected function to reject.");
  } catch (error) {
    return { error, stdout };
  } finally {
    process.stdout.write = original;
  }
}

async function captureStdout(fn) {
  const original = process.stdout.write;
  let stdout = "";
  process.stdout.write = (chunk, ...args) => {
    stdout += String(chunk);
    const callback = args.find((arg) => typeof arg === "function");
    callback?.();
    return true;
  };
  try {
    return { result: await fn(), stdout };
  } finally {
    process.stdout.write = original;
  }
}
