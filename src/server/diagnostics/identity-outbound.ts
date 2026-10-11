import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";
import { after } from "next/server";
import { cache } from "react";
import { identityTimingEnabled } from "@/server/diagnostics/identity-timing";
import { opLog, type SafeLogFields } from "@/server/operational-log";

const OPT_IN = "isolated-preview-clerk-outbound-v1";
const TAG = "signal.identity.outbound.v1";
const CLERK_ORIGIN = "https://api.clerk.com";
const SCOPES = ["unclassified", "routeResolver", "taskAction", "readControl"] as const;
export type IdentityOutboundScope = typeof SCOPES[number];
type Environment = Readonly<Record<string, string | undefined>>;
type Counts = { profileInvocations: number; profileOutboundAttempts: number; otherTransportEvents: number };
type SummaryScope = Counts & { transportObserved: boolean };
export type IdentityOutboundSummary = Readonly<{
  tag: typeof TAG;
  version: 1;
  positiveControlPassed: boolean;
  scopes: Record<IdentityOutboundScope, SummaryScope>;
}>;

/** The second exact opt-in inherits every existing short-lived isolated Preview guard. */
export function identityOutboundEnabled(env: Environment = process.env, now = Date.now()): boolean {
  return env.SIGNAL_IDENTITY_OUTBOUND_DIAGNOSTIC === OPT_IN &&
    (env.CLERK_API_URL === undefined || env.CLERK_API_URL === CLERK_ORIGIN) &&
    (env.CLERK_API_VERSION === undefined || env.CLERK_API_VERSION === "v1") &&
    identityTimingEnabled(env, now);
}

function emptyCounts(): Counts {
  return { profileInvocations: 0, profileOutboundAttempts: 0, otherTransportEvents: 0 };
}

/** A collector contains fixed counters only; it has no user or request identity. */
export function createIdentityOutboundCollector(input: {
  schedule: (callback: () => void) => void;
  emit: (summary: IdentityOutboundSummary) => void;
}) {
  const counts = Object.fromEntries(SCOPES.map(scope => [scope, emptyCounts()])) as Record<IdentityOutboundScope, Counts>;
  let scheduled = false;
  const summary = (): IdentityOutboundSummary => ({
    tag: TAG,
    version: 1,
    positiveControlPassed: counts.readControl.profileOutboundAttempts > 0,
    scopes: Object.fromEntries(SCOPES.map(scope => [scope, {
      ...counts[scope],
      transportObserved: counts[scope].profileOutboundAttempts + counts[scope].otherTransportEvents > 0,
    }])) as Record<IdentityOutboundScope, SummaryScope>,
  });
  const scheduleOnce = () => {
    if (scheduled) return;
    scheduled = true;
    try { input.schedule(() => { try { input.emit(summary()); } catch { /* Logging cannot affect auth. */ } }); }
    catch { /* Scheduling cannot affect auth. */ }
  };
  return {
    recordInvocation(scope: IdentityOutboundScope) { scheduleOnce(); counts[scope].profileInvocations++; },
    recordEvent(scope: IdentityOutboundScope, profile: boolean) {
      if (profile) counts[scope].profileOutboundAttempts++;
      else counts[scope].otherTransportEvents++;
    },
    summary,
  };
}

type Collector = ReturnType<typeof createIdentityOutboundCollector>;
type OutboundStore = Readonly<{ collector: Collector; scope: IdentityOutboundScope }>;
const scopeStorage = new AsyncLocalStorage<IdentityOutboundScope>();
const profileStorage = new AsyncLocalStorage<OutboundStore>();

/** Never read headers, bodies, response data or retain the opaque path segment. */
export function classifiedClerkProfileRequest(event: unknown): boolean | null {
  try {
    if (!event || typeof event !== "object" || !("request" in event)) return null;
    const request = event.request;
    if (!request || typeof request !== "object") return null;
    const origin = "origin" in request ? request.origin : undefined;
    const method = "method" in request ? request.method : undefined;
    const path = "path" in request ? request.path : undefined;
    if (typeof origin !== "string" || typeof method !== "string" || typeof path !== "string") return null;
    return origin === CLERK_ORIGIN && method === "GET" && /^\/v1\/users\/[A-Za-z0-9_-]{1,256}$/.test(path);
  } catch { return null; }
}

/** Only the current ALS numeric store may receive a classified Undici attempt. */
export function createIdentityOutboundSubscriber(input: {
  getStore: () => OutboundStore | undefined;
  enabled: () => boolean;
}) {
  return (event: unknown) => {
    try {
      const store = input.getStore();
      if (!store || !input.enabled()) return;
      const classified = classifiedClerkProfileRequest(event);
      if (classified !== null) store.collector.recordEvent(store.scope, classified);
    } catch { /* A diagnostic callback cannot change the original request. */ }
  };
}

const subscriber = createIdentityOutboundSubscriber({ getStore: () => profileStorage.getStore(), enabled: () => identityOutboundEnabled() });
let subscribed = false;
function ensureSubscriber() {
  if (subscribed) return;
  try {
    channel("undici:request:create").subscribe(subscriber);
    subscribed = true;
  } catch { /* Subscription failure makes outbound counts unobservable. */ }
}

function summaryFields(summary: IdentityOutboundSummary): SafeLogFields {
  const fields: SafeLogFields = { version: summary.version, positiveControlPassed: summary.positiveControlPassed };
  for (const scope of SCOPES) {
    const counts = summary.scopes[scope];
    fields[`${scope}_profileInvocations`] = counts.profileInvocations;
    fields[`${scope}_profileOutboundAttempts`] = counts.profileOutboundAttempts;
    fields[`${scope}_otherTransportEvents`] = counts.otherTransportEvents;
    fields[`${scope}_transportObserved`] = counts.transportObserved;
  }
  return fields;
}

const collectorForRender = cache(() => createIdentityOutboundCollector({
  schedule: callback => after(callback),
  emit: summary => opLog("warn", TAG, "sample", summaryFields(summary)),
}));

/** Scope labels only the identity invocation; no action or route result is cached. */
export function withIdentityOutboundScope<T>(scope: IdentityOutboundScope, work: () => Promise<T>): Promise<T> {
  if (!identityOutboundEnabled()) return work();
  return scopeStorage.run(scope, work);
}

/** Wrap only Clerk currentUser. Setup failures fall back once to the original work. */
export function observeCurrentUserOutbound<T>(work: () => Promise<T>): Promise<T> {
  if (!identityOutboundEnabled()) return work();
  let store: OutboundStore | undefined;
  try {
    ensureSubscriber();
    const collector = collectorForRender();
    const scope = scopeStorage.getStore() ?? "unclassified";
    collector.recordInvocation(scope);
    store = { collector, scope };
  } catch { /* No diagnostic failure may change or replay currentUser. */ }
  return store ? profileStorage.run(store, work) : work();
}
