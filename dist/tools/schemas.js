import { z } from "zod";
/**
 * Zod schemas shared by the step tool and the full-profile orchestrator.
 * Every field carries a rich description — MCP clients surface these to the
 * calling agent, so the descriptions ARE the interface documentation.
 */
export const observationSchema = z
    .object({
    lead_name: z.string().describe("Name of the lead / their business as publicly known, e.g. 'Krishna's Kitchen'"),
    profession: z
        .string()
        .describe("What they do, concretely — e.g. 'home-based catering & tiffin meal service owner'"),
    apparent_subculture: z
        .string()
        .describe("The sub-culture/community the lead visibly belongs to — e.g. 'Gujarati immigrant small-business community, Etobicoke GTA' or 'Gulf Arab women-owned beauty sector, Jeddah'"),
    westernization_signals: z
        .string()
        .describe("How westernized they appear in language and branding — e.g. 'English-first captions, Western SaaS aesthetic' or 'Arabic-first, Gulf dialect, no Latin script'"),
    digital_presence_audit: z
        .object({
        has_website: z
            .enum(["yes", "no", "weak"])
            .describe("'no' only if verified (e.g. no domain resolves); 'weak' = parked/placeholder/outdated"),
        website_notes: z
            .string()
            .optional()
            .describe("Evidence for the website verdict — e.g. 'all 5 candidate domains NXDOMAIN'"),
        has_booking_or_payment_link: z
            .enum(["yes", "no"])
            .describe("Any visible booking/payment/ordering link in bio or ads"),
        booking_notes: z.string().optional().describe("How orders actually happen — e.g. 'WhatsApp DM only'"),
        has_google_reviews: z.enum(["yes", "no"]).describe("Google Business profile with reviews found?"),
        google_reviews_notes: z.string().optional().describe("Evidence or 'no profile found'"),
        primary_call_to_action: z
            .enum(["dm", "call", "link", "none", "other"])
            .describe("The lead's dominant CTA across ads/profile"),
        competitor_digital_presence: z
            .string()
            .optional()
            .describe("A SPECIFIC competitor's stronger presence — only if verified. Never invent competitors"),
        customer_complaint_pattern: z
            .string()
            .optional()
            .describe("Recurring complaint pattern visible in comments — only if literally observed"),
    })
        .describe("Factual inventory of the lead's digital presence. Every entry must be verified — this drives cost-of-absence hooks"),
    observation_notes: z
        .object({
        pace: z.string().describe("Posting frequency, reply speed, Story cadence — 2-3 sentences, or 'not observed'"),
        people_orientation: z.string().describe("Tone of captions and replies — warmth, formality, emoji use, personal address forms"),
        content_shape: z.string().describe("Types of posts, production quality, content mix"),
        engagement: z.string().describe("Comment volume, reply behavior, visible complaints — or 'not observed'"),
        self_presentation: z.string().describe("Face visible? professional vs casual? brand vs personality?"),
        pressure_tells: z.string().describe("Visible stress signals, rants, inconsistencies — or 'not visible'"),
    })
        .describe("Six qualitative observation categories. 2-3 honest sentences each — 'not observed' is a valid, honest value"),
    additional_context: z
        .string()
        .optional()
        .describe("The strongest activation signals: competitor mentions, stated-but-unfulfilled intentions, customer complaint patterns. LITERAL facts only — never infer timelines or intentions"),
})
    .describe("Structured observation of the lead — the raw material the entire 7-step chain is built on. Only include what was literally observed or independently verified");
export const userServicesSchema = z
    .object({
    primary: z.string().describe("What the sender actually sells — one specific sentence"),
    secondary: z.string().optional().describe("Secondary service line, if any"),
    past_work_examples: z
        .array(z.string())
        .describe("REAL past work, each item concrete and verifiable ('Booking dashboard for a Riyadh dental clinic'). EMPTY LIST unless real examples exist — when empty, the Social Proof lever is forbidden and the chain will honestly fall back to Authority/Liking"),
    track_record: z
        .string()
        .describe("Real track record — years in market, client count, outcomes. If unknown: 'Track record not specified — fill in manually'"),
    service_depth: z.string().describe("What makes the sender's work different from a generic agency"),
})
    .describe("The SENDER's (user's) real services and track record. This is the ONLY source of social proof the opener may ever cite — never pad it");
export const glossaryEntrySchema = z
    .object({
    original: z.string().describe("The English term or bad Arabic phrase previously generated"),
    corrected: z.string().describe("The Arabic translation the user wants used instead — authoritative"),
    note: z.string().optional().describe("When this correction applies"),
    created_at: z.number().default(() => Date.now()).describe("Creation timestamp (ms)"),
})
    .describe("User-corrected Arabic translation — overrides the model's own translations");
export const glossarySchema = z
    .array(glossaryEntrySchema)
    .max(50)
    .describe("User-corrected Arabic glossary. Pass whenever the human has corrected translations in the past");
export const priorOutputSchema = z
    .record(z.string(), z.unknown())
    .describe("The parsed JSON output object of a prior step (pass it through unchanged)");
