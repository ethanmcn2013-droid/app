"use server";

import "server-only";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaceEvents, workspaceMembers } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Security & Login settings data assembly + mutations.
 *
 * All reads are guarded by currentUser() / getCurrentUser() before any
 * Clerk or DB call. All writes (revoke actions) list-then-match before
 * revoking so a session that doesn't belong to the caller is silently
 * no-oped rather than returning a useful error the caller can probe.
 *
 * Dev-fallback behaviour: when Clerk is not configured the functions
 * return empty/no-op results rather than crashing, matching the pattern
 * in auth.ts.
 */

/** True when Clerk env is missing — mirrors the check in auth.ts. */
function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

// ── Types ────────────────────────────────────────────────────────────

export type SignInMethod = {
  kind: "email" | "google" | "github" | "apple";
  label: string;
  /** The account identifier (email address or OAuth username) if connected. */
  identifier: string | null;
  /** Whether the underlying address / account is verified in Clerk. */
  verified: boolean;
  connected: boolean;
};

export type ActiveSession = {
  id: string;
  /** Display hint: browser name + OS, or a best-effort device label. */
  deviceHint: string;
  /** City/country hint if available from Clerk's geo data. */
  locationHint: string | null;
  /** ISO string; seconds-precision is fine for display. */
  createdAt: string;
  lastActiveAt: string;
  /** True when this session is the caller's current session. */
  isCurrent: boolean;
};

export type SecurityActivityLine = {
  id: string;
  sentence: string;
  relative: string;
  createdAt: string;
};

export type SecurityData = {
  /** Null means Clerk is not configured — render the dev-fallback notice. */
  clerkAvailable: boolean;
  signInMethods: SignInMethod[];
  sessions: ActiveSession[];
  recentActivity: SecurityActivityLine[];
};

// ── Helper ───────────────────────────────────────────────────────────

function buildDeviceHint(session: {
  latestActivity?: {
    browserName?: string;
    browserVersion?: string;
    deviceType?: string;
    isMobile?: boolean;
  } | null;
}): string {
  const act = session.latestActivity;
  if (!act) return "Unknown device";
  const parts: string[] = [];
  if (act.deviceType) parts.push(act.deviceType);
  else if (act.isMobile) parts.push("Mobile");
  if (act.browserName) {
    const bv = act.browserVersion ? ` ${act.browserVersion.split(".")[0]}` : "";
    parts.push(`${act.browserName}${bv}`);
  }
  return parts.join(", ") || "Unknown device";
}

function buildLocationHint(session: {
  latestActivity?: { city?: string; country?: string } | null;
}): string | null {
  const act = session.latestActivity;
  if (!act) return null;
  const parts = [act.city, act.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function secRelativeAgo(epochSeconds: number): string {
  const diff = Date.now() - epochSeconds * 1000;
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatSecurityEvent(kind: string, payload: unknown): string {
  try {
    const p = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (kind === "inviteSent") {
      const role = (p as { role?: string }).role ?? "member";
      return `A workspace invite was sent (${role} role).`;
    }
    if (kind === "inviteAccepted") {
      return "A workspace invite was accepted.";
    }
  } catch {
    // Malformed payload, fall through to generic.
  }
  return "A security-relevant event occurred.";
}

// ── Main read ────────────────────────────────────────────────────────

/**
 * Assembles all security section data in a single server call.
 * Called from the settings page.tsx and passed as a prop to the
 * SecuritySection client component.
 *
 * Ownership check: recentActivity only reads workspace_events rows
 * belonging to workspaces where the caller is an OWNER.
 */
export async function getSecurityData(): Promise<SecurityData> {
  // Demo: return empty but valid data. The section renders the
  // dev-fallback notice so the settings surface stays coherent.
  if (isDemoMode()) {
    return {
      clerkAvailable: false,
      signInMethods: [],
      sessions: [],
      recentActivity: [],
    };
  }

  if (!clerkConfigured()) {
    return {
      clerkAvailable: false,
      signInMethods: [],
      sessions: [],
      recentActivity: [],
    };
  }

  // Guard: resolve currentUser + current session id before any Clerk
  // or DB call. getCurrentUser() throws in prod if unauthenticated.
  const [clerkUser, { sessionId: currentSessionId, userId: clerkUserId }] =
    await Promise.all([currentUser(), auth()]);

  if (!clerkUser || !clerkUserId) {
    return {
      clerkAvailable: true,
      signInMethods: [],
      sessions: [],
      recentActivity: [],
    };
  }

  // ── Sign-in methods ───────────────────────────────────────────────
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? null;

  const hasPassword = clerkUser.passwordEnabled;

  const externalAccounts = clerkUser.externalAccounts ?? [];

  const providerKinds: Array<"google" | "github" | "apple"> = [
    "google",
    "github",
    "apple",
  ];

  const signInMethods: SignInMethod[] = [
    {
      kind: "email",
      label: "Email and password",
      identifier: primaryEmail,
      verified:
        clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        )?.verification?.status === "verified",
      connected: hasPassword,
    },
    ...providerKinds.map((provider) => {
      const acct = externalAccounts.find(
        (ea) => ea.provider === provider,
      );
      return {
        kind: provider,
        label:
          provider === "google"
            ? "Google"
            : provider === "github"
              ? "GitHub"
              : "Apple",
        identifier: acct?.emailAddress ?? acct?.username ?? null,
        verified: acct?.verification?.status === "verified",
        connected: Boolean(acct),
      } satisfies SignInMethod;
    }),
  ];

  // ── Active sessions ───────────────────────────────────────────────
  // A Clerk API failure here must degrade the block, never crash the
  // whole settings render.
  let sessions: ActiveSession[] = [];
  try {
    const client = await clerkClient();
    const sessionList = await client.sessions.getSessionList({
      userId: clerkUserId,
      status: "active",
    });
    sessions = (sessionList.data ?? []).map((s) => ({
      id: s.id,
      deviceHint: buildDeviceHint(s),
      locationHint: buildLocationHint(s),
      createdAt: new Date(s.createdAt * 1000).toISOString(),
      lastActiveAt: new Date(s.lastActiveAt * 1000).toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
    // Current session first.
    sessions.sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0));
  } catch (err) {
    console.warn("security: session list unavailable", err);
  }

  // ── Recent security activity ──────────────────────────────────────
  // Resolve internal user id (the Tasks DB user id, which equals
  // the Clerk id post-Phase-A).
  const me = await getCurrentUser();

  // Find workspaces the caller OWNS to scope the event read.
  const ownedWorkspaceRows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, me),
        eq(workspaceMembers.role, "owner"),
      ),
    );

  const ownedIds = ownedWorkspaceRows.map((r) => r.workspaceId);

  let recentActivity: SecurityActivityLine[] = [];

  if (ownedIds.length > 0) {
    const eventRows = await db
      .select({
        id: workspaceEvents.id,
        kind: workspaceEvents.kind,
        payload: workspaceEvents.payload,
        createdAt: workspaceEvents.createdAt,
      })
      .from(workspaceEvents)
      .where(
        and(
          inArray(workspaceEvents.workspaceId, ownedIds),
          inArray(workspaceEvents.kind, ["inviteSent", "inviteAccepted"]),
        ),
      )
      .orderBy(desc(workspaceEvents.createdAt))
      .limit(10);

    recentActivity = eventRows.map((r) => ({
      id: r.id,
      sentence: formatSecurityEvent(r.kind, r.payload),
      relative: secRelativeAgo(r.createdAt),
      createdAt: new Date(r.createdAt * 1000).toISOString(),
    }));
  }

  return {
    clerkAvailable: true,
    signInMethods,
    sessions,
    recentActivity,
  };
}

// ── Mutations ─────────────────────────────────────────────────────

/**
 * Revoke a single session. Verifies ownership by listing the caller's
 * sessions first — if the sessionId is not in the caller's session list
 * the action no-ops silently (the session doesn't exist or isn't theirs).
 *
 * Dev-fallback: no-ops when Clerk is unconfigured.
 */
export async function revokeSessionAction(
  sessionId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  if (!clerkConfigured()) return { ok: true };

  // Guard: resolve identity before any Clerk call.
  const { userId: clerkUserId, sessionId: currentSessionId } = await auth();
  if (!clerkUserId) throw new Error("Not signed in.");

  // Refuse to revoke the current session via this path — the caller
  // should use sign-out instead (which properly clears the cookie).
  if (sessionId === currentSessionId) {
    throw new Error(
      "Use sign-out to end your current session, not this action.",
    );
  }

  const client = await clerkClient();

  // Ownership check: list-then-match before revoking.
  const sessionList = await client.sessions.getSessionList({
    userId: clerkUserId,
    status: "active",
  });
  const owned = (sessionList.data ?? []).some((s) => s.id === sessionId);
  if (!owned) {
    // Session does not exist in the caller's session list — no-op.
    return { ok: true };
  }

  await client.sessions.revokeSession(sessionId);
  return { ok: true };
}

/**
 * Revoke all sessions except the caller's current session.
 * Ownership is guaranteed by listing via userId — only the caller's
 * own sessions are ever in scope.
 *
 * Dev-fallback: no-ops when Clerk is unconfigured.
 */
export async function revokeOtherSessionsAction(): Promise<{
  ok: true;
  count: number;
}> {
  if (isDemoMode()) return { ok: true, count: 0 };
  if (!clerkConfigured()) return { ok: true, count: 0 };

  // Guard: resolve identity before any Clerk call.
  const { userId: clerkUserId, sessionId: currentSessionId } = await auth();
  if (!clerkUserId) throw new Error("Not signed in.");

  const client = await clerkClient();

  // Ownership check: list-then-match, then revoke each.
  const sessionList = await client.sessions.getSessionList({
    userId: clerkUserId,
    status: "active",
  });

  const others = (sessionList.data ?? []).filter(
    (s) => s.id !== currentSessionId,
  );

  await Promise.all(others.map((s) => client.sessions.revokeSession(s.id)));

  return { ok: true, count: others.length };
}
