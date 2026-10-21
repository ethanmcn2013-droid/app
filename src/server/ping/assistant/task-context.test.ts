import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { createPingProofFixture, PROOF_PROJECT, seedProofTask } from "../proof-fixture";
import { loadAssistantTaskContext, validateAssistantTaskSources } from "./task-context";
import type { AssistantRequest } from "@/lib/ping/assistant/contract";

const projectRequest: AssistantRequest = { requestId: "task_context_project_01", text: "What should I do first?",
  scope: { kind: "project", projectId: PROOF_PROJECT }, mode: "draft" };

test("task context is bounded, authorized, cites current rows and keeps date-only sentinel out of clock time", async () => {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  try {
    await seedProofTask(proof.client, "context-task", { due: "2026-10-24", dueAt: Math.trunc(Date.parse("2026-10-24T09:00:00.000Z") / 1_000) });
    const loaded = await database.transaction(tx => loadAssistantTaskContext(tx, "alice", projectRequest, "Europe/Dublin"), { behavior: "immediate" });
    assert.equal(loaded.tasks.length, 1);
    assert.deepEqual(loaded.tasks[0], { title: "Synthetic context-task", projectName: PROOF_PROJECT, assignees: ["bob"],
      dueDate: "2026-10-24", dueTime: null, status: "todo", parentTitle: null });
    assert.equal(loaded.sources.length, 1);
    assert.equal(loaded.sources[0].kind, "task");
    assert.equal(loaded.sources[0].href, `/app/tasks?task=context-task&workspaceId=${PROOF_PROJECT}`);
    assert.match(loaded.coverage, /1 tasks across the selected Project/);
    assert.equal(await database.transaction(tx => validateAssistantTaskSources(tx, "alice", loaded.sources, "Europe/Dublin"), { behavior: "immediate" }), true);

    await database.update(schema.tasks).set({ title: "Changed task" }).where(eq(schema.tasks.id, "context-task"));
    assert.equal(await database.transaction(tx => validateAssistantTaskSources(tx, "alice", loaded.sources, "Europe/Dublin"), { behavior: "immediate" }), false);
    assert.equal(await database.transaction(tx => validateAssistantTaskSources(tx, "outsider", loaded.sources, "Europe/Dublin"), { behavior: "immediate" }), false);
  } finally { proof.client.close(); }
});

test("project-scoped context fails closed for a project outside the actor membership", async () => {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  try {
    const request: AssistantRequest = { ...projectRequest, requestId: "task_context_foreign_01",
      scope: { kind: "project", projectId: "synthetic-foreign-project" } };
    await assert.rejects(database.transaction(tx => loadAssistantTaskContext(tx, "alice", request, "UTC"), { behavior: "immediate" }));
  } finally { proof.client.close(); }
});

test('a former assignee is described as unavailable, never unassigned',async()=>{
 const proof=await createPingProofFixture();const database=drizzle(proof.client,{schema});try{
  await seedProofTask(proof.client,'former-owner',{assignees:['former-member']});
  const loaded=await database.transaction(tx=>loadAssistantTaskContext(tx,'alice',projectRequest,'UTC'),{behavior:'immediate'});
  assert.deepEqual(loaded.tasks[0].assignees,['Assigned person unavailable']);
  assert.match(loaded.sources[0].body,/Assigned to: Assigned person unavailable/);assert.doesNotMatch(loaded.sources[0].body,/No one/);
  assert.equal(await database.transaction(tx=>validateAssistantTaskSources(tx,'alice',loaded.sources,'UTC'),{behavior:'immediate'}),true);
 }finally{proof.client.close();}
});
