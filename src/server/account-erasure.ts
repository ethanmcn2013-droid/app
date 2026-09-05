import { and, eq, inArray, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { eraseEntitlementsInTransaction } from "./venue-issuance/erasure";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  activities,
  attachments,
  comments,
  driveFolderGrants,
  entitlements,
  meta,
  notificationPrefs,
  notifications,
  pendingInvites,
  projectDriveOperations,
  providerConnections,
  resources,
  shareLinkVisits,
  shareLinks,
  tasks,
  userPreferences,
  users,
  workspaceMembers,
  workspaceStorage,
  workspaces,
} from "./db/schema";
import * as schema from "./db/schema";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  GOOGLE_DRIVE_OPERATION_ERASURE_CANCELLED_STATUS,
  GOOGLE_DRIVE_OPERATION_ERASURE_ERROR_CODE,
  GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS,
  googleDriveAccountErasureFenceKey,
  isGoogleDriveOperationClaimableStatus,
} from "./connections/project-drive-operation-lifecycle";
import {
  listPendingDelegatedDriveUploadReceiptsForAccount,
  type PendingDelegatedDriveUploadReceipt,
} from "./connections/project-drive-upload-receipts-core";
import {
  createNativeByteCleanupService,
  deleteNativeByteCleanupTargetConfirmed,
} from "./attachments/native-byte-cleanup";
import {
  assertNoPendingNativeUploads,
  deleteNativeAttachmentRowsAcrossProjectsInTransaction,
  NativeUploadInProgressError,
} from "./attachments/native-upload-custody";

/**
 * Database handle accepted by {@link eraseAccountData}. Typed against the
 * full schema so the function can be exercised against any libSQL/Drizzle
 * instance, the production singleton OR an in-memory test DB. This is the
 * seam that makes erasure provably testable (see account-erasure.test.ts).
 */
export type ErasureDb = LibSQLDatabase<typeof schema>;

export type AccountErasureReceipt = Readonly<{
  /**
   * Tokens from erasers that still require post-erasure best-effort handling.
   * Project Drive revokes before deletion and therefore always returns none.
   */
  googleRefreshTokens: readonly string[];
}>;

export type AccountErasureDriveGrant = Readonly<{
  storageGenerationId: string;
  workspaceId: string;
  connectionId: string;
  folderId: string;
  userId: string;
  permissionId: string;
}>;

export type AccountErasureOptions = Readonly<{
  openProviderToken?: (input: {
    connectionId: string;
    refreshTokenCipher: string;
  }) => string;
  /**
   * Revoke one exact Drive permission before its durable receipt is deleted.
   * WP5 must wire an idempotent executor (an already-absent permission counts
   * as success). Without it, any existing grant fails erasure closed.
   */
  revokeDriveFolderGrant?: (
    grant: AccountErasureDriveGrant,
  ) => Promise<void>;
  /**
   * Revoke one Project Drive credential while its encrypted row is retained.
   * The implementation must be idempotent: an expired or already-revoked
   * token counts as success. Any ambiguous or transient failure must reject.
   */
  revokeProjectDriveRefreshToken?: (refreshToken: string) => Promise<void>;
  /**
   * Reconcile one already-delegated resumable upload from its exact durable
   * receipt. This recovery seam must never mint or delete provider bytes.
   */
  recoverPendingDelegatedDriveUpload?: (
    accountUserId: string,
    receipt: PendingDelegatedDriveUploadReceipt,
  ) => Promise<Readonly<{ outcome: "resolved" | "blocked" }>>;
  /** Test-only race seam, after the atomic fence attempt and before its result is consumed. */
  afterProjectDeletionFenceAttempt?: () => Promise<void>;
  /** Test seam; production delegates every disk/blob locator to storage.ts. */
  deleteStoredBytes?: (storedPath: string) => Promise<void>;
}>;

function rethrowNativeUploadErasureBlock(error: unknown): never {
  if (error instanceof NativeUploadInProgressError) {
    throw new Error(
      "account erasure blocked: Signal-native attachment upload is still in progress; exact custody retained",
    );
  }
  throw error;
}

/**
 * Hard-delete a user's ENTIRE footprint across every table in Tasks' Turso
 * DB, plus the stored attachment bytes they own.
 *
 * GDPR right-to-erasure / App Store 5.1.1(v): when a user deletes their
 * account, nothing of theirs may remain.
 *
 * ── Why this does NOT lean on FK cascade ──────────────────────────────
 * The schema declares `ON DELETE cascade` on several child FKs
 * (comments/activities/attachments/notifications → tasks,
 * share_link_visits → share_links, workspace_members → users/workspaces).
 * But we run libSQL over Turso's stateless HTTP protocol, where
 * `PRAGMA foreign_keys = ON` is NOT reliably in force per request, a
 * cascade we assume is happening may silently not. So erasure deletes
 * every child row EXPLICITLY and treats any cascade as a redundant
 * safety net, never as the mechanism. The companion integration test
 * runs with foreign keys OFF precisely to prove the explicit deletes —
 * not the cascade, clear every table.
 *
 * ── Why child rows are swept by BOTH taskId and workspaceId ───────────
 * `comments` / `activities` / `attachments` / `notifications` carry a
 * nullable `workspace_id` (added during the tenant cutover). Legacy rows
 * may still have `workspace_id IS NULL` while their `task_id` points at a
 * task in an owned workspace. Filtering by `workspace_id` alone would
 * leave those behind; we therefore also delete by the owned tasks' ids.
 *
 * Idempotent: every delete is a no-op once the rows are gone, and provider
 * revokers must accept already-absent grants and credentials, so a retry after
 * a partial failure is safe. Returns without writing when no `users` row
 * exists for `clerkId` (nothing provisioned yet), the caller's Clerk delete
 * still honours the request.
 */
export async function eraseAccountData(
  database: ErasureDb,
  clerkId: string,
  options: AccountErasureOptions = {},
): Promise<AccountErasureReceipt> {
  const [user] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId));

  if (!user) return { googleRefreshTokens: [] };

  const userId = user.id;

  // Collect and open every credential generation BEFORE the first delete.
  // If key custody is broken, fail closed while the rows still preserve the
  // only pointers that make external revocation possible.
  const connectionRows = await database
    .select({
      id: providerConnections.id,
      refreshTokenCipher: providerConnections.refreshTokenCipher,
    })
    .from(providerConnections)
    .where(eq(providerConnections.userId, userId));
  let openProviderToken = options.openProviderToken;
  if (!openProviderToken && connectionRows.length > 0) {
    // Keep the testable erasure core importable in plain Node. The production
    // crypto module deliberately carries `server-only`, so load it only when
    // a real encrypted generation actually needs to be opened.
    const { open, providerTokenAadContext } = await import(
      "./crypto/secret-box"
    );
    openProviderToken = (input) =>
      open(
        input.refreshTokenCipher,
        providerTokenAadContext(input.connectionId),
      );
  }
  const googleRefreshTokens = [
    ...new Set(
      connectionRows.map((connection) =>
        openProviderToken!({
          connectionId: connection.id,
          refreshTokenCipher: connection.refreshTokenCipher,
        }),
      ),
    ),
  ];

  const ownedWorkspaces = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId));
  const ownedWorkspaceIds = ownedWorkspaces.map((workspace) => workspace.id);

  // A person's Drive can be the backing store for a Project they do not own.
  // RESTRICT is deliberate: explicitly remove the inaccessible Drive resource
  // pointers, permission receipts, and folder generations before retiring the
  // credentials. The Project itself remains and falls back to Signal storage.
  const connectionIds = connectionRows.map((connection) => connection.id);
  const accountStorageRows = connectionIds.length
    ? await database
        // isolation-ok: connectionIds contains only credential generations
        // owned by the proved user; erasure must find their use in every
        // Project before any RESTRICT-backed parent can be removed.
        .select({
          id: workspaceStorage.id,
          workspaceId: workspaceStorage.workspaceId,
        })
        .from(workspaceStorage)
        .where(inArray(workspaceStorage.connectionId, connectionIds))
    : [];
  const accountStorageGenerationIds = accountStorageRows.map(
    (storage) => storage.id,
  );
  // Preserve the exact operation cleanup scope. This scope may consume work
  // that directly belongs to the account or its credential-backed storage, but
  // it must not expand merely because the person is a member or grantee in a
  // surviving Project.
  const affectedOperationScope = or(
    eq(projectDriveOperations.subjectUserId, userId),
    ownedWorkspaceIds.length > 0
      ? inArray(projectDriveOperations.workspaceId, ownedWorkspaceIds)
      : undefined,
    connectionIds.length > 0
      ? inArray(projectDriveOperations.connectionId, connectionIds)
      : undefined,
    accountStorageGenerationIds.length > 0
      ? inArray(
          projectDriveOperations.storageGenerationId,
          accountStorageGenerationIds,
        )
      : undefined,
  )!;

  // Project deletion has a broader conflict scope than account-owned operation
  // cleanup. Its immutable snapshot includes owners, members, grants, and every
  // storage credential, so erasure must yield if any of those relationships
  // reaches a non-terminal delete tombstone. These correlated predicates are
  // evaluated inside the atomic batch rather than from a stale id list.
  const projectDeleteConflictScope = or(
    sql`EXISTS (
      SELECT 1 FROM ${workspaces}
      WHERE ${workspaces.id} = ${projectDriveOperations.workspaceId}
        AND ${workspaces.ownerUserId} = ${userId}
    )`,
    sql`EXISTS (
      SELECT 1 FROM ${workspaceMembers}
      WHERE ${workspaceMembers.workspaceId} = ${projectDriveOperations.workspaceId}
        AND ${workspaceMembers.userId} = ${userId}
    )`,
    sql`EXISTS (
      SELECT 1 FROM ${driveFolderGrants}
      WHERE ${driveFolderGrants.workspaceId} = ${projectDriveOperations.workspaceId}
        AND ${driveFolderGrants.userId} = ${userId}
    )`,
    sql`EXISTS (
      SELECT 1 FROM ${providerConnections}
      INNER JOIN ${workspaceStorage}
        ON ${workspaceStorage.connectionId} = ${providerConnections.id}
      WHERE ${workspaceStorage.workspaceId} = ${projectDriveOperations.workspaceId}
        AND ${providerConnections.userId} = ${userId}
    )`,
  )!;
  const nonterminalProjectDeletionScope = and(
    projectDeleteConflictScope,
    eq(projectDriveOperations.operationKind, "project_delete"),
    inArray(projectDriveOperations.status, [
      "pending",
      "running",
      "retry_wait",
      GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS,
    ]),
  )!;
  const liveProjectDeletionScope = and(
    nonterminalProjectDeletionScope,
    eq(projectDriveOperations.status, "running"),
    sql`${projectDriveOperations.leaseExpiresAt} > unixepoch()`,
  )!;
  const noLiveProjectDeletion = sql`NOT EXISTS (
    SELECT 1 FROM ${projectDriveOperations}
    WHERE ${liveProjectDeletionScope}
  )`;
  const accountErasureFenceKey = googleDriveAccountErasureFenceKey(userId);

  // Account erasure and project deletion are mutually exclusive durable
  // lifecycle boundaries. This conditional INSERT is the single arbitration
  // statement: SQLite evaluates the lease boundary once, under its writer
  // lock. Its RETURNING row is authoritative even if the lease expires before
  // JavaScript resumes. If deletion committed a live lease first, erasure
  // yields without installing a second fence. If this write commits first,
  // every competing Project deletion observes the account fence and yields;
  // exact native-byte custody commits before the writer lock is released.
  const accountAttachmentScope = or(
    eq(attachments.uploaderUserId, userId),
    ownedWorkspaceIds.length > 0
      ? inArray(attachments.workspaceId, ownedWorkspaceIds)
      : undefined,
    ownedWorkspaceIds.length > 0
      ? inArray(tasks.workspaceId, ownedWorkspaceIds)
      : undefined,
  )!;
  const nativeCustodyArbitration = await database.transaction(
    async (transaction) => {
      const acquiredFences = await transaction
        .insert(meta)
        .select(
          sql`SELECT ${accountErasureFenceKey}, ${GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE}, unixepoch()
              WHERE ${noLiveProjectDeletion}`,
        )
        .onConflictDoUpdate({
          target: meta.key,
          set: {
            value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
            updatedAt: sql`(unixepoch())`,
          },
          setWhere: noLiveProjectDeletion,
        })
        .returning({ key: meta.key });
      if (!acquiredFences[0]) {
        return {
          acquired: false as const,
          cleanupReceiptKeys: [] as readonly string[],
          nativeBlock: null,
        };
      }

      try {
        const cleanupReceiptKeys = await transaction.transaction(
          async (custodyTransaction) => {
            const keys: string[] = [];
            const attachmentRows = await custodyTransaction
              // isolation-ok: the account fence is already held in this same
              // writer transaction. This query spans only the proved uploader
              // and every Project owned by the proved account.
              .select({
                id: attachments.id,
                uploaderUserId: attachments.uploaderUserId,
                attachmentWorkspaceId: attachments.workspaceId,
                taskWorkspaceId: tasks.workspaceId,
              })
              .from(attachments)
              .leftJoin(tasks, eq(tasks.id, attachments.taskId))
              .where(accountAttachmentScope);
            const ownedWorkspaceIdSet = new Set(ownedWorkspaceIds);
            const attachmentIdsByWorkspace = new Map<string, string[]>();
            const detachedAttachmentIds: string[] = [];
            for (const attachment of attachmentRows) {
              if (
                attachment.attachmentWorkspaceId &&
                attachment.taskWorkspaceId &&
                attachment.attachmentWorkspaceId !== attachment.taskWorkspaceId
              ) {
                throw new Error("native upload attachment parent conflicted");
              }
              const workspaceId =
                attachment.attachmentWorkspaceId ?? attachment.taskWorkspaceId;
              if (!workspaceId) {
                if (attachment.uploaderUserId !== userId) {
                  throw new Error("native upload attachment scope conflicted");
                }
                // Pre-tenant rows can outlive their task while still carrying
                // the only exact locator. Preserve the prior monotonic erasure
                // behavior by giving that locator an explicit synthetic
                // receipt scope instead of blocking account completion.
                detachedAttachmentIds.push(attachment.id);
                continue;
              }
              if (
                !ownedWorkspaceIdSet.has(workspaceId) &&
                attachment.uploaderUserId !== userId
              ) {
                throw new Error("native upload attachment scope conflicted");
              }
              const attachmentIds =
                attachmentIdsByWorkspace.get(workspaceId) ?? [];
              attachmentIds.push(attachment.id);
              attachmentIdsByWorkspace.set(workspaceId, attachmentIds);
            }
            const allAttachmentIds = attachmentRows.map(
              (attachment) => attachment.id,
            );
            // Owned Projects include every uploader plus orphan claim markers.
            // A surviving Project includes only this proved uploader; another
            // member's claim and finalized bytes remain outside the scope.
            for (const workspaceId of ownedWorkspaceIds) {
              keys.push(
                ...(await assertNoPendingNativeUploads(
                  custodyTransaction,
                  workspaceId,
                  {
                    additionalAttachmentIdsScheduledForDeletion:
                      allAttachmentIds,
                  },
                )),
              );
            }
            const deleted =
              await deleteNativeAttachmentRowsAcrossProjectsInTransaction(
                custodyTransaction,
                {
                  projectScopes: [...attachmentIdsByWorkspace].map(
                    ([workspaceId, attachmentIds]) => ({
                      workspaceId,
                      attachmentIds,
                    }),
                  ),
                  detached:
                    detachedAttachmentIds.length > 0
                      ? {
                          receiptWorkspaceId: `account-erasure:${userId}`,
                          attachmentIds: detachedAttachmentIds,
                        }
                      : undefined,
                },
              );
            keys.push(...deleted.cleanupReceiptKeys);
            return Object.freeze(keys);
          },
        );
        return {
          acquired: true as const,
          cleanupReceiptKeys,
          nativeBlock: null,
        };
      } catch (error) {
        // The nested savepoint rolls back every partial custody transfer while
        // the outer transaction commits the account fence. A retry therefore
        // retains both the exact claim evidence and lifecycle ownership.
        return {
          acquired: true as const,
          cleanupReceiptKeys: [] as readonly string[],
          nativeBlock: error,
        };
      }
    },
    { behavior: "immediate" },
  );
  await options.afterProjectDeletionFenceAttempt?.();
  if (!nativeCustodyArbitration.acquired) {
    throw new Error(
      "account erasure deferred: live Project deletion is already in progress",
    );
  }
  if (nativeCustodyArbitration.nativeBlock) {
    rethrowNativeUploadErasureBlock(nativeCustodyArbitration.nativeBlock);
  }
  const nativeByteCleanupReceiptKeys = new Set(
    nativeCustodyArbitration.cleanupReceiptKeys,
  );

  const accountFenceHeld = sql`EXISTS (
    SELECT 1 FROM ${meta}
    WHERE ${meta.key} = ${accountErasureFenceKey}
      AND ${meta.value} = ${GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE}
  )`;
  // Once the durable fence exists, every ordinary prepare/claim/finalize path
  // loses atomically. Freeze the account-owned operation scope and snapshot
  // exact provider receipts in one follow-up batch. Each statement is gated
  // by the exact fence, never by a second wall-clock lease evaluation.
  const [fenceProof, , , affectedOperationRows, survivingDeletes] =
    await database.batch([
      database
        .select({ key: meta.key })
        .from(meta)
        .where(
          and(
            eq(meta.key, accountErasureFenceKey),
            eq(meta.value, GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE),
          ),
        )
        .limit(1),
      database
        .update(projectDriveOperations)
        .set({
          status: GOOGLE_DRIVE_OPERATION_ERASURE_CANCELLED_STATUS,
          completedAt: sql`max(${projectDriveOperations.createdAt}, unixepoch())`,
          updatedAt: sql`max(${projectDriveOperations.updatedAt}, ${projectDriveOperations.createdAt}, unixepoch())`,
        })
        .where(
          and(
            accountFenceHeld,
            affectedOperationScope,
            ne(projectDriveOperations.operationKind, "project_delete"),
            eq(projectDriveOperations.status, "pending"),
            eq(projectDriveOperations.attemptCount, 0),
            isNull(projectDriveOperations.providerFolderId),
            isNull(projectDriveOperations.providerFolderWebViewLink),
            isNull(projectDriveOperations.providerPermissionId),
          ),
        ),
      database
        .update(projectDriveOperations)
        .set({
          status: GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS,
          attemptCount: sql`max(${projectDriveOperations.attemptCount}, 1)`,
          lastAttemptAt: sql`coalesce(${projectDriveOperations.lastAttemptAt}, max(${projectDriveOperations.createdAt}, unixepoch()))`,
          nextAttemptAt: null,
          leaseExpiresAt: null,
          lastErrorCode: sql`CASE
            WHEN ${projectDriveOperations.status} = 'running'
              THEN 'ambiguous_provider_result'
            ELSE coalesce(${projectDriveOperations.lastErrorCode}, ${GOOGLE_DRIVE_OPERATION_ERASURE_ERROR_CODE})
          END`,
          completedAt: null,
          updatedAt: sql`max(${projectDriveOperations.updatedAt}, ${projectDriveOperations.createdAt}, unixepoch())`,
        })
        .where(
          and(
            accountFenceHeld,
            affectedOperationScope,
            ne(projectDriveOperations.operationKind, "project_delete"),
            or(
              inArray(projectDriveOperations.status, [
                "pending",
                "retry_wait",
                GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS,
              ]),
              and(
                eq(projectDriveOperations.status, "running"),
                lte(projectDriveOperations.leaseExpiresAt, sql`unixepoch()`),
              ),
            ),
          ),
        ),
      // Re-read only after both fence writes; this is the authoritative
      // provider-receipt snapshot for later revocation and evidence deletion.
      database
        .select({
          id: projectDriveOperations.id,
          operationKind: projectDriveOperations.operationKind,
          status: projectDriveOperations.status,
          attemptCount: projectDriveOperations.attemptCount,
          lastAttemptAt: projectDriveOperations.lastAttemptAt,
          lastErrorCode: projectDriveOperations.lastErrorCode,
          workspaceId: projectDriveOperations.workspaceId,
          storageGenerationId: projectDriveOperations.storageGenerationId,
          subjectUserId: projectDriveOperations.subjectUserId,
          providerPermissionId: projectDriveOperations.providerPermissionId,
          connectionId: workspaceStorage.connectionId,
          folderId: workspaceStorage.folderId,
        })
        .from(projectDriveOperations)
        // isolation-ok: account erasure intentionally spans every Project
        // reached from this proved user's ownership, subject, credential, or
        // storage lineage. The join supplies exact provider receipts.
        .leftJoin(
          workspaceStorage,
          and(
            eq(
              projectDriveOperations.storageGenerationId,
              workspaceStorage.id,
            ),
            eq(
              projectDriveOperations.workspaceId,
              workspaceStorage.workspaceId,
            ),
          ),
        )
        .where(and(accountFenceHeld, affectedOperationScope)),
      database
        .select({
          id: projectDriveOperations.id,
          status: projectDriveOperations.status,
        })
        .from(projectDriveOperations)
        // isolation-ok: only deletion tombstones in surviving Projects are
        // handed back after this account's exact relationship is removed.
        .where(
          and(
            accountFenceHeld,
            nonterminalProjectDeletionScope,
            sql`NOT EXISTS (
              SELECT 1 FROM ${workspaces}
              WHERE ${workspaces.id} = ${projectDriveOperations.workspaceId}
                AND ${workspaces.ownerUserId} = ${userId}
            )`,
          ),
        ),
    ]);
  if (!fenceProof[0]) {
    throw new Error(
      "account erasure blocked: lifecycle fence was lost before provider snapshot",
    );
  }

  const runningOperation = affectedOperationRows.find(
    (operation) =>
      operation.operationKind !== "project_delete" &&
      operation.status === "running",
  );
  if (runningOperation) {
    throw new Error(
      "account erasure blocked: Google Drive work is still running; journal evidence retained",
    );
  }
  const unfencedOperation = affectedOperationRows.find((operation) =>
    operation.operationKind !== "project_delete" &&
    isGoogleDriveOperationClaimableStatus(operation.status),
  );
  if (unfencedOperation) {
    throw new Error(
      "account erasure blocked: Google Drive operation could not be fenced",
    );
  }

  // Permission deletion is an external side effect, so it must happen before
  // the local receipt disappears. Cover all receipts this erasure will remove:
  // grants on the person's credential-backed folders, grants to the person on
  // somebody else's folder, and every grant in a Project they own. A partial
  // provider failure leaves every DB receipt in place for an idempotent retry.
  const grantRows = await database
    .select({
      storageGenerationId: driveFolderGrants.storageGenerationId,
      workspaceId: driveFolderGrants.workspaceId,
      connectionId: workspaceStorage.connectionId,
      folderId: workspaceStorage.folderId,
      userId: driveFolderGrants.userId,
      permissionId: driveFolderGrants.permissionId,
    })
    .from(driveFolderGrants)
    // isolation-ok: account erasure deliberately finds every exact provider
    // grant that will lose its receipt, starting from this proved user, their
    // credential lineage, or a Project they own. It must cross Project scope.
    .leftJoin(
      workspaceStorage,
      and(
        eq(
          driveFolderGrants.storageGenerationId,
          workspaceStorage.id,
        ),
        eq(driveFolderGrants.workspaceId, workspaceStorage.workspaceId),
      ),
    )
    .where(
      or(
        eq(driveFolderGrants.userId, userId),
        connectionIds.length > 0
          ? inArray(workspaceStorage.connectionId, connectionIds)
          : undefined,
        ownedWorkspaceIds.length > 0
          ? inArray(driveFolderGrants.workspaceId, ownedWorkspaceIds)
          : undefined,
      ),
    );
  const grantsToRevoke = new Map<string, AccountErasureDriveGrant>();
  const rememberGrant = (grant: AccountErasureDriveGrant) => {
    const exactProviderKey = [
      grant.connectionId,
      grant.folderId,
      grant.permissionId,
    ].join("\u0000");
    grantsToRevoke.set(exactProviderKey, grant);
  };
  for (const grant of grantRows) {
    if (!grant.connectionId || !grant.folderId) {
      throw new Error(
        "account erasure blocked: Drive grant receipt has no storage generation",
      );
    }
    rememberGrant({
      ...grant,
      connectionId: grant.connectionId,
      folderId: grant.folderId,
    });
  }
  for (const operation of affectedOperationRows) {
    if (
      operation.operationKind === "grant_create" &&
      !operation.providerPermissionId
    ) {
      const neverReachedGoogle =
        (operation.status === "pending" || operation.status === "cancelled") &&
        operation.attemptCount === 0 &&
        operation.lastAttemptAt === null;
      const confirmedNoProviderMutation =
        operation.status === "cancelled" &&
        operation.attemptCount > 0 &&
        operation.lastAttemptAt !== null &&
        operation.lastErrorCode === null;
      if (!neverReachedGoogle && !confirmedNoProviderMutation) {
        throw new Error(
          "account erasure blocked: attempted Project Drive grant has no exact permission receipt",
        );
      }
      continue;
    }
    if (!operation.providerPermissionId) continue;
    if (
      operation.operationKind !== "grant_create" ||
      !operation.storageGenerationId ||
      !operation.subjectUserId ||
      !operation.connectionId ||
      !operation.folderId
    ) {
      throw new Error(
        "account erasure blocked: Project Drive operation has an incomplete grant receipt",
      );
    }
    rememberGrant({
      storageGenerationId: operation.storageGenerationId,
      workspaceId: operation.workspaceId,
      connectionId: operation.connectionId,
      folderId: operation.folderId,
      userId: operation.subjectUserId,
      permissionId: operation.providerPermissionId,
    });
  }
  const unresolvedOperation = affectedOperationRows.find(
    (operation) =>
      operation.operationKind !== "project_delete" &&
      (operation.status === GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS ||
        (operation.status === "cancelled" &&
          operation.attemptCount > 0 &&
          (operation.lastAttemptAt === null ||
            operation.lastErrorCode !== null))),
  );
  if (unresolvedOperation) {
    throw new Error(
      "account erasure blocked: Project Drive provider truth requires recovery; journal evidence retained",
    );
  }

  // A resumable-session URL is a week-lived bearer capability and the only
  // evidence that Google may already hold bytes. Once the durable account
  // fence is installed, reconcile every receipt where this account is either
  // the upload actor or the immutable storage owner. Never infer absence from
  // age, delete the row first, or trust a callback's claim without re-reading
  // the authoritative DB scope.
  const delegatedUploadReceipts =
    await listPendingDelegatedDriveUploadReceiptsForAccount(database, userId);
  if (
    delegatedUploadReceipts.length > 0 &&
    !options.recoverPendingDelegatedDriveUpload
  ) {
    throw new Error(
      "account erasure blocked: delegated Drive upload recovery is not configured",
    );
  }
  for (const receipt of delegatedUploadReceipts) {
    let result: Readonly<{ outcome: "resolved" | "blocked" }>;
    try {
      result = await options.recoverPendingDelegatedDriveUpload!(
        userId,
        receipt,
      );
    } catch {
      throw new Error(
        "account erasure blocked: delegated Drive upload provider truth is unresolved; evidence retained",
      );
    }
    if (result.outcome !== "resolved") {
      throw new Error(
        "account erasure blocked: delegated Drive upload provider truth is unresolved; evidence retained",
      );
    }
  }
  if (
    (
      await listPendingDelegatedDriveUploadReceiptsForAccount(database, userId)
    ).length > 0
  ) {
    throw new Error(
      "account erasure blocked: delegated Drive upload receipt remains; evidence retained",
    );
  }

  if (grantsToRevoke.size > 0 && !options.revokeDriveFolderGrant) {
    throw new Error(
      "account erasure blocked: Drive grant revocation is not configured",
    );
  }
  for (const grant of grantsToRevoke.values()) {
    await options.revokeDriveFolderGrant!(grant);
  }

  // Revoke every credential generation only after its folder permissions no
  // longer need access, but before consuming any journal, storage, or cipher
  // row. A timeout or transient provider failure therefore leaves encrypted
  // retry custody intact. A later local failure is also safe: the next attempt
  // sends the same token and the provider's already-revoked result is success.
  if (
    googleRefreshTokens.length > 0 &&
    !options.revokeProjectDriveRefreshToken
  ) {
    throw new Error(
      "account erasure blocked: Project Drive credential revocation is not configured",
    );
  }
  for (const refreshToken of googleRefreshTokens) {
    await options.revokeProjectDriveRefreshToken!(refreshToken);
  }

  // Only now may the journal evidence disappear. If any exact provider
  // revocation above failed, execution never reaches this delete and every
  // grant, operation receipt, and encrypted credential remains available for
  // an idempotent retry.
  const survivingDeleteIds = survivingDeletes.map((operation) => operation.id);
  const survivingDeleteIdSet = new Set(survivingDeleteIds);
  const affectedOperationIds = affectedOperationRows
    .filter((operation) => !survivingDeleteIdSet.has(operation.id))
    .map((operation) => operation.id);
  if (affectedOperationIds.length > 0) {
    await database
      .delete(projectDriveOperations)
      .where(inArray(projectDriveOperations.id, affectedOperationIds));
  }

  if (accountStorageGenerationIds.length > 0) {
    await database
      .delete(resources)
      .where(
        inArray(
          resources.storageGenerationId,
          accountStorageGenerationIds,
        ),
      );
    await database
      .delete(driveFolderGrants)
      .where(
        inArray(
          driveFolderGrants.storageGenerationId,
          accountStorageGenerationIds,
        ),
      );
  }
  // Surviving storage, direct-grant, and credential rows remain until the
  // final batch. They keep the account fence discoverable by a concurrent
  // project-deletion retry right up to the atomic lifecycle handoff.

  for (const { id: wsId } of ownedWorkspaces) {
    const wsTasks = await database
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.workspaceId, wsId));
    const taskIds = wsTasks.map((t) => t.id);

    // Match child rows by owned-task id (covers NULL workspace_id cutover
    // rows) OR by workspace_id (covers any workspace-scoped row not bound
    // to a task). `or()` drops undefined args, so an empty workspace is fine.
    const byTaskOrWs = (taskCol: SQLiteColumn, wsCol: SQLiteColumn) =>
      or(taskIds.length ? inArray(taskCol, taskIds) : undefined, eq(wsCol, wsId));

    // share_link_visits → share_links: delete the leaves first, explicitly.
    const wsLinks = await database
      .select({ token: shareLinks.token })
      .from(shareLinks)
      .where(eq(shareLinks.workspaceId, wsId));
    const tokens = wsLinks.map((l) => l.token);
    if (tokens.length) {
      await database
        .delete(shareLinkVisits)
        .where(inArray(shareLinkVisits.token, tokens));
    }
    await database.delete(shareLinks).where(eq(shareLinks.workspaceId, wsId));

    // Task-bound children, by task id AND by workspace id.
    // No runtime FK cascade — hand-rolled explicitly (same pattern as
    // removeTaskAction; libSQL over Turso stateless HTTP does not fire cascades).
    await database
      .delete(activities)
      .where(byTaskOrWs(activities.taskId, activities.workspaceId));
    await database
      .delete(comments)
      .where(byTaskOrWs(comments.taskId, comments.workspaceId));
    await database
      .delete(resources)
      .where(eq(resources.workspaceId, wsId));
    await database
      .delete(driveFolderGrants)
      .where(eq(driveFolderGrants.workspaceId, wsId));
    await database
      .delete(workspaceStorage)
      .where(eq(workspaceStorage.workspaceId, wsId));
    await database
      .delete(notifications)
      .where(byTaskOrWs(notifications.taskId, notifications.workspaceId));

    await database.delete(tasks).where(eq(tasks.workspaceId, wsId));
    await database.transaction((tx) => eraseEntitlementsInTransaction(tx, eq(entitlements.workspaceId, wsId)));
    await database
      .delete(pendingInvites)
      .where(eq(pendingInvites.workspaceId, wsId));

    // Workspace-scoped key/value meta, board name + custom columns.
    // Keys are `board:{wsId}:name` / `board:{wsId}:columns` (see board.ts).
    await database.delete(meta).where(like(meta.key, `board:${wsId}:%`));

    await database
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, wsId));
    await database.delete(workspaces).where(eq(workspaces.id, wsId));
  }

  // The user's footprint on tables owned by OTHER users, or in workspaces
  // they're a member of but don't own: comments/activities they authored,
  // attachments they uploaded, notifications addressed to them, their prefs,
  // entitlements, invites they minted or accepted, and their memberships.
  await database.delete(activities).where(eq(activities.userId, userId));
  await database.delete(comments).where(eq(comments.userId, userId));
  await database
    .delete(resources)
    .where(eq(resources.addedByUserId, userId));
  await database.delete(notifications).where(eq(notifications.userId, userId));
  await database
    .delete(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId));
  await database
    .delete(userPreferences)
    .where(eq(userPreferences.userId, userId));
  await database.transaction((tx) => eraseEntitlementsInTransaction(tx, eq(entitlements.userId, userId)));
  await database
    .delete(pendingInvites)
    .where(eq(pendingInvites.invitedByUserId, userId));
  await database
    .delete(pendingInvites)
    .where(eq(pendingInvites.acceptedByUserId, userId));

  // A Notes-originated task can live in a workspace owned by somebody else.
  // Keep that shared workspace artifact, but irreversibly unlink the erased
  // account and remove the exact approved wording plus its stable fingerprint.
  // `substr` is intentional: Clerk ids contain `_`, which is a wildcard in
  // SQL LIKE and could otherwise redact another account's provenance.
  const notesSourcePrefix = `${clerkId}:`;
  await database
    .update(tasks)
    .set({
      sourceNoteId: null,
      sourceNoteExtractBody: null,
      sourceNoteExtractSha256: null,
    })
    .where(
      sql`substr(coalesce(${tasks.sourceNoteId}, ''), 1, ${notesSourcePrefix.length}) = ${notesSourcePrefix}`,
    );

  // Leaf last. Hand each surviving Project's deletion lifecycle back before
  // removing the exact member/grant/storage relationship that makes this
  // account fence discoverable. Pending work stays pending. Retry work is made
  // immediately eligible, while manual-attention and expired-running rows are
  // rearmed with an explicit workspace-change receipt. All of that, the final
  // relationship deletes, the fence removal, and the user delete are one
  // transaction: neither lifecycle can be stranded between ownership states.
  const survivingDeleteScope =
    survivingDeleteIds.length > 0
      ? inArray(projectDriveOperations.id, survivingDeleteIds)
      : sql`0`;
  const accountStorageDeleteScope =
    accountStorageGenerationIds.length > 0
      ? inArray(workspaceStorage.id, accountStorageGenerationIds)
      : sql`0`;
  const connectionDeleteScope =
    connectionIds.length > 0
      ? inArray(providerConnections.id, connectionIds)
      : sql`0`;
  await database.batch([
    database
      .update(projectDriveOperations)
      .set({
        status: "retry_wait",
        attemptCount: sql`max(${projectDriveOperations.attemptCount}, 1)`,
        lastAttemptAt: sql`coalesce(${projectDriveOperations.lastAttemptAt}, unixepoch())`,
        nextAttemptAt: sql`max(coalesce(${projectDriveOperations.lastAttemptAt}, unixepoch()), unixepoch())`,
        leaseExpiresAt: null,
        lastErrorCode: sql`CASE
          WHEN ${projectDriveOperations.status} IN ('manual_attention', 'running')
            THEN 'workspace_changed'
          ELSE coalesce(${projectDriveOperations.lastErrorCode}, 'workspace_changed')
        END`,
        completedAt: null,
        updatedAt: sql`max(${projectDriveOperations.updatedAt}, ${projectDriveOperations.createdAt}, unixepoch())`,
      })
      .where(
        and(
          survivingDeleteScope,
          or(
            eq(projectDriveOperations.status, "retry_wait"),
            eq(
              projectDriveOperations.status,
              GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS,
            ),
            and(
              eq(projectDriveOperations.status, "running"),
              lte(projectDriveOperations.leaseExpiresAt, sql`unixepoch()`),
            ),
          ),
        ),
      ),
    // Grants to the erased person on somebody else's surviving folder carry
    // their email and user id, so their exact receipts leave only now.
    database
      .delete(driveFolderGrants)
      .where(eq(driveFolderGrants.userId, userId)),
    database.delete(workspaceStorage).where(accountStorageDeleteScope),
    database.delete(providerConnections).where(connectionDeleteScope),
    database
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId)),
    database.delete(meta).where(eq(meta.key, accountErasureFenceKey)),
    database.delete(users).where(eq(users.id, userId)),
  ]);

  // Every exact Signal-native locator entered durable custody in the same
  // transaction that removed its attachment row (or its expired claim). Drain
  // one bounded batch only after commit. Storage failure or process death
  // leaves the opaque receipt for the shared scheduled repair worker.
  if (nativeByteCleanupReceiptKeys.size > 0) {
    const receiptKeys = [...nativeByteCleanupReceiptKeys];
    await createNativeByteCleanupService({
      database,
      deleteTarget: options.deleteStoredBytes
        ? (target) => options.deleteStoredBytes!(target.locator)
        : deleteNativeByteCleanupTargetConfirmed,
    })
      .repairReady({
        keys: receiptKeys,
        limit: Math.min(50, receiptKeys.length),
      })
      .catch(() => undefined);
  }

  // Project Drive plaintext never leaves this eraser. Every credential was
  // confirmed revoked before its ciphertext row was deleted above.
  return { googleRefreshTokens: [] };
}
