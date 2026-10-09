import assert from "node:assert/strict";
import test from "node:test";
import { decodePingTranscriptionMessage as decode, encodePingAudioCommit, encodePingPcmAppend } from "./realtime-transcription";

test("append payload contains the literal measured bytes and commit is not a model response request", () => {
  assert.deepEqual(encodePingPcmAppend(new Uint8Array([0, 128, 255, 127])), { ok: true, decodedBytes: 4,
    text: '{"type":"input_audio_buffer.append","audio":"AID/fw=="}' });
  assert.equal(encodePingAudioCommit(), '{"type":"input_audio_buffer.commit"}');
  const swapped = new Float32Array([0.5, -1]); Object.setPrototypeOf(swapped, Uint8Array.prototype);
  const shared = new SharedArrayBuffer(2); const sharedView = new Uint8Array(shared); Object.setPrototypeOf(shared, ArrayBuffer.prototype);
  for (const value of [new Uint8Array(), new Uint8Array(3), new Uint8Array(9602), [0, 0], swapped, new Uint8Array(new SharedArrayBuffer(2)), sharedView])
    assert.deepEqual(encodePingPcmAppend(value), { ok: false, reason: "invalid_pcm" });
});
test("wire projection preserves item identity, optional initial predecessor and complete text only", () => {
  assert.deepEqual(decode('{"type":"input_audio_buffer.committed","event_id":"server-event","item_id":"item-one"}'),
    { kind: "ack", itemId: "item-one", previousItemId: null });
  assert.deepEqual(decode('{"type":"conversation.item.input_audio_transcription.completed","item_id":"item-one","content_index":0,"transcript":"assign me","languages":[{"code":"en"}]}'),
    { kind: "final", itemId: "item-one", contentIndex: 0, text: "assign me" });
  assert.deepEqual(decode('{"type":"conversation.item.input_audio_transcription.delta","item_id":"item-one","content_index":0,"delta":"assign"}'), { kind: "preview" });
});
test("malformed, authority extras, wrong content, oversized and provider errors fail closed without echo", () => {
  for (const value of [null, {}, "{", " ".repeat(65537),
    '{"type":"input_audio_buffer.committed","item_id":"item-one","actorId":"bad"}',
    '{"type":"input_audio_buffer.committed","item_id":"item-one","previous_item_id":3}',
    '{"type":"conversation.item.input_audio_transcription.completed","item_id":"item-one","content_index":1,"transcript":"assign me"}',
    JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", item_id: "item-one", content_index: 0, transcript: "a".repeat(4001) })])
    assert.deepEqual(decode(value), { kind: "failure", reason: "invalid_message" });
  assert.deepEqual(decode('{"type":"error","error":{"message":"private prompt"}}'), { kind: "failure", reason: "provider_error" });
  assert.deepEqual(decode('{"type":"session.created"}'), { kind: "failure", reason: "unexpected_message" });
});
