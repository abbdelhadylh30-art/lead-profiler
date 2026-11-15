# Lead Profiler

5-minute observation in. Pitch-ready Arabic opener out.

A research-compression tool for cold WhatsApp outreach in Gulf markets.
Next.js 16 + TypeScript. Runs on the Z.ai sandbox (z-ai-web-dev-sdk) or any
OpenAI-compatible API elsewhere (Vercel, self-hosted, etc.).

## How it works — the multi-book pipeline

The tool studies a researched lead through a chain of established frameworks,
each operationalized as its own prompt step. Every step emits strict JSON that
feeds the next step, so a bad opener can be traced back to the exact lens that
broke.

| Step | Framework / source book | What it decides |
|---|---|---|
| 1. Culture Map | Gulf-market cultural grammar | How every downstream signal is read; opener constraints |
| 2. DiSC | *The 8 Dimensions of Leadership* | Behavior classification + confidence + evidence |
| 3a. Status Anxiety | *Status Anxiety* (Alain de Botton) | Comparison group, hierarchy position, drive, pain point |
| 3b. Laws | *The Laws of Human Nature* (Robert Greene) | Dominant law, shadow, defensive pattern |
| 3r. Reconciliation | — | Reconciles 3a + 3b when they disagree (Law = deeper truth) |
| 4. Influence | *Influence* (Cialdini) | Primary/secondary persuasion lever + trigger |
| 5. SPIN | *SPIN Selling* (Rackham) | The opener itself: 5-part structure, 60–120 words |

Input: a `LeadObservation` — name, profession, apparent sub-culture,
digital-presence audit, and six observation-note categories from a 5-minute
scroll of the lead's social media. Output: a WhatsApp opener plus an
alternative, plus honest warnings. The confidence cascade means the opener's
confidence is the lowest of all upstream steps, not the average.

`USER_SERVICES` (what you actually sell) is injected at steps 4 and 5 as the
only permitted source of social proof — the chain is not allowed to invent
track records. A user-corrected Arabic glossary (stored in the browser) is
passed to step 5 as authoritative translations.

## Environment variables (production)

The LLM layer tries `z-ai-web-dev-sdk` first (Z.ai sandbox). Anywhere else it
falls back to an OpenAI-compatible endpoint:

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes, outside the sandbox | Your provider's API key |
| `OPENAI_BASE_URL` | no | Defaults to `https://api.openai.com/v1` — set this to your provider's base URL |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` — must support JSON-heavy chat; vision-capable for the image routes |
| `AGENT_API_KEY` | no | When set, the API routes require `x-api-key` (agents/MCP) or a same-origin browser request (the web UI keeps working). Unset = open API |

Prompt files live in `download/prompts/` and ship inside the serverless bundle
via `outputFileTracingIncludes` in `next.config.ts`. Do not remove that entry,
and do not re-add `download` to `.vercelignore` — either one kills the pipeline
in production with `ENOENT`.

Note: on the Vercel Hobby plan, function `maxDuration` is capped at 60s
(routes declare up to 300s). Single steps are well under this; long
vision calls with many images may not be.

## API surface

| Route | Purpose |
|---|---|
| `POST /api/profile-lead` | Runs one pipeline step — body: `step`, `observation`, prior step outputs, `userServices`, `arabicGlossary`, optional `step5_feedback` (regeneration directive when the claim verifier rejected a previous opener) |
| `POST /api/analyze-lead-images` | VLM extraction of observation notes from profile screenshots (max 8) |
| `POST /api/prospect-content-audit` | VLM content audit of a prospect's posts (max 12) |
| `POST /api/read-portfolio` | Fetches a URL and extracts an honest `user_services` object |

The UI chains the steps client-side, so each step's output is inspectable
before the next one runs.

When `AGENT_API_KEY` is set, all four routes require an agent key
(`x-api-key: <key>` or `Authorization: Bearer <key>`). Browser requests from
the site itself keep working (same-origin `Sec-Fetch-Site` bypass) — see
`src/lib/agent-auth.ts`.

## Installable MCP server for AI agents

`packages/lead-profiler-mcp` is a standalone npm package that exposes the whole
engine to AI agents over the [Model Context Protocol](https://modelcontextprotocol.io):

```json
{
  "mcpServers": {
    "lead-profiler": {
      "command": "npx",
      "args": ["-y", "github:abbdelhadylh30-art/lead-profiler#mcp"],
      "env": { "LEAD_PROFILER_API_KEY": "lpk_..." }
    }
  }
}
```

Six tools: `lead_profiler_playbook` (agent-facing guide), `read_portfolio`,
`analyze_screenshots` (local paths / URLs / data-URLs), `audit_content`,
`step` (manual, with client-side dependency validation), and `full_profile`
(one-shot chain with progress notifications).

The agent path is **stricter than the web UI**: after step 5 the opener runs
through the code-level claim verifier (`verifyOpener` in
`src/lib/claim-verifier.ts`, mirrored in the package) — fabricated counts,
locations, metrics, or invented salutation names trigger automatic
regeneration via `step5_feedback` (up to 2 retries), and a still-failing
opener is returned marked `do_not_send`.

See `packages/lead-profiler-mcp/README.md` for full install instructions
(Claude Desktop / Cursor / any stdio MCP client) and timeouts.

## Run locally

```bash
bun install
bun run dev        # http://localhost:3000
```

On the Z.ai sandbox the LLM layer works out of the box. Elsewhere, set the
`OPENAI_*` variables above.

## Deployment notes

- Vercel project: linked to this repo, auto-deploys `main`.
- Set the three `OPENAI_*` env vars in Project Settings → Environment
  Variables (Production + Preview) — secrets never belong in the repo.
- SQLite/Prisma is currently unused at runtime (persistence is browser-local);
  the `db/` seed machinery is inert but harmless.

## Known gaps (next up)

- The claim verifier is now wired as a hard gate on the **agent/MCP path**
  (client-side in the package, with regeneration feedback). The **web UI**
  still shows model self-reported factuality only — surfacing `verifyOpener`
  in the UI is the remaining half of this.
- All run state (observation, services, step outputs) is lost on refresh —
  only the Arabic glossary persists (localStorage). Server-side persistence
  needs a real database decision before Prisma is worth reviving.
- The agent key gate is a credit-protection measure, not hard security
  (see the comment in `src/lib/agent-auth.ts`). Rate limiting is still open.
