#!/usr/bin/env node
/**
 * Smoke test for lead-profiler-mcp.
 *
 *   node scripts/smoke-test.mjs
 *     - initialize handshake, tools/list, playbook call
 *
 *   node scripts/smoke-test.mjs --full <observation-file.json>
 *     - additionally runs lead_profiler_full_profile against the LIVE API
 *       (file shape: { observation: {...}, user_services: {...} })
 *
 *   node scripts/smoke-test.mjs --portfolio <url>
 *     - additionally calls lead_profiler_read_portfolio against the LIVE API
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const server = spawn(process.execPath, ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
});

server.on("exit", (code, signal) => {
  if (signal !== "SIGTERM" && code !== 0 && code !== null) {
    console.error(`server exited with code ${code}`);
  }
});

let buffer = "";
const pending = new Map();
let nextId = 1;

server.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("NON-JSON on stdout (protocol violation):", line.slice(0, 200));
      process.exit(1);
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "notifications/progress") {
      console.error(`  [progress] ${msg.params.message ?? ""} (${msg.params.progress}/${msg.params.total})`);
    }
  }
});

server.stderr.on("data", (d) => process.stderr.write(`  [server] ${d}`));

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => {
      if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    });
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function notification(method, params) {
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  server.kill("SIGTERM");
  process.exit(1);
}

// 1. Initialize handshake
const init = await request("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke-test", version: "0.1.0" },
});
console.log("initialized:", JSON.stringify(init.serverInfo));
notification("notifications/initialized", {});

// 2. tools/list
const tools = await request("tools/list", {});
const names = tools.tools.map((t) => t.name);
console.log("tools:", names.join(", "));
const expected = [
  "lead_profiler_playbook",
  "lead_profiler_read_portfolio",
  "lead_profiler_analyze_screenshots",
  "lead_profiler_audit_content",
  "lead_profiler_step",
  "lead_profiler_full_profile",
];
for (const e of expected) {
  if (!names.includes(e)) fail(`missing tool: ${e}`);
}
if (names.length !== expected.length) fail(`unexpected extra tools: ${names.filter((n) => !expected.includes(n))}`);
console.log("PASS: all 6 tools registered");

// 3. playbook
const pb = await request("tools/call", { name: "lead_profiler_playbook", arguments: {} });
const pbText = pb.content?.[0]?.text ?? "";
if (pbText.length < 2000) fail(`playbook suspiciously short: ${pbText.length} chars`);
console.log(`PASS: playbook returned ${pbText.length} chars of guidance`);

// 4. step tool dependency validation (should fail fast, no API call)
const badStep = await request("tools/call", {
  name: "lead_profiler_step",
  arguments: {
    step: "step2_disc",
    observation: {
      lead_name: "Test Lead",
      profession: "test",
      apparent_subculture: "test",
      westernization_signals: "test",
      digital_presence_audit: {
        has_website: "no",
        has_booking_or_payment_link: "no",
        has_google_reviews: "no",
        primary_call_to_action: "dm",
      },
      observation_notes: {
        pace: "test",
        people_orientation: "test",
        content_shape: "test",
        engagement: "test",
        self_presentation: "test",
        pressure_tells: "test",
      },
    },
  },
});
if (!badStep.isError) fail("step tool accepted step2 without step1 output — dependency validation broken");
console.log("PASS: step tool rejects missing prior outputs");

// 5. Optional live tests
const args = process.argv.slice(2);

const portfolioIdx = args.indexOf("--portfolio");
if (portfolioIdx !== -1 && args[portfolioIdx + 1]) {
  console.log("\n--- LIVE: read_portfolio ---");
  const pf = await request("tools/call", {
    name: "lead_profiler_read_portfolio",
    arguments: { url: args[portfolioIdx + 1] },
  });
  console.log(pf.content?.[0]?.text?.slice(0, 600));
}

const fullIdx = args.indexOf("--full");
if (fullIdx !== -1 && args[fullIdx + 1]) {
  console.log("\n--- LIVE: full_profile (this takes 30-90s) ---");
  const input = JSON.parse(await readFile(args[fullIdx + 1], "utf8"));
  const t0 = Date.now();
  const res = await request("tools/call", {
    name: "lead_profiler_full_profile",
    arguments: input,
    _meta: { progressToken: 999 },
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.isError) {
    console.error(`full_profile returned an error after ${secs}s:`);
    console.error(res.content?.map((c) => c.text).join("\n").slice(0, 1500));
    fail("full_profile errored");
  }
  const payload = res.structuredContent ?? JSON.parse(res.content[0].text);
  console.log(`PASS: full_profile completed in ${secs}s (${payload.total_duration_ms}ms API time)`);
  console.log("opener_language:", payload.opener?.opener_language);
  console.log("hook_type:", payload.opener?.hook_type);
  console.log("confidence:", payload.opener?.confidence);
  console.log("claim_verification.passed:", payload.claim_verification?.passed);
  console.log("attempts:", JSON.stringify(payload.claim_verification?.attempts?.map((a) => ({ n: a.attempt, passed: a.passed }))));
  console.log("\nOPENER DRAFT:\n" + payload.opener?.opener_draft);
  console.log("\nALTERNATIVE:\n" + payload.opener?.alternative_opener);
  console.log("\nWARNINGS:", JSON.stringify(payload.opener?.warnings, null, 2));
  if (payload.claim_verification?.passed !== true) {
    console.log("\nCLAIM GATE REJECTED — rejected claims:");
    console.log(JSON.stringify(payload.claim_verification?.rejected_claims, null, 2));
  }
}

console.log("\nALL SMOKE TESTS PASSED");
server.kill("SIGTERM");
process.exit(0);
