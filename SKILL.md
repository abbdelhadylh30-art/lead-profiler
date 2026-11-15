---
name: lead-profiler
description: Turns a REAL, verified observation of a lead (small business owner, founder, freelancer, professional) into a psychologically-tuned cold-outreach opener for WhatsApp/DM/email, via a hosted API running a 7-step chain (Culture Map, DiSC, Status Anxiety, Laws of Human Nature, Reconciliation, Influence Lever, SPIN opener), with a code-level claim gate that rejects fabricated numbers, locations, metrics and social proof. Use when the user says "write a cold outreach opener", "cold DM", "cold message", "help me reach this lead", "profile this business", "profile this lead", "first message to this Instagram/Facebook page", or pastes a lead's profile, business page, or screenshots and wants a first-contact message that converts. Only public, verified information is used - the skill never invents facts.
---

# Lead Profiler

Profile a real business or person from their **observed public signals**, then generate a
cold-outreach opener that is personalized, psychologically grounded, and **provably honest**.

Everything below is backed by a hosted API. You (the agent) orchestrate 7 HTTP calls plus a
claim gate. No SDK, no build step, no zip. If you can make an HTTP POST, you can run this.

This file is self-contained for the full workflow. If you cloned the whole repo (or can fetch
from GitHub), `lead-profiler/api-reference.md` holds the same contract in extended form —
per-endpoint response shapes and error tables.

## The one non-negotiable rule

**Never fabricate.** Every claim in the final opener must trace to the sender's real services
or the lead's verified observation. A vague-but-honest claim always beats a specific-but-fabricated
one. The claim gate in this pipeline enforces this at code level - openers containing untraceable
numbers, locations, or metrics are rejected and regenerated. If the gate says DO NOT SEND, you
do not send, and you do not hand-edit the opener to sneak claims back in.

## Connection details

| Setting | Value |
|---|---|
| Base URL | `https://leads.abdelhadygabriel.me` |
| Auth | Optional `x-api-key: <key>` header (server may require it; omit if none issued). `Authorization: Bearer <key>` also accepted |
| Content type | `application/json` |
| Timeout | One step call takes ~5-30s; set your HTTP timeout to at least 120s per call. The full chain takes 1-3 minutes total |

Where they disagree with your own observations, prefer what you can re-verify. Confirm any
`read-portfolio` extraction of the SENDER's services with the human before using it.

## Workflow overview

```
[optional] gather signals
  read-portfolio  /  analyze-lead-images  /  prospect-content-audit
        |
        v
build observation + user_services        <-- the honest raw material
        |
        v
run the 7-step chain (7 POSTs, two of them parallel)
        |
        v
run the claim gate on the opener
        |
        v
deliver opener with confidence + warnings
```

## Step 0 (optional) - Gather signals

Skip this if the user already provided the lead's details. Use it to collect facts before
building the observation.

**Read a portfolio / website** - what does the *sender* sell (never the lead):

```bash
curl -s -X POST https://leads.abdelhadygabriel.me/api/read-portfolio \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://senders-site.com"}'
# -> { "success": true, "url": "...", "page_title": "...",
#      "extracted": { "primary": "...", "past_work_examples": [...], "extraction_notes": "..." } }
```

**Analyze screenshots of the lead's ads/profile** (base64 data URLs, max 8 images; inline
them yourself via fetch + base64):

```bash
curl -s -X POST https://leads.abdelhadygabriel.me/api/analyze-lead-images \
  -H 'Content-Type: application/json' \
  -d '{"images": [{"dataUrl": "data:image/png;base64,...", "name": "ad-1.png"}]}'
# -> { "success": true, "images_analyzed": 3, "extracted": {...} }
```

**Audit the lead's content for pain points and patterns** (max 12 images):

```bash
curl -s -X POST https://leads.abdelhadygabriel.me/api/prospect-content-audit \
  -H 'Content-Type: application/json' \
  -d '{"images": [{"dataUrl": "data:image/png;base64,...", "name": "profile.png"}]}'
# -> { "success": true, "images_analyzed": 2, "audit": {...} }
```

## Build the observation

`observation` is a structured record of the LEAD. Every field must be literally observed or
independently verified. `"not observed"` is a valid, honest value - use it instead of guessing.
Never invent competitors, complaints, or timelines.

```json
{
  "lead_name": "Krishna's Kitchen",
  "profession": "Home-based Indian catering and daily tiffin meal service owner",
  "apparent_subculture": "Gujarati/North Indian immigrant small-business community in Etobicoke, GTA (Toronto)",
  "westernization_signals": "English-first ad copy on Meta with standard Western ad formats; WhatsApp as the order channel",
  "digital_presence_audit": {
    "has_website": "no",
    "website_notes": "Five candidate domains all return NXDOMAIN; only third-party presence is a TiffinStash directory listing",
    "has_booking_or_payment_link": "no",
    "booking_notes": "Orders taken via WhatsApp DM from ad click-throughs",
    "has_google_reviews": "no",
    "google_reviews_notes": "No Google Business profile found in searches",
    "primary_call_to_action": "dm",
    "competitor_digital_presence": "GTA tiffin competitors run websites with online ordering menus",
    "customer_complaint_pattern": "Not observed in captured material"
  },
  "observation_notes": {
    "pace": "Active advertiser - multiple creatives running simultaneously in Facebook Ad Library (Canada); organic cadence not directly observed",
    "people_orientation": "Warm, home-cooking tone in ad copy ('homemade', 'fresh tiffin'); community-family framing",
    "content_shape": "Food photography creatives with promotional offers; ad-led rather than organic-content-led",
    "engagement": "Not captured in available screenshots",
    "self_presentation": "Brand-first (kitchen and food imagery); owner's face not prominent",
    "pressure_tells": "Discount-led creatives suggest ongoing customer-acquisition pressure"
  },
  "additional_context": "Found via Facebook Ad Library (Canada) - actively spending on ads that land on WhatsApp rather than a website"
}
```

Field rules:

- `has_website`: `"yes"` / `"no"` (only if verified, e.g. domains NXDOMAIN) / `"weak"` (parked/placeholder/outdated)
- `primary_call_to_action`: `"dm"` / `"call"` / `"link"` / `"none"` / `"other"`
- `digital_presence_audit` entries drive cost-of-absence hooks - they must be factual
- `observation_notes`: 2-3 honest sentences per category

## Build user_services

`userServices` is the SENDER's real services. This is the ONLY source of social proof the
opener may ever cite. Never pad it.

```json
{
  "primary": "Conversion-focused landing pages and booking systems for home food businesses",
  "past_work_examples": ["Booking dashboard for a Riyadh dental clinic"],
  "track_record": "3 years in market, 12 launched client projects",
  "service_depth": "Ships in 2 weeks; Arabic/English bilingual; WhatsApp-order integration"
}
```

If there are NO real past work examples, pass an **empty list** - the chain will honestly fall
back to Authority/Liking levers instead of Social Proof. Do not invent examples to fill it.

**Arabic glossary (optional):** if the user has corrected Arabic translations before, pass
`"arabicGlossary": [{"original": "...", "corrected": "...", "note": "..."}]` to step 5. User
corrections always override generated translations.

## Run the 7-step chain

All steps hit one endpoint: `POST /api/profile-lead`. Each call returns
`{ "step": "...", "duration_ms": N, "output": { ... } }`. Pass prior step outputs through
**unchanged** as shown. Steps 3a and 3b run in parallel.

| # | step | required in body | prior outputs |
|---|---|---|---|
| 1 | `step1_culture_map` | `observation` | - |
| 2 | `step2_disc` | `observation` | `step1` |
| 3a | `step3a_status_anxiety` | `observation` | `step1`, `step2` |
| 3b | `step3b_laws` | `observation` | `step1`, `step2` |
| 3R | `step3_reconciliation` | `observation` | `step2`, `step3a`, `step3b` |
| 4 | `step4_influence` | `observation`, `userServices` | `step1`, `step2`, `step3_reconciled` |
| 5 | `step5_spin` | `observation`, `userServices` | `step1`, `step2`, `step3_reconciled`, `step4`, optional `arabicGlossary`, optional `step5_feedback` |

Body key naming (exact): prior outputs are keyed `step1`, `step2`, `step3a`, `step3b`,
`step3_reconciled`, `step4`; the regeneration directive is `step5_feedback`; the sender's
services key is `userServices` (camelCase).

Example - step 1, then everything chains:

```bash
curl -s -X POST https://leads.abdelhadygabriel.me/api/profile-lead \
  -H 'Content-Type: application/json' --max-time 120 \
  -d '{"step": "step1_culture_map", "observation": { ... }}'

# step 2 adds: "step1": <step1.output verbatim>
# steps 3a + 3b fire in parallel, each with "step1" and "step2"
# step 3_reconciliation gets "step2", "step3a", "step3b"
# step 4 gets "userServices", "step1", "step2", "step3_reconciled"
# step 5 gets everything, plus "arabicGlossary" if you have one
```

**Step 5 output** (the payoff):

| key | meaning |
|---|---|
| `opener_draft` | The cold-opener message - the deliverable |
| `alternative_opener` | A second variation to offer the human |
| `opener_language`, `opener_register` | Language and tone it was written in |
| `hook`, `hook_type`, `hook_source` | The psychological hook and where it came from |
| `offer` | What the sender proposes |
| `confidence`, `confidence_reason` | Honest self-assessment: high / medium / low |
| `warnings` | Honesty warnings - always surface these to the human |
| `factuality_check` | The chain's own factuality audit |

## Run the claim gate (mandatory)

After step 5, POST the opener with the SAME `userServices` and `observation` the chain used:

```bash
curl -s -X POST https://leads.abdelhadygabriel.me/api/verify-claims \
  -H 'Content-Type: application/json' \
  -d '{"opener": "<opener_draft text>", "userServices": {...}, "observation": {...}}'
# -> { "passed": true|false, "do_not_send": true|false,
#      "rejected_claims": [{"claim_text": "...", "reason": "..."}],
#      "warnings": [...], "guidance": "..." }
```

Decision rules:

- **`passed: true`** -> present the opener to the human (see below)
- **`passed: false`** -> regenerate step 5 with
  `"step5_feedback": "REGENERATION DIRECTIVE - your previous opener draft was REJECTED by the code-level claim verifier. Fabricated or unverifiable claims found: - \"<claim>\" - <reason>. Regenerate WITHOUT these claims. A vague-but-honest claim is always better than a specific-but-fabricated one. NEVER invent social proof."`
  Up to **2 regenerations**. If it still fails after all attempts: DO NOT SEND. Report
  `rejected_claims` to the human, fix the inputs (real past work, verified observation facts),
  and re-run. Never hand-edit the opener to sneak claims back in.

## Deliver the result

Present to the human, in this order:

1. `opener_draft` and `alternative_opener` (ready to copy)
2. `warnings` and `factuality_check` - verbatim, never summarized away
3. `confidence` + `confidence_reason` - if `low`, recommend human review before sending
4. One-line context: the influence lever chosen (step 4) and the hook type

If the gate failed and regenerations are exhausted, deliver nothing and explain what input
facts are missing. That is a success of the honesty system, not a failure of the run.

## Errors

| symptom | meaning / fix |
|---|---|
| `400 Missing required fields: step, observation` | body malformed - check JSON and step name spelling |
| `401` | server requires the API key - retry with `x-api-key: <key>` |
| `408` / timeout | raise your HTTP timeout to 120s+ and retry the step |
| `500` with an error message | the step failed server-side - retry once; if it persists, report the message to the human |
| `extracted` fields empty from read-portfolio | the page had little to extract - ask the user for their real services instead of guessing |

## Install notes (for humans)

This skill works wherever agents can fetch a SKILL.md from a link - no zip, no build:

- Paste `https://github.com/abbdelhadylh30-art/lead-profiler` into Claude with the words "install skill"
- Vercel skills CLI: `npx skills add abbdelhadylh30-art/lead-profiler`
- Claude Code (plugin marketplace): `/plugin marketplace add abbdelhadylh30-art/lead-profiler` then `/plugin install lead-profiler@lead-profiler`
- Claude Code (manual): clone the repo and copy `SKILL.md` into `~/.claude/skills/lead-profiler/`
- Any other agent: paste this whole file at the top of a chat and follow it

An MCP-server distribution of the same capability also exists
(`npx -y github:abbdelhadylh30-art/lead-profiler#mcp`) for clients that prefer the Model
Context Protocol. The hosted API documented above is identical in both.
