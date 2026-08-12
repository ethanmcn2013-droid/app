import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isDemoMode, getAccessMode } from "@/lib/access-mode";
import {
  isReviewSuiteWorkspaceId,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";
import {
  DEMO_USER_ID,
  demoWorkspace,
  weddingDemoWorkspace,
} from "@/modules/timeline/lib/roadmap/demo-data";
import { getWorkspacesForUser } from "@/modules/timeline/server/db/timeline-queries";
import {
  getCurrentTasksWorkspaceContext,
  getPrimaryTasksWorkspaceForUser,
} from "@/modules/timeline/server/sync/tasks-workspace-context";
import {
  ensureTimelineWorkspaceForUser,
  resolveCanonicalTimeline,
} from "@/modules/timeline/server/provision-workspace";
import type { Workspace } from "@/modules/timeline/server/db/timeline-schema";
import { devFallbackEligible } from "./timeline-auth-policy";

/**
 * Tagged error thrown when no Clerk session is attached.
 * Mirrors notes-auth.ts UnauthorizedError so module boundaries are clean.
 */
export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";
  constructor(message = "Not authenticated") {
    super(message);
  }
}

/**
 * True when both Clerk env vars are present. Replicated locally from
 * src/server/auth.ts so this module does not import across the host
 * server boundary while keeping the same keyless-dev logic in lock-step.
 */
function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

/**
 * The dev fallback user id — must match the host app (src/server/auth.ts
 * DEV_FALLBACK_USER) so cross-module dev flows resolve to the same identity.
 */
const DEV_FALLBACK_USER = "david";

/**
 * Server-side helper: returns the Clerk userId or throws UnauthorizedError.
 *
 * Demo/Review mode: resolves to the synthetic demo identity.
 * Keyless-dev fallback: returns DEV_FALLBACK_USER when NODE_ENV is not
 * production, Clerk is not configured, and access mode is "development".
 * Fail-closed on its own via the NODE_ENV term; see devFallbackEligible.
 */
export async function requireUser(): Promise<string> {
  if (isDemoMode()) return DEMO_USER_ID;

  if (
    devFallbackEligible({
      nodeEnv: process.env.NODE_ENV,
      clerkConfigured: clerkConfigured(),
      accessMode: getAccessMode(),
    })
  ) {
    return DEV_FALLBACK_USER;
  }

  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}

/**
 * Hard guard: redirects to /sign-in if there is no authenticated user.
 * Returns the userId so callers don't need to re-check.
 * Use at the top of any /app/timeline/* server component loader.
 */
export async function requireUserOrRedirect(): Promise<string> {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    throw err;
  }
}

export type ResolvedTimelineContext = Readonly<{
  workspace: Workspace;
  workspaceId: string;
  planningPeriodId: string | null;
}>;

/**
 * Resolve the Timeline workspace for a BARE Timeline page load — one that named
 * no Tasks Project at all.
 *
 * Nothing has been requested, so nothing can be substituted for. Every caller
 * uses this as the `??` arm behind `resolveTimelineContext`, which is where a
 * request that DOES name a Project is resolved; that is the only path allowed
 * to answer one, and `resolveCanonicalTimeline` is the only thing that answers
 * it (docs/wave/DECISIONS.md D-002, ADR 0001 §6).
 *
 * This used to take an optional `requestedSuiteWorkspaceId` and resolve it
 * here too. No caller ever passed it, so it was a second, unreachable copy of
 * the resolution path — and the contract guard that exists to prove membership
 * is checked before resolution was matching THAT copy instead of the live one,
 * proving nothing about production. A dead duplicate of a security path is the
 * same shape as blocker 2 itself: correct code nothing calls. It is gone.
 *
 * It stays cheap: the owner's single Timeline is returned on one query.
 * Provisioning is production blocker 2 from the E05/E06 audit — nothing in the
 * product ever created a Timeline workspace, so this function returned null
 * forever and `/app/timeline` rendered a permanent empty state — and it is
 * still here, but ONLY in the branch where the owner has no Timeline at all. It
 * is not on every read, and it is keyed to one exact Tasks Project.
 */
export async function getCurrentWorkspace(
  userId: string,
): Promise<Workspace | null> {
  if (isDemoMode()) return demoWorkspace;

  const workspaces = await getWorkspacesForUser(userId);
  if (workspaces.length === 0) return ensureTimelineWorkspaceForUser(userId);
  if (workspaces.length === 1) return workspaces[0]!;

  // More than one Timeline and no Project named. Prefer the Timeline bound to
  // the actor's deterministic primary Tasks Project rather than whichever row
  // sorts first; "first" is not evidence of anything (ADR 0001 §4). The final
  // fallback is bare-entry only — it is unreachable when a Project WAS
  // requested, and WP2's route resolver replaces it with a canonical redirect.
  const primary = await getPrimaryTasksWorkspaceForUser(userId);
  const boundToPrimary = primary
    ? workspaces.find(
        (workspace) => workspace.suiteWorkspaceId === primary.workspaceId,
      )
    : undefined;
  return boundToPrimary ?? workspaces[0]!;
}

/**
 * The only two resolutions that may put a Timeline on screen for a request that
 * named a Project, plus archived, which is read-only and already bound.
 *
 * Everything else — reconciliation, denial, failure — resolves to null, which
 * the callers render as an unavailable state. Collapsing them here is
 * deliberate: a detailed reason is server-only, because distinguishing
 * "forbidden" from "missing" to the client is an existence leak (ADR 0001 §4).
 */
function canonicalTimelineWorkspace(
  resolution: Awaited<ReturnType<typeof resolveCanonicalTimeline>>,
): Workspace | null {
  if (resolution.kind === "exact") return resolution.workspace;
  if (resolution.kind === "provisioned") return resolution.workspace;
  if (resolution.kind === "archived") return resolution.workspace;
  return null;
}

/**
 * Resolves a suite workspace context, verifying current Tasks membership.
 * Returns null when context cannot be authorised.
 */
export async function resolveTimelineContext(
  userId: string,
  requestedWorkspaceId: string,
  requestedPlanningPeriodId?: string,
): Promise<ResolvedTimelineContext | null> {
  // Demo/review is a self-contained fixture boundary.
  if (isDemoMode()) {
    // The redesign needs to render sparse, undated, overdue and twenty-plus
    // milestone states through the real page rather than a parallel harness
    // that could drift from it. Those fixtures live in a second demo
    // workspace, addressed here by slug because a fixture has no suite id.
    // Reachable only inside this branch, so production resolution is
    // untouched and no real workspace can be addressed this way.
    if (requestedWorkspaceId.trim() === weddingDemoWorkspace.slug) {
      return {
        workspace: weddingDemoWorkspace,
        workspaceId: weddingDemoWorkspace.slug,
        planningPeriodId: null,
      };
    }

    const planningPeriodId = requestedPlanningPeriodId?.trim();
    if (
      !isReviewSuiteWorkspaceId(requestedWorkspaceId) ||
      (planningPeriodId &&
        planningPeriodId !==
          REVIEW_SUITE_FIXTURE.workspace.planningPeriodId)
    ) {
      return null;
    }
    return {
      workspace: demoWorkspace,
      workspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
      planningPeriodId: planningPeriodId ?? null,
    };
  }

  // The two reads run together exactly as they did before. Only the membership
  // read authorizes anything; the Timeline list is the actor's own, keyed to
  // ownerUserId, and it is passed to the resolver purely to save a round trip.
  const [current, ownedWorkspaces] = await Promise.all([
    getCurrentTasksWorkspaceContext(userId, requestedWorkspaceId),
    getWorkspacesForUser(userId),
  ]);

  // Current Tasks membership is the authorization boundary, and the only one.
  // Without it we refuse and never substitute a different workspace: a URL
  // naming workspace B must not quietly render workspace A.
  if (!current) return null;
  if (
    requestedPlanningPeriodId &&
    current.planningPeriodId !== requestedPlanningPeriodId
  ) {
    return null;
  }

  // Membership is proved, so a missing row is a linkage gap rather than an
  // access failure, and the two must not share an outcome — conflating them is
  // what put an owner in front of "That workspace is not available." looking at
  // their own Timeline. `resolveCanonicalTimeline` still closes that gap, by
  // binding or creating THIS Project's Timeline. What it will not do is open
  // another Project's; see it for what it declines to guess, and for the
  // owner-reconciliation-required outcome that replaced the guess.
  //
  // The proved context is passed in, so membership cannot be skipped: there is
  // no way to call the resolver without it.
  const resolved = await resolveCanonicalTimeline(
    userId,
    requestedWorkspaceId,
    current,
    { ownedWorkspaces },
  );
  const workspace = canonicalTimelineWorkspace(resolved);
  if (!workspace) return null;
  return {
    workspace,
    workspaceId: current.workspaceId,
    planningPeriodId: current.planningPeriodId,
  };
}
