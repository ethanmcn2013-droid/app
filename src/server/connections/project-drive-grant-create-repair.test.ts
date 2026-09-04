import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  meta,
  projectDriveOperations,
} from "@/server/db/schema";
import { createProjectDriveAccessService } from "./project-drive-access";
import {
  accessDependencies,
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import { createProjectDriveGrantCreateRepairService } from "./project-drive-grant-create-repair";
import { createProjectDriveGrantOperationExecutor } from "./project-drive-grant-operation-executor";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { createAccountFencedProjectDriveOperationJournal } from "./project-drive-operation-orchestrator";

const START = Date.parse("2030-01-01T12:00:00.000Z");
const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function clock(initial = START) {
  let seconds = Math.floor(initial / 1_000);
  return {
    nowSql: () => sql<Date>`${seconds}`,
    nowDate: () => new Date(seconds * 1_000),
    advance(durationMs: number) {
      assert.equal(durationMs % 1_000, 0);
      seconds += durationMs / 1_000;
    },
  };
}

async function fixture() {
  const result = await freshProjectDriveCoreDb();
  cleanups.push(result.cleanup);
  await seedProjectDriveCore(result.client);
  await seedStorageGenerations(result.client);
  await result.client.executeMultiple(`
    INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link,
      state, is_current
    ) VALUES
      ('gen-future', 'ws-a', 'conn-old', 'folder-future',
       'https://drive.example/folder-future', 'active', 0),
      ('gen-live', 'ws-a', 'conn-old', 'folder-live',
       'https://drive.example/folder-live', 'active', 0);
  `);
  await result.client.execute("PRAGMA foreign_keys = ON");
  const time = clock();
  const operationIds: string[] = [];
  const journal = createProjectDriveOperationJournal({
    database: result.db,
    randomOperationId: () =>
      operationIds.shift() ?? "unexpected-operation-id",
    leaseDurationMs: 10_000,
    databaseNowSeconds: time.nowSql,
  });
  return { ...result, time, operationIds, journal };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function prepareGrant(
  setup: Fixture,
  input: Readonly<{
    operationId: string;
    workspaceId?: string;
    storageGenerationId?: string;
    subjectUserId?: string;
    granteeEmail?: string;
  }>,
) {
  setup.operationIds.push(input.operationId);
  const prepared = await setup.journal.prepare({
    operationKind: "grant_create",
    workspaceId: input.workspaceId ?? "ws-a",
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    subjectUserId: input.subjectUserId ?? "member-a",
    granteeEmail: input.granteeEmail ?? "member.a@example.com",
    grantRole: "writer",
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") throw new Error("unreachable");
  assert.equal(prepared.operation.operationId, input.operationId);
  return prepared.operation;
}

async function claim(setup: Fixture, operationId: string, workspaceId = "ws-a") {
  const claimed = await setup.journal.claim({ workspaceId, operationId });
  assert.equal(claimed.outcome, "claimed");
  if (claimed.outcome !== "claimed") throw new Error("unreachable");
  return claimed.claim;
}

async function completeGrant(
  setup: Fixture,
  operationId: string,
  workspaceId = "ws-a",
) {
  const grantClaim = await claim(setup, operationId, workspaceId);
  assert.equal(grantClaim.operationKind, "grant_create");
  if (grantClaim.operationKind !== "grant_create") {
    throw new Error("unreachable");
  }
  return setup.journal.complete({
    workspaceId,
    operationId,
    attemptFence: grantClaim.attemptFence,
    operationKind: "grant_create",
    receipt: { providerPermissionId: `permission-${operationId}` },
  });
}

function service(
  setup: Fixture,
  executeGrant: Parameters<
    typeof createProjectDriveGrantCreateRepairService
  >[0]["executeGrant"],
) {
  return createProjectDriveGrantCreateRepairService({
    database: setup.db,
    executeGrant,
    databaseNowSeconds: setup.time.nowSql,
  });
}

describe("Project Drive grant-create repair", () => {
  it("drains pending, due retry and expired-running heads but leaves future work alone", async () => {
    const setup = await fixture();
    await prepareGrant(setup, {
      operationId: "op-pending",
      storageGenerationId: "gen-current",
    });
    await prepareGrant(setup, {
      operationId: "op-retry",
      storageGenerationId: "gen-old",
    });
    await prepareGrant(setup, {
      operationId: "op-expired",
      workspaceId: "ws-b",
      storageGenerationId: "gen-other",
      subjectUserId: "outsider",
      granteeEmail: "outside@example.com",
    });
    await prepareGrant(setup, {
      operationId: "op-future",
      storageGenerationId: "gen-future",
    });
    await prepareGrant(setup, {
      operationId: "op-live",
      storageGenerationId: "gen-live",
    });

    const retryClaim = await claim(setup, "op-retry");
    await setup.journal.scheduleRetry({
      workspaceId: "ws-a",
      operationId: "op-retry",
      attemptFence: retryClaim.attemptFence,
      errorCode: "network_error",
      retryAfterMs: 1_000,
    });
    await claim(setup, "op-expired", "ws-b");
    const futureClaim = await claim(setup, "op-future");
    await setup.journal.scheduleRetry({
      workspaceId: "ws-a",
      operationId: "op-future",
      attemptFence: futureClaim.attemptFence,
      errorCode: "rate_limited",
      retryAfterMs: 100_000,
    });
    setup.time.advance(11_000);
    await claim(setup, "op-live");

    const calls: string[] = [];
    const result = await service(setup, async (locator) => {
      calls.push(`${locator.workspaceId}/${locator.operationId}`);
      return completeGrant(setup, locator.operationId, locator.workspaceId);
    }).repairReady({ limit: 10 });

    assert.deepEqual(new Set(calls), new Set([
      "ws-a/op-pending",
      "ws-a/op-retry",
      "ws-b/op-expired",
    ]));
    assert.deepEqual(result, {
      scanned: 3,
      attempted: 3,
      completed: 3,
      repairPending: 0,
      retryScheduled: 0,
      manualAttention: 0,
      skipped: 0,
      failed: 0,
    });
    const untouched = await setup.db
      .select({
        id: projectDriveOperations.id,
        status: projectDriveOperations.status,
      })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.operationKind, "grant_create"));
    assert.deepEqual(
      untouched
        .filter((row) => row.id === "op-future" || row.id === "op-live")
        .sort((left, right) => left.id.localeCompare(right.id)),
      [
        { id: "op-future", status: "retry_wait" },
        { id: "op-live", status: "running" },
      ],
    );
  });

  it("round-robins generations while executing one exact folder head at a time", async () => {
    const setup = await fixture();
    await prepareGrant(setup, { operationId: "op-a" });
    await prepareGrant(setup, {
      operationId: "op-b",
      subjectUserId: "member-b",
      granteeEmail: "member.b@example.com",
    });
    await prepareGrant(setup, {
      operationId: "op-c",
      subjectUserId: "outsider",
      granteeEmail: "outside@example.com",
    });
    await prepareGrant(setup, {
      operationId: "op-d",
      storageGenerationId: "gen-old",
    });

    const calls: string[] = [];
    let activeForCurrentGeneration = 0;
    const result = await service(setup, async (locator) => {
      const [row] = await setup.db
        .select({ generation: projectDriveOperations.storageGenerationId })
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, locator.operationId));
      calls.push(locator.operationId);
      if (row.generation === "gen-current") {
        activeForCurrentGeneration += 1;
        assert.equal(activeForCurrentGeneration, 1);
      }
      await Promise.resolve();
      const completed = await completeGrant(
        setup,
        locator.operationId,
        locator.workspaceId,
      );
      if (row.generation === "gen-current") {
        activeForCurrentGeneration -= 1;
      }
      return completed;
    }).repairReady({ limit: 10 });

    assert.deepEqual(calls, ["op-a", "op-d", "op-b", "op-c"]);
    assert.deepEqual(result, {
      scanned: 4,
      attempted: 4,
      completed: 4,
      repairPending: 0,
      retryScheduled: 0,
      manualAttention: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("treats a live lease as a head-of-line barrier for its exact generation", async () => {
    const setup = await fixture();
    await prepareGrant(setup, { operationId: "op-a-live" });
    await prepareGrant(setup, {
      operationId: "op-b-blocked",
      subjectUserId: "member-b",
      granteeEmail: "member.b@example.com",
    });
    await prepareGrant(setup, {
      operationId: "op-c-other",
      storageGenerationId: "gen-old",
    });
    await claim(setup, "op-a-live");

    const calls: string[] = [];
    const result = await service(setup, async (locator) => {
      calls.push(locator.operationId);
      return completeGrant(setup, locator.operationId, locator.workspaceId);
    }).repairReady();

    assert.deepEqual(calls, ["op-c-other"]);
    assert.equal(result.scanned, 1);
    assert.equal(result.completed, 1);
  });

  it("does not skip forward in a generation after a competing worker wins the head", async () => {
    const setup = await fixture();
    await prepareGrant(setup, { operationId: "op-a-conflict" });
    await prepareGrant(setup, {
      operationId: "op-b-must-wait",
      subjectUserId: "member-b",
      granteeEmail: "member.b@example.com",
    });
    await prepareGrant(setup, {
      operationId: "op-c-other",
      storageGenerationId: "gen-old",
    });

    const calls: string[] = [];
    const result = await service(setup, async (locator) => {
      calls.push(locator.operationId);
      if (locator.operationId === "op-a-conflict") {
        return { outcome: "conflict" };
      }
      return completeGrant(setup, locator.operationId, locator.workspaceId);
    }).repairReady();

    assert.deepEqual(calls, ["op-a-conflict", "op-c-other"]);
    assert.equal(result.skipped, 1);
    assert.equal(result.completed, 1);
  });

  it("stops a generation when its head schedules another retry", async () => {
    const setup = await fixture();
    await prepareGrant(setup, { operationId: "op-a-retry" });
    await prepareGrant(setup, {
      operationId: "op-b-must-wait",
      subjectUserId: "member-b",
      granteeEmail: "member.b@example.com",
    });
    const calls: string[] = [];
    const result = await service(setup, async (locator) => {
      calls.push(locator.operationId);
      const grantClaim = await claim(setup, locator.operationId);
      return setup.journal.scheduleRetry({
        workspaceId: locator.workspaceId,
        operationId: locator.operationId,
        attemptFence: grantClaim.attemptFence,
        errorCode: "rate_limited",
        retryAfterMs: 1_000,
      });
    }).repairReady();

    assert.deepEqual(calls, ["op-a-retry"]);
    assert.equal(result.retryScheduled, 1);
    assert.equal(result.attempted, 1);
  });

  it("keeps an exact pending intent after an unexpected worker crash", async () => {
    const setup = await fixture();
    await prepareGrant(setup, { operationId: "op-a-crash" });
    await prepareGrant(setup, {
      operationId: "op-b-must-wait",
      subjectUserId: "member-b",
      granteeEmail: "member.b@example.com",
    });
    const result = await service(setup, async () => {
      throw new Error("opaque provider body");
    }).repairReady();

    assert.equal(result.failed, 1);
    assert.equal(result.attempted, 1);
    const rows = await setup.db
      .select({ id: projectDriveOperations.id, status: projectDriveOperations.status })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.storageGenerationId, "gen-current"));
    assert.deepEqual(rows.map((row) => [row.id, row.status]), [
      ["op-a-crash", "pending"],
      ["op-b-must-wait", "pending"],
    ]);
  });

  it("retains the executor's account-erasure fence before any provider work", async () => {
    const setup = await fixture();
    await prepareGrant(setup, { operationId: "op-fenced" });
    await setup.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("member-a"),
      value: "active:v1",
    });
    const operations = createAccountFencedProjectDriveOperationJournal({
      database: setup.db,
      leaseDurationMs: 10_000,
      databaseNowSeconds: setup.time.nowSql,
    });
    let providerCalls = 0;
    const access = createProjectDriveAccessService(
      accessDependencies(setup.db, async () => {
        providerCalls += 1;
        throw new Error("provider must not be reached");
      }, setup.time.nowDate),
    );
    const executor = createProjectDriveGrantOperationExecutor({
      database: setup.db,
      operations,
      journal: setup.journal,
      journalForTransaction: (database) =>
        createProjectDriveOperationJournal({
          database,
          leaseDurationMs: 10_000,
          databaseNowSeconds: setup.time.nowSql,
        }),
      access,
      recoverOrCreatePermission: async () => {
        providerCalls += 1;
        throw new Error("provider must not be reached");
      },
      databaseNowSeconds: setup.time.nowSql,
    });

    const result = await service(setup, executor.execute).repairReady();

    assert.deepEqual(result, {
      scanned: 1,
      attempted: 1,
      completed: 0,
      repairPending: 0,
      retryScheduled: 0,
      manualAttention: 0,
      skipped: 1,
      failed: 0,
    });
    assert.equal(providerCalls, 0);
    const [operation] = await setup.db
      .select({ status: projectDriveOperations.status })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.id, "op-fenced"));
    assert.equal(operation.status, "pending");
  });

  it("bounds every batch explicitly", async () => {
    const setup = await fixture();
    const repair = service(setup, async () => ({ outcome: "conflict" }));
    for (const limit of [0, 1.5, 51, Number.NaN]) {
      await assert.rejects(() => repair.repairReady({ limit }), RangeError);
    }
  });

  it("never dispatches or scans beyond the accepted batch limit", async () => {
    const setup = await fixture();
    await prepareGrant(setup, {
      operationId: "op-a",
      storageGenerationId: "gen-current",
    });
    await prepareGrant(setup, {
      operationId: "op-b",
      storageGenerationId: "gen-old",
    });
    await prepareGrant(setup, {
      operationId: "op-c",
      storageGenerationId: "gen-future",
    });
    await prepareGrant(setup, {
      operationId: "op-d",
      workspaceId: "ws-b",
      storageGenerationId: "gen-other",
      subjectUserId: "outsider",
      granteeEmail: "outside@example.com",
    });
    const calls: string[] = [];
    const result = await service(setup, async (locator) => {
      calls.push(locator.operationId);
      return completeGrant(setup, locator.operationId, locator.workspaceId);
    }).repairReady({ limit: 2 });

    assert.equal(calls.length, 2);
    assert.equal(result.scanned, 2);
    assert.equal(result.attempted, 2);
  });
});
