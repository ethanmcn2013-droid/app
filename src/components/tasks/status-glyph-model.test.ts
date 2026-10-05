import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMN_TONE, glyphFor, glyphWords, type GlyphColumn } from "./status-glyph-model";

const lane = (key: string, extra: Partial<GlyphColumn> = {}): GlyphColumn => ({
  key,
  isDone: key === "done",
  isSystem: ["todo", "doing", "review", "waiting", "done"].includes(key),
  color: "neutral",
  ...extra,
});

test("the shipped lanes draw the same shapes as My tasks", () => {
  assert.deepEqual(
    ["todo", "doing", "review", "waiting", "done"].map((key) => glyphFor(lane(key)).shape),
    ["empty", "half", "three-quarter", "waiting", "done"],
  );
});

test("any column that counts as done draws the tick in the success tone", () => {
  const custom = glyphFor(lane("shipped", { isDone: true, isSystem: false, color: "rose" }));
  assert.equal(custom.shape, "done");
  assert.equal(custom.tone, "var(--v3-success)");
  assert.equal(glyphFor(lane("review", { isDone: true })).shape, "done");
});

test("custom columns use their colour through a v3 token, never raw hex", () => {
  for (const color of Object.keys(COLUMN_TONE) as GlyphColumn["color"][]) {
    const spec = glyphFor(lane("custom-lane", { isSystem: false, color }));
    assert.equal(spec.shape, "custom");
    assert.match(spec.tone, /^var\(--v3-[a-z0-9-]+\)$/);
  }
});

test("every tone is a v3 token and every shape has plain words", () => {
  for (const key of ["todo", "doing", "review", "waiting", "done", "x"]) {
    const spec = glyphFor(lane(key));
    assert.match(spec.tone, /^var\(--v3-[a-z0-9-]+\)$/);
    const words = glyphWords(spec.shape);
    assert.ok(words.length > 0);
    assert.equal(words[0], words[0].toUpperCase(), "sentence case");
    assert.notEqual(words, words.toUpperCase(), "never shouted");
  }
  assert.equal(glyphFor(undefined).shape, "empty");
});
