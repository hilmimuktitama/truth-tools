import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runDoctor } from "../src/doctor.js";
import { checkRedaction, renderForExportProfile } from "../src/exports.js";
import { callTruthTool, listTruthTools } from "../src/mcp-tools.js";
import { reconcileProgram } from "../src/program.js";
import { normalizeConflict, normalizeTimelineItem, PROGRAM_STATUS_SECTIONS } from "../src/schemas.js";
import { checkForUpdates, formatUpdateCheck, getUpdateTargets } from "../src/updates.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("declares runtime truth package dependencies for standalone installs", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const source = [
    readFileSync(resolve(ROOT, "src", "mcp-tools.js"), "utf8"),
    readFileSync(resolve(ROOT, "src", "doctor.js"), "utf8")
  ].join("\n");

  assert.match(pkg.dependencies?.["capture-truth"] ?? "", /^\^0\./);
  assert.match(pkg.dependencies?.["timeline-truth"] ?? "", /^\^0\./);
  assert.doesNotMatch(source, /from\s+["']\.\.\/\.\.\/(?:capture-truth|timeline-truth)\//);
});

test("lists one dotted callable interface for capture, program, timeline, and doctor", () => {
  const names = listTruthTools().map((tool) => tool.name);

  assert.deepEqual(names, [
    "truth.run",
    "capture.create",
    "capture.validate",
    "capture.render",
    "program.reconcile",
    "timeline.create",
    "timeline.validate",
    "timeline.render",
    "doctor.all"
  ]);
});

test("delegates capture create, validate, and repo-safe render", () => {
  const created = callTruthTool("capture.create", {
    sources: [
      {
        id: "jira-tf-2944",
        type: "text",
        captured_at: "2026-05-14T00:00:00Z",
        freshness: "fresh",
        content: "TF-2944 is blocked by BIF-7550 owner Platform."
      }
    ]
  });

  assert.equal(created.kind, "evidence_pack");
  assert.equal(created.sources[0].id, "jira-tf-2944");

  const validation = callTruthTool("capture.validate", { evidence_pack: created });
  assert.equal(Array.isArray(validation.gaps), true);

  const rendered = callTruthTool("capture.render", {
    evidence_pack: created,
    export_profile: "repo-safe-summary"
  });
  assert.match(rendered, /Evidence Pack/);
  assert.doesNotMatch(rendered, /TF-2944 is blocked by BIF-7550 owner Platform/);
});

test("normalizes conflicts into actionable reconciliation objects", () => {
  assert.deepEqual(
    normalizeConflict({
      claim: "Real-client rollout start date",
      source_a: { system: "local-note", value: "2026-05-27" },
      source_b: { system: "jira", value: "2026-06-02" },
      conflict_type: "date_mismatch"
    }),
    {
      claim: "Real-client rollout start date",
      source_a: { system: "local-note", value: "2026-05-27" },
      source_b: { system: "jira", value: "2026-06-02" },
      conflict_type: "date_mismatch",
      recommended_owner_action: "Assign an owner to reconcile the source disagreement and update the system of record."
    }
  );
});

test("preserves timeline unknowns without inventing dates", () => {
  const item = normalizeTimelineItem({
    title: "Phase 2 rollout",
    date_text: "TBC",
    blocks_next_milestone: "unknown"
  });

  assert.equal(item.date_status, "tbc");
  assert.equal(item.blocks_next_milestone, "unknown");
  assert.equal(item.start, undefined);
});

test("delegates timeline create, validate, and render", () => {
  const created = callTruthTool("timeline.create", {
    sources: [
      {
        id: "planning-note",
        type: "text",
        content: "Phase 1: 2026-06-01 to 2026-06-05 owner TPM status planned\nPhase 2 owner Engineering"
      }
    ]
  });

  assert.equal(Array.isArray(created.timeline.items), true);
  assert.equal(created.timeline.items.some((item) => item.title === "Phase 2"), true);

  const validation = callTruthTool("timeline.validate", { timeline: created.timeline });
  assert.equal(Array.isArray(validation.gaps), true);

  const rendered = callTruthTool("timeline.render", {
    timeline: created.timeline,
    format: "markdown"
  });
  assert.match(rendered, /Phase 2/);
});

test("reconciles program evidence into the standard program status schema", () => {
  const status = reconcileProgram({
    evidence_pack: {
      kind: "evidence_pack",
      claims: [
        { id: "c1", text: "BIF-7550 remains open.", source_refs: [{ sourceId: "jira" }] },
        { id: "c2", text: "Phase 2 date is unknown.", category: "unknown", source_refs: [{ sourceId: "note" }] }
      ],
      conflicts: [
        {
          claim: "Bifrost readiness",
          source_a: { system: "confluence", value: "ready" },
          source_b: { system: "jira", value: "BIF-7550 open" },
          conflict_type: "status_mismatch"
        }
      ],
      assumptions: ["No source was treated as automatically authoritative."]
    }
  });

  assert.deepEqual(Object.keys(status), PROGRAM_STATUS_SECTIONS);
  assert.equal(status.confirmed_facts.length, 1);
  assert.equal(status.unknowns.length, 1);
  assert.equal(status.conflicts[0].recommended_owner_action.includes("Assign an owner"), true);
  assert.equal(status.recommended_write_back.repo.length > 0, true);
  assert.equal(status.recommended_write_back.tmp.length > 0, true);
});

test("repo-safe export omits raw source bodies and flags secrets", () => {
  const rendered = renderForExportProfile({
    artifact: {
      kind: "evidence_pack",
      sources: [
        {
          id: "raw-note",
          content: "Customer token secret=abc123 and private launch note."
        }
      ],
      claims: [{ text: "Launch date is conflicting.", source_refs: [{ sourceId: "raw-note" }] }]
    },
    profile: "repo-safe-summary"
  });

  assert.match(rendered.content, /Launch date is conflicting/);
  assert.doesNotMatch(rendered.content, /abc123/);
  assert.equal(rendered.redaction.blocked_terms.length > 0, true);
});

test("repo-safe export blocks sensitive rendered fields", () => {
  assert.throws(
    () =>
      renderForExportProfile({
        artifact: {
          kind: "evidence_pack",
          conflicts: [{ claim: "Authorization: Bearer secret-token" }],
          assumptions: ["token: secret-token"]
        },
        profile: "repo-safe-summary"
      }),
    /Unsafe repo-safe-summary export blocked.*authorization_header/
  );
});

test("redaction detects JSON-shaped secret keys", () => {
  const redaction = checkRedaction({
    headers: { Authorization: "Bearer secret-token" },
    token: "secret-token"
  });

  assert.equal(redaction.ok, false);
  assert.deepEqual(redaction.blocked_terms.sort(), ["authorization_header", "secret_assignment"]);
});

test("doctor verifies install, schema, render, and MCP surface", () => {
  const result = runDoctor({ all: true });

  assert.equal(result.ok, true);
  assert.equal(result.checks.every((check) => check.ok), true);
  assert.deepEqual(
    result.checks.map((check) => check.name),
    ["install", "schema", "render", "mcp"]
  );
});

test("update checker reports newer truth package versions", async () => {
  const targets = getUpdateTargets({
    name: "truth-tools",
    version: "0.1.0",
    dependencies: {
      "capture-truth": "^0.2.0",
      "timeline-truth": "^0.2.0"
    }
  });

  const result = await checkForUpdates({
    targets,
    fetchImpl: async (url) => ({
      ok: true,
      async json() {
        const versions = {
          "truth-tools": "0.1.1",
          "capture-truth": "0.2.0",
          "timeline-truth": "0.3.0"
        };
        const name = decodeURIComponent(String(url).split("/").at(-2));
        return { version: versions[name] };
      }
    })
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.updates.map((update) => `${update.name}@${update.current}->${update.latest}`),
    ["truth-tools@0.1.0->0.1.1", "timeline-truth@0.2.0->0.3.0"]
  );
  assert.equal(formatUpdateCheck(result), "updates available: truth-tools 0.1.0 -> 0.1.1; timeline-truth 0.2.0 -> 0.3.0");
});

test("update checker stays non-fatal when registry lookup fails", async () => {
  const result = await checkForUpdates({
    targets: [{ name: "truth-tools", current: "0.1.0" }],
    fetchImpl: async () => {
      throw new Error("offline");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.updates.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(formatUpdateCheck(result), "update check unavailable for truth-tools");
});
