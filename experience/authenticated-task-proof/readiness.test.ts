import assert from "node:assert/strict";
import test from "node:test";
import { READINESS_BUDGET_MS, waitForProofReadiness } from "./readiness";

const options = () => ({ origin: "http://127.0.0.1:49731", expiresAt: new Date(Date.now() + 60000).toISOString(), child: () => ({ pid: 123, exitCode: null }), active: () => undefined, budgetMs: 60, requestMs: 20, intervalMs: 2 });
test("unsettled fetch is aborted and bounded by one whole readiness deadline", async () => {
  assert.equal(READINESS_BUDGET_MS, 30000);
  const signals: AbortSignal[] = [];
  const began = Date.now();
  const result = await waitForProofReadiness({ ...options(), fetch: (async (_url, init) => { assert.equal(init?.redirect, "manual"); signals.push(init!.signal!); return new Promise(() => undefined); }) as typeof fetch });
  assert.equal(result.ready, false); assert.equal(result.reason, "readiness-deadline");
  assert(Date.now() - began < 500); assert(result.elapsedMs >= 50); assert(signals.length > 0); assert(signals.every(signal => signal.aborted));
  assert(result.attempts.every(attempt => attempt.error === "TimeoutError"));
});
test("grant expiry caps readiness and server exit prevents further requests", async () => {
  const began = Date.now();
  const expired = await waitForProofReadiness({ ...options(), expiresAt: new Date(Date.now() + 15).toISOString(), fetch: (() => new Promise(() => undefined)) as typeof fetch });
  assert.equal(expired.ready, false); assert(Date.now() - began < 300); assert(expired.budgetMs <= 15);
  let requests = 0;
  const exited = await waitForProofReadiness({ ...options(), child: () => ({ pid: 123, exitCode: 1 }), fetch: (async () => { requests++; return new Response(); }) as typeof fetch });
  assert.equal(exited.reason, "owned-server-exited"); assert.equal(requests, 0);
  const signalled = await waitForProofReadiness({ ...options(), child: () => ({ pid: 123, exitCode: null, signalCode: "SIGTERM" }) });
  assert.equal(signalled.reason, "owned-server-exited");
});
test("only exact 200/no-location is ready; redirect target and raw error data never enter facts", async () => {
  let attempt = 0;
  const ready = await waitForProofReadiness({ ...options(), fetch: (async () => {
    attempt++; if (attempt === 1) return new Response(null, { status: 302, headers: { location: "https://private.example/user_secret?token=secret" } });
    if (attempt === 2) throw Object.assign(new Error("private token/email must not be logged"), { code: "ECONNRESET", cause: { code: "user_private" } });
    return new Response(null, { status: 200 });
  }) as typeof fetch });
  assert.equal(ready.ready, true); assert.equal(ready.attempts[0].redirect, "external"); assert.equal(ready.attempts[1].code, "ECONNRESET");
  assert(!JSON.stringify(ready).includes("private")); assert(!JSON.stringify(ready).includes("secret"));
  const rejected = await waitForProofReadiness({ ...options(), budgetMs: 15, fetch: (async () => new Response(null, { status: 404 })) as typeof fetch });
  assert.equal(rejected.ready, false);
});
