import { analyzeLeadImages, prospectContentAudit, ApiError } from "../api-client.js";
import { loadImageInputs } from "../images.js";
import { z } from "zod";
export function registerScreenshotTools(server, cfg) {
    server.registerTool("lead_profiler_analyze_screenshots", {
        title: "Analyze lead profile screenshots",
        description: "Vision-analysis of the lead's social-media profile screenshots (max 8). Extracts ONLY what is literally visible: observation notes across 6 categories, digital presence audit, bio text, follower counts when readable. Use to cross-check your manual observations and catch what you missed — then reconcile before building the final observation.",
        inputSchema: {
            images: z
                .array(z.string())
                .min(1)
                .max(8)
                .describe("Screenshot locations — local file paths, https URLs, or data: URLs (1-8 images)"),
            manual_notes: z
                .string()
                .optional()
                .describe("Your own manual observations of the lead, to be cross-checked against the extraction"),
        },
    }, async (args) => {
        try {
            const images = await loadImageInputs(args.images);
            const res = await analyzeLeadImages(cfg, images);
            const guidance = "\n\n---\nRECONCILIATION: compare the extraction against your own observations. " +
                "Where they disagree, re-verify independently and prefer what you can confirm. " +
                "'cannot_determine' fields are honest gaps — carry them into the observation as 'not observed', never guess.";
            return {
                content: [{ type: "text", text: JSON.stringify(res, null, 2) + guidance }],
                structuredContent: res,
            };
        }
        catch (err) {
            if (err instanceof ApiError || err instanceof Error) {
                return {
                    content: [{ type: "text", text: `analyze_screenshots failed: ${err.message}` }],
                    isError: true,
                };
            }
            throw err;
        }
    });
    server.registerTool("lead_profiler_audit_content", {
        title: "Audit prospect content strategy",
        description: "Deeper vision-audit of a prospect's social posts (max 12 screenshots): content themes, visual style, posting strategy, engagement patterns, brand voice, gaps/opportunities, and a sales recommendation (should you pitch, which angle, likely DiSC). Use BEFORE deciding whether a lead is worth profiling.",
        inputSchema: {
            images: z
                .array(z.string())
                .min(1)
                .max(12)
                .describe("Screenshot locations — local file paths, https URLs, or data: URLs (1-12 images)"),
        },
    }, async (args) => {
        try {
            const images = await loadImageInputs(args.images);
            const res = await prospectContentAudit(cfg, images);
            return {
                content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
                structuredContent: res,
            };
        }
        catch (err) {
            if (err instanceof ApiError || err instanceof Error) {
                return {
                    content: [{ type: "text", text: `audit_content failed: ${err.message}` }],
                    isError: true,
                };
            }
            throw err;
        }
    });
}
