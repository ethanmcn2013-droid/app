import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { after } from "next/server";
import { cache } from "react";
import { SPRINT_PREVIEW_AUTH_MARKER } from "@/lib/auth/recipient-proof-authorized-parties";
import { opLog, type SafeLogFields } from "@/server/operational-log";

const OPT_IN = "isolated-preview-auth-timing-v1";
const TAG = "signal.identity.timing.v2";
const MAX_LIFETIME_MS = 6 * 60 * 60 * 1_000;
const STAGES = ["auth", "clerkProfile", "provision", "persistedId", "total"] as const;
type Stage = typeof STAGES[number];
type Scope = "unclassified" | "routeResolver";
export type AppGateSite = "layout" | "tasksShell" | "other";
type GateStage = "profile" | "membership";
const TRACE_LIMIT = 16;
// Numeric stage codes are fixed here; no user, Project, URL or result is retained.
const TRACE_CODE = {
  layoutEntry: 1, layoutProfile: 2, layoutMembership: 3, layoutTotal: 4,
  shellEntry: 5, shellProfile: 6, shellMembership: 7, shellTotal: 8,
  routeProfile: 9,
} as const;
type TraceStage = keyof typeof TRACE_CODE;
type TraceEvent = { stage: number; ordinal: number; offsetMs: number; durationMs: number };
type Environment = Readonly<Record<string, string | undefined>>;
type Clock = () => number;
type StageCount = { count: number; totalMs: number; maxMs: number };
type ScopeCounts = Record<Stage, StageCount>;
export type IdentityTimingSummary = Readonly<{
  tag: typeof TAG;
  version: 2;
  unclassified: ScopeCounts;
  routeResolver: ScopeCounts;
  gateTrace: Readonly<{ events: TraceEvent[]; overflow: number; dropped: number }>;
}>;

/** This flag alone cannot enable logging on production or an unrelated Preview. */
export function identityTimingEnabled(env: Environment = process.env, now = Date.now()): boolean {
  const expiry = Number(env.SIGNAL_RELIABILITY_ATTEST_UNTIL_MS);
  if (env.SIGNAL_IDENTITY_TIMING_DIAGNOSTIC !== OPT_IN ||
      env.SIGNAL_SPRINT_PREVIEW_AUTH !== SPRINT_PREVIEW_AUTH_MARKER ||
      env.SIGNAL_RELIABILITY_ATTEST !== "isolated-reliability-v1" ||
      env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" || env.VERCEL_TARGET_ENV !== "preview" ||
      env.NODE_ENV !== "production" || env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV !== "preview" ||
      env.SIGNAL_ACCESS_MODE !== "production" || env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE !== "production" ||
      !/^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? "") ||
      !/^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID ?? "") ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(env.VERCEL_URL ?? "") ||
      !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
      !env.CLERK_SECRET_KEY?.startsWith("sk_test_")) return false;
  return Number.isSafeInteger(expiry) && Number.isFinite(now) && expiry > now && expiry - now <= MAX_LIFETIME_MS;
}

function emptyScope(): ScopeCounts {
  return Object.fromEntries(STAGES.map(stage => [stage, {count: 0, totalMs: 0, maxMs: 0}])) as ScopeCounts;
}

function safeMilliseconds(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 1_000) / 1_000 : 0;
}

/** Numeric-only collector. It never receives a user, session, request or URL. */
export function createIdentityTimingCollector(input: {
  schedule: (callback: () => void) => void;
  emit: (summary: IdentityTimingSummary) => void;
  now: Clock;
}) {
  const unclassified = emptyScope();
  const routeResolver = emptyScope();
  const events: TraceEvent[] = [];
  let overflow = 0;
  let dropped = 0;
  let origin: number | null = null;
  let scheduled = false;
  const scopeCounts = (scope: Scope) => scope === "routeResolver" ? routeResolver : unclassified;
  const summary = (): IdentityTimingSummary => ({tag: TAG, version: 2,
    unclassified: structuredClone(unclassified), routeResolver: structuredClone(routeResolver),
    gateTrace: {events: events.map(event => ({...event})), overflow, dropped}});
  const now = (): number | null => {
    try { const value = input.now(); return Number.isFinite(value) && value >= 0 ? value : null; }
    catch { return null; }
  };
  const markStart = (started: number | null) => {
    if (started !== null && origin === null) origin = started;
  };
  const trace = (stage: TraceStage, started: number, ended: number) => {
    if (origin === null || !Number.isFinite(started) || !Number.isFinite(ended) || ended < started || started < origin) {
      dropped++; return;
    }
    if (events.length >= TRACE_LIMIT) { overflow++; return; }
    events.push({stage: TRACE_CODE[stage], ordinal: events.length + 1,
      offsetMs: safeMilliseconds(started - origin), durationMs: safeMilliseconds(ended - started)});
  };
  const record = (scope: Scope, stage: Stage, elapsed: number) => {
    const counter = scopeCounts(scope)[stage];
    const duration = safeMilliseconds(elapsed);
    counter.count += 1;
    counter.totalMs = safeMilliseconds(counter.totalMs + duration);
    counter.maxMs = Math.max(counter.maxMs, duration);
  };
  const scheduleOnce = () => {
    if (scheduled) return;
    scheduled = true;
    try { input.schedule(() => { try { input.emit(summary()); } catch { /* diagnostics never affect the response */ } }); }
    catch { /* diagnostics never affect auth or authorization */ }
  };
  return {
    begin(scope: Scope) {
      scheduleOnce();
      const started = now();
      markStart(started);
      let finished = false;
      return {
        async measure<T>(stage: Exclude<Stage, "total">, work: () => Promise<T>): Promise<T> {
          const stageStarted = now();
          markStart(stageStarted);
          try { return await work(); }
          finally { try {
            const ended = now();
            if (stageStarted !== null && ended !== null && ended >= stageStarted) {
              record(scope, stage, ended - stageStarted);
              if (scope === "routeResolver" && stage === "clerkProfile") trace("routeProfile", stageStarted, ended);
            } else if (scope === "routeResolver" && stage === "clerkProfile") dropped++;
          } catch { /* Preserve the original result or error. */ } }
        },
        finish() {
          if (finished) return;
          finished = true;
          try { const ended = now(); if (started !== null && ended !== null && ended >= started)
            record(scope, "total", ended - started); } catch { /* Preserve work. */ }
        },
      };
    },
    beginGate(site: Exclude<AppGateSite, "other">) {
      scheduleOnce();
      const prefix = site === "layout" ? "layout" : "shell";
      const started = now();
      markStart(started);
      if (started !== null) trace(`${prefix}Entry` as TraceStage, started, started);
      else dropped++;
      let finished = false;
      return {
        async measure<T>(stage: GateStage, work: () => Promise<T>): Promise<T> {
          const stageStarted = now();
          markStart(stageStarted);
          try { return await work(); }
          finally { try { const ended = now();
            if (stageStarted !== null && ended !== null) trace(`${prefix}${stage === "profile" ? "Profile" : "Membership"}` as TraceStage,
              stageStarted, ended);
            else dropped++;
          } catch { /* Preserve the original result or error. */ } }
        },
        finish() {
          if (finished) return;
          finished = true;
          try { const ended = now();
            if (started !== null && ended !== null) trace(`${prefix}Total` as TraceStage, started, ended);
            else dropped++;
          }
          catch { /* Preserve work. */ }
        },
      };
    },
    summary,
  };
}

const phase = new AsyncLocalStorage<Scope>();
/** The approved operational sink accepts scalars only. Every key comes from fixed enums. */
function summaryFields(summary: IdentityTimingSummary): SafeLogFields {
  const fields: SafeLogFields = {version: summary.version};
  for (const scope of ["unclassified", "routeResolver"] as const) {
    for (const stage of STAGES) {
      fields[`${scope}_${stage}_count`] = summary[scope][stage].count;
      fields[`${scope}_${stage}_totalMs`] = summary[scope][stage].totalMs;
      fields[`${scope}_${stage}_maxMs`] = summary[scope][stage].maxMs;
    }
  }
  fields.gateTrace_count = summary.gateTrace.events.length;
  fields.gateTrace_overflow = summary.gateTrace.overflow;
  fields.gateTrace_dropped = summary.gateTrace.dropped;
  for (let index = 0; index < TRACE_LIMIT; index++) {
    const event = summary.gateTrace.events[index];
    fields[`gateTrace_${index}_stage`] = event?.stage ?? 0;
    fields[`gateTrace_${index}_ordinal`] = event?.ordinal ?? 0;
    fields[`gateTrace_${index}_offsetMs`] = event?.offsetMs ?? 0;
    fields[`gateTrace_${index}_durationMs`] = event?.durationMs ?? 0;
  }
  return fields;
}

const collectorForRender = cache(() => createIdentityTimingCollector({
  schedule: callback => after(callback),
  emit: summary => opLog("warn", TAG, "sample", summaryFields(summary)),
  now: () => performance.now(),
}));

const NO_TIMING = {
  measure: <T>(_stage: Exclude<Stage, "total">, work: () => Promise<T>) => work(),
  finish: () => {},
};
const NO_GATE_TIMING = {
  measure: <T>(_stage: GateStage, work: () => Promise<T>) => work(),
  finish: () => {},
};

/** Fixed-site numeric spans share the render collector with route profile timing. */
export function beginAppGateTiming(site: AppGateSite) {
  if ((site !== "layout" && site !== "tasksShell") || !identityTimingEnabled()) return NO_GATE_TIMING;
  try { return collectorForRender().beginGate(site); }
  catch { return NO_GATE_TIMING; }
}

/** No identity or authorization result is cached; only fixed numeric counters are shared per render. */
export function beginIdentityTiming() {
  if (!identityTimingEnabled()) return NO_TIMING;
  try { return collectorForRender().begin(phase.getStore() ?? "unclassified"); }
  catch { return NO_TIMING; }
}

/** Labels only the identity call inside the route resolver, never prior work as action-only. */
export function withRouteResolverIdentityTiming<T>(work: () => Promise<T>): Promise<T> {
  if (!identityTimingEnabled()) return work();
  return phase.run("routeResolver", work);
}
