import test from "node:test";
import assert from "node:assert/strict";
import { confirmMonthlyRemix, pendingMonthlyRemix, prepareMonthlyRemix } from "./template-remix-intent";

function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("an uncertain remix reuses the saved request across remount and account changes are isolated", () => {
  const storage = store();
  const first = prepareMonthlyRemix(storage, "actor-a", () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(pendingMonthlyRemix(storage, "actor-a"), first);
  assert.equal(prepareMonthlyRemix(storage, "actor-a", () => { throw new Error("minted a duplicate"); }), first);
  assert.equal(pendingMonthlyRemix(storage, "actor-b"), null);
  confirmMonthlyRemix(storage, "actor-a", "another-request-id");
  assert.equal(pendingMonthlyRemix(storage, "actor-a"), first);
  confirmMonthlyRemix(storage, "actor-a", first);
  assert.equal(pendingMonthlyRemix(storage, "actor-a"), null);
});

test("refuses before calling the server when request custody cannot be saved", () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
  assert.throws(() => prepareMonthlyRemix(blocked, "actor-a", () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), /blocked/);
  assert.throws(() => prepareMonthlyRemix(store(), "", () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), /Sign in/);
  assert.throws(() => prepareMonthlyRemix(store(), "actor-a", () => "bad"), /could not be prepared/);
});
