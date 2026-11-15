import { NextRequest, NextResponse } from "next/server";
import { checkAgentAuth } from "@/lib/agent-auth";
import { readPortfolioServices, ServiceError } from "@/lib/services";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const unauthorized = checkAgentAuth(req);
    if (unauthorized) return unauthorized;

    const { url } = (await req.json()) as { url?: string };
    const result = await readPortfolioServices(url ?? "");
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[read-portfolio] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
