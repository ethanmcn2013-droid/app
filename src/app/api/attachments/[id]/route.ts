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
      "Content-Disposition": dispositionHeader(att.filename),
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
 * Build a `Content-Disposition` value that respects RFC 6266: send a
 * sanitized ASCII fallback alongside a UTF-8 `filename*` parameter so
 * non-Latin filenames survive the round-trip. We use `inline` so
 * images / PDFs preview in the browser; the UI side renders an
 * explicit anchor with `download` attr when the user picks Download.
 */
function dispositionHeader(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
