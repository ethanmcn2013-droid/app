import "server-only";

import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import {
  withProjectDriveReceiptSession,
  type ProjectDriveAccessService,
  type ProjectDriveStorageReceipt,
} from "./project-drive-access";
import {
  deleteExactDriveUserPermission,
  processPermissionMutations,
  type FolderPermissionMutationQueue,
} from "./drive-grants";
import {
  createProjectDrivePermissionMutationLease,
  projectDrivePermissionMutationLease,
  type ProjectDrivePermissionMutationLeaseRunner,
} from "./project-drive-permission-mutation-lease";

type GrantRevocationDb = LibSQLDatabase<typeof schema>;

export type ExactDriveGrantReceipt = ProjectDriveStorageReceipt &
  Readonly<{
    userId: string;
    permissionId: string;
  }>;

export type DriveGrantRevocationDependencies = Readonly<{
  database: GrantRevocationDb;
  access: Pick<ProjectDriveAccessService, "withReceiptStorageSession">;
  fetchImpl: typeof fetch;
  mutationQueue?: FolderPermissionMutationQueue;
  mutationLease?: ProjectDrivePermissionMutationLeaseRunner;
}>;

function canonicalProviderId(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > 1_024 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.includes("://")
  ) {
    throw new TypeError(`${label} must be a canonical provider id`);
  }
  return value;
}

/**
 * Revoke one exact, persisted Drive permission without a user session.
 *
 * This is the narrow internal path used by account erasure and repair jobs.
 * Its storage generation, connection, folder and permission are all durable
 * receipts. `withReceiptStorageSession` proves the first three still describe
 * one row before decrypting a credential; the provider request contains only
 * the fourth. A 404 is idempotent success.
 */
export function createDriveGrantRevocationService(
  deps: DriveGrantRevocationDependencies,
) {
  const mutationQueue = deps.mutationQueue ?? processPermissionMutations;
  const mutationLease =
    deps.mutationLease ??
    createProjectDrivePermissionMutationLease({ database: deps.database });
  return Object.freeze({
    async revoke(
      receipt: ExactDriveGrantReceipt,
    ): Promise<Readonly<{ alreadyAbsent: boolean }>> {
      const permissionId = canonicalProviderId(
        receipt.permissionId,
        "permissionId",
      );
      canonicalProviderId(receipt.userId, "userId");

      return deps.access.withReceiptStorageSession(
        receipt,
        async (session) => {
          return deleteExactDriveUserPermission(
            session,
            { permissionId, role: "writer" },
            deps.fetchImpl,
            mutationQueue,
            mutationLease,
          );
        },
      );
    },
  });
}

export async function revokeExactDriveFolderGrant(
  receipt: ExactDriveGrantReceipt,
): Promise<void> {
  await createDriveGrantRevocationService({
    database: db,
    access: { withReceiptStorageSession: withProjectDriveReceiptSession },
    fetchImpl: fetch,
    mutationLease: projectDrivePermissionMutationLease,
  }).revoke(receipt);
}
