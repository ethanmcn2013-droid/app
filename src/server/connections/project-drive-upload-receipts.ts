import "server-only";

import { and, eq, isNotNull, or, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  providerConnections,
  resources,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

type ReceiptDb = Pick<LibSQLDatabase<typeof schema>, "select">;

export type PendingDelegatedDriveUploadReceipt = Readonly<{
  resourceId: string;
  workspaceId: string;
  storageGenerationId: string;
  actorUserId: string;
  storageOwnerUserId: string;
  addedAt: number;
  /** Last DB claim/probe/mint activity; age alone is never proof of expiry. */
  refreshedAt: number | null;
  /** Encrypted resumable-session capability. Never log or return to a client. */
  sessionCipher: string;
}>;

function canonicalId(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${field} must be a canonical id`);
  }
  return value;
}

async function listPendingDelegatedDriveUploadReceipts(
  database: ReceiptDb,
  scope: SQL<unknown>,
): Promise<readonly PendingDelegatedDriveUploadReceipt[]> {
  const rows = await database
    // isolation-ok: every caller supplies either an exact Project boundary or
    // a proved account-lineage predicate for the erasure workflow.
    .select({
      resourceId: resources.id,
      workspaceId: resources.workspaceId,
      storageGenerationId: resources.storageGenerationId,
      actorUserId: resources.addedByUserId,
      storageOwnerUserId: providerConnections.userId,
      addedAt: resources.addedAt,
      refreshedAt: resources.refreshedAt,
      sessionCipher: resources.storedPath,
    })
    .from(resources)
    .innerJoin(
      workspaceStorage,
      and(
        eq(workspaceStorage.id, resources.storageGenerationId),
        eq(workspaceStorage.workspaceId, resources.workspaceId),
      ),
    )
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(
      and(
        eq(resources.kind, "upload"),
        eq(resources.provider, "drive"),
        eq(resources.storage, "drive"),
        eq(resources.accessState, "pending"),
        isNotNull(resources.storedPath),
        scope,
      ),
    );

  return rows.map((row) => {
    if (!row.storageGenerationId || !row.actorUserId || !row.sessionCipher) {
      throw new Error("Project Drive upload receipt is incomplete");
    }
    return Object.freeze({
      resourceId: row.resourceId,
      workspaceId: row.workspaceId,
      storageGenerationId: row.storageGenerationId,
      actorUserId: row.actorUserId,
      storageOwnerUserId: row.storageOwnerUserId,
      addedAt: row.addedAt,
      refreshedAt: row.refreshedAt,
      sessionCipher: row.sessionCipher,
    });
  });
}

/**
 * Finds every live upload receipt touched by one account lineage.
 *
 * This is the explicit account-erasure integration seam for WP6. A receipt
 * belongs to both the actor who started it and the owner of the immutable
 * storage generation. Erasure must fence/cancel or retain these rows before
 * deleting either lineage; deleting the row first destroys the only durable
 * pointer to a provider session that may already have accepted bytes.
 */
export async function listPendingDelegatedDriveUploadReceiptsForAccount(
  database: ReceiptDb,
  userId: string,
): Promise<readonly PendingDelegatedDriveUploadReceipt[]> {
  const id = canonicalId(userId, "userId");
  const accountLineage = or(
    eq(resources.addedByUserId, id),
    eq(providerConnections.userId, id),
  );
  if (!accountLineage) {
    throw new Error("Project Drive account receipt predicate is unavailable");
  }
  return listPendingDelegatedDriveUploadReceipts(database, accountLineage);
}

/**
 * Finds every live delegated-session receipt in one exact Project.
 *
 * Project deletion and storage handover should fail closed while this returns
 * rows. The sealed session capability is retained for lifecycle accounting but
 * must never be decrypted, logged, or returned by those workflows.
 */
export async function listPendingDelegatedDriveUploadReceiptsForWorkspace(
  database: ReceiptDb,
  workspaceId: string,
): Promise<readonly PendingDelegatedDriveUploadReceipt[]> {
  const id = canonicalId(workspaceId, "workspaceId");
  return listPendingDelegatedDriveUploadReceipts(
    database,
    eq(resources.workspaceId, id),
  );
}
