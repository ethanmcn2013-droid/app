import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import ts from "typescript";
import { freshFileDb } from "@/server/db/memory-test-db";

// Execute the owning catalog, Tasks adapter and briefing, replacing only DB/config
// boundaries. No demo catalog or fake authorization rows participate in these tests.
function load<T>(relative: string, boundaries: Record<string, unknown>): T {
  const file = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const require = createRequire(file);
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name: string) => Object.hasOwn(boundaries, name) ? boundaries[name] : require(name),
    loaded, loaded.exports,
  );
  return loaded.exports as T;
}

async function fixture() {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA foreign_keys=ON");
  await f.client.executeMultiple(`
    INSERT INTO users(id,clerk_id,email,color,initials) VALUES
      ('local-a','clerk-a','same@example.invalid','blue','AA'),
      ('local-b','clerk-b','same@example.invalid','blue','BB');
    INSERT INTO planning_periods(id,owner_user_id,name,context_type,timezone) VALUES
      ('period-a','local-a','Current period','school_year','Europe/Dublin'),
      ('period-old','local-a','Archived period','school_year','UTC');
    UPDATE planning_periods SET archived_at=1 WHERE id='period-old';
    INSERT INTO workspaces(id,slug,name,owner_user_id,planning_period_id) VALUES
      ('grouped-a','grouped-a','Grouped A','local-a','period-a'),
      ('loose-a','loose-a','Loose A','local-a',NULL),
      ('loose-b','loose-b','Loose B','local-b',NULL),
      ('shared-b','shared-b','Shared B','local-b',NULL),
      ('archived-project','archived-project','Archived project','local-a',NULL),
      ('archived-period','archived-period','Archived period project','local-a','period-old');
    UPDATE workspaces SET archived_at=1 WHERE id='archived-project';
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('shared-b','local-a','member');
    INSERT INTO tasks(id,workspace_id,seq,title,lane,priority) VALUES
      ('task-grouped','grouped-a',1,'Grouped synthetic work','todo','normal'),
      ('task-loose','loose-a',1,'Loose synthetic work','todo','normal'),
      ('task-b','loose-b',1,'Other actor synthetic work','todo','normal'),
      ('task-shared','shared-b',1,'Shared synthetic work','todo','normal');
  `);
  const signalClient = createClient({ url: ":memory:" });
  await signalClient.executeMultiple(readFileSync(new URL("../../../../../drizzle-signal/0000_signal_baseline.sql", import.meta.url), "utf8"));
  await signalClient.executeMultiple(`
    INSERT INTO analytics_users(clerk_id,linked_workspace_id,scope_kind,timezone) VALUES
      ('clerk-a','grouped-a','workspace','UTC'), ('clerk-b','loose-b','workspace','UTC');
  `);
  const signalBoundary = { "../db/signal-analytics-client": { signalAnalyticsDb: drizzle(signalClient) } };
  const tasksBoundary = { getTasksDb: () => f.db, tasksDbConfigured: true };
  const source = load<typeof import("../data/source")>("../data/source.ts", {
    "@/modules/signal/server/tasks-db/signal-tasks-db-client": tasksBoundary,
  });
  const scope = load<typeof import("./scope")>("./scope.ts", {
    "../data/source": source,
    "../../server/tasks-db/signal-tasks-db-client": tasksBoundary,
  });
  const briefing = load<typeof import("../../server/briefing/signal-build-for-user")>("../../server/briefing/signal-build-for-user.ts", {
    ...signalBoundary,
    "../../lib/data/source": source,
    "../../lib/planning-periods/scope": { ...scope, planningPeriodsEnabled: () => true },
    "@/lib/access-mode": { isDemoMode: () => false },
    "./signal-read-state": load("../../server/briefing/signal-read-state.ts", signalBoundary),
    "./signal-rotation": load("../../server/briefing/signal-rotation.ts", signalBoundary),
  });
  return { ...f, signalClient, source, scope, briefing, cleanup() { signalClient.close(); f.cleanup(); } };
}

test("real mixed catalog includes genuinely loose owner/member projects, preserves archive policy and immutable identity", async () => {
  const f = await fixture();
  try {
    const identity = { clerkId: "clerk-a", email: "same@example.invalid" };
    const catalog = await f.scope.listPlanningCatalogForUser(identity);
    assert.equal(catalog.planningSchemaAvailable, true);
    assert.deepEqual(catalog.workspaces.map(w => w.id).sort(), ["grouped-a", "loose-a", "shared-b"]);
    assert.deepEqual(catalog.periods.map(p => p.id), ["period-a"]);
    assert.equal(catalog.workspaces.find(w => w.id === "shared-b")?.role, "member");
    assert.equal(f.scope.authorizeSignalScope(catalog, { kind: "workspace", workspaceId: "loose-a" })?.period, null);
    assert.deepEqual(f.scope.authorizeSignalScope(catalog, { kind: "planningPeriod", planningPeriodId: "period-a" })?.workspaces.map(w => w.id), ["grouped-a"]);
    // The predecessor really contains archived projects: it must not be unioned
    // into a successfully read planning catalog.
    assert.ok((await f.source.dataSource.listForUser(identity)).some(w => w.workspaceId === "archived-project"));
    for (const clerkId of ["local-a", "unknown"]) {
      assert.deepEqual((await f.scope.listPlanningCatalogForUser({ clerkId, email: identity.email })).workspaces, []);
    }
    assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally { f.cleanup(); }
});

test("actual briefing reads the exact loose project and refuses foreign/removed requests rather than its valid saved scope", async () => {
  const f = await fixture();
  try {
    const read = (clerkId: string, workspaceId?: string) => f.briefing.buildBriefingForUser({
      clerkId, cadence: "daily", recordReadState: false,
      ...(workspaceId ? { scope: { kind: "workspace" as const, workspaceId } } : {}),
    });
    const loose = await read("clerk-a", "loose-a");
    assert.equal(loose.kind, "ok");
    if (loose.kind !== "ok") throw Error("Expected authorized loose project");
    assert.deepEqual(loose.signals.map(t => [t.id, t.workspaceId]), [["task-loose", "loose-a"]]);
    assert.equal((await read("clerk-a", "shared-b")).kind, "ok");
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='shared-b' AND user_id='local-a'");
    for (const workspaceId of ["shared-b", "loose-b", "archived-project", "archived-period", "missing"]) {
      assert.deepEqual(await read("clerk-a", workspaceId), { kind: "no-workspace" });
    }
    for (const [clerkId, taskId] of [["clerk-a", "task-grouped"], ["clerk-b", "task-b"]]) {
      const saved = await read(clerkId);
      assert.equal(saved.kind, "ok");
      if (saved.kind === "ok") assert.deepEqual(saved.signals.map(t => t.id), [taskId]);
    }
    assert.equal((await f.signalClient.execute("SELECT * FROM surfaced_items")).rows.length, 0);
    assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally { f.cleanup(); }
});

test("dangling non-null period references are corruption, never reclassified as loose", async () => {
  const f = await fixture();
  try {
    // Inject a legacy corrupt reference deliberately, then exercise with FKs on.
    await f.client.execute("PRAGMA foreign_keys=OFF");
    await f.client.execute("UPDATE workspaces SET planning_period_id='missing-period' WHERE id='loose-a'");
    await f.client.execute("PRAGMA foreign_keys=ON");
    assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 1);
    const catalog = await f.scope.listPlanningCatalogForUser({ clerkId: "clerk-a", email: null });
    assert.equal(catalog.planningSchemaAvailable, true);
    assert.equal(f.scope.authorizeSignalScope(catalog, { kind: "workspace", workspaceId: "loose-a" }), null);
    assert.ok(catalog.workspaces.some(w => w.id === "shared-b"));
  } finally { f.cleanup(); }
});

test("catalog remains bounded to 200 genuinely authorized active projects", async () => {
  const f = await fixture();
  try {
    await f.client.batch(Array.from({ length: 205 }, (_, i) => ({
      sql: "INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES (?,?,?,'local-a')",
      args: [`bound-${i}`, `bound-${i}`, `Bound ${i}`],
    })), "write");
    const catalog = await f.scope.listPlanningCatalogForUser({ clerkId: "clerk-a", email: null });
    assert.equal(catalog.planningSchemaAvailable, true);
    assert.equal(catalog.workspaces.length, 200);
    assert.ok(catalog.workspaces.every(w => w.id.startsWith("bound-") || ["grouped-a", "loose-a", "shared-b"].includes(w.id)));
    assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally { f.cleanup(); }
});
