import assert from "node:assert/strict";
import test from "node:test";
import { encodePingPcm, PING_PCM_BLOCK_SAMPLES } from "./pcm";

test("actual signed little-endian vectors clamp and truncate, including a partial block", () => {
  const result = encodePingPcm(new Float32Array([0, -1, 1, -0.5, 0.5, -2, 2, 1 / 32767]));
  assert.ok(result.ok);
  assert.equal(result.samples, 8);
  assert.deepEqual([...result.bytes], [0, 0, 0, 128, 255, 127, 0, 192, 255, 63, 0, 128, 255, 127, 0, 0]);
});
test("encoder rejects nonfinite, oversized, empty, exotic and accessor storage without coercion", () => {
  let accessed = 0;
  const getter = { get length() { accessed++; return 1; } };
  class Exotic extends Float32Array {}
  const overridden = new Float32Array([1]);
  Object.defineProperty(overridden, "length", { get() { accessed++; return 1; } });
  const swapped = new Uint8Array([1]); Object.setPrototypeOf(swapped, Float32Array.prototype);
  const shared = new SharedArrayBuffer(4); const sharedView = new Float32Array(shared); Object.setPrototypeOf(shared, ArrayBuffer.prototype);
  for (const value of [getter, overridden, new Exotic([1]), [1], new Float32Array(), new Float32Array(PING_PCM_BLOCK_SAMPLES + 1),
    new Float32Array([NaN]), new Float32Array([Infinity]), new Float32Array([-Infinity]), swapped,
    new Float32Array(new SharedArrayBuffer(4)), sharedView, null]) {
    assert.deepEqual(encodePingPcm(value), { ok: false, reason: "invalid_samples" });
  }
  assert.equal(accessed, 0);
  const max = encodePingPcm(new Float32Array(PING_PCM_BLOCK_SAMPLES)); assert.ok(max.ok);
  assert.equal(max.bytes.byteLength, 9600);
});
