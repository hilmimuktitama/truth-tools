# Evaluation

Truth Tools ships a repeatable, synthetic evaluation harness. It does **not** claim real-world effectiveness: the cases are constructed, and passing them proves the engine implements its documented policy — nothing more.

## Run

```bash
npm run eval                     # hand-written cases
npm run eval:synthetic           # + 200 seeded synthetic cases (runs in CI)
npm run eval -- --synthetic=200  # same as above
npm run eval -- --list           # print every case and its expectation
```

The synthetic generator uses a fixed seed (`0x74727574`), so the same
command always produces the same cases and the same metrics. CI runs both
`npm run eval` and `npm run eval:synthetic`, so the seeded cases are part of
the release gate.

## Cases

`cases.json` contains hand-written cases covering the full policy matrix:

- artifact quality: pass, needs_review (stale source, incomplete contradiction key, invalid URL, due date, source updated after `as_of`), fail (raw source bodies, unknown refs, missing timestamps, duplicates, unsupported fields and values, contradictions, no sources/claims);
- program health: on_track, at_risk (risk or unknown), blocked (blocker), unknown (no classified claims);
- compatibility: `captured_at`, `sourceId`, and plain-string refs must normalize and be flagged as deprecations without failing the review;
- typed contradictions: `1` and `"1"` must remain distinct;
- timeline drift: reported, never judged.

Each case declares `input` plus an exact `expect` of `artifact_quality`,
`program_health`, and the issue/deprecation types that must be present.
`expect.issues` and `expect.deprecations` are **complete specifications**:
any finding the engine produces that the case did not declare is an
unexpected finding and fails the case. A case passes only when every
expectation matches and nothing extra was reported.

## Metrics

- **pass rate**: cases whose expectations all matched, with no unexpected
  findings;
- **artifact_quality accuracy** and **program_health accuracy**: dimension-level match rates;
- **issue precision/recall**: false positives are counted on **every** case,
  including clean cases with an empty expected list — any undeclared finding
  is a false positive, so a noisy engine cannot hide behind sparse
  expectations. Recall counts expected findings the engine missed;
- **seeded defect detection** (synthetic runs): each seeded case injects one
  documented defect; detection recall is the fraction of defects whose
  complete issue signature was found, and unexpected-finding counts are
  reported separately as false positives. Repeatability is guaranteed by the
  fixed seed.

Metrics are printed for the combined hand-written plus synthetic set.

## Synthetic generation

`scripts/eval.js` includes a seeded generator (`--synthetic=N`). Every case is the canonical base artifact plus exactly one documented mutation (add blocker, make source stale, embed a raw body, and so on), so the expected outcome — quality, health, and the complete issue signature — is exact and deterministic. This exercises each policy repeatedly across repetitions without hand-writing hundreds of fixtures.

## Honest boundary

The harness measures the engine against its own specification. It cannot measure whether the review would catch real-world status-report failures; that requires anonymized production artifacts and a documented labeling process, which is a future proof described in `docs/evaluation.md`.
