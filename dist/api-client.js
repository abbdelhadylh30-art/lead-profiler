export class ApiError extends Error {
    status;
    body;
    constructor(status, body, message) {
        super(message ??
            (typeof body === "object" && body !== null && "error" in body
                ? String(body.error)
                : `lead-profiler API error (HTTP ${status})`));
        this.status = status;
        this.body = body;
        this.name = "ApiError";
    }
}
async function post(cfg, path, body) {
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": `lead-profiler-mcp/${cfg.version ?? "0.1.0"}`,
    };
    if (cfg.apiKey) {
        headers["x-api-key"] = cfg.apiKey;
        headers["Authorization"] = `Bearer ${cfg.apiKey}`;
    }
    let res;
    try {
        res = await fetch(`${cfg.baseUrl}${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(cfg.timeoutMs),
        });
    }
    catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
            throw new ApiError(408, { error: `Request to ${path} timed out after ${cfg.timeoutMs}ms` }, `Request to ${path} timed out after ${Math.round(cfg.timeoutMs / 1000)}s. Increase with --timeout-ms or LEAD_PROFILER_TIMEOUT_MS.`);
        }
        throw new ApiError(502, { error: `Could not reach lead-profiler at ${cfg.baseUrl}` }, `Could not reach lead-profiler at ${cfg.baseUrl} (${err instanceof Error ? err.message : "network error"}). Check --url / LEAD_PROFILER_URL.`);
    }
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = text;
    }
    if (!res.ok) {
        if (res.status === 401) {
            throw new ApiError(401, data, "lead-profiler rejected the request: missing/invalid API key. Set LEAD_PROFILER_API_KEY (or --api-key).");
        }
        throw new ApiError(res.status, data);
    }
    return data;
}
export function profileStep(cfg, req) {
    return post(cfg, "/api/profile-lead", req);
}
export function readPortfolio(cfg, url) {
    return post(cfg, "/api/read-portfolio", { url });
}
export function analyzeLeadImages(cfg, images) {
    return post(cfg, "/api/analyze-lead-images", { images });
}
export function prospectContentAudit(cfg, images) {
    return post(cfg, "/api/prospect-content-audit", { images });
}
