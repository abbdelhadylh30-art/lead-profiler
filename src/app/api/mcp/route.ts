import { NextRequest, NextResponse } from "next/server";
import { checkAgentAuth } from "@/lib/agent-auth";
import { callMcpTool, MCP_TOOLS } from "@/lib/mcp-tools";

/**
 * Remote MCP endpoint (Streamable HTTP, stateless) — the piece stdio MCP
 * clients can't use. This is the URL remote clients (Grok connectors, hosted
 * agents, anything that speaks MCP over HTTPS) add as a connector:
 *
 *   https://leads.abdelhadygabriel.me/api/mcp
 *
 * Implements the JSON-RPC methods a tools-only server needs: initialize,
 * notifications/initialized, ping, tools/list, tools/call. Responses are
 * plain application/json (allowed by the Streamable HTTP transport spec);
 * notifications-only requests get 202 Accepted with an empty body.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const SERVER_INFO = { name: "lead-profiler", version: "0.1.1" };
const INSTRUCTIONS =
  "Lead-profiler: turn a REAL observation of a lead into an honest, psychologically-tuned cold-outreach opener via a 7-step chain with a code-level claim gate. Call lead_profiler_playbook first — it is the operating manual.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
};

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: RpcRequest["id"], result: Record<string, unknown>) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const PARSE_ERROR = -32700;

async function handleRpc(msg: RpcRequest): Promise<Record<string, unknown> | null> {
  const { id, method, params } = msg;

  // Notifications carry no id and get no response.
  if (id === undefined || id === null) return null;

  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      return rpcResult(id, {
        protocolVersion: typeof requested === "string" ? requested : "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: MCP_TOOLS });

    case "tools/call": {
      const name = params?.name;
      if (typeof name !== "string") {
        return rpcError(id, INVALID_PARAMS, "tools/call requires params.name (string)");
      }
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      const result = await callMcpTool(name, args);
      const payload: Record<string, unknown> = {
        content: [{ type: "text", text: result.text }],
      };
      if (result.isError) payload.isError = true;
      return rpcResult(id, payload);
    }

    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not supported: ${String(method)}`);
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  // Stateless server: no SSE stream to subscribe to.
  return NextResponse.json(
    { error: "GET is not supported — POST JSON-RPC 2.0 messages to this endpoint (Streamable HTTP, stateless)" },
    { status: 405, headers: CORS },
  );
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: CORS });
}

export async function POST(req: NextRequest) {
  const unauthorized = checkAgentAuth(req);
  if (unauthorized) return unauthorized;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, PARSE_ERROR, "Invalid JSON body"), { status: 400, headers: CORS });
  }

  const messages: RpcRequest[] = Array.isArray(raw) ? (raw as RpcRequest[]) : [raw as RpcRequest];

  const responses: Record<string, unknown>[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
      responses.push(rpcError(msg?.id ?? null, PARSE_ERROR, "Invalid JSON-RPC message: missing method"));
      continue;
    }
    const res = await handleRpc(msg);
    if (res) responses.push(res);
  }

  // Notifications only (e.g. notifications/initialized) -> 202, empty body.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202, headers: CORS });
  }

  const body = Array.isArray(raw) ? responses : responses[0];
  return NextResponse.json(body, { headers: CORS });
}
