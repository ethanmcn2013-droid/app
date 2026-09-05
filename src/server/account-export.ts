import { and, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  activities,
  attachments,
  comments,
  driveFolderGrants,
  entitlements,
  eventPurchaseDesignations,
  meta,
  notificationPrefs,
  notifications,
  pendingInvites,
  projectDriveOperations,
  providerConnections,
  resources,
  shareLinks,
  tasks,
  userPreferences,
  users,
  workspaceMembers,
  workspaceStorage,
  workspaces,
} from "./db/schema";
import * as schema from "./db/schema";
import type {
  ProjectDriveOperationKind,
  ProjectDriveOperationStatus,
} from "./db/schema";

export type ExportDb = LibSQLDatabase<typeof schema>;

/** Private checkout/settlement facts belong to their purchaser even after
 * transfer or removal. Never join project content or names into this record. */
const eventPurchaseMeta = {
  id: eventPurchaseDesignations.id,
  workspaceId: eventPurchaseDesignations.workspaceId,
  checkoutAuthorizedAt: eventPurchaseDesignations.checkoutAuthorizedAt,
  providerReference: eventPurchaseDesignations.providerReference,
  settledAt: eventPurchaseDesignations.settledAt,
  originalExpiresAt: eventPurchaseDesignations.originalExpiresAt,
  designation: eventPurchaseDesignations.designation,
  reason: eventPurchaseDesignations.reason,
  settlementAuthorizedAt: eventPurchaseDesignations.settlementAuthorizedAt,
  revoked: eventPurchaseDesignations.revoked,
};

/** Governing project facts, not an access decision or a former payer's receipt.
 * This stays identical after erasure; even the replacement row id is omitted. */
const eventProjectEffectMeta = {
  workspaceId: eventPurchaseDesignations.workspaceId,
  settledAt: eventPurchaseDesignations.settledAt,
  originalExpiresAt: eventPurchaseDesignations.originalExpiresAt,
  designation: eventPurchaseDesignations.designation,
  revoked: eventPurchaseDesignations.revoked,
};

function ownerEntitlement(row: typeof entitlements.$inferSelect) {
  // The existing Event grant's notes also carry the payment reference. Export
  // its project term here; the purchaser retains their own full account row.
  if (row.tier === "event") return {
    workspaceId: row.workspaceId,
    tier: row.tier,
    source: row.source,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
  };
  return row;
}

/** Attachment columns minus the internal storage locator; bytes are fetched
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

/** Only the immutable Notes receipt belongs in an export from another
 * workspace. Mutable task fields belong to that workspace and may have been
 * edited after the exporting user lost membership. */
const notesExtractReceiptMeta = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  sourceNoteId: tasks.sourceNoteId,
  sourceNoteExtractBody: tasks.sourceNoteExtractBody,
  sourceNoteExtractSha256: tasks.sourceNoteExtractSha256,
  createdAt: tasks.createdAt,
};

/** A live refresh credential and its encryption metadata are never portable. */
const providerConnectionMeta = {
  id: providerConnections.id,
  userId: providerConnections.userId,
  provider: providerConnections.provider,
  providerAccountId: providerConnections.providerAccountId,
  providerAccountEmail: providerConnections.providerAccountEmail,
  rootFolderId: providerConnections.rootFolderId,
  scopes: providerConnections.scopes,
  status: providerConnections.status,
  isCurrent: providerConnections.isCurrent,
  connectedAt: providerConnections.connectedAt,
  lastUsedAt: providerConnections.lastUsedAt,
  lastErrorAt: providerConnections.lastErrorAt,
};

/** Provider/disk `storedPath` is an internal locator, never export content. */
const resourceMeta = {
  id: resources.id,
  workspaceId: resources.workspaceId,
  taskId: resources.taskId,
  kind: resources.kind,
  provider: resources.provider,
  externalId: resources.externalId,
  storage: resources.storage,
  storageGenerationId: resources.storageGenerationId,
  title: resources.title,
  url: resources.url,
  mimeType: resources.mimeType,
  sizeBytes: resources.sizeBytes,
  thumbnail: resources.thumbnail,
  addedByUserId: resources.addedByUserId,
  addedAt: resources.addedAt,
  refreshedAt: resources.refreshedAt,
  accessState: resources.accessState,
  countsAgainstStorage: resources.countsAgainstStorage,
};

const googleDriveActionLabels: Record<ProjectDriveOperationKind, string> = {
  folder_provision: "Set up the Google Drive folder",
  grant_create: "Give someone Google Drive folder access",
  folder_rename: "Rename the Google Drive folder",
  project_delete: "Remove the Google Drive setup",
  storage_handover: "Move storage to another Google Drive",
};

const googleDriveProgressLabels: Record<ProjectDriveOperationStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  retry_wait: "Waiting to retry",
  manual_attention: "Needs attention",
  succeeded: "Complete",
  cancelled: "Cancelled",
};

/**
 * A portable, plain-language view of Google Drive activity.
 *
 * Credential and storage-generation ids, dedupe hashes, leases and Drive web
 * links stay internal. Stable folder/permission receipts remain portable, but
 * this projection cannot expose an OAuth credential or resumable-upload
 * session URL if either is added to an adjacent table later.
 */
const googleDriveActivityMeta = {
  id: projectDriveOperations.id,
  projectId: projectDriveOperations.workspaceId,
  actionCode: projectDriveOperations.operationKind,
  progressCode: projectDriveOperations.status,
  personId: projectDriveOperations.subjectUserId,
  personEmail: projectDriveOperations.granteeEmail,
  accessLevel: projectDriveOperations.grantRole,
  projectVersion: projectDriveOperations.workspaceRevision,
  driveFolderId: projectDriveOperations.providerFolderId,
  drivePermissionId: projectDriveOperations.providerPermissionId,
  attempts: projectDriveOperations.attemptCount,
  lastTriedAt: projectDriveOperations.lastAttemptAt,
  retryAfter: projectDriveOperations.nextAttemptAt,
  issueCode: projectDriveOperations.lastErrorCode,
  startedAt: projectDriveOperations.createdAt,
  updatedAt: projectDriveOperations.updatedAt,
  finishedAt: projectDriveOperations.completedAt,
};

function describeGoogleDriveActivity<
  Activity extends {
    actionCode: ProjectDriveOperationKind;
    progressCode: ProjectDriveOperationStatus;
  },
>(row: Activity) {
  return {
    ...row,
    action: googleDriveActionLabels[row.actionCode],
    progress: googleDriveProgressLabels[row.progressCode],
  };
}

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
  const notesSourcePrefix = `${clerkId}:`;
  const fromThisNotesAccount = sql<boolean>`substr(coalesce(${tasks.sourceNoteId}, ''), 1, ${notesSourcePrefix.length}) = ${notesSourcePrefix}`;

  const ownedWorkspaces = await database
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId));
  const slugs = ownedWorkspaces.map((w) => w.id);

  const myProviderConnections = await database
    .select(providerConnectionMeta)
    .from(providerConnections)
    .where(eq(providerConnections.userId, userId));
  const accountConnectionIds = myProviderConnections.map(
    (connection) => connection.id,
  );
  const accountStorageGenerations = accountConnectionIds.length
    ? await database
        // isolation-ok: every connection id was just derived from this proved
        // user. The cross-Project read is required to export their Drive
        // account lineage wherever another Project used it.
        .select({ id: workspaceStorage.id })
        .from(workspaceStorage)
        .where(inArray(workspaceStorage.connectionId, accountConnectionIds))
    : [];
  const accountStorageGenerationIds = accountStorageGenerations.map(
    (generation) => generation.id,
  );
  const accountProjectDriveActivityScope = or(
    eq(projectDriveOperations.subjectUserId, userId),
    accountConnectionIds.length
      ? inArray(projectDriveOperations.connectionId, accountConnectionIds)
      : undefined,
    accountStorageGenerationIds.length
      ? inArray(
          projectDriveOperations.storageGenerationId,
          accountStorageGenerationIds,
        )
      : undefined,
  );

  const [
    ownedTasks,
    ownedComments,
    ownedActivities,
    ownedAttachments,
    ownedResources,
    ownedNotifications,
    ownedEntitlements,
    ownedShareLinks,
    ownedInvites,
    ownedMembers,
    ownedMeta,
    ownedWorkspaceStorage,
    ownedDriveFolderGrants,
    ownedGoogleDriveActivityRows,
    myMemberships,
    myAuthoredComments,
    myAuthoredActivities,
    myUploadedAttachments,
    myNotificationPrefs,
    myUserPreferences,
    myEntitlements,
    myNotesExtractTasks,
    myDriveFolderGrants,
    myAddedResources,
    myGoogleDriveActivityRows,
    myEventPurchases,
    ownedEventProjectEffects,
  ] = await Promise.all([
    slugs.length ? database.select().from(tasks).where(inArray(tasks.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(comments).where(inArray(comments.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(activities).where(inArray(activities.workspaceId, slugs)) : [],
    slugs.length ? database.select(attachmentMeta).from(attachments).where(inArray(attachments.workspaceId, slugs)) : [],
    slugs.length ? database.select(resourceMeta).from(resources).where(inArray(resources.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(notifications).where(inArray(notifications.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(entitlements).where(inArray(entitlements.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(shareLinks).where(inArray(shareLinks.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(pendingInvites).where(inArray(pendingInvites.workspaceId, slugs)) : [],
    slugs.length ? database.select().from(workspaceMembers).where(inArray(workspaceMembers.workspaceId, slugs)) : [],
    slugs.length
      ? database.select().from(meta).where(or(...slugs.map((s) => like(meta.key, `board:${s}:%`))))
      : [],
    slugs.length
      ? database
          .select()
          .from(workspaceStorage)
          .where(inArray(workspaceStorage.workspaceId, slugs))
      : [],
    slugs.length
      ? database
          .select()
          .from(driveFolderGrants)
          .where(inArray(driveFolderGrants.workspaceId, slugs))
      : [],
    slugs.length
      ? database
          .select(googleDriveActivityMeta)
          .from(projectDriveOperations)
          .where(inArray(projectDriveOperations.workspaceId, slugs))
      : [],
    database.select().from(workspaceMembers).where(eq(workspaceMembers.userId, userId)),
    database.select().from(comments).where(eq(comments.userId, userId)),
    database.select().from(activities).where(eq(activities.userId, userId)),
    database.select(attachmentMeta).from(attachments).where(eq(attachments.uploaderUserId, userId)),
    database.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId)),
    database.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
    database.select().from(entitlements).where(eq(entitlements.userId, userId)),
    database
      .select(notesExtractReceiptMeta)
      .from(tasks)
      .where(
        slugs.length
          ? and(
              fromThisNotesAccount,
              notInArray(tasks.workspaceId, slugs),
            )
          : fromThisNotesAccount,
      ),
    database
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.userId, userId)),
    database
      .select(resourceMeta)
      .from(resources)
      .where(eq(resources.addedByUserId, userId)),
    database
      // isolation-ok: this deliberately composes the proved user's subject,
      // credential and storage-generation lineages across Projects. Owned
      // Projects are excluded because they are exported in the section above.
      .select(googleDriveActivityMeta)
      .from(projectDriveOperations)
      .where(
        slugs.length
          ? and(
              accountProjectDriveActivityScope,
              notInArray(projectDriveOperations.workspaceId, slugs),
            )
          : accountProjectDriveActivityScope,
      ),
    database
      // isolation-ok: account portability uses the freshly resolved purchaser
      // id, independently of membership. No project content/name is joined.
      .select(eventPurchaseMeta)
      .from(eventPurchaseDesignations)
      .where(eq(eventPurchaseDesignations.purchaserUserId, userId)),
    slugs.length
      ? database.select(eventProjectEffectMeta)
          .from(eventPurchaseDesignations)
          .innerJoin(workspaces, eq(workspaces.id, eventPurchaseDesignations.workspaceId))
          .where(and(
            inArray(eventPurchaseDesignations.workspaceId, slugs),
            eq(workspaces.ownerUserId, userId),
            eq(eventPurchaseDesignations.designation, "designated"),
          ))
      : [],
  ]);

  return {
    product: "tasks" as const,
    exportedAt,
    clerkId,
    user,
    eventPurchases: myEventPurchases,
    ownedWorkspaces: {
      workspaces: ownedWorkspaces,
      tasks: ownedTasks,
      comments: ownedComments,
      activities: ownedActivities,
      attachments: ownedAttachments,
      resources: ownedResources,
      notifications: ownedNotifications,
      entitlements: ownedEntitlements.map(ownerEntitlement),
      eventProjectEffects: ownedEventProjectEffects,
      shareLinks: ownedShareLinks,
      pendingInvites: ownedInvites,
      members: ownedMembers,
      boardMeta: ownedMeta,
      workspaceStorage: ownedWorkspaceStorage,
      driveFolderGrants: ownedDriveFolderGrants,
      googleDriveActivity: ownedGoogleDriveActivityRows.map((activity) =>
        describeGoogleDriveActivity(activity),
      ),
    },
    footprintElsewhere: {
      memberships: myMemberships,
      authoredComments: myAuthoredComments,
      authoredActivities: myAuthoredActivities,
      uploadedAttachments: myUploadedAttachments,
      notificationPrefs: myNotificationPrefs[0] ?? null,
      userPreferences: myUserPreferences[0] ?? null,
      entitlements: myEntitlements,
      notesExtractTasks: myNotesExtractTasks,
      providerConnections: myProviderConnections,
      driveFolderGrants: myDriveFolderGrants,
      addedResources: myAddedResources,
      googleDriveActivity: myGoogleDriveActivityRows.map((activity) =>
        describeGoogleDriveActivity(activity),
      ),
    },
  };
}
