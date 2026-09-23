# PC-06 durable internal conversation backend

12 September 2026 · implementation candidate · branch `feat/project-conversation-backend`

Integration note, 22 September: this is the original PC-06 report. The
receiving migration is now `0032_project_conversations`, after the January
`0028`–`0031` Tasks migrations. The SQL content hash below is unchanged; the
receipt file changed to record the new ID, so its historical receipt hash is
not the receiving receipt hash. The receiving migration ledger is authoritative.

## Result

The backend now provides one durable project conversation per canonical Tasks `workspaces.id`. The injected service implements authenticated-actor resolution, read-only discovery, ensure, exact current audience, send, receipt lookup, change-history retrieval, own edit and own tombstone. Every operation rechecks the stored Project and current membership inside the same transaction or read snapshot as its source access.

Send commits the message, change row, in-app attention, body-free outbox intent and durable receipt atomically. The same actor/conversation/request tuple returns the original receipt; a changed normalized body, root or mention set returns `request_conflict`. Edits and tombstones use the same request identity rule and optimistic revision check. Tombstones set the stored body to `NULL`, remove pending source derivatives and replay only a body-free record.

`src/server/conversations/database.ts` makes the database boundary explicit. A remote adapter requires the client's interactive transaction API. The verified local shape serializes every transaction on one injected persistent connection and uses `BEGIN IMMEDIATE` for writes. An unavailable or unverified adapter fails closed. The service imports neither the ambient Tasks database nor PC-04 spike fixtures.

Clerk subject resolution queries only `users.clerk_id`; it never treats a Clerk ID as a canonical `users.id` and never provisions or falls back to demo identity.

## Schema and migration

`0028_project_conversations` follows `0027_share_link_token_hash` as an additive forward migration. Its canonical LF SHA-256 is `7d1f8ecf781cb8cac6f5f931ffe61da6e10eb7c43783eacf10797918d58c2416`; its local-dry-run/CI review receipt SHA-256 is `7cf267215a8fb374b53d23c799925b3b597b3b914728157165d14b36a015f404`.

The migration adds the conversation aggregate, source messages, ordered changes, operation receipts, in-app attention and a body-free delivery outbox. Database triggers independently enforce canonical source relationships with foreign keys disabled, advance every conversation epoch for raw membership insert/delete/role-or-key update, synchronize archive/restore lifecycle and epoch, and explicitly clean Project-owned conversation rows on Project deletion. The partial unique index permits exactly one project conversation for one `workspaces.id`. DM-shaped rows remain rejected until PC-10 supplies the complete consent and retained-history service.

The receipt authorizes isolated local dry runs and CI only. No migration was run against a remote database. Application rollback disables creation and sends while retaining tables, receipts and acknowledged history; dropping stored history is not part of rollback.

## Verification

Synthetic file databases used three canonical users, two Projects and exact `workspace_members` rows. With `PC06_WORK_DIR=C:\Users\ethan\Documents\Codex\2026-09-12\plea\work\pc06`:

- `node --import tsx --import ./src/test/register-server-only.mjs --test src/server/conversations/service.persistence.test.ts` — passed 6/6 in 5.73 seconds. This covered strict Clerk mapping and unavailable storage; 20-way ensure and 40-way same-request send; changed-payload conflict; atomic row counts; injected rollback after source/change/attention/receipt; cross-Project and cross-root forgery; raw membership revocation and epoch mismatch; archive read/write behavior; edit conflict; paginated tombstone replay; deleted-body absence; derivative removal; and guard enforcement with foreign keys disabled.
- `node scripts/check-migration-contract.mjs` — passed: Tasks 29 SQL files, baseline `0014_current_schema_baseline`; Timeline 2 SQL files, baseline `0000_timeline_baseline`.
- `node --test scripts/db/migration-ledger.test.mjs scripts/db/timeline-migrate.test.mjs scripts/db/timeline-inventory.test.mjs scripts/db/timeline-binding-classification.test.mjs scripts/db/timeline-backfill-bindings.test.mjs` — passed 59/59 in 3.49 seconds, including fresh baseline-plus-forward apply, proof guards, no-op replay and atomic failure behavior.
- `.\node_modules\.bin\tsc.cmd --noEmit --incremental false --pretty false` — passed with no output.
- `.\node_modules\.bin\eslint.cmd src/server/conversations/database.ts src/server/conversations/service.ts src/server/conversations/service.persistence.test.ts src/server/db/schema.ts scripts/db/migration-ledger.test.mjs` — passed with no output.

## Limits and remaining gates

This local evidence does not verify Turso primary forwarding, remote transaction behavior, multi-region latency, Clerk session revocation timing, provider delivery or production migration safety. No production execution receipt exists. HTTP/auth integration, UI integration and internal flag/allowlist behavior are owned by their separate packets and must be retested after integration. DM consent, read coverage, delivery draining and task/Notes outcomes remain later backlog tasks. The amended PC-03 human study remains a release gate; this implementation is not permission for a real-data pilot or release.

## Independent review correction — 12 September 2026

Frozen 43507a5c review found unmentioned-member fanout and cached-actor access after raw user deletion with foreign keys OFF. Both counterexamples were reproduced by two failing persistence tests before correction. Project attention/outbox now use the validated explicit mention set excluding sender. Operation authorization requires a live users row; raw account deletion removes memberships through an FK-independent trigger, advancing only affected epochs. Regression also reinserts an orphan membership and proves it cannot authorize a missing account.

After correction: focused persistence/HTTP/reducer suite 19/19 passed (5,516.8443 ms); migration ledger suite 20/20 passed (3,419.254 ms), including fresh apply and no-op replay; migration contract passed with 29 Tasks / 2 Timeline SQL files. SQL and receipt hashes refreshed. Narrow independent acceptance pending; no remote, real Clerk, delivery or release acceptance claimed.
