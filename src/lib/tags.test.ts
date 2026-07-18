import { test } from "node:test";
import assert from "node:assert/strict";
import { tagColor, tagKey, type TagDef } from "@/lib/tags";

test("tagKey normalises case and whitespace so equivalents collapse", () => {
  assert.equal(tagKey("Design"), "design");
  assert.equal(tagKey("  DESIGN  "), "design");
  assert.equal(tagKey("Design"), tagKey("design"));
});

test("tagColor resolves a tag's colour case-insensitively, neutral fallback", () => {
  const defs: TagDef[] = [
    { name: "Design", color: "violet" },
    { name: "Urgent", color: "rose" },
  ];
  assert.equal(tagColor("design", defs), "violet"); // different casing still matches
  assert.equal(tagColor("Urgent", defs), "rose");
  assert.equal(tagColor("unknown", defs), "neutral"); // no definition → neutral
});
