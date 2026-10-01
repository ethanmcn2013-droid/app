import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { initializeLocalServiceSchema } from "./local-service-harness";
import { assertProjectId } from "../../src/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "../../src/server/conversations/database";
import { createConversationService } from "../../src/server/conversations/service";
import { createConversationTaskOutcomeService } from "../../src/server/conversations/work-links";
import { type HostedFixture } from "./hosted-seed";
import { buildMixedWorkloadSchedule } from "./contracts/workload-schedule.mjs";
import { JOURNEY_TARGETS } from "./contracts/result-reconciliation.mjs";
import { previewScopedFetch, previewScopedAccessFetch, validateVercelProtectionCookie, cleanupHostedNamespace, runHostedLaunch, validateHostedPreflight, type HostedRunConfig } from "./hosted-run";

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
      acceptanceTargets: { ...JOURNEY_TARGETS },
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

test("malformed manifest field shapes and missing controls refuse before seed or output", async () => {
  for (const field of ["authentication", "allowedOrigins", "allowedNetworkOrigins", "allowedDeliverySinks", "conversationControls"]) {
    const { config, attestation } = example();
    if (field === "conversationControls") Reflect.deleteProperty(attestation, field);
    else Reflect.set(config.manifest, field, field === "authentication" ? null : "not-an-array");
    const calls: string[] = [];
    await assert.rejects(runHostedLaunch(config, true, {
      fetchAttestation: async () => attestation,
      seed: async () => { calls.push("seed"); throw new Error("unexpected_seed"); },
      write: async () => { calls.push("write"); },
      makeDirectory: async () => { calls.push("directory"); return undefined; },
    }), field === "conversationControls" ? /hosted_conversation_controls_refused/ : /hosted_manifest_binding_mismatch/);
    assert.deepEqual(calls, []);
  }
});

test("missing seed result never starts workload or cleanup and retains the incomplete namespace", async () => {
  const { config, attestation } = example();
  const calls: string[] = [], records: Array<{ name: string; options: { flag: "wx" } }> = [];
  const result = await runHostedLaunch(config, true, {
    fetchAttestation: async () => attestation,
    seed: async () => undefined,
    workload: async () => { calls.push("workload"); throw new Error("unexpected_workload"); },
    cleanup: async () => { calls.push("cleanup"); throw new Error("unexpected_cleanup"); },
    write: async (name, _body, options) => { records.push({ name, options }); },
    makeDirectory: async () => undefined,
  });
  assert.equal(result.completed, false);
  assert.equal(result.runFailure, "hosted_fixture_missing");
  assert.deepEqual(result.namespaceCleanup, { ok: false, retainedForReconciliation: true, code: "fixture_seed_incomplete_cleanup_requires_review" });
  assert.deepEqual(calls, []);
  assert.deepEqual(records.map(record => record.name), [join(config.outputDirectory, "preflight.json"), join(config.outputDirectory, "launcher-summary.json")]);
  assert.ok(records.every(record => record.options.flag === "wx"));
});

test("missing, changed or extra hosted acceptance targets refuse before fixture seeding", async () => {
  const { config, attestation } = example();
  for (const mutate of [
    (copy: HostedRunConfig) => { delete copy.manifest.acceptanceTargets; },
    (copy: HostedRunConfig) => { copy.manifest.acceptanceTargets = { ...JOURNEY_TARGETS, "chat.send": 900 }; },
    (copy: HostedRunConfig) => { copy.manifest.acceptanceTargets = { ...JOURNEY_TARGETS, extra: 2_000 }; },
  ]) {
    const changed = structuredClone(config); mutate(changed);
    // Shared isolated-runtime preflight is also used by ordinary and cleanup tools.
    assert.doesNotThrow(() => validateHostedPreflight(changed, attestation));
    for (const execute of [false, true]) {
      const calls: string[] = [];
      await assert.rejects(runHostedLaunch(changed, execute, {
        fetchAttestation: async () => { calls.push("attestation"); return attestation; },
        seed: async () => { calls.push("seed"); throw new Error("unexpected_seed"); },
        makeDirectory: async () => { calls.push("directory"); return undefined; },
      }), /hosted_acceptance_targets_invalid/);
      assert.deepEqual(calls, []);
    }
  }
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
    cleanup: async () => { calls.push("cleanup"); return { ok: true, deletedProjects: 0, remainingProjects: 0, residualScopedRows: 0, checkedScopedTables: [] }; },
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
    cleanup: async () => { calls.push("cleanup"); return { ok: true, deletedProjects: 10, remainingProjects: 0, residualScopedRows: 0, checkedScopedTables: [] }; },
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

test("failed workload retains its fixture for reconciliation and emits sanitized summary", async () => {
  const { config, attestation, fixture } = example();
  let cleaned = 0;
  const written: string[] = [];
  const result = await runHostedLaunch(config, true, { fetchAttestation: async () => attestation, seed: async () => fixture,
    workload: async () => { throw new Error("secret: private-tasks-token"); },
    cleanup: async () => { cleaned++; return { ok: true, deletedProjects: 10, remainingProjects: 0, residualScopedRows: 0, checkedScopedTables: [] }; },
    write: async (_path: string, body: string) => { written.push(body); }, makeDirectory: async () => undefined });
  assert.equal(result.completed, false);
  assert.equal(result.runFailure, "hosted_run_failed");
  assert.equal(cleaned, 0);
  assert.equal((result.namespaceCleanup as { retainedForReconciliation: boolean }).retainedForReconciliation, true);
  assert.ok(written.every((body) => !body.includes(config.tasksToken)));
});

test("workload result without verified ten-session cleanup retains fixture", async () => {
  const { config, attestation, fixture } = example();
  let cleaned = 0;
  const result = await runHostedLaunch(config, true, { fetchAttestation: async () => attestation, seed: async () => fixture,
    workload: async () => ({ completed: true, sessionCleanup: { ok: false, attempted: 10, revoked: 9, unresolved: 1, errors: [] } }),
    cleanup: async () => { cleaned++; return { ok: true, deletedProjects: 10, remainingProjects: 0, residualScopedRows: 0, checkedScopedTables: [] }; },
    write: async () => undefined, makeDirectory: async () => undefined });
  assert.equal(result.completed, false);
  assert.equal(cleaned, 0);
  assert.equal((result.namespaceCleanup as { retainedForReconciliation: boolean }).retainedForReconciliation, true);
});

test("scoped cleanup removes non-cascading task/activity/outbox rows and refuses residual false success", async () => {
  const { config } = example();
  const ids = Array.from({ length: 10 }, (_, index) => `${config.manifest.fixtureNamespace}_project_${index}`);
  const sql: string[] = [];
  let closed = false;
  let deleted = false;
  let committed = false;
  let rolledBack = false;
  const fakeClient = { execute: async (statement: { sql: string; args?: readonly unknown[] }) => {
    sql.push(statement.sql);
    if (statement.sql.startsWith("SELECT id,owner_user_id FROM workspaces"))
      return { rows: ids.map((id) => ({ id, owner_user_id: config.actors[0].actorId })), rowsAffected: 0 };
    if (statement.sql.startsWith("SELECT id,workspace_id FROM conversations"))
      return { rows: ids.map((id, index) => ({ id: `project_synthetic_${index}`, workspace_id: id })), rowsAffected: 0 };
    if (statement.sql.startsWith("DELETE FROM workspaces")) { deleted = true; return { rows: [], rowsAffected: 10 }; }
    if (statement.sql.startsWith("SELECT id FROM workspaces")) return { rows: deleted ? [] : ids.map((id) => ({ id })), rowsAffected: 0 };
    if (statement.sql.startsWith("SELECT COUNT(*)")) return { rows: [{ count: statement.sql.includes("FROM activities") ? 1 : 0 }], rowsAffected: 0 };
    return { rows: [], rowsAffected: 0 };
  }, transaction: async () => ({ execute: fakeClient.execute, closed: false,
    commit: async () => { committed = true; }, rollback: async () => { rolledBack = true; } }), close: () => { closed = true; } };
  const result = await cleanupHostedNamespace(config, (() => fakeClient) as unknown as typeof import("@libsql/client").createClient);
  assert.equal(result.ok, false);
  assert.equal(result.residualScopedRows, 1);
  assert.equal(closed, true);
  assert.equal(committed, false);
  assert.equal(rolledBack, true);
  for (const table of ["work_operation_receipts", "suite_outbox", "activities", "tasks", "resources", "conversation_messages"])
    assert.ok(sql.some((statement) => statement.startsWith(`DELETE FROM ${table}`)), `missing ${table} cleanup`);
});

test("scoped cleanup refuses a missing or foreign project before deleting anything", async () => {
  const { config } = example();
  const sql: string[] = [];
  const fakeClient = { execute: async (statement: { sql: string }) => { sql.push(statement.sql); return { rows: [], rowsAffected: 0 }; },
    transaction: async () => ({ execute: fakeClient.execute, closed: false, rollback: async () => {} }), close: () => {} };
  await assert.rejects(cleanupHostedNamespace(config, (() => fakeClient) as unknown as typeof import("@libsql/client").createClient),
    /hosted_cleanup_scope_refused/);
  assert.equal(sql.some((statement) => statement.startsWith("DELETE")), false);
});

test("real migrated schema cleanup preserves external state and refuses cross-boundary references before any delete", async () => {
  for (const foreignKeys of [false, true]) for (const scenario of ["healthy", "outgoing-link", "incoming-link", "resource-mismatch", "outbox-mismatch", "task-project-mismatch", "mid-delete-failure"]) {
    const { config } = example();
    const db = createClient({ url: "file::memory:" });
    let deleteStatements = 0;
    try {
      await initializeLocalServiceSchema(db);
      await db.execute(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
      const [writer, observer] = config.actors;
      for (const actor of config.actors) await db.execute({ sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES (?,?,?,'#444444','S')",
        args: [actor.actorId, actor.clerkId, "Synthetic cleanup actor"] });
      const projects = Array.from({ length: 10 }, (_, index) => assertProjectId(`${config.manifest.fixtureNamespace}_project_${index}`));
      const external = assertProjectId("external_cleanup_sentinel_project");
      const adapter = createLocalConversationDatabaseAdapter({ client: db });
      const conversations = createConversationService(adapter);
      const outcomes = createConversationTaskOutcomeService(adapter, { captureConfig: { enabled: false, now: 0 } });
      const rooms = [];
      for (const projectId of [...projects, external]) {
        await db.execute({ sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type) VALUES (?,?,?,?,'project')",
          args: [projectId, projectId, "Synthetic cleanup project", writer.actorId] });
        for (const actor of config.actors) await db.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES (?,?,'member')", args: [projectId, actor.actorId] });
        const room = await conversations.ensureProjectConversation({ actorId: writer.actorId, projectId });
        assert.ok(room.ok); rooms.push(room.value);
      }
      const source = scenario === "incoming-link" ? rooms[10] : rooms[0];
      const sent = await conversations.sendMessage({ actorId: writer.actorId, input: { projectId: assertProjectId(source.projectId),
        conversationId: source.conversationId, expectedAudienceEpoch: source.audienceEpoch, clientRequestId: "cleanup_message_1234",
        body: "Synthetic cleanup message", rootId: null, mentionUserIds: [observer.actorId] } });
      assert.ok(sent.ok);
      const task = await outcomes.promoteMessageToTask({ actorId: writer.actorId, input: { clientRequestId: "cleanup_task_1234",
        sourceProjectId: assertProjectId(source.projectId), destinationProjectId: scenario === "outgoing-link" ? external : projects[0],
        conversationId: source.conversationId, messageId: sent.value.messageId, expectedRevision: 1, expectedAudienceEpoch: source.audienceEpoch,
        title: "Synthetic cleanup task", ownerUserId: observer.actorId, dueDate: "2026-10-25" as never } });
      assert.ok(task.ok);
      await db.execute({ sql: "INSERT INTO resources(id,workspace_id,task_id,kind,provider,title,added_at,access_state) VALUES ('cleanup-resource',?,?,'link','url','Synthetic',1,'ok')",
        args: [scenario === "outgoing-link" || scenario === "resource-mismatch" ? external : projects[0], task.value.taskId] });
      if (scenario === "outbox-mismatch") await db.execute({ sql: "UPDATE suite_outbox SET workspace_id=?", args: [external] });
      if (scenario === "task-project-mismatch") await db.execute({ sql: "UPDATE tasks SET workspace_id=? WHERE id=?", args: [projects[1], task.value.taskId] });
      const tables = ["workspaces", "workspace_members", "tasks", "activities", "resources", "suite_outbox", "work_links", "work_operation_receipts",
        "conversations", "conversation_messages", "conversation_attention", "conversation_outbox", "conversation_receipts", "conversation_changes", "conversation_participants"];
      const snapshot = async () => {
        const values: Record<string, string[]> = {};
        for (const table of tables) values[table] = (await db.execute(`SELECT * FROM ${table}`)).rows.map(row => JSON.stringify(row)).sort();
        return values;
      };
      const before = await snapshot();
      const makeClient = (() => ({ transaction: async (mode: "write") => {
        assert.equal(mode, "write");
        // Keep the in-memory database on one connection: libSQL's transaction()
        // detaches it. These are its actual SQLite write-transaction boundaries.
        await db.execute("BEGIN IMMEDIATE");
        let closed = false;
        return { get closed() { return closed; },
          commit: async () => { await db.execute("COMMIT"); closed = true; },
          rollback: async () => { await db.execute("ROLLBACK"); closed = true; },
          execute: async (statement: string | { sql: string; args: string[] }) => {
            if ((typeof statement === "string" ? statement : statement.sql).startsWith("DELETE")) {
              deleteStatements++;
              if (scenario === "mid-delete-failure" && deleteStatements === 4) throw new Error("injected_cleanup_failure");
            }
            return db.execute(statement);
          } };
      }, close: () => {} })) as unknown as typeof createClient;
      if (scenario === "mid-delete-failure") {
        await assert.rejects(cleanupHostedNamespace(config, makeClient), /injected_cleanup_failure/);
        assert.equal(deleteStatements, 4);
        assert.deepEqual(await snapshot(), before, "mid-delete failure must roll back every prior deletion");
      } else if (scenario !== "healthy") {
        await assert.rejects(cleanupHostedNamespace(config, makeClient), /hosted_cleanup_reference_scope_refused/, `${scenario}, FK=${foreignKeys}`);
        assert.equal(deleteStatements, 0, `${scenario} must be refused before the first DELETE`);
        assert.deepEqual(await snapshot(), before, `${scenario} must preserve every fixture and external row`);
      } else {
        const result = await cleanupHostedNamespace(config, makeClient);
        assert.equal(result.ok, true); assert.equal(result.deletedProjects, 10); assert.equal(result.residualScopedRows, 0);
        for (const table of ["tasks", "activities", "resources", "suite_outbox", "work_links", "work_operation_receipts", "conversation_messages", "conversation_attention", "conversation_outbox"])
          assert.equal(Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n), 0, table);
        assert.equal((await db.execute({ sql: "SELECT id FROM workspaces WHERE id=?", args: [external] })).rows.length, 1);
        assert.equal((await db.execute({ sql: "SELECT user_id FROM workspace_members WHERE workspace_id=?", args: [external] })).rows.length, 2);
        assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
      }
    } finally { db.close(); }
  }
});
