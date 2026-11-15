import type { Config } from "../config.js";
import { STEP_ORDER, STEP_LABELS, STEP_DESCRIPTIONS, STEP_REQUIREMENTS } from "../types.js";

function buildPlaybook(): string {
  const stepsTable = STEP_ORDER.map((s) => {
    const req = STEP_REQUIREMENTS[s];
    const needs = [
      ...req.priors,
      req.observation ? "observation" : null,
      req.userServices ? "user_services" : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `| \`${s}\` | ${STEP_LABELS[s]} | ${STEP_DESCRIPTIONS[s]} | ${needs || "—"} |`;
  }).join("\n");

  return `# Lead Profiler — Agent Playbook

You now have access to a lead-profiling engine that turns a REAL observation of a
lead into a psychologically-tuned cold-outreach opener, using a 7-book framework
chain (Culture Map → DiSC → Status Anxiety → Laws of Human Nature → Reconciliation
→ Influence/Cialdini → SPIN/Rackham). It is built around a strict honesty
architecture — read the rules before your first run.

## The workflow (recommended order)

**Phase 0 — Get the sender's real services (\`user_services\`)**
- Best: ask the human user directly what they sell + real past work.
- Alternative: call \`lead_profiler_read_portfolio\` with their portfolio URL,
  then CONFIRM the extraction with the human before using it.
- \`past_work_examples\` must be REAL, concrete items. If none are verified,
  pass an EMPTY list — the chain will then forbid the Social Proof lever and
  fall back honestly to Authority/Liking. Never invent examples.

**Phase 1 — Research the lead (use your own web research tools)**
Find and verify:
- Their business/pages, what they actually do (profession).
- Digital presence: website? booking/payment link? Google reviews? CTA?
  Verify "no website" with DNS/candidate-domain checks before claiming it.
- Active ads (e.g. Facebook Ad Library), recent posts, engagement.
- Community/sub-culture signals, language(s) used.
- Competitors' presence — only if you can name a specific, verified one.
- Complaint patterns in comments — only if literally visible.

**Phase 2 (optional) — Screenshot analysis**
If the human provided screenshots of the lead's profile/posts:
- Profile/social screenshots → \`lead_profiler_analyze_screenshots\` (max 8)
- Content strategy audit → \`lead_profiler_audit_content\` (max 12)
Pass local file paths or https URLs — the tool inlines them.
Reconcile the extraction with your own observations; where they disagree,
prefer what you can re-verify, and note the disagreement in your observation.

**Phase 3 — Build the \`observation\`**
Fill every field honestly. "Not observed" is a VALID value — the chain handles
gaps. Never infer timelines ("saying 'soon' for 4 years") or feelings; only
literal, verifiable facts. Put competitor/complaint/intention signals in
\`additional_context\` — they are the strongest hook sources.

**Phase 4 — Run the chain**
- One-shot: \`lead_profiler_full_profile\` (runs all 7 steps, ~30-90s, includes
  an automatic claim-verification gate with up to 2 regenerations).
- Manual: \`lead_profiler_step\` one step at a time (useful with clients that
  time out tool calls under 60s). Respect the dependency table below — pass
  each prior step's output through UNCHANGED.

**Phase 5 — Present the result to the human**
Always show: the opener (and the A/B alternative), the warnings, the
factuality check, and the claim-verification verdict. Do NOT silently edit
the opener to sneak in claims — if something is wrong, fix the input or
re-run, and tell the human what you changed and why.

## Steps reference

| Step | Label | What it does | Requires |
|---|---|---|---|
${stepsTable}

Steps 3a and 3b run in parallel inside \`lead_profiler_full_profile\`.

## Honesty rules (non-negotiable)

1. **Never fabricate social proof.** Counts ("14 clinics"), locations
   ("in Riyadh"), and metrics ("22% more bookings") may ONLY appear if they
   literally exist in \`user_services\` or the observation.
2. **The claim gate is a hard gate.** After step 5 the opener is scanned
   programmatically; unverifiable claims trigger automatic regeneration. If
   it still fails after retries, the result is returned with
   \`claim_verification.passed = false\` — DO NOT present that opener as ready
   to send; report the rejected claims to the human instead.
3. **Empty \`past_work_examples\` = no Social Proof.** The lever selection
   (step 4) handles this automatically — do not work around it.
4. **Literal observations only.** If you did not see it, write "not observed".
5. **Verify "no website" claims** (candidate domains / DNS) before asserting them.

## Output interpretation

- \`opener.opener_draft\` — the final deliverable (WhatsApp-ready message).
- \`opener.alternative_opener\` — an A/B variant with a different hook/offer.
- \`opener.hook_type\` — which of the 5 hook archetypes fired
  (cost_of_absence / contradiction / customer_signal / competitor_contrast /
  vocabulary_mirror).
- \`opener.factuality_check.fabricated_claims\` — MUST be empty. Any entry is
  the model self-reporting a fabrication.
- \`claim_verification\` — the code-level gate's verdict (independent of the
  model's self-report). \`passed: true\` with warnings still means the
  human should eyeball any percentages before sending.
- \`opener.warnings\` — what could misfire with THIS lead. Surface these.
- \`opener.confidence\` — cascades from the lowest upstream step confidence;
  treat "low" as "verify with a human before sending".

## Arabic output

For Gulf/Arabic leads the opener comes out in Arabic with register matching
(step 1 decides MSA_warm vs dialect vs English). If the human has corrected
translations before, pass them as \`arabic_glossary\` — those corrections are
authoritative and override the model's own translations.

## Limits & practical notes

- Full profile: ~30-90s end-to-end (6 LLM calls, 3a/3b parallel).
- Per-step calls: ~5-15s each. Images: ~10-40s.
- If your MCP client kills long tool calls, use \`lead_profiler_step\` instead
  of the full profile.
- The API is the live lead-profiler deployment (\`LEAD_PROFILER_URL\`,
  default https://leads.abdelhadygabriel.me). It may require an API key
  (\`LEAD_PROFILER_API_KEY\`) — 401 means you need one or it's wrong.`;
}

export function registerPlaybookTool(server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer, _cfg: Config): void {
  server.registerTool(
    "lead_profiler_playbook",
    {
      title: "Lead Profiler Playbook",
      description:
        "Read this FIRST. Full agent guide for the lead-profiler engine: the research workflow, the observation schema (with honesty rules), the 7-step chain dependencies, and how to interpret openers, claim checks, warnings, and confidence. No arguments.",
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: "text", text: buildPlaybook() }],
      };
    },
  );
}
