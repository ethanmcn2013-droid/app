import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  activities,
  attachments,
  comments,
  entitlements,
  notificationPrefs,
  notifications,
  pendingInvites,
  shareLinks,
  tasks,
  userPreferences,
  users,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";

/**
 * Hard-delete the user's entire footprint in Tasks' Turso DB.
 *
 * Called by `POST /api/account/delete` BEFORE the Clerk admin delete
 * so that if the DB purge errors we don't end up with an orphaned
 * Clerk-deleted user whose data is still here.
 *
 * Cascade order matters because the schema's FKs are partial:
 *   - `workspaceMembers.userId` cascades on user delete (so does
 *     `workspaceMembers.workspaceId` on workspace delete).
 *   - `tasks.id` references cascade `activities` / `comments` /
 *     `attachments` / `notifications` on task delete.
 *   - But `tasks.workspaceId` does NOT cascade, and the user-keyed
 *     rows in `comments` / `activities` / `attachments` that live on
 *     OTHER users' tasks (where this user posted) have no cascade.
 *
 * So the order is: own each workspace's tail (tasks first, which
 * cascades their tails), then the user's footprint on tables owned
 * by other users, then the user record itself.
 *
 * Idempotent: re-running after a partial failure is safe — every
 * delete is a no-op when the rows are already gone.
 *
 * If the user has never been provisioned (no `users` row for this
 * clerkId yet), the function returns without writing — the Clerk
 * delete in the caller still proceeds, which is the desired behaviour
 * for App Store 5.1.1(v) (the user requested deletion; we honoured it
 * even if there was no in-product footprint to clear).
 */
export async function deleteAccountForUser(clerkId: string): Promise<void> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId));

  if (!user) return;

  const userId = user.id;

  const ownedWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId));

  for (const ws of ownedWorkspaces) {
    await db.delete(activities).where(eq(activities.workspaceId, ws.id));
    await db.delete(comments).where(eq(comments.workspaceId, ws.id));
    await db.delete(notifications).where(eq(notifications.workspaceId, ws.id));
    await db.delete(attachments).where(eq(attachments.workspaceId, ws.id));
    await db.delete(tasks).where(eq(tasks.workspaceId, ws.id));
    await db.delete(entitlements).where(eq(entitlements.workspaceId, ws.id));
    await db.delete(pendingInvites).where(eq(pendingInvites.workspaceId, ws.id));
    await db.delete(shareLinks).where(eq(shareLinks.workspaceId, ws.id));
    await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, ws.id));
    await db.delete(workspaces).where(eq(workspaces.id, ws.id));
  }

  await db.delete(activities).where(eq(activities.userId, userId));
  await db.delete(comments).where(eq(comments.userId, userId));
  await db.delete(attachments).where(eq(attachments.uploaderUserId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(notificationPrefs).where(eq(notificationPrefs.userId, userId));
  await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
  await db.delete(entitlements).where(eq(entitlements.userId, userId));
  // pendingInvites by user-as-actor (workspace-scoped invites for owned
  // workspaces are already gone via the cascade on workspace delete in
  // the loop above; these are invites the user authored on OR accepted
  // into workspaces they don't own).
  await db
    .delete(pendingInvites)
    .where(eq(pendingInvites.invitedByUserId, userId));
  await db
    .delete(pendingInvites)
    .where(eq(pendingInvites.acceptedByUserId, userId));
  // workspaceMembers.userId has ON DELETE CASCADE on users.id — but
  // doing it explicitly is the safety net for memberships the user
  // held in workspaces they don't own. The subsequent users delete is
  // then a clean leaf.
  await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));

  await db.delete(users).where(eq(users.id, userId));

  // KNOWN GAP — attachment binaries on disk.
  // The DB rows for attachments are gone (cascade-on-task and explicit
  // by-uploader sweep above), but the underlying files under
  // `<repo>/.data/uploads/...` are NOT unlinked here. For full GDPR
  // right-to-erasure compliance, a follow-up cycle should add a
  // best-effort `fs.unlink` sweep against attachments collected before
  // their DB rows are deleted. Tracked in
  // ~/Projects/personal/studio/docs/ios/data-flow.md § hardening to-dos.
}
