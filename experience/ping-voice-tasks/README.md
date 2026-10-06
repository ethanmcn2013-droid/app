# Isolated voice-to-Tasks receiving

Run `pnpm test:ping-voice:tasks-browser` after the server/client packet is integrated.

This reuses the actual typed Tasks fixture, providers, Hybrid selection, styles and guarded hydration. Native Chromium fake-device microphone samples travel through the real worklet, PCM encoder, binary HTTP handler, server custody and executor into a disposable proof database. A labelled synthetic 440 Hz WAV provides reproducible nonzero audio. The fixture server supplies synthetic authentication, scripted transcription and an injected proposal; the transcript is not inferred from those bytes.

The five cases observe literal database state, physical execution/receipt counts, actual uploaded/provider byte equality and the rendered Tasks view. They cover compound edits and a drained partial tail, empty-selection creation, lost Finish response with original receipt recovery and failed refresh repair, stale Begin selection, and cancellation during interpretation. Desktop/phone screenshots and scoped accessibility results accompany a source-hashed receipt. No production data, real provider/model requests, genuine Clerk admission, real-user microphone, operational capacity or release acceptance is proved.

Default product voice remains unavailable without an approved server provider. This fixture never installs its provider or actor into the genuine runtime.
