import { and, eq, isNotNull, or, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  providerConnections,
  resources,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

// Injectable query core for account-erasure.ts's plain-Node security suite.
// It has no database singleton, key, transport, or public entry point. Normal
// server consumers use the server-only re-export in upload-receipts.ts.
type ReceiptDb = Pick<LibSQLDatabase<typeof schema>, "select">;

export type PendingDelegatedDriveUploadReceipt = Readonly<{
  resourceId: string;
  workspaceId: string;
  taskId: string;
  storageGenerationId: string;
  connectionId: string;
  folderId: string;
  actorUserId: string;
  storageOwnerUserId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  externalId: string | null;
  url: string | null;
  thumbnail: string | null;
  countsAgainstStorage: number;
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
      taskId: resources.taskId,
      storageGenerationId: resources.storageGenerationId,
      connectionId: workspaceStorage.connectionId,
      folderId: workspaceStorage.folderId,
      actorUserId: resources.addedByUserId,
      storageOwnerUserId: providerConnections.userId,
      title: resources.title,
      mimeType: resources.mimeType,
      sizeBytes: resources.sizeBytes,
      externalId: resources.externalId,
      url: resources.url,
      thumbnail: resources.thumbnail,
      countsAgainstStorage: resources.countsAgainstStorage,
      addedAt: resources.addedAt,
      refreshedAt: resources.refreshedAt,
      sessionCipher: resources.storedPath,
    })
    .from(resources)
    // Left joins are deliberate. A broken RESTRICT lineage must make the
    // erasure query fail closed as an incomplete receipt; an inner join would
    // silently hide an actor-owned bearer session after parent-row damage.
    .leftJoin(
      workspaceStorage,
      and(
        eq(workspaceStorage.id, resources.storageGenerationId),
        eq(workspaceStorage.workspaceId, resources.workspaceId),
      ),
    )
    .leftJoin(
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
    if (
      !row.storageGenerationId ||
      !row.connectionId ||
      !row.folderId ||
      !row.actorUserId ||
      !row.storageOwnerUserId ||
      !row.mimeType ||
      row.sizeBytes === null ||
      !row.sessionCipher
    ) {
      throw new Error("Project Drive upload receipt is incomplete");
    }
    return Object.freeze({
      resourceId: row.resourceId,
      workspaceId: row.workspaceId,
      taskId: row.taskId,
      storageGenerationId: row.storageGenerationId,
      connectionId: row.connectionId,
      folderId: row.folderId,
      actorUserId: row.actorUserId,
      storageOwnerUserId: row.storageOwnerUserId,
      title: row.title,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      externalId: row.externalId,
      url: row.url,
      thumbnail: row.thumbnail,
      countsAgainstStorage: row.countsAgainstStorage,
      addedAt: row.addedAt,
      refreshedAt: row.refreshedAt,
      sessionCipher: row.sessionCipher,
    });
  });
}

/**
 * Finds every live upload receipt touched by one account lineage.
 *
 * A receipt belongs to both the actor who started it and the owner of the
 * immutable storage generation. Erasure must reconcile or retain these rows
 * before deleting either lineage; deleting the row first destroys the only
 * durable pointer to a provider session that may already have accepted bytes.
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

/** Finds every live delegated-session receipt in one exact Project. */
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
