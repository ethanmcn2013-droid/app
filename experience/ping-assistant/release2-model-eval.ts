import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../src/server/db/schema";
import { assistantDatabaseTransaction, createAssistantStore, type AssistantDatabase } from "../../src/server/ping/assistant/store";
import { createAssistantService } from "../../src/server/ping/assistant/service";
import { createPingAssistantPlanner } from "../../src/server/ping/assistant/claude-planner";
import { assistantConversationAdapter } from "../../src/server/ping/assistant/conversation-transaction";
import { createAssistantConversationContext } from "../../src/server/ping/assistant/conversation-context";
import { getAssistantContext } from "../../src/server/ping/assistant/context";
import { loadAssistantTaskContext, validateAssistantTaskSources } from "../../src/server/ping/assistant/task-context";
import { executeAssistantAction } from "../../src/server/ping/assistant/actions";
import { executeAssistantUndo } from "../../src/server/ping/assistant/undo";
import { assertAssistantActor, authorizeAssistantProject, resolveAssistantProjectName } from "../../src/server/ping/assistant/context";
import { bindAssistantPlanTargets } from "../../src/server/ping/assistant/plan-targets";
import { assistantConversationPlannerContext } from "../../src/server/ping/assistant/planner-context";
import type { AssistantRequest, AssistantPlannerContext } from "../../src/lib/ping/assistant/contract";
import type { AssistantSource } from "../../src/lib/ping/assistant/release2";
import { estimatePlannerMicroUsd } from "../../src/server/ping/assistant/planner-budget";
import type { PlannerModel } from "../../src/server/ping/assistant/planner-budget";
import { EVAL_WORLD, RELEASE2_EVAL_CASES, RELEASE2_EVAL_PREREQUISITE, createRelease2SyntheticWorld, type EvalCase, type EvalSource } from "./release2-model-fixture";

const ACTOR = EVAL_WORLD.actorId;
const PROJECT = EVAL_WORLD.projectId;
const OUTPUT_ROOT = resolve("experience/output/ping-release2-model-eval");
const MAX_PROVIDER_ATTEMPTS = 63; // 63 prompts including B setup; one guest-only prompt is held without a call.
const PROVIDER_URL = "https://api.anthropic.com/v1/messages";

type Admission = Readonly<{ version: 1; scope: "synthetic"; purpose: "synthetic-ping-release2-eval"; model: "claude-sonnet-5-5"; actorId: "alice";
  projectId: typeof PROJECT; projectName: "The Orchard, events"; maxPhysicalAttempts: 63; maxAccountedMicroUsd: 4_000_000; keyWorkspaceMonthlyCapMicroUsd: 5_000_000;
  externalDelivery: false; timelinePublish: false; expiresAt: string }>;
type Row = { caseId: string; group: string; prompt: string; expectation: string; held?: string; status: string;
  requestId?: string; runId?: string; modelPlan?: unknown; runView?: unknown; sourceCoverage?: string; timing?: unknown; providerAttempt?: unknown;
  usage?: unknown; durableEffectDiff?: unknown; failure?: string };

function flags(argv: readonly string[]) {
  const values = new Map<string,string>();
  for(let index=0;index<argv.length;index++) {
    const key=argv[index];
    if(!key.startsWith("--"))throw new Error("invalid_cli_argument");
    if(key==="--dry-run"||key==="--action-check"){values.set(key,"true");continue;}
    const value=argv[++index];if(!value||value.startsWith("--"))throw new Error("invalid_cli_argument");
    values.set(key,value);
  }
  return values;
}

function assertUniqueOutputPath(raw:string) {
  const output=resolve(raw), rel=relative(OUTPUT_ROOT,output);
  if(!rel||rel.startsWith(`..${sep}`)||rel===".."||isAbsolute(rel)||!output.endsWith(".json"))throw new Error("output_must_be_unique_json_under_experience_output");
  return output;
}

async function readAdmission(path:string):Promise<Admission>{
  const raw=JSON.parse(await readFile(path,"utf8")) as Partial<Admission>;
  if(raw.version!==1||raw.scope!=="synthetic"||raw.purpose!=="synthetic-ping-release2-eval"||raw.model!=="claude-sonnet-5-5"||raw.actorId!==ACTOR||
    raw.projectId!==PROJECT||raw.projectName!==EVAL_WORLD.projectName||raw.maxPhysicalAttempts!==MAX_PROVIDER_ATTEMPTS||raw.maxAccountedMicroUsd!==4_000_000||
    raw.keyWorkspaceMonthlyCapMicroUsd!==5_000_000||
    raw.externalDelivery!==false||raw.timelinePublish!==false||typeof raw.expiresAt!=="string"||Date.parse(raw.expiresAt)<=Date.now())throw new Error("scope_admission_invalid");
  return raw as Admission;
}

function caseSource(item:EvalCase,ids:Record<string,string>):EvalSource|undefined{
  if(!item.source)return undefined;
  if(item.source.kind==="conversation"){
    const conversationId=ids[item.source.conversationId];
    if(!conversationId)throw new Error("fixture_conversation_missing");
    return {kind:"conversation",conversationId};
  }
  return item.source;
}

function caseSequence(){
  const rows:EvalCase[]=[];
  for(const group of [...new Set(RELEASE2_EVAL_CASES.map(item=>item.group))]){
    if(group==="B")rows.push(RELEASE2_EVAL_PREREQUISITE);
    rows.push(...RELEASE2_EVAL_CASES.filter(item=>item.group===group));
  }
  return rows;
}

async function taskDigest(client:ReturnType<typeof createClient>){
  const rows=await client.execute({sql:"SELECT id,title,description,assignees,due,due_at,lane,archived_at,completed_at,parent_task_id FROM tasks WHERE workspace_id=? ORDER BY id",args:[PROJECT]});
  const normalized=rows.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Uint8Array?Buffer.from(value).toString("base64"):value])));
  const active=normalized.filter(row=>row.archived_at===null);
  return {count:active.length,archivedCount:normalized.length-active.length,
    sha256:createHash("sha256").update(JSON.stringify(active)).digest("hex"),
    allRowsSha256:createHash("sha256").update(JSON.stringify(normalized)).digest("hex"),rows:normalized};
}

async function contextFor(database:AssistantDatabase,actorId:string,request:AssistantRequest):Promise<AssistantPlannerContext>{
  return assistantDatabaseTransaction(database,async tx=>{
    const base=await getAssistantContext(tx,actorId,request.scope.kind==="project"?request.scope.projectId:null);
    const timeZone=EVAL_WORLD.timeZone;
    const conversations=await createAssistantConversationContext(assistantConversationAdapter(tx),{directMessagesEnabled:true}).load(actorId,request);
    const tasks=await loadAssistantTaskContext(tx,actorId,request,timeZone);
    return {actorName:"Orla Byrne",projectName:base.project?.name??null,projects:base.projects.map(project=>({name:project.name})),
      members:tasks.members,selectedTaskCount:request.selectedTaskIds?.length??0,previousTaskCount:0,referenceDate:EVAL_WORLD.referenceDate,timeZone,
      sources:[...conversations.sources,...tasks.sources],coverage:`${tasks.coverage} ${conversations.coverage}`.slice(0,1000),needsYou:conversations.needsYou,
      needsYouTotal:conversations.needsYouTotal,needsYouComplete:conversations.needsYouComplete,tasks:tasks.tasks};
  });
}

/** Apply the production source-revalidation contract to both local action checks and model runs. */
async function validateSourcesFor(database:AssistantDatabase,actorId:string,sources:readonly AssistantSource[]):Promise<boolean>{
  return assistantDatabaseTransaction(database,async tx=>{
    const chatContext= createAssistantConversationContext(assistantConversationAdapter(tx),{directMessagesEnabled:true});
    const chat=sources.filter(source=>source.kind==="conversation"||source.kind==="task_discussion");
    if(chat.length&&!await chatContext.validate(actorId,chat))return false;
    const tasks=sources.filter(source=>source.kind==="task");
    return !tasks.length||validateAssistantTaskSources(tx,actorId,tasks,EVAL_WORLD.timeZone);
  });
}

/** Use the same canonical authorization and immutable target binding as production. */
function planAuthorizationFor(database:AssistantDatabase):Pick<Parameters<typeof createAssistantService>[0],"authorizePlan"|"bindTargets">{
  return {
    authorizePlan:(actorId,request,plan)=>assistantDatabaseTransaction(database,async tx=>{
      await assertAssistantActor(tx,actorId);
      const ids=new Set<string>();
      for(const action of plan.actions){
        if(!('project'in action)||action.project.kind==='created')continue;
        if(action.project.kind==='current'){
          if(request.scope.kind!=='project')throw new Error('assistant_project_unavailable');
          await authorizeAssistantProject(tx,actorId,request.scope.projectId);ids.add(request.scope.projectId);
        }else ids.add((await resolveAssistantProjectName(tx,actorId,action.project.name)).id);
      }
      return [...ids];
    }),
    bindTargets:(actorId,request,plan,priorTaskResult)=>assistantDatabaseTransaction(database,tx=>bindAssistantPlanTargets(tx,{actorId,plan,
      currentProjectId:request.scope.kind==='project'?request.scope.projectId:undefined,selectedTaskIds:request.selectedTaskIds,priorTaskResult})),
  };
}

async function ensureOutputUnused(output:string){
  await mkdir(dirname(output),{recursive:true});
  const root=await realpath(OUTPUT_ROOT);
  const parent=await realpath(dirname(output));
  const rel=relative(root,parent);
  if(rel.startsWith(`..${sep}`)||rel===".."||isAbsolute(rel))throw new Error("output_path_escape");
  try{await stat(output);throw new Error("output_already_exists");}catch(error){if(error instanceof Error&&error.message==="output_already_exists")throw error;}
}
async function persist(output:string,value:unknown){
  const temporary=`${output}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(value,null,2),{flag:"wx",mode:0o600});
  await rename(temporary,output);
}

export async function runRelease2ModelEval(argv=process.argv.slice(2)){
  const args=flags(argv),rawOutput=args.get("--output");
  if(!rawOutput)throw new Error("explicit_unique_output_required");
  const output=assertUniqueOutputPath(rawOutput);
  await ensureOutputUnused(output);
  const dryRun=args.has("--dry-run");
  const startedAt=new Date().toISOString();
  let fixture:Awaited<ReturnType<typeof createRelease2SyntheticWorld>>|undefined;
  const records:Row[]=[];
  try{
    fixture=await createRelease2SyntheticWorld();
    const before=await taskDigest(fixture.client);
    const inventory=caseSequence();
    const preflight:Record<string,unknown>={required:62,databasePath:fixture.databasePath,admittedAccountedCapMicroUsd:4_000_000,keyWorkspaceMonthlyCapMicroUsd:5_000_000,
      providerEndpointAllowlist:[PROVIDER_URL],apiCallsEnabled:false,
      prompts:inventory.map(item=>({id:item.id,group:item.group,prerequisite:item.prerequisite===true,held:item.held??null,source:item.source??null}))};
    if(dryRun){
      await persist(output,{version:"ping.release2.eval.v1",mode:"dry-run",startedAt,finishedAt:new Date().toISOString(),world:{actorId:ACTOR,projectId:PROJECT,name:EVAL_WORLD.projectName,
        referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records:inventory.map(item=>({caseId:item.id,group:item.group,prompt:item.prompt,expectation:item.expectation,held:item.held??null,status:"not_run"})),
        finalTaskState:{taskCount:before.count,taskSha256:before.sha256},providerCalls:0,spendUsd:0});
      return {output,providerCalls:0,cases:inventory.length,dryRun:true};
    }
    if(args.has("--action-check")){
      const database=drizzle(fixture.client,{schema}) as AssistantDatabase;
      const store=createAssistantStore(database,{now:()=>Date.parse(`${EVAL_WORLD.referenceDate}T09:12:00.000+01:00`)});
      const planner={plan:async()=>({model:"synthetic-action-check",requestId:"r2eval_actioncheck1",usage:null,plan:{version:"ping.assistant.v1" as const,
        outcome:"plan" as const,mode:"draft" as const,actions:[{id:"step_action_check",kind:"create_tasks" as const,project:{kind:"current" as const},tasks:[{
          title:"Synthetic action adapter proof",description:"Local action-check fixture only.",assignees:[{kind:"self" as const}],dueDate:null}]}]}})};
      const service=createAssistantService({store,planner,requireApproval:true,...planAuthorizationFor(database),context:contextFor.bind(null,database),
        validateSources:(actorId,sources)=>validateSourcesFor(database,actorId,sources),
        execute:input=>executeAssistantAction({...input,directMessagesEnabled:true,now:()=>Date.parse(`${EVAL_WORLD.referenceDate}T09:12:00.000+01:00`)}),
        undo:(tx,actorId,result)=>executeAssistantUndo(tx,actorId,result.reversal!)});
      const beforeAction=await taskDigest(fixture.client);
      const draft=await service.submit(ACTOR,{requestId:"r2eval_actioncheck1",text:"Create one synthetic action-check task.",scope:{kind:"project",projectId:PROJECT},mode:"draft"});
      const afterDraft=await taskDigest(fixture.client);
      if(draft.status!=="ready"||draft.steps.length!==1||beforeAction.allRowsSha256!==afterDraft.allRowsSha256)throw new Error("synthetic_action_draft_invalid");
      const applied=await service.apply(ACTOR,draft.id);
      const afterApply=await taskDigest(fixture.client);
      if(applied.status!=="completed"||afterApply.count!==beforeAction.count+1||afterApply.archivedCount!==beforeAction.archivedCount)throw new Error("synthetic_action_apply_invalid");
      const undone=await service.undo(ACTOR,draft.id,applied.steps[0].id);
      const afterUndo=await taskDigest(fixture.client);
      if(undone.status!=="completed"||afterUndo.sha256!==beforeAction.sha256||afterUndo.count!==beforeAction.count||afterUndo.archivedCount!==beforeAction.archivedCount+1)
        throw new Error(`synthetic_action_undo_invalid:${undone.status}:${afterUndo.count===beforeAction.count?"active_count_restored":"active_count_differs"}:${undone.steps[0]?.undoResult?.status??"no_undo_receipt"}`);
      await persist(output,{version:"ping.release2.eval.v1",mode:"synthetic-action-check",startedAt,finishedAt:new Date().toISOString(),providerCalls:0,spendUsd:0,
        world:{actorId:ACTOR,projectId:PROJECT,name:EVAL_WORLD.projectName,syntheticOnly:true,guestOrCoupleDataSeeded:false},
        evidence:{draftRunId:draft.id,draftNoEffect:beforeAction.allRowsSha256===afterDraft.allRowsSha256,appliedRunStatus:applied.status,taskCountBefore:beforeAction.count,
          taskCountAfterApply:afterApply.count,undoRunStatus:undone.status,restoredToBaseline:afterUndo.sha256===beforeAction.sha256,
          activeBaselineSha256:beforeAction.sha256,activeAfterDraftSha256:afterDraft.sha256,activeAfterApplySha256:afterApply.sha256,activeAfterUndoSha256:afterUndo.sha256,
          allRowsBeforeSha256:beforeAction.allRowsSha256,allRowsAfterUndoSha256:afterUndo.allRowsSha256,archivedAuditRowCount:afterUndo.archivedCount},
        note:"Actual task action and Undo adapters were exercised only in the disposable synthetic fixture; all model eval prompts remain draft-only."});
      return {output,providerCalls:0,cases:1,dryRun:false,actionCheck:true};
    }
    if(process.env.PING_RELEASE2_MODEL_EVAL_AUTHORIZED!=="1")throw new Error("provider_eval_not_authorized");
    if(process.env.VERCEL==="1"||process.env.VERCEL_ENV==="production"||process.env.NODE_ENV==="production")throw new Error("production_environment_refused");
    const rawScope=args.get("--scope-file"),keyFile=args.get("--key-file");
    if(!rawScope||!keyFile||!isAbsolute(keyFile))throw new Error("explicit_scope_and_key_file_required");
    const admission=await readAdmission(resolve(rawScope));
    // The Sonnet planner reserves its worst-case full 1M input-token ceiling before dispatch.
    const singleCallReservation=estimatePlannerMicroUsd("claude-sonnet-5-5" as PlannerModel,1_000_000,16_384);
    if(singleCallReservation>admission.maxAccountedMicroUsd||singleCallReservation>admission.keyWorkspaceMonthlyCapMicroUsd){
      records.push({caseId:"PREFLIGHT",group:"",prompt:"",expectation:"One maximum reservation must fit the explicitly admitted synthetic account and provider caps.",status:"blocked_before_key_read",
        failure:`Current product Sonnet reservation is $${(singleCallReservation/1_000_000).toFixed(2)} for one maximum-size attempt; admitted cap is $${(admission.maxAccountedMicroUsd/1_000_000).toFixed(2)}.`});
      await persist(output,{version:"ping.release2.eval.v1",mode:"authorized-preflight-blocked",startedAt,finishedAt:new Date().toISOString(),world:{actorId:ACTOR,projectId:PROJECT,
        name:EVAL_WORLD.projectName,referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records,finalTaskState:{taskCount:before.count,taskSha256:before.sha256},providerCalls:0,spendUsd:0,
        blockedReason:"One planner maximum reservation exceeds the admitted cap. No key was read and no provider request was sent."});
      return {output,providerCalls:0,cases:inventory.length,dryRun:false,blocked:true};
    }
    if(admission.maxPhysicalAttempts!==MAX_PROVIDER_ATTEMPTS)throw new Error("provider_attempt_cap_mismatch");
    // Reject malformed fixture context before reading a key or paying for any model attempt.
    const database=drizzle(fixture.client,{schema}) as AssistantDatabase;
    for(const item of inventory){
      if(item.held?.includes("Unsupported guest-chat"))continue;
      const source=caseSource(item,fixture.conversationIds);
      assistantConversationPlannerContext(await contextFor(database,ACTOR,{requestId:'r2eval_preflight',text:item.prompt,
        scope:{kind:'project',projectId:PROJECT},mode:'draft',...(source?{source}:{})}));
    }
    const apiKey=(await readFile(resolve(keyFile),"utf8")).trim();
    if(apiKey.length<20||/[\r\n\0]/.test(apiKey))throw new Error("explicit_key_file_invalid");
    const store=createAssistantStore(database,{now:()=>Date.parse(`${EVAL_WORLD.referenceDate}T09:12:00.000+01:00`)});
    let heldMicroUsd=0,accountedMicroUsd=0;
    const holds=new Map<string,number>();
    const budget={...store.budget,
      reserve:async(value:Parameters<typeof store.budget.reserve>[0])=>{
        if(accountedMicroUsd+heldMicroUsd+value.reservedMicroUsd>admission.maxAccountedMicroUsd)return false;
        const reserved=await store.budget.reserve(value);
        if(reserved){heldMicroUsd+=value.reservedMicroUsd;holds.set(value.requestId,value.reservedMicroUsd);}
        return reserved;
      },
      recordUsage:async(value:Parameters<typeof store.budget.recordUsage>[0])=>{
        await store.budget.recordUsage(value);
        if(value.state==="usage_observed"&&value.estimatedMicroUsd!==null){
          heldMicroUsd=Math.max(0,heldMicroUsd-(holds.get(value.requestId)??0));holds.delete(value.requestId);accountedMicroUsd+=value.estimatedMicroUsd;
        }
      }};
    let plannerFailure:string|undefined;
    const canonicalPlanner=createPingAssistantPlanner({apiKey,budget,deadlineMs:60_000,fetch:async(input,init)=>{
      const target=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
      if(target.href!==PROVIDER_URL||init?.method!=="POST")throw new Error("provider_endpoint_refused");
      return fetch(input,{...init,redirect:"error"});
    }});
    const planner={plan:async(...input:Parameters<typeof canonicalPlanner.plan>)=>{
      plannerFailure=undefined;
      // Persist custody before dispatch. An abrupt native-process exit must leave the
      // exact run/database discoverable; pending is never proof of no call or free usage.
      await persist(output,{version:'ping.release2.eval.v1',mode:'live-synthetic',startedAt,updatedAt:new Date().toISOString(),preflight,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records,
        pendingAttempt:{runId:input[0].runId,requestId:input[0].requestId,dispatchAndUsage:'unconfirmed_until_durable_receipt'},
        providerCalls:attempts.length,observedEstimatedMicroUsd:accountedMicroUsd,heldMicroUsd});
      try{return await canonicalPlanner.plan(...input);}
      catch(error){plannerFailure=error instanceof Error&&/^planner_[a-z_]+$/.test(error.message)?error.message:'planner_unclassified_failure';throw error;}
    }};
    const service=createAssistantService({store,planner,requireApproval:true,...planAuthorizationFor(database),execute:input=>executeAssistantAction({...input,directMessagesEnabled:true,now:()=>Date.parse(`${EVAL_WORLD.referenceDate}T09:12:00.000+01:00`)}),
      context:contextFor.bind(null,database),validateSources:(actorId,sources)=>validateSourcesFor(database,actorId,sources),undo:(tx,actorId,result)=>executeAssistantUndo(tx,actorId,result.reversal!)});
    let priorRunId:string|undefined,priorGroup="";
    const attempts:number[]=[];
    for(const item of inventory){
      if(item.held?.includes("Unsupported guest-chat")){
        records.push({caseId:item.id,group:item.group,prompt:item.prompt,expectation:item.expectation,held:item.held,status:"held_no_call_guest_boundary"});
        continue;
      }
      if(item.group!==priorGroup){priorRunId=undefined;priorGroup=item.group;}
      const requestId=`r2eval_${item.id.toLowerCase().replaceAll(/[^a-z0-9_-]/g,"_")}_${randomUUID().slice(0,8)}`;
      const source=caseSource(item,fixture.conversationIds);
      const request:AssistantRequest={requestId,text:item.prompt,scope:{kind:"project",projectId:PROJECT},mode:"draft",
        ...(source?{source}:{}),...(priorRunId?{replyToRunId:priorRunId}:{})};
      const beforeCase=await taskDigest(fixture.client),context=await contextFor(database,ACTOR,request),at=performance.now();
      const view=await service.submit(ACTOR,request);
      const elapsedMs=performance.now()-at;
      if(item.id==="B-SETUP-A2"||item.group==="B"||item.group==="C"||item.group==="G")priorRunId=view.id;
      const providerAttempt=await store.getPlannerAttempt(ACTOR,view.id).catch(()=>null);
      if(providerAttempt?.dispatched)attempts.push(1);
      const afterCase=await taskDigest(fixture.client);
      const modelPlan=view.steps.map(step=>step.plan).filter(Boolean);
      records.push({caseId:item.id,group:item.group,prompt:item.prompt,expectation:item.expectation,held:item.held,status:view.status,
        requestId,runId:view.id,modelPlan,runView:view,sourceCoverage:context.coverage,
        timing:{wallMs:elapsedMs,...view.timing},providerAttempt,usage:{estimatedCostMicrousd:view.estimatedCostMicrousd??null},
        ...(plannerFailure?{failure:plannerFailure}:{}),
        durableEffectDiff:{beforeActiveSha256:beforeCase.sha256,afterActiveSha256:afterCase.sha256,beforeAllRowsSha256:beforeCase.allRowsSha256,
          afterAllRowsSha256:afterCase.allRowsSha256,unchanged:beforeCase.allRowsSha256===afterCase.allRowsSha256}});
      if(attempts.length>MAX_PROVIDER_ATTEMPTS)throw new Error("physical_attempt_cap_exceeded");
      await persist(output,{version:"ping.release2.eval.v1",mode:"live-synthetic",startedAt,updatedAt:new Date().toISOString(),world:{actorId:ACTOR,projectId:PROJECT,
        name:EVAL_WORLD.projectName,referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records,providerCalls:attempts.length,spendUsd:records.reduce((sum,row)=>sum+Number((row.usage as {estimatedCostMicrousd?:number}|undefined)?.estimatedCostMicrousd??0)/1_000_000,0)});
    }
    const after=await taskDigest(fixture.client);
    await persist(output,{version:"ping.release2.eval.v1",mode:"live-synthetic",startedAt,finishedAt:new Date().toISOString(),world:{actorId:ACTOR,projectId:PROJECT,
      name:EVAL_WORLD.projectName,referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
      baseline:{taskCount:before.count,taskSha256:before.sha256},records,finalTaskState:{taskCount:after.count,taskSha256:after.sha256},providerCalls:attempts.length,
      spendUsd:records.reduce((sum,row)=>sum+Number((row.usage as {estimatedCostMicrousd?:number}|undefined)?.estimatedCostMicrousd??0)/1_000_000,0)});
    return {output,providerCalls:attempts.length,cases:records.length,dryRun:false};
  } finally {
    fixture?.client.close();
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  runRelease2ModelEval().then(result=>{process.stdout.write(JSON.stringify(result)+"\n");},error=>{
    // Never print arbitrary provider errors or credentials.
    process.stderr.write(`release2_eval_stopped:${error instanceof Error?error.message:"unknown"}\n`);
    process.exitCode=1;
  });
}
