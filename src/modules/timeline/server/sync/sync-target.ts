import { and, eq, isNull, or } from "drizzle-orm";
import type { db } from "../db/timeline-client";
import { projects, workspaces } from "../db/timeline-schema";

export type SyncTarget = Readonly<{
  ownerUserId: string;
  workspaceSlug: string;
  projectSlug: string;
  tasksWorkspaceId: string;
}>;

/** Call inside the same owning transaction as preparation or node writes. */
export async function isCurrentSyncTarget(
  executor: Pick<typeof db, "select">,
  target: SyncTarget,
): Promise<boolean> {
  const [current] = await executor
    .select({ slug: projects.slug })
    .from(workspaces)
    .innerJoin(projects, eq(projects.workspaceSlug, workspaces.slug))
    .where(and(
      eq(workspaces.slug, target.workspaceSlug),
      eq(workspaces.ownerUserId, target.ownerUserId),
      eq(workspaces.suiteWorkspaceId, target.tasksWorkspaceId),
      eq(projects.slug, target.projectSlug),
      or(eq(projects.sourceTasksWorkspaceId, target.tasksWorkspaceId), isNull(projects.sourceTasksWorkspaceId)),
    ))
    .limit(1);
  // A null child binding can inherit the exact parent after this guard, in the
  // same transaction. This also works before normalized 0001 tables exist.
  return current !== undefined;
}
