import "server-only";

import { createHash } from "node:crypto";

const PROJECT_DRIVE_OPERATION_KEY_VERSION = 1 as const;

export type ProjectDriveOperationKeyInput =
  | Readonly<{
      operationKind: "folder_provision";
      workspaceId: string;
      connectionId: string;
      targetStorageGenerationId: string;
    }>
  | Readonly<{
      operationKind: "grant_create";
      workspaceId: string;
      storageGenerationId: string;
      subjectUserId: string;
      granteeEmail: string;
      grantRole: "writer" | "reader";
    }>
  | Readonly<{
      operationKind: "folder_rename";
      workspaceId: string;
      storageGenerationId: string;
      workspaceRevision: number;
    }>
  | Readonly<{
      operationKind: "project_delete";
      workspaceId: string;
    }>
  | Readonly<{
      operationKind: "storage_handover";
      workspaceId: string;
      connectionId: string;
      storageGenerationId: string;
      targetStorageGenerationId: string;
    }>;

function requiredKeyPart(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must not be empty`);
  }
  return normalized;
}

export function normalizeProjectDriveGranteeEmail(email: string): string {
  const normalized = requiredKeyPart("granteeEmail", email).toLowerCase();
  if (
    normalized.length > 320 ||
    normalized.indexOf("@") < 1 ||
    normalized.endsWith("@")
  ) {
    throw new TypeError("granteeEmail must be a valid normalized email");
  }
  return normalized;
}

/**
 * Returns the database dedupe key for a logical provider operation.
 *
 * A fixed JSON tuple avoids delimiter collisions, the version prefix allows a
 * future algorithm to coexist safely, and the operation-specific identity
 * means retries reuse one journal row. Provider tokens, folder receipts and
 * other mutable outputs never participate in the key.
 */
export function projectDriveOperationDedupeKey(
  input: ProjectDriveOperationKeyInput,
): string {
  const workspaceId = requiredKeyPart("workspaceId", input.workspaceId);
  let identity: readonly (string | number)[];

  switch (input.operationKind) {
    case "folder_provision":
      identity = [
        requiredKeyPart("connectionId", input.connectionId),
        requiredKeyPart(
          "targetStorageGenerationId",
          input.targetStorageGenerationId,
        ),
      ];
      break;
    case "grant_create":
      if (input.grantRole !== "writer" && input.grantRole !== "reader") {
        throw new TypeError("grantRole must be writer or reader");
      }
      identity = [
        requiredKeyPart("storageGenerationId", input.storageGenerationId),
        requiredKeyPart("subjectUserId", input.subjectUserId),
        normalizeProjectDriveGranteeEmail(input.granteeEmail),
        input.grantRole,
      ];
      break;
    case "folder_rename":
      if (
        !Number.isSafeInteger(input.workspaceRevision) ||
        input.workspaceRevision < 1
      ) {
        throw new TypeError("workspaceRevision must be a positive safe integer");
      }
      identity = [
        requiredKeyPart("storageGenerationId", input.storageGenerationId),
        input.workspaceRevision,
      ];
      break;
    case "project_delete":
      identity = [];
      break;
    case "storage_handover": {
      const source = requiredKeyPart(
        "storageGenerationId",
        input.storageGenerationId,
      );
      const target = requiredKeyPart(
        "targetStorageGenerationId",
        input.targetStorageGenerationId,
      );
      if (source === target) {
        throw new TypeError("handover target must be a new storage generation");
      }
      identity = [
        requiredKeyPart("connectionId", input.connectionId),
        source,
        target,
      ];
      break;
    }
  }

  const tuple = [
    "project-drive-operation",
    PROJECT_DRIVE_OPERATION_KEY_VERSION,
    input.operationKind,
    workspaceId,
    ...identity,
  ] as const;

  return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}
