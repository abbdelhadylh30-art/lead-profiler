// Shared API types — mirrors src/lib/lead-profiler-types.ts from the
// lead-profiler web app. Kept in sync so the MCP package and the API
// agree on the contract.
export const STEP_ORDER = [
    "step1_culture_map",
    "step2_disc",
    "step3a_status_anxiety",
    "step3b_laws",
    "step3_reconciliation",
    "step4_influence",
    "step5_spin",
];
export const STEP_LABELS = {
    step1_culture_map: "Culture Map",
    step2_disc: "DiSC Classifier",
    step3a_status_anxiety: "Status Anxiety",
    step3b_laws: "Laws of Human Nature",
    step3_reconciliation: "Reconciliation",
    step4_influence: "Influence Lever",
    step5_spin: "SPIN Opener",
};
export const STEP_DESCRIPTIONS = {
    step1_culture_map: "Cultural grammar tuner — conditions how every signal downstream is read",
    step2_disc: "Behavior classifier using 8 Dimensions of Leadership",
    step3a_status_anxiety: "Social-frame layer — hierarchy position, drive, pain point",
    step3b_laws: "Individual shadow layer — what's driving them underneath",
    step3_reconciliation: "Reconciles Status Anxiety + Laws when they disagree",
    step4_influence: "Persuasion lever selector — Cialdini's 7 principles",
    step5_spin: "Opener generator — 5-part structure, 60-120 words",
};
/** Which prior outputs each step requires before it can run. */
export const STEP_REQUIREMENTS = {
    step1_culture_map: { priors: [], userServices: false, observation: true },
    step2_disc: { priors: ["step1"], userServices: false, observation: true },
    step3a_status_anxiety: { priors: ["step1", "step2"], userServices: false, observation: true },
    step3b_laws: { priors: ["step1", "step2"], userServices: false, observation: true },
    step3_reconciliation: { priors: ["step2", "step3a", "step3b"], userServices: false, observation: false },
    step4_influence: { priors: ["step1", "step2", "step3_reconciled"], userServices: true, observation: false },
    step5_spin: { priors: ["step1", "step2", "step3_reconciled", "step4"], userServices: true, observation: true },
};
