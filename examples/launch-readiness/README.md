# Launch readiness demo

The `examples/launch-readiness/` directory is the integrated showcase for Truth Tools: a launch-readiness status artifact built from Jira, a decision log, and meeting notes — reviewed twice, once with broken evidence and once with fixed evidence.

## The story

The checkout migration is scheduled to launch. The status artifact claims the launch date, the release freeze, and a blocker: the rollback decision has no accountable owner (PLAT-124 has no assignee).

- **Broken evidence** (`status-artifact-broken.json`) embeds a raw Jira body, omits `observed_at` on one source, keeps a stale decision-log snapshot, lets the Jira tracker and the decision log contradict each other about `launch.date`, and still carries the rollback blocker. The review result is **artifact_quality: fail, program_health: blocked** (`truth-review-broken.json` / `.md`).
- **Fixed evidence** (`evidence-pack.json`, mirrored by `status-artifact-fixed.json`) records only source metadata, adds `observed_at` and `source_updated_at` everywhere, reconciles the launch date, and keeps the blocker visible with an owner and a due date. The review result is **artifact_quality: pass, program_health: blocked** (`truth-review-fixed.json` / `.md`).

The point: artifact quality and program health are independent dimensions. Clean evidence does not make the program healthy; it makes the blocker trustworthy.

## Timeline drift

`baseline-plan.json` is the plan accepted on 2026-07-20. `current-plan.json` is the plan as of 2026-08-11. The launch moved from August 17 to August 20, the load test slipped a week, and a rollback-owner item was added. `timeline-drift.json` / `.md` is the deterministic diff: added, removed, changed, unchanged.

## Files

| File | Role |
| --- | --- |
| `jira-export.csv` | Source export used as evidence (metadata only travels with the artifact). |
| `decision-log.md` | Decision log entries cited as a source. |
| `meeting-notes.md` | Notes from the launch readiness review, including the blocker. |
| `baseline-plan.json` / `current-plan.json` | Baseline and current plan timelines. |
| `evidence-pack.json` | Fixed canonical StatusArtifact: sources, claims, timeline, baseline_timeline. |
| `status-artifact-broken.json` | Broken StatusArtifact: raw body, missing timestamp, contradiction. |
| `status-artifact-fixed.json` | Byte-identical copy of the evidence pack; the demo verifies they never drift. |
| `truth-review-broken.json` / `.md` | Engine output for the broken artifact. |
| `truth-review-fixed.json` / `.md` | Engine output for the fixed artifact. |
| `timeline-drift.json` / `.md` | Engine timeline diff output. |
| `README.md` | This file. |

## Run it

```bash
npm run demo          # verify every generated file against the engine (read-only)
npm run demo:build    # rebuild apps/demo/dist from apps/demo sources
npm run demo:dev      # serve the static browser demo at http://127.0.0.1:4173/
node scripts/demo.js --write   # regenerate reports, timeline drift, and demo data
```

All files here are generated or verified by `scripts/demo.js`; if the engine or a fixture changes, `npm run demo` fails until `node scripts/demo.js --write` regenerates the checked-in outputs.
