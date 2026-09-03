import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import { createProjectDriveGrantRepairService } from "./project-drive-grant-repair";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

async function fixture() {
  const result = await freshProjectDriveCoreDb();
  cleanups.push(result.cleanup);
  await seedProjectDriveCore(result.client);
  await seedStorageGenerations(result.client);
  await result.db.insert(driveFolderGrants).values([
    {
      storageGenerationId: "gen-current",
      workspaceId: "ws-a",
      userId: "member-a",
      permissionId: "permission-a",
      grantedEmail: "member.a@example.com",
      role: "writer",
      grantedAt: new Date("2026-09-01T10:00:00.000Z"),
      revokePending: true,
    },
    {
      storageGenerationId: "gen-old",
      workspaceId: "ws-a",
      userId: "member-b",
      permissionId: "permission-b",
      grantedEmail: "member.b@example.com",
      role: "writer",
      grantedAt: new Date("2026-09-01T11:00:00.000Z"),
      revokePending: false,
    },
  ]);
  return result;
}

function trackedTransactions(
  database: LibSQLDatabase<typeof schema>,
  onDepth: (depth: number) => void,
): LibSQLDatabase<typeof schema> {
  let depth = 0;
  return new Proxy(database, {
    get(target, property) {
      if (property === "transaction") {
        return async (
          callback: (transaction: LibSQLDatabase<typeof schema>) => Promise<unknown>,
          config: unknown,
        ) =>
          target.transaction(
            async (transaction) => {
              depth += 1;
              onDepth(depth);
              try {
                return await callback(
                  transaction as unknown as LibSQLDatabase<typeof schema>,
                );
              } finally {
                depth -= 1;
                onDepth(depth);
              }
            },
            config as never,
          );
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("Project Drive grant repair", () => {
  it("leaves deletion-owned revoke receipts for the deletion lifecycle", async () => {
    const setup = await fixture();
    await setup.db.insert(projectDriveOperations).values({
      id: "project-delete-running",
      workspaceId: "ws-a",
      operationKind: "project_delete",
      status: "running",
      dedupeKey: "d".repeat(64),
      attemptCount: 1,
      lastAttemptAt: new Date("2026-09-01T12:00:00.000Z"),
      leaseExpiresAt: new Date("2026-09-01T12:05:00.000Z"),
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      updatedAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    let calls = 0;
    const service = createProjectDriveGrantRepairService({
      database: setup.db,
      revokeExactGrant: async () => {
        calls += 1;
      },
    });

    assert.deepEqual(await service.repairPending(), {
      scanned: 1,
      attempted: 0,
      repaired: 0,
      skipped: 1,
      failed: 0,
    });
    assert.equal(calls, 0);
    const [receipt] = await setup.db
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.userId, "member-a"));
    assert.equal(receipt.permissionId, "permission-a");
    assert.equal(receipt.revokePending, true);
  });

  it("revokes the exact pending receipt outside writer transactions, then removes it", async () => {
    const setup = await fixture();
    let writerDepth = 0;
    const receipts: unknown[] = [];
    const service = createProjectDriveGrantRepairService({
      database: trackedTransactions(setup.db, (depth) => {
        writerDepth = depth;
      }),
      revokeExactGrant: async (receipt) => {
        assert.equal(writerDepth, 0);
        receipts.push(receipt);
      },
    });

    const result = await service.repairPending();

    assert.deepEqual(result, {
      scanned: 1,
      attempted: 1,
      repaired: 1,
      skipped: 0,
      failed: 0,
    });
    assert.deepEqual(receipts, [
      {
        storageGenerationId: "gen-current",
        workspaceId: "ws-a",
        connectionId: "conn-old",
        folderId: "folder-current",
        userId: "member-a",
        permissionId: "permission-a",
        grantedEmail: "member.a@example.com",
        role: "writer",
        grantedAt: new Date("2026-09-01T10:00:00.000Z"),
        storageOwnerUserId: "owner",
      },
    ]);
    const rows = await setup.db.select().from(driveFolderGrants);
    assert.deepEqual(
      rows.map((row) => [row.userId, row.revokePending]),
      [["member-b", false]],
    );
  });

  it("keeps exact retry evidence when the provider call fails", async () => {
    const setup = await fixture();
    const service = createProjectDriveGrantRepairService({
      database: setup.db,
      revokeExactGrant: async () => {
        throw new Error("provider body must not escape");
      },
    });

    assert.deepEqual(await service.repairPending(), {
      scanned: 1,
      attempted: 1,
      repaired: 0,
      skipped: 0,
      failed: 1,
    });
    const [row] = await setup.db
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.userId, "member-a"));
    assert.equal(row.permissionId, "permission-a");
    assert.equal(row.revokePending, true);
  });

  for (const fencedUserId of ["member-a", "owner"] as const) {
    it(`yields to an active ${fencedUserId} account-erasure fence`, async () => {
      const setup = await fixture();
      await setup.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey(fencedUserId),
        value: "active:v1",
      });
      let calls = 0;
      const service = createProjectDriveGrantRepairService({
        database: setup.db,
        revokeExactGrant: async () => {
          calls += 1;
        },
      });

      assert.deepEqual(await service.repairPending(), {
        scanned: 1,
        attempted: 0,
        repaired: 0,
        skipped: 1,
        failed: 0,
      });
      assert.equal(calls, 0);
    });
  }

  it("retains evidence when an erasure fence wins after provider success", async () => {
    const setup = await fixture();
    const service = createProjectDriveGrantRepairService({
      database: setup.db,
      revokeExactGrant: async () => {
        await setup.db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey("member-a"),
          value: "active:v1",
        });
      },
    });

    assert.deepEqual(await service.repairPending(), {
      scanned: 1,
      attempted: 1,
      repaired: 0,
      skipped: 1,
      failed: 0,
    });
    const [row] = await setup.db
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.userId, "member-a"));
    assert.equal(row.permissionId, "permission-a");
    assert.equal(row.revokePending, true);
  });

  it("does not delete a replacement receipt that races provider completion", async () => {
    const setup = await fixture();
    const service = createProjectDriveGrantRepairService({
      database: setup.db,
      revokeExactGrant: async () => {
        await setup.db
          .update(driveFolderGrants)
          .set({ permissionId: "permission-replacement" })
          .where(
            and(
              eq(driveFolderGrants.storageGenerationId, "gen-current"),
              eq(driveFolderGrants.userId, "member-a"),
            ),
          );
      },
    });

    assert.deepEqual(await service.repairPending(), {
      scanned: 1,
      attempted: 1,
      repaired: 0,
      skipped: 1,
      failed: 0,
    });
    const [row] = await setup.db
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.userId, "member-a"));
    assert.equal(row.permissionId, "permission-replacement");
    assert.equal(row.revokePending, true);
  });

  it("bounds every batch explicitly", async () => {
    const setup = await fixture();
    const service = createProjectDriveGrantRepairService({
      database: setup.db,
      revokeExactGrant: async () => {},
    });
    for (const limit of [0, 1.5, 51, Number.NaN]) {
      await assert.rejects(() => service.repairPending({ limit }), RangeError);
    }
  });
});
