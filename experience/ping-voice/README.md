# Disconnected interpretation candidate

`src/server/ping/openai-interpreter.ts` exports
`createPingOpenAiInterpreter({ model, apiKey, fetch, deadlineMs? })`. Its returned
function accepts the existing six-field `PingVoiceModelInput` projection and an
application AbortSignal. All three provider dependencies are supplied by the
caller; the module reads no environment, selects no model, and invokes no global
fetch. It is not imported by the product runtime and does not enable voice.

The candidate sends one Responses request to
`https://eu.api.openai.com/v1/responses`, with `store`, `stream`, and `background`
false. It supplies no tools, conversation, previous response, actor, Project,
task identities, capture, finality, or readsets. Input contains the whole
transcript, selection count, frozen reference instant, Dublin time zone, and
four system column keys. The injected key is used only in the request header.
No response, transcript, key, error detail, or identifiers are logged.

The strict schema has a closed object root wrapping a closed proposal union.
Every object requires all fields it declares. Effect subsets have separate
closed variants: omission preserves a field, while `dueDate: null` explicitly
clears it. Supported output is self assignment, absolute dates, system status,
from 2000 through 2100, or 1–10 placeholder creation with empty selection; a whole-input refusal or
clarification is also valid. Only one completed assistant output-text item is
accepted. Refusal content, tools, reasoning items, incomplete output, extra
messages/content, malformed proposals, and authority fields fail closed.
`bindPingProposal` still adds application capture and checks finality and exact
preconditions. A schema cannot establish natural-language clause fidelity or
accuracy; independent evaluation remains required.

The reference instant is projection context, not permission to interpret relative
dates. Instructions require whole-input refusal or clarification for relative
dates, named others, custom columns, and mixed unsupported clauses. These are
declared interpretation requirements, not proven model behavior.

Response processing is limited to 65,536 decoded HTTP bytes and 4,096 chunks,
with fatal UTF-8 decoding. Default interpretation deadline is 10 seconds; the
injected override may only shorten it. Cancellation/deadline ends the logical
attempt without retry. The factory retains its physical in-flight reservation
until the injected fetch, reader and cancellation actually settle, including a
provider that ignores abort. Late output cannot revive a cancelled attempt.
This is one factory's local guard, not account-wide concurrency or spend control.

The owning synthetic checks use actual RequestInit and Response/ReadableStream
objects with injected fetch. They make no provider requests and establish no
model quality, billing, live latency, effective region, or zero-retention account
entitlement. There is no runtime integration, screening, winning-route decision,
or release approval in this packet. Current product defaults remain unchanged.

The request follows the official [Responses migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses)
and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
The [data controls guide](https://developers.openai.com/api/docs/guides/your-data)
documents separate eligibility requirements for European processing and
retention controls. A regional hostname and `store: false` do not establish
those effective account controls. Live use remains gated on verified policy,
endpoint/model/account eligibility and independently evaluated interpretation.

Focused owning command:

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/ping/openai-interpreter.test.ts
```

Normal-chain registration and independent receiving evidence are maintained by
the integration coordinator separately from this source writer's checks.

## Completed-clip candidate

`createPingOpenAiClipTranscriber({model, apiKey, fetch, deadlineMs?})` in
`src/server/ping/openai-clip-transcription.ts` accepts already-completed native
Int16LE mono 24kHz PCM bytes and an AbortSignal. It copies at most 720,000
samples (30 seconds) into an exact 44-byte-header WAV and sends one native
multipart POST to `https://eu.api.openai.com/v1/audio/transcriptions`. The four
fields are file/model/response_format/stream; filename is `ping.wav`, format
JSON and stream false. Native multipart owns its boundary. Redirects fail,
and there are no prompts, hints, context, identity, labels or optional features.
The simple-JSON model allowlist is a documented technical subset, not a model
winner or effective account eligibility. No global fetch or key lookup occurs.

The response is bounded to 65,536 bytes/4,096 chunks and 4,000 transcript code
points, with fatal UTF-8 and strict text/optional-usage/language validation.
Returned token or duration usage preserves actual supplied fields and zeros;
missing usage is null. It is not a price, account bill or PCM-derived billing
estimate. A failed/aborted request may still have incurred unobserved usage.
The logical maximum deadline is 10 seconds, with shorter injected overrides.
Abort/deadline prevents late accepted text while the physical reservation stays
held through actual fetch/reader cancellation settlement. No retry occurs.

This source has no authentication or Finish authority and is not runtime-wired.
The caller owns complete drained bytes, captured context and the original
remaining Finish budget; two stages do not authorize a fresh 20-second budget.
HTTP completion is not a fabricated Realtime ACK/final. Synthetic composition
passes validated text through the Responses candidate and existing binder,
with zero executor integration. Schema/composition cannot prove ASR or whole
natural-language fidelity, real usage, latency, cost, live route comparison or
programme gates. Effective endpoint/model/account/retention and spend controls
must be verified before live input.

Temporary internal buffers/state last for the attempt and actual physical
settlement. Caller PCM, returned text, native/injected transport copies and
provider content have separate retention owners; this candidate does not claim
to erase those references. It writes no audio/transcripts to files or logs.

The [transcription API reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
and [file-transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text)
define the multipart/simple JSON contract. European endpoint support remains
subject to the separate eligibility in the data-controls guide linked above.

Owning synthetic command:

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/ping/openai-clip-transcription.test.ts
```

# Paired inert trial construction

`scripts/ping/comparison/paired-trial.ts` exports a manually invoked factory.
Supply completed PCM, a frozen application capture, an independent label and
exactly two explicit transcription-plus-interpretation callbacks. No default
route, credential lookup, live runner, logs or automatic export exists. Routes
receive isolated byte copies and the minimal whole-text interpretation input;
they never receive the label, capture identities or readsets. Both stages share
one remaining per-route deadline, at most 10 seconds. Logical cancellation
publishes a frozen result, while overlap remains refused until the injected
callback promise actually settles. Callbacks retain responsibility for their
own transport reservations; this module cannot prove arbitrary callback work
settled or had no unrelated side effects.

The result is a **private evaluator report**: expected/actual outcomes and
whole-plan matches are label-derived even without raw labels. Reserved-case
reports belong solely to the authorized label custodian; source authors/root
must not receive case-linked outcomes, scores or distributions. Public synthetic
owning fixtures may inspect their own literal results. No reserved material is
read by the committed tests.

Local transcribe/interpret counters count actual callback entries. Executor and
receipt counts are zero because this runner has no such seams. Observations
contain only text-ready and interpretation stages on one local monotonic clock;
microphone, speech-end, Finish, dispatch, receipt and mounted completion stages
are absent. Completion intervals therefore remain null. Transcription usage is
validated actual scalar metadata or null; interpretation usage is unavailable.
No prices, total route usage, screen score, p95, winner or human-value result is
inferred. Synthetic composition invokes the actual completed-clip and Responses
clients with injected HTTP only, proving their interface mechanics, not ASR or
model accuracy/account eligibility.

`pnpm test:ping-voice` now exercises both candidate clients and the paired
construction alongside the existing PCM/session/client suite with the existing
server-only preload. Script TypeScript checks include `comparison/*.ts`.

# Disconnected streaming session candidate

`createPingOpenAiStreamingTranscription` in
`src/server/ping/openai-streaming-transcription.ts` requires an explicit model,
key and header-capable socket connection function. It has no environment lookup,
default socket, retry or product-runtime import. Its fixed candidate URL is
`wss://eu.api.openai.com/v1/realtime?intent=transcription`, derived from the
official SDK connection convention and regional hostname; this is source intent,
not observed endpoint/account eligibility or a route winner.

Manual `open(signal)` resolves only after an actual fresh session-created
identity, same-session effective update (24 kHz PCM, supplied model, manual turn,
null noise reduction, no logprobs), and actual buffer-clear acknowledgment.
Expected update/clear response phases latch only immediately before their actual
send, after the injected queue check; premature acknowledgments during that
check refuse readiness. Initial defaults are validated separately. The supported closed protocol subset
permits empty/null user audio bookkeeping and inert optional preview metadata;
prior items, ACKs or finals before an actual application commit refuse admission.
The existing transport/collector receives original correlated ACK/final fields.
Only actual append/commit schemas are sent, bounded to 9,600 bytes per block,
1,440,000 bytes total and one commit. Event messages are bounded to 65,536 UTF8
bytes, 512 events and eight internal item identities. Unknown/failure/correction
or truncation events close the candidate rather than interpreting a prefix.

`getUsage()` exports copied scalar transcription usage or null with fixed
provenance; internal provider/session/item IDs and content are excluded. Missing
completed-event usage is an explicit compatibility allowance because current
guide examples omit it while the SDK schema requires it; it proves no complete
billing. Present malformed/null usage refuses, and identical final duplicates
are counted once. No interpretation usage, price or quality is inferred.

Cancellation/deadline rejects readiness or closes the transport logically while
single-flight admission stays reserved until connection and physical closure
settle. The injected `closed` promise must fulfill only on real socket closure;
abort/close request/disconnect alone cannot release it, and rejected closure
retains admission. An invoked connection attempt that rejects without returning
a socket likewise supplies no closure witness and keeps admission reserved.
Only cancellation before any connection invocation has zero physical work.
This trusts a supplied port contract rather than verifying
network behavior. Handshake is at most five seconds; an additional bounded
65-second lifetime does not replace the collector's capture/Finish deadlines.
Temporary internal reference cleanup claims no caller/socket/provider erasure.

Four public injected-socket owning groups inspect the handshake and projection,
compose exact PCM with the existing collector and disconnected Responses client,
and exercise usage/conflicts/ignored abort/held physical close/reentrant loss.
They make one inert interpretation and expose no executor or receipt seams.
`pnpm test:ping-voice` includes this suite. No microphone/provider/account or
reserved-label evidence is obtained; product custody remains default unavailable.
Live conformance, effective regional/retention controls, recognition/screening
and whole PP019/G0/G2 remain open.

Protocol references: [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription),
[client events](https://developers.openai.com/api/reference/resources/realtime/client-events),
[server events](https://developers.openai.com/api/reference/resources/realtime/server-events),
and [data controls](https://developers.openai.com/api/docs/guides/your-data?ssrid=ssr).

## Disconnected native-audio proposal candidate

`createPingOpenAiNativeAudio` in `src/server/ping/openai-native-audio.ts` is manually called with completed PCM, a four-field bounded context, and an abort signal. It copies PCM through the existing ordinary-buffer WAV encoder and returns only a locally validated inert proposal plus actual scalar usage or `null` when usage is unavailable. The context contains selected count, canonical reference instant, Europe/Dublin, and the four system status keys; it contains no transcript, task/Project/actor/session identity, capture finality, preconditions or authority. The fixed EU Chat Completions endpoint, explicit `gpt-audio-1.5` model, key and fetch are supplied by the caller. Regional model/account eligibility is unconfirmed; there is no environment or global-fetch lookup, retry, runtime connection, executor or receipt path.

The response must be one complete bounded Chat Completion with exactly one named function call. The unchanged local proposal validator checks the full proposal. Provider IDs and raw request/response content are not exported or logged. `pnpm test:ping-voice` includes five injected construction groups for request bytes/context, bounded proposals and usage, malformed envelopes, input ownership/reentrancy, and cancellation/deadline physical settlement. These synthetic fetch responses do not establish model fidelity, correction quality, live endpoint or account behavior, retention, microphone flow, product custody, or PP020/G0/G2 acceptance. Runtime defaults remain unchanged.


The candidate requests `n: 1`. Its usage decoder accepts a deliberately closed subset of known scalar/detail fields and preserves recognized nullable detail objects or members as `null` (unknown), never zero. This is not a claim of complete SDK usage-wire compatibility; unknown detail keys are rejected.

## Direct native paired construction

The existing manually invoked `createPingPairedInertTrialRunner` accepts exactly
two supplied routes. Its existing `{id, transcribe, interpret}` clip route and
report serialization are preserved. A closed `{id, kind: "native_audio",
interpretAudio}` route receives its own copy of the same completed PCM and only
the four-field native context above. It invokes the supplied audio-to-proposal
callback once, with zero transcription calls/usage and no transcript or
`finals_ready` observation. Native callback entry and completion are labelled
`interpretation_start`/`interpretation_end`; these are synthetic callback timings,
not real model, speech-end, microphone or confirmed task-completion latency.

Only native reports contain `nativeAudioUsage`, copied by the candidate's
unchanged exported `parsePingNativeAudioUsage` decoder. Missing/undefined result
usage is rejected; explicit null stays unknown, recognized zero stays zero, and
nullable details remain null. Prompt/completion tokens are not relabelled as a
transcription/interpretation split, price or complete billing. The same whole-plan
evaluator uses the independent supplied label and original capture. Native
results must be one closed locally valid proposal/usage envelope; no operation
authority, executor or receipt path is added.

The existing per-route original budget and callback-settlement busy latch remain.
Logical callback rejection does not witness physical provider settlement: each
injected candidate owns its own transport reservation. Executor/read/effect zero
fields describe absent runner seams, not arbitrary callback side effects. Visible
completion intervals remain null. Private reports include label-derived expected
and actual outcomes/matches and belong solely to the authorized label custodian;
authors/root may inspect only their own public synthetic fixture results. No
automatic logging/export, reserved screening, winner, model fidelity, effective
account/region/retention or full PP021/022/023 acceptance is established here.

Four additional public injected groups compare actual clip+Responses/native
constructors on literal WAV/context, inspect nullable usage and whole refusals,
prove byte/context isolation and closed route boundaries, and hold native callback
settlement across cancellation/deadline without inventing transcript stages.
`pnpm test:ping-voice` already includes the existing paired test file.

## Streaming paired transcription composition

`createPingStreamingPairedTranscriber` is a server-only, explicitly constructed
legacy transcription callback. Supply the same frozen original capture to its
factory and the paired trial; the unchanged `(pcm, signal)` signature cannot
independently authenticate that equality. The supplied accepted streaming opener
establishes fresh created/update/clear readiness before any PCM append. The
helper copies completed ordinary PCM, pumps actual full/partial blocks, records
exact reducer coverage, seals the complete clip watermark and sends one commit.
This replay boundary is not a microphone cut or paced live speech.

The existing pure input reducer consumes real correlated ACK/complete finals in
either order. Only its complete-final `interpret_once` descriptor yields text;
the helper calls no model, creates no proposal and adds no executor/receipt. The
paired runner subsequently invokes its real supplied interpreter once. Preview,
bookkeeping, missing ACK/final, wrong identity or partial result cannot yield a
prefix. Finite scheduled ticks and the existing event caps enforce the original
budget across opening, pumping, finality and closure.

`PingStreamingReady.closed` is the exact supplied physical socket promise. The
callback returns `{text,usage}` only after that witness fulfills and the original
deadline/abort still allows success. Detach/close requests are latched once;
held closure retains work/admission, and rejected or unavailable witnesses never
fabricate release. A late ready port after cancellation is closed without audio.
The outer paired runner may publish its immutable logical deadline/cancellation
while this callback remains held. These are supplied port obligations, not
observed network/provider settlement. Temporary helper cleanup claims no erasure
of caller buffers, returned transcript, socket content or provider records.

Usage snapshots precede cleanup: zero observations gives unknown null, one closed
transcription observation gives actual supported scalar usage/null, and multiple
or unexpected observations fail rather than aggregate. Known zero remains zero;
provider/item/session IDs, prices and complete billing are excluded. The paired
route's `finals_ready` means its complete-final callback after physical closure,
not speech end or visible Tasks completion. Label-derived outputs remain private
to the authorized custodian; only public synthetic owning fixtures are inspected.
No account eligibility, recognition quality, latency advantage, route winner,
runtime connection, whole PP019/021/022 or programme gate is established.

Four additional registered streaming groups inspect actual full/partial bytes,
ACK/final ordering, metadata ambiguity, held/rejected/late closure, cancellation
and deterministic missing-final budgets. One existing paired-file group composes
the actual helper/Responses and clip/Responses constructors with injected socket
and HTTP only; no provider call, credential lookup or reserved screening occurs.
