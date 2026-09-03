import "server-only";

/**
 * The consolidated Project lifecycle service — WP6 lane D.
 *
 * ── Why this module exists ─────────────────────────────────────────────────
 *
 * Until WP6 the app had two diverged Project-management implementations
 * (WP6_SURFACE_MAP.md §7):
 *
 *  - **Path A** (`src/server/actions/planning.ts`): the sidebar / Your Work
 *    lifecycle. Flat owner-role check (`requireWorkspaceOwner`), write
 *    receipts on some ops and not others, and a delete that cascaded WITHOUT
 *    the `/p/{slug}` ISR revalidation.
 *  - **Path B** (`src/server/actions/settings.ts`): the Settings page.
 *    Capability check through the WP3 seam (`provedSettingsProject`), and a
 *    delete that DOES revalidate the published page (incident E06.12,
 *    2026-08-03) — a fix Path A lacked, so deleting the same Project from the
 *    sidebar vs Settings had different observable behaviour for a live bearer
 *    link.
 *
 * This module is the one implementation both action layers now call. The
 * actions themselves stay where they are as thin authorization-context
 * adapters: they resolve the actor and the candidate Project (explicit
 * argument or fail-closed ambient), keep their demo short-circuits, feature
 * flags, analytics, cookie writes (D-021 — cookie consolidation is lane C's,
 * untouched here) and surface-specific revalidations, and delegate every
 * decision and every write to this service.
 *
 * ── One authorization idiom ────────────────────────────────────────────────
 *
 * Every operation proves a named capability through `proveProjectCapability`
 * (the WP3 seam over `src/server/projects/capabilities.ts`). The flat
 * owner-role check and the `workspaceOwnerMembershipCondition` SQL-sink
 * filter are retired from these paths: authorization expressed as a row
 * filter makes "you may not" and "there is nothing here" the same empty
 * result (D-018). What replaces the sink condition is the write receipt —
 * every mutation returns `.returning(...)` and throws on zero rows, so a row
 * that vanished between proof and write surfaces loudly instead of
 * reporting success. Archive policy stays the codebase-wide `"defer"`
 * default; flipping enforcement is one switch in project-authz.ts, not a
 * per-call-site hunt.
 *
 * ── Per-operation authorization: old A vs old B vs consolidated ────────────
 *
 * A consolidation must never silently widen access, so each operation keeps
 * the STRICTER of the two effective behaviours. The comparison, per
 * operation:
 *
 *  | op        | Path A (planning.ts)            | Path B (settings.ts)   | consolidated |
 *  |-----------|---------------------------------|------------------------|--------------|
 *  | create    | authenticated actor; if filing  | —                      | unchanged from A. No Project exists yet, so no Project capability can apply; the period gate (`requirePlanningPeriodOwner`) is the authorization. |
 *  |           | into a period: period owner     |                        |              |
 *  | rename    | —                               | `manageProject`        | `manageProject` (= B). Same population as A's owner-role set: primary owner + co-owner. |
 *  | move      | owner-role member + owner of    | —                      | `moveIntoPlanningPeriod` + owner of the TARGET period. TIGHTENED for co-owners: the capability admits a co-owner only when they also own the Project's CURRENT period (capabilities.ts:100); a primary owner is unchanged. Under A, a co-owner owning only the target period could move; now refused. Stricter, per the model — recorded, not silent. |
 *  |           | the TARGET period               |                        |              |
 *  | reorder   | owner-role member               | —                      | `manageProject`. Identical population; decision unchanged. |
 *  | archive   | owner-role member               | —                      | `manageProject`. Identical population. (Write-shape change: the sidebar's archive now bumps `revision` like Your Work's always did — catalog consumers see the change; access unchanged.) |
 *  | restore   | owner-role member               | —                      | `manageProject`. On an archived Project the capability matrix keeps `manageProject` for owners under BOTH archive policies (capabilities.ts:83), so restore stays reachable. |
 *  | duplicate | owner-role on source, re-proved | —                      | `manageProject` on the source, re-proved INSIDE the transaction (same discipline as A, via the seam's executor parameter) + owner of the target period. Identical population. |
 *  |           | in-tx + owner of target period  |                        |              |
 *  | delete    | ANY owner-role member —         | `deleteOrTransferOwnership` | `deleteOrTransferOwnership` (= B, the stricter). TIGHTENED for the sidebar: a promoted co-owner can no longer permanently destroy a Project they were handed reversible management of. Consequence inherited from B, now true everywhere: a legacy row with NULL `owner_user_id` is deletable by nobody until the ownership backfill lands (settings.ts's delete comment, 2026-08-03). |
 *  |           | a co-owner could delete         | (primary owner only)   |              |
 *
 * TOCTOU note, named rather than discovered later: Path A's move/reorder/
 * archive additionally re-bound owner membership in the UPDATE's WHERE
 * (`workspaceOwnerMembershipCondition`). That narrowed a millisecond
 * revocation race, at the price of being exactly the authorization-as-row-
 * filter shape D-018 bans. The consolidated idiom takes the proof as its own
 * statement and the receipt as the tripwire; `duplicateProject` — the one
 * operation that READS protected data over a multi-statement span — re-proves
 * inside its transaction, which is strictly stronger than a WHERE condition.
 *
 * ── E06.12 lives here and cannot be skipped ────────────────────────────────
 *
 * `deleteProject` reads `slug` + `publishedAt` BEFORE the row is gone and
 * revalidates `/p/{slug}` after the cascade commits. Both entry points call
 * this one function; there is no second delete path left to forget the fix.
 * `src/server/published-surface-revalidation.test.mjs` pins the wiring.
 */

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { nextTaskSeq } from "@/server/db/task-seq";
import {
  shareLinkVisits,
  shareLinks,
  tasks,
  workspaceMembers,
  workspaces,
  workspaceStorage,
} from "@/server/db/schema";
import { emitTasksChanged } from "@/server/events";
import {
  proveProjectCapability,
  type ProjectCapabilityKey,
  type ProjectGrant,
} from "@/server/actions/project-authz";
import { requirePlanningPeriodOwner } from "@/server/planning/authorization";
import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";
import {
  isCompatibleWorkspaceContext,
  type PlanningPeriodContext,
  type WorkspaceContext,
} from "@/lib/planning/context";
import { cleanPlainText, normalizeWorkspaceContext } from "@/lib/planning/input";
import { planDuplicatedTasks } from "@/lib/planning/duplication";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { executeProjectDriveFolderOperation } from "@/server/connections/project-drive-folder-operation-executor";
import { prepareAccountFencedProjectDriveOperationInTransaction } from "@/server/connections/project-drive-operation-orchestrator";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The neutral refusal for callers that do not pass their own copy. Existing
 * adapters pass the exact strings they already shipped ("Workspace not
 * found.", "Only the owner can delete this workspace.", …) so no user-facing
 * message changes in this consolidation.
 */
const PROJECT_UNAVAILABLE = "That project isn’t available.";

/** The receipt failure: a proved write that matched no row. Loud, never ok. */
const RECEIPT_MISSING = "Workspace not found.";

/** Mirrors planning.ts's historical maps for periodless/period creation. */
export const PROJECT_ACTIVE_DOMAIN: Readonly<
  Record<PlanningPeriodContext, string>
> = {
  school_year: "student",
  semester: "student",
  wedding_season: "wedding",
  general: "marketing",
};

export const PROJECT_PRIMARY_USE_CASE: Readonly<
  Record<PlanningPeriodContext, string>
> = {
  school_year: "teacher",
  semester: "student",
  wedding_season: "wedding",
  general: "other",
};

/** What a duplication copies. Canonical here; planning.ts re-exports it. */
export type ProjectDuplicationChoices = Readonly<{
  copyReusableTasks: boolean;
  copyTimelineStructure: boolean;
  copyCollaborators: boolean;
  copyTemplate: boolean;
}>;

export function slugifyProjectName(value: string): string {
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

/**
 * Shape-gate an untrusted candidate and prove the named capability for it.
 * `null`/`undefined`/malformed and every seam denial collapse into the one
 * refusal string the adapter shipped — distinguishing them to a caller is an
 * existence leak (ADR 0001 §4).
 */
async function provedProject(
  actorUserId: string,
  candidateProjectId: string | null | undefined,
  capability: ProjectCapabilityKey,
  refusal: string,
): Promise<ProjectGrant> {
  if (candidateProjectId === null || candidateProjectId === undefined) {
    throw new Error(refusal);
  }
  const parsed = parseProjectId(candidateProjectId);
  if (parsed === null) throw new Error(refusal);
  const grant = await proveProjectCapability(actorUserId, parsed, capability);
  if (!grant.ok) throw new Error(refusal);
  return grant;
}

/**
 * Create a Project, optionally filed into one of the actor's Planning
 * Periods. Mirrors the single-workspace path planning.ts always wrote (same
 * columns, slug shape, ordering, owner membership row); a null period means a
 * top-level periodless Project with the schema-default `"project"` context.
 *
 * Authorization: the actor authenticated, plus — when filing into a period —
 * ownership of that period, proved by `requirePlanningPeriodOwner`. No
 * Project capability can apply before the Project exists.
 */
export async function createProject(input: {
  actorUserId: string;
  name: string;
  planningPeriodId?: string | null;
}): Promise<{
  id: string;
  slug: string;
  periodContext: PlanningPeriodContext;
  contextType: WorkspaceContext;
}> {
  const cleanName = cleanPlainText(input.name, "Name", 80);

  let periodContext: PlanningPeriodContext = "general";
  let contextType: WorkspaceContext = "project";
  const targetPeriodId =
    input.planningPeriodId == null || input.planningPeriodId === ""
      ? null
      : input.planningPeriodId;
  if (targetPeriodId) {
    const period = await requirePlanningPeriodOwner(
      input.actorUserId,
      targetPeriodId,
    );
    if (period.archivedAt) throw new Error("Restore this planning period first.");
    periodContext = period.contextType;
    contextType = normalizeWorkspaceContext(undefined, period.contextType);
    if (!isCompatibleWorkspaceContext(period.contextType, contextType)) {
      throw new Error("This workspace type does not match the planning period.");
    }
  }

  const id = `ws-${randomUUID()}`;
  const slug = `${slugifyProjectName(cleanName)}-${randomUUID().slice(0, 8)}`;
  const now = new Date();

  await db.transaction(async (tx) => {
    // Order the new Project after the actor's existing siblings in the same
    // group (a specific period, or the periodless bucket).
    const [last] = await tx
      .select({ position: workspaces.position })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, input.actorUserId),
          targetPeriodId
            ? eq(workspaces.planningPeriodId, targetPeriodId)
            : sql`${workspaces.planningPeriodId} IS NULL`,
        ),
      )
      .orderBy(desc(workspaces.position))
      .limit(1);
    const position = (last?.position ?? 0) + 1000;

    const created = await tx
      .insert(workspaces)
      .values({
        id,
        slug,
        name: cleanName,
        ownerUserId: input.actorUserId,
        planningPeriodId: targetPeriodId,
        contextType,
        position,
        activeDomain: PROJECT_ACTIVE_DOMAIN[periodContext],
        primaryUseCase: PROJECT_PRIMARY_USE_CASE[periodContext],
        onboardingCompletedAt: now,
        updatedAt: now,
      })
      .returning({ id: workspaces.id });
    if (!created[0]) throw new Error(RECEIPT_MISSING);
    await tx.insert(workspaceMembers).values({
      workspaceId: id,
      userId: input.actorUserId,
      role: "owner",
    });
  });

  revalidatePath("/app", "layout");
  return { id, slug, periodContext, contextType };
}

/**
 * Rename a Project. Capability: `manageProject` (Path B's choice — the name
 * field is presented as owner work in the settings panel).
 *
 * Validation is Path B's, verbatim: trimmed, empty refused. (B never clamped
 * length here while create clamps at 80 — that asymmetry predates WP6 and is
 * preserved rather than silently changed.) New under consolidation: the
 * write bumps `revision`/`updatedAt` like every other lifecycle mutation, and
 * returns a receipt.
 */
export async function renameProject(input: {
  actorUserId: string;
  projectId: string | null | undefined;
  name: string;
  refusal?: string;
}): Promise<{ id: ProjectId }> {
  const refusal = input.refusal ?? PROJECT_UNAVAILABLE;
  const grant = await provedProject(
    input.actorUserId,
    input.projectId,
    "manageProject",
    refusal,
  );
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error("Workspace name can’t be empty.");
  }
  const result = await db.transaction(
    async (transaction) => {
      const updated = await transaction
        .update(workspaces)
        .set({
          name: trimmed,
          revision: sql`${workspaces.revision} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, grant.projectId))
        .returning({ id: workspaces.id, revision: workspaces.revision });
      if (!updated[0]) throw new Error(RECEIPT_MISSING);

      const currentStorage = await transaction
        .select({ id: workspaceStorage.id })
        .from(workspaceStorage)
        .where(
          and(
            eq(workspaceStorage.workspaceId, grant.projectId),
            eq(workspaceStorage.isCurrent, true),
          ),
        )
        .limit(2);
      if (currentStorage.length > 1) throw new Error(RECEIPT_MISSING);
      if (currentStorage.length === 0) {
        return Object.freeze({ id: updated[0].id, renameOperation: null });
      }

      const prepared =
        await prepareAccountFencedProjectDriveOperationInTransaction(
          transaction,
          {
            operationKind: "folder_rename",
            workspaceId: grant.projectId,
            storageGenerationId: currentStorage[0].id,
            workspaceRevision: updated[0].revision,
          },
        );
      if (prepared.outcome === "conflict") throw new Error(refusal);
      return Object.freeze({
        id: updated[0].id,
        renameOperation: Object.freeze({
          workspaceId: grant.projectId,
          operationId: prepared.operation.operationId,
          operationKind: "folder_rename" as const,
        }),
      });
    },
    { behavior: "immediate" },
  );

  // Drive is an external side effect, so it starts only after the Project
  // name/revision and exact-generation intent have committed together. The
  // executor records retry/manual state without undoing the local rename.
  if (result.renameOperation) {
    await executeProjectDriveFolderOperation(result.renameOperation);
  }
  revalidatePath("/app", "layout");
  return { id: grant.projectId };
}

/**
 * Reorder a Project inside its group. Capability: `manageProject` (the same
 * population Path A's owner-role check admitted).
 */
export async function reorderProject(input: {
  actorUserId: string;
  projectId: string | null | undefined;
  position: number;
  refusal?: string;
}): Promise<{ id: ProjectId }> {
  const refusal = input.refusal ?? PROJECT_UNAVAILABLE;
  const grant = await provedProject(
    input.actorUserId,
    input.projectId,
    "manageProject",
    refusal,
  );
  const updated = await db
    .update(workspaces)
    .set({
      position: safePosition(input.position),
      revision: sql`${workspaces.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, grant.projectId))
    .returning({ id: workspaces.id });
  if (!updated[0]) throw new Error(RECEIPT_MISSING);
  revalidatePath("/app", "layout");
  return { id: grant.projectId };
}

/**
 * Archive or restore a Project. Non-destructive: sets/clears `archivedAt` so
 * the Project drops out of (or returns to) the active tree; tasks, members
 * and history stay intact.
 *
 * Capability: `manageProject`. Restore stays reachable on an archived
 * Project under both archive policies — the archived branch of the
 * capability matrix keeps `manageProject` for owners precisely because
 * restore is the one management action an archived Project still needs.
 */
export async function setProjectArchived(input: {
  actorUserId: string;
  projectId: string | null | undefined;
  archived: boolean;
  refusal?: string;
}): Promise<{ id: ProjectId; contextType: string }> {
  const refusal = input.refusal ?? PROJECT_UNAVAILABLE;
  const grant = await provedProject(
    input.actorUserId,
    input.projectId,
    "manageProject",
    refusal,
  );
  const updated = await db
    .update(workspaces)
    .set({
      archivedAt: input.archived ? new Date() : null,
      revision: sql`${workspaces.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, grant.projectId))
    .returning({ id: workspaces.id, contextType: workspaces.contextType });
  if (!updated[0]) throw new Error(RECEIPT_MISSING);
  revalidatePath("/app", "layout");
  return { id: grant.projectId, contextType: updated[0].contextType };
}

/**
 * Move a Project into another of the actor's Planning Periods.
 *
 * Capability: `moveIntoPlanningPeriod` — primary owner always; a co-owner
 * only when they also own the Project's CURRENT period (capabilities.ts:100)
 * — AND ownership of the TARGET period. The intersection with Path A's check
 * (owner-role + target owner) is the stricter set; the tightening for
 * co-owners is named in the module header.
 */
export async function moveProjectToPeriod(input: {
  actorUserId: string;
  projectId: string | null | undefined;
  targetPlanningPeriodId: string;
  position?: number;
  refusal?: string;
}): Promise<{
  id: ProjectId;
  contextType: string;
  targetContextType: PlanningPeriodContext;
}> {
  const refusal = input.refusal ?? PROJECT_UNAVAILABLE;
  const [grant, target] = await Promise.all([
    provedProject(
      input.actorUserId,
      input.projectId,
      "moveIntoPlanningPeriod",
      refusal,
    ),
    requirePlanningPeriodOwner(input.actorUserId, input.targetPlanningPeriodId),
  ]);
  if (target.archivedAt) throw new Error("Restore the target period first.");
  const [current] = await db
    .select({ contextType: workspaces.contextType })
    .from(workspaces)
    .where(eq(workspaces.id, grant.projectId));
  if (!current) throw new Error(RECEIPT_MISSING);
  if (!isCompatibleWorkspaceContext(target.contextType, current.contextType)) {
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
    .where(eq(workspaces.id, grant.projectId))
    .returning({ id: workspaces.id });
  if (!updated[0]) throw new Error(RECEIPT_MISSING);
  revalidatePath("/app", "layout");
  return {
    id: grant.projectId,
    contextType: current.contextType,
    targetContextType: target.contextType,
  };
}

/** The duplication source row, as the transaction re-read returns it. */
type WorkspaceRow = typeof workspaces.$inferSelect;
type DuplicationSourceRow = Readonly<
  Pick<
    WorkspaceRow,
    | "id"
    | "name"
    | "planningPeriodId"
    | "contextType"
    | "primaryDate"
    | "primaryDateLabel"
    | "activeDomain"
    | "templateId"
    | "archivedAt"
  >
>;

const DUPLICATION_SOURCE_SELECTION = {
  id: workspaces.id,
  name: workspaces.name,
  planningPeriodId: workspaces.planningPeriodId,
  contextType: workspaces.contextType,
  primaryDate: workspaces.primaryDate,
  primaryDateLabel: workspaces.primaryDateLabel,
  activeDomain: workspaces.activeDomain,
  templateId: workspaces.templateId,
  archivedAt: workspaces.archivedAt,
};

/**
 * Duplicate a Project into one of the actor's Planning Periods.
 *
 * Capability: `manageProject` on the source (the same population as Path A's
 * owner-role check), proved once up front for an early refusal and AGAIN
 * inside the transaction that reads the protected rows — the seam's executor
 * parameter is what carries the in-transaction re-proof that
 * `requireWorkspaceOwnerInTransaction` used to. Plus ownership of the target
 * period.
 */
export async function duplicateProject(input: {
  actorUserId: string;
  sourceProjectId: string | null | undefined;
  targetPlanningPeriodId: string;
  name: string;
  choices: ProjectDuplicationChoices;
  refusal?: string;
}): Promise<{
  id: string;
  slug: string;
  sourceContextType: string;
  targetContextType: PlanningPeriodContext;
}> {
  const refusal = input.refusal ?? PROJECT_UNAVAILABLE;
  const [grant, target] = await Promise.all([
    provedProject(
      input.actorUserId,
      input.sourceProjectId,
      "manageProject",
      refusal,
    ),
    requirePlanningPeriodOwner(input.actorUserId, input.targetPlanningPeriodId),
  ]);
  if (target.archivedAt) throw new Error("Restore the target period first.");
  const cleanName = cleanPlainText(input.name, "Name", 100);

  const result = await db.transaction(async (tx) => {
    // Re-prove inside the transaction that reads the source's tasks and
    // members — a revocation landing between the outer proof and this read
    // must refuse, not copy.
    const reproof = await proveProjectCapability(
      input.actorUserId,
      grant.projectId,
      "manageProject",
      "defer",
      tx,
    );
    if (!reproof.ok) throw new Error(refusal);
    const [source] = await tx
      .select(DUPLICATION_SOURCE_SELECTION)
      .from(workspaces)
      .where(eq(workspaces.id, grant.projectId));
    if (!source) throw new Error(RECEIPT_MISSING);
    if (!isCompatibleWorkspaceContext(target.contextType, source.contextType)) {
      throw new Error("This workspace type does not match the target period.");
    }
    return duplicateProjectIntoPeriodTx(tx, {
      actorUserId: input.actorUserId,
      source,
      targetPlanningPeriodId: target.id,
      name: cleanName,
      choices: input.choices,
    });
  });

  revalidatePath("/app", "layout");
  return {
    id: result.id,
    slug: result.slug,
    sourceContextType: result.sourceContextType,
    targetContextType: target.contextType,
  };
}

/**
 * The one duplication implementation, transaction-scoped.
 *
 * Exported for `duplicatePlanningPeriodAction`, which copies several
 * workspaces inside one period-level transaction and performs its own in-tx
 * owner re-proof per source. Everything the copy deliberately omits —
 * completion history, public links, pending invitations, activity history,
 * attachments, sponsorship — is omitted HERE, once.
 */
export async function duplicateProjectIntoPeriodTx(
  tx: DatabaseTransaction,
  input: {
    actorUserId: string;
    source: DuplicationSourceRow;
    targetPlanningPeriodId: string;
    name: string;
    choices: ProjectDuplicationChoices;
  },
): Promise<{ id: string; slug: string; sourceContextType: string }> {
  const id = `ws-${randomUUID()}`;
  const slug = `${slugifyProjectName(input.name)}-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  const created = await tx
    .insert(workspaces)
    .values({
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
      // A copy is never born published. The source's bearer link stays the
      // source's.
      publishedAt: null,
      updatedAt: now,
    })
    .returning({ id: workspaces.id });
  if (!created[0]) throw new Error(RECEIPT_MISSING);
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
    // Source workspace's done semantics decide which copied tasks reset to
    // todo (T·122).
    const columnConfig = await readWorkspaceColumnConfig(input.source.id);
    const copies = planDuplicatedTasks(
      sourceTasks,
      input.choices,
      copiedMemberIds,
      () => `t-${randomUUID()}`,
      columnConfig,
    );
    for (const task of copies) {
      await tx.insert(tasks).values({
        id: task.id,
        workspaceId: id,
        seq: nextTaskSeq(id),
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
  return { id, slug, sourceContextType: input.source.contextType };
}

/**
 * Permanently delete a Project. No-undo.
 *
 * Capability: `deleteOrTransferOwnership` — primary owner only, the stricter
 * of the two paths (see the module header for what this changes at the
 * sidebar). Cascades tasks and public share links/visits explicitly because
 * the physical legacy tables did not consistently carry workspace FKs; a
 * deletion must not leave a resolvable share or an invisible orphan.
 *
 * ── E06.12 ─────────────────────────────────────────────────────────────────
 * The slug and publish state are read BEFORE the row is gone, inside the
 * same transaction that deletes it. `/p/{slug}` is ISR with a 60s window, so
 * without the explicit revalidation a deleted published workspace keeps
 * serving its cached page — task titles, tags, and the guests' and
 * suppliers' names in them — for up to a minute after the owner deleted it.
 * The revalidation is unconditional on `publishedAt`: a workspace published
 * and unpublished earlier may still hold a cached entry, and revalidating a
 * never-cached path costs nothing. Both entry points (sidebar and Settings)
 * run through this function, so the fix cannot be missing from one of them
 * again.
 */
export async function deleteProject(input: {
  actorUserId: string;
  projectId: string | null | undefined;
  refusal?: string;
}): Promise<{ id: ProjectId; slug: string; wasPublished: boolean }> {
  const refusal = input.refusal ?? PROJECT_UNAVAILABLE;
  const grant = await provedProject(
    input.actorUserId,
    input.projectId,
    "deleteOrTransferOwnership",
    refusal,
  );
  const removed = await db.transaction(async (tx) => {
    const [published] = await tx
      .select({ slug: workspaces.slug, publishedAt: workspaces.publishedAt })
      .from(workspaces)
      .where(eq(workspaces.id, grant.projectId));
    if (!published) throw new Error(RECEIPT_MISSING);
    const linkRows = await tx
      .select({ token: shareLinks.token })
      .from(shareLinks)
      .where(eq(shareLinks.workspaceId, grant.projectId));
    const tokens = linkRows.map((row) => row.token);
    if (tokens.length > 0) {
      await tx
        .delete(shareLinkVisits)
        .where(inArray(shareLinkVisits.token, tokens));
    }
    await tx
      .delete(shareLinks)
      .where(eq(shareLinks.workspaceId, grant.projectId));
    await tx.delete(tasks).where(eq(tasks.workspaceId, grant.projectId));
    const gone = await tx
      .delete(workspaces)
      .where(eq(workspaces.id, grant.projectId))
      .returning({ id: workspaces.id });
    if (!gone[0]) throw new Error(RECEIPT_MISSING);
    return published;
  });
  // Drop the public page immediately rather than at the end of the ISR
  // window (E06.12).
  revalidatePath(`/p/${removed.slug}`);
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return {
    id: grant.projectId,
    slug: removed.slug,
    wasPublished: removed.publishedAt !== null,
  };
}
