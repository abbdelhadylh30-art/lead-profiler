#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, SERVER_NAME } from "./config.js";
import { registerAllTools } from "./tools/index.js";
async function main() {
    const cfg = loadConfig(process.argv.slice(2));
    const server = new McpServer({ name: SERVER_NAME, version: cfg.version });
    registerAllTools(server, cfg);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // NEVER write to stdout — stdout is the MCP protocol channel
    console.error(`[lead-profiler-mcp] v${cfg.version} ready — API: ${cfg.baseUrl}${cfg.apiKey ? " (API key set)" : " (no API key)"}`);
}
main().catch((err) => {
    console.error("[lead-profiler-mcp] fatal:", err);
    process.exit(1);
});
