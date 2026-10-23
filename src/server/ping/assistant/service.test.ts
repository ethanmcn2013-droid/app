import {test} from "node:test";
import assert from "node:assert/strict";
import type {AssistantActionResult,AssistantPlan,AssistantPlannerContext} from "@/lib/ping/assistant/contract";
import type {AssistantSource} from "@/lib/ping/assistant/release2";
import {createAssistantService} from './service';
import {assistantPayloadHash,createAssistantStore} from './store';
import {assistantFixture} from './store-fixture';
const context:AssistantPlannerContext={actorName:'Alice',projectName:'Synthetic',projects:[{name:'Synthetic'}],members:[{name:'Alice'}],selectedTaskCount:0,previousTaskCount:0,referenceDate:'2026-10-18',timeZone:'Europe/Dublin'};
const plan:AssistantPlan={version:'ping.assistant.v1',outcome:'plan',mode:'execute',actions:[{id:'one',kind:'open_project',project:{kind:'current'}}]};
const request={requestId:'request0001',text:'Open Synthetic',scope:{kind:'project' as const,projectId:'synthetic'},mode:'execute' as const};

test('completed folder history survives unrelated task edits and Undo but keeps receipt and source authority',async()=>{
 const f=await assistantFixture();let revision=1,projectAllowed=true,receiptAllowed=true,chatCurrent=true,effects=0;
 const task:AssistantSource={ref:'task_source_1',kind:'task',projectId:'synthetic',scopeId:'task1',itemId:'task1',revision:1,audienceEpoch:1,body:'Original task',authorName:'Signal task record',createdAt:'2026-10-18T09:00:00.000Z',href:'/app/tasks?task=task1',timeZone:'UTC'};
 const chat:AssistantSource={...task,ref:'source1',kind:'conversation',scopeId:'chat1',itemId:'message1',body:'Original conversation'};
 try{
  const service=createAssistantService({store:f.store,requireApproval:true,context:async()=>({...context,sources:[task,chat]}),
   validateSources:async(_actor,sources)=>sources.every(source=>source.kind==='task'?source.revision===revision:chatCurrent),
   authorizeView:async()=>projectAllowed,authorizeCompletedFolderResults:async()=>receiptAllowed,
   planner:{plan:async()=>({plan:{version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'folder',kind:'create_drive_subfolder',project:{kind:'current'},folderName:'Contracts'}]}})},
   execute:async input=>input.commitStep(input.stepId,input.fence,async()=>{effects++;return {stepId:input.stepId,kind:'create_drive_subfolder',status:'completed',projectId:'synthetic',affectedCount:1,code:'drive_folder_ready',summary:'Created Contracts.',href:'https://drive.google.com/drive/folders/child1'};})});
  const draft=await service.submit('alice',{...request,text:'Create Contracts folder'});
  const complete=await service.apply('alice',draft.id);assert.equal(complete.steps[0].result?.code,'drive_folder_ready');
  // Archive/edit changes updatedAt; Undo restores fields with another new updatedAt.
  for(revision of [2,3])assert.equal((await service.view('alice',draft.id)).steps[0].result?.code,'drive_folder_ready');
  assert.equal(effects,1);
  receiptAllowed=false;assert.equal((await service.view('alice',draft.id)).accessUnavailable,true);receiptAllowed=true;
  projectAllowed=false;assert.equal((await service.view('alice',draft.id)).accessUnavailable,true);projectAllowed=true;
  chatCurrent=false;assert.equal((await service.view('alice',draft.id)).accessUnavailable,true);chatCurrent=true;
  // Quoted answer sources must never inherit the planning-snapshot exception.
  await f.store.finishRun('alice',draft.id,'completed',{sources:[task]});
  assert.equal((await service.view('alice',draft.id)).accessUnavailable,true);
  await assert.rejects(service.view('bob',draft.id));
 }finally{await f.close();}
});

test('folder history exception cannot make a stale draft executable',async()=>{
 const f=await assistantFixture();let current=true,effects=0,receiptReads=0;
 const source:AssistantSource={ref:'task_source_1',kind:'task',projectId:'synthetic',scopeId:'task1',itemId:'task1',revision:1,audienceEpoch:1,body:'Task',authorName:'Signal task record',createdAt:'2026-10-18T09:00:00.000Z',href:'/app/tasks',timeZone:'UTC'};
 try{
  const service=createAssistantService({store:f.store,requireApproval:true,context:async()=>({...context,sources:[source]}),validateSources:async()=>current,
   authorizeCompletedFolderResults:async()=>{receiptReads++;return true;},planner:{plan:async()=>({plan:{version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'folder',kind:'create_drive_subfolder',project:{kind:'current'},folderName:'Contracts'}]}})},execute:async()=>{effects++;throw Error('must not execute');}});
  const draft=await service.submit('alice',{...request,text:'Create Contracts folder'});current=false;
  assert.equal((await service.view('alice',draft.id)).accessUnavailable,true);
  await assert.rejects(service.apply('alice',draft.id));assert.equal(effects,0);assert.equal(receiptReads,0);
 }finally{await f.close();}
});

test('draft readiness uses one durable result write and retains its authorized recovery metadata',async()=>{
 const f=await assistantFixture();let readyWrites=0,plans=0,effects=0,clock=1000;
 const source:AssistantSource={ref:'source1',kind:'conversation',projectId:'synthetic',scopeId:'chat_1',itemId:'message_1',revision:1,audienceEpoch:1,body:'The checklist is still open.',authorName:'Alice',createdAt:'2026-10-18T09:00:00.000Z',href:'/app/messages?projectId=synthetic&messageId=message_1'};
 try{
  const store={...f.store,async finishRun(...args:Parameters<typeof f.store.finishRun>){if(args[2]==='ready')readyWrites++;return f.store.finishRun(...args);}};
  const service=createAssistantService({store,requireApproval:true,now:()=>++clock,context:async()=>({...context,sources:[source]}),validateSources:async()=>true,
   authorizePlan:async()=>['authorized-target'],bindTargets:async()=>({one:{projectId:'synthetic',taskIds:[],taskHashes:{},priorActionIds:[],hasOpenChecklist:true}}),
   planner:{plan:async()=>{plans++;return {plan,model:'synthetic-sonnet'};}},execute:async()=>{effects++;throw Error('must wait for Apply');}});
  const draft=await service.submit('alice',request);
  assert.equal(draft.status,'ready');assert.equal(draft.mode,'draft');assert.equal(readyWrites,1);assert.equal(effects,0);
  assert.match(draft.message??'',/Draft prepared\. No actions were executed\./);assert.match(draft.message??'',/checklist items are still open/);
  assert.equal(draft.model,'synthetic-sonnet');assert.ok((draft.timing?.planningMs??0)>0);
  const saved=await f.store.getRun('alice',draft.id),metadata=JSON.parse(saved.resultJson!);
  assert.deepEqual(metadata.authorizationProjects,['authorized-target','synthetic']);assert.deepEqual(metadata.planSources,[source]);
  assert.equal(metadata.message,draft.message);assert.equal(metadata.model,draft.model);assert.deepEqual(metadata.timing,draft.timing);
  assert.doesNotMatch(JSON.stringify(draft),/authorizationProjects|authorized-target|planSources|message_1/);
  assert.deepEqual(await service.view('alice',draft.id),draft);
  await service.submit('alice',request);await service.resume('alice',draft.id);
  assert.equal(readyWrites,1);assert.equal(plans,1);assert.equal(effects,0);
 }finally{await f.close();}
});
test('execute is automatic; lost response lookup/repeated submit/resume never replans or reexecutes',async()=>{
 const f=await assistantFixture();let plans=0,effects=0;try{const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>{plans++;return {plan};}},execute:async input=>input.commitStep(input.stepId,input.fence,async()=>{effects++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Opened',affectedCount:0} as AssistantActionResult;})});
  const result=await service.submit('alice',request);assert.equal(result.status,'completed');assert.equal((await service.lookup('alice',request.requestId))?.id,result.id);
  await service.submit('alice',request);await service.resume('alice',result.id);assert.equal(plans,1);assert.equal(effects,1);assert.equal(await service.lookup('bob',request.requestId),null);
 }finally{await f.close();}
});
test('draft cannot execute through resume; explicit apply executes original plan once',async()=>{
 const f=await assistantFixture();let effects=0;try{const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:async input=>input.commitStep(input.stepId,input.fence,async()=>{effects++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Opened',affectedCount:0};})});
  const draft=await service.submit('alice',{...request,mode:'draft'});assert.equal(draft.status,'ready');await service.resume('alice',draft.id);assert.equal(effects,0);await service.apply('alice',draft.id);await service.apply('alice',draft.id);assert.equal(effects,1);
 }finally{await f.close();}
});
test('a known refusal preserves earlier committed results and blocks later actions',async()=>{
 const f=await assistantFixture();try{const multi={...plan,actions:[...plan.outcome==='plan'?plan.actions:[],{id:'two',kind:'open_project' as const,project:{kind:'current' as const}},{id:'three',kind:'open_project' as const,project:{kind:'current' as const}}]};let calls=0;
  const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan:multi})},execute:async input=>{calls++;if(input.step.id==='two')throw Object.assign(Error('no authority'),{code:'unavailable'});return input.commitStep(input.stepId,input.fence,async()=>({stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Opened',affectedCount:0}));}});
  const result=await service.submit('alice',request);assert.equal(result.status,'partial');assert.equal(calls,2);assert.deepEqual(result.steps.map(s=>s.status),['completed','blocked','queued']);await service.resume('alice',result.id);assert.equal(calls,2);
 }finally{await f.close();}
});
test('unknown execution is preserved and never auto-retried; cancellation remains available',async()=>{
 const f=await assistantFixture();let effects=0;try{const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:async()=>{effects++;throw Error('lost boundary');}});
  const result=await service.submit('alice',request);assert.equal(result.status,'unknown');await service.resume('alice',result.id);assert.equal(effects,1);assert.equal((await service.cancel('alice',result.id)).status,'cancelled');
 }finally{await f.close();}
});
test('planner-requested draft also cannot execute until explicit apply; access changes redact stored result objects',async()=>{
 const f=await assistantFixture();let effects=0,allowed=true;try{const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan:{...plan,mode:'draft'} as AssistantPlan})},authorizeView:async()=>allowed,
  execute:async input=>input.commitStep(input.stepId,input.fence,async()=>{effects++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Private project result',affectedCount:0,projectId:'synthetic',href:'/app/tasks?workspaceId=synthetic'};})});
  const draft=await service.submit('alice',request);assert.equal(draft.mode,'draft');await service.resume('alice',draft.id);assert.equal(effects,0);const completed=await service.apply('alice',draft.id);assert.equal(effects,1);assert.ok(completed.steps[0].result?.projectId);
  allowed=false;const redacted=await service.view('alice',draft.id);assert.equal(redacted.steps[0].result,null);assert.match(redacted.message??'',/Access changed/);assert.equal(redacted.text,request.text);
 }finally{await f.close();}
});
test('unknown returned delivery remains partial even without a sidecar; committed lost responses recover without retry',async()=>{
 const f=await assistantFixture();try{
  let calls=0;const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:async input=>{calls++;return input.commitStep(input.stepId,input.fence,async()=>({stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Local notification saved',affectedCount:1,delivery:{queued:0,accepted:0,unknown:1,suppressed:0}}));}});
  const partial=await service.submit('alice',request);assert.equal(partial.status,'partial');await service.resume('alice',partial.id);assert.equal(calls,1);
  let lostCalls=0;const lost=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:async input=>{lostCalls++;await input.commitStep(input.stepId,input.fence,async()=>({stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Committed once',affectedCount:1}));throw Error('Response lost after commit');}});
  const recovered=await lost.submit('alice',{...request,requestId:'request0002'});assert.equal(recovered.status,'completed');assert.equal(lostCalls,1);
 }finally{await f.close();}
});
test('follow-up previous tasks are frozen at planning and not exposed as IDs in planner context',async()=>{
 const f=await assistantFixture();try{const ids=Array.from({length:100},(_,i)=>'task-'+i);let seenCount=0,snapshot:readonly string[]=[];
  const prior:AssistantActionResult={stepId:'prior-receipt',kind:'create_tasks',status:'completed',summary:'Created',affectedCount:100,projectId:'synthetic',createdTaskIds:ids};
  const follow:AssistantPlan={version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'archive',kind:'archive_tasks',project:{kind:'current'},targets:{kind:'previous',limit:90},archived:true}]};
  const service=createAssistantService({store:f.store,context:async()=>context,priorTaskResult:async()=>prior,planner:{plan:async input=>{seenCount=input.context.previousTaskCount;assert.equal(JSON.stringify(input.context).includes('task-0'),false);return {plan:follow};}},
   execute:async input=>input.commitStep(input.stepId,input.fence,async()=>{snapshot=input.results.__previous.createdTaskIds!;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Archived90',affectedCount:90};})});
  const draft=await service.submit('alice',request);ids[0]='mutated-after-bind';await service.apply('alice',draft.id);assert.equal(seenCount,100);assert.equal(snapshot[0],'task-0');assert.equal(snapshot.length,100);
 }finally{await f.close();}
});
test('orphan planning expires to unknown without repeating inference or releasing its reservation',async()=>{
 const f=await assistantFixture();try{let clock=1000;const store=createAssistantStore(f.database,{now:()=>clock});const {run}=await store.createRun({actorId:'alice',requestId:request.requestId,requestHash:assistantPayloadHash(request),request});
  await store.budget.reserve({runId:run.id,requestId:request.requestId,model:'synthetic',reservedMicroUsd:100,developmentCapMicroUsd:500,totalCapMicroUsd:1000,rateCardId:'fixed'});clock=122000;
  const service=createAssistantService({store,context:async()=>context,planner:{plan:async()=>{throw Error('must not replan');}},execute:async()=>{throw Error('must not execute');}});
  assert.equal((await service.view('alice',run.id)).status,'unknown');assert.equal((await service.resume('alice',run.id)).status,'unknown');assert.equal((await store.getRun('alice',run.id)).reservedMicroUsd,100);
 }finally{await f.close();}
});
test('pending Timeline resumes only its postcommit provisioner; original local callback stays once',async()=>{
 const f=await assistantFixture();try{let local=0,available=false;const timeline:AssistantPlan={version:'ping.assistant.v1',outcome:'plan',mode:'execute',actions:[{id:'timeline',kind:'preview_timeline',project:{kind:'current'}}]};
  const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan:timeline})},execute:async input=>{
   const result=await input.commitStep(input.stepId,input.fence,async()=>{local++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Pending',affectedCount:0,projectId:'synthetic',code:'timeline_pending'};});
   if(!available)return {...result,status:'blocked',code:'timeline_unavailable'};
   return input.settleTimelineResult!('alice',input.runId,input.stepId,{...result,code:'timeline_ready',summary:'Ready',href:'/app/timeline?workspaceId=synthetic'});
  }});
  const pending=await service.submit('alice',request);assert.equal(pending.status,'partial');available=true;const done=await service.resume('alice',pending.id);assert.equal(done.status,'completed');assert.equal(local,1);assert.equal(done.steps[0].result?.code,'timeline_ready');
 }finally{await f.close();}
});
