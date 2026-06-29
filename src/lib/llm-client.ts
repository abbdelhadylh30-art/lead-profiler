/**
 * LLM client abstraction.
 *
 * On the local Z.ai sandbox, uses z-ai-web-dev-sdk (reads /etc/.z-ai-config).
 * On Vercel or any other host, falls back to OpenAI-compatible env vars:
 *   - OPENAI_API_KEY (required for the fallback)
 *   - OPENAI_BASE_URL (optional — defaults to https://api.openai.com/v1)
 *   - OPENAI_MODEL (optional — defaults to gpt-4o-mini)
 *
 * This lets the same codebase run locally (ZAI SDK) and on Vercel (any OpenAI-compatible API).
 */

import "server-only";

let zaiInstance: Awaited<ReturnType<typeof import("z-ai-web-dev-sdk").default.create>> | null = null;
let zaiAvailable = true;

async function getZai() {
  if (!zaiAvailable) return null;
  if (!zaiInstance) {
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      zaiInstance = await ZAI.create();
    } catch {
      zaiAvailable = false;
      return null;
    }
  }
  return zaiInstance;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface VisionContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/**
 * Text chat completion. Uses ZAI SDK if available, else OpenAI-compatible fetch.
 */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  // Try ZAI SDK first (works on the Z.ai sandbox)
  const zai = await getZai();
  if (zai) {
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    const content = completion.choices?.[0]?.message?.content ?? "";
    if (content) return content;
  }

  // Fallback: OpenAI-compatible API
  return openAIChatCompletion(messages);
}

/**
 * Vision chat completion (for image analysis). Uses ZAI SDK if available, else OpenAI-compatible fetch.
 */
export async function visionCompletion(
  content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>,
): Promise<string> {
  // Try ZAI SDK first
  const zai = await getZai();
  if (zai) {
    try {
      const response = await zai.chat.completions.createVision({
        messages: [{ role: "user", content }],
        thinking: { type: "disabled" },
      });
      const content_text = response.choices?.[0]?.message?.content ?? "";
      if (content_text) return content_text;
    } catch {
      // Fall through to OpenAI
    }
  }

  // Fallback: OpenAI-compatible vision API
  return openAIVisionCompletion(content);
}

/**
 * Page reader. Uses ZAI SDK's page_reader function if available, else direct fetch + HTML parsing.
 * Returns { title, text, url } or throws.
 */
export async function readPage(url: string): Promise<{ title: string; text: string; url: string }> {
  // Try ZAI SDK first
  const zai = await getZai();
  if (zai) {
    try {
      const result = await zai.functions.invoke("page_reader", { url });
      if (result?.data?.html) {
        const html = result.data.html as string;
        return {
          title: (result.data.title as string) || "",
          text: htmlToPlainText(html).slice(0, 15000),
          url: (result.data.url as string) || url,
        };
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  // Fallback: direct fetch
  const fetchRes = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LeadProfiler/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!fetchRes.ok) {
    throw new Error(`Could not fetch page (HTTP ${fetchRes.status})`);
  }

  const html = await fetchRes.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const text = htmlToPlainText(html).slice(0, 15000);

  if (!text.trim()) {
    throw new Error("Page was fetched but no readable text content was found.");
  }

  return { title, text, url };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible fallback implementations
// ---------------------------------------------------------------------------

async function openAIChatCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No LLM available. On Vercel, set OPENAI_API_KEY env var. " +
      "Locally, the ZAI SDK is used automatically.",
    );
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new Error("OpenAI API returned empty content");
  }
  return content;
}

async function openAIVisionCompletion(
  content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No vision LLM available. On Vercel, set OPENAI_API_KEY env var with a vision-capable model.",
    );
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.4,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI Vision API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const content_text = data.choices?.[0]?.message?.content ?? "";
  if (!content_text) {
    throw new Error("OpenAI Vision API returned empty content");
  }
  return content_text;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
