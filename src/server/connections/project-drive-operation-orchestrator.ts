import "server-only";

import { eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  meta,
  projectDriveOperations,
  providerConnections,
  users,
  workspaces,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import {
  canonicalProjectDriveOperationErasureRecoveryInput,
  canonicalProjectDriveOperationFenceInput,
  canonicalProjectDriveOperationLocator,
  canonicalProjectDriveOperationPrepareInput,
  createProjectDriveOperationJournal,
  type ProjectDriveOperationConflict,
  type ProjectDriveOperationErasureRecoveryInput,
  type ProjectDriveOperationFenceInput,
  type ProjectDriveOperationJournalDependencies,
  type ProjectDriveOperationLocator,
  type ProjectDriveOperationPrepareInput,
} from "./project-drive-operation-journal";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

type OrchestrationDb = LibSQLDatabase<typeof schema>;
type JournalRuntimeDependencies = Omit<
  ProjectDriveOperationJournalDependencies,
  "database"
>;
export type ProjectDriveOperationOrchestrationTransaction = Parameters<
  Parameters<OrchestrationDb["transaction"]>[0]
>[0];

export type ProjectDriveOperationOrchestratorDependencies =
  JournalRuntimeDependencies &
    Readonly<{
      database: OrchestrationDb;
    }>;

type OperationRelations = Readonly<{
  workspaceId: string;
  operationKind:
    | "folder_provision"
    | "grant_create"
    | "folder_rename"
    | "project_delete"
    | "storage_handover";
  connectionId: string | null;
  storageGenerationId: string | null;
  subjectUserId: string | null;
}>;

const NEUTRAL_CONFLICT: ProjectDriveOperationConflict = Object.freeze({
  outcome: "conflict",
});

function relationsFromPrepare(
  input: ProjectDriveOperationPrepareInput,
): OperationRelations {
  const base = {
    workspaceId: input.workspaceId,
    operationKind: input.operationKind,
    connectionId: null,
    storageGenerationId: null,
    subjectUserId: null,
  } as const;
  switch (input.operationKind) {
    case "folder_provision":
      return { ...base, connectionId: input.connectionId };
    case "grant_create":
      return {
        ...base,
        storageGenerationId: input.storageGenerationId,
        subjectUserId: input.subjectUserId,
      };
    case "folder_rename":
      return { ...base, storageGenerationId: input.storageGenerationId };
    case "project_delete":
      return base;
    case "storage_handover":
      return {
        ...base,
        connectionId: input.connectionId,
        storageGenerationId: input.storageGenerationId,
      };
  }
}

function relationsFromStoredOperation(
  operation: typeof projectDriveOperations.$inferSelect,
): OperationRelations | null {
  const base = {
    workspaceId: operation.workspaceId,
    operationKind: operation.operationKind,
    connectionId: null,
    storageGenerationId: null,
    subjectUserId: null,
  } as const;
  switch (operation.operationKind) {
    case "folder_provision":
      return operation.connectionId
        ? { ...base, connectionId: operation.connectionId }
        : null;
    case "grant_create":
      return operation.storageGenerationId && operation.subjectUserId
        ? {
            ...base,
            storageGenerationId: operation.storageGenerationId,
            subjectUserId: operation.subjectUserId,
          }
        : null;
    case "folder_rename":
      return operation.storageGenerationId
        ? { ...base, storageGenerationId: operation.storageGenerationId }
        : null;
    case "project_delete":
      return base;
    case "storage_handover":
      return operation.connectionId && operation.storageGenerationId
        ? {
            ...base,
            connectionId: operation.connectionId,
            storageGenerationId: operation.storageGenerationId,
          }
        : null;
  }
}

/**
 * Resolve every account that can be affected by an operation using database
 * truth only. Every storage owner in the workspace is related even when the
 * operation shape has no storage column (notably project deletion), matching
 * account erasure's workspace-wide storage-lineage fence. A missing
 * relationship is indistinguishable from a fence: both return the journal's
 * neutral conflict result.
 */
async function resolveRelatedAccountIds(
  transaction: ProjectDriveOperationOrchestrationTransaction,
  relations: OperationRelations,
): Promise<readonly string[] | null> {
  const [workspace] = await transaction
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(byWorkspace(workspaces.id, relations.workspaceId))
    .limit(1);
  if (!workspace?.ownerUserId) return null;

  const accountIds = new Set<string>([workspace.ownerUserId]);
  const storageAccounts = await transaction
    .select({
      storageGenerationId: workspaceStorage.id,
      userId: providerConnections.userId,
    })
    .from(workspaceStorage)
    .leftJoin(
      providerConnections,
      eq(workspaceStorage.connectionId, providerConnections.id),
    )
    .where(byWorkspace(workspaceStorage.workspaceId, relations.workspaceId));
  const storageOwnerByGeneration = new Map<string, string>();
  for (const storageAccount of storageAccounts) {
    if (!storageAccount.userId) return null;
    storageOwnerByGeneration.set(
      storageAccount.storageGenerationId,
      storageAccount.userId,
    );
    accountIds.add(storageAccount.userId);
  }

  if (relations.subjectUserId) {
    const [subject] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, relations.subjectUserId))
      .limit(1);
    if (!subject) return null;
    accountIds.add(subject.id);
  }

  // For folder provision this is the credential owner. For handover it is
  // specifically the target credential owner; the source owner is resolved
  // independently through the immutable source storage generation below.
  if (relations.connectionId) {
    const [connection] = await transaction
      .select({ userId: providerConnections.userId })
      .from(providerConnections)
      .where(eq(providerConnections.id, relations.connectionId))
      .limit(1);
    if (!connection) return null;
    accountIds.add(connection.userId);
  }

  if (relations.storageGenerationId) {
    const storageOwnerId = storageOwnerByGeneration.get(
      relations.storageGenerationId,
    );
    if (!storageOwnerId) return null;
    accountIds.add(storageOwnerId);
  }

  // Do not construct an erasure key from an orphaned FK value. Foreign keys
  // are defense in depth rather than a runtime assumption in this codebase.
  const existingAccounts = await transaction
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [...accountIds]));
  if (existingAccounts.length !== accountIds.size) return null;

  return [...accountIds];
}

async function hasRelatedAccountFence(
  transaction: ProjectDriveOperationOrchestrationTransaction,
  accountIds: readonly string[],
): Promise<boolean> {
  const fenceKeys = accountIds.map(googleDriveAccountErasureFenceKey);
  const [fence] = await transaction
    .select({ key: meta.key })
    .from(meta)
    .where(inArray(meta.key, fenceKeys))
    .limit(1);
  // Any value at the versioned key is a fence. A corrupt or future value must
  // fail closed rather than becoming an accidental bypass.
  return Boolean(fence);
}

async function readStoredOperation(
  transaction: ProjectDriveOperationOrchestrationTransaction,
  input: ProjectDriveOperationLocator,
) {
  const [operation] = await transaction
    .select()
    .from(projectDriveOperations)
    .where(
      byWorkspace(
        projectDriveOperations.workspaceId,
        input.workspaceId,
        eq(projectDriveOperations.id, input.operationId),
      ),
    )
    .limit(1);
  return operation ?? null;
}

/**
 * Prepare a durable operation inside a caller-owned immediate transaction.
 *
 * Lifecycle writes use this seam when the domain mutation and its provider
 * intent must have one commit point (for example a Project rename). Account
 * relationship resolution, erasure-fence detection, and journal insertion
 * are therefore identical to the standalone orchestrator path without
 * opening a nested transaction. Provider I/O is never performed here.
 */
export async function prepareAccountFencedProjectDriveOperationInTransaction(
  transaction: ProjectDriveOperationOrchestrationTransaction,
  input: ProjectDriveOperationPrepareInput,
  journalRuntimeDependencies: JournalRuntimeDependencies = {},
) {
  const canonical = canonicalProjectDriveOperationPrepareInput(input);
  const accountIds = await resolveRelatedAccountIds(
    transaction,
    relationsFromPrepare(canonical),
  );
  if (!accountIds || (await hasRelatedAccountFence(transaction, accountIds))) {
    return NEUTRAL_CONFLICT;
  }
  if (canonical.operationKind !== "project_delete") {
    await assertProjectNotDeleting(transaction, canonical.workspaceId);
  }
  return createProjectDriveOperationJournal({
    ...journalRuntimeDependencies,
    database: transaction,
  }).prepare(canonical);
}

/**
 * Account-fenced entry points for every operation transition that can create
 * or restore claimable work. Relationship resolution, fence detection and
 * the journal mutation share one libSQL/Drizzle transaction, so erasure and
 * execution have a deterministic winner without a time-of-check gap.
 */
export function createAccountFencedProjectDriveOperationJournal(
  deps: ProjectDriveOperationOrchestratorDependencies,
) {
  const { database, ...journalRuntimeDependencies } = deps;

  const journalFor = (
    transaction: ProjectDriveOperationOrchestrationTransaction,
  ) =>
    createProjectDriveOperationJournal({
      ...journalRuntimeDependencies,
      database: transaction,
    });

  return Object.freeze({
    async prepare(input: ProjectDriveOperationPrepareInput) {
      return database.transaction(
        (transaction) =>
          prepareAccountFencedProjectDriveOperationInTransaction(
            transaction,
            input,
            journalRuntimeDependencies,
          ),
        { behavior: "immediate" },
      );
    },

    async claim(input: ProjectDriveOperationLocator) {
      const canonical = canonicalProjectDriveOperationLocator(input);
      return database.transaction(
        async (transaction) => {
          const operation = await readStoredOperation(transaction, canonical);
          const relations = operation
            ? relationsFromStoredOperation(operation)
            : null;
          const accountIds = relations
            ? await resolveRelatedAccountIds(transaction, relations)
            : null;
          if (
            !accountIds ||
            (await hasRelatedAccountFence(transaction, accountIds))
          ) {
            return NEUTRAL_CONFLICT;
          }
          return journalFor(transaction).claim(canonical);
        },
        { behavior: "immediate" },
      );
    },

    /**
     * Move an expired attempt into a non-claimable recovery state while a
     * related account-erasure fence is active. This is the inverse of the
     * ordinary claim gate: without an active fence it returns the same neutral
     * conflict result and reveals no operation details.
     */
    async quarantineExpiredForErasure(input: ProjectDriveOperationLocator) {
      const canonical = canonicalProjectDriveOperationLocator(input);
      return database.transaction(
        async (transaction) => {
          const operation = await readStoredOperation(transaction, canonical);
          const relations = operation
            ? relationsFromStoredOperation(operation)
            : null;
          const accountIds = relations
            ? await resolveRelatedAccountIds(transaction, relations)
            : null;
          if (
            !accountIds ||
            !(await hasRelatedAccountFence(transaction, accountIds))
          ) {
            return NEUTRAL_CONFLICT;
          }
          return journalFor(transaction).quarantineExpiredForErasure(
            canonical,
          );
        },
        { behavior: "immediate" },
      );
    },

    /**
     * Record a read-only recovery result while the account fence remains
     * active. This can materialize an exact receipt or a definitive
     * no-mutation result, but it cannot claim work or initiate provider I/O.
     */
    async recordErasureRecovery(
      input: ProjectDriveOperationErasureRecoveryInput,
    ) {
      const canonical =
        canonicalProjectDriveOperationErasureRecoveryInput(input);
      const locator =
        canonical.providerTruth === "provider_mutation_confirmed"
          ? {
              workspaceId: canonical.completion.workspaceId,
              operationId: canonical.completion.operationId,
            }
          : {
              workspaceId: canonical.fence.workspaceId,
              operationId: canonical.fence.operationId,
            };
      return database.transaction(
        async (transaction) => {
          const operation = await readStoredOperation(transaction, locator);
          const relations = operation
            ? relationsFromStoredOperation(operation)
            : null;
          const accountIds = relations
            ? await resolveRelatedAccountIds(transaction, relations)
            : null;
          if (
            !accountIds ||
            !(await hasRelatedAccountFence(transaction, accountIds))
          ) {
            return NEUTRAL_CONFLICT;
          }
          return journalFor(transaction).recordErasureRecovery(input);
        },
        { behavior: "immediate" },
      );
    },

    async requeueManualAttention(input: ProjectDriveOperationFenceInput) {
      const canonical = canonicalProjectDriveOperationFenceInput(input);
      return database.transaction(
        async (transaction) => {
          // The caller supplies only the journal locator and attempt fence. All
          // account identity comes from the stored row inside this transaction.
          const operation = await readStoredOperation(transaction, canonical);
          const relations = operation
            ? relationsFromStoredOperation(operation)
            : null;
          const accountIds = relations
            ? await resolveRelatedAccountIds(transaction, relations)
            : null;
          if (
            !accountIds ||
            (await hasRelatedAccountFence(transaction, accountIds))
          ) {
            return NEUTRAL_CONFLICT;
          }
          return journalFor(transaction).requeueManualAttention(canonical);
        },
        { behavior: "immediate" },
      );
    },
  });
}

/** Production entry point for opening or restoring claimable Drive work. */
export const accountFencedProjectDriveOperationJournal =
  createAccountFencedProjectDriveOperationJournal({ database: db });
