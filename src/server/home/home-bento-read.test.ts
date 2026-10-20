import assert from "node:assert/strict";
import { test } from "node:test";
import { freshMemoryDb } from "../db/memory-test-db";
import { attachments, meta, resources, tasks, users, workspaces } from "../db/schema";
import { projectColumnsMetaKey } from "@/lib/projects/project-hub";
import { readFilesAddedWith, readHomeFactsWith } from "./home-bento-read";

/**
 * Home's reads against the real schema, in a disposable in-memory database:
 * review mode never runs these selects, so this is where they are proved.
 * Nothing here touches a configured database.
 */

const SINCE = Date.parse("2026-01-01T00:00:00Z");
const WEEK_START = Date.parse("2026-10-19T00:00:00Z");
const WEEK_END = Date.parse("2026-10-26T00:00:00Z");
const at = (iso: string) => new Date(`${iso}T09:00:00Z`);

type TaskSeed = Partial<typeof tasks.$inferInsert> & { id: string; workspaceId: string };

async function seeded() {
  const local = await freshMemoryDb();
  await local.db.insert(users).values({ id: "orla", clerkId: "orla", handle: "orla", name: "Orla Byrne", email: "orla@example.test", initials: "OB", color: "fixture" });
  for (const id of ["p-a", "p-b", "p-c"]) await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: "orla" });
  // p-b calls its finished column "signed-off".
  await local.db.insert(meta).values({ key: projectColumnsMetaKey("p-b"), value: JSON.stringify({ custom: [{ key: "signed-off", name: "Signed off" }], doneKeys: ["done", "signed-off"] }) });

  const task = (seed: TaskSeed) => local.db.insert(tasks).values({ title: seed.id, lane: "todo", priority: "p2", assignees: [], ...seed });
  await task({ id: "a-done", workspaceId: "p-a", lane: "done", completedAt: at("2026-10-20") });
  await task({ id: "a-done-march", workspaceId: "p-a", lane: "done", completedAt: at("2026-03-02") });
  await task({ id: "a-done-last-year", workspaceId: "p-a", lane: "done", completedAt: at("2025-11-02") });
  // Reopened: a finish moment on an open task is stale.
  await task({ id: "a-reopened", workspaceId: "p-a", lane: "doing", completedAt: at("2026-10-14") });
  await task({ id: "a-sub-done", workspaceId: "p-a", lane: "done", completedAt: at("2026-10-20"), parentTaskId: "a-done" });
  await task({ id: "a-due", workspaceId: "p-a", dueAt: at("2026-10-22") });
  await task({ id: "a-due-done", workspaceId: "p-a", lane: "done", dueAt: at("2026-10-21"), completedAt: at("2026-10-19") });
  await task({ id: "a-due-next-week", workspaceId: "p-a", dueAt: at("2026-10-27") });
  await task({ id: "a-due-archived", workspaceId: "p-a", dueAt: at("2026-10-22"), archivedAt: at("2026-10-19") });
  await task({ id: "b-signed-off", workspaceId: "p-b", lane: "doing", boardColumnKey: "signed-off", completedAt: at("2026-10-15") });
  await task({ id: "b-due", workspaceId: "p-b", dueAt: at("2026-10-25") });
  // p-c is real but not asked about: nothing of it may come back.
  await task({ id: "c-done", workspaceId: "p-c", lane: "done", completedAt: at("2026-10-20"), dueAt: at("2026-10-22") });
  return local;
}

test("finished work and this week's due tasks come only from the Projects asked about", async () => {
  const local = await seeded();
  const facts = await readHomeFactsWith(local.db, { projectIds: ["p-a", "p-b"], since: SINCE, weekStart: WEEK_START, weekEnd: WEEK_END });

  assert.deepEqual(
    [...facts.completions.get("p-a")!].sort(),
    [at("2026-03-02"), at("2026-10-19"), at("2026-10-20")].map((d) => d.getTime()),
    "top-level finishes since the start date, in a done column",
  );
  assert.deepEqual(facts.completions.get("p-b"), [at("2026-10-15").getTime()], "a custom done column counts");
  assert.equal(facts.completions.has("p-c"), false);
  assert.deepEqual(Object.fromEntries(facts.dueThisWeek), { "p-a": 1, "p-b": 1 }, "open, live, top-level, due inside the week");
  assert.equal(facts.truncated, false);
});

test("no Projects reads nothing", async () => {
  const local = await seeded();
  const facts = await readHomeFactsWith(local.db, { projectIds: [], since: SINCE, weekStart: WEEK_START, weekEnd: WEEK_END });
  assert.equal(facts.completions.size + facts.dueThisWeek.size, 0);
  assert.equal(await readFilesAddedWith(local.db, { projectIds: [], since: SINCE }), 0);
});

test("files added count each file once, on live tasks in the Projects asked about", async () => {
  const local = await seeded();
  const recent = Math.floor(Date.parse("2026-10-10T09:00:00Z") / 1000);
  const old = Math.floor(Date.parse("2025-06-01T09:00:00Z") / 1000);
  await local.db.insert(attachments).values([
    { id: "att-1", workspaceId: "p-a", taskId: "a-due", uploaderUserId: "orla", filename: "brief.pdf", storedPath: "x", mimeType: "application/pdf", sizeBytes: 1, createdAt: at("2026-10-10") },
    { id: "att-2", workspaceId: "p-a", taskId: "a-due", uploaderUserId: "orla", filename: "plan.pdf", storedPath: "x", mimeType: "application/pdf", sizeBytes: 1, createdAt: at("2026-10-11") },
    { id: "att-archived", workspaceId: "p-a", taskId: "a-due-archived", uploaderUserId: "orla", filename: "gone.pdf", storedPath: "x", mimeType: "application/pdf", sizeBytes: 1, createdAt: at("2026-10-11") },
    { id: "att-other", workspaceId: "p-c", taskId: "c-done", uploaderUserId: "orla", filename: "private.pdf", storedPath: "x", mimeType: "application/pdf", sizeBytes: 1, createdAt: at("2026-10-11") },
  ]);
  const resource = (id: string, workspaceId: string, taskId: string, addedAt: number) =>
    ({ id, workspaceId, taskId, kind: "upload" as const, provider: "file", title: id, addedAt });
  await local.db.insert(resources).values([
    // The mirror of att-1: the same file.
    resource("res-att-1", "p-a", "a-due", recent),
    resource("res-link", "p-b", "b-due", recent),
    resource("res-old", "p-a", "a-due", old),
    resource("res-other", "p-c", "c-done", recent),
  ]);

  assert.equal(await readFilesAddedWith(local.db, { projectIds: ["p-a", "p-b"], since: SINCE }), 3);
});
