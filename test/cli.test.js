import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../src/cli.js";

function writeInput(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "truth-tools-"));
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "reports", "truth.md");
  const input = {
    as_of: "2026-08-11T00:00:00.000Z",
    initiative: { name: "CLI sample" },
    sources: [{ id: "source", type: "note", captured_at: "2026-08-10T00:00:00.000Z" }],
    claims: [
      {
        id: "claim",
        kind: "fact",
        subject: "release.status",
        value: "ready",
        text: "The release is ready.",
        source_refs: ["source"]
      }
    ],
    ...overrides
  };
  writeFileSync(inputPath, JSON.stringify(input, null, 2));
  return { inputPath, outputPath };
}

test("review writes Markdown and returns zero for ready", async () => {
  const { inputPath, outputPath } = writeInput();
  const code = await runCli(["review", "--input", inputPath, "--out", outputPath]);

  assert.equal(code, 0);
  assert.match(readFileSync(outputPath, "utf8"), /Readiness:\*\* ready/);
});

test("--fail-on blocked returns exit code 2", async () => {
  const { inputPath } = writeInput({
    claims: [{ id: "blocker", kind: "blocker", text: "Rollback owner is missing.", source_refs: ["source"] }]
  });

  const captured = await captureStdout(() =>
    runCli(["review", "--input", inputPath, "--format", "json", "--fail-on", "blocked"])
  );
  assert.equal(captured.result, 2);
  assert.match(captured.stdout, /"readiness": "blocked"/);
});

test("--fail-on needs_review fails risks but not ready reviews", async () => {
  const ready = writeInput();
  assert.equal(
    (await captureStdout(() => runCli(["review", "--input", ready.inputPath, "--fail-on", "needs_review"]))).result,
    0
  );

  const risk = writeInput({
    claims: [{ id: "risk", kind: "risk", text: "Capacity is unverified.", source_refs: ["source"] }]
  });
  assert.equal(
    (await captureStdout(() => runCli(["review", "--input", risk.inputPath, "--fail-on", "needs_review"]))).result,
    2
  );
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
  const captured = await captureRejectedStdout(() =>
    runCli(["review", "--input", inputPath, "--fail-on", "anything"])
  );

  assert.match(captured.error.message, /--fail-on must be blocked or needs_review/);
  assert.equal(captured.stdout, "");
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
