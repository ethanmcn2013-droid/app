import { and, eq, inArray, isNull, like, lte, or, sql } from "drizzle-orm";
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
import { deleteBytes } from "./storage";

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
  /** Test seam; production delegates every disk/blob locator to storage.ts. */
  deleteStoredBytes?: (storedPath: string) => Promise<void>;
}>;

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
  const accountStorageWorkspaceIds = [
    ...new Set(accountStorageRows.map((storage) => storage.workspaceId)),
  ];

  // A project-level operation can have no connection/storage/subject columns
  // even though this account backs that Project's Drive. Include every such
  // workspace so the durable account fence covers every operation kind.
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
    accountStorageWorkspaceIds.length > 0
      ? inArray(projectDriveOperations.workspaceId, accountStorageWorkspaceIds)
      : undefined,
  )!;
  const accountErasureFenceKey = googleDriveAccountErasureFenceKey(userId);

  // Establish a durable account fence and freeze every affected operation in
  // one transaction before snapshotting any provider receipt. Untouched work
  // is safe to cancel. Anything attempted or carrying a provider receipt is
  // held for review in an unclaimable state. An expired running attempt is
  // quarantined here too: leaving it `running` would wedge deletion forever
  // because the account fence correctly prevents a normal lease reclaim.
  // Recovery may now record provider truth, but it cannot claim or retry work.
  // The executor contract lives in project-drive-operation-lifecycle.ts and
  // requires the account fence plus status predicate to be checked in its own
  // atomic prepare/claim CAS.
  const [, , , affectedOperationRows] = await database.batch([
    database
      .insert(meta)
      .values({
        key: accountErasureFenceKey,
        value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
      })
      .onConflictDoUpdate({
        target: meta.key,
        set: {
          value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
          updatedAt: sql`(unixepoch())`,
        },
      }),
    database
      .update(projectDriveOperations)
      .set({
        status: GOOGLE_DRIVE_OPERATION_ERASURE_CANCELLED_STATUS,
        completedAt: sql`max(${projectDriveOperations.createdAt}, unixepoch())`,
        updatedAt: sql`max(${projectDriveOperations.updatedAt}, ${projectDriveOperations.createdAt}, unixepoch())`,
      })
      .where(
        and(
          affectedOperationScope,
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
          affectedOperationScope,
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
    // libSQL batches are one transaction. Re-read only after both fence writes;
    // this is the authoritative provider-receipt snapshot for later revocation
    // and evidence deletion.
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
      .where(affectedOperationScope),
  ]);

  const runningOperation = affectedOperationRows.find(
    (operation) => operation.status === "running",
  );
  if (runningOperation) {
    throw new Error(
      "account erasure blocked: Google Drive work is still running; journal evidence retained",
    );
  }
  const unfencedOperation = affectedOperationRows.find((operation) =>
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
      operation.status === GOOGLE_DRIVE_OPERATION_ERASURE_REVIEW_STATUS ||
      (operation.status === "cancelled" &&
        operation.attemptCount > 0 &&
        (operation.lastAttemptAt === null ||
          operation.lastErrorCode !== null)),
  );
  if (unresolvedOperation) {
    throw new Error(
      "account erasure blocked: Project Drive provider truth requires recovery; journal evidence retained",
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
  const affectedOperationIds = affectedOperationRows.map(
    (operation) => operation.id,
  );
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
    await database
      .delete(workspaceStorage)
      .where(inArray(workspaceStorage.id, accountStorageGenerationIds));
  }
  // Grants to the erased person on somebody else's surviving folder carry
  // their email and user id, so those receipts must go too.
  await database
    .delete(driveFolderGrants)
    .where(eq(driveFolderGrants.userId, userId));
  if (connectionIds.length > 0) {
    await database
      .delete(providerConnections)
      .where(inArray(providerConnections.id, connectionIds));
  }

  // Attachment storage locators to delete AFTER their rows are gone. We
  // collect them up front (while the rows still exist) and delete last so a DB
  // failure never removes bytes whose row still exists, while a storage
  // failure never blocks the database erasure.
  const orphanedFiles = new Set<string>();

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

    // Collect attachment file paths for this workspace before deleting.
    const wsAttachments = await database
      .select({ storedPath: attachments.storedPath })
      .from(attachments)
      .where(byTaskOrWs(attachments.taskId, attachments.workspaceId));
    for (const a of wsAttachments) orphanedFiles.add(a.storedPath);

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
      .delete(attachments)
      .where(byTaskOrWs(attachments.taskId, attachments.workspaceId));
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
    await database.delete(entitlements).where(eq(entitlements.workspaceId, wsId));
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
  const userAttachments = await database
    .select({ storedPath: attachments.storedPath })
    .from(attachments)
    .where(eq(attachments.uploaderUserId, userId));
  for (const a of userAttachments) orphanedFiles.add(a.storedPath);

  await database.delete(activities).where(eq(activities.userId, userId));
  await database.delete(comments).where(eq(comments.userId, userId));
  await database
    .delete(attachments)
    .where(eq(attachments.uploaderUserId, userId));
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
  await database.delete(entitlements).where(eq(entitlements.userId, userId));
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

  // Leaf last. Remove the durable executor fence in the same transaction as
  // the user. A failed leaf delete therefore leaves the fence active; a
  // successful delete cannot strand it.
  await database.batch([
    database
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId)),
    database.delete(meta).where(eq(meta.key, accountErasureFenceKey)),
    database.delete(users).where(eq(users.id, userId)),
  ]);

  // Best-effort removal of the now-orphaned attachment bytes. The centralized
  // storage seam understands both private Vercel Blob locators and disk paths;
  // this erasure layer must never resolve or log a stored locator itself. The
  // rows are already gone, so a deletion failure remains non-fatal.
  const deleteStoredBytes = options.deleteStoredBytes ?? deleteBytes;
  for (const storedPath of orphanedFiles) {
    try {
      await deleteStoredBytes(storedPath);
    } catch {
      // Missing bytes, a missing Blob token, and transient provider failures
      // must not undo the completed database erasure.
    }
  }

  // Project Drive plaintext never leaves this eraser. Every credential was
  // confirmed revoked before its ciphertext row was deleted above.
  return { googleRefreshTokens: [] };
}
