import { NextRequest, NextResponse } from "next/server";
import { verifyOpener, type ClaimCheckResult } from "@/lib/claim-verifier";
import type { LeadObservation, UserServices } from "@/lib/lead-profiler";
import { checkAgentAuth } from "@/lib/agent-auth";

export const runtime = "nodejs";

interface RequestBody {
  opener: string;
  userServices: UserServices;
  observation: LeadObservation;
}

/**
 * REST access to the code-level claim gate (same verifier the MCP package runs
 * after step 5). Agent callers without the MCP server — e.g. skill users — POST
 * the generated opener together with the SAME userServices + observation the
 * chain used, and get an honest pass/fail verdict with rejected claims.
 */
export async function POST(req: NextRequest) {
  const unauthorized = checkAgentAuth(req);
  if (unauthorized) return unauthorized;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.opener || typeof body.opener !== "string") {
    return NextResponse.json(
      { error: "Missing required field: opener (the full opener text as a string)" },
      { status: 400 },
    );
  }
  if (!body.userServices || typeof body.userServices !== "object") {
    return NextResponse.json(
      { error: "Missing required field: userServices — the claim gate needs the same source data the chain used" },
      { status: 400 },
    );
  }
  if (!body.observation || typeof body.observation !== "object") {
    return NextResponse.json(
      { error: "Missing required field: observation — the claim gate needs the same source data the chain used" },
      { status: 400 },
    );
  }

  const check: ClaimCheckResult = verifyOpener(body.opener, body.userServices, body.observation);

  return NextResponse.json({
    success: true,
    passed: check.passed,
    do_not_send: !check.passed,
    rejected_claims: check.rejected_claims,
    warnings: check.warnings,
    guidance: check.passed
      ? check.warnings.length > 0
        ? "Claim gate passed, but percentage claims were detected — have the human verify those numbers before sending."
        : "Claim gate passed — safe to present the opener to the human."
      : "DO NOT SEND. Re-run step5_spin with step5_feedback listing these rejected claims (up to 2 regenerations). A vague-but-honest claim is always better than a specific-but-fabricated one. Never invent social proof.",
  });
}
