import "server-only";

import { eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  activities,
  attachments,
  comments,
  notifications,
  resources,
  tasks,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { assertProjectNotDeleting } from "./project-deletion-fence";
import {
  assertNoPendingNativeUploads,
  deleteNativeAttachmentRowsInTransaction,
} from "@/server/attachments/native-upload-custody";

const SQLITE_BIND_BATCH_SIZE = 400;

function batchesOf<T>(values: readonly T[]): readonly (readonly T[])[] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += SQLITE_BIND_BATCH_SIZE) {
    batches.push(values.slice(index, index + SQLITE_BIND_BATCH_SIZE));
  }
  return batches;
}

type ProjectTaskGraphDb = LibSQLDatabase<typeof schema>;
export type ProjectTaskGraphWriter = Pick<
  ProjectTaskGraphDb,
  "delete" | "get" | "insert" | "run" | "select" | "update"
>;

export type ProjectTaskGraphReplacement<T> = (
  transaction: ProjectTaskGraphWriter,
) => Promise<T>;

/**
 * Replace every task-owned row in one Project inside the caller's IMMEDIATE
 * transaction. The Project-delete tombstone, native writer drain, exact byte
 * receipts, child-row deletion and replacement mutation therefore have one
 * commit boundary under both FK-enabled and FK-disabled SQLite connections.
 */
export async function replaceWorkspaceTaskGraphInTransaction<T>(
  transaction: ProjectTaskGraphWriter,
  input: Readonly<{
    workspaceId: string;
    replace: ProjectTaskGraphReplacement<T>;
  }>,
): Promise<
  Readonly<{ cleanupReceiptKeys: readonly string[]; replacement: T }>
> {
  const workspaceId = input.workspaceId;
  await assertProjectNotDeleting(transaction, workspaceId);

  const taskRows = await transaction
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId));
  const taskIds = taskRows.map((row) => row.id);

  const cleanupReceiptKeys = [
    ...(await assertNoPendingNativeUploads(transaction, workspaceId)),
  ];
  const attachmentIds = new Set(
    (
      await transaction
        .select({ id: attachments.id })
        .from(attachments)
        .where(eq(attachments.workspaceId, workspaceId))
    ).map((row) => row.id),
  );
  for (const taskIdBatch of batchesOf(taskIds)) {
    for (const row of await transaction
      .select({ id: attachments.id })
      .from(attachments)
      .where(inArray(attachments.taskId, taskIdBatch))) {
      attachmentIds.add(row.id);
    }
  }
  cleanupReceiptKeys.push(
    ...(
      await deleteNativeAttachmentRowsInTransaction(transaction, {
        workspaceId,
        attachmentIds: [...attachmentIds],
      })
    ).cleanupReceiptKeys,
  );

  // Workspace predicates catch denormalized rows, while the chunked task-id
  // predicates retain legacy NULL/mismatched workspace lineage without ever
  // exceeding SQLite's bind-variable ceiling.
  await transaction
    .delete(activities)
    .where(eq(activities.workspaceId, workspaceId));
  await transaction
    .delete(comments)
    .where(eq(comments.workspaceId, workspaceId));
  await transaction
    .delete(notifications)
    .where(eq(notifications.workspaceId, workspaceId));
  await transaction
    .delete(resources)
    .where(eq(resources.workspaceId, workspaceId));
  for (const taskIdBatch of batchesOf(taskIds)) {
    await transaction
      .delete(activities)
      .where(inArray(activities.taskId, taskIdBatch));
    await transaction
      .delete(comments)
      .where(inArray(comments.taskId, taskIdBatch));
    await transaction
      .delete(notifications)
      .where(inArray(notifications.taskId, taskIdBatch));
    await transaction
      .delete(resources)
      .where(inArray(resources.taskId, taskIdBatch));
  }
  await transaction.delete(tasks).where(eq(tasks.workspaceId, workspaceId));

  const replacement = await input.replace(transaction);
  return Object.freeze({
    cleanupReceiptKeys: Object.freeze(cleanupReceiptKeys),
    replacement,
  });
}
