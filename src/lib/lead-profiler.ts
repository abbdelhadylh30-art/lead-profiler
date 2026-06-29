import "server-only";
import { loadSystemPrompt, parseJsonResponse } from "./prompts";
import { chatCompletion } from "./llm-client";
import type {
  StepName,
  LeadObservation,
  StepResult,
  UserServices,
} from "./lead-profiler-types";

// Re-export for convenience
export type { StepName, LeadObservation, StepResult, UserServices };

async function callStep(
  step: StepName,
  userPrompt: string,
): Promise<{ output: Record<string, unknown>; duration_ms: number }> {
  const systemPrompt = loadSystemPrompt(step);

  const start = Date.now();
  const content = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  if (!content) {
    throw new Error(`Empty response from LLM for step ${step}`);
  }

  const parsed = parseJsonResponse(content) as Record<string, unknown>;
  return { output: parsed, duration_ms: Date.now() - start };
}

// ---------------------------------------------------------------------------
// User prompt builders
// ---------------------------------------------------------------------------

function buildStep1UserPrompt(obs: LeadObservation): string {
  const n = obs.observation_notes;
  const a = obs.digital_presence_audit;
  return `LEAD: ${obs.lead_name} — ${obs.profession}
APPARENT SUB-CULTURE: ${obs.apparent_subculture}
WESTERNIZATION SIGNALS: ${obs.westernization_signals}

DIGITAL PRESENCE AUDIT (factual inventory):
- Has website: ${a.has_website} ${a.website_notes ? `(${a.website_notes})` : ""}
- Has booking/payment link: ${a.has_booking_or_payment_link} ${a.booking_notes ? `(${a.booking_notes})` : ""}
- Has Google reviews: ${a.has_google_reviews} ${a.google_reviews_notes ? `(${a.google_reviews_notes})` : ""}
- Primary call-to-action: ${a.primary_call_to_action}
- Competitor digital presence: ${a.competitor_digital_presence ?? "N/A"}
- Customer complaint pattern: ${a.customer_complaint_pattern ?? "N/A"}

OBSERVATION NOTES (2-3 sentences of context):
- Pace: ${n.pace}
- People orientation: ${n.people_orientation}
- Content shape: ${n.content_shape}
- Engagement: ${n.engagement}
- Self-presentation: ${n.self_presentation}
- Pressure tells: ${n.pressure_tells}

Additional context: ${obs.additional_context ?? "N/A"}`;
}

function buildStep2UserPrompt(
  obs: LeadObservation,
  step1: Record<string, unknown>,
): string {
  const n = obs.observation_notes;
  return `STEP 1 OUTPUT (cultural context frame):
${JSON.stringify(step1, null, 2)}

OBSERVATION NOTES (across 6 categories):
1. Pace signals: ${n.pace}
2. People orientation: ${n.people_orientation}
3. Content shape: ${n.content_shape}
4. Engagement style: ${n.engagement}
5. Self-presentation: ${n.self_presentation}
6. Pressure tells: ${n.pressure_tells}`;
}

function buildStep3UserPrompt(
  obs: LeadObservation,
  step1: Record<string, unknown>,
  step2: Record<string, unknown>,
): string {
  const n = obs.observation_notes;
  return `STEP 1 OUTPUT (cultural context frame):
${JSON.stringify(step1, null, 2)}

STEP 2 OUTPUT (DiSC classification):
${JSON.stringify(step2, null, 2)}

OBSERVATION NOTES (across 6 categories):
1. Pace signals: ${n.pace}
2. People orientation: ${n.people_orientation}
3. Content shape: ${n.content_shape}
4. Engagement style: ${n.engagement}
5. Self-presentation: ${n.self_presentation}
6. Pressure tells: ${n.pressure_tells}`;
}

function buildStep3ReconciliationUserPrompt(
  step2: Record<string, unknown>,
  step3a: Record<string, unknown>,
  step3b: Record<string, unknown>,
): string {
  return `STEP 2 OUTPUT (DiSC):
${JSON.stringify(step2, null, 2)}

STEP 3a OUTPUT (Status Anxiety):
${JSON.stringify(step3a, null, 2)}

STEP 3b OUTPUT (Laws of Human Nature):
${JSON.stringify(step3b, null, 2)}`;
}

function buildStep4UserPrompt(
  step1: Record<string, unknown>,
  step2: Record<string, unknown>,
  step3r: Record<string, unknown>,
  userServices: UserServices,
): string {
  return `STEP 1 OUTPUT (cultural context frame):
${JSON.stringify(step1, null, 2)}

STEP 2 OUTPUT (DiSC classification):
${JSON.stringify(step2, null, 2)}

STEP 3 RECONCILED OUTPUT:
${JSON.stringify(step3r, null, 2)}

USER SERVICES (your real services and track record — determines whether Social Proof is available as a lever. If past_work_examples is empty or doesn't match the lead's profession, Social Proof is FORBIDDEN):
${JSON.stringify(userServices, null, 2)}`;
}

function buildStep5UserPrompt(
  obs: LeadObservation,
  step1: Record<string, unknown>,
  step2: Record<string, unknown>,
  step3r: Record<string, unknown>,
  step4: Record<string, unknown>,
  userServices: UserServices,
): string {
  const n = obs.observation_notes;
  const a = obs.digital_presence_audit;
  return `STEP 1 OUTPUT (cultural context frame):
${JSON.stringify(step1, null, 2)}

STEP 2 OUTPUT (DiSC classification):
${JSON.stringify(step2, null, 2)}

STEP 3 RECONCILED OUTPUT:
${JSON.stringify(step3r, null, 2)}

STEP 4 OUTPUT (Influence lever):
${JSON.stringify(step4, null, 2)}

USER SERVICES (what you actually sell — use these for the offer and for honest social proof. NEVER invent social proof not in this object. Verify all Arabic translations of service terms.):
${JSON.stringify(userServices, null, 2)}

DIGITAL PRESENCE AUDIT (factual inventory — use this for cost_of_absence hooks):
${JSON.stringify(a, null, 2)}

RAW OBSERVATION NOTES:
1. Pace signals: ${n.pace}
2. People orientation: ${n.people_orientation}
3. Content shape: ${n.content_shape}
4. Engagement style: ${n.engagement}
5. Self-presentation: ${n.self_presentation}
6. Pressure tells: ${n.pressure_tells}

ADDITIONAL CONTEXT (scan this for the strongest activation signal — competitor mentions, stated-but-unfulfilled intentions, customer complaint patterns):
${obs.additional_context ?? "N/A"}`;
}

// ---------------------------------------------------------------------------
// Single-step executor
// ---------------------------------------------------------------------------

export interface StepInput {
  step: StepName;
  observation: LeadObservation;
  userServices?: UserServices;
  step1?: Record<string, unknown>;
  step2?: Record<string, unknown>;
  step3a?: Record<string, unknown>;
  step3b?: Record<string, unknown>;
  step3_reconciled?: Record<string, unknown>;
  step4?: Record<string, unknown>;
}

export async function runStep(input: StepInput): Promise<StepResult> {
  const { step, observation, userServices } = input;
  let output: Record<string, unknown>;
  let duration_ms = 0;

  switch (step) {
    case "step1_culture_map":
      ({ output, duration_ms } = await callStep(step, buildStep1UserPrompt(observation)));
      break;
    case "step2_disc":
      if (!input.step1) throw new Error("step1 output required for step2");
      ({ output, duration_ms } = await callStep(
        step,
        buildStep2UserPrompt(observation, input.step1),
      ));
      break;
    case "step3a_status_anxiety":
      if (!input.step1 || !input.step2)
        throw new Error("step1 and step2 outputs required for step3a");
      ({ output, duration_ms } = await callStep(
        step,
        buildStep3UserPrompt(observation, input.step1, input.step2),
      ));
      break;
    case "step3b_laws":
      if (!input.step1 || !input.step2)
        throw new Error("step1 and step2 outputs required for step3b");
      ({ output, duration_ms } = await callStep(
        step,
        buildStep3UserPrompt(observation, input.step1, input.step2),
      ));
      break;
    case "step3_reconciliation":
      if (!input.step2 || !input.step3a || !input.step3b)
        throw new Error("step2, step3a, step3b outputs required for reconciliation");
      ({ output, duration_ms } = await callStep(
        step,
        buildStep3ReconciliationUserPrompt(input.step2, input.step3a, input.step3b),
      ));
      break;
    case "step4_influence":
      if (!input.step1 || !input.step2 || !input.step3_reconciled)
        throw new Error("step1, step2, step3_reconciled outputs required for step4");
      if (!userServices)
        throw new Error("userServices required for step4 — lever selection depends on whether you have real past_work_examples");
      ({ output, duration_ms } = await callStep(
        step,
        buildStep4UserPrompt(input.step1, input.step2, input.step3_reconciled, userServices),
      ));
      break;
    case "step5_spin":
      if (!input.step1 || !input.step2 || !input.step3_reconciled || !input.step4)
        throw new Error("step1, step2, step3_reconciled, step4 outputs required for step5");
      if (!userServices)
        throw new Error("userServices required for step5 — the opener needs to know what you actually sell");
      ({ output, duration_ms } = await callStep(
        step,
        buildStep5UserPrompt(
          observation,
          input.step1,
          input.step2,
          input.step3_reconciled,
          input.step4,
          userServices,
        ),
      ));
      break;
    default:
      throw new Error(`Unknown step: ${step}`);
  }

  return { step, output, duration_ms };
}
