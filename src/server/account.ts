import "server-only";
import { db } from "@/server/db";
import { eraseAccountData } from "@/server/account-erasure";

/**
 * Hard-delete the user's entire footprint in Tasks' Turso DB.
 *
 * Called by `POST /api/account/delete` BEFORE the Clerk admin delete so
 * that if the DB purge errors we don't end up with an orphaned
 * Clerk-deleted user whose data is still here.
 *
 * The erasure itself lives in `account-erasure.ts` as a db-injected pure
 * function so it can be exercised end-to-end against an in-memory libSQL DB
 * (see account-erasure.test.ts) — it deletes EVERY child row explicitly
 * across every table rather than trusting libSQL FK cascade over Turso's
 * stateless HTTP, and unlinks the user's on-disk attachment binaries. This
 * thin wrapper just binds the production `db` singleton.
 *
 * Idempotent: re-running after a partial failure is safe. Returns without
 * writing when the user was never provisioned here.
 */
export async function deleteAccountForUser(clerkId: string): Promise<void> {
  await eraseAccountData(db, clerkId);
}
