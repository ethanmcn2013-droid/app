import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { createPingProofFixture } from "../proof-fixture";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { projectsBeingDeleted } from "@/server/projects/project-deletion-fence";
import { authorizeAssistantProject, getAssistantContext } from "./context";

async function fixture(count: number) {
  const proof = await createPingProofFixture();
  for (let i = 0; i < count; i++) {
    const id = `archived-${i}`;
    await proof.client.execute({ sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,archived_at) VALUES(?,?,?,'owner',1)", args: [id, id, id] });
    await proof.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,'alice','owner')", args: [id] });
  }
  return proof;
}

test("account catalog uses the same bounded SQL count for 1 and 100 archived Projects", async () => {
  const counts: number[] = [];
  for (const count of [1, 100]) {
    const proof = await fixture(count);
    const queries: string[] = [];
    // Attach only after all fixture setup: these are actual executed Drizzle statements.
    const database = drizzle(proof.client, { schema, logger: { logQuery(query) { queries.push(query); } } });
    try {
      const context = await database.transaction(tx => getAssistantContext(tx, "alice"));
      assert.equal(context.projects.filter(project => project.archivedAt !== null).length, count);
      assert.deepEqual(context.tasks, []);
      counts.push(queries.length);
      console.log(JSON.stringify({ archivedProjects: count, sqlQueryCount: queries.length, queries }));
      assert.ok(queries.length < 10);
    } finally { proof.client.close(); }
  }
  assert.equal(counts[0], counts[1]);
});

test("batched archived visibility matches authoritative authorization and retains active catalog semantics", async () => {
  const proof = await fixture(10);
  const database = drizzle(proof.client, { schema });
  try {
    await proof.client.execute("UPDATE workspace_members SET role='member' WHERE workspace_id='archived-0'");
    await proof.client.execute("UPDATE workspaces SET owner_user_id=NULL WHERE id='archived-1'");
    await proof.client.execute("INSERT INTO users(id,clerk_id,name,color,initials) VALUES('erased','exact-clerk','erased','#111','SS')");
    await proof.client.execute("UPDATE workspaces SET owner_user_id='erased' WHERE id='archived-2'");
    await proof.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'1')", args: [accountDeletionTombstoneKey('exact-clerk')] });
    await proof.client.execute("INSERT INTO users(id,name,color,initials) VALUES('erased-id','erased','#111','SS')");
    await proof.client.execute("UPDATE workspaces SET owner_user_id='erased-id' WHERE id='archived-3'");
    await proof.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'1')", args: [accountDeletionTombstoneKey('erased-id')] });
    for (const [i, status] of ['pending', 'running', 'retry_wait', 'manual_attention'].entries()) {
      await database.insert(schema.projectDriveOperations).values({ id: `delete-${i}`, workspaceId: `archived-${i+4}`, operationKind: 'project_delete', status: status as 'pending', dedupeKey: String(i).repeat(64), attemptCount: i ? 1 : 0, lastAttemptAt: i ? new Date() : null, leaseExpiresAt: status === "running" ? new Date(Date.now()+60000) : null, nextAttemptAt: status === "retry_wait" ? new Date(Date.now()+60000) : null, lastErrorCode: i > 1 ? "network_error" : null });
    }
    // An id-key marker must not erase an owner whose exact identity key is clerkId.
    await proof.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'1')", args: [accountDeletionTombstoneKey('owner')] });
    await proof.client.execute("PRAGMA foreign_keys=OFF");
    await proof.client.execute("UPDATE workspaces SET owner_user_id='missing-owner' WHERE id='archived-9'");
    const expected: string[] = [];
    for (let i = 0; i < 10; i++) {
      try { await database.transaction(tx => authorizeAssistantProject(tx, 'alice', `archived-${i}`, 'manageProject')); expected.push(`archived-${i}`); } catch { /* same unavailable catalog contract */ }
    }
    assert.deepEqual(await projectsBeingDeleted(database, ["archived-4", "archived-4"]), new Set(["archived-4"]));

    const context = await database.transaction(tx => getAssistantContext(tx, 'alice'));
    assert.deepEqual(context.projects.filter(project => project.archivedAt !== null).map(project => project.id), expected);
    assert.deepEqual(expected, ['archived-8']);
    assert.ok(context.projects.some(project => project.id === 'synthetic-ping-project'));
    assert.ok(context.projects.every(project => !('ownerUserId' in project)));
    await proof.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'1')", args: [accountDeletionTombstoneKey('clerk_alice')] });
    await assert.rejects(database.transaction(tx => getAssistantContext(tx, 'alice')), /unavailable/);
  } finally { proof.client.close(); }
});


test("selected archived Project exposes no task or roster content and malformed ids fail closed", async () => {
  const proof = await fixture(1);
  const database = drizzle(proof.client, { schema });
  try {
    const context = await database.transaction(tx => getAssistantContext(tx, "alice", "archived-0"));
    assert.deepEqual(context.project, { id: "archived-0", name: "archived-0", archived: true });
    assert.deepEqual(context.tasks, []);
    assert.deepEqual(context.members, []);
    await proof.client.execute("PRAGMA foreign_keys=OFF");
    await proof.client.execute("UPDATE workspace_members SET workspace_id='bad:id' WHERE workspace_id='archived-0'");
    await proof.client.execute("UPDATE workspaces SET id='bad:id' WHERE id='archived-0'");
    const catalog = await database.transaction(tx => getAssistantContext(tx, "alice"));
    assert.ok(!catalog.projects.some(project => project.id === "bad:id"));
  } finally { proof.client.close(); }
});
