import { profileStep, ApiError } from "../api-client.js";
import { verifyOpener } from "../claim-verifier.js";
import { STEP_REQUIREMENTS } from "../types.js";
import { z } from "zod";
import { observationSchema, userServicesSchema, glossarySchema, priorOutputSchema } from "./schemas.js";
const STEP_NAMES = [
    "step1_culture_map",
    "step2_disc",
    "step3a_status_anxiety",
    "step3b_laws",
    "step3_reconciliation",
    "step4_influence",
    "step5_spin",
];
export function registerStepTool(server, cfg) {
    server.registerTool("lead_profiler_step", {
        title: "Run a single chain step",
        description: "Runs ONE step of the 7-step lead-profiling chain against the live API. Use for manual/fine-grained control (e.g. clients with short tool-call timeouts). Pass each required prior step's output through UNCHANGED — the dependency rules are validated locally before the API is called. For step5, the result includes a code-level claim_check; if it failed, do not present the opener as send-ready.",
        inputSchema: {
            step: z.enum(STEP_NAMES).describe("Which step to run. Order: step1_culture_map → step2_disc → step3a_status_anxiety ∥ step3b_laws → step3_reconciliation → step4_influence → step5_spin"),
            observation: observationSchema,
            user_services: userServicesSchema.optional(),
            arabic_glossary: glossarySchema.optional(),
            step1: priorOutputSchema.optional().describe("Output of step1_culture_map (required by step2, step3a, step3b, step4, step5)"),
            step2: priorOutputSchema.optional().describe("Output of step2_disc (required by step3a, step3b, step3_reconciliation, step4, step5)"),
            step3a: priorOutputSchema.optional().describe("Output of step3a_status_anxiety (required by step3_reconciliation)"),
            step3b: priorOutputSchema.optional().describe("Output of step3b_laws (required by step3_reconciliation)"),
            step3_reconciled: priorOutputSchema.optional().describe("Output of step3_reconciliation (required by step4, step5)"),
            step4: priorOutputSchema.optional().describe("Output of step4_influence (required by step5)"),
            step5_feedback: z
                .string()
                .optional()
                .describe("Regeneration directive for step5 — list rejected claims from a previous attempt so the model avoids them"),
        },
    }, async (args) => {
        // Local dependency validation — fail fast with actionable guidance
        const req = STEP_REQUIREMENTS[args.step];
        const missing = [];
        for (const prior of req.priors) {
            const v = args[prior];
            if (!v || typeof v !== "object" || Object.keys(v).length === 0) {
                missing.push(prior);
            }
        }
        if (req.userServices && !args.user_services)
            missing.push("user_services");
        if (missing.length > 0) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Cannot run ${args.step}: missing required input(s): ${missing.join(", ")}. ` +
                            `Run the prior step(s) first (lead_profiler_step or lead_profiler_full_profile) and pass their output objects through unchanged.`,
                    },
                ],
            };
        }
        try {
            const observation = args.observation;
            const userServices = args.user_services;
            const arabicGlossary = args.arabic_glossary;
            const result = await profileStep(cfg, {
                step: args.step,
                observation,
                userServices,
                arabicGlossary,
                step1: args.step1,
                step2: args.step2,
                step3a: args.step3a,
                step3b: args.step3b,
                step3_reconciled: args.step3_reconciled,
                step4: args.step4,
                step5_feedback: args.step5_feedback,
            });
            const payload = { ...result };
            // Attach the code-level claim check to step5 results when verifiable
            if (args.step === "step5_spin" && userServices) {
                const openerText = typeof result.output?.opener_draft === "string" ? result.output.opener_draft : "";
                const check = verifyOpener(openerText, userServices, observation);
                payload.claim_check = check;
                if (!check.passed) {
                    payload.do_not_send = true;
                    payload.guidance =
                        "CLAIM GATE FAILED: the opener contains claims that could not be traced to user_services or the observation. " +
                            "Do NOT present it as send-ready. Re-run step5 with step5_feedback listing these rejected claims, or fix the inputs.";
                }
                else if (check.warnings.length > 0) {
                    payload.guidance =
                        "Claim gate passed, but percentage claims were detected — have the human verify those numbers before sending.";
                }
            }
            return {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
                structuredContent: payload,
            };
        }
        catch (err) {
            if (err instanceof ApiError) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `step ${args.step} failed: ${err.message}` }],
                };
            }
            throw err;
        }
    });
}
