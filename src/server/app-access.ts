import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { isEmailAllowed } from "@/lib/access-allowlist";
import { isProductionMode } from "@/lib/access-mode";
import { db } from "@/server/db";
import { workspaceMembers } from "@/server/db/schema";

/**
 * D-018 (grant-on-accept): Tasks-local access gate for /app surfaces.
 *
 * The shared `requireAppAccess()` in require-app-access.ts is a byte-identical
 * four-repo copy and must not be modified. This wrapper extends the rule for
 * Tasks: a user passes the gate if EITHER
 *   1. their primary verified email is on the shared allowlist, OR
 *   2. they have at least one workspace_members row (they accepted a workspace
 *      invite, which means an owner explicitly granted them access).
 *
 * Without this extension, an invited non-allowlisted user would accept the
 * invite, burn the token, then bounce to /waitlist forever — worst-of-both.
 *
 * The shared file is preserved untouched (four-repo copy invariant). Call this
 * function instead of requireAppAccess() at the Tasks /app layout gate.
 *
 * Production-mode only: demo/dev posture unchanged, matching the shared file's
 * behaviour exactly.
 */
export async function requireAppAccessTasks(): Promise<void> {
  // D-018: only enforce in production mode, exactly as the shared file does.
  if (!isProductionMode()) return;

  const user = await currentUser();
  const email = user
    ? (user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null)
    : null;

  // Fast path: allowlisted email (founder always passes via ALWAYS_ALLOW).
  if (isEmailAllowed(email)) return;

  // D-018 fallback: a user who accepted a workspace invite has a membership
  // row — that is sufficient evidence the operator granted them access.
  // Non-allowlisted users without a membership still go to /waitlist.
  if (user) {
    const clerkId = user.id;
    // Resolve membership via clerk_id → user_id mapping used by auth.ts.
    // Import db lazily to avoid circular dependency with auth.ts.
    const memberRows = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      // workspace_members.user_id equals the Clerk id post-Phase-A
      // (ensureUserProvisioned writes users.id = clerk_id).
      .where(eq(workspaceMembers.userId, clerkId))
      .limit(1);
    if (memberRows.length > 0) return;
  }

  redirect("/waitlist");
}
