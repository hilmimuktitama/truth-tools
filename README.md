# Truth Tools

`truth-tools` is the unified entrypoint for three truth packages:

- [`capture-truth`](https://github.com/hilmimuktitama/capture-truth) for evidence intake
- [`program-truth`](https://github.com/hilmimuktitama/program-truth) for program reconciliation
- [`timeline-truth`](https://github.com/hilmimuktitama/timeline-truth) for timeline compilation and validation

It keeps the existing packages focused and exposes one consistent CLI and MCP-oriented callable surface for benchmarking and TPM review workflows.

## Easy Way: Ask Your AI Agent

If your AI agent supports MCP, you can ask it to install and configure `truth-tools` from this repository.

Give your AI agent this prompt:

```text
Let's use truth-tools from https://github.com/hilmimuktitama/truth-tools.
Install or configure it for this AI agent, verify it with doctor, then use it to create evidence packs, timelines, and repo-safe summaries.
```

Instructions for the AI agent:

1. Confirm Node.js `>=22` is available.
2. Prefer the npm package MCP setup. Add this server to the user's MCP config:

```json
{
  "mcpServers": {
    "truth-tools": {
      "command": "npx",
      "args": ["-y", "--package=truth-tools", "truth-tools-mcp"]
    }
  }
}
```

3. Reload or restart the MCP client if needed so it discovers the server.
4. Verify the setup with the MCP tool `doctor.all`. If MCP verification is not available yet, use:

```bash
npx -y --package=truth-tools truth-tools doctor --all
```

5. Use the exposed tools to help the user:

- `capture.create`
- `capture.validate`
- `capture.render`
- `program.reconcile`
- `timeline.create`
- `timeline.validate`
- `timeline.render`
- `doctor.all`

## CLI Usage

```bash
truth-tools doctor --all

truth-tools capture create --input intake.json
truth-tools capture validate --input evidence-pack.json
truth-tools capture render --export-profile repo-safe-summary --input evidence-pack.json

truth-tools program reconcile --input program-input.json

truth-tools timeline create --input intake.json
truth-tools timeline validate --input timeline.json
truth-tools timeline render --format markdown --input timeline.json
```

## MCP Tools

The MCP server exposes dotted tool names:

- `capture.create`
- `capture.validate`
- `capture.render`
- `program.reconcile`
- `timeline.create`
- `timeline.validate`
- `timeline.render`
- `doctor.all`

Npm-style config:

```json
{
  "mcpServers": {
    "truth-tools": {
      "command": "npx",
      "args": ["-y", "--package=truth-tools", "truth-tools-mcp"]
    }
  }
}
```

### Advanced: Local Development MCP Config

Use this only when developing against a local checkout instead of the published npm package:

```json
{
  "mcpServers": {
    "truth-tools": {
      "command": "node",
      "args": ["C:/path/to/truth-tools/src/mcp-server.js"]
    }
  }
}
```

## Doctor

`truth-tools doctor --all` checks:

- local install and runtime truth package availability
- shared conflict, timeline unknown, and program-status schemas
- repo-safe render path
- MCP tool-surface availability

## Conflict Schema

Conflicts are normalized as:

```json
{
  "claim": "Real-client rollout start date",
  "source_a": { "system": "local-note", "value": "2026-05-27" },
  "source_b": { "system": "jira", "value": "2026-06-02" },
  "conflict_type": "date_mismatch",
  "recommended_owner_action": "Assign an owner to reconcile the source disagreement and update the system of record."
}
```

## Timeline Unknowns

Timeline items carry explicit uncertainty:

```json
{
  "title": "Phase 2 rollout",
  "date_status": "tbc",
  "blocks_next_milestone": "unknown"
}
```

Supported `date_status` values:

- `exact`
- `range`
- `earliest`
- `tbc`
- `conflicting`

Supported `blocks_next_milestone` values:

- `true`
- `false`
- `unknown`

## Program Status Schema

`program.reconcile` returns:

- `confirmed_facts`
- `blockers`
- `risks`
- `unknowns`
- `conflicts`
- `assumptions`
- `recommended_write_back`

`recommended_write_back` separates what belongs in the repo, what belongs in `.tmp/`, and what needs source-system updates.

## Export Profiles

`repo-safe-summary` is the default safety posture for TPM repos. It omits raw source bodies and favors compact facts, gaps, conflicts, and owner actions.

`internal-evidence-pack` keeps structured evidence metadata but redacts raw `content` fields before rendering.

`raw-local-only` returns the full artifact and should stay local. Do not commit raw Jira, Confluence, customer, credential, or private operational data.

All render paths run a redaction check for common credential and sensitive-data markers.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```

## Update Checks

`truth-tools doctor --all` checks npm for newer versions of `truth-tools`, `capture-truth`, and `timeline-truth`.

Use `truth-tools doctor --all --no-update-check` for CI or offline runs.
