import "server-only";

import {
  decideTimelineAdoption,
  type OwnerReconciliationReason,
  type TimelineAdoptionCandidate,
} from "@/modules/timeline/lib/adopt-timeline";
import { deriveTimelineWorkspaceSlug } from "@/modules/timeline/lib/provision-slug";
import {
  bindProjectToTasksWorkspace,
  createProject,
  createWorkspace,
  getProjectsForWorkspace,
  getWorkspace,
  getWorkspaceForSuiteIdForUser,
  getWorkspacesForUser,
} from "@/modules/timeline/server/db/timeline-queries";
import { connectSuiteWorkspace } from "@/modules/timeline/server/audience-timeline";
import {
  getPrimaryTasksWorkspaceForUser,
  getSoleOwnedTasksWorkspaceIdForUser,
  type CurrentTasksWorkspaceContext,
} from "@/modules/timeline/server/sync/tasks-workspace-context";
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
  return provisionTimelineForTasksWorkspace(userId, tasksWorkspace);
}

/**
 * Create the Timeline of ONE EXACT Tasks Project.
 *
 * This is `ensureTimelineWorkspaceForUser` with the guessing removed. The old
 * function resolved *which Project to provision against* by asking for the
 * user's primary one; this takes the Project as an argument, so a request
 * naming Project B can only ever create Project B's Timeline. WP1 keeps
 * provisioning (it is the fix to a real dead end) and takes away its ability
 * to choose a Project — docs/wave/DECISIONS.md D-002.
 *
 * Idempotent: an existing exact binding is returned rather than duplicated, and
 * a lost creation race surfaces as the insert throwing on the primary key
 * rather than as a silent overwrite.
 */
export async function provisionTimelineForTasksWorkspace(
  userId: string,
  tasksWorkspace: Readonly<{ workspaceId: string; slug: string; name: string }>,
): Promise<Workspace | null> {
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

/**
 * The valid outcomes of resolving one exact Tasks Project to its Timeline.
 *
 * ADR 0001 §6 fixes this list, and the omission is the point:
 * **"open another Timeline" is not a valid outcome.**
 */
export type CanonicalTimelineResolution =
  /** This Timeline is bound to exactly the Project that was asked for. */
  | Readonly<{
      kind: "exact";
      workspace: Workspace;
      provenance: "binding" | "legacy_exact";
    }>
  /** No Timeline existed for this Project and one was created for it. */
  | Readonly<{ kind: "provisioned"; workspace: Workspace }>
  /** The evidence does not prove a single answer. The owner chooses; we do not.
   *  `workspace` is deliberately absent — there is nothing safe to show. */
  | Readonly<{
      kind: "owner-reconciliation-required";
      reason: OwnerReconciliationReason | "claimed-elsewhere";
      candidateSlugs: readonly string[];
    }>
  /** The Tasks Project is archived. It accepts no new association, so an
   *  already-bound Timeline is returned read-only and nothing else is. */
  | Readonly<{ kind: "archived"; workspace: Workspace | null }>
  /** Membership was not proved for this exact Project. */
  | Readonly<{ kind: "denied" }>
  /** A read or write failed. Never a substitute, never a silent empty. */
  | Readonly<{ kind: "failed"; code: string }>;

/**
 * Resolve the Timeline of ONE EXACT Tasks Project (plan §6.4,
 * `resolveCanonicalTimeline`).
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────
 * `createWorkspaceAction` (server/actions/workspaces.ts) creates a Timeline
 * without a `suiteWorkspaceId`, because `createWorkspace` defaults it to null
 * and only the provisioning path above passes one. Such a Timeline used to be
 * reachable as "the owner's first workspace" and by nothing else, so the
 * moment the product rail appended a `?workspaceId=` routing hint to the URL,
 * `resolveTimelineContext` found no row and the owner met "That workspace is
 * not available." — with their own Timeline sitting right there. Visiting
 * Tasks was what broke Timeline. That dead end is still closed: a linkage gap
 * still resolves rather than refusing.
 *
 * ── WHAT WP1 TOOK AWAY ─────────────────────────────────────────────────
 * The predecessor of this function, `adoptTimelineForSuiteWorkspace`, closed
 * the dead end by *opening the owner's first Timeline* whenever the evidence
 * was thin — including when it was thin because the requested Project simply
 * was not theirs. A request for Project B returned Timeline A. The repair is
 * not to remove the closing of the dead end but to remove the substitution:
 * every write below is keyed to `requestedTasksWorkspaceId`, and where the
 * evidence runs out the owner is asked instead of guessed at
 * (docs/wave/DECISIONS.md D-002).
 *
 * ── AUTHORIZATION ──────────────────────────────────────────────────────
 * Membership is not re-litigated here, it is *required to reach here*: the
 * proved Tasks context is a parameter, so there is no ordering to get wrong
 * and no way to call this without having already proved membership of the
 * exact Project being resolved. The `workspaceId` mismatch check below refuses
 * a proof issued for some other Project.
 */
export async function resolveCanonicalTimeline(
  actorUserId: string,
  requestedTasksWorkspaceId: string,
  provedTasksMembership: CurrentTasksWorkspaceContext,
): Promise<CanonicalTimelineResolution> {
  const requested = requestedTasksWorkspaceId.trim();
  if (!requested || provedTasksMembership.workspaceId !== requested) {
    return { kind: "denied" };
  }
  const archived = provedTasksMembership.archivedAt !== null;

  let owned: Workspace[];
  try {
    owned = await getWorkspacesForUser(actorUserId);
  } catch {
    return { kind: "failed", code: "timeline_workspace_read_failed" };
  }

  // The hot path: an exact binding already exists. Answer it without reading
  // anything else, so the common request costs exactly what it did before.
  const bound = owned.find(
    (workspace) => workspace.suiteWorkspaceId === requested,
  );
  if (bound) {
    return archived
      ? { kind: "archived", workspace: bound }
      : { kind: "exact", workspace: bound, provenance: "binding" };
  }

  // An archived Project accepts no new association: no adoption, no
  // provisioning, no binding write. ADR 0001 §5.
  if (archived) return { kind: "archived", workspace: null };

  let evidence: readonly TimelineAdoptionCandidate[];
  let soleOwnedTasksWorkspaceId: string | null;
  try {
    [evidence, soleOwnedTasksWorkspaceId] = await Promise.all([
      collectAdoptionEvidence(owned),
      getSoleOwnedTasksWorkspaceIdForUser(actorUserId),
    ]);
  } catch {
    return { kind: "failed", code: "timeline_evidence_read_failed" };
  }

  const decision = decideTimelineAdoption({
    requestedTasksWorkspaceId: requested,
    owned: evidence,
    soleOwnedTasksWorkspaceId,
  });

  if (decision.kind === "owner-reconciliation-required") {
    return {
      kind: "owner-reconciliation-required",
      reason: decision.reason,
      candidateSlugs: decision.candidates,
    };
  }

  if (decision.kind === "provision") {
    // Owner-only. A collaborator's first visit must not mint the owner's
    // Timeline under the visitor's identity; that needs owner identity
    // resolution, which is WP4 (plan §6.4 step 9).
    if (provedTasksMembership.role !== "owner") {
      return {
        kind: "owner-reconciliation-required",
        reason: "unproven-timeline-present",
        candidateSlugs: [],
      };
    }
    try {
      const created = await provisionTimelineForTasksWorkspace(actorUserId, {
        workspaceId: requested,
        slug: provedTasksMembership.slug,
        name: provedTasksMembership.name,
      });
      if (!created) return { kind: "failed", code: "timeline_provision_failed" };
      return { kind: "provisioned", workspace: created };
    } catch {
      // A lost uniqueness race is not a licence to open something else. Re-read
      // the committed winner; if it is not ours, the owner reconciles.
      const winner = await getWorkspaceForSuiteIdForUser(requested, actorUserId);
      if (winner) {
        return { kind: "exact", workspace: winner, provenance: "binding" };
      }
      return { kind: "failed", code: "timeline_provision_failed" };
    }
  }

  // decision.kind === "exact" | "adopt". "exact" cannot occur here (an exact
  // binding was answered above), so this is the legacy-evidence adoption.
  const adoptable = owned.find(
    (workspace) => workspace.slug === decision.slug,
  );
  if (!adoptable) return { kind: "failed", code: "timeline_candidate_missing" };
  if (decision.kind === "exact") {
    return { kind: "exact", workspace: adoptable, provenance: "binding" };
  }

  try {
    const linked = await connectSuiteWorkspace(
      adoptable.slug,
      actorUserId,
      requested,
    );
    if (!linked) {
      return {
        kind: "owner-reconciliation-required",
        reason: "claimed-elsewhere",
        candidateSlugs: [adoptable.slug],
      };
    }
  } catch {
    // uq_workspaces_suite_workspace_id: another Timeline already claims this
    // Project. The old code answered that by opening the owner's Timeline
    // anyway — the exact substitution WP1 exists to remove. Re-read the
    // committed winner and, failing that, hand the choice to the owner.
    const winner = await getWorkspaceForSuiteIdForUser(requested, actorUserId);
    if (winner) {
      return { kind: "exact", workspace: winner, provenance: "binding" };
    }
    return {
      kind: "owner-reconciliation-required",
      reason: "claimed-elsewhere",
      candidateSlugs: [adoptable.slug],
    };
  }

  await ensureBoundProject(adoptable.slug, requested);
  return {
    kind: "exact",
    workspace: { ...adoptable, suiteWorkspaceId: requested },
    provenance: "legacy_exact",
  };
}

/**
 * Read the legacy binding evidence each unbound Timeline carries.
 *
 * Only unbound Timelines are inspected: one that already names a Project is
 * that Project's, whatever its children say, and it is never a candidate for
 * another. Bound Timelines therefore cost no query at all, which keeps this
 * off the hot path entirely.
 */
async function collectAdoptionEvidence(
  owned: readonly Workspace[],
): Promise<readonly TimelineAdoptionCandidate[]> {
  return Promise.all(
    owned.map(async (workspace) => {
      if (workspace.suiteWorkspaceId) {
        return {
          slug: workspace.slug,
          suiteWorkspaceId: workspace.suiteWorkspaceId,
          boundTasksWorkspaceIds: [],
        };
      }
      const projects = await getProjectsForWorkspace(workspace.slug);
      const boundTasksWorkspaceIds = [
        ...new Set(
          projects
            .map((project) => project.sourceTasksWorkspaceId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      return {
        slug: workspace.slug,
        suiteWorkspaceId: null,
        boundTasksWorkspaceIds,
      };
    }),
  );
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
