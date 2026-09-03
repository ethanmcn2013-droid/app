import "server-only";

import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  projectDriveOperations,
  providerConnections,
  workspaces,
  workspaceStorage,
  type ProjectDriveOperationErrorCode,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import {
  createDriveFolderService,
  type DriveFolderProviderError,
  DriveFolderError,
  isDriveFolderProviderError,
  type ProjectDriveFolderProvisionClaim,
  type ProjectDriveFolderRenameClaim,
  type ProjectDriveFolderRenameResult,
  type WorkspaceDriveFolder,
} from "./drive-folders";
import {
  ProjectDriveAccessError,
  projectDriveAccessServiceFromEnv,
} from "./project-drive-access";
import {
  canonicalProjectDriveOperationLocator,
  createProjectDriveOperationJournal,
  projectDriveOperationJournal,
  type ProjectDriveOperationClaim,
  type ProjectDriveOperationConflict,
  type ProjectDriveOperationJournalDatabase,
  type ProjectDriveOperationPrepareInput,
} from "./project-drive-operation-journal";
import {
  accountFencedProjectDriveOperationJournal,
  prepareAccountFencedProjectDriveOperationInTransaction,
} from "./project-drive-operation-orchestrator";
import {
  prepareExistingMemberDriveGrantIntents,
  ProjectDriveMembershipLifecycleError,
} from "./project-drive-membership-lifecycle";

type ExecutorDb = LibSQLDatabase<typeof schema>;
type Journal = ReturnType<typeof createProjectDriveOperationJournal>;
type AccountFencedJournal = typeof accountFencedProjectDriveOperationJournal;
type FolderService = ReturnType<typeof createDriveFolderService>;

export type ProjectDriveFolderOperationKind =
  | "folder_provision"
  | "folder_rename";

export type ProjectDriveFolderOperationPrepareInput = Extract<
  ProjectDriveOperationPrepareInput,
  Readonly<{ operationKind: ProjectDriveFolderOperationKind }>
>;

export type ProjectDriveFolderOperationLocator = Readonly<{
  workspaceId: string;
  operationId: string;
  operationKind: ProjectDriveFolderOperationKind;
}>;

export type ProjectDriveFolderOperationExecutionResult =
  | Awaited<ReturnType<Journal["complete"]>>
  | Awaited<ReturnType<Journal["scheduleRetry"]>>
  | Awaited<ReturnType<Journal["markManualAttention"]>>;

type ProviderSuccess =
  | Readonly<{
      claim: ProjectDriveFolderProvisionClaim;
      result: WorkspaceDriveFolder;
    }>
  | Readonly<{
      claim: ProjectDriveFolderRenameClaim;
      result: ProjectDriveFolderRenameResult;
    }>;

export type ProjectDriveFolderOperationExecutorDependencies = Readonly<{
  database: ExecutorDb;
  operations: Pick<AccountFencedJournal, "prepare" | "claim">;
  journal: Pick<Journal, "scheduleRetry" | "markManualAttention">;
  journalForTransaction: (
    database: ProjectDriveOperationJournalDatabase,
  ) => Pick<Journal, "complete">;
  folders: Pick<FolderService, "provisionClaimed" | "renameClaimed">;
  retryBaseMs?: number;
  maxAutomaticAttempts?: number;
  /** Test-only crash seam. Production leaves this undefined. */
  afterProviderSuccess?: (success: ProviderSuccess) => Promise<void>;
}>;

const CONFLICT: ProjectDriveOperationConflict = Object.freeze({
  outcome: "conflict",
});
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15 * 60_000;

class ProjectDriveFolderOperationClaimConflict extends Error {
  constructor() {
    super("The Project Drive operation claim is no longer current.");
    this.name = "ProjectDriveFolderOperationClaimConflict";
  }
}

type FailurePlan = Readonly<{
  disposition: "retry" | "manual";
  errorCode: ProjectDriveOperationErrorCode;
}>;

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < 1 || candidate > maximum) {
    throw new TypeError("Project Drive executor timing is invalid.");
  }
  return candidate;
}

function isMutatingProviderOperation(error: DriveFolderProviderError): boolean {
  return error.operation === "file-create" || error.operation === "file-rename";
}

function classifyProviderFailure(error: DriveFolderProviderError): FailurePlan {
  if (error.status === 401) {
    return { disposition: "manual", errorCode: "reauth_required" };
  }
  if (
    error.reason === "storageQuotaExceeded" ||
    error.reason === "quotaExceeded"
  ) {
    return { disposition: "manual", errorCode: "quota_full" };
  }
  if (error.status === 404) {
    return { disposition: "manual", errorCode: "folder_missing" };
  }
  if (error.status === 403 && !error.retryable) {
    return { disposition: "manual", errorCode: "permission_denied" };
  }
  if (error.status === 409) {
    return { disposition: "manual", errorCode: "provider_conflict" };
  }
  if (
    error.status === 429 ||
    error.reason === "rateLimitExceeded" ||
    error.reason === "userRateLimitExceeded"
  ) {
    return { disposition: "retry", errorCode: "rate_limited" };
  }
  if (isMutatingProviderOperation(error)) {
    return {
      disposition: "retry",
      errorCode: "ambiguous_provider_result",
    };
  }
  if (error.code === "network-error") {
    return { disposition: "retry", errorCode: "network_error" };
  }
  if (error.retryable || (error.status !== null && error.status >= 500)) {
    return { disposition: "retry", errorCode: "provider_unavailable" };
  }
  if (error.code === "malformed-response") {
    return { disposition: "retry", errorCode: "provider_unavailable" };
  }
  return { disposition: "manual", errorCode: "provider_conflict" };
}

function classifyFailure(error: unknown): FailurePlan {
  if (error instanceof DriveFolderError) {
    const byCode: Record<DriveFolderError["code"], FailurePlan> = {
      "invalid-input": {
        disposition: "manual",
        errorCode: "repair_incomplete",
      },
      "folder-ambiguous": {
        disposition: "manual",
        errorCode: "ambiguous_provider_result",
      },
      "folder-invalid": {
        disposition: "manual",
        errorCode: "provider_conflict",
      },
      "folder-missing": {
        disposition: "manual",
        errorCode: "folder_missing",
      },
      "storage-conflict": {
        disposition: "manual",
        errorCode: "workspace_changed",
      },
    };
    return byCode[error.code];
  }
  if (error instanceof ProjectDriveAccessError) {
    const byCode: Record<ProjectDriveAccessError["code"], FailurePlan> = {
      "storage-not-found": {
        disposition: "manual",
        errorCode: "workspace_changed",
      },
      "storage-ambiguous": {
        disposition: "manual",
        errorCode: "repair_incomplete",
      },
      "connection-not-found": {
        disposition: "manual",
        errorCode: "reauth_required",
      },
      "connection-ambiguous": {
        disposition: "manual",
        errorCode: "repair_incomplete",
      },
      "connection-not-current": {
        disposition: "manual",
        errorCode: "connection_not_current",
      },
      "needs-reauth": {
        disposition: "manual",
        errorCode: "reauth_required",
      },
      "unexpected-scope-set": {
        disposition: "manual",
        errorCode: "permission_denied",
      },
    };
    return byCode[error.code];
  }
  if (isDriveFolderProviderError(error)) {
    return classifyProviderFailure(error);
  }
  return { disposition: "retry", errorCode: "network_error" };
}

function isConstraintFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(?:SQLITE_CONSTRAINT|UNIQUE constraint|FOREIGN KEY constraint)/i.test(
      error.message,
    )
  );
}

export function createProjectDriveFolderOperationExecutor(
  deps: ProjectDriveFolderOperationExecutorDependencies,
) {
  const retryBaseMs = boundedPositiveInteger(
    deps.retryBaseMs,
    30_000,
    MAX_RETRY_MS,
  );
  const maxAutomaticAttempts = boundedPositiveInteger(
    deps.maxAutomaticAttempts,
    5,
    100,
  );

  async function prepare(input: ProjectDriveFolderOperationPrepareInput) {
    // This is the only preparation path: relationship resolution, account
    // erasure fences, and journal insertion share the orchestrator transaction.
    return deps.operations.prepare(input);
  }

  async function expectedOperation(
    input: ProjectDriveFolderOperationLocator,
  ): Promise<boolean> {
    const locator = canonicalProjectDriveOperationLocator({
      workspaceId: input.workspaceId,
      operationId: input.operationId,
    });
    const [operation] = await deps.database
      .select({ operationKind: projectDriveOperations.operationKind })
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          locator.workspaceId,
          eq(projectDriveOperations.id, locator.operationId),
          eq(projectDriveOperations.operationKind, input.operationKind),
        ),
      )
      .limit(1);
    return operation?.operationKind === input.operationKind;
  }

  async function provisionFolderName(
    claim: ProjectDriveFolderProvisionClaim,
  ): Promise<string> {
    const workspaceRows = await deps.database
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(byWorkspace(workspaces.id, claim.workspaceId))
      .limit(2);
    if (workspaceRows.length !== 1) {
      throw new DriveFolderError("storage-conflict");
    }
    const currentRows = await deps.database
      .select({ id: workspaceStorage.id })
      .from(workspaceStorage)
      .where(
        byWorkspace(
          workspaceStorage.workspaceId,
          claim.workspaceId,
          eq(workspaceStorage.isCurrent, true),
        ),
      )
      .limit(2);
    if (
      currentRows.length > 1 ||
      (currentRows.length === 1 &&
        currentRows[0].id !== claim.targetStorageGenerationId)
    ) {
      throw new DriveFolderError("storage-conflict");
    }
    return workspaceRows[0].name;
  }

  async function persistProvision(
    claim: ProjectDriveFolderProvisionClaim,
    result: WorkspaceDriveFolder,
  ) {
    try {
      return await deps.database.transaction(
        async (transaction) => {
          const [workspace] = await transaction
            .select({ archivedAt: workspaces.archivedAt })
            .from(workspaces)
            .where(byWorkspace(workspaces.id, claim.workspaceId))
            .limit(1);
          if (!workspace || workspace.archivedAt !== null) {
            throw new DriveFolderError("storage-conflict");
          }
          const [connection] = await transaction
            .select({
              id: providerConnections.id,
              status: providerConnections.status,
              isCurrent: providerConnections.isCurrent,
            })
            .from(providerConnections)
            .where(eq(providerConnections.id, claim.connectionId))
            .limit(1);
          if (
            !connection ||
            connection.status !== "active" ||
            !connection.isCurrent ||
            result.connectionId !== claim.connectionId
          ) {
            throw new DriveFolderError("storage-conflict");
          }

          const generations = await transaction
            .select()
            .from(workspaceStorage)
            .where(
              byWorkspace(
                workspaceStorage.workspaceId,
                claim.workspaceId,
                eq(workspaceStorage.id, claim.targetStorageGenerationId),
              ),
            )
            .limit(2);
          const currentRows = await transaction
            .select({ id: workspaceStorage.id })
            .from(workspaceStorage)
            .where(
              byWorkspace(
                workspaceStorage.workspaceId,
                claim.workspaceId,
                eq(workspaceStorage.isCurrent, true),
              ),
            )
            .limit(2);
          if (generations.length > 1 || currentRows.length > 1) {
            throw new DriveFolderError("storage-conflict");
          }
          const existing = generations[0] ?? null;
          if (existing) {
            if (
              !existing.isCurrent ||
              existing.connectionId !== claim.connectionId ||
              existing.folderId !== result.folderId ||
              existing.folderWebViewLink !== result.folderWebViewLink
            ) {
              throw new DriveFolderError("storage-conflict");
            }
          } else {
            if (currentRows.length > 0) {
              throw new DriveFolderError("storage-conflict");
            }
            await transaction.insert(workspaceStorage).values({
              id: claim.targetStorageGenerationId,
              workspaceId: claim.workspaceId,
              connectionId: claim.connectionId,
              folderId: result.folderId,
              folderWebViewLink: result.folderWebViewLink,
              state: "active",
              isCurrent: true,
            });
          }

          // Re-prove the exact operation relationships after provider success
          // and after the new generation is visible in this transaction. An
          // account-erasure fence that won during the provider request blocks
          // both storage materialization and every member grant intent.
          const reproved =
            await prepareAccountFencedProjectDriveOperationInTransaction(
              transaction,
              {
                operationKind: "folder_provision",
                workspaceId: claim.workspaceId,
                connectionId: claim.connectionId,
                targetStorageGenerationId:
                  claim.targetStorageGenerationId,
              },
            );
          if (
            reproved.outcome === "conflict" ||
            reproved.operation.operationId !== claim.operationId
          ) {
            throw new ProjectDriveFolderOperationClaimConflict();
          }

          // A populated Project must never materialize a Drive generation
          // without also durably recording how each current member will gain
          // access. Missing/invalid emails are intentionally counted by the
          // helper as D14 coverage gaps; they do not delete the membership or
          // roll back the folder. No provider I/O occurs in this transaction.
          try {
            await prepareExistingMemberDriveGrantIntents(transaction, {
              workspaceId: claim.workspaceId,
              storageGenerationId: claim.targetStorageGenerationId,
            });
          } catch (error) {
            if (error instanceof ProjectDriveMembershipLifecycleError) {
              if (error.code === "operation-conflict") {
                throw new ProjectDriveFolderOperationClaimConflict();
              }
              if (error.code === "storage-invalid") {
                throw new DriveFolderError("storage-conflict");
              }
            }
            throw error;
          }

          const completion = await deps
            .journalForTransaction(transaction)
            .complete({
              workspaceId: claim.workspaceId,
              operationId: claim.operationId,
              attemptFence: claim.attemptFence,
              operationKind: "folder_provision",
              receipt: {
                providerFolderId: result.folderId,
                providerFolderWebViewLink: result.folderWebViewLink,
              },
            });
          if (completion.outcome === "conflict") {
            throw new ProjectDriveFolderOperationClaimConflict();
          }
          return completion;
        },
        { behavior: "immediate" },
      );
    } catch (error) {
      if (
        error instanceof DriveFolderError ||
        error instanceof ProjectDriveFolderOperationClaimConflict
      ) {
        throw error;
      }
      if (isConstraintFailure(error)) {
        throw new DriveFolderError("storage-conflict");
      }
      throw error;
    }
  }

  async function persistRename(
    claim: ProjectDriveFolderRenameClaim,
    result: ProjectDriveFolderRenameResult,
  ) {
    return deps.database.transaction(
      async (transaction) => {
        const workspacesAtRevision = await transaction
          .select({ name: workspaces.name })
          .from(workspaces)
          .where(
            byWorkspace(
              workspaces.id,
              claim.workspaceId,
              eq(workspaces.revision, claim.workspaceRevision),
              eq(workspaces.name, result.folderName),
            ),
          )
          .limit(2);
        const storageRows = await transaction
          .select({
            id: workspaceStorage.id,
            connectionId: workspaceStorage.connectionId,
            folderId: workspaceStorage.folderId,
          })
          .from(workspaceStorage)
          .where(
            byWorkspace(
              workspaceStorage.workspaceId,
              claim.workspaceId,
              eq(workspaceStorage.id, claim.storageGenerationId),
              eq(workspaceStorage.isCurrent, true),
            ),
          )
          .limit(2);
        if (
          workspacesAtRevision.length !== 1 ||
          storageRows.length !== 1 ||
          storageRows[0].id !== result.storageGenerationId ||
          storageRows[0].connectionId !== result.connectionId ||
          storageRows[0].folderId !== result.folderId
        ) {
          throw new DriveFolderError("storage-conflict");
        }
        const completion = await deps
          .journalForTransaction(transaction)
          .complete({
            workspaceId: claim.workspaceId,
            operationId: claim.operationId,
            attemptFence: claim.attemptFence,
            operationKind: "folder_rename",
            receipt: {},
          });
        if (completion.outcome === "conflict") {
          throw new ProjectDriveFolderOperationClaimConflict();
        }
        return completion;
      },
      { behavior: "immediate" },
    );
  }

  async function recordFailure(
    claim: ProjectDriveOperationClaim,
    error: unknown,
  ): Promise<ProjectDriveFolderOperationExecutionResult> {
    if (error instanceof ProjectDriveFolderOperationClaimConflict) {
      return CONFLICT;
    }
    const failure = classifyFailure(error);
    if (
      failure.disposition === "retry" &&
      claim.attemptFence < maxAutomaticAttempts
    ) {
      const multiplier = 2 ** Math.max(0, claim.attemptFence - 1);
      const retryAfterMs = Math.min(
        MAX_RETRY_MS,
        Math.max(MIN_RETRY_MS, retryBaseMs * multiplier),
      );
      return deps.journal.scheduleRetry({
        workspaceId: claim.workspaceId,
        operationId: claim.operationId,
        attemptFence: claim.attemptFence,
        errorCode: failure.errorCode,
        retryAfterMs,
      });
    }
    return deps.journal.markManualAttention({
      workspaceId: claim.workspaceId,
      operationId: claim.operationId,
      attemptFence: claim.attemptFence,
      errorCode:
        failure.disposition === "retry"
          ? "repair_incomplete"
          : failure.errorCode,
    });
  }

  async function execute(
    input: ProjectDriveFolderOperationLocator,
  ): Promise<ProjectDriveFolderOperationExecutionResult> {
    if (
      input.operationKind !== "folder_provision" &&
      input.operationKind !== "folder_rename"
    ) {
      return CONFLICT;
    }
    if (!(await expectedOperation(input))) return CONFLICT;

    // This is the only claim path. The account fence and claim CAS share the
    // orchestrator transaction; provider work starts only after it commits.
    const claimed = await deps.operations.claim({
      workspaceId: input.workspaceId,
      operationId: input.operationId,
    });
    if (claimed.outcome === "conflict") return claimed;
    const claim = claimed.claim;
    if (claim.operationKind !== input.operationKind) return CONFLICT;

    if (claim.operationKind === "folder_provision") {
      let result: WorkspaceDriveFolder;
      try {
        const folderName = await provisionFolderName(claim);
        result = await deps.folders.provisionClaimed(claim, folderName);
      } catch (error) {
        return recordFailure(claim, error);
      }
      // Throwing here models a process death: do not write a guessed failure.
      // The expired lease will be reclaimed and the exact marker adopted.
      await deps.afterProviderSuccess?.({ claim, result });
      try {
        return await persistProvision(claim, result);
      } catch (error) {
        return recordFailure(claim, error);
      }
    }

    let result: ProjectDriveFolderRenameResult;
    try {
      result = await deps.folders.renameClaimed(claim);
    } catch (error) {
      return recordFailure(claim, error);
    }
    await deps.afterProviderSuccess?.({ claim, result });
    try {
      return await persistRename(claim, result);
    } catch (error) {
      return recordFailure(claim, error);
    }
  }

  return Object.freeze({ prepare, execute });
}

/** Build the production executor lazily so env-backed key material is read at use. */
export function projectDriveFolderOperationExecutorFromEnv() {
  const access = projectDriveAccessServiceFromEnv();
  const folders = createDriveFolderService({
    database: db,
    access,
    fetchImpl: fetch,
  });
  return createProjectDriveFolderOperationExecutor({
    database: db,
    operations: accountFencedProjectDriveOperationJournal,
    journal: projectDriveOperationJournal,
    journalForTransaction: (database) =>
      createProjectDriveOperationJournal({ database }),
    folders,
  });
}

export async function executeProjectDriveFolderOperation(
  input: ProjectDriveFolderOperationLocator,
): Promise<ProjectDriveFolderOperationExecutionResult> {
  return projectDriveFolderOperationExecutorFromEnv().execute(input);
}
