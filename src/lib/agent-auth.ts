import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Agent API-key gate.
 *
 * When AGENT_API_KEY is set on the deployment:
 *   - requests with a matching `x-api-key` (or `Authorization: Bearer`) → allowed (agents / MCP server)
 *   - browser requests from the site itself (Sec-Fetch-Site: same-origin) → allowed (the web UI keeps working)
 *   - everything else → 401
 *
 * When AGENT_API_KEY is NOT set, the API stays open (current behavior).
 *
 * Note: Sec-Fetch-Site is a browser-forbidden header — regular browsers always
 * set it on same-origin fetch() and it cannot be spoofed from page JS. Non-browser
 * clients (curl, agents) can still set it manually, so this is an access gate for
 * the honest-internet threat model (protecting LLM credits from drive-by usage),
 * not a hard security boundary.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkAgentAuth(req: NextRequest): NextResponse | null {
  const required = process.env.AGENT_API_KEY;
  if (!required || required.trim() === "") return null; // gate disabled

  const headerKey = req.headers.get("x-api-key");
  if (headerKey && safeEqual(headerKey.trim(), required)) return null;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (bearer && safeEqual(bearer, required)) return null;

  // Allow the site's own browser UI — same-origin fetch always carries this header
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") return null;

  return NextResponse.json(
    {
      error: "Unauthorized: this API requires an agent key.",
      hint: "Send header 'x-api-key: <your key>' (or 'Authorization: Bearer <your key>').",
      docs: "https://github.com/abbdelhadylh30-art/lead-profiler#--installable-mcp-server-for-ai-agents",
    },
    { status: 401 },
  );
}
