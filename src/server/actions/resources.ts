"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { attachments, resources, tasks } from "@/server/db/schema";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getCurrentUser } from "@/server/auth";
import { scopeForTask } from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";
import { deleteBytes } from "@/server/storage";

// ── Provider detection ────────────────────────────────────────────────

type Provider =
  | "google_doc"
  | "google_sheet"
  | "google_slides"
  | "drive"
  | "figma"
  | "github"
  | "url";

function detectProvider(rawUrl: string): Provider {
  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(rawUrl);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return "url";
  }
  if (hostname === "docs.google.com") {
    if (pathname.startsWith("/document")) return "google_doc";
    if (pathname.startsWith("/spreadsheets")) return "google_sheet";
    if (pathname.startsWith("/presentation")) return "google_slides";
  }
  if (hostname === "drive.google.com") return "drive";
  if (hostname === "figma.com" || hostname.endsWith(".figma.com")) return "figma";
  if (hostname === "github.com") return "github";
  return "url";
}

// ── Unified resource row shape returned to the client ─────────────────

export type ResourceRow = {
  /** Stable id, either a real resources row id or 'res-' + attachment id. */
  id: string;
  taskId: string;
  workspaceId: string;
  kind: "upload" | "link";
  provider: string;
  title: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  addedByUserId: string | null;
  addedAt: number;
  accessState: string;
  countsAgainstStorage: number;
};

// ── listTaskResourcesAction ───────────────────────────────────────────

/**
 * Union read: resources rows for the task PLUS attachments rows whose
 * derived id ('res-' + attachment.id) is absent from resources. The
 * latter covers any upload made after the backfill ran but before the
 * upload path was updated to write resources directly (post-backfill
 * uploads continue writing attachments per the read-through decision).
 *
 * Result is sorted by added_at ascending.
 */
export async function listTaskResourcesAction(
  taskId: string,
): Promise<ResourceRow[]> {
  if (isDemoMode()) return [];
  const me = await getCurrentUser();

  // The task's own Project, proved openable (ADR 0001 §9). Previously this
  // compared the parent's Project against the cookie, so a task the caller may
  // genuinely read returned an empty list whenever the two disagreed —
  // indistinguishable from a task with no resources.
  const scope = await scopeForTask(taskId, me, "open");
  if (!scope.ok) return [];
  const ws = scope.ws;

  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent || parent.workspaceId !== ws) return [];

  // Fetch all resources rows for this task.
  const resourceRows = await db
    .select()
    .from(resources)
    .where(and(eq(resources.taskId, taskId), eq(resources.workspaceId, ws)));

  // Fetch attachment rows not yet mirrored into resources.
  const mirroredIds = resourceRows.map((r) => r.id);
  const allAttachments = await db
    .select()
    .from(attachments)
    .where(eq(attachments.taskId, taskId));

  const unmirroredAttachments = allAttachments.filter(
    (a) => !mirroredIds.includes(`res-${a.id}`),
  );

  const fromResources: ResourceRow[] = resourceRows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    workspaceId: r.workspaceId,
    kind: r.kind as "upload" | "link",
    provider: r.provider,
    title: r.title,
    url: r.url,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    addedByUserId: r.addedByUserId,
    addedAt: r.addedAt,
    accessState: r.accessState,
    countsAgainstStorage: r.countsAgainstStorage,
  }));

  const fromAttachments: ResourceRow[] = unmirroredAttachments.map((a) => ({
    id: `res-${a.id}`,
    taskId: a.taskId,
    workspaceId: a.workspaceId ?? ws,
    kind: "upload",
    provider: "file",
    title: a.filename,
    url: null,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    addedByUserId: a.uploaderUserId,
    addedAt: Math.floor((a.createdAt?.getTime() ?? Date.now()) / 1000),
    accessState: "legacy",
    countsAgainstStorage: 1,
  }));

  return [...fromResources, ...fromAttachments].sort(
    (a, b) => a.addedAt - b.addedAt,
  );
}

// ── addLinkResourceAction ─────────────────────────────────────────────

/**
 * Add an external link resource to a task. Validates http(s) URL,
 * detects provider from hostname/path, inserts synchronously with
 * access_state='ok'. No external fetch of any kind.
 */
export async function addLinkResourceAction(
  taskId: string,
  url: string,
  title?: string,
): Promise<ResourceRow[]> {
  if (isDemoMode()) return [];
  const me = await getCurrentUser();
  const scope = await scopeForTask(taskId, me);
  if (!scope.ok) {
    throw new Error("addLinkResourceAction: task not found");
  }
  const ws = scope.ws;

  // Validate URL — must be http or https.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("addLinkResourceAction: invalid URL");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("addLinkResourceAction: URL must use http or https");
  }

  // Workspace guard: confirm the task belongs to this tenant.
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  if (!parent) {
    throw new Error("addLinkResourceAction: task not found");
  }

  const provider = detectProvider(url);
  const resolvedTitle = title?.trim() || url;
  const resourceId = newResourceId();
  const addedAt = Math.floor(Date.now() / 1000);

  await db.insert(resources).values({
    id: resourceId,
    workspaceId: ws,
    taskId,
    kind: "link",
    provider,
    title: resolvedTitle,
    url,
    addedByUserId: me,
    addedAt,
    accessState: "ok",
    countsAgainstStorage: 0,
  });

  await recordActivity(
    taskId,
    { kind: "resourceAdd", resourceId, provider, title: resolvedTitle },
    { workspaceId: ws, userId: me },
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "resources" });

  return listTaskResourcesAction(taskId);
}

// ── removeResourceAction ──────────────────────────────────────────────

/**
 * Remove a resource by its unified id.
 *
 * Cases:
 *  1. id found in resources table as kind='upload': delete the resources
 *     row AND the backing attachments row + best-effort file unlink.
 *  2. id found in resources table as kind='link': delete the resources row.
 *  3. id starts with 'res-' and NOT in resources (unmirrored attachment):
 *     delete the attachments row + best-effort file unlink.
 *
 * No runtime FK cascade — hand-rolled explicitly (mirrors removeTaskAction
 * and account-erasure.ts patterns).
 */
export async function removeResourceAction(
  resourceId: string,
): Promise<void> {
  if (isDemoMode()) return;
  const me = await getCurrentUser();

  // Two storage shapes reach this action: a resources row, and an unmirrored
  // attachment whose id is this one minus its "res-" prefix. Establish which
  // task owns the target before deciding anything about it — a miss in the
  // first shape is not yet an answer.
  //
  // isolation-ok: this read is by primary key and deliberately carries no
  // tenant predicate. It discovers the owning task so the task's Project can
  // be proved below; nothing is returned to the caller and nothing is deleted
  // on the strength of it.
  const [resourceCandidate] = await db
    .select({ taskId: resources.taskId })
    .from(resources)
    .where(eq(resources.id, resourceId));

  const backingAttachmentId = resourceId.startsWith("res-")
    ? resourceId.slice(4)
    : null;
  // isolation-ok: same reasoning, for the unmirrored-attachment shape.
  const [attachmentCandidate] =
    resourceCandidate || !backingAttachmentId
      ? []
      : await db
          .select({ taskId: attachments.taskId })
          .from(attachments)
          .where(eq(attachments.id, backingAttachmentId));

  const owningTaskId =
    resourceCandidate?.taskId ?? attachmentCandidate?.taskId ?? null;
  if (!owningTaskId) return;

  // The proof, once, before either branch deletes anything. It is a separate
  // statement rather than another `AND workspace_id = ?` precisely because
  // both branches below are destructive and an empty result must never be the
  // thing that decides one may proceed.
  const scope = await scopeForTask(owningTaskId, me);
  if (!scope.ok) return; // same silence for "not yours" as for "not there"
  const ws = scope.ws;

  const [resourceRow] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, resourceId), eq(resources.workspaceId, ws)));

  if (resourceRow) {
    const taskId = resourceRow.taskId;
    const title = resourceRow.title;

    // A Drive row owns metadata here and bytes in the storage owner's Drive.
    // Removing it from Signal Studio must never turn into a provider delete or
    // accidentally interpret its id as an `attachments` id. Drive deletion is
    // a separate, explicit owner operation and is deliberately absent.
    if (resourceRow.kind === "upload" && resourceRow.storage !== "drive") {
      // Delete the backing attachments row too.
      // The backing attachment id is resourceId with leading 'res-' stripped.
      const attachmentId = resourceId.startsWith("res-")
        ? resourceId.slice(4)
        : null;

      if (attachmentId) {
        const [attRow] = await db
          .select({ storedPath: attachments.storedPath })
          .from(attachments)
          .where(
            and(eq(attachments.id, attachmentId), eq(attachments.workspaceId, ws)),
          );

        await db
          .delete(attachments)
          .where(eq(attachments.id, attachmentId));

        if (attRow?.storedPath) {
          await deleteBytes(attRow.storedPath);
        }
      }
    }

    await db.delete(resources).where(eq(resources.id, resourceId));

    await recordActivity(
      taskId,
      { kind: "resourceRemove", resourceId, title },
      { workspaceId: ws },
    );

    revalidatePath("/app", "layout");
    emitTasksChanged({ kind: "resources" });
    return;
  }

  // Not in resources. If the id looks like an unmirrored attachment
  // ('res-' prefix but only in attachments), handle it directly.
  if (resourceId.startsWith("res-")) {
    const attachmentId = resourceId.slice(4);
    const [attRow] = await db
      .select()
      .from(attachments)
      .where(
        and(eq(attachments.id, attachmentId), eq(attachments.workspaceId, ws)),
      );

    if (!attRow) return; // Opacity: don't reveal cross-tenant existence.

    await db
      .delete(attachments)
      .where(eq(attachments.id, attachmentId));

    await deleteBytes(attRow.storedPath);

    await recordActivity(
      attRow.taskId,
      { kind: "resourceRemove", resourceId, title: attRow.filename },
      { workspaceId: ws },
    );

    revalidatePath("/app", "layout");
    emitTasksChanged({ kind: "resources" });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function newResourceId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `res-${raw.replace(/-/g, "").slice(0, 12)}`;
}
