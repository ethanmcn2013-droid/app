import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { projectDriveOperations } from "@/server/db/schema";

type ProjectDeletionFenceExecutor = Pick<typeof db, "select">;

const NONTERMINAL_DELETE_STATUSES = [
  "pending",
  "running",
  "retry_wait",
  "manual_attention",
] as const;

export const PROJECT_DELETION_IN_PROGRESS =
  "This project is being deleted. Wait for deletion to finish before changing it.";

export class ProjectDeletionInProgressError extends Error {
  readonly code = "project-deletion-in-progress" as const;

  constructor() {
    super(PROJECT_DELETION_IN_PROGRESS);
    this.name = "ProjectDeletionInProgressError";
  }
}

function canonicalProjectId(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.includes("://")
  ) {
    throw new TypeError("workspaceId must be a canonical Project id");
  }
  return value;
}

/**
 * Refuse a Project mutation once its durable deletion intent is nonterminal.
 *
 * Callers must pass the same writer transaction that will perform the guarded
 * mutation. The `project_delete` operation is therefore a database-backed
 * tombstone: either the mutation commits before deletion snapshots it, or the
 * deletion intent commits first and this assertion refuses the mutation.
 * Deletion preparation itself intentionally does not call this helper, because
 * it owns creation and resumption of the tombstone.
 */
export async function assertProjectNotDeleting(
  executor: ProjectDeletionFenceExecutor,
  workspaceIdInput: string,
): Promise<void> {
  const workspaceId = canonicalProjectId(workspaceIdInput);
  const [deletion] = await executor
    .select({ id: projectDriveOperations.id })
    .from(projectDriveOperations)
    .where(
      and(
        eq(projectDriveOperations.workspaceId, workspaceId),
        eq(projectDriveOperations.operationKind, "project_delete"),
        inArray(projectDriveOperations.status, NONTERMINAL_DELETE_STATUSES),
      ),
    )
    .limit(1);
  if (deletion) throw new ProjectDeletionInProgressError();
}
