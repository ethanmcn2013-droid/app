import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import { createPingProofFixture, PROOF_PROJECT } from '../proof-fixture';
import { createAssistantStore } from './store';
import { createAssistantService } from './service';
import { executeAssistantAction } from './actions';
import { bindAssistantPlanTargets } from './plan-targets';
import { assistantDriveFolderOperationId } from './drive-folder';
import { ASSISTANT_VERSION, parseAssistantPlan, type AssistantAction } from '@/lib/ping/assistant/contract';
import { assistantNeedsRecovery, assistantNavigationTarget, assistantPlanDescription } from '@/components/app/messages/ping-personal-assistant-client';
import { isAssistantDriveFolderHref } from '@/lib/ping/assistant/drive-folder';
import type { ProjectDriveSubfolderResult, ProjectDriveSubfolderBinding, projectDriveSubfolderServiceFromEnv } from '@/server/connections/project-drive-subfolders';

const action:AssistantAction={id:'folder',kind:'create_drive_subfolder',project:{kind:'current'},folderName:'Contracts'};
const request={requestId:'folder-request-001',text:'Create a Contracts folder',scope:{kind:'project' as const,projectId:PROOF_PROJECT},mode:'draft' as const};
async function fixture(extra:AssistantAction[]=[]){
  const proof=await createPingProofFixture(),database=drizzle(proof.client,{schema}),store=createAssistantStore(database);
  await proof.client.executeMultiple(`UPDATE workspace_members SET role='owner' WHERE workspace_id='${PROOF_PROJECT}' AND user_id='alice';
    INSERT INTO provider_connections(id,user_id,provider,provider_account_id,root_folder_id,refresh_token_cipher,scopes,connected_at) VALUES('folder-conn','owner','google_drive','private-account','private-root','synthetic','[]',1);
    INSERT INTO workspace_storage(id,workspace_id,connection_id,folder_id,folder_web_view_link) VALUES('folder-generation','${PROOF_PROJECT}','folder-conn','private-parent','https://drive.google.com/drive/folders/private-parent');`);
  let prepares=0,creates=0,mode:'ready'|'unknown'|'prepare_crash'|'receipt_crash'|'execute_crash'='ready';
  const bind:ProjectDriveSubfolderBinding={projectId:PROOF_PROJECT,actorUserId:'alice',storageGenerationId:'folder-generation',connectionId:'folder-conn',providerAccountId:'private-account',parentId:'private-parent',folderName:'Contracts'};
  const read=async(input:{operationId:string}):Promise<ProjectDriveSubfolderResult|null>=>{
    const [row]=await database.select().from(schema.projectDriveSubfolders).where(eq(schema.projectDriveSubfolders.id,input.operationId));
    return row?{operationId:row.id,status:row.status,folderName:row.folderName,folderUrl:row.status==='complete'?row.folderUrl:null}:null;
  };
  const folders:ReturnType<typeof projectDriveSubfolderServiceFromEnv>={bind:async()=>bind,read,readForHistory:read,
    retireUnattempted:async(input)=>{const [row]=await database.select().from(schema.projectDriveSubfolders).where(eq(schema.projectDriveSubfolders.id,input.operationId));if(!row)return true;if(row.createStarted)return false;await database.delete(schema.projectDriveSubfolders).where(eq(schema.projectDriveSubfolders.id,row.id));return true;},
    prepare:async(binding,id,guard)=>{prepares++;if(mode==='prepare_crash')throw Error('crash before domain prepare');
      await database.transaction(async tx=>{await guard?.(tx);await tx.insert(schema.projectDriveSubfolders).values({id,workspaceId:binding.projectId,actorUserId:binding.actorUserId,storageGenerationId:binding.storageGenerationId,connectionId:binding.connectionId,providerAccountId:binding.providerAccountId,parentId:binding.parentId,folderName:binding.folderName,status:'pending',createdAt:new Date()}).onConflictDoNothing();});return(await read({operationId:id}))!;},
    execute:async input=>{
      if(mode==='execute_crash'){await database.update(schema.projectDriveSubfolders).set({status:'unknown'}).where(eq(schema.projectDriveSubfolders.id,input.operationId));throw Error('crash before provider');}
      const [prior]=await database.select().from(schema.projectDriveSubfolders).where(eq(schema.projectDriveSubfolders.id,input.operationId));
      if(!prior.createStarted&&!input.recoveryOnly){await database.transaction(async tx=>{await input.assertMutationAllowed?.(tx);await tx.update(schema.projectDriveSubfolders).set({createStarted:true}).where(eq(schema.projectDriveSubfolders.id,input.operationId));});creates++;}
      await database.update(schema.projectDriveSubfolders).set(mode==='unknown'?{status:'unknown'}:{status:'complete',folderId:'canonical-child',folderUrl:'https://drive.google.com/drive/folders/canonical-child'}).where(eq(schema.projectDriveSubfolders.id,input.operationId));
      return(await read({operationId:input.operationId}))!;
    }};
  const service=createAssistantService({store,requireApproval:true,context:async()=>({actorName:'Alice',projectName:'Synthetic',projects:[{name:'Synthetic',canManageProject:true}],members:[],selectedTaskCount:0,previousTaskCount:0,referenceDate:'2026-10-23',timeZone:'UTC'}),
    planner:{plan:async()=>({plan:{version:ASSISTANT_VERSION,outcome:'plan',mode:'draft',actions:[action,...extra]}})},
    bindTargets:async(actorId,_request,plan)=>{const targets=await database.transaction(tx=>bindAssistantPlanTargets(tx,{actorId,plan,currentProjectId:PROOF_PROJECT}));return {...targets,folder:{...targets.folder,driveFolder:await folders.bind({projectId:PROOF_PROJECT,actorUserId:actorId,folderName:'Contracts'})}};},
    execute:input=>{if(mode==='receipt_crash')throw Error('crash before receipt');return executeAssistantAction({...input,driveFolders:folders,guardDriveFolderAttempt:async(tx)=>{
      const [run]=await (tx??database).select().from(schema.assistantRuns).where(eq(schema.assistantRuns.id,input.runId));
      if(run.cancelledAt!==null||run.executionAuthorizedAt===null)throw Error('cancelled');
    }});}});
  return {proof,database,store,service,get prepares(){return prepares;},get creates(){return creates;},mode:(next:typeof mode)=>{mode=next;}};
}

test('closed folder action refuses paths/created refs and describes inherited access without broad link permission',()=>{
  const plan=(folderName:string,project:unknown={kind:'current'})=>({version:ASSISTANT_VERSION,outcome:'plan',mode:'draft',actions:[{...action,folderName,project}]});
  assert.ok(parseAssistantPlan(plan('Contracts')));
  for(const name of ['', ' Contracts','a/b','a\\b','..','.', 'a\nb','x'.repeat(101)])assert.equal(parseAssistantPlan(plan(name)),null,name);
  assert.equal(parseAssistantPlan(plan('Contracts',{kind:'created',stepId:'new'})),null);
  assert.match(assistantPlanDescription(action),/existing folder access; there is no Undo/);
  for(const href of ['https://evil.test','https://drive.google.com.evil.test/drive/folders/a','https://drive.google.com/drive/folders/a?x=y','javascript:alert(1)'])assert.equal(isAssistantDriveFolderHref(href),false);
  assert.equal(isAssistantDriveFolderHref('https://drive.google.com/drive/folders/safe-child'),true);
  assert.match(readFileSync('src/components/app/messages/ping-personal-assistant.tsx','utf8'),/Open Drive folder/);
});

test('actual store/service plans first, keeps binding private, settles exact canonical receipt once',async()=>{
  const f=await fixture();try{
    const ready=await f.service.submit('alice',request);assert.equal(ready.status,'ready');assert.equal(f.prepares,0);assert.equal(f.creates,0);
    assert.ok(!JSON.stringify(ready).includes('private-parent'));assert.ok(!JSON.stringify(ready).includes('private-account'));
    const applied=await f.service.apply('alice',ready.id);assert.equal(applied.status,'completed');assert.equal(f.creates,1);
    assert.equal(applied.steps[0].result?.href,'https://drive.google.com/drive/folders/canonical-child');assert.equal(applied.steps[0].canUndo,false);
    assert.equal(assistantNavigationTarget('apply',applied),null);
    await f.service.apply('alice',ready.id);await f.service.resume('alice',ready.id);assert.equal(f.creates,1);
    const step=applied.steps[0],id=assistantDriveFolderOperationId('alice',ready.id,step.id);
    await assert.rejects(f.store.settleDriveFolderResult('bob',ready.id,step.id,{operationId:id,status:'complete',folderName:'Contracts',folderUrl:'https://evil.test'}));
    const unchanged=await f.store.settleDriveFolderResult('alice',ready.id,step.id,{operationId:id,status:'complete',folderName:'Forged',folderUrl:'https://evil.test'});
    assert.deepEqual(unchanged,step.result);
  }finally{f.proof.client.close();}
});

test('crash after assistant receipt but before domain prepare recovers original only on explicit Check status',async()=>{
  const f=await fixture();try{
    f.mode('prepare_crash');const ready=await f.service.submit('alice',request),partial=await f.service.apply('alice',ready.id);
    assert.equal(partial.status,'partial');assert.equal(partial.steps[0].result?.code,'drive_folder_pending');assert.equal(f.creates,0);assert.equal(assistantNeedsRecovery(partial),true);
    f.mode('ready');assert.equal((await f.service.resume('alice',ready.id)).status,'completed');assert.equal(f.creates,1);
  }finally{f.proof.client.close();}
});

test('unknown external creation retains pending receipt and resumes original marker without duplicate or replan',async()=>{
  const f=await fixture([{id:'open',kind:'open_project',project:{kind:'current'}}]);try{
    f.mode('unknown');const ready=await f.service.submit('alice',request),partial=await f.service.apply('alice',ready.id);assert.equal(partial.status,'partial');assert.equal(f.creates,1);assert.equal(partial.steps[1].status,'queued');
    await assert.rejects(f.store.settleDriveFolderResult('alice',ready.id,partial.steps[0].id,{operationId:assistantDriveFolderOperationId('alice',ready.id,partial.steps[0].id),status:'complete',folderName:'Contracts',folderUrl:'https://evil.test'}));
    await f.service.resume('alice',ready.id);assert.equal(f.creates,1);
    f.mode('ready');const recovered=await f.service.resume('alice',ready.id);assert.equal(recovered.status,'completed');assert.equal(f.creates,1);assert.equal(recovered.steps[1].status,'completed');
  }finally{f.proof.client.close();}
});

test('cancel after local receipt but before domain prepare proves no folder attempt and never creates on recovery',async()=>{
  const f=await fixture();try{
    f.mode('prepare_crash');const ready=await f.service.submit('alice',request);await f.service.apply('alice',ready.id);await f.service.cancel('alice',ready.id);
    f.mode('ready');const stopped=await f.service.resume('alice',ready.id);assert.equal(stopped.status,'cancelled');assert.equal(stopped.steps[0].result?.code,'drive_folder_cancelled');assert.equal(f.creates,0);
  }finally{f.proof.client.close();}
});

test('stale Project revision or lost management permission refuses before pending receipt/provider prepare',async()=>{
  for(const change of ['revision','role']){
    const f=await fixture();try{
      const ready=await f.service.submit('alice',request);
      await f.proof.client.execute(change==='revision'?`UPDATE workspaces SET revision=revision+1 WHERE id='${PROOF_PROJECT}'`:`UPDATE workspace_members SET role='member' WHERE workspace_id='${PROOF_PROJECT}' AND user_id='alice'`);
      const result=await f.service.apply('alice',ready.id);assert.equal(result.status,'partial');assert.equal(f.prepares,0);assert.equal(f.creates,0);
    }finally{f.proof.client.close();}
  }
});

test('lost terminal settlement response reads back exact original receipt and continues remaining approved work',async()=>{
  const f=await fixture([{id:'open',kind:'open_project',project:{kind:'current'}}]);try{
    const original=f.store.settleDriveFolderResult;let first=true;
    f.store.settleDriveFolderResult=async(...args)=>{const settled=await original(...args);if(first){first=false;throw Error('lost settled response');}return settled;};
    const ready=await f.service.submit('alice',request),result=await f.service.apply('alice',ready.id);
    assert.equal(result.status,'completed');assert.equal(result.steps[1].status,'completed');assert.equal(f.creates,1);
  }finally{f.proof.client.close();}
});

test('explicit recovery may fence and resume a folder-only crash before its local pending receipt',async()=>{
  const f=await fixture();try{
    const ready=await f.service.submit('alice',request);f.mode('receipt_crash');
    assert.equal((await f.service.apply('alice',ready.id)).status,'unknown');assert.equal(f.prepares,0);
    f.mode('ready');assert.equal((await f.service.resume('alice',ready.id)).status,'completed');assert.equal(f.creates,1);
  }finally{f.proof.client.close();}
});

test('cancel after domain prepare but before provider dispatch settles untouched custody without a create',async()=>{
  const f=await fixture();try{
    const ready=await f.service.submit('alice',request);f.mode('execute_crash');await f.service.apply('alice',ready.id);
    assert.equal(f.prepares,1);assert.equal(f.creates,0);
    await f.service.cancel('alice',ready.id);f.mode('ready');
    const stopped=await f.service.resume('alice',ready.id);assert.equal(stopped.steps[0].result?.code,'drive_folder_cancelled');assert.equal(f.creates,0);
    assert.equal((await f.database.select().from(schema.projectDriveSubfolders)).length,0);
    const next=await f.service.submit('alice',{...request,requestId:'folder-request-002'});
    assert.equal((await f.service.apply('alice',next.id)).status,'completed');assert.equal(f.creates,1);
    assert.equal((await f.service.resume('alice',ready.id)).steps[0].result?.code,'drive_folder_cancelled');assert.equal(f.creates,1);
  }finally{f.proof.client.close();}
});

test('provider receipt accepted before assistant settlement failure is recovered once from domain truth',async()=>{
  const f=await fixture();try{
    const original=f.store.settleDriveFolderResult;let broken=true;
    f.store.settleDriveFolderResult=async(...args)=>{if(broken)throw Error('crash before assistant settlement');return original(...args);};
    const ready=await f.service.submit('alice',request);assert.equal((await f.service.apply('alice',ready.id)).status,'partial');assert.equal(f.creates,1);
    broken=false;assert.equal((await f.service.resume('alice',ready.id)).status,'completed');assert.equal(f.creates,1);
  }finally{f.proof.client.close();}
});
