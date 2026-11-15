import { runStep } from "@/lib/lead-profiler";
import { STEP_ORDER, type StepName } from "@/lib/lead-profiler-types";
import { verifyOpener, type ClaimCheckResult } from "@/lib/claim-verifier";
import {
  analyzeLeadImages,
  auditProspectContent,
  readPortfolioServices,
  ServiceError,
} from "@/lib/services";

/**
 * Tool catalog + dispatcher for the remote MCP endpoint (/api/mcp).
 * Mirrors the 6 tools of the packages/lead-profiler-mcp stdio server, but runs
 * the engine directly in-process (runStep / verifyOpener / services) instead
 * of calling the REST API. Stateless Streamable HTTP — this is what remote MCP
 * clients (Grok connectors, etc.) speak.
 */

// ---------------------------------------------------------------------------
// JSON Schemas (translated 1:1 from packages/lead-profiler-mcp/src/tools/schemas.ts)
// ---------------------------------------------------------------------------

const observationSchema = {
  type: "object" as const,
  description:
    "Structured observation of the lead — the raw material the entire 7-step chain is built on. Only include what was literally observed or independently verified.",
  required: ["lead_name", "profession", "apparent_subculture", "westernization_signals", "digital_presence_audit", "observation_notes"],
  properties: {
    lead_name: { type: "string", description: "Name of the lead / their business as publicly known, e.g. 'Krishna's Kitchen'" },
    profession: { type: "string", description: "What they do, concretely — e.g. 'home-based catering & tiffin meal service owner'" },
    apparent_subculture: {
      type: "string",
      description: "The sub-culture/community the lead visibly belongs to — e.g. 'Gujarati immigrant small-business community, Etobicoke GTA' or 'Gulf Arab women-owned beauty sector, Jeddah'",
    },
    westernization_signals: {
      type: "string",
      description: "How westernized they appear in language and branding — e.g. 'English-first captions, Western SaaS aesthetic' or 'Arabic-first, Gulf dialect, no Latin script'",
    },
    digital_presence_audit: {
      type: "object",
      description: "Factual inventory of the lead's digital presence. Every entry must be verified — this drives cost-of-absence hooks",
      required: ["has_website", "has_booking_or_payment_link", "has_google_reviews", "primary_call_to_action"],
      properties: {
        has_website: { type: "string", enum: ["yes", "no", "weak"], description: "'no' only if verified (e.g. no domain resolves); 'weak' = parked/placeholder/outdated" },
        website_notes: { type: "string", description: "Evidence for the website verdict — e.g. 'all 5 candidate domains NXDOMAIN'" },
        has_booking_or_payment_link: { type: "string", enum: ["yes", "no"], description: "Any visible booking/payment/ordering link in bio or ads" },
        booking_notes: { type: "string", description: "How orders actually happen — e.g. 'WhatsApp DM only'" },
        has_google_reviews: { type: "string", enum: ["yes", "no"], description: "Google Business profile with reviews found?" },
        google_reviews_notes: { type: "string", description: "Evidence or 'no profile found'" },
        primary_call_to_action: { type: "string", enum: ["dm", "call", "link", "none", "other"], description: "The lead's dominant CTA across ads/profile" },
        competitor_digital_presence: { type: "string", description: "A SPECIFIC competitor's stronger presence — only if verified. Never invent competitors" },
        customer_complaint_pattern: { type: "string", description: "Recurring complaint pattern visible in comments — only if literally observed" },
      },
    },
    observation_notes: {
      type: "object",
      description: "Six qualitative observation categories. 2-3 honest sentences each — 'not observed' is a valid, honest value",
      required: ["pace", "people_orientation", "content_shape", "engagement", "self_presentation", "pressure_tells"],
      properties: {
        pace: { type: "string", description: "Posting frequency, reply speed, Story cadence — 2-3 sentences, or 'not observed'" },
        people_orientation: { type: "string", description: "Tone of captions and replies — warmth, formality, emoji use, personal address forms" },
        content_shape: { type: "string", description: "Types of posts, production quality, content mix" },
        engagement: { type: "string", description: "Comment volume, reply behavior, visible complaints — or 'not observed'" },
        self_presentation: { type: "string", description: "Face visible? professional vs casual? brand vs personality?" },
        pressure_tells: { type: "string", description: "Visible stress signals, rants, inconsistencies — or 'not visible'" },
      },
    },
    additional_context: {
      type: "string",
      description: "The strongest activation signals: competitor mentions, stated-but-unfulfilled intentions, customer complaint patterns. LITERAL facts only — never infer timelines or intentions",
    },
  },
};

const userServicesSchema = {
  type: "object" as const,
  description:
    "The SENDER's (user's) real services and track record. This is the ONLY source of social proof the opener may ever cite — never pad it",
  required: ["primary", "past_work_examples", "track_record", "service_depth"],
  properties: {
    primary: { type: "string", description: "What the sender actually sells — one specific sentence" },
    secondary: { type: "string", description: "Secondary service line, if any" },
    past_work_examples: {
      type: "array",
      items: { type: "string" },
      description:
        "REAL past work, each item concrete and verifiable ('Booking dashboard for a Riyadh dental clinic'). EMPTY LIST unless real examples exist — when empty, the Social Proof lever is forbidden and the chain will honestly fall back to Authority/Liking",
    },
    track_record: { type: "string", description: "Real track record — years in market, client count, outcomes. If unknown: 'Track record not specified — fill in manually'" },
    service_depth: { type: "string", description: "What makes the sender's work different from a generic agency" },
  },
};

const arabicGlossarySchema = {
  type: "array",
  maxItems: 50,
  description: "User-corrected Arabic glossary. Pass whenever the human has corrected translations in the past",
  items: {
    type: "object",
    required: ["original", "corrected"],
    properties: {
      original: { type: "string", description: "The English term or bad Arabic phrase previously generated" },
      corrected: { type: "string", description: "The Arabic translation the user wants used instead — authoritative" },
      note: { type: "string", description: "When this correction applies" },
      created_at: { type: "number", description: "Creation timestamp (ms)" },
    },
  },
};

const priorOutputSchema = { type: "object", description: "The parsed JSON output object of a prior step (pass it through unchanged)" };

// ---------------------------------------------------------------------------
// Playbook (adapted from packages/lead-profiler-mcp — tool names kept identical)
// ---------------------------------------------------------------------------

const STEP_TABLE = [
  ["step1_culture_map", "Culture Map", "Cultural grammar tuner — conditions how every signal downstream is read", "observation"],
  ["step2_disc", "DiSC Classifier", "Behavior classifier using 8 Dimensions of Leadership", "observation, step1"],
  ["step3a_status_anxiety", "Status Anxiety", "Social-frame layer — hierarchy position, drive, pain point", "observation, step1, step2"],
  ["step3b_laws", "Laws of Human Nature", "Individual shadow layer — what's driving them underneath", "observation, step1, step2"],
  ["step3_reconciliation", "Reconciliation", "Reconciles Status Anxiety + Laws when they disagree", "step2, step3a, step3b"],
  ["step4_influence", "Influence Lever", "Persuasion lever selector — Cialdini's 7 principles", "user_services, step1, step2, step3_reconciled"],
  ["step5_spin", "SPIN Opener", "Opener generator — 5-part structure, 60-120 words", "observation, user_services, step1, step2, step3_reconciled, step4"],
]
  .map(([s, l, d, n]) => `| \`${s}\` | ${l} | ${d} | ${n} |`)
  .join("\n");

function buildPlaybook(): string {
  return `# Lead Profiler — Agent Playbook

You now have access to a lead-profiling engine that turns a REAL observation of a
lead into a psychologically-tuned cold-outreach opener, using a 7-book framework
chain (Culture Map → DiSC → Status Anxiety → Laws of Human Nature → Reconciliation
→ Influence/Cialdini → SPIN/Rackham). It is built around a strict honesty
architecture — read the rules before your first run.

## The workflow (recommended order)

**Phase 0 — Get the sender's real services (user_services)**
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
Pass images as base64 data URLs (\`data:image/...;base64,...\`) with a short name.
Reconcile the extraction with your own observations; where they disagree,
prefer what you can re-verify, and note the disagreement in your observation.

**Phase 3 — Build the observation**
Fill every field honestly. "Not observed" is a VALID value — the chain handles
gaps. Never infer timelines ("saying 'soon' for 4 years") or feelings; only
literal, verifiable facts. Put competitor/complaint/intention signals in
\`additional_context\` — they are the strongest hook sources.

**Phase 4 — Run the chain**
- One-shot: \`lead_profiler_full_profile\` (runs all 7 steps, ~1-3 min, includes
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
${STEP_TABLE}

Steps 3a and 3b run in parallel inside \`lead_profiler_full_profile\`.

## Honesty rules (non-negotiable)

1. **Never fabricate social proof.** Counts ("14 clinics"), locations
   ("in Riyadh"), and metrics ("22% more bookings") may ONLY appear if they
   literally exist in user_services or the observation.
2. **The claim gate is a hard gate.** After step 5 the opener is scanned
   programmatically; unverifiable claims trigger automatic regeneration. If
   it still fails after retries, the result is returned with
   \`claim_verification.passed = false\` — DO NOT present that opener as ready
   to send; report the rejected claims to the human instead.
3. **Empty past_work_examples = no Social Proof.** The lever selection
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

- Full profile: ~1-3 min end-to-end (6 LLM calls, 3a/3b parallel).
- Per-step calls: ~5-15s each. Images: ~10-40s.
- If your client kills long tool calls (e.g. a 60s cap), use
  \`lead_profiler_step\` step-by-step instead of the full profile.`;
}

// ---------------------------------------------------------------------------
// Tool catalog
// ---------------------------------------------------------------------------

export interface McpToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "lead_profiler_playbook",
    title: "Lead Profiler Playbook",
    description:
      "Read this FIRST. Full agent guide for the lead-profiler engine: the research workflow, the observation schema (with honesty rules), the 7-step chain dependencies, and how to interpret openers, claim checks, warnings, and confidence. No arguments.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lead_profiler_read_portfolio",
    title: "Read sender's portfolio",
    description:
      "Fetch a portfolio/business web page and extract what the SENDER actually sells into a user_services object (primary service, REAL past work examples, track record). STRICT extraction — only what is literally on the page; vague pages return empty fields. This object is the only permitted source of social proof downstream.",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string", description: "Full https URL of the portfolio / business site" } },
    },
  },
  {
    name: "lead_profiler_analyze_screenshots",
    title: "Analyze lead profile screenshots",
    description:
      "Vision analysis of up to 8 screenshots of the LEAD's social media profile/ads. Extracts literal observation notes (pace, tone, content, engagement, self-presentation, pressure tells) and a digital presence audit. Only reports what is literally visible — 'not visible in screenshots' where unclear.",
    inputSchema: {
      type: "object",
      required: ["images"],
      properties: {
        images: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            required: ["dataUrl", "name"],
            properties: {
              dataUrl: { type: "string", description: "Base64 data URL of the screenshot (data:image/png;base64,...)" },
              name: { type: "string", description: "Short filename for ordering, e.g. 'ad-1.png'" },
            },
          },
          description: "1-8 screenshots in reading order",
        },
      },
    },
  },
  {
    name: "lead_profiler_audit_content",
    title: "Audit prospect content",
    description:
      "Content-strategy audit of up to 12 screenshots of the LEAD's posts: content themes, visual style, posting strategy, engagement patterns, brand voice, gaps/opportunities, and a sales recommendation (should you pitch, angle, likely pain, rough DiSC style).",
    inputSchema: {
      type: "object",
      required: ["images"],
      properties: {
        images: {
          type: "array",
          maxItems: 12,
          items: {
            type: "object",
            required: ["dataUrl", "name"],
            properties: {
              dataUrl: { type: "string", description: "Base64 data URL of the screenshot (data:image/png;base64,...)" },
              name: { type: "string", description: "Short filename for ordering, e.g. 'post-1.png'" },
            },
          },
          description: "1-12 screenshots in posting order",
        },
      },
    },
  },
  {
    name: "lead_profiler_step",
    title: "Run one chain step",
    description:
      "Run ONE step of the 7-step psychology chain. Pass prior step outputs through UNCHANGED per the dependency table in the playbook: step1 ← observation; step2 ← +step1; step3a/step3b ← +step1,step2; step3_reconciliation ← +step2,step3a,step3b; step4 ← +user_services,step1,step2,step3_reconciled; step5 ← +step4 and everything, plus optional arabic_glossary and step5_feedback. Each call takes ~5-15s.",
    inputSchema: {
      type: "object",
      required: ["step", "observation"],
      properties: {
        step: {
          type: "string",
          enum: STEP_ORDER,
          description: "Which step to run",
        },
        observation: observationSchema,
        user_services: userServicesSchema,
        arabic_glossary: arabicGlossarySchema,
        step1: priorOutputSchema,
        step2: priorOutputSchema,
        step3a: priorOutputSchema,
        step3b: priorOutputSchema,
        step3_reconciled: priorOutputSchema,
        step4: priorOutputSchema,
        step5_feedback: { type: "string", description: "Regeneration directive appended when the claim verifier rejected a previous opener attempt" },
      },
    },
  },
  {
    name: "lead_profiler_full_profile",
    title: "Run the full 7-step lead profile",
    description:
      "One-shot: runs the complete chain (Culture Map → DiSC → Status Anxiety ∥ Laws of Human Nature → Reconciliation → Influence lever → SPIN opener), then applies a CODE-LEVEL claim-verification gate: if the opener contains numbers, locations, or metrics that cannot be traced to user_services or the observation, it is automatically regenerated (up to 2 retries) with the rejected claims fed back. Takes 1-3 minutes. Requires an honest observation and the sender's real user_services.",
    inputSchema: {
      type: "object",
      required: ["observation", "user_services"],
      properties: {
        observation: observationSchema,
        user_services: userServicesSchema,
        arabic_glossary: arabicGlossarySchema,
        max_regenerations: { type: "number", minimum: 0, maximum: 3, default: 2, description: "How many times to regenerate the opener when the claim gate fails (default 2)" },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

interface StepRunInfo {
  step: string;
  label: string;
  description: string;
  duration_ms: number;
  output: Record<string, unknown>;
}

const STEP_LABELS: Record<string, string> = {
  step1_culture_map: "Culture Map",
  step2_disc: "DiSC Classifier",
  step3a_status_anxiety: "Status Anxiety",
  step3b_laws: "Laws of Human Nature",
  step3_reconciliation: "Reconciliation",
  step4_influence: "Influence Lever",
  step5_spin: "SPIN Opener",
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  step1_culture_map: "Cultural grammar tuner — conditions how every signal downstream is read",
  step2_disc: "Behavior classifier using 8 Dimensions of Leadership",
  step3a_status_anxiety: "Social-frame layer — hierarchy position, drive, pain point",
  step3b_laws: "Individual shadow layer — what's driving them underneath",
  step3_reconciliation: "Reconciles Status Anxiety + Laws when they disagree",
  step4_influence: "Persuasion lever selector — Cialdini's 7 principles",
  step5_spin: "Opener generator — 5-part structure, 60-120 words",
};

function extractOpenerText(output: Record<string, unknown> | undefined): string {
  const draft = output?.opener_draft;
  return typeof draft === "string" ? draft : "";
}

async function runFullProfile(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const observation = args.observation as Parameters<typeof runStep>[0]["observation"];
  const userServices = args.user_services as NonNullable<Parameters<typeof runStep>[0]["userServices"]>;
  const arabicGlossary = (args.arabic_glossary as Parameters<typeof runStep>[0]["arabicGlossary"]) ?? [];
  const maxRegen = typeof args.max_regenerations === "number" ? Math.max(0, Math.min(3, Math.floor(args.max_regenerations))) : 2;

  const t0 = Date.now();
  const steps: StepRunInfo[] = [];
  const pushStep = (r: { step: StepName; output: Record<string, unknown>; duration_ms: number }) =>
    steps.push({ step: r.step, label: STEP_LABELS[r.step], description: STEP_DESCRIPTIONS[r.step], duration_ms: r.duration_ms, output: r.output });

  // Step 1 — Culture Map
  const r1 = await runStep({ step: "step1_culture_map", observation });
  pushStep(r1);

  // Step 2 — DiSC
  const r2 = await runStep({ step: "step2_disc", observation, step1: r1.output });
  pushStep(r2);

  // Steps 3a + 3b — parallel (both only need step1 + step2)
  const [r3a, r3b] = await Promise.all([
    runStep({ step: "step3a_status_anxiety", observation, step1: r1.output, step2: r2.output }),
    runStep({ step: "step3b_laws", observation, step1: r1.output, step2: r2.output }),
  ]);
  pushStep(r3a);
  pushStep(r3b);

  // Step 3R — Reconciliation
  const r3r = await runStep({ step: "step3_reconciliation", observation, step2: r2.output, step3a: r3a.output, step3b: r3b.output });
  pushStep(r3r);

  // Step 4 — Influence
  const r4 = await runStep({ step: "step4_influence", observation, userServices, step1: r1.output, step2: r2.output, step3_reconciled: r3r.output });
  pushStep(r4);

  // Step 5 — SPIN opener + claim gate with regenerations
  let feedback: string | undefined;
  let r5: { step: StepName; output: Record<string, unknown>; duration_ms: number } | undefined;
  let check: ClaimCheckResult | undefined;
  const attempts: Array<{ attempt: number; passed: boolean; rejected_claims: Array<{ claim_text: string; reason: string }>; opener_excerpt: string }> = [];

  for (let attempt = 1; attempt <= 1 + maxRegen; attempt++) {
    r5 = await runStep({
      step: "step5_spin",
      observation,
      userServices,
      arabicGlossary,
      step1: r1.output,
      step2: r2.output,
      step3_reconciled: r3r.output,
      step4: r4.output,
      step5_feedback: feedback,
    });
    const openerText = extractOpenerText(r5.output);
    check = verifyOpener(openerText, userServices, observation);
    attempts.push({
      attempt,
      passed: check.passed,
      rejected_claims: check.rejected_claims.map((c) => ({ claim_text: c.claim_text, reason: c.reason })),
      opener_excerpt: openerText.slice(0, 140),
    });
    if (check.passed) break;
    if (attempt <= maxRegen) {
      feedback = [
        "REGENERATION DIRECTIVE — your previous opener draft was REJECTED by the code-level claim verifier.",
        "Fabricated or unverifiable claims found:",
        ...check.rejected_claims.map((c) => `- "${c.claim_text}" — ${c.reason}`),
        "",
        "Regenerate the opener WITHOUT these claims. Omit specific numbers, locations, and metrics that cannot be traced to user_services or the observation. A vague-but-honest claim is always better than a specific-but-fabricated one. NEVER invent social proof.",
      ].join("\n");
    }
  }
  if (r5) pushStep(r5);

  const openerOut = r5?.output ?? {};
  const passed = check?.passed ?? false;

  return {
    success: true,
    lead_name: observation.lead_name,
    opener: {
      opener_draft: openerOut.opener_draft ?? null,
      opener_language: openerOut.opener_language ?? null,
      opener_register: openerOut.opener_register ?? null,
      hook: openerOut.hook ?? null,
      hook_type: openerOut.hook_type ?? null,
      hook_source: openerOut.hook_source ?? null,
      vocabulary_used: openerOut.vocabulary_used ?? null,
      offer: openerOut.offer ?? null,
      alternative_opener: openerOut.alternative_opener ?? null,
      confidence: openerOut.confidence ?? null,
      confidence_reason: openerOut.confidence_reason ?? null,
      warnings: openerOut.warnings ?? [],
      factuality_check: openerOut.factuality_check ?? null,
    },
    claim_verification: {
      passed,
      attempts,
      rejected_claims: check?.rejected_claims ?? [],
      warnings: check?.warnings ?? [],
    },
    steps,
    total_duration_ms: Date.now() - t0,
    guidance: passed
      ? "Present opener_draft (and alternative_opener) to the human together with warnings, factuality_check and the confidence level. If confidence is 'low', recommend human review before sending. Do not silently edit the opener — if something is off, fix the inputs and re-run."
      : "DO NOT SEND THIS OPENER. It still contains claims that could not be traced to user_services or the observation after all regeneration attempts. Report the rejected_claims to the human, fix the inputs (real past_work_examples, verified observation facts), and re-run. Never hand-edit the opener to sneak claims back in.",
  };
}

export interface McpToolResult {
  text: string;
  isError: boolean;
}

export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const ok = (payload: unknown): McpToolResult => ({ text: JSON.stringify(payload, null, 2), isError: false });
  const fail = (message: string): McpToolResult => ({ text: message, isError: true });

  try {
    switch (name) {
      case "lead_profiler_playbook":
        return ok(buildPlaybook());
      case "lead_profiler_read_portfolio": {
        const url = args.url;
        if (typeof url !== "string") return fail("Missing required argument: url");
        return ok({ success: true, ...(await readPortfolioServices(url)) });
      }
      case "lead_profiler_analyze_screenshots":
        return ok({ success: true, ...(await analyzeLeadImages(args.images)) });
      case "lead_profiler_audit_content":
        return ok({ success: true, ...(await auditProspectContent(args.images)) });
      case "lead_profiler_step": {
        const result = await runStep({
          step: args.step as StepName,
          observation: args.observation as Parameters<typeof runStep>[0]["observation"],
          userServices: args.user_services as Parameters<typeof runStep>[0]["userServices"],
          arabicGlossary: args.arabic_glossary as Parameters<typeof runStep>[0]["arabicGlossary"],
          step1: args.step1 as Record<string, unknown> | undefined,
          step2: args.step2 as Record<string, unknown> | undefined,
          step3a: args.step3a as Record<string, unknown> | undefined,
          step3b: args.step3b as Record<string, unknown> | undefined,
          step3_reconciled: args.step3_reconciled as Record<string, unknown> | undefined,
          step4: args.step4 as Record<string, unknown> | undefined,
          step5_feedback: typeof args.step5_feedback === "string" ? args.step5_feedback : undefined,
        });
        return ok({ success: true, ...result });
      }
      case "lead_profiler_full_profile":
        return ok(await runFullProfile(args));
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof ServiceError) {
      return fail(`${err.message}${err.extra?.raw ? ` — raw: ${String(err.extra.raw).slice(0, 300)}` : ""}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Tool ${name} failed: ${message}`);
  }
}
