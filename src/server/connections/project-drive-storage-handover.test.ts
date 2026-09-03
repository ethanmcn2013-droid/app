import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  meta,
  projectDriveOperations,
  providerConnections,
  resources,
  workspaceMembers,
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
