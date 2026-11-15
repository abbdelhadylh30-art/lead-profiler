import { chatCompletion, readPage, visionCompletion } from "@/lib/llm-client";
import type { UserServices } from "@/lib/lead-profiler-types";

/**
 * Shared service functions behind the REST routes and the remote MCP endpoint
 * (src/app/api/mcp). One source of truth for the extraction prompts and the
 * LLM plumbing — routes and MCP tools/call are thin wrappers over these.
 */

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export interface ImageInput {
  dataUrl: string;
  name: string;
}

/** Strip markdown fences and parse a JSON object out of an LLM response. */
function parseLLMJson(text: string, label: string): Record<string, unknown> {
  let stripped = text.trim();
  if (stripped.startsWith("```")) {
    stripped = stripped
      .split("\n")
      .filter((l) => !l.trim().startsWith("```"))
      .join("\n")
      .trim();
  }
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new ServiceError(502, `Could not parse ${label} response as JSON`, {
      raw: stripped.slice(0, 500),
    });
  }
}

// ---------------------------------------------------------------------------
// Portfolio reading (what the SENDER sells)
// ---------------------------------------------------------------------------

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

export interface PortfolioResult {
  url: string;
  page_title: string;
  extracted: Partial<UserServices> & { extraction_notes?: string };
}

export async function readPortfolioServices(rawUrl: string): Promise<PortfolioResult> {
  if (!rawUrl) throw new ServiceError(400, "URL is required");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new ServiceError(400, "Invalid URL format");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ServiceError(400, "URL must use http or https");
  }

  let pageTitle = "";
  let plainText = "";
  try {
    const pageData = await readPage(parsedUrl.href);
    pageTitle = pageData.title;
    plainText = pageData.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new ServiceError(502, `Could not fetch page: ${msg}`);
  }

  if (!plainText.trim()) {
    throw new ServiceError(502, "Page was fetched but contained no readable text content.");
  }

  const content = await chatCompletion([
    { role: "system", content: EXTRACTION_PROMPT },
    { role: "user", content: `URL: ${parsedUrl.href}\nPage title: ${pageTitle}\n\nPage content:\n${plainText}` },
  ]);
  if (!content) throw new ServiceError(502, "LLM returned empty response");

  const extracted = parseLLMJson(content, "LLM") as Partial<UserServices> & { extraction_notes?: string };
  return { url: parsedUrl.href, page_title: pageTitle, extracted };
}

// ---------------------------------------------------------------------------
// Vision helpers (screenshot analysis / content audit)
// ---------------------------------------------------------------------------

const OBSERVATION_EXTRACTION_PROMPT = `You are analyzing screenshots of a lead's social media profile to extract observation notes for a lead-profiling tool.

The user has already scrolled through the profile manually and taken these screenshots. Your job is to extract what you can LITERALLY SEE in the images — to cross-check the user's manual observations and catch anything they might have missed.

## What to extract

Extract observations across these categories. For each, ONLY report what you can LITERALLY SEE in the screenshots. If you cannot determine something from the images, say "not visible in screenshots" — do NOT guess.

### 1. Pace signals — posting frequency, reply speed, Story frequency
### 2. People orientation — tone of captions and replies, use of emojis, personal address forms
### 3. Content shape — types of posts, production quality, content mix
### 4. Engagement style — comment count, reply patterns, visible complaints
### 5. Self-presentation — face visible? professional/casual? brand/personality?
### 6. Pressure tells — visible stress signals, rants, inconsistencies
### 7. Digital presence audit — bio link, booking/payment link, CTA, follower count

## Critical rules

- ONLY report what you can LITERALLY SEE. Do NOT infer, extrapolate, or guess.
- Quote actual text from captions/comments where possible — put quotes in "quotes".
- If you see Arabic text, transcribe it accurately and translate in parentheses.
- Do NOT invent numbers (follower counts, post counts) unless you can read them in the image.
- The user will cross-check this against their manual notes.

## Output

Return ONLY a valid JSON object. No prose, no markdown fences.

{
  "extraction_confidence": "<high | medium | low>",
  "observation_notes": {
    "pace": "<what you can see — or 'not visible in screenshots'>",
    "people_orientation": "<tone, warmth, formality>",
    "content_shape": "<types, quality, mix>",
    "engagement": "<comment patterns, reply behavior>",
    "self_presentation": "<face visible? professional/casual?>",
    "pressure_tells": "<visible stress signals — or 'not visible'>"
  },
  "digital_presence_audit": {
    "has_website": "<yes | no | cannot_determine>",
    "has_booking_or_payment_link": "<yes | no | cannot_determine>",
    "has_google_reviews": "<yes | no | cannot_determine>",
    "primary_call_to_action": "<dm | call | link | none | cannot_determine>",
    "bio_text": "<transcribe bio if visible, or 'not visible'>",
    "follower_count": "<number if visible, or 'not visible'>"
  },
  "screenshot_summary": "<one sentence per screenshot describing what it showed>",
  "what_i_could_not_determine": ["<list of things you couldn't see>"]
}`;

const CONTENT_AUDIT_PROMPT = `You are a content strategy analyst. The user has uploaded screenshots of a prospect's social media posts. Your job is to audit the prospect's content and produce a structured analysis.

This audit is for a salesperson who is deciding whether to pitch this prospect and how to approach them.

## What to analyze

### 1. Content themes — categorize into 3-5 themes with percentage estimates
### 2. Visual style — aesthetic, polish level, consistency, colors
### 3. Posting strategy — formats used, pattern, recurring series
### 4. Engagement patterns — comment volume, reply behavior, negative comments, UGC
### 5. Brand voice — tone, language register, signature phrases, audience address
### 6. Gaps and opportunities — missing content, operational pain points, digital presence gaps, services to pitch
### 7. Sales recommendation — should pitch? what angle? likely pain? rough DiSC? recommended register?

## Critical rules

- ONLY report what you can LITERALLY SEE in the screenshots. Do NOT invent metrics or follower counts unless visible.
- Quote actual caption text where possible.
- If you see Arabic text, transcribe accurately and translate in parentheses.
- Be honest about what you can't determine.
- Do NOT recommend services that aren't relevant to what you see.

## Output

Return ONLY a valid JSON object. No prose, no markdown fences.

{
  "audit_confidence": "<high | medium | low>",
  "content_themes": [
    { "theme": "<name>", "estimated_percentage": "<number>", "example_post": "<one sentence>" }
  ],
  "visual_style": {
    "description": "<one paragraph>",
    "polish_level": "<polished | semi-polished | raw>",
    "consistency": "<consistent | inconsistent>",
    "colors_or_design_notes": "<one sentence>"
  },
  "posting_strategy": {
    "formats_used": ["<carousel>", "<single image>", ...],
    "pattern": "<consistent | sporadic | campaign-based>",
    "recurring_series": ["<series 1>", ...]
  },
  "engagement_patterns": {
    "comment_volume": "<low | medium | high | cannot_determine>",
    "reply_behavior": "<one sentence>",
    "negative_comments_visible": "<yes | no>",
    "user_generated_content": "<yes | no | cannot_determine>"
  },
  "brand_voice": {
    "tone": "<one or two words>",
    "language_register": "<MSA | dialect | english | mixed>",
    "signature_phrases": ["<phrase 1>", ...],
    "audience_address": "<how they address the audience>"
  },
  "gaps_and_opportunities": {
    "missing_content": ["<gap 1>", ...],
    "operational_pain_points": ["<pain 1>", ...],
    "digital_presence_gaps": ["<gap 1>", ...],
    "services_to_pitch": ["<service 1>", ...]
  },
  "sales_recommendation": {
    "should_pitch": "<yes | no | maybe>",
    "why": "<one sentence>",
    "pitch_angle": "<one sentence>",
    "likely_pain_point": "<one sentence>",
    "rough_disc_style": "<D | i | S | C | Di | iS | SC | etc.>",
    "recommended_register": "<one sentence>"
  },
  "what_i_could_not_determine": ["<list>"]
}`;

function buildImageContent(
  systemPrompt: string,
  images: ImageInput[],
  kind: string,
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: systemPrompt },
    { type: "text", text: `\n\nI am providing ${images.length} screenshot(s) of ${kind}. Analyze each per the schema above.\n\nScreenshot order:` },
  ];
  for (const img of images) {
    content.push({ type: "text", text: `--- ${img.name} ---` });
    content.push({ type: "image_url", image_url: { url: img.dataUrl } });
  }
  return content;
}

function validateImages(images: unknown, max: number): asserts images is ImageInput[] {
  if (!Array.isArray(images) || images.length === 0) {
    throw new ServiceError(400, "At least one image is required");
  }
  if (images.length > max) {
    throw new ServiceError(400, `Maximum ${max} images allowed`);
  }
}

async function runVision(prompt: string, images: ImageInput[], kind: string): Promise<Record<string, unknown>> {
  const content_text = await visionCompletion(buildImageContent(prompt, images, kind));
  if (!content_text) throw new ServiceError(502, "VLM returned empty response");
  return parseLLMJson(content_text, "VLM");
}

export interface AnalyzeImagesResult {
  images_analyzed: number;
  extracted: Record<string, unknown>;
}

export async function analyzeLeadImages(images: unknown): Promise<AnalyzeImagesResult> {
  validateImages(images, 8);
  const extracted = await runVision(OBSERVATION_EXTRACTION_PROMPT, images, "a social media profile");
  return { images_analyzed: images.length, extracted };
}

export interface ContentAuditResult {
  images_analyzed: number;
  audit: Record<string, unknown>;
}

export async function auditProspectContent(images: unknown): Promise<ContentAuditResult> {
  validateImages(images, 12);
  const audit = await runVision(CONTENT_AUDIT_PROMPT, images, "a prospect's social media posts");
  return { images_analyzed: images.length, audit };
}
