import { createPingTelemetryRecorder, type PingTelemetryEvent, type PingTelemetryRecorder } from "./telemetry";
import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrowserPingLocalSpeech, createPingLocalSpeech,
  type PingLocalSpeechConstructor, type PingLocalSpeechRecognition,
  type PingLocalSpeechResultEvent, type PingLocalSpeechSnapshot,
} from "./local-speech";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(settings: { availability?: string[]; installResult?: boolean; onFinal?: (text: string) => Promise<void>; telemetry?: () => PingTelemetryRecorder | null } = {}) {
  const instances: Native[] = [], queries: unknown[] = [], installs: unknown[] = [];
  const finals: string[] = [], states: PingLocalSpeechSnapshot[] = [];
  const deadlines = new Map<number, { at: number; callback: () => void }>();
  let clock = 0, timerId = 0, context = true, constructorQueries = 0;
  const availability = [...(settings.availability ?? ["available"])];
  class Native implements PingLocalSpeechRecognition {
    static async available(options: unknown) { queries.push(options); return availability.shift() ?? "available"; }
    static async install(options: unknown) { installs.push(options); return settings.installResult ?? true; }
    processLocally = false;
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 0;
    onstart: (() => void) | null = null;
    onresult: ((event: PingLocalSpeechResultEvent) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onnomatch: (() => void) | null = null;
    starts = 0; stops = 0; aborts = 0; abortEnds = true;
    constructor() { instances.push(this); }
    start() { this.starts++; this.onstart?.(); }
    stop() { this.stops++; }
    abort() { this.aborts++; if (this.abortEnds) this.onend?.(); }
    result(segments: [string, boolean][], resultIndex = 0) {
      this.onresult?.({ resultIndex, results: segments.map(([transcript, isFinal]) => ({
        isFinal, length: 1, 0: { transcript },
      })) });
    }
  }
  const controller = createPingLocalSpeech({
    getConstructor: () => { constructorQueries++; return Native; },
    isContextCurrent: () => context,
    onState: value => states.push(value),
    onFinal: async text => { finals.push(text); await settings.onFinal?.(text); },
    telemetry: settings.telemetry,
    now: () => clock,
    setTimer: (callback, ms) => {
      const id = ++timerId; deadlines.set(id, { at: clock + ms, callback });
      return () => { deadlines.delete(id); };
    },
  });
  return { controller, Native, instances, queries, installs, finals, states, deadlines,
    get constructorQueries() { return constructorQueries; },
    setContext(value: boolean) { context = value; },
    advance(ms: number) {
      clock += ms;
      for (const [id, timer] of [...deadlines]) if (timer.at <= clock) { deadlines.delete(id); timer.callback(); }
    },
  };
}

test("construction is lazy; downloadable requires explicit install, recheck, and separate start", async () => {
  const f = fixture({ availability: ["downloadable", "downloadable", "available", "available"] });
  assert.deepEqual(f.controller.getSnapshot(), { phase: "idle", reason: null, elapsedMs: 0 });
  assert.equal(f.constructorQueries, 0);
  assert.equal(await f.controller.start(), false);
  assert.equal(f.controller.getSnapshot().phase, "needs_install");
  assert.equal(f.installs.length, 0);
  assert.equal(f.instances[0].starts, 0);
  assert.equal(await f.controller.install(), true);
  assert.equal(f.installs.length, 1);
  assert.equal(f.queries.length, 3);
  assert.equal(f.instances.every(instance => instance.starts === 0), true);
  assert.equal(f.controller.getSnapshot().phase, "idle");
  for (const options of [...f.queries, ...f.installs]) assert.deepEqual(options, { langs: ["en-US"], processLocally: true });
  assert.equal(await f.controller.start(), true);
  assert.equal(f.instances.at(-1)?.processLocally, true);
  assert.equal(f.instances.at(-1)?.lang, "en-US");
  f.controller.dispose();
});

test("only available admits capture; no automatic install for downloading, unavailable, or unknown states", async () => {
  for (const availability of ["downloading", "unavailable", "unexpected"]) {
    const f = fixture({ availability: [availability, availability] });
    assert.equal(await f.controller.start(), false);
    assert.equal(await f.controller.install(), false);
    assert.equal(f.installs.length, 0);
    assert.equal(f.instances.every(instance => instance.starts === 0), true);
    assert.equal(f.finals.length, 0);
  }
  const failed = fixture({ availability: ["downloadable"], installResult: false });
  assert.equal(await failed.controller.install(), false);
  assert.equal(failed.controller.getSnapshot().reason, "install_failed");
  const notReady = fixture({ availability: ["downloadable", "downloading"] });
  assert.equal(await notReady.controller.install(), false);
  assert.equal(notReady.controller.getSnapshot().phase, "needs_install");
  assert.equal(notReady.instances[0].starts, 0);
});

test("Finish stops once; cumulative observed finals plus native end hand off exactly once", async () => {
  const f = fixture();
  assert.equal(await f.controller.start(), true);
  const native = f.instances[0];
  native.result([["assign", false]]);
  native.result([[" assign me ", true], ["", false]], 0);
  native.result([[" assign me ", true], ["please", true]], 1);
  assert.equal(f.finals.length, 0);
  f.controller.finish(); f.controller.finish();
  assert.equal(native.stops, 1);
  assert.equal(f.controller.getSnapshot().phase, "finishing");
  assert.equal(f.finals.length, 0);
  const lateEnd = native.onend;
  native.onend?.(); lateEnd?.();
  assert.equal(f.controller.getSnapshot().phase, "processing");
  await flush();
  assert.deepEqual(f.finals, ["assign me please"]);
  assert.equal(f.controller.getSnapshot().phase, "finished");
  assert.equal("transcript" in f.controller.getSnapshot(), false);
  assert.equal(JSON.stringify(f.states).includes("assign me"), false);
  assert.equal(f.deadlines.size, 0);
  assert.equal(native.onresult, null);
  assert.equal(native.onend, null);
  assert.equal(native.aborts, 0);
});

test("early native end, empty results, interim tail, no-match, and errors never deliver text", async () => {
  for (const scenario of ["early", "empty", "interim", "no_match", "error"] as const) {
    const f = fixture(); await f.controller.start(); const native = f.instances[0];
    if (scenario !== "empty") native.result([["status doing", scenario !== "interim"]]);
    if (scenario !== "early") f.controller.finish();
    if (scenario === "no_match") native.onnomatch?.();
    else if (scenario === "error") native.onerror?.({ error: "network", message: "private transcript must not escape" });
    else native.onend?.();
    await flush();
    assert.deepEqual(f.finals, [], scenario);
    assert.equal(f.deadlines.size, 0, scenario);
    assert.equal(native.aborts, scenario === "no_match" || scenario === "error" ? 1 : 0, scenario);
    assert.equal(JSON.stringify(f.states).includes("private transcript"), false);
  }
});

test("malformed, shrinking, revised-final, and over-limit results fail closed", async () => {
  for (const scenario of ["empty_final", "over", "spaces", "revision", "shrink", "bad_index"] as const) {
    const f = fixture(); await f.controller.start(); const native = f.instances[0];
    if (scenario === "empty_final") native.result([["  ", true]]);
    if (scenario === "over") native.result([["😀".repeat(4001), true]]);
    if (scenario === "spaces") native.result([["a".repeat(2000), true], ["b".repeat(2000), true]]);
    if (scenario === "revision") { native.result([["assign me", true]]); native.result([["unassign me", true]]); }
    if (scenario === "shrink") { native.result([["assign", false], ["me", false]]); native.result([["status doing", true]]); }
    if (scenario === "bad_index") native.result([["assign me", true]], 1);
    f.controller.finish(); native.onend?.(); await flush();
    assert.deepEqual(f.finals, [], scenario);
    assert.equal(f.controller.getSnapshot().reason, "invalid_or_over_limit_result", scenario);
  }
  const atCap = fixture(); await atCap.controller.start();
  atCap.instances[0].result([["😀".repeat(4000), true]]);
  atCap.controller.finish(); atCap.instances[0].onend?.(); await flush();
  assert.equal([...atCap.finals[0]].length, 4000);
});

test("cancel and dispose clear handlers/deadlines; saved late callbacks cannot deliver or rearm", async () => {
  for (const action of ["cancel", "dispose"] as const) {
    const f = fixture(); await f.controller.start(); const native = f.instances[0];
    native.result([["assign me", true]]); f.controller.finish();
    const end = native.onend, result = native.onresult;
    f.controller[action](); end?.(); result?.({ resultIndex: 0, results: [{ isFinal: true, length: 1, 0: { transcript: "status doing" } }] });
    await flush();
    assert.deepEqual(f.finals, []);
    assert.equal(native.aborts, 1);
    assert.equal(f.deadlines.size, 0);
    assert.equal(native.onstart, null); assert.equal(native.onerror, null); assert.equal(native.onnomatch, null);
    if (action === "dispose") assert.equal(await f.controller.start(), false);
  }
});

test("context loss before finish, end, or deferred handoff prevents delivery", async () => {
  for (const point of ["finish", "end", "handoff"] as const) {
    const f = fixture(); await f.controller.start(); const native = f.instances[0];
    native.result([["assign me", true]]);
    if (point === "finish") f.setContext(false);
    f.controller.finish();
    if (point === "end") f.setContext(false);
    native.onend?.();
    if (point === "handoff") f.setContext(false);
    await flush();
    assert.deepEqual(f.finals, [], point);
    assert.equal(f.controller.getSnapshot().reason, "context_changed", point);
  }
});

test("cancel or context loss during asynchronous readiness cannot start a late microphone", async () => {
  for (const action of ["cancel", "context", "dispose"] as const) {
    const f = fixture(), ready = deferred<string>();
    f.Native.available = async options => { f.queries.push(options); return ready.promise; };
    const starting = f.controller.start();
    assert.equal(await f.controller.start(), false);
    if (action === "context") f.setContext(false); else f.controller[action]();
    ready.resolve("available");
    assert.equal(await starting, false);
    assert.equal(f.instances[0].starts, 0);
    assert.deepEqual(f.finals, []);
  }
  const f = fixture({ availability: ["downloadable"] }), installed = deferred<boolean>();
  f.Native.install = async options => { f.installs.push(options); return installed.promise; };
  const installing = f.controller.install(); await flush(); f.controller.cancel(); installed.resolve(true);
  assert.equal(await installing, false);
  assert.equal(f.queries.length, 1);
  assert.equal(f.instances[0].starts, 0);
});

test("30-second deadline cancels listening and finishing; a late end is never accepted", async () => {
  for (const finishing of [false, true]) {
    const f = fixture(); await f.controller.start(); const native = f.instances[0];
    native.result([["assign me", true]]); if (finishing) f.controller.finish();
    const end = native.onend;
    f.advance(29_999); assert.equal(f.controller.getSnapshot().elapsedMs, 29_999);
    f.advance(1); end?.(); await flush();
    assert.equal(f.controller.getSnapshot().reason, "timeout");
    assert.equal(f.controller.getSnapshot().elapsedMs, 30_000);
    assert.equal(native.aborts, 1); assert.deepEqual(f.finals, []);
  }
});

test("local flag must exist and read back true; cloud-only APIs and changing flags are refused", async () => {
  let queries = 0, starts = 0;
  class CloudOnly { static async available() { queries++; return "available"; } static async install() { return true; } start() { starts++; } }
  const controller = createPingLocalSpeech({ getConstructor: () => CloudOnly as unknown as PingLocalSpeechConstructor,
    isContextCurrent: () => true, onState() {}, onFinal: async () => { assert.fail("cloud callback"); } });
  assert.equal(await controller.start(), false); assert.equal(queries, 0); assert.equal(starts, 0);
  for (const throws of [false, true]) {
    const f = fixture(); await f.controller.start(); const native = f.instances[0];
    Object.defineProperty(native, "processLocally", { get() { if (throws) throw Error("no local mode"); return false; } });
    native.result([["assign me", true]]); f.controller.finish(); await flush();
    assert.equal(f.controller.getSnapshot().reason, "local_processing_required"); assert.deepEqual(f.finals, []);
  }
  const ignored = fixture();
  Object.defineProperty(ignored.Native.prototype, "processLocally", { get: () => false, set() {} });
  // The fake's own property shadows its prototype: replace construction with a port whose setter ignores writes.
  class Ignored extends ignored.Native { constructor() { super(); Object.defineProperty(this, "processLocally", { get: () => false, set() {} }); } }
  const refusal = createPingLocalSpeech({ getConstructor: () => Ignored, isContextCurrent: () => true,
    onState() {}, onFinal: async () => { assert.fail("ignored local flag"); } });
  assert.equal(await refusal.start(), false); assert.equal(ignored.queries.length, 0);
});

test("parent handoff rejection remains error; cancellation cannot convert pending work into success", async () => {
  for (const outcome of ["reject", "cancel"] as const) {
    const pending = deferred<void>(), f = fixture({ onFinal: () => pending.promise });
    await f.controller.start(); f.instances[0].result([["status doing", true]]);
    f.controller.finish(); f.instances[0].onend?.(); await flush();
    assert.deepEqual(f.finals, ["status doing"]);
    assert.equal(f.controller.getSnapshot().phase, "processing");
    assert.equal(await f.controller.start(), false);
    if (outcome === "cancel") f.controller.cancel();
    if (outcome === "reject") pending.reject(Error("unknown Task response")); else pending.resolve();
    await flush();
    assert.equal(f.controller.getSnapshot().phase, outcome === "reject" ? "error" : "closed");
    assert.equal(f.states.some(state => state.phase === "finished"), false);
    assert.equal(f.finals.length, 1);
  }
});

test("browser factory is lazy and never falls back to webkit-only recognition", async () => {
  const target = globalThis as typeof globalThis & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const standard = Object.getOwnPropertyDescriptor(target, "SpeechRecognition");
  const webkit = Object.getOwnPropertyDescriptor(target, "webkitSpeechRecognition");
  let constructed = 0;
  try {
    Object.defineProperty(target, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(target, "webkitSpeechRecognition", { configurable: true, value: class { constructor() { constructed++; } } });
    const controller = createBrowserPingLocalSpeech({ isContextCurrent: () => true, onState() {}, onFinal: async () => { assert.fail("fallback callback"); } });
    assert.equal(constructed, 0); assert.equal(await controller.start(), false);
    assert.equal(constructed, 0); assert.equal(controller.getSnapshot().phase, "unavailable");
  } finally {
    if (standard) Object.defineProperty(target, "SpeechRecognition", standard); else delete target.SpeechRecognition;
    if (webkit) Object.defineProperty(target, "webkitSpeechRecognition", webkit); else delete target.webkitSpeechRecognition;
  }
});

test("abort blocks this and recreated controllers until actual native end; end never hands off cancelled text", async () => {
  const f = fixture(); await f.controller.start(); const native = f.instances[0];
  native.abortEnds = false; native.result([["assign me", true]]); f.controller.finish(); f.controller.cancel();
  assert.equal(f.controller.getSnapshot().phase, "closing");
  assert.equal(await f.controller.start(), false);
  const replacement = createPingLocalSpeech({ getConstructor: () => f.Native, isContextCurrent: () => true,
    onState() {}, onFinal: async () => { assert.fail("recreated overlap"); } });
  assert.equal(await replacement.start(), false);
  assert.equal(replacement.getSnapshot().reason, "native_closure_pending");
  assert.equal(f.instances.length, 1);
  native.onend?.(); await flush();
  assert.equal(f.controller.getSnapshot().phase, "closed");
  assert.deepEqual(f.finals, []); assert.equal(f.deadlines.size, 0);
  assert.equal(await replacement.start(), true);
  replacement.dispose();
});

test("unobserved closure fails closed after five seconds, including recreation and late native end", async () => {
  const f = fixture(); await f.controller.start(); const native = f.instances[0];
  native.abortEnds = false; f.controller.dispose(); const end = native.onend;
  f.advance(4_999); assert.equal(f.controller.getSnapshot().phase, "closing");
  f.advance(1); assert.equal(f.controller.getSnapshot().reason, "native_closure_unconfirmed");
  end?.(); assert.equal(f.controller.getSnapshot().phase, "unavailable");
  const replacement = createPingLocalSpeech({ getConstructor: () => f.Native, isContextCurrent: () => true,
    onState() {}, onFinal: async () => { assert.fail("closure guessed"); } });
  assert.equal(await replacement.start(), false);
  assert.equal(replacement.getSnapshot().reason, "native_closure_unconfirmed");
  assert.equal(f.instances.length, 1); assert.deepEqual(f.finals, []);
});

test("hung readiness times out at ten seconds; late settlement cannot start or unlock a newer query", async () => {
  const f = fixture(), old = deferred<string>(), fresh = deferred<string>();
  let queries = 0;
  f.Native.available = async () => ++queries === 1 ? old.promise : fresh.promise;
  const first = f.controller.start(); f.advance(10_000);
  assert.equal(await first, false); assert.equal(f.controller.getSnapshot().reason, "readiness_timeout");
  assert.equal(f.instances[0].starts, 0);
  const second = f.controller.start(); old.resolve("available"); await flush();
  assert.equal(await f.controller.start(), false);
  assert.equal(f.instances.every(native => native.starts === 0), true);
  fresh.resolve("available"); assert.equal(await second, true);
  assert.equal(f.instances[1].starts, 1); f.controller.dispose();
});

test("hung explicit install times out at 120 seconds without a microphone or automatic repeat", async () => {
  const f = fixture({ availability: ["downloadable"] }), pending = deferred<boolean>();
  f.Native.install = async options => { f.installs.push(options); return pending.promise; };
  const installing = f.controller.install(); await flush();
  f.advance(119_999); assert.equal(f.controller.getSnapshot().phase, "installing");
  f.advance(1); assert.equal(await installing, false);
  assert.equal(f.controller.getSnapshot().reason, "install_timeout");
  pending.resolve(true); await flush();
  assert.equal(f.queries.length, 1); assert.equal(f.installs.length, 1);
  assert.equal(f.instances[0].starts, 0); assert.deepEqual(f.finals, []);
  assert.equal(f.deadlines.size, 0);
});


test("speech diagnostics distinguish local finality from Task outcome and never include native content", async () => {
  const events: PingTelemetryEvent[] = []; let now = 0;
  const recorder = createPingTelemetryRecorder({ source: "client", inputMode: "local-speech", now: () => now, emit: e => events.push(e) });
  const f = fixture({ telemetry: () => recorder });
  await f.controller.start(); now = 25.5;
  f.instances[0].result([["PRIVATE transcript", true]]); f.controller.finish(); now = 40.25; f.instances[0].onend?.();
  await flush(); await flush();
  assert.equal(f.finals.length, 1);
  assert.ok(events.some(e => e.stage === "activation" && e.outcome === "completed"));
  assert.ok(events.some(e => e.stage === "recognition" && e.durationMs === 25.5));
  assert.ok(events.some(e => e.stage === "finish-final" && e.durationMs === 14.75));
  assert.ok(!events.some(e => e.stage === "receipt" || e.outcome.startsWith("committed")));
  assert.ok(!JSON.stringify(events).includes("PRIVATE"));
  f.controller.dispose();
});
test("throwing speech observer cannot change final handoff or teardown; cancelled finals remain cancelled", async () => {
  const broken = { begin() { throw Error("observer failed"); } } as unknown as PingTelemetryRecorder;
  const f = fixture({ telemetry: () => broken }); await f.controller.start();
  f.instances[0].result([["allowed request", true]]); f.controller.finish(); f.instances[0].onend?.(); await flush();
  assert.deepEqual(f.finals, ["allowed request"]); f.controller.dispose(); assert.equal(f.deadlines.size, 0);
  const events: PingTelemetryEvent[] = [];
  const recorder = createPingTelemetryRecorder({ source: "client", emit: e => events.push(e) });
  const cancelled = fixture({ telemetry: () => recorder }); await cancelled.controller.start();
  cancelled.instances[0].result([["PRIVATE cancelled", true]]); const late = cancelled.instances[0].onend;
  cancelled.controller.cancel(); late?.(); await flush();
  assert.equal(cancelled.finals.length, 0);
  assert.ok(events.some(e => e.stage === "recognition" && e.outcome === "cancelled"));
  assert.ok(!events.some(e => e.stage === "finish-final" && e.outcome === "completed"));
  cancelled.controller.dispose();
});
