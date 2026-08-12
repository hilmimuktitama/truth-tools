import assert from "node:assert/strict";
import test from "node:test";

import { githubOutputs, readSuiteLock, verifySuiteLock } from "../scripts/suite-lock-verify.js";

test("suite lock has exact refs, target versions, and stable output", () => {
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
