import "../../test/register-server-only.mjs";

import assert from "node:assert/strict";
import test from "node:test";
import { resolveConversationControls } from "@/lib/conversations/flags";
import type { TaskDiscussionSnapshot } from "@/lib/conversations/task-discussion-contracts";
import { createTaskConversationLoader } from "./task-history-loader";

const snapshot: TaskDiscussionSnapshot = {
  taskId: "task_a", projectId: "project_a", projectName: "A", lifecycle: "active",
  audienceEpoch: 2, throughChangeSeq: 4, members: [], comments: [], hasOlder: false,
  beforeCreateSeq: null,
};
const history = { taskId: "task_a", projectId: "project_a", comments: [], activities: [] } as const;

test("default controls explicitly select authenticated existing history", async () => {
  let canonicalCalls = 0;
  const load = createTaskConversationLoader({
    controls: () => resolveConversationControls({}),
    authenticateClerk: async () => "clerk_alice",
    openDiscussion: async () => { canonicalCalls++; return { ok: true, value: snapshot }; },
    readExistingHistory: async (clerkId, taskId) => {
      assert.equal(clerkId, "clerk_alice");
      assert.equal(taskId, "task_a");
      return history;
    },
  });

  assert.deepEqual(await load("task_a"), {
    ok: true, value: { mode: "existing_history", history },
  });
  assert.equal(canonicalCalls, 0);
});

test("sends-off keeps canonical read mode when the experiment is available", async () => {
  const controls = resolveConversationControls({
    SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true",
  });
  assert.equal(controls.sendsEnabled, false);
  let compatibilityCalls = 0;
  const load = createTaskConversationLoader({
    controls: () => controls,
    authenticateClerk: async () => "clerk_alice",
    openDiscussion: async () => ({ ok: true, value: snapshot }),
    readExistingHistory: async () => { compatibilityCalls++; return history; },
  });

  assert.deepEqual(await load("task_a"), {
    ok: true, value: { mode: "discussion", discussion: snapshot },
  });
  assert.equal(compatibilityCalls, 0);
});

test("canonical authorization refusal never falls through to existing history", async () => {
  let compatibilityCalls = 0;
  const load = createTaskConversationLoader({
    controls: () => resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true" }),
    authenticateClerk: async () => "clerk_alice",
    openDiscussion: async () => ({ ok: false, code: "unavailable" }),
    readExistingHistory: async () => { compatibilityCalls++; return history; },
  });

  assert.deepEqual(await load("task_a"), { ok: false, code: "unavailable" });
  assert.equal(compatibilityCalls, 0);
});

test("missing authenticated identity fails closed without calling either reader", async () => {
  let calls = 0;
  const load = createTaskConversationLoader({
    controls: () => resolveConversationControls({}),
    authenticateClerk: async () => null,
    openDiscussion: async () => { calls++; return { ok: true, value: snapshot }; },
    readExistingHistory: async () => { calls++; return history; },
  });

  assert.deepEqual(await load("task_a"), { ok: false, code: "unauthenticated" });
  assert.equal(calls, 0);
});
