// Shared API types — mirrors src/lib/lead-profiler-types.ts from the
// lead-profiler web app. Kept in sync so the MCP package and the API
// agree on the contract.

export type StepName =
  | "step1_culture_map"
  | "step2_disc"
  | "step3a_status_anxiety"
  | "step3b_laws"
  | "step3_reconciliation"
  | "step4_influence"
  | "step5_spin";

export interface UserServices {
  /** What you actually sell — primary service line */
  primary: string;
  /** Optional secondary service line */
  secondary?: string;
  /** Real examples of past work — used for honest social proof. Each item should be concrete. */
  past_work_examples: string[];
  /** Your real track record — years in market, number of clients, notable outcomes. Be honest. */
  track_record: string;
  /** Service depth — what makes your work different from a generic agency */
  service_depth: string;
}

export interface ArabicGlossaryEntry {
  /** The English term or bad Arabic phrase that the tool generated */
  original: string;
  /** The correct Arabic translation the user wants the tool to use instead */
  corrected: string;
  /** Optional note on when this applies */
  note?: string;
  created_at: number;
}

export interface LeadObservation {
  lead_name: string;
  profession: string;
  apparent_subculture: string;
  westernization_signals: string;
  digital_presence_audit: {
    has_website: "yes" | "no" | "weak";
    website_notes?: string;
    has_booking_or_payment_link: "yes" | "no";
    booking_notes?: string;
    has_google_reviews: "yes" | "no";
    google_reviews_notes?: string;
    primary_call_to_action: "dm" | "call" | "link" | "none" | "other";
    competitor_digital_presence?: string;
    customer_complaint_pattern?: string;
  };
  observation_notes: {
    pace: string;
    people_orientation: string;
    content_shape: string;
    engagement: string;
    self_presentation: string;
    pressure_tells: string;
  };
  additional_context?: string;
}

export interface StepResult {
  step: StepName;
  output: Record<string, unknown>;
  duration_ms: number;
}

export const STEP_ORDER: StepName[] = [
  "step1_culture_map",
  "step2_disc",
  "step3a_status_anxiety",
  "step3b_laws",
  "step3_reconciliation",
  "step4_influence",
  "step5_spin",
];

export const STEP_LABELS: Record<StepName, string> = {
  step1_culture_map: "Culture Map",
  step2_disc: "DiSC Classifier",
  step3a_status_anxiety: "Status Anxiety",
  step3b_laws: "Laws of Human Nature",
  step3_reconciliation: "Reconciliation",
  step4_influence: "Influence Lever",
  step5_spin: "SPIN Opener",
};

export const STEP_DESCRIPTIONS: Record<StepName, string> = {
  step1_culture_map: "Cultural grammar tuner — conditions how every signal downstream is read",
  step2_disc: "Behavior classifier using 8 Dimensions of Leadership",
  step3a_status_anxiety: "Social-frame layer — hierarchy position, drive, pain point",
  step3b_laws: "Individual shadow layer — what's driving them underneath",
  step3_reconciliation: "Reconciles Status Anxiety + Laws when they disagree",
  step4_influence: "Persuasion lever selector — Cialdini's 7 principles",
  step5_spin: "Opener generator — 5-part structure, 60-120 words",
};

/** Which prior outputs each step requires before it can run. */
export const STEP_REQUIREMENTS: Record<StepName, { priors: string[]; userServices: boolean; observation: boolean }> = {
  step1_culture_map: { priors: [], userServices: false, observation: true },
  step2_disc: { priors: ["step1"], userServices: false, observation: true },
  step3a_status_anxiety: { priors: ["step1", "step2"], userServices: false, observation: true },
  step3b_laws: { priors: ["step1", "step2"], userServices: false, observation: true },
  step3_reconciliation: { priors: ["step2", "step3a", "step3b"], userServices: false, observation: false },
  step4_influence: { priors: ["step1", "step2", "step3_reconciled"], userServices: true, observation: false },
  step5_spin: { priors: ["step1", "step2", "step3_reconciled", "step4"], userServices: true, observation: true },
};
