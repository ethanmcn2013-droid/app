export const PING_PCM_RATE = 24000 as const;
export const PING_PCM_BLOCK_SAMPLES = 4800 as const;
export const PING_PCM_MAX_SAMPLES = 720000 as const;

export type PingPcmResult =
  | Readonly<{ ok: true; bytes: Uint8Array; samples: number }>
  | Readonly<{ ok: false; reason: "invalid_samples" }>;
