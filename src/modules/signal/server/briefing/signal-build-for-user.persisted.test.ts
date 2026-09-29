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
    INSERT INTO users(id,clerk_id,email,color,initials) VALUES ('synthetic-owner','${ACTOR}','owner@example.invalid','blue','SO'),('synthetic-foreign','synthetic-foreign-clerk','owner@example.invalid','blue','SF');
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
async function task(id: string, options: { lane?: string; column?: string; completed?: number; archived?: number; parent?: string; blocked?: string[]; updated?: number } = {}) {
  await fixture.client.execute({
    sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,board_column_key,priority,assignees,tags,blocked_by,due_at,created_at,updated_at,completed_at,archived_at,parent_task_id) VALUES (?,?,?,?,?,?,'p2','[]','[]',?,?,?,?,?,?,?)",
    args: [id, WORKSPACE, (await fixture.client.execute("SELECT COUNT(*) AS count FROM tasks")).rows[0].count as number + 1, id, options.lane ?? "done", options.column ?? null, JSON.stringify(options.blocked ?? []), (NOW - DAY) / 1000, (NOW - 40 * DAY) / 1000, (options.updated ?? NOW - 3_600_000) / 1000, options.completed == null ? null : options.completed / 1000, options.archived == null ? null : options.archived / 1000, options.parent ?? null],
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

test("proven recent comment reaches actual Home and ledger without altering dependency lifecycle or stores", async () => {
  await task("upstream", { lane: "doing", updated: NOW - 10 * DAY });
  await task("commented-dependent", { lane: "doing", blocked: ["upstream"], updated: NOW - 10 * DAY });
  await fixture.client.execute("UPDATE tasks SET due_at=NULL");
  assert.ok((await home()).signalRows.every(row => row.id !== "commented-dependent"), "updatedAt cannot establish inactivity");
  await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES ('proven-comment',?,'commented-dependent','synthetic-owner','commentAdd',?,?)", args: [WORKSPACE, JSON.stringify({ kind: "commentAdd", commentId: "transactional-comment" }), (NOW - DAY) / 1000] });
  const beforeHashes = await hashes(), result = await build(), view = await home();
  const signal = result.signals.find(row => row.id === "commented-dependent");
  assert.ok(signal); assert.equal(signal.idleDays, null); assert.deepEqual(signal.blockedBy, ["upstream"]);
  assert.ok(view.signalRows.every(row => row.id !== "commented-dependent"));
  const ledger = ledgerFromLegacyBriefing(result.briefing, { generatedAtLabel: "Sunday, 12:00", allowedAppOrigin: "https://app.signalstudio.ie" });
  assert.doesNotMatch(JSON.stringify(ledger), /commented-dependent|transactional-comment|proven-comment/);
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
