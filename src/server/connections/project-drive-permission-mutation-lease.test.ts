import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { meta } from "@/server/db/schema";
import { freshProjectDriveCoreDb } from "./project-drive-core.test.helpers";
import {
  createProjectDrivePermissionMutationLease,
  ProjectDrivePermissionMutationLeaseError,
  projectDrivePermissionMutationLeaseKey,
} from "./project-drive-permission-mutation-lease";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function clock(initialSeconds = 1_000) {
  let seconds = initialSeconds;
  return {
    nowSql: () => sql<Date>`${seconds}`,
    advance(durationMs: number) {
      assert.equal(durationMs % 1_000, 0);
      seconds += durationMs / 1_000;
    },
  };
}

const currentGeneration = Object.freeze({
  workspaceId: "ws-a",
  storageGenerationId: "gen-current",
});

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  cleanups.push(core.cleanup);
  const time = clock();
  let nonce = 0;
  const service = () =>
    createProjectDrivePermissionMutationLease({
      database: core.db,
      leaseDurationMs: 5_000,
      databaseNowSeconds: time.nowSql,
      randomLeaseId: () => `lease-${++nonce}`,
    });
  return { ...core, time, service };
}

describe("Project Drive permission mutation lease", () => {
  it("allows only one service instance to hold an exact generation", async () => {
    const setup = await fixture();
    const instanceA = setup.service();
    const instanceB = setup.service();

    const first = await instanceA.tryAcquire(currentGeneration);
    assert.ok(first);
    assert.equal(await instanceB.tryAcquire(currentGeneration), null);
    await assert.rejects(
      () => instanceB.run(currentGeneration, async () => "never"),
      (error: unknown) =>
        error instanceof ProjectDrivePermissionMutationLeaseError &&
        error.code === "busy" &&
        !error.message.includes(first.token),
    );

    assert.equal(await instanceA.release(first), true);
    assert.ok(await instanceB.tryAcquire(currentGeneration));
  });

  it("recovers an abandoned lease after database-clock expiry", async () => {
    const setup = await fixture();
    const crashedInstance = setup.service();
    const replacementInstance = setup.service();
    const abandoned = await crashedInstance.tryAcquire(currentGeneration);
    assert.ok(abandoned);

    setup.time.advance(5_000);
    const replacement = await replacementInstance.tryAcquire(currentGeneration);
    assert.ok(replacement);
    assert.notEqual(replacement.token, abandoned.token);

    await assert.rejects(
      () => crashedInstance.renew(abandoned),
      (error: unknown) =>
        error instanceof ProjectDrivePermissionMutationLeaseError &&
        error.code === "lost",
    );
    assert.equal(await crashedInstance.release(abandoned), false);
    assert.ok(await replacementInstance.renew(replacement));
  });

  it("isolates different workspaces and immutable storage generations", async () => {
    const setup = await fixture();
    const instanceA = setup.service();
    const instanceB = setup.service();
    const held = await instanceA.tryAcquire(currentGeneration);
    assert.ok(held);

    assert.equal(await instanceB.tryAcquire(currentGeneration), null);
    assert.ok(
      await instanceB.tryAcquire({
        workspaceId: "ws-a",
        storageGenerationId: "gen-old",
      }),
    );
    assert.ok(
      await instanceB.tryAcquire({
        workspaceId: "ws-b",
        storageGenerationId: "gen-current",
      }),
    );
    assert.notEqual(
      projectDrivePermissionMutationLeaseKey({
        workspaceId: "a:b",
        storageGenerationId: "c",
      }),
      projectDrivePermissionMutationLeaseKey({
        workspaceId: "a",
        storageGenerationId: "b:c",
      }),
    );
  });

  it("uses short lease statements and keeps provider work outside a writer transaction", async () => {
    const setup = await fixture();
    const instanceA = setup.service();
    const instanceB = setup.service();
    let providerStarted!: () => void;
    let finishProvider!: () => void;
    const started = new Promise<void>((resolve) => {
      providerStarted = resolve;
    });
    const providerGate = new Promise<void>((resolve) => {
      finishProvider = resolve;
    });

    const running = instanceA.run(currentGeneration, async (lease) => {
      await lease.renew();
      providerStarted();
      await providerGate;
      return "complete";
    });
    await started;

    // A second runtime can execute and commit an unrelated writer statement
    // while the simulated provider request is outstanding.
    await setup.db.insert(meta).values({
      key: "test:provider-io-outside-writer-transaction",
      value: "committed",
    });
    assert.equal(await instanceB.tryAcquire(currentGeneration), null);
    const [written] = await setup.db
      .select({ value: meta.value })
      .from(meta)
      .where(eq(meta.key, "test:provider-io-outside-writer-transaction"));
    assert.equal(written.value, "committed");

    finishProvider();
    assert.equal(await running, "complete");
    assert.ok(await instanceB.tryAcquire(currentGeneration));
  });
});
