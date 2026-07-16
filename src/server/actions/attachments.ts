"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { db } from "@/server/db";
import { attachments, tasks } from "@/server/db/schema";
import { getAttachmentsForTask } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import type { Attachment } from "@/lib/data";
import { isDemoMode } from "@/lib/access-mode";
import { buildAttachmentStoragePath } from "@/server/attachments/storage-path";

export type PublicAttachment = Pick<
  Attachment,
  | "id"
  | "uploaderUserId"
  | "filename"
  | "mimeType"
  | "sizeBytes"
  | "createdAt"
>;

function toPublicAttachment(attachment: Attachment): PublicAttachment {
  return {
    id: attachment.id,
    uploaderUserId: attachment.uploaderUserId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
  };
}

/**
 * Local-disk file attachments. Bytes go to
 * `<repo>/.data/uploads/<workspaceId>/<taskId>/<attachmentId>-<safeFilename>`,
 * outside `public/` so the Next static handler never auto-serves them.
 * The authenticated `/api/attachments/[id]` route is the only path
 * the client uses to read the bytes.
 *
 * v1: local disk only. The API surface here (`uploadAttachmentAction`,
 * `deleteAttachmentAction`, `listAttachmentsForTaskAction`) is the
 * stable contract the future S3 / Vercel Blob swap will reimplement
 * behind. Schema, server actions, and download route are all written
 * so the storage substrate is the only thing that needs to change.
 */

/** Hard upload cap. Mirrored client-side as a UI hint; the server is
 *  the authority. */
const MAX_BYTES = 25 * 1024 * 1024;

/** Mime types we refuse outright. Not a full antivirus pass, that's
 *  a future enhancement (TODO: virus-scan via ClamAV / cloud scanner
 *  before the user-content surface goes external), but enough to
 *  reject the obvious executable shapes a user might drop in by
 *  accident. */
const BLOCKED_MIME_TYPES = new Set<string>([
  "application/x-msdownload",
  "application/x-msdos-program",
  "text/x-shellscript",
  // Script-capable document types, stored-XSS shapes if ever rendered.
  // The download route also forces these to `attachment` + nosniff + a
  // sandbox CSP; blocking at upload is the belt to that route's braces.
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
]);

/** Repository-rooted uploads dir. Resolved per call so dev (cwd
 *  = project root) and Vercel (cwd = /var/task, writable mount at
 *  /tmp) both land somewhere sensible. The user will swap the storage
 *  substrate before this surface goes multi-replica. */
function uploadsRoot(): string {
  return join(process.cwd(), ".data", "uploads");
}

function newAttachmentId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `att-${raw.replace(/-/g, "").slice(0, 8)}`;
}

/** Strip path separators and anything outside `[a-zA-Z0-9._-]`. Falls
 *  back to `file.bin` when the input collapses to empty so we never
 *  build a path with a trailing dash. */
function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Avoid a leading dot turning the file invisible / dotfile-shaped.
  const trimmed = cleaned.replace(/^\.+/, "");
  return trimmed.length > 0 ? trimmed : "file.bin";
}

/** Resolve the on-disk path for an attachment given its workspace +
 *  task + id + (already-sanitized) filename. */
function buildStoredPath(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  filename: string,
): string {
  return buildAttachmentStoragePath({
    root: uploadsRoot(),
    workspaceId,
    taskId,
    attachmentId,
    filename,
  });
}

/**
 * Accept a `formData.get('file')` Web `File`, persist the bytes under
 * the repo-rooted uploads dir, and insert the metadata row. Returns
 * the freshly-inserted `Attachment` so optimistic UI can swap its
 * placeholder out atomically.
 *
 * Validation order matches the spec: file present → size ≤ cap →
 * mime not in the blocklist → task belongs to the active workspace.
 * Failures throw so the client's `useTransition` sees a rejection and
 * can surface a toast.
 */
export async function uploadAttachmentAction(
  taskId: string,
  formData: FormData,
): Promise<PublicAttachment> {
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
  if (file.size > MAX_BYTES) {
    throw new Error(
      `uploadAttachmentAction: file exceeds ${MAX_BYTES} byte cap`,
    );
  }
  const mimeType = file.type || "application/octet-stream";
  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `uploadAttachmentAction: mime type ${mimeType} is not allowed`,
    );
  }

  const ws = await getActiveWorkspace();
  const me = await getCurrentUser();

  // Confirm the task belongs to the active workspace before we touch
  // disk. A mismatched id should look like the task doesn't exist
  // rather than reveal cross-tenant leakage.
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent || parent.workspaceId !== ws) {
    throw new Error("uploadAttachmentAction: task not found");
  }

  const attachmentId = newAttachmentId();
  const filename = safeFilename(file.name);
  const storedPath = buildStoredPath(ws, taskId, attachmentId, filename);

  await mkdir(dirname(storedPath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(storedPath, bytes);

  const createdAt = new Date();
  await db.insert(attachments).values({
    id: attachmentId,
    workspaceId: ws,
    taskId,
    uploaderUserId: me,
    filename,
    storedPath,
    mimeType,
    sizeBytes: file.size,
    createdAt,
  });

  await recordActivity(taskId, {
    kind: "attach",
    attachmentId,
    filename,
    sizeBytes: file.size,
  }, { workspaceId: ws });

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "attachments" });

  return toPublicAttachment({
    id: attachmentId,
    workspaceId: ws,
    taskId,
    uploaderUserId: me,
    filename,
    storedPath,
    mimeType,
    sizeBytes: file.size,
    createdAt,
  });
}

/**
 * Delete a single attachment row + best-effort unlink the file. The
 * disk unlink is wrapped because a missing file shouldn't keep the
 * row alive, the UI promise is "remove this", and an orphan blob is
 * preferable to an orphan row that the user can't dismiss.
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

  try {
    await unlink(row.storedPath);
  } catch (err) {
    console.warn(
      `attachments: unlink failed for ${row.storedPath}; row already removed`,
      err,
    );
  }

  await recordActivity(row.taskId, {
    kind: "detach",
    attachmentId,
    filename: row.filename,
  }, { workspaceId: ws });

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
): Promise<PublicAttachment[]> {
  if (isDemoMode()) return [];
  const ws = await getActiveWorkspace();
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent || parent.workspaceId !== ws) return [];
  return (await getAttachmentsForTask(taskId)).map(toPublicAttachment);
}

