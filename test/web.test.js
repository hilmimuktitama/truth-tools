import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createWebServer } from "../src/web-server.js";
import { parseSourceDrafts, runReviewWorkflow } from "../src/web-workflow.js";

function createStubCallTool() {
  return function callTool(name, args) {
    if (name === "capture.create") return { kind: "evidence_pack", sources: args.sources, claims: [] };
    if (name === "capture.validate") return { gaps: [], conflicts: [] };
    if (name === "timeline.create") return { timeline: { items: [], gaps: [] } };
    if (name === "timeline.validate") return { gaps: [] };
    if (name === "program.reconcile") return { confirmed_facts: [], blockers: [], risks: [], unknowns: [], conflicts: [], assumptions: [], recommended_write_back: {} };
    if (name === "capture.render") return "# Evidence Pack\n";
    if (name === "timeline.render") return "# Timeline\n";
    if (name === "doctor.all") return { ok: true, checks: [{ name: "install", ok: true }] };
    throw new Error(`unexpected tool ${name}`);
  };
}

test("parses pasted source drafts into evidence sources", () => {
  assert.deepEqual(
    parseSourceDrafts({
      pasted: "Launch note says BIF-7550 is blocking rollout.",
      uploads: [{ name: "weekly-status.md", content: "Phase 2 is TBC." }]
    }),
    [
      {
        id: "paste-1",
        type: "text",
        content: "Launch note says BIF-7550 is blocking rollout.",
        freshness: "unknown"
      },
      {
        id: "weekly-status-md",
        type: "text",
        content: "Phase 2 is TBC.",
        freshness: "unknown"
      }
    ]
  );
});

test("runs the full review workflow through the truth tool dispatcher", () => {
  const calls = [];
  const callTool = (name, args) => {
    calls.push({ name, args });
    switch (name) {
      case "capture.create":
        return { kind: "evidence_pack", sources: args.sources, claims: [{ text: "BIF-7550 is blocking rollout." }] };
      case "capture.validate":
        return { gaps: [], conflicts: [] };
      case "timeline.create":
        return { timeline: { items: [{ title: "Phase 2", date_status: "tbc" }], gaps: [] } };
      case "timeline.validate":
        return { gaps: [{ itemTitle: "Phase 2", field: "start", question: "Confirm rollout date." }] };
      case "program.reconcile":
        return { confirmed_facts: [], blockers: [], risks: [], unknowns: [], conflicts: [], assumptions: [], recommended_write_back: {} };
      case "capture.render":
        return "# Evidence Pack\n";
      case "timeline.render":
        return "# Timeline\n";
      case "doctor.all":
        return { ok: true, checks: [] };
      default:
        throw new Error(`unexpected tool ${name}`);
    }
  };

  const review = runReviewWorkflow(
    {
      sources: [{ id: "jira-note", type: "text", content: "BIF-7550 is blocking rollout." }],
      notes: ["No source was treated as automatically authoritative."]
    },
    { callTool }
  );

  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "capture.create",
      "capture.validate",
      "timeline.create",
      "timeline.validate",
      "program.reconcile",
      "capture.render",
      "timeline.render",
      "doctor.all"
    ]
  );
  assert.equal(review.evidencePack.claims.length, 1);
  assert.equal(review.timeline.items[0].title, "Phase 2");
  assert.match(review.repoSafeSummary, /Evidence Pack/);
  assert.equal(review.doctor.ok, true);
});

test("local web server exposes review and doctor endpoints", async () => {
  const server = createWebServer({
    callTool: createStubCallTool()
  });

  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();

  try {
    const reviewResponse = await fetch(`http://127.0.0.1:${port}/api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pasted: "Phase 2 is TBC." })
    });
    const review = await reviewResponse.json();

    assert.equal(reviewResponse.status, 200);
    assert.equal(review.ok, true);
    assert.equal(review.review.evidencePack.kind, "evidence_pack");

    const doctorResponse = await fetch(`http://127.0.0.1:${port}/api/doctor`);
    const doctor = await doctorResponse.json();

    assert.equal(doctorResponse.status, 200);
    assert.deepEqual(doctor, { ok: true, doctor: { ok: true, checks: [{ name: "install", ok: true }] } });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("review workflow blocks sensitive repo-safe summaries", () => {
  const callTool = createStubCallTool();

  assert.throws(
    () =>
      runReviewWorkflow(
        {
          sources: [{ id: "jira-note", type: "text", content: "BIF-7550 is blocking rollout." }]
        },
        {
          callTool(name, args) {
            if (name === "program.reconcile") {
              return {
                confirmed_facts: [{ claim: "api_key: secret-token" }],
                blockers: [],
                risks: [],
                unknowns: [],
                conflicts: [],
                assumptions: [],
                recommended_write_back: {}
              };
            }
            return callTool(name, args);
          }
        }
      ),
    /Unsafe repo-safe-summary export blocked.*secret_assignment/
  );
});

test("review endpoint rejects unsafe request envelopes before running workflow", async () => {
  let workflowCalls = 0;
  const server = createWebServer({
    callTool(name, args) {
      if (name === "capture.create") workflowCalls += 1;
      return createStubCallTool()(name, args);
    },
    maxJsonBodyBytes: 32
  });

  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();

  try {
    const baseUrl = `http://127.0.0.1:${port}/api/review`;

    const textResponse = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ pasted: "Phase 2 is TBC." })
    });
    assert.equal(textResponse.status, 415);

    const originResponse = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ pasted: "Phase 2 is TBC." })
    });
    assert.equal(originResponse.status, 403);

    const largeResponse = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pasted: "A".repeat(128) })
    });
    assert.equal(largeResponse.status, 413);
    assert.equal(workflowCalls, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
