import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import { meta } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { queueUsageErasure } from "@/server/sponsored-use/erasure";

type AccountDeletionDb = LibSQLDatabase<typeof schema>;
type AccountDeletionReader = Pick<AccountDeletionDb, "select">;
type AccountDeletionWriter = Pick<AccountDeletionDb, "select" | "insert" | "update" | "delete">;

const ACCOUNT_DELETION_TOMBSTONE_PREFIX =
  "account-deletion:tombstone:sha256:v1:";
const ACCOUNT_DELETION_TOMBSTONE_VALUE = "erasure-requested:v1";

function requireClerkId(clerkId: string): string {
  const canonical = clerkId.trim();
  if (!canonical) throw new TypeError("clerkId is required");
  return canonical;
}

/**
 * Stable, data-minimised suppression key for an account that requested
 * erasure. The raw Clerk id, email and name are never retained in the key.
 *
 * This tombstone intentionally outlives the product rows and Clerk account.
 * It prevents an already-authenticated request or delayed `user.created`
 * delivery from recreating the account while identity deletion is in flight.
 */
export function accountDeletionTombstoneKey(clerkId: string): string {
  const digest = createHash("sha256")
    .update(requireClerkId(clerkId), "utf8")
    .digest("hex");
  return `${ACCOUNT_DELETION_TOMBSTONE_PREFIX}${digest}`;
}

export async function hasAccountDeletionStartedWith(
  database: AccountDeletionReader,
  clerkId: string,
): Promise<boolean> {
  const rows = await database
    .select({ key: meta.key })
    .from(meta)
    .where(eq(meta.key, accountDeletionTombstoneKey(clerkId)))
    .limit(1);
  return rows.length === 1;
}

/**
 * Establish the identity-level deletion fence before any product eraser runs.
 * INSERT .. DO UPDATE is one atomic statement and is safe on every retry.
 */
export async function beginAccountDeletionWith(
  database: AccountDeletionWriter,
  clerkId: string,
): Promise<void> {
  await database
    .insert(meta)
    .values({
      key: accountDeletionTombstoneKey(clerkId),
      value: ACCOUNT_DELETION_TOMBSTONE_VALUE,
    })
    .onConflictDoUpdate({
      target: meta.key,
      set: {
        value: ACCOUNT_DELETION_TOMBSTONE_VALUE,
        updatedAt: sql`(unixepoch())`,
      },
    });
  // Fence first: concurrent task transactions cannot add new usage after this
  // point. Failure retains the fence and prevents the caller starting erasure.
  await queueUsageErasure(database, clerkId);
}

/** Production entry point used by both in-app and Clerk-driven deletion. */
export async function beginAccountDeletion(clerkId: string): Promise<void> {
  await beginAccountDeletionWith(db, clerkId);
}
