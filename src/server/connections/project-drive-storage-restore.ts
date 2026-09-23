import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import { driveFolderGrants, meta, providerConnections, users, workspaceMembers, workspaces, workspaceStorage } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { getGoogleDriveAbout } from "./google-drive";
import { projectDriveAccessServiceFromEnv, type ProjectDriveAccessService } from "./project-drive-access";
import { assertProjectDriveCapability, type AuthorizedProjectDriveContext } from "./project-drive-authz";
import { verifyCurrentWorkspaceDriveFolder } from "./drive-folders";
import { listCurrentWorkspaceDrivePermissions, type LiveDrivePermission } from "./drive-grants";
import { readProjectDriveMemberCoverage } from "./project-drive-member-coverage";
import { GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE, googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { readCurrentProjectDriveFolderSetupState, type ProjectDriveFolderSetupState } from "./project-drive-folder-management";

type RestoreDb = LibSQLDatabase<typeof schema>;
type Snapshot = Readonly<{
  storageId: string;
  connectionId: string;
  folderId: string;
  boundRootId: string;
  providerAccountId: string;
  credentialId: string;
  ownerUserId: string;
  ownerEmail: string;
  members: readonly Readonly<{ userId: string; email: string; role: string }>[];
}>;

type RestoreDependencies = Readonly<{
  database: RestoreDb;
  probe: (authorization: AuthorizedProjectDriveContext, snapshot: Snapshot) => Promise<boolean>;
}>;

function emailKey(value: string | null): string | null {
  const key = value?.trim().toLowerCase() ?? "";
  return key && key.includes("@") ? key : null;
}

/** Live Google evidence is required in addition to durable grant receipts. */
export function exactRestorePermissionCoverage(
  snapshot: Pick<Snapshot, "ownerEmail" | "ownerUserId" | "providerAccountId" | "members">,
  permissions: readonly LiveDrivePermission[],
): boolean {
  const owner = permissions.filter((permission) =>
    !permission.deleted && permission.type === "user" &&
    permission.permissionId === snapshot.providerAccountId &&
    permission.role === "owner" &&
    emailKey(permission.emailAddress) === snapshot.ownerEmail,
  );
  if (owner.length !== 1) return false;
  return snapshot.members.every((member) =>
    member.userId === snapshot.ownerUserId || permissions.some((permission) =>
      !permission.deleted && permission.type === "user" &&
      permission.role === "writer" &&
      permission.source === "signal-grant" &&
      permission.signalUserId === member.userId &&
      emailKey(permission.emailAddress) === member.email,
    ),
  );
}

type LiveProbeDependencies = Readonly<{
  access: Pick<ProjectDriveAccessService, "withStorageSession">;
  about: (accessToken: string) => Promise<Readonly<{ permissionId: string; emailAddress: string | null }>>;
  verify: (authorization: AuthorizedProjectDriveContext) => Promise<Readonly<{
    storageGenerationId: string; connectionId: string; folderId: string;
  }>>;
  permissions: (authorization: AuthorizedProjectDriveContext) => Promise<readonly LiveDrivePermission[]>;
}>;

export function createLiveRestoreProbe(deps: LiveProbeDependencies) {
  return async function liveRestoreProbe(
    authorization: AuthorizedProjectDriveContext,
    snapshot: Snapshot,
  ): Promise<boolean> {
  const identity = await deps.access.withStorageSession(authorization, { kind: "current" }, async (session) => {
    if (session.storage.id !== snapshot.storageId ||
        session.storage.connectionId !== snapshot.connectionId ||
        session.storage.folderId !== snapshot.folderId ||
        session.storageRootFolderId !== snapshot.boundRootId ||
        session.credential.id !== snapshot.credentialId ||
        session.credential.ownerUserId !== authorization.actorUserId ||
        session.credential.providerAccountId !== snapshot.providerAccountId ||
        !session.credential.rootFolderId) return false;
    const about = await deps.about(session.accessToken);
    return about.permissionId === snapshot.providerAccountId &&
      emailKey(about.emailAddress) === snapshot.ownerEmail;
  });
  if (!identity) return false;
  const folder = await deps.verify(authorization);
  if (folder.storageGenerationId !== snapshot.storageId ||
      folder.connectionId !== snapshot.connectionId ||
      folder.folderId !== snapshot.folderId) return false;
  const permissions = await deps.permissions(authorization);
  return exactRestorePermissionCoverage(snapshot, permissions);
  };
}

async function readSnapshot(
  database: Pick<RestoreDb, "select">,
  authorization: AuthorizedProjectDriveContext,
): Promise<Snapshot | null> {
    await assertProjectNotDeleting(database, authorization.projectId);
    const [project] = await database.select({ archivedAt: workspaces.archivedAt })
      .from(workspaces).where(eq(workspaces.id, authorization.projectId)).limit(1);
    if (!project || project.archivedAt !== null) return null;
    const [membership] = await database.select({ role: workspaceMembers.role })
      .from(workspaceMembers).where(and(
        eq(workspaceMembers.workspaceId, authorization.projectId),
        eq(workspaceMembers.userId, authorization.actorUserId),
      )).limit(1);
    if (membership?.role !== "owner") return null;
    const rows = await database.select({
      storageId: workspaceStorage.id,
      connectionId: workspaceStorage.connectionId,
      folderId: workspaceStorage.folderId,
      boundRootId: providerConnections.rootFolderId,
      providerAccountId: providerConnections.providerAccountId,
      ownerUserId: providerConnections.userId,
      state: workspaceStorage.state,
    }).from(workspaceStorage).innerJoin(providerConnections, eq(providerConnections.id, workspaceStorage.connectionId))
      .where(and(eq(workspaceStorage.workspaceId, authorization.projectId), eq(workspaceStorage.isCurrent, true)))
      .limit(2);
    if (rows.length !== 1 || rows[0].state !== "needs_reauth" || rows[0].ownerUserId !== authorization.actorUserId) return null;
    const storage = rows[0];
    const credentials = await database.select({
      id: providerConnections.id,
      rootFolderId: providerConnections.rootFolderId,
      providerAccountEmail: providerConnections.providerAccountEmail,
    }).from(providerConnections).where(and(
      eq(providerConnections.userId, authorization.actorUserId),
      eq(providerConnections.provider, "google_drive"),
      eq(providerConnections.providerAccountId, storage.providerAccountId),
      eq(providerConnections.status, "active"),
      eq(providerConnections.isCurrent, true),
    )).limit(2);
    // OAuth discovers an app-marked root in this same Google account. It may
    // differ from the historical root if that account has multiple marked
    // roots; the exact stored folder still has to prove its old parent.
    if (credentials.length !== 1 || !credentials[0].rootFolderId) return null;
    const [erasure] = await database.select({ key: meta.key }).from(meta).where(and(
      eq(meta.key, googleDriveAccountErasureFenceKey(authorization.actorUserId)),
      eq(meta.value, GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE),
    )).limit(1);
    const [pendingRevoke] = await database.select({ id: providerConnections.id }).from(providerConnections).where(and(
      eq(providerConnections.userId, authorization.actorUserId),
      eq(providerConnections.provider, "google_drive"),
      isNotNull(providerConnections.revokeRequestedAt),
      isNull(providerConnections.revokeConfirmedAt),
    )).limit(1);
    if (erasure || pendingRevoke) return null;
    const [pendingGrantRevoke] = await database.select({ userId: driveFolderGrants.userId }).from(driveFolderGrants).where(and(
      eq(driveFolderGrants.workspaceId, authorization.projectId),
      eq(driveFolderGrants.storageGenerationId, storage.storageId),
      eq(driveFolderGrants.revokePending, true),
    )).limit(1);
    if (pendingGrantRevoke) return null;
    const ownerEmail = emailKey(credentials[0].providerAccountEmail);
    if (!ownerEmail) return null;
    const memberRows = await database.select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      email: users.email,
    }).from(workspaceMembers).leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, authorization.projectId));
    if (!memberRows.some((member) => member.userId === authorization.actorUserId &&
        member.role === "owner" && emailKey(member.email) === ownerEmail)) return null;
    const members = memberRows.map((member) => ({ userId: member.userId, email: emailKey(member.email), role: member.role }))
      .sort((a, b) => a.userId.localeCompare(b.userId));
    if (members.some((member) => !member.email)) return null;
    return Object.freeze({
      storageId: storage.storageId,
      connectionId: storage.connectionId,
      folderId: storage.folderId,
      boundRootId: storage.boundRootId,
      providerAccountId: storage.providerAccountId,
      credentialId: credentials[0].id,
      ownerUserId: authorization.actorUserId,
      ownerEmail,
      members: Object.freeze(members as { userId: string; email: string; role: string }[]),
    });
}

export function createProjectDriveStorageRestoreService(deps: RestoreDependencies) {

  async function restore(authorization: AuthorizedProjectDriveContext): Promise<ProjectDriveFolderSetupState | null> {
    assertProjectDriveCapability(authorization, "manageProject");
    const before = await readSnapshot(deps.database, authorization);
    if (!before) return readCurrentProjectDriveFolderSetupState(deps.database, authorization);
    try {
      if (!(await deps.probe(authorization, before))) return readCurrentProjectDriveFolderSetupState(deps.database, authorization);
    } catch {
      return readCurrentProjectDriveFolderSetupState(deps.database, authorization);
    }
    await deps.database.transaction(async (tx) => {
      await assertProjectNotDeleting(tx, authorization.projectId);
      const [erasure] = await tx.select({ key: meta.key }).from(meta).where(and(
        eq(meta.key, googleDriveAccountErasureFenceKey(authorization.actorUserId)),
        eq(meta.value, GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE),
      )).limit(1);
      const [pendingRevoke] = await tx.select({ id: providerConnections.id }).from(providerConnections).where(and(
        eq(providerConnections.userId, authorization.actorUserId),
        eq(providerConnections.provider, "google_drive"),
        isNotNull(providerConnections.revokeRequestedAt),
        isNull(providerConnections.revokeConfirmedAt),
      )).limit(1);
      const [pendingGrantRevoke] = await tx.select({ userId: driveFolderGrants.userId }).from(driveFolderGrants).where(and(
        eq(driveFolderGrants.workspaceId, authorization.projectId),
        eq(driveFolderGrants.storageGenerationId, before.storageId),
        eq(driveFolderGrants.revokePending, true),
      )).limit(1);
      if (erasure || pendingRevoke || pendingGrantRevoke) return;
      const again = await readSnapshot(tx, authorization);
      if (!again || JSON.stringify(again) !== JSON.stringify(before)) return;
      const coverage = await readProjectDriveMemberCoverage(tx, {
        workspaceId: authorization.projectId,
        storageGenerationId: before.storageId,
        storageOwnerUserId: authorization.actorUserId,
      });
      if (!coverage.storageOwnerIsOwner || coverage.coverage !== "complete") return;
      await tx.update(workspaceStorage).set({ state: "active" }).where(and(
        eq(workspaceStorage.id, before.storageId),
        eq(workspaceStorage.workspaceId, authorization.projectId),
        eq(workspaceStorage.connectionId, before.connectionId),
        eq(workspaceStorage.folderId, before.folderId),
        eq(workspaceStorage.state, "needs_reauth"),
        eq(workspaceStorage.isCurrent, true),
      ));
    }, { behavior: "immediate" });
    return readCurrentProjectDriveFolderSetupState(deps.database, authorization);
  }

  return Object.freeze({ restore });
}

export async function restoreProjectGoogleDriveStorage(
  authorization: AuthorizedProjectDriveContext,
): Promise<ProjectDriveFolderSetupState | null> {
  return createProjectDriveStorageRestoreService({ database: db, probe: createLiveRestoreProbe({
    access: projectDriveAccessServiceFromEnv(),
    about: getGoogleDriveAbout,
    verify: verifyCurrentWorkspaceDriveFolder,
    permissions: listCurrentWorkspaceDrivePermissions,
  }) }).restore(authorization);
}
