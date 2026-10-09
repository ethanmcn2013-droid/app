import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { seedHostedFixture, verifyHostedSeedPrerequisites, sendHostedSeedMessage, sendHostedSeedMessageBatch, hostedSeedRequestId, requireSeedSuccess, remoteHarnessAdapter } from "./hosted-seed";
import { executeConversationBatch } from "../../src/server/conversations/database";
import { ACTORS, allocateLocalServiceTarget, initializeLocalServiceSchema, seedLocalServiceFixture } from "./local-service-harness";
import { localServiceManifest } from "./local-service-run";
import { runWithTargetGuard } from "./contracts/target-manifest.mjs";

test("hosted seeding refuses a target mismatch before making a client or generated write", async () => {
  await assert.rejects(seedHostedFixture({ manifest: { fixtureNamespace: "reliability-test-1234", environment: { kind: "hosted-test", identity: "test" },
    expectedTargetHashes: { tasks: "sha256:" + "0".repeat(64) }, testActors: [] }, observed: { origin: "https://test.example" },
    tasksUrl: "libsql://test.example", tasksToken: "synthetic-token", actors: [] }), /binding_refused/);
});

test("missing current-schema columns stop hosted setup before writes", async () => {
  let reads = 0;
  const fake = { execute: async (statement: unknown) => {
    reads++;
    assert.ok(typeof statement === "string" ? statement.startsWith("PRAGMA") : (statement as { sql: string }).sql.startsWith("SELECT"));
    return { rows: typeof statement === "string" ? [] : [{ id: "verified" }] };
  } } as unknown as Client;
  await assert.rejects(verifyHostedSeedPrerequisites(fake, [0, 1].map((index) => ({ actorId: `actor_${index}`, clerkId: `user_test${index}`, actorHash: "sha256:" + String(index).repeat(64) })), "reliability-test-1234"), /hosted_schema_missing_tasks/);
  assert.equal(reads, 3);
});

test("the hosted seed's first message uses the actual writer and a valid persistent request receipt", async () => {
  const target = await allocateLocalServiceTarget();
  const binding = localServiceManifest(target);
  await runWithTargetGuard({ ...binding, write: async () => {
    const client = createClient({ url: target.databaseUrl });
    try {
      await initializeLocalServiceSchema(client);
      const tiny = await seedLocalServiceFixture(client, "smoke");
      const room = tiny.rooms[0];
      const invalid = await tiny.service.sendMessage({ actorId: ACTORS.writer, input: { projectId: room.projectId, conversationId: room.conversationId,
        expectedAudienceEpoch: room.audienceEpoch, clientRequestId: "seed_message_0", body: "Synthetic invalid ID regression", rootId: null, mentionUserIds: [] } });
      assert.deepEqual(invalid, { ok: false, code: "invalid_input" });
      const first = await sendHostedSeedMessage(tiny.service, ACTORS.writer, room, binding.manifest.fixtureNamespace, 0);
      const replay = await sendHostedSeedMessage(tiny.service, ACTORS.writer, room, binding.manifest.fixtureNamespace, 0);
      assert.deepEqual(replay, first);
      const receipt = await tiny.service.getReceipt({ actorId: ACTORS.writer, projectId: room.projectId, conversationId: room.conversationId,
        clientRequestId: hostedSeedRequestId(binding.manifest.fixtureNamespace, 0, "message") });
      assert.ok(receipt.ok && receipt.value.state === "committed" && receipt.value.receipt.messageId === first.messageId);
      const rows = await client.execute({ sql: "SELECT COUNT(*) AS total FROM conversation_messages WHERE client_request_id=?", args: [first.clientRequestId] });
      assert.equal(Number(rows.rows[0].total), 1);
    } finally { client.close(); }
  } });
});

test("seed diagnostics emit only known failure enums", () => {
  assert.throws(() => requireSeedSuccess({ ok: false, code: "invalid_input" }, "message"), /hosted_seed_message_failed:invalid_input/);
  assert.throws(() => requireSeedSuccess({ ok: false, code: "private SQL details" as "invalid_input" }, "message"), /hosted_seed_message_failed:unknown_failure/);
  for (const kind of ["message", "task"] as const) for (const index of [0, 9_999]) assert.match(hostedSeedRequestId("reliability-abcdefgh", index, kind), /^[A-Za-z0-9_-]{16,128}$/);
});

test("remote seed batches delegate to the same interactive handle and roll back failures", async () => {
  const trace: string[] = [];
  let fail = false;
  const client = { batch: async () => { throw Error("top_level_batch_refused"); }, transaction: async (mode: string) => {
    trace.push(`begin:${mode}`);
    return { execute: async () => { trace.push("proof"); return { rows: [] }; },
      batch: async (statements: unknown[]) => { trace.push("batch"); assert.deepEqual(statements, [{ sql: "INSERT owned", args: ["actor"] }, "INSERT receipt"]);
        if (fail) throw Error("synthetic_batch_failure"); return [{ rows: [] }, { rows: [] }]; },
      commit: async () => { trace.push("commit"); }, rollback: async () => { trace.push("rollback"); } };
  } } as unknown as Client;
  const adapter = remoteHarnessAdapter(client);
  const write = () => adapter.transaction("write", async executor => {
    await executor.execute("SELECT proof");
    await executeConversationBatch(executor, [{ sql: "INSERT owned", args: ["actor"] }, "INSERT receipt"]);
  });
  await write(); assert.deepEqual(trace, ["begin:write", "proof", "batch", "commit"]);
  trace.length = 0; fail = true; await assert.rejects(write(), /synthetic_batch_failure/);
  assert.deepEqual(trace, ["begin:write", "proof", "batch", "rollback"]);
});

test("message-only seed batches overlap different rooms, retain room FIFO and return original index order", async () => {
  const activeRooms = new Set<number>();
  const previous = new Map<number, number>();
  let peak = 0;
  const results = await sendHostedSeedMessageBatch(1_000, 1_060, async index => {
    const room = index % 2 === 0 ? 0 : Math.floor(index / 2) % 10;
    assert.equal(activeRooms.has(room), false, "a room must never have concurrent sends");
    assert.ok(index > (previous.get(room) ?? -1), "a room retains its original sequence");
    previous.set(room, index);
    activeRooms.add(room);
    peak = Math.max(peak, activeRooms.size);
    await new Promise<void>(resolve => setImmediate(resolve));
    activeRooms.delete(room);
    return `message-${index}`;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results, Array.from({ length: 60 }, (_, index) => `message-${index + 1_000}`));
});

test("seed batch failure stops new admissions and drains an already-started peer without retry", async () => {
  let rejectFirst!: (error: Error) => void;
  let finishPeer!: () => void;
  let peerFinished = false;
  const started: number[] = [];
  const first = new Promise<string>((_resolve, reject) => { rejectFirst = reject; });
  const peer = new Promise<string>(resolve => { finishPeer = () => { peerFinished = true; resolve("peer"); }; });
  const failure = new Error("synthetic_send_failure");
  const batch = sendHostedSeedMessageBatch(1_000, 1_020, index => {
    started.push(index);
    return index === 1_000 ? first : peer;
  });
  let settled = false;
  const checked = assert.rejects(batch, error => error === failure).then(() => { settled = true; });
  assert.deepEqual(started, [1_000, 1_003]);
  rejectFirst(failure);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(settled, false, "client lifetime must cover the outstanding peer");
  finishPeer();
  await checked;
  assert.equal(peerFinished, true);
  assert.deepEqual(started, [1_000, 1_003]);
  await assert.rejects(sendHostedSeedMessageBatch(0, 10, async index => index), /batch_invalid/);
  await assert.rejects(sendHostedSeedMessageBatch(1_000, 2_001, async index => index), /batch_invalid/);
});
