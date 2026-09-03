import "server-only";

import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  users,
  workspaces,
  workspaceMembers,
  workspaceStorage,
  type ProjectDriveOperationErrorCode,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import {
  DriveGrantError,
  recoverOrCreateExactDriveUserPermission,
  type RecoveredDriveGrant,
} from "./drive-grants";
import {
  ProjectDriveAccessError,
  withProjectDriveReceiptSession,
  type ProjectDriveAccessService,
  type ProjectDriveStorageReceipt,
  type ProjectDriveStorageSession,
} from "./project-drive-access";
import {
  createProjectDriveOperationJournal,
  projectDriveOperationJournal,
  type ProjectDriveOperationClaim,
  type ProjectDriveOperationConflict,
  type ProjectDriveOperationJournalDatabase,
  type ProjectDriveOperationPrepareInput,
  type ProjectDriveOperationView,
} from "./project-drive-operation-journal";
import { normalizeProjectDriveGranteeEmail } from "./project-drive-operation-key";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { accountFencedProjectDriveOperationJournal } from "./project-drive-operation-orchestrator";

type ExecutorDb = LibSQLDatabase<typeof schema>;
type ExecutorTransaction = Parameters<
  Parameters<ExecutorDb["transaction"]>[0]
>[0];
type Journal = ReturnType<typeof createProjectDriveOperationJournal>;
type AccountFencedJournal = typeof accountFencedProjectDriveOperationJournal;

export type ProjectDriveGrantOperationPrepareInput = Extract<
  ProjectDriveOperationPrepareInput,
  Readonly<{ operationKind: "grant_create" }>
>;

export type ProjectDriveGrantOperationLocator = Readonly<{
  workspaceId: string;
  operationId: string;
}>;

type GrantClaim = Extract<
  ProjectDriveOperationClaim,
  Readonly<{ operationKind: "grant_create" }>
>;

type ProviderSuccess = Readonly<{
  claim: GrantClaim;
  result: RecoveredDriveGrant;
}>;

export type ProjectDriveGrantOperationExecutionResult =
  | Awaited<ReturnType<Journal["complete"]>>
  | Awaited<ReturnType<Journal["scheduleRetry"]>>
  | Awaited<ReturnType<Journal["markManualAttention"]>>
  | Readonly<{
      outcome: "repair_pending";
      operation: ProjectDriveOperationView;
    }>;

export type ProjectDriveGrantOperationExecutorDependencies = Readonly<{
  database: ExecutorDb;
  operations: Pick<AccountFencedJournal, "prepare" | "claim">;
  journal: Pick<Journal, "scheduleRetry" | "markManualAttention">;
  journalForTransaction: (
    database: ProjectDriveOperationJournalDatabase,
  ) => Pick<Journal, "complete" | "recordErasureRecovery">;
  access: Pick<ProjectDriveAccessService, "withReceiptStorageSession">;
  recoverOrCreatePermission: (
    session: ProjectDriveStorageSession,
    input: Readonly<{
      granteeEmail: string;
      role: "writer" | "reader";
      sendNotificationEmail: boolean;
      expectedPermissionId: string | null;
      beforeCreate: () => Promise<void>;
    }>,
  ) => Promise<RecoveredDriveGrant>;
  retryBaseMs?: number;
  maxAutomaticAttempts?: number;
  /** Test-only database clock. Production uses SQLite/libSQL time. */
  databaseNowSeconds?: () => SQL<Date>;
  /** Test-only crash seam. Production leaves this undefined. */
  afterProviderSuccess?: (success: ProviderSuccess) => Promise<void>;
}>;

const CONFLICT: ProjectDriveOperationConflict = Object.freeze({
  outcome: "conflict",
});
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15 * 60_000;

type GrantIntentErrorCode =
  | "account-fenced"
  | "claim-conflict"
  | "grant-conflict"
  | "storage-owner"
  | "workspace-changed";

export class ProjectDriveGrantIntentError extends Error {
  readonly code: GrantIntentErrorCode;

  constructor(code: GrantIntentErrorCode) {
    super("The Drive access operation is no longer safe to continue.");
    this.name = "ProjectDriveGrantIntentError";
    this.code = code;
  }
}

type GrantIntentSnapshot = Readonly<{
  storageReceipt: ProjectDriveStorageReceipt;
  storageOwnerUserId: string;
  expectedPermissionId: string | null;
}>;

type LiveIntentInspection = Readonly<{
  active: boolean;
  blockedByFence: boolean;
  storageReceipt: ProjectDriveStorageReceipt | null;
  storageOwnerUserId: string | null;
  existingGrant: typeof driveFolderGrants.$inferSelect | null;
}>;

type FailurePlan = Readonly<{
  disposition: "retry" | "manual";
  errorCode: ProjectDriveOperationErrorCode;
}>;

function databaseNowSeconds(
  source?: () => SQL<Date>,
): SQL<Date> {
  return source?.() ?? sql<Date>`unixepoch()`;
}

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

function canonicalLocator(input: ProjectDriveGrantOperationLocator) {
  const canonical = (value: string) => {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value !== value.trim() ||
      /[\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new TypeError("Project Drive operation locator is invalid.");
    }
    return value;
  };
  return Object.freeze({
    workspaceId: canonical(input.workspaceId),
    operationId: canonical(input.operationId),
  });
}

function safeNormalizeEmail(value: string | null): string | null {
  if (typeof value !== "string") return null;
  try {
    return normalizeProjectDriveGranteeEmail(value);
  } catch {
    return null;
  }
}

async function inspectLiveIntent(
  transaction: Pick<ExecutorTransaction, "select">,
  claim: GrantClaim,
  session: ProjectDriveStorageSession | null,
): Promise<LiveIntentInspection> {
  const workspaceRows = await transaction
    .select({
      ownerUserId: workspaces.ownerUserId,
      archivedAt: workspaces.archivedAt,
    })
    .from(workspaces)
    .where(byWorkspace(workspaces.id, claim.workspaceId))
    .limit(2);
  const storageRows = await transaction
    .select({
      id: workspaceStorage.id,
      workspaceId: workspaceStorage.workspaceId,
      connectionId: workspaceStorage.connectionId,
      folderId: workspaceStorage.folderId,
      state: workspaceStorage.state,
      isCurrent: workspaceStorage.isCurrent,
      storageOwnerUserId: providerConnections.userId,
      storageRootFolderId: providerConnections.rootFolderId,
    })
    .from(workspaceStorage)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(
      byWorkspace(
        workspaceStorage.workspaceId,
        claim.workspaceId,
        eq(workspaceStorage.id, claim.storageGenerationId),
      ),
    )
    .limit(2);
  const memberRows = await transaction
    .select({
      id: users.id,
      email: users.email,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, claim.workspaceId),
        eq(workspaceMembers.userId, claim.subjectUserId),
      ),
    )
    .limit(2);
  const existingGrants = await transaction
    .select()
    .from(driveFolderGrants)
    .where(
      and(
        eq(
          driveFolderGrants.storageGenerationId,
          claim.storageGenerationId,
        ),
        eq(driveFolderGrants.workspaceId, claim.workspaceId),
        eq(driveFolderGrants.userId, claim.subjectUserId),
      ),
    )
    .limit(2);

  const storage = storageRows.length === 1 ? storageRows[0] : null;
  const workspace = workspaceRows.length === 1 ? workspaceRows[0] : null;
  const member = memberRows.length === 1 ? memberRows[0] : null;
  const existingGrant = existingGrants.length === 1 ? existingGrants[0] : null;
  const storageReceipt = storage
    ? Object.freeze({
        workspaceId: storage.workspaceId,
        storageGenerationId: storage.id,
        connectionId: storage.connectionId,
        folderId: storage.folderId,
      })
    : null;

  const storageAccounts = await transaction
    .select({ userId: providerConnections.userId })
    .from(workspaceStorage)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(eq(workspaceStorage.workspaceId, claim.workspaceId));
  const relatedUserIds = new Set<string>();
  if (workspace?.ownerUserId) relatedUserIds.add(workspace.ownerUserId);
  relatedUserIds.add(claim.subjectUserId);
  for (const account of storageAccounts) relatedUserIds.add(account.userId);
  const relatedIds = [...relatedUserIds];
  const liveUsers =
    relatedIds.length > 0
      ? await transaction
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, relatedIds))
      : [];
  const fences =
    relatedIds.length > 0
      ? await transaction
          .select({ key: meta.key })
          .from(meta)
          .where(
            inArray(
              meta.key,
              relatedIds.map(googleDriveAccountErasureFenceKey),
            ),
          )
      : [];
  const storageOwnerMembership = storage
    ? await transaction
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, claim.workspaceId),
            eq(workspaceMembers.userId, storage.storageOwnerUserId),
          ),
        )
        .limit(2)
    : [];

  const sessionMatches =
    !session ||
    (storage !== null &&
      session.storage.id === storage.id &&
      session.storage.workspaceId === storage.workspaceId &&
      session.storage.connectionId === storage.connectionId &&
      session.storage.folderId === storage.folderId &&
      session.storageRootFolderId === storage.storageRootFolderId &&
      session.credential.ownerUserId === storage.storageOwnerUserId);
  const existingGrantMatches =
    existingGrants.length <= 1 &&
    (!existingGrant ||
      (existingGrant.storageGenerationId === claim.storageGenerationId &&
        existingGrant.workspaceId === claim.workspaceId &&
        existingGrant.userId === claim.subjectUserId &&
        existingGrant.grantedEmail === claim.granteeEmail &&
        existingGrant.role === claim.grantRole &&
        !existingGrant.revokePending));

  const active = Boolean(
    workspace &&
      workspace.archivedAt === null &&
      storage &&
      storageReceipt &&
      storage.isCurrent &&
      storage.state === "active" &&
      member &&
      safeNormalizeEmail(member.email) === claim.granteeEmail &&
      storage.storageOwnerUserId !== claim.subjectUserId &&
      storageOwnerMembership.length === 1 &&
      storageOwnerMembership[0].role === "owner" &&
      liveUsers.length === relatedIds.length &&
      fences.length === 0 &&
      sessionMatches &&
      existingGrantMatches,
  );

  return Object.freeze({
    active,
    blockedByFence: fences.length > 0,
    storageReceipt,
    storageOwnerUserId: storage?.storageOwnerUserId ?? null,
    existingGrant,
  });
}

function intentFailure(
  inspection: LiveIntentInspection,
  claim: GrantClaim,
): ProjectDriveGrantIntentError {
  if (inspection.blockedByFence) {
    return new ProjectDriveGrantIntentError("account-fenced");
  }
  if (
    inspection.storageOwnerUserId &&
    inspection.storageOwnerUserId === claim.subjectUserId
  ) {
    return new ProjectDriveGrantIntentError("storage-owner");
  }
  if (inspection.existingGrant) {
    return new ProjectDriveGrantIntentError("grant-conflict");
  }
  return new ProjectDriveGrantIntentError("workspace-changed");
}

function classifyProviderFailure(error: DriveGrantError): FailurePlan {
  if (error.code === "grant-not-found") {
    return { disposition: "manual", errorCode: "grant_not_found" };
  }
  if (error.code === "grant-conflict") {
    return {
      disposition: "manual",
      errorCode: "ambiguous_provider_result",
    };
  }
  if (
    error.code === "root-folder-target" ||
    error.code === "foreign-folder-target" ||
    error.code === "unsupported-grantee-type" ||
    error.code === "unsupported-role" ||
    error.code === "storage-owner"
  ) {
    return { disposition: "manual", errorCode: "permission_denied" };
  }
  if (
    error.code === "member-not-found" ||
    error.code === "member-email-unavailable"
  ) {
    return { disposition: "manual", errorCode: "workspace_changed" };
  }
  if (error.reason === "cannotInviteNonGoogleUser") {
    return {
      disposition: "manual",
      errorCode: "cannot_invite_non_google_user",
    };
  }
  if (error.status === 401) {
    return { disposition: "manual", errorCode: "reauth_required" };
  }
  if (error.status === 404) {
    return { disposition: "manual", errorCode: "folder_missing" };
  }
  if (
    error.status === 429 ||
    error.reason === "rateLimitExceeded" ||
    error.reason === "userRateLimitExceeded"
  ) {
    return { disposition: "retry", errorCode: "rate_limited" };
  }
  if (error.status === 403 && !error.retryable) {
    return { disposition: "manual", errorCode: "permission_denied" };
  }
  if (error.status === 409) {
    return { disposition: "manual", errorCode: "provider_conflict" };
  }
  if (
    error.operation === "permission-create" &&
    (error.retryable ||
      error.status === null ||
      error.code === "malformed-response")
  ) {
    return {
      disposition: "retry",
      errorCode: "ambiguous_provider_result",
    };
  }
  if (error.status === null && error.retryable) {
    return { disposition: "retry", errorCode: "network_error" };
  }
  if (
    error.retryable ||
    error.code === "malformed-response" ||
    (error.status !== null && error.status >= 500)
  ) {
    return { disposition: "retry", errorCode: "provider_unavailable" };
  }
  return { disposition: "manual", errorCode: "provider_conflict" };
}

function classifyFailure(error: unknown): FailurePlan {
  if (error instanceof ProjectDriveGrantIntentError) {
    const byCode: Record<GrantIntentErrorCode, FailurePlan> = {
      "account-fenced": {
        disposition: "manual",
        errorCode: "repair_incomplete",
      },
      "claim-conflict": {
        disposition: "manual",
        errorCode: "repair_incomplete",
      },
      "grant-conflict": {
        disposition: "manual",
        errorCode: "provider_conflict",
      },
      "storage-owner": {
        disposition: "manual",
        errorCode: "permission_denied",
      },
      "workspace-changed": {
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
  if (error instanceof DriveGrantError) return classifyProviderFailure(error);
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

export function createProjectDriveGrantOperationExecutor(
  deps: ProjectDriveGrantOperationExecutorDependencies,
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

  async function prepare(input: ProjectDriveGrantOperationPrepareInput) {
    return deps.operations.prepare(input);
  }

  async function expectedOperation(
    input: ProjectDriveGrantOperationLocator,
  ): Promise<boolean> {
    const locator = canonicalLocator(input);
    const [operation] = await deps.database
      .select({ operationKind: projectDriveOperations.operationKind })
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          locator.workspaceId,
          eq(projectDriveOperations.id, locator.operationId),
          eq(projectDriveOperations.operationKind, "grant_create"),
        ),
      )
      .limit(1);
    return operation?.operationKind === "grant_create";
  }

  async function claimIsCurrent(
    transaction: ExecutorTransaction,
    claim: GrantClaim,
  ): Promise<boolean> {
    const now = databaseNowSeconds(deps.databaseNowSeconds);
    const [current] = await transaction
      .update(projectDriveOperations)
      .set({
        // A short no-op write acquires the SQLite/libSQL writer slot. The
        // transaction commits before provider I/O begins.
        updatedAt: sql<Date>`max(${projectDriveOperations.updatedAt}, ${now})`,
      })
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          claim.workspaceId,
          eq(projectDriveOperations.id, claim.operationId),
          eq(projectDriveOperations.operationKind, "grant_create"),
          eq(projectDriveOperations.status, "running"),
          eq(projectDriveOperations.attemptCount, claim.attemptFence),
          lte(projectDriveOperations.lastAttemptAt, now),
          gt(projectDriveOperations.leaseExpiresAt, now),
          eq(
            projectDriveOperations.storageGenerationId,
            claim.storageGenerationId,
          ),
          eq(projectDriveOperations.subjectUserId, claim.subjectUserId),
          eq(projectDriveOperations.granteeEmail, claim.granteeEmail),
          eq(projectDriveOperations.grantRole, claim.grantRole),
          isNull(projectDriveOperations.providerFolderId),
          isNull(projectDriveOperations.providerFolderWebViewLink),
          isNull(projectDriveOperations.providerPermissionId),
        ),
      )
      .returning({ id: projectDriveOperations.id });
    return Boolean(current);
  }

  async function assertReadyForProvider(
    claim: GrantClaim,
    session: ProjectDriveStorageSession | null,
    expectedPermissionId: string | null | undefined,
  ): Promise<GrantIntentSnapshot> {
    return deps.database.transaction(
      async (transaction) => {
        if (!(await claimIsCurrent(transaction, claim))) {
          throw new ProjectDriveGrantIntentError("claim-conflict");
        }
        const inspection = await inspectLiveIntent(transaction, claim, session);
        if (!inspection.active || !inspection.storageReceipt) {
          throw intentFailure(inspection, claim);
        }
        const actualPermissionId =
          inspection.existingGrant?.permissionId ?? null;
        if (
          expectedPermissionId !== undefined &&
          actualPermissionId !== expectedPermissionId
        ) {
          throw new ProjectDriveGrantIntentError("grant-conflict");
        }
        return Object.freeze({
          storageReceipt: inspection.storageReceipt,
          storageOwnerUserId: inspection.storageOwnerUserId!,
          expectedPermissionId: actualPermissionId,
        });
      },
      { behavior: "immediate" },
    );
  }

  async function persistProviderSuccess(
    claim: GrantClaim,
    session: ProjectDriveStorageSession,
    result: RecoveredDriveGrant,
  ): Promise<ProjectDriveGrantOperationExecutionResult> {
    try {
      return await deps.database.transaction(
        async (transaction) => {
          const inspection = await inspectLiveIntent(
            transaction,
            claim,
            session,
          );
          let repairPending = !inspection.active;
          const existing = inspection.existingGrant;
          if (existing) {
            const exact =
              existing.permissionId === result.permissionId &&
              existing.grantedEmail === claim.granteeEmail &&
              existing.role === claim.grantRole;
            if (exact) {
              repairPending = repairPending || existing.revokePending;
              await transaction
                .update(driveFolderGrants)
                .set({ revokePending: repairPending })
                .where(
                  and(
                    eq(
                      driveFolderGrants.storageGenerationId,
                      claim.storageGenerationId,
                    ),
                    eq(driveFolderGrants.workspaceId, claim.workspaceId),
                    eq(driveFolderGrants.userId, claim.subjectUserId),
                    eq(driveFolderGrants.permissionId, result.permissionId),
                  ),
                );
            } else {
              // A legitimate older permission is retained by its completed
              // journal operation. The single domain row must take custody of
              // the exact result from this attempt so both durable receipt
              // stores agree about the permission that now needs repair.
              repairPending = true;
              await transaction
                .update(driveFolderGrants)
                .set({
                  permissionId: result.permissionId,
                  grantedEmail: claim.granteeEmail,
                  role: claim.grantRole,
                  grantedAt: databaseNowSeconds(deps.databaseNowSeconds),
                  revokePending: true,
                })
                .where(
                  and(
                    eq(
                      driveFolderGrants.storageGenerationId,
                      claim.storageGenerationId,
                    ),
                    eq(driveFolderGrants.workspaceId, claim.workspaceId),
                    eq(driveFolderGrants.userId, claim.subjectUserId),
                    eq(driveFolderGrants.permissionId, existing.permissionId),
                  ),
                );
            }
          } else {
            await transaction.insert(driveFolderGrants).values({
              storageGenerationId: claim.storageGenerationId,
              workspaceId: claim.workspaceId,
              userId: claim.subjectUserId,
              permissionId: result.permissionId,
              grantedEmail: claim.granteeEmail,
              role: claim.grantRole,
              grantedAt: databaseNowSeconds(deps.databaseNowSeconds),
              revokePending: repairPending,
            });
          }

          const journal = deps.journalForTransaction(transaction);
          let completion = await journal.complete({
            workspaceId: claim.workspaceId,
            operationId: claim.operationId,
            attemptFence: claim.attemptFence,
            operationKind: "grant_create",
            receipt: { providerPermissionId: result.permissionId },
          });
          if (
            completion.outcome === "conflict" &&
            inspection.blockedByFence
          ) {
            const recovery = await journal.recordErasureRecovery({
              workspaceId: claim.workspaceId,
              operationId: claim.operationId,
              attemptFence: claim.attemptFence,
              operationKind: "grant_create",
              receipt: { providerPermissionId: result.permissionId },
              providerTruth: "provider_mutation_confirmed",
            });
            if (recovery.outcome === "reconciled") {
              completion = {
                outcome: "completed",
                replayed: recovery.replayed,
                operation: recovery.operation,
              };
              repairPending = true;
            }
          }
          if (completion.outcome === "conflict") {
            throw new ProjectDriveGrantIntentError("claim-conflict");
          }
          return repairPending
            ? Object.freeze({
                outcome: "repair_pending" as const,
                operation: completion.operation,
              })
            : completion;
        },
        { behavior: "immediate" },
      );
    } catch (error) {
      if (error instanceof ProjectDriveGrantIntentError) throw error;
      if (isConstraintFailure(error)) {
        throw new ProjectDriveGrantIntentError("grant-conflict");
      }
      throw error;
    }
  }

  async function recordFailure(
    claim: GrantClaim,
    error: unknown,
  ): Promise<ProjectDriveGrantOperationExecutionResult> {
    if (
      error instanceof ProjectDriveGrantIntentError &&
      error.code === "claim-conflict"
    ) {
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
    input: ProjectDriveGrantOperationLocator,
  ): Promise<ProjectDriveGrantOperationExecutionResult> {
    const locator = canonicalLocator(input);
    if (!(await expectedOperation(locator))) return CONFLICT;

    // The account-fenced orchestrator is the only claim path. Its account
    // resolution and the journal CAS share one immediate transaction.
    const claimed = await deps.operations.claim(locator);
    if (claimed.outcome === "conflict") return claimed;
    if (claimed.claim.operationKind !== "grant_create") return CONFLICT;
    const claim = claimed.claim;

    let initial: GrantIntentSnapshot;
    try {
      initial = await assertReadyForProvider(claim, null, undefined);
    } catch (error) {
      return recordFailure(claim, error);
    }

    let crashSeamActive = false;
    try {
      return await deps.access.withReceiptStorageSession(
        initial.storageReceipt,
        async (session) => {
          const beforeDiscovery = await assertReadyForProvider(
            claim,
            session,
            initial.expectedPermissionId,
          );
          const result = await deps.recoverOrCreatePermission(session, {
            granteeEmail: claim.granteeEmail,
            role: claim.grantRole,
            sendNotificationEmail: false,
            expectedPermissionId: beforeDiscovery.expectedPermissionId,
            // Discovery is provider GET. Recheck once more after it, in a
            // short writer transaction, directly before a possible POST.
            beforeCreate: async () => {
              await assertReadyForProvider(claim, session, null);
            },
          });
          // This seam models a process death. It runs while the request-local
          // access token is still confined to the access-service callback;
          // the session object never escapes that custody boundary.
          crashSeamActive = true;
          await deps.afterProviderSuccess?.({ claim, result });
          crashSeamActive = false;
          try {
            return await persistProviderSuccess(claim, session, result);
          } catch (error) {
            return recordFailure(claim, error);
          }
        },
      );
    } catch (error) {
      if (crashSeamActive) throw error;
      return recordFailure(claim, error);
    }
  }

  return Object.freeze({ prepare, execute });
}

/** Build the production executor lazily so key material is read only at use. */
export function projectDriveGrantOperationExecutorFromEnv() {
  return createProjectDriveGrantOperationExecutor({
    database: db,
    operations: accountFencedProjectDriveOperationJournal,
    journal: projectDriveOperationJournal,
    journalForTransaction: (database) =>
      createProjectDriveOperationJournal({ database }),
    access: { withReceiptStorageSession: withProjectDriveReceiptSession },
    recoverOrCreatePermission: (session, input) =>
      recoverOrCreateExactDriveUserPermission(
        session,
        input,
        fetch,
      ),
  });
}

export async function executeProjectDriveGrantOperation(
  input: ProjectDriveGrantOperationLocator,
): Promise<ProjectDriveGrantOperationExecutionResult> {
  return projectDriveGrantOperationExecutorFromEnv().execute(input);
}
