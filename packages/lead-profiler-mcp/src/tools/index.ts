import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { registerPlaybookTool } from "./playbook.js";
import { registerPortfolioTool } from "./portfolio.js";
import { registerScreenshotTools } from "./screenshots.js";
import { registerStepTool } from "./step.js";
import { registerRunTool } from "./run.js";

export function registerAllTools(server: McpServer, cfg: Config): void {
  registerPlaybookTool(server, cfg);
  registerPortfolioTool(server, cfg);
  registerScreenshotTools(server, cfg);
  registerStepTool(server, cfg);
  registerRunTool(server, cfg);
}
