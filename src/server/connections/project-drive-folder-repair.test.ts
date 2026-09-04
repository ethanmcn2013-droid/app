import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { projectDriveOperations } from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import {
  createProjectDriveFolderRepairService,
  type ProjectDriveFolderRepairDependencies,
} from "./project-drive-folder-repair";
import type { ProjectDriveFolderOperationLocator } from "./project-drive-folder-operation-executor";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";

const START = Date.parse("2030-01-01T12:00:00.000Z");
const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

function clock(initial = START) {
  let seconds = Math.floor(initial / 1_000);
  return {
    nowSql: () => sql<Date>`${seconds}`,
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
type RepairableLocator = Extract<
  ProjectDriveFolderOperationLocator,
  Readonly<{ operationKind: "folder_provision" | "folder_rename" }>
>;

async function prepareRename(
  setup: Fixture,
  input: Readonly<{
    operationId: string;
    workspaceId?: string;
    storageGenerationId?: string;
    workspaceRevision: number;
  }>,
) {
  setup.operationIds.push(input.operationId);
  const prepared = await setup.journal.prepare({
    operationKind: "folder_rename",
    workspaceId: input.workspaceId ?? "ws-a",
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    workspaceRevision: input.workspaceRevision,
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") throw new Error("unreachable");
  return prepared.operation;
}

async function prepareProvision(
  setup: Fixture,
  input: Readonly<{
    operationId: string;
    workspaceId?: string;
    connectionId?: string;
    targetStorageGenerationId: string;
  }>,
) {
  setup.operationIds.push(input.operationId);
  const prepared = await setup.journal.prepare({
    operationKind: "folder_provision",
    workspaceId: input.workspaceId ?? "ws-a",
    connectionId: input.connectionId ?? "conn-new",
    targetStorageGenerationId: input.targetStorageGenerationId,
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") throw new Error("unreachable");
  return prepared.operation;
}

async function prepareHandover(
  setup: Fixture,
  input: Readonly<{
    operationId: string;
    workspaceId?: string;
    connectionId?: string;
    storageGenerationId?: string;
    targetStorageGenerationId: string;
  }>,
) {
  setup.operationIds.push(input.operationId);
  const prepared = await setup.journal.prepare({
    operationKind: "storage_handover",
    workspaceId: input.workspaceId ?? "ws-a",
    connectionId: input.connectionId ?? "conn-new",
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    targetStorageGenerationId: input.targetStorageGenerationId,
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") throw new Error("unreachable");
  return prepared.operation;
}

async function claim(
  setup: Fixture,
  operationId: string,
  workspaceId = "ws-a",
) {
  const claimed = await setup.journal.claim({ workspaceId, operationId });
  assert.equal(claimed.outcome, "claimed");
  if (claimed.outcome !== "claimed") throw new Error("unreachable");
  return claimed.claim;
}

async function claimAndComplete(
  setup: Fixture,
  locator: RepairableLocator,
) {
  const claimed = await setup.journal.claim({
    workspaceId: locator.workspaceId,
    operationId: locator.operationId,
  });
  if (claimed.outcome === "conflict") return claimed;
  assert.equal(claimed.claim.operationKind, locator.operationKind);
  if (locator.operationKind === "folder_provision") {
    return setup.journal.complete({
      workspaceId: locator.workspaceId,
      operationId: locator.operationId,
      attemptFence: claimed.claim.attemptFence,
      operationKind: "folder_provision",
      receipt: {
        providerFolderId: `folder-${locator.operationId}`,
        providerFolderWebViewLink:
          `https://drive.example.test/folders/${locator.operationId}`,
      },
    });
  }
  return setup.journal.complete({
    workspaceId: locator.workspaceId,
    operationId: locator.operationId,
    attemptFence: claimed.claim.attemptFence,
    operationKind: "folder_rename",
    receipt: {},
  });
}

function service(
  setup: Fixture,
  executeFolder: ProjectDriveFolderRepairDependencies["executeFolder"],
) {
  return createProjectDriveFolderRepairService({
    database: setup.db,
    executeFolder,
    databaseNowSeconds: setup.time.nowSql,
  });
}

describe("Project Drive folder repair", () => {
  it("drains pending, due retry and expired-running rows using the database clock", async () => {
    const setup = await fixture();
    await prepareRename(setup, {
      operationId: "01-pending",
      workspaceRevision: 1,
    });
    await prepareRename(setup, {
      operationId: "02-due-retry",
      workspaceRevision: 2,
    });
    await prepareRename(setup, {
      operationId: "03-expired-running",
      workspaceRevision: 3,
    });
    await prepareRename(setup, {
      operationId: "04-future-retry",
      workspaceRevision: 4,
    });

    const dueClaim = await claim(setup, "02-due-retry");
    await setup.journal.scheduleRetry({
      workspaceId: "ws-a",
      operationId: "02-due-retry",
      attemptFence: dueClaim.attemptFence,
      errorCode: "network_error",
      retryAfterMs: 1_000,
    });
    await claim(setup, "03-expired-running");
    const futureClaim = await claim(setup, "04-future-retry");
    await setup.journal.scheduleRetry({
      workspaceId: "ws-a",
      operationId: "04-future-retry",
      attemptFence: futureClaim.attemptFence,
      errorCode: "rate_limited",
      retryAfterMs: 100_000,
    });
    setup.time.advance(11_000);
    await prepareRename(setup, {
      operationId: "05-live-running",
      workspaceRevision: 5,
    });
    await claim(setup, "05-live-running");

    const calls: string[] = [];
    const result = await service(setup, async (locator) => {
      calls.push(locator.operationId);
      return claimAndComplete(setup, locator);
    }).repairReady({ limit: 10 });

    assert.deepEqual(calls, [
      "01-pending",
      "02-due-retry",
      "03-expired-running",
    ]);
    assert.deepEqual(result, {
      scanned: 3,
      attempted: 3,
      completed: 3,
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
      .where(eq(projectDriveOperations.workspaceId, "ws-a"));
    assert.deepEqual(
      untouched
        .filter((row) =>
          row.id === "04-future-retry" || row.id === "05-live-running",
        )
        .sort((left, right) => left.id.localeCompare(right.id)),
      [
        { id: "04-future-retry", status: "retry_wait" },
        { id: "05-live-running", status: "running" },
      ],
    );
  });

  it("bounds validation, scanning and dispatch", async () => {
    const setup = await fixture();
    for (let index = 1; index <= 4; index += 1) {
      await prepareRename(setup, {
        operationId: `bound-${index}`,
        workspaceRevision: index,
      });
    }
    const calls: string[] = [];
    const repair = service(setup, async (locator) => {
      calls.push(locator.operationId);
      return claimAndComplete(setup, locator);
    });

    for (const limit of [0, 1.5, 51, Number.NaN]) {
      await assert.rejects(() => repair.repairReady({ limit }), RangeError);
    }
    const result = await repair.repairReady({ limit: 2 });
    assert.equal(calls.length, 2);
    assert.equal(result.scanned, 2);
    assert.equal(result.attempted, 2);
    assert.equal(result.completed, 2);
  });

  it("keeps manual attention as a barrier for later workspace operations", async () => {
    const setup = await fixture();
    await prepareProvision(setup, {
      operationId: "01-provision-manual",
      targetStorageGenerationId: "manual-target",
    });
    await prepareRename(setup, {
      operationId: "02-rename-must-wait",
      workspaceRevision: 10,
    });
    const calls: string[] = [];
    const repair = service(setup, async (locator) => {
      calls.push(locator.operationId);
      const claimed = await setup.journal.claim({
        workspaceId: locator.workspaceId,
        operationId: locator.operationId,
      });
      if (claimed.outcome === "conflict") return claimed;
      return setup.journal.markManualAttention({
        workspaceId: locator.workspaceId,
        operationId: locator.operationId,
        attemptFence: claimed.claim.attemptFence,
        errorCode: "provider_conflict",
      });
    });

    const first = await repair.repairReady({ limit: 10 });
    assert.deepEqual(calls, ["01-provision-manual"]);
    assert.equal(first.manualAttention, 1);
    assert.equal(first.attempted, 1);
    assert.deepEqual(await repair.repairReady({ limit: 10 }), {
      scanned: 0,
      attempted: 0,
      completed: 0,
      retryScheduled: 0,
      manualAttention: 0,
      skipped: 0,
      failed: 0,
    });
    const rows = await setup.db
      .select({
        id: projectDriveOperations.id,
        status: projectDriveOperations.status,
      })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.workspaceId, "ws-a"));
    assert.deepEqual(
      rows
        .map((row) => [row.id, row.status])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
      [
        ["01-provision-manual", "manual_attention"],
        ["02-rename-must-wait", "pending"],
      ],
    );
  });

  it("lets the journal claim CAS choose one race winner and stays idempotent", async () => {
    const setup = await fixture();
    await prepareRename(setup, {
      operationId: "race-rename",
      workspaceRevision: 20,
    });
    let arrivals = 0;
    let release!: () => void;
    const bothWorkersListed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let providerMutations = 0;
    const repair = service(setup, async (locator) => {
      arrivals += 1;
      if (arrivals === 2) release();
      await bothWorkersListed;
      const claimed = await setup.journal.claim({
        workspaceId: locator.workspaceId,
        operationId: locator.operationId,
      });
      if (claimed.outcome === "conflict") return claimed;
      providerMutations += 1;
      return setup.journal.complete({
        workspaceId: locator.workspaceId,
        operationId: locator.operationId,
        attemptFence: claimed.claim.attemptFence,
        operationKind: "folder_rename",
        receipt: {},
      });
    });

    const results = await Promise.all([
      repair.repairReady({ limit: 1 }),
      repair.repairReady({ limit: 1 }),
    ]);
    assert.equal(arrivals, 2);
    assert.equal(providerMutations, 1);
    assert.equal(
      results.reduce((sum, result) => sum + result.completed, 0),
      1,
    );
    assert.equal(
      results.reduce((sum, result) => sum + result.skipped, 0),
      1,
    );

    assert.deepEqual(await repair.repairReady({ limit: 1 }), {
      scanned: 0,
      attempted: 0,
      completed: 0,
      retryScheduled: 0,
      manualAttention: 0,
      skipped: 0,
      failed: 0,
    });
    assert.equal(providerMutations, 1);
  });

  it("never dispatches any live handover state and preserves its barrier", async () => {
    for (const handoverStatus of [
      "pending",
      "running",
      "retry_wait",
      "manual_attention",
    ] as const) {
      const setup = await fixture();
      await prepareHandover(setup, {
        operationId: "01-handover",
        targetStorageGenerationId: "handover-target",
      });
      if (handoverStatus !== "pending") {
        const handoverClaim = await claim(setup, "01-handover");
        if (handoverStatus === "retry_wait") {
          await setup.journal.scheduleRetry({
            workspaceId: "ws-a",
            operationId: "01-handover",
            attemptFence: handoverClaim.attemptFence,
            errorCode: "network_error",
            retryAfterMs: 1_000,
          });
          setup.time.advance(2_000);
        } else if (handoverStatus === "manual_attention") {
          await setup.journal.markManualAttention({
            workspaceId: "ws-a",
            operationId: "01-handover",
            attemptFence: handoverClaim.attemptFence,
            errorCode: "workspace_changed",
          });
        }
      }
      await prepareRename(setup, {
        operationId: "02-rename-must-wait",
        workspaceRevision: 30,
      });
      await prepareProvision(setup, {
        operationId: "01-provision-other",
        workspaceId: "ws-b",
        connectionId: "conn-other",
        targetStorageGenerationId: "other-target",
      });
      const calls: RepairableLocator[] = [];

      const result = await service(setup, async (locator) => {
        calls.push(locator);
        return claimAndComplete(setup, locator);
      }).repairReady({ limit: 10 });

      assert.deepEqual(
        calls.map((locator) => [
          locator.workspaceId,
          locator.operationId,
          locator.operationKind,
        ]),
        [["ws-b", "01-provision-other", "folder_provision"]],
      );
      assert.equal(result.completed, 1);
      const protectedRows = await setup.db
        .select({
          id: projectDriveOperations.id,
          status: projectDriveOperations.status,
        })
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.workspaceId, "ws-a"));
      assert.deepEqual(
        protectedRows
          .map((row) => [row.id, row.status])
          .sort(([left], [right]) => String(left).localeCompare(String(right))),
        [
          ["01-handover", handoverStatus],
          ["02-rename-must-wait", "pending"],
        ],
      );
    }
  });
});
