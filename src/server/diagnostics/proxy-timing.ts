import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";
import { performance } from "node:perf_hooks";
import { identityTimingEnabled } from "@/server/diagnostics/identity-timing";
import { identityOutboundEnabled } from "@/server/diagnostics/identity-outbound";
import { opLog } from "@/server/operational-log";

const LIMIT = 32;
type Counts = { jwksAttempts: number; otherAttempts: number; transportObserved: boolean; incomplete: boolean; events: number; active: boolean };
const storage = new AsyncLocalStorage<Counts>();
let subscribed = false;
function subscribe(): boolean {
  if (subscribed) return true;
  try {
    channel("undici:request:create").subscribe((event: unknown) => {
      const counts = storage.getStore();
      if (!counts?.active) return;
      try {
        if (++counts.events > LIMIT) { counts.incomplete = true; return; }
        const request = (event as {request?: {origin?: unknown; method?: unknown; path?: unknown}})?.request;
        if (!request || typeof request.origin !== "string" || typeof request.method !== "string" || typeof request.path !== "string") { counts.incomplete = true; return; }
        counts.transportObserved = true;
        if (request.origin === "https://api.clerk.com" && request.method === "GET" && request.path === "/v1/jwks") counts.jwksAttempts++;
        else counts.otherAttempts++;
      } catch { counts.incomplete = true; }
    });
    subscribed = true;
  } catch { /* Unavailable transport observation is explicitly incomplete. */ }
  return subscribed;
}

function enabled(): boolean {
  try { return process.env.VERCEL_ENV === "preview" &&
    process.env.SIGNAL_IDENTITY_TIMING_DIAGNOSTIC === "isolated-preview-auth-timing-v1" &&
    process.env.SIGNAL_IDENTITY_OUTBOUND_DIAGNOSTIC === "isolated-preview-clerk-outbound-v1" &&
    identityTimingEnabled() && identityOutboundEnabled(); } catch { return false; }
}

/** Diagnostic only. Never retain request values or replay the underlying proxy. */
export function withProxyTiming<T>(request: {method: string; nextUrl: {pathname: string}}, work: () => T | Promise<T>): T | Promise<T> {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/api/tasks/mutate" || !enabled()) return work();
  let started: number;
  let counts: Counts;
  try {
    counts = {jwksAttempts: 0, otherAttempts: 0, transportObserved: false, incomplete: !subscribe(), events: 0, active: true};
    started = performance.now();
  } catch { return work(); }
  const finish = (response?: T) => {
    counts.active = false;
    if (!counts.transportObserved) counts.incomplete = true;
    try {
      const elapsed = performance.now() - started;
      const valid = Number.isFinite(elapsed) && elapsed >= 0;
      const totalMs = valid ? Math.round(elapsed * 1000) / 1000 : null;
      if (!valid) counts.incomplete = true;
      try {
        const headers = (response as {headers?: Headers} | undefined)?.headers;
        if (headers && totalMs !== null) {
          headers.append("Server-Timing", "signalProxy;dur=" + totalMs);
        }
      } catch { /* Header mutation cannot affect authentication. */ }
      try { opLog("warn", "signal.proxy.timing.v1", "sample", {version: 1, totalMs, jwksAttempts: counts.jwksAttempts, otherAttempts: counts.otherAttempts, transportObserved: counts.transportObserved, incomplete: counts.incomplete}); } catch { /* Logging cannot affect authentication. */ }
    } catch { /* Diagnostic clock failures preserve the original outcome. */ }
  };
  let invoked = false;
  let original: Promise<T> | undefined;
  const invoke = () => {
    invoked = true;
    original = (async () => {
      try { const response = await work(); finish(response); return response; }
      catch (error) { finish(); throw error; }
    })();
    return original;
  };
  try { return storage.run(counts, invoke); }
  catch {
    counts.active = false;
    counts.incomplete = true;
    return invoked ? original! : work();
  }
}

/** Full handler span, nested around the existing dispatch; not additive to action timing. */
export function withRouteTiming<T>(work: () => T | Promise<T>): T | Promise<T> {
  if (!enabled()) return work();
  let started: number;
  try { started = performance.now(); } catch { return work(); }
  const finish = (response?: T) => {
    try {
      const elapsed = performance.now() - started;
      if (!Number.isFinite(elapsed) || elapsed < 0) return;
      const headers = (response as {headers?: Headers} | undefined)?.headers;
      headers?.append("Server-Timing", "signalRoute;dur=" + Math.round(elapsed * 1000) / 1000);
    } catch { /* Diagnostic failures preserve the original handler result. */ }
  };
  return (async () => {
    try { const response = await work(); finish(response); return response; }
    catch (error) { finish(); throw error; }
  })();
}
