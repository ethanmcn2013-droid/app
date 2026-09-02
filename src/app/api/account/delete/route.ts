import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteAccountForUser } from "@/server/account";
import { beginAccountDeletion } from "@/server/account-deletion-lifecycle";

/**
 * POST /api/account/delete
 *
 * In-app account deletion per App Store 5.1.1(v): the user can erase
 * their account from inside the app, immediately and irreversibly.
 *
 * Flow:
 *   1. Verify the request is authed (the user can only delete their
 *      own account; no admin path here).
 *   2. Install a durable, hashed identity-level deletion tombstone.
 *   3. Purge the user's footprint from every Signal Studio product.
 *   4. Call Clerk admin to delete the user. Clerk severs the session
 *      automatically; the client will receive a 200 and then redirect
 *      to the homepage.
 *
 * Order is intentional: DB purge BEFORE Clerk delete, so a transient
 * Clerk-side failure doesn't leave an orphaned Turso footprint. If
 * the Clerk delete fails after the DB purge succeeds, the user can
 * retry, the DB-purge step is idempotent.
 *
 * Errors: returns 401 on missing auth, 500 on any failure during
 * the cascade. The client-side flow surfaces the error and offers
 * a retry.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Must precede every eraser. A stale authenticated request and a delayed
    // Clerk webhook can no longer reprovision this identity after this point.
    await beginAccountDeletion(userId);
    await deleteAccountForUser(userId);

    const client = await clerkClient();
    await client.users.deleteUser(userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "delete_failed", message },
      { status: 500 },
    );
  }
}
