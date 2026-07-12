import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  planningPeriods,
  tasks,
  workspaceMembers,
  workspaceSponsorships,
  workspaces,
} from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import type {
  PlanningPeriodContext,
  WorkspaceContext,
} from "@/lib/planning/context";
import {
  projectSponsorActivation,
  type SponsorActivationDTO,
} from "@/lib/planning/sponsorship";

export type YourWorkWorkspace = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: "owner" | "member";
  contextType: WorkspaceContext;
  primaryDate: string | null;
  primaryDateLabel: string | null;
  archivedAt: Date | null;
  position: number;
  taskTotal: number;
  taskCompleted: number;
  milestoneTotal: number;
  milestoneCompleted: number;
  nextTaskTitle: string | null;
}>;

export type YourWorkPeriod = Readonly<{
  id: string;
  name: string;
  contextType: PlanningPeriodContext;
  startDate: string;
  endDate: string;
  timezone: string;
  archivedAt: Date | null;
  position: number;
  canManage: boolean;
  workspaces: readonly YourWorkWorkspace[];
}>;

export type YourWorkDTO = Readonly<{
  periods: readonly YourWorkPeriod[];
  totalWorkspaceCount: number;
  searchEnabled: boolean;
}>;

/**
 * One bounded workspace query plus one bounded period query. The workspace
 * query starts at workspace_members, so owning a period never broadens access
 * to a workspace the caller is not currently a member of.
 */
export async function listYourWorkForCurrentUser(): Promise<YourWorkDTO> {
  return listYourWorkForUser(await getCurrentUser());
}

export async function listYourWorkForUser(
  actorUserId: string,
): Promise<YourWorkDTO> {
  const [ownedPeriods, workspaceRows] = await Promise.all([
    db
      .select({
        id: planningPeriods.id,
        name: planningPeriods.name,
        contextType: planningPeriods.contextType,
        startDate: sql<string>`COALESCE(${planningPeriods.startDate}, date(${planningPeriods.createdAt}, 'unixepoch'))`,
        endDate: sql<string>`COALESCE(${planningPeriods.endDate}, date(COALESCE(${planningPeriods.startDate}, date(${planningPeriods.createdAt}, 'unixepoch')), '+1 year', '-1 day'))`,
        timezone: planningPeriods.timezone,
        archivedAt: planningPeriods.archivedAt,
        position: planningPeriods.position,
      })
      .from(planningPeriods)
      .where(eq(planningPeriods.ownerUserId, actorUserId))
      .orderBy(asc(planningPeriods.position), asc(planningPeriods.createdAt))
      .limit(200),
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
        planningPeriodId: workspaces.planningPeriodId,
        periodOwnerUserId: planningPeriods.ownerUserId,
        contextType: workspaces.contextType,
        primaryDate: workspaces.primaryDate,
        primaryDateLabel: workspaces.primaryDateLabel,
        archivedAt: workspaces.archivedAt,
        position: workspaces.position,
        taskTotal: sql<number>`COUNT(DISTINCT CASE WHEN ${tasks.parentTaskId} IS NULL THEN ${tasks.id} END)`,
        taskCompleted: sql<number>`COUNT(DISTINCT CASE WHEN ${tasks.parentTaskId} IS NULL AND ${tasks.lane} = 'done' THEN ${tasks.id} END)`,
        milestoneTotal: sql<number>`COUNT(DISTINCT CASE WHEN ${tasks.parentTaskId} IS NULL AND ${tasks.isMilestone} = 1 THEN ${tasks.id} END)`,
        milestoneCompleted: sql<number>`COUNT(DISTINCT CASE WHEN ${tasks.parentTaskId} IS NULL AND ${tasks.isMilestone} = 1 AND ${tasks.lane} = 'done' THEN ${tasks.id} END)`,
        nextTaskTitle: sql<string | null>`(
          SELECT next_task.title FROM tasks next_task
          WHERE next_task.workspace_id = ${workspaces.id}
            AND next_task.parent_task_id IS NULL
            AND next_task.lane <> 'done'
          ORDER BY CASE next_task.lane
            WHEN 'doing' THEN 0 WHEN 'review' THEN 1 ELSE 2 END,
            COALESCE(next_task.position, 1000000), next_task.created_at
          LIMIT 1
        )`,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .leftJoin(
        planningPeriods,
        eq(planningPeriods.id, workspaces.planningPeriodId),
      )
      .leftJoin(tasks, eq(tasks.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, actorUserId))
      .groupBy(
        workspaces.id,
        workspaces.name,
        workspaces.slug,
        workspaceMembers.role,
        workspaces.planningPeriodId,
        planningPeriods.ownerUserId,
        workspaces.contextType,
        workspaces.primaryDate,
        workspaces.primaryDateLabel,
        workspaces.archivedAt,
        workspaces.position,
      )
      .orderBy(asc(workspaces.position), asc(workspaces.createdAt))
      .limit(2000),
  ]);

  const grouped = new Map<string, YourWorkWorkspace[]>();
  const unassigned: YourWorkWorkspace[] = [];
  const shared: YourWorkWorkspace[] = [];

  for (const row of workspaceRows) {
    const workspace: YourWorkWorkspace = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      role: row.role,
      contextType: row.contextType,
      primaryDate: row.primaryDate,
      primaryDateLabel: row.primaryDateLabel,
      archivedAt: row.archivedAt,
      position: row.position,
      taskTotal: Number(row.taskTotal),
      taskCompleted: Number(row.taskCompleted),
      milestoneTotal: Number(row.milestoneTotal),
      milestoneCompleted: Number(row.milestoneCompleted),
      nextTaskTitle: row.nextTaskTitle,
    };
    if (row.planningPeriodId && row.periodOwnerUserId === actorUserId) {
      const list = grouped.get(row.planningPeriodId) ?? [];
      list.push(workspace);
      grouped.set(row.planningPeriodId, list);
    } else if (row.role === "member" || row.periodOwnerUserId !== actorUserId) {
      // Do not expose another owner's period name/dates merely because one
      // workspace was shared. The shared workspace itself remains available.
      shared.push(workspace);
    } else {
      unassigned.push(workspace);
    }
  }

  const periods: YourWorkPeriod[] = ownedPeriods.map((period) => ({
    ...period,
    canManage: true,
    workspaces: grouped.get(period.id) ?? [],
  }));
  if (unassigned.length > 0) {
    const horizon = fallbackHorizon();
    periods.push({
      id: "unassigned",
      name: "Active work",
      contextType: "general",
      ...horizon,
      timezone: "UTC",
      archivedAt: null,
      position: Number.MAX_SAFE_INTEGER - 1,
      canManage: false,
      workspaces: unassigned,
    });
  }
  if (shared.length > 0) {
    const horizon = fallbackHorizon();
    periods.push({
      id: "shared",
      name: "Shared with you",
      contextType: "general",
      ...horizon,
      timezone: "UTC",
      archivedAt: null,
      position: Number.MAX_SAFE_INTEGER,
      canManage: false,
      workspaces: shared,
    });
  }

  return {
    periods,
    totalWorkspaceCount: workspaceRows.length,
    searchEnabled: workspaceRows.length >= 20,
  };
}

function fallbackHorizon(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = now.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate() - 1));
  return { startDate, endDate: end.toISOString().slice(0, 10) };
}

/**
 * Trusted partner-service query. Its allowlist has no workspace name, task,
 * note, member, invitation, or public-link field. Sponsorship is not auth.
 */
export async function listSponsorActivationDTOs(
  sponsorId: string,
): Promise<readonly SponsorActivationDTO[]> {
  if (!sponsorId || sponsorId.length > 200) return [];
  const rows = await db
    .select({
      activationId: workspaceSponsorships.id,
      sponsorReference: workspaceSponsorships.sponsorRef,
      status: workspaceSponsorships.status,
      metadata: workspaceSponsorships.consentedMetadata,
      metadataVersion: workspaceSponsorships.metadataVersion,
      consentReceiptId: workspaceSponsorships.consentReceiptId,
      consentedAt: workspaceSponsorships.consentedAt,
      revokedAt: workspaceSponsorships.revokedAt,
    })
    .from(workspaceSponsorships)
    .where(eq(workspaceSponsorships.sponsorId, sponsorId))
    .orderBy(asc(workspaceSponsorships.createdAt))
    .limit(1000);
  return rows.map(projectSponsorActivation);
}
