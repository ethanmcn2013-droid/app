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
 * may already have reached Google. It uses `cancelled` for untouched
 * pending/attempt-zero work, or for an attempted operation only after the
 * recovery-only journal API records a definitive no-provider-mutation result.
 * Such a reconciled cancellation has a null error code; attempted cancelled
 * rows carrying an error remain ambiguous and block evidence deletion.
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
 * Executor contract: use the account-fenced operation orchestrator for
 * prepare, claim, and manual requeue. It resolves the workspace owner,
 * subject, direct connection owner, and every workspace storage-generation
 * owner from database truth, then asserts that none of these keys exists
 * inside the SAME transaction as the journal INSERT/UPDATE CAS. Handover
 * therefore covers both its source storage and target connection. If a claim
 * commits first, erasure's post-fence re-read observes it and fails closed; if
 * erasure commits first, the executor declines new or requeued work.
 *
 * An expired claim is never reclaimed while this fence exists. Recovery may
 * only quarantine it and record the result of a read-only, provider-specific
 * reconciliation. Unknown truth stays in manual attention; an exact receipt
 * or definitive absence is required before erasure proceeds.
 */
export function googleDriveAccountErasureFenceKey(userId: string): string {
  if (!userId) {
    throw new TypeError("userId is required for an account-erasure fence");
  }
  return `${GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_META_PREFIX}${userId}`;
}
