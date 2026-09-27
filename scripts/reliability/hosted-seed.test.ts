import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { seedHostedFixture, verifyHostedSeedPrerequisites, sendHostedSeedMessage, hostedSeedRequestId, requireSeedSuccess } from "./hosted-seed";
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
