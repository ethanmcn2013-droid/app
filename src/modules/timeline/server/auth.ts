import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isDemoMode, getAccessMode } from "@/lib/access-mode";
import { DEMO_USER_ID, demoWorkspace } from "@/modules/timeline/lib/roadmap/demo-data";
import { getWorkspacesForUser, getWorkspaceForSuiteIdForUser } from "@/modules/timeline/server/db/timeline-queries";
import { getCurrentTasksWorkspaceContext } from "@/modules/timeline/server/sync/tasks-workspace-context";
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
 * Returns the first workspace owned by the current user, or null.
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
  return workspaces[0] ?? null;
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
    if (
      requestedWorkspaceId.trim() !== demoWorkspace.slug ||
      requestedPlanningPeriodId?.trim()
    ) {
      return null;
    }
    return {
      workspace: demoWorkspace,
      workspaceId: demoWorkspace.slug,
      planningPeriodId: null,
    };
  }

  const [workspace, current] = await Promise.all([
    getWorkspaceForSuiteIdForUser(requestedWorkspaceId, userId),
    getCurrentTasksWorkspaceContext(userId, requestedWorkspaceId),
  ]);
  if (!workspace || !current) return null;
  if (
    requestedPlanningPeriodId &&
    current.planningPeriodId !== requestedPlanningPeriodId
  ) {
    return null;
  }
  return {
    workspace,
    workspaceId: current.workspaceId,
    planningPeriodId: current.planningPeriodId,
  };
}
