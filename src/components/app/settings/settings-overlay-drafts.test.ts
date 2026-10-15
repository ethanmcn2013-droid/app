import assert from "node:assert/strict";
import test from "node:test";
import { SettingsOverlayDrafts } from "./settings-overlay-drafts";

test("a controlled field stays dirty when its rendered default changes", () => {
  const drafts = new SettingsOverlayDrafts();

  drafts.captureBaseline("invite-email", "");
  assert.equal(drafts.update("invite-email", "guest@example.com"), true);
  // A successful React 19 controlled render can mirror the current value into
  // defaultValue. The captured baseline remains the value from before editing.
  drafts.captureBaseline("invite-email", "guest@example.com");
  assert.equal(drafts.hasDraft, true);
  assert.equal(drafts.update("invite-email", ""), false);
});

test("a dirty field remains tracked after its tab unmounts and remounts", () => {
  const drafts = new SettingsOverlayDrafts();

  drafts.captureBaseline("workspace-name", "Orchard");
  assert.equal(drafts.update("workspace-name", "New name"), true);
  // Recreated controls reuse their stable id and cannot replace the baseline.
  drafts.captureBaseline("workspace-name", "New name");
  assert.equal(drafts.update("workspace-name", "New name"), true);
  assert.equal(drafts.update("workspace-name", "Orchard"), false);
});

test("choice controls use the same baseline tracking", () => {
  const drafts = new SettingsOverlayDrafts();

  drafts.captureBaseline("email-alerts", false);
  assert.equal(drafts.update("email-alerts", true), true);
  assert.equal(drafts.update("email-alerts", false), false);
});
