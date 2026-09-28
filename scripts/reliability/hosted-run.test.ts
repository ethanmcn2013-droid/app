import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { type HostedFixture } from "./hosted-seed";
import { buildMixedWorkloadSchedule } from "./contracts/workload-schedule.mjs";
import { previewScopedFetch, previewScopedAccessFetch, validateVercelProtectionCookie, runHostedLaunch, validateHostedPreflight, type HostedRunConfig } from "./hosted-run";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const digest = (value: string) => `sha256:${sha(value)}`;
const STORE_NAMES = ["TASKS_DATABASE_URL", "NOTES_DATABASE_URL", "TIMELINE_DATABASE_URL", "SIGNAL_DATABASE_URL", "ENTITLEMENTS_DATABASE_URL"] as const;

function example() {
  const runId = "hosted-20260928";
  const namespace = `reliability-${runId}`;
  const origin = "https://isolated-preview.example.test";
  const clerkIssuer = "https://clerk-isolated.example.test";
  const publishable = "pk_test_synthetic-only";
  const storeUrls = Object.fromEntries(STORE_NAMES.map((name) => [name, `libsql://${name.toLowerCase()}.isolated.example.test`])) as HostedRunConfig["storeUrls"];
  const stores = Object.fromEntries(STORE_NAMES.map((name) => [name, sha(storeUrls[name])])) as HostedRunConfig["expectedRuntime"]["stores"];
  const expectedRuntime = { sourceSha: "a".repeat(40), projectId: "prj_isolated123", deploymentId: "dpl_isolated456", region: "dub1", origin, stores };
  const actors = [0, 1].map((index) => { const clerkId = `user_synthetic${index}`; return {
    actorId: `synthetic_actor_${index}`, clerkId, actorHash: digest(clerkId), ownershipConfirmed: true as const,
  }; });
  const targetHashes = { tasks: digest(storeUrls.TASKS_DATABASE_URL), notes: digest(storeUrls.NOTES_DATABASE_URL),
    timeline: digest(storeUrls.TIMELINE_DATABASE_URL), signal: digest(storeUrls.SIGNAL_DATABASE_URL),
    entitlements: digest(storeUrls.ENTITLEMENTS_DATABASE_URL), attachments: digest("isolated-preview-native-attachments-disabled-v1") };
  const testActors = actors.map((actor) => ({ actorHash: actor.actorHash, kind: "controlled-test", ownershipConfirmed: true }));
  const environment = { kind: "hosted-test", identity: `${expectedRuntime.projectId}/${expectedRuntime.deploymentId}/${expectedRuntime.sourceSha}/${expectedRuntime.region}`,
    configHash: digest(JSON.stringify(expectedRuntime)), production: false };
  const authentication = { issuer: clerkIssuer, configHash: digest(publishable), mode: "clerk-development" };
  const deliverySinks = [{ name: "conversation-delivery", configHash: digest("disabled"), mode: "disabled" }];
  const config: HostedRunConfig = {
    manifest: { schemaVersion: 1, runId, fixtureNamespace: namespace, environment, expectedTargetHashes: targetHashes, testActors,
      authentication, allowedOrigins: [origin], allowedNetworkOrigins: [origin, clerkIssuer, "https://api.clerk.com"],
      allowedDeliverySinks: deliverySinks, excludedStores: ["attachments"], executionMode: "hosted-authenticated-route" },
    expectedRuntime, productionExclusions: { origins: ["https://app.signalstudio.ie"], projectIds: [expectedRuntime.projectId],
      deploymentIds: ["dpl_production"], allowPreviewInProductionProject: true,
      storeHashes: Array.from({ length: 5 }, (_, index) => sha(`production-store-${index}`)) },
    storeUrls, tasksToken: "private-tasks-token", attestationToken: "A".repeat(43),
    clerkSecretKey: "sk_test_private", clerkPublishableKey: publishable, clerkIssuer, actors,
    outputDirectory: resolve(".db-evidence", "hosted-launcher-test"), seedDomainWriteCap: 11_510, appRequestCap: 30_000, identityRequestCap: 2_000,
  };
  const attestation = { schema: "isolated-reliability-runtime/2", ...expectedRuntime,
    vercelEnvironment: "preview", vercelTargetEnvironment: "preview",
    identityProviderHash: sha(publishable), identityIssuerHash: sha(clerkIssuer), externalDeliveryDisabled: true,
    externalProvidersDisabled: true, accessMode: "production", nodeVersion: "24.1.0",
    attachments: { metadataStore: "tasks", databaseUrlHash: stores.TASKS_DATABASE_URL, byteStorageMode: "vercel-no-token", bytesEnabled: false },
    conversationRuntime: { mode: "remote", databaseUrlHash: stores.TASKS_DATABASE_URL },
    conversationControls: { internalEnabled: true, sendsEnabled: true, deliveryEnabled: false, directMessagesEnabled: false,
      allowedActorHashes: actors.map((actor) => sha(actor.actorId)).sort(), guestsEnabled: false, attachmentsEnabled: false, aiEnabled: false },
  };
  const fixture: HostedFixture = { fixtureNamespace: namespace, actors, counts: { projects: 10, tasks: 1_000, messages: 10_000, resources: 500 },
    rooms: Array.from({ length: 10 }, (_, index) => ({ projectId: `${namespace}_project_${index}`, projectName: `Synthetic ${index}`,
      conversationId: `conversation_${index}`, sourceMessageId: `message_${index}`, unusedSourceMessageIds: Array.from({ length: 400 }, (_, source) => `unused_${index}_${source}`), audienceEpoch: 1 })),
    deniedProjectForObserver: `${namespace}_project_9` };
  return { config, attestation, fixture };
}

test("full live attestation rejects immutable target, actor, sink, or store mismatch", () => {
  const { config, attestation } = example();
  assert.equal(validateHostedPreflight(config, attestation).schedule.repetitions, 3);
  for (const mutate of [
    (copy: typeof attestation) => { copy.sourceSha = "b".repeat(40); },
    (copy: typeof attestation) => { copy.stores.NOTES_DATABASE_URL = "0".repeat(64); },
    (copy: typeof attestation) => { copy.conversationControls.allowedActorHashes = []; },
    (copy: typeof attestation) => { copy.conversationControls.deliveryEnabled = true; },
    (copy: typeof attestation) => { copy.accessMode = "review"; },
    (copy: typeof attestation) => { copy.vercelEnvironment = "production"; },
    (copy: typeof attestation) => { copy.vercelTargetEnvironment = "production"; },
    (copy: typeof attestation) => { copy.vercelTargetEnvironment = ""; },
  ]) { const changed = structuredClone(attestation); mutate(changed); assert.throws(() => validateHostedPreflight(config, changed)); }
});

test("same project Preview requires explicit authorization and still excludes production deployment, origin and stores", () => {
  const { config, attestation } = example();
  assert.doesNotThrow(() => validateHostedPreflight(config, attestation));
  for (const mutate of [
    (copy: HostedRunConfig) => { copy.productionExclusions.allowPreviewInProductionProject = false; },
    (copy: HostedRunConfig) => { copy.productionExclusions.deploymentIds = [copy.expectedRuntime.deploymentId]; },
    (copy: HostedRunConfig) => { copy.productionExclusions.origins.push(copy.expectedRuntime.origin); },
    (copy: HostedRunConfig) => { copy.productionExclusions.storeHashes.push(copy.expectedRuntime.stores.TASKS_DATABASE_URL); },
  ]) { const changed = structuredClone(config); mutate(changed); assert.throws(() => validateHostedPreflight(changed, attestation)); }
});

test("Preview bypass is sent only to the pinned application origin", async () => {
  const calls: Array<{ url: string; bypass: string | null }> = [];
  const underlying = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), bypass: new Headers(init?.headers).get("x-vercel-protection-bypass") });
    return new Response(null, { status: 204 });
  };
  const fetcher = previewScopedFetch("https://isolated-preview.example.test", "synthetic-preview-bypass", underlying as typeof fetch);
  await fetcher("https://isolated-preview.example.test/api/conversations");
  await fetcher("https://api.clerk.com/v1/sessions", { headers: { "x-vercel-protection-bypass": "must-not-leak" } });
  assert.deepEqual(calls.map((call) => call.bypass), ["synthetic-preview-bypass", null]);
});

test("the exact Preview share cookie stays on the pinned origin and malformed cookies fail closed", async () => {
  const cookie = `_vercel_jwt=${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`;
  const calls: Array<{ url: string; cookie: string | null }> = [];
  const underlying = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), cookie: new Headers(init?.headers).get("cookie") });
    return new Response(null, { status: 204 });
  };
  const fetcher = previewScopedAccessFetch("https://isolated-preview.example.test", { cookie }, underlying as typeof fetch);
  await fetcher("https://isolated-preview.example.test/api/conversations");
  await fetcher("https://api.clerk.com/v1/sessions", { headers: { cookie: "must-not-leak" } });
  assert.deepEqual(calls.map((call) => call.cookie), [cookie, null]);
  for (const bad of ["_vercel_jwt=x;other=y", "_vercel_jwt=x\r\nheader:y", "other=x", "_vercel_jwt=x.y", "_vercel_jwt=x.y.z; "]) {
    assert.throws(() => validateVercelProtectionCookie(bad), /hosted_preview_cookie_invalid/);
  }
  assert.throws(() => previewScopedAccessFetch("https://isolated-preview.example.test", { cookie, bypassToken: "bypass" }),
    /hosted_preview_access_conflict/);
});

test("wrong or missing live attestation cannot reach any write or session", async () => {
  const { config, attestation } = example();
  const calls: string[] = [];
  const dependencies = { fetchAttestation: async () => ({ ...attestation, deploymentId: "dpl_wrong" }),
    seed: async () => { calls.push("seed"); throw new Error("unexpected"); }, workload: async () => { calls.push("workload"); throw new Error("unexpected"); },
    cleanup: async () => { calls.push("cleanup"); return { ok: true, deletedProjects: 0, remainingProjects: 0 }; },
    write: async () => { calls.push("write"); }, makeDirectory: async () => { calls.push("directory"); return undefined; } };
  await assert.rejects(runHostedLaunch(config, true, dependencies), /hosted_immutable_runtime_mismatch/);
  assert.deepEqual(calls, []);
  await assert.rejects(runHostedLaunch(config, true, { ...dependencies, fetchAttestation: async () => { throw new Error("404"); } }), /404/);
  assert.deepEqual(calls, []);
});

test("read-only preflight makes no writes; execute seeds and runs once, then cleans namespace", async () => {
  const { config, attestation, fixture } = example();
  const calls: string[] = [];
  const written: string[] = [];
  const dependencies = { fetchAttestation: async () => attestation, seed: async () => { calls.push("seed"); return fixture; },
    workload: async () => { calls.push("workload"); return { completed: true, appRequests: 20_401, droppedIterations: 0,
      sessionCleanup: { ok: true, attempted: 10, revoked: 10, unresolved: 0, errors: [] } }; },
    cleanup: async () => { calls.push("cleanup"); return { ok: true, deletedProjects: 10, remainingProjects: 0 }; },
    write: async (path: string, body: string) => { calls.push(`write:${path}`); written.push(body); },
    makeDirectory: async () => { calls.push("directory"); return undefined; } };
  const dry = await runHostedLaunch(config, false, dependencies);
  assert.equal(dry.mode, "read-only-preflight");
  assert.equal(dry.nominalAppRequests, buildMixedWorkloadSchedule().nominalRequests + 1);
  assert.deepEqual(calls, []);
  const result = await runHostedLaunch(config, true, dependencies);
  assert.equal(result.completed, true);
  assert.deepEqual(calls.filter((item) => item === "seed" || item === "workload" || item === "cleanup"), ["seed", "workload", "cleanup"]);
  assert.ok(calls.some((item) => item === `write:${join(config.outputDirectory, "fixture.json")}`));
  assert.ok(written.every((body) => !body.includes(config.tasksToken) && !body.includes(config.clerkSecretKey) && !body.includes(config.attestationToken)));
});

test("failure after seeding still attempts scoped cleanup and emits sanitized summary", async () => {
  const { config, attestation, fixture } = example();
  let cleaned = 0;
  const written: string[] = [];
  const result = await runHostedLaunch(config, true, { fetchAttestation: async () => attestation, seed: async () => fixture,
    workload: async () => { throw new Error("secret: private-tasks-token"); },
    cleanup: async () => { cleaned++; return { ok: true, deletedProjects: 10, remainingProjects: 0 }; },
    write: async (_path: string, body: string) => { written.push(body); }, makeDirectory: async () => undefined });
  assert.equal(result.completed, false);
  assert.equal(result.runFailure, "hosted_run_failed");
  assert.equal(cleaned, 1);
  assert.ok(written.every((body) => !body.includes(config.tasksToken)));
});
