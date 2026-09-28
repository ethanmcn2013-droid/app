import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { beginAccountDeletionWith } from "../account-deletion-lifecycle";
import { ensureUserProvisionedWith } from "./ensure-user";
import * as schema from "./schema";

async function freshDb() {
  // The parent runner owns deletion only after this child process exits.
  const fixtureRoot = resolve(process.env.SIGNAL_PROVISION_FAST_TEST_ROOT ?? "");
  if (dirname(fixtureRoot) !== resolve(tmpdir()) ||
      !basename(fixtureRoot).startsWith("signal-provision-fast-run-")) throw new Error("Test runner fixture root required");
  const directory = mkdtempSync(join(fixtureRoot, "case-"));
  const client = createClient({url: pathToFileURL(join(directory, "provision.test.db")).href});
  const migrations = readdirSync(join(process.cwd(), "drizzle"))
    .filter(file => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_").sort();
  for (const migration of migrations) {
    await client.executeMultiple(readFileSync(join(process.cwd(), "drizzle", migration), "utf8"));
  }
  return {client, db: drizzle(client, {schema}), cleanup: () => {
    client.close();
  }};
}

function countStatements(database: ReturnType<typeof drizzle<typeof schema>>, failSelect?: {at: number; error: Error}) {
  const calls = {select: 0, run: 0};
  const counted = new Proxy(database, {get(target, key, receiver) {
    if (key !== "transaction") return Reflect.get(target, key, receiver);
    return (operation: (tx: typeof database) => Promise<boolean>, config: {behavior: "immediate"}) =>
      target.transaction(async tx => operation(new Proxy(tx, {get(inner, method, innerReceiver) {
        const original = Reflect.get(inner, method, innerReceiver);
        if (method !== "select" && method !== "run") return original;
        return (...args: unknown[]) => {
          calls[method]++;
          if (method === "select" && failSelect?.at === calls.select) throw failSelect.error;
          return Reflect.apply(original, inner, args);
        };
      }}) as unknown as typeof database), config);
  }});
  return {database: counted, calls};
}

test("complete warm account does only tombstone and completeness reads, with no writes", async () => {
  const f = await freshDb();
  try {
    const actor = "user_warm_complete";
    assert.equal(await ensureUserProvisionedWith(f.db, actor, "warm@example.test", "Warm", "Person"), true);
    // Any old no-op INSERT/UPDATE now aborts, including INSERT OR IGNORE.
    for (const table of ["users", "planning_periods", "workspaces", "workspace_members"]) {
      await f.client.execute(`CREATE TRIGGER fail_${table}_insert BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'unexpected insert'); END`);
    }
    for (const table of ["users", "workspaces"]) {
      await f.client.execute(`CREATE TRIGGER fail_${table}_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'unexpected update'); END`);
    }
    const counted = countStatements(f.db);
    assert.equal(await ensureUserProvisionedWith(counted.database, actor, "warm@example.test", "Warm", "Person"), true);
    assert.deepEqual(counted.calls, {select: 2, run: 0});
  } finally { f.cleanup(); }
});

test("partial profile and derived rows take original backfill path", async () => {
  const f = await freshDb();
  try {
    const actor = "user_partial_case";
    assert.equal(await ensureUserProvisionedWith(f.db, actor), true);
    await f.client.execute({sql: "UPDATE users SET name=NULL, email=NULL WHERE clerk_id=?", args: [actor]});
    await f.client.execute({sql: "DELETE FROM workspace_members WHERE user_id=?", args: [actor]});
    await f.client.execute({sql: "UPDATE workspaces SET planning_period_id=NULL WHERE owner_user_id=?", args: [actor]});
    await f.client.execute({sql: "DELETE FROM planning_periods WHERE owner_user_id=?", args: [actor]});
    const counted = countStatements(f.db);
    assert.equal(await ensureUserProvisionedWith(counted.database, actor, "restored@example.test", "Restored", "Person"), true);
    assert.ok(counted.calls.run >= 6, "partial account must execute the original write sequence");
    const row = await f.client.execute({sql: `SELECT u.name,u.email,u.initials,p.owner_user_id AS period_owner,
      w.planning_period_id,w.context_type,m.role FROM users u
      JOIN planning_periods p ON p.owner_user_id=u.id
      JOIN workspaces w ON w.owner_user_id=u.id
      JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id
      WHERE u.clerk_id=?`, args: [actor]});
    assert.deepEqual({...row.rows[0]}, {name: "Restored Person", email: "restored@example.test", initials: "RP",
      period_owner: actor, planning_period_id: "planning-ws-partial_case", context_type: "project", role: "owner"});
  } finally { f.cleanup(); }
});

test("each independently missing warm-row requirement enters the original fallback", async () => {
  const f = await freshDb();
  try {
    for (const kind of ["member", "period", "workspace", "name", "email", "planning", "updated"] as const) {
      const actor = `user_${kind}_isolate`;
      const tail = actor.slice(5, 17);
      const workspaceId = `ws-${tail}`;
      const periodId = `planning-${workspaceId}`;
      const profile = kind === "name" || kind === "email"
        ? ["isolate@example.test", "Isolated", "Person"] as const
        : [] as const;
      assert.equal(await ensureUserProvisionedWith(f.db, actor, ...profile), true, `${kind} setup`);
      if (kind === "member") {
        await f.client.execute({sql: "DELETE FROM workspace_members WHERE workspace_id=?", args: [workspaceId]});
      } else if (kind === "period") {
        await f.client.execute({sql: `INSERT INTO planning_periods(id,owner_user_id,name,context_type,timezone,position,revision)
          VALUES(?,?,'Custom','general','UTC',2000,1)`, args: [`custom-${tail}`, actor]});
        await f.client.execute({sql: "UPDATE workspaces SET planning_period_id=? WHERE id=?", args: [`custom-${tail}`, workspaceId]});
        await f.client.execute({sql: "DELETE FROM planning_periods WHERE id=?", args: [periodId]});
      } else if (kind === "workspace") {
        await f.client.execute({sql: "DELETE FROM workspaces WHERE id=?", args: [workspaceId]});
      } else if (kind === "name" || kind === "email") {
        await f.client.execute({sql: `UPDATE users SET ${kind}=NULL WHERE clerk_id=?`, args: [actor]});
      } else if (kind === "planning") {
        await f.client.execute({sql: "UPDATE workspaces SET planning_period_id=NULL WHERE id=?", args: [workspaceId]});
      } else {
        await f.client.execute({sql: "UPDATE workspaces SET updated_at=NULL WHERE id=?", args: [workspaceId]});
      }
      const counted = countStatements(f.db);
      assert.equal(await ensureUserProvisionedWith(counted.database, actor, ...profile), true, `${kind} replay`);
      assert.ok(counted.calls.run >= 1, `${kind} alone must miss the fast path`);
      const row = await f.client.execute({sql: `SELECT u.name,u.email,p.id AS derived_period,w.id AS workspace_id,
        w.planning_period_id,w.updated_at,m.user_id AS member_id
        FROM users u LEFT JOIN planning_periods p ON p.id=?
        LEFT JOIN workspaces w ON w.id=?
        LEFT JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id
        WHERE u.clerk_id=?`, args: [periodId, workspaceId, actor]});
      assert.equal(row.rows[0]?.derived_period, periodId, `${kind} derived period`);
      assert.equal(row.rows[0]?.workspace_id, workspaceId, `${kind} workspace`);
      assert.equal(row.rows[0]?.member_id, actor, `${kind} membership`);
      assert.equal(row.rows[0]?.planning_period_id, kind === "period" ? `custom-${tail}` : periodId, `${kind} period link`);
      assert.notEqual(row.rows[0]?.updated_at, null, `${kind} updated timestamp`);
      if (kind === "name") assert.equal(row.rows[0]?.name, "Isolated Person");
      if (kind === "email") assert.equal(row.rows[0]?.email, "isolate@example.test");
    }
  } finally { f.cleanup(); }
});

test("mapped internal ID and existing custom period link remain valid on warm entry", async () => {
  const f = await freshDb();
  try {
    const actor = "user_mapped_fast";
    const internal = "internal-mapped-fast";
    await f.client.execute({sql: "INSERT INTO users(id,clerk_id,color,initials) VALUES(?,?,'#123','MF')", args: [internal, actor]});
    assert.equal(await ensureUserProvisionedWith(f.db, actor, "mapped@example.test", "Mapped", "Person"), true);
    await f.client.execute({sql: `INSERT INTO planning_periods(id,owner_user_id,name,context_type,timezone,position,revision)
      VALUES('custom-period',?,'Custom','general','UTC',2000,1)`, args: [internal]});
    await f.client.execute({sql: "UPDATE workspaces SET planning_period_id='custom-period', archived_at=123 WHERE owner_user_id=?", args: [internal]});
    const counted = countStatements(f.db);
    assert.equal(await ensureUserProvisionedWith(counted.database, actor, "new-address@example.test", "Changed", "Name"), true);
    assert.deepEqual(counted.calls, {select: 2, run: 0});
    const rows = await f.client.execute({sql: `SELECT u.id,u.name,u.email,w.planning_period_id,w.archived_at,m.user_id
      FROM users u JOIN workspaces w ON w.owner_user_id=u.id
      JOIN workspace_members m ON m.workspace_id=w.id WHERE u.clerk_id=?`, args: [actor]});
    assert.equal(rows.rows[0]?.id, internal);
    assert.equal(rows.rows[0]?.name, "Mapped Person");
    assert.equal(rows.rows[0]?.email, "mapped@example.test");
    assert.equal(rows.rows[0]?.planning_period_id, "custom-period");
    assert.equal(rows.rows[0]?.archived_at, 123);
    assert.equal(rows.rows[0]?.user_id, internal);
    // The original INSERT OR IGNORE never upgrades an existing member role.
    await f.client.execute({sql: "UPDATE workspace_members SET role='member' WHERE user_id=?", args: [internal]});
    const memberReplay = countStatements(f.db);
    assert.equal(await ensureUserProvisionedWith(memberReplay.database, actor), true);
    assert.ok(memberReplay.calls.run >= 1, "non-owner member conservatively uses the original path");
    const member = await f.client.execute({sql: "SELECT role FROM workspace_members WHERE user_id=?", args: [internal]});
    assert.equal(member.rows[0]?.role, "member");
  } finally { f.cleanup(); }
});

test("a completeness query failure propagates without falling through to writes", async () => {
  const f = await freshDb();
  try {
    const actor = "user_query_failure";
    assert.equal(await ensureUserProvisionedWith(f.db, actor), true);
    const queryError = new Error("controlled completeness read failure");
    const counted = countStatements(f.db, {at: 2, error: queryError});
    await assert.rejects(ensureUserProvisionedWith(counted.database, actor), error => error === queryError);
    assert.deepEqual(counted.calls, {select: 2, run: 0});
    const persisted = await f.client.execute({sql: "SELECT count(*) AS n FROM users WHERE clerk_id=?", args: [actor]});
    assert.equal(persisted.rows[0]?.n, 1);
  } finally { f.cleanup(); }
});

test("owner, role and context mismatch conservatively miss without changing existing semantics", async () => {
  const f = await freshDb();
  try {
    const actor = "user_mismatch_case";
    assert.equal(await ensureUserProvisionedWith(f.db, actor), true);
    const workspaceId = "ws-mismatch_cas";
    const assertFallback = async () => {
      const counted = countStatements(f.db);
      assert.equal(await ensureUserProvisionedWith(counted.database, actor), true);
      assert.ok(counted.calls.run >= 1);
    };
    await f.client.execute({sql: "UPDATE workspace_members SET role='member' WHERE workspace_id=?", args: [workspaceId]});
    await assertFallback();
    assert.equal((await f.client.execute({sql: "SELECT role FROM workspace_members WHERE workspace_id=?", args: [workspaceId]})).rows[0]?.role, "member");
    await f.client.execute({sql: "UPDATE workspace_members SET role='owner' WHERE workspace_id=?", args: [workspaceId]});

    await f.client.execute({sql: "UPDATE workspaces SET context_type='class' WHERE id=?", args: [workspaceId]});
    await assertFallback();
    assert.equal((await f.client.execute({sql: "SELECT context_type FROM workspaces WHERE id=?", args: [workspaceId]})).rows[0]?.context_type, "class");
    await f.client.execute({sql: "UPDATE workspaces SET context_type='project' WHERE id=?", args: [workspaceId]});

    await f.client.execute("INSERT INTO users(id,clerk_id,color,initials) VALUES('other-owner','user_other_owner','#123','OO')");
    await f.client.execute({sql: "UPDATE workspaces SET owner_user_id='other-owner' WHERE id=?", args: [workspaceId]});
    await assertFallback();
    assert.equal((await f.client.execute({sql: "SELECT owner_user_id FROM workspaces WHERE id=?", args: [workspaceId]})).rows[0]?.owner_user_id, "other-owner");
  } finally { f.cleanup(); }
});

test("same handle prefix but distinct workspace IDs retains original collision error", async () => {
  const f = await freshDb();
  try {
    const first = "user_abcdefgh1111";
    const second = "user_abcdefgh2222";
    assert.equal(await ensureUserProvisionedWith(f.db, first), true);
    const counted = countStatements(f.db);
    await assert.rejects(ensureUserProvisionedWith(counted.database, second), /Clerk identity could not be provisioned/);
    assert.ok(counted.calls.run >= 1);
    const secondWorkspace = await f.client.execute("SELECT count(*) AS n FROM workspaces WHERE id='ws-abcdefgh2222'");
    assert.equal(secondWorkspace.rows[0]?.n, 0);
  } finally { f.cleanup(); }
});

test("derived-ID collision falls through and preserves the original failure and rollback", async () => {
  const f = await freshDb();
  try {
    const first = "user_sameprefix12_alpha";
    const second = "user_sameprefix12_bravo";
    assert.equal(await ensureUserProvisionedWith(f.db, first), true);
    const counted = countStatements(f.db);
    await assert.rejects(ensureUserProvisionedWith(counted.database, second), /Clerk identity could not be provisioned/);
    assert.ok(counted.calls.run >= 1, "collision must not be certified complete");
    const users = await f.client.execute("SELECT clerk_id FROM users ORDER BY clerk_id");
    assert.deepEqual(users.rows.map(row => row.clerk_id), [first]);
  } finally { f.cleanup(); }
});

test("failed fallback rolls back and a complete warm account still obeys tombstone first", async () => {
  const f = await freshDb();
  try {
    await f.client.execute(`CREATE TRIGGER fail_member_insert BEFORE INSERT ON workspace_members
      BEGIN SELECT RAISE(ABORT, 'member failure'); END`);
    await assert.rejects(ensureUserProvisionedWith(f.db, "user_rollback_case"), /workspace_members/);
    for (const table of ["users", "planning_periods", "workspaces", "workspace_members"]) {
      const result = await f.client.execute(`SELECT count(*) AS n FROM ${table}`);
      assert.equal(result.rows[0]?.n, 0, `${table} rolled back`);
    }
    await f.client.execute("DROP TRIGGER fail_member_insert");
    const actor = "user_deleted_warm";
    assert.equal(await ensureUserProvisionedWith(f.db, actor), true);
    await beginAccountDeletionWith(f.db, actor);
    const counted = countStatements(f.db);
    assert.equal(await ensureUserProvisionedWith(counted.database, actor), false);
    assert.deepEqual(counted.calls, {select: 1, run: 0});
  } finally { f.cleanup(); }
});
