import { parsePlannerAttemptMetadata, type PlannerAttemptMetadata } from "./planner-attempt-metadata";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { db } from "@/server/db";
import { assistantRuns, assistantSteps } from "@/server/db/schema";
import {isAssistantInternalHref,type AssistantActionResult} from "@/lib/ping/assistant/contract";

export type AssistantDatabase = typeof db;
export type AssistantTransaction = Parameters<Parameters<AssistantDatabase["transaction"]>[0]>[0];
export type AssistantRun = typeof assistantRuns.$inferSelect;
export type AssistantStoredStep = typeof assistantSteps.$inferSelect;
export class AssistantStoreError extends Error {
  constructor(public readonly code: "unavailable" | "request_conflict" | "busy" | "cancelled" | "lease_lost" | "uncertain" | "invalid_input") { super(code); }
}
const admissions = new WeakMap<AssistantDatabase, { tail: Promise<void>; pending: number }>();
function admissionBusy(error: unknown): boolean {
  for (let depth=0; error && typeof error==='object' && depth<5; depth++) {
    const value=error as {code?:unknown;cause?:unknown};
    if(typeof value.code==='string' && /^SQLITE_BUSY(?:_|$)/.test(value.code))return true;
    error=value.cause;
  }
  return false;
}
/** Shared local admission only; a callback or uncertain commit is never replayed. */
export async function assistantDatabaseTransaction<T>(database: AssistantDatabase, operation: (tx: AssistantTransaction)=>Promise<T>): Promise<T> {
  let gate=admissions.get(database);
  if(!gate){gate={tail:Promise.resolve(),pending:0};admissions.set(database,gate);}
  if(gate.pending>=128)throw new AssistantStoreError('busy');
  gate.pending++;
  const previous=gate.tail;
  let release!:()=>void;
  gate.tail=new Promise<void>(resolve=>{release=resolve;});
  try {
    await previous;
    for(let attempt=0;;attempt++){
      let entered=false;
      try{return await database.transaction(async tx=>{entered=true;return operation(tx);},{behavior:'immediate'});}
      catch(error){
        if(entered||attempt>=2||!admissionBusy(error))throw error;
        await new Promise(resolve=>setTimeout(resolve,attempt===0?25:75));
      }
    }
  }finally{gate.pending--;release();}
}
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object"
  ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(value);
export const assistantPayloadHash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
export const assistantStepId = (runId: string, stepKey: string) => createHash("sha256").update(`${runId}\0${stepKey}`).digest("hex");
function json(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (!serialized || Buffer.byteLength(serialized) > 256_000) throw new AssistantStoreError("invalid_input");
  return serialized;
}
const exactHash = (value: string) => /^[a-f0-9]{64}$/.test(value);
const validId = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 128;
type Delivery = {state:"queued"|"claimed"|"accepted"|"unknown"|"suppressed";fence:number;leaseUntil?:number;providerId?:string};
export const assistantDeliverySummary = (records:Record<string,Delivery>)=>({queued:Object.values(records).filter(d=>d.state==='queued'||d.state==='claimed').length,
  accepted:Object.values(records).filter(d=>d.state==='accepted').length,unknown:Object.values(records).filter(d=>d.state==='unknown').length,suppressed:Object.values(records).filter(d=>d.state==='suppressed').length});

/** Injected database only. No auth fallback, environment, provider, UI or global DB. */
export function createAssistantStore(database: AssistantDatabase, options: { now?: () => number; uuid?: () => string } = {}) {
  const now = options.now ?? Date.now, uuid = options.uuid ?? randomUUID;
  const transaction = <T>(operation: (tx: AssistantTransaction) => Promise<T>) => assistantDatabaseTransaction(database, operation);
  async function ownRun(tx: Pick<AssistantTransaction, "select">, actorId: string, runId: string) {
    const [run] = await tx.select().from(assistantRuns).where(and(eq(assistantRuns.id, runId), eq(assistantRuns.actorId, actorId))).limit(1);
    if (!run) throw new AssistantStoreError("unavailable");
    return run;
  }
  const store = {
    async createRun(input: { actorId: string; requestId: string; requestHash: string; request?: unknown }) {
      if (!validId(input.actorId) || !validId(input.requestId) || !exactHash(input.requestHash)) throw new AssistantStoreError("invalid_input");
      return transaction(async tx => {
        const [prior] = await tx.select().from(assistantRuns).where(and(eq(assistantRuns.actorId, input.actorId), eq(assistantRuns.requestId, input.requestId))).limit(1);
        if (prior) { if (prior.requestHash !== input.requestHash) throw new AssistantStoreError("request_conflict"); return { run: prior, created: false }; }
        const [run] = await tx.insert(assistantRuns).values({ id: uuid(), actorId: input.actorId, requestId: input.requestId, requestHash: input.requestHash, requestJson: input.request ? json(input.request) : null, createdAt: now(), updatedAt: now() }).returning();
        return { run, created: true };
      });
    },
    getRun: (actorId: string, runId: string) => ownRun(database, actorId, runId),
    async expirePlanning(actorId:string,runId:string) {
      return transaction(async tx=>{
        const run=await ownRun(tx,actorId,runId);
        if(run.status==='planning'&&!run.planJson&&run.createdAt+120000<=now()){
          const [expired]=await tx.update(assistantRuns).set({status:'unknown',resultJson:json({...JSON.parse(run.resultJson??'{}'),message:'Planning stopped before a durable result was received. The original request has not been repeated.'}),updatedAt:now()}).where(eq(assistantRuns.id,runId)).returning();return expired;
        }return run;
      });
    },
    async getRunByRequestId(actorId: string, requestId: string) {
      const [run] = await database.select().from(assistantRuns).where(and(eq(assistantRuns.actorId,actorId),eq(assistantRuns.requestId,requestId))).limit(1);
      return run ?? null;
    },
    listRuns: (actorId: string) => database.select().from(assistantRuns).where(eq(assistantRuns.actorId, actorId)).orderBy(sql`${assistantRuns.createdAt} DESC`).limit(25),
    async getSteps(actorId: string, runId: string) {
      await ownRun(database, actorId, runId);
      return database.select().from(assistantSteps).where(eq(assistantSteps.runId, runId)).orderBy(assistantSteps.ordinal);
    },
    async getStepResults<Result = unknown>(actorId: string, runId: string): Promise<Record<string, Result>> {
      const steps = await store.getSteps(actorId, runId);
      return Object.fromEntries(steps.filter(s => s.status === "completed" && s.resultJson).map(s => [s.stepKey, JSON.parse(s.resultJson!) as Result]));
    },
    /** Only called inside commitStep's domain transaction; never dispatches. */
    async queueDeliveries(tx:AssistantTransaction,stepId:string,keys:readonly string[]) {
      if(keys.length>500||new Set(keys).size!==keys.length||keys.some(key=>!validId(key)))throw new AssistantStoreError('invalid_input');
      const [step]=await tx.select().from(assistantSteps).where(eq(assistantSteps.id,stepId)).limit(1);
      if(!step||step.status!=='running')throw new AssistantStoreError('lease_lost');
      if(step.deliveryJson){if(Object.keys(JSON.parse(step.deliveryJson)).sort().join('\0')!==[...keys].sort().join('\0'))throw new AssistantStoreError('request_conflict');return;}
      const records:Record<string,Delivery>=Object.fromEntries(keys.map(key=>[key,{state:'queued',fence:0}]));
      await tx.update(assistantSteps).set({deliveryJson:json(records),deliveryState:'queued',updatedAt:now()}).where(eq(assistantSteps.id,stepId));
    },
    async claimDelivery(input:{actorId:string;runId:string;stepId:string;key:string;leaseMs?:number}) {
      return transaction(async tx=>{
        const run=await ownRun(tx,input.actorId,input.runId);
        const [step]=await tx.select().from(assistantSteps).where(and(eq(assistantSteps.id,input.stepId),eq(assistantSteps.runId,input.runId))).limit(1);
        if(!step||!step.deliveryJson||step.status!=='completed')return null;
        const records=JSON.parse(step.deliveryJson) as Record<string,Delivery>,entry=records[input.key];
        if(!entry)return null;
        if(entry.state==='claimed'&&(entry.leaseUntil??0)<=now()){
          records[input.key]={...entry,state:'unknown'};
          await tx.update(assistantSteps).set({deliveryJson:json(records),deliveryState:'uncertain',updatedAt:now()}).where(eq(assistantSteps.id,step.id));return null;
        }
        if(entry.state!=='queued'||run.cancelledAt!==null)return null;
        const fence=entry.fence+1;records[input.key]={state:'claimed',fence,leaseUntil:now()+Math.max(1000,Math.min(120000,input.leaseMs??30000))};
        await tx.update(assistantSteps).set({deliveryJson:json(records),updatedAt:now()}).where(eq(assistantSteps.id,step.id));
        return {fence,idempotencyKey:assistantStepId(step.id,input.key)};
      });
    },
    async settleDelivery(input:{actorId:string;runId:string;stepId:string;key:string;fence:number;outcome:'accepted'|'unknown'|'suppressed';providerId?:string}) {
      return transaction(async tx=>{
        await ownRun(tx,input.actorId,input.runId);
        const [step]=await tx.select().from(assistantSteps).where(and(eq(assistantSteps.id,input.stepId),eq(assistantSteps.runId,input.runId))).limit(1);
        if(!step?.deliveryJson)throw new AssistantStoreError('unavailable');
        const records=JSON.parse(step.deliveryJson) as Record<string,Delivery>,entry=records[input.key];
        if(!entry||entry.fence!==input.fence)throw new AssistantStoreError('lease_lost');
        if(entry.state!=='claimed'){if(entry.state===input.outcome)return assistantDeliverySummary(records);throw new AssistantStoreError('request_conflict');}
        records[input.key]={state:input.outcome,fence:entry.fence,...(input.providerId?{providerId:input.providerId.slice(0,160)}:{})};
        const summary=assistantDeliverySummary(records);
        await tx.update(assistantSteps).set({deliveryJson:json(records),deliveryState:summary.unknown?'uncertain':summary.queued?'queued':'settled',updatedAt:now()}).where(eq(assistantSteps.id,step.id));return summary;
      });
    },
    async deliverySummary(actorId:string,runId:string,stepId:string) {
      const steps=await store.getSteps(actorId,runId),step=steps.find(value=>value.id===stepId);
      if(!step)throw new AssistantStoreError('unavailable');return assistantDeliverySummary(step.deliveryJson?JSON.parse(step.deliveryJson):{});
    },
    async bindPlan(actorId: string, runId: string, plan: unknown, steps: readonly { key: string; payload: unknown }[]) {
      if (!steps.length || steps.length > 100 || new Set(steps.map(s => s.key)).size !== steps.length || steps.some(s => !validId(s.key))) throw new AssistantStoreError("invalid_input");
      return transaction(async tx => {
        const run = await ownRun(tx, actorId, runId);
        if (run.cancelledAt !== null) throw new AssistantStoreError("cancelled");
        if(run.status==='unknown'||run.status==='uncertain')throw new AssistantStoreError('uncertain');
        if (run.planJson) { if (assistantPayloadHash(JSON.parse(run.planJson)) !== assistantPayloadHash(plan)) throw new AssistantStoreError("request_conflict"); return run; }
        for (const [ordinal, step] of steps.entries()) await tx.insert(assistantSteps).values({ id: assistantStepId(runId, step.key), runId, ordinal, stepKey: step.key, payloadJson: json(step.payload), payloadHash: assistantPayloadHash(step.payload), createdAt: now(), updatedAt: now() });
        const [bound] = await tx.update(assistantRuns).set({ planJson: json(plan), status: "ready", revision: run.revision + 1, updatedAt: now() }).where(eq(assistantRuns.id, runId)).returning();
        return bound;
      });
    },
    async claimStep(input: { actorId: string; runId: string; stepId: string; leaseMs?: number }) {
      return transaction(async tx => {
        const run = await ownRun(tx, input.actorId, input.runId);
        const [step] = await tx.select().from(assistantSteps).where(and(eq(assistantSteps.id, input.stepId), eq(assistantSteps.runId, input.runId))).limit(1);
        if (!step) throw new AssistantStoreError("unavailable");
        if (step.resultJson) return { ...step, result: JSON.parse(step.resultJson) };
        if (run.cancelledAt !== null) throw new AssistantStoreError("cancelled");
        if (step.status !== "pending") throw new AssistantStoreError(step.status === "running" && (step.leaseUntil ?? 0) > now() ? "busy" : "uncertain");
        const [claimed] = await tx.update(assistantSteps).set({ status: "running", fence: step.fence + 1, leaseUntil: now() + Math.max(1000, Math.min(120_000, input.leaseMs ?? 30_000)), updatedAt: now() }).where(eq(assistantSteps.id, step.id)).returning();
        await tx.update(assistantRuns).set({ status: "running", updatedAt: now() }).where(eq(assistantRuns.id, run.id));
        return { ...claimed, result: null };
      });
    },
    /** Callback MUST contain local DB effects only. One transaction owns effects + receipt. */
    async commitStep<Result>(stepId: string, fence: number, callback: (tx: AssistantTransaction) => Promise<Result>): Promise<Result> {
      return transaction(async tx => {
        const [step] = await tx.select().from(assistantSteps).where(eq(assistantSteps.id, stepId)).limit(1);
        if (!step) throw new AssistantStoreError("unavailable");
        if (step.resultJson) return JSON.parse(step.resultJson) as Result;
        const [run] = await tx.select().from(assistantRuns).where(eq(assistantRuns.id, step.runId)).limit(1);
        if (!run || run.cancelledAt !== null) throw new AssistantStoreError("cancelled");
        if (step.status !== "running" || step.fence !== fence || (step.leaseUntil ?? 0) <= now()) throw new AssistantStoreError("lease_lost");
        const result = await callback(tx);
        if ((step.leaseUntil ?? 0) <= now()) throw new AssistantStoreError("lease_lost");
        const outcome = result && typeof result === "object" && "status" in result ? String(result.status) : "completed";
        const status = ["completed","blocked","failed","cancelled"].includes(outcome) ? outcome : outcome === "unknown" ? "uncertain" : "completed";
        await tx.update(assistantSteps).set({ status, resultJson: json(result), leaseUntil: null, updatedAt: now() }).where(and(eq(assistantSteps.id, stepId), eq(assistantSteps.fence, fence)));
        return result;
      });
    },
    async markStep(actorId: string, runId: string, stepId: string, fence: number, status: "failed" | "uncertain", errorCode: string, deliveryUncertain = false) {
      if (!/^[a-z_]{1,64}$/.test(errorCode)) throw new AssistantStoreError("invalid_input");
      return transaction(async tx => {
        await ownRun(tx, actorId, runId);
        await tx.update(assistantSteps).set({ status, errorCode, deliveryState: deliveryUncertain ? "uncertain" : "not_applicable", leaseUntil: null, updatedAt: now() })
          .where(and(eq(assistantSteps.id, stepId), eq(assistantSteps.runId, runId), eq(assistantSteps.fence, fence), eq(assistantSteps.status, "running")));
      });
    },
    async finishRun(actorId: string, runId: string, status: "completed" | "partial" | "failed" | "uncertain" | "clarification" | "ready" | "unknown", result: unknown) {
      return transaction(async tx => {
        const run = await ownRun(tx, actorId, runId);
        const prior = run.resultJson ? JSON.parse(run.resultJson) : {};
        const next = result && typeof result === "object" ? {...prior,...result,
          ...("timing" in result ? {timing:{...prior.timing,...result.timing as object}} : {})} : result;
        await tx.update(assistantRuns).set({ status: run.cancelledAt !== null ? "cancelled" : status, resultJson: json(next), updatedAt: now() }).where(eq(assistantRuns.id, runId));
      });
    },
    async authorizeDraft(actorId:string,runId:string) {
      return transaction(async tx=>{
        const run=await ownRun(tx,actorId,runId);
        if(run.cancelledAt!==null)throw new AssistantStoreError("cancelled");
        if(run.executionAuthorizedAt!==null)return run;
        if(run.status!=="ready"||!run.requestJson||!run.planJson)throw new AssistantStoreError("request_conflict");
        const request=JSON.parse(run.requestJson),bound=JSON.parse(run.planJson);
        if(request.mode!=="draft"&&bound.plan?.mode!=="draft")throw new AssistantStoreError("request_conflict");
        const [updated]=await tx.update(assistantRuns).set({executionAuthorizedAt:now(),revision:run.revision+1,updatedAt:now()}).where(eq(assistantRuns.id,runId)).returning();return updated;
      });
    },
    async cancelRun(actorId: string, runId: string) {
      return transaction(async tx => {
        const run = await ownRun(tx, actorId, runId);
        if (run.status === "completed") return run;
        const [cancelled] = await tx.update(assistantRuns).set({ status: "cancelled", cancelledAt: now(), revision: run.revision + 1, updatedAt: now() }).where(eq(assistantRuns.id, runId)).returning();
        await tx.update(assistantSteps).set({ status: "cancelled", fence: sql`${assistantSteps.fence}+1`, updatedAt: now() }).where(and(eq(assistantSteps.runId, runId), eq(assistantSteps.status, "pending")));
        return cancelled;
      });
    },
    /** Reconcile the original receipt only. The callback cannot write domain tables. */
    async recoverStep<Result>(actorId:string,runId:string,stepId:string,lookup:(tx:Pick<AssistantTransaction,"select">)=>Promise<Result|null>) {
      return transaction(async tx=>{
        const run=await ownRun(tx,actorId,runId);
        const [step]=await tx.select().from(assistantSteps).where(and(eq(assistantSteps.id,stepId),eq(assistantSteps.runId,runId))).limit(1);
        if(!step)throw new AssistantStoreError("unavailable");
        if(step.status==='completed'&&step.resultJson)return JSON.parse(step.resultJson) as Result;
        const recovered=await lookup(tx);
        if(recovered===null)return null;
        if(!recovered||typeof recovered!=='object'||!('status' in recovered)||recovered.status!=='completed'||!('stepId' in recovered)||recovered.stepId!==stepId)throw new AssistantStoreError('invalid_input');
        await tx.update(assistantSteps).set({status:'completed',resultJson:json(recovered),leaseUntil:null,fence:step.fence+1,updatedAt:now()}).where(eq(assistantSteps.id,stepId));
        if(run.cancelledAt===null)await tx.update(assistantRuns).set({status:'ready',updatedAt:now()}).where(eq(assistantRuns.id,runId));
        return recovered;
      });
    },
    async settleTimelineResult(actorId:string,runId:string,stepId:string,result:AssistantActionResult) {
      return transaction(async tx=>{
        await ownRun(tx,actorId,runId);
        const [step]=await tx.select().from(assistantSteps).where(and(eq(assistantSteps.id,stepId),eq(assistantSteps.runId,runId))).limit(1);
        if(!step?.resultJson||step.status!=='completed')throw new AssistantStoreError('unavailable');
        const prior=JSON.parse(step.resultJson) as AssistantActionResult;
        if(assistantPayloadHash(prior)===assistantPayloadHash(result))return prior;
        if(!['preview_timeline','read_timeline'].includes(prior.kind)||prior.code!=='timeline_pending')throw new AssistantStoreError('request_conflict');
        if(result.status!=='completed')return prior;
        const fixed=(r:AssistantActionResult)=>({stepId:r.stepId,kind:r.kind,projectId:r.projectId,affectedCount:r.affectedCount,createdProjectId:r.createdProjectId,createdTaskIds:r.createdTaskIds,taskIds:r.taskIds,undo:r.undo,delivery:r.delivery});
        if(assistantPayloadHash(fixed(prior))!==assistantPayloadHash(fixed(result))||result.stepId!==stepId||result.code==='timeline_pending'||!isAssistantInternalHref(result.href))throw new AssistantStoreError('request_conflict');
        await tx.update(assistantSteps).set({resultJson:json(result),updatedAt:now()}).where(eq(assistantSteps.id,stepId));return result;
      });
    },
    async getPlannerAttempt(actorId:string,runId:string) {
      const run=await ownRun(database,actorId,runId);
      return parsePlannerAttemptMetadata(run.resultJson?JSON.parse(run.resultJson).plannerAttempt:null);
    },
    budget: {
      async reserve(input: { runId: string; requestId: string; model: string; reservedMicroUsd: number; developmentCapMicroUsd: number; totalCapMicroUsd: number; rateCardId: string; attempt?:PlannerAttemptMetadata }) {
        if (![input.reservedMicroUsd,input.developmentCapMicroUsd,input.totalCapMicroUsd].every(n => Number.isSafeInteger(n) && n > 0)) throw new AssistantStoreError("invalid_input");
        const attempt=input.attempt===undefined?undefined:parsePlannerAttemptMetadata(input.attempt);
        if(input.attempt!==undefined&&(!attempt||attempt.model!==input.model||attempt.revision!==0||attempt.logical!=="pending"||attempt.physical!=="pending"||attempt.dispatched||Object.values(attempt.stages).some(value=>value!==null)))throw new AssistantStoreError("invalid_input");
        return transaction(async tx => {
          const [run] = await tx.select().from(assistantRuns).where(eq(assistantRuns.id, input.runId)).limit(1);
          if (!run || run.cancelledAt !== null || run.budgetRequestId || run.planJson) return false;
          const [total] = await tx.select({ value: sql<number>`COALESCE(SUM(${assistantRuns.reservedMicroUsd}),0)` }).from(assistantRuns);
          if (Number(total.value) + input.reservedMicroUsd > Math.min(input.developmentCapMicroUsd,input.totalCapMicroUsd)) return false;
          await tx.update(assistantRuns).set({ budgetRequestId: assistantPayloadHash({runId:input.runId,requestId:input.requestId}), budgetModel: input.model, budgetRateCardId: input.rateCardId, reservedMicroUsd: input.reservedMicroUsd, usageState: "reserved", ...(attempt?{resultJson:json({...JSON.parse(run.resultJson??"{}"),plannerAttempt:attempt})}:{}), updatedAt: now() }).where(eq(assistantRuns.id, input.runId));
          return true;
        });
      },
      async recordAttempt(input:{runId:string;requestId:string;attempt:PlannerAttemptMetadata}) {
        const attempt=parsePlannerAttemptMetadata(input.attempt);if(!attempt)throw new AssistantStoreError("invalid_input");
        await transaction(async tx=>{
          const [run]=await tx.select().from(assistantRuns).where(and(eq(assistantRuns.id,input.runId),eq(assistantRuns.budgetRequestId,assistantPayloadHash({runId:input.runId,requestId:input.requestId})))).limit(1);
          if(!run)throw new AssistantStoreError("unavailable");
          const result=JSON.parse(run.resultJson??"{}"),prior=parsePlannerAttemptMetadata(result.plannerAttempt);
          if(!prior||attempt.model!==prior.model||attempt.maxOutputTokens!==prior.maxOutputTokens||attempt.deadlineMs!==prior.deadlineMs||attempt.effort!==prior.effort)throw new AssistantStoreError("request_conflict");
          if(attempt.revision<prior.revision)return;
          if(attempt.revision===prior.revision){if(assistantPayloadHash(attempt)!==assistantPayloadHash(prior))throw new AssistantStoreError("request_conflict");return;}
          if(prior.physical==='settled'&&attempt.physical!=='settled'||prior.logical!=='pending'&&attempt.logical!==prior.logical)throw new AssistantStoreError("request_conflict");
          const known=["httpStatus","providerRequestId","stopReason","failureCode","cacheReadTokens","cacheWriteTokens","cacheWrite5mTokens","cacheWrite1hTokens"] as const;
          if(prior.dispatched&&!attempt.dispatched||known.some(key=>prior[key]!==null&&attempt[key]!==prior[key])||
            Object.keys(prior.stages).some(key=>{const k=key as keyof typeof prior.stages;return prior.stages[k]!==null&&(attempt.stages[k]===null||(k==='accounting'?attempt.stages[k]!<prior.stages[k]!:attempt.stages[k]!==prior.stages[k]));}))throw new AssistantStoreError("request_conflict");
          await tx.update(assistantRuns).set({resultJson:json({...result,plannerAttempt:attempt}),updatedAt:now()}).where(eq(assistantRuns.id,run.id));
        });
      },
      async recordUsage(input: { runId:string; requestId: string; inputTokens: number | null; outputTokens: number | null; estimatedMicroUsd: number | null; state: "usage_observed" | "unknown" }) {
        if ([input.inputTokens,input.outputTokens,input.estimatedMicroUsd].some(n => n !== null && (!Number.isSafeInteger(n) || n < 0))) throw new AssistantStoreError("invalid_input");
        await transaction(async tx => {
          const [run] = await tx.select().from(assistantRuns).where(and(eq(assistantRuns.id,input.runId),eq(assistantRuns.budgetRequestId, assistantPayloadHash({runId:input.runId,requestId:input.requestId})))).limit(1);
          if (!run) throw new AssistantStoreError("unavailable");
          if (input.state === "usage_observed" && [input.inputTokens,input.outputTokens,input.estimatedMicroUsd].some(n => n === null)) throw new AssistantStoreError("invalid_input");
          if (run.usageState === "usage_observed") {
            if (input.state === "usage_observed" && (run.inputTokens !== input.inputTokens || run.outputTokens !== input.outputTokens || run.estimatedMicroUsd !== input.estimatedMicroUsd)) throw new AssistantStoreError("request_conflict");
            return;
          }
          await tx.update(assistantRuns).set({ inputTokens: input.inputTokens, outputTokens: input.outputTokens, estimatedMicroUsd: input.estimatedMicroUsd,
            ...(input.state === "usage_observed" ? {reservedMicroUsd: input.estimatedMicroUsd!} : {}),usageState: input.state, updatedAt: now() }).where(eq(assistantRuns.id, run.id));
        });
      },
    },
  };
  return store;
}
export type AssistantStore = ReturnType<typeof createAssistantStore>;
export type AssistantDeliveryPort = Pick<AssistantStore,"queueDeliveries"|"claimDelivery"|"settleDelivery"|"deliverySummary">;
