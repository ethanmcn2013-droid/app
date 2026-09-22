import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { createClient } from "@libsql/client";
import { eraseAccountData } from "@/server/account-erasure";
import { exportAccountData } from "@/server/account-export";
import { freshFileDb } from "@/server/db/memory-test-db";

test("0036 upgrades populated conversation sources without losing peer rows or guards", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await client.execute("PRAGMA foreign_keys=OFF");
    for (const file of readdirSync("drizzle").filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_" && name < "0036_").sort())
      await client.executeMultiple(readFileSync(`drizzle/${file}`, "utf8"));
    await seed(client);
    await client.executeMultiple(readFileSync("drizzle/0036_conversation_erasure_tombstones.sql", "utf8"));
    assert.equal((await client.execute("PRAGMA integrity_check")).rows[0]?.integrity_check, "ok");
    assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    assert.equal((await client.execute("SELECT count(*) AS n FROM conversation_messages")).rows[0]?.n, 6);
    assert.equal((await client.execute("SELECT count(*) AS n FROM comments WHERE revision IS NOT NULL")).rows[0]?.n, 5);
    assert.equal((await client.execute("SELECT body FROM conversation_messages WHERE id='peer-reply'")).rows[0]?.body, "Peer reply survives");
    await assert.rejects(() => client.execute("UPDATE comments SET user_id=NULL,body=NULL,deleted_at=1,revision=2 WHERE id='target-comment'"), /invalid_task_comment_update/);
  } finally { client.close(); }
});

async function seed(client: Awaited<ReturnType<typeof freshFileDb>>["client"]) {
  await client.executeMultiple(`
    INSERT INTO users(id,clerk_id,name,color,initials) VALUES
      ('target','clerk_target','Target','#111','TA'),
      ('peer','clerk_peer','Peer','#222','PE');
    INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES
      ('owned','owned','Owned','target'),('shared','shared','Shared','peer'),('revoked','revoked','Revoked','peer');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES
      ('owned','target','owner'),('owned','peer','member'),
      ('shared','peer','owner'),('shared','target','member'),
      ('revoked','peer','owner'),('revoked','target','member');
    INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees) VALUES
      ('task-owned','owned',1,'Owned task','todo','p2','[]'),
      ('task-shared','shared',1,'Shared task','todo','p2','[]'),
      ('task-revoked','revoked',1,'Revoked task','todo','p2','[]');
    INSERT INTO conversations(id,workspace_id,kind,created_by,created_at) VALUES
      ('room-owned','owned','project','target',1000),
      ('room-shared','shared','project','target',1000),
      ('room-revoked','revoked','project','target',1000);
    INSERT INTO conversation_messages(id,conversation_id,workspace_id,author_id,client_request_id,request_hash,root_id,create_seq,revision,body,created_at) VALUES
      ('owned-message','room-owned','owned','target','owned_request_0001','owned-secret-hash',NULL,1,1,'Owned private body',1000),
      ('target-root','room-shared','shared','target','shared_request_0001','target-secret-hash',NULL,1,1,'Target private root',1000),
      ('peer-reply','room-shared','shared','peer','shared_request_0002','peer-hash','target-root',2,1,'Peer reply survives',2000),
      ('peer-root','room-shared','shared','peer','shared_request_0003','peer-root-hash',NULL,3,1,'Peer root survives',3000),
      ('target-reply','room-shared','shared','target','shared_request_0004','target-reply-hash','peer-root',4,1,'Target reply body',4000),
      ('revoked-message','room-revoked','revoked','target','revoked_request_1','revoked-hash',NULL,1,1,'Revoked private body',1000);
    INSERT INTO conversation_changes(conversation_id,change_seq,kind,message_id,revision,audience_epoch,happened_at) VALUES
      ('room-owned',1,'create','owned-message',1,1,1000),
      ('room-shared',1,'create','target-root',1,1,1000),
      ('room-shared',2,'create','peer-reply',1,1,2000),
      ('room-shared',3,'create','peer-root',1,1,3000),
      ('room-shared',4,'create','target-reply',1,1,4000),
      ('room-revoked',1,'create','revoked-message',1,1,1000);
    UPDATE conversations SET next_create_seq=5,next_change_seq=5 WHERE id='room-shared';
    UPDATE conversations SET next_create_seq=2,next_change_seq=2 WHERE id IN('room-owned','room-revoked');
    INSERT INTO conversation_receipts(conversation_id,actor_id,client_request_id,operation,payload_hash,message_id,create_seq,change_seq,revision,committed_at) VALUES
      ('room-shared','target','shared_request_0001','send','target-secret-hash','target-root',1,1,1,1000),
      ('room-shared','peer','shared_request_0002','send','peer-hash','peer-reply',2,2,1,2000);
    INSERT INTO conversation_attention(id,conversation_id,workspace_id,recipient_id,message_id,root_id,create_seq) VALUES
      ('attention-target','room-shared','shared','target','peer-reply','target-root',2),
      ('attention-peer','room-shared','shared','peer','target-root',NULL,1);
    INSERT INTO conversation_outbox(id,conversation_id,workspace_id,recipient_id,message_id,created_at) VALUES
      ('outbox-target','room-shared','shared','target','peer-reply',2000),
      ('outbox-peer','room-shared','shared','peer','target-root',1000);
    INSERT INTO task_discussion_state(task_id,workspace_id,next_create_seq,next_change_seq) VALUES
      ('task-owned','owned',2,2),('task-shared','shared',4,4),('task-revoked','revoked',2,2);
    INSERT INTO comments(id,workspace_id,task_id,user_id,body,client_request_id,request_hash,revision,root_id,create_seq) VALUES
      ('owned-comment','owned','task-owned','peer','Peer owned-Project comment','owned_comment_0001','peer-owned-hash',1,NULL,1),
      ('target-comment','shared','task-shared','target','Target Discussion root','shared_comment_01','target-comment-hash',1,NULL,1),
      ('peer-comment','shared','task-shared','peer','Peer Discussion reply','shared_comment_02','peer-comment-hash',1,'target-comment',2),
      ('target-comment-reply','shared','task-shared','target','Target Discussion reply','shared_comment_03','target-reply-hash',1,NULL,3),
      ('revoked-comment','revoked','task-revoked','target','Revoked Discussion','revoked_comment_1','revoked-comment-hash',1,NULL,1);
    INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms) VALUES
      ('task-owned',1,'create','owned-comment',1,1,1000),
      ('task-shared',1,'create','target-comment',1,1,1000),
      ('task-shared',2,'create','peer-comment',1,1,2000),
      ('task-shared',3,'create','target-comment-reply',1,1,3000),
      ('task-revoked',1,'create','revoked-comment',1,1,1000);
    INSERT INTO work_links(id,source_project_id,source_conversation_id,source_message_id,source_revision,source_audience_epoch,destination_project_id,task_id,created_by,created_at)
      VALUES('link-target','shared','room-shared','target-root',1,1,'shared','task-shared','target',1000);
    INSERT INTO work_operation_receipts(actor_id,client_request_id,operation,payload_hash,source_project_id,source_conversation_id,destination_project_id,task_id,work_link_id,committed_at)
      VALUES('target','work_request_0001','conversation_task','work-hash','shared','room-shared','shared','task-shared','link-target',1000);
    INSERT INTO suite_outbox(id,event_id,type,actor_user_id,workspace_id,object_ref,payload,trace_id,occurred_at)
      VALUES('event-target','event-target','task.created','target','shared','{"taskId":"task-shared","workLinkId":"link-target"}','{}','work_request_0001',1000);
  `);
}

test("subject export includes only current Project membership and subject-authored sources", async () => {
  const f = await freshFileDb();
  try {
    await seed(f.client);
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='revoked' AND user_id='target'");
    const data = await exportAccountData(f.db, "clerk_target");
    assert.deepEqual(data.footprintElsewhere?.collaboration.authoredProjectMessages.map((row) => row.id).sort(),
      ["owned-message", "target-reply", "target-root"]);
    assert.deepEqual(data.footprintElsewhere?.collaboration.authoredTaskDiscussion.map((row) => row.id).sort(),
      ["target-comment", "target-comment-reply"]);
    assert.deepEqual(data.footprintElsewhere?.collaboration.authoredWorkLinks.map((row) => row.id), ["link-target"]);
    assert.equal(data.footprintElsewhere?.authoredComments.some((row) => row.id === "revoked-comment"), false);
    assert.equal(data.ownedWorkspaces?.comments.some((row) => row.id === "owned-comment"), false);
    const serialized = JSON.stringify(data.footprintElsewhere?.collaboration);
    for (const forbidden of ["Peer reply survives", "Peer Discussion reply", "Revoked private body", "Revoked Discussion", "target-secret-hash", "work-hash"])
      assert.equal(serialized.includes(forbidden), false, `export leaked ${forbidden}`);
  } finally { f.cleanup(); }
});

for (const foreignKeys of [false, true]) test(`erasure preserves bystander replies and removes source identity with FK ${foreignKeys ? "ON" : "OFF"}`, async () => {
  const f = await freshFileDb();
  try {
    await seed(f.client);
    await f.client.execute(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"}`);
    await f.client.executeMultiple(`
      INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees)
        VALUES('task-peer','shared',2,'Peer task','todo','p2','[]');
      INSERT INTO work_links(id,source_project_id,source_conversation_id,source_message_id,source_revision,source_audience_epoch,destination_project_id,task_id,created_by,created_at)
        VALUES('peer-link','shared','room-shared','peer-root',1,1,'shared','task-peer','peer',1000);
      INSERT INTO work_operation_receipts(actor_id,client_request_id,operation,payload_hash,source_project_id,source_conversation_id,destination_project_id,task_id,work_link_id,committed_at)
      VALUES('peer','peer_prior_task_loss','conversation_task','peer-retry-hash','shared','room-shared','shared','task-peer','peer-link',1000);
      DELETE FROM work_links WHERE id='peer-link';
    `);
    assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    await assert.rejects(() => f.client.execute("UPDATE conversation_messages SET author_id=NULL,body=NULL,deleted_at=1,client_request_id=NULL,request_hash=NULL,revision=2 WHERE id='target-root'"), /invalid_message_update/);
    await eraseAccountData(f.db, "clerk_target");
    assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    const messages = (await f.client.execute("SELECT id,author_id,body,client_request_id,request_hash,root_id FROM conversation_messages WHERE workspace_id='shared' ORDER BY create_seq")).rows;
    assert.equal(messages.length, 4);
    for (const row of messages.filter((row) => String(row.id).startsWith("target-"))) {
      assert.equal(row.author_id, null); assert.equal(row.body, null);
      assert.equal(row.client_request_id, null); assert.equal(row.request_hash, null);
    }
    assert.equal(messages.find((row) => row.id === "peer-reply")?.body, "Peer reply survives");
    assert.equal(messages.find((row) => row.id === "peer-reply")?.root_id, "target-root");
    const comments = (await f.client.execute("SELECT id,user_id,body,client_request_id,request_hash,root_id FROM comments WHERE task_id='task-shared' ORDER BY create_seq")).rows;
    assert.equal(comments.length, 3);
    assert.equal(comments.find((row) => row.id === "target-comment")?.user_id, null);
    assert.equal(comments.find((row) => row.id === "target-comment")?.body, null);
    assert.equal(comments.find((row) => row.id === "peer-comment")?.root_id, "target-comment");
    assert.equal(comments.find((row) => row.id === "peer-comment")?.body, "Peer Discussion reply");
    assert.equal((await f.client.execute("SELECT created_by FROM conversations WHERE id='room-shared'")).rows[0]?.created_by, null);
    for (const table of ["work_links", "suite_outbox", "conversation_attention", "conversation_outbox"])
      assert.equal(Number((await f.client.execute(`SELECT count(*) AS n FROM ${table} WHERE 1=1`)).rows[0]?.n ?? 0), 0, `${table} left private derivatives`);
    const retainedReceipts = (await f.client.execute("SELECT actor_id,client_request_id,payload_hash FROM work_operation_receipts")).rows;
    assert.deepEqual(retainedReceipts.map((row) => row.actor_id), ["peer"]);
    assert.equal(retainedReceipts[0]?.client_request_id, "peer_prior_task_loss");
    assert.equal(retainedReceipts[0]?.payload_hash, "peer-retry-hash");
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM conversation_receipts WHERE actor_id='target'")).rows[0]?.n, 0);
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM task_comment_receipts WHERE actor_id='target'")).rows[0]?.n, 0);
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM tasks WHERE id='task-shared'")).rows[0]?.n, 1);
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM workspaces WHERE id='owned'")).rows[0]?.n, 0);
    await assert.rejects(() => f.client.execute("UPDATE conversation_messages SET body='restored',author_id='peer',revision=3,deleted_at=NULL WHERE id='target-root'"));
    await eraseAccountData(f.db, "clerk_target");
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM conversation_messages WHERE workspace_id='shared'")).rows[0]?.n, 4);
  } finally { f.cleanup(); }
});
