# Ping text assistant: internal operator guide

This candidate adds a text-first Ping tab to the existing Chat panel. It is off by default. Speech is deferred; this guide does not qualify production use, provider quality, delivery or end-to-end performance.

## Interaction direction

The founder's October 18 references are [Agently's action demonstration](https://x.com/omarships/status/2110155655399006303/video/1) and [its contextual interface demonstration](https://x.com/ahmadafterhours/status/2108325993979277417/video/1). They establish the desired feel: a compact assistant beside the work, visible action progress, and a result view suited to the request.

Ping applies that direction within Signal: a floating text command panel, progress derived from saved steps, and structured results linking to the actual Project, tasks, chat or private Timeline preview. The current request stays prominent; older requests remain available. Closing the panel hides the interface while preserving saved work and recovery identifiers. Motion must respect reduced-motion preferences. No percentage, completion marker or preview is invented while a result is uncertain.

The references do not add desktop control, arbitrary generated components or a new speech dependency to this version. Existing Signal views remain the result surfaces; requested task changes are saved and the current Timeline stays unpublished.

## Request and result

Choose an account or Project scope, enter the whole request, and choose execution or draft mode. One bounded model response produces a finite plan; server validation and domain operations decide what can run. The model cannot supply internal IDs, change permissions, publish a Timeline or choose another database.

Execution saves each step's local effects and result in one fenced transaction. Earlier successful steps remain saved if a later step is blocked. Draft mode saves a plan without executing its actions; Apply starts that saved plan with fresh checks. Checking an original request reads its saved result. An uncertain action or external delivery is not permission to submit it again. Cancel prevents further work where possible; it does not undo committed changes or retract a message already accepted by a provider.

The current catalog is deliberately finite:

| Action | Current behavior |
| --- | --- |
| Create Project | Creates a standalone Project owned by the actor, with optional description. |
| Create tasks | Explicit items or a numbered template, up to 100 per action; optional description, assignment, due date, status and milestone flag. Templates can distribute assignees in round-robin order. |
| Update tasks | Changes the supported title, description, assignees, due date, system status or milestone fields. Subtask and recurring-task edits are refused. |
| Archive / restore | Ordinary “delete” requests use archive. Archive includes children; Undo restores only the exact IDs changed by that action and preserves previously archived children. No permanent-delete action exists. |
| Comment / chat | Saves task comments or a Project chat message through the existing audience checks and original-receipt services. Can read a bounded Project chat page. |
| Nudge / invite | Saves local intent before optional external dispatch. Nudges retain current membership, non-self, mute and 24-hour cooldown checks. Invitations require Project management permission and member-capacity checks. |
| Open / list | Opens a Project or its chat, or lists a bounded task selection. |
| Current Timeline | Explicitly prepares the exact Project's current Timeline and opens a private preview. Provisioning and sync require the actual owner. The preview GET does not provision or publish; an older publication remains separate. |

A request has at most 20 actions and 500 cumulative task effects. Creation, updates, archive, comments and nudges consume that allowance. Names must resolve unambiguously inside the authorized scope. Selected tasks and created-task references are re-read before mutation. Relative dates use the server reference day in the Project's Planning Period timezone, or the user's timezone with UTC fallback.

Follow-up references to tasks from an earlier request require an explicit Project scope. They use an actor-owned saved creation result in that same Project; they do not search account-wide history for an assumed target.

## Authorization and privacy

Each HTTP request requires both a Clerk user and session, resolves the persisted Tasks actor, and checks the explicit actor allowlist. Each step freshly checks database Project capability, archive/deletion state and actor/owner account fences. This is not a remote Clerk session-revocation query before every step.

The planner receives the request text plus a bounded projection of authorized Project/member names, selection counts, prior-task count and calendar context. It does not receive the database credentials or internal identity references from the action layer. Requests, plans and receipts are application records; do not put secrets into requests. Diagnostic stage events are metadata only and are separate from those records.

## Configuration and receiving

Use approved secret storage; never put values in this document, source control or diagnostic exports.

| Setting | Admission rule |
| --- | --- |
| `PING_ASSISTANT_ENABLED` | Must be `1`; otherwise the assistant is unavailable. The Chat tab is enabled by the server, not a public browser flag. |
| `PING_ASSISTANT_TARGET` | Explicit `local` or `remote`. Local requires a file database outside production/Vercel. Remote requires a `libsql://` target and token. |
| `TASKS_DATABASE_URL`, `TASKS_AUTH_TOKEN` | Exact Tasks target and its credential. The canonical Timeline bridge also requires a token for a local file fixture; use a nonsensitive fixture token there. |
| `PING_ASSISTANT_TASKS_URL_SHA256` | SHA-256 of the exact configured database URL. A mismatch refuses admission. |
| `PING_ASSISTANT_ACTOR_IDS` | Explicit persisted Tasks user IDs, not Clerk subjects; 1–20 unique IDs, no wildcard. |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Both must be configured. There is no development identity fallback. |
| `ANTHROPIC_API_KEY` | Server-only planner credential. Changing it requires a runtime restart; there is no automatic provider fallback. |
| `PING_ASSISTANT_EXTERNAL_DELIVERY_ENABLED` | Must be `1` for external email; independent of assistant enablement. Default is off. |
| `RESEND_API_KEY`, `RESEND_FROM` | Existing email transport credential and optional sender. No credential means no external dispatch. |

The candidate requires Tasks migration `0044_assistant_execution` and the canonical Timeline configuration for preview preparation. Follow `DEPLOY.md` and `drizzle/MIGRATIONS.md`; this guide does not authorize a production migration or flag change.

Receive the exact revision on isolated synthetic data first. Exercise Project creation → 100 tasks → 90 archives → exact Undo, a saved draft and Apply, reload/original-result recovery, revoked membership, ambiguous names, private current Timeline preparation and fake delivery uncertainty. Keep external delivery disabled for tests. Check both visible results and durable rows/receipts; a green source test or successful merge alone does not prove the complete experience.

Delivery counters distinguish queued, provider-accepted, unknown and suppressed outcomes. Provider acceptance is not proof of inbox delivery or that a person saw a message. A timed-out or lost reply remains unknown and is never automatically resent. Muted recipients and disabled transport must not be reported as delivered.

## Latency and budget evidence

The saved run can report server planning, execution and total elapsed milliseconds. Optional `PING_TELEMETRY_ENABLED=1` adds the existing server `prepare` span around model planning and `execute` spans around action execution. The browser's existing Ping diagnostics have separate flags; see [PING_TELEMETRY.md](PING_TELEMETRY.md). The text assistant does not yet prove browser submission-to-visible-result, physical paint, separate provider-network/JSON-validation/database segments, or notification arrival. Do not subtract independent clocks or turn absent measurements into zero.

The planner makes one bounded generation: Haiku for simple requests, Sonnet for compound/bulk requests. Opus is an explicitly admitted evaluation path, not an automatic fallback. The current code's dated rate card is `anthropic-standard-global-2026-10-18`: standard input/output estimates per million tokens are Haiku $0.10/$0.50 up to 100k input ($0.50/$2.50 above that), Sonnet $2/$10 and Opus $4/$20. Cache usage has separate arithmetic in `planner-budget.ts`.

Before dispatch, the durable budget reserves a conservative maximum under the $5 development sub-cap and $100 total cap. Unknown outcomes retain reservations. Provider token usage and rate-card estimates are recorded separately from settled billing; the UI estimate is not an invoice. No live provider spend, production readiness or latency improvement is established by these defaults.
