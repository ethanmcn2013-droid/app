import "server-only";

import { and, count, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { driveFolderGrants, providerConnections, users, workspaceMembers, workspaceStorage } from "@/server/db/schema";
import { safeDriveFolderUrl, type DriveAccessPerson, type ProjectDriveStatus } from "@/lib/project-drive-ui";
import { assertProjectDriveCapability, type AuthorizedProjectDriveContext } from "./project-drive-authz";
import { readCurrentProjectDriveFolderSetupState } from "./project-drive-folder-management";
import type { GoogleDriveConnectionSummary } from "./drive-connections";
import type { LiveDrivePermission } from "./drive-grants";

const emailKey = (email: string | null) => email?.trim().toLowerCase() || null;

/** A roster is context, never proof. Only exact, live named-user email matches count. */
export function projectDriveAccessPeople(
  members: readonly { name: string | null; email: string | null }[],
  permissions: readonly LiveDrivePermission[],
): { people: DriveAccessPerson[]; otherPermissionCount: number } {
  const matched = new Set<number>();
  const people = members.map((member): DriveAccessPerson => {
    const key = emailKey(member.email);
    const matches = permissions.flatMap((permission, index) => {
      if (!key || permission.deleted || permission.type !== "user" || emailKey(permission.emailAddress) !== key) return [];
      matched.add(index);
      return [permission.role];
    });
    const access = matches.includes("owner") ? "owner" : matches.includes("writer") ? "writer" : matches.includes("reader") ? "reader" : "unconfirmed";
    return { name: member.name || member.email || "Board member", email: member.email, access };
  });
  return { people, otherPermissionCount: permissions.filter((p, i) => !p.deleted && !matched.has(i)).length };
}

type StatusDependencies = {
  database: Pick<LibSQLDatabase<typeof schema>, "select">;
  connection: (auth: AuthorizedProjectDriveContext) => Promise<GoogleDriveConnectionSummary>;
  permissions: (auth: AuthorizedProjectDriveContext) => Promise<readonly LiveDrivePermission[]>;
  now: () => Date;
};

export async function readProjectDriveUiStatus(
  authorization: AuthorizedProjectDriveContext,
  deps: StatusDependencies,
): Promise<ProjectDriveStatus> {
  assertProjectDriveCapability(authorization, "manageProject");
  const snapshot = async () => {
    const [storage, members] = await Promise.all([
      deps.database.select({ id: workspaceStorage.id, ownerName: users.name, folderUrl: workspaceStorage.folderWebViewLink })
        .from(workspaceStorage)
        .innerJoin(providerConnections, eq(providerConnections.id, workspaceStorage.connectionId))
        .leftJoin(users, eq(users.id, providerConnections.userId))
        .where(and(eq(workspaceStorage.workspaceId, authorization.projectId), eq(workspaceStorage.isCurrent, true))).limit(2),
      deps.database.select({ userId: workspaceMembers.userId, name: users.name, email: users.email })
        .from(workspaceMembers).leftJoin(users, eq(users.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, authorization.projectId)).orderBy(workspaceMembers.userId),
    ]);
    return { storage, members };
  };
  const [before, own, setup] = await Promise.all([
    snapshot(), deps.connection(authorization), readCurrentProjectDriveFolderSetupState(deps.database, authorization),
  ]);
  if (before.storage.length > 1) throw new Error("Storage unavailable");
  let access: ProjectDriveStatus["access"] = {
    state: before.storage.length ? "unavailable" : "not_connected", checkedAt: null, people: [], otherPermissionCount: 0,
  };
  if (before.storage.length === 1) {
    try {
      const live = await deps.permissions(authorization);
      const after = await snapshot();
      // A handover or roster change during the provider read invalidates the result.
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Storage changed");
      access = { state: "checked", checkedAt: deps.now().toISOString(), ...projectDriveAccessPeople(before.members, live) };
    } catch {
      // Neither stored receipts nor a stale prior response can substitute for Google.
    }
  }
  // Read durable removal intent even when the live permission read failed.
  // Exact Project + generation joins exclude mismatched/orphan receipts. Do
  // not attribute historical emails or removed members to today's roster.
  const removals = await deps.database.select({ current: workspaceStorage.isCurrent, total: count() })
    .from(driveFolderGrants)
    .innerJoin(workspaceStorage, and(
      eq(workspaceStorage.id, driveFolderGrants.storageGenerationId),
      eq(workspaceStorage.workspaceId, driveFolderGrants.workspaceId),
    ))
    .where(and(
      eq(driveFolderGrants.workspaceId, authorization.projectId),
      eq(workspaceStorage.workspaceId, authorization.projectId),
      eq(driveFolderGrants.revokePending, true),
    ))
    .groupBy(workspaceStorage.isCurrent);
  const pendingRemovals = { currentFolder: 0, previousFolders: 0 };
  for (const removal of removals) {
    pendingRemovals[removal.current ? "currentFolder" : "previousFolders"] = removal.total;
  }
  return {
    ownerName: before.storage[0] ? before.storage[0].ownerName || "Storage owner" : null,
    folderUrl: safeDriveFolderUrl(before.storage[0]?.folderUrl ?? null),
    setup: setup && setup.status !== "demo" ? setup.status : "not_connected",
    pendingRemovals,
    ownConnection: { connected: own.connected, needsReconnect: own.status === "needs_reauth", accountEmail: own.accountEmail, affectedProjectCount: own.affectedProjectCount },
    access,
  };
}
