import "server-only";

import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import {
  createNativeByteCleanupService,
  deleteNativeByteCleanupTargetConfirmed,
  stageNativeByteCleanupTargets,
  type NativeByteCleanupTarget,
} from "./native-byte-cleanup";
import {
  nativeUploadClaimCleanupTargetInTransaction,
  rejectNativeUploadClaimInTransaction,
  releaseExpiredNativeUploadClaimInTransaction,
  releaseNativeUploadClaimInTransaction,
} from "./native-upload-custody";
import { chooseBackend } from "@/server/storage";

type NativeUploadCleanupDb = LibSQLDatabase<typeof schema>;

export type NativeUploadCleanupDependencies = Readonly<{
  database: NativeUploadCleanupDb;
  deleteTarget: (target: NativeByteCleanupTarget) => Promise<void>;
}>;

export async function repairExactNativeByteCleanupReceipts(
  dependencies: NativeUploadCleanupDependencies,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) return;
  // Cleanup is an optimization after custody commits. A failure, a competing
  // worker or process death leaves the exact receipt for scheduled repair.
  await createNativeByteCleanupService({
    database: dependencies.database,
    deleteTarget: dependencies.deleteTarget,
  })
    .repairReady({ keys, limit: Math.min(50, keys.length) })
    .catch(() => undefined);
}

/**
 * Transfer an already-written Signal-native object into durable cleanup
 * custody before releasing its unfinished claim. This is the compensation
 * path when verification refuses a byte or final persistence loses a race.
 */
export async function takeNativeUploadCleanupCustody(
  dependencies: NativeUploadCleanupDependencies,
  input: Readonly<{
    workspaceId: string;
    attachmentId: string;
    target: NativeByteCleanupTarget;
  }>,
): Promise<void> {
  const keys = await dependencies.database.transaction(
    async (transaction) => {
      const released = await releaseNativeUploadClaimInTransaction(
        transaction,
        input,
      );
      if (!released) return [];
      const receiptKeys = await stageNativeByteCleanupTargets(
        transaction,
        input.workspaceId,
        [input.target],
      );
      return receiptKeys;
    },
    { behavior: "immediate" },
  );

  await repairExactNativeByteCleanupReceipts(dependencies, keys);
}

export async function retainRejectedNativeUploadCleanupCustody(
  dependencies: NativeUploadCleanupDependencies,
  input: Readonly<{
    workspaceId: string;
    attachmentId: string;
    pathname: string;
    storedPath: string;
  }>,
): Promise<void> {
  const keys = await dependencies.database.transaction(
    async (transaction) => {
      const rejected = await rejectNativeUploadClaimInTransaction(
        transaction,
        input,
      );
      if (!rejected) return [];
      return stageNativeByteCleanupTargets(transaction, input.workspaceId, [
        { kind: "stored-path", locator: input.storedPath },
      ]);
    },
    { behavior: "immediate" },
  );
  // The marker deliberately remains until the presigned PUT expires. Deleting
  // today's rejected object is not proof that the still-live writer cannot
  // recreate it after Project deletion.
  await repairExactNativeByteCleanupReceipts(dependencies, keys);
}

export async function cleanupRejectedNativeUpload(input: Readonly<{
  workspaceId: string;
  attachmentId: string;
  pathname: string;
  storedPath: string;
}>): Promise<void> {
  return retainRejectedNativeUploadCleanupCustody(
    { database: db, deleteTarget: deleteNativeByteCleanupTargetConfirmed },
    input,
  );
}

export async function cleanupAbandonedNativeUploadClaim(input: Readonly<{
  workspaceId: string;
  attachmentId: string;
  storageKey: string;
  /** Stale sweeps must not retire a provider writer during its drain margin. */
  onlyAfterCustodyDeadline?: boolean;
}>): Promise<boolean> {
  const dependencies = {
    database: db,
    deleteTarget: deleteNativeByteCleanupTargetConfirmed,
  } as const;
  const keys = await db.transaction(
    async (transaction) => {
      const recordedTarget = await nativeUploadClaimCleanupTargetInTransaction(
        transaction,
        input,
      );
      const released = input.onlyAfterCustodyDeadline
        ? await releaseExpiredNativeUploadClaimInTransaction(
            transaction,
            input,
          )
        : await releaseNativeUploadClaimInTransaction(transaction, input);
      if (!released) return [];
      const backend = chooseBackend();
      const fallbackTarget: NativeByteCleanupTarget = {
        kind: backend === "disk" ? "disk-key" : "blob-pathname",
        locator: input.storageKey,
      };
      return stageNativeByteCleanupTargets(transaction, input.workspaceId, [
        recordedTarget ?? fallbackTarget,
      ]);
    },
    { behavior: "immediate" },
  );
  await repairExactNativeByteCleanupReceipts(dependencies, keys);
  return keys.length > 0;
}
