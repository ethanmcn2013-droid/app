import assert from "node:assert/strict";
import test from "node:test";
import { createAssistantTimelinePreparation } from "./timeline";

const target = { actorId: "actor", projectId: "project-a", kind: "preview_timeline" as const, runId: "run_12345678", stepId: "step_12345678" };
const project = { clerkId: "clerk-a", ownerClerkId: "clerk-a", id: "project-a", slug: "project-a", name: "Invented" };
test("explicit preparation binds one exact current timeline, syncs then rechecks access", async () => {
  const calls: string[] = [];
  const prepare = createAssistantTimelinePreparation({ project: async () => { calls.push("authorize"); return project; }, provision: async () => { calls.push("provision"); return { slug: "workspace-a" }; }, timelines: async () => [{ slug: "timeline-a", sourceTasksWorkspaceId: "project-a" }], sync: async () => { calls.push("sync"); return { ok: true, complete: true }; } });
  const result = await prepare(target);
  assert.deepEqual(calls, ["authorize", "provision", "sync", "authorize"]);
  assert.equal(result.href, "/app/timeline/timeline-a/current-preview?workspaceId=project-a");
  assert.match(result.summary, /not been published/);
});
test("foreign binding, incomplete refresh, nonowner and access loss never return preview success", async () => {
  const base = { project: async () => project, provision: async () => ({ slug: "workspace-a" }), timelines: async () => [{ slug: "timeline-a", sourceTasksWorkspaceId: "project-a" }], sync: async () => ({ ok: true as const, complete: true }) };
  for (const patch of [ { timelines: async () => [{ slug: "foreign", sourceTasksWorkspaceId: "project-b" }] }, { sync: async () => ({ ok: true as const, complete: false }) }, { project: async () => ({ ...project, ownerClerkId: "other" }) } ]) await assert.rejects(createAssistantTimelinePreparation({ ...base, ...patch })(target));
  let count = 0;
  await assert.rejects(createAssistantTimelinePreparation({ ...base, project: async () => (++count === 1 ? project : { ...project, ownerClerkId: "other" }) })(target), /access_changed/);
});
