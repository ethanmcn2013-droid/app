export const PING_PCM_RATE = 24000 as const;
export const PING_PCM_BLOCK_SAMPLES = 4800 as const;
export const PING_PCM_MAX_SAMPLES = 720000 as const;

export type PingPcmResult =
  | Readonly<{ ok: true; bytes: Uint8Array; samples: number }>
  | Readonly<{ ok: false; reason: "invalid_samples" }>;

/** Native bounded storage only; do not evaluate an unknown object's length/getters. */
export function encodePingPcm(value: unknown): PingPcmResult {
  try {
    if (!value || Object.getPrototypeOf(value) !== Float32Array.prototype) return { ok: false, reason: "invalid_samples" };
    const native = Object.getPrototypeOf(Float32Array.prototype);
    if (Object.getOwnPropertyDescriptor(native, Symbol.toStringTag)!.get!.call(value) !== "Float32Array") return { ok: false, reason: "invalid_samples" };
    const buffer: unknown = Object.getOwnPropertyDescriptor(native, "buffer")!.get!.call(value);
    if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Reflect.ownKeys(buffer).length !== 0) return { ok: false, reason: "invalid_samples" };
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(buffer); // Reject a prototype-spoofed SharedArrayBuffer brand.
    const length = Object.getOwnPropertyDescriptor(native, "length")!.get!.call(value) as number;
    if (length < 1 || length > PING_PCM_BLOCK_SAMPLES || Reflect.ownKeys(value).length !== length) return { ok: false, reason: "invalid_samples" };
    const samples = value as Float32Array;
    for (let i = 0; i < length; i++) if (!Number.isFinite(samples[i])) return { ok: false, reason: "invalid_samples" };
    const bytes = new Uint8Array(length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, Math.trunc(sample * (sample < 0 ? 32768 : 32767)), true);
    }
    return Object.freeze({ ok: true, bytes, samples: length });
  } catch { return { ok: false, reason: "invalid_samples" }; }
}
