import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  planningPeriods,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";
import { requireWorkspaceOwnerWith } from "@/server/planning/security-boundary";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function requirePlanningPeriodOwner(
  actorUserId: string,
  planningPeriodId: string,
) {
  const [period] = await db
    .select({
      id: planningPeriods.id,
      contextType: planningPeriods.contextType,
      archivedAt: planningPeriods.archivedAt,
      startDate: planningPeriods.startDate,
      endDate: planningPeriods.endDate,
      timezone: planningPeriods.timezone,
    })
    .from(planningPeriods)
    .where(
      and(
        eq(planningPeriods.id, planningPeriodId),
        eq(planningPeriods.ownerUserId, actorUserId),
      ),
    )
    .limit(1);
  if (!period) throw new Error("Planning period not found.");
  return period;
}

export async function requireWorkspaceOwner(
  actorUserId: string,
  workspaceId: string,
) {
  return requireWorkspaceOwnerWith(db, actorUserId, workspaceId);
}

/** Re-authorize inside the transaction that will read or copy protected data. */
export async function requireWorkspaceOwnerInTransaction(
  tx: DatabaseTransaction,
  actorUserId: string,
  workspaceId: string,
) {
  return requireWorkspaceOwnerWith(tx, actorUserId, workspaceId);
}

export async function requireWorkspaceMember(
  actorUserId: string,
  workspaceId: string,
) {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, actorUserId),
      ),
    )
    .limit(1);
  if (!workspace) throw new Error("Workspace not found.");
  return workspace;
}
