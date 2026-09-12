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


## Accepted task outcome, 12 September 2026 12:34 UTC

Source `3c7055097c81f441eb5cb7af08879424d54126be`, fresh Astra narrow acceptance. Integrated runner 65/65 passed, 12,027.4137 ms, including the canonical Tasks core tests and a client-resolver/real-file-DB regression for destination access loss. Scoped ESLint and full TypeScript passed. The fixture's deterministic `withhold-receipt` returns an explicit temporary error after a successful commit; `lose-response` still destroys the socket, which Chromium may transparently retry. Neither is an authenticated App bypass.

Owned final fixture session 93763 (replaces stopped39442), DB `work/pc08-final/browser-fixture-uJc3Fx/tasks.db`. Actual browser: Alice promoted an explicitly authored task into Autumn exhibition, due 2026-09-18. The post-commit receipt was withheld. Form showed unknown outcome and locked original fields. Direct synthetic SQL removed Alice from only the destination; Check outcome showed access needed and retained the original request. Restored membership, disabled sends, then Check outcome recovered Task created. Readback: tasks=1, work_links=1, work_operation_receipts=1, due=2026-09-18, is_milestone=0, destination=synthetic_project_b. No second promotion was necessary.

Rendered artifacts `evidence/task-outcome-form-desktop.png` and `evidence/task-outcome-recovered-desktop.png` are 1280×720 against the final source. Native date input was exercised by fill followed by ArrowUp/ArrowDown, which commits the React change; plain automation fill alone did not persist the date. This records a tool interaction limitation, not a passed physical phone test. All evidence is synthetic. Live Clerk and task-page navigation in a real session remain release verification gates.

## PC-09 acceptance — 12 September 2026, 13:04 UTC

Accepted source: 092ced53ec4b0936a90da2360f0c3c8af385a7a2. Fresh Sol exposed two missing cases: an initializing page could overwrite a newer tombstone delta; restoring uncertain text A could overwrite newer draft B. Revision merging, bootstrap polling order, and actor/scope-owned outgoing recovery now preserve both. The independent counterexamples changed from 0/2 to 2/2 green; fresh Astra accepted the bounded correction. The root suite passed 69/69 (26,409.2446 ms), full TypeScript and scoped ESLint. Fresh Sol separately ran six real local DB/HTTP cases, process restart, 20 migration-ledger tests and the migration contract; remote transactions were not tested.

Actual final-source browser proof: refuse-write left A uncertain; composing B and changing Projects preserved both. Removing a source member, checking A's absent receipt and revisiting preserved B plus explicit recoverable A. Restoring membership required audience review again. Sending B and restoring A created exactly one B and did not auto-send A. Task dialog Cancel returned focus to its Create task trigger. Final source was reloaded after Fast Refresh; no new unexplained error was observed.

The current isolated fixture is loopback3189, owned session60359, proxy to3188; DB work/pc09-final/browser-fixture-M3EOs2/tasks.db in the task scratch directory. No customer data or providers. Final connected screenshots were refreshed at 390×844 and 1440×1000, with document scroll width equal to viewport width. The browser runtime's supported tab CDP capability supplied device metrics and an explicit screenshot clip; screenshots are actual rendered source. The full physical keyboard, screen-reader and human study claims remain unverified.

## PC-10 work in progress — 12 September 2026, 13:48 UTC

DM backend received fresh Astra local acceptance at 0c1b901ec31c9b849e779e506207c410156c7b57, integrated as1a2b56d3. The first review rejected four actual counterexamples: populated0029 receipt backfill; block/leave/membership churn; send/edit/delete receipt replay after leaving; revocation controls during archive. All four corrected cases passed unchanged. A fifth actual-service upgrade check found preserved deleted-link receipts were still unrecoverable; the final correction authorizes only historical NULL-source receipts through the live actor and both current Projects, retaining exact pair proof for all new DM receipts. Fresh reviewer independently passed3/3 upgrade/revocation/DM-proof checks and accepted the backend. No PC-10 whole-milestone acceptance yet.

Root's first integrated suite passed78/78 (18,691.3698 ms); final backend follow-up added another legacy recovery regression. Full TypeScript and scoped lint passed. Messages UI is frozen atf9899a76 for a fresh Sol review; Task Discussion remains a separate worker-owned0031 packet. Root authored the client, the Sol backend worker authored DM services, and Astra independently reviewed backend invariants.

Actual synthetic browser work: request had no composer on either actor; recipient acceptance enabled messages; a directed reply used only the other pair member as a structured mention candidate. Main and reply drafts survived opening/closing the thread, focus returned to Reply, and both clients converged to1reply while the root feed excluded the reply body. Blocking reached both clients and an already-open thread, retained history and removed composer/edit/delete controls. A native modal confines reply keyboard focus. Mobile viewport390×844 had scrollWidth390 and the reply dialog occupied exactly that viewport. These are local browser checks, not participant sessions.

Owned fixture3189 now uses session80884 and task scratch pc10-live/browser-fixture-qjemQQ/tasks.db; it retains pre-final-correction service state for exploratory browser evidence only. A fresh final-backend fixture3190 uses session74037 and pc10-final/browser-fixture-EtHcfh/tasks.db, proxying the same3188 Next UI. Both are synthetic and local; only3190 is suitable for final corrected-backend proof. Task Discussion endpoint will arrive with0031; its current neutral directory failure is an explicit pending dependency.

## PC10 integration and review checkpoint — 12 September 2026, 14:20 UTC

Root integrated Discussion initial 95bf2200 and recovery 59cb6e7d as b7cbfa4d/a412bcf8. The receiving suite passed 90/90 (29,931.7656 ms), full TypeScript and scoped ESLint passed. These checks did not establish acceptance: independent Astra reproduced seven defects in frozen Discussion 59cb6e7d (runtime actor override in exported actions; mixed-quarantine sequence collision; departed-root-author reply failure; raw tombstone resurrection; revoked content retention; unresolved send loss; silent audience-consent advancement). The author is correcting the coherent packet; reviewer scratch evidence is in plea/work/discussion-acceptance. No production or real-identity claim.

The root DM/reply UI correction 5b9c8421 preserves exact conversation-scoped drafts and atomically restores body with selected recipient IDs, guards stale directory refresh, and corrects no-access copy. Final banner correction 856abd41 was accepted by independent Sol with 28/28 focused checks and ESLint. Root synthetic browser proof preserved an unrelated Project draft through a pending DM, and preserved identical-text drafts with different recipient IDs after a refused write and membership change.

PC14 draft-continuity work is frozen separately at 38a2957b for Sol review: authenticated layout-owned memory caches, actor/sign-out clearing, and explicit capacity handling replace silent eviction. Root browser at 3191 verified Messages → Task Discussion → Messages retains the exact unsent text and selected mention count. First-contact language check: 360 files, seven existing baselines unchanged. Human research remains zero sessions; real Clerk lifecycle is not verified by this synthetic lab.

Additional owned preview proxy: loopback 3191, root session 66510, synthetic DB plea/work/pc10-discussion-browser/browser-fixture-OceKC5/tasks.db, upstream Next 3188. It runs the integrated Discussion service and seeded synthetic_task_a/ synthetic_task_b, with fixture-only HTTP interception. Startup uses node --import tsx --import ./src/test/register-server-only.mjs scripts/conversations/preview-server.ts. The earlier direct tsx invocation failed before service startup because server-only lacked its test register; the supported harness then started successfully. Browser exercised a canonical Alice comment. Discussion correction will require a fresh proxy; this current one is pre-correction.

PC14 draft-cap correction 6d411c72788e62ea3ac1a839f9f971cc4fdd10fe accepted independently by Sol: union inventory includes text, selected-recipient-only, pending and recovered scopes; unresolved work cannot be silently discarded; exact Project/DM/root reopening reauthorizes the source. Focused model/render tests 10/10, scoped lint and full TypeScript pass. Root actual browser at 3191 held one Project draft plus 19 separate reply drafts, opened the twentieth reply and observed all 20 saved entries with the composer disabled. Opening saved reply 2 selected canonical topic 1 and restored exact text “Saved reply draft 1”. Text and Maya’s checkbox also survived Messages → Task Discussion → Messages. The pre-correction Discussion service remains a separate open milestone.

Phone capacity evidence at 115344b8: 390×844 viewport; document scroll width 390; dialog clientHeight and scrollHeight both 844; saved-list viewport 234px with 739px scrollable content. Screenshot evidence/draft-capacity-mobile.png is an actual capture from the synthetic connected browser. Explicit Discard saved draft freed one space and allowed “New draft after explicit discard.” Rendered union regression remained green after styling; first-contact language 361 files, seven baselines unchanged. This is a local subtask receipt, not PC14 readiness or live-user acceptance.
