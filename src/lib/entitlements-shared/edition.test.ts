import { test } from "node:test";
import assert from "node:assert/strict";
import { editionLabel } from "@/lib/entitlements-shared/tiers";

test("editionLabel maps named-edition sources to labels", () => {
  assert.equal(editionLabel("student_edu"), "School Edition");
  assert.equal(editionLabel("venue_edition"), "Venue Edition");
});

test("editionLabel returns null for non-edition sources (no false label)", () => {
  assert.equal(editionLabel("workspace_subscription"), null);
  assert.equal(editionLabel("event_pass"), null);
  assert.equal(editionLabel(null), null);
  assert.equal(editionLabel(undefined), null);
});
