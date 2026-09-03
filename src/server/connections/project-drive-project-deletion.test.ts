import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { and, eq, like } from "drizzle-orm";
import { eraseAccountData } from "@/server/account-erasure";
import {
  attachments,
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  resources,
  workspaceMembers,
  workspaceStorage,
  workspaces,
} from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import type { ExactDriveGrantReceipt } from "./project-drive-erasure-grants";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { setProjectDriveMemberRole } from "./project-drive-member-role";
import {
  createProjectDriveProjectDeletionService,
  ProjectDriveProjectDeletionError,
} from "./project-drive-project-deletion";
import { ProjectDeletionInProgressError } from "@/server/projects/project-deletion-fence";
import { NATIVE_BYTE_CLEANUP_META_PREFIX } from "@/server/attachments/native-byte-cleanup";
import { recordNativeUploadClaimInTransaction } from "@/server/attachments/native-upload-custody";

async function seededFixture(withStorage = true) {
  const fixture = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(fixture.client);
  if (withStorage) await seedStorageGenerations(fixture.client);
  return fixture;
}

async function insertGrant(
  fixture: Awaited<ReturnType<typeof seededFixture>>,
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
    grantedEmail:
      input.userId === "member-b"
        ? "member.b@example.com"
        : "member.a@example.com",
    role: "writer",
    grantedAt: new Date(10_000),
    revokePending: input.revokePending ?? false,
  });
}

async function createCompletedGrantOperation(
  fixture: Awaited<ReturnType<typeof seededFixture>>,
  input: Readonly<{
    operationId: string;
    subjectUserId?: string;
    permissionId: string;
    storageGenerationId?: string;
  }>,
) {
  const journal = createProjectDriveOperationJournal({
    database: fixture.db,
    randomOperationId: () => input.operationId,
  });
  const subjectUserId = input.subjectUserId ?? "member-a";
  const prepared = await journal.prepare({
    operationKind: "grant_create",
    workspaceId: "ws-a",
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    subjectUserId,
    granteeEmail:
      subjectUserId === "member-b"
        ? "member.b@example.com"
        : "member.a@example.com",
    grantRole: "writer",
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") return;
  const claimed = await journal.claim({
    workspaceId: "ws-a",
    operationId: prepared.operation.operationId,
  });
  assert.notEqual(claimed.outcome, "conflict");
  if (claimed.outcome === "conflict") return;
  const completed = await journal.complete({
    workspaceId: "ws-a",
    operationId: claimed.claim.operationId,
    attemptFence: claimed.claim.attemptFence,
    operationKind: "grant_create",
    receipt: { providerPermissionId: input.permissionId },
  });
  assert.notEqual(completed.outcome, "conflict");
}

async function createPendingOperation(
  fixture: Awaited<ReturnType<typeof seededFixture>>,
  operationId: string,
  subjectUserId = "member-b",
) {
  return createProjectDriveOperationJournal({
    database: fixture.db,
    randomOperationId: () => operationId,
  }).prepare({
    operationKind: "grant_create",
    workspaceId: "ws-a",
    storageGenerationId: "gen-current",
    subjectUserId,
    granteeEmail:
      subjectUserId === "member-b"
        ? "member.b@example.com"
        : "member.a@example.com",
    grantRole: "writer",
  });
}

function deletionError(code: ProjectDriveProjectDeletionError["code"]) {
  return (error: unknown) =>
    error instanceof ProjectDriveProjectDeletionError && error.code === code;
}

async function count(
  fixture: Awaited<ReturnType<typeof seededFixture>>,
  table: string,
  workspaceId = "ws-a",
) {
  const result = await fixture.client.execute({
    sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${
      table === "workspaces" ? "id" : "workspace_id"
    } = ?`,
    args: [workspaceId],
  });
  return Number(result.rows[0]?.n ?? 0);
}

async function seedProjectChildren(
  fixture: Awaited<ReturnType<typeof seededFixture>>,
) {
  await fixture.client.executeMultiple(`
    INSERT INTO tasks (
      id, workspace_id, title, lane, priority, assignees, created_at, updated_at
    ) VALUES ('task-delete', 'ws-a', 'Delete me', 'todo', 'medium', '[]', 10, 10);
    INSERT INTO comments (id, workspace_id, task_id, user_id, body)
      VALUES ('comment-delete', 'ws-a', 'task-delete', 'owner', 'Comment');
    INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload)
      VALUES ('activity-delete', 'ws-a', 'task-delete', 'owner', 'created', '{}');
    INSERT INTO attachments (
      id, workspace_id, task_id, uploader_user_id, filename, stored_path,
      mime_type, size_bytes
    ) VALUES (
      'attachment-delete', 'ws-a', 'task-delete', 'owner', 'local.txt',
      '.data/uploads/local.txt', 'text/plain', 5
    );
    INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage,
      storage_generation_id, stored_path, title, url, mime_type, size_bytes,
      added_by_user_id, added_at, access_state, counts_against_storage
    ) VALUES (
      'drive-resource-delete', 'ws-a', 'task-delete', 'upload', 'drive',
      'drive', 'gen-current', 'drive-file-id', 'Drive file',
      'https://drive.google.com/file/d/drive-file-id/view', 'text/plain', 5,
      'owner', 10, 'ok', 0
    );
    INSERT INTO notifications (id, workspace_id, user_id, kind, task_id, payload)
      VALUES ('notification-delete', 'ws-a', 'owner', 'mention', 'task-delete', '{}');
    INSERT INTO share_links (token, workspace_id, view)
      VALUES ('share-delete', 'ws-a', 'board');
    INSERT INTO share_link_visits (id, token)
      VALUES ('visit-delete', 'share-delete');
    INSERT INTO entitlements (id, workspace_id, user_id, tier, source)
      VALUES ('entitlement-delete', 'ws-a', 'owner', 'free', 'system');
    INSERT INTO pending_invites (
      token, workspace_id, email, invited_by_user_id, expires_at
    ) VALUES (
      'invite-delete', 'ws-a', 'future@example.com', 'owner', 9999999999
    );
    INSERT INTO workspace_events (
      id, workspace_id, user_id, kind, payload, created_at
    ) VALUES ('event-delete', 'ws-a', 'owner', 'inviteSent', '{}', 10);
    INSERT INTO workspace_sponsorships (
      id, workspace_id, sponsor_id, status, consented_metadata,
      metadata_version, consent_receipt_id, consented_at
    ) VALUES (
      'sponsor-delete', 'ws-a', 'sponsor', 'active', '{}', 1, 'receipt', 10
    );
    INSERT INTO suite_outbox (
      id, event_id, version, type, actor_user_id, workspace_id, object_ref,
      payload, trace_id, occurred_at
    ) VALUES (
      'outbox-delete', 'event-outbox-delete', 1, 'workspace.changed', 'owner',
      'ws-a', 'ws-a', '{}', 'trace-delete', 10
    );
    INSERT INTO meta (key, value) VALUES ('board:ws-a:columns', '[]');
  `);
}

type DeletePrecedenceLineage = "owned" | "member" | "storage" | "grant";
type DeletePrecedenceStatus =
  | "pending"
  | "live_running"
  | "expired_running"
  | "retry_wait"
  | "manual_attention";

async function deletionPrecedenceFixture(
  lineage: DeletePrecedenceLineage,
  status: DeletePrecedenceStatus,
) {
  const fixture = await seededFixture(false);
  let targetUserId: string;
  let targetClerkId: string;
  let actorUserId = "owner";

  switch (lineage) {
    case "owned":
      targetUserId = "owner";
      targetClerkId = "clerk-owner";
      actorUserId = targetUserId;
      break;
    case "member":
      targetUserId = "member-a";
      targetClerkId = "clerk-member-a";
      break;
    case "storage":
      targetUserId = "storage-custodian";
      targetClerkId = "clerk-storage-custodian";
      await fixture.client.executeMultiple(`
        INSERT INTO users (id, clerk_id, email, color, initials) VALUES (
          'storage-custodian', 'clerk-storage-custodian',
          'storage@example.com', '#555', 'SC'
        );
        INSERT INTO provider_connections (
          id, user_id, provider, provider_account_id, provider_account_email,
          root_folder_id, refresh_token_cipher, key_version, scopes, status,
          is_current, connected_at
        ) VALUES (
          'conn-storage-custodian', 'storage-custodian', 'google_drive',
          'account-storage-custodian', 'storage@example.com',
          'root-storage-custodian', 'cipher-storage-custodian', 1,
          '["https://www.googleapis.com/auth/drive.file"]', 'active', 1, 20
        );
        INSERT INTO workspace_storage (
          id, workspace_id, connection_id, folder_id, folder_web_view_link,
          state, is_current
        ) VALUES (
          'gen-storage-custodian', 'ws-a', 'conn-storage-custodian',
          'folder-storage-custodian',
          'https://drive.example/folder-storage-custodian', 'active', 1
        );
      `);
      break;
    case "grant":
      targetUserId = "grant-recipient";
      targetClerkId = "clerk-grant-recipient";
      await fixture.client.executeMultiple(`
        INSERT INTO users (id, clerk_id, email, color, initials) VALUES (
          'grant-recipient', 'clerk-grant-recipient',
          'grant@example.com', '#666', 'GR'
        );
        INSERT INTO workspace_storage (
          id, workspace_id, connection_id, folder_id, folder_web_view_link,
          state, is_current
        ) VALUES (
          'gen-grant-lineage', 'ws-a', 'conn-old', 'folder-grant-lineage',
          'https://drive.example/folder-grant-lineage', 'active', 1
        );
        INSERT INTO drive_folder_grants (
          storage_generation_id, workspace_id, user_id, permission_id,
          granted_email, role, granted_at, revoke_pending
        ) VALUES (
          'gen-grant-lineage', 'ws-a', 'grant-recipient',
          'permission-grant-lineage', 'grant@example.com', 'reader', 20, 0
        );
      `);
      break;
  }

  const journal = createProjectDriveOperationJournal({
    database: fixture.db,
    randomOperationId: () => `delete-precedence-${lineage}-${status}`,
  });
  const prepared = await journal.prepare({
    operationKind: "project_delete",
    workspaceId: "ws-a",
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") {
    throw new Error("could not prepare deletion-precedence fixture");
  }

  if (status === "live_running" || status === "expired_running") {
    await fixture.client.execute({
      sql: `UPDATE project_drive_operations
            SET status = 'running', attempt_count = 1,
                last_attempt_at = created_at,
                lease_expires_at = CASE WHEN ? = 1
                  THEN 32503680000 ELSE created_at END,
                updated_at = max(updated_at, created_at)
            WHERE id = ?`,
      args: [
        status === "live_running" ? 1 : 0,
        prepared.operation.operationId,
      ],
    });
  } else if (status === "retry_wait") {
    await fixture.client.execute({
      sql: `UPDATE project_drive_operations
            SET status = 'retry_wait', attempt_count = 1,
                last_attempt_at = created_at,
                next_attempt_at = 32503680000,
                last_error_code = 'provider_unavailable',
                updated_at = max(updated_at, created_at)
            WHERE id = ?`,
      args: [prepared.operation.operationId],
    });
  } else if (status === "manual_attention") {
    await fixture.client.execute({
      sql: `UPDATE project_drive_operations
            SET status = 'manual_attention', attempt_count = 1,
                last_attempt_at = created_at,
                last_error_code = 'ambiguous_provider_result',
                updated_at = max(updated_at, created_at)
            WHERE id = ?`,
      args: [prepared.operation.operationId],
    });
  }

  await fixture.client.execute({
    sql: `INSERT INTO project_drive_operations (
            id, workspace_id, operation_kind, status, dedupe_key,
            connection_id, target_storage_generation_id, attempt_count,
            created_at, updated_at
          ) VALUES (?, 'ws-a', 'folder_provision', 'pending', ?,
                    'conn-new', ?, 0, 1, 1)`,
    args: [
      `bystander-operation-${lineage}-${status}`,
      "f".repeat(64),
      `bystander-generation-${lineage}-${status}`,
    ],
  });

  return Object.freeze({
    ...fixture,
    actorUserId,
    bystanderOperationId: `bystander-operation-${lineage}-${status}`,
    operationId: prepared.operation.operationId,
    targetClerkId,
    targetUserId,
  });
}

describe("Project Drive-aware Project deletion", () => {
  for (const lineage of ["owned", "member", "storage", "grant"] as const) {
    it(`yields atomically to a live Project deletion reached through ${lineage} lineage`, async () => {
      const fixture = await deletionPrecedenceFixture(
        lineage,
        "live_running",
      );
      try {
        let providerRevocations = 0;
        const erasureOptions = {
          openProviderToken: ({ connectionId }: { connectionId: string }) =>
            `refresh:${connectionId}`,
          revokeProjectDriveRefreshToken: async (_refreshToken: string) => {
            providerRevocations += 1;
          },
        };
        const before = await fixture.client.execute({
          sql: `SELECT status, attempt_count, last_attempt_at, next_attempt_at,
                       lease_expires_at, last_error_code, completed_at
                FROM project_drive_operations WHERE id = ?`,
          args: [fixture.operationId],
        });

        await assert.rejects(
          eraseAccountData(
            fixture.db,
            fixture.targetClerkId,
            erasureOptions,
          ),
          /account erasure deferred: live Project deletion is already in progress/,
        );

        const after = await fixture.client.execute({
          sql: `SELECT status, attempt_count, last_attempt_at, next_attempt_at,
                       lease_expires_at, last_error_code, completed_at
                FROM project_drive_operations WHERE id = ?`,
          args: [fixture.operationId],
        });
        assert.deepEqual(after.rows[0], before.rows[0]);
        assert.equal(providerRevocations, 0);
        assert.equal(
          Number(
            (
              await fixture.client.execute({
                sql: "SELECT COUNT(*) AS n FROM meta WHERE key = ?",
                args: [
                  googleDriveAccountErasureFenceKey(fixture.targetUserId),
                ],
              })
            ).rows[0]?.n ?? 0,
          ),
          0,
          "erasure must not install its fence behind a live deletion lease",
        );

        // Let the winning deletion finish, then prove account erasure can retry
        // without either lifecycle leaving a permanent fence.
        await fixture.client.execute({
          sql: `UPDATE project_drive_operations
                SET lease_expires_at = last_attempt_at
                WHERE id = ?`,
          args: [fixture.operationId],
        });
        await createProjectDriveProjectDeletionService({
          database: fixture.db,
          revokeExactGrant: async () => {},
        }).delete({
          workspaceId: "ws-a",
          actorUserId: fixture.actorUserId,
        });
        await eraseAccountData(
          fixture.db,
          fixture.targetClerkId,
          erasureOptions,
        );
        assert.equal(
          Number(
            (
              await fixture.client.execute({
                sql: "SELECT COUNT(*) AS n FROM users WHERE id = ?",
                args: [fixture.targetUserId],
              })
            ).rows[0]?.n ?? 0,
          ),
          0,
        );
      } finally {
        fixture.cleanup();
      }
    });
  }

  it("keeps a failed fence acquisition authoritative when the winning lease expires at the boundary", async () => {
    const fixture = await deletionPrecedenceFixture(
      "member",
      "live_running",
    );
    try {
      let boundaryCrossed = 0;
      await assert.rejects(
        eraseAccountData(fixture.db, fixture.targetClerkId, {
          afterProjectDeletionFenceAttempt: async () => {
            boundaryCrossed += 1;
            await fixture.client.execute({
              sql: `UPDATE project_drive_operations
                    SET lease_expires_at = last_attempt_at
                    WHERE id = ?`,
              args: [fixture.operationId],
            });
          },
        }),
        /account erasure deferred: live Project deletion is already in progress/,
      );
      assert.equal(boundaryCrossed, 1);
      assert.equal(
        Number(
          (
            await fixture.client.execute({
              sql: "SELECT COUNT(*) AS n FROM meta WHERE key = ?",
              args: [
                googleDriveAccountErasureFenceKey(fixture.targetUserId),
              ],
            })
          ).rows[0]?.n ?? 0,
        ),
        0,
      );
      assert.equal(
        Number(
          (
            await fixture.client.execute({
              sql: "SELECT COUNT(*) AS n FROM project_drive_operations WHERE id = ? AND status = 'pending'",
              args: [fixture.bystanderOperationId],
            })
          ).rows[0]?.n ?? 0,
        ),
        1,
        "later batch statements must not mutate without the acquired fence",
      );

      await eraseAccountData(fixture.db, fixture.targetClerkId);
      const tombstone = await fixture.client.execute({
        sql: `SELECT status, lease_expires_at, last_error_code
              FROM project_drive_operations WHERE id = ?`,
        args: [fixture.operationId],
      });
      assert.equal(tombstone.rows[0]?.status, "retry_wait");
      assert.equal(tombstone.rows[0]?.lease_expires_at, null);
      assert.equal(tombstone.rows[0]?.last_error_code, "workspace_changed");
    } finally {
      fixture.cleanup();
    }
  });

  for (const status of [
    "pending",
    "expired_running",
    "retry_wait",
    "manual_attention",
  ] as const) {
    it(`subsumes an owned ${status} deletion when account erasure owns the Project`, async () => {
      const fixture = await deletionPrecedenceFixture("owned", status);
      try {
        const revokedTokens: string[] = [];
        await eraseAccountData(fixture.db, fixture.targetClerkId, {
          openProviderToken: ({ connectionId }) => `refresh:${connectionId}`,
          revokeProjectDriveRefreshToken: async (token) => {
            revokedTokens.push(token);
          },
        });

        assert.equal(await count(fixture, "workspaces"), 0);
        assert.equal(
          Number(
            (
              await fixture.client.execute({
                sql: "SELECT COUNT(*) AS n FROM project_drive_operations WHERE id = ?",
                args: [fixture.operationId],
              })
            ).rows[0]?.n ?? 0,
          ),
          0,
        );
        assert.deepEqual(revokedTokens.sort(), [
          "refresh:conn-new",
          "refresh:conn-old",
        ]);
        assert.equal(
          Number(
            (
              await fixture.client.execute({
                sql: "SELECT COUNT(*) AS n FROM meta WHERE key = ?",
                args: [
                  googleDriveAccountErasureFenceKey(fixture.targetUserId),
                ],
              })
            ).rows[0]?.n ?? 0,
          ),
          0,
        );
      } finally {
        fixture.cleanup();
      }
    });
  }

  for (const lineage of ["member", "storage", "grant"] as const) {
    for (const status of [
      "pending",
      "expired_running",
      "retry_wait",
      "manual_attention",
    ] as const) {
      it(`preserves and hands off a ${status} deletion after non-owner ${lineage} erasure`, async () => {
        const fixture = await deletionPrecedenceFixture(lineage, status);
        try {
          const revokedTokens: string[] = [];
          const revokedGrants: ExactDriveGrantReceipt[] = [];
          await eraseAccountData(fixture.db, fixture.targetClerkId, {
            openProviderToken: ({ connectionId }) => `refresh:${connectionId}`,
            revokeDriveFolderGrant: async (grant) => {
              revokedGrants.push(grant);
            },
            revokeProjectDriveRefreshToken: async (token) => {
              revokedTokens.push(token);
            },
          });

          assert.equal(await count(fixture, "workspaces"), 1);
          assert.equal(
            Number(
              (
                await fixture.client.execute({
                  sql: "SELECT COUNT(*) AS n FROM users WHERE id = ?",
                  args: [fixture.targetUserId],
                })
              ).rows[0]?.n ?? 0,
            ),
            0,
          );
          assert.equal(
            Number(
              (
                await fixture.client.execute({
                  sql: "SELECT COUNT(*) AS n FROM meta WHERE key = ?",
                  args: [
                    googleDriveAccountErasureFenceKey(fixture.targetUserId),
                  ],
                })
              ).rows[0]?.n ?? 0,
            ),
            0,
            "the completed erasure must not strand its account fence",
          );

          const tombstone = await fixture.client.execute({
            sql: `SELECT status, attempt_count, next_attempt_at,
                         lease_expires_at, last_error_code
                  FROM project_drive_operations WHERE id = ?`,
            args: [fixture.operationId],
          });
          assert.equal(tombstone.rows.length, 1);
          if (status === "pending") {
            assert.equal(tombstone.rows[0]?.status, "pending");
            assert.equal(tombstone.rows[0]?.attempt_count, 0);
            assert.equal(tombstone.rows[0]?.last_error_code, null);
          } else {
            assert.equal(tombstone.rows[0]?.status, "retry_wait");
            assert.equal(tombstone.rows[0]?.lease_expires_at, null);
            assert.ok(Number(tombstone.rows[0]?.next_attempt_at ?? 0) > 1);
            if (
              status === "expired_running" ||
              status === "manual_attention"
            ) {
              assert.equal(
                tombstone.rows[0]?.last_error_code,
                "workspace_changed",
              );
            } else {
              assert.equal(
                tombstone.rows[0]?.last_error_code,
                "provider_unavailable",
              );
              assert.ok(
                Number(tombstone.rows[0]?.next_attempt_at ?? 0) <
                  32_503_680_000,
                "an existing retry may be accelerated during handoff",
              );
            }
          }
          assert.equal(
            Number(
              (
                await fixture.client.execute({
                  sql: "SELECT COUNT(*) AS n FROM project_drive_operations WHERE id = ? AND status = 'pending'",
                  args: [fixture.bystanderOperationId],
                })
              ).rows[0]?.n ?? 0,
            ),
            1,
            "unrelated bystander work in the surviving Project must remain untouched",
          );
          assert.deepEqual(
            revokedTokens,
            lineage === "storage"
              ? ["refresh:conn-storage-custodian"]
              : [],
          );
          assert.deepEqual(
            revokedGrants,
            lineage === "grant"
              ? [
                  {
                    workspaceId: "ws-a",
                    storageGenerationId: "gen-grant-lineage",
                    connectionId: "conn-old",
                    folderId: "folder-grant-lineage",
                    userId: "grant-recipient",
                    permissionId: "permission-grant-lineage",
                  },
                ]
              : [],
          );

          const deletion = await createProjectDriveProjectDeletionService({
            database: fixture.db,
            revokeExactGrant: async () => {},
          }).delete({ workspaceId: "ws-a", actorUserId: "owner" });
          assert.equal(deletion.workspaceId, "ws-a");
          assert.equal(await count(fixture, "workspaces"), 0);
        } finally {
          fixture.cleanup();
        }
      });
    }
  }

  it("revokes exact named-user permissions outside the writer transaction, then removes every Project child row", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      await createCompletedGrantOperation(fixture, {
        operationId: "grant-completed",
        permissionId: "permission-a",
      });
      await seedProjectChildren(fixture);

      const revoked: ExactDriveGrantReceipt[] = [];
      const deletedStoredPaths: string[] = [];
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-operation",
        deleteStoredBytes: async (storedPath) => {
          deletedStoredPaths.push(storedPath);
          assert.equal(await count(fixture, "workspaces"), 0);
          const receipts = await fixture.db
            .select({ value: meta.value })
            .from(meta)
            .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
          assert.equal(receipts.length, 1);
          assert.match(receipts[0].value, /uploads\/local\.txt/);
          assert.doesNotMatch(receipts[0].value, /drive-file-id/);
        },
        revokeExactGrant: async (receipt) => {
          revoked.push(receipt);
          // A writer call from this callback proves provider I/O is not nested
          // in the service's immediate writer transaction.
          await fixture.db
            .insert(meta)
            .values({ key: "provider-callback-ran", value: "yes" })
            .onConflictDoNothing();
        },
      });

      const result = await service.delete({
        workspaceId: "ws-a",
        actorUserId: "owner",
      });
      assert.deepEqual(result, {
        workspaceId: "ws-a",
        slug: "ws-a",
        wasPublished: false,
        revokedGrantCount: 1,
      });
      assert.deepEqual(revoked, [
        {
          workspaceId: "ws-a",
          storageGenerationId: "gen-current",
          connectionId: "conn-old",
          folderId: "folder-current",
          userId: "member-a",
          permissionId: "permission-a",
        },
      ]);
      assert.deepEqual(deletedStoredPaths, [".data/uploads/local.txt"]);
      assert.ok(!deletedStoredPaths.includes("drive-file-id"));
      assert.equal(
        (
          await fixture.db
            .select({ key: meta.key })
            .from(meta)
            .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`))
        ).length,
        0,
        "confirmed cleanup retires its durable receipt",
      );

      for (const table of [
        "activities",
        "attachments",
        "comments",
        "drive_folder_grants",
        "entitlements",
        "notifications",
        "pending_invites",
        "project_drive_operations",
        "resources",
        "share_links",
        "suite_outbox",
        "tasks",
        "workspace_events",
        "workspace_members",
        "workspace_sponsorships",
        "workspace_storage",
        "workspaces",
      ]) {
        assert.equal(await count(fixture, table), 0, `${table} must be empty`);
      }
      assert.equal(
        Number(
          (
            await fixture.client.execute(
              "SELECT COUNT(*) AS n FROM share_link_visits WHERE token = 'share-delete'",
            )
          ).rows[0]?.n ?? 0,
        ),
        0,
      );
      assert.equal(
        Number(
          (
            await fixture.client.execute(
              "SELECT COUNT(*) AS n FROM meta WHERE key LIKE 'board:ws-a:%'",
            )
          ).rows[0]?.n ?? 0,
        ),
        0,
      );
      assert.equal(
        (
          await fixture.db
            .select()
            .from(providerConnections)
            .where(eq(providerConnections.id, "conn-old"))
        ).length,
        1,
        "the person's reusable provider connection must survive",
      );
      assert.equal(
        (
          await fixture.db
            .select()
            .from(workspaces)
            .where(eq(workspaces.id, "ws-b"))
        ).length,
        1,
        "another Project must survive",
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("best-effort native byte cleanup cannot roll back a committed Project deletion", async () => {
    const fixture = await seededFixture();
    try {
      await seedProjectChildren(fixture);
      const attempted: string[] = [];
      const result = await createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-byte-failure",
        revokeExactGrant: async () => {},
        deleteStoredBytes: async (storedPath) => {
          attempted.push(storedPath);
          throw new Error("blob unavailable");
        },
      }).delete({ workspaceId: "ws-a", actorUserId: "owner" });

      assert.equal(result.workspaceId, "ws-a");
      assert.deepEqual(attempted, [".data/uploads/local.txt"]);
      assert.equal(await count(fixture, "workspaces"), 0);
      const retained = await fixture.db
        .select({ key: meta.key, value: meta.value })
        .from(meta)
        .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
      assert.equal(retained.length, 1);
      assert.match(retained[0].value, /uploads\/local\.txt/);
    } finally {
      fixture.cleanup();
    }
  });

  it("rolls the cleanup receipt back with Project rows when the final delete fails", async () => {
    const fixture = await seededFixture();
    try {
      await seedProjectChildren(fixture);
      await fixture.client.execute(`
        CREATE TRIGGER refuse_ws_a_delete
        BEFORE DELETE ON workspaces
        WHEN OLD.id = 'ws-a'
        BEGIN
          SELECT RAISE(ABORT, 'simulated final delete failure');
        END
      `);
      let byteCalls = 0;
      await assert.rejects(
        () =>
          createProjectDriveProjectDeletionService({
            database: fixture.db,
            randomOperationId: () => "delete-rollback",
            revokeExactGrant: async () => {},
            deleteStoredBytes: async () => {
              byteCalls += 1;
            },
          }).delete({ workspaceId: "ws-a", actorUserId: "owner" }),
      );
      assert.equal(byteCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(await count(fixture, "attachments"), 1);
      assert.equal(
        (
          await fixture.db
            .select({ key: meta.key })
            .from(meta)
            .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("does not establish deletion while a Signal-native writer is live", async () => {
    const fixture = await seededFixture(false);
    try {
      await fixture.client.execute(`
        INSERT INTO tasks (
          id, workspace_id, title, lane, priority, assignees, created_at, updated_at
        ) VALUES ('task-native-live', 'ws-a', 'Files', 'todo', 'medium', '[]', 10, 10)
      `);
      const pathname = "ws-a/task-native-live/att-native-live-file.pdf";
      await fixture.db.transaction(
        async (transaction) => {
          await transaction.insert(attachments).values({
            id: "att-native-live",
            workspaceId: "ws-a",
            taskId: "task-native-live",
            uploaderUserId: "member-a",
            filename: "file.pdf",
            storedPath: pathname,
            mimeType: "application/pdf",
            sizeBytes: 12,
          });
          await recordNativeUploadClaimInTransaction(transaction, {
            workspaceId: "ws-a",
            attachmentId: "att-native-live",
            pathname,
            authorityExpiresAt: Date.now() + 30 * 60_000,
            cleanupTargetKind: "blob-pathname",
          });
        },
        { behavior: "immediate" },
      );
      let providerCalls = 0;
      await assert.rejects(
        () =>
          createProjectDriveProjectDeletionService({
            database: fixture.db,
            revokeExactGrant: async () => {
              providerCalls += 1;
            },
          }).delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("upload-in-progress"),
      );
      assert.equal(providerCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(await count(fixture, "attachments"), 1);
      assert.equal(
        (
          await fixture.db
            .select({ id: projectDriveOperations.id })
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.operationKind, "project_delete"))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("re-proves primary-owner authority inside the deletion intent transaction", async () => {
    const fixture = await seededFixture();
    try {
      await fixture.db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, "ws-a"),
            eq(workspaceMembers.userId, "owner"),
          ),
        );
      let providerCalls = 0;
      await assert.rejects(
        createProjectDriveProjectDeletionService({
          database: fixture.db,
          revokeExactGrant: async () => {
            providerCalls += 1;
          },
        }).delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("workspace-not-found"),
      );

      assert.equal(providerCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.operationKind, "project_delete"))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("uses the delete intent as a tombstone so a concurrent member writer loses before mutation", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      let blocked = false;
      const result = await createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-member-race",
        revokeExactGrant: async () => {
          await assert.rejects(
            setProjectDriveMemberRole(fixture.db, {
              workspaceId: "ws-a",
              memberUserId: "member-a",
              role: "owner",
            }),
            (error: unknown) => {
              blocked = error instanceof ProjectDeletionInProgressError;
              return blocked;
            },
          );
        },
      }).delete({ workspaceId: "ws-a", actorUserId: "owner" });

      assert.equal(blocked, true);
      assert.equal(result.workspaceId, "ws-a");
      assert.equal(await count(fixture, "workspaces"), 0);
    } finally {
      fixture.cleanup();
    }
  });

  it("retains the Project, exact receipt, storage and retryable delete intent after provider failure", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-provider-failure",
        revokeExactGrant: async () => {
          throw new Error("provider unavailable");
        },
      });
      await assert.rejects(
        service.delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        /provider unavailable/,
      );

      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(await count(fixture, "workspace_storage"), 2);
      assert.equal(await count(fixture, "workspace_members"), 3);
      const [grant] = await fixture.db
        .select()
        .from(driveFolderGrants)
        .where(eq(driveFolderGrants.permissionId, "permission-a"));
      assert.equal(grant?.revokePending, true);
      const [intent] = await fixture.db
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.operationKind, "project_delete"));
      assert.equal(intent?.status, "retry_wait");
      assert.equal(intent?.lastErrorCode, "provider_unavailable");
      assert.equal(intent?.attemptCount, 1);
    } finally {
      fixture.cleanup();
    }
  });

  it("does not start deletion while an earlier revoke-pending lifecycle owns a receipt", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture, { revokePending: true });
      let providerCalls = 0;
      await assert.rejects(
        createProjectDriveProjectDeletionService({
          database: fixture.db,
          revokeExactGrant: async () => {
            providerCalls += 1;
          },
        }).delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("drive-work-in-progress"),
      );
      assert.equal(providerCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.operationKind, "project_delete"))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("replays the same exact permission safely after a transient provider failure", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      const revoked: ExactDriveGrantReceipt[] = [];
      let attempts = 0;
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-provider-replay",
        revokeExactGrant: async (receipt) => {
          revoked.push(receipt);
          attempts += 1;
          if (attempts === 1) throw new Error("temporary outage");
        },
      });
      await assert.rejects(
        service.delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        /temporary outage/,
      );
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      const result = await service.delete({
        workspaceId: "ws-a",
        actorUserId: "owner",
      });
      assert.equal(result.revokedGrantCount, 1);
      assert.equal(revoked.length, 2);
      assert.deepEqual(revoked[1], revoked[0]);
      assert.equal(await count(fixture, "workspaces"), 0);
    } finally {
      fixture.cleanup();
    }
  });

  it("blocks before creating a delete intent when a delegated Drive upload is pending", async () => {
    const fixture = await seededFixture();
    try {
      await fixture.client.executeMultiple(`
        INSERT INTO tasks (
          id, workspace_id, title, lane, priority, assignees, created_at, updated_at
        ) VALUES ('task-upload', 'ws-a', 'Upload', 'todo', 'medium', '[]', 10, 10);
      `);
      await fixture.db.insert(resources).values({
        id: "pending-upload",
        workspaceId: "ws-a",
        taskId: "task-upload",
        kind: "upload",
        provider: "drive",
        storage: "drive",
        storageGenerationId: "gen-current",
        storedPath: "sealed-resumable-session",
        title: "Pending.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_024,
        addedByUserId: "member-a",
        addedAt: 10,
        accessState: "pending",
        countsAgainstStorage: 0,
      });
      let providerCalls = 0;
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        revokeExactGrant: async () => {
          providerCalls += 1;
        },
      });
      await assert.rejects(
        service.delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("upload-in-progress"),
      );
      assert.equal(providerCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.operationKind, "project_delete"))
        ).length,
        0,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("preserves the Project when a delegated upload appears during permission revocation", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      await fixture.client.executeMultiple(`
        INSERT INTO tasks (
          id, workspace_id, title, lane, priority, assignees, created_at, updated_at
        ) VALUES ('task-upload-race', 'ws-a', 'Upload', 'todo', 'medium', '[]', 10, 10);
      `);
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-upload-race",
        revokeExactGrant: async () => {
          await fixture.db.insert(resources).values({
            id: "pending-upload-race",
            workspaceId: "ws-a",
            taskId: "task-upload-race",
            kind: "upload",
            provider: "drive",
            storage: "drive",
            storageGenerationId: "gen-current",
            storedPath: "sealed-resumable-session-race",
            title: "Still uploading.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2_048,
            addedByUserId: "member-a",
            addedAt: 10,
            accessState: "pending",
            countsAgainstStorage: 0,
          });
        },
      });
      await assert.rejects(
        service.delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("upload-in-progress"),
      );
      assert.equal(await count(fixture, "workspaces"), 1);
      assert.equal(await count(fixture, "resources"), 1);
      assert.equal(await count(fixture, "drive_folder_grants"), 1);
    } finally {
      fixture.cleanup();
    }
  });

  it("deletes a Project that has never enabled Drive without calling a provider", async () => {
    const fixture = await seededFixture(false);
    try {
      let providerCalls = 0;
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-no-drive",
        revokeExactGrant: async () => {
          providerCalls += 1;
        },
      });
      const result = await service.delete({
        workspaceId: "ws-a",
        actorUserId: "owner",
      });
      assert.equal(result.revokedGrantCount, 0);
      assert.equal(providerCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 0);
      assert.equal(
        (
          await fixture.db
            .select()
            .from(providerConnections)
            .where(eq(providerConnections.userId, "owner"))
        ).length,
        2,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("revokes a succeeded journal-only permission receipt when its grant row is missing", async () => {
    const fixture = await seededFixture();
    try {
      await createCompletedGrantOperation(fixture, {
        operationId: "grant-journal-only",
        permissionId: "permission-journal-only",
      });
      const revoked: ExactDriveGrantReceipt[] = [];
      await createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-journal-only",
        revokeExactGrant: async (receipt) => {
          revoked.push(receipt);
        },
      }).delete({ workspaceId: "ws-a", actorUserId: "owner" });
      assert.equal(revoked.length, 1);
      assert.equal(revoked[0]?.permissionId, "permission-journal-only");
      assert.equal(revoked[0]?.folderId, "folder-current");
    } finally {
      fixture.cleanup();
    }
  });

  it("rearms a prior untouched cancelled delete lifecycle before retrying", async () => {
    const fixture = await seededFixture(false);
    try {
      const journal = createProjectDriveOperationJournal({
        database: fixture.db,
        randomOperationId: () => "delete-cancelled-old",
      });
      const prepared = await journal.prepare({
        operationKind: "project_delete",
        workspaceId: "ws-a",
      });
      assert.notEqual(prepared.outcome, "conflict");
      if (prepared.outcome === "conflict") return;
      const cancelled = await journal.cancelUnstarted({
        workspaceId: "ws-a",
        operationId: prepared.operation.operationId,
      });
      assert.notEqual(cancelled.outcome, "conflict");

      const result = await createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-rearmed-new",
        revokeExactGrant: async () => undefined,
      }).delete({ workspaceId: "ws-a", actorUserId: "owner" });
      assert.equal(result.workspaceId, "ws-a");
      assert.equal(await count(fixture, "workspaces"), 0);
    } finally {
      fixture.cleanup();
    }
  });

  it("cancels provably untouched Drive work but blocks an attempted in-flight provider outcome", async () => {
    const safeFixture = await seededFixture();
    try {
      await createPendingOperation(safeFixture, "grant-never-started");
      await createProjectDriveProjectDeletionService({
        database: safeFixture.db,
        randomOperationId: () => "delete-after-safe-cancel",
        revokeExactGrant: async () => undefined,
      }).delete({ workspaceId: "ws-a", actorUserId: "owner" });
      assert.equal(await count(safeFixture, "workspaces"), 0);
    } finally {
      safeFixture.cleanup();
    }

    const blockedFixture = await seededFixture();
    try {
      const prepared = await createPendingOperation(
        blockedFixture,
        "grant-running",
      );
      assert.notEqual(prepared.outcome, "conflict");
      if (prepared.outcome === "conflict") return;
      const claimed = await createProjectDriveOperationJournal({
        database: blockedFixture.db,
      }).claim({
        workspaceId: "ws-a",
        operationId: prepared.operation.operationId,
      });
      assert.notEqual(claimed.outcome, "conflict");

      let providerCalls = 0;
      await assert.rejects(
        createProjectDriveProjectDeletionService({
          database: blockedFixture.db,
          revokeExactGrant: async () => {
            providerCalls += 1;
          },
        }).delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("drive-work-in-progress"),
      );
      assert.equal(providerCalls, 0);
      assert.equal(await count(blockedFixture, "workspaces"), 1);
    } finally {
      blockedFixture.cleanup();
    }
  });

  for (const race of ["membership", "storage", "grant", "operation"] as const) {
    it(`preserves all evidence when a concurrent ${race} change invalidates the provider snapshot`, async () => {
      const fixture = await seededFixture();
      try {
        await insertGrant(fixture);
        const service = createProjectDriveProjectDeletionService({
          database: fixture.db,
          randomOperationId: () => `delete-race-${race}`,
          revokeExactGrant: async () => {
            switch (race) {
              case "membership":
                await fixture.db
                  .update(workspaceMembers)
                  .set({ role: "owner" })
                  .where(
                    and(
                      eq(workspaceMembers.workspaceId, "ws-a"),
                      eq(workspaceMembers.userId, "member-a"),
                    ),
                  );
                break;
              case "storage":
                await fixture.db
                  .update(workspaceStorage)
                  .set({ folderId: "folder-raced" })
                  .where(eq(workspaceStorage.id, "gen-current"));
                break;
              case "grant":
                await insertGrant(fixture, {
                  storageGenerationId: "gen-old",
                  permissionId: "permission-raced",
                });
                break;
              case "operation":
                await createPendingOperation(
                  fixture,
                  "grant-raced",
                  "member-b",
                );
                break;
            }
          },
        });

        await assert.rejects(
          service.delete({ workspaceId: "ws-a", actorUserId: "owner" }),
          deletionError("receipt-conflict"),
        );
        assert.equal(await count(fixture, "workspaces"), 1);
        assert.equal(await count(fixture, "workspace_storage"), 2);
        assert.equal(await count(fixture, "workspace_members"), 3);
        assert.ok((await count(fixture, "drive_folder_grants")) >= 1);
        assert.equal(
          (
            await fixture.db
              .select()
              .from(projectDriveOperations)
              .where(eq(projectDriveOperations.operationKind, "project_delete"))
          )[0]?.lastErrorCode,
          "workspace_changed",
        );
      } finally {
        fixture.cleanup();
      }
    });
  }

  it("blocks both before and after provider work when an exact account lineage is fenced", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      await fixture.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("member-a"),
        value: "active:v1",
      });
      let providerCalls = 0;
      const service = createProjectDriveProjectDeletionService({
        database: fixture.db,
        revokeExactGrant: async () => {
          providerCalls += 1;
        },
      });
      await assert.rejects(
        service.delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("account-erasure-in-progress"),
      );
      assert.equal(providerCalls, 0);
      assert.equal(await count(fixture, "workspaces"), 1);
    } finally {
      fixture.cleanup();
    }

    const raceFixture = await seededFixture();
    try {
      await insertGrant(raceFixture);
      await assert.rejects(
        createProjectDriveProjectDeletionService({
          database: raceFixture.db,
          randomOperationId: () => "delete-fence-race",
          revokeExactGrant: async () => {
            await raceFixture.db.insert(meta).values({
              key: googleDriveAccountErasureFenceKey("owner"),
              value: "active:v1",
            });
          },
        }).delete({ workspaceId: "ws-a", actorUserId: "owner" }),
        deletionError("account-erasure-in-progress"),
      );
      assert.equal(await count(raceFixture, "workspaces"), 1);
      assert.equal(await count(raceFixture, "drive_folder_grants"), 1);
    } finally {
      raceFixture.cleanup();
    }
  });

  it("never exposes a provider file-or-folder deletion capability", async () => {
    const fixture = await seededFixture();
    try {
      await insertGrant(fixture);
      const calls: Array<keyof ExactDriveGrantReceipt> = [];
      await createProjectDriveProjectDeletionService({
        database: fixture.db,
        randomOperationId: () => "delete-no-provider-files",
        revokeExactGrant: async (receipt) => {
          calls.push(...(Object.keys(receipt) as Array<keyof typeof receipt>));
        },
      }).delete({ workspaceId: "ws-a", actorUserId: "owner" });
      assert.ok(calls.includes("permissionId"));
      assert.equal(calls.includes("folderId"), true);
      assert.equal(
        ["fileId", "deleteFile", "deleteFolder"].some((key) =>
          calls.includes(key as keyof ExactDriveGrantReceipt),
        ),
        false,
      );
    } finally {
      fixture.cleanup();
    }
  });
});
