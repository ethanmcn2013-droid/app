import assert from "node:assert/strict";
import test from "node:test";
import { signInDiagnostics, type SignInPageState } from "./sign-in-diagnostics";

const origin = "http://127.0.0.1:49731", issuer = "https://fixture.clerk.accounts.dev";
const privateText = "user_private secret@example.test sk_test_secret eyJsecret.payload.signature";
test("failed substep preserves timing/status/safe state and rethrows original without raw data", async () => {
  const writes: unknown[] = []; let clock = 0;
  const diagnostic = signInDiagnostics(origin, issuer, [issuer, "https://api.clerk.com"], value => writes.push(value), () => clock);
  const error = Object.assign(new Error(privateText), { name: "TimeoutError", code: "ERR_ASSERTION", cause: { code: privateText }, stack: privateText });
  const sample = { ...diagnostic.pageState(`${origin}/sign-in?token=${encodeURIComponent(privateText)}`, { identifier: { count: 1, visible: true } }), rawDOM: privateText, selectors: { identifier: { count: 99999, visible: true, value: privateText } } } as unknown as SignInPageState;
  await assert.rejects(diagnostic.step("identifier", async () => { clock = 42; throw error; }, async () => sample, () => 403), value => value === error);
  const snapshot = diagnostic.snapshot(); const failure = snapshot.steps[1] as Record<string, unknown>;
  assert.equal(snapshot.currentStep, "identifier"); assert.equal(failure.phase, "fail"); assert.equal(failure.elapsedMs, 42); assert.equal(failure.durationMs, 42); assert.equal(failure.status, 403);
  assert.deepEqual(failure.error, { name: "TimeoutError", code: "ERR_ASSERTION", causeCode: undefined });
  assert.equal((failure.state as SignInPageState).selectors.identifier.count, 50);
  for (const value of [privateText, "rawDOM", "token=", "secret@example", "sk_test_", "user_private"]) assert(!JSON.stringify(writes).includes(value));
});
test("browser/network events retain only origin class/resource/status/allowlisted error code", () => {
  const diagnostic = signInDiagnostics(origin, issuer, [issuer, "https://api.clerk.com"], () => undefined);
  diagnostic.network("response", `${issuer}/v1/client?token=${privateText}`, "script", 503);
  diagnostic.network("request-failed", `https://private.example/${privateText}`, "xhr", `net::ERR_BLOCKED_BY_CLIENT at ${privateText}`);
  diagnostic.network("blocked", `https://private.example/${privateText}`, privateText);
  diagnostic.browser("page-error", { name: privateText, code: privateText, message: privateText });
  diagnostic.browser("console-error", new Error(privateText));
  const snapshot = diagnostic.snapshot();
  assert.deepEqual((snapshot.network[0] as { origin: string; status: number }).origin, "clerk-issuer");
  assert.equal((snapshot.network[0] as { status: number }).status, 503);
  assert.equal((snapshot.network[1] as { code: string }).code, "ERR_BLOCKED_BY_CLIENT");
  assert.equal((snapshot.network[2] as { resource: string }).resource, "other");
  assert(!JSON.stringify(snapshot).includes(privateText)); assert(!JSON.stringify(snapshot).includes("private.example")); assert(!JSON.stringify(snapshot).includes("/v1/client"));
  assert.equal(diagnostic.pageState("about:blank").origin, "opaque");
  assert.equal(diagnostic.pageState("not a URL").origin, "invalid");
  assert.equal(diagnostic.pageState(`${origin}/app/tasks?workspaceId=${privateText}`).page, "tasks");
  (snapshot.network[0] as Record<string, unknown>).rawURL = privateText;
  assert(!JSON.stringify(diagnostic.snapshot()).includes(privateText));
  assert.throws(() => diagnostic.network(privateText as "response", issuer, "script"), /Unknown network diagnostic kind/);
  assert.throws(() => diagnostic.browser(privateText as "page-error"), /Unknown browser diagnostic kind/);
});
test("diagnostic counts and serialized bytes stay finite while each channel retains evidence", async () => {
  const diagnostic = signInDiagnostics(origin, issuer, [issuer], () => undefined);
  for (let index = 0; index < 500; index++) {
    diagnostic.network("response", `${issuer}/secret${index}`, "script", 200);
    diagnostic.browser("console-warning");
  }
  for (let index = 0; index < 40; index++) await diagnostic.step("identity", async () => true, async () => diagnostic.pageState(origin));
  const snapshot = diagnostic.snapshot();
  assert(snapshot.network.length <= 96); assert(snapshot.browser.length <= 24); assert(snapshot.steps.length <= 48);
  assert(snapshot.dropped.network > 0); assert(snapshot.dropped.browser > 0); assert(snapshot.dropped.steps > 0);
  assert(Buffer.byteLength(JSON.stringify(snapshot, null, 2)) <= 64 * 1024);
});
test("hung or broken state sampling adds at most a bounded diagnostic wait and preserves action outcome", async () => {
  const diagnostic = signInDiagnostics(origin, issuer, [issuer], () => undefined);
  const start = Date.now();
  const result = await diagnostic.step("redirect", async () => 7, () => new Promise(() => undefined));
  assert.equal(result, 7); assert(Date.now() - start < 1500);
  await assert.rejects(diagnostic.step(privateText as "identifier", async () => undefined), /Unknown sign-in diagnostic step/);
  assert(!JSON.stringify(diagnostic.snapshot()).includes(privateText));
});
