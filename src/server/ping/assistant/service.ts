import { ASSISTANT_VERSION, parseAssistantPlan, parseAssistantRequest, type AssistantAction, type AssistantActionResult, type AssistantPlan, type AssistantPlannerContext, type AssistantRequest, type AssistantRunStatus, type AssistantRunView, type AssistantStepStatus } from "@/lib/ping/assistant/contract";
import { assistantPayloadHash, assistantDeliverySummary, AssistantStoreError, type AssistantDeliveryPort, type AssistantStore, type AssistantTransaction } from "./store";
import type { AssistantSource, AssistantVisibleCitation, AssistantUndoResult } from '@/lib/ping/assistant/release2';
import { loadAssistantMemory, editAssistantPlan } from './conversation-memory';
import { isAssistantDriveFolderPending } from '@/lib/ping/assistant/drive-folder';
import type { BoundAssistantTaskTarget } from './plan-targets';

export type AssistantPlanner = {
  plan(input: { runId: string; requestId: string; text: string; context: AssistantPlannerContext; mode?:"execute"|"draft" }, signal?: AbortSignal): Promise<{ plan: AssistantPlan; model?: string; usage?: { estimatedMicroUsd: number } | null }>;
};
export type AssistantBoundTaskTargets=Readonly<Record<string,BoundAssistantTaskTarget>>;
export type AssistantExecuteInput = {
  actorId: string; runId: string; step: AssistantAction; stepId: string; fence: number;
  commitStep: (stepId: string, fence: number, callback: (tx: AssistantTransaction) => Promise<AssistantActionResult>) => Promise<AssistantActionResult>;
  results: Record<string, AssistantActionResult>; currentProjectId?: string; selectedTaskIds?: readonly string[]; referenceDate: string; timeZone?:string; directMessagesEnabled?:boolean; authorizationProjects?:readonly string[]; authorizationSources?:readonly AssistantSource[]; boundTaskTargets?:AssistantBoundTaskTargets; actionOrder?:readonly string[];
  delivery?:AssistantDeliveryPort;
  settleTimelineResult?:AssistantStore['settleTimelineResult'];
  settleDriveFolderResult?:AssistantStore['settleDriveFolderResult'];
  driveFolderRecoveryOnly?:boolean;
};
/** A task changed by an earlier committed step is no longer compared with its pre-plan revision.
 * Its Project permission and the step's own domain guards still apply. Chat sources never get this exemption.
 */
export function assistantUnchangedSources(sources:readonly AssistantSource[],results:readonly AssistantActionResult[],forDisplay=false){
  const changed=new Set(results.filter(result=>result.status==='completed'&&(forDisplay||result.undoResult?.status!=='reverted')&&result.reversal?.kind==='tasks').flatMap(result=>result.reversal?.kind==='tasks'?result.reversal.rows.map(row=>row.id):[]));
  const lifecycleProjects=new Set(results.filter(result=>result.kind==='archive_project'&&result.status==='completed'&&result.reversal?.kind==='project_archive').map(result=>result.projectId));
  return sources.filter(source=>!lifecycleProjects.has(source.projectId)&&(source.kind!=='task'||!changed.has(source.itemId)));
}
export function createAssistantService(deps: {
  store: AssistantStore; planner: AssistantPlanner;
  context: (actorId: string, request: AssistantRequest) => Promise<AssistantPlannerContext>;
  execute: (input: AssistantExecuteInput) => Promise<AssistantActionResult>;
  authorizeView?: (actorId:string,run:AssistantRunView,authorizationProjects?:readonly string[])=>Promise<boolean>;
  authorizePlan?: (actorId:string,request:AssistantRequest,plan:Extract<AssistantPlan,{outcome:'plan'}>)=>Promise<readonly string[]>;
  bindTargets?:(actorId:string,request:AssistantRequest,plan:Extract<AssistantPlan,{outcome:'plan'}>,priorTaskResult?:AssistantActionResult)=>Promise<AssistantBoundTaskTargets>;
  priorTaskResult?: (actorId:string,request:AssistantRequest)=>Promise<AssistantActionResult|null>;
  validateSources?: (actorId:string,sources:readonly AssistantSource[])=>Promise<boolean>;
  undo?: (tx:AssistantTransaction,actorId:string,result:AssistantActionResult)=>Promise<AssistantUndoResult>;
  /** Runtime also gates recovery of pre-redesign execute-mode plans behind explicit Apply. */
  requireApproval?:boolean;
  now?: () => number;
}) {
  const { store } = deps, now = deps.now ?? Date.now;
  async function view(actorId: string, runId: string): Promise<AssistantRunView> {
    const run = await store.expirePlanning(actorId, runId), rows = await store.getSteps(actorId, runId);
    if (!run.requestJson) throw new AssistantStoreError("unavailable");
    const request = parseAssistantRequest(JSON.parse(run.requestJson));
    if (!request) throw new AssistantStoreError("unavailable");
    const metadata = run.resultJson ? JSON.parse(run.resultJson) as {message?: string; model?: string; timing?: AssistantRunView["timing"];sources?:AssistantSource[];planSources?:AssistantSource[];citations?:AssistantVisibleCitation[];authorizationProjects?:string[]} : {};
    const effectiveDraft=deps.requireApproval===true||request.mode==='draft'||!!run.planJson&&JSON.parse(run.planJson).plan?.mode==='draft';
    const visible:AssistantRunView = { id: run.id, requestId: run.requestId, text: request.text, scope: request.scope, mode: effectiveDraft?'draft':request.mode,
      status: (run.status === "uncertain" ? "unknown" : run.status) as AssistantRunStatus,
      ...(metadata.message ? {message: metadata.message} : {}), ...(metadata.model ? {model:metadata.model} : {}), ...(metadata.timing ? {timing:metadata.timing} : {}),
      ...(run.estimatedMicroUsd !== null ? {estimatedCostMicrousd:run.estimatedMicroUsd} : {}),
      planRevision:run.revision,...(request.replyToRunId?{replyToRunId:request.replyToRunId}:{}),...(request.source?{source:request.source}:{}),
      ...(metadata.citations?.length?{citations:metadata.citations}:{}),
      steps: rows.map(row => ({ id: row.id, actionId: row.stepKey, kind: (JSON.parse(row.payloadJson) as AssistantAction).kind,
        ...(run.status==='ready'?{plan:JSON.parse(row.payloadJson) as AssistantAction}:{}),
        status: (row.status === "pending" ? "queued" : row.status === "uncertain" ? "unknown" : row.status) as AssistantStepStatus,
        result: row.resultJson ? (() => {
          const original=JSON.parse(row.resultJson) as AssistantActionResult;
          const safe={...original};delete safe.reversal;delete safe.undoResult;
          if(!row.deliveryJson)return safe;
          const delivery=assistantDeliverySummary(JSON.parse(row.deliveryJson));
          return {...safe,delivery:{...delivery,suppressed:delivery.suppressed+(original.delivery?.suppressed??0)}};
        })() : null,
        ...(row.resultJson?(()=>{const result=JSON.parse(row.resultJson) as AssistantActionResult;const reversal=result.reversal;return {canUndo:!!reversal&&(reversal.kind==='tasks'?reversal.rows.length>0:reversal.kind==='project_archive'?true:reversal.items.length>0)&&result.status==='completed'&&result.undoResult?.status!=='reverted',...(result.undoResult?{undoResult:result.undoResult}:{})};})():{}) })),
      createdAt: new Date(run.createdAt).toISOString(), updatedAt: new Date(run.updatedAt).toISOString() };
    const authorizationProjects=metadata.authorizationProjects??(run.planJson?JSON.parse(run.planJson).authorizationProjects:undefined);
    const planSources:AssistantSource[]=metadata.planSources??(run.planJson?JSON.parse(run.planJson).authorizationSources:undefined)??[];
    // Display the saved/undone receipt after this run changed its own source task.
    // New effects use the stricter default in runtime's transaction-bound guard.
    const currentSources=assistantUnchangedSources(planSources,rows.flatMap(row=>row.resultJson?[JSON.parse(row.resultJson) as AssistantActionResult]:[]),true);
    const sources=[...(metadata.sources??[]),...currentSources];
    if(deps.authorizeView&&!await deps.authorizeView(actorId,visible,authorizationProjects)||sources.length&&(!deps.validateSources||!await deps.validateSources(actorId,sources)))return {...visible,accessUnavailable:true,message:'Access changed. Result details are unavailable.',citations:[],steps:visible.steps.map(step=>({...step,result:null,plan:undefined,canUndo:false}))};
    return visible;
  }
  async function executeRun(actorId: string, runId: string) {
    const run = await store.getRun(actorId, runId);
    if (!run.requestJson || !run.planJson) return view(actorId, runId);
    const request = parseAssistantRequest(JSON.parse(run.requestJson));
    const bound = JSON.parse(run.planJson) as {plan: AssistantPlan; referenceDate: string; timeZone?:string; authorizationProjects?:readonly string[];authorizationSources?:readonly AssistantSource[];boundTaskTargets?:AssistantBoundTaskTargets;priorTaskResult?:AssistantActionResult};
    if (!request || !parseAssistantPlan(bound.plan)) throw new AssistantStoreError("unavailable");
    if ((deps.requireApproval===true||request.mode === "draft" || bound.plan.outcome==='plan'&&bound.plan.mode==='draft') && run.executionAuthorizedAt === null || run.cancelledAt !== null || ["completed","failed","clarification","partial","unknown","uncertain"].includes(run.status)) return view(actorId, runId);
    if (bound.plan.outcome !== "plan") return view(actorId, runId);
    if((await view(actorId,runId)).accessUnavailable)throw new AssistantStoreError('unavailable');
    const executionStarted = now();
    const rows = await store.getSteps(actorId, runId);
    for (const row of rows) {
      if (row.status === "completed") {
        if (row.resultJson && isAssistantDriveFolderPending(JSON.parse(row.resultJson))) {
          await store.finishRun(actorId,runId,'partial',{message:'The original folder request needs a status check. It has not been repeated.'});return view(actorId,runId);
        }
        const delivery=row.deliveryJson?assistantDeliverySummary(JSON.parse(row.deliveryJson)):(row.resultJson?JSON.parse(row.resultJson).delivery:null);
        if(delivery){if(delivery.queued||delivery.unknown){
          await store.finishRun(actorId,runId,'partial',{message:delivery.unknown?'Local changes are saved. Some delivery outcomes are unconfirmed; messages have not been repeated.':'Local changes are saved. Message delivery is still queued or in progress.'});return view(actorId,runId);
        }}continue;
      }
      if (row.resultJson || !["pending","running"].includes(row.status)) return view(actorId, runId);
      let fence: number;
      try { fence = (await store.claimStep({actorId,runId,stepId:row.id})).fence; }
      catch (error) {
        if (error instanceof AssistantStoreError && error.code === "busy") return view(actorId, runId);
        if (error instanceof AssistantStoreError && error.code === "cancelled") return view(actorId, runId);
        if (error instanceof AssistantStoreError && error.code === "uncertain") {
          await store.finishRun(actorId,runId,"unknown",{message:"The original action outcome needs recovery. It has not been repeated."});return view(actorId,runId);
        }
        throw error;
      }
      const step = JSON.parse(row.payloadJson) as AssistantAction;
      try {
        const result = await deps.execute({actorId,runId,step,stepId:row.id,fence,commitStep:store.commitStep,
          results:{...(bound.priorTaskResult?{__previous:bound.priorTaskResult}:{}),...await store.getStepResults<AssistantActionResult>(actorId,runId)},referenceDate:bound.referenceDate,timeZone:bound.timeZone??'UTC',authorizationProjects:bound.authorizationProjects,authorizationSources:bound.authorizationSources,boundTaskTargets:bound.boundTaskTargets,actionOrder:bound.plan.actions.map(action=>action.id),
          ...(request.scope.kind === "project" ? {currentProjectId:request.scope.projectId} : {}),selectedTaskIds:request.selectedTaskIds,delivery:store,settleTimelineResult:store.settleTimelineResult,settleDriveFolderResult:store.settleDriveFolderResult});
        if(isAssistantDriveFolderPending(result)){
          const saved=(await store.getSteps(actorId,runId)).find(value=>value.id===row.id);
          const settled=saved?.resultJson?JSON.parse(saved.resultJson) as AssistantActionResult:null;
          if(settled?.code==='drive_folder_ready'&&settled.status==='completed')continue;
          await store.finishRun(actorId,runId,'partial',{message:settled?.summary??result.summary});return view(actorId,runId);
        }
        if (result.status !== "completed") {
          await store.finishRun(actorId,runId,result.status === "unknown" ? "unknown" : "partial",{message:result.summary});return view(actorId,runId);
        }
        const persistedStep=(await store.getSteps(actorId,runId)).find(value=>value.id===row.id);
        const delivery=persistedStep?.deliveryJson?assistantDeliverySummary(JSON.parse(persistedStep.deliveryJson)):(result.delivery??{queued:0,accepted:0,unknown:0,suppressed:0});
        if(delivery.queued||delivery.unknown){
          await store.finishRun(actorId,runId,'partial',{message:delivery.unknown?'Local changes are saved. Some delivery outcomes are unconfirmed; messages have not been repeated.':'Local changes are saved. Message delivery is still queued or in progress.'});return view(actorId,runId);
        }
      } catch (error) {
        if (error instanceof AssistantStoreError && error.code === "cancelled") return view(actorId,runId);
        const saved=(await store.getSteps(actorId,runId)).find(value=>value.id===row.id);
        if(saved?.status==='completed'&&saved.resultJson){
          const original=JSON.parse(saved.resultJson) as AssistantActionResult;
          const delivery=saved.deliveryJson?assistantDeliverySummary(JSON.parse(saved.deliveryJson)):original.delivery;
          if(original.code==='timeline_pending'||isAssistantDriveFolderPending(original)||delivery&&(delivery.queued||delivery.unknown)){
            await store.finishRun(actorId,runId,'partial',{message:'Local changes are saved. A follow-up result or delivery still needs recovery.'});return view(actorId,runId);
          }
          // A committed original receipt resolves a lost adapter response. Never invoke again.
          continue;
        }
        const code = error && typeof error === "object" && "code" in error && ["unavailable","ambiguous","unsupported","stale"].includes(String(error.code)) ? String(error.code) : "execution_unknown";
        if (code !== "execution_unknown") {
          const result: AssistantActionResult={stepId:row.id,kind:step.kind,status:"blocked",summary:code === "ambiguous" ? "More than one target matches. Clarify the target to continue." : "This action could not be applied to the current authorized target.",affectedCount:0,code};
          await store.commitStep(row.id,fence,async()=>result);
          await store.finishRun(actorId,runId,"partial",{message:result.summary});
        } else {
          await store.markStep(actorId,runId,row.id,fence,"uncertain","execution_unknown",["invite_members","nudge_tasks","send_message"].includes(step.kind));
          await store.finishRun(actorId,runId,"unknown",{message:"The original action outcome is unknown. It has not been repeated."});
        }
        return view(actorId,runId);
      }
    }
    await store.finishRun(actorId,runId,"completed",{message:"The requested actions are complete.",timing:{executionMs:now()-executionStarted,totalMs:now()-run.createdAt}});
    return view(actorId,runId);
  }
  return {
    view,
    async lookup(actorId:string,requestId:string){const run=await store.getRunByRequestId(actorId,requestId);return run?view(actorId,run.id):null;},
    async history(actorId: string) { return Promise.all((await store.listRuns(actorId)).map(run=>view(actorId,run.id))); },
    async submit(actorId: string, candidate: unknown, signal?: AbortSignal) {
      const parsedRequest = parseAssistantRequest(candidate);if(!parsedRequest)throw new AssistantStoreError("invalid_input");
      const request=deps.requireApproval===true?{...parsedRequest,mode:'draft' as const}:parsedRequest;
      const started=now(),created=await store.createRun({actorId,requestId:request.requestId,requestHash:assistantPayloadHash(request),request});
      if(!created.created)return view(actorId,created.run.id);
      const runId=created.run.id;
      try {
        const candidatePrior=await deps.priorTaskResult?.(actorId,request);
        let priorTaskResult:AssistantActionResult|undefined;
        if(candidatePrior&&candidatePrior.kind==='create_tasks'&&candidatePrior.status==='completed'&&candidatePrior.projectId&&
          candidatePrior.createdTaskIds&&candidatePrior.createdTaskIds.length<=500&&new Set(candidatePrior.createdTaskIds).size===candidatePrior.createdTaskIds.length&&
          (request.scope.kind!=='project'||candidatePrior.projectId===request.scope.projectId)){
          priorTaskResult={stepId:candidatePrior.stepId,kind:'create_tasks',status:'completed',summary:'Previous created tasks',affectedCount:candidatePrior.createdTaskIds.length,projectId:candidatePrior.projectId,createdTaskIds:[...candidatePrior.createdTaskIds]};
        }
        const baseContext=await deps.context(actorId,request);
        const memory=await loadAssistantMemory(store,actorId,request,async id=>{
          const previous=await view(actorId,id);
          return previous.message!=='Access changed. Result details are unavailable.';
        });
        const context={...baseContext,previousTaskCount:priorTaskResult?.createdTaskIds?.length??0,
          ...(memory.turns.length?{memory:memory.turns}:{}),...(memory.waiting?{waitingPlan:memory.waiting.plan.actions}:{})};
        const planned=await deps.planner.plan({runId,requestId:request.requestId,text:request.text,context,mode:request.mode},signal);
        let plan=parseAssistantPlan(planned.plan);if(!plan)throw new AssistantStoreError("invalid_input");
        let supersedes:{runId:string;revision:number}|undefined;
        let referenceDate=context.referenceDate;
        let timeZone=context.timeZone;
        if(plan.outcome==='edit'){
          if(!memory.waiting)throw new AssistantStoreError('request_conflict');
          plan=editAssistantPlan(memory.waiting.plan,plan.edits);
          supersedes={runId:memory.waiting.runId,revision:memory.waiting.revision};
          referenceDate=memory.waiting.referenceDate;
          timeZone=memory.waiting.timeZone;
        }
        if(plan.outcome==='answer'){
          if(plan.basis){
            const ids=plan.basis.stepIds;
            if(!memory.waiting||new Set(ids).size!==ids.length||!ids.every(id=>memory.waiting!.plan.actions.some(action=>action.id===id)))throw new AssistantStoreError('invalid_input');
            const waiting=await store.getRun(actorId,memory.waiting.runId);
            if(waiting.revision!==memory.waiting.revision||waiting.status!=='ready'||waiting.executionAuthorizedAt!==null||waiting.cancelledAt!==null)throw new AssistantStoreError('request_conflict');
          }
          if(!plan.citations.length&&!plan.basis)throw new AssistantStoreError('invalid_input');
          const sources=context.sources??[];
          const citations=plan.citations.map(citation=>{
            const source=sources.find(value=>value.ref===citation.ref);
            if(!source||!source.body.includes(citation.quote))throw new AssistantStoreError('invalid_input');
            return {ref:source.ref,quote:citation.quote,href:source.href,authorName:source.authorName};
          });
          const used=sources.filter(source=>plan.outcome==='answer'&&plan.citations.some(citation=>citation.ref===source.ref));
          if(used.length&&(!deps.validateSources||!await deps.validateSources(actorId,used)))throw new AssistantStoreError('unavailable');
          await store.finishRun(actorId,runId,'completed',{message:plan.message,citations,sources:used,model:planned.model,timing:{planningMs:now()-started}});
          return view(actorId,runId);
        }
        if(plan.outcome!=="plan"){
          await store.finishRun(actorId,runId,plan.outcome==="clarification"?"clarification":"failed",{message:plan.message,model:planned.model,timing:{planningMs:now()-started}});
          return view(actorId,runId);
        }
        const authorizationProjects=[...new Set([...(await deps.authorizePlan?.(actorId,request,plan)??[]),...(context.sources??[]).map(source=>source.projectId)])];
        const authorizationSources=context.sources??[];
        if(authorizationSources.length&&(!deps.validateSources||!await deps.validateSources(actorId,authorizationSources)))throw new AssistantStoreError('unavailable');
        const boundTaskTargets=await deps.bindTargets?.(actorId,request,plan,priorTaskResult);
        await store.bindPlan(actorId,runId,{plan,referenceDate,timeZone,authorizationProjects,authorizationSources,...(boundTaskTargets?{boundTaskTargets}:{}),...(priorTaskResult?{priorTaskResult}:{})},plan.actions.map(step=>({key:step.id,payload:step})),supersedes);
        const draft=request.mode==="draft"||plan.mode==='draft';
        const checklistWarning=Object.values(boundTaskTargets??{}).some(target=>target.hasOpenChecklist)
          ?' Some checklist items are still open. Marking their task done will leave those items open.':'';
        await store.finishRun(actorId,runId,"ready",{authorizationProjects,planSources:authorizationSources,model:planned.model,timing:{planningMs:now()-started},
          ...(draft?{message:`Draft prepared. No actions were executed.${checklistWarning}`}:{})});
        if(draft)return view(actorId,runId);
        return executeRun(actorId,runId);
      }catch(error){
        if(error instanceof AssistantStoreError&&error.code==="cancelled")return view(actorId,runId);
        await store.finishRun(actorId,runId,"failed",{message:"The request could not be planned. No action was started."});return view(actorId,runId);
      }
    },
    async resume(actorId:string,runId:string){
      const run=await store.expirePlanning(actorId,runId);
      if(run.requestJson&&run.planJson){
        if((await view(actorId,runId)).accessUnavailable)throw new AssistantStoreError('unavailable');
        const request=parseAssistantRequest(JSON.parse(run.requestJson)),bound=JSON.parse(run.planJson) as {plan?:AssistantPlan;referenceDate:string;timeZone?:string;authorizationProjects?:readonly string[];authorizationSources?:readonly AssistantSource[];boundTaskTargets?:AssistantBoundTaskTargets;priorTaskResult?:AssistantActionResult};
        for(const row of await store.getSteps(actorId,runId)){
          const prior=row.resultJson?JSON.parse(row.resultJson) as AssistantActionResult:null;
          if(!prior&&JSON.parse(row.payloadJson).kind==='create_drive_subfolder'&&run.cancelledAt===null&&run.executionAuthorizedAt!==null){
            await store.recoverUncommittedDriveFolderStep(actorId,runId,row.id);continue;
          }
          const folderPending=isAssistantDriveFolderPending(prior);
          if(!request||row.status!=='completed'||(!folderPending&&(run.cancelledAt!==null||prior?.code!=='timeline_pending'||!['preview_timeline','read_timeline'].includes(prior.kind))))continue;
          if(folderPending&&run.executionAuthorizedAt===null)continue;
          let result=await deps.execute({actorId,runId,step:JSON.parse(row.payloadJson),stepId:row.id,fence:row.fence,commitStep:store.commitStep,
            results:{...(bound.priorTaskResult?{__previous:bound.priorTaskResult}:{}),...await store.getStepResults<AssistantActionResult>(actorId,runId)},referenceDate:bound.referenceDate,timeZone:bound.timeZone??'UTC',authorizationProjects:bound.authorizationProjects,authorizationSources:bound.authorizationSources,boundTaskTargets:bound.boundTaskTargets,actionOrder:bound.plan?.outcome==='plan'?bound.plan.actions.map(action=>action.id):[],delivery:store,settleTimelineResult:store.settleTimelineResult,
            ...(request.scope.kind==='project'?{currentProjectId:request.scope.projectId}:{}),selectedTaskIds:request.selectedTaskIds,settleDriveFolderResult:store.settleDriveFolderResult,driveFolderRecoveryOnly:run.cancelledAt!==null});
          if(folderPending&&isAssistantDriveFolderPending(result)){
            const saved=(await store.getSteps(actorId,runId)).find(value=>value.id===row.id);if(saved?.resultJson)result=JSON.parse(saved.resultJson) as AssistantActionResult;
          }
          if(isAssistantDriveFolderPending(result)||result.status!=='completed')return view(actorId,runId);
          if(result.status!=='completed')return view(actorId,runId);
          await store.finishRun(actorId,runId,'ready',{message:folderPending?'The original folder request is complete.':'Timeline is ready.'});
        }
      }
      return executeRun(actorId,runId);
    },
    async apply(actorId:string,runId:string){if((await view(actorId,runId)).accessUnavailable)throw new AssistantStoreError('unavailable');await store.authorizeDraft(actorId,runId,deps.requireApproval===true);return executeRun(actorId,runId);},
    async undo(actorId:string,runId:string,stepId:string){
      if(!deps.undo)throw new AssistantStoreError('unavailable');
      if((await view(actorId,runId)).accessUnavailable)throw new AssistantStoreError('unavailable');
      await store.undoStep(actorId,runId,stepId,(tx,result)=>deps.undo!(tx,actorId,result));
      return view(actorId,runId);
    },
    async cancel(actorId:string,runId:string){await store.cancelRun(actorId,runId);return view(actorId,runId);},
    version:ASSISTANT_VERSION,
  };
}
