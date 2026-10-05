import assert from "node:assert/strict";
import { test } from "node:test";
import { freshMemoryDb } from "../db/memory-test-db";
import { meta, tasks, users, workspaceMembers, workspaces } from "../db/schema";
import { projectColumnsMetaKey } from "@/lib/projects/project-hub";
import { readConsoleFactsWith, validTimeZone } from "./project-console-facts";

/**
 * The Console's extra reads against the real schema, in a disposable
 * in-memory database: review mode never runs these selects, so this is where
 * they are proved. Nothing here touches a configured database.
 */

const NOW = Date.parse("2026-10-05T10:00:00Z");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

type TaskSeed = Partial<typeof tasks.$inferInsert> & { id: string; workspaceId: string };

async function seeded() {
  const local = await freshMemoryDb();
  const person = (id: string, name: string | null, email: string, initials = "FX") =>
    local.db.insert(users).values({ id, clerkId: id, handle: id, name, email, initials, color: "fixture" });
  await person("orla", "Orla Byrne", "orla@example.test", "OB");
  // Stored initials win over ones worked out from the name.
  await person("aoife", "Aoife Brennan", "aoife@example.test", "AO");
  await person("tom", null, "tom.reilly@example.test"); // no name: shown by handle
  await person("former", "Former Member", "former@example.test");

  for (const [id, owner] of [["p-a", "aoife"], ["p-b", "orla"], ["p-c", "aoife"], ["p-empty", "orla"]] as const) {
    await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: owner });
  }
  await local.db.insert(workspaceMembers).values([
    { workspaceId: "p-a", userId: "aoife", role: "owner" },
    { workspaceId: "p-a", userId: "orla", role: "member" },
    { workspaceId: "p-a", userId: "tom", role: "member" },
    { workspaceId: "p-b", userId: "orla", role: "owner" },
    { workspaceId: "p-c", userId: "aoife", role: "owner" },
    { workspaceId: "p-c", userId: "tom", role: "member" },
    { workspaceId: "p-empty", userId: "orla", role: "owner" },
  ]);
  // p-b calls its finished column "signed-off".
  await local.db.insert(meta).values({
    key: projectColumnsMetaKey("p-b"),
    value: JSON.stringify({
      custom: [{ key: "signed-off", name: "Signed off" }],
      doneKeys: ["done", "signed-off"],
    }),
  });

  const task = (seed: TaskSeed) =>
    local.db.insert(tasks).values({ title: seed.id, lane: "todo", priority: "p2", assignees: [], ...seed });

  // p-a: late work, one of it held by someone else; a big date; finished work.
  await task({ id: "a-late-mine", workspaceId: "p-a", title: "Chase the florist", dueAt: day("2026-09-28"), assignees: ["orla"] });
  await task({ id: "a-late-former", workspaceId: "p-a", title: "Book the band", dueAt: day("2026-09-29"), assignees: ["former"] });
  await task({ id: "a-late-tom", workspaceId: "p-a", title: "Order the marquee", dueAt: day("2026-10-01"), assignees: ["orla", "tom"] });
  await task({ id: "a-late-done", workspaceId: "p-a", title: "Send invitations", lane: "done", dueAt: day("2026-09-01"), completedAt: day("2026-10-03") });
  await task({ id: "a-late-archived", workspaceId: "p-a", title: "Old idea", dueAt: day("2026-08-01"), archivedAt: day("2026-08-02") });
  await task({ id: "a-late-sub", workspaceId: "p-a", title: "A subtask", dueAt: day("2026-08-01"), parentTaskId: "a-late-mine" });
  await task({ id: "a-big-done", workspaceId: "p-a", title: "Venue visit", lane: "done", isMilestone: true, dueAt: day("2026-09-20"), completedAt: day("2026-09-20") });
  await task({ id: "a-big-next", workspaceId: "p-a", title: "Menu tasting", isMilestone: true, dueAt: day("2026-10-09") });
  await task({ id: "a-big-later", workspaceId: "p-a", title: "Wedding day", isMilestone: true, dueAt: day("2026-10-17") });
  await task({ id: "a-big-undated", workspaceId: "p-a", title: "Someday", isMilestone: true });
  await task({ id: "a-done-today", workspaceId: "p-a", lane: "done", completedAt: new Date(NOW - 3_600_000) });
  await task({ id: "a-done-archived", workspaceId: "p-a", lane: "done", completedAt: day("2026-10-02"), archivedAt: day("2026-10-04") });
  await task({ id: "a-done-old", workspaceId: "p-a", lane: "done", completedAt: day("2026-08-01") });
  await task({ id: "a-reopened", workspaceId: "p-a", lane: "doing", completedAt: day("2026-10-04") });

  // p-b: its own done column; the only late task is the reader's own.
  await task({ id: "b-late-mine", workspaceId: "p-b", title: "Renew the licence", dueAt: day("2026-10-02"), assignees: ["orla"] });
  await task({ id: "b-signed-off", workspaceId: "p-b", title: "Signed off late", boardColumnKey: "signed-off", lane: "doing", dueAt: day("2026-09-01"), completedAt: day("2026-10-04") });
  await task({ id: "b-big-late", workspaceId: "p-b", title: "Inspection", isMilestone: true, dueAt: day("2026-10-02") });

  // p-c is real but not asked about: nothing of it may come back.
  await task({ id: "c-late", workspaceId: "p-c", title: "PRIVATE C TASK", dueAt: day("2026-09-01"), assignees: ["tom"] });
  return local;
}

test("each asked-about project gets its lead, next big date, oldest late task and finished days", async () => {
  const local = await seeded();
  const facts = await readConsoleFactsWith(local.db, { projectIds: ["p-a", "p-b", "p-empty"], viewerId: "orla", timeZone: "Europe/Dublin", now: NOW });

  assert.equal(facts.today, "2026-10-05");
  assert.deepEqual(Object.keys(facts.byProject).sort(), ["p-a", "p-b", "p-empty"]);

  const a = facts.byProject["p-a"]!;
  assert.deepEqual(a.lead, { name: "Aoife Brennan", initials: "AO" });
  // The earliest unfinished big date; finished and undated ones are skipped.
  assert.deepEqual(a.nextDate, { title: "Menu tasting", date: "2026-10-09" });
  // The oldest open, top-level, unarchived task past its date.
  assert.deepEqual(a.oldestLate, { id: "a-late-mine", title: "Chase the florist", dueDate: "2026-09-28" });
  // Nobody nudges themselves, and only a current member is named: the first
  // late task with someone else on it who still belongs to the project.
  assert.deepEqual(a.nudge, { taskId: "a-late-tom", title: "Order the marquee", who: "tom" });
  // Finished work counts on its own day, archived or not; a reopened task and
  // one outside the fortnight do not.
  assert.equal(a.doneByDay.length, 14);
  assert.equal(a.doneByDay[13], 1); // today
  assert.equal(a.doneByDay[11], 1); // 3 Oct
  assert.equal(a.doneByDay[10], 1); // 2 Oct, later archived
  assert.equal(a.doneByDay.reduce((sum, n) => sum + n, 0), 3);

  const b = facts.byProject["p-b"]!;
  assert.deepEqual(b.lead, { name: "Orla Byrne", initials: "OB" });
  // A big date that has passed and is still open stays the next one.
  assert.deepEqual(b.nextDate, { title: "Inspection", date: "2026-10-02" });
  // "Signed off" is done here, so it is neither late nor open.
  assert.equal(b.oldestLate?.id, "b-big-late");
  assert.equal(b.nudge, null);
  assert.equal(b.doneByDay[12], 1);

  assert.deepEqual(facts.byProject["p-empty"], {
    lead: { name: "Orla Byrne", initials: "OB" },
    nextDate: null,
    oldestLate: null,
    nudge: null,
    doneByDay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });

  // Nothing from a project that was not asked about.
  assert.doesNotMatch(JSON.stringify(facts), /PRIVATE C TASK|p-c|Former Member/);
  local.client.close();
});

test("days follow the reader's time zone", async () => {
  const local = await seeded();
  // 23:30 UTC on the 4th is already the 5th in Dublin.
  await local.db.insert(tasks).values({ id: "a-night", workspaceId: "p-a", title: "Night finish", lane: "done", priority: "p2", completedAt: new Date("2026-10-04T23:30:00Z") });
  const dublin = await readConsoleFactsWith(local.db, { projectIds: ["p-a"], viewerId: "orla", timeZone: Promise.resolve("Europe/Dublin"), now: NOW });
  const utc = await readConsoleFactsWith(local.db, { projectIds: ["p-a"], viewerId: "orla", timeZone: "UTC", now: NOW });
  // Today already holds one finish from the seed; the night one joins it in Dublin only.
  assert.equal(dublin.byProject["p-a"]!.doneByDay[13], 2);
  assert.equal(dublin.byProject["p-a"]!.doneByDay[12], 0);
  assert.equal(utc.byProject["p-a"]!.doneByDay[13], 1);
  assert.equal(utc.byProject["p-a"]!.doneByDay[12], 1);
  local.client.close();
});

test("no projects means no reads, and a bad time zone falls back", async () => {
  const local = await seeded();
  assert.deepEqual(await readConsoleFactsWith(local.db, { projectIds: [], viewerId: "orla", timeZone: "UTC", now: NOW }), { today: "2026-10-05", byProject: {} });
  assert.equal(validTimeZone("Not/AZone"), "UTC");
  assert.equal(validTimeZone(null), "UTC");
  assert.equal(validTimeZone("Europe/Dublin"), "Europe/Dublin");
  local.client.close();
});
