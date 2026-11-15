import { NextRequest, NextResponse } from "next/server";
import {
  runStep,
  type StepInput,
  type LeadObservation,
  type StepName,
  type UserServices,
  type ArabicGlossaryEntry,
} from "@/lib/lead-profiler";
import { checkAgentAuth } from "@/lib/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  step: StepName;
  observation: LeadObservation;
  userServices?: UserServices;
  arabicGlossary?: ArabicGlossaryEntry[];
  step1?: Record<string, unknown>;
  step2?: Record<string, unknown>;
  step3a?: Record<string, unknown>;
  step3b?: Record<string, unknown>;
  step3_reconciled?: Record<string, unknown>;
  step4?: Record<string, unknown>;
  /** Regeneration directive for step5 — used by agent callers when the claim verifier rejected a previous attempt */
  step5_feedback?: string;
}

export async function POST(req: NextRequest) {
  try {
    const unauthorized = checkAgentAuth(req);
    if (unauthorized) return unauthorized;

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
      arabicGlossary: body.arabicGlossary,
      step1: body.step1,
      step2: body.step2,
      step3a: body.step3a,
      step3b: body.step3b,
      step3_reconciled: body.step3_reconciled,
      step4: body.step4,
      step5_feedback: body.step5_feedback,
    };

    const result = await runStep(input);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[profile-lead] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
