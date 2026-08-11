# Launch readiness decision log

## 2026-07-20 — Baseline plan accepted

Accepted the baseline launch plan: rollback drill by 2026-07-27, load test at 200% peak by 2026-08-03, release freeze 2026-08-10, launch 2026-08-17. Rollback owner still required before freeze.

## 2026-08-09 — Launch date set to 2026-08-20

The launch date moves from 2026-08-17 to 2026-08-20 because the load test at 200% peak needs a longer run. Release freeze stays 2026-08-10. The rollback runbook must name an accountable owner before 2026-08-14 or the launch is blocked.

## 2026-08-09 — Evidence convention

Source metadata is recorded with `observed_at` (when the evidence was read or snapshotted) and `source_updated_at` (last change reported by the source system). Source bodies stay in their systems of record; only metadata travels with the status artifact.
