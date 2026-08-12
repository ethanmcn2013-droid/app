import "server-only";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";
import type { UserId } from "@/lib/data";
import { LEGACY_WORKSPACE_ID } from "@/server/db/seed";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import { isDemoMode } from "@/lib/access-mode";
import { firstMembershipByCatalogOrder } from "@/server/projects/catalog";
import { DEMO_USER_ID, DEMO_WORKSPACE_ID } from "@/server/demo/tasks-demo";

/**
 * Auth resolution. Two layers:
 *
 * 1. `getCurrentUser()`, returns the internal user id (which equals
 *    the Clerk id post-Phase-A). Falls back to `david` in dev when
 *    Clerk env vars aren't set so the app keeps running before
 *    deploy-time keys are provisioned.
 *
 * 2. `getActiveWorkspace()`, returns the workspace id the user is
 *    currently looking at. Reads the `tasks_active_ws` cookie if
 *    present and the user is a member; otherwise falls back to the
 *    user's first membership; otherwise `ws-legacy` (dev fallback).
 *
 * The pairing of these two is the per-tenant boundary every read
 * and write filters by.
 */

const ACTIVE_WORKSPACE_COOKIE = "tasks_active_ws";

const DEV_FALLBACK_USER: UserId = "david";

/** True when Clerk env is missing, dev / preview before keys land. */
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
  // Demo/Review: synthetic identity, paired with the in-memory read
  // short-circuits in queries.ts. Never touches Clerk or the DB.
  if (isDemoMode()) return DEMO_USER_ID;

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
    // arrives via the shared Clerk session (cross-product hop) before the
    // `user.created` webhook fires will have a users row so Analytics
    // `listForUser` can resolve via clerk_id. ensureUserProvisioned uses
    // INSERT OR IGNORE, safe to call on every request; DB round-trip is
    // cheap relative to the auth() call already above.
    //
    // B6 (Phase 3.6): pass email so ensureUserProvisioned can backfill
    // the email column for rows provisioned before the column existed
    // (pre-migration NULL-email recurrence risk, pm's finding). currentUser()
    // is a Clerk server helper that fetches the full user object; it is
    // slightly more expensive than auth() (one extra Clerk API call) but only
    // fires on the already-auth-gated path. We use the primary email address.
    const clerkUserObj = await currentUser();
    const clerkEmail =
      clerkUserObj?.emailAddresses?.find(
        (e) => e.id === clerkUserObj.primaryEmailAddressId,
      )?.emailAddress ?? null;
    // C2: pass first/last name so ensureUserProvisioned can backfill the
    // name column if the row was provisioned before the webhook fired.
    await ensureUserProvisioned(
      clerkId,
      clerkEmail,
      clerkUserObj?.firstName ?? null,
      clerkUserObj?.lastName ?? null,
    );

    // Clerk id IS the internal user id post-Phase-A. The webhook
    // provisions the row; this query is the safety net in case a
    // protected page renders before the webhook lands (rare, but
    // possible on the very first signup before Clerk fires the event).
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId));
    if (row) return row.id;

    // Webhook hasn't fired yet, return the Clerk id directly so
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
  if (isDemoMode()) return DEMO_WORKSPACE_ID;

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

/**
 * The membership-proved half of `getActiveWorkspace()`.
 *
 * Same cookie and same first-membership fallback, and then it stops. Where
 * `getActiveWorkspace()` returns `LEGACY_WORKSPACE_ID` — a workspace the
 * caller has produced no membership proof of, which really exists and really
 * holds tasks — this returns `null`.
 *
 * Recorded as DECISIONS D-005 and ADR 0001 §1. Reproduced against a fresh
 * schema-baseline database: a user in zero workspaces resolves through
 * `auth.ts:169-179` to `ws-legacy`, and every one of the 95 ambient call sites
 * can receive it.
 *
 * Additive on purpose. `getActiveWorkspace()` is unchanged, because
 * reclassifying its 95 call sites is WP3 and changing its contract underneath
 * them would be a behaviour change wearing a safety label. WP2 owns the new
 * resolver (`src/server/projects/resolve.ts`), which never calls this and
 * never returns a workspace id without proof; this function exists so a WP3
 * migration has a drop-in that fails closed, and so the regression test has
 * something to pin.
 *
 * ── The fallback is ordered ────────────────────────────────────────────────
 *
 * The first version's fallback was a bare `.limit(1)` with no `ORDER BY`, so a
 * cookieless caller who belongs to several Projects resolved to an arbitrary
 * one and the choice was planner-dependent — the same defect class as the
 * catalog query's missing `ORDER BY`, and it survived for the same reason:
 * it was written as a drop-in with no callers, and an unordered read looks
 * harmless until something depends on it. WP3 has since adopted this across
 * 65 migrated sites.
 *
 * `ORDER BY position, name, id` matches `compareProjects` in
 * `src/server/projects/catalog.ts`, so the Project this returns is the same
 * one the catalog would list first and the resolver would pick for
 * `first-active`. Three accessors agreeing on "first" is the point: a user
 * whose bare entry lands in one Project and whose chooser highlights another
 * has been told two different things about where they are.
 *
 * This is a determinism fix, not an authorization fix. It is still an ambient
 * guess, and it is still not a sufficient basis for a destructive operation —
 * WP3 bounds its two bulk paths (`seed.ts` clear/re-seed) on `manageProject`
 * rather than bare membership, and that requirement does not relax because the
 * guess became stable.
 */
export async function getActiveWorkspaceOrNull(): Promise<string | null> {
  if (isDemoMode()) return DEMO_WORKSPACE_ID;

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

  // One implementation of "first Project", shared with the catalog and the
  // resolver, so the three cannot drift apart.
  return firstMembershipByCatalogOrder(db, me);
}

/** List workspaces the current user is a member of. Used by the
 *  sidebar workspace-switcher popover. */
export async function listMyWorkspaces(): Promise<
  Array<{ id: string; name: string; slug: string; role: string }>
> {
  if (isDemoMode()) {
    return [
      {
        id: DEMO_WORKSPACE_ID,
        name: "The Orchard, events",
        slug: "the-orchard",
        role: "owner",
      },
    ];
  }

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
