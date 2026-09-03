import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  driveFolderGrants,
  projectDriveOperations,
  providerConnections,
  users,
  workspaceMembers,
  workspaces,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";
import {
  executeProjectDriveFolderOperation,
  type ProjectDriveFolderOperationExecutionResult,
  type ProjectDriveFolderOperationLocator,
} from "./project-drive-folder-operation-executor";
import {
  type ProjectDriveOperationJournalDependencies,
} from "./project-drive-operation-journal";
import { normalizeProjectDriveGranteeEmail } from "./project-drive-operation-key";
import { prepareAccountFencedProjectDriveOperationInTransaction } from "./project-drive-operation-orchestrator";

type ManagementDb = LibSQLDatabase<typeof schema>;
type JournalRuntimeDependencies = Omit<
  ProjectDriveOperationJournalDependencies,
  "database"
>;

export type ProjectDriveFolderSetupState = Readonly<{
  status:
    | "active"
    | "setting_up"
    | "fallback"
    | "not_connected"
    | "needs_attention"
    | "archived"
    | "unavailable"
    | "demo";
  coverage: "complete" | "pending" | "incomplete" | "not_applicable";
  pendingMemberCount: number;
  memberGapCount: number;
  folderUrl: string | null;
}>;

export const DEMO_PROJECT_DRIVE_FOLDER_SETUP_STATE: ProjectDriveFolderSetupState =
  Object.freeze({
    status: "demo",
    coverage: "not_applicable",
    pendingMemberCount: 0,
    memberGapCount: 0,
    folderUrl: null,
  });

export const ARCHIVED_PROJECT_DRIVE_FOLDER_SETUP_STATE: ProjectDriveFolderSetupState =
  Object.freeze({
    status: "archived",
    coverage: "not_applicable",
    pendingMemberCount: 0,
    memberGapCount: 0,
    folderUrl: null,
  });

const NOT_CONNECTED_STATE: ProjectDriveFolderSetupState = Object.freeze({
  status: "not_connected",
  coverage: "not_applicable",
  pendingMemberCount: 0,
  memberGapCount: 0,
  folderUrl: null,
});

const SETTING_UP_STATE: ProjectDriveFolderSetupState = Object.freeze({
  status: "setting_up",
  coverage: "pending",
  pendingMemberCount: 0,
  memberGapCount: 0,
  folderUrl: null,
});

const NEEDS_ATTENTION_STATE: ProjectDriveFolderSetupState = Object.freeze({
  status: "needs_attention",
  coverage: "incomplete",
  pendingMemberCount: 0,
  memberGapCount: 0,
  folderUrl: null,
});

const UNAVAILABLE_STATE: ProjectDriveFolderSetupState = Object.freeze({
  status: "unavailable",
  coverage: "not_applicable",
  pendingMemberCount: 0,
  memberGapCount: 0,
  folderUrl: null,
});

const IN_FLIGHT_OPERATION_STATUSES = [
  "pending",
  "running",
  "retry_wait",
  "manual_attention",
] as const;

export type ProjectDriveFolderManagementDependencies = Readonly<{
  database: ManagementDb;
  execute: (
    input: ProjectDriveFolderOperationLocator,
  ) => Promise<ProjectDriveFolderOperationExecutionResult>;
  randomStorageGenerationId?: () => string;
  journalRuntimeDependencies?: JournalRuntimeDependencies;
}>;

type SetupDecision =
  | Readonly<{ kind: "existing" }>
  | Readonly<{ kind: "archived" }>
  | Readonly<{ kind: "not-connected" }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "needs-attention" }>
  | Readonly<{ kind: "other-owner-in-flight" }>
  | Readonly<{
      kind: "execute";
      locator: ProjectDriveFolderOperationLocator;
    }>;

function isCanonicalUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizedEmailOrNull(value: string | null): string | null {
  if (!value) return null;
  try {
    return normalizeProjectDriveGranteeEmail(value);
  } catch {
    return null;
  }
}

function isPendingGrantStatus(status: string): boolean {
  return status === "pending" || status === "running" || status === "retry_wait";
}

export function createProjectDriveFolderManagementService(
  deps: ProjectDriveFolderManagementDependencies,
) {
  const nextStorageGenerationId =
    deps.randomStorageGenerationId ?? randomUUID;

  async function readCurrentState(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<ProjectDriveFolderSetupState | null> {
    const [project] = await deps.database
      .select({ archivedAt: workspaces.archivedAt })
      .from(workspaces)
      .where(byWorkspace(workspaces.id, authorization.projectId))
      .limit(1);
    if (!project) return UNAVAILABLE_STATE;
    if (project.archivedAt !== null) {
      return ARCHIVED_PROJECT_DRIVE_FOLDER_SETUP_STATE;
    }
    const storageRows = await deps.database
      .select({
        storageGenerationId: workspaceStorage.id,
        state: workspaceStorage.state,
        folderUrl: workspaceStorage.folderWebViewLink,
        storageOwnerUserId: providerConnections.userId,
      })
      .from(workspaceStorage)
      .innerJoin(
        providerConnections,
        eq(providerConnections.id, workspaceStorage.connectionId),
      )
      .where(
        byWorkspace(
          workspaceStorage.workspaceId,
          authorization.projectId,
          eq(workspaceStorage.isCurrent, true),
        ),
      )
      .limit(2);
    if (storageRows.length === 0) return null;
    if (storageRows.length !== 1) return UNAVAILABLE_STATE;
    const storage = storageRows[0];

    const members = await deps.database
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        email: users.email,
      })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, authorization.projectId));
    const storageOwnerMembership = members.find(
      (member) => member.userId === storage.storageOwnerUserId,
    );
    const actorMembership = members.find(
      (member) => member.userId === authorization.actorUserId,
    );
    if (!actorMembership || actorMembership.role !== "owner") {
      return UNAVAILABLE_STATE;
    }
    if (!storageOwnerMembership || storageOwnerMembership.role !== "owner") {
      return Object.freeze({
        ...NEEDS_ATTENTION_STATE,
        folderUrl: storage.folderUrl,
      });
    }
    const grants = await deps.database
      .select({
        userId: driveFolderGrants.userId,
        grantedEmail: driveFolderGrants.grantedEmail,
        role: driveFolderGrants.role,
        revokePending: driveFolderGrants.revokePending,
      })
      .from(driveFolderGrants)
      .where(
        and(
          eq(driveFolderGrants.workspaceId, authorization.projectId),
          eq(
            driveFolderGrants.storageGenerationId,
            storage.storageGenerationId,
          ),
        ),
      );
    const operations = await deps.database
      .select({
        subjectUserId: projectDriveOperations.subjectUserId,
        granteeEmail: projectDriveOperations.granteeEmail,
        grantRole: projectDriveOperations.grantRole,
        status: projectDriveOperations.status,
      })
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          authorization.projectId,
          eq(projectDriveOperations.operationKind, "grant_create"),
          eq(
            projectDriveOperations.storageGenerationId,
            storage.storageGenerationId,
          ),
        ),
      );

    let pendingMemberCount = 0;
    let memberGapCount = 0;
    for (const member of members) {
      if (member.userId === storage.storageOwnerUserId) continue;
      const email = normalizedEmailOrNull(member.email);
      if (!email) {
        memberGapCount += 1;
        continue;
      }
      const grant = grants.find(
        (candidate) =>
          candidate.userId === member.userId &&
          candidate.grantedEmail === email &&
          candidate.role === "writer" &&
          !candidate.revokePending,
      );
      if (grant) continue;
      const intent = operations.find(
        (candidate) =>
          candidate.subjectUserId === member.userId &&
          candidate.granteeEmail === email &&
          candidate.grantRole === "writer",
      );
      if (intent && isPendingGrantStatus(intent.status)) {
        pendingMemberCount += 1;
      } else {
        memberGapCount += 1;
      }
    }

    const coverage =
      memberGapCount > 0
        ? "incomplete"
        : pendingMemberCount > 0
          ? "pending"
          : "complete";
    const status =
      storage.state !== "active"
        ? "needs_attention"
        : coverage === "incomplete"
          ? "fallback"
          : coverage === "pending"
            ? "setting_up"
            : "active";
    return Object.freeze({
      status,
      coverage,
      pendingMemberCount,
      memberGapCount,
      folderUrl: storage.folderUrl,
    });
  }

  async function decide(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<SetupDecision> {
    return deps.database.transaction(
      async (transaction) => {
        const projectRows = await transaction
          .select({
            archivedAt: workspaces.archivedAt,
            membershipRole: workspaceMembers.role,
          })
          .from(workspaces)
          .leftJoin(
            workspaceMembers,
            and(
              eq(workspaceMembers.workspaceId, workspaces.id),
              eq(workspaceMembers.userId, authorization.actorUserId),
            ),
          )
          .where(byWorkspace(workspaces.id, authorization.projectId))
          .limit(2);
        if (
          projectRows.length !== 1 ||
          projectRows[0].membershipRole !== "owner"
        ) {
          return Object.freeze({ kind: "unavailable" });
        }
        if (projectRows[0].archivedAt || authorization.archived) {
          return Object.freeze({ kind: "archived" });
        }

        const currentStorage = await transaction
          .select({ id: workspaceStorage.id })
          .from(workspaceStorage)
          .where(
            byWorkspace(
              workspaceStorage.workspaceId,
              authorization.projectId,
              eq(workspaceStorage.isCurrent, true),
            ),
          )
          .limit(2);
        if (currentStorage.length > 1) {
          return Object.freeze({ kind: "unavailable" });
        }
        if (currentStorage.length === 1) {
          return Object.freeze({ kind: "existing" });
        }

        const existingOperations = await transaction
          .select({
            id: projectDriveOperations.id,
            status: projectDriveOperations.status,
            connectionId: projectDriveOperations.connectionId,
          })
          .from(projectDriveOperations)
          .where(
            byWorkspace(
              projectDriveOperations.workspaceId,
              authorization.projectId,
              eq(projectDriveOperations.operationKind, "folder_provision"),
              inArray(
                projectDriveOperations.status,
                IN_FLIGHT_OPERATION_STATUSES,
              ),
            ),
          )
          .limit(2);
        if (existingOperations.length > 1) {
          return Object.freeze({ kind: "unavailable" });
        }
        const existing = existingOperations[0];
        if (existing) {
          if (existing.status === "manual_attention") {
            return Object.freeze({ kind: "needs-attention" });
          }
          const [ownedConnection] = await transaction
            .select({ id: providerConnections.id })
            .from(providerConnections)
            .where(
              and(
                eq(providerConnections.id, existing.connectionId ?? ""),
                eq(providerConnections.userId, authorization.actorUserId),
                eq(providerConnections.provider, "google_drive"),
                eq(providerConnections.status, "active"),
                eq(providerConnections.isCurrent, true),
              ),
            )
            .limit(1);
          if (!ownedConnection) {
            return Object.freeze({ kind: "other-owner-in-flight" });
          }
          return Object.freeze({
            kind: "execute",
            locator: {
              workspaceId: authorization.projectId,
              operationId: existing.id,
              operationKind: "folder_provision" as const,
            },
          });
        }

        const connections = await transaction
          .select({ id: providerConnections.id })
          .from(providerConnections)
          .where(
            and(
              eq(providerConnections.userId, authorization.actorUserId),
              eq(providerConnections.provider, "google_drive"),
              eq(providerConnections.status, "active"),
              eq(providerConnections.isCurrent, true),
            ),
          )
          .limit(2);
        if (connections.length === 0) {
          return Object.freeze({ kind: "not-connected" });
        }
        if (connections.length !== 1) {
          return Object.freeze({ kind: "unavailable" });
        }
        const storageGenerationId = nextStorageGenerationId();
        if (!isCanonicalUuid(storageGenerationId)) {
          throw new TypeError("Storage generation id must be a UUID.");
        }
        const prepared =
          await prepareAccountFencedProjectDriveOperationInTransaction(
            transaction,
            {
              operationKind: "folder_provision",
              workspaceId: authorization.projectId,
              connectionId: connections[0].id,
              targetStorageGenerationId: storageGenerationId,
            },
            deps.journalRuntimeDependencies,
          );
        if (prepared.outcome === "conflict") {
          return Object.freeze({ kind: "unavailable" });
        }
        return Object.freeze({
          kind: "execute",
          locator: {
            workspaceId: authorization.projectId,
            operationId: prepared.operation.operationId,
            operationKind: "folder_provision" as const,
          },
        });
      },
      { behavior: "immediate" },
    );
  }

  async function enable(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<ProjectDriveFolderSetupState> {
    assertProjectDriveCapability(authorization, "manageProject");
    if (authorization.archived) {
      return ARCHIVED_PROJECT_DRIVE_FOLDER_SETUP_STATE;
    }

    const decision = await decide(authorization);
    if (decision.kind === "archived") {
      return ARCHIVED_PROJECT_DRIVE_FOLDER_SETUP_STATE;
    }
    if (decision.kind === "not-connected") return NOT_CONNECTED_STATE;
    if (decision.kind === "unavailable") return UNAVAILABLE_STATE;
    if (decision.kind === "needs-attention") return NEEDS_ATTENTION_STATE;
    if (decision.kind === "other-owner-in-flight") return SETTING_UP_STATE;
    if (decision.kind === "existing") {
      return (await readCurrentState(authorization)) ?? UNAVAILABLE_STATE;
    }

    const execution = await deps.execute(decision.locator);
    const current = await readCurrentState(authorization);
    if (current) return current;
    if (execution.outcome === "manual_attention") {
      return NEEDS_ATTENTION_STATE;
    }
    if (execution.outcome === "conflict") return UNAVAILABLE_STATE;
    return SETTING_UP_STATE;
  }

  return Object.freeze({ enable });
}

function projectDriveFolderManagementServiceFromEnv() {
  return createProjectDriveFolderManagementService({
    database: db,
    execute: executeProjectDriveFolderOperation,
  });
}

/** Enable Drive for this Project only after an explicit management action. */
export async function enableProjectGoogleDriveStorage(
  authorization: AuthorizedProjectDriveContext,
): Promise<ProjectDriveFolderSetupState> {
  return projectDriveFolderManagementServiceFromEnv().enable(authorization);
}
