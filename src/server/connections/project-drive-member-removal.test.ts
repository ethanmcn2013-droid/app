import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  resources,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenCipher,
} from "./project-drive-core.test.helpers";
import type { ExactDriveGrantReceipt } from "./project-drive-erasure-grants";
import {
  createProjectDriveMemberRemovalService,
  ProjectDriveMemberRemovalError,
} from "./project-drive-member-removal";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

async function seededRemovalFixture() {
  const fixture = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  return fixture;
}

async function insertGrant(
  fixture: Awaited<ReturnType<typeof seededRemovalFixture>>,
  input: Readonly<{
    storageGenerationId?: string;
    userId?: string;
    permissionId?: string;
    revokePending?: boolean;
  }> = {},
) {
  await fixture.db.insert(driveFolderGrants).values({
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    workspaceId: "ws-a",
    userId: input.userId ?? "member-a",
    permissionId: input.permissionId ?? "permission-a",
    grantedEmail: "member.a@example.com",
    role: "writer",
    grantedAt: new Date(10_000),
    revokePending: input.revokePending ?? false,
  });
}

async function createGrantOperation(
  fixture: Awaited<ReturnType<typeof seededRemovalFixture>>,
  input: Readonly<{
    operationId: string;
    storageGenerationId?: string;
    userId?: string;
    email?: string;
    permissionId?: string;
    claimOnly?: boolean;
  }>,
) {
  const journal = createProjectDriveOperationJournal({
    database: fixture.db,
    randomOperationId: () => input.operationId,
  });
  const prepared = await journal.prepare({
    operationKind: "grant_create",
    workspaceId: "ws-a",
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    subjectUserId: input.userId ?? "member-a",
    granteeEmail: input.email ?? "member.a@example.com",
    grantRole: "writer",
  });
  assert.equal(prepared.outcome, "prepared");
  if (prepared.outcome !== "prepared" || input.permissionId === undefined) {
    return prepared.operation;
  }
  const claim = await journal.claim({
    workspaceId: "ws-a",
    operationId: input.operationId,
  });
  assert.equal(claim.outcome, "claimed");
  if (claim.outcome !== "claimed" || input.claimOnly) return prepared.operation;
  const completed = await journal.complete({
    workspaceId: "ws-a",
    operationId: input.operationId,
    attemptFence: claim.claim.attemptFence,
    operationKind: "grant_create",
    receipt: { providerPermissionId: input.permissionId },
  });
  assert.equal(completed.outcome, "completed");
  return prepared.operation;
}

function expectRemovalError(code: ProjectDriveMemberRemovalError["code"]) {
  return (error: unknown) =>
    error instanceof ProjectDriveMemberRemovalError && error.code === code;
}

describe("Project Drive member removal", () => {
  it("revokes the exact provider permission before deleting membership and local evidence", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await insertGrant(fixture);
      await createGrantOperation(fixture, {
        operationId: "grant-a",
        permissionId: "permission-a",
      });
      const receipts: ExactDriveGrantReceipt[] = [];
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async (receipt) => {
          assert.equal(
            (
              await fixture.db
                .select()
                .from(workspaceMembers)
                .where(
                  and(
                    eq(workspaceMembers.workspaceId, "ws-a"),
                    eq(workspaceMembers.userId, "member-a"),
                  ),
                )
            ).length,
            1,
            "membership must remain while provider work is in flight",
          );
          receipts.push(receipt);
        },
      });

      assert.deepEqual(await service.remove({
        workspaceId: "ws-a",
        memberUserId: "member-a",
      }), { removed: true, revokedGrantCount: 1 });
      assert.deepEqual(receipts, [{
        storageGenerationId: "gen-current",
        workspaceId: "ws-a",
        connectionId: "conn-old",
        folderId: "folder-current",
        userId: "member-a",
        permissionId: "permission-a",
      }]);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "member-a"))
        ).length,
        0,
      );
      assert.equal(
        (
          await fixture.db
            .select()
            .from(driveFolderGrants)
            .where(eq(driveFolderGrants.userId, "member-a"))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps membership and exact revoke-pending evidence after provider failure", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await insertGrant(fixture);
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => {
          throw new Error("provider unavailable");
        },
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "member-a" }),
        /provider unavailable/,
      );
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "member-a"))
        ).length,
        1,
      );
      const [grant] = await fixture.db
        .select()
        .from(driveFolderGrants)
        .where(eq(driveFolderGrants.userId, "member-a"));
      assert.equal(grant?.permissionId, "permission-a");
      assert.equal(grant?.revokePending, true);
    } finally {
      fixture.cleanup();
    }
  });

  it("atomically cancels untouched grant intent before removing the member", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await createGrantOperation(fixture, { operationId: "grant-pending" });
      let providerCalls = 0;
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => {
          providerCalls += 1;
        },
      });
      await service.remove({ workspaceId: "ws-a", memberUserId: "member-a" });
      const [operation] = await fixture.db
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, "grant-pending"));
      assert.equal(operation?.status, "cancelled");
      assert.equal(providerCalls, 0);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "member-a"))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("blocks removal while a grant worker has an in-flight provider outcome", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await createGrantOperation(fixture, {
        operationId: "grant-running",
        permissionId: "not-yet-known",
        claimOnly: true,
      });
      let providerCalls = 0;
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => {
          providerCalls += 1;
        },
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "member-a" }),
        expectRemovalError("drive-work-in-progress"),
      );
      assert.equal(providerCalls, 0);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "member-a"))
        ).length,
        1,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("blocks the current storage owner until storage is handed over", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await fixture.db
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(eq(workspaceMembers.userId, "member-b"));
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => undefined,
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "owner" }),
        expectRemovalError("storage-handover-required"),
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("blocks removal while the member has a pending delegated upload", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await fixture.client.executeMultiple(`
        INSERT INTO tasks (
          id, workspace_id, title, lane, priority, assignees, created_at, updated_at
        ) VALUES ('task-a', 'ws-a', 'Task A', 'todo', 'medium', '[]', 10, 10);
      `);
      await fixture.db.insert(resources).values({
        id: "upload-pending",
        workspaceId: "ws-a",
        taskId: "task-a",
        kind: "upload",
        provider: "drive",
        storage: "drive",
        storageGenerationId: "gen-current",
        storedPath: "sealed-session-capability",
        title: "Contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_024,
        addedByUserId: "member-a",
        addedAt: 10,
        accessState: "pending",
        countsAgainstStorage: 0,
      });
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => undefined,
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "member-a" }),
        expectRemovalError("upload-in-progress"),
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("blocks removal of a historical storage owner with a pending delegated upload", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await fixture.db
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(eq(workspaceMembers.userId, "member-b"));
      await fixture.db.insert(providerConnections).values({
        id: "conn-member-b",
        userId: "member-b",
        provider: "google_drive",
        providerAccountId: "account-member-b",
        providerAccountEmail: "member.b@example.com",
        rootFolderId: "root-member-b",
        refreshTokenCipher: tokenCipher(
          "conn-member-b",
          "refresh-member-b",
        ),
        keyVersion: 1,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
        status: "active",
        isCurrent: true,
        connectedAt: new Date(20_000),
      });
      await fixture.db.transaction(async (transaction) => {
        await transaction
          .update(workspaceStorage)
          .set({ isCurrent: false })
          .where(eq(workspaceStorage.workspaceId, "ws-a"));
        await transaction.insert(workspaceStorage).values({
          id: "gen-member-b",
          workspaceId: "ws-a",
          connectionId: "conn-member-b",
          folderId: "folder-member-b",
          folderWebViewLink:
            "https://drive.google.com/drive/folders/folder-member-b",
          state: "active",
          isCurrent: true,
        });
      });
      await fixture.client.executeMultiple(`
        INSERT INTO tasks (
          id, workspace_id, title, lane, priority, assignees, created_at, updated_at
        ) VALUES ('task-a', 'ws-a', 'Task A', 'todo', 'medium', '[]', 10, 10);
      `);
      await fixture.db.insert(resources).values({
        id: "upload-owned-historically",
        workspaceId: "ws-a",
        taskId: "task-a",
        kind: "upload",
        provider: "drive",
        storage: "drive",
        storageGenerationId: "gen-old",
        storedPath: "sealed-session-capability",
        title: "Archive.zip",
        mimeType: "application/zip",
        sizeBytes: 2_048,
        addedByUserId: "member-a",
        addedAt: 10,
        accessState: "pending",
        countsAgainstStorage: 0,
      });
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => undefined,
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "owner" }),
        expectRemovalError("upload-in-progress"),
      );
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "owner"))
        ).length,
        1,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("revokes a journal-only exact receipt even when the grant row is missing", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await createGrantOperation(fixture, {
        operationId: "grant-recovered",
        storageGenerationId: "gen-old",
        permissionId: "permission-recovered",
      });
      const receipts: ExactDriveGrantReceipt[] = [];
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async (receipt) => {
          receipts.push(receipt);
        },
      });
      const result = await service.remove({
        workspaceId: "ws-a",
        memberUserId: "member-a",
      });
      assert.equal(result.removed, true);
      assert.equal(receipts[0]?.storageGenerationId, "gen-old");
      assert.equal(receipts[0]?.folderId, "folder-old");
      assert.equal(receipts[0]?.permissionId, "permission-recovered");
    } finally {
      fixture.cleanup();
    }
  });

  it("retains membership when Drive evidence changes during provider revocation", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await insertGrant(fixture);
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => {
          await insertGrant(fixture, {
            storageGenerationId: "gen-old",
            permissionId: "permission-race",
          });
        },
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "member-a" }),
        expectRemovalError("receipt-conflict"),
      );
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "member-a"))
        ).length,
        1,
      );
      const grants = await fixture.db
        .select()
        .from(driveFolderGrants)
        .where(eq(driveFolderGrants.userId, "member-a"));
      assert.equal(grants.length, 2);
      assert.equal(
        grants.find((grant) => grant.permissionId === "permission-a")
          ?.revokePending,
        true,
      );
      assert.equal(
        grants.find((grant) => grant.permissionId === "permission-race")
          ?.revokePending,
        false,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("refuses before provider work when either exact account lineage is fenced", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await createGrantOperation(fixture, {
        operationId: "grant-fenced",
        permissionId: "permission-fenced",
      });
      await fixture.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("owner"),
        value: "active:v1",
      });
      let providerCalls = 0;
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => {
          providerCalls += 1;
        },
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "member-a" }),
        expectRemovalError("account-erasure-in-progress"),
      );
      assert.equal(providerCalls, 0);
    } finally {
      fixture.cleanup();
    }
  });

  it("preserves the final owner invariant inside the removal transaction", async () => {
    const fixture = await seededRemovalFixture();
    try {
      await fixture.db
        .delete(workspaceStorage)
        .where(eq(workspaceStorage.workspaceId, "ws-a"));
      const service = createProjectDriveMemberRemovalService({
        database: fixture.db,
        revokeExactGrant: async () => undefined,
      });
      await assert.rejects(
        service.remove({ workspaceId: "ws-a", memberUserId: "owner" }),
        expectRemovalError("last-owner"),
      );
    } finally {
      fixture.cleanup();
    }
  });
});
