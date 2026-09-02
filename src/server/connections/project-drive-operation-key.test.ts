import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeProjectDriveGranteeEmail,
  projectDriveOperationDedupeKey,
  type ProjectDriveOperationKeyInput,
} from "./project-drive-operation-key";

function key(input: ProjectDriveOperationKeyInput): string {
  return projectDriveOperationDedupeKey(input);
}

describe("Project Drive operation dedupe keys", () => {
  it("is a deterministic lowercase SHA-256 key", () => {
    const input = {
      operationKind: "folder_provision",
      workspaceId: "workspace-a",
      connectionId: "connection-a",
      targetStorageGenerationId: "generation-a",
    } as const;

    assert.equal(key(input), key(input));
    assert.match(key(input), /^[0-9a-f]{64}$/);
  });

  it("separates tuple boundaries and operation kinds", () => {
    const grantA = key({
      operationKind: "grant_create",
      workspaceId: "ab",
      storageGenerationId: "c",
      subjectUserId: "d",
      granteeEmail: "person@example.com",
      grantRole: "writer",
    });
    const grantB = key({
      operationKind: "grant_create",
      workspaceId: "a",
      storageGenerationId: "bc",
      subjectUserId: "d",
      granteeEmail: "person@example.com",
      grantRole: "writer",
    });
    const rename = key({
      operationKind: "folder_rename",
      workspaceId: "ab",
      storageGenerationId: "c",
      workspaceRevision: 1,
    });

    assert.notEqual(grantA, grantB);
    assert.notEqual(grantA, rename);
  });

  it("normalizes a grant email before hashing", () => {
    const base = {
      operationKind: "grant_create",
      workspaceId: "workspace-a",
      storageGenerationId: "generation-a",
      subjectUserId: "user-a",
      grantRole: "writer",
    } as const;

    assert.equal(
      key({ ...base, granteeEmail: " Member@Example.COM " }),
      key({ ...base, granteeEmail: "member@example.com" }),
    );
    assert.equal(
      normalizeProjectDriveGranteeEmail(" Member@Example.COM "),
      "member@example.com",
    );
  });

  it("changes when a logical operation identity changes", () => {
    const first = key({
      operationKind: "folder_rename",
      workspaceId: "workspace-a",
      storageGenerationId: "generation-a",
      workspaceRevision: 8,
    });
    const nextRevision = key({
      operationKind: "folder_rename",
      workspaceId: "workspace-a",
      storageGenerationId: "generation-a",
      workspaceRevision: 9,
    });
    const otherWorkspace = key({
      operationKind: "folder_rename",
      workspaceId: "workspace-b",
      storageGenerationId: "generation-a",
      workspaceRevision: 8,
    });

    assert.notEqual(first, nextRevision);
    assert.notEqual(first, otherWorkspace);

    const provisionA = key({
      operationKind: "folder_provision",
      workspaceId: "workspace-a",
      connectionId: "connection-a",
      targetStorageGenerationId: "generation-b",
    });
    const provisionB = key({
      operationKind: "folder_provision",
      workspaceId: "workspace-a",
      connectionId: "connection-b",
      targetStorageGenerationId: "generation-b",
    });
    assert.notEqual(provisionA, provisionB);

    const readerGrant = key({
      operationKind: "grant_create",
      workspaceId: "workspace-a",
      storageGenerationId: "generation-a",
      subjectUserId: "user-a",
      granteeEmail: "member@example.com",
      grantRole: "reader",
    });
    const writerGrant = key({
      operationKind: "grant_create",
      workspaceId: "workspace-a",
      storageGenerationId: "generation-a",
      subjectUserId: "user-a",
      granteeEmail: "member@example.com",
      grantRole: "writer",
    });
    assert.notEqual(readerGrant, writerGrant);
  });

  it("rejects invalid operation identities", () => {
    assert.throws(
      () =>
        key({
          operationKind: "project_delete",
          workspaceId: " ",
        }),
      /workspaceId must not be empty/,
    );
    assert.throws(
      () =>
        key({
          operationKind: "folder_rename",
          workspaceId: "workspace-a",
          storageGenerationId: "generation-a",
          workspaceRevision: 0,
        }),
      /positive safe integer/,
    );
    assert.throws(
      () =>
        key({
          operationKind: "storage_handover",
          workspaceId: "workspace-a",
          connectionId: "connection-a",
          storageGenerationId: "generation-a",
          targetStorageGenerationId: "generation-a",
        }),
      /target must be a new storage generation/,
    );
    assert.throws(
      () =>
        projectDriveOperationDedupeKey({
          operationKind: "grant_create",
          workspaceId: "workspace-a",
          storageGenerationId: "generation-a",
          subjectUserId: "user-a",
          granteeEmail: "member@example.com",
          grantRole: "owner",
        } as unknown as ProjectDriveOperationKeyInput),
      /grantRole must be writer or reader/,
    );
  });
});
