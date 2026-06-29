import { NextRequest, NextResponse } from "next/server";
import {
  runStep,
  type StepInput,
  type LeadObservation,
  type StepName,
  type UserServices,
} from "@/lib/lead-profiler";
import { verifyOpener } from "@/lib/claim-verifier";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes per request max

interface RequestBody {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    if (!body.step || !body.observation) {
      return NextResponse.json(
        { error: "Missing required fields: step, observation" },
        { status: 400 },
      );
    }

    const input: StepInput = {
      step: body.step,
      observation: body.observation,
      userServices: body.userServices,
      step1: body.step1,
      step2: body.step2,
      step3a: body.step3a,
      step3b: body.step3b,
      step3_reconciled: body.step3_reconciled,
      step4: body.step4,
    };

    const result = await runStep(input);

    // Programmatic post-check: if this is Step 5, scan the opener for fabricated claims.
    // This is the code-level backstop — the LLM has shown it will embellish despite
    // prompt warnings, so we verify with code, not LLM self-audit.
    if (body.step === "step5_spin" && body.userServices && result.output?.opener_draft) {
      const openerText = String(result.output.opener_draft);
      const altText = result.output.alternative_opener
        ? String(result.output.alternative_opener)
        : "";

      const primaryCheck = verifyOpener(openerText, body.userServices, body.observation);
      const altCheck = altText
        ? verifyOpener(altText, body.userServices, body.observation)
        : null;

      // Augment the Step 5 output with the programmatic check
      result.output = {
        ...result.output,
        programmatic_claim_check: {
          primary_opener: {
            passed: primaryCheck.passed,
            rejected_claims: primaryCheck.rejected_claims,
            warnings: primaryCheck.warnings,
          },
          alternative_opener: altCheck
            ? {
                passed: altCheck.passed,
                rejected_claims: altCheck.rejected_claims,
                warnings: altCheck.warnings,
              }
            : null,
        },
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[profile-lead] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
