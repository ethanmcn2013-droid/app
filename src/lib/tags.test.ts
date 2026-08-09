import { test } from "node:test";
import assert from "node:assert/strict";
import { tagColor, tagDisplayName, tagKey, type TagDef } from "@/lib/tags";

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

test("tagDisplayName humanises stored slugs without touching the stored value", () => {
  assert.equal(tagDisplayName("mara-finn"), "Mara & Finn");
  assert.equal(tagDisplayName("venue_prep"), "Venue Prep");
  assert.equal(tagDisplayName("bar"), "Bar");
  // Already-human names keep their authored casing beyond the first letter.
  assert.equal(tagDisplayName("VIP guests"), "VIP Guests");
  // Degenerate input falls back to what was stored rather than an empty chip.
  assert.equal(tagDisplayName("---"), "---");
});
