import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { previewReliabilityAttestation } from "./preview-reliability-attestation";

const now = Date.UTC(2026, 8, 27);
const token = "a".repeat(43);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const publishableKey = (host: string) => `pk_test_${Buffer.from(`${host}$`).toString("base64")}`;
const environment = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production",
  SIGNAL_RELIABILITY_ATTEST: "isolated-reliability-v1", SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now + 3600000),
  SIGNAL_RELIABILITY_ATTEST_TOKEN: token, SIGNAL_RELIABILITY_ORIGIN: "https://isolated.example.test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("synthetic.clerk.accounts.dev"), CLERK_SECRET_KEY: "sk_test_synthetic",
  VERCEL_DEPLOYMENT_ID: "dpl_synthetic", VERCEL_PROJECT_ID: "prj_synthetic", VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  TASKS_DATABASE_URL: "libsql://synthetic-tasks", NOTES_DATABASE_URL: "libsql://synthetic-notes",
  TIMELINE_DATABASE_URL: "libsql://synthetic-timeline", SIGNAL_DATABASE_URL: "libsql://synthetic-signal",
  ENTITLEMENTS_DATABASE_URL: "libsql://synthetic-entitlements",
  SIGNAL_ACCESS_MODE: "production", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production",
  SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "true",
  SIGNAL_CONVERSATION_DELIVERY_ENABLED: "false", SIGNAL_CONVERSATION_DM_ENABLED: "false",
  SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "synthetic-alice,synthetic-bob",
  SIGNAL_CONVERSATION_DATABASE_MODE: "remote", SIGNAL_CONVERSATION_REMOTE_ENABLED: "true",
  SIGNAL_CONVERSATION_REMOTE_TARGET: "isolated-acceptance",
  SIGNAL_CONVERSATION_REMOTE_URL_SHA256: sha("libsql://synthetic-tasks"), TASKS_AUTH_TOKEN: "synthetic-task-secret" };
const request = (origin = environment.SIGNAL_RELIABILITY_ORIGIN, authorization = `Bearer ${token}`) => new Request(origin + "/api/internal/reliability-target", { headers: { authorization } });
test("preview proof is content-free and hashes actual runtime bindings", async () => {
  const response = previewReliabilityAttestation(request(), environment, now);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schema, "isolated-reliability-runtime/2");
  assert.equal(body.vercelEnvironment, "preview");
  assert.equal(body.vercelTargetEnvironment, "preview");
  assert.deepEqual(Object.keys(body).sort(), ["schema", "sourceSha", "projectId", "deploymentId", "vercelEnvironment", "vercelTargetEnvironment", "region", "origin", "nodeVersion",
    "stores", "identityProviderHash", "identityIssuerHash", "accessMode", "conversationControls", "conversationRuntime",
    "attachments", "externalProvidersDisabled", "externalDeliveryDisabled", "observedAt"].sort());
  const storeKeys = ["TASKS_DATABASE_URL", "NOTES_DATABASE_URL", "TIMELINE_DATABASE_URL", "SIGNAL_DATABASE_URL", "ENTITLEMENTS_DATABASE_URL"] as const;
  assert.deepEqual(body.stores, Object.fromEntries(storeKeys.map(key => [key, sha(environment[key])])));
  assert.equal(body.identityProviderHash, sha(environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY));
  assert.equal(body.identityIssuerHash, sha("https://synthetic.clerk.accounts.dev"));
  assert.equal(body.accessMode, "production");
  assert.equal(body.nodeVersion, process.versions.node);
  assert.deepEqual(body.conversationControls, { internalEnabled: true, sendsEnabled: true, deliveryEnabled: false,
    directMessagesEnabled: false, allowedActorHashes: [sha("synthetic-alice"), sha("synthetic-bob")].sort(),
    guestsEnabled: false, attachmentsEnabled: false, aiEnabled: false });
  assert.deepEqual(body.conversationRuntime, { mode: "remote", databaseUrlHash: sha(environment.TASKS_DATABASE_URL) });
  assert.deepEqual(body.attachments, { metadataStore: "tasks", databaseUrlHash: sha(environment.TASKS_DATABASE_URL),
    byteStorageMode: "vercel-no-token", bytesEnabled: false });
  assert.equal(body.externalProvidersDisabled, true);
  assert.equal(body.externalDeliveryDisabled, true);
  assert.doesNotMatch(JSON.stringify(body), /libsql:|sk_test_|pk_test_|synthetic-alice|synthetic-bob|synthetic-task-secret|synthetic\.clerk/);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
});
test("production, expired, incomplete, provider-enabled or mismatched previews stay hidden", () => {
  for (const patch of [{VERCEL_ENV:"production"},{VERCEL_TARGET_ENV:"production"},{SIGNAL_RELIABILITY_ATTEST:""},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS:String(now)},{SIGNAL_RELIABILITY_ATTEST_UNTIL_MS:String(now+7*3600000)},
    {CLERK_SECRET_KEY:"sk_live_synthetic"},{TASKS_DATABASE_URL:""},{RESEND_API_KEY:"synthetic"},
    {BLOB_READ_WRITE_TOKEN:"synthetic"},{GOOGLE_OAUTH_CLIENT_SECRET:"synthetic"},{VERCEL_GIT_COMMIT_SHA:"unknown"},
    {NOTES_TO_TASKS_SECRET:"synthetic"},{NOTES_TO_TIMELINE_SECRET:"synthetic"},{STUDIO_CRON_PING_SECRET:"synthetic"}]) {
    assert.equal(previewReliabilityAttestation(request(), {...environment,...patch}, now).status, 404);
  }
  for (const invalid of [request("https://other.example.test"),request(undefined,""),request(undefined,"Bearer " + "b".repeat(43)),request(undefined,token)])
    assert.equal(previewReliabilityAttestation(invalid, environment, now).status, 404);
  assert.equal(previewReliabilityAttestation(new Request(request(), { method: "POST" }), environment, now).status, 404);
  assert.equal(previewReliabilityAttestation(request(), {}, now).status, 404);
});

test("partial or wrong conversation, actor and authenticated access settings stay hidden", () => {
  const required = ["SIGNAL_ACCESS_MODE", "NEXT_PUBLIC_SIGNAL_ACCESS_MODE", "SIGNAL_CONVERSATION_INTERNAL_ENABLED",
    "SIGNAL_CONVERSATION_SEND_ENABLED", "SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS", "SIGNAL_CONVERSATION_DATABASE_MODE",
    "SIGNAL_CONVERSATION_REMOTE_ENABLED", "SIGNAL_CONVERSATION_REMOTE_TARGET", "SIGNAL_CONVERSATION_REMOTE_URL_SHA256", "TASKS_AUTH_TOKEN"];
  for (const key of required) {
    assert.equal(previewReliabilityAttestation(request(), { ...environment, [key]: undefined }, now).status, 404, key);
  }
  for (const patch of [
    { SIGNAL_ACCESS_MODE: "review" }, { NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "demo" },
    { SIGNAL_CONVERSATION_SEND_ENABLED: "TRUE" }, { SIGNAL_CONVERSATION_DELIVERY_ENABLED: "true" },
    { SIGNAL_CONVERSATION_DM_ENABLED: "true" }, { SIGNAL_CONVERSATION_DATABASE_MODE: "local" },
    { SIGNAL_CONVERSATION_REMOTE_URL_SHA256: "b".repeat(64) }, { TASKS_DATABASE_URL: "libsql://wrong-task-store" },
    { TASKS_AUTH_TOKEN: " " }, { SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "" },
    { SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "synthetic-alice,synthetic-alice" },
    { SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "synthetic-alice,synthetic-bob,synthetic-charlie" },
  ]) assert.equal(previewReliabilityAttestation(request(), { ...environment, ...patch }, now).status, 404);
});

test("actor hashes reflect the effective trimmed distinct allowlist, never caller declarations", async () => {
  const response = previewReliabilityAttestation(request(), { ...environment,
    SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: " synthetic-bob,synthetic-alice,synthetic-bob, ",
    SIGNAL_RELIABILITY_ACTOR_HASHES: "untrusted-declaration", NODE_VERSION: "untrusted-declaration",
  }, now);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.conversationControls.allowedActorHashes, [sha("synthetic-alice"), sha("synthetic-bob")].sort());
  assert.equal(body.nodeVersion, process.versions.node);
  assert.doesNotMatch(JSON.stringify(body), /untrusted-declaration/);
});

test("identity proof rejects invalid test keys and alternative issuer configuration", () => {
  for (const key of ["pk_test_synthetic", "pk_live_synthetic", publishableKey("bad.example/path"),
    publishableKey("user:password@bad.example"), publishableKey("bad.example:8443"), publishableKey("bad.example?query")]) {
    assert.equal(previewReliabilityAttestation(request(), { ...environment, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key }, now).status, 404);
  }
  for (const key of ["CLERK_DOMAIN", "NEXT_PUBLIC_CLERK_DOMAIN", "CLERK_PROXY_URL", "NEXT_PUBLIC_CLERK_PROXY_URL",
    "CLERK_IS_SATELLITE", "NEXT_PUBLIC_CLERK_IS_SATELLITE"]) {
    assert.equal(previewReliabilityAttestation(request(), { ...environment, [key]: "untrusted-override" }, now).status, 404);
  }
});

test("every configured external provider prevents a receipt", () => {
  for (const key of ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET",
    "BLOB_READ_WRITE_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "NOTES_TO_TASKS_SECRET",
    "NOTES_TO_TIMELINE_SECRET", "STUDIO_CRON_PING_SECRET"]) {
    const response = previewReliabilityAttestation(request(), { ...environment, [key]: "synthetic-provider-secret" }, now);
    assert.equal(response.status, 404, key);
    assert.equal(response.body, null);
  }
});

const diagnosticRequest = (authorization = `Bearer ${token}`) => new Request(
  environment.SIGNAL_RELIABILITY_ORIGIN + "/api/internal/reliability-target?diagnostic=1", { headers: { authorization } });

test("protected diagnostic returns only the fixed boolean predicates and no attestation identity", async () => {
  const response = previewReliabilityAttestation(diagnosticRequest(), environment, now);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["predicates", "schema"]);
  assert.equal(body.schema, "isolated-reliability-diagnostic/1");
  assert.deepEqual(Object.keys(body.predicates).sort(), ["originMatches", "originHttps", "testPublishableKey", "testSecretKey",
    "deploymentIdFormat", "projectIdFormat", "sourceShaFormat", "storesPresent", "providersDisabled", "serverAccessProduction",
    "publicAccessProduction", "identityOverridesAbsent", "testIssuerParseable", "conversationInternalEnabled", "conversationSendsEnabled",
    "conversationDeliveryDisabled", "conversationDirectMessagesDisabled", "twoConversationActors", "conversationRemoteTarget"].sort());
  assert.ok(Object.values(body.predicates).every(value => value === true));
  assert.doesNotMatch(JSON.stringify(body), /synthetic|https:|libsql:|sk_test_|pk_test_|SIGNAL_|CLERK_|DATABASE_URL|dpl_|prj_/);
  const normal = previewReliabilityAttestation(request(), environment, now);
  for (const name of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control", "Referrer-Policy", "X-Robots-Tag"])
    assert.equal(response.headers.get(name), normal.headers.get(name));
  assert.equal((await normal.json()).schema, "isolated-reliability-runtime/2");
});

test("diagnostic cannot bypass method, deployment classification, marker, expiry or constant-time Bearer gate", () => {
  for (const patch of [{ VERCEL: "" }, { VERCEL_ENV: "production" }, { VERCEL_TARGET_ENV: "production" },
    { VERCEL_TARGET_ENV: undefined }, { NODE_ENV: "development" }, { SIGNAL_RELIABILITY_ATTEST: "" },
    { SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now) }, { SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: "invalid" },
    { SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now + 6 * 3600000 + 1) }, { SIGNAL_RELIABILITY_ATTEST_TOKEN: "short" }]) {
    const response = previewReliabilityAttestation(diagnosticRequest(), { ...environment, ...patch }, now);
    assert.equal(response.status, 404); assert.equal(response.body, null);
  }
  for (const authorization of ["", token, "Bearer short", `Bearer ${"b".repeat(43)}`]) {
    const response = previewReliabilityAttestation(diagnosticRequest(authorization), environment, now);
    assert.equal(response.status, 404); assert.equal(response.body, null);
  }
  assert.equal(previewReliabilityAttestation(new Request(diagnosticRequest(), { method: "POST" }), environment, now).status, 404);
  assert.equal(previewReliabilityAttestation(diagnosticRequest(), {}, now).status, 404);
});

test("bad source identity is diagnosed without making normal attestation pass", async () => {
  const invalid = { ...environment, VERCEL_GIT_COMMIT_SHA: "private-invalid-source" };
  const diagnostic = await previewReliabilityAttestation(diagnosticRequest(), invalid, now).json();
  assert.equal(diagnostic.predicates.sourceShaFormat, false);
  assert.ok(Object.values(diagnostic.predicates).every(value => typeof value === "boolean"));
  assert.doesNotMatch(JSON.stringify(diagnostic), /private-invalid-source/);
  assert.equal(previewReliabilityAttestation(request(), invalid, now).status, 404);
  const disabledQuery = new Request(request().url + "?diagnostic=0", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(previewReliabilityAttestation(disabledQuery, invalid, now).status, 404);
});

test("remaining configuration failures are boolean-only and normal mode stays hidden", async () => {
  const failures = [
    [{ SIGNAL_RELIABILITY_ORIGIN: "https://private-other.example" }, "originMatches"],
    [{ SIGNAL_RELIABILITY_ORIGIN: "http://private-other.example" }, "originHttps"],
    [{ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "" }, "testPublishableKey"], [{ CLERK_SECRET_KEY: "" }, "testSecretKey"],
    [{ VERCEL_DEPLOYMENT_ID: "" }, "deploymentIdFormat"], [{ VERCEL_PROJECT_ID: "" }, "projectIdFormat"],
    [{ TASKS_DATABASE_URL: "" }, "storesPresent"], [{ RESEND_API_KEY: "private-provider-value" }, "providersDisabled"],
    [{ SIGNAL_ACCESS_MODE: "review" }, "serverAccessProduction"], [{ NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review" }, "publicAccessProduction"],
    [{ CLERK_DOMAIN: "private-domain" }, "identityOverridesAbsent"], [{ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_invalid" }, "testIssuerParseable"],
    [{ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "false" }, "conversationInternalEnabled"], [{ SIGNAL_CONVERSATION_SEND_ENABLED: "false" }, "conversationSendsEnabled"],
    [{ SIGNAL_CONVERSATION_DELIVERY_ENABLED: "true" }, "conversationDeliveryDisabled"], [{ SIGNAL_CONVERSATION_DM_ENABLED: "true" }, "conversationDirectMessagesDisabled"],
    [{ SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "one-private-actor" }, "twoConversationActors"], [{ TASKS_AUTH_TOKEN: "" }, "conversationRemoteTarget"],
  ] as const;
  for (const [patch, predicate] of failures) {
    const env = { ...environment, ...patch };
    const response = previewReliabilityAttestation(diagnosticRequest(), env, now);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.predicates[predicate], false, predicate);
    assert.ok(Object.values(body.predicates).every(value => typeof value === "boolean"));
    assert.equal(previewReliabilityAttestation(request(), env, now).status, 404, predicate);
    assert.doesNotMatch(JSON.stringify(body), /private-|one-private-actor/);
  }
});
