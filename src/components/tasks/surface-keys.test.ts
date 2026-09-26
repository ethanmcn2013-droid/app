import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldHandleSurfaceKey, type SurfaceKeyEvent, type SurfaceKeyState } from "./surface-keys";
import { columnTone, glyphFor, glyphWords } from "./status-glyph-model";

const idle: SurfaceKeyState = { layerOpen: false, paletteOpen: false };
const key = (patch: Partial<SurfaceKeyEvent> = {}): SurfaceKeyEvent => ({
  key: "d",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  targetTag: "DIV",
  targetEditable: false,
  targetRole: null,
  ...patch,
});

test("a plain letter on the surface is handled", () => {
  assert.equal(shouldHandleSurfaceKey(key(), idle), true);
  assert.equal(shouldHandleSurfaceKey(key({ key: "?", shiftKey: true }), idle), true);
});

test("letters never fire inside inputs, textareas, selects or editable text", () => {
  for (const tag of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
    assert.equal(shouldHandleSurfaceKey(key({ targetTag: tag }), idle), false, tag);
  }
  assert.equal(shouldHandleSurfaceKey(key({ targetEditable: true }), idle), false);
  assert.equal(shouldHandleSurfaceKey(key({ targetRole: "textbox" }), idle), false);
  assert.equal(shouldHandleSurfaceKey(key({ targetRole: "combobox" }), idle), false);
});

test("modifiers block single letters, except the listed combos", () => {
  assert.equal(shouldHandleSurfaceKey(key({ metaKey: true }), idle), true, "Cmd+D duplicates");
  assert.equal(shouldHandleSurfaceKey(key({ key: "s", metaKey: true }), idle), false);
  assert.equal(shouldHandleSurfaceKey(key({ key: "k", ctrlKey: true }), idle), false, "Ctrl+K belongs to the palette");
  assert.equal(shouldHandleSurfaceKey(key({ key: "z", ctrlKey: true }), idle), true);
  assert.equal(shouldHandleSurfaceKey(key({ key: "a", metaKey: true }), idle), true);
  assert.equal(shouldHandleSurfaceKey(key({ key: "Enter", ctrlKey: true }), idle), true);
  assert.equal(shouldHandleSurfaceKey(key({ altKey: true }), idle), false);
});

test("open layers and the palette own the keyboard", () => {
  assert.equal(shouldHandleSurfaceKey(key(), { layerOpen: true, paletteOpen: false }), false);
  assert.equal(shouldHandleSurfaceKey(key(), { layerOpen: false, paletteOpen: true }), false);
});

test("IME composition never triggers a shortcut", () => {
  assert.equal(shouldHandleSurfaceKey(key({ isComposing: true }), idle), false);
});

test("status glyphs share My tasks' shapes", () => {
  const col = (key: string, patch: Partial<{ isDone: boolean; isSystem: boolean; color: "neutral" | "rose" | "amber" }> = {}) => ({
    key,
    isDone: false,
    isSystem: true,
    color: "neutral" as const,
    ...patch,
  });
  assert.equal(glyphFor(col("todo")).shape, "empty");
  assert.equal(glyphFor(col("doing")).shape, "half");
  assert.equal(glyphFor(col("review")).shape, "three-quarter");
  assert.equal(glyphFor(col("waiting", { isSystem: false })).shape, "waiting");
  assert.equal(glyphFor(col("done", { isDone: true })).shape, "done");
  assert.equal(glyphFor(undefined).shape, "empty");
});

test("any column that counts as done draws the tick", () => {
  const glyph = glyphFor({ key: "shipped", isDone: true, isSystem: false, color: "rose" });
  assert.equal(glyph.shape, "done");
  assert.equal(glyph.tone, "var(--v3-success)");
});

test("custom columns take a v3 identity token, never raw hex", () => {
  const glyph = glyphFor({ key: "suppliers", isDone: false, isSystem: false, color: "rose" });
  assert.equal(glyph.shape, "custom");
  assert.equal(glyph.tone, "var(--v3-project-7)");
  for (const color of ["neutral", "rose", "sky", "amber", "emerald", "violet", "teal", "pink", "indigo"] as const) {
    assert.match(columnTone(color), /^var\(--v3-[a-z0-9-]+\)$/, color);
  }
});

test("every shape has plain words", () => {
  for (const shape of ["empty", "half", "three-quarter", "waiting", "done", "custom"] as const) {
    assert.ok(glyphWords(shape).length > 0);
  }
});
