import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getAttachmentById } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";

// node:fs isn't edge-friendly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated attachment download. Re-checks workspace membership
 * before streaming so a leaked id from another tenant is invisible:
 * mismatched / unknown / on-disk-missing all return 404 (not 403).
 * Opacity is the right default — the user shouldn't be able to probe
 * for the existence of an id they have no access to.
 *
 * Streaming uses Node's `fs.createReadStream` adapted to a Web
 * `ReadableStream` via `Readable.toWeb`, which lines up cleanly with
 * Next 16's `Response` body contract for Node-runtime route handlers.
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

  // Confirm the bytes actually exist before we promise a stream — a
  // missing file (manual cleanup, partial deploy) should look like a
  // 404 to the client too, not a half-written zero-byte response.
  let size: number;
  try {
    const s = await stat(att.storedPath);
    size = s.size;
  } catch {
    return notFound();
  }

  const nodeStream = createReadStream(att.storedPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": dispositionHeader(att.filename, att.mimeType),
      // Defense against stored XSS via user-uploaded content served from
      // this authed origin:
      //   - nosniff: the browser must honour Content-Type, never sniff a
      //     "text/plain" upload into executable text/html.
      //   - CSP default-src 'none' + sandbox: even if a file is rendered,
      //     no script/network/form/same-origin context is available, so an
      //     HTML/SVG payload can't run in the tasks origin or touch Clerk.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
      // User content — never CDN-cache it. The `id` is opaque enough
      // that browser memory cache is fine; intermediaries shouldn't
      // hold copies because authorization is per-request.
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
 * MIME types safe to render `inline` in the browser. Everything else is
 * forced to `attachment` (download) so an HTML/SVG/XML upload can never be
 * rendered as active content in this origin. SVG is deliberately EXCLUDED —
 * it is an XML document that can carry <script>.
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
 * Build a `Content-Disposition` value that respects RFC 6266: send a
 * sanitized ASCII fallback alongside a UTF-8 `filename*` parameter so
 * non-Latin filenames survive the round-trip. `inline` (browser preview)
 * is used ONLY for the safe-preview allowlist; every other type is forced
 * to `attachment` so it downloads rather than rendering.
 */
function dispositionHeader(filename: string, mimeType: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  const mode = INLINE_SAFE_MIME.has(mimeType) ? "inline" : "attachment";
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
