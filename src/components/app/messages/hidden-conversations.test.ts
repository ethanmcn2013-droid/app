import assert from "node:assert/strict";
import test from "node:test";
import { hiddenConversationKey, readHiddenConversations } from "./hidden-conversations";

test("hidden conversation preferences are actor scoped and contain IDs only", () => {
  const values = new Map([[hiddenConversationKey("alice"), '["room","room",1,null]']]);
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  assert.deepEqual(readHiddenConversations(storage, "alice"), ["room"]);
  assert.deepEqual(readHiddenConversations(storage, "bob"), []);
  values.set(hiddenConversationKey("alice"), "invalid");
  assert.deepEqual(readHiddenConversations(storage, "alice"), []);
});
