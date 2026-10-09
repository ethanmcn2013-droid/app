import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { after } from "next/server";
import { cache } from "react";
import { identityTimingEnabled } from "@/server/diagnostics/identity-timing";
import { opLog, type SafeLogFields } from "@/server/operational-log";

const OPT_IN = "isolated-preview-task-timing-v1";
const TAG = "signal.task.timing.v1";
const SCOPES = ["create", "edit", "complete", "unclassified"] as const;
// These stages are intentionally overlapping: finalRead includes getTasks' query/map;
// boardQuery/boardMap count each withReadRetry attempt; writeAndActivity includes
// transaction-local authorization and capture where they share the writer transaction.
// identity includes the ambient membership lookup; projectProof includes scoped
// target reads and board-column configuration when an action needs them.
// actionTotal includes synchronous revalidatePath scheduling, not subsequent RSC render
// or full HTTP response time. Unclassified page reads are never joined to an action.
const STAGES = ["actionTotal", "identity", "projectProof", "writeAndActivity", "finalRead", "boardQuery", "boardMap"] as const;
type Scope = typeof SCOPES[number];
type ActionScope = Exclude<Scope, "unclassified">;
type Stage = typeof STAGES[number];
type Environment = Readonly<Record<string, string | undefined>>;
type Counter = { count: number; totalMs: number; maxMs: number };
type ScopeCounters = Record<Stage, Counter> & { rowsReturned: number; maxRowsReturned: number };
export type TaskTimingSummary = Readonly<{ tag: typeof TAG; version: 1; scopes: Record<Scope, ScopeCounters> }>;

export function taskTimingEnabled(env: Environment = process.env, now = Date.now()): boolean {
  return env.SIGNAL_TASK_TIMING_DIAGNOSTIC === OPT_IN && identityTimingEnabled(env, now);
}

const milliseconds = (value: number) => Number.isFinite(value) && value >= 0 ? Math.round(value * 1_000) / 1_000 : 0;
const rows = (value: number) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function emptyScope(): ScopeCounters {
  return { ...Object.fromEntries(STAGES.map(stage => [stage, { count: 0, totalMs: 0, maxMs: 0 }])),
    rowsReturned: 0, maxRowsReturned: 0 } as ScopeCounters;
}

/** Fixed numeric counters only. No user, Project, SQL, payload or result enters this collector. */
export function createTaskTimingCollector(input: {
  schedule: (callback: () => void) => void;
  emit: (summary: TaskTimingSummary) => void;
  now: () => number;
}) {
  const counts = Object.fromEntries(SCOPES.map(scope => [scope, emptyScope()])) as Record<Scope, ScopeCounters>;
  let scheduled = false;
  const scheduleOnce = () => {
    if (scheduled) return;
    scheduled = true;
    try { input.schedule(() => { try { input.emit(summary()); } catch { /* A log cannot affect a response. */ } }); }
    catch { /* Diagnostics never affect task work. */ }
  };
  const summary = (): TaskTimingSummary => ({ tag: TAG, version: 1, scopes: structuredClone(counts) });
  return {
    now: input.now,
    record(scope: Scope, stage: Stage, elapsed: number) {
      scheduleOnce();
      const counter = counts[scope][stage]; const duration = milliseconds(elapsed);
      counter.count++;
      counter.totalMs = milliseconds(counter.totalMs + duration);
      counter.maxMs = Math.max(counter.maxMs, duration);
    },
    recordRows(scope: Scope, count: number) {
      scheduleOnce();
      const safeCount = rows(count);
      counts[scope].rowsReturned += safeCount;
      counts[scope].maxRowsReturned = Math.max(counts[scope].maxRowsReturned, safeCount);
    },
    summary,
  };
}

type Collector = ReturnType<typeof createTaskTimingCollector>;
const actionStore = new AsyncLocalStorage<{ scope: ActionScope; collector: Collector }>();
function summaryFields(summary: TaskTimingSummary): SafeLogFields {
  const fields: SafeLogFields = { version: summary.version };
  for (const scope of SCOPES) {
    for (const stage of STAGES) {
      const counter = summary.scopes[scope][stage];
      fields[`${scope}_${stage}_count`] = counter.count;
      fields[`${scope}_${stage}_totalMs`] = counter.totalMs;
      fields[`${scope}_${stage}_maxMs`] = counter.maxMs;
    }
    fields[`${scope}_rowsReturned`] = summary.scopes[scope].rowsReturned;
    fields[`${scope}_maxRowsReturned`] = summary.scopes[scope].maxRowsReturned;
  }
  return fields;
}
const collectorForRender = cache(() => createTaskTimingCollector({
  schedule: callback => after(callback),
  emit: summary => opLog("warn", TAG, "sample", summaryFields(summary)),
  now: () => performance.now(),
}));

function availableStore(): { scope: Scope; collector: Collector } | null {
  if (!taskTimingEnabled()) return null;
  const current = actionStore.getStore();
  if (current) return current;
  try { return { scope: "unclassified", collector: collectorForRender() }; }
  catch { return null; }
}

/** The action boundary ends when its returned Promise settles, not when RSC render completes. */
export function withTaskActionTiming<T>(scope: ActionScope, work: () => Promise<T>): Promise<T> {
  if (!taskTimingEnabled()) return work();
  let collector: Collector;
  try { collector = collectorForRender(); } catch { return work(); }
  return actionStore.run({ scope, collector }, async () => {
    let started: number;
    try { started = collector.now(); } catch { return work(); }
    try { return await work(); }
    finally { try { collector.record(scope, "actionTotal", collector.now() - started); } catch { /* Preserve original result/error. */ } }
  });
}

/** Stage labels wrap only the supplied work and never inspect its arguments or result. */
export async function measureTaskStage<T>(stage: Exclude<Stage, "actionTotal" | "boardQuery" | "boardMap">, work: () => Promise<T>): Promise<T> {
  const store = actionStore.getStore();
  if (!store || !taskTimingEnabled()) return work();
  let started: number;
  try { started = store.collector.now(); } catch { return work(); }
  try { return await work(); }
  finally { try { store.collector.record(store.scope, stage, store.collector.now() - started); } catch { /* Preserve work. */ } }
}

/** Each withReadRetry attempt records its actual query and map, including unclassified page reads. */
export async function measureTaskBoardQuery<T>(work: () => Promise<T>): Promise<T> {
  const store = availableStore();
  if (!store) return work();
  let started: number;
  try { started = store.collector.now(); } catch { return work(); }
  try { return await work(); }
  finally { try { store.collector.record(store.scope, "boardQuery", store.collector.now() - started); } catch { /* Preserve work. */ } }
}

export function measureTaskBoardMap<T>(rowCount: number, work: () => T): T {
  const store = availableStore();
  if (!store) return work();
  let started: number;
  try { started = store.collector.now(); } catch { return work(); }
  try {
    const result = work();
    try { store.collector.recordRows(store.scope, rowCount); } catch { /* Preserve mapping result. */ }
    return result;
  } finally { try { store.collector.record(store.scope, "boardMap", store.collector.now() - started); }
    catch { /* Preserve mapping result/error. */ } }
}
