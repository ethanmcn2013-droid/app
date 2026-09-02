import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  driveFolderGrants,
  projectDriveOperations,
  workspaceMembers,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  createProjectDriveOperationJournal,
  ProjectDriveOperationInputError,
  type ProjectDriveOperationPrepareInput,
} from "./project-drive-operation-journal";
import { projectDriveOperationDedupeKey } from "./project-drive-operation-key";

const START = Date.parse("2030-01-01T12:00:00.000Z");
const CONFLICT = Object.freeze({ outcome: "conflict" });

type JournalDb = ReturnType<typeof drizzle<typeof schema>>;

async function freshJournalDb() {
  const directory = mkdtempSync(join(tmpdir(), "signal-drive-journal-"));
  const databaseUrl = pathToFileURL(join(directory, "journal.test.db")).href;
  const client = createClient({ url: databaseUrl });
  await client.execute("PRAGMA foreign_keys = OFF");
  const drizzleDir = join(process.cwd(), "drizzle");
  const migrations = readdirSync(drizzleDir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_")
    .sort();
  for (const migration of migrations) {
    await client.executeMultiple(
      readFileSync(join(drizzleDir, migration), "utf8"),
    );
  }
  await client.execute("PRAGMA foreign_keys = ON");
  const foreignKeys = await client.execute("PRAGMA foreign_keys");
  assert.equal(Number(foreignKeys.rows[0]?.foreign_keys), 1);
  const database = drizzle(client, { schema });
  await seedJournalFixture(client);
  return {
    client,
    database,
    cleanup: () => {
      client.close();
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // The process owns its temporary directory on Windows.
      }
    },
  };
}

async function seedJournalFixture(client: Client): Promise<void> {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, email, color, initials) VALUES
      ('u-a', 'clerk-a', 'owner-a@example.test', '#111111', 'AA'),
      ('u-b', 'clerk-b', 'owner-b@example.test', '#222222', 'BB'),
      ('u-member', 'clerk-member', 'member@example.test', '#333333', 'MM'),
      ('u-invitee', 'clerk-invitee', 'invitee@example.test', '#444444', 'II');

    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-a', 'ws-a', 'Project A', 'u-a'),
      ('ws-b', 'ws-b', 'Project B', 'u-b');

    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a', 'u-a', 'owner'),
      ('ws-a', 'u-member', 'member'),
      ('ws-b', 'u-b', 'owner');

    INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, provider_account_email,
      root_folder_id, refresh_token_cipher, key_version, scopes, status,
      is_current, connected_at
    ) VALUES
      ('connection-a', 'u-a', 'google_drive', 'provider-a',
       'owner-a@example.test', 'root-a', 'cipher-a', 1,
       '["https://www.googleapis.com/auth/drive.file"]', 'active', 1,
       ${Math.floor(START / 1_000)}),
      ('connection-a-alt', 'u-member', 'google_drive', 'provider-member',
       'member@example.test', 'root-member', 'cipher-member', 1,
       '["https://www.googleapis.com/auth/drive.file"]', 'active', 1,
       ${Math.floor(START / 1_000)}),
      ('connection-b', 'u-b', 'google_drive', 'provider-b',
       'owner-b@example.test', 'root-b', 'cipher-b', 1,
       '["https://www.googleapis.com/auth/drive.file"]', 'active', 1,
       ${Math.floor(START / 1_000)});

    INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link,
      state, is_current
    ) VALUES
      ('storage-a', 'ws-a', 'connection-a', 'folder-a',
       'https://drive.example.test/folders/a', 'active', 1),
      ('storage-b', 'ws-b', 'connection-b', 'folder-b',
       'https://drive.example.test/folders/b', 'active', 1);
  `);
}

function clock(initial = START) {
  let seconds = Math.floor(initial / 1_000);
  return {
    nowSql: () => sql<Date>`${seconds}`,
    advance: (durationMs: number) => {
      assert.equal(durationMs % 1_000, 0);
      seconds += durationMs / 1_000;
    },
  };
}

function journal(
  database: JournalDb,
  ids: string[],
  time = clock(),
  leaseDurationMs = 10_000,
) {
  return {
    time,
    service: createProjectDriveOperationJournal({
      database,
      randomOperationId: () => ids.shift() ?? "unexpected-operation-id",
      leaseDurationMs,
      databaseNowSeconds: time.nowSql,
    }),
  };
}

async function prepare(
  service: ReturnType<typeof createProjectDriveOperationJournal>,
  input: ProjectDriveOperationPrepareInput,
) {
  const result = await service.prepare(input);
  assert.notEqual(result.outcome, "conflict");
  if (result.outcome === "conflict") throw new Error("unreachable");
  return result.operation;
}

describe("Project Drive operation journal · canonical preparation", () => {
  it("prepares every operation kind idempotently with only its exact shape", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service } = journal(database, [
        "op-provision",
        "op-grant",
        "op-rename",
        "op-delete",
        "op-handover",
        "unused-replay-id",
      ]);

      await prepare(service, {
        operationKind: "folder_provision",
        workspaceId: " ws-a ",
        connectionId: " connection-a ",
        targetStorageGenerationId: " storage-new ",
      });
      await prepare(service, {
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: " Member@Example.TEST ",
        grantRole: "writer",
      });
      await prepare(service, {
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 7,
      });
      await prepare(service, {
        operationKind: "project_delete",
        workspaceId: "ws-a",
      });
      await prepare(service, {
        operationKind: "storage_handover",
        workspaceId: "ws-a",
        connectionId: "connection-a-alt",
        storageGenerationId: "storage-a",
        targetStorageGenerationId: "storage-handover",
      });

      const replay = await service.prepare({
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: "member@example.test",
        grantRole: "writer",
      });
      assert.equal(replay.outcome, "existing");
      if (replay.outcome === "existing") {
        assert.equal(replay.operation.operationId, "op-grant");
      }

      const rows = await database
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.workspaceId, "ws-a"));
      assert.equal(rows.length, 5);
      const grant = rows.find((row) => row.id === "op-grant");
      assert.equal(grant?.granteeEmail, "member@example.test");
      assert.equal(grant?.connectionId, null);
      assert.equal(grant?.providerPermissionId, null);
      assert.equal(grant?.status, "pending");
      assert.equal(grant?.attemptCount, 0);

      const forbiddenSecret = "access-secret-that-must-not-land";
      await assert.rejects(
        service.prepare({
          operationKind: "project_delete",
          workspaceId: "ws-b",
          accessToken: forbiddenSecret,
        } as never),
        ProjectDriveOperationInputError,
      );
      assert.equal(
        JSON.stringify(await database.select().from(projectDriveOperations)).includes(
          forbiddenSecret,
        ),
        false,
      );
    } finally {
      cleanup();
    }
  });

  it("returns the same neutral conflict for unique-key and exact-shape collisions", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service } = journal(database, ["op-one", "op-two", "op-three"]);
      await prepare(service, {
        operationKind: "folder_provision",
        workspaceId: "ws-a",
        connectionId: "connection-a",
        targetStorageGenerationId: "reserved-generation",
      });
      assert.deepEqual(
        await service.prepare({
          operationKind: "folder_provision",
          workspaceId: "ws-a",
          connectionId: "connection-a-alt",
          targetStorageGenerationId: "reserved-generation",
        }),
        CONFLICT,
      );

      const poisonedInput = {
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 99,
      } as const;
      await database.insert(projectDriveOperations).values({
        id: "poisoned-shape",
        workspaceId: "ws-a",
        operationKind: "project_delete",
        dedupeKey: projectDriveOperationDedupeKey(poisonedInput),
        createdAt: new Date(START),
        updatedAt: new Date(START),
      });
      assert.deepEqual(await service.prepare(poisonedInput), CONFLICT);

      const foreignDedupe = projectDriveOperationDedupeKey({
        operationKind: "project_delete",
        workspaceId: "ws-a",
      });
      await database.insert(projectDriveOperations).values({
        id: "foreign-poison",
        workspaceId: "ws-b",
        operationKind: "project_delete",
        dedupeKey: foreignDedupe,
        createdAt: new Date(START),
        updatedAt: new Date(START),
      });
      assert.deepEqual(
        await service.prepare({
          operationKind: "project_delete",
          workspaceId: "ws-a",
        }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation journal · claims and fencing", () => {
  it("uses the database clock for one claim winner and lease recovery", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service, time } = journal(database, ["op-rename"]);
      const operation = await prepare(service, {
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 8,
      });

      const attempts = await Promise.all([
        service.claim({ workspaceId: "ws-a", operationId: operation.operationId }),
        service.claim({ workspaceId: "ws-a", operationId: operation.operationId }),
      ]);
      const winners = attempts.filter((result) => result.outcome === "claimed");
      const losers = attempts.filter((result) => result.outcome === "conflict");
      assert.equal(winners.length, 1);
      assert.equal(losers.length, 1);
      assert.deepEqual(losers[0], CONFLICT);
      const first = winners[0];
      assert.equal(first?.outcome, "claimed");
      if (!first || first.outcome !== "claimed") throw new Error("unreachable");
      assert.equal(first.claim.attemptFence, 1);
      assert.equal(first.claim.operationKind, "folder_rename");

      time.advance(9_000);
      assert.deepEqual(
        await service.claim({ workspaceId: "ws-a", operationId: operation.operationId }),
        CONFLICT,
      );
      time.advance(1_000);
      assert.deepEqual(
        await service.complete({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: first.claim.attemptFence,
          operationKind: "folder_rename",
          receipt: {},
        }),
        CONFLICT,
        "an expired worker must lose authority before another worker reclaims",
      );
      const recovered = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(recovered.outcome, "claimed");
      if (recovered.outcome !== "claimed") throw new Error("unreachable");
      assert.equal(recovered.claim.attemptFence, 2);

      assert.deepEqual(
        await service.complete({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: first.claim.attemptFence,
          operationKind: "folder_rename",
          receipt: {},
        }),
        CONFLICT,
      );
      const completed = await service.complete({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: recovered.claim.attemptFence,
        operationKind: "folder_rename",
        receipt: {},
      });
      assert.equal(completed.outcome, "completed");
      if (completed.outcome !== "completed") throw new Error("unreachable");
      assert.equal(completed.replayed, false);
      assert.equal(completed.operation.status, "succeeded");

      const replay = await service.complete({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: recovered.claim.attemptFence,
        operationKind: "folder_rename",
        receipt: {},
      });
      assert.equal(replay.outcome, "completed");
      if (replay.outcome === "completed") assert.equal(replay.replayed, true);
      assert.deepEqual(
        await service.claim({ workspaceId: "ws-a", operationId: operation.operationId }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });

  it("pins production lease decisions to SQLite time, not process time", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/server/connections/project-drive-operation-journal.ts",
      ),
      "utf8",
    );
    assert.match(source, /sql<Date>`unixepoch\(\)`/);
    assert.doesNotMatch(source, /Date\.now\(|new Date\(/);
  });

  it("claims a retry only when due and records only an allowlisted error", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service, time } = journal(database, ["op-grant"]);
      const operation = await prepare(service, {
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: "member@example.test",
        grantRole: "reader",
      });
      const claimed = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(claimed.outcome, "claimed");
      if (claimed.outcome !== "claimed") throw new Error("unreachable");

      await assert.rejects(
        service.scheduleRetry({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: claimed.claim.attemptFence,
          errorCode: "NETWORK_ERROR",
          retryAfterMs: 5_000,
        } as never),
        (error: unknown) =>
          error instanceof ProjectDriveOperationInputError &&
          error.code === "invalid-error-code",
      );
      await assert.rejects(
        service.scheduleRetry({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: claimed.claim.attemptFence,
          errorCode: "network_error",
          retryAfterMs: 999,
        }),
        /timing/,
      );
      await assert.rejects(
        service.scheduleRetry({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: claimed.claim.attemptFence,
          errorCode: "network_error",
          retryAfterMs: 5_000,
          rawError: "Bearer secret-provider-body",
        } as never),
        (error: unknown) =>
          error instanceof ProjectDriveOperationInputError &&
          error.code === "invalid-shape",
      );

      const scheduled = await service.scheduleRetry({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: claimed.claim.attemptFence,
        errorCode: "network_error",
        retryAfterMs: 5_000,
      });
      assert.equal(scheduled.outcome, "retry_scheduled");
      if (scheduled.outcome !== "retry_scheduled") throw new Error("unreachable");
      assert.equal(scheduled.operation.lastErrorCode, "network_error");
      assert.equal(
        scheduled.operation.nextAttemptAt?.toISOString(),
        "2030-01-01T12:00:05.000Z",
      );

      time.advance(4_000);
      assert.deepEqual(
        await service.claim({ workspaceId: "ws-a", operationId: operation.operationId }),
        CONFLICT,
      );
      time.advance(1_000);
      const retry = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(retry.outcome, "claimed");
      if (retry.outcome !== "claimed") throw new Error("unreachable");
      assert.equal(retry.claim.attemptFence, 2);
      assert.deepEqual(
        await service.markManualAttention({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: 1,
          errorCode: "permission_denied",
        }),
        CONFLICT,
      );
      const manual = await service.markManualAttention({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: retry.claim.attemptFence,
        errorCode: "cannot_invite_non_google_user",
      });
      assert.equal(manual.outcome, "manual_attention");
      if (manual.outcome !== "manual_attention") throw new Error("unreachable");
      assert.equal(manual.operation.nextAttemptAt, null);
      assert.equal(manual.operation.leaseExpiresAt, null);
      assert.deepEqual(
        await service.claim({ workspaceId: "ws-a", operationId: operation.operationId }),
        CONFLICT,
      );

      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: 1,
        }),
        CONFLICT,
      );
      const requeued = await service.requeueManualAttention({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: retry.claim.attemptFence,
      });
      assert.equal(requeued.outcome, "requeued");
      if (requeued.outcome !== "requeued") throw new Error("unreachable");
      assert.equal(requeued.operation.status, "pending");
      assert.equal(
        requeued.operation.lastErrorCode,
        "cannot_invite_non_google_user",
      );
      const resumed = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(resumed.outcome, "claimed");
      if (resumed.outcome !== "claimed") throw new Error("unreachable");
      assert.equal(resumed.claim.attemptFence, 3);

      const [row] = await database
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, operation.operationId));
      assert.equal(row?.lastErrorCode, null);
      assert.equal(JSON.stringify(row).includes("Bearer secret-provider-body"), false);
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation journal · transaction composition", () => {
  it("prepares membership and its grant intent in one atomic transaction", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const time = clock();
      await assert.rejects(
        database.transaction(async (transaction) => {
          await transaction.insert(workspaceMembers).values({
            workspaceId: "ws-a",
            userId: "u-invitee",
            role: "member",
          });
          const transactionalJournal = createProjectDriveOperationJournal({
            database: transaction,
            randomOperationId: () => "op-transaction-rollback",
            leaseDurationMs: 10_000,
            databaseNowSeconds: time.nowSql,
          });
          const intent = await transactionalJournal.prepare({
            operationKind: "grant_create",
            workspaceId: "ws-a",
            storageGenerationId: "storage-a",
            subjectUserId: "u-invitee",
            granteeEmail: "invitee@example.test",
            grantRole: "writer",
          });
          assert.equal(intent.outcome, "prepared");
          throw new Error("rollback membership and intent");
        }),
        /rollback membership and intent/,
      );
      assert.equal(
        (
          await database
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "u-invitee"))
        ).length,
        0,
      );
      assert.equal(
        (
          await database
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.id, "op-transaction-rollback"))
        ).length,
        0,
      );

      await database.transaction(async (transaction) => {
        await transaction.insert(workspaceMembers).values({
          workspaceId: "ws-a",
          userId: "u-invitee",
          role: "member",
        });
        const transactionalJournal = createProjectDriveOperationJournal({
          database: transaction,
          randomOperationId: () => "op-transaction-commit",
          leaseDurationMs: 10_000,
          databaseNowSeconds: time.nowSql,
        });
        const intent = await transactionalJournal.prepare({
          operationKind: "grant_create",
          workspaceId: "ws-a",
          storageGenerationId: "storage-a",
          subjectUserId: "u-invitee",
          granteeEmail: "invitee@example.test",
          grantRole: "writer",
        });
        assert.equal(intent.outcome, "prepared");
      });
      assert.equal(
        (
          await database
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "u-invitee"))
        ).length,
        1,
      );
      assert.equal(
        (
          await database
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.id, "op-transaction-commit"))
        ).length,
        1,
      );
    } finally {
      cleanup();
    }
  });

  it("materializes the provider receipt and domain grant atomically", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const time = clock();
      const { service } = journal(database, ["op-atomic-receipt"], time);
      const operation = await prepare(service, {
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: "member@example.test",
        grantRole: "writer",
      });
      const claimed = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(claimed.outcome, "claimed");
      if (claimed.outcome !== "claimed") throw new Error("unreachable");

      const completeInside = async (
        transaction: Parameters<
          Parameters<typeof database.transaction>[0]
        >[0],
      ) => {
        const transactionalJournal = createProjectDriveOperationJournal({
          database: transaction,
          randomOperationId: () => "unused-operation-id",
          leaseDurationMs: 10_000,
          databaseNowSeconds: time.nowSql,
        });
        const completed = await transactionalJournal.complete({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: claimed.claim.attemptFence,
          operationKind: "grant_create",
          receipt: { providerPermissionId: "permission-atomic" },
        });
        assert.equal(completed.outcome, "completed");
        await transaction.insert(driveFolderGrants).values({
          storageGenerationId: "storage-a",
          workspaceId: "ws-a",
          userId: "u-member",
          permissionId: "permission-atomic",
          grantedEmail: "member@example.test",
          role: "writer",
          grantedAt: new Date(START),
          revokePending: false,
        });
      };

      await assert.rejects(
        database.transaction(async (transaction) => {
          await completeInside(transaction);
          throw new Error("rollback receipt and grant");
        }),
        /rollback receipt and grant/,
      );
      const [afterRollback] = await database
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, operation.operationId));
      assert.equal(afterRollback?.status, "running");
      assert.equal(afterRollback?.providerPermissionId, null);
      assert.equal((await database.select().from(driveFolderGrants)).length, 0);

      await database.transaction(completeInside);
      const [afterCommit] = await database
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, operation.operationId));
      assert.equal(afterCommit?.status, "succeeded");
      assert.equal(afterCommit?.providerPermissionId, "permission-atomic");
      assert.equal((await database.select().from(driveFolderGrants)).length, 1);
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation journal · lifecycle cycles", () => {
  it("rearms a revoked grant without replaying its old terminal receipt", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const time = clock();
      const { service } = journal(database, ["op-grant-cycle"], time);
      const input = {
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: "member@example.test",
        grantRole: "writer",
      } as const;
      const operation = await prepare(service, input);
      const firstClaim = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(firstClaim.outcome, "claimed");
      if (firstClaim.outcome !== "claimed") throw new Error("unreachable");
      await service.complete({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: firstClaim.claim.attemptFence,
        operationKind: "grant_create",
        receipt: { providerPermissionId: "permission-old" },
      });
      await database.insert(driveFolderGrants).values({
        storageGenerationId: "storage-a",
        workspaceId: "ws-a",
        userId: "u-member",
        permissionId: "permission-old",
        grantedEmail: "member@example.test",
        role: "writer",
        grantedAt: new Date(START),
        revokePending: false,
      });

      const terminalReplay = await service.prepare(input);
      assert.equal(terminalReplay.outcome, "existing");
      if (terminalReplay.outcome !== "existing") throw new Error("unreachable");
      assert.equal(terminalReplay.operation.status, "succeeded");

      assert.deepEqual(
        await service.rearmLifecycleOperation({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          operationKind: "grant_create",
          previousAttemptFence: firstClaim.claim.attemptFence,
          previousReceipt: { providerPermissionId: "permission-wrong" },
        }),
        CONFLICT,
      );

      await database.transaction(async (transaction) => {
        await transaction
          .delete(driveFolderGrants)
          .where(
            eq(driveFolderGrants.permissionId, "permission-old"),
          );
        const transactionalJournal = createProjectDriveOperationJournal({
          database: transaction,
          randomOperationId: () => "unused-cycle-id",
          leaseDurationMs: 10_000,
          databaseNowSeconds: time.nowSql,
        });
        const rearmed = await transactionalJournal.rearmLifecycleOperation({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          operationKind: "grant_create",
          previousAttemptFence: firstClaim.claim.attemptFence,
          previousReceipt: { providerPermissionId: "permission-old" },
        });
        assert.equal(rearmed.outcome, "rearmed");
      });

      const nextIntent = await service.prepare(input);
      assert.equal(nextIntent.outcome, "existing");
      if (nextIntent.outcome !== "existing") throw new Error("unreachable");
      assert.equal(nextIntent.operation.status, "pending");
      assert.equal(nextIntent.operation.receipt, null);
      assert.equal(nextIntent.operation.operationId, "unused-cycle-id");
      const nextClaim = await service.claim({
        workspaceId: "ws-a",
        operationId: nextIntent.operation.operationId,
      });
      assert.equal(nextClaim.outcome, "claimed");
      if (nextClaim.outcome !== "claimed") throw new Error("unreachable");
      assert.equal(nextClaim.claim.attemptFence, 1);
      assert.deepEqual(
        await service.complete({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          attemptFence: firstClaim.claim.attemptFence,
          operationKind: "grant_create",
          receipt: { providerPermissionId: "permission-old" },
        }),
        CONFLICT,
        "a prior lifecycle fence must not become valid again",
      );
      const nextDone = await service.complete({
        workspaceId: "ws-a",
        operationId: nextIntent.operation.operationId,
        attemptFence: nextClaim.claim.attemptFence,
        operationKind: "grant_create",
        receipt: { providerPermissionId: "permission-new" },
      });
      assert.equal(nextDone.outcome, "completed");
      if (nextDone.outcome === "completed") {
        assert.deepEqual(nextDone.operation.receipt, {
          providerPermissionId: "permission-new",
        });
      }
    } finally {
      cleanup();
    }
  });

  it("restarts a cancelled project deletion as a fresh pending intent", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service } = journal(database, [
        "op-delete-cycle",
        "op-delete-cycle-next",
      ]);
      const input = {
        operationKind: "project_delete",
        workspaceId: "ws-a",
      } as const;
      const operation = await prepare(service, input);
      await service.cancelUnstarted({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      const oldCycle = await service.prepare(input);
      assert.equal(oldCycle.outcome, "existing");
      if (oldCycle.outcome !== "existing") throw new Error("unreachable");
      assert.equal(oldCycle.operation.status, "cancelled");

      const rearmed = await service.rearmLifecycleOperation({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        operationKind: "project_delete",
        previousAttemptFence: 0,
        previousReceipt: {},
      });
      assert.equal(rearmed.outcome, "rearmed");
      if (rearmed.outcome !== "rearmed") throw new Error("unreachable");
      assert.equal(rearmed.operation.status, "pending");
      assert.equal(rearmed.operation.completedAt, null);
      assert.equal(rearmed.operation.operationId, "op-delete-cycle-next");
      assert.deepEqual(
        await service.rearmLifecycleOperation({
          workspaceId: "ws-a",
          operationId: operation.operationId,
          operationKind: "project_delete",
          previousAttemptFence: 0,
          previousReceipt: {},
        }),
        CONFLICT,
        "the old lifecycle intent id must stay permanently stale",
      );
      const freshCycle = await service.prepare(input);
      assert.equal(freshCycle.outcome, "existing");
      if (freshCycle.outcome !== "existing") throw new Error("unreachable");
      assert.equal(freshCycle.operation.status, "pending");
      assert.equal(freshCycle.operation.operationId, "op-delete-cycle-next");
      const claim = await service.claim({
        workspaceId: "ws-a",
        operationId: freshCycle.operation.operationId,
      });
      assert.equal(claim.outcome, "claimed");
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation journal · terminal receipts", () => {
  it("requires the receipt for the claimed operation kind and replays only an exact receipt", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service } = journal(database, ["op-grant", "op-folder"]);
      const grant = await prepare(service, {
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: "member@example.test",
        grantRole: "writer",
      });
      const grantClaim = await service.claim({
        workspaceId: "ws-a",
        operationId: grant.operationId,
      });
      assert.equal(grantClaim.outcome, "claimed");
      if (grantClaim.outcome !== "claimed") throw new Error("unreachable");

      assert.deepEqual(
        await service.complete({
          workspaceId: "ws-a",
          operationId: grant.operationId,
          attemptFence: grantClaim.claim.attemptFence,
          operationKind: "project_delete",
          receipt: {},
        }),
        CONFLICT,
      );
      await assert.rejects(
        service.complete({
          workspaceId: "ws-a",
          operationId: grant.operationId,
          attemptFence: grantClaim.claim.attemptFence,
          operationKind: "grant_create",
          receipt: {
            providerPermissionId: "permission-a",
            providerBody: "secret-provider-response",
          },
        } as never),
        (error: unknown) =>
          error instanceof ProjectDriveOperationInputError &&
          error.code === "invalid-shape",
      );
      const grantDone = await service.complete({
        workspaceId: "ws-a",
        operationId: grant.operationId,
        attemptFence: grantClaim.claim.attemptFence,
        operationKind: "grant_create",
        receipt: { providerPermissionId: " permission-a " },
      });
      assert.equal(grantDone.outcome, "completed");
      if (grantDone.outcome !== "completed") throw new Error("unreachable");
      assert.deepEqual(grantDone.operation.receipt, {
        providerPermissionId: "permission-a",
      });
      assert.deepEqual(
        await service.complete({
          workspaceId: "ws-a",
          operationId: grant.operationId,
          attemptFence: grantClaim.claim.attemptFence,
          operationKind: "grant_create",
          receipt: { providerPermissionId: "permission-other" },
        }),
        CONFLICT,
      );

      const folder = await prepare(service, {
        operationKind: "folder_provision",
        workspaceId: "ws-a",
        connectionId: "connection-a",
        targetStorageGenerationId: "storage-folder-receipt",
      });
      const folderClaim = await service.claim({
        workspaceId: "ws-a",
        operationId: folder.operationId,
      });
      assert.equal(folderClaim.outcome, "claimed");
      if (folderClaim.outcome !== "claimed") throw new Error("unreachable");
      await assert.rejects(
        service.complete({
          workspaceId: "ws-a",
          operationId: folder.operationId,
          attemptFence: folderClaim.claim.attemptFence,
          operationKind: "folder_provision",
          receipt: {
            providerFolderId: "folder-new",
            providerFolderWebViewLink:
              "https://drive.example.test/folders/new?access_token=secret",
          },
        }),
        (error: unknown) =>
          error instanceof ProjectDriveOperationInputError &&
          error.code === "invalid-receipt",
      );
      const folderDone = await service.complete({
        workspaceId: "ws-a",
        operationId: folder.operationId,
        attemptFence: folderClaim.claim.attemptFence,
        operationKind: "folder_provision",
        receipt: {
          providerFolderId: "folder-new",
          providerFolderWebViewLink: "https://drive.example.test/folders/new",
        },
      });
      assert.equal(folderDone.outcome, "completed");
      if (folderDone.outcome !== "completed") throw new Error("unreachable");
      assert.deepEqual(folderDone.operation.receipt, {
        providerFolderId: "folder-new",
        providerFolderWebViewLink: "https://drive.example.test/folders/new",
      });
    } finally {
      cleanup();
    }
  });

  it("keeps every wrong-workspace transition indistinguishable", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service } = journal(database, ["op-private"]);
      const operation = await prepare(service, {
        operationKind: "project_delete",
        workspaceId: "ws-a",
      });
      assert.deepEqual(
        await service.claim({ workspaceId: "ws-b", operationId: operation.operationId }),
        CONFLICT,
      );
      const claimed = await service.claim({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(claimed.outcome, "claimed");
      if (claimed.outcome !== "claimed") throw new Error("unreachable");
      const fence = claimed.claim.attemptFence;

      const foreignResults = await Promise.all([
        service.complete({
          workspaceId: "ws-b",
          operationId: operation.operationId,
          attemptFence: fence,
          operationKind: "project_delete",
          receipt: {},
        }),
        service.scheduleRetry({
          workspaceId: "ws-b",
          operationId: operation.operationId,
          attemptFence: fence,
          errorCode: "network_error",
          retryAfterMs: 5_000,
        }),
        service.markManualAttention({
          workspaceId: "ws-b",
          operationId: operation.operationId,
          attemptFence: fence,
          errorCode: "repair_incomplete",
        }),
        service.cancelUnstarted({
          workspaceId: "ws-b",
          operationId: operation.operationId,
        }),
      ]);
      assert.deepEqual(foreignResults, [CONFLICT, CONFLICT, CONFLICT, CONFLICT]);

      const done = await service.complete({
        workspaceId: "ws-a",
        operationId: operation.operationId,
        attemptFence: fence,
        operationKind: "project_delete",
        receipt: {},
      });
      assert.equal(done.outcome, "completed");
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation journal · safe cancellation", () => {
  it("cancels only an untouched pending operation and makes replay idempotent", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service, time } = journal(database, ["op-cancel", "op-started"]);
      const untouched = await prepare(service, {
        operationKind: "project_delete",
        workspaceId: "ws-a",
      });
      const cancelled = await service.cancelUnstarted({
        workspaceId: "ws-a",
        operationId: untouched.operationId,
      });
      assert.equal(cancelled.outcome, "cancelled");
      if (cancelled.outcome !== "cancelled") throw new Error("unreachable");
      assert.equal(cancelled.replayed, false);
      assert.equal(cancelled.operation.attemptCount, 0);
      const replay = await service.cancelUnstarted({
        workspaceId: "ws-a",
        operationId: untouched.operationId,
      });
      assert.equal(replay.outcome, "cancelled");
      if (replay.outcome === "cancelled") assert.equal(replay.replayed, true);

      const started = await prepare(service, {
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 21,
      });
      const claim = await service.claim({
        workspaceId: "ws-a",
        operationId: started.operationId,
      });
      assert.equal(claim.outcome, "claimed");
      time.advance(10_000);
      assert.deepEqual(
        await service.cancelUnstarted({
          workspaceId: "ws-a",
          operationId: started.operationId,
        }),
        CONFLICT,
        "an expired lease is still proof that provider work may have begun",
      );
    } finally {
      cleanup();
    }
  });

  it("refuses a pending row that already contains a stable provider receipt", async () => {
    const { database, cleanup } = await freshJournalDb();
    try {
      const { service } = journal(database, ["op-receipted"]);
      const operation = await prepare(service, {
        operationKind: "folder_provision",
        workspaceId: "ws-a",
        connectionId: "connection-a",
        targetStorageGenerationId: "storage-receipted",
      });
      await database
        .update(projectDriveOperations)
        .set({
          providerFolderId: "provider-folder",
          providerFolderWebViewLink: "https://drive.example.test/folders/provider",
        })
        .where(eq(projectDriveOperations.id, operation.operationId));
      assert.deepEqual(
        await service.cancelUnstarted({
          workspaceId: "ws-a",
          operationId: operation.operationId,
        }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });
});
