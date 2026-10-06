import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePingVoiceCapture } from "@/lib/ping/use-voice-capture";
import { createPingVoiceSession, type PingVoiceSession, type PingVoiceSnapshot } from "@/lib/ping/voice-session";

// Observation and explicitly scripted provider boundaries belong only to this
// fixture. The native microphone, AudioContext and worklet remain real.
const streams: MediaStream[] = [], contexts: AudioContext[] = [];
const sends: { type: string; bytes: Uint8Array }[] = [];
const modelCalls: { keys: string[]; transcript: string }[] = [];
let permission: "normal" | "delayed" | "denied" = "normal";
let grant: (() => void) | null = null, gumCalls = 0;
let listener: ((raw: unknown) => void) | null = null;
let session: PingVoiceSession | null = null;
let snapshot: PingVoiceSnapshot | null = null;
let liveContext = "synthetic-context";
const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = async constraints => {
  gumCalls++;
  if (permission === "denied") throw new DOMException("Synthetic permission denial", "NotAllowedError");
  const stream = await nativeGetUserMedia(constraints);
  streams.push(stream);
  if (permission === "delayed") await new Promise<void>(resolve => { grant = resolve; });
  return stream;
};
const NativeAudioContext = window.AudioContext;
window.AudioContext = class extends NativeAudioContext {
  constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
};

function makeSession(onSnapshot: (next: PingVoiceSnapshot) => void): PingVoiceSession {
  const contextKey = liveContext;
  const capture = {
    generationId: crypto.randomUUID(), connectionEpoch: crypto.randomUUID(), contextKey,
    sessionId: "synthetic-session", actorId: "synthetic-actor", inputItemId: crypto.randomUUID(),
    commandId: crypto.randomUUID(), projectId: "synthetic-project", selectedTaskIds: ["synthetic-task"],
    referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", expectedColumnConfig: null,
    snapshots: { "synthetic-task": { assignees: ["synthetic-other"], due: null, dueAtSeconds: null,
      startDay: 20000, durationDays: 2, lane: "todo", boardColumnKey: null, completedAtSeconds: null } },
  };
  session = createPingVoiceSession({
    capture, now: () => Math.floor(performance.now()), isContextCurrent: () => liveContext === contextKey,
    transport: {
      send(text) {
        const message = JSON.parse(text) as { type: string; audio?: string };
        const bytes = message.audio ? Uint8Array.from(atob(message.audio), character => character.charCodeAt(0)) : new Uint8Array();
        sends.push({ type: message.type, bytes });
      },
      subscribe(receive) { listener = receive; return () => { if (listener === receive) listener = null; }; },
      queuedBytes: () => 0, close() {},
    },
    interpret: async input => {
      modelCalls.push({ keys: Object.keys(input).sort(), transcript: input.transcript });
      return { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } };
    },
    onSnapshot(next) { snapshot = next; onSnapshot(next); },
  });
  return session;
}

type FixtureApi = {
  permission: (mode: typeof permission) => void;
  releasePermission: () => void;
  emit: (value: unknown) => void;
  changeContext: () => void;
  unmount: () => void;
  report: () => {
    gumCalls: number; awaitingPermission: boolean; snapshot: PingVoiceSnapshot | null;
    messages: { type: string; byteLength: number; nonzero: boolean }[];
    modelCalls: typeof modelCalls; tracks: string[]; contexts: { rate: number; state: string }[];
    proposal: unknown;
  };
};
declare global { interface Window { voiceFixture: FixtureApi } }
const root = createRoot(document.getElementById("root")!);
function Fixture() {
  const [contextKey, setContextKey] = useState(liveContext);
  const createSession = useCallback((onSnapshot: (next: PingVoiceSnapshot) => void) => makeSession(onSnapshot), []);
  const voice = usePingVoiceCapture({ contextKey, createSession });
  useEffect(() => { window.voiceFixture = {
    permission: mode => { permission = mode; }, releasePermission: () => { const resolve = grant; grant = null; resolve?.(); },
    emit: value => listener?.(JSON.stringify(value)),
    changeContext: () => { liveContext = crypto.randomUUID(); setContextKey(liveContext); },
    unmount: () => root.unmount(),
    report: () => ({ gumCalls, awaitingPermission: grant !== null, snapshot,
      messages: sends.map(message => ({ type: message.type, byteLength: message.bytes.length, nonzero: message.bytes.some(value => value !== 0) })),
      modelCalls, tracks: streams.flatMap(stream => stream.getTracks().map(track => track.readyState)),
      contexts: contexts.map(context => ({ rate: context.sampleRate, state: context.state })), proposal: voice.proposal }),
  }; }, [voice.proposal]);
  return <main>
    <h1>Isolated microphone receiving</h1>
    <p>Native browser audio; scripted transcription and interpretation; no task writes.</p>
    <button data-testid="start" onClick={() => void voice.start()}>Start</button>
    <button data-testid="finish" onClick={voice.finish}>Finish</button>
    <button data-testid="cancel" onClick={voice.cancel}>Cancel</button>
    <output data-testid="phase">{voice.phase}</output>
  </main>;
}
root.render(<Fixture />);
