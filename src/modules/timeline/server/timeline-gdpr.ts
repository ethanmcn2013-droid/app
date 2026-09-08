import { eq, inArray, sql } from "drizzle-orm";
import {
  activity,
  comments,
  nodeOverlays,
  projectSources,
  projects,
  subtasks,
  tasks,
  workspaces,
  timelinePublications,
  timelinePublicationItems,
  audienceShares,
  audienceViewReceipts,
  suiteProjectBindings,
  timelineSourceSyncState,
} from "./db/timeline-schema";
import { db } from "./db/timeline-client";

type AudienceShareExport = Pick<
  typeof audienceShares.$inferSelect,
  | "id"
  | "publicationId"
  | "state"
  | "version"
  | "expiresAt"
  | "createdAt"
  | "rotatedAt"
  | "revokedAt"
>;

const audienceShareExportColumns = {
  id: audienceShares.id,
  publicationId: audienceShares.publicationId,
  state: audienceShares.state,
  version: audienceShares.version,
  expiresAt: audienceShares.expiresAt,
  createdAt: audienceShares.createdAt,
  rotatedAt: audienceShares.rotatedAt,
  revokedAt: audienceShares.revokedAt,
};

/**
 * GDPR Art. 20 (data portability) — Timeline module.
 *
 * Returns everything Timeline holds for the user, keyed at the workspace
 * layer (`workspaces.ownerUserId` = Clerk userId).
 *
 * Audience publications, items, and link lifecycle metadata owned by the
 * user's workspaces are included. Token digests and short-lived qualified-
 * view session digests are omitted: neither is portable user content and
 * exposing them would weaken the sharing boundary.
 *
 * May be called from the GDPR orchestrator in src/server/ via the boundary-
 * approved import path (check-module-boundaries.mjs gdprOrchestrators list).
 */
export async function exportForUser(clerkId: string): Promise<
  | { available: true; workspaces: (typeof workspaces.$inferSelect)[]; projects: (typeof projects.$inferSelect)[]; tasks: (typeof tasks.$inferSelect)[]; subtasks: (typeof subtasks.$inferSelect)[]; activity: (typeof activity.$inferSelect)[]; comments: (typeof comments.$inferSelect)[]; projectSources: (typeof projectSources.$inferSelect)[]; nodeOverlays: (typeof nodeOverlays.$inferSelect)[]; publications: (typeof timelinePublications.$inferSelect)[]; publicationItems: (typeof timelinePublicationItems.$inferSelect)[]; audienceShares: AudienceShareExport[] }
  | { available: false; reason: string }
> {
  try {
    const ownedWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, clerkId));

    const slugs = ownedWorkspaces.map((w) => w.slug);

    if (slugs.length === 0) {
      return {
        available: true,
        workspaces: [],
        projects: [],
        tasks: [],
        subtasks: [],
        activity: [],
        comments: [],
        projectSources: [],
        nodeOverlays: [],
        publications: [],
        publicationItems: [],
        audienceShares: [],
      };
    }

    const [
      projectRows,
      taskRows,
      subtaskRows,
      activityRows,
      commentRows,
      sourceRows,
      overlayRows,
      publicationRows,
    ] = await Promise.all([
      db.select().from(projects).where(inArray(projects.workspaceSlug, slugs)),
      db.select().from(tasks).where(inArray(tasks.workspaceSlug, slugs)),
      db.select().from(subtasks).where(inArray(subtasks.workspaceSlug, slugs)),
      db.select().from(activity).where(inArray(activity.workspaceSlug, slugs)),
      db.select().from(comments).where(inArray(comments.workspaceSlug, slugs)),
      db.select().from(projectSources).where(inArray(projectSources.workspaceSlug, slugs)),
      db.select().from(nodeOverlays).where(inArray(nodeOverlays.workspaceSlug, slugs)),
      db.select().from(timelinePublications).where(inArray(timelinePublications.workspaceSlug, slugs)),
    ]);

    // Collect publication items and audience shares keyed by publication id.
    const pubIds = publicationRows.map((p) => p.id);
    const [pubItemRows, shareRows] = pubIds.length
      ? await Promise.all([
          db.select().from(timelinePublicationItems).where(inArray(timelinePublicationItems.publicationId, pubIds)),
          db
            .select(audienceShareExportColumns)
            .from(audienceShares)
            .where(inArray(audienceShares.publicationId, pubIds)),
        ])
      : [[], []];

    return {
      available: true,
      workspaces: ownedWorkspaces,
      projects: projectRows,
      tasks: taskRows,
      subtasks: subtaskRows,
      activity: activityRows,
      comments: commentRows,
      projectSources: sourceRows,
      nodeOverlays: overlayRows,
      publications: publicationRows,
      publicationItems: pubItemRows,
      audienceShares: shareRows,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { available: false, reason };
  }
}

/**
 * GDPR right-to-erasure — Timeline module.
 *
 * Hard-deletes every row owned by `clerkId` across all Timeline tables.
 * Mirrors the erasure logic from the standalone roadmap repo
 * (`roadmap/src/server/account-erasure.ts`), extended to also sweep
 * timeline publications, publication items, audience shares, and qualified-
 * view receipts.
 *
 * Explicit deletes for every child table — never relies on FK cascade,
 * which is not reliably enforced over Turso's stateless HTTP.
 *
 * Returns `{ ok: true }` on success, `{ ok: false, error }` on failure so
 * the orchestrator can attempt every product eraser and then fail closed
 * before identity deletion.
 *
 * One local transaction includes ownership selection and every child sweep.
 * Failure rolls back this module; the orchestrator still attempts other stores.
 * Idempotent: retrying a failed or completed erasure is safe.
 */
export async function eraseForUser(
  clerkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      // Timeline owns by immutable Clerk identity, independently of Tasks membership.
      const ownedWorkspaces = await tx
        .select({ slug: workspaces.slug })
        .from(workspaces)
        .where(eq(workspaces.ownerUserId, clerkId));
      if (ownedWorkspaces.length === 0) return;
      const slugs = ownedWorkspaces.map((w) => w.slug);

      // Before 0001 BOTH normalized tables are absent. Inspect that exact state
      // instead of catching failed deletes: operational/partial-schema failures
      // must roll back, not be mistaken for successful legacy cleanup.
      const normalizedTables = await tx.all<{ name: string; type: string }>(sql`
        SELECT name, type FROM sqlite_schema
        WHERE name IN ('suite_project_bindings', 'timeline_source_sync_state')
      `);
      if (normalizedTables.length !== 0 && (
        normalizedTables.length !== 2 || normalizedTables.some((object) => object.type !== "table")
      )) {
        throw new Error("Timeline normalized erasure schema is incomplete");
      }
      if (normalizedTables.length === 2) {
        await tx.delete(timelineSourceSyncState)
          .where(inArray(timelineSourceSyncState.timelineWorkspaceSlug, slugs));
        // All states are owned data, including orphaned and retired bindings.
        await tx.delete(suiteProjectBindings)
          .where(inArray(suiteProjectBindings.timelineWorkspaceSlug, slugs));
      }

      const taskRows = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(inArray(tasks.workspaceSlug, slugs));
      if (taskRows.length > 0) {
        await tx.delete(subtasks).where(inArray(subtasks.taskId, taskRows.map((t) => t.id)));
      }
      // Also cover workspace-owned legacy orphans when FKs were not enforced.
      await tx.delete(subtasks).where(inArray(subtasks.workspaceSlug, slugs));

      const pubRows = await tx
        .select({ id: timelinePublications.id })
        .from(timelinePublications)
        .where(inArray(timelinePublications.workspaceSlug, slugs));
      if (pubRows.length > 0) {
        const pubIds = pubRows.map((p) => p.id);
        await tx.delete(audienceViewReceipts)
          .where(inArray(audienceViewReceipts.publicationId, pubIds));
        await tx.delete(audienceShares)
          .where(inArray(audienceShares.publicationId, pubIds));
        await tx.delete(timelinePublicationItems)
          .where(inArray(timelinePublicationItems.publicationId, pubIds));
        await tx.delete(timelinePublications)
          .where(inArray(timelinePublications.workspaceSlug, slugs));
      }

      // Explicit child cleanup works with FKs on or off; keep RESTRICT intact.
      await tx.delete(comments).where(inArray(comments.workspaceSlug, slugs));
      await tx.delete(nodeOverlays).where(inArray(nodeOverlays.workspaceSlug, slugs));
      await tx.delete(activity).where(inArray(activity.workspaceSlug, slugs));
      await tx.delete(projectSources).where(inArray(projectSources.workspaceSlug, slugs));
      await tx.delete(tasks).where(inArray(tasks.workspaceSlug, slugs));
      await tx.delete(projects).where(inArray(projects.workspaceSlug, slugs));
      await tx.delete(workspaces).where(inArray(workspaces.slug, slugs));
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}
