import assert from "node:assert/strict";
import test from "node:test";
import { conversationAvailability, resolveConversationControls } from "./flags";

test("defaults deny every environment and malformed switches do not enable", () => {
  for (const NODE_ENV of ["development", "test", "production"]) {
    for (const value of [undefined, "false", "1", "TRUE", " true "]) {
      const controls = resolveConversationControls({ NODE_ENV, SIGNAL_CONVERSATION_INTERNAL_ENABLED: value });
      assert.deepEqual(conversationAvailability(controls, "alice"), { read: false, send: false, deliver: false });
    }
  }
});

test("explicit internal actor allowlist is distinct from Project authorization", () => {
  const controls = resolveConversationControls({
    SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "true",
    SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: " alice,bob ,", SIGNAL_CONVERSATION_DELIVERY_ENABLED: "true",
  });
  assert.deepEqual(conversationAvailability(controls, "alice"), { read: true, send: true, deliver: true });
  for (const actor of ["", "charlie", "Alice", " alice"]) {
    assert.deepEqual(conversationAvailability(controls, actor), { read: false, send: false, deliver: false });
  }
});

test("the explicit open-to-all switch admits every authenticated member, only while chat is on", () => {
  const open = resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "true", SIGNAL_CONVERSATION_OPEN_TO_ALL: "true" });
  assert.deepEqual(conversationAvailability(open, "anyone"), { read: true, send: true, deliver: false });
  assert.deepEqual(conversationAvailability(open, ""), { read: false, send: false, deliver: false });
  const off = resolveConversationControls({ SIGNAL_CONVERSATION_OPEN_TO_ALL: "true" });
  assert.deepEqual(conversationAvailability(off, "anyone"), { read: false, send: false, deliver: false });
  for (const value of ["1", "TRUE", " true", "yes"]) {
    const malformed = resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_OPEN_TO_ALL: value });
    assert.deepEqual(conversationAvailability(malformed, "anyone"), { read: false, send: false, deliver: false });
  }
  const star = resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "*" });
  assert.deepEqual(conversationAvailability(star, "anyone"), { read: false, send: false, deliver: false });
});

test("send rollback preserves history and separates external drain", () => {
  const controls = resolveConversationControls({
    SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "false",
    SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "alice", SIGNAL_CONVERSATION_DELIVERY_ENABLED: "false",
  });
  assert.deepEqual(conversationAvailability(controls, "alice"), { read: true, send: false, deliver: false });
});

test("unapproved expansion cannot be enabled with ambient environment variables", () => {
  const controls = resolveConversationControls({
    SIGNAL_CONVERSATION_GUEST_ENABLED: "true", SIGNAL_CONVERSATION_ATTACHMENT_ENABLED: "true", SIGNAL_CONVERSATION_AI_ENABLED: "true",
  });
  assert.equal(controls.guestsEnabled, false);
  assert.equal(controls.attachmentsEnabled, false);
  assert.equal(controls.aiEnabled, false);
});

test("DMs remain off when Project rooms are enabled", () => {
  const base = { SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "true" };
  assert.equal(resolveConversationControls(base).directMessagesEnabled, false);
  assert.equal(resolveConversationControls({ ...base, SIGNAL_CONVERSATION_DM_ENABLED: "TRUE" }).directMessagesEnabled, false);
  assert.equal(resolveConversationControls({ ...base, SIGNAL_CONVERSATION_DM_ENABLED: "true" }).directMessagesEnabled, true);
});
