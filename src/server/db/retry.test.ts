/**
 * Unit test for the read-retry helper (db/retry.ts).
 *
 * Run: node --import tsx --test src/server/db/retry.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransient, withReadRetry } from "./retry";

test("isTransient classifies network/5xx errors as retryable, SQL errors as not", () => {
  assert.equal(isTransient(new Error("fetch failed")), true);
  assert.equal(isTransient(new Error("ECONNRESET")), true);
  assert.equal(isTransient(new Error("Server returned HTTP 503")), true);
  assert.equal(isTransient(new Error("stream not found")), true);
  // Non-transient — a real SQL error should never be retried.
  assert.equal(isTransient(new Error("SQLITE_ERROR: no such column: foo")), false);
  assert.equal(isTransient(new Error("UNIQUE constraint failed")), false);
  assert.equal(isTransient(null), false);
});

test("withReadRetry resolves after transient failures", async () => {
  let calls = 0;
  const result = await withReadRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("fetch failed");
      return "ok";
    },
    { baseMs: 1 },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3); // failed twice, succeeded on the third
});

test("withReadRetry rethrows a non-transient error immediately (no retry)", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withReadRetry(async () => {
        calls++;
        throw new Error("SQLITE_ERROR: no such column: foo");
      }, { baseMs: 1 }),
    /no such column/,
  );
  assert.equal(calls, 1); // never retried
});

test("withReadRetry gives up after exhausting retries", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withReadRetry(async () => {
        calls++;
        throw new Error("network timeout");
      }, { retries: 2, baseMs: 1 }),
    /network timeout/,
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});
