# Local execution and rollback controls

12 September 2026. Preparatory PC-20 work; integration and provider controls remain unverified. No deployment, remote migration or notification was performed.

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

None of these integrated checks is claimed complete by the current pure switch tests. Native libSQL stress crashes must remain in the experiment report, alongside the bounded connection configuration that passes; a local driver workaround is not a deployed scalability proof.

## Owned preview

Source worktree: `feat-project-conversation-prototype`; final current source includes prototype fixes and unchanged paper constants moved out of Next route exports. URL `http://127.0.0.1:3187/lab/project-conversation`. The declared Next development command is invoked through the installed Next binary with `--webpack --hostname 127.0.0.1 --port 3187`. Webpack is explicit because dependencies are reused via an existing node_modules junction.

Root launcher: `C:/Users/ethan/Documents/Codex/2026-09-12/plea/work/start-conversation-preview.ps1`. Session 44547 is this task's owned preview process. It strips relevant inherited provider variables in its child shell, refuses a worktree containing `.env*`, sets documented review mode and memory-only DB URLs, disables Next telemetry and binds loopback. It neither copies credentials nor modifies shared dependencies. Stop only this owned session/process, never every Node process or an unrelated port listener.

HTTP 200 and browser rendering verified. Known existing server-build warning: OpenTelemetry/Sentry dynamic dependency expression; DSNs are unset and no runtime/browser error was observed. The initial cold compile caused one browser navigation timeout before HTTP 200; subsequent warm navigation succeeded. Cold development compile time is not a production performance measure.

Required final artifact record: canonical commit, checks against final source, screenshot hashes, 1440×1000 and 390×844 evidence, design/human disposition, and remaining remote/provider gates. Screenshots are retained beside this document under `evidence/` and copied to the user-facing output directory.
