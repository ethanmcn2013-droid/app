import assert from "node:assert/strict";
import test from "node:test";
import { createAssistantService } from "./service";
import type { AssistantStore } from "./store";
import type { AssistantActionResult } from "@/lib/ping/assistant/contract";

async function visibleDelivery(local: NonNullable<AssistantActionResult["delivery"]>, sidecar: Record<string, { state: string; fence: number }> | null) {
  const request = { requestId: "synthetic-request", text: "Nudge the selected tasks", scope: { kind: "project", projectId: "synthetic-project" }, mode: "execute" };
  const original: AssistantActionResult = { stepId: "synthetic-step", kind: "nudge_tasks", status: "completed", summary: "Synthetic local intent",
    affectedCount: 0, projectId: "synthetic-project", delivery: local };
  const run = { id: "synthetic-run", requestId: request.requestId, requestJson: JSON.stringify(request), resultJson: "{}", planJson: null,
    status: "completed", estimatedMicroUsd: null, createdAt: 0, updatedAt: 0 };
  const store = { expirePlanning: async () => run, getSteps: async () => [{ id: original.stepId, stepKey: "nudge",
    payloadJson: JSON.stringify({ id: "nudge", kind: "nudge_tasks" }), status: "completed", resultJson: JSON.stringify(original),
    deliveryJson: sidecar === null ? null : JSON.stringify(sidecar) }] } as unknown as AssistantStore;
  const unexpected = async (): Promise<never> => { throw new Error("Unexpected inference or effect invocation"); };
  const service = createAssistantService({ store, planner: { plan: unexpected }, context: unexpected, execute: unexpected });
  return (await service.view("synthetic-actor", run.id)).steps[0].result!.delivery;
}

test("muted local nudge remains suppressed with an empty external sidecar", async () => {
  assert.deepEqual(await visibleDelivery({ queued: 0, accepted: 0, unknown: 0, suppressed: 1 }, {}),
    { queued: 0, accepted: 0, unknown: 0, suppressed: 1 });
});

test("fresh sidecar replaces transient counters and adds only immutable local suppressions", async () => {
  assert.deepEqual(await visibleDelivery({ queued: 9, accepted: 7, unknown: 6, suppressed: 2 }, {
    a: { state: "accepted", fence: 1 }, b: { state: "unknown", fence: 1 }, c: { state: "claimed", fence: 1 }, d: { state: "suppressed", fence: 1 },
  }), { queued: 1, accepted: 1, unknown: 1, suppressed: 3 });
});

test("without a sidecar, the original delivery result is preserved", async () => {
  const original = { queued: 1, accepted: 2, unknown: 3, suppressed: 4 };
  assert.deepEqual(await visibleDelivery(original, null), original);
});
