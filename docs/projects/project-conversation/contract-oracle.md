# Execution contract and database oracle

Baseline: a709e22a9f19ffb4c45b1c420815f2edf6bfbf30; owned integration branch feat/project-conversation-integration. PC-00 accepted by integrator on 12 September 2026. No other active worktree was modified. Local January release has broader deletion and Tasks changes; these are not silently imported. Its `authorizeStoredProject` transaction-executor addition is absent on this base; the existing `proveProjectCapability` already accepts an executor and is the required integration seam. The `conversation.ts` task wrapper exists on the January branch only: the planning inventory's reference is contextual, not a file available in this selected base. Canonical comments remain available here. Before PC-08/10/13, recheck upstream task/deletion drift and port only required behavior with tests.

`src/lib/conversations/contracts.ts` defines transport shapes; `authorization-contract.ts` is an executable policy oracle, not an authorization adapter. It accepts trusted snapshots for tests and must never accept client snapshots in production. Identity comes from a valid server session before opening the database transaction. The eventual adapter loads the resource's stored Project, exact membership, both DM memberships/consent, retained-history entitlement and archive state in one primary transaction, using `proveProjectCapability(actor, project, capability, "enforce", executor)`. No ambient client or process database is imported by these initial contract modules.

## Complete epoch writer mapping

Use one aggregate epoch per conversation. Every source update and its epoch/change invalidation commits in the same transaction. Grant, role, removal, archive and restore invalidate all conversations with that exact workspace ID. These predicates are conservative and intentionally include all DMs in that Project. Explicit DM state/participant/block changes invalidate that exact conversation. Membership INSERT must not reopen a previously removed DM: retain the pair and require rejoin confirmation from both members. Workspace destruction explicitly cleans owned messaging rows, including when foreign keys are off; account suspension/removal clears eligibility before returning success.

| Canonical writer | Trigger/table coverage |
|---|---|
| `src/server/projects/service.ts` create/duplicate/delete | `workspace_members` INSERT; workspace DELETE cleanup |
| `src/server/actions/settings.ts` remove, role change, invitation accept (raw INSERT OR IGNORE) | membership INSERT/DELETE/UPDATE OF role/workspace_id/user_id; old and new Project for key change |
| `src/server/actions/planning.ts` bulk/duplicate creation | membership INSERT |
| `src/server/actions/templates.ts` template creation | membership INSERT |
| `src/server/account-erasure.ts` Project/user membership deletes | membership DELETE plus explicit user/workspace derivative cleanup |
| workspace archive/restore writers | workspace UPDATE OF archived_at; epoch never resets |
| future DM acceptance/block/leave/confirm | scoped pair/participant state UPDATE; no automatic consent on membership INSERT |
| synthetic direct SQL | identical triggers and explicit guard assertions, not action-only hooks |

Seed files and tests are not production writers. Workspace/user key changes must either be forbidden for conversation-associated identities or invalidate both old and new scopes. No mutable pair identity. Do not assume foreign keys prevent tenant mismatch; test with FK on and off. No trigger creates a duplicated Project-membership model for project conversations.

## EX-01 executable acceptance oracle

The local spike uses new uniquely named file databases, two separately created libSQL clients and synthetic identities only. It must not import `src/server/db/index.ts`, load `.env`, connect to remote URLs or use a live service. Apply the current supported schema baseline for canonical Project/member fixtures when testing integration seams; isolate proposed conversation SQL outside the active migration ledger until PC-06. Crash seams throw/close before or after commit; do not terminate an unrelated process.

| Case | Setup / forced ordering | Required observations |
|---|---|---|
| O01 durable commit | fail after source insert, change insert, attention insert and outbox insert in turn | no partial effects after rollback; no receipt; sequence allocation rollback permitted |
| O02 lost response | commit all effects, drop response, lookup original actor/room/request | one receipt with original ID; exactly one source/change/attention event/outbox; absent response never interpreted absent record |
| O03 retry stress | 10,000 duplicate submissions including concurrent clients | one logical source and effects, no new request identity; any transient busy errors explicitly retried with original key and counted |
| O04 payload conflict | repeat key with changed normalized body, root or mentions | request_conflict; no second effects; tuple includes actor and conversation; normalize CRLF only, sort/deduplicate authorized mention IDs before hash |
| O05 scope/root forgery | wrong route Project, nonmember, wrong-room root, reply-to-reply, invalid mention identity | neutral unavailable for access; invalid_input for entitled malformed roots/mentions; no inserts |
| O06 remove-before-send | raw DELETE membership commits; second client starts send/read/receipt | all refuse; no new body committed or returned; stale client epoch/session does not authorize |
| O07 send-before-remove | sender write lock/commit before remover lock/commit | one acknowledged message may exist; new reads/receipt after removal refuse departed user; pre-revoke in-flight response is not recallable |
| O08 epoch topology | raw INSERT/role/DELETE, archive/restore, explicit DM consent/block/leave/rejoin | matching-room epoch increases, unrelated Project unchanged, change invalidation exists, stale draft refuses |
| O09 DM retained history | block/leave/member removal/rejoin with two devices | no sends until active and both members current; departed history unavailable; unaffected retained history readable; third person never sees pair; rejoin does not auto-consent |
| O10 tombstone/revision | edit and delete after reader cursor, replay duplicate/out-of-order pages | same source ID, increasing change/revision; deleted body absent; stale revision refuses |
| O11 FK-independent integrity | execute raw bad room/tenant/root/pair inserts with FK on and off | CHECK/guard/transaction rejects malformed relationship; test explicitly rather than inferring from migration text |
| O12 attention without worker | source commit, never start external drain | directed event already visible once; hidden replies remain unobserved; no worker dependency for in-app attention |
| O13 read snapshot | remove before new reader snapshot; separate clients/processes | no forbidden content; each read proves exact member in its same snapshot; response no-store in later route |

Local success cannot prove Turso primary forwarding, deployed replica freshness, Clerk session revocation timing, multi-region performance or provider delivery. Those remain separate environment evidence. The spike must record driver/runtime, file DB settings, exact command, counts and latency, including failed assertions. Required write ordering uses the installed driver's write transaction (`BEGIN IMMEDIATE` semantics); no network calls while holding it. A new receipt response is emitted only after commit resolves.

PC-01 is accepted only after the typed oracle tests and a fresh contract review. PC-04 requires actual SQL/concurrency results; pure policy tests do not count for it. PC-03 remains the separately recorded human review gate before backend integration.
