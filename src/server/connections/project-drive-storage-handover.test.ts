import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  resources,
  users,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import {
  coreAuthorization,
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenCipher,
} from "./project-drive-core.test.helpers";
import { ProjectDriveAuthorizationError } from "./project-drive-authz";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { prepareExistingMemberDriveGrantIntents } from "./project-drive-membership-lifecycle";
import { createProjectDriveStorageHandoverService } from "./project-drive-storage-handover";

const TARGET_GENERATION_ID = "11111111-1111-4111-8111-111111111111";

async function handoverFixture(input?: { withTargetConnection?: boolean }) {
  const core = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(core.client);
  await seedStorageGenerations(core.client);
  await core.db
    .update(workspaceMembers)
    .set({ role: "owner" })
    .where(eq(workspaceMembers.userId, "member-a"));
  if (input?.withTargetConnection !== false) {
    await core.db.insert(providerConnections).values({
      id: "conn-member-a",
      userId: "member-a",
      provider: "google_drive",
      providerAccountId: "account-member-a",
      providerAccountEmail: "member.a@example.com",
      rootFolderId: "root-member-a",
      refreshTokenCipher: tokenCipher(
        "conn-member-a",
        "refresh-member-a",
      ),
      keyVersion: 1,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
      status: "active",
      isCurrent: true,
      connectedAt: new Date("2026-09-03T10:00:00.000Z"),
    });
  }
  return core;
}

type HandoverFixture = Awaited<ReturnType<typeof handoverFixture>>;

async function materializeTargetStorage(
  fixture: HandoverFixture,
  input: Readonly<{
    missingEmailUserId?: string;
    grantStatus?: "pending" | "retry_wait" | "manual_attention";
    withReceipts?: boolean;
  }> = {},
) {
  if (input.missingEmailUserId) {
    await fixture.db
      .update(users)
      .set({ email: null })
      .where(eq(users.id, input.missingEmailUserId));
  }
  await fixture.db.transaction(
    async (transaction) => {
      await transaction
        .update(workspaceStorage)
        .set({ isCurrent: false })
        .where(eq(workspaceStorage.id, "gen-current"));
      await transaction.insert(workspaceStorage).values({
        id: TARGET_GENERATION_ID,
        workspaceId: "ws-a",
        connectionId: "conn-member-a",
        folderId: "folder-handover",
        folderWebViewLink: "https://drive.example/folder-handover",
        state: "active",
        isCurrent: true,
      });
      const operationIds = ["grant-owner", "grant-member-b"];
      await prepareExistingMemberDriveGrantIntents(
        transaction,
        {
          workspaceId: "ws-a",
          storageGenerationId: TARGET_GENERATION_ID,
        },
        {
          randomOperationId: () =>
            operationIds.shift() ?? "unexpected-grant-operation",
        },
      );
    },
    { behavior: "immediate" },
  );

  if (input.grantStatus && input.grantStatus !== "pending") {
    const nextAttempt =
      input.grantStatus === "retry_wait" ? ", next_attempt_at = created_at" : "";
    await fixture.client.execute(`
      UPDATE project_drive_operations
      SET status = '${input.grantStatus}',
          attempt_count = 1,
          last_attempt_at = created_at,
          updated_at = created_at,
          last_error_code = '${
            input.grantStatus === "retry_wait"
              ? "network_error"
              : "cannot_invite_non_google_user"
          }'
          ${nextAttempt}
      WHERE id = 'grant-owner'
    `);
  }

  if (input.withReceipts) {
    await fixture.db.insert(driveFolderGrants).values([
      {
        storageGenerationId: TARGET_GENERATION_ID,
        workspaceId: "ws-a",
        userId: "owner",
        permissionId: "permission-owner",
        grantedEmail: "owner@example.com",
        role: "writer",
        grantedAt: new Date("2026-09-03T10:00:00.000Z"),
        revokePending: false,
      },
      {
        storageGenerationId: TARGET_GENERATION_ID,
        workspaceId: "ws-a",
        userId: "member-b",
        permissionId: "permission-member-b",
        grantedEmail: "member.b@example.com",
        role: "writer",
        grantedAt: new Date("2026-09-03T10:00:00.000Z"),
        revokePending: false,
      },
    ]);
  }
}

describe("Project Drive storage handover management", () => {
  it("commits one exact handover intent before dispatch and reuses it on retry", async () => {
    const fixture = await handoverFixture();
    try {
      const dispatched: string[] = [];
      let generated = 0;
      const service = createProjectDriveStorageHandoverService({
        database: fixture.db,
        randomStorageGenerationId: () => {
          generated += 1;
          return TARGET_GENERATION_ID;
        },
        journalRuntimeDependencies: {
          randomOperationId: () => "operation-handover",
        },
        execute: async (locator) => {
          const [stored] = await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.id, locator.operationId));
          assert.equal(stored?.status, "pending");
          assert.equal(stored?.connectionId, "conn-member-a");
          assert.equal(stored?.storageGenerationId, "gen-current");
          assert.equal(
            stored?.targetStorageGenerationId,
            TARGET_GENERATION_ID,
          );
          dispatched.push(locator.operationId);
          return { outcome: "conflict" };
        },
      });

      const first = await service.handover(
        coreAuthorization("owner", "ws-a", true),
        { targetOwnerUserId: "member-a" },
      );
      const second = await service.handover(
        coreAuthorization("owner", "ws-a", true),
        { targetOwnerUserId: "member-a" },
      );

      assert.equal(first.status, "setting_up");
      assert.equal(first.storageOwnerUserId, "owner");
      assert.equal(second.status, "setting_up");
      assert.deepEqual(dispatched, [
        "operation-handover",
        "operation-handover",
      ]);
      assert.equal(generated, 1);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(
              eq(
                projectDriveOperations.operationKind,
                "storage_handover",
              ),
            )
        ).length,
        1,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("is idempotent when the selected owner already owns current storage", async () => {
    const fixture = await handoverFixture();
    try {
      let dispatched = 0;
      const service = createProjectDriveStorageHandoverService({
        database: fixture.db,
        execute: async () => {
          dispatched += 1;
          return { outcome: "conflict" };
        },
      });
      const result = await service.handover(
        coreAuthorization("owner", "ws-a", true),
        { targetOwnerUserId: "owner" },
      );
      assert.equal(result.status, "already_owner");
      assert.equal(result.storageOwnerUserId, "owner");
      assert.equal(dispatched, 0);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(
              eq(
                projectDriveOperations.operationKind,
                "storage_handover",
              ),
            )
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("requires the target owner to have one current exact-scope connection", async () => {
    const fixture = await handoverFixture({ withTargetConnection: false });
    try {
      let dispatched = 0;
      const service = createProjectDriveStorageHandoverService({
        database: fixture.db,
        execute: async () => {
          dispatched += 1;
          return { outcome: "conflict" };
        },
      });
      const result = await service.handover(
        coreAuthorization("owner", "ws-a", true),
        { targetOwnerUserId: "member-a" },
      );
      assert.equal(result.status, "target_not_connected");
      assert.equal(result.storageOwnerUserId, "owner");
      assert.equal(dispatched, 0);
    } finally {
      fixture.cleanup();
    }
  });

  it("blocks handover while any delegated Drive upload is pending", async () => {
    const fixture = await handoverFixture();
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
      let dispatched = 0;
      const service = createProjectDriveStorageHandoverService({
        database: fixture.db,
        execute: async () => {
          dispatched += 1;
          return { outcome: "conflict" };
        },
      });

      const result = await service.handover(
        coreAuthorization("owner", "ws-a", true),
        { targetOwnerUserId: "member-a" },
      );
      assert.equal(result.status, "upload_in_progress");
      assert.equal(dispatched, 0);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(
              eq(
                projectDriveOperations.operationKind,
                "storage_handover",
              ),
            )
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("fails closed when either related account has entered erasure", async () => {
    const fixture = await handoverFixture();
    try {
      await fixture.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("member-a"),
        value: "fenced",
      });
      let dispatched = 0;
      const service = createProjectDriveStorageHandoverService({
        database: fixture.db,
        randomStorageGenerationId: () => TARGET_GENERATION_ID,
        execute: async () => {
          dispatched += 1;
          return { outcome: "conflict" };
        },
      });
      const result = await service.handover(
        coreAuthorization("owner", "ws-a", true),
        { targetOwnerUserId: "member-a" },
      );
      assert.equal(result.status, "unavailable");
      assert.equal(dispatched, 0);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(
              eq(
                projectDriveOperations.operationKind,
                "storage_handover",
              ),
            )
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("reports the shared folder-readiness truth after handover dispatch", async (t) => {
    const scenarios = [
      {
        name: "pending writer grants stay setting up",
        materialize: {},
        expectedStatus: "setting_up",
      },
      {
        name: "a manual writer-grant result needs attention",
        materialize: { grantStatus: "manual_attention" as const },
        expectedStatus: "needs_attention",
      },
      {
        name: "a member without an email needs attention",
        materialize: { missingEmailUserId: "member-b" },
        expectedStatus: "needs_attention",
      },
      {
        name: "a transient writer-grant failure stays setting up",
        materialize: { grantStatus: "retry_wait" as const },
        expectedStatus: "setting_up",
      },
      {
        name: "complete exact writer receipts become active",
        materialize: { withReceipts: true },
        expectedStatus: "active",
      },
    ] as const;

    for (const scenario of scenarios) {
      await t.test(scenario.name, async () => {
        const fixture = await handoverFixture();
        try {
          const service = createProjectDriveStorageHandoverService({
            database: fixture.db,
            randomStorageGenerationId: () => TARGET_GENERATION_ID,
            journalRuntimeDependencies: {
              randomOperationId: () => "operation-readiness",
            },
            execute: async (locator) => {
              assert.equal(locator.operationKind, "storage_handover");
              if (locator.operationKind === "storage_handover") {
                assert.equal(locator.actorUserId, "owner");
              }
              await materializeTargetStorage(fixture, scenario.materialize);
              return { outcome: "conflict" };
            },
          });
          const result = await service.handover(
            coreAuthorization("owner", "ws-a", true),
            { targetOwnerUserId: "member-a" },
          );

          assert.equal(result.status, scenario.expectedStatus);
          assert.equal(result.storageOwnerUserId, "member-a");
          assert.equal(
            result.folderUrl,
            "https://drive.example/folder-handover",
          );
        } finally {
          fixture.cleanup();
        }
      });
    }
  });

  it("rejects a context without fresh project-management authority", async () => {
    const fixture = await handoverFixture();
    try {
      const service = createProjectDriveStorageHandoverService({
        database: fixture.db,
        execute: async () => ({ outcome: "conflict" }),
      });
      await assert.rejects(
        service.handover(coreAuthorization("member-a", "ws-a", false), {
          targetOwnerUserId: "owner",
        }),
        ProjectDriveAuthorizationError,
      );
    } finally {
      fixture.cleanup();
    }
  });
});
