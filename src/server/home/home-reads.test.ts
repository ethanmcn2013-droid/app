import assert from "node:assert/strict";
import { test } from "node:test";
import { freshMemoryDb } from "../db/memory-test-db";
import { meta, tasks, users, workspaceMembers, workspaces } from "../db/schema";
import { projectColumnsMetaKey, projectStatusMetaKey, projectTargetDateMetaKey } from "@/lib/projects/project-hub";
import { buildRiver } from "@/lib/home/overview-river";
import { HOME_TASK_LIMIT, readHomeTasksWith } from "./home-board-read";
import { RIVER_TASK_LIMIT, readRiverFactsWith } from "./overview-river-read";

/**
 * Home's and the Overview's reads against the real schema, in a disposable
 * in-memory database: review mode never runs these selects, so this is where
 * they are proved. Nothing here touches a configured database.
 */

const NOW = Date.parse("2026-10-05T10:00:00Z");
const day = (iso: string) => new Date(`${iso}T09:00:00Z`);

type TaskSeed = Partial<typeof tasks.$inferInsert> & { id: string; workspaceId: string };

async function seeded() {
  const local = await freshMemoryDb();
  const person = (id: string, name: string | null, email: string) =>
    local.db.insert(users).values({ id, clerkId: id, handle: id, name, email, initials: "FX", color: "fixture" });
  await person("orla", "Orla Byrne", "orla@example.test");
  await person("aoife", "Aoife Brennan", "aoife@example.test");
  await person("former", "Former Member", "former@example.test");

  for (const [id, owner] of [["p-a", "orla"], ["p-b", "aoife"], ["p-c", "aoife"]] as const) {
    await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: owner });
  }
  await local.db.insert(workspaceMembers).values([
    { workspaceId: "p-a", userId: "orla", role: "owner" },
    { workspaceId: "p-a", userId: "aoife", role: "member" },
    { workspaceId: "p-b", userId: "aoife", role: "owner" },
    { workspaceId: "p-b", userId: "orla", role: "member" },
    { workspaceId: "p-c", userId: "aoife", role: "owner" },
  ]);
  await local.db.insert(meta).values([
    // p-b calls its finished column "signed-off".
    { key: projectColumnsMetaKey("p-b"), value: JSON.stringify({ custom: [{ key: "signed-off", name: "Signed off" }], doneKeys: ["done", "signed-off"] }) },
    { key: projectStatusMetaKey("p-a"), value: "at-risk" },
    { key: projectTargetDateMetaKey("p-a"), value: "2026-10-13" },
    { key: projectStatusMetaKey("p-c"), value: "paused" },
  ]);

  const task = (seed: TaskSeed) => local.db.insert(tasks).values({ title: seed.id, lane: "todo", priority: "p2", assignees: [], ...seed });
  await task({ id: "a-late", workspaceId: "p-a", title: "Chase the florist", dueAt: day("2026-10-01"), assignees: ["orla"], tags: ["venue-and-hire"] });
  await task({ id: "a-today", workspaceId: "p-a", title: "Print the menus", lane: "doing", dueAt: day("2026-10-05"), assignees: ["aoife", "former"], tags: ["food-and-drink", "print"] });
  await task({ id: "a-big", workspaceId: "p-a", title: "Menu tasting", isMilestone: true, dueAt: day("2026-10-09") });
  await task({ id: "a-undated", workspaceId: "p-a", title: "Book the band" });
  await task({ id: "a-waiting", workspaceId: "p-a", title: "Wait for the quote", lane: "doing", boardColumnKey: "waiting", assignees: ["orla"] });
  await task({ id: "a-repeats", workspaceId: "p-a", title: "Send the rota", dueAt: day("2026-10-07"), recurrence: { freq: "weekly", interval: 1 } as never });
  await task({ id: "a-done-today", workspaceId: "p-a", title: "Send invitations", lane: "done", dueAt: day("2026-10-05"), completedAt: new Date(NOW - 3_600_000), assignees: ["orla"] });
  await task({ id: "a-done-last-month", workspaceId: "p-a", title: "Venue visit", lane: "done", completedAt: day("2026-09-10") });
  await task({ id: "a-done-last-year", workspaceId: "p-a", title: "First call", lane: "done", completedAt: day("2025-10-01") });
  await task({ id: "a-archived", workspaceId: "p-a", title: "Old idea", dueAt: day("2026-10-02"), archivedAt: day("2026-10-03") });
  await task({ id: "a-sub", workspaceId: "p-a", title: "A subtask", dueAt: day("2026-10-02"), parentTaskId: "a-late" });
  await task({ id: "b-signed-off", workspaceId: "p-b", title: "Signed off", lane: "doing", boardColumnKey: "signed-off", dueAt: day("2026-10-02"), completedAt: day("2026-10-04") });
  await task({ id: "b-reopened", workspaceId: "p-b", title: "Reopened", lane: "doing", completedAt: day("2026-10-04"), assignees: ["orla"] });
  // p-c is real but not asked about: nothing of it may come back.
  await task({ id: "c-private", workspaceId: "p-c", title: "PRIVATE C TASK", dueAt: day("2026-10-01"), assignees: ["orla"] });
  return local;
}

test("Home reads only the Projects it was handed, top-level and unarchived, open or just finished", async () => {
  const local = await seeded();
  const read = await readHomeTasksWith(local.db, { projectIds: ["p-a", "p-b"], viewerId: "orla", now: NOW });

  assert.equal(read.viewerName, "Orla Byrne");
  assert.deepEqual(
    read.tasks.map((task) => task.id).sort(),
    ["a-big", "a-done-today", "a-late", "a-repeats", "a-today", "a-undated", "a-waiting", "b-reopened", "b-signed-off"],
  );
  assert.equal(JSON.stringify(read).includes("PRIVATE"), false);
  assert.equal(read.truncated, false);

  const by = (id: string) => read.tasks.find((task) => task.id === id)!;
  assert.equal(by("a-waiting").columnKey, "waiting", "a custom column claim is the task's column");
  assert.equal(by("a-repeats").recurring, true);
  assert.equal(by("a-late").dueAt, day("2026-10-01").getTime());
  assert.equal(by("a-done-today").completedAt, NOW - 3_600_000);
  // A finish moment on a task that is open again is stale and not reported.
  assert.equal(by("b-reopened").completedAt, null);
  // p-b's own finished column counts as done there.
  assert.equal(by("b-signed-off").completedAt, day("2026-10-04").getTime());
  assert.equal(read.columns.get("p-b")!.find((column) => column.key === "signed-off")!.isDone, true);
  assert.equal(read.columns.get("p-a")!.some((column) => column.key === "waiting"), true);

  // Members only, each under their own Project: a former member is not named.
  assert.deepEqual(read.members.get("p-a"), { orla: "Orla Byrne", aoife: "Aoife Brennan" });
  assert.equal(JSON.stringify([...read.members.values()]).includes("Former"), false);
});

test("Home asked about nothing reads nothing", async () => {
  const local = await seeded();
  const read = await readHomeTasksWith(local.db, { projectIds: [], viewerId: "orla", now: NOW });
  assert.deepEqual([read.tasks.length, read.members.size, read.columns.size, read.viewerName], [0, 0, 0, "Orla Byrne"]);
  assert.equal(HOME_TASK_LIMIT, 3000);
});

test("the Overview reads a Project's settings, members and tasks, and nothing of any other", async () => {
  const local = await seeded();
  const facts = await readRiverFactsWith(local.db, { projects: [{ id: "p-a", name: "Mara & Finn", role: "primary-owner" }], now: NOW });

  assert.equal(facts.projects.length, 1);
  assert.deepEqual([facts.projects[0]!.status, facts.projects[0]!.targetDate], ["at-risk", "2026-10-13"]);
  assert.deepEqual(facts.projects[0]!.members, { orla: "Orla Byrne", aoife: "Aoife Brennan" });
  // Finished work is kept for the last half year or so, not for ever.
  assert.deepEqual(
    facts.tasks.map((task) => task.id).sort(),
    ["a-big", "a-done-last-month", "a-done-today", "a-late", "a-repeats", "a-today", "a-undated", "a-waiting"],
  );
  assert.equal(JSON.stringify(facts).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(facts).includes("paused"), false);
  const by = (id: string) => facts.tasks.find((task) => task.id === id)!;
  assert.deepEqual(by("a-today").labels, ["food-and-drink", "print"]);
  assert.equal(by("a-big").bigDate, true);
  assert.equal(by("a-late").bigDate, false);
  assert.equal(facts.truncated, false);
  assert.equal(RIVER_TASK_LIMIT, 3000);

  // And the model built on it, in the reader's time zone.
  const river = buildRiver({ now: NOW, timeZone: "Europe/Dublin", viewerId: "orla", ...facts, canAct: true });
  assert.equal(river.lead, "8 days to the target date, Tue 13 Oct.");
  assert.deepEqual(river.lenses.map((lens) => lens.id), ["areas", "people", "status"]);
  assert.deepEqual(river.lenses[0]!.lanes.map((lane) => lane.name), ["Food and drink", "Venue and hire", "No area yet"]);
  const today = river.items.find((item) => item.id === "a-today")!;
  // The first current member holds it; the former member is never named.
  assert.deepEqual([today.day, today.owner?.name], [0, "Aoife Brennan"]);
});

test("the Overview asked about nothing reads nothing", async () => {
  const local = await seeded();
  assert.deepEqual(await readRiverFactsWith(local.db, { projects: [], now: NOW }), { projects: [], tasks: [], truncated: false });
});
