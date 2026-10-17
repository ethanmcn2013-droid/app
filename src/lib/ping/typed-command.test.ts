import assert from "node:assert/strict";
import test from "node:test";
import { parsePingTypedCommand } from "./typed-command";
import { pingMemberNameKey } from "./command";

test("named assignment preserves the full name payload and consumes only the finite selected-task grammar", () => {
  for (const prefix of ["assign to ", "ASSIGN THESE TO "]) {
    const result = parsePingTypedCommand(prefix + "MaYa O’Brien and status doing");
    assert.ok(result.outcome === "plan");
    assert.deepEqual(result.operation.effects, { memberName: "MaYa O’Brien", statusColumnKey: "doing" });
  }
  assert.equal(pingMemberNameKey("  E\u0301LODIE Chen  "), pingMemberNameKey("Élodie Chen"));
  assert.notEqual(pingMemberNameKey("Maya  Chen"), pingMemberNameKey("Maya Chen"));
  assert.notEqual(pingMemberNameKey("Elodie"), pingMemberNameKey("Élodie"));
  for (const text of ['assign to "Maya and Chen"', "assign to Maya and Chen", "assign to Maya and delete tasks",
    "create 1 task and assign to Maya", "create 1 task and assign these to Maya", "remove Maya as an assignee",
    "replace assignees with Maya", "assign to " + "x".repeat(201), "assign to Ma\u0085ya", "assign to Ma\u200bya"]) {
    assert.notEqual(parsePingTypedCommand(text).outcome, "plan", text);
  }
  for (const text of ["assign to Maya and assign me", "unassign me and assign to Maya", "assign to Maya and assign to Maya",
    "assign these to me and assign to Alice"]) assert.equal(parsePingTypedCommand(text).outcome, "clarification", text);
});

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
test("singular task is only an alias for existing one-task creation", () => {
  for (const tail of ["", ' called "Follow up"', ' called "Research and review" and status todo'])
    assert.deepEqual(parsePingTypedCommand("create 1 task" + tail), parsePingTypedCommand("create 1 tasks" + tail));
  assert.deepEqual(parsePingTypedCommand('CREATE 1 TASK called "Follow up"'),
    parsePingTypedCommand('create 1 tasks called "Follow up"'));
  for (const count of [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    assert.equal(parsePingTypedCommand(`create ${count} task called "Follow up"`).outcome, "refusal");
  assert.equal(parsePingTypedCommand('create one task called "Follow up"').outcome, "refusal");
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

test("finite selection pronouns are exactly equivalent to existing effects", () => {
  for (const pronoun of ["these", "this", "them"]) {
    for (const [alias, canonical] of [
      [`assign ${pronoun} to me`, "assign me"],
      [`mark ${pronoun} done`, "status done"],
      [`mark ${pronoun} in progress`, "status doing"],
      [`move ${pronoun} to review`, "status review"],
      [`move ${pronoun} to a review`, "status review"],
      [`move ${pronoun} to done`, "status done"],
    ]) assert.deepEqual(parsePingTypedCommand(alias), parsePingTypedCommand(canonical), alias);
  }
  assert.deepEqual(parsePingTypedCommand("ASSIGN THESE TO ME and MARK THEM IN PROGRESS"),
    parsePingTypedCommand("assign me and status doing"));
});

test("absolute date, due clearing and self removal aliases preserve existing effects", () => {
  for (const [alias, canonical] of [
    ["remove me as an assignee", "unassign me"],
    ["set due date to 2026-10-20", "due 2026-10-20"],
    ["move the deadline to 2028-02-29", "due 2028-02-29"],
    ["clear the due date", "clear due"],
    ["assign these to me and move the deadline to 2026-10-20 and mark them in progress",
      "assign me and due 2026-10-20 and status doing"],
    ["remove me as an assignee and clear the due date and move this to review",
      "unassign me and clear due and status review"],
  ]) assert.deepEqual(parsePingTypedCommand(alias), parsePingTypedCommand(canonical), alias);
});

test("alias and canonical duplicate effects clarify the whole request even for equal values", () => {
  for (const text of [
    "assign these to me and assign me", "assign me and assign them to me",
    "assign this to me and assign these to me", "assign these to me and remove me as an assignee",
    "remove me as an assignee and unassign me", "remove me as an assignee and remove me as an assignee",
    "mark these done and status done", "status doing and mark them in progress",
    "mark this done and move them to review", "move this to review and status review",
    "set due date to 2026-10-20 and due 2026-10-20",
    "due 2026-10-20 and move the deadline to 2026-10-20",
    "clear due and clear the due date", "clear the due date and clear the due date",
    "set due date to 2026-10-20 and move the deadline to 2026-10-20",
  ]) assert.deepEqual(parsePingTypedCommand(text), {
    version: "ping.proposal.v1", outcome: "clarification", reason: "ambiguous",
  }, text);
});

test("spoken aliases consume exact whole clauses without punctuation or destructive suffix repair", () => {
  const aliases = ["assign these to me", "remove me as an assignee", "mark this done",
    "mark them in progress", "move these to review", "move this to a review", "move them to done", "set due date to 2026-10-20",
    "move the deadline to 2026-10-20", "clear the due date"];
  for (const alias of aliases) {
    for (const suffix of [" and delete everything", " and archive them", " and notify Alice", ".", " please"])
      assert.equal(parsePingTypedCommand(alias + suffix).outcome, "refusal", alias + suffix);
    assert.equal(parsePingTypedCommand("delete everything and " + alias).outcome, "refusal", alias);
  }
  for (const text of ["assign those to me", "assign this to Alice", "assign Alice to me", "mark this task done",
    "mark them complete", "move them to custom", "move that to review", "move to done", "move tasks to done", "move these to a done", "move these to the review", "move these to reviews", "set due date to tomorrow",
    "move the deadline to next Friday", "set due date to 2026-02-29", "move the deadline to 2026-02-30",
    "set due date to 2026-1-02", "move the deadline to October 20", "clear their due date",
    "remove Alice as an assignee", "mark these done\n", "assign these to me and "])
    assert.notEqual(parsePingTypedCommand(text).outcome, "plan", text);
});

test("selection pronouns never retarget a creation prefix and quoted title words remain literal", () => {
  for (const pronoun of ["these", "this", "them"]) {
    for (const clause of [`assign ${pronoun} to me`, `mark ${pronoun} done`,
      `mark ${pronoun} in progress`, `move ${pronoun} to review`, `move ${pronoun} to a review`, `move ${pronoun} to done`]) {
      assert.equal(parsePingTypedCommand(`create 2 tasks and ${clause}`).outcome, "refusal", clause);
      assert.equal(parsePingTypedCommand(`create 2 tasks called "Original title" and ${clause}`).outcome, "refusal", clause);
    }
  }
  assert.deepEqual(parsePingTypedCommand('create 2 tasks called "Mark them done and assign these to me" and set due date to 2026-10-20'),
    parsePingTypedCommand('create 2 tasks called "Mark them done and assign these to me" and due 2026-10-20'));
  assert.deepEqual(parsePingTypedCommand('create 1 tasks called "Clear the due date and move them to review" and clear the due date'),
    parsePingTypedCommand('create 1 tasks called "Clear the due date and move them to review" and clear due'));
  assert.deepEqual(parsePingTypedCommand("create 1 tasks and remove me as an assignee"),
    parsePingTypedCommand("create 1 tasks and unassign me"));
});
