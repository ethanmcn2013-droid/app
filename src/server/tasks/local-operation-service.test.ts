import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { eq } from "drizzle-orm";
import { freshFileDb } from "@/server/db/memory-test-db";
import { activities, meta, tasks, users, planningPeriods, workspaces, workspaceMembers } from "@/server/db/schema";
import { emptyConfig } from "@/lib/board-config";
const require = createRequire(import.meta.url);
const stub = (id: string, exports: unknown) => { const path = require.resolve(id); require.cache[path] = { id: path, filename: path, loaded: true, exports } as NodeModule; };
stub("@/server/db", { db: {} });
stub("@/server/auth", { getCurrentUser: async () => { throw new Error("Synthetic transport forbidden"); } });
// The pure tombstone reader is real; only unused erasure dispatch is isolated.
stub("@/server/sponsored-use/erasure", { queueUsageErasure: async () => { throw new Error("Unused effect"); } });
const { applyLocalOperation, reconcileLocalOperation, readLocalTasks, localOperationKey, parseLocalOperation } = require("./local-operation-service") as typeof import("./local-operation-service");
const op = { operationId: "operation_one", kind: "create" as const, projectId: "project_a", taskId: "task_a", title: "Original title" };
async function fixture() {
  const f = await freshFileDb();
  for (const suffix of ["a", "b"]) {
    const actor = `user_${suffix}`;
    await f.db.insert(users).values({ id: actor, clerkId: actor, color: "indigo", initials: suffix });
    await f.db.insert(planningPeriods).values({ id: `period_${suffix}`, ownerUserId: actor, name: "Fixture period" });
    await f.db.insert(workspaces).values({ id: `project_${suffix}`, slug: `fixture-${suffix}`, name: "Fixture project", ownerUserId: actor, planningPeriodId: `period_${suffix}` });
    await f.db.insert(workspaceMembers).values({ workspaceId: `project_${suffix}`, userId: actor, role: "owner" });
  }
  return f;
}
async function counts(f: Awaited<ReturnType<typeof fixture>>) {
  return [await f.db.select().from(tasks), await f.db.select().from(activities), await f.db.select().from(meta)].map(rows => rows.length);
}
test("strict operation schema rejects caller identity and injective keys distinguish actors", () => {
  assert.throws(() => parseLocalOperation({ ...op, actor: "user_a" }), /invalid/);
  assert.notEqual(localOperationKey("a:b", "c"), localOperationKey("a", "b:c"));
});
test("immutable create replay survives title update and returns current mutable state separately", async () => {
  const f = await fixture(); try {
    const first = await applyLocalOperation(f.db, "user_a", op);
    const changed = await applyLocalOperation(f.db, "user_a", { ...op, operationId: "operation_two", kind: "title", title: "Changed title" });
    assert.equal(changed.title, "Changed title");
    assert.deepEqual(await applyLocalOperation(f.db, "user_a", op), first);
    const read = await reconcileLocalOperation(f.db, "user_a", op);
    assert.deepEqual(read.response, first); assert.equal(read.currentTask?.title, "Changed title");
    assert.deepEqual(await counts(f), [1, 2, 2]);
  } finally { f.cleanup(); }
});
test("Task, activity and receipt all roll back at each interrupted stage", async () => {
  for (const stage of ["afterTask", "afterActivity"] as const) {
    const f = await fixture(); try {
      await assert.rejects(applyLocalOperation(f.db, "user_a", op, { [stage]: async () => { throw new Error("interrupted"); } }), /interrupted/);
      assert.deepEqual(await counts(f), [0, 0, 0]);
      await applyLocalOperation(f.db, "user_a", op); assert.deepEqual(await counts(f), [1, 1, 1]);
    } finally { f.cleanup(); }
  }
});
test("receipt corruption prevents retry without effects", async () => {
  const f = await fixture(); try {
    await applyLocalOperation(f.db, "user_a", op);
    await f.db.update(meta).set({ value: "{broken" }).where(eq(meta.key, localOperationKey("user_a", op.operationId)));
    await assert.rejects(applyLocalOperation(f.db, "user_a", op), /corrupt/);
    assert.deepEqual(await counts(f), [1, 1, 1]);
  } finally { f.cleanup(); }
});
test("cross-kind, payload and Task reuse conflict without effects", async () => {
  const f = await fixture(); try {
    await applyLocalOperation(f.db, "user_a", op);
    for (const patch of [{ kind: "title" }, { title: "Different" }, { taskId: "other_task" }]) {
      await assert.rejects(applyLocalOperation(f.db, "user_a", { ...op, ...patch }), /conflict/);
    }
    assert.deepEqual(await counts(f), [1, 1, 1]);
  } finally { f.cleanup(); }
});
test("membership revocation and archive forbid historical replay before receipt lookup", async () => {
  const f = await fixture(); try {
    await applyLocalOperation(f.db, "user_a", op);
    await f.db.delete(workspaceMembers).where(eq(workspaceMembers.userId, "user_a"));
    await assert.rejects(applyLocalOperation(f.db, "user_a", op), /unavailable/);
    await assert.rejects(reconcileLocalOperation(f.db, "user_a", op), /unavailable/);
    await f.db.insert(workspaceMembers).values({ workspaceId: "project_a", userId: "user_a", role: "owner" });
    await f.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "project_a"));
    await assert.rejects(applyLocalOperation(f.db, "user_a", op), /unavailable/);
    assert.deepEqual(await counts(f), [1, 1, 1]);
  } finally { f.cleanup(); }
});
test("foreign reads/create/title refuse neutrally in both directions without effects", async () => {
  const f = await fixture(); try {
    for (const suffix of ["a", "b"]) await applyLocalOperation(f.db, `user_${suffix}`, { ...op, projectId: `project_${suffix}`, taskId: `task_${suffix}` });
    const before = await counts(f);
    for (const [actor, foreign] of [["a", "b"], ["b", "a"]]) {
      const input = { ...op, projectId: `project_${foreign}`, taskId: `task_${foreign}` };
      await assert.rejects(reconcileLocalOperation(f.db, `user_${actor}`, input), /unavailable/);
      await assert.rejects(applyLocalOperation(f.db, `user_${actor}`, input), /unavailable/);
      await assert.rejects(applyLocalOperation(f.db, `user_${actor}`, { ...input, kind: "title" }), /unavailable/);
      await assert.rejects(readLocalTasks(f.db, `user_${actor}`, `project_${foreign}`), /unavailable/);
      await assert.rejects(readLocalTasks(f.db, `user_${actor}`, `project_${foreign}`, `task_${foreign}`), /unavailable/);
    }
    assert.deepEqual(await counts(f), before);
  } finally { f.cleanup(); }
});
test("concurrent duplicate attempts serialize to one committed operation", async () => {
  const f = await fixture(); try {
    const results = await Promise.allSettled([applyLocalOperation(f.db, "user_a", op), applyLocalOperation(f.db, "user_a", op)]);
    assert(results.every(result => result.status === "fulfilled"));
    const response = await applyLocalOperation(f.db, "user_a", op);
    for (const result of results) if (result.status === "fulfilled") assert.deepEqual(result.value, response);
    assert.deepEqual(await counts(f), [1, 1, 1]);
  } finally { f.cleanup(); }
});
test("same actor operation cannot be reused in another authorized Project", async () => {
  const f = await fixture(); try {
    await f.db.insert(workspaceMembers).values({ workspaceId: "project_b", userId: "user_a", role: "member" });
    await applyLocalOperation(f.db, "user_a", op);
    await assert.rejects(applyLocalOperation(f.db, "user_a", { ...op, projectId: "project_b", taskId: "task_other" }), /conflict/);
    assert.deepEqual(await counts(f), [1, 1, 1]);
  } finally { f.cleanup(); }
});
test("title update rollback and deleted Task refuse replay", async () => {
  const f = await fixture(); try {
    await applyLocalOperation(f.db, "user_a", op);
    await assert.rejects(applyLocalOperation(f.db, "user_a", { ...op, kind: "title", operationId: "title_one", title: "Changed" }, { afterActivity: async () => { throw new Error("interrupted"); } }), /interrupted/);
    assert.equal((await readLocalTasks(f.db, "user_a", "project_a", "task_a")).tasks[0].title, op.title);
    assert.deepEqual(await counts(f), [1, 1, 1]);
    await f.db.delete(tasks).where(eq(tasks.id, "task_a"));
    await assert.rejects(applyLocalOperation(f.db, "user_a", op), /unavailable/);
  } finally { f.cleanup(); }
});
test("canonical create respects transaction-bound column completion truth and disabled sponsorship", async () => {
  const f = await fixture(); try {
    await f.db.insert(meta).values({ key: "board:project_a:columns", value: JSON.stringify({ ...emptyConfig(), doneKeys: ["todo"] }) });
    const result = await applyLocalOperation(f.db, "user_a", op);
    const [task] = await f.db.select().from(tasks).where(eq(tasks.id, op.taskId));
    assert.equal(task.completedAt?.toISOString(), result.committedAt);
    assert.equal((await f.client.execute("SELECT count(*) n FROM sponsored_use_intents")).rows[0].n, 0);
  } finally { f.cleanup(); }
});
test("expiry between writes rolls back and releases the per-client queue", async () => {
  const f = await fixture();
  const saved = { marker: process.env.SIGNAL_LOCAL_TASK_OPERATIONS, expiry: process.env.SIGNAL_LOCAL_TASK_EXPIRES_AT };
  try {
    process.env.SIGNAL_LOCAL_TASK_OPERATIONS = "true";
    process.env.SIGNAL_LOCAL_TASK_EXPIRES_AT = new Date(Date.now() + 60000).toISOString();
    await assert.rejects(applyLocalOperation(f.db, "user_a", op, { afterTask: async () => { process.env.SIGNAL_LOCAL_TASK_EXPIRES_AT = "2000-01-01T00:00:00.000Z"; } }), /expired/);
    assert.deepEqual(await counts(f), [0, 0, 0]);
    process.env.SIGNAL_LOCAL_TASK_EXPIRES_AT = new Date(Date.now() + 60000).toISOString();
    await applyLocalOperation(f.db, "user_a", op);
    assert.deepEqual(await counts(f), [1, 1, 1]);
  } finally {
    if (saved.marker === undefined) delete process.env.SIGNAL_LOCAL_TASK_OPERATIONS; else process.env.SIGNAL_LOCAL_TASK_OPERATIONS = saved.marker;
    if (saved.expiry === undefined) delete process.env.SIGNAL_LOCAL_TASK_EXPIRES_AT; else process.env.SIGNAL_LOCAL_TASK_EXPIRES_AT = saved.expiry;
    f.cleanup();
  }
});
