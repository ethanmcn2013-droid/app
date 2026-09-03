import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { and, eq, like } from "drizzle-orm";
import { claimPathname } from "@/lib/attachment-claim";
import {
  attachments,
  meta,
  resources,
  workspaceMembers,
} from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "@/server/connections/project-drive-core.test.helpers";
import {
  createNativeByteCleanupService,
  NATIVE_BYTE_CLEANUP_META_PREFIX,
} from "./native-byte-cleanup";
import { retainRejectedNativeUploadCleanupCustody } from "./native-upload-cleanup";
import {
  assertNoPendingNativeUploads,
  deleteNativeAttachmentAndMirrorInTransaction,
  deleteNativeAttachmentRowsInTransaction,
  finalizeNativeUploadClaimInTransaction,
  NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS,
  nativeUploadClaimKey,
  NativeUploadClaimStartError,
  NativeUploadInProgressError,
  recordNativeUploadClaimInTransaction,
  releaseExpiredNativeUploadClaimInTransaction,
  releaseNativeUploadClaimInTransaction,
} from "./native-upload-custody";
import { googleDriveAccountErasureFenceKey } from "@/server/connections/project-drive-operation-lifecycle";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-lifecycle";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  cleanups.push(core.cleanup);
  await seedProjectDriveCore(core.client);
  await seedStorageGenerations(core.client);
  await core.client.execute(`
    INSERT INTO tasks (
      id, workspace_id, title, lane, priority, assignees, created_at, updated_at
    ) VALUES ('task-a', 'ws-a', 'Files', 'todo', 'medium', '[]', 10, 10)
  `);
  return core;
}

async function insertClaim(
  setup: Awaited<ReturnType<typeof fixture>>,
  input: Readonly<{
    attachmentId?: string;
    authorityExpiresAt?: number;
    cleanupTargetKind?: "blob-pathname" | "disk-key";
    uploaderUserId?: string;
    withMarker?: boolean;
  }> = {},
) {
  const attachmentId = input.attachmentId ?? "att-native";
  const filename = "deck.pdf";
  const pathname = claimPathname("ws-a", "task-a", attachmentId, filename);
  await setup.db.transaction(
    async (transaction) => {
      await transaction.insert(attachments).values({
        id: attachmentId,
        workspaceId: "ws-a",
        taskId: "task-a",
        uploaderUserId: input.uploaderUserId ?? "owner",
        filename,
        storedPath: pathname,
        mimeType: "application/pdf",
        sizeBytes: 12,
        createdAt: new Date(10_000),
      });
      if (input.withMarker !== false) {
        await recordNativeUploadClaimInTransaction(transaction, {
          workspaceId: "ws-a",
          attachmentId,
          pathname,
          authorityExpiresAt:
            input.authorityExpiresAt ?? Date.now() + 30 * 60_000,
          cleanupTargetKind: input.cleanupTargetKind ?? "blob-pathname",
        });
      }
    },
    { behavior: "immediate" },
  );
  return { attachmentId, filename, pathname };
}

describe("Signal-native upload custody", () => {
  for (const mirror of ["signal", "drive", "link"] as const) {
    it(`deletes only an exact ${mirror} attachment mirror`, async () => {
      const setup = await fixture();
      const attachmentId = `att-mirror-${mirror}`;
      const resourceId = `res-${attachmentId}`;
      await setup.db.insert(attachments).values({
        id: attachmentId,
        workspaceId: "ws-a",
        taskId: "task-a",
        uploaderUserId: "owner",
        filename: `${mirror}.pdf`,
        storedPath: `.data/uploads/${mirror}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 12,
      });
      await setup.db.insert(resources).values({
        id: resourceId,
        workspaceId: "ws-a",
        taskId: "task-a",
        kind: mirror === "link" ? "link" : "upload",
        provider: mirror === "link" ? "url" : "file",
        storage: mirror === "drive" ? "drive" : "signal",
        storageGenerationId: mirror === "drive" ? "gen-current" : null,
        storedPath:
          mirror === "drive"
            ? "provider-file-id"
            : mirror === "link"
              ? null
              : `.data/uploads/${mirror}.pdf`,
        title: `${mirror} resource`,
        url: mirror === "link" ? "https://example.test" : null,
        addedByUserId: "owner",
        addedAt: 10,
        accessState: "ok",
        countsAgainstStorage: mirror === "signal" ? 1 : 0,
      });

      const deletion = await setup.db.transaction(
        (transaction) =>
          deleteNativeAttachmentAndMirrorInTransaction(transaction, {
            workspaceId: "ws-a",
            attachmentId,
          }),
        { behavior: "immediate" },
      );
      assert.deepEqual(deletion.deletedAttachmentIds, [attachmentId]);
      assert.equal(
        (
          await setup.db
            .select({ id: resources.id })
            .from(resources)
            .where(eq(resources.id, resourceId))
        ).length,
        mirror === "signal" ? 0 : 1,
      );
    });
  }

  it("refuses to clean a finalized locator retained by another row", async () => {
    const setup = await fixture();
    const storedPath = ".data/uploads/aliased-finalized.pdf";
    await setup.client.executeMultiple(`
      INSERT INTO tasks (
        id, workspace_id, title, lane, priority, assignees, created_at, updated_at
      ) VALUES ('task-b', 'ws-b', 'Other files', 'todo', 'medium', '[]', 10, 10);
      INSERT INTO attachments (
        id, workspace_id, task_id, uploader_user_id, filename, stored_path,
        mime_type, size_bytes
      ) VALUES
        ('att-alias-target', 'ws-a', 'task-a', 'owner', 'target.pdf',
         '${storedPath}', 'application/pdf', 12),
        ('att-alias-retained', 'ws-b', 'task-b', 'outsider', 'retained.pdf',
         '${storedPath}', 'application/pdf', 12);
    `);
    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) =>
            deleteNativeAttachmentRowsInTransaction(transaction, {
              workspaceId: "ws-a",
              attachmentIds: ["att-alias-target"],
            }),
          { behavior: "immediate" },
        ),
      /locator alias conflicted/,
    );
    assert.equal(
      (
        await setup.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(like(attachments.id, "att-alias-%"))
      ).length,
      2,
    );
    assert.equal(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`))
      ).length,
      0,
    );
  });

  it("retains an expired writer when another row aliases its exact target", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup, {
      attachmentId: "att-expired-alias",
      authorityExpiresAt:
        Date.now() - NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS - 60_000,
      cleanupTargetKind: "disk-key",
    });
    await setup.client.executeMultiple(`
      INSERT INTO tasks (
        id, workspace_id, title, lane, priority, assignees, created_at, updated_at
      ) VALUES ('task-b', 'ws-b', 'Other files', 'todo', 'medium', '[]', 10, 10);
      INSERT INTO attachments (
        id, workspace_id, task_id, uploader_user_id, filename, stored_path,
        mime_type, size_bytes
      ) VALUES (
        'att-expired-alias-retained', 'ws-b', 'task-b', 'outsider',
        'retained.pdf', '${claim.pathname}', 'application/pdf', 12
      );
    `);
    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) =>
            deleteNativeAttachmentRowsInTransaction(transaction, {
              workspaceId: "ws-a",
              attachmentIds: [claim.attachmentId],
            }),
          { behavior: "immediate" },
        ),
      /locator alias conflicted/,
    );
    assert.equal(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(
            eq(
              meta.key,
              nativeUploadClaimKey("ws-a", claim.attachmentId),
            ),
          )
      ).length,
      1,
    );
    assert.equal(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`))
      ).length,
      0,
    );
  });

  it("atomically gives a finalized ordinary deletion exact replay custody", async () => {
    const setup = await fixture();
    const storedPath = ".data/uploads/ordinary-delete-finalized.pdf";
    await setup.db.insert(attachments).values({
      id: "att-ordinary-finalized",
      workspaceId: "ws-a",
      taskId: "task-a",
      uploaderUserId: "owner",
      filename: "ordinary-delete-finalized.pdf",
      storedPath,
      mimeType: "application/pdf",
      sizeBytes: 12,
    });

    const deletion = await setup.db.transaction(
      (transaction) =>
        deleteNativeAttachmentRowsInTransaction(transaction, {
          workspaceId: "ws-a",
          attachmentIds: ["att-ordinary-finalized"],
        }),
      { behavior: "immediate" },
    );
    assert.deepEqual(deletion.deletedAttachmentIds, [
      "att-ordinary-finalized",
    ]);
    assert.equal(deletion.cleanupReceiptKeys.length, 1);
    assert.equal(
      (
        await setup.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, "att-ordinary-finalized"))
      ).length,
      0,
    );

    const failed = await createNativeByteCleanupService({
      database: setup.db,
      deleteTarget: async (target) => {
        assert.deepEqual(target, { kind: "stored-path", locator: storedPath });
        throw new Error("storage unavailable");
      },
    }).repairReady({ keys: deletion.cleanupReceiptKeys });
    assert.equal(failed.failed, 1);
    assert.equal(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`))
      ).length,
      1,
      "storage failure must retain the exact replay receipt",
    );
  });

  it("refuses an ordinary row deletion while exact writer authority is live", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup, {
      attachmentId: "att-ordinary-live",
    });
    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) =>
            deleteNativeAttachmentRowsInTransaction(transaction, {
              workspaceId: "ws-a",
              attachmentIds: [claim.attachmentId],
            }),
          { behavior: "immediate" },
        ),
      (error: unknown) => error instanceof NativeUploadInProgressError,
    );
    assert.equal(
      (
        await setup.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, claim.attachmentId))
      ).length,
      1,
    );
    assert.equal(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(eq(meta.key, nativeUploadClaimKey("ws-a", claim.attachmentId)))
      ).length,
      1,
    );
  });

  it("blocks deletion while exact write authority is live", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup);
    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) =>
            assertNoPendingNativeUploads(transaction, "ws-a"),
          { behavior: "immediate" },
        ),
      (error: unknown) => error instanceof NativeUploadInProgressError,
    );
    const [marker] = await setup.db
      .select({ key: meta.key })
      .from(meta)
      .where(eq(meta.key, nativeUploadClaimKey("ws-a", claim.attachmentId)));
    assert.ok(marker);
  });

  it("turns expired authority into exact storage-key cleanup custody", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup, { authorityExpiresAt: 1 });
    await setup.db.transaction(
      (transaction) => assertNoPendingNativeUploads(transaction, "ws-a"),
      { behavior: "immediate" },
    );

    assert.equal(
      (
        await setup.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, claim.attachmentId))
      ).length,
      0,
    );
    const receipts = await setup.db
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
    assert.equal(receipts.length, 1);
    assert.deepEqual(JSON.parse(receipts[0].value).target, {
      kind: "blob-pathname",
      locator: claim.pathname,
    });
  });

  it("blocks through the in-flight drain margin and releases only after it", async () => {
    const inside = await fixture();
    const insideMargin = await insertClaim(inside, {
      attachmentId: "att-inside-drain-margin",
      authorityExpiresAt:
        Date.now() - NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS + 60_000,
    });
    await assert.rejects(
      () =>
        inside.db.transaction(
          (transaction) =>
            assertNoPendingNativeUploads(transaction, "ws-a"),
          { behavior: "immediate" },
        ),
      (error: unknown) => error instanceof NativeUploadInProgressError,
    );
    assert.equal(
      (
        await inside.db
          .select({ key: meta.key })
          .from(meta)
          .where(
            eq(
              meta.key,
              nativeUploadClaimKey("ws-a", insideMargin.attachmentId),
            ),
          )
      ).length,
      1,
    );
    assert.equal(
      await inside.db.transaction(
        (transaction) =>
          releaseExpiredNativeUploadClaimInTransaction(transaction, {
            workspaceId: "ws-a",
            attachmentId: insideMargin.attachmentId,
          }),
        { behavior: "immediate" },
      ),
      false,
      "the stale sweeper must obey the same drain deadline",
    );

    const outside = await fixture();
    const outsideMargin = await insertClaim(outside, {
      attachmentId: "att-outside-drain-margin",
      authorityExpiresAt:
        Date.now() - NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS - 60_000,
    });
    await outside.db.transaction(
      (transaction) => assertNoPendingNativeUploads(transaction, "ws-a"),
      { behavior: "immediate" },
    );
    assert.equal(
      (
        await outside.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, outsideMargin.attachmentId))
      ).length,
      0,
    );
  });

  it("preserves the backend fixed when each expired writer was issued", async () => {
    const setup = await fixture();
    const blob = await insertClaim(setup, {
      attachmentId: "att-blob",
      authorityExpiresAt: 1,
      cleanupTargetKind: "blob-pathname",
    });
    const disk = await insertClaim(setup, {
      attachmentId: "att-disk",
      authorityExpiresAt: 1,
      cleanupTargetKind: "disk-key",
    });

    await setup.db.transaction(
      (transaction) => assertNoPendingNativeUploads(transaction, "ws-a"),
      { behavior: "immediate" },
    );
    const receipts = await setup.db
      .select({ value: meta.value })
      .from(meta)
      .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
    assert.deepEqual(
      receipts
        .map((row) => JSON.parse(row.value).target)
        .sort((a, b) => a.kind.localeCompare(b.kind)),
      [
        { kind: "blob-pathname", locator: blob.pathname },
        { kind: "disk-key", locator: disk.pathname },
      ],
    );
  });

  it("blocks a markerless pre-deploy placeholder and releases it exactly", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup, { withMarker: false });
    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) =>
            assertNoPendingNativeUploads(transaction, "ws-a"),
          { behavior: "immediate" },
        ),
      (error: unknown) => error instanceof NativeUploadInProgressError,
    );

    assert.equal(
      await setup.db.transaction(
        (transaction) =>
          releaseNativeUploadClaimInTransaction(transaction, {
            workspaceId: "ws-a",
            attachmentId: claim.attachmentId,
          }),
        { behavior: "immediate" },
      ),
      true,
    );
    assert.equal(
      (
        await setup.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, claim.attachmentId))
      ).length,
      0,
    );
  });

  it("finalizes with an exact CAS and treats a repeated finalization as complete", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup);
    const input = {
      workspaceId: "ws-a",
      attachmentId: claim.attachmentId,
      pathname: claim.pathname,
      uploaderUserId: "owner",
      finalStoredPath: "https://blob.example/ws-a/task-a/att-native-deck.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12,
    } as const;
    const completed = await setup.db.transaction(
      (transaction) =>
        finalizeNativeUploadClaimInTransaction(transaction, input),
      { behavior: "immediate" },
    );
    assert.equal(completed, "completed");
    const repeated = await setup.db.transaction(
      (transaction) =>
        finalizeNativeUploadClaimInTransaction(transaction, input),
      { behavior: "immediate" },
    );
    assert.equal(repeated, "already-completed");
    const [persisted] = await setup.db
      .select({ storedPath: attachments.storedPath })
      .from(attachments)
      .where(
        and(
          eq(attachments.id, claim.attachmentId),
          eq(attachments.workspaceId, "ws-a"),
        ),
      );
    assert.equal(persisted.storedPath, input.finalStoredPath);
  });

  it("keeps a rejected presigned writer fenced and permanently non-finalizable", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup);
    const storedPath =
      "https://blob.example/ws-a/task-a/att-native-deck.pdf";
    const deleted: unknown[] = [];
    await retainRejectedNativeUploadCleanupCustody(
      {
        database: setup.db,
        deleteTarget: async (target) => {
          deleted.push(target);
        },
      },
      {
        workspaceId: "ws-a",
        attachmentId: claim.attachmentId,
        pathname: claim.pathname,
        storedPath,
      },
    );

    assert.deepEqual(deleted, [{ kind: "stored-path", locator: storedPath }]);
    assert.ok(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(eq(meta.key, nativeUploadClaimKey("ws-a", claim.attachmentId)))
      )[0],
      "the live writer marker must survive confirmed cleanup",
    );
    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) => assertNoPendingNativeUploads(transaction, "ws-a"),
          { behavior: "immediate" },
        ),
      (error: unknown) => error instanceof NativeUploadInProgressError,
    );
    assert.equal(
      await setup.db.transaction(
        (transaction) =>
          finalizeNativeUploadClaimInTransaction(transaction, {
            workspaceId: "ws-a",
            attachmentId: claim.attachmentId,
            pathname: claim.pathname,
            uploaderUserId: "owner",
            finalStoredPath: storedPath,
            mimeType: "application/pdf",
            sizeBytes: 12,
          }),
        { behavior: "immediate" },
      ),
      "lost",
      "a rewritten blob must not outrun cleanup custody",
    );
  });

  it("never stages cleanup for an attachment another finalizer already completed", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup);
    const storedPath =
      "https://blob.example/ws-a/task-a/att-native-deck.pdf";
    await setup.db.transaction(
      (transaction) =>
        finalizeNativeUploadClaimInTransaction(transaction, {
          workspaceId: "ws-a",
          attachmentId: claim.attachmentId,
          pathname: claim.pathname,
          uploaderUserId: "owner",
          finalStoredPath: storedPath,
          mimeType: "application/pdf",
          sizeBytes: 12,
        }),
      { behavior: "immediate" },
    );
    let deleteCalls = 0;
    await retainRejectedNativeUploadCleanupCustody(
      {
        database: setup.db,
        deleteTarget: async () => {
          deleteCalls += 1;
        },
      },
      {
        workspaceId: "ws-a",
        attachmentId: claim.attachmentId,
        pathname: claim.pathname,
        storedPath,
      },
    );
    assert.equal(deleteCalls, 0);
    assert.equal((await setup.db.select().from(attachments)).length, 1);
    assert.equal((await setup.db.select().from(meta).where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`))).length, 0);
  });

  it("atomically refuses new claims behind either account-erasure fence layer", async () => {
    for (const [index, scenario] of [
      {
        key: googleDriveAccountErasureFenceKey("member-a"),
        uploaderUserId: "member-a",
      },
      {
        key: googleDriveAccountErasureFenceKey("owner"),
        uploaderUserId: "member-a",
      },
      {
        key: accountDeletionTombstoneKey("clerk-member-a"),
        uploaderUserId: "member-a",
      },
      {
        key: accountDeletionTombstoneKey("clerk-owner"),
        uploaderUserId: "member-a",
      },
    ].entries()) {
      const setup = await fixture();
      await setup.db
        .insert(meta)
        .values({ key: scenario.key, value: `arbitrary-${index}` });
      await assert.rejects(
        () =>
          insertClaim(setup, {
            attachmentId: `att-fenced-${index}`,
            uploaderUserId: scenario.uploaderUserId,
          }),
        (error: unknown) =>
          error instanceof NativeUploadClaimStartError &&
          error.code === "account-erasure-in-progress",
      );
      assert.equal(
        (
          await setup.db
            .select({ id: attachments.id })
            .from(attachments)
            .where(eq(attachments.id, `att-fenced-${index}`))
        ).length,
        0,
        "the attachment insert must roll back with its refused marker",
      );
    }
  });

  it("atomically refuses a claim when the uploader membership was removed", async () => {
    const setup = await fixture();
    await setup.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, "ws-a"),
          eq(workspaceMembers.userId, "member-a"),
        ),
      );

    await assert.rejects(
      () =>
        insertClaim(setup, {
          attachmentId: "att-membership-race",
          uploaderUserId: "member-a",
        }),
      (error: unknown) =>
        error instanceof NativeUploadClaimStartError &&
        error.code === "parent-changed",
    );
    assert.equal(
      (
        await setup.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, "att-membership-race"))
      ).length,
      0,
      "the placeholder must roll back with the refused claim",
    );
  });

  it("keeps finalization fenced when erasure starts for the uploader or fresh owner", async () => {
    for (const [index, scenario] of [
      {
        label: "uploader product fence",
        key: googleDriveAccountErasureFenceKey("member-a"),
      },
      {
        label: "owner product fence",
        key: googleDriveAccountErasureFenceKey("owner"),
      },
      {
        label: "uploader identity tombstone",
        key: accountDeletionTombstoneKey("clerk-member-a"),
      },
      {
        label: "owner identity tombstone",
        key: accountDeletionTombstoneKey("clerk-owner"),
      },
    ].entries()) {
      const setup = await fixture();
      const claim = await insertClaim(setup, {
        attachmentId: `att-finalize-fenced-${index}`,
        uploaderUserId: "member-a",
      });
      await setup.db
        .insert(meta)
        .values({ key: scenario.key, value: `arbitrary-${index}` });

      await assert.rejects(
        () =>
          setup.db.transaction(
            (transaction) =>
              finalizeNativeUploadClaimInTransaction(transaction, {
                workspaceId: "ws-a",
                attachmentId: claim.attachmentId,
                pathname: claim.pathname,
                uploaderUserId: "member-a",
                finalStoredPath: `https://blob.example/${claim.attachmentId}.pdf`,
                mimeType: "application/pdf",
                sizeBytes: 12,
              }),
            { behavior: "immediate" },
          ),
        (error: unknown) =>
          error instanceof NativeUploadClaimStartError &&
          error.code === "account-erasure-in-progress",
        scenario.label,
      );

      const [placeholder] = await setup.db
        .select({ storedPath: attachments.storedPath })
        .from(attachments)
        .where(eq(attachments.id, claim.attachmentId));
      assert.equal(
        placeholder?.storedPath,
        claim.pathname,
        `${scenario.label} must preserve the exact placeholder`,
      );
      assert.equal(
        (
          await setup.db
            .select({ key: meta.key })
            .from(meta)
            .where(
              eq(
                meta.key,
                nativeUploadClaimKey("ws-a", claim.attachmentId),
              ),
            )
        ).length,
        1,
        `${scenario.label} must preserve the cleanup marker`,
      );
    }
  });

  it("keeps finalization fenced when the uploader membership was removed", async () => {
    const setup = await fixture();
    const claim = await insertClaim(setup, {
      attachmentId: "att-finalize-membership-race",
      uploaderUserId: "member-a",
    });
    await setup.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, "ws-a"),
          eq(workspaceMembers.userId, "member-a"),
        ),
      );

    await assert.rejects(
      () =>
        setup.db.transaction(
          (transaction) =>
            finalizeNativeUploadClaimInTransaction(transaction, {
              workspaceId: "ws-a",
              attachmentId: claim.attachmentId,
              pathname: claim.pathname,
              uploaderUserId: "member-a",
              finalStoredPath: "https://blob.example/membership-race.pdf",
              mimeType: "application/pdf",
              sizeBytes: 12,
            }),
          { behavior: "immediate" },
        ),
      (error: unknown) =>
        error instanceof NativeUploadClaimStartError &&
        error.code === "parent-changed",
    );
    assert.equal(
      (
        await setup.db
          .select({ key: meta.key })
          .from(meta)
          .where(
            eq(
              meta.key,
              nativeUploadClaimKey("ws-a", claim.attachmentId),
            ),
          )
      ).length,
      1,
      "the live marker must survive a refused finalization",
    );
  });
});
