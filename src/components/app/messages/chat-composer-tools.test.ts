import assert from "node:assert/strict";
import test from "node:test";
import { appendDictatedText } from "./chat-composer-model";

test("dictation preserves the existing draft and cannot exceed server limits", () => {
  assert.equal(appendDictatedText("Keep this", " add this\r\nnext "), "Keep this add this\nnext");
  assert.equal(appendDictatedText("Keep this\n", "next"), "Keep this\nnext");
  assert.equal(appendDictatedText("a".repeat(8000), "b"), null);
  assert.equal(appendDictatedText("", "😀".repeat(8000)), "😀".repeat(8000));
  assert.equal(appendDictatedText("Kept", "\0"), null);
});
