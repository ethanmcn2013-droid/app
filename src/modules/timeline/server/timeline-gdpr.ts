import { eq, inArray } from "drizzle-orm";
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
} from "./db/timeline-schema";
import { db } from "./db/timeline-client";

/**
 * GDPR Art. 20 (data portability) — Timeline module.
 *
 * Returns everything Timeline holds for the user, keyed at the workspace
 * layer (`workspaces.ownerUserId` = Clerk userId).
 *
 * Audience publications, items, and shares owned by the user's workspaces
 * are included. `audience_shares.token_hash` is a SHA-256 digest of the
 * share token — the raw token is never persisted, so no credential is
 * exposed.
 *
 * May be called from the GDPR orchestrator in src/server/ via the boundary-
 * approved import path (check-module-boundaries.mjs gdprOrchestrators list).
 */
export async function exportForUser(clerkId: string): Promise<
  | { available: true; workspaces: (typeof workspaces.$inferSelect)[]; projects: (typeof projects.$inferSelect)[]; tasks: (typeof tasks.$inferSelect)[]; subtasks: (typeof subtasks.$inferSelect)[]; activity: (typeof activity.$inferSelect)[]; comments: (typeof comments.$inferSelect)[]; projectSources: (typeof projectSources.$inferSelect)[]; nodeOverlays: (typeof nodeOverlays.$inferSelect)[]; publications: (typeof timelinePublications.$inferSelect)[]; publicationItems: (typeof timelinePublicationItems.$inferSelect)[]; audienceShares: (typeof audienceShares.$inferSelect)[] }
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
          db.select().from(audienceShares).where(inArray(audienceShares.publicationId, pubIds)),
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
 * timeline publications, publication items, and audience shares.
 *
 * Explicit deletes for every child table — never relies on FK cascade,
 * which is not reliably enforced over Turso's stateless HTTP.
 *
 * Returns `{ ok: true }` on success, `{ ok: false, error }` on failure so
 * the orchestrator can log and continue.
 *
 * Idempotent: retrying after partial failure is safe.
 */
export async function eraseForUser(
  clerkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ownedWorkspaces = await db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, clerkId));

    if (ownedWorkspaces.length === 0) return { ok: true };

    const slugs = ownedWorkspaces.map((w) => w.slug);

    // Sweep subtasks by task id (keyed by taskId, not workspaceSlug).
    const taskRows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.workspaceSlug, slugs));
    if (taskRows.length > 0) {
      const ids = taskRows.map((t) => t.id);
      await db.delete(subtasks).where(inArray(subtasks.taskId, ids));
    }

    // Sweep timeline publications and their children.
    const pubRows = await db
      .select({ id: timelinePublications.id })
      .from(timelinePublications)
      .where(inArray(timelinePublications.workspaceSlug, slugs));
    if (pubRows.length > 0) {
      const pubIds = pubRows.map((p) => p.id);
      await db
        .delete(audienceShares)
        .where(inArray(audienceShares.publicationId, pubIds));
      await db
        .delete(timelinePublicationItems)
        .where(inArray(timelinePublicationItems.publicationId, pubIds));
      await db
        .delete(timelinePublications)
        .where(inArray(timelinePublications.workspaceSlug, slugs));
    }

    // Workspace-scoped content tables, explicit, no cascade reliance.
    await db.delete(comments).where(inArray(comments.workspaceSlug, slugs));
    await db
      .delete(nodeOverlays)
      .where(inArray(nodeOverlays.workspaceSlug, slugs));
    await db.delete(activity).where(inArray(activity.workspaceSlug, slugs));
    await db
      .delete(projectSources)
      .where(inArray(projectSources.workspaceSlug, slugs));
    await db.delete(tasks).where(inArray(tasks.workspaceSlug, slugs));
    await db.delete(projects).where(inArray(projects.workspaceSlug, slugs));
    await db.delete(workspaces).where(inArray(workspaces.slug, slugs));

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}
