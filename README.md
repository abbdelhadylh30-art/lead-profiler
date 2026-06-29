# Lead Profiler

**5-minute observation in. Pitch-ready Arabic opener out.**

A research-compression tool for cold WhatsApp outreach. Takes your manual social-media observation notes for a lead and produces a draft WhatsApp opener designed to feel like it came from someone who already understood them — not a cold pitch.

## The 5-step pipeline

```
Culture Map → DiSC → (Status Anxiety ∥ Laws of Human Nature) → Reconciliation → Influence → SPIN → Opener
```

| Step | Book | What it does |
|---|---|---|
| 1. Culture Map | Erin Meyer | Cultural grammar tuner — conditions every downstream read |
| 2. DiSC | 8 Dimensions of Leadership | Behavior classifier (8 dimensions) |
| 3a. Status Anxiety | Alain de Botton | Social-frame layer — hierarchy position, drive, pain point |
| 3b. Laws of Human Nature | Robert Greene | Individual shadow layer — what's driving them underneath |
| 3. Reconciliation | (synthesis) | Reconciles 3a + 3b when they disagree |
| 4. Influence | Cialdini | Persuasion lever selector (7 principles) |
| 5. SPIN | Rackham | Opener generator — Arabic-first, hook-driven, 50-80 words |

Step 3a and 3b run in parallel. Total runtime: ~30 seconds per lead.

## Key features

- **Arabic-first output** — detects the lead's Arabic register (Saudi Hejazi, Najdi, Emirati, etc.) and generates the opener natively, not translated
- **Hook-driven** — surfaces a specific cost the lead is paying but can't see (cost_of_absence, contradiction, customer_signal, competitor_contrast)
- **Factuality check** — every claim in the opener is traced to its source (user_services, observation_notes, or digital_presence_audit). Fabricated claims are flagged.
- **Social Proof guard** — Social Proof lever is forbidden when `past_work_examples` is empty or doesn't match the lead's profession
- **Digital presence audit** — 30-second factual check that drives the activation hook for leads with no website
- **What You Sell** — your real services and track record, filled once, used as the only source of honest social proof

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- z-ai-web-dev-sdk (on Z.ai sandbox) or any OpenAI-compatible API (on Vercel/other hosts)

## Setup

### Local development

```bash
bun install
bun run dev
```

On the Z.ai sandbox, the app uses z-ai-web-dev-sdk automatically.

### Vercel deployment

1. Push this repo to GitHub
2. Import in Vercel
3. Set environment variables:
   - `OPENAI_API_KEY` — any OpenAI-compatible API key
   - `OPENAI_MODEL` — (optional) defaults to `gpt-4o-mini`. For better Arabic, consider `gpt-4o` or `anthropic/claude-3.5-sonnet`
   - `OPENAI_BASE_URL` — (optional) for OpenRouter, Together, etc.

The app automatically detects whether the ZAI SDK is available (sandbox) or whether to use the OpenAI-compatible fallback (Vercel).

## Usage

1. Fill in **"What You Sell"** — your real services, track record, and past work examples
2. Fill in **"Lead Observation"** — 5-minute scroll worth of notes across 6 signal categories + digital presence audit
3. Click **Generate Profile**
4. The 5-step chain runs in ~30 seconds
5. The draft WhatsApp opener appears in Arabic (or English for highly Westernized leads)
6. Read the factuality check and warnings before sending

## License

MIT
