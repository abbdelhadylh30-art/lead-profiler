# lead-profiler API reference

Base URL: `https://leads.abdelhadygabriel.me`
Auth: open by default. If the deployment enables the agent key gate, send
`x-api-key: <key>` (or `Authorization: Bearer <key>`); a 401 response means a
key is required. Keys are issued by the deployment owner.

All endpoints are `POST` with `Content-Type: application/json`.

---

## POST /api/profile-lead — run one chain step

Request:

```json
{
  "step": "step1_culture_map",
  "observation": { ... },
  "userServices": { ... },
  "arabicGlossary": [ ... ],
  "step1": { ... }, "step2": { ... }, "step3a": { ... }, "step3b": { ... },
  "step3_reconciled": { ... }, "step4": { ... },
  "step5_feedback": "optional regeneration directive for step5"
}
```

Response (200):

```json
{
  "success": true,
  "step": "step1_culture_map",
  "duration_ms": 6234,
  "output": { ...step-specific analysis... }
}
```

Errors: 400 validation (missing step/observation or missing prior outputs),
401 key gate, 5xx LLM hiccup (retry once).

### Step order and dependencies

| Step | Requires | Notes |
|---|---|---|
| `step1_culture_map` | `observation` | Culture Map — culture/sub-culture read |
| `step2_disc` | `observation`, `step1` | DiSC behavioral classifier |
| `step3a_status_anxiety` | `observation`, `step1`, `step2` | runs in parallel with 3b |
| `step3b_laws` | `observation`, `step1`, `step2` | runs in parallel with 3a |
| `step3_reconciliation` | `observation`, `step2`, `step3a`, `step3b` | reconciles the two lenses |
| `step4_influence` | `observation`, `userServices`, `step1`, `step2`, `step3_reconciled` | picks the ethical influence lever |
| `step5_spin` | `observation`, `userServices`, `arabicGlossary?`, `step1`, `step2`, `step3_reconciled`, `step4`, `step5_feedback?` | generates the opener |

Missing prior outputs → 400. Pass each prior step's `output` object through
UNCHANGED.

### The observation object

```json
{
  "lead_name": "Krishna's Kitchen",
  "profession": "home-based catering & tiffin meal service owner",
  "apparent_subculture": "Gujarati immigrant small-business community, Etobicoke GTA",
  "westernization_signals": "English-first captions, Western SaaS aesthetic",
  "digital_presence_audit": {
    "has_website": "yes | no | weak",
    "website_notes": "evidence, e.g. 'all 5 candidate domains NXDOMAIN'",
    "has_booking_or_payment_link": "yes | no",
    "booking_notes": "how orders actually happen, e.g. 'WhatsApp DM only'",
    "has_google_reviews": "yes | no",
    "google_reviews_notes": "evidence or 'no profile found'",
    "primary_call_to_action": "dm | call | link | none | other",
    "competitor_digital_presence": "SPECIFIC verified competitor only — never invent",
    "customer_complaint_pattern": "recurring visible complaint pattern only — never infer"
  },
  "observation_notes": {
    "pace": "posting frequency, reply speed — or 'not observed'",
    "people_orientation": "caption/reply warmth, formality, personal address",
    "content_shape": "post types, production quality, content mix",
    "engagement": "comment volume, reply behavior — or 'not observed'",
    "self_presentation": "face visible? professional vs casual? brand vs personality?",
    "pressure_tells": "visible stress signals, rants — or 'not visible'"
  },
  "additional_context": "strongest activation signals: competitor mentions, stated-but-unfulfilled intentions, complaint patterns. LITERAL facts only"
}
```

`website_notes`, `booking_notes`, `google_reviews_notes`,
`competitor_digital_presence`, `customer_complaint_pattern`,
`additional_context` are optional. Every value must be literally observed or
independently verified — "not observed" is a valid, honest value.

### The userServices object (the sender's REAL services)

```json
{
  "primary": "what the sender actually sells — one specific sentence",
  "secondary": "secondary service line, if any",
  "past_work_examples": ["REAL past work, concrete and verifiable — EMPTY LIST unless real"],
  "track_record": "years in market, client count, outcomes — or 'Track record not specified'",
  "service_depth": "what makes this different from a generic agency"
}
```

This is the ONLY source of social proof the opener may ever cite. Never pad it.

### arabicGlossary (optional)

```json
[{ "original": "term or bad Arabic phrase", "corrected": "authoritative Arabic", "note": "when it applies", "created_at": 1700000000000 }]
```

Human-corrected translations override the model's own. Pass whenever the human
has corrected Arabic output before (max 50 entries).

### step5 output (the opener)

`output` for `step5_spin` contains: `opener_draft` (the deliverable),
`alternative_opener` (A/B variant), `opener_language`, `opener_register`,
`hook`, `hook_type` (cost_of_absence / contradiction / customer_signal /
competitor_contrast / vocabulary_mirror), `hook_source`, `vocabulary_used`,
`offer`, `confidence` (high/medium/low — cascades from upstream steps),
`confidence_reason`, `warnings` (what could misfire with THIS lead),
`factuality_check` (with `fabricated_claims` — MUST be empty; any entry is the
model self-reporting a fabrication).

---

## POST /api/verify-claims — the code-level claim gate

Runs the same regex-based verifier the MCP package applies after step 5. Every
count/percentage/location claim in the opener is checked against the source
data. Call it EVERY time after step 5 — before presenting anything to a human.

Request:

```json
{
  "opener": "the full opener text",
  "userServices": { ...same object used in the chain... },
  "observation": { ...same object used in the chain... }
}
```

Response (200):

```json
{
  "success": true,
  "passed": false,
  "do_not_send": true,
  "rejected_claims": [
    { "claim_text": "14 clinics", "claim_type": "count_with_noun", "reason": "not traceable to user_services or observation", "pattern_matched": "..." }
  ],
  "warnings": ["percentage claims detected — have the human verify the numbers"],
  "guidance": "DO NOT SEND. Re-run step5_spin with step5_feedback listing these rejected claims..."
}
```

On failure: re-run `step5_spin` with
`step5_feedback` = a directive listing the rejected claims verbatim and
instructing the model to drop them (max 2 regenerations), then re-verify.
Still failing → report to the human, do not send.

---

## POST /api/read-portfolio — extract the sender's services

Request: `{ "url": "https://senders-portfolio.example" }`
Response: `{ "success": true, "url": "...", "page_title": "...", "extracted": { ...partial UserServices + extraction_notes } }`

Strict extraction: only what is literally on the page. ALWAYS confirm with the
human before using it as `user_services` — remove anything the human disowns.

## POST /api/analyze-lead-images — vision extraction from screenshots

Request: `{ "images": [{ "name": "ad_card_1.png", "dataUrl": "data:image/png;base64,..." }], "max": 8 }`
Response: `{ "success": true, "images_analyzed": 3, "extracted": { ...observation notes + digital presence audit... } }`

Inline the images yourself (fetch + base64 → data URL) before POSTing. Max 8.
Use to cross-check your manual observations — `cannot_determine` fields are
honest gaps, carry them forward as "not observed", never guess.

## POST /api/prospect-content-audit — content strategy audit

Request: `{ "images": [{ "name": "post_1.png", "dataUrl": "data:image/png;base64,..." }] }` (max 12)
Response: `{ "success": true, "images_analyzed": 6, "audit": { themes, visual_style, posting_strategy, engagement_patterns, brand_voice, gaps_opportunities, sales_recommendation } }`

Use BEFORE deciding whether a lead is worth profiling.

---

## Timing and client timeouts

- Single chain step: ~5-15s. Vision endpoints: ~10-40s. Full chain (7 steps,
  3a/3b parallel): ~30-150s.
- If your tool-call timeout is short, run the chain step-by-step (each call is
  small) instead of one long orchestrated call.
- The engine's LLM runs on a free model — expect occasional 5xx; retry once
  before reporting failure.
