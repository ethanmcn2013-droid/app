# Ping text assistant: internal operator guide

This candidate adds a text-first Ping tab to the existing Chat panel. It is off by default. Speech is deferred; this guide does not qualify production use, provider quality, delivery or end-to-end performance.

## Interaction direction

The founder's October 18 references are [Agently's action demonstration](https://x.com/omarships/status/2110155655399006303/video/1) and [its contextual interface demonstration](https://x.com/ahmadafterhours/status/2108325993979277417/video/1). They establish the desired feel: a compact assistant beside the work, visible action progress, and a result view suited to the request.

Ping applies that direction within Signal: a floating text command panel, progress derived from saved steps, and structured results linking to the actual Project, tasks, chat or private Timeline preview. The current request stays prominent; older requests remain available. Closing the panel hides the interface while preserving saved work and recovery identifiers. Motion must respect reduced-motion preferences. No percentage, completion marker or preview is invented while a result is uncertain.

The references do not add desktop control, arbitrary generated components or a new speech dependency to this version. Existing Signal views remain the result surfaces; requested task changes are saved and the current Timeline stays unpublished.

Since 21 October 2026 the panel follows the chat and Ping design contract in `docs/projects/chat-ping-redesign/README.md`: Ping is a row in the chat list, every request is a plan first (draft mode) with Cancel and Apply plan, and nothing changes until it is applied.

## Request and result

Choose an account or Project scope and enter the whole request. Ping shows the saved plan before any action runs. Only Apply plan authorizes changes, including messages, comments, nudges and invitations. The HTTP boundary forces draft mode, and the runtime also holds recovery of older execute-mode plans until Apply. The model cannot supply internal IDs, change permissions, publish a Timeline or choose another database.

Execution saves each step's local effects and result in one fenced transaction. Earlier successful steps remain saved if a later step is blocked. Draft mode saves a plan without executing its actions; Apply starts that saved plan with fresh checks. Checking an original request reads its saved result. An uncertain action or external delivery is not permission to submit it again. Cancel prevents further work where possible; it does not undo committed changes or retract a message already accepted by a provider.

The current catalog is deliberately finite:

| Action | Current behavior |
| --- | --- |
| Create Project | Creates a standalone Project owned by the actor, with optional description. |
| Create tasks | Explicit items or a numbered template, up to 100 per action; optional description, assignment, due date, status and milestone flag. Templates can distribute assignees in round-robin order. |
| Update tasks | Changes the supported title, description, assignees, due date, system status or milestone fields. Subtask and recurring-task edits are refused. |
| Archive / restore | Ordinary “delete” requests use archive. Archive includes children; Undo restores only the exact IDs changed by that action and preserves previously archived children. No permanent-delete action exists. |
| Comment / chat | Saves task comments or a Project chat message through the existing audience checks and original-receipt services. Can read a bounded Project chat page. |
| Private messages | A named recipient selects an existing, consented direct conversation when DMs are enabled. Missing or paused consent never falls back to a Project-room broadcast. |
| Checklist | Adds child items under one authorized parent, or ticks one uniquely named child. The parent and its siblings keep their state. |
| Nudge / invite | Saves local intent before optional external dispatch. Nudges retain current membership, non-self, mute and 24-hour cooldown checks. Invitations require Project management permission and member-capacity checks. |
| Open / list | Opens a Project or its chat, or lists a bounded task selection. |
| Current Timeline | Explicitly prepares the exact Project's current Timeline and opens a private preview. Provisioning and sync require the actual owner. The preview GET does not provision or publish; an older publication remains separate. |

A request has at most 20 actions and 500 cumulative task effects. Creation, updates, archive, comments and nudges consume that allowance. Names must resolve unambiguously inside the authorized scope. Selected tasks and created-task references are re-read before mutation. Relative dates use the server reference day in the Project's Planning Period timezone, or the user's timezone with UTC fallback.

Follow-up references to tasks from an earlier request require an explicit Project scope. They use an actor-owned saved creation result in that same Project; they do not search account-wide history for an assumed target.

## Release 2 candidate

The approved Chat design remains the contract. An explicit conversation source supplies only that authorized conversation or task discussion; account searches inspect bounded recent sources in authorized Projects. Direct messages additionally require their existing feature switch and readable consent. Catch up uses the same directed Needs-you service as Chat, with visible coverage limits when not every item fits.

The planner receives opaque source references, readable excerpts and bounded task summaries. Answers can quote those sources and link to their exact messages or tasks. Before saving or showing a cited answer, the server checks current membership, audience, revision and content. Deleted or changed sources make the saved answer unavailable. Provider input omits source IDs, internal links and credentials.

Follow-ups name an earlier actor-owned request in the same scope and source. Up to eight earlier turns and the unapplied plan form the memory. Editing replaces that waiting plan atomically; the old plan cannot be applied afterward. A time-only edit retains the day; an edit naming one task in a bulk creation leaves its siblings unchanged. All changes still wait for Apply plan. Cancelled plans remain history rather than instructions to execute.

Step Undo restores captured task state only if it still matches what Ping saved. Ping-created tasks are archived. Messages and comments are taken back through their original author, audience and revision checks. The reversal and its receipt share one transaction; repeat requests read that receipt. Later edits cause a conflict rather than being overwritten. Delivered emails and accepted invitations cannot be recalled; those steps are not presented as reversible.

Date-only tasks keep the existing calendar-day convention. Explicit clock times retain a local clock label and a time-zone-correct instant. Ambiguous or nonexistent daylight-saving times are refused for clarification.

This candidate adds no migration, provider key, budget increase, publication or general-access activation. Source tests, rendered receiving and live Sonnet evaluation remain separate evidence; only an independent reviewer scores the fixed request set and Ping scorecard.

## Authorization and privacy

Each HTTP request requires both a Clerk user and session, resolves the persisted Tasks actor, and checks the explicit actor allowlist. Each step freshly checks database Project capability, archive/deletion state and actor/owner account fences. This is not a remote Clerk session-revocation query before every step.

The planner receives the request text plus bounded authorized Project/member names, chat excerpts, task summaries, earlier turns, the waiting plan, selection counts and calendar context. Sources use opaque references; database credentials and internal source identities stay on the server. Requests, plans and receipts are application records; do not put secrets into requests. Diagnostic stage events are metadata only and are separate from those records.

## Configuration and receiving

Use approved secret storage; never put values in this document, source control or diagnostic exports.

| Setting | Admission rule |
| --- | --- |
| `PING_ASSISTANT_ENABLED` | Must be `1`; otherwise the assistant is unavailable. The Chat tab is enabled by the server, not a public browser flag. |
| `PING_ASSISTANT_TARGET` | Explicit `local` or `remote`. Local requires a file database outside production/Vercel. Remote requires a `libsql://` target and token. |
| `TASKS_DATABASE_URL`, `TASKS_AUTH_TOKEN` | Exact Tasks target and its credential. The canonical Timeline bridge also requires a token for a local file fixture; use a nonsensitive fixture token there. |
| `PING_ASSISTANT_TASKS_URL_SHA256` | SHA-256 of the exact configured database URL. A mismatch refuses admission. |
| `PING_ASSISTANT_ACTOR_IDS` | Explicit persisted Tasks user IDs, not Clerk subjects; 1–20 unique IDs, no wildcard. |
| `PING_ASSISTANT_OPEN_TO_ALL` | Exactly `1` admits every persisted, non-erased Tasks actor (general release, founder decision 21 Oct 2026). Session and actor resolution are still required; the actor list is ignored while it is on. |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Both must be configured. There is no development identity fallback. |
| `PING_ASSISTANT_ANTHROPIC_API_KEY` | Dedicated server-only Ping planner credential. There is no fallback to `ANTHROPIC_API_KEY`. Changing it requires a runtime restart. |
| `PING_ASSISTANT_EXTERNAL_DELIVERY_ENABLED` | Must be `1` for external email; independent of assistant enablement. Default is off. |
| `RESEND_API_KEY`, `RESEND_FROM` | Existing email transport credential and optional sender. No credential means no external dispatch. |

Keep the generic `ANTHROPIC_API_KEY` unset for a Ping-only cohort: that key separately enables existing Tasks reply/summary/weekly narration and Notes extraction outside Ping's allowlist and budget ledger. A dedicated Ping key does not configure those features. Both credential names prevent a provider-free sterile-preview attestation.

The candidate requires Tasks migration `0044_assistant_execution` and the canonical Timeline configuration for preview preparation. Follow `DEPLOY.md` and `drizzle/MIGRATIONS.md`; this guide does not authorize a production migration or flag change.

Receive the exact revision on isolated synthetic data first. Exercise Project creation → 100 tasks → 90 archives → exact Undo, a saved draft and Apply, reload/original-result recovery, revoked membership, ambiguous names, private current Timeline preparation and fake delivery uncertainty. Keep external delivery disabled for tests. Check both visible results and durable rows/receipts; a green source test or successful merge alone does not prove the complete experience.

Delivery counters distinguish queued, provider-accepted, unknown and suppressed outcomes. Provider acceptance is not proof of inbox delivery or that a person saw a message. A timed-out or lost reply remains unknown and is never automatically resent. Muted recipients and disabled transport must not be reported as delivered.

## Latency and budget evidence

The saved run can report server planning, execution and total elapsed milliseconds. Optional `PING_TELEMETRY_ENABLED=1` adds server `prepare` and `execute` spans. The browser's existing Ping diagnostics have separate flags; when enabled, assistant requests carry opaque correlation headers and record body receipt, response decoding, matching React receipt commits and an animation-frame opportunity. Closing, cancelling or changing account ends the diagnostic observation without releasing a physically pending mutation. An animation frame is not proof of paint, and receipt rendering is not destination task hydration. See [PING_TELEMETRY.md](PING_TELEMETRY.md) for collection limits. Do not subtract independent clocks or turn absent measurements into zero.

Bulk task updates group identical patches and insert activities in bounded batches inside the existing fenced transaction. Three local before/after cases preserved the full task/activity snapshots and receipts while reducing 431 SQL statements to 35 for identical patches, or 68 when existing completion times differed. These are local synthetic measurements, not model or production completion times; ordinary-task guards, rollback and original-result recovery remain required.

The production planner makes one bounded Sonnet generation for every request, with adaptive thinking at medium effort, a 60-second deadline and no automatic retry or fallback. The existing routing rule selects the output cap: 4,096 tokens for small requests and 16,384 for compound/bulk requests. Generic Haiku and Opus paths remain available only for explicitly admitted evaluations; Haiku needs separate qualification before production routing. The current code's dated rate card is `anthropic-standard-global-2026-10-18`: standard input/output estimates per million tokens are Haiku $0.10/$0.50 up to 100k input ($0.50/$2.50 above that), Sonnet $2/$10 and Opus $4/$20. Cache usage has separate arithmetic in `planner-budget.ts`.

The frozen ten-prompt paired synthetic comparison recorded semantic completeness of 9/10 for Haiku and 10/10 for Sonnet. It used a controlled 16,384-token output cap for both models, which differs from the small-request production cap. The earlier Haiku literal-title failure remains historical evidence. These bounded results support the initial routing choice; they do not establish general accuracy or production readiness.

Before dispatch, the durable budget reserves a conservative maximum. In production (`VERCEL_ENV=production`) the cap is $100 a calendar month (UTC), counting only runs created this month (founder decision, 21 Oct 2026); every other environment keeps the $5 development sub-cap over all runs. Unknown outcomes retain reservations. Provider token usage and rate-card estimates are recorded separately from settled billing; the UI estimate is not an invoice. No live provider spend, production readiness or latency improvement is established by these defaults.


### Private model-attempt ledger

The existing durable reservation can retain a closed `plannerAttempt` object inside the actor-owned run's private result JSON. It is independent of diagnostic flags and is not included in the public run DTO. `store.getPlannerAttempt(actorId, runId)` provides owner-bound inspection; the existing budget columns remain the single source for token totals, estimated cost and retained unknown reservations. Metadata is erased with the run, without a separate retention copy.

Initial configuration is saved atomically with reservation before fetch. Monotonic durations distinguish reservation, response headers, body/decode, validation, accounting, logical outcome and physical settlement. HTTP status, a bounded provider request reference, stop category and cache-token breakdown contain no request text, plan text, identities, credentials or reasoning. TTFT and hidden reasoning are explicitly null: a nonstreaming response does not measure first-token latency. Missing cache-lifetime breakdown stays null; conservative pricing assumptions are not reported as observed lifetime counts. Initial dispatched=false means no dispatch observation was durably saved, not proof that a later interrupted fetch never happened. Stage durations are not an additive partition: logical and physical totals include inner work.

Terminal observations are optional and cannot change a valid proposal, repeat a model request or repeat an action. The production runtime registers a per-invocation Next `after()` callback to retain the original physical operation and then drain its final observations after the response. This does not await extra work on the user response path. Retention is bounded by the platform and the route's 120-second maximum; it cannot guarantee settlement of transport that ignores cancellation forever. Scheduler failure, process termination or unavailable storage can still leave incomplete coverage. Generic adapters without this hook remain best-effort. If observation storage fails or the process ends, initial pending/missing data remains visible; it is not proof of physical settlement. A deadline or cancellation can be recorded while transport is still physically pending. Unknown usage keeps its conservative reservation; valid observed usage remains accounted even when proposal validation or optional telemetry fails. Preflight rejection without reservation makes zero model calls and has no admitted-attempt record. Generic evaluation adapters without the optional metadata writer have budget accounting but no claim of durable stage coverage.

This ledger does not add HTTP authentication, task SQL, browser paint or destination hydration measurement. Optional bounded Ping diagnostics remain supplementary and can omit events. No model calls or latency improvements follow merely from enabling this instrumentation.
