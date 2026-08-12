# Evaluation

Truth Tools ships a repeatable, synthetic evaluation harness. This document
explains what it measures, what it does not, and how to extend it.

## What it measures

`npm run eval` runs every case in `evaluation/cases.json` plus the seeded
synthetic suite (`npm run eval:synthetic`, also wired into CI), and reports:

- **pass rate** — cases whose `artifact_quality` and `program_health`
  expectations both matched and whose required issue/deprecation types were
  all found, **with no unexpected findings**;
- **artifact_quality accuracy** and **program_health accuracy** —
  dimension-level match rates;
- **issue precision / recall** — false positives are counted on every case,
  including clean cases: any finding the case did not declare is a false
  positive (a noisy engine cannot hide behind sparse expectations); recall
  counts expected findings the engine missed;
- **overall conformance** — all expected quality/health/findings match with no
  unexpected findings;
- **seeded defect detection** — only synthetic mutations classified as
  `defect` count toward defect recall. Valid health behavior (blocker, risk,
  unknown) and valid tolerance behavior (timeline drift) are reported as
  conformance cases, not defects. Defect recall is the fraction of defect
  mutations whose complete issue signature was found.

`expect.issues` and `expect.deprecations` in `cases.json` are complete
specifications: undeclared findings fail the case. The 30 hand-written cases
cover the full policy matrix: pass/needs_review/fail quality,
on_track/at_risk/blocked/unknown health, typed contradictions (`1` vs `"1"`),
stale/future sources, raw-body rejection, unknown refs, duplicates,
unsupported fields and values, incomplete contradiction keys, invalid URLs
and due dates, deprecation normalizers, and the rule that timeline drift is
reported but never judged.

## Repeatability

The synthetic generator uses a fixed seed, so `npm run eval -- --synthetic=200`
produces the same 200 cases and the same metrics on every machine. Each
synthetic case is the canonical base artifact plus exactly one documented
mutation, so the expected outcome is exact by construction. The evaluation
test suite asserts that two runs produce identical results.

## What it does not claim

The cases are constructed. Passing them proves the engine implements its
documented policy; it does not prove the tool catches real-world status-report
failures. That would require:

1. anonymized real status artifacts;
2. a documented labeling process with a second labeler;
3. measured missed findings and false positives against that labeled set.

Until that exists, READMEs and portfolio copy must not claim effectiveness,
time savings, or adoption.

## Extending

Add a case to `evaluation/cases.json` with an exact `expect`; the base
artifact in `cases.json` is deep-merged with the case `input` at the top
level (arrays replace). `expect.issues` and `expect.deprecations` must be
the **complete** list of findings the case produces — omit nothing, or the
case fails for unexpected findings. Add a mutation to `MUTATIONS` in
`scripts/eval.js` for synthetic coverage; give it the complete issue
signature too. Run `npm run eval` and `npm run eval:synthetic` plus the
evaluation tests.
