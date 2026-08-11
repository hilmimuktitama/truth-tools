# GitHub settings

These are the repository settings and GitHub features the project relies on.
Settings are a repository owner action; this document is the checklist, and
the files it references are already in `.github/`.

## Branch protection

Protect the default branch (`main`):

- **Require pull request reviews**: 1 review, with `dismiss stale pull
  request approvals` on.
- **Require status checks to pass**: the `test` job of `.github/workflows/
  ci.yml` (runs `npm ci`, `npm test`, `npm run check`, `npm run
  contracts:verify`, `npm run demo`, `npm run demo:build`, `npm run eval`,
  gate checks on the broken/fixed fixtures, and `npm pack --dry-run`).
- CI, Pages, and release workflows check out the default branches of
  `hilmmkttm/capture-truth`, `hilmmkttm/timeline-truth`, and
  `hilmmkttm/program-truth` under `components/` and set required sibling mode.
  Merge compatible component changes before merging or tagging Truth Tools.
- **Require branches to be up to date** before merging.
- **Do not allow bypassing** for the settings above, except repository admins
  at your discretion.
- Optionally: require signed commits for supply-chain hygiene.

## Pages

- Settings → Pages → **Source: GitHub Actions**. This activates
  `.github/workflows/pages.yml`, which deploys `apps/demo/dist`.
- The workflow triggers only on `main` pushes and `v*` tags, so feature
  branches never deploy.

## Environments and release

- Create a GitHub **environment** for the release workflow (or use the
  default environment) and link it to the npm publisher account configured
  for trusted publishing (see `docs/release-process.md` and ADR-0005).
- No repository secrets are required by `release.yml`; do not add an
  `NPM_TOKEN` secret — the workflow uses OIDC provenance only.

## Repository defaults

- **Default branch**: `main`.
- **Issues**: the bug template at `.github/ISSUE_TEMPLATE/bug.yml` is the
  only required template; blank issues remain enabled via `config.yml`.
- **Pull requests**: template at `.github/pull_request_template.md`; it
  requires the verification checklist to be completed.
- **Code owners**: `.github/CODEOWNERS` requires the maintainer on every
  change and on every change under `packages/contracts/`.
- **Security**: enable private vulnerability reporting; the policy is in
  `SECURITY.md`.
- **Community files**: `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`,
  `SECURITY.md` are referenced from the README.

## Workflows included but not executed here

`pages.yml` and `release.yml` are part of the repository and documented, but
neither runs on this branch: `pages.yml` only fires on `main`/`v*`, and
`release.yml` only on `v*` tags. No deployment or publication is executed
from this branch work.

## Deleting

The legacy npm `0.2.0` release is untagged here. If it exists in the npm
registry, it is replaced by publishing `0.3.0`; retiring `0.2.0` from the
registry is an npm-side decision, not a repository setting.
