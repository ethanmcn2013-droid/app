import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import type { ExactDriveGrantReceipt } from "./project-drive-erasure-grants";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { listPendingDelegatedDriveUploadReceiptsForWorkspace } from "./project-drive-upload-receipts";

type MemberRemovalDb = LibSQLDatabase<typeof schema>;
type MemberRemovalTransaction = Parameters<
  Parameters<MemberRemovalDb["transaction"]>[0]
>[0];

export type ProjectDriveMemberRemovalDependencies = Readonly<{
  database: MemberRemovalDb;
  revokeExactGrant: (receipt: ExactDriveGrantReceipt) => Promise<void>;
}>;

export class ProjectDriveMemberRemovalError extends Error {
  readonly code:
    | "account-erasure-in-progress"
    | "drive-work-in-progress"
    | "last-owner"
    | "receipt-conflict"
    | "storage-handover-required"
    | "upload-in-progress";

  constructor(code: ProjectDriveMemberRemovalError["code"]) {
    const messages: Record<ProjectDriveMemberRemovalError["code"], string> = {
      "account-erasure-in-progress":
        "This member’s account is still being removed. Try again when that finishes.",
      "drive-work-in-progress":
        "This member’s Drive access is still being updated. Try again when it finishes.",
      "last-owner": "A workspace must keep at least one owner.",
      "receipt-conflict":
        "This member’s Drive access changed while it was being removed. Try again.",
      "storage-handover-required":
        "Hand over this board’s Drive storage before removing this member.",
      "upload-in-progress":
        "Finish or recover this member’s Drive upload before removing them.",
    };
    super(messages[code]);
    this.name = "ProjectDriveMemberRemovalError";
    this.code = code;
  }
}

type GrantOperation = Readonly<{
  id: string;
  status: typeof projectDriveOperations.$inferSelect.status;
  attemptCount: number;
  lastAttemptAt: Date | null;
  lastErrorCode: typeof projectDriveOperations.$inferSelect.lastErrorCode;
  storageGenerationId: string | null;
  providerPermissionId: string | null;
  connectionId: string | null;
  folderId: string | null;
  storageOwnerUserId: string | null;
}>;

type GrantRow = Readonly<{
  storageGenerationId: string;
  workspaceId: string;
  userId: string;
  permissionId: string;
  connectionId: string;
  folderId: string;
  storageOwnerUserId: string;
  revokePending: boolean;
}>;

type RemovalSnapshot = Readonly<{
  alreadyAbsent: boolean;
  receipts: readonly ExactDriveGrantReceipt[];
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

function providerReceiptKey(receipt: ExactDriveGrantReceipt): string {
  return [receipt.connectionId, receipt.folderId, receipt.permissionId].join(
    "\u0000",
  );
}

function exactReceiptKey(receipt: ExactDriveGrantReceipt): string {
  return [
    receipt.workspaceId,
    receipt.storageGenerationId,
    receipt.connectionId,
    receipt.folderId,
    receipt.userId,
    receipt.permissionId,
  ].join("\u0000");
}

function operationKnownSafe(operation: GrantOperation): boolean {
  if (operation.status === "succeeded") {
    return Boolean(
      operation.storageGenerationId &&
        operation.providerPermissionId &&
        operation.connectionId &&
        operation.folderId &&
        operation.storageOwnerUserId,
    );
  }
  if (operation.status !== "cancelled") return false;
  if (operation.attemptCount === 0) {
    return (
      operation.lastAttemptAt === null &&
      operation.providerPermissionId === null
    );
  }
  // Recovery's authoritative no-provider-mutation receipt is represented by
  // an attempted cancellation with no error and no permission receipt.
  return (
    operation.lastAttemptAt !== null &&
    operation.lastErrorCode === null &&
    operation.providerPermissionId === null
  );
}

async function readGrantOperations(
  transaction: MemberRemovalTransaction,
  workspaceId: string,
  memberUserId: string,
): Promise<GrantOperation[]> {
  return transaction
    .select({
      id: projectDriveOperations.id,
      status: projectDriveOperations.status,
      attemptCount: projectDriveOperations.attemptCount,
      lastAttemptAt: projectDriveOperations.lastAttemptAt,
      lastErrorCode: projectDriveOperations.lastErrorCode,
      storageGenerationId: projectDriveOperations.storageGenerationId,
      providerPermissionId: projectDriveOperations.providerPermissionId,
      connectionId: workspaceStorage.connectionId,
      folderId: workspaceStorage.folderId,
      storageOwnerUserId: providerConnections.userId,
    })
    .from(projectDriveOperations)
    .leftJoin(
      workspaceStorage,
      and(
        eq(workspaceStorage.id, projectDriveOperations.storageGenerationId),
        eq(workspaceStorage.workspaceId, projectDriveOperations.workspaceId),
      ),
    )
    .leftJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(
      and(
        eq(projectDriveOperations.workspaceId, workspaceId),
        eq(projectDriveOperations.operationKind, "grant_create"),
        eq(projectDriveOperations.subjectUserId, memberUserId),
      ),
    );
}

async function readGrantRows(
  transaction: MemberRemovalTransaction,
  workspaceId: string,
  memberUserId: string,
): Promise<GrantRow[]> {
  return transaction
    .select({
      storageGenerationId: driveFolderGrants.storageGenerationId,
      workspaceId: driveFolderGrants.workspaceId,
      userId: driveFolderGrants.userId,
      permissionId: driveFolderGrants.permissionId,
      connectionId: workspaceStorage.connectionId,
      folderId: workspaceStorage.folderId,
      storageOwnerUserId: providerConnections.userId,
      revokePending: driveFolderGrants.revokePending,
    })
    .from(driveFolderGrants)
    .innerJoin(
      workspaceStorage,
      and(
        eq(workspaceStorage.id, driveFolderGrants.storageGenerationId),
        eq(workspaceStorage.workspaceId, driveFolderGrants.workspaceId),
      ),
    )
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(
      and(
        eq(driveFolderGrants.workspaceId, workspaceId),
        eq(driveFolderGrants.userId, memberUserId),
      ),
    );
}

function exactReceiptFromGrant(grant: GrantRow): ExactDriveGrantReceipt {
  return Object.freeze({
    storageGenerationId: grant.storageGenerationId,
    workspaceId: grant.workspaceId,
    connectionId: grant.connectionId,
    folderId: grant.folderId,
    userId: grant.userId,
    permissionId: grant.permissionId,
  });
}

function exactReceiptFromOperation(
  operation: GrantOperation,
  workspaceId: string,
  memberUserId: string,
): ExactDriveGrantReceipt | null {
  if (operation.status !== "succeeded") return null;
  if (
    !operation.storageGenerationId ||
    !operation.providerPermissionId ||
    !operation.connectionId ||
    !operation.folderId ||
    !operation.storageOwnerUserId
  ) {
    throw new ProjectDriveMemberRemovalError("receipt-conflict");
  }
  return Object.freeze({
    storageGenerationId: operation.storageGenerationId,
    workspaceId,
    connectionId: operation.connectionId,
    folderId: operation.folderId,
    userId: memberUserId,
    permissionId: operation.providerPermissionId,
  });
}

async function assertNoAccountErasureFences(
  transaction: MemberRemovalTransaction,
  userIds: Iterable<string>,
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return;
  const fences = await transaction
    .select({ key: meta.key })
    .from(meta)
    .where(
      inArray(
        meta.key,
        uniqueUserIds.map(googleDriveAccountErasureFenceKey),
      ),
    );
  if (fences.length > 0) {
    throw new ProjectDriveMemberRemovalError("account-erasure-in-progress");
  }
}

async function readExactRemovalEvidence(
  transaction: MemberRemovalTransaction,
  workspaceId: string,
  memberUserId: string,
  operations: readonly GrantOperation[],
): Promise<{
  grantRows: GrantRow[];
  receipts: Map<string, ExactDriveGrantReceipt>;
}> {
  const grantRows = await readGrantRows(
    transaction,
    workspaceId,
    memberUserId,
  );
  const receipts = new Map<string, ExactDriveGrantReceipt>();
  const relatedUserIds = new Set<string>([memberUserId]);
  for (const grant of grantRows) {
    const receipt = exactReceiptFromGrant(grant);
    receipts.set(exactReceiptKey(receipt), receipt);
    relatedUserIds.add(grant.storageOwnerUserId);
  }
  for (const operation of operations) {
    const receipt = exactReceiptFromOperation(
      operation,
      workspaceId,
      memberUserId,
    );
    if (!receipt) continue;
    receipts.set(exactReceiptKey(receipt), receipt);
    relatedUserIds.add(operation.storageOwnerUserId!);
  }
  await assertNoAccountErasureFences(transaction, relatedUserIds);
  return { grantRows, receipts };
}

async function assertRemovalPreconditions(
  transaction: MemberRemovalTransaction,
  workspaceId: string,
  memberUserId: string,
): Promise<{ alreadyAbsent: boolean; operations: GrantOperation[] }> {
  const memberships = await transaction
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, memberUserId),
      ),
    )
    .limit(2);
  if (memberships.length === 0) return { alreadyAbsent: true, operations: [] };
  if (memberships.length !== 1) {
    throw new ProjectDriveMemberRemovalError("receipt-conflict");
  }
  if (memberships[0].role === "owner") {
    const owners = await transaction
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.role, "owner"),
        ),
      )
      .limit(2);
    if (owners.length === 1) {
      throw new ProjectDriveMemberRemovalError("last-owner");
    }
  }

  const currentStorageOwnedByMember = await transaction
    .select({ id: workspaceStorage.id })
    .from(workspaceStorage)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(
      and(
        eq(workspaceStorage.workspaceId, workspaceId),
        eq(workspaceStorage.isCurrent, true),
        eq(providerConnections.userId, memberUserId),
      ),
    )
    .limit(1);
  if (currentStorageOwnedByMember.length > 0) {
    throw new ProjectDriveMemberRemovalError("storage-handover-required");
  }

  const uploads = await listPendingDelegatedDriveUploadReceiptsForWorkspace(
    transaction,
    workspaceId,
  );
  if (
    uploads.some(
      (receipt) =>
        receipt.actorUserId === memberUserId ||
        receipt.storageOwnerUserId === memberUserId,
    )
  ) {
    throw new ProjectDriveMemberRemovalError("upload-in-progress");
  }

  const operations = await readGrantOperations(
    transaction,
    workspaceId,
    memberUserId,
  );
  return { alreadyAbsent: false, operations };
}

async function prepareRemoval(
  database: MemberRemovalDb,
  workspaceId: string,
  memberUserId: string,
): Promise<RemovalSnapshot> {
  return database.transaction(
    async (transaction) => {
      const preflight = await assertRemovalPreconditions(
        transaction,
        workspaceId,
        memberUserId,
      );
      if (preflight.alreadyAbsent) {
        return Object.freeze({ alreadyAbsent: true, receipts: [] });
      }

      const journal = createProjectDriveOperationJournal({
        database: transaction,
      });
      for (const operation of preflight.operations) {
        if (
          operation.status === "pending" &&
          operation.attemptCount === 0 &&
          operation.lastAttemptAt === null &&
          operation.providerPermissionId === null
        ) {
          const cancelled = await journal.cancelUnstarted({
            workspaceId,
            operationId: operation.id,
          });
          if (cancelled.outcome === "conflict") {
            throw new ProjectDriveMemberRemovalError(
              "drive-work-in-progress",
            );
          }
        }
      }

      const operations = await readGrantOperations(
        transaction,
        workspaceId,
        memberUserId,
      );
      if (operations.some((operation) => !operationKnownSafe(operation))) {
        throw new ProjectDriveMemberRemovalError("drive-work-in-progress");
      }

      const { grantRows, receipts } = await readExactRemovalEvidence(
        transaction,
        workspaceId,
        memberUserId,
        operations,
      );

      if (grantRows.length > 0) {
        await transaction
          .update(driveFolderGrants)
          .set({ revokePending: true })
          .where(
            and(
              eq(driveFolderGrants.workspaceId, workspaceId),
              eq(driveFolderGrants.userId, memberUserId),
            ),
          );
      }
      return Object.freeze({
        alreadyAbsent: false,
        receipts: Object.freeze([...receipts.values()]),
      });
    },
    { behavior: "immediate" },
  );
}

async function finishRemoval(
  database: MemberRemovalDb,
  workspaceId: string,
  memberUserId: string,
  snapshot: RemovalSnapshot,
): Promise<boolean> {
  if (snapshot.alreadyAbsent) return false;
  return database.transaction(
    async (transaction) => {
      const preflight = await assertRemovalPreconditions(
        transaction,
        workspaceId,
        memberUserId,
      );
      if (preflight.alreadyAbsent) {
        throw new ProjectDriveMemberRemovalError("receipt-conflict");
      }
      if (preflight.operations.some((operation) => !operationKnownSafe(operation))) {
        throw new ProjectDriveMemberRemovalError("drive-work-in-progress");
      }

      const expectedReceiptKeys = new Set(
        snapshot.receipts.map(exactReceiptKey),
      );
      const currentEvidence = await readExactRemovalEvidence(
        transaction,
        workspaceId,
        memberUserId,
        preflight.operations,
      );
      const currentReceiptKeys = new Set(currentEvidence.receipts.keys());
      if (
        currentReceiptKeys.size !== expectedReceiptKeys.size ||
        [...currentReceiptKeys].some(
          (receiptKey) => !expectedReceiptKeys.has(receiptKey),
        ) ||
        currentEvidence.grantRows.some((grant) => !grant.revokePending)
      ) {
        throw new ProjectDriveMemberRemovalError("receipt-conflict");
      }

      for (const grant of currentEvidence.grantRows) {
        const deleted = await transaction
          .delete(driveFolderGrants)
          .where(
            and(
              eq(
                driveFolderGrants.storageGenerationId,
                grant.storageGenerationId,
              ),
              eq(driveFolderGrants.workspaceId, workspaceId),
              eq(driveFolderGrants.userId, memberUserId),
              eq(driveFolderGrants.permissionId, grant.permissionId),
              eq(driveFolderGrants.revokePending, true),
            ),
          )
          .returning({ userId: driveFolderGrants.userId });
        if (!deleted[0]) {
          throw new ProjectDriveMemberRemovalError("receipt-conflict");
        }
      }

      const removed = await transaction
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, memberUserId),
          ),
        )
        .returning({ userId: workspaceMembers.userId });
      if (!removed[0]) {
        throw new ProjectDriveMemberRemovalError("receipt-conflict");
      }
      return true;
    },
    { behavior: "immediate" },
  );
}

export function createProjectDriveMemberRemovalService(
  dependencies: ProjectDriveMemberRemovalDependencies,
) {
  return Object.freeze({
    async remove(input: Readonly<{ workspaceId: string; memberUserId: string }>) {
      const workspaceId = canonicalId(input.workspaceId, "workspaceId");
      const memberUserId = canonicalId(input.memberUserId, "memberUserId");
      const snapshot = await prepareRemoval(
        dependencies.database,
        workspaceId,
        memberUserId,
      );
      const providerRevocations = new Map<string, ExactDriveGrantReceipt>();
      for (const receipt of snapshot.receipts) {
        providerRevocations.set(providerReceiptKey(receipt), receipt);
      }
      for (const receipt of providerRevocations.values()) {
        // Provider I/O happens only after the preflight writer transaction has
        // committed. A failure leaves membership plus every exact receipt.
        await dependencies.revokeExactGrant(receipt);
      }
      const removed = await finishRemoval(
        dependencies.database,
        workspaceId,
        memberUserId,
        snapshot,
      );
      return Object.freeze({
        removed,
        revokedGrantCount: providerRevocations.size,
      });
    },
  });
}
