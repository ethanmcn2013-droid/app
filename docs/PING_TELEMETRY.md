# Ping telemetry and latency operations

This contract instruments the maintained **typed command and local-speech-to-typed** flow. Native recognition readiness/finality can be observed only when that browser path actually runs. The maintained route does not call a cloud interpreter or transcription provider. The legacy voice implementation and scripted guided runner are separate cohorts. This instrumentation does not activate Ping, lift programme gates, grant data access or establish production performance.

## Enablement and rollback

Both sides are off by default. Set `PING_TELEMETRY_ENABLED=1` on the server and `NEXT_PUBLIC_PING_TELEMETRY_ENABLED=1` at the client build only in an admitted environment. Client public configuration is compiled into the build; a server-only flag cannot turn an existing client bundle on. Set `NEXT_PUBLIC_PING_TELEMETRY_DEPLOYMENT` to `development`, `preview`, `production` or `test` and `NEXT_PUBLIC_PING_TELEMETRY_RELEASE` to the exact 40-character lowercase source SHA. Server provenance uses `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA`, validated independently. Unknown provenance stays `unknown`/`null`; it is never inferred from an origin URL. These flags are not authentication or Ping product enablement.

Rollback: set the server flag off first. The collector receives an unavailable response and drops that batch without retry. A subsequent build with the public flag off removes browser collection. Preserve failed/unknown product outcomes and their recovery markers. Never retry a mutation because its telemetry disappeared. A code rollback follows the owning App release procedure; no database migration is introduced here.

Before any operating activation, the receiving owner records environment/release, log-access roles and actual platform retention/deletion settings, telemetry window, rollback owner and alert destination in Delivery. Verify the existing plan supports the required retention/access; do not provision a paid sink or enable billing. Until those settings and actual ingestion are read back, label the state **implemented, not operating**. This repository does not control the host's log retention. Random diagnostic IDs are short-lived correlation hints, not anonymous user IDs; restrict access and retain raw logs only for the admitted investigation window. No actor, project, task, command, receipt lookup token, generation, auth/session key, identity hash, text, title, audio, proposal, raw URL or free-form error belongs in an event.

## Exact event and transport contract

`src/lib/ping/telemetry.ts` is the authoritative closed `ping.telemetry.v1` schema. Every event contains version, source, trust, clock, random attempt/request/span UUIDv4, optional random parent span UUID, fixed stage/outcome, fractional `durationMs` or null, bounded sequence/drop counts, validated deployment/release and input mode. Extra properties, nested values and unknown enums are rejected. Client metadata is **client_reported**; it never authorizes execution or proves a business commit. A header-supplied diagnostic correlation value remains an untrusted join hint even when a server measures its own duration.

The recorder emits at most 64 events, then counts drops. Start/end share the same span; one end is accepted. Diagnostics are queued, fail-open, and never awaited by command execution. Queueing moves work off the caller's stack; synchronous serialization/logging still costs CPU and may delay the event loop. See measured overhead evidence before increasing collection. This is bounded incident sampling, not lossless full-fleet tracing.

The browser collector holds at most 64 queued events, one batch of at most 16 events / 8 KiB in flight and a 2-second default deadline (maximum configurable 5 seconds). It never retries a batch. On timeout it drops the old batch and queue, then quarantines exports until that physical request actually settles. New events can export afterward; a late successful response never credits or retries the lost batch. An abort-ignoring request that never settles keeps collection quarantined, preventing a chain of physical requests. Explicit disposal remains permanent. Its `acceptedByReceiver` count means an HTTP success, not final log delivery; failed or unknown delivery and dropped queued events remain distinct. A wholly lost page cannot report its own loss. A later event may carry an overflow summary; silence is not proof of zero drops.

`POST /api/ping/telemetry` requires same-origin POST, existing authenticated session, exact batch schema and bounded body. Authentication has a 2-second diagnostic response deadline; at most eight authentication operations may remain physically unsettled in one process. A full authentication lease budget returns `503` immediately without starting or queueing another authentication call. Timeout does not release a physical lease; actual resolve/reject does, and a late result cannot parse or export the request. Cheap rejected methods/origins acquire no lease. The shared bounded JSON body reader has a 10-second limit.

The receiver admits at most 60 accepted-origin/authenticated batches per minute **per process** and the server log sink at most 512 events per minute per process, plus one overflow summary. Once the sink budget is exhausted, subsequent requests bypass recorder construction. A `request`/`overflow` summary with `droppedCount: 0` means at least one complete request was omitted and the number of missing events is unknown; it never means complete coverage or zero loss. Earlier event overflow and request bypass share one summary latch per window. Already admitted recorders can still consume the last slots and truncate a trace. These are not whole-trace reservations, fleet-wide quotas or tenant fairness guarantees. Invalid bodies can consume the authenticated-process budget. Rejected method/origin/auth do not consume its accepted-batch quota. `202` acknowledges validation/queueing only; the export can still fail or be dropped. No client telemetry can call command services or recover a receipt.

The existing sanitized operational logger emits exactly:

```text
[ping.telemetry] {"version":"ping.telemetry.v1",...the exact validated scalar fields...}
```

That illustrative line is not a parseable sample. Export actual message text as one line per record; remove only a platform envelope through a separately reviewed adapter, never by searching arbitrary text for JSON or executing log contents. Operational logs are diagnostic, not durable business audit receipts. Existing `ping.operations.v1` lines and unrelated cron heartbeat counters have different meanings.

## Timing boundaries

| Stage | Meaning and limit |
| --- | --- |
| activation, capability, install, recognition | Explicit user activation through native readiness/recognition lifecycle. No microphone is opened by measurement. User speaking time is distinct from system wait. |
| finish-final | Explicit Finish through accepted final transcript; this is not necessarily acoustic speech-end. Unsupported acoustic boundaries remain absent. |
| prepare, review | Request preparation and user review are separate. Review time must not become a server latency regression. |
| request, authenticate, decode, resolve, dispatch | Local observed server/transport stages. A successful HTTP response alone does not mean the task committed. |
| transaction-read, transaction-write | Actual awaited adapter operation; completion alone does not prove a business mutation. |
| execute, receipt | Command outcome / authoritative receipt knowledge. Only explicit committed outcome facts establish business knowledge. Unknown stays unknown. |
| refresh, hydration | Authorized canonical refresh / accepted hydration. Stale hydration is not a visible success. |
| react-commit, render-opportunity | React committed state / animation-frame opportunity. Neither independently proves pixels were painted or a person saw them. |
| apply-to-react-commit, finish-to-react-commit | Same-browser monotonic intervals to the committed result. Keep user review/speaking time and input mode visible in interpretation. |
| recovery, cancel, close, attempt | Read-only recovery, context invalidation and complete/unfinished attempt coverage. Reload starts new diagnostics; original mutation identity and recovery rules are unchanged. |

Durations never subtract browser from server clocks, different page clocks or independent requests. Correlation connects events; it does not synchronize clocks. Missing/unsupported/censored values stay null or explicit unfinished. Keep first guided `ping.guided.latency.v2` results intact; its matching model-projection boundary remains distinct from React commit/physical paint. `ping.guided.measurement.v1` adds delivery/gesture/page-fence coverage without rewriting v2.

## Analyze and compare

Use Node 22 and the App's declared Corepack pnpm version. No API or remote service is needed:

```text
corepack pnpm ping:telemetry:analyze INPUT.log COHORT.json NEW-REPORT.json
corepack pnpm ping:telemetry:analyze CANDIDATE.log CANDIDATE-COHORT.json NEW-COMPARISON.json BASELINE.log BASELINE-COHORT.json
corepack pnpm test:ping-telemetry
```

Outputs require a fresh path and never overwrite evidence. Inputs are capped at 16 MiB, 20,000 lines and 8 KiB per event. The tool accepts only the exact logger prefix followed by validated JSON; it never echoes rejected input. Reports omit diagnostic correlation IDs. Manifest labels describe the synthetic workload/environment/configuration, never a person or customer:

```json
{
  "version": "ping.telemetry.cohort.v1",
  "kind": "synthetic",
  "workload": "ten-selected",
  "environment": "isolated-libsql",
  "configuration": "default",
  "temperature": "warm",
  "windowSeconds": 60,
  "warmupExcluded": 5
}
```

The operator records the actual observation window; the manifest labels it, without inventing event timestamps. Exclude warmups in the exported input and retain them separately. Group by source/trust/clock/deployment/release/input mode/stage/outcome. Quantiles use terminal local monotonic durations: median averages the two middle values, p95 is nearest rank and withheld below 20 samples. Above 20 it is still descriptive, not a confidence guarantee. Explicit unfinished durations are censored. Duplicate event delivery is removed; conflicting duplicate keys are flagged. Sequence gaps, per-recorder maximum reported drops and overflow summaries overlap: never sum them into an exact loss total. Stage facts can have no paired start. Source-cohort attempt counts are not a unique user count or product success denominator.

Comparison refuses mismatched workload, environment, configuration, temperature, window or warmup definitions; unknown temperature, malformed/conflicting input, reported loss and absent comparable timing fail closed. Release may differ to evaluate a change. Multiple releases for the same comparison group are not pooled. Changed failure/unknown/cancelled counts, unfinished observations, missing groups and independent attempted-work denominators must be inspected alongside timing; a faster success-only subset cannot authorize adoption. No command automatically declares a win or rollout.

## Operating signals and response

These are initial **proposed rules**, not configured or delivered alerts. First establish an independent admitted-attempt denominator and actual log delivery; rate-capped diagnostics cannot supply a lossless availability denominator. The Ping delivery owner owns triage and records the receiving environment's alert destination and backup before activation.

| Signal | Initial window / minimum | Action |
| --- | --- | --- |
| Unknown committed outcome | Any observed unknown after execute; inspect every event | Preserve marker; use bounded read-only receipt recovery. Never auto-repeat the mutation. Escalate a confirmed customer effect or recurrent unknowns. |
| Availability / refusal / error shift | 15 minutes and at least 100 independently counted attempts; compare like outcomes/configuration | Separate permission/refusal from system failure. Inspect auth/resolve/dispatch boundaries and target revision. Stop new admission if existing safety rules require it. |
| Missing stages / conflicting events / export drops | Any conflict, overflow or persistent missing final stages across two windows | Mark latency view incomplete, inspect budget/receiver/sink/auth and collector quarantine. Reduce admitted diagnostic traffic; do not increase a quota without measuring CPU/load. |
| Sustained latency | Same release/mode/temperature, 15 minutes, at least 100 terminal samples, three consecutive windows above both baseline p95 × 1.2 and baseline + 100 ms | Attribute local stages before changing code. These are investigation thresholds, not product SLOs. Do not mix review time, speech time, old model projection and rendered completion. |
| No observations | Only meaningful when independent admitted-attempt count is nonzero | Check both flags/build provenance, receiver/auth, platform export and retention. Silence cannot prove healthy operation. |

Before calling alerts operational, inject safe invented events in the admitted environment and prove receiver ingestion, rule evaluation, actual alert arrival, owner action and rollback. Keep that receipt separate from local parser/tests. Actual production latency improvement additionally requires compatible real before/after cohorts and safety/error/unknown denominators. Until then the truthful status is **local engineering proof, production operation unverified**.

## Every improvement loop

Record a source pin, environment and workload, fresh latency ideas ranked by likely benefit/risk, one causal change, rejection criteria, warmup/sample/error/unknown/drop/censoring denominators, raw safe results, required correctness checks and adoption/rejection. Preserve failed experiments. Start with measured database fanout, observer overhead, refresh duplication, finality and render fanout; never hide slow confirmation behind a faster acknowledgement, cache authorization across attempts or remove durable journaling. Use a new cohort/version when a boundary changes. The programme ledger and Delivery task own acceptance; this document is the operating contract, not a second project tracker.


## Text-assistant model attempt custody

The assistant's private durable `plannerAttempt` metadata is separate from flag-controlled diagnostic spans. Its initial configuration shares the mandatory model budget reservation transaction; revisioned terminal observations merge without replacing messages, timing, cancellation or receipts. Missing/pending observations mean incomplete coverage, including process termination or observer-write loss. Inspect through the actor-bound store getter, not a public DTO or exported operational metric dimension. Token totals and rate-card estimates remain in the existing budget columns; cache breakdown is supplementary, never another charge. There is no raw prompt, proposal, provider body, secret, content hash or reasoning in attempt metadata. See [the text assistant runbook](PING_TEXT_ASSISTANT.md#private-model-attempt-ledger) for stage meanings, unknown usage and physical-settlement limits. The existing best-effort server/client diagnostic event budgets do not provide an all-call denominator.
