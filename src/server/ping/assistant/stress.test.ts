import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import type { AssistantAction, AssistantPlan, AssistantRequest } from "@/lib/ping/assistant/contract";
import { createPingProofFixture, PROOF_PROJECT, seedProofTask } from "../proof-fixture";
import { createAssistantStore } from "./store";
import { createAssistantService } from "./service";
import { executeAssistantAction, type AssistantActionInput } from "./actions";
import { getAssistantContext } from "./context";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";

// Synthetic file-backed SQLite, actual fencing/service/actions. No ambient runtime,
// authentication, provider, email, or Timeline publication is imported here.
const FIXED_NOW = Date.parse("2026-10-18T09:00:00.000Z");
const project = { kind: "current" } as const;
const create = (count: number, extra = {}): AssistantAction => ({ id: "create", kind: "create_tasks", project,
  template: { count, titlePrefix: "Synthetic stress", ...extra } });
const plan = (actions: readonly AssistantAction[], mode: "draft" | "execute" = "execute"): AssistantPlan =>
  ({ version: "ping.assistant.v1", outcome: "plan", mode, actions });
async function fixture(planned: AssistantPlan, options: { actor?: string; lost?: boolean; dispatch?: AssistantActionInput["dispatch"]; timelineFails?: boolean } = {}) {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  const store = createAssistantStore(database, { now: () => FIXED_NOW });
  let plans = 0, executions = 0, deliveries = 0, provisions = 0;
  const transact = <T>(operation: Parameters<typeof database.transaction<T>>[0]) => database.transaction(operation, { behavior: "immediate" });
  const service = createAssistantService({ store, now: () => FIXED_NOW,
    planner: { plan: async () => { plans++; return { plan: planned, model: "synthetic-one-shot" }; } },
    context: (actor, request) => transact(async tx => {
      const c = await getAssistantContext(tx, actor, request.scope.kind === "project" ? request.scope.projectId : null);
      return { actorName: actor, projectName: c.project?.name ?? null, projects: c.projects.map(p => ({ name: p.name })),
        members: c.members.map(m => ({ name: m.name ?? "Unnamed" })), selectedTaskCount: request.selectedTaskIds?.length ?? 0,
        previousTaskCount: 0, referenceDate: "2026-10-18", timeZone: "Europe/Dublin" };
    }),
    execute: async input => {
      executions++;
      const result = await executeAssistantAction({ ...input, now: () => FIXED_NOW, deliveryTransaction: transact,
        dispatch: options.dispatch ? async (...args) => { deliveries++; return options.dispatch!(...args); } : undefined,
        prepareTimeline: async action => { provisions++; if (options.timelineFails) throw Error("synthetic unavailable");
          return { href: `/app/timeline/synthetic/current-preview?workspaceId=${action.projectId}` }; } });
      if (options.lost) throw Error("synthetic response lost after durable commit");
      return result;
    },
  });
  let sequence = 0;
  const request = (overrides: Partial<AssistantRequest> = {}): AssistantRequest => ({ requestId: `stress_request_${++sequence}`,
    text: "Synthetic structured planner scenario", scope: { kind: "project", projectId: PROOF_PROJECT }, mode: "execute", ...overrides });
  const submit = (overrides: Partial<AssistantRequest> = {}) => service.submit(options.actor ?? "alice", request(overrides));
  const count = async (where = "1=1") => Number((await proof.client.execute(`SELECT COUNT(*) n FROM tasks WHERE ${where}`)).rows[0].n);
  return { ...proof, database, store, service, request, submit, count, stats: () => ({ plans, executions, deliveries, provisions }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const samples: { id: string; ms: number; status: string }[] = [];
const childBatch = Boolean(process.env.PING_ASSISTANT_STRESS_RANGE);
const range = process.env.PING_ASSISTANT_STRESS_RANGE?.split(":").map(Number) ?? [1, 100];
assert.ok(range.length === 2 && range.every(Number.isSafeInteger) && range[0] >= 1 && range[1] <= 100 && range[0] <= range[1], "Invalid synthetic scenario range");
let serial = 0;
function scenario(name: string, body: (f: Fixture) => Promise<string>, p: AssistantPlan, options: Parameters<typeof fixture>[1] = {}) {
  const id = `${String(++serial).padStart(3, "0")}:${name}`;
  if (!childBatch || serial < range[0] || serial > range[1]) return;
  test(id, async t => {
    const f = await fixture(p, options); const started = performance.now();
    try { const status = await body(f); const ms = performance.now() - started; samples.push({ id, ms, status });
      t.diagnostic(JSON.stringify({ synthetic: true, id, serverSpanMs: Number(ms.toFixed(3)), status, ...f.stats() }));
      assert.equal((await f.client.execute("PRAGMA quick_check")).rows[0].quick_check, "ok");
      assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks WHERE workspace_id='synthetic-foreign-project'")).rows[0].n), 0);
    } finally { f.client.close(); }
  });
}

const createVariants = [
  { count: 1 }, { count: 2, status: "doing" }, { count: 3, status: "review" }, { count: 4, status: "done" },
  { count: 5, dueDate: "tomorrow" }, { count: 6, dueDate: "2026-10-30" }, { count: 7, assignees: [{ kind: "self" }] },
  { count: 8, milestoneCount: 3 }, { count: 9, description: "Synthetic detail" }, { count: 10, dueDate: null },
  { count: 50, titlePrefix: "Unicode café 🎯" }, { count: 100, milestoneCount: 10 },
];
for (const [index, variant] of createVariants.entries()) {
  const { count, ...fields } = variant;
  scenario(`create-${index + 1}-${count}`, async f => { const r = await f.submit(); assert.equal(r.status, "completed");
    assert.equal(await f.count(), count); assert.equal(r.steps[0].result?.createdTaskIds?.length, count);
    const rows = (await f.client.execute("SELECT * FROM tasks ORDER BY seq")).rows;
    assert.equal(new Set(rows.map(r => r.seq)).size, count);
    if ("status" in fields) assert.ok(rows.every(r => r.lane === fields.status));
    if ("description" in fields) assert.ok(rows.every(r => r.description === fields.description));
    if ("milestoneCount" in fields) assert.equal(rows.filter(r => r.is_milestone === 1).length, fields.milestoneCount);
    if ("assignees" in fields) assert.ok(rows.every(r => JSON.parse(String(r.assignees)).includes("alice")));
    return r.status; }, plan([create(count, fields)]));
}
for (const amount of [1, 2, 3, 5, 10, 20, 30, 40, 50, 75, 90, 100]) {
  scenario(`archive-and-exact-undo-${amount}`, async f => { const r = await f.submit(); assert.equal(r.status, "completed");
    assert.equal(r.steps[1].result?.undo?.taskIds.length, amount); assert.equal(await f.count(), 100);
    assert.equal(await f.count("archived_at IS NOT NULL"), 0); assert.equal(r.steps[2].result?.affectedCount, amount); return r.status;
  }, plan([create(100), { id: "archive", kind: "archive_tasks", project, targets: { kind: "created", stepId: "create", limit: amount }, archived: true },
    { id: "undo", kind: "archive_tasks", project, targets: { kind: "created", stepId: "create", limit: amount }, archived: false }]));
}
const changes = [{ title: "Renamed" }, { description: "Updated detail" }, { status: "todo" }, { status: "doing" }, { status: "review" },
  { status: "done" }, { dueDate: "tomorrow" }, { dueDate: null }, { milestone: true }, { milestone: false },
  { assignees: [{ kind: "self" }] }, { title: "Combined", status: "done", milestone: true }];
for (const [index, change] of changes.entries()) scenario(`update-field-${index + 1}`, async f => {
  const r = await f.submit(); assert.equal(r.status, "completed"); assert.equal(r.steps[1].result?.affectedCount, 3);
  const rows = (await f.client.execute("SELECT * FROM tasks")).rows;
  if ("title" in change) assert.ok(rows.every(r => r.title === change.title));
  if ("status" in change) assert.ok(rows.every(r => r.lane === change.status));
  if ("milestone" in change) assert.ok(rows.every(r => Number(r.is_milestone) === Number(change.milestone)));
  return r.status;
}, plan([create(3), { id: "edit", kind: "update_tasks", project, targets: { kind: "created", stepId: "create" }, changes: change } as AssistantAction]));

for (const count of [1, 3, 13, 55, 100]) scenario(`draft-apply-${count}`, async f => {
  const r = await f.submit({ mode: "draft" }); assert.equal(r.status, "ready"); assert.equal(await f.count(), 0);
  await f.service.resume("alice", r.id); assert.equal(await f.count(), 0);
  assert.equal((await f.service.apply("alice", r.id)).status, "completed"); await f.service.apply("alice", r.id);
  assert.equal(await f.count(), count); assert.equal(f.stats().plans, 1); assert.equal(f.stats().executions, 1); return "completed";
}, plan([create(count)]));
for (const boundary of ["membership", "actor-erasure", "owner-erasure", "selected-foreign", "cancel"] as const) scenario(`draft-authority-${boundary}`, async f => {
  const r = await f.submit({ mode: "draft", ...(boundary === "selected-foreign" ? { selectedTaskIds: ["foreign-selection"] } : {}) });
  assert.equal(r.status, "ready");
  if (boundary === "membership") await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
  if (boundary === "actor-erasure" || boundary === "owner-erasure") await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'{}')", args: [accountDeletionTombstoneKey(boundary === "actor-erasure" ? "clerk_alice" : "clerk_owner")] });
  if (boundary === "selected-foreign") await seedProofTask(f.client, "foreign-selection", { projectId: "synthetic-foreign-project" });
  const result = boundary === "cancel" ? await f.service.cancel("alice", r.id) : await f.service.apply("alice", r.id);
  assert.equal(result.status, boundary === "cancel" ? "cancelled" : "partial");
  assert.equal(await f.count("workspace_id='synthetic-ping-project'"), 0);
  if (boundary === "selected-foreign") await f.client.execute("DELETE FROM tasks WHERE id='foreign-selection'");
  return result.status;
}, plan([boundary === "selected-foreign" ? { id: "edit", kind: "update_tasks", project, targets: { kind: "selected" }, changes: { title: "Forbidden" } } : create(10)]));
for (const count of [1, 8, 50, 90, 100]) scenario(`lost-response-idempotency-${count}`, async f => {
  const request = f.request(); const r = await f.service.submit("alice", request); assert.equal(r.status, "completed");
  const duplicate = await f.service.submit("alice", request); assert.equal(duplicate.id, r.id);
  await f.service.resume("alice", r.id); assert.equal(await f.count(), count); assert.equal(f.stats().executions, 1);
  await assert.rejects(f.service.submit("alice", { ...request, text: "different" }), /request_conflict/); return r.status;
}, plan([create(count)]), { lost: true });
for (const kind of ["comment", "message", "nudge-accepted", "nudge-unknown", "nudge-muted"] as const) scenario(`conversation-and-notification-${kind}`, async f => {
  await f.client.execute("UPDATE users SET email='synthetic-bob@example.invalid' WHERE id='bob'");
  if (kind === "nudge-muted") await f.client.execute("INSERT INTO notification_prefs(user_id,nudges) VALUES('bob',0)");
  const request = f.request(), r = await f.service.submit("alice", request);
  assert.equal(r.status, kind === "nudge-unknown" ? "partial" : "completed");
  await f.service.submit("alice", request); await f.service.resume("alice", r.id);
  const table = kind === "comment" ? "comments" : kind === "message" ? "conversation_messages" : "notifications";
  assert.equal(Number((await f.client.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n), kind === "nudge-muted" ? 0 : 1);
  assert.equal(f.stats().deliveries, kind.startsWith("nudge") && kind !== "nudge-muted" ? 1 : 0);
  return r.status;
}, plan([create(1, { assignees: [{ kind: "name", name: "bob" }] }), kind === "comment" ?
  { id: "follow", kind: "add_comment", project, targets: { kind: "created", stepId: "create" }, body: "Synthetic comment" } : kind === "message" ?
    { id: "follow", kind: "send_message", project, body: "Synthetic chat" } :
    { id: "follow", kind: "nudge_tasks", project, targets: { kind: "created", stepId: "create" } }]),
{ dispatch: async () => ({ outcome: kind === "nudge-unknown" ? "unknown" : "accepted" }) });

for (const [index, targets] of [
  { kind: "selected" }, { kind: "titles", titles: ["Missing"] }, { kind: "previous" },
  { kind: "titles", titles: ["Synthetic foreign"] }, { kind: "all", status: "done" },
].entries()) for (const kind of ["archive_tasks", "update_tasks"] as const) scenario(`refusal-${kind}-${index}`, async f => {
  await seedProofTask(f.client, "guard"); const r = await f.submit(); assert.equal(r.status, "partial");
  assert.equal(await f.count(), 1); assert.equal(await f.count("archived_at IS NOT NULL"), 0);
  assert.equal((await f.client.execute("SELECT title FROM tasks")).rows[0].title, "Synthetic guard"); return r.status;
}, plan([kind === "archive_tasks" ? { id: "refuse", kind, project, targets, archived: true } :
  { id: "refuse", kind, project, targets, changes: { title: "Forbidden" } }] as AssistantAction[]));

for (const [index, message] of ["Which project?", "Which Alex?", "Which tasks?", "Choose a date", "Archive or delete?", "Which conversation?", "Which recipient?", "What should the comment say?"].entries())
  scenario(`clarification-${index + 1}`, async f => { const r = await f.submit(); assert.equal(r.status, "clarification");
    assert.equal(r.message, message); assert.equal(await f.count(), 0); assert.equal(f.stats().executions, 0); return r.status;
  }, { version: "ping.assistant.v1", outcome: "clarification", message });

for (const outcome of ["accepted", "unknown", "suppressed", "throw"] as const) for (const recipients of [1, 2]) scenario(`invite-${outcome}-${recipients}`, async f => {
  const r = await f.submit(); assert.equal(r.status, outcome === "unknown" || outcome === "throw" ? "partial" : "completed");
  const calls = f.stats().deliveries; await f.service.resume("owner", r.id); assert.equal(f.stats().deliveries, calls);
  assert.equal(calls, recipients); assert.equal(await f.count(), 0);
  assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM pending_invites")).rows[0].n), recipients); return r.status;
}, plan([{ id: "invite", kind: "invite_members", project, emails: Array.from({ length: recipients }, (_, i) => `synthetic${i}@example.invalid`) }]),
{ actor: "owner", dispatch: async () => { if (outcome === "throw") throw Error("synthetic ambiguous transport"); return { outcome }; } });

for (const kind of ["open_project", "open_chat", "read_chat", "list_tasks", "read_timeline", "preview_timeline"] as const) scenario(`read-only-${kind}`, async f => {
  const r = await f.submit(); assert.equal(r.status, "completed"); assert.equal(await f.count(), 0);
  assert.equal(r.steps[0].result?.affectedCount, 0); return r.status;
}, plan([{ id: "read", kind, project }]));
for (const kind of ["read_timeline", "preview_timeline"] as const) scenario(`timeline-unavailable-${kind}`, async f => {
  const r = await f.submit(); assert.equal(r.status, "partial"); assert.equal(await f.count(), 0);
  assert.equal(r.steps[0].result?.code, "timeline_pending"); return r.status;
}, plan([{ id: "read", kind, project }]), { timelineFails: true });

for (const concurrency of [2, 3, 4, 5, 6]) scenario(`concurrent-duplicate-${concurrency}`, async f => {
  const request = f.request();
  // Settle every submitted operation before fixture cleanup even when one fails.
  // Rejected submits still fail this scenario; no busy error is ignored/retried.
  const submitted = await Promise.allSettled(Array.from({ length: concurrency }, () => f.service.submit("alice", request)));
  const rejected = submitted.filter(result => result.status === "rejected");
  assert.equal(rejected.length, 0, `Concurrent submit rejection: ${rejected.map(result => String(result.reason)).join("; ")}`);
  const results = submitted.filter(result => result.status === "fulfilled").map(result => result.value);
  assert.equal(new Set(results.map(r => r.id)).size, 1); const r = await f.service.resume("alice", results[0].id);
  assert.equal(r.status, "completed"); assert.equal(await f.count(), 100); assert.equal(f.stats().plans, 1); return r.status;
}, plan([create(100)]));
for (const count of [1, 2, 3, 4, 5]) scenario(`cross-domain-create-project-${count}`, async f => {
  const r = await f.submit({ scope: { kind: "account" } }); assert.equal(r.status, "completed");
  const id = r.steps[0].result?.createdProjectId; assert.ok(id); assert.equal(r.steps[1].result?.projectId, id);
  assert.equal(await f.count(), count); assert.ok(r.steps[2].result?.href?.startsWith("/app/")); return r.status;
}, plan([{ id: "project", kind: "create_project", name: `Synthetic owned ${count}` },
  { ...create(count), project: { kind: "created", stepId: "project" } }, { id: "open", kind: "open_project", project: { kind: "created", stepId: "project" } }]));

if (childBatch) test("stress scenario inventory and bounded latency summary", t => {
  assert.equal(serial, 100); assert.equal(samples.length, range[1] - range[0] + 1);
  const sorted = samples.map(s => s.ms).sort((a, b) => a - b);
  const percentile = (p: number) => Number(sorted[Math.ceil(sorted.length * p) - 1].toFixed(3));
  t.diagnostic(JSON.stringify({ synthetic: true, scenarios: samples.length, unit: "milliseconds", includes: "service submit/apply/recovery plus scenario SQL assertions; excludes fixture migration/setup", p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1), statuses: samples.reduce<Record<string, number>>((a, s) => ({ ...a, [s.status]: (a[s.status] ?? 0) + 1 }), {}), limitation: "fake one-shot planner and dispatcher; no model quality, network latency, real delivery, publication, or production claim" }));
});
else test("100 actual SQLite service/action scenarios in ten isolated native-client batches", { timeout: 600_000 }, async t => {
  assert.equal(serial, 100);
  const directory = process.env.PING_ASSISTANT_STRESS_OUTPUT ? path.resolve(process.env.PING_ASSISTANT_STRESS_OUTPUT) : await mkdtemp(path.join(tmpdir(), "ping-assistant-stress-"));
  await mkdir(directory, { recursive: true });
  const all: { id: string; serverSpanMs: number; status: string }[] = [];
  for (let first = 1; first <= 100; first += 10) {
    const label = `${String(first).padStart(3, "0")}-${String(first + 9).padStart(3, "0")}`;
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; raw: string }>((resolve, reject) => {
      // Node's inherited worker marker prevents a child --test invocation from
      // starting. This is a fresh test runner, not an in-process nested run().
      const childEnvironment: NodeJS.ProcessEnv = { ...process.env, PING_ASSISTANT_STRESS_RANGE: `${first}:${first + 9}` };
      delete childEnvironment.NODE_TEST_CONTEXT;
      const child = spawn(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "--test", "--test-concurrency=1", "src/server/ping/assistant/stress.test.ts"],
        { cwd: process.cwd(), env: childEnvironment, windowsHide: true });
      let raw = ""; child.stdout.on("data", chunk => { raw += String(chunk); }); child.stderr.on("data", chunk => { raw += String(chunk); });
      child.on("error", reject); child.on("close", (code, signal) => resolve({ code, signal, raw }));
    });
    await writeFile(path.join(directory, `batch-${label}.log`), result.raw);
    assert.equal(result.code, 0, `Batch ${label} exited ${result.code}/${result.signal}; preserved ${directory}\n${result.raw}`);
    assert.match(result.raw, /# fail 0\b/); assert.match(result.raw, /# skipped 0\b/);
    const rows = result.raw.split(/\r?\n/).filter(line => line.startsWith('# {"synthetic":true,"id":')).map(line => JSON.parse(line.slice(2)) as { id: string; serverSpanMs: number; status: string });
    assert.equal(rows.length, 10); assert.deepEqual(rows.map(row => Number(row.id.slice(0, 3))), Array.from({ length: 10 }, (_, index) => first + index));
    all.push(...rows);
    t.diagnostic(JSON.stringify({ batch: label, completed: rows.length, rawSha256: createHash("sha256").update(result.raw).digest("hex") }));
  }
  assert.equal(all.length, 100); assert.equal(new Set(all.map(row => row.id)).size, 100);
  const times = all.map(row => row.serverSpanMs).sort((a, b) => a - b);
  const summary = { synthetic: true, scenarios: 100, uniqueScenarios: 100, failedBatches: 0, skippedScenarios: 0,
    serverSpanMs: { p50: times[49], p95: times[94], p99: times[98], max: times[99] },
    statuses: all.reduce<Record<string, number>>((a, row) => ({ ...a, [row.status]: (a[row.status] ?? 0) + 1 }), {}),
    boundary: "Actual SQLite/store/service/actions; fake planner and transport; fixed fixture date; no production/provider/model-quality/publication claim", samples: all };
  await writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  t.diagnostic(JSON.stringify({ ...summary, samples: undefined, evidenceDirectory: directory }));
});
