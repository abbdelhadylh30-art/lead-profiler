import type { Config } from "./config.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(
      message ??
        (typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : `lead-profiler API error (HTTP ${status})`),
    );
    this.name = "ApiError";
  }
}

async function post<T>(cfg: Config, path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": `lead-profiler-mcp/${cfg.version ?? "0.1.0"}`,
  };
  if (cfg.apiKey) {
    headers["x-api-key"] = cfg.apiKey;
    headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError(
        408,
        { error: `Request to ${path} timed out after ${cfg.timeoutMs}ms` },
        `Request to ${path} timed out after ${Math.round(cfg.timeoutMs / 1000)}s. Increase with --timeout-ms or LEAD_PROFILER_TIMEOUT_MS.`,
      );
    }
    throw new ApiError(
      502,
      { error: `Could not reach lead-profiler at ${cfg.baseUrl}` },
      `Could not reach lead-profiler at ${cfg.baseUrl} (${err instanceof Error ? err.message : "network error"}). Check --url / LEAD_PROFILER_URL.`,
    );
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new ApiError(
        401,
        data,
        "lead-profiler rejected the request: missing/invalid API key. Set LEAD_PROFILER_API_KEY (or --api-key).",
      );
    }
    throw new ApiError(res.status, data);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

import type { LeadObservation, StepName, StepResult, UserServices, ArabicGlossaryEntry } from "./types.js";

export interface ProfileStepRequest {
  step: StepName;
  observation: LeadObservation;
  userServices?: UserServices;
  arabicGlossary?: ArabicGlossaryEntry[];
  step1?: Record<string, unknown>;
  step2?: Record<string, unknown>;
  step3a?: Record<string, unknown>;
  step3b?: Record<string, unknown>;
  step3_reconciled?: Record<string, unknown>;
  step4?: Record<string, unknown>;
  /** Optional regeneration feedback for step5 — appended as a directive when the claim gate rejected a previous attempt */
  step5_feedback?: string;
}

export function profileStep(cfg: Config, req: ProfileStepRequest): Promise<StepResult> {
  return post<StepResult>(cfg, "/api/profile-lead", req);
}

export interface PortfolioResponse {
  success: boolean;
  url: string;
  page_title: string;
  extracted: Partial<UserServices> & { extraction_notes?: string };
}

export function readPortfolio(cfg: Config, url: string): Promise<PortfolioResponse> {
  return post<PortfolioResponse>(cfg, "/api/read-portfolio", { url });
}

export interface ImageInput {
  dataUrl: string;
  name: string;
}

export interface AnalyzeImagesResponse {
  success: boolean;
  images_analyzed: number;
  extracted: Record<string, unknown>;
}

export function analyzeLeadImages(cfg: Config, images: ImageInput[]): Promise<AnalyzeImagesResponse> {
  return post<AnalyzeImagesResponse>(cfg, "/api/analyze-lead-images", { images });
}

export interface ContentAuditResponse {
  success: boolean;
  images_analyzed: number;
  audit: Record<string, unknown>;
}

export function prospectContentAudit(cfg: Config, images: ImageInput[]): Promise<ContentAuditResponse> {
  return post<ContentAuditResponse>(cfg, "/api/prospect-content-audit", { images });
}
