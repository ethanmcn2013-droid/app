"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { attachments } from "@/server/db/schema";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getCurrentUser } from "@/server/auth";
import { scopeForTask } from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";
import { SNIFF_BYTES } from "@/lib/upload-validation";
import { finalizeNativeUploadClaimInTransaction } from "@/server/attachments/native-upload-custody";
import {
  cleanupAbandonedNativeUploadClaim,
  cleanupRejectedNativeUpload,
} from "@/server/attachments/native-upload-cleanup";
import {
  isApprovedVercelBlobUrl,
  isWorldReadable,
  pathnameMatchesClaim,
  verifyBlobContents,
  type BlobVerdict,
} from "@/server/attachments/verify-upload";

/**
 * Finishing an upload that the browser wrote straight to Vercel Blob.
 *
 * The browser calls this with an attachment id and a blob URL. Neither is
 * evidence. This action re-proves the caller on the attachment's own
 * Project, then proves the blob is the object we issued a token for, is
 * not world-readable, is the size the store says it is, and carries bytes
 * that match its declared type. Rejected bytes enter durable cleanup custody,
 * while the claim marker remains through the presigned writer's drain margin.
 */

export type FinalizeUploadResult =
  | { ok: true; attachmentId: string }
  | { ok: false; reason: string };

export async function finalizeUpload(
  attachmentId: string,
  blobUrl: string,
): Promise<FinalizeUploadResult> {
  // Hard rule §2.10.
  if (isDemoMode()) return { ok: false, reason: "demo" };

  const me = await getCurrentUser();

  // isolation-ok: by primary key and deliberately without a tenant
  // predicate. This read only discovers which Project owns the claim; it
  // returns nothing to the caller and authorizes nothing. The proof is
  // the `scopeForTask` below, and every write waits for it.
  const [row] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId));
  if (!row?.workspaceId) return { ok: false, reason: "not-found" };

  // ADR 0001 §9, object operation: the claim's own task decides.
  const scope = await scopeForTask(row.taskId, me);
  if (!scope.ok || scope.ws !== row.workspaceId) {
    return { ok: false, reason: "not-found" };
  }
  // Only the person who opened the claim may close it. Two members
  // uploading to the same task hold two different claims, and neither
  // should be able to complete the other's.
  if (row.uploaderUserId !== me) return { ok: false, reason: "not-found" };

  // An exact replay can arrive after the first finalizer committed but before
  // the browser observed its response. It has already passed fresh Project
  // authorization and uploader ownership above; return the persisted result
  // without probing the store or recording a second activity.
  if (
    row.storedPath === blobUrl &&
    isApprovedVercelBlobUrl(row.storedPath)
  ) {
    return { ok: true, attachmentId };
  }

  // The claim's stored_path still holds the pathname the token was minted
  // for; the URL only replaces it once everything below passes.
  const expectedPathname = row.storedPath;
  if (!pathnameMatchesClaim(blobUrl, expectedPathname)) {
    // The supplied URL is not trusted cleanup authority. The exact expected
    // pathname remains fenced through the server-issued PUT's drain margin,
    // then its expiry path takes cleanup custody before releasing the row.
    return { ok: false, reason: "pathname-mismatch" };
  }

  if (await isWorldReadable(blobUrl)) {
    await cleanupRejectedNativeUpload({
      workspaceId: row.workspaceId,
      attachmentId,
      pathname: expectedPathname,
      storedPath: blobUrl,
    });
    return { ok: false, reason: "world-readable" };
  }

  const verdict = await inspectBlob(blobUrl, row.mimeType, row.sizeBytes);
  if (!verdict.ok) {
    await cleanupRejectedNativeUpload({
      workspaceId: row.workspaceId,
      attachmentId,
      pathname: expectedPathname,
      storedPath: blobUrl,
    });
    return { ok: false, reason: verdict.reason };
  }

  let finalization: Awaited<
    ReturnType<typeof finalizeNativeUploadClaimInTransaction>
  >;
  try {
    finalization = await db.transaction(
      (transaction) =>
        finalizeNativeUploadClaimInTransaction(transaction, {
          workspaceId: row.workspaceId!,
          attachmentId,
          pathname: expectedPathname,
          uploaderUserId: me,
          finalStoredPath: blobUrl,
          // The type STORED is the one the bytes earned, never the label the
          // browser sent; the download route serves this value directly.
          mimeType: verdict.mimeType,
          sizeBytes: verdict.sizeBytes,
        }),
      { behavior: "immediate" },
    );
  } catch {
    await cleanupRejectedNativeUpload({
      workspaceId: row.workspaceId,
      attachmentId,
      pathname: expectedPathname,
      storedPath: blobUrl,
    });
    return { ok: false, reason: "not-found" };
  }
  if (finalization === "lost") {
    await cleanupRejectedNativeUpload({
      workspaceId: row.workspaceId,
      attachmentId,
      pathname: expectedPathname,
      storedPath: blobUrl,
    });
    return { ok: false, reason: "not-found" };
  }
  if (finalization === "already-completed") {
    return { ok: true, attachmentId };
  }

  await recordActivity(
    row.taskId,
    {
      kind: "attach",
      attachmentId,
      filename: row.filename,
      sizeBytes: verdict.sizeBytes,
    },
    { workspaceId: row.workspaceId },
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "attachments" });

  return { ok: true, attachmentId };
}

/**
 * Drop claims whose uploads never finished.
 *
 * A claim row is inserted before the browser is allowed to write a byte,
 * and `getWorkspaceStorageUsage` counts it — that is what makes the quota
 * check atomic. It also means a browser that is closed mid-upload leaves a
 * row holding space for a file that does not exist, and unlike the old
 * server-action path there is no `catch` on the server that can clean it
 * up: the failure happens in the browser, or in the network between the
 * browser and the store.
 *
 * So the client sweeps. This runs when an upload fails and before a fresh
 * one starts, and removes only the caller's OWN unfinished claims on this
 * task that are old enough to be certainly dead. `STALE_CLAIM_MS` is the
 * prefilter for obviously stale candidates. The marker's database-clock
 * custody deadline is the final authority that keeps an admitted PUT from
 * deleting its own row.
 *
 * A finalized attachment is never touched: its `stored_path` is a URL, a
 * claim's is still the pathname. Removing a real attachment is
 * `deleteAttachmentAction`'s job and asks first.
 */
const STALE_CLAIM_MS = 60 * 60 * 1000; // an hour of upload is enough for 50 MB

export async function abandonStaleUploads(taskId: string): Promise<number> {
  // Hard rule §2.10.
  if (isDemoMode()) return 0;
  const me = await getCurrentUser();

  // ADR 0001 §9, object operation — the task's own Project decides, before
  // anything is read on its behalf and long before anything is deleted.
  const scope = await scopeForTask(taskId, me);
  if (!scope.ok) return 0;
  const ws = scope.ws;

  const rows = await db
    .select()
    .from(attachments)
    .where(
      and(eq(attachments.taskId, taskId), eq(attachments.workspaceId, ws)),
    );

  const cutoff = Date.now() - STALE_CLAIM_MS;
  let removed = 0;
  for (const row of rows) {
    if (row.uploaderUserId !== me) continue;
    if (/^https?:\/\//.test(row.storedPath)) continue;
    if (row.createdAt instanceof Date && row.createdAt.getTime() > cutoff) {
      continue;
    }
    const released = await cleanupAbandonedNativeUploadClaim({
      workspaceId: ws,
      attachmentId: row.id,
      storageKey: row.storedPath,
      onlyAfterCustodyDeadline: true,
    });
    if (released) removed += 1;
  }

  if (removed > 0) {
    revalidatePath("/app", "layout");
    emitTasksChanged({ kind: "attachments" });
  }
  return removed;
}

/**
 * Read the blob's own metadata and leading bytes back out of the store.
 *
 * Only `SNIFF_BYTES` are consumed and the stream is then cancelled, so
 * verifying a 50 MB file costs sixteen bytes of egress rather than fifty
 * megabytes of it.
 */
async function inspectBlob(
  blobUrl: string,
  declaredMimeType: string,
  declaredSize: number,
): Promise<BlobVerdict> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, reason: "missing", detail: "no store configured" };
  }

  let opened: Awaited<ReturnType<typeof openBlob>>;
  try {
    opened = await openBlob(blobUrl);
  } catch {
    return { ok: false, reason: "missing", detail: "store unreachable" };
  }
  if (!opened) return { ok: false, reason: "missing", detail: "not in store" };

  return verifyBlobContents({
    declaredMimeType,
    declaredSize,
    claimedSize: opened.size,
    openLeadingBytes: () => readLeading(opened.stream, SNIFF_BYTES),
  });
}

async function openBlob(
  blobUrl: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  const { get } = await import("@vercel/blob");
  const result = await get(blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return { stream: result.stream, size: result.blob.size ?? 0 };
}

async function readLeading(
  stream: ReadableStream<Uint8Array>,
  n: number,
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < n) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    // Sixteen bytes are enough; do not pull the rest of the file.
    await reader.cancel().catch(() => {});
  }
  if (total === 0) return null;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out.subarray(0, Math.min(n, total));
}
