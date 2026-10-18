import assert from "node:assert/strict";
import test from "node:test";
import { createTimelineAssistantPreparation } from "./assistant-preparation";
import type { TasksWorkspaceContextResult } from "./sync/tasks-workspace-context";

const input = { actorClerkId: "clerk-owner", projectId: "project-a" };
const context: TasksWorkspaceContextResult = { kind: "member", context: { workspaceId: "project-a", planningPeriodId: null,
  slug: "project-a", name: "Synthetic current Project", role: "owner", ownerClerkId: "clerk-owner", archivedAt: null } };
const base = {
  session: async () => ({ userId: "clerk-owner", sessionId: "session-a" }), context: async () => context,
  provision: async () => ({ slug: "workspace-a" }),
  timelines: async () => [{ slug: "timeline-a", sourceTasksWorkspaceId: "project-a" }],
  sync: async () => ({ ok: true as const, complete: true }),
};

test("module port re-proves actual actor and canonical owner, binds exactly, syncs then checks access again", async () => {
  const calls: string[] = [];
  const prepare = createTimelineAssistantPreparation({ ...base,
    session: async () => { calls.push("session"); return base.session(); },
    context: async (actor, project) => { calls.push("context"); assert.equal(actor, input.actorClerkId); assert.equal(project, input.projectId); return context; },
    provision: async (actor, project, ownership) => { calls.push("provision"); assert.equal(actor, input.actorClerkId);
      assert.equal(project.workspaceId, input.projectId); assert.equal(ownership.tasksWorkspaceId, input.projectId); return { slug: "workspace-a" }; },
    sync: async (workspace, timeline) => { calls.push("sync"); assert.equal(workspace, "workspace-a"); assert.equal(timeline, "timeline-a"); return { ok: true, complete: true }; },
  });
  assert.deepEqual(await prepare(input), { timelineSlug: "timeline-a" });
  assert.deepEqual(calls, ["session", "context", "provision", "sync", "context"]);
});

test("missing or foreign Clerk actor never reaches canonical context or a writer", async () => {
  for (const session of [{ userId: null, sessionId: "s" }, { userId: "clerk-owner", sessionId: null }, { userId: "foreign", sessionId: "s" }]) {
    let reads = 0, writes = 0;
    await assert.rejects(createTimelineAssistantPreparation({ ...base, session: async () => session,
      context: async () => { reads++; return context; }, provision: async () => { writes++; return null; } })(input), /actor_required/);
    assert.equal(reads, 0); assert.equal(writes, 0);
  }
});

test("unavailable, archived, co-owner and mismatched Tasks Project ownership cannot provision", async () => {
  const bad: TasksWorkspaceContextResult[] = [{ kind: "unavailable", code: "tasks_not_configured" }, { kind: "not-a-member" },
    { kind: "member", context: { ...context.context, archivedAt: 1 } },
    { kind: "member", context: { ...context.context, ownerClerkId: "other-owner" } },
    { kind: "member", context: { ...context.context, workspaceId: "project-b" } }];
  for (const value of bad) {
    let writes = 0;
    await assert.rejects(createTimelineAssistantPreparation({ ...base, context: async () => value,
      provision: async () => { writes++; return null; } })(input), /owner_required/);
    assert.equal(writes, 0);
  }
});

test("foreign or duplicate binding never syncs; incomplete refresh never returns success", async () => {
  for (const rows of [[{ slug: "foreign", sourceTasksWorkspaceId: "project-b" }],
    [{ slug: "one", sourceTasksWorkspaceId: "project-a" }, { slug: "two", sourceTasksWorkspaceId: "project-a" }]]) {
    let syncs = 0;
    await assert.rejects(createTimelineAssistantPreparation({ ...base, timelines: async () => rows,
      sync: async () => { syncs++; return { ok: true, complete: true }; } })(input), /binding_unavailable/);
    assert.equal(syncs, 0);
  }
  await assert.rejects(createTimelineAssistantPreparation({ ...base, sync: async () => ({ ok: true, complete: false }) })(input), /refresh_unavailable/);
});

test("access lost during sync prevents success projection", async () => {
  let reads = 0;
  await assert.rejects(createTimelineAssistantPreparation({ ...base,
    context: async () => ++reads === 1 ? context : { kind: "not-a-member" } })(input), /access_changed/);
});
