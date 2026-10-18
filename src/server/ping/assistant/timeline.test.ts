import assert from "node:assert/strict";
import test from "node:test";
import { createAssistantTimelinePreparation } from "./timeline";

const target = { actorId: "actor", projectId: "project-a", kind: "preview_timeline" as const, runId: "run_12345678", stepId: "step_12345678" };
const project = { clerkId: "clerk-a", ownerClerkId: "clerk-a", id: "project-a", slug: "project-a", name: "Invented" };
test("explicit preparation binds one exact current timeline, syncs then rechecks access", async () => {
  const calls: string[] = [];
  const prepare = createAssistantTimelinePreparation({ project: async () => { calls.push("authorize"); return project; }, prepare: async input => {
    calls.push("module-prepare"); assert.deepEqual(input, { actorClerkId: "clerk-a", projectId: "project-a" }); return { timelineSlug: "timeline-a" };
  } });
  const result = await prepare(target);
  assert.deepEqual(calls, ["authorize", "module-prepare", "authorize"]);
  assert.equal(result.href, "/app/timeline/timeline-a/current-preview?workspaceId=project-a");
  assert.match(result.summary, /did not publish or change a shared copy/);
});
test("module refusal, nonowner and access loss never return preview success", async () => {
  const base = { project: async () => project, prepare: async () => ({ timelineSlug: "timeline-a" }) };
  for (const patch of [ { prepare: async (): Promise<{ timelineSlug: string }> => { throw new Error("timeline_binding_unavailable"); } }, { project: async () => ({ ...project, ownerClerkId: "other" }) } ]) await assert.rejects(createAssistantTimelinePreparation({ ...base, ...patch })(target));
  let count = 0;
  await assert.rejects(createAssistantTimelinePreparation({ ...base, project: async () => (++count === 1 ? project : { ...project, ownerClerkId: "other" }) })(target), /access_changed/);
});
