import { test } from "node:test";
import assert from "node:assert/strict";

// A minimal in-memory localStorage on a stub window, installed before the
// module under test is loaded.
const store = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
(globalThis as unknown as { window: unknown }).window = { localStorage, addEventListener() {}, removeEventListener() {} };

test("the list shows the Labels column by default, and an empty choice hides every column", async () => {
  const { readListColumns } = await import("./display-prefs");
  // No stored preference: the first client read matches the server default.
  assert.equal(readListColumns(), "labels");
  // The person hid every optional column.
  store.set("signal-tasks.v3.list-columns", "");
  assert.equal(readListColumns(), "");
  store.set("signal-tasks.v3.list-columns", "labels,estimate");
  assert.equal(readListColumns(), "labels,estimate");
});
