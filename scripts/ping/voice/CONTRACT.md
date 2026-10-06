# Offline microphone and finality contract

`ping.voice.offline.v1` is a delegated disposable construction. It is disconnected by default: no provider credentials, live API, HTTP capture authority, executor or product voice mount. Initial contract commit exports types/constants only; the factory and codecs follow in the same writer lane. The existing command/input semantics remain unchanged.

Sol owns `pcm.ts`, `realtime-transcription.ts`, `voice-session.ts` and owning tests. A separate writer owns the worklet/hook; coordinator owns browser fixture/package integration and receiving. One writer per worktree. Synthetic capture is validated application test context, not authentication.

## Worklet and hook seam

The processor is `ping-pcm-capture` at `/ping/pcm-worklet.js`. Processor options are the session's frozen `getCaptureTag()` pair. Unavailable, invalid, closed or disposed sessions expose null; no actor/capture/command/readsets are exposed. Hook never derives these tags from provider data.

- `frame`: exact exported `PingVoiceFrame`; transferable Float32 ArrayBuffer, actual mono 24 kHz, 1–4,800 samples, consecutive ordinal starting at one. Buffer byte length equals samples times four. PCM encoding is synchronous, signed Int16 little-endian; samples clamp [-1,1], scale negative by 32,768 and positive by 32,767, truncate toward zero.
- `cut`: exact `PingVoiceCut`; throughFrame/totalSamples equal received ledger including partial tail. Empty input refuses. The matching worklet cut command is `PingWorkletCommand`. Duplicate identical cut is inert; further frames or mismatched counts refuse.
- Worklet failure: `{type:"failure",generationId,connectionEpoch,reason:"unsupported_audio"|"capture_cap"}`; hook validates and cancels its generation with `capture_failed`.

Hook exports `usePingVoiceCapture({contextKey, createSession, workletUrl?})`, with phase/snapshot/start/finish/cancel/proposal. Factory accepts the snapshot callback and returns `PingVoiceSession`. Explicit Start creates one session and validates its tag before microphone permission. Context loss/unmount cancels; delayed permission grant stops its tracks and never replaces newer resources. Default worklet URL above. Native 24 kHz mono is checked; unsupported shapes refuse rather than fake a PCM label.

First user Finish calls `requestFinish()`; only true sends one tagged cut command. Worklet stops admitting samples, transfers accepted full blocks/partial tail, then cut fence. Preserve AudioContext/port until this fence drains. Session sends reducer Finish only after fence matches; encoding/enqueue must cover it before seal/commit. Ten-second outer deadline starts at first user Finish and never extends. No VAD commit; one committed turn at Finish. 200 ms blocks avoid consuming the reducer's event cap with each native processing quantum.

## Session/provider boundary

Transport is an injected already-ready, explicitly empty dedicated transcription session with null turn detection and approved PCM format. Session never opens it. Synchronous send invocation/enqueue acceptance are distinct counters, neither proves server delivery. No retry after send throw. Queued bytes are bounded by 1,920,000; captured audio remains bounded by the existing 30-second/1,440,000-byte policy. Unknown/unbounded/exotic values fail closed before materialization.

Append base64 comes from actual bytes. Commit follows the drained tail exactly once. ACK binds the sole pending local commit in its application-owned connection epoch; `item_id`/predecessor are real wire identity. Client event IDs are not assumed echoed. Complete finals, including final-before-ACK, use the accepted reducer. Preview deltas are validated/ignored in this minimal runner. Unknown/conflicting/missing completion closes without prefix interpretation.

Codec facts checked against the [transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription), [client events](https://developers.openai.com/api/reference/resources/realtime/client-events) and [server events](https://developers.openai.com/api/reference/resources/realtime/server-events). Model/session conformance still requires an actual authorized provider attempt.

One small bounded serialized queue handles synchronous callback reentrancy. Interpretation latch is set before invoking the injected function with only the existing `modelInput` plus AbortSignal; never whole descriptor/capture/IDs/readsets. Unknown returned data goes through existing binder/normalizer. Late/conflicting input can invalidate a result but cannot retroactively erase a legitimate call. Cancel/dispose aborts, unsubscribes/closes once, wipes retained input/PCM/proposal and blocks stale completion. Ready exposes only normalized operation proposal; no executor method or dispatch event.

Fixture callbacks/transcripts are scripted and explicitly labelled. Actual native fake-device bytes, tail/cleanup and injected calls are separate observations from ASR/model accuracy. No real speech-end/visible result latency exists here. Typed post-text prepare cannot act as Start custody; future strict server-owned voice capture and real execution/readback remain separate gates.
