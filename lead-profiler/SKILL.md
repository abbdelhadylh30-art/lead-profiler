---
name: lead-profiler
description: >-
  Turns a REAL observation of a lead (small business owner, founder, freelancer,
  professional) into a psychologically-tuned cold-outreach opener for
  WhatsApp/DM/email, via a 7-book framework chain (Culture Map, DiSC, Status
  Anxiety, Laws of Human Nature, Reconciliation, Influence, SPIN) running on the
  hosted lead-profiler engine, with a code-level claim gate that refuses
  fabricated social proof. Use when the user says "write a cold outreach
  opener", "cold DM", "cold message", "help me reach this lead", "profile this
  business", "first message to this Instagram/Facebook page", or pastes a
  lead's profile, business page, or screenshots and wants a first-contact
  message that converts.
---

# lead-profiler

You are using the lead-profiler engine: a hosted API that converts a **literal,
verified observation of a lead** into a cold-outreach opener tuned by a 7-book
psychology chain. It is built around a strict honesty architecture. Read the
rules before your first run — they are enforced in code, not suggestions.

**Before your first run, read `api-reference.md` in this folder** — it holds
the full request/response contract, the observation schema, and the step
dependency table. This file is the workflow; that file is the contract.

## The rules (non-negotiable)

1. **Never fabricate social proof.** Counts ("14 clinics"), locations ("in
   Riyadh"), and metrics ("22% more bookings") may ONLY appear if they
   literally exist in `user_services` or the observation. A vague-but-honest
   claim always beats a specific-but-fabricated one.
2. **The claim gate is a hard gate.** After step 5 you MUST call
   `POST /api/verify-claims` with the opener + the same `user_services` and
   `observation` you used. If `passed: false` — do NOT present the opener as
   send-ready. Regenerate (max 2 retries) with `step5_feedback`, then re-verify.
3. **Empty `past_work_examples` = no Social Proof.** Do not work around it.
4. **Literal observations only.** If you did not see it, write "not observed".
   Never infer timelines ("saying 'soon' for 4 years") or feelings.
5. **Verify "no website" claims** (candidate domains / DNS checks) before
   asserting them in the observation.
6. **Never silently edit an opener.** If something is off, fix the inputs and
   re-run, and tell the human what you changed and why.

## The workflow

**Phase 0 — Get the sender's real services (`user_services`)**
- Best: ask the human directly what they sell + their real past work.
- Alternative: `POST /api/read-portfolio` with their portfolio URL, then
  CONFIRM the extraction with the human before using it.
- `past_work_examples` must be REAL and concrete. If none are verified, pass
  an EMPTY list — the chain will honestly fall back to Authority/Liking.

**Phase 1 — Research the lead (use your own web tools)**
Find and verify: their business and profession; digital presence (website?
booking/payment link? Google reviews? CTA?); active ads (e.g. Facebook Ad
Library); recent posts and engagement; community/sub-culture signals;
languages used. Competitor mentions and complaint patterns only if you can
cite a specific, verified one.

**Phase 2 (optional) — Screenshot analysis**
Profile screenshots → `POST /api/analyze-lead-images` (max 8). Content-strategy
audit → `POST /api/prospect-content-audit` (max 12). Inline images yourself as
data URLs (fetch + base64). Reconcile the extraction against your own
observations; where they disagree, prefer what you can re-verify.

**Phase 3 — Build the `observation`**
Fill every field honestly — full schema in `api-reference.md`. "Not observed"
is a valid, honest value. Put competitor mentions, stated-but-unfulfilled
intentions, and complaint patterns in `additional_context` — they are the
strongest hook sources.

**Phase 4 — Run the chain**
Run the steps in order via `POST /api/profile-lead`, passing each prior step's
output UNCHANGED (dependency table in `api-reference.md`):
`step1_culture_map` → `step2_disc` → `step3a_status_anxiety` ∥
`step3b_laws` (parallel) → `step3_reconciliation` → `step4_influence` →
`step5_spin`. Each call is ~5-15s.

**Phase 5 — Claim gate, then present to the human**
`POST /api/verify-claims` with the step5 opener. On failure: re-run step5 with
`step5_feedback` listing the rejected claims (up to 2 regenerations), re-verify.
Then present to the human: the opener (and `alternative_opener`), `warnings`,
`factuality_check`, the claim verdict, and the confidence level. If confidence
is "low", recommend human review before sending. If `claim_verification.passed`
is false after all retries: report the rejected claims, fix the inputs, re-run.

## If the MCP server is installed instead

Claude Code / Claude Desktop / Cursor users can skip REST entirely:
`npx github:abbdelhadylh30-art/lead-profiler#mcp` exposes the same engine as
MCP tools (`lead_profiler_full_profile` runs the whole chain including the
claim gate in one call). The workflow and honesty rules are identical.
