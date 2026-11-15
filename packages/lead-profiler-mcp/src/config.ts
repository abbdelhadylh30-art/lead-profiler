import { readFileSync } from "fs";

export interface Config {
  /** Base URL of the lead-profiler deployment */
  baseUrl: string;
  /** Agent API key (sent as x-api-key). undefined = API is open / no key needed. */
  apiKey?: string;
  /** Per-HTTP-request timeout in ms */
  timeoutMs: number;
  /** Package version (reported to the API and in the server banner) */
  version: string;
}

export const PACKAGE_VERSION = "0.1.1";
export const SERVER_NAME = "lead-profiler";

const DEFAULT_BASE_URL = "https://leads.abdelhadygabriel.me";
const DEFAULT_TIMEOUT_MS = 300_000;

const HELP = `lead-profiler-mcp — MCP server for the lead-profiler API

Usage: lead-profiler-mcp [--url <baseUrl>] [--api-key <key>] [--timeout-ms <ms>]

Options:
  --url <baseUrl>       lead-profiler deployment base URL
                        (env: LEAD_PROFILER_URL, default: ${DEFAULT_BASE_URL})
  --api-key <key>       agent API key, sent as x-api-key header
                        (env: LEAD_PROFILER_API_KEY)
  --timeout-ms <ms>     per-request timeout (env: LEAD_PROFILER_TIMEOUT_MS,
                        default: ${DEFAULT_TIMEOUT_MS})
  --version             print version and exit
  -h, --help            show this help and exit

The server speaks MCP over stdio. Configure it in your MCP client, e.g. Claude
Desktop:

  {
    "mcpServers": {
      "lead-profiler": {
        "command": "npx",
        "args": ["-y", "github:abbdelhadylh30-art/lead-profiler#mcp"],
        "env": { "LEAD_PROFILER_API_KEY": "lpk_..." }
      }
    }
  }
`;

function flag(argv: string[], ...names: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    for (const n of names) {
      if (a === n) {
        const v = argv[i + 1];
        if (!v) {
          console.error(`Missing value for ${n}`);
          process.exit(2);
        }
        return v;
      }
      if (a.startsWith(`${n}=`)) return a.slice(n.length + 1);
    }
  }
  return undefined;
}

function loadPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? PACKAGE_VERSION;
  } catch {
    return PACKAGE_VERSION;
  }
}

export function loadConfig(argv: string[]): Config {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.error(HELP);
    process.exit(0);
  }

  const version = loadPackageVersion();
  if (argv.includes("--version")) {
    console.log(`lead-profiler-mcp v${version}`);
    process.exit(0);
  }

  const baseUrl = (
    flag(argv, "--url") ??
    process.env.LEAD_PROFILER_URL ??
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  let apiKey = flag(argv, "--api-key") ?? process.env.LEAD_PROFILER_API_KEY;
  if (apiKey === undefined) {
    // Common alternative naming
    apiKey = process.env.LEAD_PROFILER_KEY;
  }
  if (apiKey !== undefined && apiKey.trim() === "") apiKey = undefined;

  const timeoutRaw =
    flag(argv, "--timeout-ms") ?? process.env.LEAD_PROFILER_TIMEOUT_MS;
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    console.error(`Invalid timeout: ${timeoutRaw}`);
    process.exit(2);
  }

  return { baseUrl, apiKey, timeoutMs, version };
}
