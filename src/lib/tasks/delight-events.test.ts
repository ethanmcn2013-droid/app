import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  beginTaskSync,
  TASKS_ACK_DIAGNOSTIC_EVENT,
  TASKS_SYNC_EVENT,
  type TaskAckDiagnosticDetail,
} from "./delight-events";

const diagnosticKeys = ["at", "id", "operation", "phase"];

function withBrowser(
  enabled: boolean,
  run: (events: Array<{ type: string; detail: unknown }>, announcePending: () => void) => void,
) {
  const priorEnv = { ...process.env };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousCustomEvent = Object.getOwnPropertyDescriptor(globalThis, "CustomEvent");
  const events: Array<{ type: string; detail: unknown }> = [];
  let pending: (() => void) | undefined;
  const fakeWindow = {
    location: { origin: "https://isolated-preview.vercel.app" },
    setTimeout(callback: () => void, delay: number) {
      assert.equal(delay, 300);
      pending = callback;
      return 1;
    },
    clearTimeout() { pending = undefined; },
    dispatchEvent(event: Event & { detail?: unknown }) {
      events.push({ type: event.type, detail: event.detail });
      return true;
    },
  };
  class FakeCustomEvent<T> extends Event {
    detail: T;
    constructor(type: string, init: { detail: T }) {
      super(type);
      this.detail = init.detail;
    }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "CustomEvent", { configurable: true, value: FakeCustomEvent });
  Object.assign(process.env, {
    NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview",
    NEXT_PUBLIC_SIGNAL_TASK_ACK_DIAGNOSTIC: enabled ? "isolated-preview-task-ack-v1" : "",
    NEXT_PUBLIC_SIGNAL_TASK_ACK_ORIGIN: fakeWindow.location.origin,
    NEXT_PUBLIC_SIGNAL_TASK_ACK_UNTIL_MS: String(Date.now() + 60_000),
  });
  try { run(events, () => pending?.()); }
  finally {
    for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key];
    Object.assign(process.env, priorEnv);
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousCustomEvent) Object.defineProperty(globalThis, "CustomEvent", previousCustomEvent);
    else Reflect.deleteProperty(globalThis, "CustomEvent");
  }
}

test("diagnostic observes fast real success with one ID and no visible pending event", () => {
  withBrowser(true, events => {
    const startAt = performance.now();
    const finish = beginTaskSync("create", startAt);
    finish();
    finish();
    const diagnostic = events.filter(event => event.type === TASKS_ACK_DIAGNOSTIC_EVENT)
      .map(event => event.detail as TaskAckDiagnosticDetail);
    assert.equal(diagnostic.length, 2);
    assert.deepEqual(diagnostic.map(event => event.phase), ["start", "success"]);
    assert.equal(diagnostic[0].id, diagnostic[1].id);
    assert.equal(diagnostic[0].operation, "create");
    assert.equal(diagnostic[0].at, startAt);
    assert.ok(diagnostic[1].at >= diagnostic[0].at);
    assert.deepEqual(Object.keys(diagnostic[0]).sort(), diagnosticKeys);
    assert.equal(events.some(event => event.type === TASKS_SYNC_EVENT), false);
  });
});

test("explicit rejection records falsy thrown value without changing visible legacy branch", () => {
  for (const error of [null, undefined, false, 0, ""]) {
    withBrowser(true, events => {
      const finish = beginTaskSync("edit");
      finish(error, true);
      assert.deepEqual(events.filter(event => event.type === TASKS_ACK_DIAGNOSTIC_EVENT)
        .map(event => (event.detail as TaskAckDiagnosticDetail).phase), ["start", "error"]);
      assert.equal(events.some(event => event.type === "tasks:toast"), false);
    });
  }
});

test("slow operations retain the visible pending then success sequence with diagnostic on or off", () => {
  for (const enabled of [false, true]) {
    withBrowser(enabled, (events, announcePending) => {
      const finish = beginTaskSync("complete");
      announcePending();
      assert.equal(events.filter(event => event.type === TASKS_SYNC_EVENT).length, 1);
      finish();
      announcePending();
      assert.deepEqual(events.filter(event => event.type === TASKS_SYNC_EVENT)
        .map(event => (event.detail as { phase: string }).phase), ["pending", "success"]);
      assert.equal(events.some(event => event.type === "tasks:toast"), false);
      assert.equal(events.filter(event => event.type === TASKS_ACK_DIAGNOSTIC_EVENT).length, enabled ? 2 : 0);
    });
  }
});

test("legacy truthy error caller remains an error and keeps its visible toast", () => {
  withBrowser(true, events => {
    beginTaskSync("other")(new Error("synthetic"));
    assert.deepEqual(events.filter(event => event.type === TASKS_ACK_DIAGNOSTIC_EVENT)
      .map(event => (event.detail as TaskAckDiagnosticDetail).phase), ["start", "error"]);
    assert.equal(events.filter(event => event.type === "tasks:toast").length, 1);
  });
});

test("diagnostic gate refuses missing opt-in, wrong origin, expired window, and production", () => {
  withBrowser(false, events => {
    beginTaskSync("complete")();
    assert.equal(events.some(event => event.type === TASKS_ACK_DIAGNOSTIC_EVENT), false);
  });
  withBrowser(true, events => {
    process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_ORIGIN = "https://another-preview.vercel.app";
    beginTaskSync("complete")();
    process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_ORIGIN = "https://isolated-preview.vercel.app";
    process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_UNTIL_MS = String(Date.now() - 1);
    beginTaskSync("complete")();
    process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_UNTIL_MS = String(Date.now() + 60_000);
    process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "production";
    beginTaskSync("complete")();
    assert.equal(events.some(event => event.type === TASKS_ACK_DIAGNOSTIC_EVENT), false);
  });
});

test("actual Next configuration emits only a short-lived test Preview's diagnostic posture", () => {
  const until = String(Date.now() + 60_000);
  const enabled = {
    SIGNAL_TASK_ACK_DIAGNOSTIC: "isolated-preview-task-ack-v1",
    VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production" as const,
    SIGNAL_ACCESS_MODE: "production", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production",
    SIGNAL_RELIABILITY_ATTEST: "isolated-reliability-v1",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic",
    VERCEL_URL: "isolated-preview.vercel.app", SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: until,
  };
  const configUrl = new URL("../../../next.config.ts", import.meta.url).href;
  const script = `const m=await import(${JSON.stringify(configUrl)}); const c=m.default.default??m.default; console.log(JSON.stringify([c.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_DIAGNOSTIC,c.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_ORIGIN,c.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_UNTIL_MS]));`;
  const readPosture = (overrides: Record<string, string>) => JSON.parse(execFileSync(process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { env: { ...process.env, ...enabled, ...overrides }, encoding: "utf8", windowsHide: true }));
  assert.deepEqual(readPosture({}), ["isolated-preview-task-ack-v1", "https://isolated-preview.vercel.app", until]);
  const deniedPostures: Array<Record<string, string>> = [
    { SIGNAL_TASK_ACK_DIAGNOSTIC: "" }, { VERCEL_ENV: "production" }, { VERCEL_TARGET_ENV: "production" },
    { SIGNAL_RELIABILITY_ATTEST: "" }, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic" },
    { VERCEL_URL: "app.signalstudio.ie" }, { SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: "0" },
    { SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(Date.now() + 7 * 60 * 60 * 1000) },
  ];
  for (const denied of deniedPostures) assert.deepEqual(readPosture(denied), ["", "", ""]);
});
