import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { CONTRACT_FLOORS, RELEASE_TARGET_VERSIONS, githubOutputs, parseArgs, readSuiteLock, verifySiblingContracts, verifySuiteLock } from "../scripts/suite-lock-verify.js";

test("suite lock preserves historical released facts and stable output", () => {
  const lock = readSuiteLock();
  const result = verifySuiteLock({ lock });
  assert.equal(result.ok, true, result.failures.join(", "));
  assert.equal(lock.components["capture-truth"].version, "0.4.1");
  assert.equal(lock.components["timeline-truth"].version, "0.3.1");
  assert.equal(lock.components["program-truth"].version, "0.2.1");
  assert.match(githubOutputs(lock), /capture_truth_ref=[0-9a-f]{40}/);
});

test("suite lock rejects malformed, missing, and non-SHA refs", () => {
  for (const mutate of [
    (lock) => { lock.components["capture-truth"].ref = "main"; },
    (lock) => { delete lock.components["timeline-truth"]; },
    (lock) => { lock.components["program-truth"].version = "next"; },
    (lock) => { lock.$schema = "wrong"; }
  ]) {
    const lock = structuredClone(readSuiteLock());
    mutate(lock);
    assert.equal(verifySuiteLock({ lock }).ok, false);
  }
});

test("github output is stdout-safe and release mode rejects provisional refs", () => {
  const lock = readSuiteLock();
  assert.equal(githubOutputs(lock).split("\n").length, 3);
  assert.ok(githubOutputs(lock).split("\n").every((line) => /^[a-z_]+_ref=[0-9a-f]{40}$/.test(line)));
  assert.equal(verifySuiteLock({ lock, requireCommitted: true }).ok, true);

  const provisional = structuredClone(lock);
  provisional.components["capture-truth"].provisional = true;
  assert.equal(verifySuiteLock({ lock: provisional, requireCommitted: true }).ok, false);
});

test("suite lock rejects an unexpected repository identity", () => {
  const lock = structuredClone(readSuiteLock());
  lock.components["capture-truth"].repository = "other-owner/capture-truth";
  const result = verifySuiteLock({ lock });
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /repository identity/);
});

test("target versions are checked without making provisional refs releaseable", () => {
  const lock = readSuiteLock();
  assert.equal(lock.components["timeline-truth"].ref, "2b08ea75c930b02112a12f17a4de152898d7b5a7");
  assert.equal(verifySuiteLock({ lock, targetVersions: RELEASE_TARGET_VERSIONS }).ok, false);
  const staged = structuredClone(lock);
  staged.components["capture-truth"].version = "0.5.1";
  staged.components["program-truth"].version = "0.3.1";
  staged.components["capture-truth"].provisional = true;
  staged.components["program-truth"].provisional = true;
  assert.equal(verifySuiteLock({ lock: staged, targetVersions: RELEASE_TARGET_VERSIONS }).ok, false);
  assert.ok(CONTRACT_FLOORS["capture-truth"]);
});

test("release mode enforces the exact coordinated target versions", () => {
  const lock = structuredClone(readSuiteLock());
  const result = verifySuiteLock({ lock, targetVersions: RELEASE_TARGET_VERSIONS, requireCommitted: true });
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /capture-truth.*target 0\.5\.1/);
  assert.match(result.failures.join("\n"), /timeline-truth.*target 0\.4\.0/);
  assert.match(result.failures.join("\n"), /program-truth.*target 0\.3\.1/);
});

test("release CLI wires exact target enforcement and keeps stdout safe", () => {
  const result = spawnSync(process.execPath, [
    "scripts/suite-lock-verify.js",
    "--release",
    "--github-output"
  ], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /capture-truth.*target 0\.5\.1/);
  assert.match(result.stderr, /timeline-truth.*target 0\.4\.0/);
  assert.match(result.stderr, /program-truth.*target 0\.3\.1/);
});

test("contract floor fails an old contract that only forges package metadata", () => {
  const result = verifySiblingContracts({ componentRoot: new URL("../../", import.meta.url).pathname });
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.ok(CONTRACT_FLOORS["program-truth"]);
});

test("contract verifier enforces Capture, Timeline, and Program public contract details", () => {
  const root = new URL("../../", import.meta.url).pathname;
  const result = verifySiblingContracts({ componentRoot: root });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("final-lock fixture checks exact current target refs in memory", () => {
  const lock = structuredClone(readSuiteLock());
  lock.components["capture-truth"] = { repository: "hilmimuktitama/capture-truth", ref: "a".repeat(40), version: "0.5.1" };
  lock.components["timeline-truth"] = { repository: "hilmimuktitama/timeline-truth", ref: "b".repeat(40), version: "0.4.0" };
  lock.components["program-truth"] = { repository: "hilmimuktitama/program-truth", ref: "c".repeat(40), version: "0.3.1" };
  assert.equal(verifySuiteLock({ lock, targetVersions: RELEASE_TARGET_VERSIONS }).ok, true);
  for (const mutate of [
    (entry) => { entry.version = "9.9.9"; },
    (entry) => { entry.ref = "wrong"; },
    (entry) => { entry.repository = "other/name"; },
    (entry) => { entry.provisional = true; }
  ]) {
    const invalid = structuredClone(lock);
    mutate(invalid.components["capture-truth"]);
    assert.equal(verifySuiteLock({ lock: invalid, targetVersions: RELEASE_TARGET_VERSIONS, requireCommitted: true }).ok, false);
  }
});

test("checked-out sibling contracts meet the staged contract floors", () => {
  const result = verifySiblingContracts({ componentRoot: new URL("../../", import.meta.url).pathname });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("process accepts the exact workflow command style with a separate component-root value", (context) => {
  const componentRoot = process.env.TRUTH_SUITE_COMPONENT_ROOT;
  if (!componentRoot) return context.skip("sibling component root is not configured");
  const result = spawnSync(process.execPath, [
    "scripts/suite-lock-verify.js",
    "--component-root",
    componentRoot,
    "--verify-checkouts"
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Suite lock verification: PASS/);
});

test("argument parser accepts both value forms and rejects malformed arguments", () => {
  assert.deepEqual(parseArgs(["--lock=one.json", "--component-root", "/tmp/root", "--release"]).errors, []);
  for (const args of [
    ["--lock"],
    ["--component-root", "--verify-checkouts"],
    ["--release", "--release"],
    ["--unknown"]
  ]) assert.ok(parseArgs(args).errors.length > 0, args.join(" "));
  assert.deepEqual(parseArgs(["--verify-contracts"]).errors, []);
});
