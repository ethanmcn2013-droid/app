import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { freshMemoryDb } from "../db/memory-test-db";
import { activities, meta, tasks, users, workspaceMembers, workspaces } from "../db/schema";
import { computeProjectAnalytics } from "@/lib/projects/project-analytics";
import { projectColumnsMetaKey } from "@/lib/projects/project-hub";
import { readDueChangesWith, readPortfolioInputWith } from "./project-analytics";

/**
 * Analytics across several projects, and the record of date changes, against
 * the real schema in a disposable in-memory database: review mode never runs
 * these selects, so this is where they are proved. Nothing here touches a
 * configured database.
 *
 * Run with: node --import tsx --import ./src/test/register-server-only.mjs --test src/server/projects/project-analytics-portfolio.test.ts
 */

const NOW = Date.parse("2026-10-05T10:00:00Z");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const CONTEXT = { now: NOW, range: "12w", timeZone: "Europe/Dublin" } as const;

type TaskSeed = Partial<typeof tasks.$inferInsert> & { id: string; workspaceId: string };

async function seeded() {
  const local = await freshMemoryDb();
  const person = (id: string, name: string) =>
    local.db.insert(users).values({ id, clerkId: id, handle: id, name, email: `${id}@example.test`, initials: "FX", color: "fixture" });
  await person("orla", "Orla Byrne");
  await person("aoife", "Aoife Brennan");
  await person("outsider", "PRIVATE OUTSIDER NAME");

  for (const id of ["p-a", "p-b", "p-c"]) await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: "orla" });
  await local.db.insert(workspaceMembers).values([
    { workspaceId: "p-a", userId: "orla", role: "owner" },
    { workspaceId: "p-a", userId: "aoife", role: "member" },
    { workspaceId: "p-b", userId: "orla", role: "owner" },
    { workspaceId: "p-c", userId: "outsider", role: "owner" },
  ]);
  // p-b calls its finished column "signed-off".
  await local.db.insert(meta).values({
    key: projectColumnsMetaKey("p-b"),
    value: JSON.stringify({ custom: [{ key: "signed-off", name: "Signed off" }], doneKeys: ["done", "signed-off"] }),
  });

  const task = (seed: TaskSeed) =>
    local.db.insert(tasks).values({ title: seed.id, lane: "todo", priority: "p2", assignees: [], createdAt: day("2026-09-20"), ...seed });
  await task({ id: "a-late", workspaceId: "p-a", title: "Chase the florist", dueAt: day("2026-09-28"), assignees: ["aoife"] });
  await task({ id: "a-next", workspaceId: "p-a", title: "Menu tasting", dueAt: day("2026-10-07"), assignees: ["orla"] });
  await task({ id: "a-done", workspaceId: "p-a", title: "Send invitations", lane: "done", completedAt: day("2026-10-03") });
  await task({ id: "a-sub", workspaceId: "p-a", title: "A subtask", parentTaskId: "a-late", dueAt: day("2026-09-01") });
  // Aoife is not a member of p-b: she is counted there but never named.
  await task({ id: "b-late", workspaceId: "p-b", title: "Renew the licence", dueAt: day("2026-10-02"), assignees: ["aoife"] });
  await task({ id: "b-signed", workspaceId: "p-b", title: "Signed off", boardColumnKey: "signed-off", lane: "doing", completedAt: day("2026-10-04") });
  // p-c is real but not asked about: nothing of it may come back.
  await task({ id: "c-late", workspaceId: "p-c", title: "PRIVATE C TASK", dueAt: day("2026-09-01"), assignees: ["outsider"] });

  const change = (id: string, workspaceId: string, taskId: string, field: string, iso: string) =>
    local.db.insert(activities).values({ id, workspaceId, taskId, userId: "orla", kind: "update", payload: { kind: "update", field } as never, createdAt: day(iso) });
  await change("x1", "p-a", "a-late", "due", "2026-09-22");
  await change("x2", "p-a", "a-late", "due", "2026-09-25");
  await change("x3", "p-a", "a-late", "title", "2026-09-26"); // not a date
  await change("x4", "p-a", "a-next", "due", "2026-05-01"); // before the period
  await change("x5", "p-b", "b-late", "due", "2026-09-30");
  await change("x6", "p-c", "c-late", "due", "2026-09-30"); // another project
  await change("x7", "p-c", "c-late", "due", "2026-10-01");
  return local;
}

const PROJECTS = [
  { id: "p-a", name: "Mara & Finn" },
  { id: "p-b", name: "Barn roof" },
];

test("several projects are read as one, each task filed under its own project", async () => {
  const local = await seeded();
  const input = await readPortfolioInputWith(local.db, PROJECTS, CONTEXT);
  assert.doesNotMatch(JSON.stringify(input), /PRIVATE|c-late/, "nothing of a project that was not asked about");
  assert.deepEqual(input.tasks.map((task) => task.id).sort(), ["a-done", "a-late", "a-next", "b-late", "b-signed"], "top-level tasks of the two projects only");
  assert.equal(input.tasks.find((task) => task.id === "a-late")!.project, "Mara & Finn");
  assert.equal(input.tasks.find((task) => task.id === "b-late")!.project, "Barn roof");
  // Each project's own finished column decides what is done.
  assert.equal(input.tasks.find((task) => task.id === "b-signed")!.done, true);
  // A person is named only on tasks of a project they belong to.
  assert.deepEqual(input.tasks.find((task) => task.id === "a-late")!.assigneeIds, ["aoife"]);
  assert.deepEqual(input.tasks.find((task) => task.id === "b-late")!.assigneeIds, ["former:aoife"]);

  const a = computeProjectAnalytics(input);
  assert.equal(a.open.count, 3);
  assert.equal(a.overdue.count, 2);
  assert.deepEqual(a.late.map((task) => [task.title, task.project, task.owners]), [
    ["Chase the florist", "Mara & Finn", ["Aoife Brennan"]],
    ["Renew the licence", "Barn roof", ["Former member"]],
  ]);
  assert.deepEqual(a.next.tasks.map((task) => [task.title, task.project]), [["Menu tasting", "Mara & Finn"]]);
  assert.equal(a.recent.finishedThisWeek, 2);
  // Date changes: the two projects' own, in the period, and only changes to a date.
  assert.deepEqual(a.moved && [a.moved.changes, a.moved.changedTasks, a.moved.repeatCount], [3, 2, 1]);
  assert.deepEqual(a.moved!.tasks.map((task) => [task.title, task.changes, task.project]), [["Chase the florist", 2, "Mara & Finn"]]);
});

test("no projects reads nothing, and date changes are scoped by project and period", async () => {
  const local = await seeded();
  const none = await readPortfolioInputWith(local.db, [], CONTEXT);
  assert.deepEqual(none.tasks, []);
  assert.deepEqual(none.dueChanges, []);
  assert.deepEqual((await readDueChangesWith(local.db, ["p-a"], day("2026-07-01")))!.sort(), ["a-late", "a-late"]);
  assert.deepEqual(await readDueChangesWith(local.db, ["p-a"], day("2026-01-01")).then((ids) => ids!.length), 3);
  assert.deepEqual(await readDueChangesWith(local.db, [], day("2026-01-01")), []);
});

test("the wider reads take their projects from the catalog and never write", () => {
  const source = readFileSync(fileURLToPath(new URL("./project-analytics.ts", import.meta.url)), "utf8");
  assert.match(source, /import "server-only";/);
  assert.doesNotMatch(source, /^["']use server["']/m, "not a Server Function");
  assert.doesNotMatch(source, /\.(insert|update|delete)\(/, "nothing here writes");
  assert.match(source, /export async function loadPortfolioAnalytics\(\s*range: AnalyticsRangeKey,\s*\)/, "the loader accepts no ids");
  assert.match(source, /export async function loadAnalyticsProjects\(\)/);
  assert.equal((source.match(/await loadProjectCatalogAction\(\)/g) ?? []).length, 2, "both lists are the membership catalog");
  assert.match(source, /inArray\(tasks\.workspaceId, ids\)/);
  assert.match(source, /inArray\(workspaceMembers\.workspaceId, ids\)/);
  assert.match(source, /inArray\(activities\.workspaceId, \[\.\.\.projectIds\]\)/);
});
