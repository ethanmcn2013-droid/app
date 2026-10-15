/** Content-free diagnostics only. Client reports never authorize work or prove commits. */
export const PING_TELEMETRY_BATCH_VERSION = "ping.telemetry.batch.v1" as const;
export const PING_TELEMETRY_ENDPOINT = "/api/ping/telemetry" as const;
export const PING_TELEMETRY_ATTEMPT_HEADER = "X-Ping-Telemetry-Attempt" as const;
export const PING_TELEMETRY_REQUEST_HEADER = "X-Ping-Telemetry-Request" as const;
export const PING_TELEMETRY_VERSION = "ping.telemetry.v1" as const;
export const PING_TELEMETRY_STAGES = ["activation","capability","install","recognition","finish-final","prepare","review","execute","receipt","refresh","hydration","react-commit","render-opportunity","recovery","cancel","close","request","authenticate","decode","resolve","dispatch","transaction-read","transaction-write","apply-to-react-commit","finish-to-react-commit","attempt"] as const;
export const PING_TELEMETRY_OUTCOMES = ["completed","failed","refused","unauthenticated","invalid_input","unavailable","unknown","cancelled","expired","context_invalidated","not_invoked","committed_changed","committed_no_changes","replayed","not_found","matched","diverged","stale","overflow","unfinished","started"] as const;
export type PingTelemetryStage = typeof PING_TELEMETRY_STAGES[number];
export type PingTelemetryOutcome = typeof PING_TELEMETRY_OUTCOMES[number];
export type PingTelemetryInputMode = "typed" | "local-speech" | "legacy-voice" | "unknown";
export type PingTelemetryDeployment = "development" | "preview" | "production" | "test" | "unknown";
export type PingTelemetryEvent = Readonly<{
  version: typeof PING_TELEMETRY_VERSION; source: "client" | "server";
  trust: "client_reported" | "server_observed"; clock: "client_monotonic" | "server_monotonic";
  attemptId: string; requestId: string; spanId: string; parentSpanId: string | null;
  stage: PingTelemetryStage; outcome: PingTelemetryOutcome; durationMs: number | null;
  sequence: number; droppedCount: number; deployment: PingTelemetryDeployment; release: string | null; inputMode: PingTelemetryInputMode;
}>;
export type PingTelemetryFact = Readonly<{stage: PingTelemetryStage; outcome: PingTelemetryOutcome; durationMs?: number | null; parentSpanId?: string | null}>;
export type PingTelemetryEnd = (outcome: PingTelemetryOutcome) => void;
export type PingTelemetryRecorder = Readonly<{attemptId: string; requestId: string; record: (fact: PingTelemetryFact) => void; begin: (stage: PingTelemetryStage, parentSpanId?: string | null) => PingTelemetryEnd; coverage: () => Readonly<{recorded:number;dropped:number;pending:number}>; flush: () => void}>;
const keys = ["version","source","trust","clock","attemptId","requestId","spanId","parentSpanId","stage","outcome","durationMs","sequence","droppedCount","deployment","release","inputMode"];
export function isPingTelemetryId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function validatePingTelemetryEvent(value: unknown): PingTelemetryEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
  if (![Object.prototype,null].includes(Object.getPrototypeOf(value))) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).length !== keys.length || keys.some(k => !Object.hasOwn(raw,k))) return null;
  const e = Object.fromEntries(keys.map(k => [k, raw[k]]));
  if (Object.keys(e).length !== keys.length || keys.some(k => !Object.hasOwn(e,k)) || e.version !== PING_TELEMETRY_VERSION ||
    !(["client","server"] as readonly unknown[]).includes(e.source) || e.trust !== (e.source === "client" ? "client_reported" : "server_observed") || e.clock !== (e.source === "client" ? "client_monotonic" : "server_monotonic") ||
    !isPingTelemetryId(e.attemptId) || !isPingTelemetryId(e.requestId) || !isPingTelemetryId(e.spanId) || (e.parentSpanId !== null && !isPingTelemetryId(e.parentSpanId)) ||
    !(PING_TELEMETRY_STAGES as readonly unknown[]).includes(e.stage) || !(PING_TELEMETRY_OUTCOMES as readonly unknown[]).includes(e.outcome) ||
    !(e.durationMs === null || typeof e.durationMs === "number" && Number.isFinite(e.durationMs) && e.durationMs >= 0 && e.durationMs <= 300000) ||
    !Number.isInteger(e.sequence) || Number(e.sequence) < 0 || Number(e.sequence) > 255 || !Number.isInteger(e.droppedCount) || Number(e.droppedCount) < 0 || Number(e.droppedCount) > 65535 ||
    !(["development","preview","production","test","unknown"] as readonly unknown[]).includes(e.deployment) || !(e.release === null || typeof e.release === "string" && /^[0-9a-f]{40}$/.test(e.release)) ||
    !(["typed","local-speech","legacy-voice","unknown"] as readonly unknown[]).includes(e.inputMode)) return null;
  return Object.freeze(e) as PingTelemetryEvent;
  } catch { return null; }
}
/** Bounded asynchronous dispatch. No exporter runs on the caller's stack. */
export function createPingTelemetryRecorder(options: {
  source: "client" | "server"; emit: (event: PingTelemetryEvent) => unknown; attemptId?: string; requestId?: string;
  deployment?: PingTelemetryDeployment; release?: string | null; inputMode?: PingTelemetryInputMode;
  now?: () => number; randomId?: () => string; maxEvents?: number;
}): PingTelemetryRecorder {
  const random = options.randomId ?? (() => crypto.randomUUID());
  let disabled = false;
  const id = () => { try { const v = random(); if (isPingTelemetryId(v)) return v; } catch { /* Diagnostics are fail-open. */ } disabled=true; return "00000000-0000-4000-8000-000000000000"; };
  const attemptId = isPingTelemetryId(options.attemptId) ? options.attemptId : id();
  const requestId = isPingTelemetryId(options.requestId) ? options.requestId : id();
  const now = options.now ?? (() => performance.now());
  const limit = Number.isInteger(options.maxEvents) ? Math.max(1,Math.min(64,options.maxEvents!)) : 64;
  let recorded = 0, dropped = 0, scheduled = false, draining = false;
  const queue: PingTelemetryEvent[] = [];
  const drop = () => { dropped = Math.min(65535,dropped + 1); };
  function flush() {
    if (scheduled || draining || !queue.length) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false; draining = true;
      const batch = queue.splice(0);
      for (const event of batch) {
        try { void Promise.resolve(options.emit(event)).catch(drop); } catch { drop(); }
      }
      draining = false;
      if (queue.length) flush();
    });
  }
  function put(fact: PingTelemetryFact, spanId: string) {
    try {
      if (disabled || draining || recorded >= limit) { drop(); return; }
      const event = validatePingTelemetryEvent({version:PING_TELEMETRY_VERSION,source:options.source,trust:options.source === "client" ? "client_reported":"server_observed",clock:options.source === "client" ? "client_monotonic":"server_monotonic",attemptId,requestId,spanId,parentSpanId:fact.parentSpanId ?? null,stage:fact.stage,outcome:fact.outcome,durationMs:fact.durationMs ?? null,sequence:recorded,droppedCount:dropped,deployment:options.deployment ?? "unknown",release:options.release ?? null,inputMode:options.inputMode ?? "unknown"});
      if (!event) { drop(); return; } recorded++; queue.push(event); flush();
    } catch { drop(); }
  }
  return {attemptId,requestId,record: fact => { try {put(fact,id());} catch {drop();} },begin: (stage,parentSpanId = null) => {
    let spanId: string, start: number; try {spanId=id();start=now();} catch {drop();return () => {};}
    put({stage,outcome:"started",parentSpanId},spanId);
    let ended=false; return outcome => { if (ended) return; ended=true; let durationMs: number | null=null;
      try {const delta=now()-start; if(Number.isFinite(delta)&&delta>=0&&delta<=300000) durationMs=delta;} catch { /* absent */ }
      put({stage,outcome,parentSpanId,durationMs},spanId);
    };
  },coverage: () => ({recorded,dropped,pending:queue.length}),flush};
}
