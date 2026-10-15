import { createPingTelemetryRecorder, validatePingTelemetryEvent, type PingTelemetryEvent, type PingTelemetryInputMode, type PingTelemetryRecorder, PING_TELEMETRY_ENDPOINT, PING_TELEMETRY_BATCH_VERSION } from "./telemetry";

const ENDPOINT = PING_TELEMETRY_ENDPOINT;
const BATCH_VERSION = PING_TELEMETRY_BATCH_VERSION;
export const PING_TELEMETRY_ATTEMPT_HEADER = "X-Ping-Telemetry-Attempt";
export const PING_TELEMETRY_REQUEST_HEADER = "X-Ping-Telemetry-Request";
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
/** A best-effort diagnostic exporter, never a mutation/recovery queue. No retries. */
export function createPingTelemetryCollector(options: {
  fetcher?: typeof fetch; timeoutMs?: number; maxQueued?: number;
} = {}) {
  const queue: PingTelemetryEvent[] = [];
  const fetcher = options.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const limit = Math.max(1, Math.min(64, options.maxQueued ?? 64));
  let scheduled = false, running = false, disposed = false, dropped = 0, pendingDrops = 0, unknownDelivery = 0, acceptedByReceiver = 0;
  let abort: AbortController | null = null;
  const drop = (n = 1) => { dropped += n; pendingDrops = Math.min(65535, pendingDrops + n); };
  const body = (events: PingTelemetryEvent[]) => JSON.stringify({ version: BATCH_VERSION, events });
  function schedule() {
    if (scheduled || running || disposed || !queue.length) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; void drain(); });
  }
  async function drain() {
    if (running || disposed || !queue.length) return;
    running = true;
    const batch: PingTelemetryEvent[] = [];
    while (queue.length && batch.length < 16) {
      const next = queue[0];
      if (bytes(body([...batch, next])) > 8192) {
        if (!batch.length) { queue.shift(); drop(); continue; }
        break;
      }
      batch.push(queue.shift()!);
    }
    if (!batch.length) { running = false; schedule(); return; }
    const controller = new AbortController(); abort = controller;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); disposed = true; drop(queue.length); queue.length = 0; reject(new Error("diagnostic deadline")); }, Math.max(1, Math.min(5000, options.timeoutMs ?? 2000))); });
      // Promise.race also bounds a fetch implementation which ignores AbortSignal.
      const response = await Promise.race([Promise.resolve().then(() => fetcher(ENDPOINT, {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "content-type": "application/json" }, body: body(batch),
      })), deadline]);
      if (response.ok) acceptedByReceiver += batch.length;
      else { unknownDelivery += batch.length; drop(batch.length); }
    } catch { unknownDelivery += batch.length; drop(batch.length); }
    finally { clearTimeout(timeout); if (abort === controller) abort = null; running = false; schedule(); }
  }
  return {
    emit(value: PingTelemetryEvent) {
      try {
        const event = validatePingTelemetryEvent(value);
        if (!event || event.source !== "client" || disposed || queue.length >= limit) { drop(); return; }
        if (pendingDrops) {
          const summary = validatePingTelemetryEvent({ ...event, requestId: crypto.randomUUID(), spanId: crypto.randomUUID(), parentSpanId: null, sequence: 0, stage: "attempt", outcome: "overflow", durationMs: null,
            droppedCount: Math.min(65535, event.droppedCount + pendingDrops) });
          if (summary && queue.length < limit - 1) { queue.push(summary); pendingDrops = 0; }
        }
        if (queue.length >= limit) { drop(); return; }
        queue.push(event); schedule();
      } catch { drop(); }
    },
    coverage: () => ({ queued: queue.length, inFlight: running, acceptedByReceiver, dropped, unknownDelivery }),
    dispose() { disposed = true; drop(queue.length); queue.length = 0; abort?.abort(); },
  };
}
const inputModes = new WeakMap<PingTelemetryRecorder, PingTelemetryInputMode>();
let collector: ReturnType<typeof createPingTelemetryCollector> | null = null;
/** Explicit opt-in; never exports product identities or reads recovery storage. */
export function createBrowserPingTelemetry(inputMode: PingTelemetryInputMode, attemptId?: string): PingTelemetryRecorder | null {
  if (process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED !== "1") return null;
  try {
    collector ??= createPingTelemetryCollector();
    const deployment = process.env.NEXT_PUBLIC_PING_TELEMETRY_DEPLOYMENT;
    const release = process.env.NEXT_PUBLIC_PING_TELEMETRY_RELEASE;
    const recorder = createPingTelemetryRecorder({ source: "client", inputMode, attemptId,
      deployment: deployment === "development" || deployment === "preview" || deployment === "production" || deployment === "test" ? deployment : "unknown",
      release: release && /^[0-9a-f]{40}$/.test(release) ? release : null, emit: collector.emit });
    inputModes.set(recorder, inputMode);
    return recorder;
  } catch { return null; }
}
/** Safe optional observer: diagnostics cannot throw into an owner. */
export function pingTelemetryBegin(recorder: PingTelemetryRecorder | null | undefined, stage: Parameters<PingTelemetryRecorder["begin"]>[0]) {
  try { const end = recorder?.begin(stage); return (outcome: Parameters<NonNullable<typeof end>>[0]) => { try { end?.(outcome); } catch { /* diagnostic only */ } }; }
  catch { return (() => {}) as ReturnType<PingTelemetryRecorder["begin"]>; }
}

export function createPingTelemetryRequest(recorder: PingTelemetryRecorder | null | undefined): PingTelemetryRecorder | null {
  try { return recorder ? createBrowserPingTelemetry(inputModes.get(recorder) ?? "unknown", recorder.attemptId) ?? recorder : null; }
  catch { return null; }
}
export function pingTelemetryHeaders(recorder: PingTelemetryRecorder | null): Record<string, string> {
  try { return recorder ? { [PING_TELEMETRY_ATTEMPT_HEADER]: recorder.attemptId, [PING_TELEMETRY_REQUEST_HEADER]: recorder.requestId } : {}; }
  catch { return {}; }
}

export function pingTelemetryRecord(recorder: PingTelemetryRecorder | null | undefined, fact: Parameters<PingTelemetryRecorder["record"]>[0]) {
  try { recorder?.record(fact); } catch { /* diagnostic only */ }
}

/** Call from a layout effect only after canonical hydration was accepted. No paint claim. */
export function observePingTelemetryCommit(options: {
  recorder: PingTelemetryRecorder | null; outcome: "matched" | "diverged"; isCurrent: () => boolean;
  endCommit?: ReturnType<PingTelemetryRecorder["begin"]> | null; endAttempt: ReturnType<PingTelemetryRecorder["begin"]>;
  requestFrame: (callback: () => void) => number; cancelFrame: (handle: number) => void;
}): () => void {
  let disposed = false;
  const current = () => { try { return !disposed && options.isCurrent(); } catch { return false; } };
  if (!current()) return () => {};
  pingTelemetryRecord(options.recorder, { stage: "react-commit", outcome: options.outcome });
  try { options.endCommit?.("completed"); options.endAttempt(options.outcome); } catch { /* diagnostic only */ }
  let frame: number;
  try { frame = options.requestFrame(() => { if (current()) pingTelemetryRecord(options.recorder, { stage: "render-opportunity", outcome: "completed" }); }); }
  catch { return () => { disposed = true; }; }
  return () => { disposed = true; try { options.cancelFrame(frame); } catch { /* diagnostic only */ } };
}
