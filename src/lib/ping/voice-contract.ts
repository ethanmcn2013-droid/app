import type { PingTypedErrorCode, PingTypedReceipt, PingTypedSnapshot } from "./typed-contract";
import type { PingVoiceModelInput, PingVoiceSnapshot, PingVoiceTransport } from "./voice-session";

/** Isolated server capture custody; no browser/provider actor, capture or finality authority. */
export const PING_VOICE_VERSION = "ping.voice.v1" as const;
export const PING_VOICE_ENDPOINT = "/api/ping" as const;
export const PING_VOICE_AUDIO_ENDPOINT = "/api/ping/audio" as const;
export const PING_VOICE_MAX_FRAME_BYTES = 9600;
export const PING_VOICE_MAX_FRAMES = 151;
export type PingVoiceIdentity = Readonly<{ generationId: string; commandId: string; projectId: string }>;
export type PingVoiceBegin = Readonly<{
  version: typeof PING_VOICE_VERSION; action: "begin"; requestId: string; projectId: string;
  selectedTaskIds: readonly string[]; snapshots: Readonly<Record<string, PingTypedSnapshot>>;
}>;
export type PingVoiceFinish = Readonly<{
  version: typeof PING_VOICE_VERSION; action: "finish"; generationId: string; token: string;
  throughFrame: number; totalSamples: number;
}>;
export type PingVoiceTokenRequest = Readonly<{
  version: typeof PING_VOICE_VERSION; action: "status" | "cancel"; generationId: string; token: string;
}>;
export type PingVoiceRequest = PingVoiceBegin | PingVoiceFinish | PingVoiceTokenRequest;
/** Binary body is separate; headers carry only this exact envelope. */
export type PingVoiceAudioEnvelope = Readonly<{
  version: typeof PING_VOICE_VERSION; generationId: string; token: string; ordinal: number;
}>;
export type PingVoiceResponse =
  | Readonly<{ ok: false; code: PingTypedErrorCode }>
  | (PingVoiceIdentity & Readonly<{ ok: true; action: "begin"; token: string;
      connectionEpoch: string; captureExpiresAt: number }>)
  | (PingVoiceIdentity & Readonly<{ ok: true; action: "audio"; acceptedThrough: number; totalSamples: number }>)
  | (PingVoiceIdentity & Readonly<{ ok: true; action: "finish" | "status"; state: "pending"; snapshot: PingVoiceSnapshot }>)
  | (PingVoiceIdentity & Readonly<{ ok: true; action: "finish" | "status" | "cancel";
      knowledge: "committed"; receipt: PingTypedReceipt }>)
  | (PingVoiceIdentity & Readonly<{ ok: true; action: "finish" | "status" | "cancel";
      knowledge: "unresolved"; detail: "pending" | "absent" | "failed" }>)
  | (PingVoiceIdentity & Readonly<{ ok: true; action: "finish" | "status" | "cancel";
      knowledge: "not_invoked"; code?: PingTypedErrorCode }>);

/** Constructor injection only. Genuine runtime has no default/scripted provider. */
export type PingVoiceProviders = Readonly<{
  createTransport: (tag: Readonly<{ generationId: string; connectionEpoch: string }>) => PingVoiceTransport;
  interpret: (input: PingVoiceModelInput, signal: AbortSignal) => Promise<unknown>;
}>;

// Client host awaits Begin BEFORE starting the native hook. Its synchronous factory returns
// an HTTP facade holding only returned tags/token: Float32 -> PCM once -> ordered bounded
// binary upload. Finish follows actual cut + upload ACKs. No client input runner/model/ACK/
// final/seal/proposal. Pending/error after Finish never proves zero; only terminal server
// not_invoked does. Committed original uses existing typed token receipt/refresh and Date
// decoder. No second Apply gate for supported low-risk voice; typed flow stays unchanged.
