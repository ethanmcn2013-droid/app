import "server-only";

import {
  asc,
  eq,
  inArray,
  type SQL,
} from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  workspaceMembers,
  workspaceStorage,
  workspaces,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { deleteProjectRowsInTransaction } from "@/server/projects/project-deletion-rows";
import type { ExactDriveGrantReceipt } from "./project-drive-erasure-grants";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { projectDriveOperationDedupeKey } from "./project-drive-operation-key";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { listPendingDelegatedDriveUploadReceiptsForWorkspace } from "./project-drive-upload-receipts";

type ProjectDeletionDb = LibSQLDatabase<typeof schema>;
type ProjectDeletionTransaction = Parameters<
  Parameters<ProjectDeletionDb["transaction"]>[0]
>[0];
type WorkspaceRow = typeof workspaces.$inferSelect;
type MemberRow = typeof workspaceMembers.$inferSelect;
type StorageRow = typeof workspaceStorage.$inferSelect;
type GrantRow = typeof driveFolderGrants.$inferSelect;
type OperationRow = typeof projectDriveOperations.$inferSelect;

const DELETE_LEASE_MS = 15 * 60_000;
const RETRY_AFTER_MS = 1_000;

export type ProjectDriveProjectDeletionDependencies = Readonly<{
  database: ProjectDeletionDb;
  revokeExactGrant: (receipt: ExactDriveGrantReceipt) => Promise<void>;
  randomOperationId?: () => string;
  leaseDurationMs?: number;
  /** Test seam only. Production always uses the journal's DB clock. */
  databaseNowSeconds?: () => SQL<Date>;
}>;

export type ProjectDriveProjectDeletionResult = Readonly<{
  workspaceId: string;
  slug: string;
  wasPublished: boolean;
  revokedGrantCount: number;
}>;

export class ProjectDriveProjectDeletionError extends Error {
  readonly code:
    | "account-erasure-in-progress"
    | "drive-work-in-progress"
    | "receipt-conflict"
    | "upload-in-progress"
    | "workspace-not-found";

  constructor(code: ProjectDriveProjectDeletionError["code"]) {
    const messages: Record<ProjectDriveProjectDeletionError["code"], string> = {
      "account-erasure-in-progress":
        "This board is involved in an account removal. Try again when that finishes.",
      "drive-work-in-progress":
        "This board’s Drive access is still being updated. Try again when it finishes.",
      "receipt-conflict":
        "This board changed while it was being deleted. Nothing was removed. Try again.",
      "upload-in-progress":
        "Finish or recover this board’s Drive upload before deleting it.",
      "workspace-not-found": "Workspace not found.",
    };
    super(messages[code]);
    this.name = "ProjectDriveProjectDeletionError";
    this.code = code;
  }
}

type ConnectionIdentity = Readonly<{
  id: string;
  userId: string;
  provider: "google_drive";
  providerAccountId: string;
  rootFolderId: string;
}>;

type ProjectState = Readonly<{
  workspace: WorkspaceRow;
  members: readonly MemberRow[];
  storage: readonly StorageRow[];
  grants: readonly GrantRow[];
  operations: readonly OperationRow[];
  connections: readonly ConnectionIdentity[];
}>;

type PreparedDeletion = Readonly<{
  workspaceId: string;
  workspace: WorkspaceRow;
  stateFingerprint: string;
  operationId: string;
  attemptFence: number;
  accountUserIds: readonly string[];
  receipts: readonly ExactDriveGrantReceipt[];
}>;

function canonicalId(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.includes("://")
  ) {
    throw new TypeError(`${field} must be a canonical id`);
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
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

function providerReceiptKey(receipt: ExactDriveGrantReceipt): string {
  return [receipt.connectionId, receipt.folderId, receipt.permissionId].join(
    "\u0000",
  );
}

function isUntouchedPendingOperation(operation: OperationRow): boolean {
  return (
    operation.status === "pending" &&
    operation.attemptCount === 0 &&
    operation.lastAttemptAt === null &&
    operation.nextAttemptAt === null &&
    operation.leaseExpiresAt === null &&
    operation.lastErrorCode === null &&
    operation.providerFolderId === null &&
    operation.providerFolderWebViewLink === null &&
    operation.providerPermissionId === null &&
    operation.completedAt === null
  );
}

function isUntouchedCancelledOperation(operation: OperationRow): boolean {
  return (
    operation.status === "cancelled" &&
    operation.attemptCount === 0 &&
    operation.lastAttemptAt === null &&
    operation.nextAttemptAt === null &&
    operation.leaseExpiresAt === null &&
    operation.lastErrorCode === null &&
    operation.providerFolderId === null &&
    operation.providerFolderWebViewLink === null &&
    operation.providerPermissionId === null &&
    operation.completedAt !== null
  );
}

function storageById(state: ProjectState): Map<string, StorageRow> {
  return new Map(state.storage.map((row) => [row.id, row]));
}

function connectionById(
  state: ProjectState,
): Map<string, ConnectionIdentity> {
  return new Map(state.connections.map((row) => [row.id, row]));
}

function assertCompletedOperationIntegrity(
  operation: OperationRow,
  state: ProjectState,
): void {
  if (
    operation.status !== "succeeded" ||
    operation.attemptCount < 1 ||
    operation.lastAttemptAt === null ||
    operation.nextAttemptAt !== null ||
    operation.leaseExpiresAt !== null ||
    operation.lastErrorCode !== null ||
    operation.completedAt === null
  ) {
    throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }
  const storage = storageById(state);
  switch (operation.operationKind) {
    case "folder_provision": {
      const target = operation.targetStorageGenerationId
        ? storage.get(operation.targetStorageGenerationId)
        : null;
      if (
        !operation.connectionId ||
        !operation.targetStorageGenerationId ||
        !operation.providerFolderId ||
        !operation.providerFolderWebViewLink ||
        operation.storageGenerationId !== null ||
        operation.subjectUserId !== null ||
        operation.providerPermissionId !== null ||
        !target ||
        target.connectionId !== operation.connectionId ||
        target.folderId !== operation.providerFolderId ||
        target.folderWebViewLink !== operation.providerFolderWebViewLink
      ) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }
      return;
    }
    case "grant_create":
      if (
        !operation.storageGenerationId ||
        !operation.subjectUserId ||
        !operation.granteeEmail ||
        !operation.grantRole ||
        !operation.providerPermissionId ||
        operation.connectionId !== null ||
        operation.targetStorageGenerationId !== null ||
        operation.providerFolderId !== null ||
        operation.providerFolderWebViewLink !== null ||
        !storage.has(operation.storageGenerationId)
      ) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }
      return;
    case "folder_rename":
      if (
        !operation.storageGenerationId ||
        !operation.workspaceRevision ||
        operation.connectionId !== null ||
        operation.targetStorageGenerationId !== null ||
        operation.subjectUserId !== null ||
        operation.providerFolderId !== null ||
        operation.providerFolderWebViewLink !== null ||
        operation.providerPermissionId !== null ||
        !storage.has(operation.storageGenerationId)
      ) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }
      return;
    case "storage_handover": {
      const source = operation.storageGenerationId
        ? storage.get(operation.storageGenerationId)
        : null;
      const target = operation.targetStorageGenerationId
        ? storage.get(operation.targetStorageGenerationId)
        : null;
      if (
        !operation.connectionId ||
        !operation.storageGenerationId ||
        !operation.targetStorageGenerationId ||
        !operation.providerFolderId ||
        !operation.providerFolderWebViewLink ||
        operation.subjectUserId !== null ||
        operation.providerPermissionId !== null ||
        !source ||
        !target ||
        target.connectionId !== operation.connectionId ||
        target.folderId !== operation.providerFolderId ||
        target.folderWebViewLink !== operation.providerFolderWebViewLink
      ) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }
      return;
    }
    case "project_delete":
      throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }
}

function assertNonDeleteOperationsAreQuiescent(state: ProjectState): void {
  for (const operation of state.operations) {
    if (operation.operationKind === "project_delete") continue;
    if (isUntouchedCancelledOperation(operation)) continue;
    if (operation.status === "succeeded") {
      assertCompletedOperationIntegrity(operation, state);
      continue;
    }
    throw new ProjectDriveProjectDeletionError("drive-work-in-progress");
  }
}

async function readProjectState(
  transaction: ProjectDeletionTransaction,
  workspaceId: string,
): Promise<ProjectState> {
  const workspaceRows = await transaction
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(2);
  if (workspaceRows.length === 0) {
    throw new ProjectDriveProjectDeletionError("workspace-not-found");
  }
  if (workspaceRows.length !== 1) {
    throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }

  const [members, storage, grants, operations] = await Promise.all([
    transaction
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.userId)),
    transaction
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.workspaceId, workspaceId))
      .orderBy(asc(workspaceStorage.id)),
    transaction
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.workspaceId, workspaceId))
      .orderBy(
        asc(driveFolderGrants.storageGenerationId),
        asc(driveFolderGrants.userId),
      ),
    transaction
      .select()
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.workspaceId, workspaceId))
      .orderBy(asc(projectDriveOperations.id)),
  ]);

  const connectionIds = [
    ...new Set([
      ...storage.map((row) => row.connectionId),
      ...operations.flatMap((row) => (row.connectionId ? [row.connectionId] : [])),
    ]),
  ];
  const connections = connectionIds.length
    ? await transaction
        .select({
          id: providerConnections.id,
          userId: providerConnections.userId,
          provider: providerConnections.provider,
          providerAccountId: providerConnections.providerAccountId,
          rootFolderId: providerConnections.rootFolderId,
        })
        .from(providerConnections)
        .where(inArray(providerConnections.id, connectionIds))
        .orderBy(asc(providerConnections.id))
    : [];
  if (connections.length !== connectionIds.length) {
    throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }

  return Object.freeze({
    workspace: workspaceRows[0],
    members: Object.freeze(members),
    storage: Object.freeze(storage),
    grants: Object.freeze(grants),
    operations: Object.freeze(operations),
    connections: Object.freeze(connections),
  });
}

function projectStateFingerprint(state: ProjectState): string {
  return fingerprint({
    workspace: state.workspace,
    members: state.members,
    storage: state.storage,
    grants: state.grants,
    operations: state.operations,
    connections: state.connections,
  });
}

function relatedAccountUserIds(state: ProjectState): readonly string[] {
  const ids = new Set<string>();
  if (!state.workspace.ownerUserId) {
    throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }
  ids.add(state.workspace.ownerUserId);
  for (const member of state.members) ids.add(member.userId);
  for (const connection of state.connections) ids.add(connection.userId);
  for (const grant of state.grants) ids.add(grant.userId);
  for (const operation of state.operations) {
    if (operation.subjectUserId) ids.add(operation.subjectUserId);
  }
  return Object.freeze([...ids].sort());
}

async function assertNoAccountErasureFences(
  transaction: ProjectDeletionTransaction,
  userIds: readonly string[],
): Promise<void> {
  if (userIds.length === 0) return;
  const [fence] = await transaction
    .select({ key: meta.key })
    .from(meta)
    .where(inArray(meta.key, userIds.map(googleDriveAccountErasureFenceKey)))
    .limit(1);
  if (fence) {
    throw new ProjectDriveProjectDeletionError(
      "account-erasure-in-progress",
    );
  }
}

async function assertNoPendingDelegatedUploads(
  transaction: ProjectDeletionTransaction,
  workspaceId: string,
): Promise<void> {
  const receipts =
    await listPendingDelegatedDriveUploadReceiptsForWorkspace(
      transaction,
      workspaceId,
    );
  if (receipts.length > 0) {
    throw new ProjectDriveProjectDeletionError("upload-in-progress");
  }
}

function collectExactGrantReceipts(
  state: ProjectState,
): readonly ExactDriveGrantReceipt[] {
  const storage = storageById(state);
  const connections = connectionById(state);
  const receipts = new Map<string, ExactDriveGrantReceipt>();
  for (const grant of state.grants) {
    const generation = storage.get(grant.storageGenerationId);
    if (
      !generation ||
      generation.workspaceId !== grant.workspaceId ||
      !connections.has(generation.connectionId)
    ) {
      throw new ProjectDriveProjectDeletionError("receipt-conflict");
    }
    const receipt = Object.freeze({
      workspaceId: grant.workspaceId,
      storageGenerationId: grant.storageGenerationId,
      connectionId: generation.connectionId,
      folderId: generation.folderId,
      userId: grant.userId,
      permissionId: grant.permissionId,
    });
    receipts.set(exactReceiptKey(receipt), receipt);
  }

  for (const operation of state.operations) {
    if (
      operation.operationKind !== "grant_create" ||
      operation.status !== "succeeded"
    ) {
      continue;
    }
    assertCompletedOperationIntegrity(operation, state);
    const generation = storage.get(operation.storageGenerationId!);
    if (!generation) {
      throw new ProjectDriveProjectDeletionError("receipt-conflict");
    }
    const receipt = Object.freeze({
      workspaceId: operation.workspaceId,
      storageGenerationId: operation.storageGenerationId!,
      connectionId: generation.connectionId,
      folderId: generation.folderId,
      userId: operation.subjectUserId!,
      permissionId: operation.providerPermissionId!,
    });
    receipts.set(exactReceiptKey(receipt), receipt);
  }
  return Object.freeze([...receipts.values()]);
}

async function cancelUntouchedNonDeleteOperations(
  transaction: ProjectDeletionTransaction,
  state: ProjectState,
  deps: ProjectDriveProjectDeletionDependencies,
): Promise<void> {
  const journal = createProjectDriveOperationJournal({
    database: transaction,
    randomOperationId: deps.randomOperationId,
    leaseDurationMs: deps.leaseDurationMs ?? DELETE_LEASE_MS,
    databaseNowSeconds: deps.databaseNowSeconds,
  });
  for (const operation of state.operations) {
    if (
      operation.operationKind === "project_delete" ||
      !isUntouchedPendingOperation(operation)
    ) {
      continue;
    }
    const cancelled = await journal.cancelUnstarted({
      workspaceId: state.workspace.id,
      operationId: operation.id,
    });
    if (cancelled.outcome === "conflict") {
      throw new ProjectDriveProjectDeletionError("drive-work-in-progress");
    }
  }
}

async function prepareAndClaimDeleteIntent(
  transaction: ProjectDeletionTransaction,
  state: ProjectState,
  deps: ProjectDriveProjectDeletionDependencies,
) {
  const journal = createProjectDriveOperationJournal({
    database: transaction,
    randomOperationId: deps.randomOperationId,
    leaseDurationMs: deps.leaseDurationMs ?? DELETE_LEASE_MS,
    databaseNowSeconds: deps.databaseNowSeconds,
  });
  const deleteRows = state.operations.filter(
    (operation) => operation.operationKind === "project_delete",
  );
  if (deleteRows.length > 1) {
    throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }

  let operationId: string;
  const existing = deleteRows[0];
  if (
    existing &&
    (existing.dedupeKey !==
      projectDriveOperationDedupeKey({
        operationKind: "project_delete",
        workspaceId: state.workspace.id,
      }) ||
      existing.connectionId !== null ||
      existing.storageGenerationId !== null ||
      existing.targetStorageGenerationId !== null ||
      existing.subjectUserId !== null ||
      existing.granteeEmail !== null ||
      existing.grantRole !== null ||
      existing.workspaceRevision !== null ||
      existing.providerFolderId !== null ||
      existing.providerFolderWebViewLink !== null ||
      existing.providerPermissionId !== null)
  ) {
    throw new ProjectDriveProjectDeletionError("receipt-conflict");
  }
  if (existing && isUntouchedCancelledOperation(existing)) {
    const rearmed = await journal.rearmLifecycleOperation({
      workspaceId: state.workspace.id,
      operationId: existing.id,
      operationKind: "project_delete",
      previousAttemptFence: 0,
      previousReceipt: {},
    });
    if (rearmed.outcome === "conflict") {
      throw new ProjectDriveProjectDeletionError("receipt-conflict");
    }
    operationId = rearmed.operation.operationId;
  } else if (existing) {
    if (
      existing.status === "cancelled" ||
      existing.status === "manual_attention" ||
      existing.status === "succeeded"
    ) {
      throw new ProjectDriveProjectDeletionError("drive-work-in-progress");
    }
    operationId = existing.id;
  } else {
    const prepared = await journal.prepare({
      operationKind: "project_delete",
      workspaceId: state.workspace.id,
    });
    if (prepared.outcome === "conflict") {
      throw new ProjectDriveProjectDeletionError("receipt-conflict");
    }
    operationId = prepared.operation.operationId;
  }

  const claimed = await journal.claim({
    workspaceId: state.workspace.id,
    operationId,
  });
  if (
    claimed.outcome === "conflict" ||
    claimed.claim.operationKind !== "project_delete"
  ) {
    throw new ProjectDriveProjectDeletionError("drive-work-in-progress");
  }
  return claimed.claim;
}

async function prepareDeletion(
  deps: ProjectDriveProjectDeletionDependencies,
  workspaceId: string,
): Promise<PreparedDeletion> {
  return deps.database.transaction(
    async (transaction) => {
      let state = await readProjectState(transaction, workspaceId);
      await assertNoPendingDelegatedUploads(transaction, workspaceId);
      await assertNoAccountErasureFences(
        transaction,
        relatedAccountUserIds(state),
      );

      await cancelUntouchedNonDeleteOperations(transaction, state, deps);
      state = await readProjectState(transaction, workspaceId);
      assertNonDeleteOperationsAreQuiescent(state);

      const claim = await prepareAndClaimDeleteIntent(
        transaction,
        state,
        deps,
      );

      await transaction
        .update(driveFolderGrants)
        .set({ revokePending: true })
        .where(eq(driveFolderGrants.workspaceId, workspaceId));

      state = await readProjectState(transaction, workspaceId);
      assertNonDeleteOperationsAreQuiescent(state);
      const deleteOperation = state.operations.find(
        (operation) => operation.id === claim.operationId,
      );
      if (
        !deleteOperation ||
        deleteOperation.operationKind !== "project_delete" ||
        deleteOperation.status !== "running" ||
        deleteOperation.attemptCount !== claim.attemptFence
      ) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }

      await assertNoPendingDelegatedUploads(transaction, workspaceId);
      const accountUserIds = relatedAccountUserIds(state);
      await assertNoAccountErasureFences(transaction, accountUserIds);
      const receipts = collectExactGrantReceipts(state);

      return Object.freeze({
        workspaceId,
        workspace: state.workspace,
        stateFingerprint: projectStateFingerprint(state),
        operationId: claim.operationId,
        attemptFence: claim.attemptFence,
        accountUserIds,
        receipts,
      });
    },
    { behavior: "immediate" },
  );
}

async function scheduleRetry(
  deps: ProjectDriveProjectDeletionDependencies,
  prepared: PreparedDeletion,
  errorCode: "provider_unavailable" | "workspace_changed",
): Promise<void> {
  try {
    await deps.database.transaction(
      async (transaction) => {
        await assertNoAccountErasureFences(
          transaction,
          prepared.accountUserIds,
        );
        await createProjectDriveOperationJournal({
          database: transaction,
          randomOperationId: deps.randomOperationId,
          leaseDurationMs: deps.leaseDurationMs ?? DELETE_LEASE_MS,
          databaseNowSeconds: deps.databaseNowSeconds,
        }).scheduleRetry({
          workspaceId: prepared.workspaceId,
          operationId: prepared.operationId,
          attemptFence: prepared.attemptFence,
          errorCode,
          retryAfterMs: RETRY_AFTER_MS,
        });
      },
      { behavior: "immediate" },
    );
  } catch {
    // The original failure is authoritative. A lost retry transition leaves
    // the exact running receipt and lease in place for safe expiry recovery.
  }
}

async function finishDeletion(
  deps: ProjectDriveProjectDeletionDependencies,
  prepared: PreparedDeletion,
): Promise<ProjectDriveProjectDeletionResult> {
  return deps.database.transaction(
    async (transaction) => {
      const state = await readProjectState(transaction, prepared.workspaceId);
      await assertNoPendingDelegatedUploads(
        transaction,
        prepared.workspaceId,
      );
      await assertNoAccountErasureFences(
        transaction,
        relatedAccountUserIds(state),
      );
      if (projectStateFingerprint(state) !== prepared.stateFingerprint) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }

      const completed = await createProjectDriveOperationJournal({
        database: transaction,
        randomOperationId: deps.randomOperationId,
        leaseDurationMs: deps.leaseDurationMs ?? DELETE_LEASE_MS,
        databaseNowSeconds: deps.databaseNowSeconds,
      }).complete({
        workspaceId: prepared.workspaceId,
        operationId: prepared.operationId,
        attemptFence: prepared.attemptFence,
        operationKind: "project_delete",
        receipt: {},
      });
      if (completed.outcome === "conflict") {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }

      await deleteProjectRowsInTransaction(transaction, prepared.workspaceId);
      const deleted = await transaction
        .delete(workspaces)
        .where(eq(workspaces.id, prepared.workspaceId))
        .returning({ id: workspaces.id });
      if (!deleted[0]) {
        throw new ProjectDriveProjectDeletionError("receipt-conflict");
      }

      return Object.freeze({
        workspaceId: prepared.workspaceId,
        slug: prepared.workspace.slug,
        wasPublished: prepared.workspace.publishedAt !== null,
        revokedGrantCount: new Set(
          prepared.receipts.map(providerReceiptKey),
        ).size,
      });
    },
    { behavior: "immediate" },
  );
}

/**
 * Delete one Project without ever deleting provider-owned files or folders.
 *
 * Authorization intentionally lives at the existing `deleteProject` boundary.
 * This service begins only after that proof. It first commits a durable,
 * DB-clock-fenced delete intent and exact permission snapshot, performs only
 * idempotent named-user permission DELETEs outside any database writer
 * transaction, then atomically re-proves the snapshot and removes local rows.
 */
export function createProjectDriveProjectDeletionService(
  deps: ProjectDriveProjectDeletionDependencies,
) {
  return Object.freeze({
    async delete(input: Readonly<{ workspaceId: string }>) {
      const workspaceId = canonicalId(input.workspaceId, "workspaceId");
      const prepared = await prepareDeletion(deps, workspaceId);
      const providerReceipts = new Map<string, ExactDriveGrantReceipt>();
      for (const receipt of prepared.receipts) {
        providerReceipts.set(providerReceiptKey(receipt), receipt);
      }

      try {
        for (const receipt of providerReceipts.values()) {
          // Deliberately outside both writer transactions. If any call fails,
          // the Project, membership, storage and exact receipts all remain.
          await deps.revokeExactGrant(receipt);
        }
      } catch (error) {
        await scheduleRetry(deps, prepared, "provider_unavailable");
        throw error;
      }

      try {
        return await finishDeletion(deps, prepared);
      } catch (error) {
        if (
          error instanceof ProjectDriveProjectDeletionError &&
          error.code !== "account-erasure-in-progress"
        ) {
          await scheduleRetry(deps, prepared, "workspace_changed");
        }
        throw error;
      }
    },
  });
}
