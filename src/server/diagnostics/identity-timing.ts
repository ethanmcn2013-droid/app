import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { after } from "next/server";
import { cache } from "react";
import { SPRINT_PREVIEW_AUTH_MARKER } from "@/lib/auth/recipient-proof-authorized-parties";

const OPT_IN = "isolated-preview-auth-timing-v1";
const TAG = "signal.identity.timing.v1";
const MAX_LIFETIME_MS = 6 * 60 * 60 * 1_000;
const STAGES = ["auth", "clerkProfile", "provision", "persistedId", "total"] as const;
type Stage = typeof STAGES[number];
type Scope = "unclassified" | "routeResolver";
type Environment = Readonly<Record<string, string | undefined>>;
type Clock = () => number;
type StageCount = { count: number; totalMs: number; maxMs: number };
type ScopeCounts = Record<Stage, StageCount>;
export type IdentityTimingSummary = Readonly<{
  tag: typeof TAG;
  version: 1;
  unclassified: ScopeCounts;
  routeResolver: ScopeCounts;
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
  let scheduled = false;
  const scopeCounts = (scope: Scope) => scope === "routeResolver" ? routeResolver : unclassified;
  const summary = (): IdentityTimingSummary => ({tag: TAG, version: 1,
    unclassified: structuredClone(unclassified), routeResolver: structuredClone(routeResolver)});
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
      const started = input.now();
      let finished = false;
      return {
        async measure<T>(stage: Exclude<Stage, "total">, work: () => Promise<T>): Promise<T> {
          const stageStarted = input.now();
          try { return await work(); }
          finally { record(scope, stage, input.now() - stageStarted); }
        },
        finish() {
          if (finished) return;
          finished = true;
          record(scope, "total", input.now() - started);
        },
      };
    },
    summary,
  };
}

const phase = new AsyncLocalStorage<Scope>();
const collectorForRender = cache(() => createIdentityTimingCollector({
  schedule: callback => after(callback),
  emit: summary => console.info(JSON.stringify(summary)),
  now: () => performance.now(),
}));

const NO_TIMING = {
  measure: <T>(_stage: Exclude<Stage, "total">, work: () => Promise<T>) => work(),
  finish: () => {},
};

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
