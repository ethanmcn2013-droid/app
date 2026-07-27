import assert from "node:assert/strict";
import { test } from "node:test";

import {
  emitMeaningfulAction,
  hashIdentity,
  sponsorUsageEventsEnabled,
  type EmitInput,
  type InstrumentationEnv,
} from "./emitter";
import { FORBIDDEN_FIELDS, type VenueMeaningfulActionV1 } from "./event-schema";

const ENV: InstrumentationEnv = {
  SPONSOR_USAGE_EVENTS: "1",
  SPONSOR_USAGE_HASH_SALT: "salt-of-at-least-sixteen",
};

function input(overrides: Partial<EmitInput> = {}): EmitInput {
  return {
    eventId: "evt_1",
    product: "tasks",
    kind: "task_completed",
    occurredAt: 1_785_000_000_000,
    subjectId: "user_abc",
    workspaceId: "ws_xyz",
    ...overrides,
  };
}

function collector() {
  const seen: VenueMeaningfulActionV1[] = [];
  return { seen, sink: (e: VenueMeaningfulActionV1) => void seen.push(e) };
}

test("a committed action emits exactly one event", async () => {
  const { seen, sink } = collector();
  const outcome = await emitMeaningfulAction(input(), true, sink, ENV);
  assert.equal(outcome.emitted, true);
  assert.equal(seen.length, 1);
});

test("a rolled-back transaction emits nothing", async () => {
  const { seen, sink } = collector();
  const outcome = await emitMeaningfulAction(input(), false, sink, ENV);
  assert.equal(outcome.emitted, false);
  assert.equal(seen.length, 0);
  if (!outcome.emitted) assert.match(outcome.reason, /did not commit/);
});

test("the flag is off by default, so production stays dark", async () => {
  assert.equal(sponsorUsageEventsEnabled({}), false);
  const { seen, sink } = collector();
  const outcome = await emitMeaningfulAction(input(), true, sink, {
    SPONSOR_USAGE_HASH_SALT: ENV.SPONSOR_USAGE_HASH_SALT,
  });
  assert.equal(outcome.emitted, false);
  assert.equal(seen.length, 0);
});

test("no raw identifier survives into the emitted event", async () => {
  const { seen, sink } = collector();
  await emitMeaningfulAction(input(), true, sink, ENV);
  const payload = JSON.stringify(seen[0]);
  assert.ok(!payload.includes("user_abc"), "subject id must not travel");
  assert.ok(!payload.includes("ws_xyz"), "workspace id must not travel");
});

test("the emitted event carries only the seven contracted fields", async () => {
  const { seen, sink } = collector();
  await emitMeaningfulAction(input(), true, sink, ENV);
  assert.deepEqual(Object.keys(seen[0]).sort(), [
    "eventId",
    "instrumentationVersion",
    "kind",
    "occurredAt",
    "product",
    "subjectIdHash",
    "workspaceIdHash",
  ]);
  for (const key of Object.keys(seen[0])) {
    assert.equal(FORBIDDEN_FIELDS.has(key.toLowerCase()), false);
  }
});

test("hashing is stable for a salt and changes with it", () => {
  const a = hashIdentity("user_abc", "salt-one-that-is-long");
  assert.equal(a, hashIdentity("user_abc", "salt-one-that-is-long"));
  assert.notEqual(a, hashIdentity("user_abc", "salt-two-that-is-long"));
  assert.match(a, /^[0-9a-f]{32}$/);
});

test("replaying the same eventId yields an identical event, so the sink can dedupe", async () => {
  const { seen, sink } = collector();
  await emitMeaningfulAction(input(), true, sink, ENV);
  await emitMeaningfulAction(input(), true, sink, ENV);
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(new Set(seen.map((e) => e.eventId)).size, 1);
});

test("a kind outside the allowlist never reaches the sink", async () => {
  const { seen, sink } = collector();
  const outcome = await emitMeaningfulAction(
    input({ kind: "page_view" as EmitInput["kind"] }),
    true,
    sink,
    ENV,
  );
  assert.equal(outcome.emitted, false);
  assert.equal(seen.length, 0);
});

test("a missing salt blocks emission rather than sending a weak hash", async () => {
  const { seen, sink } = collector();
  const outcome = await emitMeaningfulAction(input(), true, sink, {
    SPONSOR_USAGE_EVENTS: "1",
    SPONSOR_USAGE_HASH_SALT: "short",
  });
  assert.equal(outcome.emitted, false);
  assert.equal(seen.length, 0);
});

test("a missing identity blocks emission", async () => {
  const { seen, sink } = collector();
  const outcome = await emitMeaningfulAction(input({ workspaceId: "" }), true, sink, ENV);
  assert.equal(outcome.emitted, false);
  assert.equal(seen.length, 0);
});
