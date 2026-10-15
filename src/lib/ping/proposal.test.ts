import assert from "node:assert/strict";
import test from "node:test";
import { bindPingProposal, normalizePingCapture } from "./proposal";
import { syntheticCapture, syntheticPlan } from "./input-test-fixture";

const seal = () => ({ generationId: "synthetic-generation", inputItemId: "synthetic-whole-input", state: "complete" });
test("named proposal has no identity authority; trusted binding captures exact name and the whole assignee readset", () => {
  const proposal = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { memberName: "éLODIE" } } };
  const member = { userId: "synthetic-member", name: "E\u0301lodie" };
  assert.equal(bindPingProposal(proposal, syntheticCapture(), seal()).ok, false);
  const bound = bindPingProposal(proposal, syntheticCapture(), seal(), member); assert.ok(bound.ok);
  assert.deepEqual(bound.command.operation.effects, { namedAssignment: member });
  assert.deepEqual(bound.context.captured.namedAssignment, member);
  assert.ok(Object.isFrozen(bound.context.captured.namedAssignment));
  assert.ok(bound.proposal.outcome === "plan");
  assert.deepEqual(bound.proposal.operation.effects, { memberName: member.name });
  assert.ok(bound.command.operation.kind === "edit_selected");
  assert.deepEqual(bound.command.operation.expected["synthetic-task"].assignees, ["synthetic-other"]);
  for (const effects of [{ memberName: "Different" }, { memberName: "éLODIE", userId: "forged" },
    { namedAssignment: member }, { memberName: "éLODIE", selfAssignment: "add" }]) {
    assert.equal(bindPingProposal({ ...proposal, operation: { ...proposal.operation, effects } }, syntheticCapture(), seal(), member).ok, false);
  }
  assert.equal(bindPingProposal({ ...proposal, operation: { kind: "create_placeholders", count: 1, effects: { memberName: "éLODIE" } } },
    { ...syntheticCapture(), selectedTaskIds: [], snapshots: {} }, seal(), member).ok, false);
});
test("operation-only compound binds captured identities and relevant preconditions without model authority", () => {
  const capture = syntheticCapture(); const result = bindPingProposal(syntheticPlan(), capture, seal()); assert.ok(result.ok);
  assert.equal(result.command.commandId, capture.commandId); assert.equal(result.command.projectId, capture.projectId);
  assert.deepEqual(result.context.captured.selectedTaskIds, ["synthetic-task"]);
  assert.equal(result.context.actorId, "synthetic-actor"); assert.equal(result.context.input.itemId, "synthetic-whole-input");
  assert.equal(result.command.operation.kind, "edit_selected");
  if (result.command.operation.kind === "edit_selected") {
    assert.equal(result.command.operation.expected["synthetic-task"].durationDays, 2);
    assert.deepEqual(result.command.operation.expected["synthetic-task"].assignees, ["synthetic-other"]);
  }
  capture.snapshots["synthetic-task"].assignees.push("changed-later");
  assert.deepEqual(result.context.captured.expected["synthetic-task"].assignees, ["synthetic-other"]);
  assert.ok(Object.isFrozen(result.context.captured.expected["synthetic-task"].assignees));
});

test("only touched fields enter command readset; full capture remains independently frozen", () => {
  const proposal = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { statusColumnKey: "done" } } };
  const result = bindPingProposal(proposal, syntheticCapture(), seal()); assert.ok(result.ok);
  if (result.command.operation.kind === "edit_selected") assert.deepEqual(Object.keys(result.command.operation.expected["synthetic-task"]).sort(),
    ["boardColumnKey", "completedAtSeconds", "lane"]);
  assert.equal(result.context.captured.expected["synthetic-task"].startDay, 20000);
});

test("placeholder default/literal title, 1–10 bounds, no generated IDs, no creation self removal", () => {
  const capture = { ...syntheticCapture(), selectedTaskIds: [], snapshots: {} };
  const proposal = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count: 10, effects: {} } };
  const result = bindPingProposal(proposal, capture, seal()); assert.ok(result.ok);
  assert.deepEqual(result.command.operation, { kind: "create_placeholders", count: 10, title: "Untitled task", effects: {} });
  const literal = bindPingProposal({ ...proposal, operation: { ...proposal.operation, title: "Task {n}" } }, capture, seal()); assert.ok(literal.ok);
  if (literal.command.operation.kind === "create_placeholders") assert.equal(literal.command.operation.title, "Task {n}");
  for (const operation of [{ ...proposal.operation, count: 11 }, { ...proposal.operation, count: "1" },
    { ...proposal.operation, title: "" }, { ...proposal.operation, effects: { selfAssignment: "remove" } },
    { ...proposal.operation, id: "supplied" }]) assert.equal(bindPingProposal({ ...proposal, operation }, capture, seal()).ok, false);
});

test("model actor/IDs/finality/readsets/additional clauses rejected at every boundary; getters not evaluated", () => {
  const proposal = syntheticPlan();
  for (const key of ["actorId", "commandId", "projectId", "inputItemId", "state", "complete", "selectedTaskIds", "expected", "delete", "extraOperations"]) {
    assert.equal(bindPingProposal({ ...proposal, [key]: "untrusted" }, syntheticCapture(), seal()).ok, false, key);
    assert.equal(bindPingProposal({ ...proposal, operation: { ...proposal.operation, [key]: "untrusted" } }, syntheticCapture(), seal()).ok, false, key);
  }
  for (const effects of [{ selfAssignment: "named-person" }, { dueDate: "2026-02-30" }, { statusColumnKey: "custom" },
    { ...proposal.operation.effects, delete: true }, {}]) {
    assert.equal(bindPingProposal({ ...proposal, operation: { kind: "edit_selected", effects } }, syntheticCapture(), seal()).ok, false);
  }
  let reads = 0; const accessor = { ...proposal };
  Object.defineProperty(accessor, "actorId", { enumerable: true, get() { reads++; throw new Error("synthetic_accessor"); } });
  assert.equal(bindPingProposal(accessor, syntheticCapture(), seal()).ok, false); assert.equal(reads, 0);
});

test("malformed capture/readset and incomplete/different aggregate seal fail closed", () => {
  for (const capture of [{ ...syntheticCapture(), selectedTaskIds: ["synthetic-task", "synthetic-task"] },
    { ...syntheticCapture(), commandId: "not-uuid" }, { ...syntheticCapture(), timeZone: "UTC" },
    { ...syntheticCapture(), snapshots: {} }, { ...syntheticCapture(), snapshots: { "synthetic-task": { lane: "todo" } } },
    { ...syntheticCapture(), actorId: "" }, { ...syntheticCapture(), selectedTaskIds: new Array(1) },
    { ...syntheticCapture(), selectedTaskIds: new Array(0xffffffff) }]) {
    assert.equal(normalizePingCapture(capture), null);
  }
  for (const value of [{ ...seal(), state: "incomplete" }, { ...seal(), generationId: "different" },
    { ...seal(), inputItemId: "different" }, { ...seal(), actorId: "pretend" }]) {
    assert.deepEqual(bindPingProposal(syntheticPlan(), syntheticCapture(), value), { ok: false, reason: "incomplete_input" });
  }
});

test("whole-plan refusal/clarification closes without commands; malformed refusal cannot become a plan", () => {
  for (const outcome of ["refusal", "clarification"] as const) {
    assert.deepEqual(bindPingProposal({ version: "ping.proposal.v1", outcome, reason: "unsupported" }, syntheticCapture(), seal()), { ok: false, reason: outcome });
    assert.equal(bindPingProposal({ version: "ping.proposal.v1", outcome, reason: "unsupported", operation: syntheticPlan().operation }, syntheticCapture(), seal()).ok, false);
  }
});

test("subclass/custom array prototypes cannot run inherited validation methods", () => {
  let reads = 0;
  const ids = ["synthetic-task"];
  const exoticPrototype = Object.create(Array.prototype, { every: { get() { reads++; throw new Error("synthetic_inherited_accessor"); } } });
  Object.setPrototypeOf(ids, exoticPrototype);
  assert.equal(normalizePingCapture({ ...syntheticCapture(), selectedTaskIds: ids }), null); assert.equal(reads, 0);
  class Subclass extends Array<string> {}
  assert.equal(normalizePingCapture({ ...syntheticCapture(), selectedTaskIds: new Subclass("synthetic-task") }), null);
});
