import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const helperPath = fileURLToPath(new URL("./identity-timing.ts", import.meta.url));
const authPath = fileURLToPath(new URL("../auth.ts", import.meta.url));
const marker = "isolated-clerk-preview-v1";
const optIn = "isolated-preview-auth-timing-v1";

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
    SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: optIn,
    SIGNAL_SPRINT_PREVIEW_AUTH: marker,
    SIGNAL_RELIABILITY_ATTEST: "isolated-reliability-v1",
    SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(Date.now() + 60 * 60 * 1_000),
    VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production",
    NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview", SIGNAL_ACCESS_MODE: "production",
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production", VERCEL_DEPLOYMENT_ID: "dpl_Synthetic123",
    VERCEL_PROJECT_ID: "prj_Synthetic123", VERCEL_URL: "synthetic-preview.vercel.app",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic",
  };
}

function helperFixture() {
  let request = 1;
  const callbacks = new Map();
  const cache = implementation => {
    const values = new Map();
    return () => {
      if (!values.has(request)) values.set(request, implementation());
      return values.get(request);
    };
  };
  const helper = loadSource(helperPath, {
    "server-only": {},
    "react": {cache},
    "next/server": {after: callback => {
      const bucket = callbacks.get(request) ?? [];
      bucket.push(callback); callbacks.set(request, bucket);
    }},
    "@/lib/auth/recipient-proof-authorized-parties": {SPRINT_PREVIEW_AUTH_MARKER: marker},
  });
  return {helper, callbacks, setRequest: next => { request = next; }};
}

test("opt-in requires the exact isolated Preview markers and a short live expiry", () => {
  const {helper} = helperFixture();
  const env = enabledEnv();
  const now = Date.now();
  assert.equal(helper.identityTimingEnabled(env, now), true);
  for (const change of [
    {SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: undefined},
    {SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: "true"},
    {SIGNAL_SPRINT_PREVIEW_AUTH: undefined},
    {SIGNAL_RELIABILITY_ATTEST: undefined},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now - 1)},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now + 7 * 60 * 60 * 1_000)},
    {VERCEL_ENV: "production"}, {VERCEL_TARGET_ENV: "production"},
    {NODE_ENV: "development"}, {NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "production"},
    {SIGNAL_ACCESS_MODE: "review"}, {NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review"},
    {VERCEL_DEPLOYMENT_ID: undefined}, {VERCEL_URL: "foreign.example"},
    {NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic"},
    {CLERK_SECRET_KEY: "sk_live_synthetic"},
  ]) assert.equal(helper.identityTimingEnabled({...env, ...change}, now), false);
});

test("numeric collector emits once, with no result, error or cross-collector data", async () => {
  const {helper} = helperFixture();
  const callbacks = []; const emitted = [];
  let clock = 0;
  const create = () => helper.createIdentityTimingCollector({
    schedule: callback => callbacks.push(callback), emit: summary => emitted.push(summary), now: () => ++clock,
  });
  const first = create();
  const call = first.begin("unclassified");
  const privateResult = "private-user-and-email@example.invalid";
  assert.equal(await call.measure("auth", async () => privateResult), privateResult);
  call.finish(); call.finish();
  const route = first.begin("routeResolver");
  const privateError = new Error("private-cookie-and-url");
  await assert.rejects(route.measure("clerkProfile", async () => {throw privateError;}), error => error === privateError);
  route.finish();
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].unclassified.total.count, 1);
  assert.equal(emitted[0].routeResolver.total.count, 1);
  assert.equal(emitted[0].unclassified.auth.count, 1);
  assert.equal(emitted[0].routeResolver.clerkProfile.count, 1);
  assert.deepEqual(Object.keys(emitted[0]).sort(), ["routeResolver", "tag", "unclassified", "version"]);
  assert.doesNotMatch(JSON.stringify(emitted[0]), /private|email|cookie|url|invalid/i);
  const second = create();
  const other = second.begin("unclassified"); other.finish();
  assert.equal(second.summary().unclassified.auth.count, 0);
  assert.equal(second.summary().routeResolver.total.count, 0);
  assert.equal(callbacks.length, 2);
});

test("schedule and emit failures do not change the measured result or error", async () => {
  const {helper} = helperFixture();
  const scheduleFailure = new Error("private-schedule-error");
  const expectedFailure = new Error("private-auth-error");
  const collector = helper.createIdentityTimingCollector({
    schedule: () => {throw scheduleFailure;}, emit: () => {throw new Error("must not emit");}, now: () => 1,
  });
  const successful = collector.begin("unclassified");
  assert.equal(await successful.measure("auth", async () => "original-result"), "original-result");
  successful.finish();
  const failed = collector.begin("unclassified");
  await assert.rejects(failed.measure("clerkProfile", async () => {throw expectedFailure;}), error => error === expectedFailure);
  failed.finish();
  assert.equal(collector.summary().unclassified.total.count, 2);

  let scheduledCallback;
  const emitFailureCollector = helper.createIdentityTimingCollector({
    schedule: callback => {scheduledCallback = callback;},
    emit: () => {throw new Error("private-emit-error");}, now: () => 1,
  });
  const measured = emitFailureCollector.begin("routeResolver");
  assert.equal(await measured.measure("auth", async () => "original-result"), "original-result");
  measured.finish();
  assert.doesNotThrow(() => scheduledCallback());
});

test("real getCurrentUser keeps result, failure and demo behavior while timing buckets stay isolated", async () => {
  const {helper, callbacks, setRequest} = helperFixture();
  const env = enabledEnv();
  const keys = Object.keys(env);
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalInfo = console.info;
  const emitted = [];
  Object.assign(process.env, env);
  console.info = value => emitted.push(JSON.parse(value));
  const state = {demo: false, failProfile: false, authCalls: 0, profileCalls: 0, provisions: 0, selects: 0};
  const profileError = new Error("secret-profile-failure");
  const authModule = loadSource(authPath, {
    "server-only": {},
    "next/headers": {cookies: async () => ({get: () => undefined})},
    "@clerk/nextjs/server": {
      auth: async () => {state.authCalls++; return {userId: "private-clerk-subject"};},
      currentUser: async () => {state.profileCalls++; if (state.failProfile) throw profileError;
        return {primaryEmailAddressId: "primary", emailAddresses: [{id: "primary", emailAddress: "private@example.invalid"}]};},
    },
    "drizzle-orm": {eq: (...args) => args},
    "@/server/db": {db: {select: () => ({from: () => ({where: async () => {
      state.selects++; return [{id: "private-internal-user"}];
    }})})}},
    "@/server/db/schema": {users: {id: "id", clerkId: "clerkId"}},
    "@/server/db/seed": {LEGACY_WORKSPACE_ID: "legacy"},
    "@/server/db/ensure-user": {ensureUserProvisioned: async () => {state.provisions++;}},
    "@/lib/access-mode": {isDemoMode: () => state.demo},
    "@/server/projects/catalog": {},
    "@/server/demo/tasks-demo": {DEMO_USER_ID: "synthetic-demo", DEMO_WORKSPACE_ID: "synthetic-demo-project"},
    "@/server/diagnostics/identity-timing": helper,
  });
  try {
    setRequest(1);
    assert.equal(await authModule.getCurrentUser(), "private-internal-user");
    assert.equal(await helper.withRouteResolverIdentityTiming(() => authModule.getCurrentUser()), "private-internal-user");
    assert.deepEqual([state.authCalls, state.profileCalls, state.provisions, state.selects], [2, 2, 2, 2]);
    assert.equal(callbacks.get(1)?.length, 1);
    callbacks.get(1)[0]();
    assert.equal(emitted[0].unclassified.total.count, 1);
    assert.equal(emitted[0].routeResolver.total.count, 1);

    setRequest(2); state.failProfile = true;
    await assert.rejects(authModule.getCurrentUser(), error => error === profileError);
    assert.equal(callbacks.get(2)?.length, 1);
    callbacks.get(2)[0]();
    assert.equal(emitted[1].unclassified.auth.count, 1);
    assert.equal(emitted[1].unclassified.clerkProfile.count, 1);
    assert.equal(emitted[1].unclassified.provision.count, 0);
    assert.equal(emitted[1].unclassified.total.count, 1);
    assert.equal(emitted[1].routeResolver.total.count, 0);
    assert.doesNotMatch(JSON.stringify(emitted), /private|secret|example\.invalid/i);

    setRequest(3); state.demo = true;
    assert.equal(await authModule.getCurrentUser(), "synthetic-demo");
    assert.equal(callbacks.has(3), false);

    setRequest(4); state.demo = false; state.failProfile = false;
    process.env.VERCEL_ENV = "production";
    assert.equal(await authModule.getCurrentUser(), "private-internal-user");
    assert.equal(callbacks.has(4), false, "production cannot emit diagnostic timing");
  } finally {
    console.info = originalInfo;
    for (const key of keys) {if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];}
  }
});
