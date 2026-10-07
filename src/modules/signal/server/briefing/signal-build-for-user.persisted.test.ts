import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { freshFileDb } from "@/server/db/memory-test-db";
import { ledgerFromLegacyBriefing } from "../../lib/analytics/ledger-adapters";
import { buildOverviewModel } from "../../lib/overview/overview-model";
import { dueInstantForDay, toCalendarDate } from "@/lib/tasks/anchor-due";

// Actual source, scope authorization, orchestrator, engine, Home and ledger.
// Only isolated DB URLs and the clock are controlled; no source is mocked.
const NOW = Date.parse("2026-09-27T12:00:00Z"), DAY = 86_400_000;
const WORKSPACE = "synthetic-lifecycle", ACTOR = "synthetic-lifecycle-clerk";
let fixture: Awaited<ReturnType<typeof freshFileDb>>, signalStore: Client;
let orchestrator: typeof import("./signal-build-for-user");
let homeModule: typeof import("@/app/app/home/home-data");
let tasksClientModule: typeof import("../tasks-db/signal-tasks-db-client");
const envNames = ["TASKS_DATABASE_URL", "TASKS_AUTH_TOKEN", "SIGNAL_DATABASE_URL", "SIGNAL_AUTH_TOKEN", "SIGNAL_ACCESS_MODE", "NEXT_PUBLIC_SIGNAL_ACCESS_MODE", "SIGNAL_PERIOD_SIGNAL_ENABLED", "VERCEL_ENV"];
const saved = Object.fromEntries(envNames.map(key => [key, process.env[key]]));

function scratchUrl(file: string) {
  const child = relative(resolve(tmpdir()), resolve(file));
  assert.ok(child && !isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`), "database must be inside process scratch");
  return pathToFileURL(file).href;
}
before(async () => {
  for (const key of envNames) delete process.env[key];
  process.env.SIGNAL_ACCESS_MODE = "production";
  mock.timers.enable({ apis: ["Date"], now: NOW });
  fixture = await freshFileDb();
  const file = (await fixture.client.execute("PRAGMA database_list")).rows.find(row => row.name === "main")?.file;
  assert.equal(typeof file, "string"); process.env.TASKS_DATABASE_URL = scratchUrl(String(file));
  const directory = mkdtempSync(join(tmpdir(), "signal-lifecycle-consumer-"));
  process.env.SIGNAL_DATABASE_URL = scratchUrl(join(directory, "signal.db"));
  signalStore = createClient({ url: process.env.SIGNAL_DATABASE_URL });
  const migrations = new URL("../../../../../drizzle-signal/", import.meta.url);
  for (const name of readdirSync(migrations).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    await signalStore.executeMultiple(readFileSync(new URL(name, migrations), "utf8"));
  }
  await fixture.client.executeMultiple(`
    INSERT INTO users(id,clerk_id,email,color,initials) VALUES ('synthetic-owner','${ACTOR}','owner@example.invalid','blue','SO'),('synthetic-second-owner','synthetic-second-clerk','second@example.invalid','green','SS'),('synthetic-foreign','synthetic-foreign-clerk','owner@example.invalid','blue','SF');
    INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES ('${WORKSPACE}','${WORKSPACE}','Synthetic lifecycle','synthetic-owner'),('synthetic-foreign-project','synthetic-foreign-project','Foreign project','synthetic-foreign');
  `);
  const today = Math.floor(NOW / DAY);
  await signalStore.executeMultiple(`
    INSERT INTO analytics_users(clerk_id,linked_workspace_id,timezone) VALUES ('${ACTOR}','${WORKSPACE}','UTC');
    INSERT INTO briefing_feedback(clerk_id,item_key,verdict,trigger_id) VALUES ('${ACTOR}','dismissed-task','not-useful','idle');
    INSERT INTO surfaced_items(clerk_id,item_key,trigger_id,first_day,last_day,run_days) VALUES ('${ACTOR}','carry-task','idle',${today - 2},${today - 1},2);
    INSERT INTO phrasing_rotations(clerk_id,trigger_id,last_index,last_fired_at) VALUES ('${ACTOR}','idle',4,${NOW / 1000 - DAY / 1000});
  `);
  orchestrator = await import("./signal-build-for-user");
  homeModule = await import("@/app/app/home/home-data");
  tasksClientModule = await import("../tasks-db/signal-tasks-db-client");
});
beforeEach(async () => {
  await fixture.client.executeMultiple("DELETE FROM activities; DELETE FROM tasks; DELETE FROM meta;");
});
after(() => {
  tasksClientModule?.getTasksClient()?.close(); signalStore?.close(); fixture?.cleanup(); mock.timers.reset();
  for (const key of envNames) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});
async function task(id: string, options: { lane?: string; column?: string; completed?: number; archived?: number; parent?: string; blocked?: string[]; updated?: number; assignees?: string[] } = {}) {
  await fixture.client.execute({
    sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,board_column_key,priority,assignees,tags,blocked_by,due_at,created_at,updated_at,completed_at,archived_at,parent_task_id) VALUES (?,?,?,?,?,?,'p2',?,'[]',?,?,?,?,?,?,?)",
    args: [id, WORKSPACE, (await fixture.client.execute("SELECT COUNT(*) AS count FROM tasks")).rows[0].count as number + 1, id, options.lane ?? "done", options.column ?? null, JSON.stringify(options.assignees ?? []), JSON.stringify(options.blocked ?? []), (NOW - DAY) / 1000, (NOW - 40 * DAY) / 1000, (options.updated ?? NOW - 3_600_000) / 1000, options.completed == null ? null : options.completed / 1000, options.archived == null ? null : options.archived / 1000, options.parent ?? null],
  });
}
async function build() {
  const result = await orchestrator.buildBriefingForUser({ clerkId: ACTOR, cadence: "daily", recordReadState: false, scope: { kind: "workspace", workspaceId: WORKSPACE } });
  assert.equal(result.kind, "ok"); if (result.kind !== "ok") throw new Error("authorized fixture unexpectedly refused");
  return result;
}
async function home() {
  const result = await homeModule.loadHomeData({ clerkId: ACTOR, scope: { kind: "workspace", workspaceId: WORKSPACE } });
  assert.equal(result.kind, "ok"); if (result.kind !== "ok") throw new Error("authorized Home fixture unexpectedly refused");
  return result;
}
async function config(value: string) {
  await fixture.client.execute({ sql: "INSERT INTO meta(key,value,updated_at) VALUES (?,?,?)", args: [`board:${WORKSPACE}:columns`, value, NOW / 1000] });
}

test("actual custom stage stays open in Home and ledger without start or review inference", async () => {
  await config(JSON.stringify({ custom: [{ key: "evidence-check", name: "Evidence check" }], doneKeys: ["done"] }));
  await task("inspect-materials", { lane: "review", column: "evidence-check" });
  await task("known-doing", { lane: "doing" });
  const result = await build();
  const custom = result.signals.find(task => task.id === "inspect-materials")!;
  assert.deepEqual(custom.stage, { key: "evidence-check", label: "Evidence check", phase: "unknown", complete: false });
  const view = await home();
  const row = view.myTasks.find(task => task.id === "inspect-materials")!;
  assert.equal(row.lane, "open"); assert.equal(row.stageLabel, "Evidence check");
  assert.equal(view.stats.inReview, 0);
  assert.equal(view.deadlines.flatMap(group => group.rows).find(task => task.id === row.id)?.lane, "open");
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Test read", allowedAppOrigin: "https://app.signalstudio.ie" });
  const unknown = ledger.entries.find(entry => entry.text.toLowerCase() === custom.title.toLowerCase())!;
  assert.ok(unknown.reasons.some(reason => /Still open in “Evidence check”/.test(reason)));
  assert.ok(unknown.reasons.every(reason => !/^Started|^Not started|^Sitting in review/.test(reason)));
  assert.ok(ledger.entries.find(entry => entry.text === "Known-doing")?.reasons.some(reason => /^Started/.test(reason)));
});

test("actual inspected terminal prerequisite counts once while separate deadline/readiness rows keep private ids internal", async () => {
  await task("archived-safety-proof", { lane: "done", archived: NOW - DAY });
  await task("send-crate", { lane: "doing", blocked: ["archived-safety-proof", "archived-safety-proof"] });
  await fixture.client.execute({ sql: "UPDATE tasks SET due_at=? WHERE id='send-crate'", args: [(NOW + DAY) / 1000] });
  const result = await build();
  assert.deepEqual(result.signals.map(task => task.id), ["send-crate"]);
  assert.deepEqual(result.signals[0]!.prerequisiteEvidence,
    [{ id: "archived-safety-proof", workspaceId: WORKSPACE, lane: "done", boardColumnKey: null, complete: true }]);
  assert.deepEqual(result.briefing.readTaskIds, ["archived-safety-proof", "send-crate"]);
  assert.equal(result.briefing.needsAttention.length, 2);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Test read", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.equal(ledger.entries.length, 2);
  assert.deepEqual(ledger.entries.map(entry => entry.receipt.evidenceCount), [1, 2]);
  assert.equal(result.briefing.readCount, 2); assert.equal(result.briefing.triggeredCount, 2);
  assert.equal(ledger.readCounts, null, "existing partial activity coverage still withholds public totals");
  const view = await home();
  assert.equal(view.stats.open, 1);
  assert.deepEqual(view.signalRows.map(row => row.href), ["/app/task/send-crate", "/app/task/send-crate"]);
  assert.equal(new Set(view.signalRows.map(row => row.observationId)).size, 2);
  assert.doesNotMatch(JSON.stringify({ ledger, view }), /archived-safety-proof|prerequisiteEvidence|evidenceTaskIds|readTaskIds/);
});
async function hashes() {
  const out: Record<string, string> = {};
  for (const [name, store] of Object.entries({ tasks: fixture.client, signal: signalStore })) {
    const catalog = (await store.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows;
    const tables = [];
    for (const table of catalog) {
      const tableName = String(table.name), escaped = tableName.replaceAll('"', '""');
      tables.push({ name: tableName, rows: (await store.execute(`SELECT * FROM "${escaped}"`)).rows.map(row => JSON.stringify(row)).sort() });
    }
    out[name] = createHash("sha256").update(JSON.stringify(tables)).digest("hex");
  }
  return out;
}

test("actual Home recognizes configured terminal as finished", async () => {
  await config(JSON.stringify({ custom: [{ key: "accepted", name: "Accepted" }], doneKeys: ["accepted"] }));
  await task("accepted", { lane: "doing", column: "accepted", completed: NOW - DAY });
  const view = await home(); assert.deepEqual({ open: view.stats.open, done: view.stats.doneThisWeek }, { open: 0, done: 1 });
});
test("actual Home preserves review even with dependencies", async () => {
  await task("dependency", { lane: "doing" });
  await task("review", { lane: "review", blocked: ["dependency"] });
  const view = await home(); assert.equal(view.stats.inReview, 1);
  assert.equal((await build()).signals.find(row => row.id === "review")?.lane, "review");
});

test("completed hidden dependency stops stale blocked claims in actual Home and legacy ledger", async () => {
  await task("cleared-upstream", { completed: NOW - 10 * DAY, archived: NOW - DAY });
  await task("dependent", { lane: "doing", blocked: ["cleared-upstream"], updated: NOW - 10 * DAY });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL WHERE id='dependent'");
  const beforeHashes = await hashes(), result = await build(), view = await home();
  assert.deepEqual(result.signals.map(row => ({ id: row.id, blockedBy: row.blockedBy })), [{ id: "dependent", blockedBy: [] }]);
  assert.equal(view.stats.open, 1); assert.ok(view.signalRows.every(row => row.trigger !== "blocked-too-long"));
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", scopeLabel: result.authorizedScope.label, scopeKind: "workspace", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.doesNotMatch(JSON.stringify(ledger), /upstream|cleared-upstream|has not cleared|have not cleared/);
  assert.deepEqual(await hashes(), beforeHashes);
  await fixture.client.execute("UPDATE tasks SET lane='doing' WHERE id='cleared-upstream'");
  const reopened = await build();
  assert.deepEqual(reopened.signals[0].blockedBy, ["cleared-upstream"]);
  assert.deepEqual((await build()).signals[0].blockedBy, ["cleared-upstream"]);
  assert.ok((await home()).signalRows.every(row => row.trigger !== "blocked-too-long"), "incomplete activity history cannot establish blocker age");
  const reopenedLedger = ledgerFromLegacyBriefing(reopened.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.equal(reopenedLedger.emptyState?.kind, "coverage");
  assert.equal(reopenedLedger.readCounts, null);
});

test("persisted hidden completion produces dated prerequisite observation in Home and ledger, then reopen removes it", async () => {
  await task("completed-prerequisite", { completed: NOW - DAY, archived: NOW - DAY });
  await task("dated-dependent", { lane: "doing", blocked: ["completed-prerequisite"] });
  await fixture.client.execute({ sql: "UPDATE tasks SET due_at=? WHERE id='dated-dependent'", args: [(NOW + 3 * DAY) / 1000] });
  const before = await hashes(), result = await build(), view = await home();
  assert.deepEqual(result.signals.map(signal => [signal.id, signal.hasCompletedListedPrerequisite, signal.dependencyCoverage]),
    [["dated-dependent", true, "complete"]]);
  assert.equal(view.signalRows.find(row => row.id === "dated-dependent")?.trigger, "prerequisites-complete");
  assert.match(view.signalRows.find(row => row.id === "dated-dependent")?.why ?? "", /listed prerequisites are complete/i);
  assert.match(view.signalRows.find(row => row.id === "dated-dependent")?.why ?? "", /30 Sep/);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.ok(ledger.entries.some(entry => entry.detail?.includes("listed prerequisites are complete") && entry.detail?.includes("30 Sep")));
  assert.doesNotMatch(JSON.stringify(ledger), /completed-prerequisite/);
  assert.deepEqual(await hashes(), before);
  await fixture.client.execute("UPDATE tasks SET lane='doing' WHERE id='completed-prerequisite'");
  const reopened = await build();
  assert.equal(reopened.signals[0]?.hasCompletedListedPrerequisite, false);
  assert.ok((await home()).signalRows.every(row => row.trigger !== "prerequisites-complete"));
});

test("persisted visible blocker of near-due work has its own Home and ledger observation without activity-age claims", async () => {
  await task("open-prerequisite", { lane: "doing" });
  await task("near-due-dependent", { lane: "doing", blocked: ["open-prerequisite"] });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL WHERE id='open-prerequisite'");
  await fixture.client.execute({ sql: "UPDATE tasks SET due_at=? WHERE id='near-due-dependent'", args: [(NOW + DAY) / 1000] });
  const before = await hashes(), result = await build(), view = await home();
  assert.deepEqual(view.signalRows.map(row => [row.id, row.trigger]),
    [["near-due-dependent", "due-soon"], ["open-prerequisite", "blocking-due-work"]]);
  assert.equal(view.signalRows.find(row => row.id === "open-prerequisite")?.due, null, "the blocker has no borrowed deadline");
  assert.ok(result.signals.every(signal => signal.idleDays === null));
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.ok(ledger.entries.some(entry => entry.text === "Open-prerequisite" && entry.detail?.includes("near-due-dependent")));
  assert.doesNotMatch(JSON.stringify(ledger), /for five days|idleDays|blocked-too-long/);
  assert.deepEqual(await hashes(), before);
});

test("persisted deadline and prerequisite observations keep separate full meanings in Home and Briefing", async () => {
  await task("safety-check", { lane: "doing" });
  await task("publish-map", { lane: "todo", blocked: ["safety-check"] });
  await fixture.client.execute({ sql: "UPDATE tasks SET due_at=?,priority=CASE id WHEN 'publish-map' THEN 'p1' ELSE 'p2' END", args: [NOW / 1000 + 3_600] });
  const before = await hashes(), result = await build(), view = await home();
  assert.deepEqual(view.signalRows.map(row => row.id), ["publish-map", "safety-check", "safety-check"]);
  const row = view.signalRows[0]!;
  assert.equal(row.trigger, "due-soon");
  assert.match(row.why, /today|hour/i);
  assert.doesNotMatch(row.why, /safety-check|prerequisite/);
  assert.match(view.signalRows.find(row => row.trigger === "blocking-due-work")!.why, /publish-map/);
  assert.equal(new Set(view.signalRows.map(row => row.observationId)).size, 3);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.equal(ledger.entries[0]?.detail, row.why);
  assert.deepEqual(await hashes(), before);
});

test("saved title edit reaches a dated observation without claiming progress or complete history", async () => {
  await task("catalogue", { lane: "doing", assignees: ["synthetic-owner", "synthetic-second-owner"] });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL WHERE id='catalogue'");
  await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES ('recorded-title-edit',?,'catalogue','synthetic-owner','update',?,?)", args: [WORKSPACE, JSON.stringify({ kind: "update", field: "title" }), (NOW - 1_000) / 1000] });
  const before = await hashes(), result = await build(), view = await home();
  assert.equal(result.signals[0]?.hasRecordedTitleEdit, true);
  assert.deepEqual(result.signals[0]?.assignees, [{ id: "synthetic-owner" }, { id: "synthetic-second-owner" }]);
  assert.deepEqual(result.signals[0]?.latestValidatedTitleEdit, {
    at: new Date(NOW - 1_000).toISOString(), kind: "update", field: "title",
  });
  assert.equal(result.signals[0]?.idleDays, null);
  assert.equal(view.signalRows.length, 1);
  assert.equal(view.signalRows[0]?.trigger, "recorded-activity");
  assert.match(view.signalRows[0]?.why ?? "", /title edit/i);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.entries[0]?.state, "recorded");
  assert.match(ledger.coverageNote ?? "", /recorded title edit does not establish meaningful work progress/i);
  assert.match(ledger.coverageNote ?? "", /history is incomplete/i);
  const overview = buildOverviewModel({ ledger, timezone: "UTC", legacy: { briefing: result.briefing, signals: result.signals, authorizedScope: result.authorizedScope } });
  assert.equal(overview.coverage?.note, ledger.coverageNote);
  assert.doesNotMatch(JSON.stringify(ledger), /recorded-title-edit|synthetic-owner|synthetic-second-owner|latestValidatedTitleEdit|only event|no activity/i);
  assert.deepEqual(await hashes(), before);
});

test("absent, future, pre-creation and foreign title-edit records cannot manufacture metadata evidence", async () => {
  await task("catalogue", { lane: "doing" });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL WHERE id='catalogue'");
  for (const [id, workspace, at] of [
    ["foreign-edit", "synthetic-foreign-project", NOW - 1_000],
    ["future-edit", WORKSPACE, NOW + 1_000],
    ["before-creation", WORKSPACE, NOW - 41 * DAY],
  ] as const) {
    await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,'catalogue','synthetic-owner','update',?,?)", args: [id, workspace, JSON.stringify({ kind: "update", field: "title" }), at / 1000] });
  }
  const before = await hashes(), result = await build();
  assert.equal(result.signals[0]?.hasRecordedTitleEdit, false);
  assert.equal(result.signals[0]?.latestValidatedTitleEdit, undefined);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.doesNotMatch(ledger.coverageNote ?? "", /recorded title edit/i);
  assert.match(ledger.coverageNote ?? "", /history is incomplete/);
  assert.equal(ledger.entries.length, 0);
  assert.deepEqual(await hashes(), before);
});

for (const [label, kind, payload] of [
  ["malformed JSON", "update", "{broken"],
  ["missing payload kind", "update", JSON.stringify({ field: "title" })],
  ["contradictory payload kind", "update", JSON.stringify({ kind: "commentAdd", field: "title" })],
  ["missing field", "update", JSON.stringify({ kind: "update" })],
  ["other tracked field", "update", JSON.stringify({ kind: "update", field: "priority" })],
  ["non-string field", "update", JSON.stringify({ kind: "update", field: ["title"] })],
  ["array payload", "update", JSON.stringify([{ kind: "update", field: "title" }])],
  ["noncanonical event kind", "title-edited", JSON.stringify({ kind: "title-edited", field: "title" })],
  ["contradictory column kind", "commentAdd", JSON.stringify({ kind: "update", field: "title" })],
] as const) {
  test(`invalid title metadata (${label}) cannot earn recorded title evidence`, async () => {
    await task("catalogue", { lane: "doing" });
    await fixture.client.execute("UPDATE tasks SET due_at=NULL WHERE id='catalogue'");
    await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES ('invalid-title-edit',?,'catalogue','synthetic-owner',?,?,?)", args: [WORKSPACE, kind, payload, (NOW - 1_000) / 1000] });
    const before = await hashes(), result = await build();
    assert.equal(result.signals[0]?.hasRecordedTitleEdit, false);
    assert.equal(result.signals[0]?.latestValidatedTitleEdit, undefined);
    assert.equal(result.signals[0]?.idleDays, null);
    const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
    assert.doesNotMatch(ledger.coverageNote ?? "", /recorded title edit/i);
    assert.match(ledger.coverageNote ?? "", /history is incomplete/);
    assert.equal(ledger.entries.length, 0);
    assert.deepEqual(await hashes(), before);
  });
}

test("all listed completed prerequisites preserve readiness meaning through dated Home and public Briefing, then reopen removes it", async () => {
  await task("hidden-first", { completed: NOW - DAY, archived: NOW - DAY });
  await task("hidden-second", { completed: NOW - DAY, archived: NOW - DAY });
  await task("publish-guide", { lane: "todo", blocked: ["hidden-first", "hidden-second"] });
  await fixture.client.execute({ sql: "UPDATE tasks SET due_at=? WHERE id='publish-guide'", args: [(NOW + DAY) / 1000] });
  const before = await hashes(), result = await build(), view = await home();
  const row = view.signalRows.find(item => item.id === "publish-guide");
  assert.equal(row?.trigger, "due-soon");
  assert.doesNotMatch(row?.why ?? "", /prerequisites/);
  const readiness = view.signalRows.find(item => item.trigger === "prerequisites-complete")!;
  assert.match(readiness.why, /listed prerequisites are complete/i);
  assert.match(readiness.why, /move ahead|no longer held up/i);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.equal(ledger.entries[0]?.detail, row?.why);
  assert.equal(ledger.entries[1]?.detail, readiness.why);
  assert.doesNotMatch(JSON.stringify(ledger), /hidden-first|hidden-second/);
  assert.deepEqual(await hashes(), before);
  await fixture.client.execute("UPDATE tasks SET lane='doing' WHERE id='hidden-second'");
  const reopened = await home();
  assert.doesNotMatch(reopened.signalRows.find(item => item.id === "publish-guide")?.why ?? "", /prerequisites are complete|move ahead|no longer held up/);
});

test("missing and foreign prerequisites preserve Home deadline pressure and task-specific opaque Briefing context", async () => {
  await task("hidden-complete", { completed: NOW - DAY, archived: NOW - DAY });
  await fixture.client.execute("INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by) VALUES ('foreign-secret','synthetic-foreign-project',1,'Private foreign title','done','p2','[]','[]','[]')");
  for (const unknown of ["missing-secret", "foreign-secret"]) {
    await task("publish-guide", { lane: "todo", blocked: ["hidden-complete", unknown] });
    await fixture.client.execute({ sql: "UPDATE tasks SET due_at=? WHERE id='publish-guide'", args: [(NOW + DAY) / 1000] });
    const before = await hashes(), result = await build(), view = await home();
    const row = view.signalRows.find(item => item.id === "publish-guide");
    assert.equal(row?.trigger, "due-soon");
    assert.doesNotMatch(row?.why ?? "", /prerequisites/);
    assert.ok(view.signalRows.every(item => item.trigger !== "prerequisites-unverified"), "unknown state is context, not a confirmed risk");
    assert.equal(view.allClear, null);
    const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
    assert.equal(ledger.entries[0]?.detail, row?.why);
    assert.equal(ledger.entries.length, 1, "the genuine saved deadline remains selected");
    assert.match(ledger.entries[0]!.id, /^signal-/);
    const context = ledger.coverageNote ?? "";
    assert.match(context, /“publish-guide”[^]*prerequisites could not be fully verified/i);
    assert.match(context, /state is unknown[^]*not confirmed clear to move ahead/i);
    assert.match(context, /Activity history for this task is incomplete; earlier meaningful activity is not established/);
    const overview = buildOverviewModel({ ledger, timezone: result.authorizedScope.timezone,
      legacy: { briefing: result.briefing, signals: result.signals, authorizedScope: result.authorizedScope } });
    assert.equal(overview.coverage?.note, context, "the actual full-read receiving model retains the complete context");
    assert.equal(overview.attention.length, 1); assert.equal(overview.risks.length, 0);
    assert.equal(ledger.readCounts, null);
    assert.doesNotMatch(JSON.stringify(ledger), /missing-secret|foreign-secret|Private foreign title|hidden-complete|prerequisites are complete/);
    assert.deepEqual(await hashes(), before);
    await fixture.client.execute("DELETE FROM tasks WHERE id='publish-guide'");
  }
});

test("proven recent comment reaches actual Home and ledger without altering dependency lifecycle or stores", async () => {
  await task("upstream", { lane: "doing", updated: NOW - 10 * DAY });
  await task("commented-dependent", { lane: "doing", blocked: ["upstream"], updated: NOW - 10 * DAY });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL");
  assert.ok((await home()).signalRows.every(row => row.id !== "commented-dependent"), "updatedAt cannot establish inactivity");
  await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES ('proven-comment',?,'commented-dependent','synthetic-owner','commentAdd',?,?)", args: [WORKSPACE, JSON.stringify({ kind: "commentAdd", commentId: "transactional-comment" }), (NOW - DAY) / 1000] });
  const beforeHashes = await hashes(), result = await build(), view = await home();
  const signal = result.signals.find(row => row.id === "commented-dependent");
  assert.ok(signal); assert.equal(signal.idleDays, null); assert.deepEqual(signal.blockedBy, ["upstream"]);
  const observation = view.signalRows.find(row => row.id === "commented-dependent");
  assert.equal(observation?.trigger, "recorded-activity");
  assert.match(observation?.why ?? "", /comment added/i);
  assert.doesNotMatch(observation?.why ?? "", /meaningful progress|blocked for|waiting for/i);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.doesNotMatch(JSON.stringify(ledger), /transactional-comment|proven-comment/);
  assert.deepEqual(await hashes(), beforeHashes);
});

test("actual picker date survives source, briefing and Home in extreme reader zones", async () => {
  const selected = new Date(2026, 8, 28, 12);
  const day = toCalendarDate(selected), instant = dueInstantForDay(selected);
  assert.equal(day, "2026-09-28"); assert.ok(instant);
  await task("picked-date", { lane: "doing" });
  await fixture.client.execute({ sql: "UPDATE tasks SET due=?,due_at=? WHERE id='picked-date'", args: [day, instant.getTime() / 1000] });
  try {
    for (const [zone, expected] of [["Etc/GMT+12", 0], ["Pacific/Kiritimati", 1], ["Europe/Dublin", 0]] as const) {
      await signalStore.execute({ sql: "UPDATE analytics_users SET timezone=? WHERE clerk_id=?", args: [zone, ACTOR] });
      const result = await build(), view = await home();
      assert.deepEqual(result.signals[0].deadline, { kind: "date-only", date: day });
      assert.equal(view.stats.dueToday, expected, zone);
      assert.equal(view.myTasks[0]?.due, expected ? "Today" : "Tomorrow", zone);
      assert.equal(view.dateCoverageComplete, true);
    }
  } finally {
    await signalStore.execute({ sql: "UPDATE analytics_users SET timezone='UTC' WHERE clerk_id=?", args: [ACTOR] });
  }
});

test("actual saved-date reassurance is conservative for open unset, cleared and malformed dates", async () => {
  assert.equal((await home()).dateCoverageComplete, true, "empty open scope is complete");
  await task("undated", { lane: "doing" });
  await fixture.client.execute("UPDATE tasks SET due=NULL,due_at=NULL WHERE id='undated'");
  assert.equal((await home()).dateCoverageComplete, false, "never-set open date is not reassurance");
  await fixture.client.execute({ sql: "UPDATE tasks SET due='2026-09-28',due_at=? WHERE id='undated'", args: [(NOW + DAY) / 1000] });
  assert.equal((await home()).dateCoverageComplete, true);
  await fixture.client.execute("UPDATE tasks SET due=NULL,due_at=NULL WHERE id='undated'");
  assert.equal((await home()).dateCoverageComplete, false, "explicit clear has the same saved state");
  await fixture.client.execute("UPDATE tasks SET due='unreadable',due_at=NULL WHERE id='undated'");
  assert.equal((await home()).dateCoverageComplete, false, "malformed saved date stays unknown");
  await fixture.client.execute("UPDATE tasks SET lane='done' WHERE id='undated'");
  assert.equal((await home()).dateCoverageComplete, true, "terminal undated work does not limit open coverage");
});

test("canonical priorities order equal-lane undated Home tasks P0 through P3 with unknown last", async () => {
  for (const priority of ["p3", "p1", "p0", "p2", "unexpected"]) {
    await task(`priority-${priority}`, { lane: "doing" });
    await fixture.client.execute({ sql: "UPDATE tasks SET priority=?,due=NULL,due_at=NULL WHERE id=?", args: [priority, `priority-${priority}`] });
  }
  const result = await build(), view = await home();
  assert.deepEqual(Object.fromEntries(result.signals.map(signal => [signal.id, signal.priority])), {
    "priority-p3": 3, "priority-p1": 1, "priority-p0": 0, "priority-p2": 2, "priority-unexpected": null,
  });
  assert.deepEqual(view.myTasks.map(row => row.id), ["priority-p0", "priority-p1", "priority-p2", "priority-p3", "priority-unexpected"]);
  assert.equal(view.allClear, null, "unknown evidence cannot show healthy all-clear");
});

test("persisted tied deadline observations honor P0 through unknown in Home and ledger cap", async () => {
  for (const [id, priority] of [["a-unknown", "invalid"], ["b-p3", "p3"], ["c-p2", "p2"], ["d-p1", "p1"], ["z-p0", "p0"]] as const) {
    await task(id, { lane: "doing" });
    await fixture.client.execute({ sql: "UPDATE tasks SET priority=?,due_at=? WHERE id=?", args: [priority, (NOW + DAY) / 1000, id] });
  }
  const result = await build(), view = await home();
  assert.deepEqual(Object.fromEntries(result.signals.map(signal => [signal.id, signal.priority])), {
    "a-unknown": null, "b-p3": 3, "c-p2": 2, "d-p1": 1, "z-p0": 0,
  });
  assert.deepEqual(view.signalRows.map(row => row.id), ["z-p0", "d-p1", "c-p2"]);
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.deepEqual(ledger.entries.map(entry => entry.text), ["Z-p0", "D-p1", "C-p2"]);
  assert.equal(result.briefing.triggeredCount, 5);
});

for (const fault of ["missing", "foreign", "mixed"] as const) {
  test(`actual Home and ledger retain known work beside unknown ${fault} dependency`, async () => {
    await task("known-completed", { completed: NOW - DAY });
    if (fault === "foreign") await fixture.client.execute({ sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by,created_at,updated_at) VALUES ('unresolved','synthetic-foreign-project',1,'Foreign secret title','done','p2','[]','[]','[]',?,?)", args: [(NOW - DAY) / 1000, NOW / 1000] });
    await task("dependent", { lane: "doing", blocked: fault === "mixed" ? ["known-completed", "unresolved"] : ["unresolved"], updated: NOW - 10 * DAY });
    const beforeHashes = await hashes();
    const view = await home();
    const result = await build();
    const dependent = result.signals.find(row => row.id === "dependent");
    assert.ok(dependent);
    assert.equal(dependent.dependencyCoverage, "partial");
    assert.deepEqual(dependent.blockedBy, []);
    assert.equal(result.briefing.coverageStatus, "partial");
    assert.equal(view.allClear, null);
    assert.ok(view.signalRows.some(row => row.id === "dependent" && row.trigger === "due-soon"), "known urgent date remains visible");
    assert.ok(view.signalRows.every(row => row.id !== "dependent" || row.trigger !== "blocked-too-long"));
    const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
    assert.equal(ledger.readCounts, null);
    assert.ok(ledger.coverageNote);
    assert.deepEqual(await hashes(), beforeHashes);
  });
}
test("metadata edit never makes an old completion count this week", async () => {
  await task("old", { completed: NOW - 30 * DAY });
  assert.equal((await home()).stats.doneThisWeek, 0);
  assert.equal((await build()).signals[0].movedToShippedAt, NOW - 30 * DAY);
});
test("terminal without completion evidence stays unknown in orchestrator and Home", async () => {
  await task("unknown"); assert.equal((await build()).signals[0].movedToShippedAt, null);
  assert.equal((await home()).stats.doneThisWeek, 0);
});
test("future completion is never attributed as recent", async () => {
  await task("future", { completed: NOW + DAY });
  assert.equal((await home()).stats.doneThisWeek, 0);
  assert.equal((await build()).signals[0].movedToShippedAt, null);
});
test("reopened stale stamp stays open without shipped time", async () => {
  await task("reopened", { lane: "doing", completed: NOW - DAY });
  assert.equal((await build()).signals[0].movedToShippedAt, null);
  assert.deepEqual({ open: (await home()).stats.open, done: (await home()).stats.doneThisWeek }, { open: 1, done: 0 });
});
test("archived and child records reach neither Home counts nor source signals", async () => {
  await task("parent", { lane: "doing" }); await task("archived", { lane: "doing", archived: NOW - DAY }); await task("child", { lane: "doing", parent: "parent" });
  assert.equal((await home()).stats.open, 1); assert.deepEqual((await build()).signals.map(row => row.id), ["parent"]);
});
test("persisted real terminal event reaches orchestrator completion", async () => {
  await task("transition");
  await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES ('terminal-event',?,'transition','synthetic-owner','move',?,?)", args: [WORKSPACE, JSON.stringify({ from: "doing", to: "done" }), (NOW - 2 * DAY) / 1000] });
  assert.equal((await build()).signals[0].movedToShippedAt, NOW - 2 * DAY);
});
test("malformed config cannot produce a completed/default Home response", async () => {
  await config("{broken"); await task("bad-config"); await assert.rejects(home());
});
test("read-only orchestrator, Home and opaque ledger preserve all persisted state", async () => {
  await task("visible", { lane: "doing" });
  const beforeHashes = await hashes(), result = await build(); await home();
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", scopeLabel: result.authorizedScope.label, scopeKind: "workspace", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.ok(ledger.entries.length <= 3); assert.doesNotMatch(JSON.stringify(ledger), /synthetic-lifecycle-clerk|synthetic-owner|terminal-event/);
  assert.deepEqual(await hashes(), beforeHashes);
});
test("same-email foreign subject cannot inherit selected workspace", async () => {
  await task("private-task", { lane: "doing" });
  const result = await orchestrator.buildBriefingForUser({ clerkId: "synthetic-foreign-clerk", cadence: "daily", recordReadState: false, scope: { kind: "workspace", workspaceId: WORKSPACE } });
  assert.equal(result.kind, "no-workspace");
});

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));

test("context starts independent reads, drains all, and gives onboarding failure precedence", async () => {
  const onboarding = deferred<null>(), ages = deferred<Map<string, number>>();
  const primary = new Error("onboarding failure"), secondary = new Error("dismissal failure");
  const started: string[] = []; let settled = false;
  const result = orchestrator.readBriefingContext(
    () => { started.push("onboarding"); return onboarding.promise; },
    () => { started.push("dismissed"); throw secondary; },
    () => { started.push("ages"); return ages.promise; },
  );
  const observed = result.then(() => { settled = true; }, error => { settled = true; return error; });
  await nextTurn(); assert.deepEqual(started, ["onboarding", "dismissed", "ages"]); assert.equal(settled, false);
  onboarding.reject(primary); await nextTurn(); assert.equal(settled, false);
  ages.resolve(new Map()); assert.equal(await observed, primary);
});

test("context preserves the former dismissal/age Promise.all first rejection after draining", async () => {
  const dismissed = deferred<Set<string>>(), ages = deferred<Map<string, number>>();
  const first = new Error("ages first"), second = new Error("dismissed later"); let settled = false;
  const result = orchestrator.readBriefingContext(async () => null, () => dismissed.promise, () => ages.promise);
  const observed = result.then(() => { settled = true; }, error => { settled = true; return error; });
  ages.reject(first); await nextTurn(); assert.equal(settled, false);
  dismissed.reject(second); assert.equal(await observed, first);
});

test("authorized Home uses one Tasks source read; foreign scope starts neither context nor source", async () => {
  await task("concurrent-home", { lane: "doing" });
  const { dataSource } = await import("../../lib/data/source");
  const originalRead = dataSource.readMany, originalOnboarding = dataSource.getWorkspaceOnboarding;
  assert.ok(originalRead); assert.ok(originalOnboarding);
  let sourceReads = 0, onboardingReads = 0;
  dataSource.readMany = async function (ids) { sourceReads++; return originalRead.call(this, ids); };
  dataSource.getWorkspaceOnboarding = async function (id) { onboardingReads++; return originalOnboarding.call(this, id); };
  const beforeHashes = await hashes();
  try {
    const view = await home(); assert.equal(view.stats.open, 1);
    assert.deepEqual({ sourceReads, onboardingReads }, { sourceReads: 1, onboardingReads: 1 });
    const foreign = await orchestrator.buildBriefingForUser({ clerkId: "synthetic-foreign-clerk", cadence: "daily", recordReadState: false, scope: { kind: "workspace", workspaceId: WORKSPACE } });
    assert.equal(foreign.kind, "no-workspace");
    assert.deepEqual({ sourceReads, onboardingReads }, { sourceReads: 1, onboardingReads: 1 });
    assert.deepEqual(await hashes(), beforeHashes);
  } finally { dataSource.readMany = originalRead; dataSource.getWorkspaceOnboarding = originalOnboarding; }
});
for (const fault of ["missing", "duplicate", "foreign"] as const) {
  test(`orchestrator rejects ${fault} source workspace before persisted state writes`, async () => {
    await task("contract-task", { lane: "doing" });
    const { dataSource } = await import("../../lib/data/source");
    const original = dataSource.readMany; assert.ok(original);
    const beforeHashes = await hashes();
    dataSource.readMany = async function (ids) {
      const actual = await original.call(this, ids);
      if (fault === "missing") return [];
      if (fault === "duplicate") return [actual[0], actual[0]];
      return [{ ...actual[0], workspaceId: "synthetic-foreign-project" }];
    };
    try {
      await assert.rejects(orchestrator.buildBriefingForUser({ clerkId: ACTOR, cadence: "daily", recordReadState: true, scope: { kind: "workspace", workspaceId: WORKSPACE } }), /Signal source workspace coverage mismatch/);
      assert.deepEqual(await hashes(), beforeHashes);
    } finally { dataSource.readMany = original; }
  });
}

test("durable completion reaches dated full-read context and reopening removes recognition despite its saved timestamp", async () => {
  await task("finished-record", { completed: NOW - 20 * 3_600_000 });
  const before = await hashes();
  const result = await build();
  const view = await home();
  assert.equal(result.signals[0]!.stage?.complete, true);
  assert.equal(result.signals[0]!.movedToShippedAt, NOW - 20 * 3_600_000);
  assert.deepEqual(view.signalRows, [], "recognition does not occupy attention selection");
  assert.ok(!view.myTasks.some(row => row.id === "finished-record"));
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Test read", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.deepEqual(ledger.entries, []);
  assert.match(ledger.coverageNote ?? "", /1 task has a saved completion in the past 24 hours[^]*“finished-record”[^]*26 September 2026 at 16:00:00 \(UTC\)[^]*2026-09-26T16:00:00.000Z/);
  assert.match(ledger.coverageNote ?? "", /included in this read/);
  assert.equal(ledger.readCounts, null, "partial source history still withholds public totals");
  const overview = buildOverviewModel({ ledger, timezone: result.authorizedScope.timezone,
    legacy: { briefing: result.briefing, signals: result.signals, authorizedScope: result.authorizedScope } });
  assert.equal(overview.coverage?.note, ledger.coverageNote);
  assert.equal(overview.attention.length + overview.risks.length + overview.activity.length, 0);
  assert.deepEqual(await hashes(), before);
  await fixture.client.execute("UPDATE tasks SET lane='todo',due_at=NULL WHERE id='finished-record'");
  const reopenedBefore = await hashes(), reopened = await build(), reopenedHome = await home();
  assert.equal(reopened.signals[0]!.stage?.complete, false);
  assert.equal(reopened.signals[0]!.movedToShippedAt, null);
  assert.ok(reopenedHome.myTasks.some(row => row.id === "finished-record"));
  assert.ok(reopenedHome.signalRows.every(row => row.trigger !== "just-shipped"));
  const reopenedLedger = ledgerFromLegacyBriefing(reopened.briefing, { generatedAtLabel: "Test read", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.doesNotMatch(reopenedLedger.coverageNote ?? "", /saved completion in the past 24 hours|2026-09-26T16:00:00.000Z/);
  assert.match(reopenedLedger.coverageNote ?? "", /history is incomplete/i);
  assert.deepEqual(await hashes(), reopenedBefore);
});
test("round8 validated title and note occurrences survive partial source history", async () => {
  await task("saved-title", { lane: "todo" });
  await task("saved-note", { lane: "todo" });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL");
  for (const [id, kind, payload] of [
    ["saved-title", "update", { kind: "update", field: "title" }],
    ["saved-note", "commentAdd", { kind: "commentAdd", commentId: "opaque-comment" }],
  ] as const) {
    await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,'synthetic-owner',?,?,?)",
      args: [id+"-event", WORKSPACE, id, kind, JSON.stringify(payload), (NOW - 1_800_000) / 1000] });
  }
  const view = await home();
  assert.ok(view.signalRows.some(row => row.id === "saved-title" && /title/i.test(row.why)));
  assert.ok(view.signalRows.some(row => row.id === "saved-note" && /note|comment/i.test(row.why)));
});
test("round8 complete project open-work summary counts unknown stages without personal overload", async () => {
  await config(JSON.stringify({ custom: [{ key: "quality-gate", name: "Quality gate" }], doneKeys: ["done"] }));
  await task("ordinary-one", { lane: "todo" }); await task("ordinary-two", { lane: "doing" });
  await task("ordinary-custom", { lane: "doing", column: "quality-gate" });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL");
  const view = await home();
  assert.deepEqual(view.signalRows, [], "ordinary open work stays quiet");
  const result = await build();
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Test read", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.match(ledger.coverageNote ?? "", /3 tasks are currently open/);
  assert.ok(result.signals.every(signal => signal.taskCoverage === "complete"));
  assert.equal(result.briefing.coverageStatus, "partial", "bounded activity history remains honestly partial");
  assert.doesNotMatch(ledger.coverageNote ?? "", /your workload|overload/i);
  // This adapter-only variant verifies complete context composition, without
  // claiming that the persisted source above has complete activity history.
  const completeContext = ledgerFromLegacyBriefing({ ...result.briefing, coverageStatus: "complete",
    activityCoverageNote: "3 tasks are currently open in this project (Tasks · Test project).",
  }, { generatedAtLabel: "Test read", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.equal(completeContext.coverageNote, "3 tasks are currently open in this project (Tasks · Test project).");
  assert.doesNotMatch(completeContext.coverageNote ?? "", /could not be checked|incomplete/i);
});
