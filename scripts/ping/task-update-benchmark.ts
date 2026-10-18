import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from '@/server/db/schema';
import {createPingProofFixture,PROOF_PROJECT} from '@/server/ping/proof-fixture';
import {createAssistantStore,assistantPayloadHash,assistantStepId} from '@/server/ping/assistant/store';
import {executeAssistantAction} from '@/server/ping/assistant/actions';
import type {AssistantAction,AssistantActionResult} from '@/lib/ping/assistant/contract';

export const UPDATE_BENCHMARK_NOW=Date.parse('2026-10-18T09:00:00Z');
export type UpdateScenario='field_patch'|'same_values'|'mixed_statuses';
export async function updateBenchmarkFixture(){
 const proof=await createPingProofFixture(),statements:string[]=[];
 const database=drizzle(proof.client,{schema,logger:{logQuery(query){statements.push(query);}}});
 let serial=0;const store=createAssistantStore(database,{now:()=>UPDATE_BENCHMARK_NOW,uuid:()=>`benchmark-run-${++serial}`});
 async function prepare(action:AssistantAction){
  const requestId=`benchmark_request_${serial+1}`;
  const {run}=await store.createRun({actorId:'alice',requestId,requestHash:assistantPayloadHash({requestId})});
  await store.bindPlan('alice',run.id,{benchmark:true},[{key:action.id,payload:action}]);
  const stepId=assistantStepId(run.id,action.id),claim=await store.claimStep({actorId:'alice',runId:run.id,stepId});
  return {actorId:'alice',runId:run.id,stepId,fence:claim.fence,step:action,commitStep:store.commitStep,results:{} as Record<string,AssistantActionResult>,referenceDate:'2026-10-18',currentProjectId:PROOF_PROJECT,now:()=>UPDATE_BENCHMARK_NOW};
 }
 const create=await prepare({id:'create',kind:'create_tasks',project:{kind:'current'},template:{count:100,titlePrefix:'Synthetic update benchmark'}});
 const created=await executeAssistantAction(create);const ids=created.createdTaskIds!;
 async function reset(scenario:UpdateScenario){
  await proof.client.execute('DELETE FROM activities');
  await proof.client.execute({sql:`UPDATE tasks SET lane=?,assignees=?,due=?,due_at=?,completed_at=NULL,board_column_key=NULL,idle_days=0,updated_at=? WHERE workspace_id=?`,args:[scenario==='same_values'?'doing':'todo',scenario==='same_values'?'["alice"]':'[]',scenario==='same_values'?'2026-10-20':null,scenario==='same_values'?Date.parse('2026-10-20T09:00:00Z')/1000:null,UPDATE_BENCHMARK_NOW/1000-86400,PROOF_PROJECT]});
  if(scenario==='mixed_statuses')await proof.client.execute({sql:`UPDATE tasks SET lane=CASE WHEN seq%3=0 THEN 'done' WHEN seq%3=1 THEN 'review' ELSE 'doing' END,completed_at=CASE WHEN seq%3=0 THEN ?-seq ELSE NULL END WHERE workspace_id=?`,args:[UPDATE_BENCHMARK_NOW/1000-86400,PROOF_PROJECT]});
 }
 async function snapshot(){return {tasks:(await proof.client.execute('SELECT * FROM tasks ORDER BY id')).rows,activities:(await proof.client.execute('SELECT * FROM activities ORDER BY id')).rows};}
 return {...proof,database,store,statements,ids,prepare,reset,snapshot};
}
export async function runUpdateBenchmark(samples=5,scenarios:readonly UpdateScenario[]=['field_patch']){
 const outcomes=[];
 for(const scenario of scenarios){
  const f=await updateBenchmarkFixture();
  try{
   const observations=[];let snapshot:Awaited<ReturnType<typeof f.snapshot>>|undefined;let result:AssistantActionResult|undefined;
   for(let sample=-1;sample<samples;sample++){
    await f.reset(scenario);
    const input=await f.prepare({id:'update',kind:'update_tasks',project:{kind:'current'},targets:{kind:'selected'},changes:{status:scenario==='mixed_statuses'?'done':'doing',dueDate:'2026-10-20',assignees:[{kind:'self'}]}});
    const selected={...input,selectedTaskIds:f.ids};f.statements.length=0;
    const start=performance.now();result=await executeAssistantAction(selected);const elapsedMs=performance.now()-start;
    const statements=[...f.statements];
    if(sample>=0)observations.push({elapsedMs,statements:statements.length,updates:statements.filter(s=>/^update "tasks"/i.test(s)).length,activityInserts:statements.filter(s=>/^insert into "activities"/i.test(s)).length});
    snapshot=await f.snapshot();
    const old=JSON.stringify(snapshot);const duplicate=await executeAssistantAction(selected);
    if(JSON.stringify(duplicate)!==JSON.stringify(result)||JSON.stringify(await f.snapshot())!==old)throw Error('Original receipt replay changed business state');
   }
   const sorted=observations.map(o=>o.elapsedMs).sort((a,b)=>a-b);
   outcomes.push({scenario,warmup:1,samples,observations,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),businessSnapshotSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),result,snapshot});
  }finally{f.client.close();}
 }
 return {schemaVersion:'ping-task-update-local-benchmark/1',synthetic:true,clock:'performance.now monotonic',includes:'executeAssistantAction plus actual fenced store commit and original result; excludes setup/claim/planning/network',noOpSemantics:'same_values retains existing UPDATE/activity behavior; no new no-op policy',outcomes};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/task-update-benchmark.ts'))void(async()=>{
 const scenario=process.env.PING_UPDATE_BENCH_SCENARIO??'field_patch';
 if(!['field_patch','same_values','mixed_statuses'].includes(scenario))throw Error('Invalid benchmark scenario');
 const result=await runUpdateBenchmark(Number(process.env.PING_UPDATE_BENCH_SAMPLES??5),[scenario as UpdateScenario]);
 if(process.env.PING_UPDATE_BENCH_OUTPUT)fs.writeFileSync(process.env.PING_UPDATE_BENCH_OUTPUT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({...result,outcomes:result.outcomes.map(({snapshot,...row})=>({...row,result:{status:row.result!.status,affectedCount:row.result!.affectedCount},snapshotRows:{tasks:snapshot!.tasks.length,activities:snapshot!.activities.length}}))}));
})().catch(error=>{console.error(error);process.exitCode=1;});
