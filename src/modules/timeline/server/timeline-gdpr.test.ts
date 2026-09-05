import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import ts from "typescript";
import * as schema from "./db/timeline-schema";

const require = createRequire(import.meta.url);
const { runTimelineMigrations } = require("../../../../scripts/db/timeline-migrate.mjs") as {
  runTimelineMigrations: (options: { client: ReturnType<typeof createClient>; environment: string; databaseUrl: string; releaseSha: string }) => Promise<unknown>;
};
type Database = ReturnType<typeof drizzle<typeof schema>>;
function load<T>(relative: string, database: Database): T {
  const file = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const sourceRequire = createRequire(file);
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name: string) => name.endsWith("/timeline-client") ? { db: database } : sourceRequire(name),
    loaded, loaded.exports,
  );
  return loaded.exports as T;
}
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function fixture(foreignKeys: boolean, legacy = false) {
  const directory = mkdtempSync(join(tmpdir(), "timeline-erasure-"));
  const databaseUrl = pathToFileURL(join(directory, "timeline.db")).href;
  const client = createClient({ url: databaseUrl });
  if (legacy) {
    await client.executeMultiple(readFileSync(new URL("../../../../drizzle-timeline/0000_timeline_baseline.sql", import.meta.url), "utf8"));
  } else {
    await runTimelineMigrations({ client, environment: "test", databaseUrl, releaseSha: "synthetic-module-lifecycle" });
  }
  await client.execute(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"}`);
  for (const [slug, owner, state] of [["a-active", "clerk-a", "active"], ["a-orphaned", "clerk-a", "orphaned"], ["a-retired", "clerk-a", "retired"], ["b", "clerk-b", "active"]]) {
    // Synthetic custody material is hashed in snapshots, never emitted as rows.
    await client.batch([
      { sql: "INSERT INTO workspaces(slug,name,owner_user_id,suite_workspace_id) VALUES (?,?,?,?)", args: [slug, slug, owner, `tasks-${slug}`] },
      { sql: "INSERT INTO projects(workspace_slug,slug,name,one_liner,accent,source_tasks_workspace_id) VALUES (?,'plan','Plan','','default',?)", args: [slug, `tasks-${slug}`] },
      { sql: "INSERT INTO tasks(id,workspace_slug,project_slug,title,description) VALUES (?,?,'plan','Synthetic task','')", args: [`task-${slug}`, slug] },
      { sql: "INSERT INTO subtasks(id,task_id,workspace_slug,title) VALUES (?,?,?,'Synthetic child')", args: [`sub-${slug}`, `task-${slug}`, slug] },
      { sql: "INSERT INTO comments(id,task_id,workspace_slug,body) VALUES (?,?,?,'Synthetic comment')", args: [`comment-${slug}`, `task-${slug}`, slug] },
      { sql: "INSERT INTO activity(id,workspace_slug,entity_kind,entity_id,action) VALUES (?,?,'task',?,'created')", args: [`activity-${slug}`, slug, `task-${slug}`] },
      { sql: "INSERT INTO node_overlays(workspace_slug,node_id,label_override) VALUES (?,?,'Synthetic override')", args: [slug, `task-${slug}`] },
      { sql: "INSERT INTO project_sources(workspace_slug,project_slug,raw_markdown) VALUES (?,'plan','Synthetic source')", args: [slug] },
      { sql: "INSERT INTO timeline_publications(id,workspace_slug,source_workspace_id,source_digest,label,audience_kind,timezone) VALUES (?,?,?,'digest','Synthetic publication','guests','UTC')", args: [`pub-${slug}`, slug, `tasks-${slug}`] },
      { sql: "INSERT INTO timeline_publication_items(public_id,publication_id,title,state,source_relation,source_digest) VALUES (?,?,'Synthetic item','published','relation','digest')", args: [`item-${slug}`, `pub-${slug}`] },
      { sql: "INSERT INTO audience_shares(id,publication_id,token_hash) VALUES (?,?,?)", args: [`share-${slug}`, `pub-${slug}`, sha(["synthetic-share", slug])] },
      { sql: "INSERT INTO audience_view_receipts(publication_id,session_hash,expires_at) VALUES (?,?,2000000000)", args: [`pub-${slug}`, sha(["synthetic-session", slug])] },
      ...(!legacy ? [
        { sql: "INSERT INTO suite_project_bindings(tasks_workspace_id,timeline_workspace_slug,primary_timeline_slug,state,provenance) VALUES (?,?,'plan',?,'legacy_exact')", args: [`tasks-${slug}`, slug, state] },
        { sql: "INSERT INTO timeline_source_sync_state(tasks_workspace_id,timeline_workspace_slug,timeline_slug,status) VALUES (?,?,'plan','complete')", args: [`tasks-${slug}`, slug] },
      ] : []),
    ], "write");
  }
  const db = new Proxy(drizzle(client, { schema }), {
    get(target, property) {
      if (property === "transaction") return async (operation: Parameters<Database["transaction"]>[0]) => {
        // libSQL hands off its connection to each transaction, then reconnects.
        // Set and prove the intended pragma on EVERY owning transaction.
        await client.execute(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"}`);
        return target.transaction(async tx => {
          const [mode] = await tx.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
          assert.equal(mode.foreign_keys, foreignKeys ? 1 : 0);
          return operation(tx);
        });
      };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const gdpr = load<typeof import("./timeline-gdpr")>("./timeline-gdpr.ts", db);
  const tables = (await client.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map(r => String(r.name));
  async function snapshot(bystanderOnly = false) {
    const result: Record<string, { count: number; sha256: string }> = {};
    for (const table of tables) {
      const column = table === "workspaces" ? "slug"
        : ["suite_project_bindings", "timeline_source_sync_state"].includes(table) ? "timeline_workspace_slug"
        : ["timeline_publication_items", "audience_shares", "audience_view_receipts"].includes(table) ? "publication_id"
        : "workspace_slug";
      const metadata = table === "signal_timeline_schema_migrations";
      const where = bystanderOnly && !metadata ? ` WHERE ${column}='${column === "publication_id" ? "pub-b" : "b"}'` : "";
      const rows = (await client.execute(`SELECT * FROM "${table}"${where}`)).rows;
      result[table] = { count: rows.length, sha256: sha(rows.map(r => JSON.stringify(r)).sort()) };
    }
    return result;
  }
  return { client, db, gdpr, tables, snapshot, cleanup() {
    client.close();
    try { rmSync(directory, { recursive: true, force: true }); }
    catch (error) {
      // Same libSQL post-close Windows handle boundary as memory-test-db.ts.
      // Cleanup happens only after the awaited test; never mask its assertions.
      if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  } };
}

for (const foreignKeys of [true, false]) {
  test(`Timeline erasure removes all owned children and binding states; bystander/idempotence/Clerk identity (FK ${foreignKeys})`, async () => {
    const f = await fixture(foreignKeys);
    try {
      assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
      const before = await f.snapshot();
      const bystander = await f.snapshot(true);
      assert.equal(Object.keys(before).length, 15, "actual normalized baseline plus owning ledger");
      assert.ok(Object.values(before).every(t => t.count > 0));
      assert.deepEqual(await f.gdpr.eraseForUser("tasks-a-active"), { ok: true });
      assert.deepEqual(await f.snapshot(), before, "a Tasks project id is not Timeline owner identity");
      if (!foreignKeys) {
        // FK-off legacy orphan still has an exact owning workspace.
        await f.client.execute("PRAGMA foreign_keys=OFF");
        await f.client.execute("INSERT INTO subtasks(id,task_id,workspace_slug,title) VALUES ('orphan','missing','a-active','Synthetic orphan')");
      }
      const exportedB = await f.gdpr.exportForUser("clerk-b");
      const exportHash = sha(exportedB);
      assert.doesNotMatch(JSON.stringify(exportedB), /tokenHash|sessionHash|leaseToken/);
      assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
      assert.deepEqual(await f.snapshot(), bystander, "every table retains exactly the bystander's rows and migration ledger");
      assert.equal(sha(await f.gdpr.exportForUser("clerk-b")), exportHash);
      assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
      assert.deepEqual(await f.gdpr.eraseForUser("absent-clerk"), { ok: true });
      assert.deepEqual(await f.snapshot(), bystander);
      assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
      assert.equal((await f.client.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
    } finally { f.cleanup(); }
  });

  test(`late Timeline delete failure rolls back all prior child sweeps and permits retry (FK ${foreignKeys})`, async () => {
    const f = await fixture(foreignKeys);
    try {
      const before = await f.snapshot();
      const bystander = await f.snapshot(true);
      await f.client.execute("CREATE TRIGGER synthetic_late_failure BEFORE DELETE ON projects WHEN OLD.workspace_slug='a-retired' BEGIN SELECT RAISE(ABORT,'synthetic-late-delete-failure'); END");
      const result = await f.gdpr.eraseForUser("clerk-a");
      assert.equal(result.ok, false);
      assert.deepEqual(await f.snapshot(), before, "failed erasure must retain all rows, including token/session custody");
      await f.client.execute("DROP TRIGGER synthetic_late_failure");
      assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
      assert.deepEqual(await f.snapshot(), bystander);
    } finally { f.cleanup(); }
  });

  test(`verified pre-0001 tables remain erasable with explicit child cleanup (FK ${foreignKeys})`, async () => {
    const f = await fixture(foreignKeys, true);
    try {
      assert.equal(f.tables.length, 12);
      const bystander = await f.snapshot(true);
      assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
      assert.deepEqual(await f.snapshot(), bystander);
      assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    } finally { f.cleanup(); }
  });
}

test("Timeline ownership selection and metadata failure occur inside the owning transaction; operational failure never means legacy absence", async () => {
  const f = await fixture(true);
  try {
    const before = await f.snapshot();
    let metadataRead = false;
    const guarded = new Proxy(f.db, {
      get(target, property) {
        if (property === "select") throw Error("Owner/ID selection escaped the erasure transaction");
        if (property === "transaction") return (operation: Parameters<Database["transaction"]>[0]) => target.transaction(tx => operation(new Proxy(tx, {
          get(inner, key) {
            if (key === "all") return async () => { metadataRead = true; throw Error("synthetic metadata read unavailable"); };
            const value = Reflect.get(inner, key);
            return typeof value === "function" ? value.bind(inner) : value;
          },
        })));
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const gdpr = load<typeof import("./timeline-gdpr")>("./timeline-gdpr.ts", guarded);
    assert.equal((await gdpr.eraseForUser("clerk-a")).ok, false);
    assert.equal(metadataRead, true);
    assert.deepEqual(await f.snapshot(), before);
  } finally { f.cleanup(); }
});

test("partial normalized schema is not accepted as the pre-0001 compatibility mode", async () => {
  const f = await fixture(false);
  try {
    await f.client.execute("DROP TABLE timeline_source_sync_state");
    const before = sha((await f.client.execute("SELECT * FROM workspaces")).rows);
    assert.equal((await f.gdpr.eraseForUser("clerk-a")).ok, false);
    assert.equal(sha((await f.client.execute("SELECT * FROM workspaces")).rows), before);
    assert.equal(Number((await f.client.execute("SELECT count(*) n FROM subtasks")).rows[0].n), 4);
  } finally { f.cleanup(); }
});

test("held sync lease loses its compare-and-set after erasure without recreating state", async () => {
  const f = await fixture(true);
  try {
    const sync = load<typeof import("./sync/sync-state")>("./sync/sync-state.ts", f.db);
    const lease = await sync.acquireSyncLease({ tasksWorkspaceId: "tasks-a-active", timelineWorkspaceSlug: "a-active", timelineSlug: "plan" });
    assert.ok(lease);
    assert.deepEqual(await f.gdpr.eraseForUser("clerk-a"), { ok: true });
    const after = await f.snapshot();
    assert.equal(await f.db.transaction(tx => sync.commitSyncGeneration(tx, lease, { status: "complete", sourceCount: 1, importedCount: 1 })), false);
    assert.deepEqual(await f.snapshot(), after);
  } finally { f.cleanup(); }
});

test("normalized names occupied by views are not exact legacy absence", async () => {
  const f = await fixture(true, true);
  try {
    await f.client.executeMultiple("CREATE VIEW suite_project_bindings AS SELECT 1; CREATE VIEW timeline_source_sync_state AS SELECT 1;");
    const before = await f.snapshot();
    assert.equal((await f.gdpr.eraseForUser("clerk-a")).ok, false);
    assert.deepEqual(await f.snapshot(), before);
  } finally { f.cleanup(); }
});
