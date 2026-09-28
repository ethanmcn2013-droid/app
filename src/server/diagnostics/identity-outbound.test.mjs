import assert from "node:assert/strict";
import {AsyncLocalStorage} from "node:async_hooks";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const outboundPath = fileURLToPath(new URL("./identity-outbound.ts", import.meta.url));
const timingPath = fileURLToPath(new URL("./identity-timing.ts", import.meta.url));
const authPath = fileURLToPath(new URL("../auth.ts", import.meta.url));
const operationalLogPath = fileURLToPath(new URL("../operational-log.ts", import.meta.url));
const scrubPath = fileURLToPath(new URL("../../lib/sentry-scrub.ts", import.meta.url));

function loadSource(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
    fileName: path,
  }).outputText;
  const loaded = {exports: {}};
  new Function("require", "module", "exports", compiled)((name) => dependencies[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

function enabledEnv() {
  return {
    SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: "isolated-preview-auth-timing-v1",
    SIGNAL_IDENTITY_OUTBOUND_DIAGNOSTIC: "isolated-preview-clerk-outbound-v1",
    SIGNAL_SPRINT_PREVIEW_AUTH: "isolated-clerk-preview-v1",
    SIGNAL_RELIABILITY_ATTEST: "isolated-reliability-v1",
    SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(Date.now() + 60 * 60 * 1_000),
    VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production",
    NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview", SIGNAL_ACCESS_MODE: "production",
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production", VERCEL_DEPLOYMENT_ID: "dpl_Synthetic123",
    VERCEL_PROJECT_ID: "prj_Synthetic123", VERCEL_URL: "synthetic-preview.vercel.app",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic",
  };
}

async function withEnv(env, work) {
  const keys = [...new Set([...Object.keys(env), "CLERK_API_URL", "CLERK_API_VERSION"])];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  try { return await work(); }
  finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

function fixture(operationalLog, options = {}) {
  const request = new AsyncLocalStorage();
  const callbacks = new Map();
  const logs = [];
  const cache = implementation => {
    const values = new Map();
    return () => {
      const id = request.getStore() ?? 0;
      if (!values.has(id)) values.set(id, implementation());
      return values.get(id);
    };
  };
  const after = callback => {
    const id = request.getStore() ?? 0;
    const bucket = callbacks.get(id) ?? [];
    bucket.push(callback); callbacks.set(id, bucket);
  };
  const timing = loadSource(timingPath, {
    "server-only": {}, "react": {cache}, "next/server": {after},
    "@/lib/auth/recipient-proof-authorized-parties": {SPRINT_PREVIEW_AUTH_MARKER: "isolated-clerk-preview-v1"},
    "@/server/operational-log": {opLog() {}},
  });
  let subscriber; let subscriptionCount = 0;
  const channel = {subscribe(callback) {
    subscriptionCount++;
    if (options.failSubscription) throw Error("private-subscription-failure");
    subscriber = callback;
  }};
  const outbound = loadSource(outboundPath, {
    "server-only": {}, "react": {cache}, "next/server": {after},
    "node:diagnostics_channel": {channel: name => {assert.equal(name, "undici:request:create"); return channel;}},
    "@/server/diagnostics/identity-timing": timing,
    "@/server/operational-log": operationalLog ?? {opLog: (level, scope, message, fields) => logs.push({level, scope, message, fields})},
  });
  return {outbound, request, callbacks, logs,
    publish: event => subscriber?.(event),
    subscriptionCount: () => subscriptionCount};
}

const profile = (path = "/v1/users/user_private_canary") => ({request: {
  origin: "https://api.clerk.com", method: "GET", path,
  get headers() {throw new Error("headers-must-not-be-read");},
  get body() {throw new Error("body-must-not-be-read");},
}});

test("outbound flag inherits every timing guard, test keys, expiry and exact Clerk API pin", () => {
  const {outbound} = fixture();
  const env = enabledEnv(); const now = Date.now();
  assert.equal(outbound.identityOutboundEnabled(env, now), true);
  for (const change of [
    {SIGNAL_IDENTITY_OUTBOUND_DIAGNOSTIC: undefined},
    {SIGNAL_IDENTITY_OUTBOUND_DIAGNOSTIC: "true"},
    {SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: undefined},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now - 1)},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now + 7 * 60 * 60 * 1_000)},
    {VERCEL_ENV: "production"}, {VERCEL_TARGET_ENV: "production"},
    {NODE_ENV: "development"}, {NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic"},
    {CLERK_SECRET_KEY: "sk_live_synthetic"},
    {CLERK_API_URL: "https://other.example"}, {CLERK_API_VERSION: "v2"},
  ]) assert.equal(outbound.identityOutboundEnabled({...env, ...change}, now), false);
});

test("classifier reads only exact method, Clerk origin and opaque one-segment path", () => {
  const {outbound} = fixture();
  assert.equal(outbound.classifiedClerkProfileRequest(profile()), true);
  for (const request of [
    {origin: "https://api.clerk.com", method: "POST", path: "/v1/users/user_a"},
    {origin: "https://other.example", method: "GET", path: "/v1/users/user_a"},
    {origin: "https://api.clerk.com", method: "GET", path: "/v1/users/user_a?expand=1"},
    {origin: "https://api.clerk.com", method: "GET", path: "/v1/users/user_a/sessions"},
    {origin: "https://api.clerk.com", method: "GET", path: "/v2/users/user_a"},
  ]) assert.equal(outbound.classifiedClerkProfileRequest({request}), false);
  assert.equal(outbound.classifiedClerkProfileRequest({request: {get origin() {throw Error("private-url");}}}), null);
  assert.equal(outbound.classifiedClerkProfileRequest({}), null);
});

test("scoped concurrent currentUser calls remain numeric and isolated across render collectors", async () => {
  const f = fixture();
  await withEnv(enabledEnv(), async () => {
    const work = (id, scope, path, value) => f.request.run(id, () => f.outbound.withIdentityOutboundScope(scope,
      () => f.outbound.observeCurrentUserOutbound(async () => {
        await new Promise(resolve => setImmediate(resolve));
        f.publish(profile(path));
        f.publish({request: {origin: "https://other.example", method: "GET", path: "/other"}});
        return value;
      })));
    const result = await Promise.all([
      work(1, "taskAction", "/v1/users/user_private_actor_one", "private-result-one"),
      work(2, "routeResolver", "/v1/users/user_private_actor_two", "private-result-two"),
    ]);
    assert.deepEqual(result, ["private-result-one", "private-result-two"]);
    assert.equal(f.subscriptionCount(), 1);
    f.publish(profile()); // No profile ALS store: this event belongs to no collector.
    assert.equal(f.callbacks.get(1)?.length, 1);
    assert.equal(f.callbacks.get(2)?.length, 1);
    f.callbacks.get(1)[0](); f.callbacks.get(2)[0]();
    assert.equal(f.logs.length, 2);
    assert.deepEqual(f.logs.map(log => log.fields.taskAction_profileOutboundAttempts), [1, 0]);
    assert.deepEqual(f.logs.map(log => log.fields.routeResolver_profileOutboundAttempts), [0, 1]);
    assert.deepEqual(f.logs.map(log => log.fields.taskAction_otherTransportEvents), [1, 0]);
    assert.ok(f.logs.every(log => log.fields.positiveControlPassed === false));
    assert.ok(f.logs.every(log => Object.values(log.fields).every(value => typeof value === "number" || typeof value === "boolean")));
    assert.doesNotMatch(JSON.stringify(f.logs), /private|actor_one|actor_two|canary|headers|body|result/i);
  });
});

test("existing read action is a positive control only after a classified Clerk GET is observed", async () => {
  const f = fixture();
  await withEnv(enabledEnv(), async () => {
    await f.request.run(3, () => f.outbound.withIdentityOutboundScope("readControl",
      () => f.outbound.observeCurrentUserOutbound(async () => "read-result")));
    f.callbacks.get(3)[0]();
    assert.equal(f.logs[0].fields.readControl_profileInvocations, 1);
    assert.equal(f.logs[0].fields.readControl_profileOutboundAttempts, 0);
    assert.equal(f.logs[0].fields.positiveControlPassed, false);
    await f.request.run(4, () => f.outbound.withIdentityOutboundScope("readControl",
      () => f.outbound.observeCurrentUserOutbound(async () => {f.publish(profile()); return "read-result";})));
    f.callbacks.get(4)[0]();
    assert.equal(f.logs[1].fields.readControl_profileOutboundAttempts, 1);
    assert.equal(f.logs[1].fields.readControl_transportObserved, true);
    assert.equal(f.logs[1].fields.positiveControlPassed, true);
  });
});

test("real getCurrentUser wiring scopes one Clerk event without changing provisioning or error", async () => {
  const f = fixture();
  let profileCalls = 0; let provisionCalls = 0;
  const profileError = Error("private-original-profile-error");
  let failProfile = false;
  const authModule = loadSource(authPath, {
    "server-only": {},
    "next/headers": {cookies: async () => ({get: () => undefined})},
    "@clerk/nextjs/server": {
      auth: async () => ({userId: "private-clerk-id"}),
      currentUser: async () => {
        profileCalls++;
        f.publish(profile("/v1/users/private_clerk_id"));
        if (failProfile) throw profileError;
        return {primaryEmailAddressId: "primary", emailAddresses: [{id: "primary", emailAddress: "private@example.invalid"}]};
      },
    },
    "drizzle-orm": {eq: (...args) => args},
    "@/server/db": {db: {select: () => ({from: () => ({where: async () => [{id: "private-persisted-id"}]})})}},
    "@/server/db/schema": {users: {id: "id", clerkId: "clerkId"}},
    "@/server/db/seed": {LEGACY_WORKSPACE_ID: "legacy"},
    "@/server/db/ensure-user": {ensureUserProvisioned: async () => {provisionCalls++;}},
    "@/lib/access-mode": {isDemoMode: () => false},
    "@/server/projects/catalog": {},
    "@/server/demo/tasks-demo": {DEMO_USER_ID: "demo", DEMO_WORKSPACE_ID: "demo-project"},
    "@/server/diagnostics/identity-timing": {beginIdentityTiming: () => ({measure: (_stage, work) => work(), finish() {}})},
    "@/server/diagnostics/identity-outbound": f.outbound,
  });
  await withEnv(enabledEnv(), async () => {
    assert.equal(await f.request.run(10, () => f.outbound.withIdentityOutboundScope("taskAction", authModule.getCurrentUser)), "private-persisted-id");
    assert.equal(profileCalls, 1);
    assert.equal(provisionCalls, 1);
    f.callbacks.get(10)[0]();
    assert.equal(f.logs[0].fields.taskAction_profileInvocations, 1);
    assert.equal(f.logs[0].fields.taskAction_profileOutboundAttempts, 1);
    assert.equal(f.logs[0].fields.positiveControlPassed, false);

    failProfile = true;
    await assert.rejects(f.request.run(11, () => f.outbound.withIdentityOutboundScope("taskAction", authModule.getCurrentUser)), error => error === profileError);
    assert.equal(profileCalls, 2);
    assert.equal(provisionCalls, 1);
    f.callbacks.get(11)[0]();
    assert.equal(f.logs[1].fields.taskAction_profileOutboundAttempts, 1);
  });
});

test("expiry after subscription and malformed events cannot affect auth or add counts", async () => {
  const f = fixture();
  const env = enabledEnv();
  await withEnv(env, async () => {
    await f.request.run(5, () => f.outbound.observeCurrentUserOutbound(async () => {
      f.publish({request: {get path() {throw Error("private-path");}, origin: "https://api.clerk.com", method: "GET"}});
      return "kept";
    }));
    assert.equal(f.subscriptionCount(), 1);
    process.env.SIGNAL_RELIABILITY_ATTEST_UNTIL_MS = String(Date.now() - 1);
    f.publish(profile());
    assert.equal(await f.request.run(6, () => f.outbound.observeCurrentUserOutbound(async () => "still-kept")), "still-kept");
    assert.equal(f.callbacks.has(6), false);
    f.callbacks.get(5)[0]();
    assert.equal(f.logs[0].fields.unclassified_profileInvocations, 1);
    assert.equal(f.logs[0].fields.unclassified_profileOutboundAttempts, 0);
    assert.equal(f.logs[0].fields.unclassified_otherTransportEvents, 0);
  });
});

test("disabled guard and failed channel subscription call the original identity work once", async () => {
  const disabled = fixture();
  let disabledCalls = 0;
  await withEnv({...enabledEnv(), SIGNAL_IDENTITY_OUTBOUND_DIAGNOSTIC: undefined}, async () => {
    assert.equal(await disabled.outbound.observeCurrentUserOutbound(async () => {disabledCalls++; return "kept";}), "kept");
    assert.equal(disabled.subscriptionCount(), 0);
    assert.equal(disabled.callbacks.size, 0);
  });
  assert.equal(disabledCalls, 1);

  const failed = fixture(undefined, {failSubscription: true});
  let workCalls = 0;
  const originalError = Error("original-private-profile-error");
  await withEnv(enabledEnv(), async () => {
    assert.equal(await failed.request.run(9, () => failed.outbound.observeCurrentUserOutbound(async () => {
      workCalls++; return "kept-result";
    })), "kept-result");
    await assert.rejects(failed.request.run(9, () => failed.outbound.observeCurrentUserOutbound(async () => {
      workCalls++; throw originalError;
    })), error => error === originalError);
    assert.equal(failed.subscriptionCount(), 2);
    assert.equal(failed.callbacks.get(9)?.length, 1);
    failed.callbacks.get(9)[0]();
    assert.equal(failed.logs[0].fields.unclassified_profileInvocations, 2);
    assert.equal(failed.logs[0].fields.unclassified_profileOutboundAttempts, 0);
  });
  assert.equal(workCalls, 2);
});

test("throwing schedule and logger preserve original result or exact thrown error once", async () => {
  const f = fixture();
  const {outbound} = f;
  let calls = 0;
  const emitted = [];
  const collector = outbound.createIdentityOutboundCollector({
    schedule: () => {throw Error("private-scheduler");},
    emit: value => emitted.push(value),
  });
  collector.recordInvocation("taskAction");
  assert.equal(collector.summary().scopes.taskAction.profileInvocations, 1);
  assert.deepEqual(emitted, []);
  const logger = outbound.createIdentityOutboundCollector({
    schedule: callback => emitted.push(callback),
    emit: () => {throw Error("private-logger");},
  });
  logger.recordInvocation("routeResolver");
  assert.doesNotThrow(() => emitted[0]());
  await withEnv(enabledEnv(), async () => {
    const expected = Error("private-profile-failure");
    await assert.rejects(f.request.run(7, () => outbound.observeCurrentUserOutbound(async () => {
      calls++; throw expected;
    })), error => error === expected);
    assert.equal(calls, 1);
  });
});

test("approved operational logger emits only the fixed scalar outbound schema", async () => {
  const scrub = loadSource(scrubPath, {});
  const operationalLog = loadSource(operationalLogPath, {"@/lib/sentry-scrub": scrub});
  const f = fixture(operationalLog);
  const originalWarn = console.warn;
  const lines = [];
  console.warn = line => lines.push(String(line));
  try {
    await withEnv(enabledEnv(), async () => {
      await f.request.run(8, () => f.outbound.withIdentityOutboundScope("readControl",
        () => f.outbound.observeCurrentUserOutbound(async () => {f.publish(profile()); return "private-result";})));
      f.callbacks.get(8)[0]();
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[signal\.identity\.outbound\.v1\] sample version=1 positiveControlPassed=true /);
    const fields = Object.fromEntries([...lines[0].matchAll(/\b((?:unclassified|routeResolver|taskAction|readControl)_(?:profileInvocations|profileOutboundAttempts|otherTransportEvents|transportObserved))=([^ ]+)/g)]
      .map(([, key, value]) => [key, value]));
    assert.equal(Object.keys(fields).length, 16);
    assert.equal(fields.readControl_profileOutboundAttempts, "1");
    assert.doesNotMatch(lines[0], /private|canary|headers|body|result|example/i);
  } finally { console.warn = originalWarn; }
});
