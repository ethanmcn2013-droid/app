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
  type ProjectBindingAuthority,
} from "@/modules/timeline/server/db/timeline-queries";
import { connectSuiteWorkspace } from "@/modules/timeline/server/audience-timeline";
import { ensureSuiteProjectBinding } from "@/modules/timeline/server/sync/sync-state";
import {
  getPrimaryTasksWorkspaceForUser,
  getSoleOwnedTasksWorkspaceIdForUser,
  type CurrentTasksWorkspaceContext,
} from "@/modules/timeline/server/sync/tasks-workspace-context";
import type { Workspace } from "@/modules/timeline/server/db/timeline-schema";
import {
  proveTasksProjectOwnership,
  type TasksProjectOwnership,
} from "@/modules/timeline/lib/tasks-project-ownership";

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
  // The proof rides out of the lookup that established it; this path cannot
  // provision without one, and cannot invent one.
  return provisionTimelineForTasksWorkspace(
    userId,
    tasksWorkspace,
    tasksWorkspace.ownership,
  );
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
  /** Proof that `userId` owns `tasksWorkspace.workspaceId`. The write
   *  statements re-check it against what they are about to write. */
  ownership: TasksProjectOwnership,
): Promise<Workspace | null> {
  const existing = await getWorkspaceForSuiteIdForUser(
    tasksWorkspace.workspaceId,
    userId,
  );
  if (existing) {
    const primary = await ensureBoundProject(
      existing.slug,
      tasksWorkspace.workspaceId,
      { kind: "project-owner", ownership },
    );
    if (primary) {
      await ensureSuiteProjectBinding({
        tasksWorkspaceId: tasksWorkspace.workspaceId,
        timelineWorkspaceSlug: existing.slug,
        primaryTimelineSlug: primary,
        authority: { kind: "project-owner", ownership },
      });
    }
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
    ownership,
  });

  const primary = await ensureBoundProject(finalSlug, tasksWorkspace.workspaceId, {
    kind: "project-owner",
    ownership,
  });

  // The normalized binding, written from the same proof as the mirrors and in
  // the same act (WP4, plan §6.2). Both mirrors stay — they are dual-written
  // for at least two stable releases so a rollback dual-read resolves the same
  // exact rows — but from here on the authoritative row exists from the
  // Timeline's first moment rather than waiting for a backfill.
  if (primary) {
    await ensureSuiteProjectBinding({
      tasksWorkspaceId: tasksWorkspace.workspaceId,
      timelineWorkspaceSlug: finalSlug,
      primaryTimelineSlug: primary,
      authority: { kind: "project-owner", ownership },
    });
  }

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
  /** The evidence does not prove a single answer, or the actor may not write
   *  the answer it proves. The owner chooses; we do not. `workspace` is
   *  deliberately absent — there is nothing safe to show. */
  | Readonly<{
      kind: "owner-reconciliation-required";
      reason:
        | OwnerReconciliationReason
        | "claimed-elsewhere"
        /** The actor is not the Tasks Project's owner, so they may not create
         *  or bind its Timeline — a membership role of "owner" is not
         *  ownership. Reads are unaffected. */
        | "not-project-owner";
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
  /**
   * The actor's own Timeline workspaces, when the caller already has them.
   *
   * Purely a round-trip saving, and safe to prefetch precisely because it
   * authorizes nothing: the list is keyed to `ownerUserId` and every Project
   * decision below is still made from `requestedTasksWorkspaceId`. The old
   * code read this in parallel with the membership check; passing it in keeps
   * that parallelism instead of paying an extra serial round trip on every
   * Timeline page load.
   */
  options: Readonly<{ ownedWorkspaces?: readonly Workspace[] }> = {},
): Promise<CanonicalTimelineResolution> {
  const requested = requestedTasksWorkspaceId.trim();
  if (!requested || provedTasksMembership.workspaceId !== requested) {
    return { kind: "denied" };
  }
  const archived = provedTasksMembership.archivedAt !== null;

  let owned: readonly Workspace[];
  try {
    owned = options.ownedWorkspaces ?? (await getWorkspacesForUser(actorUserId));
  } catch {
    return { kind: "failed", code: "timeline_workspace_read_failed" };
  }
  // Re-scope the list to the actor whatever the caller passed. `getWorkspacesForUser`
  // already filters by owner, so this is a no-op on the intended call — but the
  // list is a PARAMETER now, and a future caller passing another user's list
  // would otherwise get that user's Timeline back as `exact`. The resolver does
  // not trust its own caller for this.
  owned = owned.filter((workspace) => workspace.ownerUserId === actorUserId);

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

  // `exact` cannot occur here — an existing binding was answered at the top —
  // but it is a READ, and reads are authorized by Tasks membership alone
  // (ADR 0001 §6.6). It is therefore answered before the write gate below, so
  // narrowing who may write never narrows who may look.
  if (decision.kind === "exact") {
    const alreadyBound = owned.find(
      (workspace) => workspace.slug === decision.slug,
    );
    return alreadyBound
      ? { kind: "exact", workspace: alreadyBound, provenance: "binding" }
      : { kind: "failed", code: "timeline_candidate_missing" };
  }

  // ── THE WRITE GATE ─────────────────────────────────────────────────────
  // Every remaining outcome WRITES: `provision` creates a Timeline bound to
  // this Project, `adopt` binds an existing one to it. Both consume
  // `uq_workspaces_suite_workspace_id`, so both are one-way doors — whoever
  // gets there first owns the Project's Timeline and the loser is refused for
  // good, because every later resolution is owner-scoped and finds nothing.
  //
  // ONE gate for both, deliberately. The first version of this check sat
  // inside the `provision` branch only, and the identical lockout stayed
  // reachable through `adopt`: a co-owner promoted by `setMemberRoleAction`
  // has `workspace_members.role = 'owner'` and, owning no Project of their
  // own, resolves the SHARED Project as their sole owned one — so their
  // personal unclaimed Timeline was bound to somebody else's Project on first
  // visit. Gating one write path and not its twin is not a gate.
  //
  // The count behind that pairing proof stays broad on purpose (D-017, F2): a
  // co-owned Project is still a Project an unclaimed Timeline could legitimately
  // belong to, so narrowing the COUNT would reopen an F2-shaped hole. The
  // eligibility to write is what must be narrow, and it belongs here.
  //
  // "Owner" means the Tasks Project's own owner — `workspaces.owner_user_id`
  // joined to that user's immutable Clerk subject — never a membership role.
  // Null means the Project has no owner row, which is missing identity rather
  // than permission: plan §6.4 step 9 says refuse and let the owner reconcile.
  // Collaborator-first provisioning needs owner-identity resolution and is WP4.
  //
  // The gate and the proof are the same act, so they are one statement: minting
  // succeeds only when the read proved membership of THIS Project and named
  // this actor as its owner. The token then travels to the write statements,
  // which re-check it against what they are about to write — so the refusal
  // holds even if this branch is later restructured, and a future caller that
  // skips this line cannot write at all.
  const ownership = proveTasksProjectOwnership(
    actorUserId,
    requested,
    // The caller has already unwrapped the membership read; re-wrapping it is
    // the honest way to say "this context came from a proved member".
    { kind: "member", context: provedTasksMembership },
  );
  if (!ownership) {
    return {
      kind: "owner-reconciliation-required",
      reason: "not-project-owner",
      candidateSlugs: [],
    };
  }

  if (decision.kind === "provision") {
    try {
      const created = await provisionTimelineForTasksWorkspace(
        actorUserId,
        {
          workspaceId: requested,
          slug: provedTasksMembership.slug,
          name: provedTasksMembership.name,
        },
        ownership,
      );
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

  // The legacy-evidence adoption, past the write gate above.
  const adoptable = owned.find(
    (workspace) => workspace.slug === decision.slug,
  );
  if (!adoptable) return { kind: "failed", code: "timeline_candidate_missing" };

  try {
    const linked = await connectSuiteWorkspace(
      adoptable.slug,
      actorUserId,
      requested,
      ownership,
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

  const adoptedPrimary = await ensureBoundProject(adoptable.slug, requested, {
    kind: "project-owner",
    ownership,
  });
  if (adoptedPrimary) {
    await ensureSuiteProjectBinding({
      tasksWorkspaceId: requested,
      timelineWorkspaceSlug: adoptable.slug,
      primaryTimelineSlug: adoptedPrimary,
      authority: { kind: "project-owner", ownership },
    });
  }
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

/**
 * Make sure this Timeline workspace has exactly ONE child bound to this Tasks
 * Project — the primary Timeline of ADR 0001 §6.
 *
 * The "exactly one" is the part that was missing. This used to look only at
 * `projects[0]`: if that child was unbound it was bound, without checking
 * whether a SIBLING already named the same Tasks Project. On a multi-child
 * legacy Timeline — the venue fixture's shape — that produced two children
 * synchronizing from one Project, so one Tasks milestone existed twice and
 * every reconcile fought over it.
 */
async function ensureBoundProject(
  workspaceSlug: string,
  sourceTasksWorkspaceId: string,
  authority: ProjectBindingAuthority,
): Promise<string | null> {
  const projects = await getProjectsForWorkspace(workspaceSlug);
  if (projects.length > 0) {
    // Already has a primary for this Project. Nothing to do, and above all no
    // second one to create.
    // Kept as `.some(` deliberately. `milestone-safety-regression.test.ts`
    // pins this exact text as the F8 guard — one Tasks Project, at most one
    // synchronizing child — and a guard is renegotiated explicitly or not at
    // all (DECISIONS D-007). The slug is then read separately.
    const alreadyBound = projects.some(
      (project) => project.sourceTasksWorkspaceId === sourceTasksWorkspaceId,
    );
    if (alreadyBound) {
      return projects.find(
        (project) => project.sourceTasksWorkspaceId === sourceTasksWorkspaceId,
      )!.slug;
    }

    // Otherwise the first child that names no Project at all may become the
    // primary. A child bound to a DIFFERENT Project is that Project's and is
    // never re-pointed here; if every child is spoken for, this Timeline needs
    // an owner's decision, not a silent extra binding.
    const adoptable = projects.find(
      (project) => !project.sourceTasksWorkspaceId,
    );
    if (adoptable) {
      await bindProjectToTasksWorkspace(
        workspaceSlug,
        adoptable.slug,
        sourceTasksWorkspaceId,
        authority,
      );
      return adoptable.slug;
    }
    // Every child is spoken for by another Project. Returning null rather than
    // a slug matters: the caller uses this to write the normalized binding, and
    // a binding needs a primary Timeline that genuinely is one.
    return null;
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
    authority,
  );
  return DEFAULT_PROJECT_SLUG;
}
