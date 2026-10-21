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
const MAX_EVAL_MICRO_USD = 5_000_000;
const MAX_WORKSPACE_MICRO_USD = 10_000_000;
const PROVIDER_URL = "https://api.anthropic.com/v1/messages";

type Admission = Readonly<{ version: 2; scope: "synthetic"; purpose: "synthetic-ping-release2-eval"; model: "claude-sonnet-5-5"; actorId: "alice";
  projectId: typeof PROJECT; projectName: "The Orchard, events"; maxPhysicalAttempts: 63; maxAccountedMicroUsd: typeof MAX_EVAL_MICRO_USD; keyWorkspaceMonthlyCapMicroUsd: typeof MAX_WORKSPACE_MICRO_USD;
  externalDelivery: false; timelinePublish: false; expiresAt: string }>;
type Continuation = Readonly<{ version: 1; group: string; groups: readonly string[]; caseIds: readonly string[]; physicalAttempts: number;
  observedMicroUsd: number; unknownUsage: false; admissionSha256: string; actorId: "alice"; projectId: typeof PROJECT; model: "claude-sonnet-5-5";
  evaluationFingerprintSha256: string;
  previous: Readonly<{ path: string; sha256: string }> | null }>;
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
  if(raw.version!==2||raw.scope!=="synthetic"||raw.purpose!=="synthetic-ping-release2-eval"||raw.model!=="claude-sonnet-5-5"||raw.actorId!==ACTOR||
    raw.projectId!==PROJECT||raw.projectName!==EVAL_WORLD.projectName||raw.maxPhysicalAttempts!==MAX_PROVIDER_ATTEMPTS||raw.maxAccountedMicroUsd!==MAX_EVAL_MICRO_USD||
    raw.keyWorkspaceMonthlyCapMicroUsd!==MAX_WORKSPACE_MICRO_USD||
    raw.externalDelivery!==false||raw.timelinePublish!==false||typeof raw.expiresAt!=="string"||!Number.isFinite(Date.parse(raw.expiresAt))||Date.parse(raw.expiresAt)<=Date.now())
    throw new Error("scope_admission_invalid");
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

const GROUPS=[...new Set(RELEASE2_EVAL_CASES.map(item=>item.group))];
const EVALUATION_SOURCE_FILES=["experience/ping-assistant/release2-model-eval.ts","experience/ping-assistant/release2-model-fixture.ts",
  "src/server/ping/proof-fixture.ts","src/server/ping/assistant/store.ts","src/server/ping/assistant/service.ts","src/server/ping/assistant/claude-planner.ts",
  "src/server/ping/assistant/planner-budget.ts","src/server/ping/assistant/planner-attempt-metadata.ts","src/server/ping/assistant/conversation-memory.ts",
  "src/server/ping/assistant/task-snapshot.ts","src/server/ping/assistant/task-batch.ts","src/server/ping/assistant/task-update-batch.ts","src/server/ping/assistant/calendar-time.ts",
  "src/server/ping/assistant/context.ts","src/server/ping/assistant/conversation-context.ts","src/server/ping/assistant/task-context.ts",
  "src/server/ping/assistant/conversation-transaction.ts","src/server/ping/assistant/actions.ts","src/server/ping/assistant/undo.ts",
  "src/server/ping/assistant/plan-targets.ts","src/server/ping/assistant/planner-context.ts","src/lib/ping/assistant/contract.ts",
  "src/lib/ping/assistant/release2.ts","src/server/conversations/service.ts","src/server/conversations/task-discussion.ts","src/server/conversations/attention.ts","src/server/conversations/database.ts",
  "src/server/db/board-config-read.ts","src/server/db/schema.ts","src/server/actions/project-authz.ts","src/server/projects/project-deletion-fence.ts","src/server/account-deletion-key.ts",
  "src/server/tasks/create-task-core.ts","src/server/projects/create-project-core.ts","src/server/actions/private-task-db-write.ts",
  "package.json","pnpm-lock.yaml","docs/projects/chat-ping-redesign/ping-requests.md","docs/projects/chat-ping-redesign/ping-eval.md",
  "docs/projects/chat-ping-redesign/scorecards.md"];
function groupInventory(group:string){
  if(!GROUPS.includes(group))throw new Error("eval_group_invalid");
  return caseSequence().filter(item=>item.group===group);
}
function expectedCalls(items:readonly EvalCase[]){return items.filter(item=>!item.held?.includes("Unsupported guest-chat")).length;}
function safeRecord(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function settledCost(row:Row):number{
  const attempt=safeRecord(row.providerAttempt),usage=safeRecord(row.usage),cost=usage.estimatedCostMicrousd;
  if(attempt.dispatched!==true||attempt.physical!=="settled"||typeof cost!=="number"||!Number.isSafeInteger(cost)||cost<0)throw new Error("prior_group_has_unknown_or_unsettled_usage");
  return cost;
}
function storedOutputPath(output:string){return relative(OUTPUT_ROOT,output).split(sep).join("/");}
async function evaluationFingerprint(){
  const digest=createHash("sha256");
  for(const file of [...EVALUATION_SOURCE_FILES].sort())digest.update(file).update("\0").update(await readFile(resolve(file))).update("\0");
  return digest.digest("hex");
}

/** Verify a prior group chain from its final artifact back to A; never trust counters alone. */
async function readCompletedPrefix(rawPath:string,expectedAdmissionSha256?:string,expectedFingerprintSha256?:string):Promise<Continuation>{
  const output=assertUniqueOutputPath(rawPath),resolvedOutput=await realpath(output),resolvedRoot=await realpath(OUTPUT_ROOT),resolvedRel=relative(resolvedRoot,resolvedOutput);
  if(resolvedRel.startsWith(`..${sep}`)||resolvedRel===".."||isAbsolute(resolvedRel))throw new Error("prior_output_path_escape");
  const bytes=await readFile(resolvedOutput),document=safeRecord(JSON.parse(bytes.toString("utf8")));
  if(document.mode!=="live-synthetic"||typeof document.finishedAt!=="string"||document.pendingAttempt||document.continuationBlockedReason)
    throw new Error("prior_group_incomplete_or_pending");
  const continuation=safeRecord(document.continuation) as unknown as Continuation;
  const group=continuation.group,index=GROUPS.indexOf(group);
  const world=safeRecord(document.world);
  const baseline=safeRecord(document.baseline),finalState=safeRecord(document.finalTaskState);
  if(continuation.version!==1||index<0||continuation.unknownUsage!==false||continuation.actorId!==ACTOR||continuation.projectId!==PROJECT||
    continuation.model!=="claude-sonnet-5-5"||document.providerCalls!==continuation.physicalAttempts||
    world.actorId!==ACTOR||world.projectId!==PROJECT||world.name!==EVAL_WORLD.projectName||world.referenceDate!==EVAL_WORLD.referenceDate||world.timeZone!==EVAL_WORLD.timeZone||
    world.syntheticOnly!==true||typeof baseline.taskSha256!=="string"||baseline.taskSha256!==finalState.taskSha256||baseline.taskCount!==finalState.taskCount||
    document.sourceFingerprintSha256!==continuation.evaluationFingerprintSha256||
    continuation.admissionSha256!==expectedAdmissionSha256&&expectedAdmissionSha256!==undefined||
    typeof continuation.evaluationFingerprintSha256!=="string"||continuation.evaluationFingerprintSha256!==expectedFingerprintSha256&&expectedFingerprintSha256!==undefined)
    throw new Error("prior_group_scope_or_admission_mismatch");
  const expectedGroups=GROUPS.slice(0,index+1);
  if(JSON.stringify(continuation.groups)!==JSON.stringify(expectedGroups)||JSON.stringify(continuation.caseIds)!==JSON.stringify(groupInventory(group).map(item=>item.id)))
    throw new Error("prior_group_prefix_invalid");
  const records=Array.isArray(document.records)?document.records.map(value=>safeRecord(value) as unknown as Row):[];
  const expectedRows=groupInventory(group);
  if(JSON.stringify(records.map(row=>row.caseId))!==JSON.stringify(expectedRows.map(item=>item.id)))throw new Error("prior_group_cases_incomplete");
  for(let i=0;i<records.length;i++){
    const row=records[i],expected=expectedRows[i];
    if(row.group!==expected.group||row.prompt!==expected.prompt||row.expectation!==expected.expectation||(row.held??null)!==(expected.held??null))
      throw new Error("prior_group_prompt_inventory_mismatch");
  }
  let ownAttempts=0,ownCost=0;
  for(let i=0;i<records.length;i++){
    const expected=groupInventory(group)[i];
    if(expected.held?.includes("Unsupported guest-chat")){
      if(records[i].status!=="held_no_call_guest_boundary"||records[i].providerAttempt)throw new Error("held_case_must_not_call_provider");
      continue;
    }
    ownCost+=settledCost(records[i]);ownAttempts++;
  }
  if(ownAttempts!==expectedCalls(groupInventory(group)))throw new Error("prior_group_attempt_count_mismatch");
  const previous=continuation.previous;
  let previousAttempts=0,previousCost=0;
  if(index===0){if(previous!==null)throw new Error("prior_group_a_must_not_have_parent");}
  else{
    if(!previous||typeof previous.path!=="string"||typeof previous.sha256!=="string")throw new Error("prior_group_missing_parent");
    const parentPath=assertUniqueOutputPath(resolve(OUTPUT_ROOT,previous.path));
    const parentRealPath=await realpath(parentPath),parentRealRel=relative(resolvedRoot,parentRealPath);
    if(parentRealRel.startsWith(`..${sep}`)||parentRealRel===".."||isAbsolute(parentRealRel))throw new Error("prior_output_path_escape");
    const parentBytes=await readFile(parentRealPath);
    if(createHash("sha256").update(parentBytes).digest("hex")!==previous.sha256)throw new Error("prior_group_hash_mismatch");
    const parent=await readCompletedPrefix(parentPath,continuation.admissionSha256,continuation.evaluationFingerprintSha256);
    if(parent.group!==GROUPS[index-1])throw new Error("prior_group_sequence_gap");
    previousAttempts=parent.physicalAttempts;previousCost=parent.observedMicroUsd;
  }
  if(continuation.physicalAttempts!==previousAttempts+ownAttempts||continuation.observedMicroUsd!==previousCost+ownCost||
    continuation.physicalAttempts>MAX_PROVIDER_ATTEMPTS||!Number.isSafeInteger(continuation.observedMicroUsd)||
    continuation.observedMicroUsd>MAX_EVAL_MICRO_USD||continuation.observedMicroUsd>MAX_WORKSPACE_MICRO_USD)throw new Error("prior_group_cumulative_usage_invalid");
  return continuation;
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
  const actionCheck=args.has("--action-check");
  const requestedGroup=args.get("--group");
  const rawPriorResults=args.get("--prior-results");
  if(rawPriorResults&&!requestedGroup)throw new Error("prior_results_require_group");
  if(requestedGroup&&!actionCheck){
    if(!GROUPS.includes(requestedGroup))throw new Error("eval_group_invalid");
    if(requestedGroup==="A"&&rawPriorResults)throw new Error("group_a_must_start_fresh");
    if(requestedGroup!=="A"&&!rawPriorResults)throw new Error("prior_group_results_required");
  }
  if(!dryRun&&!actionCheck&&!requestedGroup)throw new Error("live_eval_requires_one_group_per_process");
  const sourceFingerprintSha256=await evaluationFingerprint();
  let priorContinuation:Continuation|undefined;
  let priorResultPath:string|undefined,priorResultSha256:string|undefined;
  if(requestedGroup&&rawPriorResults){
    priorResultPath=assertUniqueOutputPath(rawPriorResults);
    priorResultSha256=createHash("sha256").update(await readFile(priorResultPath)).digest("hex");
    priorContinuation=await readCompletedPrefix(priorResultPath,undefined,sourceFingerprintSha256);
    if(GROUPS.indexOf(priorContinuation.group)!==GROUPS.indexOf(requestedGroup)-1)throw new Error("prior_group_is_not_exact_predecessor");
  }
  if(requestedGroup){
    const projectedCalls=(priorContinuation?.physicalAttempts??0)+expectedCalls(groupInventory(requestedGroup));
    if(projectedCalls>MAX_PROVIDER_ATTEMPTS)throw new Error("provider_attempt_cap_exceeded_by_group_chain");
    const maxReservation=estimatePlannerMicroUsd("claude-sonnet-5-5" as PlannerModel,1_000_000,16_384);
    if((priorContinuation?.observedMicroUsd??0)+maxReservation>Math.min(MAX_EVAL_MICRO_USD,MAX_WORKSPACE_MICRO_USD))
      throw new Error("group_chain_max_reservation_exceeds_cap");
  }
  const startedAt=new Date().toISOString();
  let fixture:Awaited<ReturnType<typeof createRelease2SyntheticWorld>>|undefined;
  const records:Row[]=[];
  try{
    fixture=await createRelease2SyntheticWorld();
    const before=await taskDigest(fixture.client);
    const inventory=requestedGroup?groupInventory(requestedGroup):caseSequence();
    const preflight:Record<string,unknown>={required:62,selectedGroup:requestedGroup??null,groupRequired:requestedGroup?inventory.length:null,
      groupExpectedCalls:requestedGroup?expectedCalls(inventory):null,expectedPhysicalCalls:expectedCalls(inventory),maximumChainPhysicalCalls:MAX_PROVIDER_ATTEMPTS,
      evaluationSpendCapMicroUsd:MAX_EVAL_MICRO_USD,workspaceMonthlyCapMicroUsd:MAX_WORKSPACE_MICRO_USD,
      databasePath:fixture.databasePath,providerEndpointAllowlist:[PROVIDER_URL],apiCallsEnabled:false,
      prompts:inventory.map(item=>({id:item.id,group:item.group,prerequisite:item.prerequisite===true,held:item.held??null,source:item.source??null}))};
    if(dryRun){
      await persist(output,{version:"ping.release2.eval.v1",mode:"dry-run",startedAt,finishedAt:new Date().toISOString(),world:{actorId:ACTOR,projectId:PROJECT,name:EVAL_WORLD.projectName,
        referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
        sourceFingerprintSha256,continuationPreflight:priorContinuation?{lastCompletedGroup:priorContinuation.group,cumulativePhysicalAttempts:priorContinuation.physicalAttempts,cumulativeObservedMicroUsd:priorContinuation.observedMicroUsd,
          admissionSha256:priorContinuation.admissionSha256}:null,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records:inventory.map(item=>({caseId:item.id,group:item.group,prompt:item.prompt,expectation:item.expectation,held:item.held??null,status:"not_run"})),
        finalTaskState:{taskCount:before.count,taskSha256:before.sha256},providerCalls:0,spendUsd:0});
      return {output,providerCalls:0,cases:inventory.length,dryRun:true,group:requestedGroup??null};
    }
    if(actionCheck){
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
    const admissionSha256=createHash("sha256").update(await readFile(resolve(rawScope))).digest("hex");
    if(priorContinuation&&priorContinuation.admissionSha256!==admissionSha256)throw new Error("prior_group_admission_hash_mismatch");
    const previousAttempts=priorContinuation?.physicalAttempts??0,previousCost=priorContinuation?.observedMicroUsd??0;
    const effectiveCap=Math.min(admission.maxAccountedMicroUsd,admission.keyWorkspaceMonthlyCapMicroUsd,MAX_EVAL_MICRO_USD,MAX_WORKSPACE_MICRO_USD);
    // The planner reserves its worst-case full 1M input-token ceiling before dispatch.
    const singleCallReservation=estimatePlannerMicroUsd("claude-sonnet-5-5" as PlannerModel,1_000_000,16_384);
    if(previousCost+singleCallReservation>effectiveCap){
      records.push({caseId:"PREFLIGHT",group:"",prompt:"",expectation:"One maximum reservation must fit the explicitly admitted synthetic account and provider caps.",status:"blocked_before_key_read",
        failure:`Current product Sonnet reservation is $${(singleCallReservation/1_000_000).toFixed(2)} for one maximum-size attempt; remaining admitted cap is $${((effectiveCap-previousCost)/1_000_000).toFixed(2)}.`});
      await persist(output,{version:"ping.release2.eval.v1",mode:"authorized-preflight-blocked",startedAt,finishedAt:new Date().toISOString(),world:{actorId:ACTOR,projectId:PROJECT,
        name:EVAL_WORLD.projectName,referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records,finalTaskState:{taskCount:before.count,taskSha256:before.sha256},providerCalls:previousAttempts,spendUsd:previousCost/1_000_000,
        blockedReason:"One planner maximum reservation exceeds the admitted cap. No key was read and no provider request was sent."});
      return {output,providerCalls:0,cases:inventory.length,dryRun:false,blocked:true};
    }
    if(admission.maxPhysicalAttempts!==MAX_PROVIDER_ATTEMPTS||previousAttempts+expectedCalls(inventory)>MAX_PROVIDER_ATTEMPTS)throw new Error("provider_attempt_cap_exceeded_by_group_chain");
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
    let heldMicroUsd=0,accountedMicroUsd=previousCost;
    const attempts:number[]=[];
    const holds=new Map<string,number>();
    const budget={...store.budget,
      reserve:async(value:Parameters<typeof store.budget.reserve>[0])=>{
        if(accountedMicroUsd+heldMicroUsd+value.reservedMicroUsd>effectiveCap)return false;
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
      await persist(output,{version:'ping.release2.eval.v1',mode:'live-synthetic',startedAt,updatedAt:new Date().toISOString(),preflight,sourceFingerprintSha256,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records,continuationPreflight:priorContinuation??null,
        pendingAttempt:{runId:input[0].runId,requestId:input[0].requestId,dispatchAndUsage:'unconfirmed_until_durable_receipt'},
        providerCalls:previousAttempts+attempts.length,observedEstimatedMicroUsd:accountedMicroUsd,heldMicroUsd});
      try{return await canonicalPlanner.plan(...input);}
      catch(error){plannerFailure=error instanceof Error&&/^planner_[a-z_]+$/.test(error.message)?error.message:'planner_unclassified_failure';throw error;}
    }};
    const service=createAssistantService({store,planner,requireApproval:true,...planAuthorizationFor(database),execute:input=>executeAssistantAction({...input,directMessagesEnabled:true,now:()=>Date.parse(`${EVAL_WORLD.referenceDate}T09:12:00.000+01:00`)}),
      context:contextFor.bind(null,database),validateSources:(actorId,sources)=>validateSourcesFor(database,actorId,sources),undo:(tx,actorId,result)=>executeAssistantUndo(tx,actorId,result.reversal!)});
    let priorRunId:string|undefined,priorGroup="";
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
      if(attempts.length+previousAttempts>MAX_PROVIDER_ATTEMPTS)throw new Error("physical_attempt_cap_exceeded");
      const settled=providerAttempt?.dispatched===true&&providerAttempt.physical==="settled"&&view.estimatedCostMicrousd!==null&&view.estimatedCostMicrousd!==undefined;
      await persist(output,{version:"ping.release2.eval.v1",mode:"live-synthetic",startedAt,updatedAt:new Date().toISOString(),sourceFingerprintSha256,world:{actorId:ACTOR,projectId:PROJECT,
        name:EVAL_WORLD.projectName,referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
        baseline:{taskCount:before.count,taskSha256:before.sha256},records,continuationPreflight:priorContinuation??null,groupProgress:{group:requestedGroup,completedCases:records.length,
          expectedCases:inventory.length,cumulativePhysicalAttempts:previousAttempts+attempts.length,observedEstimatedMicroUsd:accountedMicroUsd,heldMicroUsd},
        providerCalls:previousAttempts+attempts.length,spendUsd:accountedMicroUsd/1_000_000,
        ...(!settled?{pendingAttempt:{runId:view.id,requestId,dispatchAndUsage:providerAttempt?.dispatched===true?"unconfirmed_until_durable_receipt":"not_settled"},
          continuationBlockedReason:"Current group has no fully observed settled usage receipt."}:{})});
      if(!settled)throw new Error("eval_stopped_unsettled_or_unconfirmed_attempt");
    }
    const after=await taskDigest(fixture.client);
    if(records.length!==inventory.length||attempts.length!==expectedCalls(inventory)||heldMicroUsd!==0||before.allRowsSha256!==after.allRowsSha256)
      throw new Error("eval_group_not_complete_or_draft_state_changed");
    const ownCost=records.reduce((sum,row)=>sum+(row.status==="held_no_call_guest_boundary"?0:settledCost(row)),0);
    if(accountedMicroUsd!==previousCost+ownCost||previousAttempts+attempts.length>MAX_PROVIDER_ATTEMPTS||accountedMicroUsd>effectiveCap)
      throw new Error("eval_group_cumulative_accounting_mismatch");
    if(priorResultPath&&priorResultSha256){
      await readCompletedPrefix(priorResultPath,admissionSha256,sourceFingerprintSha256);
      if(createHash("sha256").update(await readFile(priorResultPath)).digest("hex")!==priorResultSha256)throw new Error("prior_group_changed_during_run");
    }
    if(await evaluationFingerprint()!==sourceFingerprintSha256)throw new Error("evaluation_source_changed_during_run");
    const continuation:Continuation={version:1,group:requestedGroup!,groups:[...(priorContinuation?.groups??[]),requestedGroup!],
      caseIds:inventory.map(item=>item.id),physicalAttempts:previousAttempts+attempts.length,observedMicroUsd:accountedMicroUsd,unknownUsage:false,
      admissionSha256,actorId:ACTOR,projectId:PROJECT,model:"claude-sonnet-5-5",evaluationFingerprintSha256:sourceFingerprintSha256,
      previous:priorResultPath&&priorResultSha256?{path:storedOutputPath(priorResultPath),sha256:priorResultSha256}:null};
    await persist(output,{version:"ping.release2.eval.v1",mode:"live-synthetic",startedAt,finishedAt:new Date().toISOString(),sourceFingerprintSha256,world:{actorId:ACTOR,projectId:PROJECT,
      name:EVAL_WORLD.projectName,referenceDate:EVAL_WORLD.referenceDate,timeZone:EVAL_WORLD.timeZone,syntheticOnly:true,guestOrCoupleDataSeeded:false},preflight,
      baseline:{taskCount:before.count,taskSha256:before.sha256},records,continuation,finalTaskState:{taskCount:after.count,taskSha256:after.sha256},
      providerCalls:continuation.physicalAttempts,spendUsd:continuation.observedMicroUsd/1_000_000});
    return {output,providerCalls:continuation.physicalAttempts,cases:records.length,dryRun:false,group:requestedGroup};
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
