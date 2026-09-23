import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { projectDriveOperations, providerConnections, users, workspaceMembers, workspaces, workspaceStorage } from "@/server/db/schema";
import type { DriveHandoverRead } from "@/lib/project-drive-handover-ui";
import { assertProjectDriveCapability, type AuthorizedProjectDriveContext } from "./project-drive-authz";
import { isExactGoogleDriveScopeSet } from "./google-drive-scopes";
import { listPendingDelegatedDriveUploadReceiptsForWorkspace } from "./project-drive-upload-receipts";
import type { ProjectDriveStorageHandoverState } from "./project-drive-storage-handover";

type HandoverDatabase = LibSQLDatabase<typeof schema>;
const unavailable = (state: DriveHandoverRead["state"]): DriveHandoverRead => ({ state, choices: [], continuation: null });

/** A transactionally consistent read of prerequisites; execution revalidates all of them. */
export async function readProjectDriveHandoverUi(
  authorization: AuthorizedProjectDriveContext,
  database: HandoverDatabase,
): Promise<DriveHandoverRead> {
  assertProjectDriveCapability(authorization, "manageProject");
  return database.transaction(async (tx) => {
    const projects = await tx.select({ archivedAt: workspaces.archivedAt, actorRole: workspaceMembers.role })
      .from(workspaces).leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, authorization.actorUserId)))
      .where(eq(workspaces.id, authorization.projectId)).limit(2);
    if (projects.length !== 1 || projects[0].actorRole !== "owner") return unavailable("unavailable");
    if (authorization.archived || projects[0].archivedAt) return unavailable("archived");
    const storage = await tx.select({ id: workspaceStorage.id, ownerId: providerConnections.userId })
      .from(workspaceStorage).innerJoin(providerConnections, eq(providerConnections.id, workspaceStorage.connectionId))
      .where(and(eq(workspaceStorage.workspaceId, authorization.projectId), eq(workspaceStorage.isCurrent, true))).limit(2);
    if (storage.length === 0) return unavailable("not_connected");
    if (storage.length !== 1) return unavailable("unavailable");
    const owners = await tx.select({ userId: workspaceMembers.userId, name: users.name, email: users.email })
      .from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(eq(workspaceMembers.workspaceId, authorization.projectId), eq(workspaceMembers.role, "owner"))).orderBy(workspaceMembers.userId);
    if (!owners.some(owner => owner.userId === storage[0].ownerId)) return unavailable("unavailable");
    // Keep the existing journal receipt reader's fail-closed lineage checks.
    // Its ciphertext and identifiers are never projected into the UI response.
    if ((await listPendingDelegatedDriveUploadReceiptsForWorkspace(tx, authorization.projectId)).length) return unavailable("uploads_pending");
    const connections = await tx.select({ id: providerConnections.id, userId: providerConnections.userId, scopes: providerConnections.scopes })
      .from(providerConnections).innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, providerConnections.userId), eq(workspaceMembers.workspaceId, authorization.projectId)))
      .where(and(eq(workspaceMembers.role, "owner"), eq(providerConnections.provider, "google_drive"), eq(providerConnections.status, "active"), eq(providerConnections.isCurrent, true)));
    const candidates = owners.flatMap(owner => {
      const connected = connections.filter(connection => connection.userId === owner.userId);
      if (owner.userId === storage[0].ownerId || connected.length !== 1 || !isExactGoogleDriveScopeSet(connected[0].scopes)) return [];
      return [{ choice: { userId: owner.userId, name: owner.name || owner.email || "Board owner" }, connectionId: connected[0].id }];
    });
    const operations = await tx.select({ connectionId: projectDriveOperations.connectionId, generationId: projectDriveOperations.storageGenerationId, status: projectDriveOperations.status })
      .from(projectDriveOperations).where(and(eq(projectDriveOperations.workspaceId, authorization.projectId), eq(projectDriveOperations.operationKind, "storage_handover"), inArray(projectDriveOperations.status, ["pending", "running", "retry_wait", "manual_attention"]))).limit(2);
    if (operations.length > 1) return unavailable("unavailable");
    if (operations.length) {
      const operation = operations[0];
      if (operation.status === "manual_attention") return unavailable("needs_attention");
      const target = candidates.find(candidate => candidate.connectionId === operation.connectionId);
      if (!target || operation.generationId !== storage[0].id) return unavailable("needs_attention");
      return { state: "in_progress", choices: [], continuation: target.choice };
    }
    return { state: "ready", choices: candidates.map(candidate => candidate.choice), continuation: null };
  }, { behavior: "deferred" });
}

/** UI allow-list is an additional guard; the existing handover service remains authoritative. */
export async function requestProjectDriveUiHandover(
  authorization: AuthorizedProjectDriveContext,
  targetOwnerUserId: string,
  deps: {
    database: HandoverDatabase;
    handover: (auth: AuthorizedProjectDriveContext, input: { targetOwnerUserId: string }) => Promise<ProjectDriveStorageHandoverState>;
  },
): Promise<ProjectDriveStorageHandoverState["status"]> {
  const read = await readProjectDriveHandoverUi(authorization, deps.database);
  const allowed = read.state === "ready" ? read.choices.some(choice => choice.userId === targetOwnerUserId)
    : read.state === "in_progress" && read.continuation?.userId === targetOwnerUserId;
  if (!allowed) return "unavailable";
  return (await deps.handover(authorization, { targetOwnerUserId })).status;
}
