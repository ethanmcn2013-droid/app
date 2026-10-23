import assert from "node:assert/strict";
import test from "node:test";
import { appendDictatedText, assistantDraftNearLimit } from "./chat-composer-model";

test("dictation preserves the existing draft and cannot exceed server limits", () => {
  assert.equal(appendDictatedText("Keep this", " add this\r\nnext "), "Keep this add this\nnext");
  assert.equal(appendDictatedText("Keep this\n", "next"), "Keep this\nnext");
  assert.equal(appendDictatedText("a".repeat(8000), "b"), null);
  assert.equal(appendDictatedText("", "😀".repeat(8000)), "😀".repeat(8000));
  assert.equal(appendDictatedText("Kept", "\0"), null);
});

test("Ping warns only within 1,000 UTF-16 units of its own 16,000 limit", () => {
  assert.equal(assistantDraftNearLimit("", 16_000), false);
  assert.equal(assistantDraftNearLimit("a".repeat(14_999), 16_000), false);
  assert.equal(assistantDraftNearLimit("a".repeat(15_000), 16_000), true);
  assert.equal(assistantDraftNearLimit("a".repeat(16_000), 16_000), true);
  assert.equal(assistantDraftNearLimit("a".repeat(16_001), 16_000), true);
  assert.equal(assistantDraftNearLimit("😀".repeat(7_500), 16_000), true);
});
