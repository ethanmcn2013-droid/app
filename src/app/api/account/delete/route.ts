import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteAccountForUser } from "@/server/account";

/**
 * POST /api/account/delete
 *
 * In-app account deletion per App Store 5.1.1(v): the user can erase
 * their account from inside the app, immediately and irreversibly.
 *
 * Flow:
 *   1. Verify the request is authed (the user can only delete their
 *      own account; no admin path here).
 *   2. Purge the user's footprint from Turso (Tasks' product DB).
 *   3. Call Clerk admin to delete the user. Clerk severs the session
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
