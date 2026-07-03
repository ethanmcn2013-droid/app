import { eq, inArray, like, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  activities,
  attachments,
  comments,
  entitlements,
  meta,
  notificationPrefs,
  notifications,
  pendingInvites,
  shareLinks,
  tasks,
  userPreferences,
  users,
  workspaceMembers,
  workspaces,
} from "./db/schema";
import * as schema from "./db/schema";

export type ExportDb = LibSQLDatabase<typeof schema>;

/** Attachment columns minus the internal on-disk path, bytes are fetched
 *  via the authenticated download route, never inlined into the export. */
const attachmentMeta = {
  id: attachments.id,
  workspaceId: attachments.workspaceId,
  taskId: attachments.taskId,
  uploaderUserId: attachments.uploaderUserId,
  filename: attachments.filename,
  mimeType: attachments.mimeType,
  sizeBytes: attachments.sizeBytes,
  createdAt: attachments.createdAt,
};

/**
 * GDPR Art. 20 (data portability), assemble everything Tasks holds for a
 * user: their profile, every workspace they own and all its content, and
 * their footprint in workspaces owned by others (comments/activity they
 * authored, attachments they uploaded, memberships, prefs, entitlements,
 * invites). Counterpart to `account-erasure.ts`; same db-injection seam.
 *
 * Attachment BYTES are never inlined, only metadata (the download route
 * serves bytes per-attachment). The internal `storedPath` is omitted.
 */
export async function exportAccountData(database: ExportDb, clerkId: string) {
  const exportedAt = new Date().toISOString();

  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId));

  if (!user) {
    return { product: "tasks" as const, exportedAt, clerkId, user: null };
  }
  const userId = user.id;

  const ownedWorkspaces = await database
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId));
  const slugs = ownedWorkspaces.map((w) => w.id);

  const [
    ownedTasks,
    ownedComments,
    ownedActivities,
    ownedAttachments,
    ownedNotifications,
    ownedEntitlements,
    ownedShareLinks,
    ownedInvites,
    ownedMembers,
    ownedMeta,
    myMemberships,
    myAuthoredComments,
    myAuthoredActivities,
    myUploadedAttachments,
    myNotificationPrefs,
    myUserPreferences,
    myEntitlements,
  ] = await Promise.all([
    slugs.length ? database.select().from(tasks).where(inArray(tasks.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(comments).where(inArray(comments.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(activities).where(inArray(activities.workspaceId, slugs)) : [],
    slugs.length ? database.select(attachmentMeta).from(attachments).where(inArray(attachments.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(notifications).where(inArray(notifications.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(entitlements).where(inArray(entitlements.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(shareLinks).where(inArray(shareLinks.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(pendingInvites).where(inArray(pendingInvites.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(workspaceMembers).where(inArray(workspaceMembers.workspaceId, slugs)) : [],
    slugs.length
      ? database.select().from(meta).where(or(...slugs.map((s) => like(meta.key, `board:${s}:%`))))
      : [],
    database.select().from(workspaceMembers).where(eq(workspaceMembers.userId, userId)),
    database.select().from(comments).where(eq(comments.userId, userId)),
    database.select().from(activities).where(eq(activities.userId, userId)),
    database.select(attachmentMeta).from(attachments).where(eq(attachments.uploaderUserId, userId)),
    database.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId)),
    database.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
    database.select().from(entitlements).where(eq(entitlements.userId, userId)),
  ]);

  return {
    product: "tasks" as const,
    exportedAt,
    clerkId,
    user,
    ownedWorkspaces: {
      workspaces: ownedWorkspaces,
      tasks: ownedTasks,
      comments: ownedComments,
      activities: ownedActivities,
      attachments: ownedAttachments,
      notifications: ownedNotifications,
      entitlements: ownedEntitlements,
      shareLinks: ownedShareLinks,
      pendingInvites: ownedInvites,
      members: ownedMembers,
      boardMeta: ownedMeta,
    },
    footprintElsewhere: {
      memberships: myMemberships,
      authoredComments: myAuthoredComments,
      authoredActivities: myAuthoredActivities,
      uploadedAttachments: myUploadedAttachments,
      notificationPrefs: myNotificationPrefs[0] ?? null,
      userPreferences: myUserPreferences[0] ?? null,
      entitlements: myEntitlements,
    },
  };
}
