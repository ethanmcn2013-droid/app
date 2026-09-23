import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  workspaceMembers,
  workspaces,
  workspaceStorage,
} from "@/server/db/schema";
import {
  coreAuthorization,
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenCipher,
} from "./project-drive-core.test.helpers";
import {
  createProjectDriveFolderManagementService,
  type ProjectDriveFolderSetupState,
} from "./project-drive-folder-management";
import { prepareExistingMemberDriveGrantIntents } from "./project-drive-membership-lifecycle";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  googleDriveAccountErasureFenceKey,
} from "./project-drive-operation-lifecycle";

const STORAGE_GENERATION_ID = "11111111-1111-4111-8111-111111111111";

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(core.client);
  return core;
}

describe("Project Drive explicit folder management", () => {
  it("uses only the caller's exact active current credential and reserves a UUID generation", async () => {
    const core = await fixture();
    try {
      const executed: Array<Record<string, unknown>> = [];
      const service = createProjectDriveFolderManagementService({
        database: core.db,
        execute: async (locator) => {
          executed.push(locator);
          return { outcome: "conflict" };
        },
        randomStorageGenerationId: () => STORAGE_GENERATION_ID,
        journalRuntimeDependencies: {
          randomOperationId: () => "operation-enable",
        },
      });
      const state = await service.enable(
        coreAuthorization("owner", "ws-a", true),
      );
      assert.deepEqual(state, {
        status: "unavailable",
        coverage: "not_applicable",
        pendingMemberCount: 0,
        memberGapCount: 0,
        folderUrl: null,
      } satisfies ProjectDriveFolderSetupState);
      assert.deepEqual(executed, [
        {
          workspaceId: "ws-a",
          operationId: "operation-enable",
          operationKind: "folder_provision",
        },
      ]);
      const [operation] = await core.db
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, "operation-enable"));
      assert.equal(operation.connectionId, "conn-new");
      assert.equal(operation.targetStorageGenerationId, STORAGE_GENERATION_ID);
      assert.equal(operation.status, "pending");
      assert.doesNotMatch(JSON.stringify(state), /conn-new|operation-enable|11111111/);
    } finally {
      core.cleanup();
    }
  });

  it("selects the managing caller's credential rather than the primary owner's", async () => {
    const core = await fixture();
    try {
      await core.db
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(
          and(
            eq(workspaceMembers.workspaceId, "ws-a"),
            eq(workspaceMembers.userId, "member-a"),
          ),
        );
      await core.db.insert(providerConnections).values({
        id: "conn-member-a",
        userId: "member-a",
        provider: "google_drive",
        providerAccountId: "account-member-a",
        providerAccountEmail: "member.a@example.com",
        rootFolderId: "root-member-a",
        refreshTokenCipher: tokenCipher("conn-member-a", "refresh-member-a"),
        keyVersion: 1,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
        status: "active",
        isCurrent: true,
        connectedAt: new Date("2026-09-03T10:00:00.000Z"),
      });
      const service = createProjectDriveFolderManagementService({
        database: core.db,
        execute: async () => ({ outcome: "conflict" }),
        randomStorageGenerationId: () => STORAGE_GENERATION_ID,
        journalRuntimeDependencies: {
          randomOperationId: () => "operation-member-enable",
        },
      });
      await service.enable(coreAuthorization("member-a", "ws-a", true));

      const [operation] = await core.db
        .select({ connectionId: projectDriveOperations.connectionId })
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, "operation-member-enable"));
      assert.equal(operation.connectionId, "conn-member-a");
    } finally {
      core.cleanup();
    }
  });

  it("treats existing current storage as idempotent and never replaces its history", async () => {
    const core = await fixture();
    try {
      await seedStorageGenerations(core.client);
      await core.db.insert(driveFolderGrants).values([
        {
          storageGenerationId: "gen-current",
          workspaceId: "ws-a",
          userId: "member-a",
          permissionId: "permission-a",
          grantedEmail: "member.a@example.com",
          role: "writer",
          grantedAt: new Date("2026-09-03T10:00:00.000Z"),
          revokePending: false,
        },
        {
          storageGenerationId: "gen-current",
          workspaceId: "ws-a",
          userId: "member-b",
          permissionId: "permission-b",
          grantedEmail: "member.b@example.com",
          role: "writer",
          grantedAt: new Date("2026-09-03T10:00:00.000Z"),
          revokePending: false,
        },
      ]);
      const service = createProjectDriveFolderManagementService({
        database: core.db,
        execute: async () => {
          assert.fail("existing storage must not execute provisioning");
        },
        randomStorageGenerationId: () => {
          assert.fail("existing storage must not reserve a replacement");
        },
      });
      const before = await core.db.select().from(workspaceStorage);
      const state = await service.enable(
        coreAuthorization("owner", "ws-a", true),
      );
      const after = await core.db.select().from(workspaceStorage);

      assert.deepEqual(state, {
        status: "active",
        coverage: "complete",
        pendingMemberCount: 0,
        memberGapCount: 0,
        folderUrl: "https://drive.example/folder-current",
      });
      assert.deepEqual(after, before);
      assert.equal(
        (
          await core.db
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.operationKind, "folder_provision"))
        ).length,
        0,
      );
    } finally {
      core.cleanup();
    }
  });

  it("never reports pending or missing member access as complete coverage", async () => {
    const core = await fixture();
    try {
      await seedStorageGenerations(core.client);
      const operationIds = ["grant-member-a", "grant-member-b"];
      await core.db.transaction(
        (transaction) =>
          prepareExistingMemberDriveGrantIntents(
            transaction,
            {
              workspaceId: "ws-a",
              storageGenerationId: "gen-current",
            },
            {
              randomOperationId: () =>
                operationIds.shift() ?? "unexpected-grant-operation",
            },
          ),
        { behavior: "immediate" },
      );
      const service = createProjectDriveFolderManagementService({
        database: core.db,
        execute: async () =>
          assert.fail("existing storage must not execute provisioning"),
      });

      const pending = await service.enable(
        coreAuthorization("owner", "ws-a", true),
      );
      assert.deepEqual(pending, {
        status: "setting_up",
        coverage: "pending",
        pendingMemberCount: 2,
        memberGapCount: 0,
        folderUrl: "https://drive.example/folder-current",
      });

      await core.client.execute(
        "UPDATE users SET email = NULL WHERE id = 'member-b'",
      );
      const incomplete = await service.enable(
        coreAuthorization("owner", "ws-a", true),
      );
      assert.deepEqual(incomplete, {
        status: "fallback",
        coverage: "incomplete",
        pendingMemberCount: 1,
        memberGapCount: 1,
        folderUrl: "https://drive.example/folder-current",
      });
    } finally {
      core.cleanup();
    }
  });

  it("refuses an archived Project and an account-fenced setup before execution", async (t) => {
    await t.test("archived", async () => {
      const core = await fixture();
      try {
        await core.db
          .update(workspaces)
          .set({ archivedAt: new Date("2026-09-03T10:00:00.000Z") })
          .where(eq(workspaces.id, "ws-a"));
        const service = createProjectDriveFolderManagementService({
          database: core.db,
          execute: async () => assert.fail("archived setup must not execute"),
        });
        const state = await service.enable(
          coreAuthorization("owner", "ws-a", true),
        );
        assert.equal(state.status, "archived");
        assert.equal((await core.db.select().from(projectDriveOperations)).length, 0);
      } finally {
        core.cleanup();
      }
    });

    await t.test("account fence", async () => {
      const core = await fixture();
      try {
        await core.db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey("owner"),
          value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
        });
        const service = createProjectDriveFolderManagementService({
          database: core.db,
          execute: async () => assert.fail("fenced setup must not execute"),
          randomStorageGenerationId: () => STORAGE_GENERATION_ID,
        });
        const state = await service.enable(
          coreAuthorization("owner", "ws-a", true),
        );
        assert.equal(state.status, "unavailable");
        assert.equal((await core.db.select().from(projectDriveOperations)).length, 0);
      } finally {
        core.cleanup();
      }
    });
  });
});
