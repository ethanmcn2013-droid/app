import { createHash } from "node:crypto";

const ACCOUNT_DELETION_TOMBSTONE_PREFIX =
  "account-deletion:tombstone:sha256:v1:";

/** Pure key derivation shared by Drizzle and transaction-bound SQL writers. */
export function accountDeletionTombstoneKey(clerkId: string): string {
  const canonical = clerkId.trim();
  if (!canonical) throw new TypeError("clerkId is required");
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `${ACCOUNT_DELETION_TOMBSTONE_PREFIX}${digest}`;
}
