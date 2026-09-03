import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

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

type NodeError = Error & { code?: string };

async function deleteBlobLocator(locator: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Blob storage credentials are unavailable");
  }
  const blob = await import("@vercel/blob");
  try {
    await blob.del(locator);
  } catch (error) {
    if (error instanceof blob.BlobNotFoundError) return;
    throw error;
  }
}

function exactRelativeStorageKey(storageKey: string): string {
  if (
    !storageKey ||
    storageKey.includes("\\") ||
    isAbsolute(storageKey) ||
    storageKey.startsWith("/") ||
    storageKey
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new TypeError("storageKey must be an exact relative object key");
  }
  return storageKey;
}

function exactPathInsideUploadsRoot(candidate: string): string {
  const root = resolve(uploadsRoot());
  const target = resolve(candidate);
  const fromRoot = relative(root, target);
  if (
    !fromRoot ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new TypeError("stored path must resolve inside the uploads root");
  }
  return target;
}

async function unlinkConfirmed(absPath: string): Promise<void> {
  try {
    await unlink(absPath);
  } catch (error) {
    if ((error as NodeError)?.code === "ENOENT") return;
    throw error;
  }
}

export type StoredPathDeleteTarget =
  | Readonly<{ kind: "blob"; locator: string }>
  | Readonly<{ kind: "disk"; absPath: string }>;

/** Resolve a finalized attachment locator without treating it as an object key. */
export function resolveStoredPathDeleteTarget(
  storedPath: string,
): StoredPathDeleteTarget {
  if (!storedPath || /[\u0000-\u001f\u007f]/.test(storedPath)) {
    throw new TypeError("storedPath must be an exact non-empty locator");
  }
  if (storedPath.startsWith("https://") || storedPath.startsWith("http://")) {
    return Object.freeze({ kind: "blob", locator: storedPath });
  }
  if (
    !isAbsolute(storedPath) &&
    storedPath
      .split(/[\\/]/)
      .some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError("relative stored path contains traversal segments");
  }

  // Current disk rows are absolute. Older rows used `.data/uploads/...`
  // relative to the app root. Both are accepted only when the exact resolved
  // target remains beneath uploadsRoot(); a relative object key belongs to the
  // disk-key seam below and must never be silently double-prefixed here.
  const candidate = isAbsolute(storedPath)
    ? storedPath
    : resolve(process.cwd(), storedPath);
  return Object.freeze({
    kind: "disk",
    absPath: exactPathInsideUploadsRoot(candidate),
  });
}

/**
 * Delete exactly one stored locator and report genuine storage failure.
 *
 * A missing object is success: a worker may crash after deleting bytes but
 * before retiring its durable receipt, so replay must converge. Every other
 * error is allowed to escape so that receipt remains retryable. This function
 * never derives a directory, prefix or sibling target from the stored value.
 */
export async function deleteBytesConfirmed(storedPath: string): Promise<void> {
  const target = resolveStoredPathDeleteTarget(storedPath);
  if (target.kind === "blob") {
    await deleteBlobLocator(target.locator);
    return;
  }
  await unlinkConfirmed(target.absPath);
}

/** Delete an exact Vercel Blob pathname; backend choice is not inferred. */
export async function deleteBlobPathnameConfirmed(
  pathname: string,
): Promise<void> {
  await deleteBlobLocator(exactRelativeStorageKey(pathname));
}

/** Delete an exact local-disk object key; backend choice is not inferred. */
export async function deleteDiskStorageKeyConfirmed(
  storageKey: string,
): Promise<void> {
  await unlinkConfirmed(resolveDiskStorageKeyDeleteTarget(storageKey).absPath);
}

/**
 * Delete the exact backend object addressed by a server-issued storage key.
 * Blob accepts that key directly; local development maps the same key under
 * `uploadsRoot()`. Traversal, absolute paths and separator ambiguity are
 * refused before either backend is touched.
 */
export async function deleteStorageKeyConfirmed(
  storageKey: string,
): Promise<void> {
  const target = resolveStorageKeyDeleteTarget(storageKey);
  if (target.kind === "blob") {
    await deleteBlobLocator(target.locator);
    return;
  }
  await unlinkConfirmed(target.absPath);
}

export type StorageKeyDeleteTarget =
  | Readonly<{ kind: "blob"; locator: string }>
  | Readonly<{ kind: "disk"; absPath: string }>;

/** Pure target resolution kept public so exact-key safety is testable. */
export function resolveStorageKeyDeleteTarget(
  storageKey: string,
): StorageKeyDeleteTarget {
  const exactKey = exactRelativeStorageKey(storageKey);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return Object.freeze({ kind: "blob", locator: exactKey });
  }
  if (process.env.VERCEL === "1") {
    throw new Error("Blob storage credentials are unavailable");
  }

  return resolveDiskStorageKeyDeleteTarget(exactKey);
}

/** Pure disk-key resolution, deliberately independent of current env vars. */
export function resolveDiskStorageKeyDeleteTarget(
  storageKey: string,
): Readonly<{ kind: "disk"; absPath: string }> {
  const exactKey = exactRelativeStorageKey(storageKey);
  const root = resolve(uploadsRoot());
  const target = resolve(root, ...exactKey.split("/"));
  const fromRoot = relative(root, target);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new TypeError("storageKey escaped the uploads root");
  }
  return Object.freeze({ kind: "disk", absPath: target });
}

/**
 * Compatibility wrapper for single-row removal flows that intentionally do
 * not block their database mutation on byte-store availability. Project
 * deletion uses `deleteBytesConfirmed` behind a durable cleanup receipt.
 */
export async function deleteBytes(storedPath: string): Promise<void> {
  if (!storedPath) return;
  await deleteBytesConfirmed(storedPath).catch(() => undefined);
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
