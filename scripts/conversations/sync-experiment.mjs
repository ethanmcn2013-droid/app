/** EX-02: isolated file store and two real Node HTTP processes. No provider calls. */
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createFreshSpikeDatabase, FIXTURE } from "./transaction-store.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(process.argv[2] ?? "work/conversation-sync");
await mkdir(outputDir, { recursive: true });
const databasePath = join(outputDir, `sync-${randomUUID()}.db`);
const fixture = await createFreshSpikeDatabase({ databasePath, foreignKeys: false });
const children = [];
const report = { experiment: "EX-02", runtime: process.version, startedAt: new Date().toISOString(), settings: fixture.settings, profiles: [], claims: [], failures: [] };
const scope = { projectId: FIXTURE.projectA, conversationId: FIXTURE.projectConversationA };
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] ?? null;
async function launch() {
  const child = fork(join(here, "sync-instance.mjs"), [databasePath], { silent: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
  children.push(child);
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error("instance_start_timeout")), 15_000);
    child.once("error", reject);
    child.once("exit", (code) => { if (code) reject(new Error(`instance_exit_${code}`)); });
    child.once("message", (message) => { clearTimeout(timeout); resolveReady({ url: `http://127.0.0.1:${message.port}`, pid: message.pid }); });
  });
}
async function read(instance, actorId, afterChangeSeq = 0) {
  const query = new URLSearchParams({ ...scope, afterChangeSeq: String(afterChangeSeq) });
  const started = performance.now();
  const response = await fetch(`${instance.url}/changes?${query}`, { headers: { "x-fixture-actor": actorId }, signal: AbortSignal.timeout(8_000) });
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.status, 200);
  return { value: await response.json(), elapsed: performance.now() - started };
}
try {
  const instances = await Promise.all([launch(), launch()]);
  report.instances = instances;
  assert.notEqual(instances[0].pid, instances[1].pid);
  for (const viewers of [10, 50, 200]) {
    const actors = Array.from({ length: viewers }, (_, index) => `synthetic-viewer-${viewers}-${index}`);
    await fixture.client.batch(actors.flatMap((actor) => [
      { sql: "INSERT INTO users(id,handle,name,color,initials) VALUES (?,?,?,'#64748b','SV')", args: [actor, actor, "Synthetic Viewer"] },
      { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,?,'member',?)", args: [scope.projectId, actor, Date.now()] },
    ]), "write");
    const initial = await read(instances[0], FIXTURE.alice);
    assert.equal(initial.value.ok, true);
    const epoch = initial.value.value.audienceEpoch;
    const warm = await Promise.all(actors.map((actor, index) => read(instances[index % 2], actor)));
    for (const result of warm) assert.equal(result.value.ok, true);
    const expected = new Map();
    const ackTimes = []; const observedDelays = []; const requestTimes = [];
    const seen = actors.map(() => new Map());
    let stopped = false; let sendDone = false;
    const runStarted = performance.now();
    const readers = actors.map(async (actor, index) => {
      let cursor = 0;
      await delay((index * 37) % 1000);
      while (!stopped && performance.now() - runStarted < 12_000) {
        const result = await read(instances[index % 2], actor, cursor);
        assert.equal(result.value.ok, true);
        requestTimes.push(result.elapsed);
        for (const change of result.value.value.changes) {
          if (change.messageId && !seen[index].has(change.messageId)) seen[index].set(change.messageId, Date.now());
        }
        cursor = result.value.value.throughChangeSeq;
        if (sendDone && [...expected.keys()].every((id) => seen[index].has(id))) break;
        if (!result.value.value.hasMore) await delay(1000);
      }
    });
    try {
      for (let index = 0; index < 10; index++) {
        const requestId = `sync_${viewers}_${randomUUID()}`;
        const started = performance.now();
        const response = await fetch(`${instances[index % 2].url}/send`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8_000),
          body: JSON.stringify({ ...scope, actorId: FIXTURE.alice, clientRequestId: requestId, expectedAudienceEpoch: epoch, body: `Synthetic sync message ${viewers}/${index}`, mentionUserIds: [], rootId: null }),
        });
        const receipt = await response.json();
        assert.equal(receipt.ok, true, JSON.stringify(receipt));
        ackTimes.push(performance.now() - started);
        expected.set(receipt.value.messageId, receipt.value.committedAt);
        await delay(100);
      }
      sendDone = true;
      await Promise.all(readers);
    } finally { stopped = true; await Promise.allSettled(readers); }
    for (const observations of seen) for (const [id, committedAt] of expected) {
      if (observations.has(id)) observedDelays.push(observations.get(id) - committedAt);
    }
    // A reader can beat the HTTP acknowledgment; first-seen times are retained independently.
    const finalReads = await Promise.all(actors.map((actor, index) => read(instances[index % 2], actor)));
    for (const [readerIndex, result] of finalReads.entries()) {
      assert.equal(result.value.ok, true);
      const ids = new Set(result.value.value.changes.map((change) => change.messageId));
      // Profile may contain >100 epoch changes; paginate fully for acknowledged-ID verification below.
      let cursor = result.value.value.throughChangeSeq; let more = result.value.value.hasMore;
      while (more) {
        const page = await read(instances[readerIndex % 2], actors[readerIndex], cursor);
        assert.equal(page.value.ok, true);
        for (const change of page.value.value.changes) ids.add(change.messageId);
        cursor = page.value.value.throughChangeSeq; more = page.value.value.hasMore;
      }
      for (const id of expected.keys()) assert.ok(ids.has(id), "acknowledged message missing");
    }
    const profile = { viewers, messages: expected.size, durationMs: Math.round(performance.now() - runStarted), pollingRequests: requestTimes.length,
      warmP95Ms: percentile(warm.map((value) => value.elapsed), 0.95), sendP95Ms: percentile(ackTimes, 0.95), visibilityP95Ms: percentile(observedDelays, 0.95),
      observedDeliveries: observedDelays.length, expectedDeliveries: viewers * expected.size, pollP95Ms: percentile(requestTimes, 0.95) };
    profile.withinTargets = profile.observedDeliveries === profile.expectedDeliveries && profile.sendP95Ms <= 800 && profile.visibilityP95Ms !== null && profile.visibilityP95Ms <= 1500 && profile.warmP95Ms <= 1000;
    report.profiles.push(profile);
    process.stdout.write(JSON.stringify(profile) + "\n");
    // Verify immediate post-revoke denial independently on both runtime instances.
    await fixture.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?", args: [scope.projectId, actors[0]] });
    for (const instance of instances) assert.deepEqual((await read(instance, actors[0])).value, { ok: false, code: "unavailable" });
    await fixture.client.batch(actors.slice(1).map((actor) => ({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?", args: [scope.projectId, actor] })), "write");
  }
  report.instanceStats = await Promise.all(instances.map(async (instance) => (await fetch(`${instance.url}/stats`)).json()));
  report.claims = ["Two independent local Node processes read the same local file store", "Fresh membership denial checked on both processes after raw SQL removal", "Synthetic HTTP identity only; Clerk and deployed Turso consistency unverified", "Local demand measured; hosted monetary cost and network latency unverified", "No production route or migration installed"];
} catch (error) {
  report.failures.push(error.message);
  process.exitCode = 1;
} finally {
  for (const child of children) { if (child.connected) child.send("close"); }
  await Promise.all(children.map((child) => new Promise((resolveExit) => {
    if (child.exitCode !== null) return resolveExit();
    const timer = setTimeout(() => { child.kill(); resolveExit(); }, 3000);
    child.once("exit", () => { clearTimeout(timer); resolveExit(); });
  })));
  fixture.client.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(outputDir, "sync-result.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ result: join(outputDir, "sync-result.json"), failures: report.failures }) + "\n");
}
