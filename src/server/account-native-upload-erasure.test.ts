import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, like, sql } from "drizzle-orm";
import { claimPathname } from "@/lib/attachment-claim";
import { eraseAccountData } from "@/server/account-erasure";
import {
  createNativeByteCleanupService,
  NATIVE_BYTE_CLEANUP_META_PREFIX,
} from "@/server/attachments/native-byte-cleanup";
import {
  NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS,
  nativeUploadClaimKey,
  recordNativeUploadClaimInTransaction,
} from "@/server/attachments/native-upload-custody";
import { googleDriveAccountErasureFenceKey } from "@/server/connections/project-drive-operation-lifecycle";
import { freshFileDb } from "@/server/db/memory-test-db";
import {
  attachments,
  meta,
  users,
  workspaces,
} from "@/server/db/schema";

type Fixture = Awaited<ReturnType<typeof freshFileDb>>;

async function accountNativeFixture(): Promise<Fixture> {
  const fixture = await freshFileDb();
  await fixture.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, email, color, initials) VALUES
      ('target', 'clerk-target', 'target@example.test', '#111', 'TA'),
      ('other-owner', 'clerk-other-owner', 'owner@example.test', '#222', 'OO'),
      ('bystander', 'clerk-bystander', 'bystander@example.test', '#333', 'BY');
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-owned', 'ws-owned', 'Owned', 'target'),
      ('ws-surviving', 'ws-surviving', 'Surviving', 'other-owner');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-owned', 'target', 'owner'),
      ('ws-owned', 'bystander', 'member'),
      ('ws-surviving', 'other-owner', 'owner'),
      ('ws-surviving', 'target', 'member'),
      ('ws-surviving', 'bystander', 'member');
    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('task-owned', 'ws-owned', 'Owned task', 'todo', 'med'),
      ('task-surviving', 'ws-surviving', 'Surviving task', 'todo', 'med');
  `);
  return fixture;
}

function scopeInput(scope: "owned" | "surviving") {
  return scope === "owned"
    ? {
        workspaceId: "ws-owned",
        taskId: "task-owned",
        uploaderUserId: "bystander",
      }
    : {
        workspaceId: "ws-surviving",
        taskId: "task-surviving",
        uploaderUserId: "target",
      };
}

async function insertPlaceholder(
  fixture: Fixture,
  input: Readonly<{
    workspaceId: string;
    taskId: string;
    uploaderUserId: string;
    attachmentId: string;
    filename?: string;
  }>,
) {
  const filename = input.filename ?? `${input.attachmentId}.pdf`;
  const pathname = claimPathname(
    input.workspaceId,
    input.taskId,
    input.attachmentId,
    filename,
  );
  await fixture.db.insert(attachments).values({
    id: input.attachmentId,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    uploaderUserId: input.uploaderUserId,
    filename,
    storedPath: pathname,
    mimeType: "application/pdf",
    sizeBytes: 12,
  });
  return pathname;
}

async function insertClaim(
  fixture: Fixture,
  input: Readonly<{
    workspaceId: string;
    taskId: string;
    uploaderUserId: string;
    attachmentId: string;
    live: boolean;
    cleanupTargetKind?: "blob-pathname" | "disk-key";
  }>,
) {
  const filename = `${input.attachmentId}.pdf`;
  const pathname = claimPathname(
    input.workspaceId,
    input.taskId,
    input.attachmentId,
    filename,
  );
  const authorityExpiresAt = input.live
    ? Date.now() + 10 * 60_000
    : Date.now() - NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS - 60_000;
  await fixture.db.transaction(
    async (transaction) => {
      await transaction.insert(attachments).values({
        id: input.attachmentId,
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        uploaderUserId: input.uploaderUserId,
        filename,
        storedPath: pathname,
        mimeType: "application/pdf",
        sizeBytes: 12,
      });
      await recordNativeUploadClaimInTransaction(transaction, {
        workspaceId: input.workspaceId,
        attachmentId: input.attachmentId,
        pathname,
        authorityExpiresAt,
        cleanupTargetKind: input.cleanupTargetKind ?? "blob-pathname",
      });
    },
    { behavior: "immediate" },
  );
  return pathname;
}

async function insertFinalizedAttachment(
  fixture: Fixture,
  input: Readonly<{
    workspaceId: string;
    taskId: string;
    uploaderUserId: string;
    attachmentId: string;
    storedPath: string;
  }>,
) {
  await fixture.db.insert(attachments).values({
    id: input.attachmentId,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    uploaderUserId: input.uploaderUserId,
    filename: `${input.attachmentId}.pdf`,
    storedPath: input.storedPath,
    mimeType: "application/pdf",
    sizeBytes: 12,
  });
}

async function countMeta(fixture: Fixture, prefix: string): Promise<number> {
  return (
    await fixture.db
      .select({ key: meta.key })
      .from(meta)
      .where(like(meta.key, `${prefix}%`))
  ).length;
}

for (const scope of ["owned", "surviving"] as const) {
  for (const claimState of ["live", "malformed", "legacy"] as const) {
    test(`${claimState} Signal-native authority blocks ${scope} account erasure with exact evidence intact`, async () => {
      const fixture = await accountNativeFixture();
      const input = {
        ...scopeInput(scope),
        attachmentId: `attachment-${scope}-${claimState}`,
      };
      try {
        const pathname = await insertPlaceholder(fixture, input);
        if (claimState === "live") {
          await fixture.db.transaction(
            async (transaction) => {
              await recordNativeUploadClaimInTransaction(transaction, {
                workspaceId: input.workspaceId,
                attachmentId: input.attachmentId,
                pathname,
                authorityExpiresAt: Date.now() + 10 * 60_000,
                cleanupTargetKind: "blob-pathname",
              });
            },
            { behavior: "immediate" },
          );
        } else if (claimState === "malformed") {
          await fixture.db.insert(meta).values({
            key: nativeUploadClaimKey(
              input.workspaceId,
              input.attachmentId,
            ),
            value: "{not-a-valid-claim",
          });
        }

        await assert.rejects(
          eraseAccountData(fixture.db, "clerk-target"),
          claimState === "malformed"
            ? /invalid native upload claim receipt/
            : /Signal-native attachment upload is still in progress/,
        );
        assert.equal(
          (
            await fixture.db
              .select({ id: attachments.id })
              .from(attachments)
              .where(eq(attachments.id, input.attachmentId))
          ).length,
          1,
        );
        assert.equal(
          (
            await fixture.db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, "target"))
          ).length,
          1,
        );
        assert.equal(
          (
            await fixture.db
              .select({ key: meta.key })
              .from(meta)
              .where(
                eq(
                  meta.key,
                  googleDriveAccountErasureFenceKey("target"),
                ),
              )
          ).length,
          1,
          "the account fence must retain custody for a retry",
        );
        assert.equal(
          await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
          0,
          "a blocked transaction must not leak cleanup authority",
        );
      } finally {
        fixture.cleanup();
      }
    });
  }
}

test("a later live claim rolls back earlier expired-claim handoff across the full account scope", async () => {
  const fixture = await accountNativeFixture();
  try {
    await insertClaim(fixture, {
      ...scopeInput("owned"),
      attachmentId: "attachment-owned-expired-before-block",
      live: false,
    });
    await insertClaim(fixture, {
      ...scopeInput("surviving"),
      attachmentId: "attachment-surviving-live-blocker",
      live: true,
    });

    await assert.rejects(
      eraseAccountData(fixture.db, "clerk-target"),
      /Signal-native attachment upload is still in progress/,
    );
    for (const attachmentId of [
      "attachment-owned-expired-before-block",
      "attachment-surviving-live-blocker",
    ]) {
      assert.equal(
        (
          await fixture.db
            .select({ id: attachments.id })
            .from(attachments)
            .where(eq(attachments.id, attachmentId))
        ).length,
        1,
      );
    }
    assert.equal(
      (
        await fixture.db
          .select({ key: meta.key })
          .from(meta)
          .where(
            eq(
              meta.key,
              nativeUploadClaimKey(
                "ws-owned",
                "attachment-owned-expired-before-block",
              ),
            ),
          )
      ).length,
      1,
      "expired evidence must roll back when any in-scope writer is still live",
    );
    assert.equal(
      await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
      0,
    );
  } finally {
    fixture.cleanup();
  }
});

test("expired target claims transfer exact custody while an unrelated live bystander claim survives", async () => {
  const fixture = await accountNativeFixture();
  try {
    const ownedPathname = await insertClaim(fixture, {
      ...scopeInput("owned"),
      attachmentId: "attachment-owned-expired",
      live: false,
      cleanupTargetKind: "disk-key",
    });
    const survivingPathname = await insertClaim(fixture, {
      ...scopeInput("surviving"),
      attachmentId: "attachment-surviving-expired",
      live: false,
    });
    const bystanderPathname = await insertClaim(fixture, {
      workspaceId: "ws-surviving",
      taskId: "task-surviving",
      uploaderUserId: "bystander",
      attachmentId: "attachment-bystander-live",
      live: true,
    });
    const deletedLocators: string[] = [];

    await eraseAccountData(fixture.db, "clerk-target", {
      deleteStoredBytes: async (locator) => {
        deletedLocators.push(locator);
      },
    });

    assert.deepEqual(deletedLocators.sort(), [
      ownedPathname,
      survivingPathname,
    ].sort());
    assert.equal(
      (
        await fixture.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, "target"))
      ).length,
      0,
    );
    assert.equal(
      (
        await fixture.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, "ws-surviving"))
      ).length,
      1,
    );
    assert.equal(
      (
        await fixture.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, "attachment-bystander-live"))
      ).length,
      1,
    );
    assert.equal(
      (
        await fixture.db
          .select({ key: meta.key })
          .from(meta)
          .where(
            eq(
              meta.key,
              nativeUploadClaimKey(
                "ws-surviving",
                "attachment-bystander-live",
              ),
            ),
          )
      ).length,
      1,
    );
    assert.ok(!deletedLocators.includes(bystanderPathname));
    assert.equal(
      await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
      0,
    );
  } finally {
    fixture.cleanup();
  }
});

test("a later owned-Project failure retains its already-committed finalized-byte custody", async () => {
  const fixture = await accountNativeFixture();
  try {
    await insertFinalizedAttachment(fixture, {
      ...scopeInput("owned"),
      attachmentId: "attachment-owned-finalized",
      storedPath: ".data/uploads/account-owned-finalized.pdf",
    });
    await fixture.client.execute(`
      CREATE TRIGGER refuse_owned_account_project_delete
      BEFORE DELETE ON workspaces
      WHEN OLD.id = 'ws-owned'
      BEGIN
        SELECT RAISE(ABORT, 'simulated account Project rollback');
      END
    `);
    let storageCalls = 0;
    await assert.rejects(
      eraseAccountData(fixture.db, "clerk-target", {
        deleteStoredBytes: async () => {
          storageCalls += 1;
        },
      }),
    );
    assert.equal(storageCalls, 0);
    assert.equal(
      (
        await fixture.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, "attachment-owned-finalized"))
      ).length,
      0,
      "the exact row and its receipt commit before later provider/Project work",
    );
    assert.equal(
      (
        await fixture.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, "ws-owned"))
      ).length,
      1,
    );
    assert.equal(
      await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
      1,
    );
  } finally {
    fixture.cleanup();
  }
});

test("provider-time bystander deletion cannot orphan a finalized target attachment", async () => {
  const fixture = await accountNativeFixture();
  const storedPath = ".data/uploads/account-provider-race.pdf";
  try {
    await insertFinalizedAttachment(fixture, {
      ...scopeInput("surviving"),
      attachmentId: "attachment-provider-race",
      storedPath,
    });
    await fixture.client.executeMultiple(`
      INSERT INTO provider_connections (
        id, user_id, provider, provider_account_id,
        provider_account_email, root_folder_id, refresh_token_cipher,
        key_version, scopes, status, is_current, connected_at
      ) VALUES (
        'connection-provider-race', 'target', 'google_drive',
        'permission-provider-race', 'target@example.test',
        'root-provider-race', 'cipher-provider-race', 1,
        '["https://www.googleapis.com/auth/drive.file"]',
        'active', 1, 1756800000
      );
    `);

    let providerCallbackReached = 0;
    let bystanderRowsDeleted = -1;
    let failedByteDeletes = 0;
    await eraseAccountData(fixture.db, "clerk-target", {
      openProviderToken: ({ refreshTokenCipher }) => {
        assert.equal(refreshTokenCipher, "cipher-provider-race");
        return "refresh-provider-race";
      },
      revokeProjectDriveRefreshToken: async (refreshToken) => {
        providerCallbackReached += 1;
        assert.equal(refreshToken, "refresh-provider-race");
        const deleted = await fixture.db
          .delete(attachments)
          .where(eq(attachments.id, "attachment-provider-race"))
          .returning({ id: attachments.id });
        bystanderRowsDeleted = deleted.length;
      },
      deleteStoredBytes: async (locator) => {
        failedByteDeletes += 1;
        assert.equal(locator, storedPath);
        throw new Error("cleanup storage unavailable");
      },
    });

    assert.equal(providerCallbackReached, 1);
    assert.equal(
      bystanderRowsDeleted,
      0,
      "account custody must own the row before provider I/O begins",
    );
    assert.equal(failedByteDeletes, 1);
    const receipts = await fixture.db
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
    assert.equal(receipts.length, 1);
    const receipt = JSON.parse(receipts[0]!.value) as {
      workspaceId: string;
      target: { kind: string; locator: string };
    };
    assert.equal(receipt.workspaceId, "ws-surviving");
    assert.deepEqual(receipt.target, {
      kind: "stored-path",
      locator: storedPath,
    });
    assert.ok(!receipts[0]!.key.includes(storedPath));
  } finally {
    fixture.cleanup();
  }
});

test("a detached pre-tenant attachment keeps exact cleanup custody without blocking erasure", async () => {
  const fixture = await accountNativeFixture();
  const storedPath = ".data/uploads/detached-pre-tenant.pdf";
  try {
    await fixture.db.insert(attachments).values({
      id: "attachment-detached-pre-tenant",
      workspaceId: null,
      taskId: "missing-pre-tenant-task",
      uploaderUserId: "target",
      filename: "detached-pre-tenant.pdf",
      storedPath,
      mimeType: "application/pdf",
      sizeBytes: 12,
    });

    let storageCalls = 0;
    await eraseAccountData(fixture.db, "clerk-target", {
      deleteStoredBytes: async (locator) => {
        storageCalls += 1;
        assert.equal(locator, storedPath);
        throw new Error("storage unavailable");
      },
    });

    assert.equal(storageCalls, 1);
    assert.equal(
      (
        await fixture.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, "attachment-detached-pre-tenant"))
      ).length,
      0,
    );
    assert.equal(
      (
        await fixture.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, "target"))
      ).length,
      0,
    );
    const [receipt] = await fixture.db
      .select({ value: meta.value })
      .from(meta)
      .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
    assert.ok(receipt);
    assert.deepEqual(JSON.parse(receipt.value), {
      version: 1,
      owner: "signal-native-attachment",
      workspaceId: "account-erasure:target",
      target: { kind: "stored-path", locator: storedPath },
      claimToken: null,
    });
  } finally {
    fixture.cleanup();
  }
});

test("storage failure retains the exact account receipt through crash-safe replay", async () => {
  const fixture = await accountNativeFixture();
  const storedPath = ".data/uploads/account-surviving-finalized.pdf";
  try {
    await insertFinalizedAttachment(fixture, {
      ...scopeInput("surviving"),
      attachmentId: "attachment-surviving-finalized",
      storedPath,
    });
    let firstAttempts = 0;
    await eraseAccountData(fixture.db, "clerk-target", {
      deleteStoredBytes: async (locator) => {
        firstAttempts += 1;
        assert.equal(locator, storedPath);
        throw new Error("storage unavailable");
      },
    });
    assert.equal(firstAttempts, 1);
    assert.equal(
      (
        await fixture.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, "attachment-surviving-finalized"))
      ).length,
      0,
    );
    assert.equal(
      await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
      1,
    );

    const replayedLocators: string[] = [];
    const crashedWorker = createNativeByteCleanupService({
      database: fixture.db,
      databaseNowSeconds: () => sql<Date>`32503680000`,
      randomLeaseId: () => "account-cleanup-crash",
      deleteTarget: async (target) => {
        replayedLocators.push(target.locator);
      },
      afterDelete: async () => {
        throw new Error("simulated cleanup worker crash");
      },
    });
    await assert.rejects(
      crashedWorker.repairReady(),
      /simulated cleanup worker crash/,
    );
    assert.equal(
      await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
      1,
    );

    const replay = await createNativeByteCleanupService({
      database: fixture.db,
      databaseNowSeconds: () => sql<Date>`32503680100`,
      randomLeaseId: () => "account-cleanup-replay",
      deleteTarget: async (target) => {
        replayedLocators.push(target.locator);
      },
    }).repairReady();
    assert.equal(replay.cleaned, 1);
    assert.deepEqual(replayedLocators, [storedPath, storedPath]);
    assert.equal(
      await countMeta(fixture, NATIVE_BYTE_CLEANUP_META_PREFIX),
      0,
    );
  } finally {
    fixture.cleanup();
  }
});
