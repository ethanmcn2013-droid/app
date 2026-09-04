import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, like, sql } from "drizzle-orm";
import { meta } from "@/server/db/schema";
import { freshProjectDriveCoreDb } from "@/server/connections/project-drive-core.test.helpers";
import {
  createNativeByteCleanupService,
  NATIVE_BYTE_CLEANUP_META_PREFIX,
  stageNativeByteCleanupReceipts,
  stageNativeByteCleanupTargets,
  type NativeByteCleanupTarget,
} from "./native-byte-cleanup";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function clock(initialSeconds = 2_000_000_000) {
  let seconds = initialSeconds;
  return {
    nowSql: () => sql<Date>`${seconds}`,
    advance(durationMs: number) {
      assert.equal(durationMs % 1_000, 0);
      seconds += durationMs / 1_000;
    },
  };
}

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  cleanups.push(core.cleanup);
  const time = clock();
  let nonce = 0;
  return {
    ...core,
    time,
    service(
      deleteTarget: (target: NativeByteCleanupTarget) => Promise<void>,
      options: Readonly<{
        afterDelete?: (target: NativeByteCleanupTarget) => Promise<void>;
      }> = {},
    ) {
      return createNativeByteCleanupService({
        database: core.db,
        deleteTarget,
        databaseNowSeconds: time.nowSql,
        leaseDurationMs: 5_000,
        retryAfterMs: 5_000,
        randomLeaseId: () => `lease-${++nonce}`,
        afterDelete: options.afterDelete,
      });
    },
  };
}

async function receiptRows(
  setup: Awaited<ReturnType<typeof fixture>>,
) {
  return setup.db
    .select({ key: meta.key, value: meta.value })
    .from(meta)
    .where(like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`));
}

describe("durable Signal-native byte cleanup", () => {
  it("keeps exact locator kinds in versioned receipts outside board metadata", async () => {
    const setup = await fixture();
    const keys = await stageNativeByteCleanupTargets(setup.db, "ws-a", [
      { kind: "stored-path", locator: "C:/uploads/native-one.pdf" },
      { kind: "blob-pathname", locator: "ws-a/task-a/claim-two.pdf" },
    ]);

    assert.equal(keys.length, 2);
    assert.ok(keys.every((key) => key.startsWith(NATIVE_BYTE_CLEANUP_META_PREFIX)));
    assert.ok(keys.every((key) => !key.startsWith("board:ws-a:")));
    const values = (await receiptRows(setup)).map((row) => JSON.parse(row.value));
    assert.deepEqual(
      values.map((value) => value.target).sort((a, b) => a.kind.localeCompare(b.kind)),
      [
        { kind: "blob-pathname", locator: "ws-a/task-a/claim-two.pdf" },
        { kind: "stored-path", locator: "C:/uploads/native-one.pdf" },
      ],
    );
  });

  it("retains a failed receipt and removes it only after confirmed success", async () => {
    const setup = await fixture();
    await stageNativeByteCleanupReceipts(setup.db, "ws-a", [
      "C:/uploads/retry.pdf",
    ]);
    const failed = await setup
      .service(async () => {
        throw new Error("store unavailable");
      })
      .repairReady();
    assert.deepEqual(failed, {
      scanned: 1,
      attempted: 1,
      cleaned: 0,
      retryScheduled: 1,
      skipped: 0,
      failed: 1,
    });
    assert.equal((await receiptRows(setup)).length, 1);

    setup.time.advance(5_000);
    const deleted: NativeByteCleanupTarget[] = [];
    const repaired = await setup
      .service(async (target) => {
        deleted.push(target);
      })
      .repairReady();
    assert.equal(repaired.cleaned, 1);
    assert.deepEqual(deleted, [
      { kind: "stored-path", locator: "C:/uploads/retry.pdf" },
    ]);
    assert.equal((await receiptRows(setup)).length, 0);
  });

  it("replays safely after a crash between object deletion and receipt removal", async () => {
    const setup = await fixture();
    await stageNativeByteCleanupReceipts(setup.db, "ws-a", [
      "C:/uploads/already-gone.pdf",
    ]);
    let objectExists = true;
    const crashed = setup.service(
      async () => {
        objectExists = false;
      },
      {
        afterDelete: async () => {
          throw new Error("process died");
        },
      },
    );
    await assert.rejects(() => crashed.repairReady(), /process died/);
    assert.equal(objectExists, false);
    assert.equal((await receiptRows(setup)).length, 1);

    setup.time.advance(5_000);
    let idempotentDeletes = 0;
    const replay = await setup
      .service(async () => {
        idempotentDeletes += 1;
        // The exact object is already missing; the strict storage seam treats
        // that state as confirmed success.
      })
      .repairReady();
    assert.equal(replay.cleaned, 1);
    assert.equal(idempotentDeletes, 1);
    assert.equal((await receiptRows(setup)).length, 0);
  });

  it("allows only one runtime to act on a leased receipt", async () => {
    const setup = await fixture();
    await stageNativeByteCleanupReceipts(setup.db, "ws-a", [
      "C:/uploads/one-owner.pdf",
    ]);
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    let calls = 0;
    const instanceA = setup.service(async () => {
      calls += 1;
      providerStarted();
      await gate;
    });
    const instanceB = setup.service(async () => {
      calls += 1;
    });

    const first = instanceA.repairReady();
    await started;
    const second = await instanceB.repairReady();
    assert.equal(second.attempted, 0);
    releaseProvider();
    assert.equal((await first).cleaned, 1);
    assert.equal(calls, 1);
  });

  it("bounds each cross-tenant run and preserves work for the next pass", async () => {
    const setup = await fixture();
    await stageNativeByteCleanupReceipts(setup.db, "ws-a", [
      "C:/uploads/a.pdf",
      "C:/uploads/b.pdf",
    ]);
    await stageNativeByteCleanupReceipts(setup.db, "ws-b", [
      "C:/uploads/c.pdf",
    ]);
    let calls = 0;
    const service = setup.service(async () => {
      calls += 1;
    });
    const first = await service.repairReady({ limit: 2 });
    assert.equal(first.scanned, 2);
    assert.equal(first.cleaned, 2);
    assert.equal(calls, 2);
    assert.equal((await receiptRows(setup)).length, 1);
    assert.equal((await service.repairReady({ limit: 2 })).cleaned, 1);
  });

  it("isolates partial failure to one exact receipt", async () => {
    const setup = await fixture();
    await stageNativeByteCleanupTargets(setup.db, "ws-a", [
      { kind: "stored-path", locator: "C:/uploads/good.pdf" },
      { kind: "stored-path", locator: "C:/uploads/retry.pdf" },
    ]);
    const result = await setup
      .service(async (target) => {
        if (target.locator.endsWith("retry.pdf")) {
          throw new Error("store unavailable");
        }
      })
      .repairReady();
    assert.deepEqual(result, {
      scanned: 2,
      attempted: 2,
      cleaned: 1,
      retryScheduled: 1,
      skipped: 0,
      failed: 1,
    });
    const [retained] = await receiptRows(setup);
    assert.match(retained.value, /retry\.pdf/);
  });

  it("deduplicates the same authority without resetting an active receipt", async () => {
    const setup = await fixture();
    const target = { kind: "disk-key", locator: "ws-a/task-a/file.bin" } as const;
    const first = await stageNativeByteCleanupTargets(setup.db, "ws-a", [
      target,
      target,
    ]);
    const second = await stageNativeByteCleanupTargets(setup.db, "ws-a", [
      target,
    ]);
    assert.deepEqual(second, first);
    assert.equal((await receiptRows(setup)).length, 1);
  });

  it("retains malformed or key-tampered evidence without touching storage", async () => {
    const setup = await fixture();
    const [key] = await stageNativeByteCleanupReceipts(setup.db, "ws-a", [
      "C:/uploads/evidence.pdf",
    ]);
    const [row] = await receiptRows(setup);
    const parsed = JSON.parse(row.value);
    parsed.target.locator = "C:/uploads/different.pdf";
    await setup.db
      .update(meta)
      .set({ value: JSON.stringify(parsed), updatedAt: new Date(0) })
      .where(eq(meta.key, key));
    let deleteCalls = 0;
    const result = await setup
      .service(async () => {
        deleteCalls += 1;
      })
      .repairReady();
    assert.equal(result.failed, 1);
    assert.equal(deleteCalls, 0);
    assert.equal((await receiptRows(setup)).length, 1);
  });

  it("an exact-key drain cannot consume an unrelated tenant receipt", async () => {
    const setup = await fixture();
    const [wanted] = await stageNativeByteCleanupReceipts(setup.db, "ws-a", [
      "C:/uploads/a.pdf",
    ]);
    await stageNativeByteCleanupReceipts(setup.db, "ws-b", [
      "C:/uploads/b.pdf",
    ]);
    const seen: string[] = [];
    const result = await setup
      .service(async (target) => {
        seen.push(target.locator);
      })
      .repairReady({ keys: [wanted], limit: 1 });
    assert.equal(result.cleaned, 1);
    assert.deepEqual(seen, ["C:/uploads/a.pdf"]);
    assert.equal((await receiptRows(setup)).length, 1);
  });
});
