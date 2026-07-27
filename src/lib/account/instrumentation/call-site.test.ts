import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyLaneTransition,
  dayBucketedEventId,
  recordSponsoredUse,
  venueLocalDate,
} from "./call-site";
import { emittedCount, resetEmittedCount } from "./sink";
import type { InstrumentationEnv } from "./emitter";

const ENV: InstrumentationEnv = {
  SPONSOR_USAGE_EVENTS: "1",
  SPONSOR_USAGE_HASH_SALT: "salt-of-at-least-sixteen",
};

const base = {
  product: "notes" as const,
  kind: "note_materially_edited" as const,
  objectKey: "note_1",
  subjectId: "user_1",
  occurredAt: Date.UTC(2026, 5, 15, 9),
};

test("the venue day is the venue's, not UTC's", () => {
  // 22:30 UTC in June is 23:30 in Dublin, still the same local day.
  assert.equal(venueLocalDate(Date.UTC(2026, 5, 15, 22, 30)), "2026-06-15");
  assert.equal(venueLocalDate(Date.UTC(2026, 5, 15, 23, 30)), "2026-06-16");
});

test("a hundred autosaves of one note collapse to one event id", () => {
  const ids = new Set(
    Array.from({ length: 100 }, (_, i) =>
      dayBucketedEventId({ ...base, occurredAt: base.occurredAt + i * 30_000 }),
    ),
  );
  assert.equal(ids.size, 1, "the day bucket is what makes autosave safe");
});

test("the same note on the next day is a different event", () => {
  const today = dayBucketedEventId(base);
  const tomorrow = dayBucketedEventId({
    ...base,
    occurredAt: base.occurredAt + 86_400_000,
  });
  assert.notEqual(today, tomorrow);
});

test("different objects, kinds, and people never share an id", () => {
  const a = dayBucketedEventId(base);
  assert.notEqual(a, dayBucketedEventId({ ...base, objectKey: "note_2" }));
  assert.notEqual(a, dayBucketedEventId({ ...base, subjectId: "user_2" }));
  assert.notEqual(a, dayBucketedEventId({ ...base, kind: "note_created" }));
});

test("an event id exposes neither the object nor the person", () => {
  const id = dayBucketedEventId(base);
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.ok(!id.includes("note_1"));
  assert.ok(!id.includes("user_1"));
});

test("moving into done is a completion and out of done is a reopen", () => {
  assert.equal(classifyLaneTransition("doing", "done"), "task_completed");
  assert.equal(classifyLaneTransition("done", "doing"), "task_reopened");
  assert.equal(classifyLaneTransition("todo", "doing"), "task_status_changed");
});

test("a move that changes nothing means nothing", () => {
  assert.equal(classifyLaneTransition("doing", "doing"), null);
  assert.equal(classifyLaneTransition("done", "done"), null);
  assert.equal(classifyLaneTransition("todo", null), null);
});

test("a committed action emits", async () => {
  resetEmittedCount();
  await recordSponsoredUse(
    { ...base, workspaceId: "ws_1" },
    true,
    ENV,
  );
  assert.equal(emittedCount(), 1);
});

test("an uncommitted action emits nothing", async () => {
  resetEmittedCount();
  await recordSponsoredUse({ ...base, workspaceId: "ws_1" }, false, ENV);
  assert.equal(emittedCount(), 0);
});

test("a missing workspace or subject emits nothing", async () => {
  resetEmittedCount();
  await recordSponsoredUse({ ...base, workspaceId: null }, true, ENV);
  await recordSponsoredUse({ ...base, subjectId: null, workspaceId: "ws_1" }, true, ENV);
  assert.equal(emittedCount(), 0);
});

test("the flag off means silence", async () => {
  resetEmittedCount();
  await recordSponsoredUse({ ...base, workspaceId: "ws_1" }, true, {
    SPONSOR_USAGE_HASH_SALT: ENV.SPONSOR_USAGE_HASH_SALT,
  });
  assert.equal(emittedCount(), 0);
});

test("instrumentation never throws into a user's write path", async () => {
  resetEmittedCount();
  await assert.doesNotReject(() =>
    recordSponsoredUse(
      {
        ...base,
        // A kind that is not allowlisted would fail validation inside.
        kind: "not_a_kind" as never,
        workspaceId: "ws_1",
      },
      true,
      ENV,
    ),
  );
  assert.equal(emittedCount(), 0);
});

test("a replayed gesture produces the same id, so ingest can dedupe", () => {
  assert.equal(dayBucketedEventId(base), dayBucketedEventId({ ...base }));
});
