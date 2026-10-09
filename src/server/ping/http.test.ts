import assert from "node:assert/strict";
import test from "node:test";
import { createPingTypedHttp, createPingAudioHttp } from "./http";
import { createPingTypedSession } from "./typed-session";
import { createPingProofFixture, PROOF_PROJECT } from "./proof-fixture";
import { PING_TYPED_VERSION } from "@/lib/ping/typed-contract";
import { PING_VOICE_VERSION } from "@/lib/ping/voice-contract";

const url = "https://isolated.invalid/api/ping";
function request(body: unknown, origin = "https://isolated.invalid", extra: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin, ...extra }, body: JSON.stringify(body) });
}
test("missing auth, cross-origin and malformed bodies fail before session construction", async () => {
  let construction = 0;
  const unauthenticated = createPingTypedHttp({ authenticate: async () => null, session: async () => { construction++; return null; } });
  assert.equal((await unauthenticated(request({}))).status, 401);
  const authed = createPingTypedHttp({ authenticate: async () => ({ actorId: "alice", sessionId: "synthetic-session" }),
    session: async () => { construction++; return null; } });
  assert.equal((await authed(request({}, "https://foreign.invalid"))).status, 404);
  assert.equal((await authed(request({}, "https://isolated.invalid", { "content-length": "48001" }))).status, 400);
  assert.equal((await authed(request({}, "https://isolated.invalid", { "sec-fetch-site": "cross-site" }))).status, 404);
  assert.equal(construction, 0);
});
test("actual isolated handler carries one server-captured command through execution and canonical JSON refresh", async () => {
  const fixture = await createPingProofFixture();
  try {
    const session = createPingTypedSession(fixture.adapter);
    const handle = createPingTypedHttp({ authenticate: async () => ({ actorId: "alice", sessionId: "synthetic-session" }),
      session: async () => session });
    const body = { version: PING_TYPED_VERSION, action: "prepare", generationId: "one", requestId: "00000000-0000-4000-8000-000000000001",
      projectId: PROOF_PROJECT, selectedTaskIds: [], snapshots: {}, text: "create 1 tasks" };
    const forged = await handle(request({ ...body, actorId: "owner" })); assert.equal(forged.status, 400);
    const prepared = await handle(request(body)); assert.equal(prepared.status, 200);
    const plan = await prepared.json(); assert.equal(plan.action, "prepare"); assert.equal(typeof plan.token, "string");
    assert.equal(Object.hasOwn(plan, "actorId"), false); assert.equal(Object.hasOwn(plan, "text"), false);
    const execute = await handle(request({ version: PING_TYPED_VERSION, action: "execute", generationId: "one", token: plan.token }));
    const outcome = await execute.json(); assert.equal(outcome.knowledge, "committed");
    const refresh = await handle(request({ version: PING_TYPED_VERSION, action: "refresh", generationId: "one", token: plan.token }));
    const current = await refresh.json(); assert.equal(current.projection, "matches"); assert.equal(current.tasks.length, 1);
    assert.equal(current.tasks[0].title, "Untitled task"); assert.equal(typeof current.tasks[0].updatedAt, "string");
    assert.match(refresh.headers.get("cache-control")!, /no-store/);
    assert.equal(Number((await fixture.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
  } finally { fixture.client.close(); }
});

test("actual voice control and bounded binary handlers carry Start, exact bytes, Finish and one real receipt", async () => {
  const f = await createPingProofFixture();
  try {
    const sent: string[] = []; let listener: (raw: unknown) => void = () => {};
    const session = createPingTypedSession(f.adapter, { voice: { createTransport: tag => {
      assert.deepEqual(Object.keys(tag).sort(), ["connectionEpoch", "generationId"]);
      return { subscribe: fn => { listener = fn; return () => {}; }, close: () => {}, queuedBytes: () => 0,
        send: text => { sent.push(text); if (JSON.parse(text).type === "input_audio_buffer.commit") {
          listener(JSON.stringify({ type: "input_audio_buffer.committed", item_id: "one", previous_item_id: null }));
          listener(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", item_id: "one", content_index: 0, transcript: "create one task" }));
        } } };
    }, interpret: async () => ({ version: "ping.proposal.v1", outcome: "plan", operation: {
      kind: "create_placeholders", count: 1, title: "Untitled task", effects: {} } }) } });
    let auths = 0; const deps = { authenticate: async () => { auths++; return { actorId: "alice", sessionId: "session" }; }, session: async () => session };
    const control = createPingTypedHttp(deps), audio = createPingAudioHttp(deps);
    const handle = await (await control(request({ version: PING_VOICE_VERSION, action: "begin", requestId: "00000000-0000-4000-8000-000000000009",
      projectId: PROOF_PROJECT, selectedTaskIds: [], snapshots: {} }))).json();
    assert.equal(handle.action, "begin");
    const binary = (bytes: Uint8Array, extra: Record<string, string> = {}) => new Request(`${url}/audio`, { method: "POST",
      headers: { origin: "https://isolated.invalid", "content-type": "application/octet-stream", "x-ping-version": PING_VOICE_VERSION,
        "x-ping-generation": handle.generationId, "x-ping-token": handle.token, "x-ping-frame": "1", ...extra }, body: new Uint8Array(bytes).buffer });
    assert.equal((await audio(binary(new Uint8Array(9602)))).status, 400);
    assert.equal((await audio(binary(new Uint8Array([0, 0]), { "content-encoding": "gzip" }))).status, 400);
    assert.equal((await audio(binary(new Uint8Array([0, 128, 255, 63])))).status, 200);
    assert.equal((await audio(binary(new Uint8Array([0, 128, 255, 63])))).status, 200);
    const finished = await (await control(request({ version: PING_VOICE_VERSION, action: "finish", generationId: handle.generationId,
      token: handle.token, throughFrame: 1, totalSamples: 2 }))).json();
    assert.equal(finished.knowledge, "committed"); assert.equal(finished.commandId, handle.commandId);
    assert.equal(sent.length, 2); assert.deepEqual(JSON.parse(sent[0]), { type: "input_audio_buffer.append", audio: "AID/Pw==" });
    assert.ok(auths >= 8); assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 1);
    assert.equal((await f.client.execute("SELECT title FROM tasks")).rows[0].title, "Untitled task");
    const next = await (await control(request({ version: PING_VOICE_VERSION, action: "begin", requestId: "00000000-0000-4000-8000-000000000010",
      projectId: PROOF_PROJECT, selectedTaskIds: [], snapshots: {} }))).json();
    let readStarted!: () => void, cancelled = 0;
    const reading = new Promise<void>(resolve => { readStarted = resolve; });
    const stream = new ReadableStream<Uint8Array>({ pull: () => { readStarted(); }, cancel: () => { cancelled++; } }, { highWaterMark: 0 });
    const uploading = audio(new Request(`${url}/audio`, { method: "POST", duplex: "half", body: stream,
      headers: { origin: "https://isolated.invalid", "content-type": "application/octet-stream", "x-ping-version": PING_VOICE_VERSION,
        "x-ping-generation": next.generationId, "x-ping-token": next.token, "x-ping-frame": "1" } } as RequestInit));
    await reading;
    const cancellation = await (await control(request({ version: PING_VOICE_VERSION, action: "cancel", generationId: next.generationId, token: next.token }))).json();
    assert.equal(cancellation.knowledge, "not_invoked"); assert.equal((await uploading).status, 409);
    assert.equal(cancelled, 1); assert.equal(sent.length, 2, "cancelled pending reader cannot append bytes");
  } finally { f.client.close(); }
});
