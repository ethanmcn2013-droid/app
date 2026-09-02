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
import { eraseAccountData } from "@/server/account-erasure";
import {
  meta,
  projectDriveOperations,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  ProjectDriveOperationInputError,
  type ProjectDriveOperationPrepareInput,
} from "./project-drive-operation-journal";
import {
  createAccountFencedProjectDriveOperationJournal,
} from "./project-drive-operation-orchestrator";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  googleDriveAccountErasureFenceKey,
} from "./project-drive-operation-lifecycle";

const START = Date.parse("2030-01-01T12:00:00.000Z");
const CONFLICT = Object.freeze({ outcome: "conflict" });

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function freshOrchestratorDb() {
  const directory = mkdtempSync(join(tmpdir(), "signal-drive-fence-"));
  const databaseUrl = pathToFileURL(join(directory, "fence.test.db")).href;
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
  await seedFixture(client);
  const database = drizzle(client, { schema });
  return {
    client,
    database,
    cleanup: () => {
      client.close();
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // This process owns the disposable fixture directory.
      }
    },
  };
}

async function seedFixture(client: Client) {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, email, color, initials) VALUES
      ('u-a','clerk-a','a@example.test','#111111','AA'),
      ('u-b','clerk-b','b@example.test','#222222','BB'),
      ('u-member','clerk-member','member@example.test','#333333','MM');

    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-a','ws-a','Project A','u-a'),
      ('ws-b','ws-b','Project B','u-b'),
      ('ws-c','ws-c','Project C','u-a');

    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a','u-a','owner'),
      ('ws-a','u-member','member'),
      ('ws-b','u-b','owner'),
      ('ws-c','u-a','owner');

    INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, provider_account_email,
      root_folder_id, refresh_token_cipher, key_version, scopes, status,
      is_current, connected_at
    ) VALUES
      ('connection-a','u-a','google_drive','provider-a','a@example.test',
       'root-a','cipher-a',1,
       '["https://www.googleapis.com/auth/drive.file"]','active',1,
       ${Math.floor(START / 1_000)}),
      ('connection-b','u-b','google_drive','provider-b','b@example.test',
       'root-b','cipher-b',1,
       '["https://www.googleapis.com/auth/drive.file"]','active',1,
       ${Math.floor(START / 1_000)});

    INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link,
      state, is_current
    ) VALUES
      ('storage-a','ws-a','connection-a','folder-a',
       'https://drive.example.test/folders/a','active',1),
      ('storage-cross','ws-a','connection-b','folder-cross',
       'https://drive.example.test/folders/cross','active',0),
      ('storage-b','ws-b','connection-b','folder-b',
       'https://drive.example.test/folders/b','active',1),
      ('storage-c','ws-c','connection-a','folder-c',
       'https://drive.example.test/folders/c','active',1);
  `);
}

function orchestrator(database: TestDb, operationIds: string[]) {
  return createAccountFencedProjectDriveOperationJournal({
    database,
    randomOperationId: () =>
      operationIds.shift() ?? "unexpected-operation-id",
    leaseDurationMs: 60_000,
    databaseNowSeconds: () => sql<Date>`${Math.floor(START / 1_000)}`,
  });
}

async function putFence(database: TestDb, userId: string) {
  await database.insert(meta).values({
    key: googleDriveAccountErasureFenceKey(userId),
    value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  });
}

async function removeFence(database: TestDb, userId: string) {
  await database
    .delete(meta)
    .where(eq(meta.key, googleDriveAccountErasureFenceKey(userId)));
}

async function seedRunningBlocker(
  database: TestDb,
  id = "running-erasure-blocker",
  dedupeCharacter = "f",
) {
  await database.insert(projectDriveOperations).values({
    id,
    workspaceId: "ws-a",
    operationKind: "project_delete",
    status: "running",
    dedupeKey: dedupeCharacter.repeat(64),
    attemptCount: 1,
    lastAttemptAt: new Date(START),
    leaseExpiresAt: new Date(START + 60_000),
    createdAt: new Date(START),
    updatedAt: new Date(START),
  });
}

async function seedManualRename(
  database: TestDb,
  input: {
    id: string;
    storageGenerationId: string;
    dedupeCharacter: string;
  },
) {
  await database.insert(projectDriveOperations).values({
    id: input.id,
    workspaceId: "ws-a",
    operationKind: "folder_rename",
    status: "manual_attention",
    dedupeKey: input.dedupeCharacter.repeat(64),
    storageGenerationId: input.storageGenerationId,
    workspaceRevision: 3,
    attemptCount: 1,
    lastAttemptAt: new Date(START),
    lastErrorCode: "repair_incomplete",
    createdAt: new Date(START),
    updatedAt: new Date(START),
  });
}

async function seedManualHandover(
  database: TestDb,
  input: {
    id: string;
    workspaceId?: string;
    connectionId: string;
    storageGenerationId: string;
    dedupeCharacter: string;
  },
) {
  await database.insert(projectDriveOperations).values({
    id: input.id,
    workspaceId: input.workspaceId ?? "ws-a",
    operationKind: "storage_handover",
    status: "manual_attention",
    dedupeKey: input.dedupeCharacter.repeat(64),
    connectionId: input.connectionId,
    storageGenerationId: input.storageGenerationId,
    targetStorageGenerationId: `${input.id}-target`,
    attemptCount: 1,
    lastAttemptAt: new Date(START),
    lastErrorCode: "repair_incomplete",
    createdAt: new Date(START),
    updatedAt: new Date(START),
  });
}

async function seedManualProjectDelete(
  database: TestDb,
  id: string,
  dedupeCharacter: string,
) {
  await database.insert(projectDriveOperations).values({
    id,
    workspaceId: "ws-a",
    operationKind: "project_delete",
    status: "manual_attention",
    dedupeKey: dedupeCharacter.repeat(64),
    attemptCount: 1,
    lastAttemptAt: new Date(START),
    lastErrorCode: "repair_incomplete",
    createdAt: new Date(START),
    updatedAt: new Date(START),
  });
}

async function failErasureOnRunningOperation(database: TestDb) {
  await assert.rejects(
    eraseAccountData(database, "clerk-a", {
      openProviderToken: ({ refreshTokenCipher }) => refreshTokenCipher,
    }),
    /Google Drive work is still running/,
  );
}

async function operationStatus(database: TestDb, operationId: string) {
  const [operation] = await database
    .select({ status: projectDriveOperations.status })
    .from(projectDriveOperations)
    .where(eq(projectDriveOperations.id, operationId));
  return operation?.status ?? null;
}

describe("Project Drive operation orchestration · prepare versus erasure", () => {
  it("lets preparation win first, then lets erasure durably cancel untouched work", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      const service = orchestrator(database, ["prepared-before-erasure"]);
      const prepared = await service.prepare({
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 2,
      });
      assert.equal(prepared.outcome, "prepared");
      await seedRunningBlocker(database);

      await failErasureOnRunningOperation(database);

      assert.equal(
        await operationStatus(database, "prepared-before-erasure"),
        "cancelled",
      );
      assert.equal(
        (
          await database
            .select()
            .from(meta)
            .where(
              eq(meta.key, googleDriveAccountErasureFenceKey("u-a")),
            )
        ).length,
        1,
      );
    } finally {
      cleanup();
    }
  });

  it("lets the erasure fence win first without revealing existence", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      await seedRunningBlocker(database);
      await failErasureOnRunningOperation(database);
      const service = orchestrator(database, ["must-not-be-inserted"]);

      const fenced = await service.prepare({
        operationKind: "folder_provision",
        workspaceId: "ws-a",
        connectionId: "connection-a",
        targetStorageGenerationId: "reserved-a",
      });
      const missing = await service.prepare({
        operationKind: "project_delete",
        workspaceId: "workspace-that-does-not-exist",
      });

      assert.deepEqual(fenced, CONFLICT);
      assert.deepEqual(missing, CONFLICT);
      assert.equal(
        await operationStatus(database, "must-not-be-inserted"),
        null,
      );
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation orchestration · claim versus erasure", () => {
  it("retains a claim that wins first and makes erasure fail closed", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      const service = orchestrator(database, ["claimed-before-erasure"]);
      const prepared = await service.prepare({
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 4,
      });
      assert.equal(prepared.outcome, "prepared");
      const claimed = await service.claim({
        workspaceId: "ws-a",
        operationId: prepared.operation.operationId,
      });
      assert.equal(claimed.outcome, "claimed");

      await failErasureOnRunningOperation(database);

      assert.equal(
        await operationStatus(database, "claimed-before-erasure"),
        "running",
      );
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-a",
          operationId: "claimed-before-erasure",
        }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });

  it("makes a later claim lose neutrally after erasure wins", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      const service = orchestrator(database, ["claim-after-erasure"]);
      const prepared = await service.prepare({
        operationKind: "folder_rename",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        workspaceRevision: 5,
      });
      assert.equal(prepared.outcome, "prepared");
      await seedRunningBlocker(database);
      await failErasureOnRunningOperation(database);

      assert.equal(
        await operationStatus(database, "claim-after-erasure"),
        "cancelled",
      );
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-a",
          operationId: "claim-after-erasure",
        }),
        CONFLICT,
      );
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-a",
          operationId: "missing-operation",
        }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation orchestration · manual requeue versus erasure", () => {
  it("lets requeue win first, then erasure returns attempted work to review", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      await seedManualRename(database, {
        id: "requeued-before-erasure",
        storageGenerationId: "storage-a",
        dedupeCharacter: "1",
      });
      const service = orchestrator(database, []);
      const requeued = await service.requeueManualAttention({
        workspaceId: "ws-a",
        operationId: "requeued-before-erasure",
        attemptFence: 1,
      });
      assert.equal(requeued.outcome, "requeued");
      await seedRunningBlocker(database, "requeue-running-blocker", "2");

      await failErasureOnRunningOperation(database);

      assert.equal(
        await operationStatus(database, "requeued-before-erasure"),
        "manual_attention",
      );
    } finally {
      cleanup();
    }
  });

  it("makes a later requeue lose with the same result as a missing row", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      await seedManualRename(database, {
        id: "requeue-after-erasure",
        storageGenerationId: "storage-a",
        dedupeCharacter: "3",
      });
      await seedRunningBlocker(database, "requeue-running-blocker", "4");
      await failErasureOnRunningOperation(database);
      const service = orchestrator(database, []);

      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: "requeue-after-erasure",
          attemptFence: 1,
        }),
        CONFLICT,
      );
      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: "missing-operation",
          attemptFence: 1,
        }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive operation orchestration · complete account lineage", () => {
  it("keeps an unrelated account fully claimable", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      await putFence(database, "u-a");
      const service = orchestrator(database, ["unrelated-operation"]);
      const prepared = await service.prepare({
        operationKind: "folder_rename",
        workspaceId: "ws-b",
        storageGenerationId: "storage-b",
        workspaceRevision: 2,
      });
      assert.equal(prepared.outcome, "prepared");
      const claimed = await service.claim({
        workspaceId: "ws-b",
        operationId: prepared.operation.operationId,
      });
      assert.equal(claimed.outcome, "claimed");
    } finally {
      cleanup();
    }
  });

  it("checks owner, subject, storage owner, and both handover owners", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      const service = orchestrator(database, ["must-never-be-consumed"]);
      const cases: ReadonlyArray<{
        fenceUserId: string;
        input: ProjectDriveOperationPrepareInput;
      }> = [
        {
          fenceUserId: "u-a",
          input: { operationKind: "project_delete", workspaceId: "ws-a" },
        },
        {
          fenceUserId: "u-b",
          input: { operationKind: "project_delete", workspaceId: "ws-a" },
        },
        {
          fenceUserId: "u-b",
          input: {
            operationKind: "folder_provision",
            workspaceId: "ws-c",
            connectionId: "connection-b",
            targetStorageGenerationId: "reserved-by-b",
          },
        },
        {
          fenceUserId: "u-member",
          input: {
            operationKind: "grant_create",
            workspaceId: "ws-a",
            storageGenerationId: "storage-a",
            subjectUserId: "u-member",
            granteeEmail: "member@example.test",
            grantRole: "writer",
          },
        },
        {
          fenceUserId: "u-b",
          input: {
            operationKind: "folder_rename",
            workspaceId: "ws-a",
            storageGenerationId: "storage-cross",
            workspaceRevision: 7,
          },
        },
        {
          fenceUserId: "u-b",
          input: {
            operationKind: "storage_handover",
            workspaceId: "ws-c",
            connectionId: "connection-b",
            storageGenerationId: "storage-c",
            targetStorageGenerationId: "handover-target-owner-b",
          },
        },
        {
          fenceUserId: "u-b",
          input: {
            operationKind: "storage_handover",
            workspaceId: "ws-a",
            connectionId: "connection-a",
            storageGenerationId: "storage-cross",
            targetStorageGenerationId: "handover-source-owner-b",
          },
        },
      ];

      for (const testCase of cases) {
        await putFence(database, testCase.fenceUserId);
        assert.deepEqual(await service.prepare(testCase.input), CONFLICT);
        await removeFence(database, testCase.fenceUserId);
      }
      assert.equal(
        await operationStatus(database, "must-never-be-consumed"),
        null,
      );

      await assert.rejects(
        service.prepare({
          operationKind: "storage_handover",
          workspaceId: "ws-a",
          storageGenerationId: "storage-cross",
          targetStorageGenerationId: "omitted-target-connection",
        } as never),
        ProjectDriveOperationInputError,
      );
    } finally {
      cleanup();
    }
  });

  it("derives claim and requeue identities only from stored rows", async () => {
    const { database, cleanup } = await freshOrchestratorDb();
    try {
      const service = orchestrator(database, [
        "subject-bound-operation",
        "handover-source-bound-operation",
        "handover-target-bound-operation",
        "workspace-storage-bound-delete",
      ]);
      const prepared = await service.prepare({
        operationKind: "grant_create",
        workspaceId: "ws-a",
        storageGenerationId: "storage-a",
        subjectUserId: "u-member",
        granteeEmail: "member@example.test",
        grantRole: "reader",
      });
      assert.equal(prepared.outcome, "prepared");
      await putFence(database, "u-member");
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-a",
          operationId: "subject-bound-operation",
        }),
        CONFLICT,
      );
      await assert.rejects(
        service.claim({
          workspaceId: "ws-a",
          operationId: "subject-bound-operation",
          subjectUserId: "u-a",
        } as never),
        ProjectDriveOperationInputError,
      );
      await removeFence(database, "u-member");

      const sourceBoundHandover = await service.prepare({
        operationKind: "storage_handover",
        workspaceId: "ws-a",
        connectionId: "connection-a",
        storageGenerationId: "storage-cross",
        targetStorageGenerationId: "source-bound-target",
      });
      assert.equal(sourceBoundHandover.outcome, "prepared");
      await putFence(database, "u-b");
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-a",
          operationId: "handover-source-bound-operation",
        }),
        CONFLICT,
      );
      await removeFence(database, "u-b");

      const workspaceStorageBoundDelete = await service.prepare({
        operationKind: "project_delete",
        workspaceId: "ws-a",
      });
      assert.equal(workspaceStorageBoundDelete.outcome, "prepared");
      await putFence(database, "u-b");
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-a",
          operationId: "workspace-storage-bound-delete",
        }),
        CONFLICT,
      );
      await removeFence(database, "u-b");

      const targetBoundHandover = await service.prepare({
        operationKind: "storage_handover",
        workspaceId: "ws-c",
        connectionId: "connection-b",
        storageGenerationId: "storage-c",
        targetStorageGenerationId: "target-bound-target",
      });
      assert.equal(targetBoundHandover.outcome, "prepared");
      await putFence(database, "u-b");
      assert.deepEqual(
        await service.claim({
          workspaceId: "ws-c",
          operationId: "handover-target-bound-operation",
        }),
        CONFLICT,
      );
      await removeFence(database, "u-b");

      await seedManualRename(database, {
        id: "storage-owner-bound-requeue",
        storageGenerationId: "storage-cross",
        dedupeCharacter: "9",
      });
      await putFence(database, "u-b");
      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: "storage-owner-bound-requeue",
          attemptFence: 1,
        }),
        CONFLICT,
      );
      await seedManualProjectDelete(
        database,
        "workspace-storage-bound-delete-requeue",
        "6",
      );
      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: "workspace-storage-bound-delete-requeue",
          attemptFence: 1,
        }),
        CONFLICT,
      );
      await assert.rejects(
        service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: "storage-owner-bound-requeue",
          attemptFence: 1,
          connectionId: "connection-a",
        } as never),
        ProjectDriveOperationInputError,
      );

      await seedManualHandover(database, {
        id: "handover-target-bound-requeue",
        workspaceId: "ws-c",
        connectionId: "connection-b",
        storageGenerationId: "storage-c",
        dedupeCharacter: "8",
      });
      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-c",
          operationId: "handover-target-bound-requeue",
          attemptFence: 1,
        }),
        CONFLICT,
      );
      await seedManualHandover(database, {
        id: "handover-source-bound-requeue",
        connectionId: "connection-a",
        storageGenerationId: "storage-cross",
        dedupeCharacter: "7",
      });
      assert.deepEqual(
        await service.requeueManualAttention({
          workspaceId: "ws-a",
          operationId: "handover-source-bound-requeue",
          attemptFence: 1,
        }),
        CONFLICT,
      );
    } finally {
      cleanup();
    }
  });
});
