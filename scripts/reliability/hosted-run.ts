import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, basename, join, relative, isAbsolute } from "node:path";
import { createClient } from "@libsql/client";
import { validateTargetManifest } from "./contracts/target-manifest.mjs";
import { buildMixedWorkloadSchedule, WORKLOAD } from "./contracts/workload-schedule.mjs";
import { createAuthenticatedSessionManager } from "./authenticated-sessions.mjs";
import { hostedTargetHash, seedHostedFixture, type HostedActor, type HostedFixture, type HostedManifest } from "./hosted-seed";
import { runHostedWorkload } from "./hosted-workload";

const STORE_NAMES = ["TASKS_DATABASE_URL", "NOTES_DATABASE_URL", "TIMELINE_DATABASE_URL", "SIGNAL_DATABASE_URL", "ENTITLEMENTS_DATABASE_URL"] as const;
const TARGET_NAMES = ["tasks", "notes", "timeline", "signal", "entitlements"] as const;
const HASH = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const ATTACHMENTS_DISABLED = hostedTargetHash("isolated-preview-native-attachments-disabled-v1");
const DELIVERY_SINK = { name: "conversation-delivery", configHash: hostedTargetHash("disabled"), mode: "disabled" };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const fail = (code: string): never => { throw new Error(code); };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: unknown, keys: readonly string[]) => object(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");

export type HostedRunConfig = {
  manifest: HostedManifest;
  expectedRuntime: { sourceSha: string; projectId: string; deploymentId: string; region: string; origin: string; stores: Record<typeof STORE_NAMES[number], string> };
  productionExclusions: { origins: string[]; projectIds: string[]; deploymentIds: string[]; storeHashes: string[];
    allowPreviewInProductionProject: boolean };
  storeUrls: Record<typeof STORE_NAMES[number], string>;
  tasksToken: string;
  attestationToken: string;
  clerkSecretKey: string;
  clerkPublishableKey: string;
  clerkIssuer: string;
  actors: Array<HostedActor & { ownershipConfirmed: true }>;
  outputDirectory: string;
  seedDomainWriteCap: number;
  appRequestCap: number;
  identityRequestCap: number;
  vercelProtectionBypassToken?: string;
  vercelProtectionCookie?: string;
};

type Attestation = {
  schema: string; sourceSha: string; projectId: string; deploymentId: string; region: string | null; origin: string;
  vercelEnvironment: string; vercelTargetEnvironment: string;
  stores: Record<string, string>; identityProviderHash: string; identityIssuerHash: string; externalDeliveryDisabled: boolean;
  externalProvidersDisabled: boolean; accessMode: string; nodeVersion: string;
  attachments: { metadataStore: string; databaseUrlHash: string; byteStorageMode: string; bytesEnabled: boolean };
  conversationRuntime: { mode: string; databaseUrlHash: string };
  conversationControls?: { internalEnabled: boolean; sendsEnabled: boolean; deliveryEnabled: boolean; directMessagesEnabled: boolean;
    allowedActorHashes: string[]; guestsEnabled: boolean; attachmentsEnabled: boolean; aiEnabled: boolean };
};

/** All checks finish before session creation, database access, or a fixture write. */
export function validateHostedPreflight(config: HostedRunConfig, attestation: Attestation) {
  if (!object(config) || !object(attestation) || attestation.schema !== "isolated-reliability-runtime/2") fail("hosted_attestation_missing");
  const expected = config.expectedRuntime;
  if (!expected || attestation.vercelEnvironment !== "preview" || attestation.vercelTargetEnvironment !== "preview" ||
      !SHA.test(expected.sourceSha) || !/^prj_[A-Za-z0-9]+$/.test(expected.projectId) ||
      !/^dpl_[A-Za-z0-9]+$/.test(expected.deploymentId) || !/^[a-z0-9-]{2,32}$/i.test(expected.region) ||
      expected.sourceSha !== attestation.sourceSha || expected.projectId !== attestation.projectId ||
      expected.deploymentId !== attestation.deploymentId || expected.region !== attestation.region || expected.origin !== attestation.origin) {
    fail("hosted_immutable_runtime_mismatch");
  }
  const origin = new URL(expected.origin);
  if (origin.protocol !== "https:" || origin.origin !== expected.origin || origin.hostname === "app.signalstudio.ie" ||
      origin.hostname === "signalstudio.ie" || !/^https:\/\//.test(expected.origin)) fail("hosted_origin_refused");
  const excluded = config.productionExclusions;
  if (!excluded || !excluded.origins?.includes("https://app.signalstudio.ie") || !excluded.projectIds?.length ||
      !excluded.deploymentIds?.length || excluded.deploymentIds.includes(expected.deploymentId) ||
      (excluded.projectIds.includes(expected.projectId) && excluded.allowPreviewInProductionProject !== true) ||
      excluded.origins.includes(expected.origin) ||
      !Array.isArray(excluded.storeHashes) || excluded.storeHashes.length < 5 || !excluded.storeHashes.every((item) => /^[a-f0-9]{64}$/.test(item))) {
    fail("hosted_production_exclusions_missing_or_matched");
  }
  if (!exactKeys(config.storeUrls, STORE_NAMES) || !exactKeys(expected.stores, STORE_NAMES) || !exactKeys(attestation.stores, STORE_NAMES)) fail("hosted_store_set_mismatch");
  for (const [index, name] of STORE_NAMES.entries()) {
    const storeUrl = config.storeUrls[name];
    if (typeof storeUrl !== "string" || !/^libsql:\/\//i.test(storeUrl) || new URL(storeUrl).username || new URL(storeUrl).password) fail("hosted_store_url_invalid");
    const digest = hash(storeUrl);
    if (digest !== expected.stores[name] || digest !== attestation.stores[name] || excluded.storeHashes.includes(digest) ||
        config.manifest.expectedTargetHashes[TARGET_NAMES[index]] !== `sha256:${digest}`) fail("hosted_store_hash_mismatch");
  }
  if (config.manifest.expectedTargetHashes.attachments !== ATTACHMENTS_DISABLED ||
      !Array.isArray(config.manifest.excludedStores) || !config.manifest.excludedStores.includes("attachments")) fail("hosted_attachment_exclusion_missing");
  if (attestation.externalDeliveryDisabled !== true || attestation.externalProvidersDisabled !== true ||
      attestation.accessMode !== "production" || !/^v?\d+\.\d+\.\d+$/.test(attestation.nodeVersion) ||
      attestation.attachments?.metadataStore !== "tasks" ||
      attestation.attachments?.databaseUrlHash !== attestation.stores.TASKS_DATABASE_URL ||
      attestation.attachments?.byteStorageMode !== "vercel-no-token" || attestation.attachments?.bytesEnabled !== false ||
      attestation.conversationRuntime?.mode !== "remote" ||
      attestation.conversationRuntime?.databaseUrlHash !== attestation.stores.TASKS_DATABASE_URL ||
      !attestation.conversationControls ||
      attestation.conversationControls.internalEnabled !== true || attestation.conversationControls.sendsEnabled !== true ||
      attestation.conversationControls.deliveryEnabled !== false || attestation.conversationControls.directMessagesEnabled !== false ||
      attestation.conversationControls.guestsEnabled !== false || attestation.conversationControls.attachmentsEnabled !== false ||
      attestation.conversationControls.aiEnabled !== false) fail("hosted_conversation_controls_refused");
  if (!config.clerkSecretKey?.startsWith("sk_test_") || !config.clerkPublishableKey?.startsWith("pk_test_") ||
      hash(config.clerkPublishableKey) !== attestation.identityProviderHash || hash(config.clerkIssuer) !== attestation.identityIssuerHash ||
      !/^https:\/\//.test(config.clerkIssuer)) fail("hosted_clerk_instance_mismatch");
  if (!Array.isArray(config.actors) || config.actors.length !== 2 || new Set(config.actors.map((actor) => actor.actorId)).size !== 2 ||
      new Set(config.actors.map((actor) => actor.clerkId)).size !== 2 ||
      config.actors.some((actor) => actor.ownershipConfirmed !== true || actor.actorHash !== hostedTargetHash(actor.clerkId) || !/^user_[A-Za-z0-9_-]+$/.test(actor.clerkId))) fail("hosted_actor_ownership_invalid");
  const actualActorHashes = config.actors.map((actor) => hash(actor.actorId)).sort();
  if (attestation.conversationControls.allowedActorHashes?.length !== 2 ||
      actualActorHashes.join("|") !== [...attestation.conversationControls.allowedActorHashes].sort().join("|")) fail("hosted_actor_allowlist_mismatch");
  if (config.seedDomainWriteCap !== 11_510 || config.appRequestCap !== WORKLOAD.totalRequestCap ||
      !Number.isInteger(config.identityRequestCap) || config.identityRequestCap < 100 || config.identityRequestCap > 2_500 ||
      buildMixedWorkloadSchedule().nominalRequests + 1 > config.appRequestCap) fail("hosted_budget_invalid");
  if (!HASH.test(config.manifest.environment.configHash as string) ||
      config.manifest.environment.configHash !== hostedTargetHash(JSON.stringify(expected)) ||
      config.manifest.environment.identity !== `${expected.projectId}/${expected.deploymentId}/${expected.sourceSha}/${expected.region}` ||
      config.manifest.authentication?.issuer !== config.clerkIssuer ||
      config.manifest.authentication?.configHash !== hostedTargetHash(config.clerkPublishableKey) ||
      config.manifest.allowedOrigins?.join("|") !== expected.origin ||
      config.manifest.allowedNetworkOrigins?.join("|") !== [expected.origin, config.clerkIssuer, "https://api.clerk.com"].join("|") ||
      config.manifest.allowedDeliverySinks?.length !== 1 || JSON.stringify(config.manifest.allowedDeliverySinks[0]) !== JSON.stringify(DELIVERY_SINK)) {
    fail("hosted_manifest_binding_mismatch");
  }
  const observed = { origin: expected.origin, environment: { ...config.manifest.environment }, targetHashes: { ...config.manifest.expectedTargetHashes },
    networkOrigins: [expected.origin, config.clerkIssuer, "https://api.clerk.com"], externalNetworkEnabled: true,
    authentication: { ...config.manifest.authentication }, deliverySinks: [DELIVERY_SINK], externalDeliveryEnabled: false,
    testActors: config.actors.map((actor) => ({ actorHash: actor.actorHash, kind: "controlled-test", ownershipConfirmed: true })) };
  const guard = validateTargetManifest(config.manifest, observed);
  if (!guard.ok) fail("hosted_target_manifest_rejected");
  if (!Array.isArray(config.manifest.testActors) || config.manifest.testActors.length !== 2 ||
      config.manifest.testActors.map((actor) => actor.actorHash).sort().join("|") !== config.actors.map((actor) => actor.actorHash).sort().join("|")) fail("hosted_manifest_actors_mismatch");
  return { observed, schedule: buildMixedWorkloadSchedule(), attestedRuntime: { sourceSha: expected.sourceSha, projectId: expected.projectId,
    deploymentId: expected.deploymentId, region: expected.region, origin: expected.origin, nodeVersion: attestation.nodeVersion,
    vercelEnvironment: attestation.vercelEnvironment, vercelTargetEnvironment: attestation.vercelTargetEnvironment,
    storeHashes: expected.stores } };
}

export function validateVercelProtectionCookie(cookie: string): void {
  if (!/^_vercel_jwt=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie) || cookie.length > 8192)
    fail("hosted_preview_cookie_invalid");
}

export async function fetchHostedAttestation(origin: string, token: string, bypassToken?: string, fetchImpl: typeof fetch = fetch,
  cookie?: string): Promise<Attestation> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) fail("hosted_attestation_token_invalid");
  if (cookie) validateVercelProtectionCookie(cookie);
  if (cookie && bypassToken) fail("hosted_preview_access_conflict");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(`${origin}/api/internal/reliability-target`, { headers: { authorization: `Bearer ${token}`,
      ...(bypassToken ? { "x-vercel-protection-bypass": bypassToken } : {}), ...(cookie ? { cookie } : {}) },
      redirect: "error", cache: "no-store", signal: controller.signal });
    if (!response.ok || response.headers.get("content-type")?.includes("application/json") !== true) fail("hosted_attestation_unavailable");
    const body = await response.text();
    if (body.length > 8_192) fail("hosted_attestation_oversize");
    return JSON.parse(body) as Attestation;
  } catch { return fail("hosted_attestation_unavailable"); }
  finally { clearTimeout(timeout); }
}

/** A Preview bypass token must never accompany Clerk or any other origin. */
export function previewScopedFetch(origin: string, bypassToken: string, fetchImpl: typeof fetch = fetch): typeof fetch {
  return previewScopedAccessFetch(origin, { bypassToken }, fetchImpl);
}

/** Removes any Preview credential on foreign origins, including Clerk. */
export function previewScopedAccessFetch(origin: string, access: { bypassToken?: string; cookie?: string },
  fetchImpl: typeof fetch = fetch): typeof fetch {
  if (access.cookie) validateVercelProtectionCookie(access.cookie);
  if (access.cookie && access.bypassToken) fail("hosted_preview_access_conflict");
  return (url, init) => {
    const target = new URL(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
    const headers = new Headers(init?.headers);
    if (target.origin !== origin) {
      headers.delete("x-vercel-protection-bypass");
      headers.delete("cookie");
      return fetchImpl(url, { ...init, headers });
    }
    if (access.bypassToken) headers.set("x-vercel-protection-bypass", access.bypassToken);
    if (access.cookie) headers.set("cookie", access.cookie);
    return fetchImpl(url, { ...init, headers });
  };
}

export async function cleanupHostedNamespace(config: HostedRunConfig) {
  const namespace = config.manifest.fixtureNamespace;
  if (!/^reliability-[a-z0-9-]{8,64}$/.test(namespace)) fail("hosted_cleanup_namespace_invalid");
  const client = createClient({ url: config.storeUrls.TASKS_DATABASE_URL, authToken: config.tasksToken });
  const ids = Array.from({ length: 10 }, (_, index) => `${namespace}_project_${index}`);
  try {
    const rows = await client.execute({ sql: "SELECT id,owner_user_id FROM workspaces WHERE id LIKE ? ESCAPE '\\'", args: [`${namespace.replaceAll("_", "\\_")}_project_%`] });
    if (rows.rows.some((row) => !ids.includes(String(row.id)) || row.owner_user_id !== config.actors[0].actorId)) fail("hosted_cleanup_scope_refused");
    let deleted = 0;
    for (const id of ids) {
      await client.execute({ sql: "DELETE FROM resources WHERE workspace_id=? AND id LIKE ? ESCAPE '\\'", args: [id, `${namespace.replaceAll("_", "\\_")}_resource_%`] });
      const result = await client.execute({ sql: "DELETE FROM workspaces WHERE id=? AND owner_user_id=?", args: [id, config.actors[0].actorId] });
      deleted += result.rowsAffected;
    }
    const remaining = await client.execute({ sql: "SELECT id FROM workspaces WHERE id LIKE ? ESCAPE '\\'", args: [`${namespace.replaceAll("_", "\\_")}_project_%`] });
    return { ok: remaining.rows.length === 0, deletedProjects: deleted, remainingProjects: remaining.rows.length };
  } finally { client.close(); }
}

export async function runHostedLaunch(config: HostedRunConfig, execute: boolean, dependencies: {
  fetchAttestation?: typeof fetchHostedAttestation; seed?: typeof seedHostedFixture; workload?: typeof runHostedWorkload;
  cleanup?: typeof cleanupHostedNamespace; write?: typeof writeFile; makeDirectory?: typeof mkdir;
} = {}) {
  let proposedOrigin: URL;
  try { proposedOrigin = new URL(config.expectedRuntime.origin); } catch { return fail("hosted_origin_refused"); }
  if (proposedOrigin.origin !== config.expectedRuntime.origin || proposedOrigin.protocol !== "https:" ||
      ["app.signalstudio.ie", "signalstudio.ie"].includes(proposedOrigin.hostname) ||
      config.productionExclusions?.origins?.includes(proposedOrigin.origin)) fail("hosted_origin_refused");
  if (config.vercelProtectionBypassToken !== undefined && !/^[A-Za-z0-9_-]{12,256}$/.test(config.vercelProtectionBypassToken)) fail("hosted_preview_bypass_token_invalid");
  if (config.vercelProtectionCookie !== undefined) validateVercelProtectionCookie(config.vercelProtectionCookie);
  if (config.vercelProtectionCookie && config.vercelProtectionBypassToken) fail("hosted_preview_access_conflict");
  const attestation = await (dependencies.fetchAttestation ?? fetchHostedAttestation)(config.expectedRuntime.origin, config.attestationToken,
    config.vercelProtectionBypassToken, fetch, config.vercelProtectionCookie);
  const preflight = validateHostedPreflight(config, attestation);
  if (!execute) return { mode: "read-only-preflight", accepted: true, attestedRuntime: preflight.attestedRuntime,
    nominalAppRequests: preflight.schedule.nominalRequests + 1, appRequestCap: config.appRequestCap, seedDomainWriteCap: config.seedDomainWriteCap,
    durationMinutes: WORKLOAD.repetitions * (WORKLOAD.warmupMs + WORKLOAD.measuredMs) / 60_000 };
  if (!config.tasksToken || !config.outputDirectory) fail("hosted_execution_credentials_or_output_missing");
  const outputDirectory = resolve(config.outputDirectory);
  const privateRelative = relative(resolve(".db-evidence"), outputDirectory);
  if (!privateRelative || privateRelative.startsWith("..") || isAbsolute(privateRelative)) fail("hosted_output_must_be_private_db_evidence");
  await (dependencies.makeDirectory ?? mkdir)(outputDirectory, { recursive: false });
  const safeWrite = dependencies.write ?? writeFile;
  await safeWrite(join(outputDirectory, "preflight.json"), JSON.stringify({ ...preflight.attestedRuntime, nominalAppRequests: preflight.schedule.nominalRequests + 1,
    seedDomainWriteCap: config.seedDomainWriteCap, appRequestCap: config.appRequestCap }, null, 2), { flag: "wx" });
  let fixture: HostedFixture | undefined;
  let workload: unknown;
  let runFailure: string | null = null;
  let cleanup: unknown = null;
  try {
    fixture = await (dependencies.seed ?? seedHostedFixture)({ manifest: config.manifest, observed: preflight.observed,
      tasksUrl: config.storeUrls.TASKS_DATABASE_URL, tasksToken: config.tasksToken, actors: config.actors });
    await safeWrite(join(outputDirectory, "fixture.json"), JSON.stringify(fixture, null, 2), { flag: "wx" });
    workload = await (dependencies.workload ?? runHostedWorkload)({ manifest: config.manifest, observed: preflight.observed, fixture,
      tasksUrl: config.storeUrls.TASKS_DATABASE_URL, tasksToken: config.tasksToken, executionAuthorized: true, outputDirectory,
      createSessions: () => createAuthenticatedSessionManager({ secretKey: config.clerkSecretKey,
        instanceHash: hostedTargetHash(config.clerkPublishableKey), expectedInstanceHash: hostedTargetHash(config.clerkPublishableKey),
        expectedIssuer: config.clerkIssuer, executionMode: "hosted-test",
        controlledActorManifest: { instanceHash: hostedTargetHash(config.clerkPublishableKey),
          actors: config.actors.map((actor) => ({ userId: actor.clerkId, actorHash: actor.actorHash, ownershipConfirmed: true })) },
        allowedApplicationOrigins: [config.expectedRuntime.origin], maxSessions: 10, identityRequestCap: config.identityRequestCap,
        requestTimeoutMs: 60_000, maxRetries: 2,
        fetchImpl: config.vercelProtectionBypassToken || config.vercelProtectionCookie
          ? previewScopedAccessFetch(config.expectedRuntime.origin, { bypassToken: config.vercelProtectionBypassToken,
            cookie: config.vercelProtectionCookie }) : fetch }) });
  } catch (error) { runFailure = object(error) && typeof error.message === "string" && /^[a-z0-9_-]{1,100}$/i.test(error.message) ? error.message : "hosted_run_failed"; }
  finally {
    if (fixture) {
      try { cleanup = await (dependencies.cleanup ?? cleanupHostedNamespace)(config); }
      catch { cleanup = { ok: false, code: "hosted_namespace_cleanup_failed" }; }
    } else cleanup = { ok: false, code: "fixture_seed_incomplete_cleanup_requires_review" };
    await safeWrite(join(outputDirectory, "launcher-summary.json"), JSON.stringify({ runId: config.manifest.runId,
      completed: runFailure === null && object(workload) && workload.completed === true && object(cleanup) && cleanup.ok === true,
      runFailure, namespaceCleanup: cleanup, workloadSummary: object(workload) ? { completed: workload.completed, appRequests: workload.appRequests,
        actualAppTransportRequests: workload.actualAppTransportRequests,
        droppedIterations: workload.droppedIterations, sessionCleanup: workload.sessionCleanup } : null }, null, 2), { flag: "wx" });
  }
  return { completed: runFailure === null && object(workload) && workload.completed === true && object(cleanup) && cleanup.ok === true,
    runFailure, namespaceCleanup: cleanup, workload };
}

if (typeof require !== "undefined" && require.main === module) {
  void (async () => {
    const configPath = process.argv[2];
    const execute = process.argv.includes("--execute");
    try {
    if (!configPath || !/^\.env\.reliability-hosted(?:\.[a-z0-9-]+)?\.json$/i.test(basename(configPath))) fail("hosted_private_config_required");
    const config = JSON.parse(await readFile(resolve(configPath), "utf8")) as HostedRunConfig;
    const result = await runHostedLaunch(config, execute);
    process.stdout.write(`${JSON.stringify(execute ? { completed: result.completed, runFailure: result.runFailure } : result)}\n`);
    if (execute && !result.completed) process.exitCode = 1;
    } catch (error) {
    const code = object(error) && typeof error.message === "string" && /^[a-z0-9_-]{1,100}$/i.test(error.message) ? error.message : "hosted_launcher_failed";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
    }
  })();
}
