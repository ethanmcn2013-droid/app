# Local execution and rollback controls

12 September 2026. PC-20 local controls in progress; backend rollback and runtime-denial checks passed, delivery controls remain pending PC-11. No deployment, remote migration or notification was performed.

## Availability switches

`src/lib/conversations/flags.ts` requires explicit server-supplied configuration. It does not load environment values itself, authenticate an actor, authorize a Project or grant database access. Its pure tests prove the decision table only; a future route must invoke it after valid authentication and then prove canonical resource access.

| Variable | Effect |
|---|---|
| `SIGNAL_CONVERSATION_INTERNAL_ENABLED=true` | Allows candidate availability for the explicit internal actor allowlist |
| `SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS` | Exact comma-separated authenticated IDs; empty list denies everybody |
| `SIGNAL_CONVERSATION_SEND_ENABLED=true` | Enables sending only within the internal/allowlist envelope; default false |
| `SIGNAL_CONVERSATION_DELIVERY_ENABLED=true` | Enables external drain eligibility separately; default false; it does not configure or authorize an email provider |

Missing switches are false in development, tests and production. Only exact `true` enables a switch. Guest, attachment and AI controls are hard false in this scope. No public environment variable or client-controlled input may enable the backend. These flags do not affect the clearly marked in-memory lab fixture.

The current candidate runtime additionally requires `SIGNAL_CONVERSATION_DATABASE_MODE=local` and an explicit canonical `TASKS_DATABASE_URL=file:...` outside production/Vercel. It creates no fallback database, imports no ambient seeding module and never switches database URLs while a process is running. Remote runtime activation remains unavailable until the designated transaction/primary evidence is supplied. The allowlist contains canonical user IDs resolved from `users.clerk_id` after a real Clerk session; client actor fields are rejected. Missing Clerk configuration never enables a seed identity.

`scripts/conversations/preview-server.ts` is a separate loopback-only synthetic fixture proxy for browser verification. It creates a uniquely named file DB under an explicit scratch directory, applies supported migrations and seeds only invented identities/projects. Its `x-fixture-actor` input and `/__fixture` controls exist only in this script; application routes import neither. It forwards UI assets to an owned local Next preview and invokes the same HTTP handler/service. This proves local browser behavior with fixtures, never Clerk authentication or deployed authorization.

Data-preserving rollback means disabling sends and delivery while keeping internal entitled history available. Existing receipts, source IDs and change sequences must survive. A global internal-off switch hides the candidate completely; use the send-off switch for a read-only incident response. There is no down-migration/drop-table rollback. Disable an experimental poller without deleting history; restarting it reauthorizes and resumes from the durable change cursor.

## Concrete checks to close at integration

1. On the frozen integrated candidate, send and acknowledge a synthetic message, turn sends off, prove new sends refuse and history/receipt still resolve for the entitled actor. Remove that actor and prove both history and receipt now refuse.
2. Pause external delivery. Commit a directed source and prove in-app attention exists once. Resume only against an isolated sink; a stale/revoked recipient must receive nothing. Missing provider configuration must be reported as unavailable, never sent.
3. Inject lost acknowledgment and restart the owned process. Reuse the original request and prove the same receipt; retain uncertain local drafts until reconciliation.
4. Apply supported baseline plus approved additive migration to a fresh synthetic DB through the declared receipt runner. Record schema contract, receipt identity and preserved rows. No direct production Drizzle command.
5. Scrub message text, recipients, session credentials, content-bearing URLs and read timestamps from logs/traces. Operational evidence records IDs, error codes, counts and latency only.

At backend revision 57c16c36, actual HTTP plus file DB tests prove sends-off refuses writes while entitled receipts/history remain, then membership removal refuses reads and replay. Migration runner tests prove fresh application and no-op rerun. Five runtime/flag checks subsequently prove unsupported configurations refuse storage and missing Clerk configuration produces no synthetic actor. Delivery drain, process restart and final-candidate checks remain pending; these partial results do not close PC-20. Native libSQL stress crashes must remain in the experiment report, alongside the bounded connection configuration that passes; a local driver workaround is not a deployed scalability proof.

## Owned preview

Source worktree: `feat-project-conversation-prototype`; final current source includes prototype fixes and unchanged paper constants moved out of Next route exports. URL `http://127.0.0.1:3187/lab/project-conversation`. The declared Next development command is invoked through the installed Next binary with `--webpack --hostname 127.0.0.1 --port 3187`. Webpack is explicit because dependencies are reused via an existing node_modules junction.

Root launcher: `C:/Users/ethan/Documents/Codex/2026-09-12/plea/work/start-conversation-preview.ps1`. Session 44547 is this task's owned preview process. It strips relevant inherited provider variables in its child shell, refuses a worktree containing `.env*`, sets documented review mode and memory-only DB URLs, disables Next telemetry and binds loopback. It neither copies credentials nor modifies shared dependencies. Stop only this owned session/process, never every Node process or an unrelated port listener.

HTTP 200 and browser rendering verified. Known existing server-build warning: OpenTelemetry/Sentry dynamic dependency expression; DSNs are unset and no runtime/browser error was observed. The initial cold compile caused one browser navigation timeout before HTTP 200; subsequent warm navigation succeeded. Cold development compile time is not a production performance measure.

Required final artifact record: canonical commit, checks against final source, screenshot hashes, 1440×1000 and 390×844 evidence, design/human disposition, and remaining remote/provider gates. Screenshots are retained beside this document under `evidence/` and copied to the user-facing output directory.

## Connected browser verification checkpoint

Integration source 9db7f08 plus later local runtime tests. Owned Next session 20798 uses the isolated launcher `work/start-conversation-live-preview.ps1` at port 3188; owned fixture proxy session 83774 at port 3189 creates `work/pc07-live/browser-fixture-WYXvTd/tasks.db`. Only these task-owned processes may be stopped. The proxy script uses an async main wrapper because this repository transforms .ts entrypoints as CommonJS.

Actual browser actions: Alice created a room and sent; Bob saw it and sent through a dropped response after commit. Direct fixture inspection found two message rows, two receipt rows and zero directed effects for the unmentioned messages. Browser returned between Projects with a draft intact, edited and tombstoned an own message, disabled Send after a membership epoch change, enabled after explicit audience review, and cleared history/composer when Bob was removed. Phone viewport 390×844 was rendered. Project switching initially exposed unbound browser clearTimeout; a wrapper corrected it and the action passed on recheck.

Fresh client review found delayed-audience, old-epoch retry, session-generation and scroll/keyboard gaps; correction is active. These exploratory browser passes are not final PC-07 acceptance and must be repeated on the corrected source. No real Clerk/session, production deployment, physical IME/mobile keyboard, remote transaction or provider delivery proof is implied.

Process-restart proof: `service.persistence.test.ts` starts one isolated Node child that sends a directed message and exits immediately after commit without emitting its receipt. A second fresh process looks up the original request and retries it. The test passed (2,178.4602 ms): same recovered receipt, exactly one message, receipt, attention event and outbox intent. Child provider variables are removed and only the explicitly named synthetic DB is opened. Final-candidate rerun remains required after subsequent schema/service work.


## Accepted client correction, 12 September 2026 12:23 UTC

Source `5a22b2af`, fresh Sol narrow review accepted. Full isolated conversation check: 52/52 pass, 9,157.2976 ms; scoped ESLint and full TypeScript pass. Structured temporary failures now back off 2/4/8/16/30 seconds, success resets, and awaited pagination remains single-flight. Live arrivals preserve a reader's scroll top; only near-bottom reading follows the new end, while explicit older-page prepends preserve the content anchor.

Owned fixture session 13168 supersedes stopped session 83774; DB `work/pc07-final/browser-fixture-2ysLOT/tasks.db` is synthetic. Actual browser proof: a reader at top 513, height 6,442, viewport 587 remained at top 513 after another member's committed message grew height to 6,505. Recent 100-message history and explicit older-page loading made the original message reachable in a 121-message fixture. Bob's dropped successful POST response recovered via live history; direct DB read found exactly one Bob message. Project switch/return restored the exact `Keep this Project draft` fixture draft after history loaded. Return inserted a newline at the measured 681px mobile breakpoint. The viewport override did not change that background tab to 390px; do not mislabel this check as a 390px final screenshot. Earlier 390px exploratory proof remains historical; repeat the final responsive matrix at PC-14.

No new browser errors were recorded in this check; the log retains the already-fixed 11:34 timer error from the earlier session. Real Clerk, physical IME, remote database and provider delivery remain unverified release gates. PC-08 core was subsequently received as `5d5a2992` / `7f2287cd`; its HTTP/UI journey is in progress.
