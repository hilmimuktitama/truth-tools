import { readFileSync } from "node:fs";

export const SCHEMA_VERSION = "1.0.0";

export const CONTRACT_NAMES = [
  "source",
  "source-ref",
  "candidate-claim",
  "claim",
  "timeline-item",
  "status-artifact",
  "truth-review",
  "suite-lock"
];

function load(name) {
  const text = readFileSync(new URL(`./schemas/${name}.schema.json`, import.meta.url), "utf8");
  return JSON.parse(text);
}

export const contracts = Object.freeze(
  Object.fromEntries(CONTRACT_NAMES.map((name) => [name, Object.freeze(load(name))]))
);

export function loadContract(name) {
  if (!Object.hasOwn(contracts, name)) {
    throw new Error(`Unknown contract '${name}'. Known contracts: ${CONTRACT_NAMES.join(", ")}.`);
  }
  return contracts[name];
}
