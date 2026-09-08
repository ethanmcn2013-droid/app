import assert from "node:assert/strict";
import { test } from "node:test";
import { withRecoveryLockRetry, withRecoveryTransaction } from "./recovery-lock-retry";

test("only a rolled-back SQLite busy error retries; network/unknown commit errors surface once", async () => {
  for (const error of [Object.assign(Error("network"), { code: "ECONNRESET" }), Error("unknown commit")]) {
    let calls = 0;
    await assert.rejects(withRecoveryLockRetry(async () => { calls++; throw error; }), candidate => candidate === error);
    assert.equal(calls, 1);
  }
  let calls = 0;
  assert.equal(await withRecoveryLockRetry(async () => {
    if (++calls === 1) throw Object.assign(Error("rolled back"), { cause: { code: "SQLITE_BUSY" } });
    return "committed";
  }), "committed");
  assert.equal(calls, 2);
});

test("queued transaction starts fresh after failure and other databases remain independent", async () => {
  const db = {}, other = {};
  let release!: () => void, entered = false, authority = true;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const first = withRecoveryTransaction(db, async () => { await hold; throw Error("synthetic failure"); });
  const caught = assert.rejects(first, /synthetic failure/);
  const next = withRecoveryTransaction(db, async () => { entered = true; return authority; });
  assert.equal(await withRecoveryTransaction(other, async () => "unblocked"), "unblocked");
  assert.equal(entered, false);
  authority = false; release();
  await caught;
  assert.equal(await next, false);
});
