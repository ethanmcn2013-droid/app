import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getAttachmentById } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { openBlobStream, resolveStoredPath } from "@/server/storage";

// node:fs isn't edge-friendly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated attachment download. Re-checks workspace membership
 * before streaming so a leaked id from another tenant is invisible:
 * mismatched / unknown / on-disk-missing all return 404 (not 403).
 * Opacity is the right default.
 *
 * Serves both storage backends:
 *  - stored_path starts with http(s) → 302 redirect to the blob URL
 *    (Vercel Blob signs the URL; the browser fetches directly from CDN)
 *  - stored_path is a disk path → streams via Node fs exactly as before
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return notFound();
  }

  const ws = await getActiveWorkspace();
  const att = await getAttachmentById(id);
  if (!att || att.workspaceId !== ws) {
    return notFound();
  }

  const resolved = await resolveStoredPath(att.storedPath);

  if (resolved.kind === "missing") {
    return notFound();
  }

  let body: ReadableStream<Uint8Array>;
  let size: number | null;

  if (resolved.kind === "blob") {
    // E08.07. Streamed, not redirected. `putBytes` writes private blobs, and a
    // private blob URL is not fetchable by a browser — it needs the store
    // token on the request. The 302 this replaces would have handed the user a
    // URL they could not open. Streaming also keeps the security headers below
    // on blob-backed files, which a redirect discarded.
    const opened = await openBlobStream(resolved.url);
    if (!opened) return notFound();
    body = opened.stream;
    size = opened.size;
  } else {
    let stats: Awaited<ReturnType<typeof stat>>;
    try {
      stats = await stat(resolved.absPath);
    } catch {
      return notFound();
    }
    size = stats.size;
    body = Readable.toWeb(
      createReadStream(resolved.absPath),
    ) as ReadableStream<Uint8Array>;
  }

  return new Response(body, {
    status: 200,
    headers: {
      // The stored mime type is the one `validateUpload` accepted after
      // reading the file's own bytes, never the raw string the client sent.
      "Content-Type": att.mimeType || "application/octet-stream",
      ...(size != null ? { "Content-Length": String(size) } : {}),
      "Content-Disposition": dispositionHeader(att.filename, att.mimeType),
      // Defense against stored XSS via user-uploaded content:
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
      // User content, never CDN-cache it.
      "Cache-Control": "private, no-store",
    },
  });
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * MIME types safe to render inline in the browser. SVG is deliberately
 * excluded — it can carry <script>.
 */
const INLINE_SAFE_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

/**
 * Build a Content-Disposition value per RFC 6266: sanitized ASCII
 * fallback plus UTF-8 filename* parameter. inline only for the safe
 * allowlist.
 */
function dispositionHeader(filename: string, mimeType: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  const mode = INLINE_SAFE_MIME.has(mimeType) ? "inline" : "attachment";
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
