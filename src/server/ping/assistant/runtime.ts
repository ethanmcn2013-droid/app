import "server-only";
import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { isDemoMode } from "@/lib/access-mode";
import { assistantTarget, assistantTargetAdmits, createAssistantAuthentication } from "./controls";
import { assistantDatabaseTransaction, createAssistantStore } from "./store";
import { createAssistantService,assistantUnchangedSources } from "./service";
import type { AssistantSource } from '@/lib/ping/assistant/release2';
import { createPingAssistantPlanner } from "./claude-planner";
import { pingAssistantApiKey } from "./provider-key";
import { assertAssistantActor, authorizeAssistantProject, getAssistantContext,resolveAssistantProjectName,AssistantActionRefusal,type AssistantActionTransaction } from "./context";
import { assistantConversationAdapter } from './conversation-transaction';
import { createAssistantConversationContext } from './conversation-context';
import { executeAssistantUndo } from './undo';
import { executeAssistantAction } from "./actions";
import { prepareAssistantTimeline } from "./timeline";
import { createAssistantDispatcher } from "./dispatch";
import { pingTelemetrySpan } from "../telemetry";
import {parseAssistantRequest,type AssistantActionResult } from "@/lib/ping/assistant/contract";
import {sameAssistantRoom} from './conversation-memory';
import { guardAssistantCommitStep } from "./runtime-admission";
import { resolveConversationControls } from '@/lib/conversations/flags';
import { loadAssistantTaskContext, validateAssistantTaskSources } from './task-context';
import { bindAssistantPlanTargets } from './plan-targets';
import { projectDriveSubfolderServiceFromEnv } from '@/server/connections/project-drive-subfolders';
import type { AssistantExecuteInput } from './service';
import {validateAssistantTaskPostImages} from './task-snapshot';

type Target = NonNullable<ReturnType<typeof assistantTarget>>;
const currentTarget = () => assistantTarget(process.env, isDemoMode());
type Instance = ReturnType<typeof createInstance>;
const shared = globalThis as typeof globalThis & { pingAssistantRuntime?: { key: string; instance: Instance } };

function createInstance(target: Target) {
  const client = createClient({ url: target.url, authToken: target.authToken });
  const database = drizzle(client, { schema });
  const store = createAssistantStore(database);
  const stillCurrent = () => currentTarget()?.cacheKey === target.cacheKey;
  const transact = <T>(operation: Parameters<typeof database.transaction<T>>[0]) => {
    if (!stillCurrent()) throw new Error("assistant_configuration_changed");
    return assistantDatabaseTransaction(database, tx => {
      if (!stillCurrent()) throw new Error("assistant_configuration_changed");
      return operation(tx);
    });
  };
  const key = pingAssistantApiKey(process.env);
  // One instance retains transport quarantine after a logical timeout. Changing
  // credentials requires restart; old result reads remain available meanwhile.
  const planner = key ? createPingAssistantPlanner({ apiKey: key, fetch, budget: store.budget, retainCompletion: completion => after(() => completion) }) : null;
  const dispatcher = createAssistantDispatcher(database);
  async function validateSources(tx:AssistantActionTransaction,actorId:string,sources:readonly AssistantSource[]){
    const chat=sources.filter(source=>source.kind!=='task'),task=sources.filter(source=>source.kind==='task');
    if(chat.length&&!await createAssistantConversationContext(assistantConversationAdapter(tx),{directMessagesEnabled:resolveConversationControls(process.env).directMessagesEnabled}).validate(actorId,chat))return false;
    for(const zone of new Set(task.map(source=>source.timeZone??'UTC'))){
      if(!await validateAssistantTaskSources(tx,actorId,task.filter(source=>(source.timeZone??'UTC')===zone),zone))return false;
    }
    return true;
  }
  const authorizeExecution = async (input: AssistantExecuteInput, tx: AssistantActionTransaction) => {
    if(!stillCurrent())throw new AssistantActionRefusal('unavailable');
        const selector='targets' in input.step?input.step.targets:'parent' in input.step?input.step.parent:undefined;
        if(selector&&selector.kind!=='created'&&'project' in input.step&&input.step.project.kind!=='created'&&!input.boundTaskTargets?.[input.step.id])throw new AssistantActionRefusal('stale');
        for(const projectId of input.authorizationProjects??[])await authorizeAssistantProject(tx,input.actorId,projectId);
        const ordered=(input.actionOrder??[]).flatMap(id=>input.results[id]?[input.results[id]]:[]);
        if(!await validateAssistantTaskPostImages(tx,input.actorId,input.authorizationSources??[],ordered))throw new AssistantActionRefusal('stale');
        const sources=assistantUnchangedSources(input.authorizationSources??[],Object.values(input.results));
        if(sources.length&&!await validateSources(tx,input.actorId,sources))throw new AssistantActionRefusal('stale');
  };
  const service = createAssistantService({ store,requireApproval:true,
    planner: { plan: (input, signal) => {
      if (!planner || !stillCurrent() || pingAssistantApiKey(process.env) !== key) throw new Error("planner_unavailable");
      return pingTelemetrySpan("prepare", () => planner.plan(input, signal ?? new AbortController().signal));
    } },
    priorTaskResult: async (actorId, request) => {
      if (request.scope.kind !== "project") return null;
      let priorId=request.replyToRunId;
      const visited=new Set<string>();
      while(priorId&&visited.size<8){
        if(visited.has(priorId))return null;visited.add(priorId);
        const run=await store.getRun(actorId,priorId);
        const priorRequest=run.requestJson?parseAssistantRequest(JSON.parse(run.requestJson)):null;
        if(!priorRequest||!sameAssistantRoom(request,priorRequest))return null;
        priorId=priorRequest.replyToRunId;
        const results = Object.values(await store.getStepResults<AssistantActionResult>(actorId, run.id));
        const prior = results.filter(result => result.kind === "create_tasks" && result.status === "completed" && !result.undoResult && result.createdTaskIds?.length &&
          (request.scope.kind !== "project" || result.projectId === request.scope.projectId)).at(-1);
        if (!prior?.projectId) continue;
        try { await transact(tx => authorizeAssistantProject(tx, actorId, prior.projectId!)); return prior; } catch { return null; }
      }
      return null;
    },
    context: (actorId, request) => transact(async tx => {
      const actor = await assertAssistantActor(tx, actorId);
      const context = await getAssistantContext(tx, actorId, request.scope.kind === "project" ? request.scope.projectId : null);
      if(context.project&&'archived' in context.project&&context.project.archived){
        if(request.source)throw new AssistantActionRefusal('unavailable');
        return {actorName:actor.name??'You',projectName:context.project.name,
          projects:context.projects.map(project=>({name:project.name,archived:project.archivedAt!==null,canManageProject:project.role==='owner'})),members:[],
          selectedTaskCount:0,previousTaskCount:0,referenceDate:new Date().toISOString().slice(0,10),timeZone:'UTC',
          sources:[],tasks:[],coverage:'Archived Project management only. Task and chat content has not been read.',needsYouState:'not_checked' as const};
      }
      const conversations=await createAssistantConversationContext(assistantConversationAdapter(tx),{directMessagesEnabled:resolveConversationControls(process.env).directMessagesEnabled}).load(actorId,request);
      const [preferences] = await tx.select({ timeZone: schema.userPreferences.timeZone }).from(schema.userPreferences).where(eq(schema.userPreferences.userId, actorId)).limit(1);
      let timeZone = preferences?.timeZone ?? "UTC";
      if (context.project) {
        const [period] = await tx.select({ timeZone: schema.planningPeriods.timezone }).from(schema.workspaces)
          .innerJoin(schema.planningPeriods, eq(schema.planningPeriods.id, schema.workspaces.planningPeriodId)).where(eq(schema.workspaces.id, context.project.id)).limit(1);
        timeZone = period?.timeZone ?? timeZone;
      }
      try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { timeZone = "UTC"; }
      const folderContext=/\b(?:folder|folders|drive|directory)\b/i.test(request.text);
      const configured=folderContext&&context.projects.length?await tx.select({projectId:schema.workspaceStorage.workspaceId}).from(schema.workspaceStorage).where(and(eq(schema.workspaceStorage.isCurrent,true),inArray(schema.workspaceStorage.workspaceId,context.projects.map(project=>project.id)))):[];
      const configuredIds=new Set(configured.map(row=>row.projectId));
      const taskContext=await loadAssistantTaskContext(tx,actorId,request,timeZone);
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const day = (kind: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === kind)!.value;
      return { actorName: actor.name ?? "You", projectName: context.project?.name ?? null, projects: context.projects.map(p => ({ name: p.name, archived: p.archivedAt!==null,canManageProject:p.role==='owner',...(folderContext?{driveFolder:configuredIds.has(p.id)?'configured' as const:'unavailable' as const}:{}) })),
        members: taskContext.members, selectedTaskCount: request.selectedTaskIds?.length ?? 0,
        previousTaskCount: 0, referenceDate: `${day("year")}-${day("month")}-${day("day")}`, timeZone,
        sources:[...conversations.sources,...taskContext.sources],coverage:`${taskContext.coverage} ${conversations.coverage}`.slice(0,1000),
        ...(conversations.needsYou ? { needsYou: conversations.needsYou } : {}),
        ...(conversations.needsYouTotal !== undefined ? { needsYouTotal: conversations.needsYouTotal } : {}),
        ...(conversations.needsYouComplete !== undefined ? { needsYouComplete: conversations.needsYouComplete } : {}),
        needsYouState:conversations.needsYouState,
        ...(conversations.selectedSource ? { selectedSource: conversations.selectedSource } : {}),
        tasks:taskContext.tasks };
    }),
    validateSources:(actorId,sources)=>transact(tx=>validateSources(tx,actorId,sources)),
    undo:(tx,actorId,result)=>{
      if(!stillCurrent()||!result.reversal)throw new Error('assistant_configuration_changed');
      return pingTelemetrySpan('execute',()=>executeAssistantUndo(tx,actorId,result.reversal!,{directMessagesEnabled:resolveConversationControls(process.env).directMessagesEnabled}));
    },
    authorizePlan:(actorId,request,plan)=>transact(async tx=>{
      await assertAssistantActor(tx,actorId);
      const ids=new Set<string>();
      for(const step of plan.actions){
        if(!('project' in step)||step.project.kind==='created')continue;
        if(step.project.kind==='current'){
          if(request.scope.kind!=='project')throw new Error('assistant_project_unavailable');
          await authorizeAssistantProject(tx,actorId,request.scope.projectId,['archive_project','create_drive_subfolder'].includes(step.kind)?'manageProject':'open');ids.add(request.scope.projectId);
        }else ids.add((await resolveAssistantProjectName(tx,actorId,step.project.name,step.kind==='archive_project'?'manageProject':'open')).id);
      }
      return [...ids];
    }),
    bindTargets:async(actorId,request,plan,priorTaskResult)=>{
      const bound=await transact(tx=>bindAssistantPlanTargets(tx,{actorId,plan,currentProjectId:request.scope.kind==='project'?request.scope.projectId:undefined,selectedTaskIds:request.selectedTaskIds,priorTaskResult}));
      const result={...bound};
      for(const step of plan.actions){
        if(step.kind!=='create_drive_subfolder')continue;
        const target=result[step.id];if(!target)throw new AssistantActionRefusal('stale');
        const driveFolder=await projectDriveSubfolderServiceFromEnv().bind({projectId:target.projectId,actorUserId:actorId,folderName:step.folderName});
        result[step.id]={...target,driveFolder};
      }
      return result;
    },
    authorizeView: (actorId, run,authorizationProjects=[]) => transact(async tx => {
      try {
        await assertAssistantActor(tx, actorId);
        const projects = new Set([...authorizationProjects,...run.steps.flatMap(s => s.result?.projectId ? [s.result.projectId] : [])]);
        if (run.scope.kind === "project") projects.add(run.scope.projectId);
        for(const {plan} of run.steps)if(plan&&'project' in plan&&plan.project.kind==='name')projects.add((await resolveAssistantProjectName(tx,actorId,plan.project.name)).id);
        for (const projectId of projects) {
          const lifecycle=run.steps.some(step=>step.kind==='archive_project'&&step.result?.projectId===projectId);
          await authorizeAssistantProject(tx,actorId,projectId,lifecycle?'manageProject':'open');
        }
        return true;
      } catch { return false; }
    }),
    execute: input => pingTelemetrySpan("execute", () => executeAssistantAction({ ...input,directMessagesEnabled:resolveConversationControls(process.env).directMessagesEnabled,
      commitStep:guardAssistantCommitStep(input.commitStep,stillCurrent,async tx=>{
        await authorizeExecution(input,tx);
      }), dispatch: dispatcher, deliveryTransaction: transact,
      driveFolders: projectDriveSubfolderServiceFromEnv(),
      guardDriveFolderAttempt: async transaction => {
        const guard = async (tx: AssistantActionTransaction) => {
          await authorizeExecution(input,tx);
          const [run]=await tx.select().from(schema.assistantRuns).where(eq(schema.assistantRuns.id,input.runId)).limit(1);
          if(!run||run.actorId!==input.actorId||run.cancelledAt!==null||run.executionAuthorizedAt===null)throw new AssistantActionRefusal('unavailable');
          const binding=input.boundTaskTargets?.[input.step.id];
          if(!binding?.projectState)throw new AssistantActionRefusal('stale');
          const project=await authorizeAssistantProject(tx,input.actorId,binding.projectId,'manageProject');
          if(project.revision!==binding.projectState.revision||project.archivedAt!==null)throw new AssistantActionRefusal('stale');
        };
        if(transaction)await guard(transaction);else await transact(guard);
      },
      prepareTimeline: action => prepareAssistantTimeline(action, (actorId, projectId) => transact(async tx => {
        const actor = await assertAssistantActor(tx, actorId), project = await authorizeAssistantProject(tx, actorId, projectId);
        const owner = await assertAssistantActor(tx, project.ownerUserId!);
        if (!actor.clerkId || !owner.clerkId) throw new Error("timeline_identity_unavailable");
        return { clerkId: actor.clerkId, ownerClerkId: owner.clerkId, id: project.id, slug: project.slug, name: project.name };
      })) })),
  });
  return { database, service, transact };
}

function instance(target: Target) {
  const prior = shared.pingAssistantRuntime;
  if (prior) return prior.key === target.cacheKey ? prior.instance : null;
  const created = createInstance(target); shared.pingAssistantRuntime = { key: target.cacheKey, instance: created }; return created;
}
export const authenticateAssistantActor = createAssistantAuthentication({ target: currentTarget,
  session: async () => { const session = await auth(); return { userId: session.userId, sessionId: session.sessionId }; },
  resolveActor: async (clerkId, target) => {
    const runtime = instance(target); if (!runtime) return null;
    return runtime.transact(async tx => {
      const [user] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.clerkId, clerkId)).limit(1);
      if (!user) return null;
      await assertAssistantActor(tx, user.id); return user.id;
    });
  },
});
export async function getAssistantService(actorId: string) {
  const target = currentTarget(); return assistantTargetAdmits(target, actorId) ? instance(target!)?.service ?? null : null;
}
