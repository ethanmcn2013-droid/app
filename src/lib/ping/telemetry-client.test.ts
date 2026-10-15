import assert from "node:assert/strict";
import test from "node:test";
import { createPingTelemetryRecorder, type PingTelemetryEvent } from "./telemetry";
import { createPingTelemetryCollector, createBrowserPingTelemetry, pingTelemetryBegin, observePingTelemetryCommit } from "./telemetry-client";
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function event(): Promise<PingTelemetryEvent> {
  const events: PingTelemetryEvent[] = [];
  createPingTelemetryRecorder({ source: "client", inputMode: "typed", emit: e => events.push(e) }).record({ stage: "attempt", outcome: "completed" });
  await tick(); return events[0];
}
test("browser diagnostics are default off and observer failures cannot escape", () => {
  const original = process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED;
  delete process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED;
  try { assert.equal(createBrowserPingTelemetry("typed"), null); }
  finally { if (original !== undefined) process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED = original; }
  const observer = { begin() { throw new Error("PRIVATE CONTENT"); } } as unknown as ReturnType<typeof createPingTelemetryRecorder>;
  assert.doesNotThrow(() => pingTelemetryBegin(observer, "execute")("unknown"));
});
test("collector validates content-free client events, bounds batches and never instruments itself", async () => {
  const e = await event(), bodies: string[] = [], urls: string[] = [];
  const collector = createPingTelemetryCollector({ fetcher: (async (url, init) => {
    urls.push(String(url)); bodies.push(String(init?.body));
    assert.deepEqual(Object.keys(init?.headers ?? {}), ["content-type"]);
    return new Response(null, { status: 204 });
  }) as typeof fetch });
  for (let i = 0; i < 40; i++) collector.emit({ ...e, sequence: i });
  collector.emit({ ...e, text: "PRIVATE TITLE" } as PingTelemetryEvent);
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(collector.coverage().acceptedByReceiver, 40);
  assert.equal(collector.coverage().dropped, 1);
  assert.ok(bodies.length >= 3);
  for (const body of bodies) {
    assert.ok(new TextEncoder().encode(body).length <= 8192);
    const batch = JSON.parse(body); assert.equal(batch.version, "ping.telemetry.batch.v1"); assert.ok(batch.events.length <= 16);
    assert.ok(!body.includes("PRIVATE"));
  }
  assert.ok(urls.every(url => url === "/api/ping/telemetry")); collector.dispose();
});
test("collector contains rejected delivery, retains loss coverage and does not retry the lost batch", async () => {
  const e = await event(), batches: PingTelemetryEvent[][] = []; let calls = 0;
  const collector = createPingTelemetryCollector({ fetcher: (async (_url, init) => {
    batches.push(JSON.parse(String(init?.body)).events); if (++calls === 1) throw Error("PRIVATE TOKEN");
    return new Response(null, { status: 204 });
  }) as typeof fetch });
  collector.emit(e); await tick(); await tick();
  assert.equal(calls, 1); assert.equal(collector.coverage().unknownDelivery, 1);
  collector.emit({ ...e, sequence: 1 }); await tick(); await tick();
  assert.equal(calls, 2); assert.equal(batches[1][0].outcome, "overflow"); assert.equal(batches[1][0].droppedCount, 1);
  assert.notEqual(batches[1][0].requestId, e.requestId);
  collector.dispose();
});
test("collector bounds queue and quarantines a sink that ignores abort; disposal never sends queued events", async () => {
  const e = await event(); let calls = 0;
  const collector = createPingTelemetryCollector({ maxQueued: 2, timeoutMs: 5,
    fetcher: (async () => { calls++; return new Promise<Response>(() => {}); }) as typeof fetch });
  collector.emit(e); collector.emit(e); collector.emit(e);
  assert.equal(collector.coverage().queued, 2); assert.equal(collector.coverage().dropped, 1);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(collector.coverage().inFlight, false); assert.equal(collector.coverage().unknownDelivery, 2);
  collector.emit(e); await tick(); assert.equal(calls, 1);
  collector.dispose();
  const disposed = createPingTelemetryCollector({ fetcher: (async () => { calls++; return new Response(); }) as typeof fetch });
  disposed.emit(e); disposed.dispose(); await tick(); assert.equal(calls, 1); assert.equal(disposed.coverage().dropped, 1);
});


test("accepted React commit and frame opportunity stay separate; stale or disposed observations never claim a frame", async () => {
  const events: PingTelemetryEvent[] = [], ends: string[] = [];
  const recorder = createPingTelemetryRecorder({ source: "client", emit: e => events.push(e) });
  let current = true, cancelled = false;
  const frame: { callback: (() => void) | null } = { callback: null };
  const observe = () => observePingTelemetryCommit({ recorder, outcome: "matched", isCurrent: () => current,
    endCommit: outcome => { ends.push(outcome); }, endAttempt: outcome => { ends.push(outcome); },
    requestFrame: callback => { frame.callback = callback; return 1; }, cancelFrame: () => { cancelled = true; } });
  const cleanup = observe(); await tick();
  assert.deepEqual(ends, ["completed", "matched"]);
  assert.ok(events.some(e => e.stage === "react-commit"));
  assert.ok(!events.some(e => e.stage === "render-opportunity"));
  cleanup(); frame.callback?.(); await tick();
  assert.equal(cancelled, true); assert.ok(!events.some(e => e.stage === "render-opportunity"));
  current = false; const before = events.length; observe(); await tick(); assert.equal(events.length, before);
  current = true; observe(); frame.callback?.(); await tick();
  assert.equal(events.filter(e => e.stage === "render-opportunity").length, 1);
  assert.ok(!JSON.stringify(events).includes("painted"));
});
