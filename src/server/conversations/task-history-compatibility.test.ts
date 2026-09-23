import "../../test/register-server-only.mjs";

import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readExistingTaskHistory } from "./task-history-compatibility";

test("reader binds exact Clerk identity and current task-derived Project membership", async () => {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client);
  try {
    await client.batch([
      "CREATE TABLE users (id TEXT PRIMARY KEY, clerk_id TEXT UNIQUE, email TEXT, handle TEXT, name TEXT)",
      "CREATE TABLE workspaces (id TEXT PRIMARY KEY)",
      "CREATE TABLE workspace_members (workspace_id TEXT, user_id TEXT, PRIMARY KEY (workspace_id,user_id))",
      "CREATE TABLE tasks (id TEXT PRIMARY KEY, workspace_id TEXT)",
      "CREATE TABLE comments (id TEXT PRIMARY KEY, workspace_id TEXT, task_id TEXT, user_id TEXT, body TEXT, created_at INTEGER, revision INTEGER, deleted_at INTEGER, create_seq INTEGER)",
      "CREATE TABLE activities (id TEXT PRIMARY KEY, workspace_id TEXT, task_id TEXT, user_id TEXT, kind TEXT, created_at INTEGER)",
      "INSERT INTO users VALUES ('alice','clerk_alice','alice@example.test','alice','Alice')",
      "INSERT INTO users VALUES ('bob','clerk_bob','bob@example.test','bob','Bob')",
      "INSERT INTO workspaces VALUES ('project_a')",
      "INSERT INTO workspaces VALUES ('project_b')",
      "INSERT INTO workspace_members VALUES ('project_a','alice')",
      "INSERT INTO workspace_members VALUES ('project_b','bob')",
      "INSERT INTO tasks VALUES ('task_a','project_a')",
      "INSERT INTO comments VALUES ('visible','project_a','task_a','alice','kept',10,1,NULL,1)",
      "INSERT INTO comments VALUES ('quarantined','project_a','task_a','alice','hidden quarantine',11,NULL,NULL,NULL)",
      "INSERT INTO comments VALUES ('deleted','project_a','task_a','alice','hidden tombstone',12,2,99,2)",
      "INSERT INTO comments VALUES ('foreign','project_b','task_a','bob','hidden foreign',13,1,NULL,3)",
      "INSERT INTO activities VALUES ('valid_activity','project_a','task_a','alice','move',14)",
      "INSERT INTO activities VALUES ('foreign_activity','project_b','task_a','bob','move',15)",
      "INSERT INTO activities VALUES ('unknown_activity','project_a','task_a','alice','private_future_event',16)",
    ], "write");

    const visible = await readExistingTaskHistory(database, {
      clerkId: "clerk_alice", taskId: "task_a",
    });
    assert.deepEqual(visible, {
      taskId: "task_a",
      projectId: "project_a",
      comments: [{
        id: "visible", authorId: "alice", authorName: "Alice", body: "kept", createdAt: 10_000,
      }],
      activities: [{
        id: "valid_activity", authorId: "alice", authorName: "Alice", kind: "move", createdAt: 14_000,
      }],
    });

    assert.equal(await readExistingTaskHistory(database, {
      clerkId: "clerk_bob", taskId: "task_a",
    }), null);
    assert.equal(await readExistingTaskHistory(database, {
      clerkId: "alice", taskId: "task_a",
    }), null, "canonical id is not accepted as a Clerk-id fallback");

    await client.execute("DELETE FROM workspace_members WHERE workspace_id='project_a' AND user_id='alice'");
    assert.equal(await readExistingTaskHistory(database, {
      clerkId: "clerk_alice", taskId: "task_a",
    }), null);
  } finally {
    client.close();
  }
});
