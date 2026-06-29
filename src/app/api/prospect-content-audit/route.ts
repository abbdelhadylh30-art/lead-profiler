import { NextRequest, NextResponse } from "next/server";
import { visionCompletion } from "@/lib/llm-client";

export const runtime = "nodejs";
export const maxDuration = 180;

const AUDIT_PROMPT = `You are a content strategy analyst. The user has uploaded screenshots of a prospect's social media posts. Your job is to audit the prospect's content and produce a structured analysis.

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

interface ImageInput { dataUrl: string; name: string; }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { images?: ImageInput[] };
    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
    }
    if (body.images.length > 12) {
      return NextResponse.json({ error: "Maximum 12 images allowed" }, { status: 400 });
    }

    const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: AUDIT_PROMPT },
      { type: "text", text: `\n\nI am providing ${body.images.length} screenshot(s) of a prospect's social media posts. Audit the content per the schema above.\n\nScreenshot order:` },
    ];
    for (const img of body.images) {
      content.push({ type: "text", text: `--- ${img.name} ---` });
      content.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }

    const content_text = await visionCompletion(content);
    if (!content_text) return NextResponse.json({ error: "VLM returned empty response" }, { status: 502 });

    let stripped = content_text.trim();
    if (stripped.startsWith("```")) {
      stripped = stripped.split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim();
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(stripped);
    } catch {
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start >= 0 && end > start) {
        extracted = JSON.parse(stripped.slice(start, end + 1));
      } else {
        return NextResponse.json({ error: "Could not parse VLM response as JSON", raw: stripped.slice(0, 500) }, { status: 502 });
      }
    }

    return NextResponse.json({ success: true, images_analyzed: body.images.length, audit: extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[prospect-content-audit] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
