# Release process

Truth Tools publishes one npm package: `truth-tools` (CLI + MCP + contracts
loader). The `packages/contracts` workspace is private and contains the
canonical schemas used by the root package; it is validated but never published.
Releases follow
ADR-0005: tagged, trusted publishing with provenance. The release workflow
is `.github/workflows/release.yml`.

## Versioning

- `0.3.0` is the version on this branch; the legacy npm `0.2.0` is untagged
  here and replaced by 0.3.0.
- The review contract carries its own `schema_version: "1.0.0"` inside
  `TruthReview`; it is independent of the npm version and only bumps when the
  canonical schemas change incompatibly.

## Before a release (maintainer)

1. Update `CHANGELOG.md` with the release entry and set the version.
2. Bump `version` in `package.json`; the private contracts workspace is not a
   separately released package.
3. Run the full gate locally:

   ```bash
   npm ci
   npm test
   npm run check
    npm run contracts:verify
    npm run demo
    npm run demo:build
    npm run eval
    npm run eval:synthetic
    node bin/truth-tools.js doctor
    npm pack --dry-run
    (cd packages/contracts && npm pack --dry-run)
    ```

   Run it with the converged sibling repositories available. CI checks out the
   default branches of `capture-truth`, `timeline-truth`, and `program-truth`
   under `components/` and requires them, so merge compatible component changes
   before releasing Truth Tools.

4. `npm pack --dry-run` output is the **package allowlist** check: the tarball
   must contain only `bin/`, `src/`, `packages/`, `scripts/`, `examples/`,
   `docs/`, `apps/`, `evaluation/`, `README.md`, `LICENSE`, `CHANGELOG.md` —
   and no capture/timeline binaries, secrets, or node_modules.
5. Merge the release commit to `main`, wait for CI to pass, and create the
   exact tag `v<package-version>` on that main commit. Tags must match
   `^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$`. Create the GitHub Release from
   that tag; publishing the release starts the `release.published` workflow.

## The release workflow

`.github/workflows/release.yml` runs when a GitHub Release is published and:

1. resolves the exact release tag (or the required manual-dispatch tag), checks
   out that tag with full history, verifies the tag resolves to `HEAD`, and
   verifies the tag without `v` matches the package version dynamically;
2. checks out the default branches of all three public sibling repositories
   under `${{ github.workspace }}/components/`, then installs with `npm ci`;
3. runs `npm test`, `npm run check`, `npm run contracts:verify`, `npm run demo`,
   `npm run demo:build`, `npm run eval`, `npm run eval:synthetic`, and
    `node bin/truth-tools.js doctor`;
4. runs `npm pack --dry-run` for the root package and the private contracts
   workspace;
5. publishes `truth-tools` with `npm publish --provenance --access public`.
   The private contracts workspace is never published separately.

The trusted sequence is: merge to `main` → wait for CI → tag the exact main
commit → create the GitHub Release → let the `release.published` workflow run →
verify npm provenance and the published package.

### Setting up trusted publishing (one-time)

1. In npm, create the publisher account/team used by CI.
2. In GitHub, create an environment (or use the default) and add the npm
   publisher account to it; GitHub Actions OIDC then exchanges an identity
   token with npm — **no registry token is stored in the repository**.
3. Give the environment `contents: read` and `id-token: write` permissions
   (already declared in the workflow).
4. After the exact `v<package-version>` release publishes, verify the provenance
   attestation with `npm view truth-tools dist.attestations` or the provenance
   badge on the published version.

## Pages

`.github/workflows/pages.yml` builds `apps/demo/dist` and deploys it to
GitHub Pages on pushes to `main` and `v*` tags. It is defined but not
executed on this branch; enabling it requires the repository setting
"Pages → Source: GitHub Actions" (see `docs/github-settings.md`). The
workflow verifies `npm run demo` before uploading so stale fixtures can
never be deployed.

## Dry-run every time

`npm pack --dry-run` is cheap and catches allowlist drift, missing files, and
accidental inclusion of node_modules or logs. Run it before every tag.
