import Ajv2020 from "ajv/dist/2020.js";

import { CONTRACT_NAMES, SCHEMA_VERSION, contracts, loadContract } from "../packages/contracts/index.js";

export { CONTRACT_NAMES, SCHEMA_VERSION, contracts, loadContract };

export const ARTIFACT_QUALITY_VALUES = ["pass", "needs_review", "fail"];
export const PROGRAM_HEALTH_VALUES = ["on_track", "at_risk", "blocked", "unknown"];
export const CLAIM_KINDS = ["fact", "blocker", "risk", "unknown"];
export const CLAIM_STATES = ["active", "superseded", "historical"];
export const TIMELINE_TYPES = ["task", "milestone"];
export const DATE_DERIVATIONS = ["explicit", "natural", "none"];
export const EVIDENCE_GRADES = ["exact", "derived", "fuzzy", "missing"];

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });

// Ajv's built-in date-time format is intentionally not enabled for Draft
// 2020-12. Keep the contract's full-timezone shape regex, and add the
// semantic RFC3339 checks here without pulling in ajv-formats.
ajv.addFormat("date-time", {
  type: "string",
  validate: isValidRfc3339DateTime
});

function isValidRfc3339DateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zone === "Z" ? 0 : Number(zone.slice(1, 3));
  const offsetMinute = zone === "Z" ? 0 : Number(zone.slice(4, 6));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1] &&
    hour <= 23 && minute <= 59 && second <= 59 &&
    offsetHour <= 23 && offsetMinute <= 59;
}

for (const contract of Object.values(contracts)) {
  ajv.addSchema(contract);
}

export function validateContract(name, data) {
  const contract = loadContract(name);
  const validate = ajv.getSchema(contract.$id);
  if (!validate) throw new Error(`Contract '${name}' is not registered with the validator.`);
  const valid = validate(data);
  return { valid, errors: validate.errors ?? [] };
}

export function validateStatusArtifact(data) {
  return validateContract("status-artifact", data);
}

export function validateTruthReview(data) {
  return validateContract("truth-review", data);
}
