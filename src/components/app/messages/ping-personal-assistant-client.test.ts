import assert from "node:assert/strict";
import test from "node:test";
import { assistantNavigationTarget, assistantVisibleStepStatus, assistantCanContinue, assistantCreatedProjects, assistantReentryId, assistantIsWorking, assistantNeedsRecovery, assistantRunLabel, parseAssistantApiResponse, parsePendingAssistantRequest, pendingAssistantKey, observeAssistantResultCommit } from "./ping-personal-assistant-client";
import type { AssistantRunView } from "@/lib/ping/assistant/contract";
const run: AssistantRunView = { id:"run_synthetic_123",requestId:"request_synthetic_123",text:"Create 100 tasks",scope:{kind:"project",projectId:"synthetic-project"},mode:"execute",status:"partial",createdAt:"2026-10-18T09:00:00.000Z",updatedAt:"2026-10-18T09:01:00.000Z",steps:[
  {id:"step1",actionId:"tasks",kind:"create_tasks",status:"completed",result:{stepId:"tasks",kind:"create_tasks",status:"completed",summary:"Created 100 tasks",affectedCount:100}},
  {id:"step2",actionId:"preview",kind:"preview_timeline",status:"unknown",result:null},
] };
test("durable pending marker is actor-scoped identifiers only, never request text",()=>{
  const marker={version:1,requestId:run.requestId,runId:run.id};
  assert.deepEqual(parsePendingAssistantRequest(JSON.stringify(marker)),marker);
  for(const value of [{...marker,text:"private request"},{...marker,actorId:"other"},{...marker,runId:"bad"},{...marker,requestId:"bad"}])assert.equal(parsePendingAssistantRequest(JSON.stringify(value)),null);
  assert.equal(parsePendingAssistantRequest("{"),null);
  assert.notEqual(pendingAssistantKey("actor-a"),pendingAssistantKey("actor-b"));
});
test("partial saved work with unknown step remains recoverable and never appears Done",()=>{
  assert.equal(assistantRunLabel(run),"Some work is saved");assert.equal(assistantNeedsRecovery(run),true);assert.equal(assistantIsWorking(run),false);
  assert.equal(assistantNeedsRecovery({...run,status:"completed",steps:[]}),false);
  assert.equal(assistantIsWorking({...run,status:"planning",steps:[]}),true);
  assert.equal(assistantRunLabel({...run,status:"ready",mode:"draft"}),"Draft ready");
});
test("visible step state follows the original outcome rather than existence of its receipt",()=>{
  const saved=run.steps[0];
  assert.equal(assistantVisibleStepStatus(saved),"completed");
  for(const status of ["blocked","unknown","failed","cancelled"] as const)
    assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,status}}),status);
  assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,code:"timeline_pending"}}),"queued");
  assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,delivery:{queued:0,accepted:0,unknown:1,suppressed:0}}}),"unknown");
  assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,delivery:{queued:1,accepted:0,unknown:0,suppressed:0}}}),"queued");
});
test("only a successful direct command opens its explicit result; reads and uncertain work never navigate",()=>{
  const href="/app/timeline/synthetic/current-preview?workspaceId=synthetic-project";
  const completed:AssistantRunView={...run,status:"completed",steps:[run.steps[0],{...run.steps[1],status:"completed",result:{stepId:"preview",kind:"preview_timeline",status:"completed",summary:"Private preview ready",affectedCount:0,href}}]};
  for(const operation of ["submit","apply","resume"] as const)assert.equal(assistantNavigationTarget(operation,completed),href);
  for(const operation of ["read","cancel"] as const)assert.equal(assistantNavigationTarget(operation,completed),null);
  for(const status of ["partial","unknown","ready","cancelled","failed"] as const)assert.equal(assistantNavigationTarget("submit",{...completed,status}),null);
  assert.equal(assistantNavigationTarget("submit",{...completed,steps:[run.steps[0]]}),null);
  for(const evil of ["https://outside.example/","//outside.example/","javascript:alert(1)","/app/../outside","/app/%2e%2e/outside"])
    assert.equal(assistantNavigationTarget("submit",{...completed,steps:[{...completed.steps[1],result:{...completed.steps[1].result!,href:evil}}]}),null);
  for(const status of ["blocked","unknown"] as const)assert.equal(assistantNavigationTarget("submit",{...completed,steps:[{...completed.steps[1],result:{...completed.steps[1].result!,status}}]}),null);
  assert.equal(assistantNavigationTarget("submit",{...completed,steps:[{...completed.steps[1],result:{...completed.steps[1].result!,code:"timeline_pending"}}]}),null);
});

test("cancelling remaining work releases the composer while keeping unknown receipts visible", () => {
  const cancelled = {...run, status: "cancelled" as const};
  assert.equal(assistantNeedsRecovery(cancelled), false);
  assert.equal(cancelled.steps[1].status, "unknown");
  assert.equal(assistantCanContinue(cancelled), false);
  assert.equal(assistantCanContinue({...run, steps: [{...run.steps[1], status: "blocked"}]}), false);
  assert.equal(assistantCanContinue({...run, steps: [{...run.steps[0], result: {...run.steps[0].result!, kind: "preview_timeline", code: "timeline_pending"}}]}), true);
});
test("API readback validates stored progress, receipt absence and scalar delivery counts",()=>{
  const response={version:"ping.assistant.v1",ok:true,available:true,run};
  assert.deepEqual(parseAssistantApiResponse(response),response);
  assert.deepEqual(parseAssistantApiResponse({version:"ping.assistant.v1",ok:true,available:true}),{version:"ping.assistant.v1",ok:true,available:true});
  assert.equal(parseAssistantApiResponse({...response,run:{...run,status:"invented"}}),null);
  assert.equal(parseAssistantApiResponse({...response,run:{...run,steps:[{...run.steps[0],result:{...run.steps[0].result,affectedCount:-1}}]}}),null);
  assert.equal(parseAssistantApiResponse({...response,run:{...run,steps:[{...run.steps[0],result:{...run.steps[0].result,delivery:{queued:"wrong",accepted:0,unknown:0,suppressed:0}}}]}}),null);
});


test("request-to-visible timing waits for a matching commit and real frame, not server timings",()=>{
  const facts: unknown[]=[];const ended: unknown[]=[];let callback:()=>void=()=>{};
  const timing={requestId:"request_synthetic_123",startedAt:10,done:false,recorder:{record:(fact:unknown)=>facts.push(fact)} as never,endAttempt:(outcome:unknown)=>ended.push(outcome)};
  const options={timing,run:{status:"planning" as const,mode:"execute" as const},isCurrent:()=>true,requestFrame:(cb:()=>void)=>{callback=cb;return 1;},cancelFrame:()=>{},now:()=>210};
  observeAssistantResultCommit(options);assert.deepEqual(facts,[]);
  observeAssistantResultCommit({...options,run:{status:"completed",mode:"execute"}});
  assert.deepEqual(facts,[{stage:"react-commit",outcome:"completed"}]);assert.deepEqual(ended,[]);
  callback();assert.deepEqual(facts.at(-1),{stage:"render-opportunity",outcome:"completed",durationMs:200});assert.deepEqual(ended,["completed"]);
  callback();assert.equal(facts.length,2);
});

test("hidden or disposed results do not manufacture a visible completion",()=>{
  const facts:unknown[]=[];let callback:()=>void=()=>{};
  const timing={requestId:"request_synthetic_123",startedAt:10,done:false,recorder:{record:(fact:unknown)=>facts.push(fact)} as never,endAttempt:()=>{throw Error("must not finish");}};
  const base={timing,run:{status:"completed" as const,mode:"execute" as const},isCurrent:()=>true,requestFrame:(cb:()=>void)=>{callback=cb;return 1;},cancelFrame:()=>{}};
  observeAssistantResultCommit({...base,isCurrent:()=>false});assert.deepEqual(facts,[]);
  const dispose=observeAssistantResultCommit(base);dispose();callback();assert.equal(facts.length,1);assert.equal(timing.done,false);
});

test("reload re-entry requires authoritative absence and reuses original saved request identity", () => {
  const saved = { version: 1 as const, requestId: "request_saved_123" };
  assert.equal(assistantReentryId(saved, false), null);
  assert.equal(assistantReentryId(null, true), null);
  assert.equal(assistantReentryId(saved, true), saved.requestId);
});
test("follow-up scope uses explicit authorized created Project fields only", () => {
  const projectRun = {...run, status: "completed" as const, steps: [{...run.steps[0], result: {...run.steps[0].result!, createdProjectId: "new-project", createdProjectName: "New launch"}}]};
  assert.deepEqual(assistantCreatedProjects(projectRun), [{id:"new-project",name:"New launch"}]);
  assert.deepEqual(assistantCreatedProjects({...projectRun,status:"running"}), []);
  assert.deepEqual(assistantCreatedProjects(run), []);
});
