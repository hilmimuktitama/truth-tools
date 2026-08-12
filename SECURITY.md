# Security Policy

## Supported versions

Only the current release line is supported. The supported version is **0.3.1**.

## Reporting a vulnerability

Report vulnerabilities privately, not as public issues:

- Use GitHub private vulnerability reporting on this repository if enabled, or
- Open a draft security advisory, or
- Email the maintainer (see the repository profile) with the subject
  `[truth-tools security]`.

Include the version, the surface (CLI, MCP, contracts, demo, evaluation),
steps to reproduce, and — if the report includes an artifact — a minimized
input without real credentials or source bodies.

## Scope and trust boundary

Truth Tools is a deterministic validator of a **supplied** status artifact. It
does not fetch URLs, read source bodies, or prove semantic support. Reports
are handled under the trust boundary documented in `README.md` and
`docs/architecture.md`:

- **Raw source bodies are rejected by design.** Sources carry metadata only.
  Do not paste Jira, Confluence, meeting-note, or customer content into
  artifacts, issues, or reports.
- **Claim text is exported verbatim.** Never place credentials or
  confidential source bodies in `text` fields; the report reprints them.
- **Markdown output is for humans.** The JSON review is the machine-consumable
  form; the demo renders all dynamic text with `textContent`, never HTML.

## Security-sensitive areas

- `packages/contracts/schemas/` — canonical contracts; changes affect every
  consumer and must pass `npm run contracts:verify`.
- `src/report.js` — Markdown escaping and the verbatim text boundary.
- `scripts/demo-dev.js` — the local static server binds to 127.0.0.1 and serves
  only the demo directory.
- `src/normalize.js` / `src/review.js` — input handling, strict fields, and
  date parsing; malformed input must fail deterministically, never hang.

## Reporting process

1. Maintainer triages within 7 days.
2. A fix is prepared on a private branch with a regression test.
3. A security release or advisory is published; details of the vulnerability
   are disclosed only after a fixed version is available.

## No telemetry

Truth Tools sends no network traffic, telemetry, or analytics from the CLI,
MCP server, or browser demo.
