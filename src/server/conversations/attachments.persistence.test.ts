import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { assertProjectId } from "@/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createConversationService } from "./service";
import { createConversationAttachmentService, type ConversationAttachmentScope } from "./attachments";
import { eraseConversationAttachmentsWith } from "./attachment-erasure";
import type { PersonalAttachmentStorage } from "./personal-chat-attachment-storage";
import { createConversationAttachmentHttp, createConversationAttachmentDownload } from "./attachment-http";
import { resolveConversationControls } from "@/lib/conversations/flags";
const projectId=assertProjectId("fixture_project");
const fileBytes=new TextEncoder().encode("Shared file\n");
async function fixture(withFiles=true, foreignKeys=false) {
 const client=createClient({url:":memory:"});
 await client.execute("PRAGMA foreign_keys=OFF");
 for(const name of (await readdir("drizzle")).filter(n=>/^\d{4}_.+\.sql$/.test(n)&&n>="0014_"&&(withFiles||n<"0047_")).sort())await client.executeMultiple(await readFile(`drizzle/${name}`,"utf8"));
 await client.executeMultiple("INSERT INTO users(id,clerk_id,name,color,initials) VALUES('a','clerk_a','A','#444','AA'),('b','clerk_b','B','#444','BB'),('c','clerk_c','C','#444','CC'); INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES('fixture_project','fixture','Fixture','a'),('other_project','other','Other','c'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('fixture_project','a','owner'),('fixture_project','b','member'),('other_project','c','owner');");
 if(foreignKeys)await client.execute("PRAGMA foreign_keys=ON");
 const bytes=new Map<string,Uint8Array>();let failDelete=false;let pendingWrite=false;
 const storage:PersonalAttachmentStorage={backend:()=>"disk",identity:()=>"fixture:disk",put:async(key,data,_mime,_backend,_identity,admission)=>{assert.equal(await admission.admit(),true);bytes.set(key,data);if(pendingWrite)throw new Error("uncertain PUT");return key},remove:async(_backend,key)=>{if(failDelete)throw new Error("delete unavailable");bytes.delete(key)}};
 const adapter=createLocalConversationDatabaseAdapter({client});
 const attachments=createConversationAttachmentService(adapter,{enabled:true,directMessagesEnabled:true,storage});
 const service=createConversationService(adapter,{directMessagesEnabled:true,attachmentsEnabled:true,attachmentCleanup:ownerId=>attachments.repair(ownerId)});
 const room=await service.ensureProjectConversation({actorId:"a",projectId});assert.ok(room.ok);if(!room.ok)throw Error("room");
 const scope:ConversationAttachmentScope={ownerId:"a",projectId,conversationId:room.value.conversationId,rootId:null,expectedAudienceEpoch:room.value.audienceEpoch};
 const upload=(request="upload_request_0001",overrides:Partial<typeof scope>={})=>attachments.upload({...scope,...overrides,clientRequestId:request,filename:"shared.txt",mimeType:"text/plain",bytes:fileBytes});
 const send=(ids:readonly string[]=[],request="message_request_001",overrides={})=>service.sendMessage({actorId:"a",input:{...scope,clientRequestId:request,body:ids.length?"":"Legacy text",mentionUserIds:[],attachmentIds:ids,...overrides}});
 return {client,adapter,attachments,service,scope,upload,send,bytes,storage,database:drizzle(client,{schema}),failDelete:()=>{failDelete=true},pendingWrite:()=>{pendingWrite=true}};
}

test("shared upload stays private, atomic send preserves ordered receipt/reload, peers can read only committed live messages",async()=>{
 const f=await fixture();try{
 const x=await f.upload(),y=await f.upload("upload_request_0002");assert.ok(x.ok&&y.ok);if(!x.ok||!y.ok)return;
 const ids=[y.value.attachment.id,x.value.attachment.id];assert.deepEqual(await f.attachments.read({ownerId:"b",id:ids[0]}),{ok:false,code:"unavailable"});
 const sent=await f.send(ids);assert.ok(sent.ok);if(!sent.ok)return;assert.deepEqual(sent.value.attachments?.map(x=>x.id),ids);
 assert.deepEqual(await f.send(ids),sent);assert.deepEqual(await f.send([...ids].reverse()),{ok:false,code:"request_conflict"});
 assert.deepEqual(await f.service.getReceipt({actorId:"a",...f.scope,clientRequestId:"message_request_001"}),{ok:true,value:{state:"committed",receipt:sent.value}});
 const page=await f.service.getMessagePage({actorId:"b",...f.scope});assert.ok(page.ok);assert.deepEqual(page.ok&&page.value.messages[0].attachments?.map(x=>x.id),ids);
 assert.equal((await f.attachments.read({ownerId:"b",id:ids[0]})).ok,true);assert.equal((await f.attachments.read({ownerId:"c",id:ids[0]})).ok,false);
 assert.equal((await f.attachments.cancel({ownerId:"a",id:ids[0]})).ok,false);
 const deleted=await f.service.tombstoneMessage({actorId:"a",...f.scope,messageId:sent.value.messageId,clientRequestId:"delete_request_0001",expectedRevision:1});assert.ok(deleted.ok);
 assert.equal((await f.attachments.read({ownerId:"b",id:ids[0]})).ok,false);assert.equal(f.bytes.size,0);
 }finally{f.client.close()}
});

test("claims reject foreign uploader/project/root/epoch, expiry and partial/duplicate binding",async()=>{
 const f=await fixture();try{
 const x=await f.upload();assert.ok(x.ok);if(!x.ok)return;const id=x.value.attachment.id;
 assert.equal((await f.upload("foreign_upload_001",{ownerId:"c"})).ok,false);
 assert.equal((await f.send([id,id])).ok,false);
 assert.equal((await f.service.sendMessage({actorId:"b",input:{...f.scope,body:"",clientRequestId:"foreign_send_0001",mentionUserIds:[],attachmentIds:[id]}})).ok,false);
 assert.equal((await f.send([id],"wrong_root_send01",{rootId:"missing_root"})).ok,false);
 await f.client.execute({sql:"UPDATE conversation_chat_attachments SET audience_epoch=audience_epoch+1 WHERE id=?",args:[id]});
 assert.equal((await f.send([id])).ok,false);
 await f.client.execute({sql:"UPDATE conversation_chat_attachments SET audience_epoch=?,workspace_id='other_project' WHERE id=?",args:[f.scope.expectedAudienceEpoch,id]});assert.equal((await f.send([id])).ok,false);
 await f.client.execute({sql:"UPDATE conversation_chat_attachments SET workspace_id=?,expires_at=1 WHERE id=?",args:[projectId,id]});assert.equal((await f.send([id])).ok,false);
 assert.equal((await f.client.execute("SELECT COUNT(*) n FROM conversation_messages")).rows[0].n,0);
 }finally{f.client.close()}
});

test("binding failure rolls back message, counters, changes and receipt",async()=>{
 const f=await fixture();try{const x=await f.upload();assert.ok(x.ok);if(!x.ok)return;
 await f.client.executeMultiple("CREATE TRIGGER fail_bind BEFORE UPDATE OF message_id ON conversation_chat_attachments BEGIN SELECT RAISE(ABORT,'injected_bind_failure'); END;");
 await assert.rejects(()=>f.send([x.value.attachment.id]),/injected_bind_failure/);
 for(const table of ["conversation_messages","conversation_receipts","conversation_changes"])assert.equal((await f.client.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n,0);
 assert.equal((await f.client.execute("SELECT next_create_seq n FROM conversations")).rows[0].n,1);
 }finally{f.client.close()}
});

test("old schema and gate off keep legacy hashes and ordinary text untouched",async()=>{
 const f=await fixture(false);try{const input={...f.scope,body:"Legacy text",clientRequestId:"legacy_request_001",mentionUserIds:[]};const textService=createConversationService(f.adapter);assert.ok((await textService.sendMessage({actorId:"a",input})).ok);
 const hash=createHash("sha256").update(JSON.stringify(["send","a",f.scope.conversationId,"Legacy text",null,[]])).digest("hex");assert.equal((await f.client.execute("SELECT request_hash FROM conversation_messages")).rows[0].request_hash,hash);
 assert.ok((await f.service.sendMessage({actorId:"a",input})).ok);assert.equal((await f.upload()).ok,false);assert.equal((await f.send([`ca_${"a".repeat(32)}`])).ok,false);
 }finally{f.client.close()}
});

for(const fk of [false,true])test(`0047 custody and erasure preserve bystanders and unsettled writers FK=${fk}`,async()=>{
 const f=await fixture(true,fk);try{const x=await f.upload();const peer=await f.upload("peer_upload_00001",{ownerId:"b"});assert.ok(x.ok&&peer.ok);if(!x.ok||!peer.ok)return;
 await f.send([x.value.attachment.id]);
 await eraseConversationAttachmentsWith(f.database,{ownerId:"a"},f.storage);assert.equal(f.bytes.size,1);assert.equal((await f.client.execute("SELECT owner_id FROM conversation_chat_attachments")).rows[0].owner_id,"b");
 f.pendingWrite();assert.equal((await f.upload("uncertain_upload01")).ok,false);await assert.rejects(()=>eraseConversationAttachmentsWith(f.database,{projectId},f.storage),/custody/);assert.equal((await f.client.execute("SELECT state FROM conversation_chat_attachments WHERE owner_id='a'")).rows[0].state,"cleanup");
 assert.equal((await f.client.execute("PRAGMA integrity_check")).rows[0].integrity_check,"ok");assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length,0);
 }finally{f.client.close()}
});

test("HTTP enforces exact scope fields, same origin, limits and authorized private download headers",async()=>{
 const f=await fixture();try{const controls=resolveConversationControls({SIGNAL_CONVERSATION_INTERNAL_ENABLED:"true",SIGNAL_CONVERSATION_SEND_ENABLED:"true",SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS:"a,b"});const handle=createConversationAttachmentHttp({authenticate:async()=>"a",controls:()=>controls,service:async()=>f.attachments});
 const form=()=>{const value=new FormData();value.set("file",new File([fileBytes],"shared.txt",{type:"text/plain"}));for(const [key,val]of Object.entries({...f.scope,clientRequestId:"http_upload_00001"})){if(key!=="ownerId")value.set(key,String(val??""))}return value};
 assert.equal((await handle(new Request("http://local/api/conversations/attachments",{method:"POST",headers:{origin:"http://evil"},body:form()}))).status,404);
 const forged=form();forged.set("ownerId","b");assert.equal((await handle(new Request("http://local/api/conversations/attachments",{method:"POST",headers:{origin:"http://local"},body:forged}))).status,400);
 const response=await handle(new Request("http://local/api/conversations/attachments",{method:"POST",headers:{origin:"http://local"},body:form()}));assert.equal(response.status,200);const data=await response.json();await f.send([data.attachment.id]);let opened=0;
 const download=createConversationAttachmentDownload({authenticate:async()=>"b",controls:()=>controls,service:async()=>f.attachments,open:async()=>{opened++;return new ReadableStream({start(c){c.enqueue(fileBytes);c.close()}})}});
 const file=await download(new Request("http://local"),{params:Promise.resolve({id:data.attachment.id})});assert.equal(file.status,200);assert.equal(file.headers.get("X-Content-Type-Options"),"nosniff");assert.match(file.headers.get("Cache-Control")!,/no-store/);assert.match(file.headers.get("Content-Disposition")!,/^attachment;/);assert.equal(opened,1);
 await f.client.execute("DELETE FROM workspace_members WHERE user_id='b'");assert.equal((await download(new Request("http://local"),{params:Promise.resolve({id:data.attachment.id})})).status,404);assert.equal(opened,1);
 }finally{f.client.close()}
});

test("DM files require consent, pin roots and recheck audience/membership before binding",async()=>{
 const f=await fixture();try{
 const request=await f.service.requestDirectMessage({actorId:"a",projectId,recipientId:"b",clientRequestId:"dm_request_000001"});assert.ok(request.ok);if(!request.ok)return;
 const pending={conversationId:request.value.scope.conversationId,expectedAudienceEpoch:request.value.scope.audienceEpoch};assert.equal((await f.upload("dm_pending_upload1",pending)).ok,false);
 const accepted=await f.service.transitionDirectMessage({actorId:"b",projectId,...pending,operation:"accept",clientRequestId:"dm_accept_0000001"});assert.ok(accepted.ok);if(!accepted.ok)return;
 const dm={conversationId:accepted.value.scope.conversationId,expectedAudienceEpoch:accepted.value.scope.audienceEpoch};
 const root=await f.send([],"dm_root_message01",{...dm,body:"DM root"});assert.ok(root.ok);if(!root.ok)return;
 const reply={...dm,rootId:root.value.messageId};const staged=await f.upload("dm_reply_upload01",reply);assert.ok(staged.ok);if(!staged.ok)return;
 assert.equal((await f.send([staged.value.attachment.id],"wrong_dm_root_001",dm)).ok,false);
 const sent=await f.send([staged.value.attachment.id],"dm_reply_message1",reply);assert.ok(sent.ok);
 assert.equal((await f.attachments.read({ownerId:"b",id:staged.value.attachment.id})).ok,true);
 const blocked=await f.service.transitionDirectMessage({actorId:"b",projectId,...dm,operation:"block",clientRequestId:"dm_block_00000001"});assert.ok(blocked.ok);
 assert.equal((await f.upload("dm_blocked_upload",dm)).ok,false);
 const projectClaim=await f.upload("epoch_upload_0001");assert.ok(projectClaim.ok);if(!projectClaim.ok)return;
 await f.client.execute({sql:"UPDATE conversations SET audience_epoch=audience_epoch+1 WHERE id=?",args:[f.scope.conversationId]});
 assert.equal((await f.send([projectClaim.value.attachment.id],"changed_epoch_001")).ok,false);
 assert.equal((await f.upload("epoch_stale_00001")).ok,false);
 await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='fixture_project' AND user_id='a'");assert.equal((await f.upload("revoked_upload01")).ok,false);
 }finally{f.client.close()}
});

for(const fk of [false,true])test(`0047 populated migration preserves Project/DM/personal hashes and rows FK=${fk}`,async()=>{
 const f=await fixture(false);try{
 const text=await f.send();assert.ok(text.ok);
 const dm=await f.service.requestDirectMessage({actorId:"a",projectId,recipientId:"b",clientRequestId:"migration_dm_0001"});assert.ok(dm.ok);if(!dm.ok)return;
 await f.service.transitionDirectMessage({actorId:"b",projectId,conversationId:dm.value.scope.conversationId,expectedAudienceEpoch:dm.value.scope.audienceEpoch,operation:"accept",clientRequestId:"migration_accept1"});
 await f.send([],"migration_dm_text1",{conversationId:dm.value.scope.conversationId,expectedAudienceEpoch:dm.value.scope.audienceEpoch,body:"DM text"});
 await f.client.execute("INSERT INTO personal_chat_messages(id,owner_id,client_request_id,request_hash,body,created_at) VALUES('personal_fixture','a','migration_private','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Saved note',1)");
 const before=JSON.stringify((await f.client.execute("SELECT * FROM conversation_messages ORDER BY id")).rows);const personal=JSON.stringify((await f.client.execute("SELECT * FROM personal_chat_messages")).rows);
 await f.client.execute(`PRAGMA foreign_keys=${fk?"ON":"OFF"}`);await f.client.executeMultiple(await readFile("drizzle/0047_conversation_chat_attachments.sql","utf8"));
 assert.equal(JSON.stringify((await f.client.execute("SELECT * FROM conversation_messages ORDER BY id")).rows),before);assert.equal(JSON.stringify((await f.client.execute("SELECT * FROM personal_chat_messages")).rows),personal);
 const receipt=JSON.parse(await readFile("drizzle/receipts/conversation-chat-attachments-2026-10-23.json","utf8"));for(const proof of receipt.migrations[0].proofs)assert.equal((await f.client.execute(proof.sql)).rows[0].value,proof.expected,proof.id);
 }finally{f.client.close()}
});

test("file limits/signature/quota/rate and erasure failure retain exact custody",async()=>{
 const f=await fixture();try{
 const base={...f.scope,clientRequestId:"limit_upload_0001",filename:"x.png",mimeType:"image/png",bytes:fileBytes};
 assert.deepEqual(await f.attachments.upload(base),{ok:false,code:"unsupported_file"});assert.deepEqual(await f.attachments.upload({...base,mimeType:"text/plain",bytes:new Uint8Array(2097153)}),{ok:false,code:"upload_too_large"});
 const claim=await f.upload();assert.ok(claim.ok);if(!claim.ok)return;
 assert.deepEqual(await f.attachments.upload({...f.scope,clientRequestId:"upload_request_0001",filename:"different.txt",mimeType:"text/plain",bytes:fileBytes}),{ok:false,code:"request_conflict"});
 f.failDelete();await assert.rejects(()=>eraseConversationAttachmentsWith(f.database,{ownerId:"a"},f.storage),/custody/);const retained=(await f.client.execute("SELECT state,storage_key,store_identity FROM conversation_chat_attachments")).rows[0];assert.equal(retained.state,"cleanup");assert.equal(retained.store_identity,"fixture:disk");assert.match(String(retained.storage_key),/^conversation-chat\//);assert.equal(f.bytes.size,1);
 }finally{f.client.close()}
});

test("gate-off tombstone keeps lifecycle cleanup active and staged files cannot follow deleted roots",async()=>{
 const f=await fixture();try{
 const upload=await f.upload();assert.ok(upload.ok);if(!upload.ok)return;const sent=await f.send([upload.value.attachment.id]);assert.ok(sent.ok);if(!sent.ok)return;
 const off=createConversationService(f.adapter,{attachmentsEnabled:false,attachmentCleanup:ownerId=>f.attachments.repair(ownerId)});
 assert.ok((await off.tombstoneMessage({actorId:"a",...f.scope,messageId:sent.value.messageId,clientRequestId:"off_delete_000001",expectedRevision:1})).ok);assert.equal(f.bytes.size,0);
 const root=await f.send([],"later_root_00001");assert.ok(root.ok);if(!root.ok)return;const reply=await f.upload("reply_staged_0001",{rootId:root.value.messageId});assert.ok(reply.ok);if(!reply.ok)return;
 await f.service.tombstoneMessage({actorId:"a",...f.scope,messageId:root.value.messageId,clientRequestId:"root_delete_00001",expectedRevision:1});assert.equal((await f.send([reply.value.attachment.id],"deleted_root_send",{rootId:root.value.messageId})).ok,false);
 }finally{f.client.close()}
});

test("cancelled claims, rate reservations and owner quota cannot bind or admit more files",async()=>{
 const f=await fixture();try{
 const x=await f.upload();assert.ok(x.ok);if(!x.ok)return;
 assert.ok((await f.attachments.cancel({ownerId:"a",id:x.value.attachment.id})).ok);assert.equal((await f.send([x.value.attachment.id])).ok,false);
 for(let i=1;i<10;i++)assert.ok((await f.upload(`rate_request_${String(i).padStart(8,"0")}`)).ok);
 assert.deepEqual(await f.upload("rate_request_limit01"),{ok:false,code:"rate_limited"});
 await f.client.execute("UPDATE conversation_chat_attachments SET created_at=1");
 await f.client.execute("UPDATE conversation_chat_attachments SET size_bytes=2097152 WHERE state='ready'");
 const original=(await f.client.execute("SELECT id FROM conversation_chat_attachments WHERE state='ready' LIMIT 1")).rows[0].id;
 for(let i=0;i<42;i++)await f.client.execute({sql:"INSERT INTO conversation_chat_attachments SELECT ?,owner_id,workspace_id,conversation_id,root_id,audience_epoch,message_id,position,?,request_hash,filename,mime_type,size_bytes,backend,store_identity,storage_key,stored_path,state,writer_settled,custody_until,expires_at,created_at FROM conversation_chat_attachments WHERE id=?",args:[`ca_${String(i).padStart(32,"0")}`,`quota_clone_${i}`,original]});
 assert.deepEqual(await f.upload("quota_request_limit1"),{ok:false,code:"quota_exceeded"});
 }finally{f.client.close()}
});
