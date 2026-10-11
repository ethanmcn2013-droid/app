# Offline microphone receiving

This fixture runs the actual capture hook, native AudioContext/AudioWorklet,
PCM encoder and finalization runner. Chromium supplies a labelled synthetic
audio device. Transcription events and the interpretation callback are scripted;
they do not recognize the audio or establish provider/model accuracy.

Start is explicit. The fixture records measured PCM message byte lengths,
resource states, physical callback counts and the separate runner counters.
It never dispatches an executor or accesses a task database. No API keys are
used. The worklet is served from the owning `public/ping/pcm-worklet.js` source.

The microphone rate and mono channel preference are requested as ideals; the
actual AudioContext and worklet must run at 24 kHz, and the explicitly mono
worklet graph validates one real channel. The native browser graph converts
the device rate and channels to this graph. No compressed recording or custom
resampler is substituted. Device settings and encoded graph shape are separate
observations in the fixture receipt.
This conversion is defined by the [Web Audio specification](https://www.w3.org/TR/webaudio-1.1/#MediaStreamAudioSourceNode).

Run the focused package command after integration. Timestamped receipts and
screenshots are placed in `experience/output/ping-voice/`. Source hashes and
the immutable source revision are included; these are local construction
evidence, not human-device, live authentication, ASR or operating acceptance.
