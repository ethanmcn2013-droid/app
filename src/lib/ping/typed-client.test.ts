import assert from "node:assert/strict";
import test from "node:test";
import { PING_TYPED_ENDPOINT, PING_TYPED_VERSION, type PingTypedRequest } from "./typed-contract";
import {
  clearPingIntentMarker,
  decodePingTypedResponse,
  pingIntentStorageKey,
  readPingIntentMarker,
  sendPingTyped,
  updatePingIntentPhase,
  writePingIntentMarker,
  pingTypedResponseMatches,
  restorePingTypedTasks,
  type PingTypedIntentMarker,
} from "./typed-client";

const request: PingTypedRequest = {
  version: PING_TYPED_VERSION,
  action: "prepare",
  generationId: "generation-1",
  requestId: "b5a38b39-fc3c-40d1-9b2b-93dc79975e0a",
  projectId: "project-1",
  selectedTaskIds: ["task-1"],
  snapshots: {
    "task-1": {
      assignees: ["member-1"], due: null, dueAtSeconds: null, startDay: null,
      durationDays: null, lane: "doing", boardColumnKey: null, completedAtSeconds: null,
    },
  },
  text: "assign me",
};

const marker: PingTypedIntentMarker = {
  version: "ping.typed.intent.v1",
  generationId: "generation-1",
  commandId: "a71d46fd-e42b-4f25-9c64-3a3db8941f15",
  projectId: "project-1",
  token: "opaque-original-handle",
  phase: "prepared",
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, String(value)); },
  } as Storage;
}

test("typed requests are same-origin, non-cached, and omit actor or session authority", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  const result = await sendPingTyped(request, async (input, init) => {
    observedUrl = String(input);
    observedInit = init;
    return Response.json({
      ok: true,
      action: "prepare",
      generationId: "generation-1",
      commandId: "a71d46fd-e42b-4f25-9c64-3a3db8941f15",
      projectId: "project-1",
      token: "opaque-original-handle",
      expiresAt: Date.now() + 60_000,
      proposal: { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } },
    });
  });

  assert.equal(observedUrl, PING_TYPED_ENDPOINT);
  assert.equal(observedInit?.method, "POST");
  assert.equal(observedInit?.credentials, "same-origin");
  assert.equal(observedInit?.cache, "no-store");
  const sent = JSON.parse(String(observedInit?.body)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(sent).sort(), ["action", "generationId", "projectId", "requestId", "selectedTaskIds", "snapshots", "text", "version"]);
  assert.equal("actorId" in sent, false);
  assert.equal("sessionId" in sent, false);
  assert.equal(result.kind, "response");
  if (result.kind !== "response") return;
  assert.equal(result.response.ok, true);
  if (!result.response.ok) return;
  assert.equal(result.response.action, "prepare");
  assert.equal(result.response.generationId, "generation-1");
  assert.equal(result.response.projectId, "project-1");
  assert.equal(result.response.token, "opaque-original-handle");
  assert.equal(pingTypedResponseMatches(result.response, request, "project-1"), true);
  assert.equal(pingTypedResponseMatches(result.response, request, "other-project"), false);
});

test("transport loss and malformed response remain unknown", async () => {
  assert.deepEqual(await sendPingTyped(request, async () => { throw new Error("network down"); }), { kind: "unknown" });
  assert.deepEqual(await sendPingTyped(request, async () => Response.json({ ok: true, action: "execute" })), { kind: "unknown" });
  assert.equal(decodePingTypedResponse({ ok: false, code: "private_server_detail", message: "do not expose" }), null);
});

test("the decoder rejects a receipt whose embedded command or project does not match its envelope", () => {
  const receipt = {
    version: "ping.receipt.v1", commandId: "different-command", projectId: "project-1",
    committedAtSeconds: 1, outcome: "completed", affectedCount: 1, changedCount: 1, effects: [],
  };
  assert.equal(decodePingTypedResponse({
    ok: true, action: "execute", generationId: "generation-1", commandId: marker.commandId,
    projectId: marker.projectId, knowledge: "committed", receipt,
  }), null);
});

test("receipt decoding matches affected, changed, no-op, and placeholder semantics", () => {
  const base = {
    ok: true, action: "execute", generationId: "generation-1", commandId: marker.commandId,
    projectId: marker.projectId, knowledge: "committed",
    receipt: {
      version: "ping.receipt.v1", commandId: marker.commandId, projectId: marker.projectId,
      committedAtSeconds: 1, outcome: "completed", affectedCount: 2, changedCount: 1,
      effects: [
        { taskId: "task-1", changedFields: [] },
        { taskId: "task-2", changedFields: ["due"] },
      ],
    },
  };
  assert.notEqual(decodePingTypedResponse(base), null);
  assert.equal(decodePingTypedResponse({ ...base, receipt: { ...base.receipt, affectedCount: -1 } }), null);
  assert.equal(decodePingTypedResponse({ ...base, receipt: { ...base.receipt, changedCount: 2 } }), null);
  assert.equal(decodePingTypedResponse({ ...base, receipt: { ...base.receipt, effects: [{ ...base.receipt.effects[0], secret: true }, base.receipt.effects[1]] } }), null);
  assert.notEqual(decodePingTypedResponse({
    ...base,
    receipt: {
      ...base.receipt, outcome: "completed", affectedCount: 2, changedCount: 2,
      effects: [
        { taskId: "task-1", changedFields: ["created"], seq: 1 },
        { taskId: "task-2", changedFields: ["created"], seq: 2 },
      ],
    },
  }), null);
});

test("session marker stores only the opaque original handle and is scoped to actor and Project", () => {
  const storage = memoryStorage();
  assert.equal(writePingIntentMarker(storage, "member-1", marker), true);
  const key = pingIntentStorageKey("member-1", "project-1");
  const raw = storage.getItem(key) ?? "";
  assert.equal(raw.includes("assign me"), false);
  assert.equal(raw.includes("dueDate"), false);
  assert.deepEqual(readPingIntentMarker(storage, "member-1", "project-1"), marker);
  assert.equal(readPingIntentMarker(storage, "member-2", "project-1"), null);
  assert.equal(readPingIntentMarker(storage, "member-1", "project-2"), null);
  assert.equal(updatePingIntentPhase(storage, "member-1", marker, "invoking"), true);
  assert.equal(readPingIntentMarker(storage, "member-1", "project-1")?.phase, "invoking");
  clearPingIntentMarker(storage, "member-1", "project-1");
  assert.equal(readPingIntentMarker(storage, "member-1", "project-1"), null);
});

test("invalid persisted intent markers fail closed and storage exceptions are contained", () => {
  const storage = memoryStorage();
  storage.setItem(pingIntentStorageKey("member-1", "project-1"), JSON.stringify({ ...marker, projectId: "project-2" }));
  assert.equal(readPingIntentMarker(storage, "member-1", "project-1"), null);
  const denied = {
    getItem() { throw new Error("storage denied"); },
    setItem() { throw new Error("storage denied"); },
    removeItem() { throw new Error("storage denied"); },
  };
  assert.equal(writePingIntentMarker(denied, "member-1", marker), false);
  assert.equal(readPingIntentMarker(denied, "member-1", "project-1"), null);
  assert.doesNotThrow(() => clearPingIntentMarker(denied, "member-1", "project-1"));
});

test("canonical refresh rows restore Date values and reject another Project", () => {
  const updatedAt = "2026-10-06T12:34:56.000Z";
  const rows = [{
    id: "task-1", workspaceId: "project-1", title: "Review draft", lane: "doing" as const, priority: "p2" as const,
    assignees: ["member-1"], parentTaskId: null, updatedAt, dueAt: "2026-10-08T09:00:00.000Z",
    archivedAt: null, completedAt: null, externalContactName: null, externalContactEmail: null, cents: null,
  }];
  const restored = restorePingTypedTasks(rows, "project-1");
  assert.equal(restored?.[0]?.updatedAt.toISOString(), updatedAt);
  assert.equal(restored?.[0]?.dueAt?.toISOString(), "2026-10-08T09:00:00.000Z");
  assert.equal(restorePingTypedTasks(rows, "project-2"), null);
  assert.equal(restorePingTypedTasks([{ ...rows[0], updatedAt: "not-a-date" }], "project-1"), null);
});
