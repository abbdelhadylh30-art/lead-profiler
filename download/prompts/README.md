# Lead Profiler — Prompt Template & Runner

## What's here

The 5-step lead-profiling pipeline, operationalized as 6 prompt files + a Python runner script.

### Prompt files (`/home/z/my-project/download/prompts/`)

| File | Step | Role |
|---|---|---|
| `step1_culture_map.md` | 1 | Cultural grammar tuner — runs FIRST, conditions all downstream reads |
| `step2_disc.md` | 2 | DiSC behavior classifier (8 dimensions) |
| `step3a_status_anxiety.md` | 3a | Social-frame layer (5 status drives, pain point) |
| `step3b_laws.md` | 3b | Individual shadow layer (8-law shortlist from Greene's 18) |
| `step3_reconciliation.md` | 3 | Reconciles 3a + 3b when they disagree (Law wins as deeper truth) |
| `step4_influence.md` | 4 | Persuasion lever selector (7 Cialdini principles, pain-to-lever + DiSC-to-lever tables) |
| `step5_spin.md` | 5 | Opener generator (5-part structure, 60-120 words, Problem question) |

Each prompt file contains:
- The role description
- The system prompt (in a code block — paste into any chat UI manually OR load via the runner)
- The input template (what to paste as the user message)
- The output contract (strict JSON schema)

### Runner script (`/home/z/my-project/scripts/lead_profiler/`)

| File | Purpose |
|---|---|
| `lead_profiler.py` | Python script that chains all 6 steps via the `z-ai` CLI. Handles JSON validation, parallel execution of 3a/3b, intermediate file saving, and final opener printing. |
| `sample_input.json` | Template showing the exact input format. Use this as your starting point for real leads. |
| `output/` | Each run creates a subdirectory here with all 7 intermediate JSON files + a `full_run.json` bundle. Inspectable so you can debug where the chain breaks. |

---

## How to use it

### Option A — Manual (for iterating on prompt text)

1. Open each prompt file in order
2. Copy the system prompt block
3. Paste into your chat UI (me, Claude, GPT, etc.)
4. Fill in the input template with your observation notes
5. Run the step, copy the JSON output
6. Feed the JSON into the next step's input template
7. Repeat through Step 5

Use this mode when you want to refine the prompts themselves — you'll see exactly what each step produces and can edit the prompt text in real time.

### Option B — Automated runner (for batch processing real leads)

1. Edit `sample_input.json` — replace the sample lead with your real lead's observation notes
2. Save as a new file (e.g., `lead_001.json`)
3. Run:
   ```bash
   python /home/z/my-project/scripts/lead_profiler/lead_profiler.py \
     --input /path/to/lead_001.json \
     --verbose
   ```
4. The script:
   - Runs Step 1 (Culture Map)
   - Runs Step 2 (DiSC)
   - Runs Step 3a + Step 3b IN PARALLEL (~10s saved)
   - Runs Step 3 reconciliation
   - Runs Step 4 (Influence)
   - Runs Step 5 (SPIN opener)
   - Prints the draft opener + alternative + warnings + chain summary
   - Saves all intermediate JSONs to `output/<lead_name>_<timestamp>/`

Total runtime per lead: ~30 seconds.

---

## Input format

```json
{
  "lead_name": "Dr. Ahmed Al-Rashid",
  "profession": "Dental clinic owner",
  "apparent_subculture": "Saudi national, Jeddah-based, UK educated",
  "westernization_signals": "Mixed Arabic/English posting, references HBR, MBA from London",
  "observation_notes": {
    "pace": "posting frequency, reply speed, content cadence",
    "people_orientation": "warmth vs. skepticism in captions and replies",
    "content_shape": "carousels, reels, formal posts, BTS",
    "engagement": "reply patterns, tone, selectivity",
    "self_presentation": "front-and-center vs. behind-the-brand",
    "pressure_tells": "Stories, rants, brags, withdrawal under stress"
  },
  "additional_context": "Anything else relevant — competitors, family dynamics in the business, recent changes, etc."
}
```

The 6 observation categories come straight from the 5-minute scroll protocol defined in the master synthesis doc. Fill them with shorthand notes, not polished prose.

---

## Output structure

Each run produces a directory: `output/<lead_name>_<timestamp>/` containing:

```
step1_culture_map.json       — sub-culture, 8-scale positions, opener constraints
step2_disc.json              — primary dimension, DiSC style, confidence, evidence, warnings
step3a_status_anxiety.json   — comparison group, hierarchy position, drive, pain point
step3b_laws.json             — dominant law, shadow warning, defensive pattern
step3_reconciled.json        — reconciled motivation, vocabulary to use, what never to name
step4_influence.json         — primary lever, secondary lever, lever trigger, framing note
step5_opener.json            — the draft opener, alternative opener, warnings, structure check
full_run.json                — everything bundled together
```

The `opener_draft` field in `step5_opener.json` is the final deliverable.

---

## The honesty layer (how to read the output)

1. **Confidence cascade:** the final opener's confidence is the LOWEST of all upstream steps, not the average. If Step 3b (Laws) is low-confidence, the opener is low-confidence — even if everything else is solid. Take this seriously.

2. **Warnings field:** every step produces warnings. Read them. They tell you what could misfire on this specific lead. If a warning says "this could trigger defensiveness," believe it and edit the opener before sending.

3. **Intermediate files:** the whole point of saving step1/step2/step3a/step3b/step3r/step4 separately is so you can debug. If an opener misfires on a real lead, trace back through the JSONs to find which step made the wrong call. That tells you which prompt needs refinement.

4. **Alternative opener:** Step 5 produces two openers — a primary and an alternative with a different lever or different problem-question angle. Use these for A/B testing on similar leads.

---

## What to do when the chain breaks

When an opener misfires on a real lead, don't just blame the LLM. Trace the break:

| Symptom | Likely broken step | What to fix |
|---|---|---|
| Opener feels generic, not "seen" | Step 5 (specific_observation) | The specific_observation field isn't concrete enough |
| Opener triggers defensiveness | Step 3b (defensive_pattern) or Step 5 (didn't respect it) | The defensive pattern wasn't translated into the opener's framing |
| Wrong lever fired | Step 4 (mapping tables) | The pain-to-lever or DiSC-to-lever mapping needs adjustment for your market |
| DiSC classification wrong | Step 2 (signal interpretation) | The cultural adjustments from Step 1 may not be working |
| Cultural register wrong | Step 1 (sub-culture read) | The starting-position defaults need refinement |
| Pain point missed entirely | Step 3a (drive selection) | The lead may be in the 30% non-status-driven — Status Anxiety needs to yield |

Iterate on the specific prompt that broke, not the whole chain. The strict separation between steps exists precisely so you can localize failures.

---

## What's deliberately NOT here yet

1. **The 4 messaging-bonus books** (StoryBrand, Hooked, Contagious, Jab Jab Jab Right Hook) — these enhance Step 5 but are deferred until the core 6 are validated against real leads. Add them as a Step 5.5 enhancement layer after stress-testing.

2. **A web UI** — premature. The Python runner is sufficient for batch processing; a UI adds zero value until the underlying engine produces reliable openers.

3. **Automatic lead scraping** — the 5-minute manual observation is still the slowest part, but automating it (scraping IG profiles) introduces ToS issues, platform-specific parsers, and a much bigger build. Defer to v2.

4. **Your own win/loss pattern data** — the frameworks are scaffolding; your close rate on specific opener styles is the calibration. Add this as a Step 0 input field once you have 20+ leads through the tool.

---

## Test result

The runner was tested on a synthetic sample lead (`sample_input.json` — Dr. Ahmed Al-Rashid, Saudi dental clinic owner in Jeddah). End-to-end runtime: ~30 seconds. The chain produced:

- **Culture:** Saudi national, high-hybridization
- **DiSC:** Pioneering (Di/iD)
- **Status Anxiety:** Lovelessness drive, threatened hierarchy position
- **Laws:** Defensiveness (dominant) + Grandiosity (secondary)
- **Reconciliation:** Layers DISAGREE — Law (Defensiveness) is the deeper truth; Status Anxiety (Lovelessness) is the surface story the lead tells himself
- **Influence:** Authority lever + Unity secondary
- **Opener:** 70-word WhatsApp message with specific observation (Invisalign case study reel), cultural acknowledgment (Dr. Ahmed, hope you're well), Authority framing (top 3 dentists in Jeddah), Problem question (empty chair weeks), and implicit soft close

The warnings honestly flagged that the "cousin-competition" mention could trigger defensiveness — which is exactly the kind of honest self-critique the chain is designed to produce.
