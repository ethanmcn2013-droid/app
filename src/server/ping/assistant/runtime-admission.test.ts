import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { assistantTarget } from "./controls";
import { guardAssistantCommitStep } from "./runtime-admission";
import type { AssistantExecuteInput } from "./service";
import type { AssistantActionResult } from "@/lib/ping/assistant/contract";

const env = { NODE_ENV: "test", PING_ASSISTANT_ENABLED: "1", CLERK_SECRET_KEY: "synthetic-clerk", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic-public",
  TASKS_DATABASE_URL: "file:synthetic.db", PING_ASSISTANT_TASKS_URL_SHA256: createHash("sha256").update("file:synthetic.db").digest("hex"),
  PING_ASSISTANT_TARGET: "local", PING_ASSISTANT_ACTOR_IDS: "synthetic-actor" };
const result: AssistantActionResult = { stepId: "synthetic-step", kind: "create_tasks", status: "completed", summary: "Synthetic", affectedCount: 1 };
const latch = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

for (const [name, patch] of [
  ["disabled", { PING_ASSISTANT_ENABLED: "0" }],
  ["actor removed", { PING_ASSISTANT_ACTOR_IDS: "other-actor" }],
  ["target changed", { TASKS_DATABASE_URL: "file:other.db", PING_ASSISTANT_TASKS_URL_SHA256: createHash("sha256").update("file:other.db").digest("hex") }],
] as const) {
  test(`configuration ${name} while planner is pending prevents new effects`, async () => {
    const admitted = assistantTarget(env)!; let current = { ...env }, effects = 0;
    const planner = latch();
    const commit: AssistantExecuteInput["commitStep"] = async (_step, _fence, callback) => callback({} as Parameters<Parameters<AssistantExecuteInput["commitStep"]>[2]>[0]);
    const guarded = guardAssistantCommitStep(commit, () => assistantTarget(current)?.cacheKey === admitted.cacheKey);
    const running = (async () => { await planner.promise; return guarded(result.stepId, 1, async () => { effects++; return result; }); })();
    current = { ...current, ...patch }; planner.resolve();
    await assert.rejects(running, /unavailable/); assert.equal(effects, 0);
  });
}

test("configuration is checked after writer queue admission, not before waiting", async () => {
  const admitted = assistantTarget(env)!; let current = { ...env }, effects = 0;
  const queued = latch(), release = latch();
  const commit: AssistantExecuteInput["commitStep"] = async (_step, _fence, callback) => {
    queued.resolve(); await release.promise;
    return callback({} as Parameters<Parameters<AssistantExecuteInput["commitStep"]>[2]>[0]);
  };
  const guarded = guardAssistantCommitStep(commit, () => assistantTarget(current)?.cacheKey === admitted.cacheKey);
  const running = guarded(result.stepId, 1, async () => { effects++; return result; });
  await queued.promise; current = { ...current, PING_ASSISTANT_ENABLED: "0" }; release.resolve();
  await assert.rejects(running, /unavailable/); assert.equal(effects, 0);
});

test("original receipt remains readable without executing callback; restored target admits only new work", async () => {
  const admitted = assistantTarget(env)!; let current = { ...env }, effects = 0;
  const original: AssistantExecuteInput["commitStep"] = async () => result;
  const recovery = guardAssistantCommitStep(original, () => assistantTarget(current)?.cacheKey === admitted.cacheKey);
  current = { ...current, PING_ASSISTANT_ENABLED: "0" };
  assert.deepEqual(await recovery(result.stepId, 1, async () => { effects++; return result; }), result);
  current = { ...env };
  assert.deepEqual(await recovery(result.stepId, 1, async () => { effects++; return result; }), result);
  assert.equal(effects, 0);
});
