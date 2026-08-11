# Contributing to Truth Tools

Thanks for considering a contribution. The project is deliberately small; a
good contribution fixes one of the documented boundaries, not a new generic
feature. Read `docs/architecture.md` and the ADRs before proposing design
changes.

## Ground rules

- **Deterministic first.** The same input must always produce the same review.
  No timezone-free dates, no locale parsing, no randomness in the engine.
- **Quality and health stay separate.** `artifact_quality` describes the
  evidence structure; `program_health` describes the program. Do not merge
  them, and do not make exit codes depend on health without an explicit gate.
- **No raw source bodies.** Sources are metadata only. Never add a `content`
  field to the contract.
- **No telemetry.** The CLI, MCP server, and demo make no network requests.
- **No claims of proof.** Docs may say what the tool checks; they may not
  claim it proves facts or prevents real-world failures.

## Development setup

Requires Node.js 22+.

```bash
npm ci
npm test              # engine, CLI, MCP, contracts, drift, demo, evaluation
npm run check         # syntax-check every JS file
npm run contracts:verify
npm run demo          # verify generated outputs against the engine
npm run eval
npm pack --dry-run    # inspect the package allowlist contents
```

## What needs a test

- Any change to `src/review.js` or `src/normalize.js` needs engine tests plus
  an evaluation case in `evaluation/cases.json` if the policy changed.
- Any change to `packages/contracts/schemas/` needs `npm run
  contracts:verify` to pass and a conformance test in `test/contracts.test.js`.
- Any change to the demo fixtures or renderer needs `node scripts/demo.js
  --write` to regenerate the checked-in outputs, then `npm run demo` to pass.
- Any change to `src/cli.js` exit-code behavior needs exact `exitCodeFor`
  unit tests: quality gates (`--fail-on fail|needs_review`) and health gates
  (`--fail-on-health blocked|at_risk`) are independent.

## Pull request flow

1. Open an issue first for behavior changes; keep the issue focused.
2. Make the change on a branch, with tests and documentation updated in the
   same PR.
3. Run the full verification list above locally.
4. Open a PR against the template; the maintainer (see CODEOWNERS) reviews
   every change.

## Versioning and releases

Version bumps, changelog entries, and the release workflow are described in
`docs/release-process.md` and `CHANGELOG.md`. Releases are cut by the
maintainer via tagged, trusted-publishing workflow; contributors never publish.
