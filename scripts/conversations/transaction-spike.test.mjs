import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { tmpdir } from "node:os";
import test, { after } from "node:test";
import {
  FIXTURE,
  LostResponseError,
  SeamFailureError,
  createFreshSpikeDatabase,
  mergeChangePage,
  openConversationSpikeStore,
} from "./transaction-store.mjs";

const configuredWorkDir = process.env.PC04_WORK_DIR;
const workRoot = resolve(configuredWorkDir || join(tmpdir(), "signal-studio-pc04"));
const runId = `run-${new Date().toISOString().replaceAll(":", "-")}-${process.pid}`;
const runDir = join(workRoot, runId);
mkdirSync(runDir, { recursive: true });

const evidence = {
  runId,
  runDir,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  libsqlClient: "0.17.3",
  databases: 0,
  baselineMigrationFiles: 0,
  independentClientsPerCase: 2,
  oracleCases: 13,
  testAssertions: 17,
  duplicateStress: null,
  settings: [],
};

async function scalar(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  const row = result.rows[0];
  if (!row) return undefined;
  const value = Object.values(row)[0];
  return typeof value === "bigint" ? Number(value) : value;
}

async function epoch(client, conversationId) {
  return Number(await scalar(
    client,
    "SELECT audience_epoch FROM conversation_spike_conversations WHERE id = ?",
    [conversationId],
  ));
}

async function counts(client, conversationId = FIXTURE.projectConversationA) {
  const result = {};
  for (const [name, table] of Object.entries({
    messages: "conversation_spike_messages",
    changes: "conversation_spike_changes",
    attention: "conversation_spike_attention",
    outbox: "conversation_spike_outbox",
    receipts: "conversation_spike_receipts",
  })) {
    result[name] = Number(await scalar(client, `SELECT COUNT(*) FROM ${table} WHERE conversation_id = ?`, [conversationId]));
  }
  return result;
}

async function expectSqlReject(client, sql, args, pattern) {
  await assert.rejects(() => client.execute({ sql, args }), pattern);
}

async function freshCase(name, foreignKeys = false) {
  const databasePath = join(runDir, `${name}-fk-${foreignKeys ? "on" : "off"}.db`);
  const setup = await createFreshSpikeDatabase({ databasePath, foreignKeys, busyTimeoutMs: 100 });
  evidence.databases += 1;
  evidence.baselineMigrationFiles = setup.baselineFiles.length;
  setup.client.close();
  const first = await openConversationSpikeStore({ databasePath, foreignKeys, busyTimeoutMs: 100 });
  const second = await openConversationSpikeStore({ databasePath, foreignKeys, busyTimeoutMs: 100 });
  assert.notEqual(first.client, second.client);
  const pragmas = {};
  for (const pragma of ["journal_mode", "foreign_keys", "busy_timeout", "synchronous", "locking_mode", "page_size"]) {
    pragmas[pragma] = await scalar(first.client, `PRAGMA ${pragma}`);
  }
  evidence.settings.push({ name, foreignKeys, databasePath, ...pragmas });
  return {
    databasePath,
    first,
    second,
    close() {
      first.close();
      second.close();
    },
  };
}

function sendInput(overrides = {}) {
  return {
    actorId: FIXTURE.alice,
    projectId: FIXTURE.projectA,
    conversationId: FIXTURE.projectConversationA,
    clientRequestId: "request_default_0001",
    expectedAudienceEpoch: 1,
    body: "Synthetic hello",
    rootId: null,
    mentionUserIds: [FIXTURE.bob],
    ...overrides,
  };
}

test("O01 rolls back source, change, attention, outbox and receipt at every seam", async () => {
  const harness = await freshCase("o01-rollback");
  try {
    for (const seam of ["source", "change", "attention", "outbox", "receipt"]) {
      const input = sendInput({ clientRequestId: `request_rollback_${seam.padEnd(9, "x")}` });
      await assert.rejects(
        () => harness.first.send(input, { failAfter: seam }),
        (error) => error instanceof SeamFailureError && error.seam === seam,
      );
      assert.deepEqual(await counts(harness.second.client), {
        messages: 0, changes: 0, attention: 0, outbox: 0, receipts: 0,
      });
      assert.equal(await scalar(
        harness.second.client,
        "SELECT next_create_seq FROM conversation_spike_conversations WHERE id = ?",
        [FIXTURE.projectConversationA],
      ), 1);
    }
  } finally {
    harness.close();
  }
});

test("O02 recovers the original receipt after a lost post-commit response", async () => {
  const harness = await freshCase("o02-lost-response");
  try {
    const input = sendInput({ clientRequestId: "request_lost_response_0001" });
    await assert.rejects(
      () => harness.first.send(input, { dropResponseAfterCommit: true }),
      (error) => error instanceof LostResponseError,
    );
    const lookup = await harness.second.lookupReceipt(input);
    assert.equal(lookup.ok, true);
    assert.equal(lookup.value.state, "committed");
    assert.equal(lookup.value.receipt.clientRequestId, input.clientRequestId);
    assert.deepEqual(await counts(harness.second.client), {
      messages: 1, changes: 1, attention: 1, outbox: 1, receipts: 1,
    });
  } finally {
    harness.close();
  }
});

test("O03 returns one logical result for 10,000 bounded retries across two independent clients", { timeout: 120_000 }, async () => {
  const harness = await freshCase("o03-duplicate-stress");
  try {
    const input = sendInput({ clientRequestId: "request_duplicate_stress_0001" });
    const latencies = [];
    const started = performance.now();
    const workerCount = 40;
    const submissionsPerWorker = 250;
    const results = await Promise.all(Array.from({ length: workerCount }, async (_, workerIndex) => {
      const store = workerIndex % 2 === 0 ? harness.first : harness.second;
      const values = [];
      for (let index = 0; index < submissionsPerWorker; index += 1) {
        const oneStarted = performance.now();
        values.push(await store.send(input));
        latencies.push(performance.now() - oneStarted);
      }
      return values;
    }));
    const durationMs = performance.now() - started;
    const flattened = results.flat();
    assert.equal(flattened.length, 10_000);
    assert.ok(flattened.every((result) => result.ok));
    assert.equal(new Set(flattened.map((result) => result.value.messageId)).size, 1);
    assert.equal(new Set(flattened.map((result) => result.value.clientRequestId)).size, 1);
    assert.deepEqual(await counts(harness.first.client), {
      messages: 1, changes: 1, attention: 1, outbox: 1, receipts: 1,
    });
    latencies.sort((a, b) => a - b);
    evidence.duplicateStress = {
      submissions: flattened.length,
      concurrency: workerCount,
      maxInteractiveTransactionsPerClient: 1,
      durationMs: Number(durationMs.toFixed(3)),
      throughputPerSecond: Number((flattened.length / (durationMs / 1000)).toFixed(2)),
      latencyMs: {
        p50: Number(latencies[Math.floor(latencies.length * 0.50)].toFixed(3)),
        p95: Number(latencies[Math.floor(latencies.length * 0.95)].toFixed(3)),
        p99: Number(latencies[Math.floor(latencies.length * 0.99)].toFixed(3)),
        max: Number(latencies.at(-1).toFixed(3)),
      },
      transactionAttempts: harness.first.counters.transactionAttempts + harness.second.counters.transactionAttempts,
      busyRetries: harness.first.counters.busyRetries + harness.second.counters.busyRetries,
      observedMaxActiveWriteTransactionsPerClient: Math.max(
        harness.first.counters.maxActiveWriteTransactions,
        harness.second.counters.maxActiveWriteTransactions,
      ),
    };
  } finally {
    harness.close();
  }
});

test("O04 normalizes only line endings and rejects changed payloads for the same request", async () => {
  const harness = await freshCase("o04-payload-conflict");
  try {
    const input = sendInput({
      clientRequestId: "request_payload_conflict_01",
      body: "line one\r\nline two",
      mentionUserIds: [FIXTURE.bob, FIXTURE.bob],
    });
    const original = await harness.first.send(input);
    assert.equal(original.ok, true);
    const normalizedRetry = await harness.second.send({
      ...input,
      body: "line one\nline two",
      mentionUserIds: [FIXTURE.bob],
    });
    assert.equal(normalizedRetry.ok, true);
    assert.equal(normalizedRetry.value.messageId, original.value.messageId);
    for (const changed of [
      { body: "line one\nline two " },
      { rootId: original.value.messageId },
      { mentionUserIds: [FIXTURE.alice, FIXTURE.bob] },
    ]) {
      assert.deepEqual(await harness.second.send({ ...input, ...changed }), { ok: false, code: "request_conflict" });
    }
    assert.deepEqual(await harness.first.send({ ...input, body: null }), { ok: false, code: "invalid_input" });
    const separateRequest = await harness.first.send({
      ...input,
      clientRequestId: "request_same_body_distinct_1",
      body: "line one\nline two",
      mentionUserIds: [FIXTURE.bob],
    });
    assert.equal(separateRequest.ok, true);
    assert.notEqual(separateRequest.value.messageId, original.value.messageId);
    assert.deepEqual(await counts(harness.first.client), {
      messages: 2, changes: 2, attention: 2, outbox: 2, receipts: 2,
    });
  } finally {
    harness.close();
  }
});

test("O05 refuses forged scope and malformed roots or mentions without inserts", async () => {
  const harness = await freshCase("o05-scope-root");
  try {
    const foreignRoot = await harness.first.send(sendInput({
      actorId: FIXTURE.charlie,
      projectId: FIXTURE.projectB,
      conversationId: FIXTURE.projectConversationB,
      clientRequestId: "request_foreign_root_0001",
      mentionUserIds: [],
    }));
    assert.equal(foreignRoot.ok, true);
    const root = await harness.first.send(sendInput({ clientRequestId: "request_local_root_00001" }));
    assert.equal(root.ok, true);
    const reply = await harness.first.send(sendInput({
      clientRequestId: "request_local_reply_0001",
      rootId: root.value.messageId,
    }));
    assert.equal(reply.ok, true);
    const before = await counts(harness.first.client);
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_wrong_project_001",
      projectId: FIXTURE.projectB,
    })), { ok: false, code: "unavailable" });
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_nonmember_00001",
      actorId: FIXTURE.charlie,
    })), { ok: false, code: "unavailable" });
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_wrong_root_0001",
      rootId: foreignRoot.value.messageId,
    })), { ok: false, code: "invalid_input" });
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_reply_to_reply1",
      rootId: reply.value.messageId,
    })), { ok: false, code: "invalid_input" });
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_bad_mention_0001",
      mentionUserIds: [FIXTURE.dave],
    })), { ok: false, code: "invalid_input" });
    assert.deepEqual(await counts(harness.first.client), before);
  } finally {
    harness.close();
  }
});

test("O06 commits removal before send and refuses send, read and receipt on the second client", async () => {
  const harness = await freshCase("o06-remove-before-send");
  try {
    const original = sendInput({ clientRequestId: "request_before_removal_01" });
    assert.equal((await harness.first.send(original)).ok, true);
    const staleEpoch = await epoch(harness.first.client, FIXTURE.projectConversationA);
    await harness.first.client.execute({
      sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectA, FIXTURE.bob],
    });
    const bobScope = {
      actorId: FIXTURE.bob,
      projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA,
    };
    assert.deepEqual(await harness.second.send(sendInput({
      ...bobScope,
      clientRequestId: "request_after_removal_001",
      expectedAudienceEpoch: staleEpoch,
    })), { ok: false, code: "unavailable" });
    assert.deepEqual(await harness.second.readChanges({ ...bobScope, afterChangeSeq: 0 }), { ok: false, code: "unavailable" });
    assert.deepEqual(await harness.second.lookupReceipt({ ...bobScope, clientRequestId: original.clientRequestId }), { ok: false, code: "unavailable" });
    assert.equal((await counts(harness.first.client)).messages, 1);
  } finally {
    harness.close();
  }
});

test("O07 commits send before removal and then denies the departed sender", async () => {
  const harness = await freshCase("o07-send-before-remove");
  try {
    const currentEpoch = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const bobInput = sendInput({
      actorId: FIXTURE.bob,
      clientRequestId: "request_bob_committed_0001",
      expectedAudienceEpoch: currentEpoch,
      mentionUserIds: [FIXTURE.alice],
    });
    const acknowledged = await harness.second.send(bobInput);
    assert.equal(acknowledged.ok, true);
    await harness.first.client.execute({
      sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectA, FIXTURE.bob],
    });
    assert.deepEqual(await harness.second.lookupReceipt(bobInput), { ok: false, code: "unavailable" });
    assert.deepEqual(await harness.second.send(bobInput), { ok: false, code: "unavailable" });
    const aliceRead = await harness.first.readChanges({
      actorId: FIXTURE.alice,
      projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA,
      afterChangeSeq: 0,
    });
    assert.equal(aliceRead.ok, true);
    assert.ok(aliceRead.value.changes.some((change) => change.messageId === acknowledged.value.messageId));
  } finally {
    harness.close();
  }
});

test("O08 every canonical raw writer advances only matching epochs and invalidates stale drafts", async () => {
  const harness = await freshCase("o08-epoch-topology");
  try {
    const a0 = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const dm0 = await epoch(harness.first.client, FIXTURE.dmConversation);
    const b0 = await epoch(harness.first.client, FIXTURE.projectConversationB);
    await harness.first.client.execute({
      sql: "UPDATE workspace_members SET role = 'admin' WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectA, FIXTURE.bob],
    });
    assert.ok(await epoch(harness.first.client, FIXTURE.projectConversationA) > a0);
    assert.ok(await epoch(harness.first.client, FIXTURE.dmConversation) > dm0);
    assert.equal(await epoch(harness.first.client, FIXTURE.projectConversationB), b0);
    const staleEpoch = await epoch(harness.first.client, FIXTURE.projectConversationA);
    await harness.first.client.execute({
      sql: "INSERT INTO workspace_members(workspace_id, user_id, role) VALUES (?, ?, 'member')",
      args: [FIXTURE.projectA, FIXTURE.dave],
    });
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_stale_epoch_0001",
      expectedAudienceEpoch: staleEpoch,
    })), {
      ok: false,
      code: "audience_changed",
      audienceEpoch: await epoch(harness.first.client, FIXTURE.projectConversationA),
    });
    const beforeMoveA = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const beforeMoveB = await epoch(harness.first.client, FIXTURE.projectConversationB);
    await harness.first.client.execute({
      sql: "UPDATE workspace_members SET workspace_id = ? WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectB, FIXTURE.projectA, FIXTURE.dave],
    });
    assert.ok(await epoch(harness.first.client, FIXTURE.projectConversationA) > beforeMoveA);
    assert.ok(await epoch(harness.first.client, FIXTURE.projectConversationB) > beforeMoveB);
    await harness.first.client.execute({
      sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectB, FIXTURE.dave],
    });
    const beforeArchive = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const beforeArchiveInput = sendInput({
      clientRequestId: "request_before_archive_001",
      expectedAudienceEpoch: beforeArchive,
    });
    const beforeArchiveReceipt = await harness.first.send(beforeArchiveInput);
    assert.equal(beforeArchiveReceipt.ok, true);
    await harness.first.client.execute({ sql: "UPDATE workspaces SET archived_at = ? WHERE id = ?", args: [Date.now(), FIXTURE.projectA] });
    assert.ok(await epoch(harness.first.client, FIXTURE.projectConversationA) > beforeArchive);
    const archivedEpoch = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const archivedRecovery = await harness.second.send(beforeArchiveInput);
    assert.equal(archivedRecovery.ok, true);
    assert.equal(archivedRecovery.recovered, true);
    assert.equal(archivedRecovery.value.messageId, beforeArchiveReceipt.value.messageId);
    assert.deepEqual(await harness.second.send({ ...beforeArchiveInput, body: "changed after archive" }), {
      ok: false,
      code: "request_conflict",
    });
    assert.deepEqual(await harness.second.send(sendInput({
      clientRequestId: "request_archived_room_001",
      expectedAudienceEpoch: archivedEpoch,
    })), { ok: false, code: "archived" });
    assert.equal((await harness.second.readChanges({
      actorId: FIXTURE.alice, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA, afterChangeSeq: 0,
    })).ok, true);
    await harness.first.client.execute({ sql: "UPDATE workspaces SET archived_at = NULL WHERE id = ?", args: [FIXTURE.projectA] });
    assert.ok(await epoch(harness.first.client, FIXTURE.projectConversationA) > archivedEpoch);
    const dmBeforeStates = await epoch(harness.first.client, FIXTURE.dmConversation);
    for (const state of ["blocked", "left", "rejoin_pending", "active"]) {
      await harness.first.client.execute({
        sql: "UPDATE conversation_spike_conversations SET pair_state = ? WHERE id = ?",
        args: [state, FIXTURE.dmConversation],
      });
    }
    await harness.first.client.execute({
      sql: "UPDATE conversation_spike_participants SET consented = 0 WHERE conversation_id = ? AND user_id = ?",
      args: [FIXTURE.dmConversation, FIXTURE.bob],
    });
    assert.ok(await epoch(harness.first.client, FIXTURE.dmConversation) >= dmBeforeStates + 5);
    const audienceChanges = await scalar(
      harness.first.client,
      "SELECT COUNT(*) FROM conversation_spike_changes WHERE kind = 'audience'",
    );
    assert.ok(Number(audienceChanges) >= 10);
    await harness.first.client.execute({
      sql: "INSERT INTO workspace_members(workspace_id, user_id, role) VALUES (?, ?, 'member')",
      args: [FIXTURE.projectA, FIXTURE.dave],
    });
    const beforeAccountDelete = await epoch(harness.first.client, FIXTURE.projectConversationA);
    await harness.first.client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [FIXTURE.dave] });
    assert.ok(await epoch(harness.first.client, FIXTURE.projectConversationA) > beforeAccountDelete);
  } finally {
    harness.close();
  }
});

test("O09 membership loss and rejoin preserve only entitled DM history and require both confirmations", async () => {
  const harness = await freshCase("o09-dm-rejoin");
  try {
    let currentEpoch = await epoch(harness.first.client, FIXTURE.dmConversation);
    const original = await harness.first.send(sendInput({
      conversationId: FIXTURE.dmConversation,
      clientRequestId: "request_dm_original_0001",
      expectedAudienceEpoch: currentEpoch,
    }));
    assert.equal(original.ok, true);
    for (const pairState of ["blocked", "left"]) {
      await harness.first.client.execute({
        sql: "UPDATE conversation_spike_conversations SET pair_state = ? WHERE id = ?",
        args: [pairState, FIXTURE.dmConversation],
      });
      currentEpoch = await epoch(harness.first.client, FIXTURE.dmConversation);
      const refused = await harness.second.send(sendInput({
        actorId: FIXTURE.bob,
        conversationId: FIXTURE.dmConversation,
        clientRequestId: `request_dm_${pairState.padEnd(12, "x")}`,
        expectedAudienceEpoch: currentEpoch,
      }));
      assert.deepEqual(refused, { ok: false, code: "read_only" });
      assert.equal((await harness.second.readChanges({
        actorId: FIXTURE.bob, projectId: FIXTURE.projectA,
        conversationId: FIXTURE.dmConversation, afterChangeSeq: 0,
      })).ok, true);
    }
    await harness.first.client.execute({
      sql: "UPDATE conversation_spike_conversations SET pair_state = 'active' WHERE id = ?",
      args: [FIXTURE.dmConversation],
    });
    await harness.first.client.execute({
      sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectA, FIXTURE.bob],
    });
    assert.deepEqual(await harness.second.readChanges({
      actorId: FIXTURE.bob, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation, afterChangeSeq: 0,
    }), { ok: false, code: "unavailable" });
    const aliceRetained = await harness.first.readChanges({
      actorId: FIXTURE.alice, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation, afterChangeSeq: 0,
    });
    assert.equal(aliceRetained.ok, true);
    currentEpoch = await epoch(harness.first.client, FIXTURE.dmConversation);
    assert.deepEqual(await harness.first.send(sendInput({
      conversationId: FIXTURE.dmConversation,
      clientRequestId: "request_dm_member_lost_01",
      expectedAudienceEpoch: currentEpoch,
    })), { ok: false, code: "read_only" });
    const beforeRejoinEpoch = await epoch(harness.first.client, FIXTURE.dmConversation);
    await harness.first.client.execute({
      sql: "INSERT INTO workspace_members(workspace_id, user_id, role) VALUES (?, ?, 'member')",
      args: [FIXTURE.projectA, FIXTURE.bob],
    });
    assert.equal(await scalar(
      harness.first.client,
      "SELECT consented FROM conversation_spike_participants WHERE conversation_id = ? AND user_id = ?",
      [FIXTURE.dmConversation, FIXTURE.bob],
    ), 0);
    assert.deepEqual(await harness.second.readChanges({
      actorId: FIXTURE.bob, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation, afterChangeSeq: 0,
    }), { ok: false, code: "unavailable" });
    assert.deepEqual(await harness.second.confirmDm({
      actorId: FIXTURE.bob, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation, expectedAudienceEpoch: beforeRejoinEpoch,
    }), {
      ok: false,
      code: "audience_changed",
      audienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
    });
    await harness.first.client.execute({
      sql: "UPDATE workspaces SET archived_at = ? WHERE id = ?",
      args: [Date.now(), FIXTURE.projectA],
    });
    assert.deepEqual(await harness.second.confirmDm({
      actorId: FIXTURE.bob, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation,
      expectedAudienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
    }), { ok: false, code: "archived" });
    await harness.first.client.execute({
      sql: "UPDATE workspaces SET archived_at = NULL WHERE id = ?",
      args: [FIXTURE.projectA],
    });
    assert.deepEqual(await harness.second.confirmDm({
      actorId: FIXTURE.bob, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation,
      expectedAudienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
    }), { ok: true, value: { active: false } });
    currentEpoch = await epoch(harness.first.client, FIXTURE.dmConversation);
    assert.deepEqual(await harness.second.send(sendInput({
      actorId: FIXTURE.bob,
      conversationId: FIXTURE.dmConversation,
      clientRequestId: "request_dm_one_consent_001",
      expectedAudienceEpoch: currentEpoch,
    })), { ok: false, code: "read_only" });
    assert.deepEqual(await harness.first.confirmDm({
      actorId: FIXTURE.alice, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation,
      expectedAudienceEpoch: currentEpoch - 1,
    }), { ok: false, code: "audience_changed", audienceEpoch: currentEpoch });
    assert.deepEqual(await harness.first.confirmDm({
      actorId: FIXTURE.alice, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation, expectedAudienceEpoch: currentEpoch,
    }), { ok: true, value: { active: true } });
    currentEpoch = await epoch(harness.first.client, FIXTURE.dmConversation);
    assert.equal((await harness.second.send(sendInput({
      actorId: FIXTURE.bob,
      conversationId: FIXTURE.dmConversation,
      clientRequestId: "request_dm_both_consent_01",
      expectedAudienceEpoch: currentEpoch,
      mentionUserIds: [FIXTURE.alice],
    }))).ok, true);
    assert.deepEqual(await harness.second.readChanges({
      actorId: FIXTURE.charlie, projectId: FIXTURE.projectA,
      conversationId: FIXTURE.dmConversation, afterChangeSeq: 0,
    }), { ok: false, code: "unavailable" });
  } finally {
    harness.close();
  }
});

test("O09 direct confirmation cannot reactivate blocked or left DMs", async () => {
  const harness = await freshCase("o09-restrict-confirm");
  try {
    for (const state of ["blocked", "left"]) {
      await harness.first.client.execute({
        sql: "UPDATE conversation_spike_conversations SET pair_state = ? WHERE id = ?",
        args: [state, FIXTURE.dmConversation],
      });
      assert.deepEqual(await harness.second.confirmDm({
        actorId: FIXTURE.bob,
        projectId: FIXTURE.projectA,
        conversationId: FIXTURE.dmConversation,
        expectedAudienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
      }), { ok: false, code: "read_only" });
      assert.equal(await scalar(
        harness.first.client,
        "SELECT pair_state FROM conversation_spike_conversations WHERE id = ?",
        [FIXTURE.dmConversation],
      ), state);
    }
  } finally {
    harness.close();
  }
});

test("O09 membership churn cannot erase blocked or left DM state", async () => {
  for (const state of ["blocked", "left"]) {
    const harness = await freshCase(`o09-${state}-membership-churn`);
    try {
      await harness.first.client.execute({
        sql: "UPDATE conversation_spike_conversations SET pair_state = ? WHERE id = ?",
        args: [state, FIXTURE.dmConversation],
      });
      await harness.first.client.execute({
        sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
        args: [FIXTURE.projectA, FIXTURE.bob],
      });
      assert.equal(await scalar(
        harness.first.client,
        "SELECT pair_state FROM conversation_spike_conversations WHERE id = ?",
        [FIXTURE.dmConversation],
      ), state);
      await harness.first.client.execute({
        sql: "INSERT INTO workspace_members(workspace_id, user_id, role) VALUES (?, ?, 'member')",
        args: [FIXTURE.projectA, FIXTURE.bob],
      });
      assert.equal(await scalar(
        harness.first.client,
        "SELECT pair_state FROM conversation_spike_conversations WHERE id = ?",
        [FIXTURE.dmConversation],
      ), state);
      for (const [store, actorId] of [[harness.second, FIXTURE.bob], [harness.first, FIXTURE.alice]]) {
        assert.deepEqual(await store.confirmDm({
          actorId,
          projectId: FIXTURE.projectA,
          conversationId: FIXTURE.dmConversation,
          expectedAudienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
        }), { ok: false, code: "read_only" });
      }
      assert.equal(await scalar(
        harness.first.client,
        "SELECT pair_state FROM conversation_spike_conversations WHERE id = ?",
        [FIXTURE.dmConversation],
      ), state);
      assert.equal(await scalar(
        harness.first.client,
        "SELECT SUM(consented) FROM conversation_spike_participants WHERE conversation_id = ?",
        [FIXTURE.dmConversation],
      ), 0);
    } finally {
      harness.close();
    }
  }
});

test("O10 edit/tombstone replay never returns or stores deleted text and ignores stale revisions", async () => {
  const harness = await freshCase("o10-tombstone-replay");
  try {
    const input = sendInput({ clientRequestId: "request_revision_source_01", body: "secret old body" });
    const created = await harness.first.send(input);
    assert.equal(created.ok, true);
    const currentEpoch = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const mutation = {
      actorId: FIXTURE.alice,
      projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA,
      messageId: created.value.messageId,
      expectedAudienceEpoch: currentEpoch,
    };
    assert.deepEqual(await harness.first.edit({ ...mutation, expectedRevision: 1, body: "secret edited body" }), {
      ok: true,
      value: { messageId: created.value.messageId, revision: 2, changeSeq: 2 },
    });
    assert.deepEqual(await harness.second.edit({ ...mutation, expectedRevision: 1, body: "stale resurrection" }), {
      ok: false,
      code: "revision_conflict",
    });
    assert.deepEqual(await harness.first.tombstone({ ...mutation, expectedRevision: 2 }), {
      ok: true,
      value: { messageId: created.value.messageId, revision: 3, changeSeq: 3 },
    });
    const all = await harness.second.readChanges({
      actorId: FIXTURE.bob,
      projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA,
      afterChangeSeq: 0,
      limit: 100,
    });
    assert.equal(all.ok, true);
    assert.equal(all.value.changes.length, 3);
    assert.ok(all.value.changes.every((change) => change.kind === "delete" && change.revision === 3 && change.body === null));
    assert.doesNotMatch(JSON.stringify(all), /secret old body|secret edited body/);
    const ledgerColumns = await harness.first.client.execute("PRAGMA table_info(conversation_spike_changes)");
    assert.equal(ledgerColumns.rows.some((row) => row.name === "body"), false);
    assert.equal(await scalar(
      harness.first.client,
      "SELECT COUNT(*) FROM conversation_spike_messages WHERE body IS NOT NULL AND id = ?",
      [created.value.messageId],
    ), 0);
    let replay = new Map();
    replay = mergeChangePage(replay, [...all.value.changes].reverse());
    replay = mergeChangePage(replay, all.value.changes);
    assert.deepEqual(replay.get(created.value.messageId), {
      messageId: created.value.messageId,
      revision: 3,
      body: null,
      deleted: true,
    });
  } finally {
    harness.close();
  }
});

for (const foreignKeys of [false, true]) {
  test(`O11 rejects malformed tenant/root/pair relationships with foreign keys ${foreignKeys ? "on" : "off"}`, async () => {
    const harness = await freshCase("o11-integrity", foreignKeys);
    try {
      const now = Date.now();
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_conversations
          (id, workspace_id, kind, created_by, created_at) VALUES ('bad-null-room', NULL, 'project', ?, ?)`,
        [FIXTURE.alice, now],
        /NOT NULL|invalid_conversation_workspace/,
      );
      for (const [id, low, high] of [
        ["bad-same-pair", FIXTURE.alice, FIXTURE.alice],
        ["bad-reversed-pair", FIXTURE.bob, FIXTURE.alice],
        ["bad-foreign-pair", FIXTURE.alice, FIXTURE.charlie],
      ]) {
        await expectSqlReject(
          harness.first.client,
          `INSERT INTO conversation_spike_conversations
            (id, workspace_id, kind, dm_low_user_id, dm_high_user_id, pair_state, created_by, created_at)
            VALUES (?, ?, 'dm', ?, ?, 'active', ?, ?)`,
          [id, FIXTURE.projectA, low, high, FIXTURE.alice, now],
          /CHECK|invalid_dm_pair/,
        );
      }
      const root = await harness.first.send(sendInput({ clientRequestId: `request_integrity_root_${foreignKeys ? "on" : "off"}`.padEnd(24, "x") }));
      const reply = await harness.first.send(sendInput({
        clientRequestId: `request_integrity_reply_${foreignKeys ? "on" : "off"}`.padEnd(25, "x"),
        rootId: root.value.messageId,
      }));
      const dmSource = await harness.first.send(sendInput({
        conversationId: FIXTURE.dmConversation,
        clientRequestId: `request_integrity_dm_${foreignKeys ? "on" : "off"}`.padEnd(24, "x"),
        expectedAudienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
      }));
      assert.equal(dmSource.ok, true);
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_messages
          (id, conversation_id, workspace_id, author_id, root_id, create_seq, revision, body, created_at)
          VALUES ('bad-null-tenant', ?, NULL, ?, NULL, 90, 1, 'x', ?)`,
        [FIXTURE.projectConversationA, FIXTURE.alice, now],
        /NOT NULL|invalid_message_tenant/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_messages
          (id, conversation_id, workspace_id, author_id, root_id, create_seq, revision, body, created_at)
          VALUES ('bad-cross-tenant', ?, ?, ?, NULL, 91, 1, 'x', ?)`,
        [FIXTURE.projectConversationA, FIXTURE.projectB, FIXTURE.alice, now],
        /invalid_message_tenant/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_messages
          (id, conversation_id, workspace_id, author_id, root_id, create_seq, revision, body, created_at)
          VALUES ('bad-missing-root', ?, ?, ?, 'missing-root', 92, 1, 'x', ?)`,
        [FIXTURE.projectConversationA, FIXTURE.projectA, FIXTURE.alice, now],
        /invalid_message_root|FOREIGN KEY/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_messages
          (id, conversation_id, workspace_id, author_id, root_id, create_seq, revision, body, created_at)
          VALUES ('bad-reply-root', ?, ?, ?, ?, 93, 1, 'x', ?)`,
        [FIXTURE.projectConversationA, FIXTURE.projectA, FIXTURE.alice, reply.value.messageId, now],
        /invalid_message_root/,
      );
      await harness.first.client.execute({
        sql: "INSERT INTO workspace_members(workspace_id, user_id, role) VALUES (?, ?, 'member'), (?, ?, 'member')",
        args: [FIXTURE.projectA, FIXTURE.dave, FIXTURE.projectA, FIXTURE.charlie],
      });
      assert.deepEqual(await harness.first.send(sendInput({
        conversationId: FIXTURE.dmConversation,
        clientRequestId: `request_bad_dm_mention_${foreignKeys ? "on" : "off"}`.padEnd(26, "x"),
        expectedAudienceEpoch: await epoch(harness.first.client, FIXTURE.dmConversation),
        mentionUserIds: [FIXTURE.dave],
      })), { ok: false, code: "invalid_input" });
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_messages
          (id, conversation_id, workspace_id, author_id, root_id, create_seq, revision, body, created_at)
          VALUES ('bad-dm-third-author', ?, ?, ?, NULL, 94, 1, 'x', ?)`,
        [FIXTURE.dmConversation, FIXTURE.projectA, FIXTURE.dave, now],
        /invalid_dm_author/,
      );
      await expectSqlReject(
        harness.first.client,
        "UPDATE conversation_spike_participants SET user_id = ? WHERE conversation_id = ? AND user_id = ?",
        [FIXTURE.dave, FIXTURE.dmConversation, FIXTURE.bob],
        /immutable_dm_participant/,
      );
      await expectSqlReject(
        harness.first.client,
        "UPDATE workspace_members SET workspace_id = ? WHERE workspace_id = ? AND user_id = ?",
        [FIXTURE.projectB, FIXTURE.projectA, FIXTURE.bob],
        /dm_membership_key_immutable/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_changes
          (conversation_id, change_seq, kind, message_id, revision, audience_epoch, happened_at)
          VALUES (?, 95, 'edit', ?, 99, 1, ?)`,
        [FIXTURE.projectConversationA, root.value.messageId, now],
        /invalid_change_source/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_receipts
          (conversation_id, actor_id, client_request_id, payload_hash, message_id, create_seq, change_seq, revision, committed_at)
          VALUES (?, ?, 'bad_receipt_source_0001', 'hash', ?, 1, 96, 1, ?)`,
        [FIXTURE.projectConversationA, FIXTURE.bob, root.value.messageId, now],
        /invalid_receipt_source/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_attention
          (id, conversation_id, workspace_id, recipient_id, message_id, root_id, create_seq)
          VALUES ('bad-dm-attention', ?, ?, ?, ?, NULL, 1)`,
        [FIXTURE.dmConversation, FIXTURE.projectA, FIXTURE.charlie, dmSource.value.messageId],
        /invalid_dm_attention_recipient/,
      );
      await expectSqlReject(
        harness.first.client,
        `INSERT INTO conversation_spike_outbox
          (id, conversation_id, workspace_id, recipient_id, message_id, state, created_at)
          VALUES ('bad-dm-outbox', ?, ?, ?, ?, 'pending', ?)`,
        [FIXTURE.dmConversation, FIXTURE.projectA, FIXTURE.charlie, dmSource.value.messageId, now],
        /invalid_dm_outbox_recipient/,
      );
      await harness.first.client.execute({ sql: "DELETE FROM workspaces WHERE id = ?", args: [FIXTURE.projectA] });
      for (const table of [
        "conversation_spike_conversations", "conversation_spike_participants", "conversation_spike_messages",
        "conversation_spike_changes", "conversation_spike_receipts", "conversation_spike_attention", "conversation_spike_outbox",
      ]) {
        assert.equal(Number(await scalar(harness.first.client, `SELECT COUNT(*) FROM ${table}`)), table === "conversation_spike_conversations" ? 1 : 0);
      }
    } finally {
      harness.close();
    }
  });
}

test("O12 ordinary Project audience is not automatically directed attention", async () => {
  const harness = await freshCase("o12-directed-audience");
  try {
    await harness.first.client.execute({
      sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,?,'member',?)",
      args: [FIXTURE.projectA, FIXTURE.dave, Date.now()],
    });
    const currentEpoch = await epoch(harness.first.client, FIXTURE.projectConversationA);
    const sent = await harness.first.send(sendInput({ clientRequestId: "request_directed_audience_01", expectedAudienceEpoch: currentEpoch }));
    assert.equal(sent.ok, true);
    assert.equal(await scalar(harness.first.client, "SELECT COUNT(*) FROM conversation_spike_attention WHERE recipient_id=?", [FIXTURE.bob]), 1);
    assert.equal(await scalar(harness.first.client, "SELECT COUNT(*) FROM conversation_spike_attention WHERE recipient_id=?", [FIXTURE.dave]), 0);
    assert.equal(await scalar(harness.first.client, "SELECT COUNT(*) FROM conversation_spike_outbox WHERE recipient_id=?", [FIXTURE.dave]), 0);
    assert.equal((await harness.second.readChanges({ actorId: FIXTURE.dave, projectId: FIXTURE.projectA, conversationId: FIXTURE.projectConversationA })).ok, true);
  } finally { harness.close(); }
});

test("O12 in-app attention commits without a worker and root observation leaves hidden replies unread", async () => {
  const harness = await freshCase("o12-attention");
  try {
    const root = await harness.first.send(sendInput({ clientRequestId: "request_attention_root_001" }));
    const reply = await harness.first.send(sendInput({
      clientRequestId: "request_attention_reply_01",
      rootId: root.value.messageId,
    }));
    assert.equal(reply.ok, true);
    const scope = {
      actorId: FIXTURE.bob,
      projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA,
    };
    const before = await harness.second.listAttention(scope);
    assert.equal(before.ok, true);
    assert.equal(before.value.length, 2);
    assert.ok(before.value.every((row) => row.observed_at === null));
    assert.equal(await scalar(
      harness.second.client,
      "SELECT COUNT(*) FROM conversation_spike_outbox WHERE state = 'pending'",
    ), 2);
    assert.deepEqual(await harness.second.markObserved({ ...scope, rootId: null, throughCreateSeq: 2 }), { ok: true });
    const afterObservation = await harness.second.listAttention(scope);
    const rootEvent = afterObservation.value.find((row) => row.root_id === null);
    const hiddenReply = afterObservation.value.find((row) => row.root_id === root.value.messageId);
    assert.notEqual(rootEvent.observed_at, null);
    assert.equal(hiddenReply.observed_at, null);
  } finally {
    harness.close();
  }
});

test("O13 a new same-snapshot read on another client refuses all content after removal", async () => {
  const harness = await freshCase("o13-read-snapshot");
  try {
    const sent = await harness.first.send(sendInput({ clientRequestId: "request_snapshot_source_01" }));
    assert.equal(sent.ok, true);
    const bobScope = {
      actorId: FIXTURE.bob,
      projectId: FIXTURE.projectA,
      conversationId: FIXTURE.projectConversationA,
      afterChangeSeq: 0,
    };
    const before = await harness.second.readChanges(bobScope);
    assert.equal(before.ok, true);
    assert.equal(before.value.changes.length, 1);
    await harness.first.client.execute({
      sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      args: [FIXTURE.projectA, FIXTURE.bob],
    });
    const afterRemoval = await harness.second.readChanges(bobScope);
    assert.deepEqual(afterRemoval, { ok: false, code: "unavailable" });
    assert.doesNotMatch(JSON.stringify(afterRemoval), /Synthetic hello/);
  } finally {
    harness.close();
  }
});

after(() => {
  const evidencePath = join(runDir, "evidence.json");
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`\nPC04_EVIDENCE ${JSON.stringify({ ...evidence, evidencePath })}\n`);
});
