import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  projectDriveOperations,
  providerConnections,
  workspaceMembers,
  workspaces,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import { assertExactGoogleDriveScopeSet } from "./google-drive-scopes";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";
import {
  executeProjectDriveFolderOperation,
  type ProjectDriveFolderOperationExecutionResult,
  type ProjectDriveFolderOperationLocator,
} from "./project-drive-folder-operation-executor";
import type { ProjectDriveOperationJournalDependencies } from "./project-drive-operation-journal";
import { prepareAccountFencedProjectDriveOperationInTransaction } from "./project-drive-operation-orchestrator";
import { listPendingDelegatedDriveUploadReceiptsForWorkspace } from "./project-drive-upload-receipts";

type HandoverDb = LibSQLDatabase<typeof schema>;
type JournalRuntimeDependencies = Omit<
  ProjectDriveOperationJournalDependencies,
  "database"
>;

const IN_FLIGHT_STATUSES = [
  "pending",
  "running",
  "retry_wait",
  "manual_attention",
] as const;

export type ProjectDriveStorageHandoverState = Readonly<{
  status:
    | "active"
    | "already_owner"
    | "setting_up"
    | "needs_attention"
    | "target_not_connected"
    | "upload_in_progress"
    | "archived"
    | "unavailable"
    | "demo";
  storageOwnerUserId: string | null;
  folderUrl: string | null;
}>;

export const DEMO_PROJECT_DRIVE_STORAGE_HANDOVER_STATE: ProjectDriveStorageHandoverState =
  Object.freeze({
    status: "demo",
    storageOwnerUserId: null,
    folderUrl: null,
  });

export const ARCHIVED_PROJECT_DRIVE_STORAGE_HANDOVER_STATE: ProjectDriveStorageHandoverState =
  Object.freeze({
    status: "archived",
    storageOwnerUserId: null,
    folderUrl: null,
  });

type HandoverDecision =
  | Readonly<{
      kind:
        | "already-owner"
        | "needs-attention"
        | "target-not-connected"
        | "upload-in-progress"
        | "archived"
        | "unavailable";
      storageOwnerUserId: string | null;
      folderUrl: string | null;
    }>
  | Readonly<{
      kind: "execute";
      locator: ProjectDriveFolderOperationLocator;
      sourceOwnerUserId: string;
      sourceFolderUrl: string;
    }>;

export type ProjectDriveStorageHandoverDependencies = Readonly<{
  database: HandoverDb;
  execute: (
    input: ProjectDriveFolderOperationLocator,
  ) => Promise<ProjectDriveFolderOperationExecutionResult>;
  randomStorageGenerationId?: () => string;
  journalRuntimeDependencies?: JournalRuntimeDependencies;
}>;

function canonicalId(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${label} must be a canonical id`);
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function state(
  status: ProjectDriveStorageHandoverState["status"],
  storageOwnerUserId: string | null,
  folderUrl: string | null,
): ProjectDriveStorageHandoverState {
  return Object.freeze({ status, storageOwnerUserId, folderUrl });
}

export function createProjectDriveStorageHandoverService(
  deps: ProjectDriveStorageHandoverDependencies,
) {
  const nextGenerationId = deps.randomStorageGenerationId ?? randomUUID;

  async function decide(
    authorization: AuthorizedProjectDriveContext,
    targetOwnerUserId: string,
  ): Promise<HandoverDecision> {
    return deps.database.transaction(
      async (transaction) => {
        const projectRows = await transaction
          .select({
            archivedAt: workspaces.archivedAt,
            actorRole: workspaceMembers.role,
          })
          .from(workspaces)
          .leftJoin(
            workspaceMembers,
            and(
              eq(workspaceMembers.workspaceId, workspaces.id),
              eq(
                workspaceMembers.userId,
                authorization.actorUserId,
              ),
            ),
          )
          .where(byWorkspace(workspaces.id, authorization.projectId))
          .limit(2);
        if (
          projectRows.length !== 1 ||
          projectRows[0].actorRole !== "owner"
        ) {
          return {
            kind: "unavailable",
            storageOwnerUserId: null,
            folderUrl: null,
          };
        }
        if (projectRows[0].archivedAt || authorization.archived) {
          return {
            kind: "archived",
            storageOwnerUserId: null,
            folderUrl: null,
          };
        }

        const storageRows = await transaction
          .select({
            storageGenerationId: workspaceStorage.id,
            folderUrl: workspaceStorage.folderWebViewLink,
            sourceOwnerUserId: providerConnections.userId,
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
        if (storageRows.length !== 1) {
          return {
            kind: "unavailable",
            storageOwnerUserId: null,
            folderUrl: null,
          };
        }
        const storage = storageRows[0];
        if (storage.sourceOwnerUserId === targetOwnerUserId) {
          return {
            kind: "already-owner",
            storageOwnerUserId: targetOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }

        const ownerMemberships = await transaction
          .select({
            userId: workspaceMembers.userId,
            role: workspaceMembers.role,
          })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, authorization.projectId),
              inArray(workspaceMembers.userId, [
                storage.sourceOwnerUserId,
                targetOwnerUserId,
              ]),
            ),
          );
        if (
          ownerMemberships.length !== 2 ||
          ownerMemberships.some((member) => member.role !== "owner")
        ) {
          return {
            kind: "unavailable",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }

        const pendingUploads =
          await listPendingDelegatedDriveUploadReceiptsForWorkspace(
            transaction,
            authorization.projectId,
          );
        if (pendingUploads.length > 0) {
          return {
            kind: "upload-in-progress",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }

        const targetConnections = await transaction
          .select({
            id: providerConnections.id,
            scopes: providerConnections.scopes,
          })
          .from(providerConnections)
          .where(
            and(
              eq(providerConnections.userId, targetOwnerUserId),
              eq(providerConnections.provider, "google_drive"),
              eq(providerConnections.status, "active"),
              eq(providerConnections.isCurrent, true),
            ),
          )
          .limit(2);
        if (targetConnections.length === 0) {
          return {
            kind: "target-not-connected",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }
        if (targetConnections.length !== 1) {
          return {
            kind: "unavailable",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }
        try {
          assertExactGoogleDriveScopeSet(targetConnections[0].scopes);
        } catch {
          return {
            kind: "target-not-connected",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }

        const existingOperations = await transaction
          .select({
            id: projectDriveOperations.id,
            connectionId: projectDriveOperations.connectionId,
            storageGenerationId:
              projectDriveOperations.storageGenerationId,
            status: projectDriveOperations.status,
          })
          .from(projectDriveOperations)
          .where(
            byWorkspace(
              projectDriveOperations.workspaceId,
              authorization.projectId,
              eq(projectDriveOperations.operationKind, "storage_handover"),
              inArray(
                projectDriveOperations.status,
                IN_FLIGHT_STATUSES,
              ),
            ),
          )
          .limit(2);
        if (existingOperations.length > 1) {
          return {
            kind: "unavailable",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }
        const existing = existingOperations[0];
        if (existing) {
          if (
            existing.connectionId !== targetConnections[0].id ||
            existing.storageGenerationId !== storage.storageGenerationId
          ) {
            return {
              kind: "unavailable",
              storageOwnerUserId: storage.sourceOwnerUserId,
              folderUrl: storage.folderUrl,
            };
          }
          if (existing.status === "manual_attention") {
            return {
              kind: "needs-attention",
              storageOwnerUserId: storage.sourceOwnerUserId,
              folderUrl: storage.folderUrl,
            };
          }
          return {
            kind: "execute",
            locator: {
              workspaceId: authorization.projectId,
              operationId: existing.id,
              operationKind: "storage_handover",
            },
            sourceOwnerUserId: storage.sourceOwnerUserId,
            sourceFolderUrl: storage.folderUrl,
          };
        }

        const targetStorageGenerationId = nextGenerationId();
        if (!isUuid(targetStorageGenerationId)) {
          throw new TypeError("Storage generation id must be a UUID.");
        }
        const prepared =
          await prepareAccountFencedProjectDriveOperationInTransaction(
            transaction,
            {
              operationKind: "storage_handover",
              workspaceId: authorization.projectId,
              connectionId: targetConnections[0].id,
              storageGenerationId: storage.storageGenerationId,
              targetStorageGenerationId,
            },
            deps.journalRuntimeDependencies,
          );
        if (prepared.outcome === "conflict") {
          return {
            kind: "unavailable",
            storageOwnerUserId: storage.sourceOwnerUserId,
            folderUrl: storage.folderUrl,
          };
        }
        return {
          kind: "execute",
          locator: {
            workspaceId: authorization.projectId,
            operationId: prepared.operation.operationId,
            operationKind: "storage_handover",
          },
          sourceOwnerUserId: storage.sourceOwnerUserId,
          sourceFolderUrl: storage.folderUrl,
        };
      },
      { behavior: "immediate" },
    );
  }

  async function currentStorageState(
    workspaceId: string,
  ): Promise<
    Readonly<{
      storageOwnerUserId: string;
      folderUrl: string;
    }> | null
  > {
    const rows = await deps.database
      .select({
        storageOwnerUserId: providerConnections.userId,
        folderUrl: workspaceStorage.folderWebViewLink,
      })
      .from(workspaceStorage)
      .innerJoin(
        providerConnections,
        eq(providerConnections.id, workspaceStorage.connectionId),
      )
      .where(
        byWorkspace(
          workspaceStorage.workspaceId,
          workspaceId,
          eq(workspaceStorage.isCurrent, true),
        ),
      )
      .limit(2);
    return rows.length === 1 ? Object.freeze(rows[0]) : null;
  }

  async function handover(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{ targetOwnerUserId: string }>,
  ): Promise<ProjectDriveStorageHandoverState> {
    assertProjectDriveCapability(authorization, "manageProject");
    const targetOwnerUserId = canonicalId(
      input.targetOwnerUserId,
      "targetOwnerUserId",
    );
    if (authorization.archived) {
      return state("archived", null, null);
    }
    const decision = await decide(authorization, targetOwnerUserId);
    if (decision.kind === "already-owner") {
      return state(
        "already_owner",
        decision.storageOwnerUserId,
        decision.folderUrl,
      );
    }
    if (decision.kind === "archived") return state("archived", null, null);
    if (decision.kind === "target-not-connected") {
      return state(
        "target_not_connected",
        decision.storageOwnerUserId,
        decision.folderUrl,
      );
    }
    if (decision.kind === "upload-in-progress") {
      return state(
        "upload_in_progress",
        decision.storageOwnerUserId,
        decision.folderUrl,
      );
    }
    if (decision.kind === "needs-attention") {
      return state(
        "needs_attention",
        decision.storageOwnerUserId,
        decision.folderUrl,
      );
    }
    if (decision.kind === "unavailable") {
      return state(
        "unavailable",
        decision.storageOwnerUserId,
        decision.folderUrl,
      );
    }
    if (!("locator" in decision)) {
      return state(
        "unavailable",
        decision.storageOwnerUserId,
        decision.folderUrl,
      );
    }

    const execution = await deps.execute(decision.locator);
    const current = await currentStorageState(authorization.projectId);
    if (current?.storageOwnerUserId === targetOwnerUserId) {
      return state("active", targetOwnerUserId, current.folderUrl);
    }
    if (execution.outcome === "manual_attention") {
      return state(
        "needs_attention",
        current?.storageOwnerUserId ?? decision.sourceOwnerUserId,
        current?.folderUrl ?? decision.sourceFolderUrl,
      );
    }
    return state(
      "setting_up",
      current?.storageOwnerUserId ?? decision.sourceOwnerUserId,
      current?.folderUrl ?? decision.sourceFolderUrl,
    );
  }

  return Object.freeze({ handover });
}

function projectDriveStorageHandoverServiceFromEnv() {
  return createProjectDriveStorageHandoverService({
    database: db,
    execute: executeProjectDriveFolderOperation,
  });
}

export async function handoverProjectGoogleDriveStorage(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{ targetOwnerUserId: string }>,
): Promise<ProjectDriveStorageHandoverState> {
  return projectDriveStorageHandoverServiceFromEnv().handover(
    authorization,
    input,
  );
}
