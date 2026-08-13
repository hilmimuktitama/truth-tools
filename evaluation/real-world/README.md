# Private real-world evaluation

This harness is local-only and makes no real-world evaluation claim. Place
anonymized StatusArtifact JSON files in the ignored
`evaluation/real-world/input/` directory and separate labels in
`evaluation/real-world/labels/`. Two reviewers label independently; an
adjudicator resolves disagreements. The repository review engine is run for
every artifact. Complete finding-type sets are compared and issue
precision/recall (including zero-denominator handling), artifact-quality and
program-health agreement, and per-case/type FP/FN counts are reported.

Credentials, source bodies, and identifying URLs are rejected rather than
uploaded or silently redacted. Results are ignored by Git and never transmitted.
The bundled example is synthetic verification only.

Run `npm run eval:private:synthetic` for the bundled synthetic verification, or
use `node evaluation/real-world/run-private-evaluation.js --input-dir <dir>
--label-dir <dir> --output evaluation/private-results/report.json`. The output
defaults to the ignored `evaluation/private-results/private-evaluation.json`;
an explicit output outside that directory is rejected. No network or
transmission is performed. No external evaluation has been performed.
