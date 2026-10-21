import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantApiCommand,parseAssistantPlan,type AssistantPlan,type AssistantPlannerContext,type AssistantActionResult} from '@/lib/ping/assistant/contract';
import type {AssistantSource} from '@/lib/ping/assistant/release2';
import {createAssistantService,assistantUnchangedSources} from './service';
import {createAssistantHttp} from './http';
import {assistantFixture} from './store-fixture';
import {assistantConversationPlannerContext} from './planner-context';
import {editAssistantPlan} from './conversation-memory';
import {instantFromAssistantDayTime,assistantLocalDayTime} from './calendar-time';

const context:AssistantPlannerContext={actorName:'Alice',projectName:'Synthetic',projects:[{name:'Synthetic'}],members:[{name:'Alice'},{name:'Niamh'}],selectedTaskCount:0,previousTaskCount:0,referenceDate:'2026-07-16',timeZone:'Europe/Dublin'};
const request={requestId:'request_r20001',text:'Call the florist tomorrow at 10',scope:{kind:'project' as const,projectId:'synthetic'},mode:'draft' as const};
const plan:Extract<AssistantPlan,{outcome:'plan'}>={version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'call',kind:'create_tasks',project:{kind:'current'},tasks:[{title:'Call the florist',assignees:[{kind:'self'}],dueDate:'tomorrow',dueTime:'10:00'}]}]};
const source:AssistantSource={ref:'source1',kind:'conversation',projectId:'synthetic',scopeId:'chat_1',itemId:'message_1',revision:1,audienceEpoch:1,body:'We agreed on Spritz, not wine.',authorName:'Alice',createdAt:'2026-07-16T09:00:00.000Z',href:'/app/messages?projectId=synthetic&messageId=message_1'};

test('public endpoint forces a waiting plan even when caller forges execute; only Apply writes',async()=>{
 const f=await assistantFixture();let writes=0;try{
  const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:input=>input.commitStep(input.stepId,input.fence,async()=>{writes++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Created',affectedCount:1};})});
  const http=createAssistantHttp({authenticate:async()=> 'alice',service:async()=>service});
  const response=await http(new Request('http://localhost/api/ping/assistant',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({operation:'submit',request:{...request,mode:'execute'}})}));
  const body=await response.json();assert.equal(body.run.status,'ready');assert.equal(body.run.mode,'draft');assert.equal(writes,0);
  await service.resume('alice',body.run.id);assert.equal(writes,0);await service.apply('alice',body.run.id);await service.apply('alice',body.run.id);assert.equal(writes,1);
 }finally{await f.close();}
});

test('time-only and owner edits preserve the day and other fields; unknown or dependent drops fail',()=>{
 const edited=editAssistantPlan(plan,[{kind:'task_fields',stepId:'call',changes:{dueTime:'11:00',assignees:[{kind:'name',name:'Niamh'}]}}]);
 assert.equal(edited.actions[0].kind,'create_tasks');if(edited.actions[0].kind==='create_tasks')assert.deepEqual(edited.actions[0].tasks?.[0],{title:'Call the florist',assignees:[{kind:'name',name:'Niamh'}],dueDate:'tomorrow',dueTime:'11:00'});
 assert.throws(()=>editAssistantPlan(plan,[{kind:'drop',stepId:'unknown'}]));
 assert.equal(parseAssistantPlan({...plan,actions:[{...plan.actions[0],tasks:[{title:'Bad day',dueDate:'2026-02-30'}]}]}),null);
 assert.equal(parseAssistantPlan({version:'ping.assistant.v1',outcome:'edit',edits:[{kind:'task_fields',stepId:'call',changes:{dueTime:'25:00'}}]}),null);
});

test('Project local clock survives daylight saving; nonexistent and repeated clock times are refused',()=>{
 assert.equal(instantFromAssistantDayTime('2026-07-17','10:00','Europe/Dublin').toISOString(),'2026-07-17T09:00:00.000Z');
 assert.equal(instantFromAssistantDayTime('2026-12-17','10:00','Europe/Dublin').toISOString(),'2026-12-17T10:00:00.000Z');
 assert.deepEqual(assistantLocalDayTime(new Date('2026-07-17T23:30:00Z'),'Europe/Dublin'),{day:'2026-07-18',time:'00:30'});
 assert.throws(()=>instantFromAssistantDayTime('2026-03-29','01:30','Europe/Dublin'));
 assert.throws(()=>instantFromAssistantDayTime('2026-10-25','01:30','Europe/Dublin'));
});

test('a follow-up naming one task in a bulk creation leaves its siblings unchanged',()=>{
 const bulk:Extract<AssistantPlan,{outcome:'plan'}>={...plan,actions:[{id:'prep',kind:'create_tasks',project:{kind:'current'},tasks:[
  {title:'Print the menu',assignees:[{kind:'self'}],dueDate:'tomorrow'},
  {title:'Check the fire exits',assignees:[{kind:'self'}],dueDate:'today'}]}]};
 const edited=editAssistantPlan(bulk,[{kind:'task_fields',stepId:'prep',taskTitle:'Print the menu',changes:{assignees:[{kind:'name',name:'Niamh'}]}}]);
 assert.equal(edited.actions[0].kind,'create_tasks');if(edited.actions[0].kind!=='create_tasks')assert.fail();
 assert.deepEqual(edited.actions[0].tasks?.[1],bulk.actions[0].kind==='create_tasks'?bulk.actions[0].tasks?.[1]:null);
 const dropped=editAssistantPlan(edited,[{kind:'drop',stepId:'prep',taskTitle:'Print the menu'}]);
 assert.equal(dropped.actions[0].kind,'create_tasks');if(dropped.actions[0].kind==='create_tasks')assert.equal(dropped.actions[0].tasks?.[0].title,'Check the fire exits');
});

test('production service recovery holds pre-redesign execute plans until Apply',async()=>{
 const f=await assistantFixture();let writes=0;try{
  const legacyRequest={...request,mode:'execute' as const};
  const legacyPlan={...plan,mode:'execute' as const};
  const old=await f.store.createRun({actorId:'alice',requestId:request.requestId,requestHash:(await import('./store')).assistantPayloadHash(legacyRequest),request:legacyRequest});
  await f.store.bindPlan('alice',old.run.id,{plan:legacyPlan,referenceDate:context.referenceDate},legacyPlan.actions.map(action=>({key:action.id,payload:action})));
  const service=createAssistantService({requireApproval:true,store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:input=>input.commitStep(input.stepId,input.fence,async()=>{writes++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Created',affectedCount:1};})});
  const waiting=await service.resume('alice',old.run.id);assert.equal(waiting.mode,'draft');assert.equal(writes,0);
  await service.apply('alice',old.run.id);assert.equal(writes,1);
 }finally{await f.close();}
});

test('follow-up remembers only its explicit scope, replaces waiting plan atomically, answers without applying',async()=>{
 const f=await assistantFixture();let calls=0,writes=0;try{
  const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async input=>{
   calls++;if(calls===1)return {plan};
   assert.equal(input.context.memory?.[0].user,request.text);assert.equal(input.context.waitingPlan?.[0].id,'call');
   if(calls===2)return {plan:{version:'ping.assistant.v1',outcome:'edit',edits:[{kind:'task_fields',stepId:'call',changes:{dueTime:'11:00'}}]}};
   return {plan:{version:'ping.assistant.v1',outcome:'answer',message:'Tomorrow at 11:00. The plan is still waiting.',citations:[]}};
  }},execute:async()=>{writes++;throw Error('must not write');}});
  const original=await service.submit('alice',request);
  const edited=await service.submit('alice',{...request,requestId:'request_r20002',text:'make it 11 instead',replyToRunId:original.id});
  assert.equal(edited.status,'ready');assert.equal((await service.view('alice',original.id)).status,'cancelled');
  await assert.rejects(service.apply('alice',original.id));
  const answer=await service.submit('alice',{...request,requestId:'request_r20003',text:'what time is that for?',replyToRunId:edited.id});
  assert.equal(answer.status,'completed');assert.match(answer.message??'',/11:00/);assert.equal((await service.view('alice',edited.id)).status,'ready');assert.equal(writes,0);
  const foreign=await service.submit('bob',{...request,requestId:'request_r20004',replyToRunId:edited.id});assert.equal(foreign.status,'failed');assert.equal(calls,3);
  const otherScope=await service.submit('alice',{...request,requestId:'request_r20005',scope:{kind:'project',projectId:'other'},replyToRunId:edited.id});assert.equal(otherScope.status,'failed');assert.equal(calls,3);
 }finally{await f.close();}
});

test('exact quotes link only server sources; forged citations and revoked sources fail closed',async()=>{
 const f=await assistantFixture();let valid=true,calls=0;try{
  const service=createAssistantService({store:f.store,context:async()=>({...context,sources:[source]}),validateSources:async()=>valid,planner:{plan:async()=>({plan:{version:'ping.assistant.v1',outcome:'answer',message:'You chose Spritz.',citations:[{ref:'source1',quote:++calls===1?'Spritz':'invented quote'}]}})},execute:async()=>{throw Error('no writes');}});
  const answer=await service.submit('alice',request);assert.equal(answer.status,'completed');assert.equal(answer.citations?.[0].href,source.href);
  const forged=await service.submit('alice',{...request,requestId:'request_r20002'});assert.equal(forged.status,'failed');
  valid=false;const redacted=await service.view('alice',answer.id);assert.equal(redacted.citations?.length,0);assert.doesNotMatch(JSON.stringify(redacted),/chose Spritz/);
 }finally{await f.close();}
});

test('provider projection removes internal IDs and URLs while retaining opaque sources and bounded memory',()=>{
 const safe=assistantConversationPlannerContext({...context,sources:[source],memory:[{user:'and her?',reply:'Niamh'}],waitingPlan:plan.actions});
 const json=JSON.stringify(safe);assert.match(json,/source1|Spritz|Niamh/);assert.doesNotMatch(json,/synthetic|chat_1|message_1|\/app\/messages|audienceEpoch/);
 assert.throws(()=>assistantConversationPlannerContext({...context,sources:[{...source,body:'x'.repeat(4001)}]}));
 assert.equal(parseAssistantApiCommand({operation:'submit',request:{...request,source:{kind:'conversation',conversationId:'chat',actorId:'bob'}}}),null);
 assert.equal(parseAssistantApiCommand({operation:'submit',request:{...request,scope:{kind:'account'},source:{kind:'conversation',conversationId:'chat'}}}),null);
});

test('Undo saves one atomic receipt, repeated Undo does not repeat effects, snapshots never leave server',async()=>{
 const f=await assistantFixture();let undos=0;try{
  const result:AssistantActionResult={stepId:'',kind:'create_tasks',status:'completed',summary:'Created',affectedCount:1,projectId:'synthetic',reversal:{kind:'tasks',projectId:'synthetic',rows:[{id:'task_private',before:null,after:{title:'private snapshot',updatedAt:'2026-07-16'}}]}};
  const service=createAssistantService({store:f.store,context:async()=>context,planner:{plan:async()=>({plan})},execute:input=>input.commitStep(input.stepId,input.fence,async()=>({...result,stepId:input.stepId})),undo:async()=>{undos++;return {status:'reverted',summary:'Task archived.',affectedCount:1};}});
  const draft=await service.submit('alice',request);const applied=await service.apply('alice',draft.id);assert.equal(applied.steps[0].canUndo,true);assert.doesNotMatch(JSON.stringify(applied),/private snapshot/);
  const undone=await service.undo('alice',draft.id,applied.steps[0].id);assert.equal(undone.steps[0].undoResult?.status,'reverted');assert.equal(undone.steps[0].canUndo,false);
  await service.undo('alice',draft.id,applied.steps[0].id);assert.equal(undos,1);await assert.rejects(service.undo('bob',draft.id,applied.steps[0].id));
 }finally{await f.close();}
});

test('an account waiting plan retains source authorization before any write and cannot apply after revocation',async()=>{
 const f=await assistantFixture();let allowed=true,writes=0;const seen:string[][]=[];try{
  const service=createAssistantService({requireApproval:true,store:f.store,context:async()=>({...context,sources:[source]}),
   validateSources:async()=>true,authorizePlan:async()=>['target-project'],authorizeView:async(_actor,_run,projects)=>{seen.push([...(projects??[])]);return allowed;},
   planner:{plan:async()=>({plan})},execute:input=>input.commitStep(input.stepId,input.fence,async()=>{writes++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Created',affectedCount:1};})});
  const draft=await service.submit('alice',{...request,scope:{kind:'account'}});
  assert.equal(draft.status,'ready');assert.equal(writes,0);assert.deepEqual(seen.at(-1),['target-project','synthetic']);
  assert.doesNotMatch(JSON.stringify(draft),/authorizationProjects|target-project/);
  // The bound plan remains authoritative even if a response is lost before ready metadata is saved.
  await f.store.finishRun('alice',draft.id,'ready',{authorizationProjects:undefined});
  allowed=false;const redacted=await service.view('alice',draft.id);
  assert.equal(redacted.accessUnavailable,true);assert.equal(redacted.steps[0].plan,undefined);
  await assert.rejects(service.apply('alice',draft.id));assert.equal(writes,0);
 }finally{await f.close();}
});

test('a waiting plan with an edited or inaccessible source is hidden and cannot Apply or resume',async()=>{
 const f=await assistantFixture();let current=true,writes=0;try{
  const service=createAssistantService({requireApproval:true,store:f.store,context:async()=>({...context,sources:[source]}),validateSources:async()=>current,
   planner:{plan:async()=>({plan})},execute:input=>input.commitStep(input.stepId,input.fence,async()=>{writes++;return {stepId:input.stepId,kind:input.step.kind,status:'completed',summary:'Created',affectedCount:1};})});
  const draft=await service.submit('alice',request);assert.equal(draft.status,'ready');
  current=false;const hidden=await service.view('alice',draft.id);assert.equal(hidden.accessUnavailable,true);assert.equal(hidden.steps[0].plan,undefined);
  await assert.rejects(service.apply('alice',draft.id));await assert.rejects(service.resume('alice',draft.id));assert.equal(writes,0);
 }finally{await f.close();}
});

test('factual source answers require an exact citation; questions about a waiting plan use its retained payload',async()=>{
 const f=await assistantFixture();try{
  const service=createAssistantService({store:f.store,context:async()=>({...context,sources:[source]}),validateSources:async()=>true,
   planner:{plan:async()=>({plan:{version:'ping.assistant.v1',outcome:'answer',message:'An unsupported assertion.',citations:[]}})},execute:async()=>{throw Error('no writes');}});
  const refused=await service.submit('alice',request);assert.equal(refused.status,'failed');assert.doesNotMatch(JSON.stringify(refused),/unsupported assertion/);
 }finally{await f.close();}
});

test('only a task snapshot changed by this run is exempt from its own pre-plan revision check',()=>{
 const task:AssistantSource={...source,ref:'task_source_1',kind:'task',scopeId:'changed_task',itemId:'changed_task'};
 const untouched={...task,ref:'task_source_2',scopeId:'other_task',itemId:'other_task'};
 const result:AssistantActionResult={stepId:'update',kind:'update_tasks',status:'completed',summary:'Updated',affectedCount:1,reversal:{kind:'tasks',projectId:'synthetic',rows:[{id:'changed_task',before:{title:'Before'},after:{title:'After'}}]}};
 assert.deepEqual(assistantUnchangedSources([source,task,untouched],[result]),[source,untouched]);
 assert.deepEqual(assistantUnchangedSources([source,task,untouched],[{...result,status:'blocked'}]),[source,task,untouched]);
 assert.deepEqual(assistantUnchangedSources([source,task,untouched],[{...result,undoResult:{status:'reverted',summary:'Restored',affectedCount:1}}]),[source,task,untouched]);
});
