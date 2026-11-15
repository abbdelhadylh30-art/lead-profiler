import type { Config } from "../config.js";
import { readPortfolio, ApiError } from "../api-client.js";
import { z } from "zod";

export function registerPortfolioTool(server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer, cfg: Config): void {
  server.registerTool(
    "lead_profiler_read_portfolio",
    {
      title: "Read the sender's portfolio",
      description:
        "Fetches a portfolio/business page and extracts what the sender actually sells + their real track record, as a user_services draft for the profiling chain. Strict extraction: only what is literally on the page. ALWAYS confirm the extraction with the human before using it — this object is the only source of social proof the opener may ever cite.",
      inputSchema: {
        url: z.string().url().describe("https URL of the sender's portfolio, past-work, or business page"),
      },
    },
    async (args) => {
      try {
        const res = await readPortfolio(cfg, args.url);
        const guidance =
          "\n\n---\nNEXT STEP: confirm this extraction with the human user before running the chain. " +
          "past_work_examples must be REAL and verifiable — remove anything the human disowns; " +
          "if the list ends up empty, the Social Proof lever will be (correctly) forbidden.";
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) + guidance }],
          structuredContent: res as unknown as Record<string, unknown>,
        };
      } catch (err) {
        if (err instanceof ApiError) {
          return {
            content: [{ type: "text", text: `read_portfolio failed: ${err.message}` }],
            isError: true,
          };
        }
        throw err;
      }
    },
  );
}
