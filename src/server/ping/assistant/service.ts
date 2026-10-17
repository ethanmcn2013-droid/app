import { ASSISTANT_VERSION, parseAssistantPlan, parseAssistantRequest, type AssistantAction, type AssistantActionResult, type AssistantPlan, type AssistantPlannerContext, type AssistantRequest, type AssistantRunStatus, type AssistantRunView, type AssistantStepStatus } from "@/lib/ping/assistant/contract";
import { assistantPayloadHash, assistantDeliverySummary, AssistantStoreError, type AssistantDeliveryPort, type AssistantStore, type AssistantTransaction } from "./store";

export type AssistantPlanner = {
  plan(input: { runId: string; requestId: string; text: string; context: AssistantPlannerContext; mode?:"execute"|"draft" }, signal?: AbortSignal): Promise<{ plan: AssistantPlan; model?: string; usage?: { estimatedMicroUsd: number } | null }>;
};
export type AssistantExecuteInput = {
  actorId: string; runId: string; step: AssistantAction; stepId: string; fence: number;
  commitStep: (stepId: string, fence: number, callback: (tx: AssistantTransaction) => Promise<AssistantActionResult>) => Promise<AssistantActionResult>;
  results: Record<string, AssistantActionResult>; currentProjectId?: string; selectedTaskIds?: readonly string[]; referenceDate: string;
  delivery?:AssistantDeliveryPort;
  settleTimelineResult?:AssistantStore['settleTimelineResult'];
};
export function createAssistantService(deps: {
  store: AssistantStore; planner: AssistantPlanner;
  context: (actorId: string, request: AssistantRequest) => Promise<AssistantPlannerContext>;
  execute: (input: AssistantExecuteInput) => Promise<AssistantActionResult>;
  authorizeView?: (actorId:string,run:AssistantRunView)=>Promise<boolean>;
  priorTaskResult?: (actorId:string,request:AssistantRequest)=>Promise<AssistantActionResult|null>;
  now?: () => number;
}) {
  const { store } = deps, now = deps.now ?? Date.now;
  async function view(actorId: string, runId: string): Promise<AssistantRunView> {
    const run = await store.expirePlanning(actorId, runId), rows = await store.getSteps(actorId, runId);
    if (!run.requestJson) throw new AssistantStoreError("unavailable");
    const request = parseAssistantRequest(JSON.parse(run.requestJson));
    if (!request) throw new AssistantStoreError("unavailable");
    const metadata = run.resultJson ? JSON.parse(run.resultJson) as {message?: string; model?: string; timing?: AssistantRunView["timing"]} : {};
    const effectiveDraft=request.mode==='draft'||!!run.planJson&&JSON.parse(run.planJson).plan?.mode==='draft';
    const visible:AssistantRunView = { id: run.id, requestId: run.requestId, text: request.text, scope: request.scope, mode: effectiveDraft?'draft':request.mode,
      status: (run.status === "uncertain" ? "unknown" : run.status) as AssistantRunStatus,
      ...(metadata.message ? {message: metadata.message} : {}), ...(metadata.model ? {model:metadata.model} : {}), ...(metadata.timing ? {timing:metadata.timing} : {}),
      ...(run.estimatedMicroUsd !== null ? {estimatedCostMicrousd:run.estimatedMicroUsd} : {}),
      steps: rows.map(row => ({ id: row.id, actionId: row.stepKey, kind: (JSON.parse(row.payloadJson) as AssistantAction).kind,
        status: (row.status === "pending" ? "queued" : row.status === "uncertain" ? "unknown" : row.status) as AssistantStepStatus,
        result: row.resultJson ? {...JSON.parse(row.resultJson) as AssistantActionResult,...(row.deliveryJson?{delivery:assistantDeliverySummary(JSON.parse(row.deliveryJson))}:{})} : null })),
      createdAt: new Date(run.createdAt).toISOString(), updatedAt: new Date(run.updatedAt).toISOString() };
    if(deps.authorizeView&&!await deps.authorizeView(actorId,visible))return {...visible,message:'Access changed. Result details are unavailable.',steps:visible.steps.map(step=>({...step,result:null}))};
    return visible;
  }
  async function executeRun(actorId: string, runId: string) {
    const run = await store.getRun(actorId, runId);
    if (!run.requestJson || !run.planJson) return view(actorId, runId);
    const request = parseAssistantRequest(JSON.parse(run.requestJson));
    const bound = JSON.parse(run.planJson) as {plan: AssistantPlan; referenceDate: string; priorTaskResult?:AssistantActionResult};
    if (!request || !parseAssistantPlan(bound.plan)) throw new AssistantStoreError("unavailable");
    if ((request.mode === "draft" || bound.plan.outcome==='plan'&&bound.plan.mode==='draft') && run.executionAuthorizedAt === null || run.cancelledAt !== null || ["completed","failed","clarification","partial","unknown","uncertain"].includes(run.status)) return view(actorId, runId);
    if (bound.plan.outcome !== "plan") return view(actorId, runId);
    const executionStarted = now();
    const rows = await store.getSteps(actorId, runId);
    for (const row of rows) {
      if (row.status === "completed") {
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
          results:{...(bound.priorTaskResult?{__previous:bound.priorTaskResult}:{}),...await store.getStepResults<AssistantActionResult>(actorId,runId)},referenceDate:bound.referenceDate,
          ...(request.scope.kind === "project" ? {currentProjectId:request.scope.projectId} : {}),selectedTaskIds:request.selectedTaskIds,delivery:store,settleTimelineResult:store.settleTimelineResult});
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
          if(original.code==='timeline_pending'||delivery&&(delivery.queued||delivery.unknown)){
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
      const request = parseAssistantRequest(candidate);if(!request)throw new AssistantStoreError("invalid_input");
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
        const context={...baseContext,previousTaskCount:priorTaskResult?.createdTaskIds?.length??0};
        const planned=await deps.planner.plan({runId,requestId:request.requestId,text:request.text,context,mode:request.mode},signal);
        const plan=parseAssistantPlan(planned.plan);if(!plan)throw new AssistantStoreError("invalid_input");
        if(plan.outcome!=="plan"){
          await store.finishRun(actorId,runId,plan.outcome==="clarification"?"clarification":"failed",{message:plan.message,model:planned.model,timing:{planningMs:now()-started}});
          return view(actorId,runId);
        }
        await store.bindPlan(actorId,runId,{plan,referenceDate:context.referenceDate,...(priorTaskResult?{priorTaskResult}:{})},plan.actions.map(step=>({key:step.id,payload:step})));
        await store.finishRun(actorId,runId,"ready",{model:planned.model,timing:{planningMs:now()-started}});
        if(request.mode==="draft"||plan.mode==='draft'){
          await store.finishRun(actorId,runId,"ready",{message:"Draft prepared. No actions were executed.",model:planned.model,timing:{planningMs:now()-started}});return view(actorId,runId);
        }
        return executeRun(actorId,runId);
      }catch(error){
        if(error instanceof AssistantStoreError&&error.code==="cancelled")return view(actorId,runId);
        await store.finishRun(actorId,runId,"failed",{message:"The request could not be planned. No action was started."});return view(actorId,runId);
      }
    },
    async resume(actorId:string,runId:string){
      const run=await store.expirePlanning(actorId,runId);
      if(run.requestJson&&run.planJson&&run.cancelledAt===null){
        const request=parseAssistantRequest(JSON.parse(run.requestJson)),bound=JSON.parse(run.planJson) as {referenceDate:string;priorTaskResult?:AssistantActionResult};
        for(const row of await store.getSteps(actorId,runId)){
          const prior=row.resultJson?JSON.parse(row.resultJson) as AssistantActionResult:null;
          if(!request||prior?.code!=='timeline_pending'||!['preview_timeline','read_timeline'].includes(prior.kind)||row.status!=='completed')continue;
          const result=await deps.execute({actorId,runId,step:JSON.parse(row.payloadJson),stepId:row.id,fence:row.fence,commitStep:store.commitStep,
            results:{...(bound.priorTaskResult?{__previous:bound.priorTaskResult}:{}),...await store.getStepResults<AssistantActionResult>(actorId,runId)},referenceDate:bound.referenceDate,delivery:store,settleTimelineResult:store.settleTimelineResult,
            ...(request.scope.kind==='project'?{currentProjectId:request.scope.projectId}:{}),selectedTaskIds:request.selectedTaskIds});
          if(result.status!=='completed')return view(actorId,runId);
          await store.finishRun(actorId,runId,'ready',{message:'Timeline is ready.'});
        }
      }
      return executeRun(actorId,runId);
    },
    async apply(actorId:string,runId:string){await store.authorizeDraft(actorId,runId);return executeRun(actorId,runId);},
    async cancel(actorId:string,runId:string){await store.cancelRun(actorId,runId);return view(actorId,runId);},
    version:ASSISTANT_VERSION,
  };
}
