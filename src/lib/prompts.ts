import { readFileSync } from "fs";
import { join } from "path";

const PROMPTS_DIR = "/home/z/my-project/download/prompts";

export type StepName =
  | "step1_culture_map"
  | "step2_disc"
  | "step3a_status_anxiety"
  | "step3b_laws"
  | "step3_reconciliation"
  | "step4_influence"
  | "step5_spin";

/**
 * Load the system prompt from a step's markdown file.
 * The markdown contains the prompt inside a ``` code fence;
 * we extract the longest block (the system prompt body).
 */
export function loadSystemPrompt(step: StepName): string {
  const mdPath = join(PROMPTS_DIR, `${step}.md`);
  const content = readFileSync(mdPath, "utf-8");

  const blocks: string[] = [];
  let inBlock = false;
  let current: string[] = [];

  for (const line of content.split("\n")) {
    if (line.trim().startsWith("```") && !inBlock) {
      inBlock = true;
      current = [];
    } else if (line.trim().startsWith("```") && inBlock) {
      inBlock = false;
      blocks.push(current.join("\n"));
    } else if (inBlock) {
      current.push(line);
    }
  }

  if (blocks.length === 0) {
    throw new Error(`No code block found in ${mdPath}`);
  }

  // The system prompt is the longest block
  return blocks.reduce((a, b) => (a.length > b.length ? a : b)).trim();
}

/**
 * Strip code fences and parse JSON defensively.
 */
export function parseJsonResponse(content: string): unknown {
  let stripped = content.trim();
  if (stripped.startsWith("```")) {
    const lines = stripped.split("\n").filter((l) => !l.trim().startsWith("```"));
    stripped = lines.join("\n").trim();
  }

  try {
    return JSON.parse(stripped);
  } catch {
    // Try extracting JSON object from middle of text
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error(`Could not parse JSON from LLM response: ${stripped.slice(0, 300)}`);
  }
}
