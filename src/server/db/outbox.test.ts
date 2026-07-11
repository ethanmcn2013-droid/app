import assert from "node:assert/strict";
import test from "node:test";
import { createOutboxEvent } from "./outbox-contract";

test("outbox envelope is versioned, workspace-scoped, and traceable", () => {
  const event = createOutboxEvent({
    type: "task.milestone.updated",
    workspaceId: "ws_1",
    payload: { taskId: "task_1" },
    eventId: "evt_1",
    traceId: "trace_1",
    occurredAt: 1_000,
  });
  assert.equal(event.eventId, "evt_1");
  assert.equal(event.workspaceId, "ws_1");
  assert.equal(event.traceId, "trace_1");
});

test("outbox rejects unscoped events", () => {
  assert.throws(() => createOutboxEvent({ type: "task.updated", payload: {} }));
});
