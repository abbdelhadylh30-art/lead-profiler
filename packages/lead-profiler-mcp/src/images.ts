import { readFile } from "fs/promises";
import { basename, extname } from "path";
import type { ImageInput } from "./api-client.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const MAX_BYTES = 8 * 1024 * 1024;

function nameFromUrl(url: string, index: number): string {
  try {
    const u = new URL(url);
    const file = basename(u.pathname);
    return file || `image-${index}`;
  } catch {
    return `image-${index}`;
  }
}

/**
 * Accepts local file paths, http(s) URLs, and raw data: URLs, and converts
 * everything into the { dataUrl, name } shape the lead-profiler API expects.
 * Agents usually have screenshots on disk — this is the ergonomic entry point.
 */
export async function loadImageInputs(inputs: string[]): Promise<ImageInput[]> {
  const out: ImageInput[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const index = i + 1;

    // Raw data URL — pass through
    if (input.startsWith("data:")) {
      out.push({ dataUrl: input, name: `image-${index}` });
      continue;
    }

    // Remote URL — fetch and inline
    if (/^https?:\/\//i.test(input)) {
      let res: Response;
      try {
        res = await fetch(input, {
          headers: { "User-Agent": "lead-profiler-mcp/0.1.0" },
          signal: AbortSignal.timeout(30_000),
          redirect: "follow",
        });
      } catch (err) {
        throw new Error(
          `Could not fetch image ${input} (${err instanceof Error ? err.message : "network error"})`,
        );
      }
      if (!res.ok) {
        throw new Error(`Could not fetch image ${input} (HTTP ${res.status})`);
      }
      const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!contentType.startsWith("image/")) {
        throw new Error(`URL ${input} did not return an image (content-type: ${contentType || "unknown"})`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) {
        throw new Error(`Image ${input} is larger than ${MAX_BYTES / 1024 / 1024}MB`);
      }
      out.push({
        dataUrl: `data:${contentType};base64,${buf.toString("base64")}`,
        name: nameFromUrl(input, index),
      });
      continue;
    }

    // Local file path
    const ext = extname(input).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
      throw new Error(
        `Unsupported image extension '${ext}' for ${input} — supported: png, jpg, jpeg, webp, gif`,
      );
    }
    let buf: Buffer;
    try {
      buf = await readFile(input);
    } catch (err) {
      throw new Error(
        `Could not read image file ${input} (${err instanceof Error ? err.message : "unknown error"}) — pass an absolute path`,
      );
    }
    if (buf.byteLength > MAX_BYTES) {
      throw new Error(`Image ${input} is larger than ${MAX_BYTES / 1024 / 1024}MB`);
    }
    out.push({
      dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
      name: basename(input),
    });
  }

  return out;
}
