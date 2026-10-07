import { strict as assert } from "node:assert";
import { test } from "node:test";
import { enrichRelationshipCandidates } from "./relationship-observations";
import type { TaskSignal } from "./types";
import type { Triggered } from "./triggers";
import { ledgerFromLegacyBriefing } from "../analytics/ledger-adapters";

const now = Date.parse("2026-10-07T12:00:00Z");
const task = (id: string, overrides: Partial<TaskSignal> = {}): TaskSignal => ({ id, title: `Title ${id}`, workspaceId: "w", lane: "next", priority: null, dueAt: now + 86400000, idleDays: 6, commentCount: 0, blockedBy: [], sourceLabel: "Tasks", movedToShippedAt: null, ...overrides });
const evidence = (id: string, complete = false, workspaceId = "w") => ({ id, workspaceId, complete, lane: complete ? "shipped" : "next", boardColumnKey: null });
const candidate = (dependent: TaskSignal, trigger: Triggered["trigger"] = "blocked-too-long"): Triggered => ({ task: dependent, trigger, severity: 72, reasons: ["Existing reason"] });
const enrich = (row: Triggered, signals: TaskSignal[]) => enrichRelationshipCandidates([row], signals, now, "UTC")[0]!;

test("open-edge explanation includes completed siblings and anonymous uncertainty", () => {
  const open = task("open");
  const done = task("done", { lane: "shipped" });
  const dependent = task("dependent", { blockedBy: [open.id, done.id, "unavailable"], dependencyCoverage: "partial",
    prerequisiteEvidence: [evidence(open.id), evidence(done.id, true)] });
  const result = enrich({ ...candidate(open, "blocking-due-work"), relatedTaskId: dependent.id }, [dependent, open, done]);
  assert.deepEqual(result.representedTaskIds, [dependent.id, open.id, done.id].sort());
  assert.match(result.detailOverride!, /Title dependent.*Title open/);
  assert.match(result.detailOverride!, /verified complete: “Title done”/);
  assert.match(result.detailOverride!, /state is unknown/);
  assert.doesNotMatch(result.detailOverride!, /unavailable|are complete|all prerequisites/);
});

test("near-due mixed relation carries complete authorized membership without a readiness claim", () => {
  const open = task("open");
  const done = task("done", { lane: "shipped" });
  const dependent = task("dependent", { blockedBy: [open.id], dependencyCoverage: "complete",
    prerequisiteEvidence: [evidence(done.id, true), evidence(open.id)] });
  const row = { ...candidate(open, "blocking-due-work"), relatedTaskId: dependent.id };
  const result = enrich(row, [dependent, done, open]);
  assert.equal(result.task, open);
  assert.equal(result.relatedTaskId, dependent.id);
  assert.equal(result.severity, row.severity);
  assert.deepEqual(result.representedTaskIds, ["dependent", "done", "open"]);
  assert.equal(result.detailOverride, "“Title dependent” is due tomorrow. Listed prerequisites still open: “Title open”. Listed prerequisites verified complete: “Title done”.");
  assert.doesNotMatch(result.detailOverride!, /no longer held up|are complete|ready|started/);
});

test("near-due relation deduplicates inspected evidence and keeps foreign, missing and hidden names private", () => {
  const open = task("open");
  const dependent = task("dependent", { dependencyCoverage: "partial",
    blockedBy: [open.id, open.id, "hidden-complete", "foreign-secret", "missing-secret", "dependent"],
    prerequisiteEvidence: [evidence(open.id), evidence(open.id), evidence("hidden-complete", true), evidence("foreign-secret", true, "other")] });
  const result = enrich({ ...candidate(open, "blocking-due-work"), relatedTaskId: dependent.id },
    [dependent, open, task("foreign-secret", { title: "Private foreign title", workspaceId: "other" })]);
  assert.deepEqual(result.representedTaskIds, ["dependent", "hidden-complete", "open"]);
  assert.match(result.detailOverride!, /still open: “Title open”/);
  assert.match(result.detailOverride!, /verified complete: 1 prerequisite outside this visible task list/);
  assert.match(result.detailOverride!, /not confirmed clear.*state is unknown/);
  assert.doesNotMatch(result.detailOverride!, /hidden-complete|foreign-secret|missing-secret|Private foreign title|are complete/);
});

test("long near-due relation retains full states and source set through ledger receiving limits", () => {
  const open = Array.from({ length: 8 }, (_, index) => task(`open-${index}`, { title: `Open prerequisite ${index}: ${"lengthy visible task evidence ".repeat(8)}` }));
  const done = task("done", { title: "Completed check", lane: "shipped" });
  const dependent = task("dependent", { title: "Long dependent title ".repeat(30), dependencyCoverage: "partial",
    blockedBy: [...open.map(item => item.id), "foreign-secret", "missing-secret"],
    prerequisiteEvidence: [...open.map(item => evidence(item.id)), evidence(done.id, true), evidence("hidden-complete", true), evidence("foreign-secret", true, "other")] });
  const row = enrich({ ...candidate(open[0]!, "blocking-due-work"), relatedTaskId: dependent.id }, [dependent, ...open, done]);
  const ids = [dependent.id, ...open.map(item => item.id), done.id, "hidden-complete"].sort();
  assert.deepEqual(row.representedTaskIds, ids);
  const ledger = ledgerFromLegacyBriefing({ userId: "test", generatedAt: now, greetingHour: 12,
    needsAttention: [{ id: open[0]!.id, text: open[0]!.title, detail: row.detailOverride!, trigger: row.trigger,
      reasons: row.reasons, sourceLabel: "Tasks", workspaceId: "w", evidenceTaskIds: row.representedTaskIds }],
    movingWell: [], quietRisks: [], suggestedFocus: [], isEmpty: false,
    readCount: ids.length, triggeredCount: ids.length, readTaskIds: ids, triggeredTaskIds: ids },
  { generatedAtLabel: "Today", allowedAppOrigin: "https://app.signalstudio.ie" });
  const received = ledger.entries[0]!;
  assert.match(received.detail!, /dependent task is due tomorrow.*8 prerequisites open.*2 prerequisites complete.*2 prerequisites unverified/);
  assert.match(received.detail!, /not confirmed clear to move ahead/);
  assert.ok(received.detail!.length <= 520);
  assert.ok(received.reasons.length <= 6 && received.reasons.every(reason => reason.length <= 280));
  assert.match(received.reasons.join(" "), /Complete prerequisite: “Completed check”/);
  assert.equal(received.receipt.evidenceCount, ids.length);
  assert.doesNotMatch(JSON.stringify(received), /foreign-secret|missing-secret|hidden-complete|no longer held up|are complete/);
});

test("round8receiving long mixed prerequisites retain complete and unknown certainty at the ledger boundary", () => {
  const open = Array.from({ length: 8 }, (_, index) => task(`open-${index}`, { title: `Open prerequisite ${index}: ${"lengthy visible task evidence ".repeat(8)}` }));
  const completed = task("completed", { title: "Completed prerequisite", lane: "shipped" });
  const dependent = task("dependent", { dependencyCoverage: "partial", blockedBy: [...open.map(item => item.id), "opaque-missing"],
    prerequisiteEvidence: [...open.map(item => evidence(item.id)), evidence(completed.id, true)] });
  const row = enrich(candidate(dependent, "prerequisites-unverified"), [dependent, ...open, completed]);
  const ids = [dependent.id, ...open.map(item => item.id), completed.id].sort();
  const ledger = ledgerFromLegacyBriefing({ userId: "test", generatedAt: now, greetingHour: 12, needsAttention: [], movingWell: [],
    quietRisks: [{ id: dependent.id, text: dependent.title, detail: row.detailOverride!, trigger: row.trigger, reasons: row.reasons,
      sourceLabel: dependent.sourceLabel, workspaceId: "w", evidenceTaskIds: row.representedTaskIds }], suggestedFocus: [], isEmpty: false,
    readCount: ids.length, triggeredCount: ids.length, readTaskIds: ids, triggeredTaskIds: ids },
  { generatedAtLabel: "Today", allowedAppOrigin: "https://app.signalstudio.ie" });
  const received = ledger.entries[0]!;
  assert.match(received.detail!, /8 (?:listed )?prerequisites? (?:still )?open/i);
  assert.match(received.detail!, /1 (?:listed )?prerequisites? (?:verified )?complete/i);
  assert.match(received.detail!, /unknown|unverified/i);
  assert.match(received.detail!, /not confirmed clear to move ahead/i);
  assert.ok(received.detail!.length <= 520);
  assert.ok(received.reasons.length <= 6 && received.reasons.every(reason => reason.length <= 280));
  assert.match(received.reasons.join(" "), /\d+ (?:remaining|additional|other) prerequisite/i);
  assert.equal(received.receipt.evidenceCount, ids.length);
  assert.deepEqual(row.representedTaskIds, ids);
  assert.doesNotMatch(JSON.stringify(received), /opaque-missing|open-\d/);
});

test("all visible open prerequisites contribute full titles and a deterministic source set", () => {
  const dependent = task("d", { blockedBy: ["b", "a", "c"], prerequisiteEvidence: [evidence("b"), evidence("a"), evidence("c")] });
  const result = enrich(candidate(dependent), [dependent, task("c"), task("a"), task("b")]);
  assert.deepEqual(result.representedTaskIds, ["a", "b", "c", "d"]);
  assert.equal(result.detailOverride, "Listed prerequisites still open: “Title a”, “Title b”, “Title c”.");
});

test("mixed completed and open records are explicitly distinguished", () => {
  const dependent = task("d", { blockedBy: ["a"], prerequisiteEvidence: [evidence("a"), evidence("b", true)] });
  const result = enrich(candidate(dependent), [dependent, task("a"), task("b", { lane: "shipped" })]);
  assert.deepEqual(result.representedTaskIds, ["a", "b", "d"]);
  assert.match(result.detailOverride!, /still open: “Title a”/);
  assert.match(result.detailOverride!, /verified complete: “Title b”/);
});

test("completed hidden evidence remains anonymous and retains released semantics", () => {
  const dependent = task("d", { dependencyCoverage: "complete", prerequisiteEvidence: [evidence("private-a", true), evidence("private-b", true)] });
  const result = enrich(candidate(dependent, "prerequisites-complete"), [dependent]);
  assert.equal(result.detailOverride, "Listed prerequisites are complete: 2 prerequisites outside this visible task list. It is no longer held up by that listed work.");
  assert.doesNotMatch(result.detailOverride!, /private-|started|runnable/);
  assert.deepEqual(result.representedTaskIds, ["d", "private-a", "private-b"]);
});

test("foreign and missing edges remain unknown without fabricated states or leaked ids", () => {
  const dependent = task("d", { blockedBy: ["foreign-secret", "missing-secret", "a"], dependencyCoverage: "partial", prerequisiteEvidence: [evidence("foreign-secret", true, "other")] });
  const result = enrich(candidate(dependent, "prerequisites-unverified"), [dependent, task("a"), task("foreign-secret", { workspaceId: "other" })]);
  assert.deepEqual(result.representedTaskIds, ["a", "d"]);
  assert.match(result.detailOverride!, /still open: “Title a”/);
  assert.match(result.detailOverride!, /state is unknown/);
  assert.doesNotMatch(result.detailOverride!, /foreign-secret|missing-secret|complete/);
});

test("blocking observation preserves its chosen anchor and singleton prose compatibility", () => {
  const blocker = task("a");
  const dependent = task("d", { blockedBy: ["a", "b"], prerequisiteEvidence: [evidence("a"), evidence("b")] });
  const row = { ...candidate(blocker, "blocking-due-work"), relatedTaskId: "d", relatedTaskTitle: dependent.title };
  const result = enrich(row, [blocker, dependent, task("b")]);
  assert.equal(result.task, blocker);
  assert.equal(result.reasons, row.reasons);
  assert.equal(result.severity, row.severity);
  assert.equal(result.relatedTaskId, "d");
  assert.match(result.detailOverride!, /“Title d” is due tomorrow/);
  assert.match(result.detailOverride!, /Title a.*Title b/);
  assert.deepEqual(result.representedTaskIds, ["a", "b", "d"]);
  const single = task("s", { blockedBy: ["a"] });
  const singleRelation = enrich({ ...candidate(blocker, "blocking-due-work"), relatedTaskId: single.id }, [single, blocker]);
  assert.equal(singleRelation.detailOverride, "“Title s” is due tomorrow. Listed prerequisite still open: “Title a”.");
  assert.deepEqual(singleRelation.representedTaskIds, ["a", "s"]);
  assert.equal(enrich(candidate(single), [single, blocker]).detailOverride, undefined);
  const unrelated = candidate(blocker, "due-soon");
  assert.equal(enrich(unrelated, [blocker]), unrelated);
});
