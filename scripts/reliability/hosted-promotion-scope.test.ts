import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { assertProjectId } from "@/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "@/server/conversations/database";
import { createConversationService } from "@/server/conversations/service";
import { createConversationTaskOutcomeService } from "@/server/conversations/work-links";
import { hostedPromotionIdentity, readHostedPromotionScope, type HostedPromotionProofInput } from "./hosted-workload";
import { reconcileRun } from "./contracts/result-reconciliation.mjs";

async function fixture() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys=OFF");
  const migrations = (await readdir("drizzle")).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort();
  for (const migration of migrations) await client.executeMultiple(await readFile(join("drizzle", migration), "utf8"));
  await client.executeMultiple(`INSERT INTO users(id,clerk_id,name,color,initials) VALUES ('alice','clerk_alice','Alice','#111','AA'),('bob','clerk_bob','Bob','#222','BB');
    INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES ('synthetic_project','scope','Scope','alice','project',1,1);
    INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES ('synthetic_project','alice','owner',1),('synthetic_project','bob','member',1);`);
  const projectId = assertProjectId("synthetic_project");
  const adapter = createLocalConversationDatabaseAdapter({ client });
  const conversation = createConversationService(adapter);
  const room = await conversation.ensureProjectConversation({ actorId: "alice", projectId });
  if (!room.ok) assert.fail("fixture conversation failed");
  const message = await conversation.sendMessage({ actorId: "alice", input: { projectId, conversationId: room.value.conversationId,
    expectedAudienceEpoch: room.value.audienceEpoch, clientRequestId: "source_scope_request_0001", body: "Synthetic source", rootId: null, mentionUserIds: [] } });
  if (!message.ok) assert.fail("fixture message failed");
  const input: HostedPromotionProofInput = { actorId: "alice", clientRequestId: "promotion_scope_request_0001", projectId,
    conversationId: room.value.conversationId, messageId: message.value.messageId, expectedRevision: message.value.revision,
    expectedAudienceEpoch: room.value.audienceEpoch, destinationProjectId: projectId, title: "Synthetic measured task", ownerUserId: "bob", dueDate: "2026-10-25" };
  return { client, input, async promote() {
    return createConversationTaskOutcomeService(adapter).promoteMessageToTask({ actorId: input.actorId, input: {
      ...input, sourceProjectId: projectId, destinationProjectId: projectId, dueDate: "2026-10-25" } });
  }, async close() { client.close(); } };
}

function reconcileProof(proof: Awaited<ReturnType<typeof readHostedPromotionScope>>, success: boolean) {
  // 200 physical attempts preserve the original 0.5% allowance: exactly one
  // actual failed attempt may fit, without claiming an acknowledgment.
  const expectedOperations = Array.from({ length: 200 }, (_, index) => ({ id: `op-${index}`, journey: "task.mutate", expectedOutcome: "write", projectId: "synthetic_project" }));
  const observations = expectedOperations.map((expected, index) => ({ logicalOperationId: expected.id, attemptId: `${expected.id}/1`, attemptNumber: 1,
    journey: "task.mutate", phase: "measured", latencyMs: 100,
    response: { statusCode: index === 0 && !success ? 503 : 200, valid: true, success: index === 0 ? success : true, errorEnvelope: index === 0 && !success },
    acknowledged: index === 0 ? success : true,
    ...(index === 0 ? proof : { scopeAuthorized: true, actualProjectIds: ["synthetic_project"], unauthorizedContent: false, effectIds: [`effect-${index}`] }) }));
  return reconcileRun({ manifest: { measuredDurationSeconds: 60, acceptanceTargets: { "task.mutate": 800 } }, expectedOperations, observations });
}

test("valid 200 promotion proves actual receipt/task/link/outbox source scope", async () => {
  const f = await fixture(); try {
    const response = await f.promote(); assert.equal(response.ok, true);
    const proof = await readHostedPromotionScope(f.client, f.input, false);
    assert.equal(proof.scopeAuthorized, true); assert.equal(proof.unauthorizedContent, false);
    assert.deepEqual(proof.effectIds, [hostedPromotionIdentity(f.input).taskId]);
    assert.equal(reconcileProof(proof, true).ok, true);
  } finally { await f.close(); }
});

test("valid 503 with no deterministic effects proves absence and retains one failed unacknowledged attempt", async () => {
  const f = await fixture(); try {
    const proof = await readHostedPromotionScope(f.client, f.input, true);
    assert.deepEqual(proof, { scopeAuthorized: true, actualProjectIds: [], unauthorizedContent: false, effectIds: [] });
    const result = reconcileProof(proof, false);
    assert.equal(result.ok, true, JSON.stringify(result.findings));
    assert.equal(result.failureRate, 0.005); assert.equal(result.counts.acknowledgedOperations, 199);
    assert.equal(result.achievedRequests, 199); assert.equal(result.byJourney["task.mutate"].failures, 1);
    assert.equal((await readHostedPromotionScope(f.client, f.input, false)).scopeAuthorized, false, "absence never proves successful ACK");
  } finally { await f.close(); }
});

test("valid unavailable promotion with actual matching durable commit stays unacknowledged", async () => {
  const f = await fixture(); try {
    await f.promote();
    const proof = await readHostedPromotionScope(f.client, f.input, true);
    const result = reconcileProof(proof, false);
    assert.equal(proof.scopeAuthorized, true); assert.equal(proof.effectIds.length, 1);
    assert.equal(result.ok, true); assert.equal(result.failureRate, 0.005); assert.equal(result.counts.acknowledgedOperations, 199);
  } finally { await f.close(); }
});

test("unavailable promotion cannot hide foreign orphan effects or mismatched durable receipts", async () => {
  for (const scenario of ["foreign-orphan", "mismatched", "partial"] as const) {
    const f = await fixture(); try {
      if (scenario === "foreign-orphan") {
        await f.client.execute({ sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,position,created_at,updated_at) VALUES (?,'foreign-project',1,'Foreign','todo','p2','[]',1,1,1)", args: [hostedPromotionIdentity(f.input).taskId] });
      } else {
        await f.promote();
        if (scenario === "partial") await f.client.execute("DELETE FROM suite_outbox");
      }
      const proof = await readHostedPromotionScope(f.client, scenario === "mismatched" ? { ...f.input, title: "Different requested payload" } : f.input, true);
      assert.equal(proof.scopeAuthorized, false);
      if (scenario !== "partial") assert.equal(proof.unauthorizedContent, true);
      const result = reconcileProof(proof, false);
      assert.equal(result.ok, false);
      assert.ok(result.findings.some((finding: { code: string }) => finding.code === (scenario === "partial" ? "SCOPE_UNVERIFIED" : "FORBIDDEN_SCOPE_EFFECT")));
    } finally { await f.close(); }
  }
});

test("missing or failed source readback stays unverified rather than inventing absence", async () => {
  const f = await fixture(); try {
    for (const client of [{ batch: async () => [{}] }, { batch: async () => { throw new Error("private provider error"); } }]) {
      await assert.rejects(readHostedPromotionScope(client as never, f.input, true));
    }
    const result = reconcileProof({ scopeAuthorized: false, actualProjectIds: [], unauthorizedContent: false, effectIds: [] }, false);
    assert.ok(result.findings.some((finding: { code: string }) => finding.code === "SCOPE_UNVERIFIED"));
  } finally { await f.close(); }
});


test("promotion scope batch uses one actual database snapshot and rejects incomplete batch results", async () => {
  const f = await fixture(); try {
    await f.promote();
    let calls = 0;
    const client = { async batch(statements: Parameters<typeof f.client.batch>[0], mode: Parameters<typeof f.client.batch>[1]) {
      calls++; assert.equal(mode, "read"); assert.equal(statements.length, 4);
      return f.client.batch(statements, mode);
    } };
    const proof = await readHostedPromotionScope(client, f.input, false);
    assert.equal(calls, 1); assert.equal(proof.scopeAuthorized, true);
    for (const rows of [[], [{ rows: [] }], Array.from({ length: 4 }, () => ({}))]) {
      await assert.rejects(readHostedPromotionScope({ batch: async () => rows } as never, f.input, true), /hosted_write_effect_unverified/);
    }
  } finally { await f.close(); }
});
