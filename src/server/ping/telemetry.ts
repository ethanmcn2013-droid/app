import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createPingTelemetryRecorder, isPingTelemetryId, type PingTelemetryEvent, type PingTelemetryRecorder, type PingTelemetryStage, type PingTelemetryOutcome, validatePingTelemetryEvent } from "@/lib/ping/telemetry";
import { opLog } from "@/server/operational-log";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";
const context = new AsyncLocalStorage<PingTelemetryRecorder | undefined>();
export const pingTelemetryEnabled = () => process.env.PING_TELEMETRY_ENABLED === "1";
export function pingTelemetryFact(stage: PingTelemetryStage, outcome: PingTelemetryOutcome) { try {context.getStore()?.record({stage,outcome});} catch { /* Diagnostics are fail-open. */ } }
export async function pingTelemetrySpan<T>(stage: PingTelemetryStage, operation: () => Promise<T>): Promise<T> {
  const end = context.getStore()?.begin(stage);
  try {const result = await operation(); end?.("completed"); return result;} catch (error) {end?.("failed");throw error;}
}
let windowStart=0, emitted=0, dropped=0, summary=false;
function refreshBudgetWindow() {
  const now=Date.now();
  if(now-windowStart>=60000){windowStart=now;emitted=0;dropped=0;summary=false;}
}
/** One queued summary per process window, shared by event drops and request skips. */
function queueOverflow(stage: "attempt" | "request", droppedCount: number) {
  if(summary) return;
  summary=true;
  queueMicrotask(()=>{
    try {
      const event=validatePingTelemetryEvent({version:"ping.telemetry.v1",source:"server",trust:"server_observed",clock:"server_monotonic",attemptId:randomUUID(),requestId:randomUUID(),spanId:randomUUID(),parentSpanId:null,stage,outcome:"overflow",durationMs:null,sequence:0,droppedCount,deployment:"unknown",release:null,inputMode:"unknown"});
      if(event)opLog("warn","ping.telemetry",JSON.stringify(event));
    } catch { /* Diagnostics cannot change the business result. */ }
  });
}
/** Per-process 512 events/minute, plus one bounded drop summary. No fleet guarantee. */
export function emitPingTelemetry(event: PingTelemetryEvent) {
  refreshBudgetWindow();
  const safe=validatePingTelemetryEvent(event); if(!safe) return;
  if(emitted>=512){dropped=Math.min(65535,dropped+1);queueOverflow("attempt",dropped);return;}
  emitted++; opLog("warn","ping.telemetry",JSON.stringify(safe));
}
export async function withPingTelemetry(request: Request, operation: () => Promise<Response>): Promise<Response> {
  if(!pingTelemetryEnabled()) return operation();
  try {
  refreshBudgetWindow();
  if(emitted>=512){
    // request/overflow means at least one whole request omitted. No events were
    // constructed, so droppedCount=0 is NOT an exact missing-event count or a
    // claim of complete coverage. Concurrent accepted recorders may still drop.
    queueOverflow("request",0);
    return context.getStore() ? context.run(undefined,operation) : operation();
  }
  } catch {
    return context.getStore() ? context.run(undefined,operation) : operation();
  }
  let recorder: PingTelemetryRecorder;
  try {
    const attempt=request.headers.get("X-Ping-Telemetry-Attempt"), req=request.headers.get("X-Ping-Telemetry-Request");
    const deployment=["development","preview","production","test"].includes(process.env.VERCEL_ENV ?? "") ? process.env.VERCEL_ENV as "development"|"preview"|"production"|"test" : "unknown";
    const release=/^[0-9a-f]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA ?? "") ? process.env.VERCEL_GIT_COMMIT_SHA! : null;
    recorder=createPingTelemetryRecorder({source:"server",emit:emitPingTelemetry,randomId:randomUUID,attemptId:isPingTelemetryId(attempt)?attempt:undefined,requestId:isPingTelemetryId(req)?req:undefined,deployment,release});
  }catch{return operation();}
  return context.run(recorder,async()=>{
    const end=recorder.begin("request");
    try {const response=await operation();end(response.ok?"completed":response.status===401?"unauthenticated":response.status===400?"invalid_input":response.status===503?"failed":"unavailable");
      try {response.headers.set("X-Ping-Telemetry-Attempt",recorder.attemptId);response.headers.set("X-Ping-Telemetry-Request",recorder.requestId);}catch { /* Diagnostics are fail-open. */ }
      return response;
    }catch(error){end("failed");throw error;}
  });
}
/** A completed transaction means adapter return, never an inferred business commit. */
export function instrumentPingAdapter(adapter: ConversationDatabaseAdapter): ConversationDatabaseAdapter {
  return {...adapter,transaction: (mode,operation)=>pingTelemetrySpan(mode==="read"?"transaction-read":"transaction-write",()=>adapter.transaction(mode,operation))};
}
