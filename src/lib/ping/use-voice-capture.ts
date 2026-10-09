"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { PING_INPUT_POLICY } from "./input-protocol";
import type { PingProposal } from "./proposal";
import type { PingVoiceCut, PingVoiceFrame, PingVoiceSession, PingVoiceSnapshot, PingWorkletCommand } from "./voice-session";

type CapturePhase = "idle" | "requesting_permission" | "listening" | "finishing" | "awaiting_finals" |
  "interpreting" | "ready" | "closed" | "unavailable";
type NativeCapture = {
  generation: number;
  contextKey: string;
  disposed: boolean;
  sessionDisposed: boolean;
  nativeClosed: boolean;
  session: PingVoiceSession | null;
  stream: MediaStream | null;
  context: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  node: AudioWorkletNode | null;
  gain: GainNode | null;
  timer: ReturnType<typeof setTimeout> | null;
  ackTimer: ReturnType<typeof setTimeout> | null;
  responseTimer: ReturnType<typeof setTimeout> | null;
  interpretationTimer: ReturnType<typeof setTimeout> | null;
  lastCommitCalls: number;
  lastPhase: PingVoiceSnapshot["phase"] | null;
};

export type PingVoiceCaptureOptions = Readonly<{
  contextKey: string;
  createSession: (onSnapshot: (snapshot: PingVoiceSnapshot) => void) => PingVoiceSession;
  workletUrl?: string;
}>;

function displayPhase(snapshotPhase: string): CapturePhase {
  switch (snapshotPhase) {
    case "capturing": return "listening";
    case "finishing": return "finishing";
    case "awaiting_finals": return "awaiting_finals";
    case "interpreting": return "interpreting";
    case "ready": return "ready";
    case "unavailable": return "unavailable";
    default: return "closed";
  }
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* Native teardown is best effort and idempotent. */ }
  }
}

/** Native capture only. The injected session owns protocol, transport and interpretation. */
export function usePingVoiceCapture(options: PingVoiceCaptureOptions) {
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [snapshot, setSnapshot] = useState<PingVoiceSnapshot | null>(null);
  const [proposal, setProposal] = useState<PingProposal | null>(null);
  const current = useRef<NativeCapture | null>(null);
  const generation = useRef(0);
  const contextKeyRef = useRef(options.contextKey);
  const mounted = useRef(false);
  const receiveSnapshotRef = useRef<(capture: NativeCapture, next: PingVoiceSnapshot) => void>(() => undefined);

  const clearTimer = useCallback((capture: NativeCapture) => {
    for (const key of ["timer", "ackTimer", "responseTimer", "interpretationTimer"] as const) {
      if (capture[key] !== null) clearTimeout(capture[key]!);
      capture[key] = null;
    }
  }, []);

  const closeNative = useCallback((capture: NativeCapture, preserveDeadline = false) => {
    if (!preserveDeadline) clearTimer(capture);
    if (capture.nativeClosed) return;
    capture.nativeClosed = true;
    try { capture.node?.port.close(); } catch { /* Already closed. */ }
    try { capture.source?.disconnect(); } catch { /* Already disconnected. */ }
    try { capture.node?.disconnect(); } catch { /* Already disconnected. */ }
    try { capture.gain?.disconnect(); } catch { /* Already disconnected. */ }
    stopStream(capture.stream);
    capture.stream = null;
    const audio = capture.context;
    capture.context = null;
    if (audio && audio.state !== "closed") void audio.close().catch(() => undefined);
    capture.source = null;
    capture.node = null;
    capture.gain = null;
  }, [clearTimer]);

  const dispose = useCallback((capture: NativeCapture, reason: "cancelled" | "context_changed" | "capture_failed", showClosed: boolean) => {
    if (capture.disposed) return;
    capture.disposed = true;
    clearTimer(capture);
    if (!capture.sessionDisposed) {
      capture.sessionDisposed = true;
      try { capture.session?.cancel(reason); } catch { /* Session cancellation is best effort. */ }
      try { capture.session?.dispose(); } catch { /* Session disposal is best effort. */ }
    }
    closeNative(capture);
    if (current.current === capture) current.current = null;
    if (showClosed && mounted.current) {
      setSnapshot(capture.session?.getSnapshot() ?? null);
      setProposal(null);
      setPhase(reason === "capture_failed" ? "unavailable" : "closed");
    }
  }, [clearTimer, closeNative]);

  const receiveSnapshot = useCallback((capture: NativeCapture, next: PingVoiceSnapshot) => {
    if (capture.disposed || current.current !== capture || capture.generation !== generation.current) return;
    const previousPhase = capture.lastPhase;
    capture.lastPhase = next.phase;
    if (next.counters.commitCalls > capture.lastCommitCalls && capture.ackTimer === null) {
      capture.ackTimer = setTimeout(() => {
        capture.ackTimer = null;
        if (capture.disposed || current.current !== capture) return;
        capture.session?.tick();
        const currentSnapshot = capture.session?.getSnapshot();
        if (currentSnapshot) receiveSnapshotRef.current(capture, currentSnapshot);
      }, PING_INPUT_POLICY.ackMs);
    }
    capture.lastCommitCalls = next.counters.commitCalls;
    if (next.phase === "interpreting" && previousPhase !== "interpreting") {
      if (capture.timer !== null) clearTimeout(capture.timer);
      capture.timer = null;
      if (capture.ackTimer !== null) clearTimeout(capture.ackTimer);
      capture.ackTimer = null;
      capture.responseTimer = setTimeout(() => {
        capture.responseTimer = null;
        if (capture.disposed || current.current !== capture) return;
        capture.session?.tick();
        const currentSnapshot = capture.session?.getSnapshot();
        if (currentSnapshot) receiveSnapshotRef.current(capture, currentSnapshot);
      }, PING_INPUT_POLICY.responseMs);
      capture.interpretationTimer = setTimeout(() => {
        capture.interpretationTimer = null;
        if (capture.disposed || current.current !== capture) return;
        capture.session?.tick();
        const currentSnapshot = capture.session?.getSnapshot();
        if (currentSnapshot) receiveSnapshotRef.current(capture, currentSnapshot);
        if (current.current === capture && currentSnapshot?.phase !== "closed") dispose(capture, "capture_failed", true);
      }, PING_INPUT_POLICY.interpretationMs);
    }
    setSnapshot(next);
    const nextPhase = displayPhase(next.phase);
    setPhase(nextPhase);
    if (nextPhase === "ready") setProposal(capture.session?.getProposal() ?? null);
    if (nextPhase === "ready") clearTimer(capture);
    else if (nextPhase === "closed" || nextPhase === "unavailable") {
      setProposal(null);
      closeNative(capture);
    }
  }, [clearTimer, closeNative, dispose]);

  useLayoutEffect(() => {
    receiveSnapshotRef.current = receiveSnapshot;
  });

  const cancel = useCallback(() => {
    const capture = current.current;
    if (capture) dispose(capture, "cancelled", true);
    else {
      setProposal(null);
      setPhase("closed");
    }
  }, [dispose]);

  useLayoutEffect(() => {
    mounted.current = true;
    const previousKey = contextKeyRef.current;
    contextKeyRef.current = options.contextKey;
    if (previousKey !== options.contextKey) {
      const capture = current.current;
      if (capture) dispose(capture, "context_changed", true);
      setProposal(null);
      setSnapshot(null);
      setPhase("idle");
    }
    return () => {
      mounted.current = false;
      const capture = current.current;
      if (capture) dispose(capture, "context_changed", false);
    };
  }, [options.contextKey, dispose]);

  const start = useCallback(async () => {
    const old = current.current;
    if (old && !old.disposed && !old.nativeClosed) return;
    if (old) dispose(old, "cancelled", false);
    const id = ++generation.current;
    const capture: NativeCapture = {
      generation: id, contextKey: options.contextKey, disposed: false, sessionDisposed: false, nativeClosed: false,
      session: null, stream: null, context: null, source: null, node: null, gain: null, timer: null,
      ackTimer: null, responseTimer: null, interpretationTimer: null, lastCommitCalls: 0, lastPhase: null,
    };
    current.current = capture;
    setPhase("requesting_permission");
    setSnapshot(null);
    setProposal(null);

    try {
      capture.session = options.createSession((next) => receiveSnapshot(capture, next));
      const tag = capture.session.getCaptureTag();
      if (!tag || capture.disposed || current.current !== capture) {
        dispose(capture, "capture_failed", true);
        return;
      }
      capture.timer = setTimeout(() => {
        if (capture.disposed || current.current !== capture) return;
        capture.session?.tick();
        const currentSnapshot = capture.session?.getSnapshot();
        if (currentSnapshot) receiveSnapshot(capture, currentSnapshot);
        if (current.current === capture && currentSnapshot?.phase !== "closed") dispose(capture, "capture_failed", true);
      }, PING_INPUT_POLICY.captureMs);
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") {
        dispose(capture, "capture_failed", true);
        return;
      }

      const audio = new AudioContext({ sampleRate: 24000 });
      capture.context = audio;
      const resumePromise = audio.resume();
      const modulePromise = audio.audioWorklet.addModule(options.workletUrl ?? "/ping/pcm-worklet.js");
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: { ideal: 1 }, sampleRate: { ideal: 24000 }, echoCancellation: false,
        noiseSuppression: false, autoGainControl: false,
      }, video: false });
      void streamPromise.then((stream) => {
        if (capture.disposed || current.current !== capture || capture.generation !== generation.current) stopStream(stream);
        else capture.stream = stream;
      }, () => undefined);

      await Promise.all([resumePromise, modulePromise, streamPromise]);
      if (capture.disposed || current.current !== capture || capture.generation !== generation.current) {
        closeNative(capture);
        return;
      }
      const stream = capture.stream;
      if (!stream || audio.sampleRate !== 24000 || audio.state !== "running") throw new Error("unsupported_audio");
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error("unsupported_audio");

      const node = new AudioWorkletNode(audio, "ping-pcm-capture", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1,
        channelCountMode: "explicit", processorOptions: { generationId: tag.generationId, connectionEpoch: tag.connectionEpoch },
      });
      capture.node = node;
      node.port.onmessage = (event: MessageEvent<unknown>) => {
        if (capture.disposed || current.current !== capture || capture.generation !== generation.current) return;
        const value = event.data;
        if (!value || typeof value !== "object") {
          dispose(capture, "capture_failed", true);
          return;
        }
        const message = value as { type?: unknown; generationId?: unknown; connectionEpoch?: unknown };
        if (message.generationId !== tag.generationId || message.connectionEpoch !== tag.connectionEpoch) {
          dispose(capture, "capture_failed", true);
          return;
        }
        if (message.type === "frame") {
          capture.session?.acceptFrame(value as PingVoiceFrame);
        } else if (message.type === "cut") {
          capture.session?.acceptCut(value as PingVoiceCut);
          closeNative(capture, true);
        } else if (message.type === "failure") {
          dispose(capture, "capture_failed", true);
        } else {
          dispose(capture, "capture_failed", true);
        }
      };
      node.port.onmessageerror = () => dispose(capture, "capture_failed", true);
      node.onprocessorerror = () => dispose(capture, "capture_failed", true);
      const source = audio.createMediaStreamSource(stream);
      const gain = audio.createGain();
      gain.gain.value = 0;
      capture.source = source;
      capture.gain = gain;
      source.connect(node);
      node.connect(gain);
      gain.connect(audio.destination);
      const currentSnapshot = capture.session.getSnapshot();
      receiveSnapshot(capture, currentSnapshot);
    } catch {
      if (!capture.disposed && current.current === capture) dispose(capture, "capture_failed", true);
      else closeNative(capture);
    }
  }, [closeNative, dispose, options, receiveSnapshot]);

  const finish = useCallback(() => {
    const capture = current.current;
    if (!capture || capture.disposed || !capture.session || !capture.node) return;
    try {
      if (!capture.session.requestFinish()) return;
      setPhase("finishing");
      clearTimer(capture);
      capture.timer = setTimeout(() => {
        if (capture.disposed || current.current !== capture) return;
        capture.session?.tick();
        const currentSnapshot = capture.session?.getSnapshot();
        if (currentSnapshot) receiveSnapshot(capture, currentSnapshot);
        if (current.current === capture && currentSnapshot?.phase !== "closed") dispose(capture, "capture_failed", true);
      }, PING_INPUT_POLICY.finishMs);
      const tag = capture.session.getCaptureTag();
      if (!tag) {
        dispose(capture, "capture_failed", true);
        return;
      }
      const command: PingWorkletCommand = { type: "cut", generationId: tag.generationId, connectionEpoch: tag.connectionEpoch };
      capture.node.port.postMessage(command);
    } catch {
      dispose(capture, "capture_failed", true);
    }
  }, [clearTimer, dispose, receiveSnapshot]);

  return { phase, snapshot, start, finish, cancel, proposal } as const;
}
