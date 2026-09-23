import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { claimPathname } from "@/lib/attachment-claim";
import { freshFileDb } from "@/server/db/memory-test-db";
import {
  attachments,
  comments,
  meta,
  taskCommentChanges,
  taskCommentReceipts,
  taskDiscussionState,
  tasks,
  workspaces,
} from "@/server/db/schema";
import {
  NATIVE_BYTE_CLEANUP_META_PREFIX,
  createNativeByteCleanupService,
} from "@/server/attachments/native-byte-cleanup";
import { repairExactNativeByteCleanupReceipts } from "@/server/attachments/native-upload-cleanup";
import {
  NativeUploadInProgressError,
  nativeUploadClaimKey,
  recordNativeUploadClaimInTransaction,
} from "@/server/attachments/native-upload-custody";
import { ProjectDeletionInProgressError } from "./project-deletion-fence";
import { replaceWorkspaceTaskGraphInTransaction } from "./project-task-graph";

async function fixture(foreignKeys: boolean) {
  const setup = await freshFileDb();
  await setup.client.execute(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  await setup.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES
      ('owner-a', 'clerk-owner-a', '#111', 'OA'),
      ('owner-b', 'clerk-owner-b', '#222', 'OB');
    INSERT INTO workspaces (id, slug, name, owner_user_id, active_domain) VALUES
      ('ws-a', 'ws-a', 'Project A', 'owner-a', 'wedding'),
      ('ws-b', 'ws-b', 'Project B', 'owner-b', 'student');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a', 'owner-a', 'owner'),
      ('ws-b', 'owner-b', 'owner');
    INSERT INTO tasks (id, workspace_id, title, lane, priority, parent_task_id) VALUES
      ('task-a', 'ws-a', 'Target parent', 'todo', 'p1', NULL),
      ('task-a-child', 'ws-a', 'Target child', 'doing', 'p2', 'task-a'),
      ('task-b', 'ws-b', 'Bystander', 'todo', 'p1', NULL);
    INSERT INTO task_discussion_state (
      task_id, workspace_id, audience_epoch, next_create_seq, next_change_seq
    ) VALUES
      ('task-a', 'ws-a', 1, 2, 2),
      ('task-b', 'ws-b', 1, 2, 2);
    INSERT INTO comments (
      id, workspace_id, task_id, user_id, body, created_at,
      client_request_id, request_hash, revision, create_seq
    ) VALUES
      ('comment-a', 'ws-a', 'task-a', 'owner-a', 'Target comment', 1,
       'fixture_task_a_comment_0001',
       '516dcbca32080e77f4a0a1f579a1f94cd9b02caeb7f0165b6d720ea40e5e50e2', 1, 1),
      ('comment-b', 'ws-b', 'task-b', 'owner-b', 'Bystander comment', 1,
       'fixture_task_b_comment_0001',
       '5979b1e76b5d5b416d708a687de2e7aac57eb6a395a1cc9695d5422e0f2d3a3d', 1, 1);
    INSERT INTO task_comment_changes (
      task_id, change_seq, kind, comment_id, revision, audience_epoch, happened_at_ms
    ) VALUES
      ('task-a', 1, 'create', 'comment-a', 1, 1, 1000),
      ('task-b', 1, 'create', 'comment-b', 1, 1, 1000);
    INSERT INTO task_comment_receipts (
      task_id, actor_id, client_request_id, operation, payload_hash,
      comment_id, create_seq, change_seq, revision, committed_at_ms
    ) VALUES
      ('task-a', 'owner-a', 'fixture_task_a_comment_0001', 'send',
       '516dcbca32080e77f4a0a1f579a1f94cd9b02caeb7f0165b6d720ea40e5e50e2',
       'comment-a', 1, 1, 1, 1000),
      ('task-b', 'owner-b', 'fixture_task_b_comment_0001', 'send',
       '5979b1e76b5d5b416d708a687de2e7aac57eb6a395a1cc9695d5422e0f2d3a3d',
       'comment-b', 1, 1, 1, 1000);
    INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload) VALUES
      ('activity-a', NULL, 'task-a-child', 'owner-a', 'created', '{}'),
      ('activity-b', 'ws-b', 'task-b', 'owner-b', 'created', '{}');
    INSERT INTO notifications (id, workspace_id, user_id, kind, task_id, payload) VALUES
      ('notification-a', NULL, 'owner-a', 'mention', 'task-a', '{}'),
      ('notification-b', 'ws-b', 'owner-b', 'mention', 'task-b', '{}');
    INSERT INTO attachments (
      id, workspace_id, task_id, uploader_user_id, filename, stored_path,
      mime_type, size_bytes
    ) VALUES
      ('attachment-a', NULL, 'task-a', 'owner-a', 'target.pdf',
       '.data/uploads/target.pdf', 'application/pdf', 12),
      ('attachment-b', 'ws-b', 'task-b', 'owner-b', 'bystander.pdf',
       '.data/uploads/bystander.pdf', 'application/pdf', 13);
    INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage, stored_path, title,
      added_by_user_id, added_at, access_state, counts_against_storage
    ) VALUES
      ('res-attachment-a', 'ws-a', 'task-a', 'upload', 'file', 'signal',
       '.data/uploads/target.pdf', 'target.pdf', 'owner-a', 10, 'ok', 1),
      ('link-a', 'ws-a', 'task-a-child', 'link', 'url', 'signal', NULL,
       'Target link', 'owner-a', 10, 'ok', 0),
      ('res-attachment-b', 'ws-b', 'task-b', 'upload', 'file', 'signal',
       '.data/uploads/bystander.pdf', 'bystander.pdf', 'owner-b', 10, 'ok', 1);
  `);
  return setup;
}

async function count(setup: Awaited<ReturnType<typeof fixture>>, sql: string) {
  const result = await setup.client.execute(`SELECT COUNT(*) AS n FROM ${sql}`);
  return Number(result.rows[0]?.n ?? 0);
}

describe("atomic Project task-graph replacement", () => {
  for (const foreignKeys of [false, true]) {
    for (const mode of ["clear", "reseed"] as const) {
      it(`${mode} owns every exact row with foreign keys ${foreignKeys ? "on" : "off"}`, async () => {
        const setup = await fixture(foreignKeys);
        try {
          const reset = await setup.db.transaction(
            (transaction) =>
              replaceWorkspaceTaskGraphInTransaction(transaction, {
                workspaceId: "ws-a",
                replace: async (replacement) => {
                  if (mode === "reseed") {
                    await replacement.insert(tasks).values({
                      id: "replacement-a",
                      workspaceId: "ws-a",
                      title: "Replacement",
                      lane: "todo",
                      priority: "p1",
                    });
                    await replacement.insert(taskDiscussionState).values({
                      taskId: "replacement-a",
                      workspaceId: "ws-a",
                      audienceEpoch: 1,
                      nextCreateSeq: 2,
                      nextChangeSeq: 2,
                    });
                    await replacement.insert(comments).values({
                      id: "replacement-comment-a",
                      workspaceId: "ws-a",
                      taskId: "replacement-a",
                      userId: "owner-a",
                      body: "Replacement comment",
                      clientRequestId: "fixture_replacement_comment_0001",
                      requestHash: "69e1f7f54fe793b2edfa60c3b681b53b276310c65cbd375112bce5552eed7d4f",
                      revision: 1,
                      createSeq: 1,
                    });
                    await replacement.insert(taskCommentChanges).values({
                      taskId: "replacement-a",
                      changeSeq: 1,
                      kind: "create",
                      commentId: "replacement-comment-a",
                      revision: 1,
                      audienceEpoch: 1,
                      happenedAtMs: 1000,
                    });
                    await replacement.insert(taskCommentReceipts).values({
                      taskId: "replacement-a",
                      actorId: "owner-a",
                      clientRequestId: "fixture_replacement_comment_0001",
                      operation: "send",
                      payloadHash: "69e1f7f54fe793b2edfa60c3b681b53b276310c65cbd375112bce5552eed7d4f",
                      commentId: "replacement-comment-a",
                      createSeq: 1,
                      changeSeq: 1,
                      revision: 1,
                      committedAtMs: 1000,
                    });
                  }
                  await replacement
                    .update(workspaces)
                    .set({ activeDomain: mode === "clear" ? null : "trades" })
                    .where(eq(workspaces.id, "ws-a"));
                },
              }),
            { behavior: "immediate" },
          );
          assert.equal(reset.cleanupReceiptKeys.length, 1);

          let storageCalls = 0;
          await repairExactNativeByteCleanupReceipts(
            {
              database: setup.db,
              deleteTarget: async (target) => {
                storageCalls += 1;
                assert.deepEqual(target, {
                  kind: "stored-path",
                  locator: ".data/uploads/target.pdf",
                });
                throw new Error("storage unavailable");
              },
            },
            reset.cleanupReceiptKeys,
          );
          assert.equal(storageCalls, 1);
          assert.equal(await count(setup, "tasks WHERE workspace_id = 'ws-a'"), mode === "reseed" ? 1 : 0);
          assert.equal(await count(setup, "comments WHERE id = 'comment-a'"), 0);
          for (const table of ["task_discussion_state", "task_comment_changes", "task_comment_receipts"]) {
            assert.equal(await count(setup, `${table} WHERE task_id = 'task-a'`), 0, `${table}: old Project lineage`);
            assert.equal(await count(setup, `${table} WHERE task_id = 'task-b'`), 1, `${table}: other Project intact`);
            assert.equal(
              await count(setup, `${table} WHERE task_id = 'replacement-a'`),
              mode === "reseed" ? 1 : 0,
              `${table}: replacement lineage`,
            );
          }
          assert.equal(await count(setup, "activities WHERE id = 'activity-a'"), 0);
          assert.equal(await count(setup, "notifications WHERE id = 'notification-a'"), 0);
          assert.equal(await count(setup, "attachments WHERE id = 'attachment-a'"), 0);
          assert.equal(await count(setup, "resources WHERE workspace_id = 'ws-a'"), 0);
          assert.equal(await count(setup, "tasks WHERE workspace_id = 'ws-b'"), 1);
          assert.equal(await count(setup, "attachments WHERE id = 'attachment-b'"), 1);
          assert.equal(
            await count(
              setup,
              `meta WHERE key LIKE '${NATIVE_BYTE_CLEANUP_META_PREFIX}%'`,
            ),
            1,
          );
        } finally {
          setup.cleanup();
        }
      });
    }
  }

  for (const claimKind of ["live", "malformed", "markerless"] as const) {
    it(`${claimKind} native authority rolls the entire reset back`, async () => {
      const setup = await fixture(false);
      let replacementCalls = 0;
      let storageCalls = 0;
      try {
        const pathname = claimPathname(
          "ws-a",
          "task-a",
          "attachment-a",
          "target.pdf",
        );
        await setup.db
          .update(attachments)
          .set({ workspaceId: "ws-a", storedPath: pathname })
          .where(eq(attachments.id, "attachment-a"));
        if (claimKind === "live") {
          await setup.db.transaction(
            (transaction) =>
              recordNativeUploadClaimInTransaction(transaction, {
                workspaceId: "ws-a",
                attachmentId: "attachment-a",
                pathname,
                authorityExpiresAt: Date.now() + 60_000,
                cleanupTargetKind: "disk-key",
              }),
            { behavior: "immediate" },
          );
        } else if (claimKind === "malformed") {
          await setup.db.insert(meta).values({
            key: nativeUploadClaimKey("ws-a", "attachment-a"),
            value: "{malformed",
          });
        }

        await assert.rejects(
          () =>
            setup.db.transaction(
              (transaction) =>
                replaceWorkspaceTaskGraphInTransaction(transaction, {
                  workspaceId: "ws-a",
                  replace: async () => {
                    replacementCalls += 1;
                  },
                }),
              { behavior: "immediate" },
            ),
          claimKind === "malformed"
            ? (error: unknown) => error instanceof TypeError
            : (error: unknown) => error instanceof NativeUploadInProgressError,
        );
        if (replacementCalls > 0) {
          await repairExactNativeByteCleanupReceipts(
            {
              database: setup.db,
              deleteTarget: async () => {
                storageCalls += 1;
              },
            },
            [],
          );
        }
        assert.equal(replacementCalls, 0);
        assert.equal(storageCalls, 0);
        assert.equal(await count(setup, "tasks WHERE workspace_id = 'ws-a'"), 2);
        assert.equal(await count(setup, "comments WHERE id = 'comment-a'"), 1);
        for (const table of ["task_discussion_state", "task_comment_changes", "task_comment_receipts"]) {
          assert.equal(await count(setup, `${table} WHERE task_id = 'task-a'`), 1, `${table}: rollback retained lineage`);
        }
        assert.equal(await count(setup, "attachments WHERE id = 'attachment-a'"), 1);
        assert.equal(await count(setup, "resources WHERE id = 'res-attachment-a'"), 1);
        assert.equal(
          await count(
            setup,
            `meta WHERE key LIKE '${NATIVE_BYTE_CLEANUP_META_PREFIX}%'`,
          ),
          0,
        );
      } finally {
        setup.cleanup();
      }
    });
  }

  it("rolls back custody and the old graph when reseed insertion fails", async () => {
    const setup = await fixture(false);
    try {
      await assert.rejects(() =>
        setup.db.transaction(
          (transaction) =>
            replaceWorkspaceTaskGraphInTransaction(transaction, {
              workspaceId: "ws-a",
              replace: async (replacement) => {
                await replacement.insert(tasks).values({
                  id: "task-b",
                  workspaceId: "ws-a",
                  title: "Conflicting replacement",
                  lane: "todo",
                  priority: "p1",
                });
              },
            }),
          { behavior: "immediate" },
        ),
      );
      assert.equal(await count(setup, "tasks WHERE workspace_id = 'ws-a'"), 2);
      assert.equal(await count(setup, "attachments WHERE id = 'attachment-a'"), 1);
      assert.equal(await count(setup, "resources WHERE id = 'res-attachment-a'"), 1);
      assert.equal(
        await count(
          setup,
          `meta WHERE key LIKE '${NATIVE_BYTE_CLEANUP_META_PREFIX}%'`,
        ),
        0,
      );
    } finally {
      setup.cleanup();
    }
  });

  it("does not cross a durable Project-deletion fence", async () => {
    const setup = await fixture(false);
    try {
      await setup.client.execute(`
        INSERT INTO project_drive_operations (
          id, workspace_id, operation_kind, status, dedupe_key
        ) VALUES (
          'delete-ws-a', 'ws-a', 'project_delete', 'pending',
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        )
      `);
      await assert.rejects(
        () =>
          setup.db.transaction(
            (transaction) =>
              replaceWorkspaceTaskGraphInTransaction(transaction, {
                workspaceId: "ws-a",
                replace: async () => undefined,
              }),
            { behavior: "immediate" },
          ),
        (error: unknown) => error instanceof ProjectDeletionInProgressError,
      );
      assert.equal(await count(setup, "tasks WHERE workspace_id = 'ws-a'"), 2);
      assert.equal(await count(setup, "attachments WHERE id = 'attachment-a'"), 1);
      assert.equal(
        await count(
          setup,
          `meta WHERE key LIKE '${NATIVE_BYTE_CLEANUP_META_PREFIX}%'`,
        ),
        0,
      );
    } finally {
      setup.cleanup();
    }
  });

  it("chunks beyond the bind boundary and leaves bounded-drain work discoverable", async () => {
    const setup = await fixture(false);
    try {
      const rows = Array.from({ length: 401 }, (_, index) => ({
        id: `attachment-extra-${index}`,
        workspaceId: "ws-a",
        taskId: "task-a",
        uploaderUserId: "owner-a",
        filename: `extra-${index}.pdf`,
        storedPath: `.data/uploads/extra-${index}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: index + 1,
      }));
      for (let offset = 0; offset < rows.length; offset += 100) {
        await setup.db
          .insert(attachments)
          .values(rows.slice(offset, offset + 100));
      }
      const reset = await setup.db.transaction(
        (transaction) =>
          replaceWorkspaceTaskGraphInTransaction(transaction, {
            workspaceId: "ws-a",
            replace: async () => undefined,
          }),
        { behavior: "immediate" },
      );
      assert.equal(reset.cleanupReceiptKeys.length, 402);

      let storageCalls = 0;
      await repairExactNativeByteCleanupReceipts(
        {
          database: setup.db,
          deleteTarget: async () => {
            storageCalls += 1;
          },
        },
        reset.cleanupReceiptKeys,
      );
      assert.equal(storageCalls, 50);
      assert.equal(
        await count(
          setup,
          `meta WHERE key LIKE '${NATIVE_BYTE_CLEANUP_META_PREFIX}%'`,
        ),
        352,
      );

      const replay = createNativeByteCleanupService({
        database: setup.db,
        deleteTarget: async () => {
          storageCalls += 1;
        },
      });
      let replayed = 0;
      for (;;) {
        const batch = await replay.repairReady();
        replayed += batch.cleaned;
        if (batch.scanned === 0) break;
      }
      assert.equal(replayed, 352);
      assert.equal(storageCalls, 402);
      assert.equal(
        await count(
          setup,
          `meta WHERE key LIKE '${NATIVE_BYTE_CLEANUP_META_PREFIX}%'`,
        ),
        0,
      );
    } finally {
      setup.cleanup();
    }
  });
});
