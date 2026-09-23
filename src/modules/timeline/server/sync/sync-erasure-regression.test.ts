import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import ts from "typescript";
import * as schema from "../db/timeline-schema";
import type { MilestoneSnapshot } from "./tasks-milestone-source";

// Actual action, queries, sync helpers and eraser; only auth, the external
// Tasks snapshot and framework/provider boundaries are substituted. Both
// SQLite connections point to this test's disposable file, never env URLs.
const migrationRequire = createRequire(import.meta.url);
const { runTimelineMigrations } = migrationRequire("../../../../../scripts/db/timeline-migrate.mjs");
type Database = ReturnType<typeof drizzle<typeof schema>>;
type Action = typeof import("../actions/workspaces");
type Queries = typeof import("../db/timeline-queries");
type Sync = typeof import("./sync-state");
function load<T>(relative: string, boundaries: Record<string, unknown>): T {
  const file = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const sourceRequire = createRequire(file);
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name: string) => Object.hasOwn(boundaries, name) ? boundaries[name] : sourceRequire(name), mod, mod.exports,
  );
  return mod.exports as T;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function barrier() {
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { entered = resolve; });
  return { release, reached, pause: async () => { entered(); await held; } };
}
const snapshot: MilestoneSnapshot = {
  kind: "complete", totalCount: 1, digest: "synthetic-digest",
  items: [{ id: "ms-current", workspaceSlug: "a", projectSlug: "plan", title: "Synthetic milestone", status: "next", targetDate: "2027-01-22", sortOrder: 0 }],
};

async function fixture(foreignKeys: boolean, legacy = false) {
  const directory = mkdtempSync(join(tmpdir(), "timeline-sync-erasure-"));
  const databaseUrl = pathToFileURL(join(directory, "timeline.db")).href;
  const client = createClient({ url: databaseUrl });
  if (legacy) await client.executeMultiple(readFileSync(new URL("../../../../../drizzle-timeline/0000_timeline_baseline.sql", import.meta.url), "utf8"));
  else await runTimelineMigrations({ client, environment: "test", databaseUrl, releaseSha: "synthetic-sync-erasure" });
  for (const actor of ["a", "b"]) await client.batch([
    { sql: "INSERT INTO workspaces(slug,name,owner_user_id,suite_workspace_id) VALUES (?,?,?,?)", args: [actor, actor, `clerk-${actor}`, `tasks-${actor}`] },
    { sql: "INSERT INTO projects(workspace_slug,slug,name,one_liner,accent,source_tasks_workspace_id) VALUES (?,'plan','Plan','','default',?)", args: [actor, `tasks-${actor}`] },
    { sql: "INSERT INTO tasks(id,workspace_slug,project_slug,title,description,kind,target_date) VALUES (?,?,'plan','Synthetic','','milestone','2027-01-21')", args: [actor === "a" ? "ms-current" : "ms-b", actor] },
  ], "write");
  await client.execute("INSERT INTO tasks(id,workspace_slug,project_slug,title,description,kind) VALUES ('ms-stale','a','plan','Synthetic stale','','milestone')");
  let inTransaction = false;
  let beforeTransaction: (() => Promise<void>) | undefined;
  function guarded(connection: typeof client, watch: boolean): Database {
    const base = drizzle(connection, { schema });
    return new Proxy(base, {
      get(target, key) {
        if (key === "transaction") return async (operation: Parameters<Database["transaction"]>[0]) => {
          if (watch && beforeTransaction) await beforeTransaction();
          await connection.execute(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"}`);
          await connection.execute("PRAGMA busy_timeout=25");
          return target.transaction(async tx => {
            assert.equal((await tx.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`))[0].foreign_keys, foreignKeys ? 1 : 0);
            if (watch) inTransaction = true;
            try { return await operation(tx); }
            finally { if (watch) inTransaction = false; }
          });
        };
        if (watch && inTransaction && ["select", "insert", "update", "delete"].includes(String(key))) {
          throw Error("Sync escaped its owning executor");
        }
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  const db = guarded(client, true);
  const common = {
    "./timeline-client": { db }, "@/modules/timeline/server/db/timeline-client": { db },
    "@/lib/access-mode": { isDemoMode: () => false },
  };
  const queries = load<Queries>("../db/timeline-queries.ts", common);
  const sync = load<Sync>("./sync-state.ts", common);
  const target = load<typeof import("./sync-target")>("./sync-target.ts", common);
  const gdpr = { async eraseForUser(actor: string) {
    // Each attempt models a fresh request connection. A libSQL connection
    // whose BEGIN failed busy can itself retain a pending native statement;
    // retry-on-that-same-connection is not claimed by this fixture.
    const connection = createClient({ url: databaseUrl });
    try {
      return await load<typeof import("../timeline-gdpr")>("../timeline-gdpr.ts", {
        "./db/timeline-client": { db: guarded(connection, false) },
      }).eraseForUser(actor);
    } finally { connection.close(); }
  } };
  const invalidations: string[] = [];
  const noProvider = () => { throw Error("Unexpected provider or unrelated store access"); };
  function action(options: {
    read?: () => Promise<MilestoneSnapshot>;
    bind?: Queries["bindProjectToTasksWorkspace"];
    ensure?: Sync["ensureSuiteProjectBinding"];
    acquire?: Sync["acquireSyncLease"];
  } = {}) {
    return load<Action>("../actions/workspaces.ts", {
      ...common,
      "@/modules/timeline/server/auth": { requireUser: async () => "clerk-a" },
      "@/modules/timeline/server/db/timeline-queries": { ...queries, bindProjectToTasksWorkspace: options.bind ?? queries.bindProjectToTasksWorkspace },
      "@/modules/timeline/server/sync/sync-target": target,
      "@/modules/timeline/server/sync/sync-state": { ...sync, ensureSuiteProjectBinding: options.ensure ?? sync.ensureSuiteProjectBinding, acquireSyncLease: options.acquire ?? sync.acquireSyncLease },
      "@/modules/timeline/server/sync/tasks-workspace-context": { getCurrentTasksWorkspaceContext: async () => ({ kind: "member", context: { archivedAt: null } }) },
      "@/modules/timeline/server/sync/tasks-milestone-source": { makeMilestoneSyncSource: () => ({ getMilestonesForClerkId: async (actor: string, id: string) => {
        assert.equal(actor, "clerk-a"); assert.equal(id, "tasks-a");
        return options.read ? options.read() : snapshot;
      } }) },
      "next/cache": { revalidatePath: (path: string) => invalidations.push(path) },
      "next/navigation": { redirect: noProvider }, "@clerk/nextjs/server": { clerkClient: noProvider },
      "@/server/db/entitlements": { getPersonalFeatureTier: noProvider },
      "@/lib/account/instrumentation/call-site": { recordSponsoredUse: noProvider },
    }).syncMilestonesAction;
  }
  const tables = (await client.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map(row => String(row.name));
  async function hashes() {
    return Object.fromEntries(await Promise.all(tables.map(async table => [table, digest((await client.execute(`SELECT * FROM "${table}" ORDER BY rowid`)).rows)])));
  }
  return { client, db, gdpr, queries, sync, action, invalidations, hashes,
    setBeforeTransaction: (callback?: () => Promise<void>) => { beforeTransaction = callback; },
    async bystander() { return digest(await queries.getEffectiveNodesForWorkspace("b")); },
    async count(table: string) { assert.ok(tables.includes(table)); return Number((await client.execute(`SELECT count(*) n FROM "${table}"`)).rows[0].n); },
    close() { client.close(); },
  };
  // No recursive deletion: libSQL retains disposable Windows handles after
  // close. All assertions are awaited and both connections are closed; files
  // remain in the unique synthetic temp directory, never a shared DB path.
}

for (const foreignKeys of [true, false]) {
  for (const legacy of [true, false]) {
    test(`actual sync permits current owner and inherited null child (FK ${foreignKeys}, legacy ${legacy})`, async () => {
      const f = await fixture(foreignKeys, legacy);
      try {
        await f.client.execute("UPDATE projects SET source_tasks_workspace_id=NULL WHERE workspace_slug='a'");
        const bystander = await f.bystander();
        const result = await f.action()("a", "plan");
        assert.equal("ok" in result && result.ok, true);
        assert.equal((await f.queries.getProjectsForWorkspace("a"))[0].sourceTasksWorkspaceId, "tasks-a");
        assert.equal(await f.count("tasks"), 2, "one imported milestone plus the bystander; stale node reconciled");
        assert.equal(await f.bystander(), bystander);
      } finally { f.close(); }
    });

    test(`erasure during source read refuses resurrection (FK ${foreignKeys}, legacy ${legacy})`, async () => {
      const f = await fixture(foreignKeys, legacy);
      try {
        const bystander = await f.bystander();
        const result = await f.action({ read: async () => {
          assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
          return snapshot;
        } })("a", "plan");
        assert.ok("error" in result && !result.retryable);
        assert.equal(await f.count("workspaces"), 1);
        assert.equal(await f.count("tasks"), 1);
        if (!legacy) { assert.equal(await f.count("suite_project_bindings"), 0); assert.equal(await f.count("timeline_source_sync_state"), 0); }
        assert.equal(await f.bystander(), bystander);
        assert.deepEqual(f.invalidations, []);
      } finally { f.close(); }
    });
  }

  test(`after-binding paused null-lease sync and erasure serialize; retry removes every write (FK ${foreignKeys})`, { timeout: 15_000 }, async () => {
    const f = await fixture(foreignKeys, true);
    const held = barrier();
    const pending = f.action({ bind: async (...args) => { await f.queries.bindProjectToTasksWorkspace(...args); await held.pause(); } })("a", "plan");
    try {
      await held.reached;
      const erasure = await f.gdpr.eraseForUser("clerk-a");
      assert.ok(!erasure.ok && /SQLITE_BUSY/.test(erasure.error), "the in-flight writer owns the local transaction; erasure must retain retry custody");
      held.release();
      assert.ok("ok" in await pending);
      const bystander = await f.bystander();
      assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
      assert.equal(await f.count("tasks"), 1);
      assert.equal(await f.count("workspaces"), 1);
      assert.equal(await f.bystander(), bystander);
    } finally { held.release(); await pending.catch(() => {}); f.close(); }
  });

  for (const stage of ["binding", "lease"] as const) {
    test(`normalized ${stage} preparation cannot outlive erasure (FK ${foreignKeys})`, { timeout: 15_000 }, async () => {
      const f = await fixture(foreignKeys);
      const held = barrier();
      if (stage === "lease") await f.sync.ensureSuiteProjectBinding({ tasksWorkspaceId: "tasks-a", timelineWorkspaceSlug: "a", primaryTimelineSlug: "plan", authority: { kind: "inherits-workspace-binding" } });
      const pending = f.action(stage === "binding" ? {
        ensure: async (...args) => { await held.pause(); return f.sync.ensureSuiteProjectBinding(...args); },
      } : { acquire: async (...args) => { await held.pause(); return f.sync.acquireSyncLease(...args); } })("a", "plan");
      try {
        await held.reached;
        const erasure = await f.gdpr.eraseForUser("clerk-a");
        assert.ok(!erasure.ok && /SQLITE_BUSY/.test(erasure.error));
        held.release();
        assert.ok("ok" in await pending);
        assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
        assert.equal(await f.count("suite_project_bindings"), 0);
        assert.equal(await f.count("timeline_source_sync_state"), 0);
        assert.equal(await f.count("tasks"), 1);
      } finally { held.release(); await pending.catch(() => {}); f.close(); }
    });
  }
}

for (const mutation of [
  "UPDATE workspaces SET owner_user_id='clerk-b' WHERE slug='a'",
  "UPDATE workspaces SET suite_workspace_id='tasks-changed' WHERE slug='a'",
  "UPDATE projects SET source_tasks_workspace_id='tasks-b' WHERE workspace_slug='a'",
  "DELETE FROM projects WHERE workspace_slug='a'",
]) {
  for (const legacy of [true, false]) test(`current target refuses ${mutation.split(" ").slice(0, 4).join(" ")} (legacy ${legacy})`, async () => {
    const f = await fixture(false, legacy);
    try {
      if (!legacy) assert.ok("ok" in await f.action()("a", "plan")); // Next complete snapshot has unchanged digest.
      f.invalidations.length = 0;
      let after!: Awaited<ReturnType<typeof f.hashes>>;
      const result = await f.action({ read: async () => {
        // libSQL reconnects after handing its connection to a transaction.
        await f.client.execute("PRAGMA foreign_keys=OFF");
        assert.equal((await f.client.execute("PRAGMA foreign_keys")).rows[0].foreign_keys, 0);
        await f.client.execute(mutation); after = await f.hashes(); return snapshot;
      } })("a", "plan");
      assert.ok("error" in result && !result.retryable);
      assert.deepEqual(await f.hashes(), after, "no CAS/freshness, child fill, history or node write after target changed");
      assert.deepEqual(f.invalidations, []);
    } finally { f.close(); }
  });
}

test("erasure before preparation opens refuses binding and lease creation", async () => {
  const f = await fixture(false);
  try {
    f.setBeforeTransaction(async () => { f.setBeforeTransaction(); assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true }); });
    const result = await f.action()("a", "plan");
    assert.ok("error" in result && !result.retryable);
    assert.equal(await f.count("suite_project_bindings"), 0);
    assert.equal(await f.count("timeline_source_sync_state"), 0);
  } finally { f.close(); }
});

for (const legacy of [true, false]) test(`partial snapshots preserve omitted nodes but still require the current target (legacy ${legacy})`, async () => {
  const f = await fixture(false, legacy);
  try {
    const partial: MilestoneSnapshot = { kind: "partial", totalCount: 2, items: snapshot.items };
    const result = await f.action({ read: async () => partial })("a", "plan");
    assert.ok("ok" in result && !result.complete && result.changed);
    assert.equal(await f.count("tasks"), 3, "a truncated source cannot delete the omitted milestone");
    f.invalidations.length = 0;
    let after!: Awaited<ReturnType<typeof f.hashes>>;
    const denied = await f.action({ read: async () => {
      await f.client.execute("UPDATE workspaces SET owner_user_id='clerk-b' WHERE slug='a'");
      after = await f.hashes();
      return partial;
    } })("a", "plan");
    assert.ok("error" in denied && !denied.retryable);
    assert.deepEqual(await f.hashes(), after);
    assert.deepEqual(f.invalidations, []);
  } finally { f.close(); }
});

test("normalized generation supersession and unchanged digest retain their actual action semantics", async () => {
  const f = await fixture(true);
  try {
    const result = await f.action({ read: async () => {
      assert.ok(await f.sync.acquireSyncLease({ tasksWorkspaceId: "tasks-a", timelineWorkspaceSlug: "a", timelineSlug: "plan" }));
      return snapshot;
    } })("a", "plan");
    assert.ok("ok" in result && result.superseded);
    assert.equal(await f.count("tasks"), 3);
    assert.deepEqual(f.invalidations, []);
    assert.ok("ok" in await f.action()("a", "plan"));
    f.invalidations.length = 0;
    await f.client.execute("CREATE TRIGGER reject_rewrite BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'unexpected rewrite'); END");
    const unchanged = await f.action()("a", "plan");
    assert.ok("ok" in unchanged && unchanged.changed === false && !unchanged.superseded);
    assert.deepEqual(f.invalidations, []);
  } finally { f.close(); }
});

test("late reconcile failure rolls back CAS, node upsert and date history through the same executor", async () => {
  const f = await fixture(true);
  const previous = process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED;
  process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED = "true";
  try {
    await f.client.execute("CREATE TRIGGER reject_reconcile BEFORE DELETE ON tasks WHEN OLD.id='ms-stale' BEGIN SELECT RAISE(ABORT,'synthetic late write failure'); END");
    let prepared!: Awaited<ReturnType<typeof f.hashes>>;
    await assert.rejects(f.action({ read: async () => { prepared = await f.hashes(); return snapshot; } })("a", "plan"), /synthetic late write failure|Failed query/);
    assert.deepEqual(await f.hashes(), prepared, "the entire final transaction rolls back, including its successful CAS");
    assert.deepEqual(f.invalidations, []);
    await f.client.execute("DROP TRIGGER reject_reconcile");
    assert.ok("ok" in await f.action()("a", "plan"));
    assert.equal(await f.count("activity"), 1, "actual date-change history committed with the node write");
    assert.equal(await f.count("tasks"), 2);
  } finally {
    if (previous === undefined) delete process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED;
    else process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED = previous;
    f.close();
  }
});

for (const foreignKeys of [true, false]) {
  test(`R1 caller transaction rolls back an inserted binding after mirror ABORT and permits retry (FK ${foreignKeys})`, async () => {
    const f = await fixture(foreignKeys);
    try {
      await f.client.execute("UPDATE projects SET source_tasks_workspace_id=NULL WHERE workspace_slug='a'");
      await f.client.execute("CREATE TRIGGER reject_binding_mirror BEFORE UPDATE OF source_tasks_workspace_id ON projects WHEN OLD.workspace_slug='a' BEGIN SELECT RAISE(ABORT,'synthetic mirror failure'); END");
      const before = await f.hashes();
      const bystander = await f.bystander();
      let sourceReads = 0;
      const result = await f.action({ read: async () => {
        sourceReads++;
        return { kind: "error", code: "synthetic-offline" };
      } })("a", "plan").then(value => ({ value, error: null }), (error: unknown) => ({ value: null, error }));
      assert.equal(await f.count("suite_project_bindings"), 0, "the current transaction's inserted binding is not an independent race winner");
      assert.equal(await f.count("timeline_source_sync_state"), 0, "failed preparation must not acquire a lease");
      assert.deepEqual(await f.hashes(), before, "all data, including the null child, remains as before preparation");
      assert.ok(result.error instanceof Error, "the write-phase failure must escape both catches and roll back the owning transaction");
      assert.ok(result.error.cause instanceof Error, "the underlying statement failure remains available to the server");
      assert.equal(sourceReads, 0, "preparation failure stops before the external Tasks read");
      assert.deepEqual(f.invalidations, []);

      await f.client.execute("DROP TRIGGER reject_binding_mirror");
      const retry = await f.action()("a", "plan");
      assert.ok("ok" in retry && retry.complete);
      assert.equal(await f.count("suite_project_bindings"), 1);
      assert.equal(await f.count("timeline_source_sync_state"), 1);
      assert.equal((await f.queries.getProjectsForWorkspace("a"))[0].sourceTasksWorkspaceId, "tasks-a");
      assert.equal(await f.count("tasks"), 2, "successful retry imports and reconciles the actual snapshot");
      assert.equal(await f.bystander(), bystander);
    } finally { f.close(); }
  });

  test(`R1 default standalone binding retains rollback/fail-soft behavior and retry (FK ${foreignKeys})`, async () => {
    const f = await fixture(foreignKeys);
    try {
      await f.client.execute("UPDATE projects SET source_tasks_workspace_id=NULL WHERE workspace_slug='a'");
      await f.client.execute("CREATE TRIGGER reject_binding_mirror BEFORE UPDATE OF source_tasks_workspace_id ON projects WHEN OLD.workspace_slug='a' BEGIN SELECT RAISE(ABORT,'synthetic mirror failure'); END");
      const before = await f.hashes();
      const input = { tasksWorkspaceId: "tasks-a", timelineWorkspaceSlug: "a", primaryTimelineSlug: "plan", authority: { kind: "inherits-workspace-binding" as const } };
      assert.deepEqual(await f.sync.ensureSuiteProjectBinding(input), { kind: "not-exact", reason: "binding-race-lost" });
      assert.deepEqual(await f.hashes(), before, "the default helper's private transaction still rolls back before rereading");
      await f.client.execute("DROP TRIGGER reject_binding_mirror");
      assert.deepEqual(await f.sync.ensureSuiteProjectBinding(input), { kind: "bound", created: true });
      assert.equal((await f.queries.getProjectsForWorkspace("a"))[0].sourceTasksWorkspaceId, "tasks-a");
      assert.equal(await f.count("suite_project_bindings"), 1);
      assert.equal(await f.count("timeline_source_sync_state"), 0, "standalone binding does not acquire a sync lease");
    } finally { f.close(); }
  });
}
