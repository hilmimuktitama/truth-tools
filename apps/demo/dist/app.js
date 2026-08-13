import { TRUTH_DEMO } from "./data.js";

const state = { view: "broken" };

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function daysBetween(earlierIso, laterIso) {
  // Fractional days with one decimal, matching the engine's policy decision:
  // a source is stale when age > max_source_age_days (14.5d is stale under a
  // 14d policy). Rounding to whole days would misrepresent the verdict.
  const milliseconds = new Date(laterIso).getTime() - new Date(earlierIso).getTime();
  if (!Number.isFinite(milliseconds)) return null;
  const days = Math.max(0, milliseconds / 86_400_000);
  return Math.round(days * 10) / 10;
}

function badge(value) {
  const node = el("span", `badge ${value}`);
  node.textContent = value;
  return node;
}

function reviewForView() {
  return state.view === "broken"
    ? TRUTH_DEMO.brokenReview
    : state.view === "fixed"
      ? TRUTH_DEMO.fixedReview
      : TRUTH_DEMO.factsOnlyReview;
}

// The narrative is derived from the review output, never hardcoded: source
// ages come from daysBetween against the review's as_of and policy, so the
// story always matches the freshness bars above it.
function verdictNarrative(review, view) {
  const issues = review.findings.issues;
  const types = issues.map((item) => item.type);
  const staleAges = issues
    .filter((item) => item.type === "stale_observation" && item.age_days !== undefined)
    .map((item) => item.age_days);
  const maxStaleAge = staleAges.length > 0 ? Math.max(...staleAges) : null;
  const rawBodyCount = issues.filter((item) => item.type === "raw_source_content").length;
  const conflictValues = review.findings.conflicts.flatMap((conflict) => conflict.values.length);
  const blocker = review.findings.blockers[0];
  const risk = review.findings.risks[0];
  const clauses = [];

  if (view === "broken") {
    if (rawBodyCount > 0) {
      clauses.push(`a raw source body is embedded (${rawBodyCount} source${rawBodyCount === 1 ? "" : "s"})`);
    }
    if (types.includes("missing_observed_at")) clauses.push("one source has no observed_at");
    if (maxStaleAge !== null) {
      clauses.push(
        `the oldest snapshot is ${maxStaleAge.toFixed(1)} days old against a ${review.policy.max_observation_age_days}-day observation policy`
      );
    }
    if (conflictValues.length > 0) {
      clauses.push(`${conflictValues[0]} sources contradict the launch date`);
    }
    if (blocker && (!blocker.owner || !blocker.due_at)) clauses.push("the rollback blocker is ownerless and dateless");
    if (risk && (!risk.owner || !risk.mitigation)) clauses.push("a risk lacks an owner or mitigation");
    return `The engine refuses the artifact: ${clauses.join(", ")}. The blocker makes the program blocked.`;
  }

  if (view === "facts-only") {
    return "The artifact needs review: it contains the fact release.ready=false but no explicit health assessment. Program health is unknown.";
  }

  if (rawBodyCount === 0) clauses.push("metadata only, no raw bodies");
  if (maxStaleAge === null) clauses.push("every source is fresh and citable");
  if (conflictValues.length === 0) clauses.push("the launch date is reconciled");
  if (blocker && blocker.owner && blocker.due_at) clauses.push("the blocker is owned and dated");
  if (risk && risk.owner && risk.mitigation) clauses.push("risks carry owners and mitigations");
  return `The artifact passes review: ${clauses.join(", ")}. The program is still blocked by the active blocker.`;
}

function renderVerdict() {
  const review = reviewForView();
  const quality = $("badge-quality");
  const health = $("badge-health");
  quality.replaceChildren(badge(`quality: ${review.artifact_quality}`));
  health.replaceChildren(badge(`health: ${review.program_health}`));

  const note = $("verdict-note");
  note.textContent = verdictNarrative(review, state.view);

  $("quality-health-lesson").textContent =
    state.view === "broken"
      ? "Here quality and health both fail — the evidence is broken, so we cannot even trust the blocker."
      : state.view === "fixed"
        ? "Here quality passes while health stays blocked. Fixing the evidence did not fix the program; it made the blocker visible and trustworthy."
        : "Here the evidence is facts-only and needs review because no health assessment was supplied. Facts alone do not establish program health.";
}

// Pure freshness computation shared by the browser and the test suite. Each
// source gets observation age, content age, and snapshot gap. A missing
// source_updated_at yields null values, never NaN.
export function freshnessRows(review) {
  const obsMax = review.policy.max_observation_age_days;
  const contentMax = review.policy.max_source_content_age_days;
  return review.sources.map((source) => {
    const obsAgeDays = daysBetween(source.observed_at, review.as_of);
    const contentAgeDays = source.source_updated_at
      ? daysBetween(source.source_updated_at, review.as_of)
      : null;
    return {
      id: source.id,
      type: source.type,
      obsAgeDays,
      obsMax,
      obsStale: obsAgeDays !== null && obsAgeDays > obsMax,
      obsMissing: obsAgeDays === null,
      contentAgeDays,
      contentMax,
      contentStale: contentAgeDays !== null && contentAgeDays > contentMax,
      contentMissing: contentAgeDays === null,
      snapshotGapDays: source.source_updated_at ? daysBetween(source.observed_at, source.source_updated_at) : null,
      snapshotGapMissing: !source.source_updated_at
    };
  });
}

function renderFreshness() {
  const review = reviewForView();
  const panel = $("freshness-panel");
  panel.replaceChildren();

  const renderRow = (label, ageDays, maxDays, stale, missing) => {
    const bar = el("div", "freshness-bar");
    if (!missing) {
      const fill = el("div", `freshness-fill${stale ? " stale" : ""}`);
      // Exact engine decision: stale iff age exceeds the policy, no rounding.
      fill.style.width = `${Math.min(100, (ageDays / Math.max(maxDays, 1)) * 100)}%`;
      bar.append(fill);
    }
    const meta = el("div", "freshness-meta");
    const name = el("span");
    name.textContent = label;
    const detail = el("span");
    detail.textContent = missing
      ? "no source update recorded — cannot calculate this dimension"
      : maxDays === null
        ? `gap ${ageDays.toFixed(1)}d — source update after observation`
        : `age ${ageDays.toFixed(1)}d${stale ? ` — STALE (> ${maxDays}d policy)` : ` — within ${maxDays}d policy`}`;
    meta.append(name, detail);
    const row = el("div", "freshness-row");
    row.append(meta, bar);
    panel.append(row);
  };

  for (const entry of freshnessRows(review)) {
    renderRow(
      `${entry.id} (${entry.type}) — observation`,
      entry.obsAgeDays,
      entry.obsMax,
      entry.obsStale,
      entry.obsMissing
    );
    renderRow(
      `${entry.id} (${entry.type}) — content`,
      entry.contentAgeDays,
      entry.contentMax,
      entry.contentStale,
      entry.contentMissing
    );
    renderRow(`${entry.id} (${entry.type}) — snapshot gap`, entry.snapshotGapDays, null, false, entry.snapshotGapMissing);
  }

  if (review.sources.length === 0) {
    panel.append(el("p", null, "No sources survived normalization — see evidence issues."));
  }
}

function renderCategories() {
  const review = reviewForView();
  const panel = $("categories-panel");
  panel.replaceChildren();

  const kinds = [
    ["facts", review.summary.facts],
    ["blockers", review.summary.blockers],
    ["risks", review.summary.risks],
    ["unknowns", review.summary.unknowns],
    ["conflicts", review.summary.conflicts]
  ];
  const max = Math.max(1, ...kinds.map(([, count]) => count));

  for (const [kind, count] of kinds) {
    const row = el("div", "kind-row");
    const label = el("span", "kind-label", kind);
    const track = el("div", "kind-track");
    const fill = el("div", "kind-fill");
    fill.style.width = `${(count / max) * 100}%`;
    track.append(fill);
    row.append(label, track, el("span", "kind-count", String(count)));
    panel.append(row);
  }
}

function renderHealthDimensions() {
  const review = reviewForView();
  const panel = $("health-panel");
  panel.replaceChildren();
  for (const [label, value] of [
    ["Reported", review.reported_program_health],
    ["Claim floor", review.claim_health_floor],
    ["Final", review.program_health],
    ["Consistency", review.health_consistency]
  ]) panel.append(el("p", null, `${label}: ${value ?? "missing"}`));
}

function renderConflicts() {
  const review = reviewForView();
  const list = $("conflicts-panel");
  list.replaceChildren();

  if (review.findings.conflicts.length === 0) {
    list.append(el("li", null, "None."));
    return;
  }
  for (const conflict of review.findings.conflicts) {
    const values = conflict.values.map((entry) => JSON.stringify(entry.value)).join(" vs ");
    list.append(el("li", null, `${conflict.subject}: ${values}. ${conflict.action}`));
  }
}

function renderActions() {
  const review = reviewForView();
  const list = $("actions-panel");
  list.replaceChildren();

  if (review.recommended_actions.length === 0) {
    list.append(el("li", null, "No follow-up required."));
    return;
  }
  for (const action of review.recommended_actions) {
    list.append(el("li", null, `${action.priority} — ${action.action}`));
  }
}

function renderFindings() {
  const review = reviewForView();
  const list = $("findings-panel");
  list.replaceChildren();
  const findings = [
    ...review.findings.issues.map((item) => `${item.severity}: ${item.type} — ${item.message}`),
    ...review.findings.deprecations.map((item) => `deprecated: ${item.type} — ${item.message}`)
  ];
  if (findings.length === 0) {
    list.append(el("li", null, "None."));
    return;
  }
  for (const finding of findings) list.append(el("li", null, finding));
}

function renderDrift() {
  const { drift, baseline, current } = TRUTH_DEMO;
  const summary = $("drift-summary");
  summary.replaceChildren(
    badge(`added ${drift.summary.added}`),
    badge(`removed ${drift.summary.removed}`),
    badge(`changed ${drift.summary.changed}`),
    badge(`unchanged ${drift.summary.unchanged}`)
  );

  const renderPlan = (container, plan) => {
    const list = $(container);
    list.replaceChildren();
    for (const item of plan.timeline) {
      const li = el("li", "drift-item");
      const title = el("span", null, item.title);
      const meta = el("span", "date", `${item.date}${item.status ? ` · ${item.status}` : ""}`);
      li.append(title, meta);
      list.append(li);
    }
  };
  renderPlan("drift-baseline", baseline);
  renderPlan("drift-current", current);

  const changes = $("drift-changes");
  changes.replaceChildren();
  if (drift.changed.length === 0 && drift.added.length === 0 && drift.removed.length === 0) {
    changes.append(el("li", null, "The current plan matches the baseline exactly."));
    return;
  }
  for (const entry of drift.added) {
    changes.append(el("li", "drift-change", `added: ${entry.item.title} (${entry.item.date})`));
  }
  for (const entry of drift.removed) {
    changes.append(el("li", "drift-change", `removed: ${entry.item.title} (${entry.item.date})`));
  }
  for (const entry of drift.changed) {
    const li = el("li", "drift-change");
    const parts = entry.changes.map(
      (field) => `${field} ${entry.from[field]} → ${entry.to[field]}`
    );
    const text = `${entry.title}: `;
    li.append(document.createTextNode(text));
    const from = el("span", "from", parts.join("; "));
    li.append(from);
    changes.append(li);
  }
}

function renderSibling() {
  const sibling = TRUTH_DEMO.sibling;
  const reviews = $("sibling-reviews");
  if (!sibling) {
    reviews.replaceChildren(el("p", null, "Sibling components are not available in this build."));
    return;
  }

  const programReview = sibling.program.review;
  reviews.replaceChildren(
    badge(`capture ${sibling.capture.summary.source_count} sources`),
    badge(`timeline ${sibling.timeline.items.length} items`),
    badge(`quality: ${programReview.artifact_quality}`),
    badge(`health: ${programReview.program_health}`)
  );

  const captureList = $("sibling-capture");
  captureList.replaceChildren();
  for (const source of sibling.capture.sources) {
    const included = source.raw_included ? "yes (held in system of record)" : "no";
    captureList.append(el("li", null, `${source.id} (${source.type}) observed ${source.observed_at.slice(0, 10)} · raw included: ${included}`));
  }
  const diff = sibling.diff;
  const timelineList = $("sibling-timeline");
  timelineList.replaceChildren(
    el("li", null, `baseline ${diff.baseline.item_count} items · current ${diff.current.item_count} items`),
    el("li", null, `matched ${diff.summary.matched} · added ${diff.summary.added} · removed ${diff.summary.removed}`),
    el("li", null, `changed ${diff.summary.changed} · unchanged ${diff.summary.unchanged} · new issues ${diff.summary.new_issues}`)
  );

  const programList = $("sibling-program");
  programList.replaceChildren();
  for (const claim of programReview.findings.facts) {
    programList.append(el("li", "sibling-claim", `${claim.kind}: ${claim.text}`));
  }
  for (const claim of programReview.findings.blockers) {
    programList.append(el("li", "sibling-claim", `${claim.kind}: ${claim.text} (${claim.owner})`));
  }
  for (const claim of programReview.findings.risks) {
    programList.append(el("li", "sibling-claim", `risk: ${claim.text} (${claim.owner})`));
  }
  for (const claim of programReview.findings.unknowns) {
    programList.append(el("li", "sibling-claim", `unknown: ${claim.text}`));
  }

  const programSources = $("sibling-program-sources");
  programSources.replaceChildren();
  for (const source of sibling.program.artifact.sources) {
    programSources.append(el("li", null, `${source.id} (${source.type}) · ${source.locator ?? "no locator"}`));
  }
}

function bindToggle() {
  const buttons = {
    broken: $("view-broken"),
    fixed: $("view-fixed"),
    "facts-only": $("view-facts-only")
  };
  for (const [view, button] of Object.entries(buttons)) {
    button.addEventListener("click", () => {
      state.view = view;
      for (const other of Object.values(buttons)) other.setAttribute("aria-pressed", String(false));
      button.setAttribute("aria-pressed", String(true));
      renderVerdict();
      renderFreshness();
      renderCategories();
      renderHealthDimensions();
      renderConflicts();
      renderActions();
      renderFindings();
    });
  }
}

function init() {
  $("demo-version").textContent = TRUTH_DEMO.version;
  renderVerdict();
  renderFreshness();
  renderCategories();
  renderHealthDimensions();
  renderConflicts();
  renderActions();
  renderFindings();
  renderDrift();
  renderSibling();
  bindToggle();
}

if (typeof document !== "undefined") init();
