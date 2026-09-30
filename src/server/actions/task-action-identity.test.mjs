import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const authPath = fileURLToPath(new URL("../auth.ts", import.meta.url));
const actionsPath = fileURLToPath(new URL("./tasks.ts", import.meta.url));

// Execute the real auth and Task action source with only external boundaries
// substituted. A source regex or an isolated helper test cannot catch a caller
// accidentally resolving identity a second time before the action write.
function loadSource(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => dependencies[name] ?? {}, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

function fixture() {
  const counters = { auth: 0, currentUser: 0, provision: 0, update: 0, activity: 0, list: 0 };
  const timing = { scopes: [], stages: [] };
  const state = {
    actor: "user_alice",
    cookie: "project_alice",
    demo: false,
    failAuth: false,
    failCurrentUser: false,
    failCatalog: false,
    noSession: false,
    failProvision: false,
    mappedIds: new Map(),
    ambientReads: 0,
    memberships: new Map([
      ["user_alice", new Set(["project_alice"])],
      ["user_bob", new Set(["project_bob"])],
    ]),
  };
  const users = { id: "users.id", clerkId: "users.clerkId" };
  const workspaceMembers = { userId: "members.userId", workspaceId: "members.workspaceId" };
  const tasks = { id: "tasks.id", workspaceId: "tasks.workspaceId", lane: "tasks.lane" };
  const workspaces = { id: "workspaces.id", ownerUserId: "workspaces.ownerUserId" };
  const schema = { users, workspaceMembers, tasks, workspaces };
  const eq = (column, value) => ({ kind: "eq", column, value });
  const and = (...parts) => ({ kind: "and", parts });
  const matches = (row, expression) => expression.kind === "and"
    ? expression.parts.every((part) => matches(row, part))
    : row[expression.column] === expression.value;
  const db = {
    select() {
      return {
        from(table) {
          const query = {
            innerJoin() { return query; },
            where(expression) {
              if (table === workspaceMembers) state.ambientReads++;
              const internalActor = state.mappedIds.get(state.actor) ?? state.actor;
              const rows = table === users
                ? [ { "users.id": internalActor, "users.clerkId": state.actor, id: internalActor } ]
                : table === workspaceMembers
                  ? [...(state.memberships.get(internalActor) ?? [])].map((workspaceId) => ({
                    "members.userId": internalActor, "members.workspaceId": workspaceId, workspaceId,
                  }))
                  : table === tasks
                    ? [{ "tasks.id": "task_alice", "tasks.workspaceId": "project_alice", id: "task_alice", workspaceId: "project_alice", lane: "todo" }]
                    : table === workspaces
                      ? [{ "workspaces.id": "project_alice", "workspaces.ownerUserId": "user_alice", id: "user_alice", clerkId: "user_alice" }]
                    : [];
              const selected = rows.filter((row) => matches(row, expression));
              return {
                then: (resolve, reject) => Promise.resolve(selected).then(resolve, reject),
                limit: (count) => Promise.resolve(selected.slice(0, count)),
              };
            },
          }; return query;
        },
      };
    },
    update(table) {
      assert.equal(table, tasks);
      return {
        set() {
          return {
            where() { return { async returning() { counters.update++; return [{ id: "task_alice" }]; } }; },
          };
        },
      };
    },
    transaction: async work => work(db),
  };
  const demo = { isDemoMode: () => state.demo };
  const authModule = loadSource(authPath, {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }) },
    "@clerk/nextjs/server": {
      auth: async () => {
        counters.auth++;
        if (state.failAuth) throw Error("auth failed");
        return { userId: state.noSession ? null : state.actor };
      },
      currentUser: async () => {
        counters.currentUser++;
        if (state.failCurrentUser) throw Error("currentUser failed");
        return { primaryEmailAddressId: "primary", emailAddresses: [{ id: "primary", emailAddress: "owned@example.test" }] };
      },
    },
    "drizzle-orm": { and, eq },
    "@/server/db": { db },
    "@/server/db/schema": schema,
    "@/server/db/seed": { LEGACY_WORKSPACE_ID: "ws_legacy" },
    "@/server/db/ensure-user": { ensureUserProvisioned: async () => {
      counters.provision++;
      if (state.failProvision) throw Error("provision failed");
    } },
    "@/server/diagnostics/identity-timing": { beginIdentityTiming: () => ({
      measure: (_stage, work) => work(), finish() {},
    }) },
    "@/server/diagnostics/identity-outbound": {
      observeCurrentUserOutbound: work => work(),
      withIdentityOutboundScope: (_scope, work) => work(),
    },
    "@/lib/access-mode": demo,
    "@/server/projects/catalog": {
      firstMembershipByCatalogOrder: async (_db, actor) => {
        state.ambientReads++;
        if (state.failCatalog) throw Error("catalog failed");
        return [...(state.memberships.get(actor) ?? [])].sort()[0] ?? null;
      },
    },
    "@/server/demo/tasks-demo": { DEMO_USER_ID: "demo_user", DEMO_WORKSPACE_ID: "demo_project" },
  });
  const actionModule = loadSource(actionsPath, {
    "drizzle-orm": { and, eq },
    "next/cache": { revalidatePath() {} },
    "@/server/db": { db },
    "@/server/db/schema": schema,
    "@/server/db/queries": { getTasks: async (workspaceId) => {
      counters.list++;
      return [{ id: `list_for_${workspaceId}` }];
    } },
    "@/server/db/activity": { recordActivity: async (_taskId, _payload, options) => {
      assert.equal(options.userId, state.mappedIds.get(state.actor) ?? state.actor);
      counters.activity++;
    } },
    "@/server/events": { emitTasksChanged() {} },
    "@/server/auth": authModule,
    "@/server/diagnostics/identity-outbound": {
      withIdentityOutboundScope: (_scope, work) => work(),
    },
    "@/server/diagnostics/task-timing": {
      withTaskActionTiming: (scope, work) => { timing.scopes.push(scope); return work(); },
      measureTaskStage: (stage, work) => { timing.stages.push(stage); return work(); },
    },
    "@/server/actions/private-task-db-write": { privateTaskDbWrite: (operation) => operation() },
    "@/server/actions/project-authz": {
      authorizeStoredProject: async ({ storedProjectId, actorUserId }) =>
        state.memberships.get(actorUserId)?.has(storedProjectId)
          ? { ok: true, projectId: storedProjectId } : { ok: false },
      authorizeProjectCandidate: async ({ candidateProjectId, actorUserId }) => state.memberships.get(actorUserId)?.has(candidateProjectId)
        ? { ok: true, projectId: candidateProjectId }
        : { ok: false },
      scopeForTask: async (taskId, actor) => ({
        ok: taskId === "task_alice" && Boolean(state.memberships.get(actor)?.has("project_alice")),
        ws: "project_alice",
      }),
      readableProjectOrNull: async (projectId, actor) => {
        assert.equal(actor, state.mappedIds.get(state.actor) ?? state.actor);
        return state.memberships.get(actor)?.has(projectId) ? projectId : null;
      },
    },
    "@/lib/access-mode": demo,
    "@/server/demo/tasks-demo": { demoTasks: () => [{ id: "demo_task" }] },
    "@/lib/data": { LANE_ORDER: ["todo", "done"] },
    "@/server/projects/project-deletion-fence": { assertProjectNotDeleting: async () => {} },
    "@/server/account-deletion-lifecycle": { hasAccountDeletionStartedWith: async () => false },
  });
  return { counters, state, authModule, actionModule, timing };
}

async function withProductionEnvironment(run) {
  const before = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  };
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "test-publishable-key";
  process.env.CLERK_SECRET_KEY = "test-secret-key";
  try { await run(); } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("real update action resolves and provisions its actor once", async () => withProductionEnvironment(async () => {
  const { counters, state, actionModule, timing } = fixture();
  assert.deepEqual(await actionModule.updateTaskAction("task_alice", { title: "Changed" }), [{ id: "list_for_project_alice" }]);
  assert.deepEqual(counters, { auth: 1, currentUser: 1, provision: 1, update: 1, activity: 1, list: 1 });
  assert.deepEqual(timing.scopes, ["edit"]);
  assert.deepEqual(timing.stages, ["identity", "writeAndActivity", "projectProof", "finalRead"]);
  assert.equal(state.ambientReads, 0);
}));

test("forged or revoked cookie falls back only to the same actor's live membership", async () => withProductionEnvironment(async () => {
  const { counters, state, authModule, actionModule } = fixture();
  state.cookie = "project_bob";
  assert.equal((await authModule.getCurrentUserAndActiveWorkspaceOrNull())[1], "project_alice");
  state.memberships.set("user_alice", new Set());
  assert.deepEqual(await actionModule.updateTaskAction("task_alice", {}), []);
  assert.equal(counters.update, 0);
  assert.equal(counters.list, 0);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision], [2, 2, 2]);
}));

test("refused target returns only the caller's still-proved ambient list", async () => withProductionEnvironment(async () => {
  const { counters, actionModule } = fixture();
  assert.deepEqual(await actionModule.updateTaskAction("foreign_task", {}), [{ id: "list_for_project_alice" }]);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision, counters.update], [1, 1, 1, 0]);
}));

test("separate actor requests cannot reuse identity or ambient membership", async () => withProductionEnvironment(async () => {
  const { counters, state, authModule } = fixture();
  assert.deepEqual(await authModule.getCurrentUserAndActiveWorkspaceOrNull(), ["user_alice", "project_alice"]);
  state.actor = "user_bob";
  state.cookie = "project_alice";
  assert.deepEqual(await authModule.getCurrentUserAndActiveWorkspaceOrNull(), ["user_bob", "project_bob"]);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision], [2, 2, 2]);
}));

test("workspace proof uses a persisted internal ID distinct from the Clerk subject", async () => withProductionEnvironment(async () => {
  const { counters, state, authModule, actionModule } = fixture();
  state.mappedIds.set("user_alice", "internal_alice");
  state.memberships.delete("user_alice");
  state.memberships.set("internal_alice", new Set(["project_alice"]));
  assert.deepEqual(await authModule.getCurrentUserAndActiveWorkspaceOrNull(), ["internal_alice", "project_alice"]);
  assert.deepEqual(await actionModule.updateTaskAction("task_alice", { title: "Changed" }), [{ id: "list_for_project_alice" }]);
  assert.equal(counters.update, 1);
  assert.equal(counters.activity, 1);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision], [2, 2, 2]);
}));

test("auth or provisioning failure cannot continue to task mutation", async () => withProductionEnvironment(async () => {
  for (const failure of ["failAuth", "noSession", "failCurrentUser", "failProvision"]) {
    const { counters, state, actionModule } = fixture();
    state[failure] = true;
    await assert.rejects(actionModule.updateTaskAction("task_alice", {}));
    assert.equal(counters.update, 0);
    assert.equal(counters.list, 0);
  }
}));

test("successful stored-Project edit ignores an unavailable ambient fallback", async () => withProductionEnvironment(async () => {
  const { state, actionModule, counters } = fixture();
  state.cookie = "project_bob";
  state.failCatalog = true;
  assert.deepEqual(await actionModule.updateTaskAction("task_alice", { title: "Changed" }),
    [{ id: "list_for_project_alice" }]);
  assert.equal(state.ambientReads, 0);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision, counters.update], [1, 1, 1, 1]);
}));

test("missing target resolves the same actor's ambient Project only for its neutral reply", async () => withProductionEnvironment(async () => {
  const { state, actionModule, counters } = fixture();
  state.cookie = "project_bob";
  assert.deepEqual(await actionModule.updateTaskAction("missing", {}), [{ id: "list_for_project_alice" }]);
  assert.ok(state.ambientReads >= 2);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision, counters.update], [1, 1, 1, 0]);
}));

test("explicit foreign create refuses without consulting ambient membership", async () => withProductionEnvironment(async () => {
  const { state, actionModule, counters } = fixture();
  state.failCatalog = true;
  await assert.rejects(actionModule.addTaskAction({ title: "Denied", projectId: "project_bob" }),
    /Task Project is unavailable/);
  assert.equal(state.ambientReads, 0);
  assert.deepEqual([counters.auth, counters.currentUser, counters.provision, counters.update], [1, 1, 1, 0]);
}));

const changedActions = [
  ["moveTaskAction", ["foreign_task", "done"]],
  ["toggleCompleteAction", ["foreign_task"]],
  ["updateTaskAction", ["foreign_task", { title: "Changed" }]],
  ["addTaskAction", [{ title: "New task" }]],
  ["reorderTaskAction", ["foreign_task", "todo", 1]],
  ["removeTaskAction", ["foreign_task"]],
  ["setTaskArchivedAction", ["foreign_task", true]],
  ["duplicateTaskAction", ["foreign_task"]],
  ["setTaskMilestoneAction", ["foreign_task", true]],
];

test("each changed action exits demo before identity or storage access", async () => withProductionEnvironment(async () => {
  for (const [name, args] of changedActions) {
    const { counters, state, actionModule } = fixture();
    state.demo = true;
    assert.deepEqual(await actionModule[name](...args), [{ id: "demo_task" }], name);
    assert.deepEqual([counters.auth, counters.currentUser, counters.provision, counters.update, counters.list], [0, 0, 0, 0, 0], name);
  }
}));

test("each changed action refuses a removed member without a second identity resolution", async () => withProductionEnvironment(async () => {
  for (const [name, args] of changedActions) {
    const { counters, state, actionModule } = fixture();
    state.memberships.set("user_alice", new Set());
    assert.deepEqual(await actionModule[name](...args), [], name);
    assert.deepEqual([counters.auth, counters.currentUser, counters.provision, counters.update, counters.list], [1, 1, 1, 0, 0], name);
  }
}));

test("demo action never reaches Clerk or provisioning", async () => withProductionEnvironment(async () => {
  const { counters, state, actionModule } = fixture();
  state.demo = true;
  assert.deepEqual(await actionModule.updateTaskAction("task_alice", {}), [{ id: "demo_task" }]);
  assert.equal(counters.auth, 0);
  assert.equal(counters.provision, 0);
}));

test("only ambient-dependent Task actions use the paired entry point", () => {
  const source = readFileSync(actionsPath, "utf8");
  const direct = (source.match(/await getCurrentUserAndActiveWorkspaceOrNull\(\)/g) ?? []).length;
  const scoped = (source.match(/withIdentityOutboundScope\("taskAction", getCurrentUserAndActiveWorkspaceOrNull\)/g) ?? []).length;
  assert.equal(direct + scoped, 6);
  assert.equal(scoped, 0);
  assert.doesNotMatch(source, /getCurrentUser\(\),\s*getActiveWorkspaceOrNull\(\)/);
});
