import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, readPage } from "@/lib/llm-client";
import type { UserServices } from "@/lib/lead-profiler-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACTION_PROMPT = `You are reading a web page that the user claims is their portfolio, previous work, or business website.

Your job: extract what they actually sell and their real track record — to fill a user_services object for a lead-profiling tool. The tool uses this object as the ONLY source of honest social proof, so you must be strict about what you include.

## What to extract

1. **primary** — What is their primary service? One sentence. Be specific.
2. **secondary** — Any secondary service line? Empty string if none.
3. **past_work_examples** — A list of 3-8 specific, verifiable past work items. Each item should be ONE line, concrete, with what was built + for what kind of client + location if mentioned. Only include items that are LITERALLY on the page — do NOT invent. If the page is vague, return an empty list.
4. **track_record** — One sentence — ONLY if explicitly stated on the page. If vague, return: "Track record not specified on portfolio page — user should fill in manually."
5. **service_depth** — One sentence on what makes their work different.

## Critical rules

- ONLY extract what is LITERALLY on the page. Do NOT invent numbers, client names, or projects.
- past_work_examples MUST be concrete and verifiable. Vague entries are forbidden — return empty list instead.
- If the page content looks like JavaScript bundle code, return empty fields and note it.

## Output

Return ONLY a valid JSON object. No prose, no markdown fences.

{
  "primary": "<one sentence>",
  "secondary": "<one sentence or empty string>",
  "past_work_examples": ["<concrete item 1>", ...],
  "track_record": "<one sentence>",
  "service_depth": "<one sentence>",
  "extraction_notes": "<one sentence on what you found>"
}`;

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
    }

    let pageTitle = "";
    let plainText = "";

    try {
      const pageData = await readPage(parsedUrl.href);
      pageTitle = pageData.title;
      plainText = pageData.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      return NextResponse.json({ error: `Could not fetch page: ${msg}` }, { status: 502 });
    }

    if (!plainText.trim()) {
      return NextResponse.json({ error: "Page was fetched but contained no readable text content." }, { status: 502 });
    }

    const content = await chatCompletion([
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `URL: ${parsedUrl.href}\nPage title: ${pageTitle}\n\nPage content:\n${plainText}` },
    ]);

    if (!content) return NextResponse.json({ error: "LLM returned empty response" }, { status: 502 });

    let stripped = content.trim();
    if (stripped.startsWith("```")) {
      stripped = stripped.split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim();
    }

    let extracted: Partial<UserServices> & { extraction_notes?: string };
    try {
      extracted = JSON.parse(stripped);
    } catch {
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start >= 0 && end > start) {
        extracted = JSON.parse(stripped.slice(start, end + 1));
      } else {
        return NextResponse.json({ error: "Could not parse LLM response as JSON", raw: stripped.slice(0, 500) }, { status: 502 });
      }
    }

    return NextResponse.json({ success: true, url: parsedUrl.href, page_title: pageTitle, extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[read-portfolio] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
