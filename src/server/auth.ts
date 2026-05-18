import "server-only";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";
import type { UserId } from "@/lib/data";
import { LEGACY_WORKSPACE_ID } from "@/server/db/seed";
import { ensureUserProvisioned } from "@/server/db/ensure-user";

/**
 * Auth resolution. Two layers:
 *
 * 1. `getCurrentUser()` — returns the internal user id (which equals
 *    the Clerk id post-Phase-A). Falls back to `david` in dev when
 *    Clerk env vars aren't set so the app keeps running before
 *    deploy-time keys are provisioned.
 *
 * 2. `getActiveWorkspace()` — returns the workspace id the user is
 *    currently looking at. Reads the `tasks_active_ws` cookie if
 *    present and the user is a member; otherwise falls back to the
 *    user's first membership; otherwise `ws-legacy` (dev fallback).
 *
 * The pairing of these two is the per-tenant boundary every read
 * and write filters by.
 */

const ACTIVE_WORKSPACE_COOKIE = "tasks_active_ws";

const DEV_FALLBACK_USER: UserId = "david";

/** True when Clerk env is missing — dev / preview before keys land. */
function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

/**
 * Resolve the current internal user id. Falls back to the legacy
 * seed user (`david`) in development when Clerk isn't configured OR
 * when the request hasn't been authed.
 *
 * Production safety: in NODE_ENV==="production" the fallback paths
 * throw instead of silently running as "david" (a real Turso DB user).
 * This means every unauthenticated production request fails loudly
 * rather than leaking real data through the dev fallback identity.
 * Callers in production must be behind a Clerk-protected route.
 */
export async function getCurrentUser(): Promise<UserId> {
  const isProd = process.env.NODE_ENV === "production";

  if (!clerkConfigured()) {
    if (isProd) {
      throw new Error(
        "Clerk is not configured. NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set in production.",
      );
    }
    return DEV_FALLBACK_USER;
  }

  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      if (isProd) {
        throw new Error("Unauthenticated request reached getCurrentUser in production.");
      }
      return DEV_FALLBACK_USER;
    }

    // P0-1 hardening (DECISIONS.md D1 / ARCH_SPEC.md §1):
    // Idempotently provision the users row on every authed board entry.
    // This closes the webhook-race hole from the Tasks side: a user who
    // arrives via the shared Clerk session (seamless flow) before the
    // `user.created` webhook fires will have a users row so Analytics
    // `listForUser` can resolve via clerk_id. ensureUserProvisioned uses
    // INSERT OR IGNORE — safe to call on every request; DB round-trip is
    // cheap relative to the auth() call already above.
    await ensureUserProvisioned(clerkId);

    // Clerk id IS the internal user id post-Phase-A. The webhook
    // provisions the row; this query is the safety net in case a
    // protected page renders before the webhook lands (rare, but
    // possible on the very first signup before Clerk fires the event).
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId));
    if (row) return row.id;

    // Webhook hasn't fired yet — return the Clerk id directly so
    // anything queryable by user id still works. Subsequent requests
    // pick up the row once it's persisted.
    return clerkId;
  } catch (err) {
    // Re-throw in production so we never silently run as "david".
    if (isProd) throw err;
    return DEV_FALLBACK_USER;
  }
}

/**
 * Same as getCurrentUser, but returns null instead of throwing for
 * unauthenticated production requests. Use this in public routes
 * (invite previews, .ics feeds, etc.) where unauth visitors are
 * expected and need to be rendered different UI rather than crashing.
 */
export async function getCurrentUserOrNull(): Promise<UserId | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

/**
 * Resolve which workspace the user is currently in. Validates
 * membership before honoring the cookie so a hijacked cookie can't
 * leak data across tenants.
 */
export async function getActiveWorkspace(): Promise<string> {
  const me = await getCurrentUser();
  const c = await cookies();
  const cookieValue = c.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  if (cookieValue) {
    const [match] = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, me),
          eq(workspaceMembers.workspaceId, cookieValue),
        ),
      )
      .limit(1);
    if (match) return cookieValue;
  }

  // Fall back to the user's first membership.
  const [first] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, me))
    .limit(1);
  if (first) return first.workspaceId;

  // Legacy fallback for dev runs where the user isn't in any
  // workspace yet (typically only the very first request before
  // the webhook fires).
  return LEGACY_WORKSPACE_ID;
}

/** List workspaces the current user is a member of. Used by the
 *  sidebar workspace-switcher popover. */
export async function listMyWorkspaces(): Promise<
  Array<{ id: string; name: string; slug: string; role: string }>
> {
  const me = await getCurrentUser();
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, me));
  return rows;
}

export const ACTIVE_WORKSPACE_COOKIE_NAME = ACTIVE_WORKSPACE_COOKIE;
