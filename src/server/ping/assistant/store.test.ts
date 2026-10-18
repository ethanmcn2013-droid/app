import {test} from "node:test";
import assert from "node:assert/strict";
import {assistantFixture} from "./store-fixture";



import {createClient} from "@libsql/client";
import {drizzle} from "drizzle-orm/libsql";
import {eq} from "drizzle-orm";
import * as schema from "@/server/db/schema";
import {createAssistantStore,assistantPayloadHash,assistantStepId} from "./store";

const runInput=(requestId="request0001")=>({actorId:"alice",requestId,requestHash:assistantPayloadHash({requestId,text:"Synthetic request"})});
async function prepared(f:Awaited<ReturnType<typeof assistantFixture>>) {
 const {run}=await f.store.createRun(runInput());await f.store.bindPlan("alice",run.id,{actions:["one"]},[{key:"one",payload:{kind:"test"}}]);
 const stepId=assistantStepId(run.id,"one"),claim=await f.store.claimStep({actorId:"alice",runId:run.id,stepId});return {run,stepId,fence:claim.fence};
}
test('actor/request custody is immutable, private and durable across connections',async()=>{
 const f=await assistantFixture();let second:ReturnType<typeof createClient>|undefined;
 try {const a=await f.store.createRun(runInput());assert.equal((await f.store.createRun(runInput())).created,false);
  await assert.rejects(f.store.createRun({...runInput(),requestHash:"f".repeat(64)}),/request_conflict/);
  await assert.rejects(f.store.getRun('bob',a.run.id),/unavailable/);assert.equal(await f.store.getRunByRequestId('bob','request0001'),null);
  second=createClient({url:f.url});const reopened=createAssistantStore(drizzle(second,{schema}));assert.equal((await reopened.getRunByRequestId('alice','request0001'))?.id,a.run.id);
 }finally{second?.close();await f.close();}
});
test('effect, activity and step result commit atomically; duplicate returns exact prior without callback',async()=>{
 const f=await assistantFixture();try {const p=await prepared(f);let calls=0;
  const result={status:'completed',ids:['synthetic'],nothing:null};
  const first=await f.store.commitStep(p.stepId,p.fence,async tx=>{calls++;await tx.insert(schema.meta).values({key:'effect',value:'one'});return result;});
  const duplicate=await f.store.commitStep(p.stepId,0,async()=>{calls++;throw Error('must not execute');});
  assert.deepEqual(first,result);assert.deepEqual(duplicate,result);assert.equal(calls,1);
  assert.deepEqual(await f.store.getStepResults('alice',p.run.id),{one:result});
  assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM meta")).rows[0].n,1);
 }finally{await f.close();}
});
test('callback failure rolls back local effects and no receipt claims completion',async()=>{
 const f=await assistantFixture();try {const p=await prepared(f);
  await assert.rejects(f.store.commitStep(p.stepId,p.fence,async tx=>{await tx.insert(schema.meta).values({key:'effect',value:'one'});throw Error('synthetic failure');}),/synthetic failure/);
  assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM meta")).rows[0].n,0);
  assert.equal((await f.store.getSteps('alice',p.run.id))[0].resultJson,null);
 }finally{await f.close();}
});
test('cancellation fences a claimed step; expired leases never silently redispatch',async()=>{
 const f=await assistantFixture();try {const p=await prepared(f);await f.store.cancelRun('alice',p.run.id);
  await assert.rejects(f.store.commitStep(p.stepId,p.fence,async()=>({status:'completed'})),/cancelled/);
  const r=await f.store.createRun(runInput('request0002'));await f.store.bindPlan('alice',r.run.id,{},[{key:'two',payload:{}}]);
  let clock=1000;const timed=createAssistantStore(f.database,{now:()=>clock});const id=assistantStepId(r.run.id,'two');const claim=await timed.claimStep({actorId:'alice',runId:r.run.id,stepId:id,leaseMs:1000});clock=2001;
  await assert.rejects(timed.commitStep(id,claim.fence,async()=>({status:'completed'})),/lease_lost/);
  await assert.rejects(timed.claimStep({actorId:'alice',runId:r.run.id,stepId:id}),/uncertain/);
 }finally{await f.close();}
});
test('plan binding and draft execution grant are immutable and actor-bound',async()=>{
 const f=await assistantFixture();try {const {run}=await f.store.createRun({...runInput(),request:{mode:'draft'}});
  await f.store.bindPlan('alice',run.id,{a:1},[{key:'a',payload:{kind:'one'}}]);
  await assert.rejects(f.store.bindPlan('alice',run.id,{a:2},[{key:'a',payload:{kind:'two'}}]),/request_conflict/);
  await assert.rejects(f.store.authorizeDraft('bob',run.id),/unavailable/);
  const applied=await f.store.authorizeDraft('alice',run.id);assert.notEqual(applied.executionAuthorizedAt,null);
  assert.equal((await f.store.authorizeDraft('alice',run.id)).revision,applied.revision);
 }finally{await f.close();}
});
test('permanent dispatch entitlement and unknown reservation survive; known usage releases only observed unused reserve',async()=>{
 const f=await assistantFixture();try {const {run}=await f.store.createRun(runInput());const input={runId:run.id,requestId:'budget0001',model:'synthetic',reservedMicroUsd:100,developmentCapMicroUsd:150,totalCapMicroUsd:1000,rateCardId:'fixed'};
  assert.equal(await f.store.budget.reserve(input),true);assert.equal(await f.store.budget.reserve(input),false);
  await f.store.budget.recordUsage({runId:run.id,requestId:'budget0001',inputTokens:null,outputTokens:null,estimatedMicroUsd:null,state:'unknown'});
  assert.equal((await f.store.getRun('alice',run.id)).reservedMicroUsd,100);
  const next=await f.store.createRun(runInput('request0002'));assert.equal(await f.store.budget.reserve({...input,runId:next.run.id,requestId:'budget0002'}),false);
  await f.store.budget.recordUsage({runId:run.id,requestId:'budget0001',inputTokens:10,outputTokens:2,estimatedMicroUsd:20,state:'usage_observed'});
  assert.equal((await f.store.getRun('alice',run.id)).reservedMicroUsd,20);
  assert.equal(await f.store.budget.reserve({...input,runId:next.run.id,requestId:'budget0002'}),true);
  await assert.rejects(f.store.budget.recordUsage({runId:run.id,requestId:'budget0001',inputTokens:10,outputTokens:2,estimatedMicroUsd:1,state:'usage_observed'}),/request_conflict/);
  assert.equal((await f.database.select().from(schema.assistantRuns).where(eq(schema.assistantRuns.id,run.id)))[0].budgetRequestId,assistantPayloadHash({runId:run.id,requestId:'budget0001'}));
 }finally{await f.close();}
});
test('same client request across actors has distinct immutable billing invocation custody',async()=>{
 const f=await assistantFixture();try{
  const alice=(await f.store.createRun(runInput())).run,bob=(await f.store.createRun({...runInput(),actorId:'bob'})).run;
  const reserve={requestId:'same-client-id',model:'synthetic',reservedMicroUsd:100,developmentCapMicroUsd:500,totalCapMicroUsd:1000,rateCardId:'fixed'};
  assert.equal(await f.store.budget.reserve({...reserve,runId:alice.id}),true);assert.equal(await f.store.budget.reserve({...reserve,runId:bob.id}),true);
  await f.store.budget.recordUsage({runId:bob.id,requestId:reserve.requestId,inputTokens:2,outputTokens:1,estimatedMicroUsd:5,state:'usage_observed'});
  assert.equal((await f.store.getRun('alice',alice.id)).reservedMicroUsd,100);assert.equal((await f.store.getRun('bob',bob.id)).reservedMicroUsd,5);
  await assert.rejects(f.store.budget.recordUsage({runId:alice.id,requestId:'foreign-id',inputTokens:2,outputTokens:1,estimatedMicroUsd:1,state:'usage_observed'}),/unavailable/);
 }finally{await f.close();}
});
test('delivery is queued with local effects; only one fenced dispatcher can settle and unknown never resends',async()=>{
 const f=await assistantFixture();try{const p=await prepared(f);
  await f.store.commitStep(p.stepId,p.fence,async tx=>{await tx.insert(schema.meta).values({key:'local',value:'one'});await f.store.queueDeliveries(tx,p.stepId,['recipient-a','recipient-b']);return {status:'completed'};});
  const a=await f.store.claimDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-a'});assert.ok(a);
  assert.equal(await f.store.claimDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-a'}),null);
  await assert.rejects(f.store.settleDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-a',fence:0,outcome:'accepted'}),/lease_lost/);
  await f.store.settleDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-a',fence:a.fence,outcome:'unknown'});
  assert.equal(await f.store.claimDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-a'}),null);
  const b=await f.store.claimDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-b'});assert.ok(b);
  await f.store.settleDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient-b',fence:b.fence,outcome:'accepted',providerId:'synthetic-receipt'});
  assert.deepEqual(await f.store.deliverySummary('alice',p.run.id,p.stepId),{queued:0,accepted:1,unknown:1,suppressed:0});
 }finally{await f.close();}
});
test('expired physical delivery lease is unknown rather than another send entitlement',async()=>{
 const f=await assistantFixture();try{const p=await prepared(f);await f.store.commitStep(p.stepId,p.fence,async tx=>{await f.store.queueDeliveries(tx,p.stepId,['recipient']);return {status:'completed'};});
  let clock=1000;const timed=createAssistantStore(f.database,{now:()=>clock});assert.ok(await timed.claimDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient',leaseMs:1000}));clock=2001;
  assert.equal(await timed.claimDelivery({actorId:'alice',runId:p.run.id,stepId:p.stepId,key:'recipient'}),null);
  assert.equal((await timed.deliverySummary('alice',p.run.id,p.stepId)).unknown,1);
 }finally{await f.close();}
});
test('read-only original recovery records a known receipt without invoking the original action',async()=>{
 const f=await assistantFixture();try{const p=await prepared(f);await f.store.markStep('alice',p.run.id,p.stepId,p.fence,'uncertain','lost_response');let reads=0;
  const result=await f.store.recoverStep('alice',p.run.id,p.stepId,async tx=>{reads++;await tx.select().from(schema.meta);return {status:'completed',stepId:p.stepId};});
  assert.equal(reads,1);assert.equal(result?.status,'completed');assert.equal((await f.store.getSteps('alice',p.run.id))[0].status,'completed');
 }finally{await f.close();}
});
test('Timeline result settlement enriches only its pending original and then stays immutable',async()=>{
 const f=await assistantFixture();try{const p=await prepared(f);const prior={stepId:p.stepId,kind:'preview_timeline' as const,status:'completed' as const,summary:'Pending',affectedCount:0,projectId:'synthetic',code:'timeline_pending'};
  await f.store.commitStep(p.stepId,p.fence,async()=>prior);
  const done={...prior,code:'timeline_ready',summary:'Ready',href:'/app/timeline?workspaceId=synthetic'};
  await f.store.settleTimelineResult('alice',p.run.id,p.stepId,done);await f.store.settleTimelineResult('alice',p.run.id,p.stepId,done);
  await assert.rejects(f.store.settleTimelineResult('alice',p.run.id,p.stepId,{...done,href:'/app/tasks'}),/request_conflict/);
 }finally{await f.close();}
});

test('shared database admission serializes concurrent same and distinct request custody',async()=>{
 const f=await assistantFixture();try{
  const stores=Array.from({length:16},()=>createAssistantStore(f.database));
  const same=await Promise.all(stores.map(store=>store.createRun(runInput('concurrent-same'))));
  assert.equal(same.filter(value=>value.created).length,1);assert.equal(new Set(same.map(value=>value.run.id)).size,1);
  const distinct=await Promise.all(stores.map((store,index)=>store.createRun(runInput(`concurrent-distinct-${index}`))));
  assert.equal(distinct.filter(value=>value.created).length,16);assert.equal(new Set(distinct.map(value=>value.run.id)).size,16);
 }finally{await f.close();}
});

test('admission retries only SQLITE_BUSY before callback entry, never callback or commit errors',async()=>{
 const {assistantDatabaseTransaction}=await import('./store');
 type Database=import('./store').AssistantDatabase;type Tx=import('./store').AssistantTransaction;
 const busy=()=>Object.assign(new Error('locked'),{code:'SQLITE_BUSY'});
 let attempts=0,calls=0;
 const early={transaction:async(callback:(tx:Tx)=>Promise<unknown>)=>{if(++attempts<3)throw busy();return callback({} as Tx);}} as unknown as Database;
 assert.equal(await assistantDatabaseTransaction(early,async()=>{calls++;return 'known';}),'known');assert.equal(attempts,3);assert.equal(calls,1);
 let lateAttempts=0,lateCalls=0;
 const late={transaction:async(callback:(tx:Tx)=>Promise<unknown>)=>{lateAttempts++;await callback({} as Tx);throw busy();}} as unknown as Database;
 await assert.rejects(assistantDatabaseTransaction(late,async()=>{lateCalls++;return 'effect';}),/locked/);assert.equal(lateAttempts,1);assert.equal(lateCalls,1);
 let callbackCalls=0;
 const callbackError={transaction:async(callback:(tx:Tx)=>Promise<unknown>)=>callback({} as Tx)} as unknown as Database;
 await assert.rejects(assistantDatabaseTransaction(callbackError,async()=>{callbackCalls++;throw busy();}),/locked/);assert.equal(callbackCalls,1);
});

test('real planner metadata shares reservation custody, survives cancel/result merges, stays private and erases with run',async()=>{
 const f=await assistantFixture();try{
  const {createClaudeAssistantPlanner}=await import('./claude-planner');
  const {createAssistantService}=await import('./service');
  const {run}=await f.store.createRun({...runInput(),request:{requestId:'request0001',text:'Synthetic',scope:{kind:'account'},mode:'execute'}});
  let calls=0;
  const planner=createClaudeAssistantPlanner({apiKey:'SYNTHETIC-NOT-A-CREDENTIAL',budget:f.store.budget,schema:{type:'object'},instructions:'Synthetic',validate:v=>v,
   fetch:(async()=>{calls++;return Response.json({type:'message',role:'assistant',model:'claude-sonnet-5-5',stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:2,cache_read_input_tokens:3,cache_creation_input_tokens:5,cache_creation:{ephemeral_5m_input_tokens:2,ephemeral_1h_input_tokens:3}},content:[{type:'text',text:'{}'}]});}) as typeof fetch});
  await planner.plan({runId:run.id,requestId:'request0001',text:'Synthetic',context:{},tier:'compound'},new AbortController().signal);
  // Queued optional observer and normal service writes use the same serialized transaction admission.
  await Promise.all([f.store.finishRun('alice',run.id,'ready',{message:'Saved',timing:{planningMs:1}}),f.store.cancelRun('alice',run.id)]);
  let attempt=await f.store.getPlannerAttempt('alice',run.id);
  for(let i=0;i<20&&attempt?.physical!=='settled';i++){await new Promise(r=>setTimeout(r,10));attempt=await f.store.getPlannerAttempt('alice',run.id);}
  assert.equal(attempt?.logical,'completed');assert.equal(attempt?.physical,'settled');assert.equal(attempt?.cacheReadTokens,3);assert.equal(attempt?.cacheWrite5mTokens,2);assert.equal(attempt?.cacheWrite1hTokens,3);
  const saved=await f.store.getRun('alice',run.id);assert.equal(saved.status,'cancelled');assert.equal(JSON.parse(saved.resultJson!).message,'Saved');assert.equal(saved.usageState,'usage_observed');assert.equal(saved.inputTokens,18);
  const service=createAssistantService({store:f.store,planner:{plan:async()=>{throw Error('unused');}},context:async()=>{throw Error('unused');},execute:async()=>{throw Error('unused');}});
  const visible=JSON.stringify(await service.view('alice',run.id));assert.ok(!visible.includes('plannerAttempt'));assert.ok(!visible.includes('cacheReadTokens'));
  await assert.rejects(f.store.getPlannerAttempt('bob',run.id),/unavailable/);
  await assert.rejects(f.store.budget.recordAttempt({runId:run.id,requestId:'foreign',attempt:attempt!}),/unavailable/);
  await f.store.budget.recordAttempt({runId:run.id,requestId:'request0001',attempt:attempt!});
  await assert.rejects(f.store.budget.recordAttempt({runId:run.id,requestId:'request0001',attempt:{...attempt!,httpStatus:400}}),/request_conflict/);
  await assert.rejects(f.store.budget.recordAttempt({runId:run.id,requestId:'request0001',attempt:{...attempt!,revision:attempt!.revision+1,physical:'pending'}}),/request_conflict/);
  assert.equal(calls,1);assert.equal(await f.store.budget.reserve({runId:run.id,requestId:'request0001',model:'claude-sonnet-5-5',reservedMicroUsd:100,developmentCapMicroUsd:5000000,totalCapMicroUsd:100000000,rateCardId:'fixed'}),false);
  const lostRun=(await f.store.createRun(runInput('lost-metadata'))).run;
  const lostPlanner=createClaudeAssistantPlanner({apiKey:'SYNTHETIC-NOT-A-CREDENTIAL',budget:{...f.store.budget,recordAttempt:async()=>{throw Error('observer unavailable');}},schema:{type:'object'},instructions:'Synthetic',validate:v=>v,
   fetch:(async()=>Response.json({type:'message',role:'assistant',model:'claude-sonnet-5-5',stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:2},content:[{type:'text',text:'{}'}]})) as typeof fetch});
  await lostPlanner.plan({runId:lostRun.id,requestId:'lost-metadata',text:'Synthetic',context:{},tier:'compound'},new AbortController().signal);
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal((await f.store.getRun('alice',lostRun.id)).usageState,'usage_observed');
  assert.equal((await f.store.getPlannerAttempt('alice',lostRun.id))?.physical,'pending');assert.equal((await f.store.getPlannerAttempt('alice',lostRun.id))?.stages.physical,null);
  const pending=(await f.store.getPlannerAttempt('alice',lostRun.id))!;
  const orphan=(await f.store.createRun(runInput('orphan-attempt'))).run;
  await f.store.budget.reserve({runId:orphan.id,requestId:'orphan-attempt',model:pending.model,reservedMicroUsd:100,developmentCapMicroUsd:5000000,totalCapMicroUsd:100000000,rateCardId:'fixed',attempt:pending});
  const futureStore=createAssistantStore(f.database,{now:()=>orphan.createdAt+120001});await futureStore.expirePlanning('alice',orphan.id);
  assert.deepEqual(await futureStore.getPlannerAttempt('alice',orphan.id),pending);assert.equal((await futureStore.getRun('alice',orphan.id)).usageState,'reserved');
  for(const regression of [{dispatched:false},{httpStatus:null},{stages:{...attempt!.stages,headers:null}}])await assert.rejects(f.store.budget.recordAttempt({runId:run.id,requestId:'request0001',attempt:{...attempt!,revision:attempt!.revision+1,...regression}}),/request_conflict/);

  await f.database.delete(schema.assistantRuns).where(eq(schema.assistantRuns.id,run.id));await assert.rejects(f.store.getPlannerAttempt('alice',run.id),/unavailable/);
 }finally{await f.close();}
});
