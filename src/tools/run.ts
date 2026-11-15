import type { Config } from "../config.js";
import { profileStep, ApiError } from "../api-client.js";
import { verifyOpener, type ClaimCheckResult } from "../claim-verifier.js";
import {
  STEP_LABELS,
  STEP_DESCRIPTIONS,
  type ArabicGlossaryEntry,
  type LeadObservation,
  type StepResult,
  type UserServices,
} from "../types.js";
import { z } from "zod";
import type { ProgressNotification } from "@modelcontextprotocol/sdk/types.js";
import { observationSchema, userServicesSchema, glossarySchema } from "./schemas.js";

interface StepRunInfo {
  step: string;
  label: string;
  description: string;
  duration_ms: number;
  output: Record<string, unknown>;
}

function extractOpenerText(output: Record<string, unknown> | undefined): string {
  if (!output) return "";
  const draft = output.opener_draft;
  return typeof draft === "string" ? draft : "";
}

export function registerRunTool(server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer, cfg: Config): void {
  server.registerTool(
    "lead_profiler_full_profile",
    {
      title: "Run the full 7-step lead profile",
      description:
        "One-shot: runs the complete chain (Culture Map → DiSC → Status Anxiety ∥ Laws of Human Nature → Reconciliation → Influence lever → SPIN opener), then applies a CODE-LEVEL claim-verification gate: if the opener contains numbers, locations, or metrics that cannot be traced to user_services or the observation, it is automatically regenerated (up to 2 retries) with the rejected claims fed back. Takes 30-90s. Requires an honest observation and the sender's real user_services.",
      inputSchema: {
        observation: observationSchema,
        user_services: userServicesSchema,
        arabic_glossary: glossarySchema.optional(),
        max_regenerations: z
          .number()
          .int()
          .min(0)
          .max(3)
          .optional()
          .default(2)
          .describe("How many times to regenerate the opener when the claim gate fails (default 2)"),
      },
    },
    async (args, extra) => {
      // Progress notifications (only when the client provided a progress token)
      const progressToken = (extra._meta as { progressToken?: string | number } | undefined)?.progressToken;
      const notify = async (progress: number, total: number, message: string): Promise<void> => {
        if (progressToken === undefined) return;
        try {
          const notification: ProgressNotification = {
            method: "notifications/progress",
            params: { progressToken, progress, total, message },
          };
          await extra.sendNotification(notification);
        } catch {
          // Progress is best-effort — never fail a run because of it
        }
      };

      const observation = args.observation as LeadObservation;
      const userServices = args.user_services as UserServices;
      const arabicGlossary = (args.arabic_glossary as ArabicGlossaryEntry[] | undefined) ?? [];
      const maxRegen = args.max_regenerations ?? 2;

      const totalCalls = 7 + maxRegen; // 7 LLM calls (3a/3b parallel) + possible regenerations
      let completed = 0;

      const t0 = Date.now();
      const steps: StepRunInfo[] = [];

      const pushStep = (r: StepResult) => {
        steps.push({
          step: r.step,
          label: STEP_LABELS[r.step],
          description: STEP_DESCRIPTIONS[r.step],
          duration_ms: r.duration_ms,
          output: r.output,
        });
      };

      try {
        // Step 1 — Culture Map
        await notify(completed, totalCalls, "step1_culture_map — Culture Map");
        const r1 = await profileStep(cfg, { step: "step1_culture_map", observation });
        pushStep(r1);
        completed++;
        await notify(completed, totalCalls, "step2_disc — DiSC Classifier");

        // Step 2 — DiSC
        const r2 = await profileStep(cfg, {
          step: "step2_disc",
          observation,
          step1: r1.output,
        });
        pushStep(r2);
        completed++;
        await notify(completed, totalCalls, "step3a_status_anxiety + step3b_laws (parallel)");

        // Steps 3a + 3b — in parallel (both only need step1 + step2)
        const [r3a, r3b] = await Promise.all([
          profileStep(cfg, {
            step: "step3a_status_anxiety",
            observation,
            step1: r1.output,
            step2: r2.output,
          }),
          profileStep(cfg, {
            step: "step3b_laws",
            observation,
            step1: r1.output,
            step2: r2.output,
          }),
        ]);
        pushStep(r3a);
        pushStep(r3b);
        completed += 2;
        await notify(completed, totalCalls, "step3_reconciliation — Reconciliation");

        // Step 3R — Reconciliation
        const r3r = await profileStep(cfg, {
          step: "step3_reconciliation",
          observation,
          step2: r2.output,
          step3a: r3a.output,
          step3b: r3b.output,
        });
        pushStep(r3r);
        completed++;
        await notify(completed, totalCalls, "step4_influence — Influence lever");

        // Step 4 — Influence
        const r4 = await profileStep(cfg, {
          step: "step4_influence",
          observation,
          userServices,
          step1: r1.output,
          step2: r2.output,
          step3_reconciled: r3r.output,
        });
        pushStep(r4);
        completed++;

        // Step 5 — SPIN opener + claim-verification gate with regenerations
        let feedback: string | undefined;
        let r5: StepResult | undefined;
        let check: ClaimCheckResult | undefined;
        const attempts: Array<{
          attempt: number;
          passed: boolean;
          rejected_claims: Array<{ claim_text: string; reason: string }>;
          opener_excerpt: string;
        }> = [];

        for (let attempt = 1; attempt <= 1 + maxRegen; attempt++) {
          await notify(completed, totalCalls, `step5_spin — opener generation (attempt ${attempt}/${1 + maxRegen})`);
          r5 = await profileStep(cfg, {
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
          completed++;

          const openerText = extractOpenerText(r5.output);
          check = verifyOpener(openerText, userServices, observation);
          attempts.push({
            attempt,
            passed: check.passed,
            rejected_claims: check.rejected_claims.map((c) => ({
              claim_text: c.claim_text,
              reason: c.reason,
            })),
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

        const payload = {
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

        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                `full_profile failed after ${steps.length} step(s): ${msg}\n\n` +
                `Partial step outputs are preserved below — re-usable as prior inputs for lead_profiler_step.`,
            },
            { type: "text", text: JSON.stringify({ steps }, null, 2) },
          ],
        };
      }
    },
  );
}
