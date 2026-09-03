import "server-only";

import { eq, inArray, like, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  activities,
  attachments,
  comments,
  driveFolderGrants,
  entitlements,
  meta,
  notifications,
  pendingInvites,
  projectDriveOperations,
  resources,
  shareLinkVisits,
  shareLinks,
  suiteOutbox,
  tasks,
  workspaceEvents,
  workspaceMembers,
  workspaceSponsorships,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

type ProjectRowsExecutor = Pick<
  LibSQLDatabase<typeof schema>,
  "delete" | "select"
>;

/**
 * Remove every local row owned by one Project, leaves first.
 *
 * This function deliberately has no provider dependency. A Drive resource is
 * only a local metadata pointer here: deleting it never trashes or deletes the
 * person's provider-owned file or folder. The caller owns the surrounding
 * writer transaction and deletes the workspace row itself after this returns.
 */
export async function deleteProjectRowsInTransaction(
  transaction: ProjectRowsExecutor,
  workspaceId: string,
): Promise<readonly string[]> {
  const taskRows = await transaction
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId));
  const taskIds = taskRows.map((row) => row.id);
  const byTaskOrWorkspace = (
    taskColumn: SQLiteColumn,
    workspaceColumn: SQLiteColumn,
  ) =>
    or(
      taskIds.length > 0 ? inArray(taskColumn, taskIds) : undefined,
      eq(workspaceColumn, workspaceId),
    )!;

  // `attachments` is the legacy Signal-owned byte table. Drive uploads live
  // in `resources` and are provider-owned, so their `storedPath` values must
  // never enter this cleanup list. Carry the native locators out of the writer
  // transaction before their rows disappear; the caller deletes bytes only
  // after the database commit succeeds.
  const attachmentRows = await transaction
    .select({ storedPath: attachments.storedPath })
    .from(attachments)
    .where(byTaskOrWorkspace(attachments.taskId, attachments.workspaceId));
  const signalAttachmentStoredPaths = Object.freeze([
    ...new Set(
      attachmentRows
        .map((row) => row.storedPath)
        .filter((storedPath): storedPath is string => storedPath.length > 0),
    ),
  ]);

  const links = await transaction
    .select({ token: shareLinks.token })
    .from(shareLinks)
    .where(eq(shareLinks.workspaceId, workspaceId));
  if (links.length > 0) {
    await transaction
      .delete(shareLinkVisits)
      .where(inArray(shareLinkVisits.token, links.map((row) => row.token)));
  }
  await transaction
    .delete(shareLinks)
    .where(eq(shareLinks.workspaceId, workspaceId));

  await transaction
    .delete(activities)
    .where(byTaskOrWorkspace(activities.taskId, activities.workspaceId));
  await transaction
    .delete(comments)
    .where(byTaskOrWorkspace(comments.taskId, comments.workspaceId));
  await transaction
    .delete(attachments)
    .where(byTaskOrWorkspace(attachments.taskId, attachments.workspaceId));
  await transaction
    .delete(notifications)
    .where(byTaskOrWorkspace(notifications.taskId, notifications.workspaceId));

  await transaction
    .delete(resources)
    .where(byTaskOrWorkspace(resources.taskId, resources.workspaceId));
  await transaction.delete(tasks).where(eq(tasks.workspaceId, workspaceId));
  await transaction
    .delete(entitlements)
    .where(eq(entitlements.workspaceId, workspaceId));
  await transaction
    .delete(pendingInvites)
    .where(eq(pendingInvites.workspaceId, workspaceId));
  await transaction
    .delete(workspaceEvents)
    .where(eq(workspaceEvents.workspaceId, workspaceId));
  await transaction
    .delete(workspaceSponsorships)
    .where(eq(workspaceSponsorships.workspaceId, workspaceId));
  await transaction
    .delete(suiteOutbox)
    .where(eq(suiteOutbox.workspaceId, workspaceId));
  await transaction.delete(meta).where(like(meta.key, `board:${workspaceId}:%`));

  // RESTRICT-backed storage metadata is consumed only after all resources.
  // Provider connections are intentionally not Project rows and survive.
  await transaction
    .delete(driveFolderGrants)
    .where(eq(driveFolderGrants.workspaceId, workspaceId));
  await transaction
    .delete(projectDriveOperations)
    .where(eq(projectDriveOperations.workspaceId, workspaceId));
  await transaction
    .delete(workspaceStorage)
    .where(eq(workspaceStorage.workspaceId, workspaceId));
  await transaction
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return signalAttachmentStoredPaths;
}
