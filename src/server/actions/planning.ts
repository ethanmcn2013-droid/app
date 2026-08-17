"use server";

import { createHash, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  sql,
} from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  planningOnboardingSessions,
  planningPeriods,
  tasks,
  workspaceMembers,
  workspaceSponsorships,
  workspaces,
  type PlanningOnboardingState,
} from "@/server/db/schema";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getCurrentUser,
} from "@/server/auth";
import {
  requirePlanningPeriodOwner,
  requireWorkspaceOwner,
  requireWorkspaceOwnerInTransaction,
} from "@/server/planning/authorization";
import { listCurrentMemberWorkspaceNamesInPeriod } from "@/server/planning/security-boundary";
import {
  PROJECT_ACTIVE_DOMAIN,
  PROJECT_PRIMARY_USE_CASE,
  createProject,
  deleteProject,
  duplicateProject,
  duplicateProjectIntoPeriodTx,
  moveProjectToPeriod,
  reorderProject,
  setProjectArchived,
  slugifyProjectName,
  type ProjectDuplicationChoices,
} from "@/server/projects/service";
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
import { extendCoupleAccessForWeddingDate } from "@/server/db/couple-access-term";
import { requirePlanningFeature } from "@/server/planning/flags";
import { isDemoMode } from "@/lib/access-mode";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
 * Archive a project (workspace). Non-destructive: `archivedAt` set so the
 * project drops out of the active projects tree while its tasks, members,
 * and history stay intact. Restore brings it back.
 *
 * Thin adapter over the consolidated service (WP6): the service proves
 * `manageProject` — the same owner/co-owner population the old flat
 * owner-role check admitted — writes with a receipt, and revalidates.
 */
export async function archiveProjectAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const actorUserId = await getCurrentUser();
  await setProjectArchived({
    actorUserId,
    projectId: workspaceId,
    archived: true,
    refusal: "Workspace not found.",
  });
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_archived", {
    source: "lifecycle",
  });
  return { ok: true };
}

/** Restore an archived project (workspace). Adapter over the service. */
export async function restoreProjectAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const actorUserId = await getCurrentUser();
  await setProjectArchived({
    actorUserId,
    projectId: workspaceId,
    archived: false,
    refusal: "Workspace not found.",
  });
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_restored", {
    source: "lifecycle",
  });
  return { ok: true };
}

/**
 * Delete a project (workspace) by id. No-undo. Thin adapter over the
 * consolidated service delete — the ONE cascade, with the E06.12 `/p/{slug}`
 * revalidation inside it, shared with Settings' deleteWorkspaceAction.
 *
 * Authorization is the service's `deleteOrTransferOwnership`: primary owner
 * only. This is stricter than the flat owner-role check this action used to
 * carry — a promoted co-owner is now refused here exactly as Settings has
 * refused them since WP3-C (see the service header's comparison table).
 *
 * If the deleted project was the active one, the active-workspace cookie is
 * cleared so the next request resolves a surviving sibling. The cookie write
 * stays HERE (D-021 — cookie consolidation is lane C's).
 */
export async function deleteProjectAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const actorUserId = await getCurrentUser();
  await deleteProject({
    actorUserId,
    projectId: workspaceId,
    refusal: "Workspace not found.",
  });
  const c = await cookies();
  if (c.get(ACTIVE_WORKSPACE_COOKIE_NAME)?.value === workspaceId) {
    c.delete(ACTIVE_WORKSPACE_COOKIE_NAME);
  }
  revalidatePlanningSurfaces();
  return { ok: true };
}

/**
 * R-015 · D-022 point 3. The wedding date is captured here, on the workspace,
 * and the sponsored couple's access term is derived from it. Writing the date
 * without recomputing the term is what left the ratified rule unimplemented on
 * the path that actually runs.
 *
 * The recompute can only move the term LATER (see
 * `extendCoupleAccessForWeddingDate`). A failure is reported and swallowed
 * rather than thrown: the couple keeps the 548-day floor they already had, and
 * failing their onboarding to fix an extension would be the worse trade.
 */
async function applyWeddingDateToCoupleAccess(
  actorUserId: string,
  weddingDate: string | null | undefined,
): Promise<void> {
  if (!weddingDate) return;
  try {
    await extendCoupleAccessForWeddingDate(db, {
      userId: actorUserId,
      weddingDate,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "extend-couple-access-for-wedding-date" },
    });
  }
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
  if (period.contextType === "wedding_season") {
    await applyWeddingDateToCoupleAccess(actorUserId, primaryDate);
  }
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
 * Thin adapter over the consolidated service's `createProject`, which
 * mirrors the single-workspace path of `insertWorkspaces` exactly (same
 * columns, slug shape, ordering, owner membership row) but supports a
 * standalone/periodless project by allowing a null `planningPeriodId`.
 * The cookie write stays here (D-021).
 */
export async function createProjectAction(
  name: string,
  planningPeriodId?: string | null,
): Promise<{ ok: true; id: string }> {
  cleanPlainText(name, "Name", 80);

  // Demo/review: synthesize an id without writing so the preview can
  // optimistically show the new project. The real DB is never touched.
  if (isDemoMode()) {
    return { ok: true, id: `ws-${randomUUID()}` };
  }

  const actorUserId = await getCurrentUser();
  const created = await createProject({ actorUserId, name, planningPeriodId });

  await selectWorkspaceCookie(created.id);
  revalidatePath("/app", "layout");
  await trackPlanningEvent(actorUserId, "workspace_bulk_created", {
    planning_period_context: created.periodContext,
    workspace_context: created.contextType,
    workspace_count: 1,
    source: "your_work",
  });
  return { ok: true, id: created.id };
}

/**
 * Move a workspace into another planning period. Adapter over the service,
 * which proves `moveIntoPlanningPeriod` on the workspace AND ownership of
 * the target period — the stricter intersection of the old flat check and
 * the WP2 capability model (see the service header for the named co-owner
 * tightening).
 */
export async function moveWorkspaceAction(input: {
  workspaceId: string;
  targetPlanningPeriodId: string;
  position?: number;
}): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const moved = await moveProjectToPeriod({
    actorUserId,
    projectId: input.workspaceId,
    targetPlanningPeriodId: input.targetPlanningPeriodId,
    position: input.position,
    refusal: "Workspace not found.",
  });
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_moved", {
    workspace_context: moved.contextType,
    planning_period_context: moved.targetContextType,
    source: "lifecycle",
  });
  return { ok: true };
}

/** Reorder a workspace inside its group. Adapter over the service. */
export async function reorderWorkspaceAction(
  workspaceId: string,
  position: number,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  await reorderProject({
    actorUserId,
    projectId: workspaceId,
    position,
    refusal: "Workspace not found.",
  });
  revalidatePlanningSurfaces();
  return { ok: true };
}

/**
 * The Your Work archive pair. Same service operation as the sidebar's
 * `archiveProjectAction`/`restoreProjectAction` — one implementation, one
 * capability check — behind this surface's feature flag and analytics.
 */
export async function archiveWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const archived = await setProjectArchived({
    actorUserId,
    projectId: workspaceId,
    archived: true,
    refusal: "Workspace not found.",
  });
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_archived", {
    workspace_context: archived.contextType,
    source: "lifecycle",
  });
  return { ok: true };
}

export async function restoreWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  requirePlanningFeature("planningPeriods");
  const actorUserId = await getCurrentUser();
  const restored = await setProjectArchived({
    actorUserId,
    projectId: workspaceId,
    archived: false,
    refusal: "Workspace not found.",
  });
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_restored", {
    workspace_context: restored.contextType,
    source: "lifecycle",
  });
  return { ok: true };
}

export type WorkspaceDuplicationChoices = ProjectDuplicationChoices;

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

/**
 * Duplicate a workspace into a planning period. Adapter over the service,
 * which proves `manageProject` on the source — re-proved inside the copying
 * transaction, the same discipline `requireWorkspaceOwnerInTransaction`
 * carried here — plus ownership of the target period. The cookie write
 * stays here (D-021).
 */
export async function duplicateWorkspaceAction(input: {
  sourceWorkspaceId: string;
  targetPlanningPeriodId: string;
  name: string;
  choices: WorkspaceDuplicationChoices;
}): Promise<{ id: string; slug: string }> {
  requirePlanningFeature("planningPeriods");
  requirePlanningFeature("lifecycleDuplication");
  const actorUserId = await getCurrentUser();
  const result = await duplicateProject({
    actorUserId,
    sourceProjectId: input.sourceWorkspaceId,
    targetPlanningPeriodId: input.targetPlanningPeriodId,
    name: input.name,
    choices: input.choices,
    refusal: "Workspace not found.",
  });
  await selectWorkspaceCookie(result.id);
  revalidatePlanningSurfaces();
  await trackPlanningEvent(actorUserId, "workspace_duplicated", {
    workspace_context: result.sourceContextType,
    planning_period_context: result.targetContextType,
    source: "lifecycle",
  });
  return { id: result.id, slug: result.slug };
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
      const workspace = await duplicateProjectIntoPeriodTx(tx, {
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
  if (period.contextType === "wedding_season") {
    await applyWeddingDateToCoupleAccess(actorUserId, primaryDate);
  }
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
    const slug = `${slugifyProjectName(name)}-${randomUUID().slice(0, 8)}`;
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
      activeDomain: PROJECT_ACTIVE_DOMAIN[input.periodContext],
      primaryUseCase: PROJECT_PRIMARY_USE_CASE[input.periodContext],
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
