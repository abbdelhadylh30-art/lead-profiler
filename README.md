# lead-profiler-mcp

Installable MCP server that gives AI agents (Claude, Cursor, Cline, Z.ai agents, any MCP client) direct access to the [lead-profiler](https://leads.abdelhadygabriel.me) engine: it turns **real observations of a lead** into a psychologically-tuned, honesty-checked cold-outreach opener via a 7-book framework chain (Culture Map → DiSC → Status Anxiety → Laws of Human Nature → Reconciliation → Influence/Cialdini → SPIN/Rackham).

The agent version is **stricter than the web UI**: every generated opener passes through a code-level claim-verification gate — fabricated counts, locations, metrics, or invented names trigger automatic regeneration before anything is returned as final.

## Install

### Claude Desktop / Claude Code

Add to `claude_desktop_config.json` (Claude Desktop) or `.mcp.json` (Claude Code):

```json
{
  "mcpServers": {
    "lead-profiler": {
      "command": "npx",
      "args": ["-y", "github:abbdelhadylh30-art/lead-profiler#mcp"],
      "env": {
        "LEAD_PROFILER_API_KEY": "lpk_YOUR_KEY"
      }
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lead-profiler": {
      "command": "npx",
      "args": ["-y", "github:abbdelhadylh30-art/lead-profiler#mcp"],
      "env": {
        "LEAD_PROFILER_API_KEY": "lpk_YOUR_KEY"
      }
    }
  }
}
```

### Any MCP client (stdio)

```bash
npx github:abbdelhadylh30-art/lead-profiler#mcp
```

Run `lead-profiler-mcp --help` for flags (`--url`, `--api-key`, `--timeout-ms`).

## Configuration

| Env var | CLI flag | Default | Meaning |
|---|---|---|---|
| `LEAD_PROFILER_URL` | `--url` | `https://leads.abdelhadygabriel.me` | lead-profiler deployment base URL |
| `LEAD_PROFILER_API_KEY` | `--api-key` | — | Agent API key (required once the deployment enables the key gate) |
| `LEAD_PROFILER_TIMEOUT_MS` | `--timeout-ms` | `300000` | Per-request timeout |

API keys are issued by the deployment owner. Requests send `x-api-key` (also accepts `Authorization: Bearer`).

## Tools

| Tool | What it does |
|---|---|
| `lead_profiler_playbook` | **Read first.** Full agent guide: workflow, observation schema, honesty rules, output interpretation |
| `lead_profiler_read_portfolio` | Extract a sender's real services/track record from their portfolio URL → `user_services` draft |
| `lead_profiler_analyze_screenshots` | Vision-extract observation notes from profile screenshots (local paths, URLs, or data URLs; max 8) |
| `lead_profiler_audit_content` | Deeper content-strategy audit of prospect posts (max 12) with sales recommendation |
| `lead_profiler_full_profile` | **Main tool.** One-shot full chain run with claim gate + up to 2 auto-regenerations (30–90s) |
| `lead_profiler_step` | Run one step manually (for clients with short tool-call timeouts) |

## The honest workflow

1. Get the sender's real `user_services` (ask the human, or `read_portfolio` + human confirmation).
2. Research the lead with your own web tools; verify digital-presence facts (DNS-check "no website" claims).
3. Optionally analyze screenshots / audit content.
4. Build a literal `observation` — "not observed" is a valid value.
5. `lead_profiler_full_profile` → present the opener, warnings, factuality check, and claim verdict to the human.
6. If `claim_verification.passed` is false: **do not send** — report the rejected claims.

## Timeouts

The full profile takes 30–90s. Some clients default to shorter tool-call timeouts:
- Claude Code: `MCP_TIMEOUT=120000` (or `MCP_TOOL_TIMEOUT`) env when launching.
- Claude Desktop: raise `MCP_TIMEOUT` in the launch environment.
- Any client: fall back to `lead_profiler_step` (each call is 5–15s).

## Development

```bash
cd packages/lead-profiler-mcp
bun install
bun run build
node scripts/smoke-test.mjs                                    # offline tests
node scripts/smoke-test.mjs --full scripts/fixtures/krishna-observation.json   # live chain run
```

## License

MIT
