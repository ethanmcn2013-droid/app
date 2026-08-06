import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Source-level guard on the sponsored-use call sites.
 *
 * These emits sit immediately after a user's write, and the ways they go wrong
 * are silent: an emit moved above its commit, an emit on a replay path that
 * wrote nothing, or a raw identifier passed where a hash is expected. None of
 * those fail a unit test, because the sink swallows everything by design.
 *
 * So the contract is asserted against the source text.
 */

const read = (relative) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

const notes = read("src/modules/notes/server/actions/notes.ts");
const tasks = read("src/server/actions/tasks.ts");
const timeline = read("src/modules/timeline/server/actions/workspaces.ts");
const signal = read("src/modules/signal/app/signal-ledger-actions.ts");
const callSite = read("src/lib/account/instrumentation/call-site.ts");
const sink = read("src/lib/account/instrumentation/sink.ts");
const contract = JSON.parse(
  read("src/lib/account/instrumentation/venue-meaningful-action.v1.json"),
);

test("every wired kind belongs to its product in the frozen contract", () => {
  const wired = [
    ["notes", "note_created"],
    ["notes", "note_materially_edited"],
    ["tasks", "task_created"],
    ["tasks", "task_completed"],
    ["timeline", "timeline_published"],
    ["timeline", "timeline_visibility_changed"],
    ["timeline", "timeline_curated"],
    ["signal", "briefing_deliberately_opened"],
  ];
  for (const [product, kind] of wired) {
    assert.ok(
      contract.kinds[product].includes(kind),
      `${kind} must be allowlisted under ${product}`,
    );
  }
});

test("the subject handed to the emitter is the Clerk id, per the contract", () => {
  // The attribution join closes on redemptions.user_clerk_id and nothing else.
  assert.equal(contract.subjectIdSource, "clerk-user-id");
});

test("Notes emits only on a real insert, not on the replay reconcile", () => {
  const idx = notes.indexOf("if (inserted[0]) {");
  assert.ok(idx > 0, "the idempotent insert guard must still exist");
  const guarded = notes.slice(idx, idx + 600);
  assert.match(guarded, /note_created/);
  // The reconcile path below must stay silent.
  const reconcile = notes.slice(notes.indexOf("const existing = await readOwnedNote"));
  assert.ok(!reconcile.slice(0, 400).includes("recordSponsoredUse"));
});

test("Notes emits the edit only after the compare-and-swap succeeded", () => {
  const idx = notes.indexOf("if (updated[0]) {");
  assert.ok(idx > 0);
  assert.match(notes.slice(idx, idx + 700), /note_materially_edited/);
});

test("task completion is classified, never assumed", () => {
  assert.match(tasks, /classifyLaneTransition\(row\.lane, target\)/);
  assert.match(tasks, /classifyLaneTransition\(row\.lane, toLane\)/);
});

test("the update path diffs against a pre-read rather than trusting the patch", () => {
  assert.match(tasks, /assignees: tasks\.assignees/);
  assert.match(tasks, /startDay: tasks\.startDay/);
  assert.match(tasks, /task_reassigned/);
  assert.match(tasks, /task_rescheduled/);
});

test("the six write paths that needed a subject resolve one without a serial round-trip", () => {
  const promiseAll = tasks.match(
    /Promise\.all\(\[getCurrentUser\(\), getActiveWorkspace\(\)\]\)/g,
  );
  assert.ok(promiseAll && promiseAll.length >= 4, "expected the Promise.all shape");
});

test("Timeline proves a canonical workspace rather than a slug", () => {
  // Split on the call, not the identifier, so the import is not counted.
  // System B (publishWorkspaceAction / unpublishWorkspaceAction) was deleted
  // as dead code with zero callers (2026-08-05); curate is the one surviving
  // emit site in this file.
  const emits = timeline.split("recordSponsoredUse(").slice(1);
  assert.ok(emits.length >= 1, "curate must emit");
  for (const block of emits) {
    assert.match(
      block.slice(0, 400),
      /workspaceId: workspace\.suiteWorkspaceId/,
      "a Timeline emit must carry the canonical workspace, which may be null",
    );
  }
});

test("the emit helper cannot throw into a write path", () => {
  assert.match(callSite, /try \{/);
  assert.match(callSite, /\} catch \{/);
});

test("the event id is bucketed by venue-local day, which is what makes autosave safe", () => {
  assert.match(callSite, /venueLocalDate\(input\.occurredAt\)/);
  assert.match(callSite, /Europe\/Dublin/);
});

test("no raw identifier is placed on the event by a call site", () => {
  // The emitter hashes; a call site passing a pre-hashed value would break the
  // join, and one passing content would be rejected by validation.
  assert.match(callSite, /subjectId: input\.subjectId/);
  assert.match(callSite, /workspaceId: input\.workspaceId/);
  assert.ok(!callSite.includes("title"));
  assert.ok(!callSite.includes("body"));
});

test("the transport is one file, so landing ingest touches no call site", () => {
  assert.match(sink, /sponsoredUseSink/);
  assert.ok(!sink.includes("fetch("), "no network today");
  assert.ok(!callSite.includes("fetch("));
});

test("the flag and retention match the frozen contract", () => {
  assert.equal(contract.featureFlagEnv, "SPONSOR_USAGE_EVENTS");
  assert.equal(contract.retentionDays, 35);
  assert.equal(contract.suppression.behaviouralMinimumWorkspaces, 3);
  assert.equal(contract.suppression.rateMinimumWorkspaces, 5);
});

test("Signal measures a deliberate gesture, not an automatic landing", () => {
  // Opening a ledger entry cannot happen without a person choosing it, and the
  // guards above the emit redirect away unless the briefing resolved.
  assert.match(signal, /briefing_deliberately_opened/);
  assert.match(signal, /if \(!demoMode\) \{/);
  // The excluded candidates must stay excluded as *calls*. They are named in
  // the comment above the emit, which is the point: the reasoning is recorded
  // where the next person will look.
  assert.ok(!/recordSurfaced\s*\(/.test(signal), "the surfaced record is a system event");
  assert.ok(!/recordPlanningEvent\s*\(/.test(signal), "the planning event is a view");
});

test("demo and review sessions are excluded from Signal attribution", () => {
  const emitIndex = signal.indexOf("briefing_deliberately_opened");
  const guardIndex = signal.lastIndexOf("if (!demoMode) {", emitIndex);
  assert.ok(guardIndex > 0 && guardIndex < emitIndex, "the emit must sit inside the guard");
});

test("acknowledgement stays unmapped, and the contract says exactly why", () => {
  assert.ok(contract.unmappedKinds.briefing_acknowledged);
  assert.match(contract.unmappedKinds.briefing_acknowledged, /no caller/);
  assert.equal(
    contract.unmappedKinds.briefing_deliberately_opened,
    undefined,
    "the deliberate open is mapped now, so it must not still be listed as unmapped",
  );
});
