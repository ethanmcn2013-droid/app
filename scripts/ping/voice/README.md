# Offline microphone receiving

This fixture runs the actual capture hook, native AudioContext/AudioWorklet,
PCM encoder and finalization runner. Chromium supplies a labelled synthetic
audio device. Transcription events and the interpretation callback are scripted;
they do not recognize the audio or establish provider/model accuracy.

Start is explicit. The fixture records measured PCM message byte lengths,
resource states, physical callback counts and the separate runner counters.
It never dispatches an executor or accesses a task database. No API keys are
used. The worklet is served from the owning `public/ping/pcm-worklet.js` source.

Run the focused package command after integration. Timestamped receipts and
screenshots are placed in `experience/output/ping-voice/`. Source hashes and
the immutable source revision are included; these are local construction
evidence, not human-device, live authentication, ASR or operating acceptance.
