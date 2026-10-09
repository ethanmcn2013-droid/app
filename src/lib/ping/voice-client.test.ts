import assert from "node:assert/strict";
import test from "node:test";
import { createPingVoiceFacade, decodePingVoiceResponse, makePingVoiceBegin, sendPingVoice } from "./voice-client";
import { PING_VOICE_VERSION, type PingVoiceIdentity } from "./voice-contract";
import type { PingVoiceCut, PingVoiceFrame } from "./voice-session";

const identity: PingVoiceIdentity & { token: string; connectionEpoch: string } = {
  generationId: "generation-1", commandId: "command-1", projectId: "project-1", token: "opaque-token", connectionEpoch: "epoch-1",
};
const wireIdentity = { generationId: identity.generationId, commandId: identity.commandId, projectId: identity.projectId };

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

test("voice decoder rejects authority fields and inconsistent committed receipts", () => {
  const extra = { ok: false, code: "unavailable", actorId: "not-authority" };
  assert.equal(decodePingVoiceResponse(extra), null);
  const invalidReceipt = { version: "ping.receipt.v1", commandId: "command-1", projectId: "project-1", committedAtSeconds: 1,
    outcome: "completed", affectedCount: 1, changedCount: 1, effects: [] };
  assert.equal(decodePingVoiceResponse({ ok: true, action: "status", generationId: identity.generationId,
    commandId: identity.commandId, projectId: identity.projectId, knowledge: "committed", receipt: invalidReceipt }), null);
});

test("Begin serializes only frozen Project selection witnesses and no browser authority", () => {
  const request = makePingVoiceBegin("project-1", ["task-1"], { "task-1": {
    assignees: [], due: null, dueAtSeconds: null, startDay: null, durationDays: null,
    lane: "todo", boardColumnKey: null, completedAtSeconds: null,
  } }, "request-1");
  assert.deepEqual(Object.keys(request).sort(), ["action", "projectId", "requestId", "selectedTaskIds", "snapshots", "version"]);
  assert.equal(JSON.stringify(request).includes("actorId"), false);
  assert.equal(JSON.stringify(request).includes("sessionId"), false);
  assert.equal(request.version, PING_VOICE_VERSION);
});

test("native frame arriving after Finish drains through ordered ACKs before one exact-byte Finish", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const uploaded: Uint8Array[] = [];
  let completed!: (result: Awaited<ReturnType<typeof sendPingVoice>>) => void;
  const done = new Promise<Awaited<ReturnType<typeof sendPingVoice>>>((resolve) => { completed = resolve; });
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init: init ?? {} });
    if (url.endsWith("/api/ping/audio")) {
      const body = init?.body as ArrayBuffer;
      uploaded.push(new Uint8Array(body.slice(0)));
      const ordinal = Number((init?.headers as Record<string, string>)["x-ping-frame"]);
      return jsonResponse({ ok: true, action: "audio", ...wireIdentity, acceptedThrough: ordinal, totalSamples: ordinal * 4 });
    }
    return jsonResponse({ ok: true, action: "finish", ...wireIdentity, knowledge: "unresolved", detail: "pending" });
  };
  const facade = createPingVoiceFacade({ identity, fetcher, onFinish: completed });
  assert.equal(facade.session.requestFinish(), true);
  const samples = new Float32Array([0, 0.5, -0.5, 1]);
  const frame: PingVoiceFrame = { type: "frame", generationId: identity.generationId, connectionEpoch: identity.connectionEpoch,
    ordinal: 1, sampleRate: 24000, channels: 1, sampleCount: samples.length, samples: samples.buffer };
  facade.session.acceptFrame(frame);
  const cut: PingVoiceCut = { type: "cut", generationId: identity.generationId, connectionEpoch: identity.connectionEpoch, throughFrame: 1, totalSamples: 4 };
  facade.session.acceptCut(cut);
  const finished = await done;
  assert.equal(finished.kind, "response");
  assert.deepEqual(calls.map((call) => call.url), ["/api/ping/audio", "/api/ping"]);
  assert.equal(new DataView(uploaded[0].buffer).getInt16(0, true), 0);
  assert.equal(new DataView(uploaded[0].buffer).getInt16(2, true), 16383);
  assert.equal((calls[0].init.headers as Record<string, string>)["x-ping-frame"], "1");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(JSON.parse(String(calls[1].init.body)).action, "finish");
});

test("lost Finish response is reported unknown and is never retried by the facade", async () => {
  let finishCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    if (String(input).endsWith("/api/ping/audio")) return jsonResponse({ ok: true, action: "audio", ...wireIdentity, acceptedThrough: 1, totalSamples: 2 });
    finishCalls++;
    throw new TypeError("connection lost");
  };
  let complete!: (result: Awaited<ReturnType<typeof sendPingVoice>>) => void;
  const finished = new Promise<Awaited<ReturnType<typeof sendPingVoice>>>((resolve) => { complete = resolve; });
  const facade = createPingVoiceFacade({ identity, fetcher, onFinish: complete });
  facade.session.acceptFrame({ type: "frame", generationId: identity.generationId, connectionEpoch: identity.connectionEpoch,
    ordinal: 1, sampleRate: 24000, channels: 1, sampleCount: 2, samples: new Float32Array([0, 0]).buffer });
  assert.equal(facade.session.requestFinish(), true);
  facade.session.acceptCut({ type: "cut", generationId: identity.generationId, connectionEpoch: identity.connectionEpoch, throughFrame: 1, totalSamples: 2 });
  const outcome = await finished;
  assert.equal(outcome.kind, "unknown");
  assert.equal(finishCalls, 1);
});
