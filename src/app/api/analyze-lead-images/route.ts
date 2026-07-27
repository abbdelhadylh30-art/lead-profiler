import { NextRequest, NextResponse } from "next/server";
import { visionCompletion } from "@/lib/llm-client";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACTION_PROMPT = `You are analyzing screenshots of a lead's social media profile to extract observation notes for a lead-profiling tool.

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

interface ImageInput { dataUrl: string; name: string; }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { images?: ImageInput[] };
    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
    }
    if (body.images.length > 8) {
      return NextResponse.json({ error: "Maximum 8 images allowed" }, { status: 400 });
    }

    const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: EXTRACTION_PROMPT },
      { type: "text", text: `\n\nI am providing ${body.images.length} screenshot(s) of a social media profile. Analyze each and extract observations per the schema above.\n\nScreenshot order:` },
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

    return NextResponse.json({ success: true, images_analyzed: body.images.length, extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze-lead-images] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
