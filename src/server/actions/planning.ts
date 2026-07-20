"use server";

import { createHash, randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  sql,
} from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  planningOnboardingSessions,
  planningPeriods,
  shareLinkVisits,
  shareLinks,
  tasks,
  workspaceMembers,
  workspaceSponsorships,
  workspaces,
  type PlanningOnboardingState,
} from "@/server/db/schema";
import { emitTasksChanged } from "@/server/events";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getCurrentUser,
} from "@/server/auth";
import {
  requirePlanningPeriodOwner,
  requireWorkspaceOwner,
  requireWorkspaceOwnerInTransaction,
} from "@/server/planning/authorization";
import {
  listCurrentMemberWorkspaceNamesInPeriod,
  workspaceOwnerMembershipCondition,
} from "@/server/planning/security-boundary";
import {
  cleanPlainText,
  normalizePeriodInput,
  normalizeWorkspaceContext,
  normalizeWorkspaceNames,
  optionalDate,
} from "@/lib/planning/input";
import {
  isCompatibleWorkspaceContext,
  isPlanningPeriodContext,
  type PlanningPeriodContext,
  type WorkspaceContext,
} from "@/lib/planning/context";
import { assertIanaTimeZone } from "@/lib/planning/dates";
import { trackPlanningEvent } from "@/server/planning/analytics-server";
import { detectVenueWelcome } from "@/server/db/venue-welcome";
import { requirePlanningFeature } from "@/server/planning/flags";
import { planDuplicatedTasks } from "@/lib/planning/duplication";
import { isDemoMode } from "@/lib/access-mode";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ACTIVE_DOMAIN: Readonly<Record<PlanningPeriodContext, string>> = {
  school_year: "student",
  semester: "student",
  wedding_season: "wedding",
  general: "marketing",
};

const PRIMARY_USE_CASE: Readonly<Record<PlanningPeriodContext, string>> = {
  school_year: "teacher",
  semester: "student",
  wedding_season: "wedding",
  general: "other",
};

export type PlanningPeriodMutationInput = {
  name: string;
  contextType: PlanningPeriodContext;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string;
};

export async function createPlanningPeriodAction(
  input: PlanningPeriodMutationInput,
): Promise<{ id: string }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const normalized = normalizePeriodInput(input, { requireFinite: true });
  const id = `pp-${randomUUID()}`;
  const [last] = await db
    .select({ position: planningPeriods.position })
    .from(planningPeriods)
    .where(eq(planningPeriods.ownerUserId, actorUserId))
    .orderBy(desc(planningPeriods.position))
    .limit(1);
  await db.insert(planningPeriods).values({
    id,
    ownerUserId: actorUserId,
    ...normalized,
    position: (last?.position ?? 0) + 1000,
  });
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "planning_period_created", {
    planning_period_context: normalized.contextType,
    source: "your_work",
  });
  return { id };
}

export async function renamePlanningPeriodAction(
  planningPeriodId: string,
  name: string,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  await requirePlanningPeriodOwner(actorUserId, planningPeriodId);
  await db
    .update(planningPeriods)
    .set({
      name: cleanPlainText(name, "Name", 100),
      revision: sql`${planningPeriods.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(planningPeriods.id, planningPeriodId),
        eq(planningPeriods.ownerUserId, actorUserId),
      ),
    );
  revalidatePlanningSurfaces();
  return { ok: true };
}

export async function updatePlanningPeriodAction(
  planningPeriodId: string,
  input: PlanningPeriodMutationInput,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const current = await requirePlanningPeriodOwner(actorUserId, planningPeriodId);
  const normalized = normalizePeriodInput(input, { requireFinite: true });
  if (normalized.contextType !== current.contextType) {
    throw new Error("Move workspaces before changing a planning period context.");
  }
  await db
    .update(planningPeriods)
    .set({
      ...normalized,
      revision: sql`${planningPeriods.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(planningPeriods.id, planningPeriodId),
        eq(planningPeriods.ownerUserId, actorUserId),
      ),
    );
  revalidatePlanningSurfaces();
  return { ok: true };
}

export async function archivePlanningPeriodAction(
  planningPeriodId: string,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  await requirePlanningPeriodOwner(actorUserId, planningPeriodId);
  await db
    .update(planningPeriods)
    .set({
      archivedAt: new Date(),
      revision: sql`${planningPeriods.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(planningPeriods.id, planningPeriodId),
        eq(planningPeriods.ownerUserId, actorUserId),
      ),
    );
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "planning_period_archived", {
    source: "lifecycle",
  });
  return { ok: true };
}

export async function restorePlanningPeriodAction(
  planningPeriodId: string,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  await requirePlanningPeriodOwner(actorUserId, planningPeriodId);
  await db
    .update(planningPeriods)
    .set({
      archivedAt: null,
      revision: sql`${planningPeriods.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(planningPeriods.id, planningPeriodId),
        eq(planningPeriods.ownerUserId, actorUserId),
      ),
    );
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "planning_period_restored", {
    source: "lifecycle",
  });
  return { ok: true };
}

/**
 * Archive a project (workspace). Owner-only, non-destructive: it sets
 * `archivedAt` so the project drops out of the active projects tree while
 * its tasks, members, and history stay intact. Restore brings it back.
 */
export async function archiveProjectAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const actorUserId = await getCurrentUser();
  await requireWorkspaceOwner(actorUserId, workspaceId);
  await db
    .update(workspaces)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_archived", {
    source: "lifecycle",
  });
  return { ok: true };
}

/** Restore an archived project (workspace). Owner-only; clears `archivedAt`. */
export async function restoreProjectAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const actorUserId = await getCurrentUser();
  await requireWorkspaceOwner(actorUserId, workspaceId);
  await db
    .update(workspaces)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_restored", {
    source: "lifecycle",
  });
  return { ok: true };
}

/**
 * Delete a project (workspace) by id. Owner-only, no-undo. Cascades tasks
 * and public share links/visits explicitly (legacy rows didn't all carry a
 * workspace FK — mirror of deleteWorkspaceAction). If the deleted project
 * was the active one, the active-workspace cookie is cleared so the next
 * request resolves a surviving sibling.
 */
export async function deleteProjectAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const actorUserId = await getCurrentUser();
  await requireWorkspaceOwner(actorUserId, workspaceId);
  await db.transaction(async (tx) => {
    const linkRows = await tx
      .select({ token: shareLinks.token })
      .from(shareLinks)
      .where(eq(shareLinks.workspaceId, workspaceId));
    const tokens = linkRows.map((row) => row.token);
    if (tokens.length > 0) {
      await tx
        .delete(shareLinkVisits)
        .where(inArray(shareLinkVisits.token, tokens));
    }
    await tx.delete(shareLinks).where(eq(shareLinks.workspaceId, workspaceId));
    await tx.delete(tasks).where(eq(tasks.workspaceId, workspaceId));
    await tx.delete(workspaces).where(eq(workspaces.id, workspaceId));
  });
  const c = await cookies();
  if (c.get(ACTIVE_WORKSPACE_COOKIE_NAME)?.value === workspaceId) {
    c.delete(ACTIVE_WORKSPACE_COOKIE_NAME);
  }
  revalidatePlanningSurfaces();
  emitTasksChanged({ kind: "seed" });
  return { ok: true };
}

export type BulkWorkspaceInput = {
  planningPeriodId: string;
  names: string | string[];
  contextType?: WorkspaceContext;
  primaryDate?: string | null;
  primaryDateLabel?: string | null;
};

export type BulkWorkspaceResult = {
  created: Array<{ id: string; name: string; slug: string }>;
  skipped: string[];
  inputDuplicates: readonly string[];
};

export async function bulkCreateWorkspacesAction(
  input: BulkWorkspaceInput,
): Promise<BulkWorkspaceResult> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const period = await requirePlanningPeriodOwner(
    actorUserId,
    input.planningPeriodId,
  );
  if (period.archivedAt) throw new Error("Restore this planning period first.");
  const { names, duplicates } = normalizeWorkspaceNames(input.names);
  const contextType = normalizeWorkspaceContext(
    input.contextType,
    period.contextType,
  );
  if (!isCompatibleWorkspaceContext(period.contextType, contextType)) {
    throw new Error("This workspace type does not match the planning period.");
  }
  const primaryDate = optionalDate(input.primaryDate, "primary date");
  const primaryDateLabel =
    input.primaryDateLabel == null || input.primaryDateLabel === ""
      ? null
      : cleanPlainText(input.primaryDateLabel, "Primary date label", 80);

  const existing = await listCurrentMemberWorkspaceNamesInPeriod(
    db,
    actorUserId,
    input.planningPeriodId,
  );
  const existingKeys = new Set(
    existing.map((row) => row.name.toLocaleLowerCase("en")),
  );
  const createNames = names.filter(
    (name) => !existingKeys.has(name.toLocaleLowerCase("en")),
  );
  const skipped = names.filter((name) => !createNames.includes(name));

  const created = await db.transaction(async (tx) =>
    insertWorkspaces(tx, {
      actorUserId,
      planningPeriodId: input.planningPeriodId,
      periodContext: period.contextType,
      contextType,
      names: createNames,
      primaryDate,
      primaryDateLabel,
    }),
  );
  if (created[0]) await selectWorkspaceCookie(created[0].id);
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_bulk_created", {
    planning_period_context: period.contextType,
    workspace_context: contextType,
    workspace_count: created.length,
    source: "your_work",
  });
  return { created, skipped, inputDuplicates: duplicates };
}

/**
 * Create a single workspace ("project") directly from the Projects
 * sidebar and return its id so the caller can switch to it.
 *
 * This mirrors the single-workspace path of `insertWorkspaces`
 * exactly (same columns, slug shape, ordering, owner membership row)
 * but supports a standalone/periodless project by allowing a null
 * `planningPeriodId`. When a period is passed we validate ownership
 * and inherit its context so the row shows under that period in the
 * tree; when null the workspace is a top-level periodless project
 * with the schema-default `"project"` context.
 */
export async function createProjectAction(
  name: string,
  planningPeriodId?: string | null,
): Promise<{ ok: true; id: string }> {
  const cleanName = cleanPlainText(name, "Name", 80);

  // Demo/review: synthesize an id without writing so the preview can
  // optimistically show the new project. The real DB is never touched.
  if (isDemoMode()) {
    return { ok: true, id: `ws-${randomUUID()}` };
  }

  const actorUserId = await getCurrentUser();

  // Resolve the target period (if any). Owner-check mirrors the guard
  // bulkCreateWorkspacesAction applies before inserting into a period.
  let periodContext: PlanningPeriodContext = "general";
  let contextType: WorkspaceContext = "project";
  const targetPeriodId =
    planningPeriodId == null || planningPeriodId === "" ? null : planningPeriodId;
  if (targetPeriodId) {
    const period = await requirePlanningPeriodOwner(actorUserId, targetPeriodId);
    if (period.archivedAt) throw new Error("Restore this planning period first.");
    periodContext = period.contextType;
    contextType = normalizeWorkspaceContext(undefined, period.contextType);
    if (!isCompatibleWorkspaceContext(period.contextType, contextType)) {
      throw new Error("This workspace type does not match the planning period.");
    }
  }

  const id = `ws-${randomUUID()}`;
  const slug = `${slugify(cleanName)}-${randomUUID().slice(0, 8)}`;
  const now = new Date();

  await db.transaction(async (tx) => {
    // Order the new project after the user's existing siblings in the
    // same group (a specific period, or the periodless bucket).
    const [last] = await tx
      .select({ position: workspaces.position })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, actorUserId),
          targetPeriodId
            ? eq(workspaces.planningPeriodId, targetPeriodId)
            : sql`${workspaces.planningPeriodId} IS NULL`,
        ),
      )
      .orderBy(desc(workspaces.position))
      .limit(1);
    const position = (last?.position ?? 0) + 1000;

    await tx.insert(workspaces).values({
      id,
      slug,
      name: cleanName,
      ownerUserId: actorUserId,
      planningPeriodId: targetPeriodId,
      contextType,
      position,
      activeDomain: ACTIVE_DOMAIN[periodContext],
      primaryUseCase: PRIMARY_USE_CASE[periodContext],
      onboardingCompletedAt: now,
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({
      workspaceId: id,
      userId: actorUserId,
      role: "owner",
    });
  });

  await selectWorkspaceCookie(id);
  revalidatePath("/app", "layout");
  await trackPlanningEvent(actorUserId, "workspace_bulk_created", {
    planning_period_context: periodContext,
    workspace_context: contextType,
    workspace_count: 1,
    source: "your_work",
  });
  return { ok: true, id };
}

export async function moveWorkspaceAction(input: {
  workspaceId: string;
  targetPlanningPeriodId: string;
  position?: number;
}): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const [workspace, target] = await Promise.all([
    requireWorkspaceOwner(actorUserId, input.workspaceId),
    requirePlanningPeriodOwner(actorUserId, input.targetPlanningPeriodId),
  ]);
  if (target.archivedAt) throw new Error("Restore the target period first.");
  if (!isCompatibleWorkspaceContext(target.contextType, workspace.contextType)) {
    throw new Error("This workspace type does not match the target period.");
  }
  const updated = await db
    .update(workspaces)
    .set({
      planningPeriodId: target.id,
      position: safePosition(input.position),
      revision: sql`${workspaces.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaces.id, workspace.id),
        workspaceOwnerMembershipCondition(actorUserId, workspace.id),
      ),
    )
    .returning({ id: workspaces.id });
  if (!updated[0]) throw new Error("Workspace not found.");
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_moved", {
    workspace_context: workspace.contextType,
    planning_period_context: target.contextType,
    source: "lifecycle",
  });
  return { ok: true };
}

export async function reorderWorkspaceAction(
  workspaceId: string,
  position: number,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  await requireWorkspaceOwner(actorUserId, workspaceId);
  const updated = await db
    .update(workspaces)
    .set({
      position: safePosition(position),
      revision: sql`${workspaces.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaces.id, workspaceId),
        workspaceOwnerMembershipCondition(actorUserId, workspaceId),
      ),
    )
    .returning({ id: workspaces.id });
  if (!updated[0]) throw new Error("Workspace not found.");
  revalidatePlanningSurfaces();
  return { ok: true };
}

export async function archiveWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  return setWorkspaceArchived(workspaceId, true);
}

export async function restoreWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  return setWorkspaceArchived(workspaceId, false);
}

export type WorkspaceDuplicationChoices = Readonly<{
  copyReusableTasks: boolean;
  copyTimelineStructure: boolean;
  copyCollaborators: boolean;
  copyTemplate: boolean;
}>;

export async function getWorkspaceDuplicationReviewAction(
  workspaceId: string,
): Promise<{
  workspaceId: string;
  taskCount: number;
  milestoneCount: number;
  collaboratorCount: number;
  neverCopied: readonly string[];
}> {
  requirePlanningFeature("lifecycleDuplication");
  const actorUserId = await getCurrentUser();
  await requireWorkspaceOwner(actorUserId, workspaceId);
  const counts = await db.transaction(async (tx) => {
    await requireWorkspaceOwnerInTransaction(tx, actorUserId, workspaceId);
    const [currentCounts] = await tx
      .select({
        taskCount: sql<number>`COUNT(DISTINCT ${tasks.id})`,
        milestoneCount: sql<number>`COUNT(DISTINCT CASE WHEN ${tasks.isMilestone} = 1 THEN ${tasks.id} END)`,
        collaboratorCount: sql<number>`(
          SELECT COUNT(*) FROM workspace_members members
          WHERE members.workspace_id = ${workspaceId} AND members.role = 'member'
        )`,
      })
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId));
    return currentCounts;
  });
  return {
    workspaceId,
    taskCount: Number(counts?.taskCount ?? 0),
    milestoneCount: Number(counts?.milestoneCount ?? 0),
    collaboratorCount: Number(counts?.collaboratorCount ?? 0),
    neverCopied: [
      "completion history",
      "public links",
      "pending invitations",
      "activity history",
      "attachments",
      "sponsorship",
    ],
  };
}

export async function duplicateWorkspaceAction(input: {
  sourceWorkspaceId: string;
  targetPlanningPeriodId: string;
  name: string;
  choices: WorkspaceDuplicationChoices;
}): Promise<{ id: string; slug: string }> {
  requirePlanningFeature("planningPeriods");
  requirePlanningFeature("lifecycleDuplication");
  const actorUserId = await getCurrentUser();
  const [source, target] = await Promise.all([
    requireWorkspaceOwner(actorUserId, input.sourceWorkspaceId),
    requirePlanningPeriodOwner(actorUserId, input.targetPlanningPeriodId),
  ]);
  if (target.archivedAt) throw new Error("Restore the target period first.");
  if (!isCompatibleWorkspaceContext(target.contextType, source.contextType)) {
    throw new Error("This workspace type does not match the target period.");
  }
  const result = await db.transaction(async (tx) => {
    const currentSource = await requireWorkspaceOwnerInTransaction(
      tx,
      actorUserId,
      source.id,
    );
    if (!isCompatibleWorkspaceContext(target.contextType, currentSource.contextType)) {
      throw new Error("This workspace type does not match the target period.");
    }
    return duplicateWorkspaceIntoPeriod(tx, {
      actorUserId,
      source: currentSource,
      targetPlanningPeriodId: target.id,
      name: cleanPlainText(input.name, "Name", 100),
      choices: input.choices,
    });
  });
  await selectWorkspaceCookie(result.id);
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_duplicated", {
    workspace_context: source.contextType,
    planning_period_context: target.contextType,
    source: "lifecycle",
  });
  return result;
}

export async function getPlanningPeriodDuplicationReviewAction(
  planningPeriodId: string,
): Promise<{
  planningPeriodId: string;
  workspaces: Array<{ id: string; name: string; archived: boolean }>;
  datePolicy: string;
  neverCopied: readonly string[];
}> {
  requirePlanningFeature("lifecycleDuplication");
  const actorUserId = await getCurrentUser();
  await requirePlanningPeriodOwner(actorUserId, planningPeriodId);
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      archivedAt: workspaces.archivedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaces.planningPeriodId, planningPeriodId),
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.role, "owner"),
      ),
    )
    .orderBy(asc(workspaces.position));
  return {
    planningPeriodId,
    workspaces: rows.map((row) => ({
      id: row.id,
      name: row.name,
      archived: Boolean(row.archivedAt),
    })),
    datePolicy:
      "No dates move automatically. Enter the new period dates for review; workspace primary dates remain visible and unchanged.",
    neverCopied: [
      "completion history",
      "public links",
      "pending invitations",
      "activity history",
      "attachments",
      "sponsorship",
    ],
  };
}

export async function duplicatePlanningPeriodAction(input: {
  sourcePlanningPeriodId: string;
  newPeriod: PlanningPeriodMutationInput;
  workspaceIds: string[];
  choices: WorkspaceDuplicationChoices;
}): Promise<{ planningPeriodId: string; workspaceIds: string[] }> {
  requirePlanningFeature("planningPeriods");
  requirePlanningFeature("lifecycleDuplication");
  const actorUserId = await getCurrentUser();
  const sourcePeriod = await requirePlanningPeriodOwner(
    actorUserId,
    input.sourcePlanningPeriodId,
  );
  const target = normalizePeriodInput(input.newPeriod, { requireFinite: true });
  if (target.contextType !== sourcePeriod.contextType) {
    throw new Error("A duplicated planning period keeps its context type.");
  }
  const uniqueWorkspaceIds = [...new Set(input.workspaceIds)].slice(0, 50);
  const sources = await Promise.all(
    uniqueWorkspaceIds.map((id) => requireWorkspaceOwner(actorUserId, id)),
  );
  if (
    sources.some(
      (workspace) =>
        workspace.planningPeriodId !== sourcePeriod.id || workspace.archivedAt,
    )
  ) {
    throw new Error("Choose active workspaces from the source planning period.");
  }
  const planningPeriodId = `pp-${randomUUID()}`;
  const copied = await db.transaction(async (tx) => {
    const currentSources = [];
    for (const id of uniqueWorkspaceIds) {
      currentSources.push(
        await requireWorkspaceOwnerInTransaction(tx, actorUserId, id),
      );
    }
    if (
      currentSources.some(
        (workspace) =>
          workspace.planningPeriodId !== sourcePeriod.id || workspace.archivedAt,
      )
    ) {
      throw new Error("Choose active workspaces from the source planning period.");
    }
    await tx.insert(planningPeriods).values({
      id: planningPeriodId,
      ownerUserId: actorUserId,
      ...target,
      position: 1000,
    });
    const result: string[] = [];
    for (const source of currentSources) {
      const workspace = await duplicateWorkspaceIntoPeriod(tx, {
        actorUserId,
        source,
        targetPlanningPeriodId: planningPeriodId,
        name: source.name,
        choices: input.choices,
      });
      result.push(workspace.id);
    }
    return result;
  });
  if (copied[0]) await selectWorkspaceCookie(copied[0]);
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "planning_period_created", {
    planning_period_context: target.contextType,
    workspace_count: copied.length,
    source: "lifecycle",
  });
  return { planningPeriodId, workspaceIds: copied };
}

export async function savePlanningOnboardingDraftAction(input: {
  id?: string;
  revision?: number;
  contextType: PlanningPeriodContext;
  state: PlanningOnboardingState;
}): Promise<{ id: string; revision: number }> {
  requirePlanningFeature("contextualOnboarding");
  const actorUserId = await getCurrentUser();
  if (!isPlanningPeriodContext(input.contextType)) {
    throw new Error("Unknown planning period context.");
  }
  const state = normalizeOnboardingState(input.state);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 86_400_000);
  if (input.id) {
    const revision = Number.isSafeInteger(input.revision) ? input.revision! : 1;
    const updated = await db
      .update(planningOnboardingSessions)
      .set({
        contextType: input.contextType,
        state,
        revision: revision + 1,
        updatedAt: now,
        expiresAt,
      })
      .where(
        and(
          eq(planningOnboardingSessions.id, input.id),
          eq(planningOnboardingSessions.userId, actorUserId),
          eq(planningOnboardingSessions.status, "in_progress"),
          eq(planningOnboardingSessions.revision, revision),
        ),
      )
      .returning({ id: planningOnboardingSessions.id });
    if (!updated[0]) throw new Error("This onboarding draft changed elsewhere. Reload it.");
    await trackPlanningEvent(actorUserId, "contextual_onboarding_saved", {
      planning_period_context: input.contextType,
      step: state.step,
      source: "onboarding",
      resumed: true,
    });
    return { id: input.id, revision: revision + 1 };
  }
  const id = `onboarding-${randomUUID()}`;
  await db.insert(planningOnboardingSessions).values({
    id,
    userId: actorUserId,
    contextType: input.contextType,
    state,
    expiresAt,
  });
  await trackPlanningEvent(actorUserId, "contextual_onboarding_started", {
    planning_period_context: input.contextType,
    step: state.step,
    source: "onboarding",
  });
  return { id, revision: 1 };
}

export async function getPlanningOnboardingDraftAction(): Promise<{
  id: string;
  revision: number;
  contextType: PlanningPeriodContext;
  state: PlanningOnboardingState;
} | null> {
  requirePlanningFeature("contextualOnboarding");
  const actorUserId = await getCurrentUser();
  const [draft] = await db
    .select({
      id: planningOnboardingSessions.id,
      revision: planningOnboardingSessions.revision,
      contextType: planningOnboardingSessions.contextType,
      state: planningOnboardingSessions.state,
    })
    .from(planningOnboardingSessions)
    .where(
      and(
        eq(planningOnboardingSessions.userId, actorUserId),
        eq(planningOnboardingSessions.status, "in_progress"),
        gt(planningOnboardingSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(planningOnboardingSessions.updatedAt))
    .limit(1);
  return draft ?? null;
}

export type CompleteContextualOnboardingInput = PlanningPeriodMutationInput & {
  workspaceNames: string | string[];
  workspaceContext?: WorkspaceContext;
  primaryDate?: string | null;
  primaryDateLabel?: string | null;
  draftId?: string;
  sponsor?: {
    id: string;
    consentGranted: true;
    activationLabel?: string | null;
  } | null;
};

export async function completeContextualOnboardingAction(
  input: CompleteContextualOnboardingInput,
): Promise<{ planningPeriodId: string; workspaceIds: string[] }> {
  requirePlanningFeature("contextualOnboarding");
  const actorUserId = await getCurrentUser();
  const period = normalizePeriodInput(input, { requireFinite: true });
  const { names } = normalizeWorkspaceNames(input.workspaceNames, { max: 50 });
  const workspaceContext = normalizeWorkspaceContext(
    input.workspaceContext,
    period.contextType,
  );
  if (!isCompatibleWorkspaceContext(period.contextType, workspaceContext)) {
    throw new Error("This workspace type does not match the planning period.");
  }
  if (period.contextType === "wedding_season" && names.length !== 1) {
    throw new Error("A couple starts with one private wedding workspace.");
  }
  const primaryDate = optionalDate(input.primaryDate, "primary date");
  if (period.contextType === "wedding_season" && !primaryDate) {
    throw new Error("Add the wedding date before creating this workspace.");
  }
  const primaryDateLabel =
    input.primaryDateLabel == null || input.primaryDateLabel === ""
      ? null
      : cleanPlainText(input.primaryDateLabel, "Primary date label", 80);
  const planningPeriodId = `pp-${randomUUID()}`;
  const sponsor = await normalizeSponsor(
    input.sponsor,
    period.contextType,
    actorUserId,
  );

  const created = await db.transaction(async (tx) => {
    await tx.insert(planningPeriods).values({
      id: planningPeriodId,
      ownerUserId: actorUserId,
      ...period,
      position: 1000,
    });
    const workspaceRows = await insertWorkspaces(tx, {
      actorUserId,
      planningPeriodId,
      periodContext: period.contextType,
      contextType: workspaceContext,
      names,
      primaryDate,
      primaryDateLabel,
    });
    if (sponsor && workspaceRows[0]) {
      await tx.insert(workspaceSponsorships).values({
        id: `sponsorship-${randomUUID()}`,
        workspaceId: workspaceRows[0].id,
        sponsorId: sponsor.id,
        sponsorRef: sponsor.ref,
        entitlementRef: sponsor.entitlementRef,
        consentReceiptId: sponsor.consentReceiptId,
        consentedMetadata: {
          activationLabel: sponsor.activationLabel ?? undefined,
          primaryDate: primaryDate ?? undefined,
        },
        consentedAt: new Date(),
      });
    }
    if (input.draftId) {
      await tx
        .update(planningOnboardingSessions)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
          revision: sql`${planningOnboardingSessions.revision} + 1`,
        })
        .where(
          and(
            eq(planningOnboardingSessions.id, input.draftId),
            eq(planningOnboardingSessions.userId, actorUserId),
            eq(planningOnboardingSessions.status, "in_progress"),
          ),
        );
    }
    return workspaceRows;
  });
  if (created[0]) await selectWorkspaceCookie(created[0].id);
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "contextual_onboarding_completed", {
    planning_period_context: period.contextType,
    workspace_context: workspaceContext,
    workspace_count: created.length,
    source: "onboarding",
  });
  return {
    planningPeriodId,
    workspaceIds: created.map((workspace) => workspace.id),
  };
}

async function setWorkspaceArchived(
  workspaceId: string,
  archived: boolean,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const workspace = await requireWorkspaceOwner(actorUserId, workspaceId);
  const updated = await db
    .update(workspaces)
    .set({
      archivedAt: archived ? new Date() : null,
      revision: sql`${workspaces.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaces.id, workspace.id),
        workspaceOwnerMembershipCondition(actorUserId, workspace.id),
      ),
    )
    .returning({ id: workspaces.id });
  if (!updated[0]) throw new Error("Workspace not found.");
  revalidatePlanningSurfaces();
  await trackPlanningEvent(
    actorUserId,
    archived ? "workspace_archived" : "workspace_restored",
    { workspace_context: workspace.contextType, source: "lifecycle" },
  );
  return { ok: true };
}

async function insertWorkspaces(
  tx: DatabaseTransaction,
  input: {
    actorUserId: string;
    planningPeriodId: string;
    periodContext: PlanningPeriodContext;
    contextType: WorkspaceContext;
    names: readonly string[];
    primaryDate: string | null;
    primaryDateLabel: string | null;
  },
): Promise<Array<{ id: string; name: string; slug: string }>> {
  if (input.names.length === 0) return [];
  const [last] = await tx
    .select({ position: workspaces.position })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.actorUserId),
        eq(workspaces.planningPeriodId, input.planningPeriodId),
      ),
    )
    .orderBy(desc(workspaces.position))
    .limit(1);
  const created: Array<{ id: string; name: string; slug: string }> = [];
  let position = (last?.position ?? 0) + 1000;
  const now = new Date();
  for (const name of input.names) {
    const id = `ws-${randomUUID()}`;
    const slug = `${slugify(name)}-${randomUUID().slice(0, 8)}`;
    await tx.insert(workspaces).values({
      id,
      slug,
      name,
      ownerUserId: input.actorUserId,
      planningPeriodId: input.planningPeriodId,
      contextType: input.contextType,
      primaryDate: input.primaryDate,
      primaryDateLabel: input.primaryDateLabel,
      position,
      activeDomain: ACTIVE_DOMAIN[input.periodContext],
      primaryUseCase: PRIMARY_USE_CASE[input.periodContext],
      onboardingCompletedAt: now,
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({
      workspaceId: id,
      userId: input.actorUserId,
      role: "owner",
    });
    created.push({ id, name, slug });
    position += 1000;
  }
  return created;
}

async function duplicateWorkspaceIntoPeriod(
  tx: DatabaseTransaction,
  input: {
    actorUserId: string;
    source: Awaited<ReturnType<typeof requireWorkspaceOwner>>;
    targetPlanningPeriodId: string;
    name: string;
    choices: WorkspaceDuplicationChoices;
  },
): Promise<{ id: string; slug: string }> {
  const id = `ws-${randomUUID()}`;
  const slug = `${slugify(input.name)}-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  await tx.insert(workspaces).values({
    id,
    slug,
    name: input.name,
    ownerUserId: input.actorUserId,
    planningPeriodId: input.targetPlanningPeriodId,
    contextType: input.source.contextType,
    primaryDate: input.source.primaryDate,
    primaryDateLabel: input.source.primaryDateLabel,
    activeDomain: input.source.activeDomain,
    templateId: input.choices.copyTemplate ? input.source.templateId : null,
    position: 1000,
    onboardingCompletedAt: now,
    publishedAt: null,
    updatedAt: now,
  });
  await tx.insert(workspaceMembers).values({
    workspaceId: id,
    userId: input.actorUserId,
    role: "owner",
  });

  const copiedMemberIds = new Set<string>([input.actorUserId]);
  if (input.choices.copyCollaborators) {
    const members = await tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.source.id),
          eq(workspaceMembers.role, "member"),
        ),
      );
    for (const member of members) {
      await tx.insert(workspaceMembers).values({
        workspaceId: id,
        userId: member.userId,
        role: "member",
      });
      copiedMemberIds.add(member.userId);
    }
  }

  if (input.choices.copyReusableTasks || input.choices.copyTimelineStructure) {
    const sourceTasks = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.workspaceId, input.source.id))
      .orderBy(asc(tasks.createdAt));
    const copies = planDuplicatedTasks(
      sourceTasks,
      input.choices,
      copiedMemberIds,
      () => `t-${randomUUID()}`,
    );
    for (const task of copies) {
      await tx.insert(tasks).values({
        id: task.id,
        workspaceId: id,
        title: task.title,
        description: task.description,
        lane: task.lane,
        priority: task.priority,
        assignees: task.assignees,
        due: task.due,
        dueAt: task.dueAt,
        estimate: task.estimate,
        tags: task.tags,
        recurrence: task.recurrence,
        startDay: task.startDay,
        durationDays: task.durationDays,
        position: task.position,
        parentTaskId: task.parentTaskId,
        boardColumnKey: task.boardColumnKey,
        isMilestone: task.isMilestone,
        // Explicit omissions: history, source-note provenance, contacts,
        // money, attachments, completion timestamps and public tokens.
        updatedAt: now,
      });
    }
  }
  return { id, slug };
}

function normalizeOnboardingState(
  input: PlanningOnboardingState,
): PlanningOnboardingState {
  if (!input || !["context", "period", "workspaces", "review"].includes(input.step)) {
    throw new Error("Unknown onboarding step.");
  }
  const timezone = input.timezone ?? "UTC";
  assertIanaTimeZone(timezone);
  return {
    step: input.step,
    periodName: input.periodName
      ? cleanPlainText(input.periodName, "Name", 100)
      : undefined,
    startDate: optionalDate(input.startDate, "start date") ?? undefined,
    endDate: optionalDate(input.endDate, "end date") ?? undefined,
    timezone,
    workspaceNames: input.workspaceNames
      ?.filter((value): value is string => typeof value === "string")
      .slice(0, 50)
      .map((value) => cleanPlainText(value, "Workspace name", 100)),
    primaryDate: optionalDate(input.primaryDate, "primary date") ?? undefined,
    primaryDateLabel: input.primaryDateLabel
      ? cleanPlainText(input.primaryDateLabel, "Primary date label", 80)
      : undefined,
  };
}

async function normalizeSponsor(
  sponsor: CompleteContextualOnboardingInput["sponsor"],
  context: PlanningPeriodContext,
  actorUserId: string,
) {
  if (!sponsor) return null;
  if (context !== "wedding_season") {
    throw new Error("Sponsorship is only accepted in the wedding activation flow.");
  }
  if (sponsor.consentGranted !== true) {
    throw new Error("Consent is required before sharing activation metadata.");
  }
  const verified = await detectVenueWelcome(actorUserId);
  if (!verified || verified.sponsorSlug !== sponsor.id) {
    throw new Error("The venue activation could not be verified.");
  }
  return {
    id: verified.sponsorSlug,
    ref: null,
    entitlementRef: `sha256:${createHash("sha256").update(verified.code).digest("hex")}`,
    consentReceiptId: `consent-${randomUUID()}`,
    activationLabel: sponsor.activationLabel
      ? cleanPlainText(sponsor.activationLabel, "Activation label", 100)
      : null,
  };
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "workspace"
  );
}

function safePosition(value: number | undefined): number {
  if (value === undefined) return 1000;
  if (!Number.isFinite(value)) throw new Error("Position must be a number.");
  return Math.max(-1_000_000, Math.min(1_000_000, value));
}

async function selectWorkspaceCookie(workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function revalidatePlanningSurfaces(): void {
  revalidatePath("/app", "layout");
  revalidatePath("/app/your-work");
  revalidatePath("/welcome/plan");
}
