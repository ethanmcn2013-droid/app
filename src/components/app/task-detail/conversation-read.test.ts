import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConversationResult } from "@/lib/conversations/contracts";
import type { TaskConversationSurface } from "@/server/conversations/task-history-loader";
import { readTaskConversationWithSoftDeadline, type ConversationReadEvent } from "./conversation-read";

function deferred() {
  let resolve!: (value: ConversationResult<TaskConversationSurface>) => void;
  const promise = new Promise<ConversationResult<TaskConversationSurface>>((accept) => { resolve = accept; });
  return { promise, resolve };
}

const history = (taskId: string): TaskConversationSurface => ({
  mode: "existing_history",
  history: { taskId, projectId: "project-a", comments: [], activities: [] },
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("slow Task conversation read still renders its eventual authorized success", async () => {
  const pending = deferred();
  const events: ConversationReadEvent[] = [];
  const read = readTaskConversationWithSoftDeadline({
    taskId: "task-a", load: () => pending.promise, isCurrent: () => true,
    onEvent: (event) => events.push(event), slowAfterMs: 5,
  });
  await wait(20);
  assert.deepEqual(events, [{ kind: "slow" }]);
  pending.resolve({ ok: true, value: history("task-a") });
  await read;
  assert.deepEqual(events, [{ kind: "slow" }, { kind: "success", surface: history("task-a") }]);
});

test("retry supersedes a slow read and ignores its late success", async () => {
  const first = deferred(), second = deferred();
  const events: ConversationReadEvent[] = [];
  let generation = 1;
  const oldRead = readTaskConversationWithSoftDeadline({
    taskId: "task-a", load: () => first.promise, isCurrent: () => generation === 1,
    onEvent: (event) => events.push(event), slowAfterMs: 5,
  });
  await wait(20);
  assert.deepEqual(events, [{ kind: "slow" }]);
  generation = 2;
  const retry = readTaskConversationWithSoftDeadline({
    taskId: "task-a", load: () => second.promise, isCurrent: () => generation === 2,
    onEvent: (event) => events.push(event), slowAfterMs: 100,
  });
  first.resolve({ ok: true, value: history("task-a") });
  await oldRead;
  assert.equal(events.length, 1);
  second.resolve({ ok: true, value: history("task-a") });
  await retry;
  assert.deepEqual(events.map((event) => event.kind), ["slow", "success"]);
});

test("switching Task scope rejects the former Task's late result", async () => {
  const first = deferred(), second = deferred();
  const events: ConversationReadEvent[] = [];
  let activeTask = "task-a";
  const oldRead = readTaskConversationWithSoftDeadline({
    taskId: "task-a", load: () => first.promise, isCurrent: () => activeTask === "task-a",
    onEvent: (event) => events.push(event), slowAfterMs: 100,
  });
  activeTask = "task-b";
  const newRead = readTaskConversationWithSoftDeadline({
    taskId: "task-b", load: () => second.promise, isCurrent: () => activeTask === "task-b",
    onEvent: (event) => events.push(event), slowAfterMs: 100,
  });
  first.resolve({ ok: true, value: history("task-a") });
  second.resolve({ ok: true, value: history("task-b") });
  await Promise.all([oldRead, newRead]);
  assert.deepEqual(events, [{ kind: "success", surface: history("task-b") }]);
});

test("a denial arriving after the slow cue never renders prior content", async () => {
  const pending = deferred();
  const events: ConversationReadEvent[] = [];
  const read = readTaskConversationWithSoftDeadline({
    taskId: "task-a", load: () => pending.promise, isCurrent: () => true,
    onEvent: (event) => events.push(event), slowAfterMs: 5,
  });
  await wait(20);
  pending.resolve({ ok: false, code: "unavailable" });
  await read;
  assert.deepEqual(events, [{ kind: "slow" }, { kind: "failure", code: "unavailable" }]);
});
