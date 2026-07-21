"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { attachments, resources, tasks } from "@/server/db/schema";
import { getAttachmentsForTask } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import type { Attachment } from "@/lib/data";
import { isDemoMode } from "@/lib/access-mode";
import { getEffectiveTier } from "@/server/db/entitlements";
import {
  getQuota,
  SERVER_UPLOAD_LIMIT_BYTES,
  WARN_THRESHOLDS,
} from "@/lib/storage-config";
import { putBytes, deleteBytes } from "@/server/storage";

/**
 * File attachment server actions.
 *
 * Storage substrate is abstracted behind src/server/storage.ts; the
 * upload action uses claim-then-verify (Opus §1.4): the metadata row
 * is inserted BEFORE bytes are written so the usage SUM is atomic.
 * If quota is exceeded or the byte write fails, the claim row is
 * deleted and no orphan bytes or rows survive.
 *
 * stored_path holds either a disk path (legacy / dev) or a blob URL
 * (https://...). The download route distinguishes by prefix.
 */

/** Mime types refused outright. Not a full antivirus pass; enough to
 *  block the obvious executable + stored-XSS shapes. */
const BLOCKED_MIME_TYPES = new Set<string>([
  "application/x-msdownload",
  "application/x-msdos-program",
  "text/x-shellscript",
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
]);

function newAttachmentId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `att-${raw.replace(/-/g, "").slice(0, 8)}`;
}

/** Strip path separators and anything outside [a-zA-Z0-9._-]. */
function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  const trimmed = cleaned.replace(/^\.+/, "");
  return trimmed.length > 0 ? trimmed : "file.bin";
}

/**
 * Compute the workspace-prefixed blob key (also used as the sub-path
 * under uploadsRoot() for disk). Format:
 *   <workspaceId>/<taskId>/<attachmentId>-<safeFilename>
 */
function buildStorageKey(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  filename: string,
): string {
  return `${workspaceId}/${taskId}/${attachmentId}-${filename}`;
}

// ── Workspace storage usage ───────────────────────────────────────────

/**
 * Sum storage bytes for a workspace, counting:
 *   - resources rows where counts_against_storage = 1
 *   - attachments rows NOT mirrored into resources (post-backfill
 *     uploads that still live only in attachments)
 *
 * This is the same union rule as listTaskResourcesAction so no bytes
 * are double-counted. Called AFTER the claim row is inserted so the
 * SUM already includes the pending upload.
 */
export async function getWorkspaceStorageUsage(
  workspaceId: string,
): Promise<number> {
  // Sum from resources (counts_against_storage=1 only).
  const resResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${resources.sizeBytes}), 0)` })
    .from(resources)
    .where(
      and(
        eq(resources.workspaceId, workspaceId),
        eq(resources.countsAgainstStorage, 1),
      ),
    );
  const fromResources = Number(resResult[0]?.total ?? 0);

  // Sum from attachments whose derived id ('res-' + att.id) is absent from resources.
  // This avoids double-counting attachments already mirrored into resources.
  const attResult = await db.get<{ total: number }>(
    sql`SELECT COALESCE(SUM(a.size_bytes), 0) AS total
        FROM attachments a
        WHERE a.workspace_id = ${workspaceId}
          AND NOT EXISTS (
            SELECT 1 FROM resources r WHERE r.id = 'res-' || a.id
          )`,
  );
  const fromAttachments = Number(attResult?.total ?? 0);

  return fromResources + fromAttachments;
}

// ── Upload action result ──────────────────────────────────────────────

export type UploadAttachmentResult = {
  attachment: Attachment;
  /** Current workspace usage in bytes after this upload. */
  usageBytes: number;
  /** Warn thresholds crossed, expressed as fraction strings e.g. "0.8". */
  warnThresholds: string[];
};

/**
 * Accept a formData.get('file') Web File, enforce quota, and persist
 * the bytes through the storage seam (Vercel Blob or local disk).
 *
 * Quota enforcement uses claim-then-verify:
 *   (a) validate per-file size limit
 *   (b) resolve tier + quota
 *   (c) INSERT metadata row (the "claim")
 *   (d) SUM workspace usage INCLUDING the claim
 *   (e) if over quota: delete claim row, return over-quota error
 *   (f) write bytes; if write fails: delete claim row, throw
 *
 * Bounded overshoot: at most one file beyond the quota can land (two
 * concurrent uploads that both passed the pre-check — one wins the
 * byte write, the other's claim is already counted in the sum).
 */
export async function uploadAttachmentAction(
  taskId: string,
  formData: FormData,
): Promise<UploadAttachmentResult> {
  if (isDemoMode()) {
    throw new Error("Attachments are read-only in demo and review mode");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("uploadAttachmentAction: no file provided");
  }
  if (file.size <= 0) {
    throw new Error("uploadAttachmentAction: empty file");
  }

  const ws = await getActiveWorkspace();
  const me = await getCurrentUser();

  // Resolve tier and quota before touching the DB.
  const tier = await getEffectiveTier(me, ws);
  const quota = getQuota(tier);
  const effectiveCap = Math.min(quota.maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES);

  if (file.size > effectiveCap) {
    throw new Error(
      `uploadAttachmentAction: file exceeds ${effectiveCap}-byte cap ` +
        `(tier ${tier}, effective cap = min(${quota.maxFileBytes}, ${SERVER_UPLOAD_LIMIT_BYTES}))`,
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `uploadAttachmentAction: mime type ${mimeType} is not allowed`,
    );
  }

  // Confirm the task belongs to the active workspace.
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent || parent.workspaceId !== ws) {
    throw new Error("uploadAttachmentAction: task not found");
  }

  const attachmentId = newAttachmentId();
  const filename = safeFilename(file.name);
  const storageKey = buildStorageKey(ws, taskId, attachmentId, filename);
  const createdAt = new Date();

  // (c) INSERT the claim row first. stored_path is a placeholder;
  // it will be updated after the byte write succeeds. We use the
  // storage key as a stable interim value so the row is non-null.
  await db.insert(attachments).values({
    id: attachmentId,
    workspaceId: ws,
    taskId,
    uploaderUserId: me,
    filename,
    storedPath: storageKey,
    mimeType,
    sizeBytes: file.size,
    createdAt,
  });

  // (d) SUM workspace usage INCLUDING the claim.
  const usageBytesAfterClaim = await getWorkspaceStorageUsage(ws);

  // (e) Over-quota check.
  if (usageBytesAfterClaim > quota.totalBytes) {
    // Delete the claim row — no orphan row survives.
    await db.delete(attachments).where(eq(attachments.id, attachmentId));
    throw new Error(
      `uploadAttachmentAction: workspace storage quota exceeded ` +
        `(usage ${usageBytesAfterClaim} bytes, limit ${quota.totalBytes} bytes, tier ${tier})`,
    );
  }

  // (f) Write bytes. If this fails, delete the claim row.
  let finalStoredPath: string;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    finalStoredPath = await putBytes(storageKey, bytes, mimeType);
  } catch (err) {
    await db.delete(attachments).where(eq(attachments.id, attachmentId));
    throw err;
  }

  // Update stored_path to the final value (blob URL or abs disk path).
  if (finalStoredPath !== storageKey) {
    await db
      .update(attachments)
      .set({ storedPath: finalStoredPath })
      .where(eq(attachments.id, attachmentId));
  }

  await recordActivity(
    taskId,
    { kind: "attach", attachmentId, filename, sizeBytes: file.size },
    { workspaceId: ws },
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "attachments" });

  // Determine which warn thresholds this upload crossed.
  const warnThresholds = WARN_THRESHOLDS.filter(
    (t) => usageBytesAfterClaim / quota.totalBytes >= t,
  ).map(String);

  return {
    attachment: {
      id: attachmentId,
      workspaceId: ws,
      taskId,
      uploaderUserId: me,
      filename,
      storedPath: finalStoredPath,
      mimeType,
      sizeBytes: file.size,
      createdAt,
    },
    usageBytes: usageBytesAfterClaim,
    warnThresholds,
  };
}

/**
 * Delete a single attachment row + best-effort remove bytes.
 * Works regardless of quota state; quota never gates deletes.
 * Routes the unlink through the storage seam (handles both blob URLs
 * and disk paths).
 */
export async function deleteAttachmentAction(
  attachmentId: string,
): Promise<void> {
  if (isDemoMode()) return;
  const ws = await getActiveWorkspace();

  const [row] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, ws),
      ),
    );
  if (!row) {
    // Opacity: don't reveal whether the id exists in another workspace.
    return;
  }

  await db.delete(attachments).where(eq(attachments.id, attachmentId));

  await deleteBytes(row.storedPath);

  await recordActivity(
    row.taskId,
    { kind: "detach", attachmentId, filename: row.filename },
    { workspaceId: ws },
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "attachments" });
}

/**
 * Read pass-through used by the detail panel to refetch the canonical
 * attachment list after a mutation. Workspace-scoped at the read
 * layer so a stale id from another tenant returns nothing.
 */
export async function listAttachmentsForTaskAction(
  taskId: string,
): Promise<Attachment[]> {
  if (isDemoMode()) return [];
  const ws = await getActiveWorkspace();
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent || parent.workspaceId !== ws) return [];
  return getAttachmentsForTask(taskId);
}
