import type { PingInputEffect } from "./input-protocol";
import type { PingProposal } from "./proposal";

export type PingVoiceFrame = Readonly<{
  type: "frame"; generationId: string; connectionEpoch: string;
  ordinal: number; sampleRate: 24000; channels: 1;
  sampleCount: number; samples: ArrayBuffer;
}>;
export type PingVoiceCut = Readonly<{
  type: "cut"; generationId: string; connectionEpoch: string;
  throughFrame: number; totalSamples: number;
}>;
export type PingWorkletCommand = Readonly<{
  type: "cut"; generationId: string; connectionEpoch: string;
}>;
export type PingVoiceModelInput = Extract<PingInputEffect, { kind: "interpret_once" }>["modelInput"];
export type PingVoiceTransport = Readonly<{
  send: (text: string) => void;
  subscribe: (listener: (raw: unknown) => void, disconnected: () => void) => () => void;
  queuedBytes: () => number;
  close: () => void;
}>;
export type PingVoiceSnapshot = Readonly<{
  phase: "unavailable" | "capturing" | "finishing" | "awaiting_finals" | "interpreting" | "ready" | "closed";
  reason: string | null;
  throughFrame: number; totalSamples: number; encodedBytes: number;
  counters: Readonly<{
    appendCalls: number; appendAccepted: number; appendedBytes: number;
    commitCalls: number; commitAccepted: number; interpretationCalls: number;
    interpretationDescriptors: number;
  }>;
}>;
export type PingVoiceSession = Readonly<{
  acceptFrame: (value: unknown) => void;
  requestFinish: () => boolean;
  acceptCut: (value: unknown) => void;
  cancel: (reason?: "cancelled" | "context_changed" | "capture_failed") => void;
  tick: () => void;
  dispose: () => void;
  getSnapshot: () => PingVoiceSnapshot;
  getCaptureTag: () => Readonly<{ generationId: string; connectionEpoch: string }> | null;
  getProposal: () => PingProposal | null;
}>;
export type PingVoiceOptions = Readonly<{
  capture: unknown;
  transport: PingVoiceTransport | null;
  now: () => number;
  isContextCurrent: () => boolean;
  interpret: (input: PingVoiceModelInput, signal: AbortSignal) => Promise<unknown>;
  onSnapshot?: (snapshot: PingVoiceSnapshot) => void;
}>;
