import type { ProjectDriveOperationStatus } from "../db/schema";

/**
 * Statuses an operation executor may claim.
 *
 * This shared predicate documents the lifecycle contract, but it is not an
 * authorization check by itself: prepare/claim implementations MUST retain
 * the equivalent status predicate in the same atomic SQL INSERT/UPDATE CAS
 * that creates or claims work.
 */
export const GOOGLE_DRIVE_OPERATION_CLAIMABLE_STATUSES = [
  "pending",
  "retry_wait",
  "running",
] as const satisfies readonly ProjectDriveOperationStatus[];

export function isGoogleDriveOperationClaimableStatus(
  status: ProjectDriveOperationStatus,
): boolean {
  return GOOGLE_DRIVE_OPERATION_CLAIMABLE_STATUSES.some(
    (claimableStatus) => claimableStatus === status,
  );
}

/**
 * Account erasure uses `manual_attention` as the durable fence for work that
 * may already have reached Google, and `cancelled` only for untouched
 * pending/attempt-zero work with no provider receipt.
 */
export const GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS =
  "manual_attention" as const;
export const GOOGLE_DRIVE_OPERATION_ERASURE_CANCELLED_STATUS =
  "cancelled" as const;
export const GOOGLE_DRIVE_OPERATION_ERASURE_ERROR_CODE =
  "repair_incomplete" as const;

const GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_META_PREFIX =
  "google-drive:account-erasure:user:";

export const GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE = "active:v1";

/**
 * Durable account-erasure fence stored in the existing `meta` table.
 *
 * Executor contract: operation prepare and claim transactions must resolve
 * every related account (workspace owner, subject user, direct connection
 * owner, and storage-generation connection owner), then assert that none of
 * these keys exists inside the SAME transaction as their INSERT/UPDATE CAS.
 * A manual-attention operation must never be requeued while a related fence
 * exists. If a claim commits first, erasure's post-fence re-read observes the
 * running operation and fails closed; if erasure commits first, the executor
 * must decline new or requeued work.
 */
export function googleDriveAccountErasureFenceKey(userId: string): string {
  if (!userId) {
    throw new TypeError("userId is required for an account-erasure fence");
  }
  return `${GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_META_PREFIX}${userId}`;
}
