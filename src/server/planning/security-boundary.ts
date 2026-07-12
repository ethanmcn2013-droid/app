import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { workspaceMembers, workspaces } from "@/server/db/schema";

type PlanningQueryExecutor = Pick<LibSQLDatabase<typeof schema>, "select">;

const workspaceOwnerSelection = {
  id: workspaces.id,
  name: workspaces.name,
  slug: workspaces.slug,
  planningPeriodId: workspaces.planningPeriodId,
  contextType: workspaces.contextType,
  primaryDate: workspaces.primaryDate,
  primaryDateLabel: workspaces.primaryDateLabel,
  activeDomain: workspaces.activeDomain,
  templateId: workspaces.templateId,
  archivedAt: workspaces.archivedAt,
};

/** Bind a workspace mutation to current owner membership at its SQL sink. */
export function workspaceOwnerMembershipCondition(
  actorUserId: string,
  workspaceId: string,
) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${workspaceMembers}
    WHERE ${workspaceMembers.workspaceId} = ${workspaceId}
      AND ${workspaceMembers.userId} = ${actorUserId}
      AND ${workspaceMembers.role} = 'owner'
  )`;
}

export async function requireWorkspaceOwnerWith(
  database: PlanningQueryExecutor,
  actorUserId: string,
  workspaceId: string,
) {
  const [workspace] = await database
    .select(workspaceOwnerSelection)
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.role, "owner"),
      ),
    )
    .limit(1);
  if (!workspace) throw new Error("Workspace not found.");
  return workspace;
}

/** Period-wide name reads remain bounded by the actor's current memberships. */
export async function listCurrentMemberWorkspaceNamesInPeriod(
  database: PlanningQueryExecutor,
  actorUserId: string,
  planningPeriodId: string,
) {
  return database
    .select({ name: workspaces.name })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaces.planningPeriodId, planningPeriodId),
      ),
    );
}
