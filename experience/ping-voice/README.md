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
