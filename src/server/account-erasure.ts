import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
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

/**
 * Database handle accepted by {@link eraseAccountData}. Typed against the
 * full schema so the function can be exercised against any libSQL/Drizzle
 * instance, the production singleton OR an in-memory test DB. This is the
 * seam that makes erasure provably testable (see account-erasure.test.ts).
 */
export type ErasureDb = LibSQLDatabase<typeof schema>;

export type AccountErasureReceipt = Readonly<{
  /** Plaintext exists only in memory until the unified orchestrator revokes it. */
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
}>;

/**
 * Hard-delete a user's ENTIRE footprint across every table in Tasks' Turso
 * DB, plus the on-disk attachment binaries they own.
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
 * Idempotent: every delete is a no-op once the rows are gone, so a retry
 * after a partial failure is safe. Returns without writing when no `users`
 * row exists for `clerkId` (nothing provisioned yet), the caller's Clerk
 * delete still honours the request.
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
  const grantsToRevoke = grantRows.map((grant) => {
    if (!grant.connectionId || !grant.folderId) {
      throw new Error(
        "account erasure blocked: Drive grant receipt has no storage generation",
      );
    }
    return {
      ...grant,
      connectionId: grant.connectionId,
      folderId: grant.folderId,
    };
  });
  if (grantsToRevoke.length > 0 && !options.revokeDriveFolderGrant) {
    throw new Error(
      "account erasure blocked: Drive grant revocation is not configured",
    );
  }
  for (const grant of grantsToRevoke) {
    await options.revokeDriveFolderGrant!(grant);
  }

  if (connectionIds.length > 0) {
    const storageRows = await database
      // isolation-ok: connectionIds contains only credential generations
      // owned by the proved user; erasure must find their use in every Project
      // before the RESTRICT-backed connection rows can be removed.
      .select({ id: workspaceStorage.id })
      .from(workspaceStorage)
      .where(inArray(workspaceStorage.connectionId, connectionIds));
    const storageGenerationIds = storageRows.map((storage) => storage.id);
    if (storageGenerationIds.length > 0) {
      await database
        .delete(resources)
        .where(inArray(resources.storageGenerationId, storageGenerationIds));
      await database
        .delete(driveFolderGrants)
        .where(
          inArray(
            driveFolderGrants.storageGenerationId,
            storageGenerationIds,
          ),
        );
      await database
        .delete(workspaceStorage)
        .where(inArray(workspaceStorage.id, storageGenerationIds));
    }
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

  // On-disk attachment binaries to unlink AFTER their rows are gone. We
  // collect paths up front (while the rows still exist) and unlink last so
  // a DB failure never leaves dangling files we've lost the pointer to,
  // and an unlink failure never blocks the DB erasure.
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

  await database
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  // Leaf last.
  await database.delete(users).where(eq(users.id, userId));

  // Best-effort unlink of the now-orphaned attachment binaries. The rows
  // are already gone, so failures here only leave dead bytes on disk (no
  // way to address them in-product), log-worthy, never fatal, never a
  // reason to fail the erasure. A missing file (already swept, or never
  // persisted in a serverless runtime) is expected and ignored.
  for (const storedPath of orphanedFiles) {
    try {
      await unlink(path.resolve(process.cwd(), storedPath));
    } catch {
      // ENOENT and friends: nothing left to remove.
    }
  }

  return { googleRefreshTokens };
}
