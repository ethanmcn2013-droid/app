import assert from "node:assert/strict";
import test from "node:test";
import { parsePingTypedCommand } from "./typed-command";

test("restricted typed grammar consumes compound requests with literal operations", () => {
  assert.deepEqual(parsePingTypedCommand("assign me and due 2026-10-08 and status doing"), {
    version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected",
      effects: { selfAssignment: "add", dueDate: "2026-10-08", statusColumnKey: "doing" } },
  });
  assert.deepEqual(parsePingTypedCommand("unassign me and clear due"), {
    version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected",
      effects: { selfAssignment: "remove", dueDate: null } },
  });
});
test("creation includes counts at both boundaries and quoted titles without splitting their words", () => {
  assert.deepEqual(parsePingTypedCommand('create 10 tasks called "Research and review" and status review'), {
    version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count: 10,
      title: "Research and review", effects: { statusColumnKey: "review" } },
  });
  assert.deepEqual(parsePingTypedCommand("create 1 tasks"), { version: "ping.proposal.v1", outcome: "plan",
    operation: { kind: "create_placeholders", count: 1, effects: {} } });
});
test("unknown suffixes and mixed or destructive clauses cannot execute a supported prefix", () => {
  for (const text of ["assign me and delete everything", "assign me later", "create 0 tasks", "create 11 tasks",
    "create 01 tasks", "due 2026-02-30", "assign Alice", "due tomorrow", "status custom",
    "assign me and create 2 tasks", "create 1 tasks and", "create 1 tasks called \"x\" trailing"]) {
    assert.notEqual(parsePingTypedCommand(text).outcome, "plan", text);
  }
});
test("duplicate effects refuse the whole request even if their values agree", () => {
  for (const text of ["assign me and assign me", "assign me and unassign me", "due 2026-10-08 and clear due",
    "status todo and status done"]) assert.equal(parsePingTypedCommand(text).outcome, "clarification");
});
test("bounded input rejects controls, oversized and decoded control titles", () => {
  for (const value of [null, {}, " ", "assign me\n", "x".repeat(8001), "😀".repeat(4001),
    'create 1 tasks called "\\n"', 'create 1 tasks called "' + "x".repeat(201) + '"']) {
    assert.notEqual(parsePingTypedCommand(value).outcome, "plan");
  }
});
