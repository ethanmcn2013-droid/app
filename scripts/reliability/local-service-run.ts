import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import { assertProjectId } from "../../src/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "../../src/server/conversations/database";
import { createConversationService } from "../../src/server/conversations/service";
import { runWithTargetGuard } from "./contracts/target-manifest.mjs";
import { reconcileRun } from "./contracts/result-reconciliation.mjs";
import { ACTORS, allocateLocalServiceTarget, assertLocalServiceUrl, exerciseLocalServiceFaults, hashIdentity,
  initializeLocalServiceSchema, probeLocalServices, seedLocalServiceFixture, type LOCAL_PROFILES } from "./local-service-harness";

/** Explicit disabled-store markers are not claims that those stores were exercised. */
export function localServiceManifest(target: { directory: string; databaseUrl: string }) {
  assertLocalServiceUrl(target.databaseUrl);
  const runId = target.directory.split(/[\\/]/).at(-1)!.toLowerCase();
  const environment = { kind: "local-service-test", identity: runId, configHash: hashIdentity("local-file-service-no-network-v1"), production: false };
  const targetHashes = Object.fromEntries(["tasks", "notes", "timeline", "signal", "attachments"].map((name) => [name, hashIdentity(name === "tasks" ? target.databaseUrl : `${runId}:${name}:disabled`)]));
  const sinks = [{ name: "all-external-delivery", configHash: hashIdentity("disabled"), mode: "disabled" }];
  const manifest = { schemaVersion: 1, runId, fixtureNamespace: `reliability-${runId}`, environment,
    allowedOrigins: ["http://127.0.0.1:1"], expectedTargetHashes: targetHashes, allowedDeliverySinks: sinks,
    syntheticIdentities: Object.values(ACTORS), acceptanceTargets: { message_ack: 800, task_ack: 800, conversation_history: 1_000, message_visible: 1_000 },
    excludedStores: ["notes", "timeline", "signal", "attachments"], executionMode: "local-service-burst-probe", scope: "persisted-local-chat-and-message-task-outcome-services" };
  const observed = { environment, origin: manifest.allowedOrigins[0], targetHashes, deliverySinks: sinks,
    syntheticIdentities: Object.values(ACTORS), externalNetworkEnabled: false, externalDeliveryEnabled: false };
  return { manifest, observed };
}

export function scrubbedLocalEnvironment() {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (/^(TASKS_|NOTES_|TIMELINE_|SIGNAL_|NEXT_PUBLIC_|CLERK_|SENTRY_|RESEND_|STRIPE_|BLOB_|OPENAI_|ANTHROPIC_|VERCEL_|CRON_|OUTBOX_|GOOGLE_)/.test(key)) delete environment[key];
  return environment;
}

export async function runLocalServiceHarness(profile: keyof typeof LOCAL_PROFILES = "smoke", rounds = 2) {
  const target = await allocateLocalServiceTarget();
  const { manifest, observed } = localServiceManifest(target);
  // Prove wrong identity is rejected before opening a client or creating a record.
  await assert.rejects(runWithTargetGuard({ manifest, observed: { ...observed, environment: { ...observed.environment, identity: "wrong-test-target" } }, write: () => { throw new Error("guard_callback_reached"); } }), /target guard rejected/);
  await assert.rejects(access(join(target.directory, "tasks.db")));
  return runWithTargetGuard({ manifest, observed, write: async () => {
    const client = createClient({ url: target.databaseUrl });
    try {
      const migrations = await initializeLocalServiceSchema(client);
      const fixture = await seedLocalServiceFixture(client, profile);
      const probe = await probeLocalServices(client, fixture.checkpoint, rounds);
      const reconciliation = reconcileRun({ manifest: { ...manifest, measuredDurationSeconds: probe.elapsedMs / 1_000 }, observations: probe.observations, expectedOperations: probe.expectedOperations, requestCap: 1_000 });
      assert.ok(reconciliation.ok, JSON.stringify(reconciliation.findings));
      const faults = await exerciseLocalServiceFaults(client, fixture.checkpoint);
      const inputPath = join(target.directory, "checkpoint.json");
      await writeFile(inputPath, JSON.stringify({ databaseUrl: target.databaseUrl, checkpoint: fixture.checkpoint }));
      const restart = spawnSync(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "scripts/reliability/local-service-worker.ts", inputPath],
        { cwd: process.cwd(), env: scrubbedLocalEnvironment(), encoding: "utf8", timeout: 30_000 });
      assert.equal(restart.status, 0, restart.stderr);
      const receipt = { schemaVersion: 1, manifest, profile, migrations, counts: fixture.counts, checkpoint: fixture.checkpoint,
        probe, reconciliation, faults, freshProcessRead: JSON.parse(restart.stdout),
        limitations: ["local serialized database connection", "service calls with synthetic actors; no authenticated HTTP sessions", "burst probe; no timed 20-minute mixed workload or hosted latency claim", "task outcome creation only; ordinary task update/complete not measured", "resource metadata only; native bytes and external stores not exercised", "instant simulated outage; no 30-second interruption", "fresh-process read of committed database; forced crash/backup restore supplied by separate suites"] };
      await writeFile(join(target.directory, "receipt.json"), JSON.stringify(receipt, null, 2));
      return { target, receipt };
    } finally { client.close(); }
  } });
}

export async function runLocalInterruptionRehearsal(directory: string) {
  const resolved = resolve(directory);
  const receipt = JSON.parse(await readFile(join(resolved, "receipt.json"), "utf8"));
  const databaseUrl = `file:${join(resolved, "tasks.db").replaceAll("\\", "/")}`;
  const actual = localServiceManifest({ directory: resolved, databaseUrl });
  return runWithTargetGuard({ manifest: receipt.manifest, observed: actual.observed, write: async () => {
    const client = createClient({ url: databaseUrl });
    try {
      const service = createConversationService(createLocalConversationDatabaseAdapter({ client }));
      const currentRoom = await service.getProjectConversation({ actorId: ACTORS.writer, projectId: assertProjectId(receipt.checkpoint.projectId) });
      assert.ok(currentRoom.ok && currentRoom.value, "rehearsal_project_unavailable");
      const faults = await exerciseLocalServiceFaults(client, { ...receipt.checkpoint, audienceEpoch: currentRoom.value.audienceEpoch }, 30_000);
      const output = { profile: receipt.profile, targetHash: actual.manifest.expectedTargetHashes.tasks, faults,
        scope: "actual-30-second-local-adapter-interruption", pendingAttempts: "explicitly_failed_then_new_supported_writes", hostedProof: false };
      await writeFile(join(resolved, "interruption-receipt.json"), JSON.stringify(output, null, 2));
      return output;
    } finally { client.close(); }
  } });
}

async function main() {
  if (process.argv[2] === "fault-rehearsal") {
    console.log(JSON.stringify(await runLocalInterruptionRehearsal(process.argv[3])));
    return;
  }
  const profile = process.argv[2] ?? "smoke";
  if (!["smoke", "small", "representative"].includes(profile)) throw new Error("unsupported_local_profile");
  const result = await runLocalServiceHarness(profile as keyof typeof LOCAL_PROFILES, Number(process.argv[3] ?? 2));
  console.log(JSON.stringify({ receipt: join(result.target.directory, "receipt.json"), profile, counts: result.receipt.counts,
    latency: result.receipt.probe.latency, reconciliation: result.receipt.reconciliation.ok, faults: result.receipt.faults }));
}
if (/[/\\]local-service-run\.ts$/.test(process.argv[1] ?? "")) main().catch((error) => { console.error(error); process.exitCode = 1; });
