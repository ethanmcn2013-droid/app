import "server-only";

import { deriveTimelineWorkspaceSlug } from "@/modules/timeline/lib/provision-slug";
import {
  bindProjectToTasksWorkspace,
  createProject,
  createWorkspace,
  getProjectsForWorkspace,
  getWorkspace,
  getWorkspaceForSuiteIdForUser,
} from "@/modules/timeline/server/db/timeline-queries";
import { getPrimaryTasksWorkspaceForUser } from "@/modules/timeline/server/sync/tasks-workspace-context";
import type { Workspace } from "@/modules/timeline/server/db/timeline-schema";

/**
 * Give someone who has a Tasks workspace a Timeline workspace to go with it.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────
 * This is the first half of production blocker 2 from the E05/E06 audit.
 * `createWorkspaceAction` (server/actions/workspaces.ts:93) had zero callers
 * anywhere in src, e2e, scripts or experience. `getCurrentWorkspace` returns
 * `workspaces[0] ?? null`, which in production was null forever, so
 * `/app/timeline` rendered a permanent empty state whose advice — "Create a
 * workspace in Tasks first" — did nothing, because creating a Tasks workspace
 * did not create a Timeline one. Timeline is the film's hero surface and no
 * sponsored couple could reach it.
 *
 * ── WHEN A TIMELINE IS CREATED, AND WHY THEN ───────────────────────────
 * On the couple's first visit to Timeline, not at redemption.
 *
 * Three reasons, in order of weight:
 *
 *   1. REDEMPTION MUST NOT BE ABLE TO FAIL FOR THIS. `redeemCompCodeImpl`
 *      (src/server/actions/comp.ts) runs inside a Server Component render and
 *      writes to the Tasks database only — the cycle-8.5 fresh-user 500 came
 *      from putting the wrong kind of work on that path. Timeline is a
 *      SEPARATE libSQL database reached over its own client. A couple losing
 *      their entitlement because a second database was slow is a far worse
 *      outcome than a couple whose Timeline appears a moment later.
 *   2. IT IS THE CONVENTION ALREADY WRITTEN DOWN. `workspaces.template_id`'s
 *      own schema comment says "Notes/Roadmap/Analytics use this to lazily
 *      seed their per-layer slices on first visit". This is that, for
 *      Timeline.
 *   3. IT IS IDEMPOTENT AND SELF-HEALING. It fixes every couple who has
 *      already redeemed, not only the next one, with no backfill script and
 *      no migration.
 *
 * R-031 is what made this answerable. The seeding question — what a couple's
 * Timeline contains on day one — was blocked on whether the artifact lives on
 * the search-indexable `/p`. D-033 answered it: `/p`, noindex by default, opt-in
 * to search. So provisioning creates PRIVATE planning material and nothing
 * public. No publication is created, no token is minted, no page is exposed.
 * Publishing stays a separate, deliberate act by the couple
 * (`publishAudiencePublication`), exactly as it was.
 *
 * ── WHAT IT CREATES ────────────────────────────────────────────────────
 * One Timeline workspace bound to the Tasks workspace by `suiteWorkspaceId`,
 * and one project inside it bound to the same Tasks workspace by
 * `sourceTasksWorkspaceId`. The project is required, not a nicety:
 * `syncMilestonesAction` refuses with "Create a project first" without one, and
 * the plan page's autosync is what copies the couple's milestones across.
 *
 * The milestones themselves come from the wedding template, which now declares
 * six Timeline points (src/lib/wedding-template-timeline.ts). Before that
 * declaration a provisioned Timeline would have been correct and empty, which
 * is why both halves had to land together.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────
 * No publication. No share token. No venue-visible anything: the venue has no
 * read path to any Timeline table
 * (evidence/E05.08-timeline-planning-boundary.md, criterion 6) and this adds
 * none. It never runs the milestone sync itself — sync reaches across to the
 * Tasks database and belongs on the plan page's existing autosync lifecycle,
 * not on a first-paint render.
 */
export async function ensureTimelineWorkspaceForUser(
  userId: string,
): Promise<Workspace | null> {
  const tasksWorkspace = await getPrimaryTasksWorkspaceForUser(userId);
  if (!tasksWorkspace) return null;

  const existing = await getWorkspaceForSuiteIdForUser(
    tasksWorkspace.workspaceId,
    userId,
  );
  if (existing) {
    await ensureBoundProject(existing.slug, tasksWorkspace.workspaceId);
    return existing;
  }

  const slug = deriveTimelineWorkspaceSlug({
    preferred: tasksWorkspace.slug || tasksWorkspace.name,
    fallbackSeed: tasksWorkspace.workspaceId,
    isTaken: () => false,
  });

  // Re-check the derived slug against the table before inserting. The pure
  // deriver cannot query, so uniqueness is proved here; a lost race surfaces
  // as the insert throwing on the primary key rather than as a silent overwrite.
  const collision = await getWorkspace(slug);
  const finalSlug = collision
    ? deriveTimelineWorkspaceSlug({
        preferred: tasksWorkspace.slug || tasksWorkspace.name,
        fallbackSeed: tasksWorkspace.workspaceId,
        isTaken: (candidate) => candidate === slug,
      })
    : slug;

  // suiteWorkspaceId is set at insert, not afterwards. It is the only
  // suite-wide join key, and a workspace that exists without one is a
  // workspace nothing can find by suite context.
  const created = await createWorkspace({
    slug: finalSlug,
    name: tasksWorkspace.name,
    ownerUserId: userId,
    suiteWorkspaceId: tasksWorkspace.workspaceId,
  });

  await ensureBoundProject(finalSlug, tasksWorkspace.workspaceId);

  return created;
}

/** The one project a provisioned Timeline opens on. */
const DEFAULT_PROJECT_SLUG = "plan";
const DEFAULT_PROJECT_NAME = "The plan";

async function ensureBoundProject(
  workspaceSlug: string,
  sourceTasksWorkspaceId: string,
): Promise<void> {
  const projects = await getProjectsForWorkspace(workspaceSlug);
  if (projects.length > 0) {
    const target = projects[0]!;
    if (!target.sourceTasksWorkspaceId) {
      await bindProjectToTasksWorkspace(
        workspaceSlug,
        target.slug,
        sourceTasksWorkspaceId,
      );
    }
    return;
  }

  await createProject({
    slug: DEFAULT_PROJECT_SLUG,
    name: DEFAULT_PROJECT_NAME,
    workspaceSlug,
    // Never published on creation. Publishing is the couple's own act.
    publishedAt: null,
  });
  await bindProjectToTasksWorkspace(
    workspaceSlug,
    DEFAULT_PROJECT_SLUG,
    sourceTasksWorkspaceId,
  );
}
