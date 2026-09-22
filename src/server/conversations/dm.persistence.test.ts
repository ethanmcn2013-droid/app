import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { assertProjectId } from "@/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createConversationService } from "./service";

const projectId = assertProjectId("dm_project");
async function fixture() {
  const root=resolve(process.env.PC10_WORK_DIR ?? tmpdir()); await mkdir(root,{recursive:true});
  const directory=await mkdtemp(join(root,"signal-pc10-"));
  const client=createClient({url:`file:${join(directory,"tasks.db").replaceAll("\\","/")}`});
  await client.execute("PRAGMA foreign_keys=OFF");
  for(const migration of (await readdir("drizzle")).filter((name)=>/^\d{4}_.+\.sql$/.test(name)&&name>="0014_").sort())
    await client.executeMultiple(await readFile(join("drizzle",migration),"utf8"));
  const now=Date.now();
  for(const [id,name] of [["alice","Alice"],["bob","Bob"],["mallory","Mallory"]])
    await client.execute({sql:"INSERT INTO users(id,clerk_id,name,color,initials) VALUES(?,?,?,?,?)",args:[id,`clerk_${id}`,name,"#111",name[0]+name[0]]});
  await client.execute({sql:"INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES(?,'dm-project','DM Project','alice','project',?,?)",args:[projectId,now,now]});
  for(const [id,role] of [["alice","owner"],["bob","member"],["mallory","member"]])
    await client.execute({sql:"INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,?,?)",args:[projectId,id,role,now]});
  const adapter=createLocalConversationDatabaseAdapter({client});
  return {client,service:createConversationService(adapter),adapter};
}
const request=(service:ReturnType<typeof createConversationService>,actorId="alice",recipientId="bob",clientRequestId="dm_request_0000001") =>
  service.requestDirectMessage({actorId,projectId,recipientId,clientRequestId});
test("disabled DM service refuses direct bypass while Project rooms remain available",async()=>{
  const f=await fixture(); try {
    const made=await request(f.service); assert.equal(made.ok,true); if(!made.ok) return;
    const conversationId=made.value.scope.conversationId;
    const gated=createConversationService(f.adapter,{directMessagesEnabled:false});
    assert.deepEqual(await gated.getDirectMessage({actorId:"alice",projectId,conversationId}),{ok:false,code:"unavailable"});
    assert.deepEqual(await gated.listDirectMessages({actorId:"alice",projectId}),{ok:false,code:"unavailable"});
    assert.deepEqual(await gated.requestDirectMessage({actorId:"alice",projectId,recipientId:"bob",clientRequestId:"dm_request_disabled_1"}),{ok:false,code:"unavailable"});
    assert.deepEqual(await gated.getMessagePage({actorId:"alice",projectId,conversationId}),{ok:false,code:"unavailable"});
    assert.deepEqual(await gated.getHistory({actorId:"alice",projectId,conversationId,afterChangeSeq:0}),{ok:false,code:"unavailable"});
    assert.deepEqual(await gated.getReceipt({actorId:"alice",projectId,conversationId,clientRequestId:"dm_request_0000001"}),{ok:false,code:"unavailable"});
    assert.equal((await gated.ensureProjectConversation({actorId:"alice",projectId})).ok,true);
  } finally {f.client.close();}
});
async function transition(service:ReturnType<typeof createConversationService>,actorId:string,conversationId:string,operation:"accept"|"decline"|"block"|"unblock"|"leave"|"reopen",clientRequestId:string){
  const scope=await service.getDirectMessage({actorId,projectId,conversationId}); assert.equal(scope.ok,true); if(!scope.ok) throw new Error("scope");
  return service.transitionDirectMessage({actorId,projectId,conversationId,operation,clientRequestId,expectedAudienceEpoch:scope.value.audienceEpoch});
}
async function scalar(client:Client,sql:string,args:(string|number|null)[]=[]){const row=(await client.execute({sql,args})).rows[0];return row?.value ?? row?.n;}

test("one sorted Project pair requires recipient consent and decline never creates another request",async()=>{
  const f=await fixture(); try {
    const [first,reversed]=await Promise.all([request(f.service),request(f.service,"bob","alice","dm_request_0000002")]);
    assert.equal([first,reversed].filter((r)=>r.ok).length,1);
    assert.equal(Number(await scalar(f.client,"SELECT COUNT(*) AS n FROM conversations WHERE kind='dm'")),1);
    const made=first.ok?first:reversed; if(!made.ok) throw new Error("pair");
    const conversationId=made.value.scope.conversationId;
    const pending=await f.service.sendMessage({actorId:"alice",input:{projectId,conversationId,clientRequestId:"dm_body_pending_001",expectedAudienceEpoch:made.value.scope.audienceEpoch,body:"must not persist",rootId:null,mentionUserIds:[]}});
    assert.deepEqual(pending,{ok:false,code:"consent_required"});
    assert.equal(Number(await scalar(f.client,"SELECT COUNT(*) AS n FROM conversation_messages")),0);
    const recipient=made.value.scope.requesterId==="alice"?"bob":"alice";
    const declined=await transition(f.service,recipient,conversationId,"decline","dm_decline_000001"); assert.equal(declined.ok,true);
    assert.deepEqual(await request(f.service,made.value.scope.requesterId,recipient,"dm_request_after_decline"),{ok:false,code:"read_only"});
    assert.equal(Number(await scalar(f.client,"SELECT COUNT(*) AS n FROM conversations WHERE kind='dm'")),1);
  } finally {f.client.close();}
});

test("active exact pair sends, roots expose reply counts, threads normalize to first level",async()=>{
  const f=await fixture(); try {
    const made=await request(f.service); if(!made.ok) throw new Error("pair"); const id=made.value.scope.conversationId;
    const accepted=await transition(f.service,"bob",id,"accept","dm_accept_0000001"); if(!accepted.ok) throw new Error("accept");
    const send=async(clientRequestId:string,rootId:string|null,body:string)=>f.service.sendMessage({actorId:"alice",input:{projectId,conversationId:id,clientRequestId,expectedAudienceEpoch:(await f.service.getDirectMessage({actorId:"alice",projectId,conversationId:id}) as Extract<Awaited<ReturnType<typeof f.service.getDirectMessage>>,{ok:true}>).value.audienceEpoch,body,rootId,mentionUserIds:[]}});
    const root=await send("dm_send_root_00001",null,"Root"); if(!root.ok) throw new Error("root");
    const reply=await send("dm_send_reply_0001",root.value.messageId,"Reply"); if(!reply.ok) throw new Error("reply");
    assert.deepEqual(await send("dm_nested_reply_001",reply.value.messageId,"Nested"),{ok:false,code:"invalid_input"});
    const roots=await f.service.getMessagePage({actorId:"bob",projectId,conversationId:id});
    assert.equal(roots.ok&&roots.value.messages.length,1); assert.equal(roots.ok&&roots.value.messages[0].replyCount,1);
    const thread=await f.service.getMessagePage({actorId:"bob",projectId,conversationId:id,rootId:root.value.messageId});
    assert.deepEqual(thread.ok&&thread.value.messages.map((m)=>m.body),["Root","Reply"]);
    const delta=await f.service.getHistory({actorId:"bob",projectId,conversationId:id,afterChangeSeq:reply.value.changeSeq-1});
    assert.deepEqual(delta.ok&&delta.value.messages.map((m)=>m.id),[root.value.messageId,reply.value.messageId]);
    assert.deepEqual(await f.service.getMessagePage({actorId:"mallory",projectId,conversationId:id}),{ok:false,code:"unavailable"});
    assert.equal(Number(await scalar(f.client,"SELECT COUNT(*) AS n FROM conversation_outbox WHERE recipient_id='bob'")),2);
  } finally {f.client.close();}
});

test("block owner, membership churn, and two fresh confirmations preserve restrictive state and retained history",async()=>{
  const f=await fixture(); try {
    const made=await request(f.service); if(!made.ok) throw new Error("pair"); const id=made.value.scope.conversationId;
    await transition(f.service,"bob",id,"accept","dm_accept_0000002");
    const before=await f.service.getDirectMessage({actorId:"alice",projectId,conversationId:id}); if(!before.ok) throw new Error("scope");
    await f.service.sendMessage({actorId:"alice",input:{projectId,conversationId:id,clientRequestId:"dm_retained_body_01",expectedAudienceEpoch:before.value.audienceEpoch,body:"Retained",rootId:null,mentionUserIds:[]}});
    const blocked=await transition(f.service,"bob",id,"block","dm_block_00000001"); assert.equal(blocked.ok,true);
    assert.deepEqual(await transition(f.service,"alice",id,"unblock","dm_wrong_unblock_01"),{ok:false,code:"read_only"});
    assert.equal((await f.service.getMessagePage({actorId:"alice",projectId,conversationId:id})).ok,true);
    await f.client.execute({sql:"DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'",args:[projectId]});
    assert.deepEqual(await f.service.getMessagePage({actorId:"alice",projectId,conversationId:id}),{ok:false,code:"unavailable"});
    assert.equal((await f.service.getMessagePage({actorId:"bob",projectId,conversationId:id})).ok,true);
    await f.client.execute({sql:"INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'alice','owner',?)",args:[projectId,Date.now()]});
    assert.equal((await f.service.getDirectMessage({actorId:"bob",projectId,conversationId:id}) as {ok:true;value:{pairState:string}}).value.pairState,"blocked");
    const unblocked=await transition(f.service,"bob",id,"unblock","dm_unblock_000001"); assert.equal(unblocked.ok&&unblocked.value.scope.pairState,"rejoin_pending");
    const stale=(await f.service.getDirectMessage({actorId:"alice",projectId,conversationId:id}) as {ok:true;value:{audienceEpoch:number}}).value.audienceEpoch;
    await transition(f.service,"alice",id,"reopen","dm_reopen_alice_01");
    assert.deepEqual(await f.service.transitionDirectMessage({actorId:"bob",projectId,conversationId:id,operation:"reopen",clientRequestId:"dm_reopen_stale_001",expectedAudienceEpoch:stale}),{ok:false,code:"audience_changed"});
    const reopened=await transition(f.service,"bob",id,"reopen","dm_reopen_bob_0001"); assert.equal(reopened.ok&&reopened.value.scope.pairState,"active");
  } finally {f.client.close();}
});

test("foreign-key-off guards reject third participants, pair mutation, and active state without consent",async()=>{
  const f=await fixture(); try {
    const made=await request(f.service); if(!made.ok) throw new Error("pair"); const id=made.value.scope.conversationId;
    await assert.rejects(f.client.execute({sql:"INSERT INTO conversation_participants(conversation_id,user_id,status,consented,retains_history) VALUES(?,'mallory','active',1,1)",args:[id]}),/invalid_dm_participant/);
    await assert.rejects(f.client.execute({sql:"UPDATE conversation_participants SET user_id='mallory' WHERE conversation_id=? AND user_id='bob'",args:[id]}),/immutable_dm_participant/);
    await assert.rejects(f.client.execute({sql:"UPDATE conversations SET pair_state='active' WHERE id=?",args:[id]}),/dm_consent_required/);
    await assert.rejects(f.client.execute("UPDATE workspace_members SET user_id='mallory' WHERE workspace_id='dm_project' AND user_id='bob'"),/dm_membership_key_immutable/);
  } finally {f.client.close();}
});

test("0034 preserves populated PC08 receipts, including a deleted-link receipt with no invented source",async()=>{
  const root=resolve(process.env.PC10_WORK_DIR ?? tmpdir()); await mkdir(root,{recursive:true});
  const directory=await mkdtemp(join(root,"signal-pc10-upgrade-"));
  const client=createClient({url:`file:${join(directory,"tasks.db").replaceAll("\\","/")}`});
  try {
    await client.execute("PRAGMA foreign_keys=OFF");
    for(const migration of (await readdir("drizzle")).filter((name)=>/^\d{4}_.+\.sql$/.test(name)&&name>="0014_"&&name<="0033_conversation_task_outcomes.sql").sort())
      await client.executeMultiple(await readFile(join("drizzle",migration),"utf8"));
    await client.execute("INSERT INTO users(id,name,color,initials) VALUES('upgrade_actor','Actor','#111','AA')");
    await client.execute("INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES('upgrade_project','upgrade','Upgrade','upgrade_actor','project',1,1)");
    await client.execute("INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES('upgrade_project','upgrade_actor','owner',1)");
    await client.execute("INSERT INTO conversations(id,workspace_id,kind,lifecycle,audience_epoch,next_create_seq,next_change_seq,created_by,created_at) VALUES('upgrade_room','upgrade_project','project','active',1,2,2,'upgrade_actor',1)");
    await client.execute("INSERT INTO conversation_messages(id,conversation_id,workspace_id,author_id,client_request_id,request_hash,create_seq,revision,body,created_at) VALUES('upgrade_message','upgrade_room','upgrade_project','upgrade_actor','upgrade_message_req','hash',1,1,'body',1)");
    for(const suffix of ["live","deleted"]){
      await client.execute({sql:"INSERT INTO tasks(id,workspace_id,title,lane,priority) VALUES(?, 'upgrade_project','Task','todo','normal')",args:[`task_${suffix}`]});
      await client.execute({sql:"INSERT INTO work_links(id,source_project_id,source_conversation_id,source_message_id,source_revision,source_audience_epoch,destination_project_id,task_id,created_by,created_at) VALUES(?,'upgrade_project','upgrade_room','upgrade_message',1,1,'upgrade_project',?,'upgrade_actor',1)",args:[`link_${suffix}`,`task_${suffix}`]});
      await client.execute({sql:"INSERT INTO work_operation_receipts(actor_id,client_request_id,operation,payload_hash,source_project_id,destination_project_id,task_id,work_link_id,committed_at) VALUES('upgrade_actor',?,'conversation_task','hash','upgrade_project','upgrade_project',?,?,1)",args:[`request_${suffix}`,`task_${suffix}`,`link_${suffix}`]});
    }
    await client.execute("DELETE FROM work_links WHERE id='link_deleted'");
    await client.executeMultiple(await readFile("drizzle/0034_project_direct_messages.sql","utf8"));
    const rows=await client.execute("SELECT client_request_id,source_conversation_id FROM work_operation_receipts ORDER BY client_request_id");
    assert.deepEqual(rows.rows.map((row)=>[row.client_request_id,row.source_conversation_id]),[["request_deleted",null],["request_live","upgrade_room"]]);
    await assert.rejects(client.execute("UPDATE work_operation_receipts SET source_project_id='changed'"),/immutable_work_operation_receipt/);
  } finally {client.close();}
});

test("departed actors cannot replay edit or delete receipts, while archive still permits block and leave",async()=>{
  const f=await fixture(); try {
    const made=await request(f.service); if(!made.ok) throw new Error("pair"); const id=made.value.scope.conversationId;
    const accepted=await transition(f.service,"bob",id,"accept","dm_mutation_accept_01"); if(!accepted.ok) throw new Error("accept");
    const sent=await f.service.sendMessage({actorId:"alice",input:{projectId,conversationId:id,clientRequestId:"dm_mutation_send_001",expectedAudienceEpoch:accepted.value.scope.audienceEpoch,body:"Original",rootId:null,mentionUserIds:[]}}); if(!sent.ok) throw new Error("send");
    const current=await f.service.getDirectMessage({actorId:"alice",projectId,conversationId:id}); if(!current.ok) throw new Error("scope");
    const edit={actorId:"alice",projectId,conversationId:id,messageId:sent.value.messageId,clientRequestId:"dm_mutation_edit_001",expectedRevision:1,expectedAudienceEpoch:current.value.audienceEpoch,body:"Edited",mentionUserIds:[]};
    assert.equal((await f.service.editMessage(edit)).ok,true);
    const afterEdit=await f.service.getDirectMessage({actorId:"alice",projectId,conversationId:id}); if(!afterEdit.ok) throw new Error("scope");
    const deletedSource=await f.service.sendMessage({actorId:"alice",input:{projectId,conversationId:id,clientRequestId:"dm_delete_send_0001",expectedAudienceEpoch:afterEdit.value.audienceEpoch,body:"Delete me",rootId:null,mentionUserIds:[]}}); if(!deletedSource.ok) throw new Error("send");
    const tombstone={actorId:"alice",projectId,conversationId:id,messageId:deletedSource.value.messageId,clientRequestId:"dm_mutation_delete01",expectedRevision:1,expectedAudienceEpoch:afterEdit.value.audienceEpoch};
    assert.equal((await f.service.tombstoneMessage(tombstone)).ok,true);
    await f.client.execute({sql:"UPDATE workspaces SET archived_at=? WHERE id=?",args:[Date.now(),projectId]});
    assert.equal((await transition(f.service,"bob",id,"block","dm_archive_block_001")).ok,true);
    assert.equal((await transition(f.service,"alice",id,"leave","dm_archive_leave_001")).ok,true);
    assert.deepEqual(await f.service.editMessage(edit),{ok:false,code:"unavailable"});
    assert.deepEqual(await f.service.tombstoneMessage(tombstone),{ok:false,code:"unavailable"});
  } finally {f.client.close();}
});
