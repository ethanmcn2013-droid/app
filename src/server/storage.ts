import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Storage seam for attachment bytes.
 *
 * Backend selection (mirrors the fail-closed pattern in src/server/db/index.ts):
 *
 *  1. BLOB_READ_WRITE_TOKEN set → Vercel Blob (put/del from @vercel/blob).
 *     stored_path on the attachments row becomes the blob URL (https://...).
 *
 *  2. NOT a Vercel deployment (VERCEL env absent or not "1") → local disk.
 *     stored_path is a file-system path under uploadsRoot().
 *
 *  3. Vercel deploy, no BLOB_READ_WRITE_TOKEN → writes throw an
 *     operator-facing error naming the required operator action.
 *     Reads and deletes of existing local rows no-op gracefully so
 *     existing UI continues to work while the token is being provisioned.
 *
 * Keys for blob storage are workspace-prefixed:
 *   <workspaceId>/<taskId>/<attachmentId>-<safeFilename>
 *
 * The download route in src/app/api/attachments/[id]/route.ts
 * must serve both shapes: if stored_path starts with http(s)
 * redirect 302 to the blob URL; else stream from disk as today.
 */

// ── Backend chooser ────────────────────────────────────────────────────

type StorageBackend = "blob" | "disk" | "vercel-no-token";

export function chooseBackend(): StorageBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL === "1") return "vercel-no-token";
  return "disk";
}

// ── uploadsRoot: shared with legacy paths (do not duplicate) ──────────

export function uploadsRoot(): string {
  return join(process.cwd(), ".data", "uploads");
}

// ── Public seam ───────────────────────────────────────────────────────

/**
 * Write bytes to the chosen storage backend.
 * Returns the value to store in attachments.stored_path:
 *  - blob URL (https://...) for Vercel Blob
 *  - absolute disk path for local
 *
 * @param key   workspace-prefixed key: "<ws>/<taskId>/<id>-<safeName>"
 * @param buf   file bytes
 * @param contentType  MIME type forwarded to Vercel Blob
 */
export async function putBytes(
  key: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  const backend = chooseBackend();

  if (backend === "blob") {
    const { put } = await import("@vercel/blob");
    const result = await put(key, buf, {
      access: "private",
      contentType,
      addRandomSuffix: false,
    });
    return result.url;
  }

  if (backend === "disk") {
    const absPath = join(uploadsRoot(), key);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, buf);
    return absPath;
  }

  // vercel-no-token: operator must provision BLOB_READ_WRITE_TOKEN.
  throw new Error(
    "Storage not configured: set BLOB_READ_WRITE_TOKEN in Vercel project settings. " +
      "See content/hq/operator-todos/premium-blob-storage.md for the runbook.",
  );
}

/**
 * Delete bytes from whichever backend owns them.
 * Best-effort: errors are swallowed so the row can always be removed.
 * Handles both blob URLs and disk paths by inspecting the stored_path prefix.
 */
export async function deleteBytes(storedPath: string): Promise<void> {
  if (!storedPath) return;

  try {
    if (storedPath.startsWith("https://") || storedPath.startsWith("http://")) {
      // Blob URL — delegate to @vercel/blob del (no-op if BLOB_READ_WRITE_TOKEN absent).
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { del } = await import("@vercel/blob");
        await del(storedPath);
      }
      return;
    }

    // Disk path.
    await unlink(storedPath);
  } catch {
    // Best-effort: a missing file or missing token is not an error.
  }
}

/**
 * Given an attachments row's stored_path, say how the download route should
 * serve it: stream it off a private blob, stream it off disk, or 404.
 *
 * E08.07 — WHY THIS IS NO LONGER A REDIRECT. `putBytes` writes with
 * `access: "private"`, and a private Vercel Blob is not fetchable by URL: the
 * SDK's own type documentation says it "requires authentication to access", and
 * `get()` sets the Authorization header from `BLOB_READ_WRITE_TOKEN`. The route
 * used to answer `302 → <blob url>`, sending the browser to a URL it cannot
 * authenticate. Attachment downloads would have failed the moment the operator
 * provisioned the store, which is an open P1 on the HQ ledger
 * (`premium-blob-storage`) — so the defect had never fired and would have
 * fired on the day it was hardest to diagnose.
 *
 * Streaming through the route is also the correct posture, not just the
 * working one: the bytes only leave the server after `getActiveWorkspace()`
 * has matched the attachment's workspace, and the security headers the disk
 * path already sets now apply to blob-backed files too.
 */
export type ServeResult =
  | { kind: "blob"; url: string }
  | { kind: "disk"; absPath: string }
  | { kind: "missing" };

export async function resolveStoredPath(storedPath: string): Promise<ServeResult> {
  if (!storedPath) return { kind: "missing" };

  if (storedPath.startsWith("https://") || storedPath.startsWith("http://")) {
    return { kind: "blob", url: storedPath };
  }

  // Disk path: confirm the file exists before the route opens a stream.
  try {
    await stat(storedPath);
    return { kind: "disk", absPath: storedPath };
  } catch {
    return { kind: "missing" };
  }
}

/**
 * Open a read stream for a private blob. Returns null when the blob is gone or
 * the store is not reachable, so the route can 404 rather than 500.
 *
 * The caller MUST have already checked that the attachment belongs to the
 * requesting workspace. This function performs no authorization of its own —
 * holding the stored_path is not permission to read it.
 */
export async function openBlobStream(url: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  size: number | null;
} | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { get } = await import("@vercel/blob");
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return { stream: result.stream, size: result.blob.size ?? null };
  } catch {
    return null;
  }
}
