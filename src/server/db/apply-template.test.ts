import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, asc, eq, like } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { freshFileDb } from "./memory-test-db";
import * as schema from "./schema";
import { activities, meta, tasks, users, workspaceMembers, workspaces } from "./schema";
import { getTemplate } from "../../lib/templates";

let apply: typeof import("./apply-template");
let beginDeletion: typeof import("../account-deletion-lifecycle").beginAccountDeletionWith;
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  apply = await import("./apply-template");
  beginDeletion = (await import("../account-deletion-lifecycle")).beginAccountDeletionWith;
});

const templateId = "wedding-planning-workspace";
const requestId = "template-request-0001";
async function fixture() {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA journal_mode = WAL");
  for (const id of ["owner", "member", "stranger"]) {
    await f.db.insert(users).values({ id, clerkId: id, name: id, initials: "FX", color: "fixture" });
  }
  for (const id of ["project-a", "project-b"]) {
    await f.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: id === "project-a" ? "owner" : "stranger", primaryDate: "2027-06-19" });
    await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: id === "project-a" ? "owner" : "stranger", role: "owner" });
  }
  await f.db.insert(workspaceMembers).values({ workspaceId: "project-a", userId: "member", role: "member" });
  const dependencies = { database: f.db, actorUserId: "owner" };
  return {
    ...f, dependencies,
    apply: (options = { requestId }) => apply.applyTemplateToWorkspace(templateId, "project-a", options, dependencies),
    rows: () => f.db.select().from(tasks).where(eq(tasks.workspaceId, "project-a")).orderBy(asc(tasks.seq)),
    receipts: () => f.db.select().from(meta).where(like(meta.key, "board:project-a:template-application:%")),
  };
}

test("wedding application appends 18 tasks, 6 anchored milestones, unique seq and one activity per seed", async () => {
  const f = await fixture();
  try {
    await f.db.insert(tasks).values({ id: "user-task", workspaceId: "project-a", seq: 12, title: "Keep my task", lane: "todo", priority: "p1", assignees: ["owner"], position: 40 });
    await f.apply();
    const [original, ...seeded] = await f.rows();
    assert.equal(original.id, "user-task");
    assert.equal(original.position, 40);
    assert.equal(seeded.length, 18);
    assert.equal(seeded.filter(task => task.isMilestone).length, 6);
    assert.equal(seeded.filter(task => task.lane === "done").length, 2);
    assert.deepEqual(seeded.map(task => task.seq), Array.from({ length: 18 }, (_, i) => 13 + i));
    const expectedOffsets = [-270, -42, -21, -14, -7, 14];
    assert.deepEqual(seeded.filter(task => task.isMilestone).map(task => (task.dueAt!.getTime() - Date.parse("2027-06-19T00:00:00Z")) / 86400000).sort((a, b) => a - b), expectedOffsets);
    assert.equal(seeded.filter(task => task.dueAt === null).length, 12);
    assert.deepEqual(seeded.map(task => task.title), getTemplate(templateId).tasks.map(task => task.title));
    assert.ok(seeded.filter(task => task.lane === "todo").every(task => task.position !== null && task.position > 40));
    const events = await f.db.select().from(activities);
    assert.equal(events.length, 18);
    assert.ok(events.every(event => event.userId === "owner" && event.workspaceId === "project-a" && seeded.some(task => task.id === event.taskId)));
    assert.equal((await f.receipts()).length, 1);
  } finally { f.cleanup(); }
});

for (const stage of ["task", "activity", "receipt"] as const) {
  test(`a late ${stage} failure rolls back the whole application and retry preserves existing data`, async () => {
    const f = await fixture();
    try {
      await f.db.insert(tasks).values({ id: "user-task", workspaceId: "project-a", seq: 1, title: "Keep my task", lane: "todo", priority: "p1", assignees: [], position: 1 });
      const trigger = stage === "task"
        ? "CREATE TRIGGER fail_template BEFORE INSERT ON tasks WHEN NEW.seq = 4 BEGIN SELECT RAISE(ABORT, 'fixture task failure'); END"
        : stage === "activity"
          ? "CREATE TRIGGER fail_template BEFORE INSERT ON activities WHEN (SELECT COUNT(*) FROM activities) = 2 BEGIN SELECT RAISE(ABORT, 'fixture activity failure'); END"
          : "CREATE TRIGGER fail_template BEFORE INSERT ON meta WHEN NEW.key LIKE 'board:%:template-application:%' BEGIN SELECT RAISE(ABORT, 'fixture receipt failure'); END";
      await f.client.execute(trigger);
      await assert.rejects(f.apply());
      assert.deepEqual((await f.rows()).map(task => task.id), ["user-task"]);
      assert.equal((await f.db.select().from(activities)).length, 0);
      assert.equal((await f.receipts()).length, 0);
      await f.client.execute("DROP TRIGGER fail_template");
      await f.apply();
      assert.equal((await f.rows()).length, 19);
      assert.equal((await f.db.select().from(activities)).length, 18);
      await f.apply();
      assert.equal((await f.rows()).length, 19);
    } finally { f.cleanup(); }
  });
}

test("lost acknowledgement and replay do not overwrite edited, archived or deleted seeded tasks", async () => {
  const f = await fixture();
  try {
    const seedIds = new Set<string>();
    const commitThenLoseResponse = async () => { await f.apply(); throw new Error("response lost after commit"); };
    await assert.rejects(commitThenLoseResponse(), /response lost/);
    const rows = await f.rows();
    rows.forEach(task => seedIds.add(task.id));
    await f.db.update(tasks).set({ title: "My revised wording", archivedAt: new Date("2027-01-01Z") }).where(eq(tasks.id, rows[0].id));
    await f.db.delete(tasks).where(eq(tasks.id, rows[1].id));
    // The workspace anchor can change after the completed application too.
    await f.db.update(workspaces).set({ primaryDate: "2028-01-01" }).where(eq(workspaces.id, "project-a"));
    await f.apply();
    const replay = await f.rows();
    assert.equal(replay.length, 17);
    assert.equal(replay[0].title, "My revised wording");
    assert.ok(replay[0].archivedAt);
    assert.ok(replay.every(task => seedIds.has(task.id)));
    assert.equal(replay[2].dueAt?.getTime(), rows[3].dueAt?.getTime());
  } finally { f.cleanup(); }
});

test("same request conflicts on changed template/explicit anchor; new request remains additive", async () => {
  const f = await fixture();
  try {
    await f.apply();
    await assert.rejects(apply.applyTemplateToWorkspace("job-application-push", "project-a", { requestId }, f.dependencies), /different inputs/);
    await assert.rejects(apply.applyTemplateToWorkspace(templateId, "project-a", { requestId, anchorDate: null }, f.dependencies), /different inputs/);
    await f.apply({ requestId: "template-request-0002" });
    const rows = await f.rows();
    assert.equal(rows.length, 36);
    assert.equal(new Set(rows.map(task => task.id)).size, 36);
    assert.equal(new Set(rows.map(task => task.seq)).size, 36);
    assert.equal((await f.receipts()).length, 2);
  } finally { f.cleanup(); }
});

test("explicit null has no dates; an explicit anchor overrides the Project date", async () => {
  const f = await fixture();
  try {
    await apply.applyTemplateToWorkspace(templateId, "project-a", { requestId, anchorDate: null }, f.dependencies);
    assert.ok((await f.rows()).every(task => task.dueAt === null));
    await apply.applyTemplateToWorkspace(templateId, "project-a", { requestId: "template-request-0002", anchorDate: "2028-02-29" }, f.dependencies);
    const dated = (await f.rows()).slice(18).filter(task => task.dueAt);
    assert.equal(dated.length, 6);
    assert.deepEqual(dated.map(task => (task.dueAt!.getTime() - Date.parse("2028-02-29T00:00:00Z")) / 86400000).sort((a,b) => a-b), [-270, -42, -21, -14, -7, 14]);
  } finally { f.cleanup(); }
});

test("concurrent same request on independent connections commits exactly one application", async () => {
  const f = await fixture();
  const path = (await f.client.execute("PRAGMA database_list")).rows[0].file;
  const second = createClient({ url: pathToFileURL(String(path)).href });
  try {
    const other = drizzle(second, { schema });
    await Promise.all([
      f.apply(), f.apply(),
      apply.applyTemplateToWorkspace(templateId, "project-a", { requestId }, { database: other, actorUserId: "owner" }),
      apply.applyTemplateToWorkspace(templateId, "project-a", { requestId }, { database: other, actorUserId: "owner" }),
    ]);
    assert.equal((await f.rows()).length, 18);
    assert.equal((await f.db.select().from(activities)).length, 18);
    assert.equal((await f.receipts()).length, 1);
  } finally { second.close(); f.cleanup(); }
});

test("concurrent distinct intents remain additive without duplicate lane positions or seq", async () => {
  const f = await fixture();
  try {
    await Promise.all([f.apply(), f.apply({ requestId: "template-request-0002" })]);
    const rows = await f.rows();
    assert.equal(rows.length, 36);
    assert.equal(new Set(rows.map(task => task.seq)).size, 36);
    for (const lane of new Set(rows.map(task => task.lane))) {
      const positions = rows.filter(task => task.lane === lane).map(task => task.position);
      assert.equal(new Set(positions).size, positions.length);
    }
  } finally { f.cleanup(); }
});

test("foreign/missing Project and revoked membership are refused, including after a completed receipt", async () => {
  const f = await fixture();
  try {
    for (const projectId of ["project-b", "missing-project"]) {
      await assert.rejects(apply.applyTemplateToWorkspace(templateId, projectId, { requestId }, f.dependencies), /project isn’t available/);
    }
    await assert.rejects(apply.applyTemplateToWorkspace(templateId, "project-a", { requestId }, { ...f.dependencies, actorUserId: "stranger" }), /project isn’t available/);
    assert.equal((await f.db.select().from(tasks)).length, 0);
    assert.equal((await f.receipts()).length, 0);
    await apply.applyTemplateToWorkspace(templateId, "project-a", { requestId }, { ...f.dependencies, actorUserId: "member" });
    await f.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "member")));
    await assert.rejects(apply.applyTemplateToWorkspace(templateId, "project-a", { requestId }, { ...f.dependencies, actorUserId: "member" }), /project isn’t available/);
    assert.equal((await f.rows()).length, 18);
  } finally { f.cleanup(); }
});

test("archive and durable account-erasure fence block writes and receipt replay", async () => {
  const f = await fixture();
  try {
    await f.apply();
    await f.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "project-a"));
    await assert.rejects(f.apply(), /project isn’t available/);
    await f.db.update(workspaces).set({ archivedAt: null }).where(eq(workspaces.id, "project-a"));
    await beginDeletion(f.db, "owner");
    await assert.rejects(f.apply(), /project isn’t available/);
    await assert.rejects(apply.remixTemplateIntoWorkspace(templateId, requestId, f.dependencies), /project isn’t available/);
    assert.equal((await f.rows()).length, 18);
    assert.equal((await f.db.select().from(workspaces)).length, 2);
  } finally { f.cleanup(); }
});

test("invalid requests/templates write nothing; unidentified legacy calls stay additive", async () => {
  const f = await fixture();
  try {
    for (const invalid of ["", "too-short", "a".repeat(129), "contains spaces in request"]) {
      await assert.rejects(f.apply({ requestId: invalid }), /request id/);
    }
    await assert.rejects(apply.applyTemplateToWorkspace("missing", "project-a", { requestId }, f.dependencies), /Unknown template/);
    assert.equal((await f.rows()).length, 0);
    await apply.applyTemplateToWorkspace(templateId, "project-a", undefined, f.dependencies);
    await apply.applyTemplateToWorkspace(templateId, "project-a", undefined, f.dependencies);
    assert.equal((await f.rows()).length, 36);
  } finally { f.cleanup(); }
});

test("remix task failure rolls back project and owner membership; retry/concurrency returns one owned seeded Project", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER fail_template BEFORE INSERT ON tasks WHEN NEW.seq = 4 BEGIN SELECT RAISE(ABORT, 'fixture task failure'); END");
    await assert.rejects(apply.remixTemplateIntoWorkspace(templateId, requestId, f.dependencies));
    assert.equal((await f.db.select().from(workspaces)).length, 2);
    assert.equal((await f.db.select().from(workspaceMembers)).length, 3);
    assert.equal((await f.db.select().from(tasks)).length, 0);
    await f.client.execute("DROP TRIGGER fail_template");
    const [first, second] = await Promise.all([
      apply.remixTemplateIntoWorkspace(templateId, requestId, f.dependencies),
      apply.remixTemplateIntoWorkspace(templateId, requestId, f.dependencies),
    ]);
    assert.deepEqual(first, second);
    assert.equal((await f.db.select().from(workspaces)).length, 3);
    const seeds = await f.db.select().from(tasks).where(eq(tasks.workspaceId, first.workspaceId));
    assert.equal(seeds.length, 18);
    assert.ok(seeds.every(task => task.dueAt === null));
    assert.equal((await f.db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, first.workspaceId)))[0].userId, "owner");
    await assert.rejects(apply.remixTemplateIntoWorkspace("job-application-push", requestId, f.dependencies), /different inputs/);
    const next = await apply.remixTemplateIntoWorkspace(templateId, "template-request-0002", f.dependencies);
    assert.notEqual(first.workspaceId, next.workspaceId);
    assert.equal((await f.db.select().from(tasks)).length, 36);
  } finally { f.cleanup(); }
});


test("durable Project deletion intent blocks an application inside its writer transaction", async () => {
  const f = await fixture();
  try {
    await f.client.execute(`INSERT INTO project_drive_operations (id, workspace_id, operation_kind, status, dedupe_key)
      VALUES ('deleting-project-a', 'project-a', 'project_delete', 'pending', '${"a".repeat(64)}')`);
    await assert.rejects(f.apply(), /being deleted/);
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.receipts()).length, 0);
  } finally { f.cleanup(); }
});


/** Execute the actual Server Action module with only request/runtime boundaries
 * substituted. The template writers, permission queries and transactions below
 * still run against the real disposable database. */
async function actionHarness(f: Awaited<ReturnType<typeof fixture>>) {
  const authz = await import("../actions/project-authz");
  const state = { actor: "owner", demo: false, failInvalidation: false, failCookie: false, effects: [] as string[] };
  const boundaries: Record<string, unknown> = {
    "next/cache": { revalidatePath: () => {
      state.effects.push("invalidate");
      if (state.failInvalidation) { state.failInvalidation = false; throw new Error("fixture invalidation failure"); }
    } },
    "next/headers": { cookies: async () => ({ set: () => {
      state.effects.push("cookie");
      if (state.failCookie) { state.failCookie = false; throw new Error("fixture cookie failure"); }
    } }) },
    "@/server/auth": { ACTIVE_WORKSPACE_COOKIE_NAME: "fixture-cookie", getCurrentUser: async () => {
      state.effects.push("identity"); return state.actor;
    }, getActiveWorkspaceOrNull: async () => { throw new Error("Ambient Project must not be used"); } },
    "@/server/actions/project-authz": { authorizeProjectCandidate: async (input: { candidateProjectId: string; actorUserId: string }) =>
      authz.authorizeStoredProject({ storedProjectId: input.candidateProjectId, actorUserId: input.actorUserId,
        capability: "createOrEditTasks", archivePolicy: "enforce", executor: f.db }) },
    "@/server/db/apply-template": {
      requireTemplateRequestId: apply.requireTemplateRequestId,
      applyTemplateToWorkspace: (id: string, projectId: string, options: Parameters<typeof apply.applyTemplateToWorkspace>[2], dependencies: { actorUserId: string }) =>
        apply.applyTemplateToWorkspace(id, projectId, options, { ...dependencies, database: f.db }),
      remixTemplateIntoWorkspace: (id: string, requestId: string, dependencies: { actorUserId: string }) =>
        apply.remixTemplateIntoWorkspace(id, requestId, { ...dependencies, database: f.db }),
    },
    "@/server/db/queries": { getTasks: async (projectId: string) => f.db.select().from(tasks).where(eq(tasks.workspaceId, projectId)) },
    "@/server/events": { emitTasksChanged: () => { state.effects.push("emit"); } },
    "@/lib/access-mode": { isDemoMode: () => state.demo },
    "@/server/demo/tasks-demo": { DEMO_WORKSPACE_ID: "demo", DEMO_WORKSPACE_SLUG: "demo", demoTasks: () => [] },
  };
  const source = readFileSync(new URL("../actions/templates.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const actionModule = { exports: {} as typeof import("../actions/templates") };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", compiled)(
    (specifier: string) => specifier in boundaries ? boundaries[specifier] : require(specifier), actionModule, actionModule.exports,
  );
  return { state, actions: actionModule.exports };
}

test("apply action requires explicit request/Project, rejects a foreign member, and survives post-commit failure", async () => {
  const f = await fixture();
  try {
    const { actions, state } = await actionHarness(f);
    await assert.rejects(actions.applyTemplateAction(templateId, undefined as never), /request id/);
    await assert.rejects(actions.applyTemplateAction(templateId, { workspaceId: "project-b", requestId }), /project isn’t available/);
    assert.equal((await f.rows()).length, 0);
    state.actor = "member";
    state.failInvalidation = true;
    await assert.rejects(actions.applyTemplateAction(templateId, { workspaceId: "project-a", requestId }), /invalidation failure/);
    assert.equal((await f.rows()).length, 18);
    const response = await actions.applyTemplateAction(templateId, { workspaceId: "project-a", requestId });
    assert.equal(response.length, 18);
    assert.equal((await f.rows()).length, 18);
    assert.equal((await f.receipts()).length, 1);
    assert.equal(state.effects.filter(effect => effect === "emit").length, 1);
  } finally { f.cleanup(); }
});

test("remix action retries a failed cookie write without creating another Project", async () => {
  const f = await fixture();
  try {
    const { actions, state } = await actionHarness(f);
    state.failCookie = true;
    await assert.rejects(actions.remixTemplateAction(templateId, requestId), /cookie failure/);
    assert.equal((await f.db.select().from(workspaces)).length, 3);
    const result = await actions.remixTemplateAction(templateId, requestId);
    assert.equal(result.ok, true);
    assert.equal((await f.db.select().from(workspaces)).length, 3);
    assert.equal((await f.db.select().from(tasks).where(eq(tasks.workspaceId, result.workspaceId))).length, 18);
  } finally { f.cleanup(); }
});

test("demo actions remain inert before identity, persistence, cookie and invalidation", async () => {
  const f = await fixture();
  try {
    const { actions, state } = await actionHarness(f);
    state.demo = true;
    assert.deepEqual(await actions.applyTemplateAction("missing", undefined as never), []);
    assert.equal((await actions.remixTemplateAction("missing", "")).workspaceId, "demo");
    assert.deepEqual(state.effects, []);
    assert.equal((await f.db.select().from(tasks)).length, 0);
  } finally { f.cleanup(); }
});
