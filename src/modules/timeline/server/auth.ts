import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isDemoMode, getAccessMode } from "@/lib/access-mode";
import {
  isReviewSuiteWorkspaceId,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";
import { DEMO_USER_ID, demoWorkspace } from "@/modules/timeline/lib/roadmap/demo-data";
import { getWorkspacesForUser, getWorkspaceForSuiteIdForUser } from "@/modules/timeline/server/db/timeline-queries";
import { getCurrentTasksWorkspaceContext } from "@/modules/timeline/server/sync/tasks-workspace-context";
import {
  adoptTimelineForSuiteWorkspace,
  ensureTimelineWorkspaceForUser,
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
 * Returns the first workspace owned by the current user, provisioning one
 * against their Tasks workspace if they have none.
 *
 * The provisioning branch is production blocker 2 from the E05/E06 audit:
 * nothing in the product ever created a Timeline workspace, so this function
 * returned null forever and `/app/timeline` rendered a permanent empty state.
 * See `ensureTimelineWorkspaceForUser` for when a Timeline is created and why
 * then. It runs only when the user has none, so the normal path is unchanged
 * and costs one query as before.
 */
export async function getCurrentWorkspace(
  userId: string,
  requestedSuiteWorkspaceId?: string,
): Promise<Workspace | null> {
  if (isDemoMode()) return demoWorkspace;
  if (requestedSuiteWorkspaceId) {
    const [localWorkspace, currentMembership] = await Promise.all([
      getWorkspaceForSuiteIdForUser(requestedSuiteWorkspaceId, userId),
      getCurrentTasksWorkspaceContext(userId, requestedSuiteWorkspaceId),
    ]);
    if (!localWorkspace || !currentMembership) return null;
    return localWorkspace;
  }
  const workspaces = await getWorkspacesForUser(userId);
  if (workspaces[0]) return workspaces[0];
  return ensureTimelineWorkspaceForUser(userId);
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

  const [linked, current] = await Promise.all([
    getWorkspaceForSuiteIdForUser(requestedWorkspaceId, userId),
    getCurrentTasksWorkspaceContext(userId, requestedWorkspaceId),
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
  // access failure, and the two must not share an outcome. Timelines created
  // in-app carry no suite id, which made every routing hint a dead end; adopt
  // the owner's Timeline and record the link. See
  // `adoptTimelineForSuiteWorkspace` for what it declines to guess.
  const workspace =
    linked ??
    (await adoptTimelineForSuiteWorkspace(userId, requestedWorkspaceId));
  if (!workspace) return null;
  return {
    workspace,
    workspaceId: current.workspaceId,
    planningPeriodId: current.planningPeriodId,
  };
}
