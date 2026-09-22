# PC11 attention and delivery implementation packet

Preparation baseline: integration `c2c79063cdd8995e00d3a6bed8247f28249c0bc3`; implementation waits for accepted PC10 DM and PC10 Task Discussion/0031. This packet changes no repository files.

## Existing seams and decisions

- `conversation_attention` is already committed atomically with a message, and `conversation_outbox` is already a body-free leased row. Project mentions and every DM currently use the same default reason bit; edits do not recompute recipients. Task Discussion plans equivalent `task_comment_attention` and `task_comment_outbox` tables. Keep these source-local ledgers and UNION them in one adapter. Do not copy them into a third event table.
- Directed seen state has one authority: `conversation_attention.observed_at` or `task_comment_attention.seen_at_ms`. Do not reuse `notifications.read_at` and do not add a second per-event observation table. Add shared disjoint coverage only for ordinary root/thread unread.
- Ordinary root unread is derived from canonical root `create_seq` values not covered by that reader's ranges; it does not need a duplicate attention event. Replies become directed only through DM, mention, or follow policy.
- `notifications` and `getNotificationsForUser` are task/payload based; current Inbox does not mark rows read. Leave historic reminders/direct alerts as a legacy section. New comment/message mutations must not call `notify`, whose separate ambient connection and payload can retain snippets.
- Reuse `user_preferences.time_zone`, but validate it as IANA. It is nullable today and the settings action only truncates it. External message delivery requires an explicit valid zone; it must not silently assume UTC. New external delivery opt-in defaults off and quiet hours default off.
- `suite_outbox` and `/api/cron/outbox` dispatch private JSON payloads to arbitrary consumers without leases. Reuse conventions only. PC11 gets an isolated sink and drain over the existing source outboxes.

Reason bits are shared constants: `MENTION=1`, `FOLLOWED_REPLY=2`, `DM=4`. Migration 0032 rewrites existing DM attention from `1` to `4`; existing Project rows remain mentions. A DM mention is one event with `DM|MENTION`, and a followed explicit mention is one event with ORed reasons. Self actions never create attention or external work.

## Typed service contract

Put public types in `src/lib/conversations/attention-contracts.ts`:

```ts
type MessageSourceKind = "conversation" | "task_discussion";
type AttentionReason = "mention" | "followed_reply" | "dm";
type AttentionItem = {
  eventId: string;
  source: { kind: MessageSourceKind; projectId: ProjectId; scopeId: string;
    itemId: string; rootId: string | null; revision: number; createSeq: number };
  reasons: AttentionReason[];
  seenAt: number | null;
  item: { body: string; author: { id: string; name: string }; createdAt: number };
};
type AttentionPage = { items: AttentionItem[]; nextCursor: string | null;
  unseenScopeCount: number };
type ObservedRange = { kind: MessageSourceKind; scopeId: string;
  rootId: string | null; fromCreateSeq: number; throughCreateSeq: number };
```

`createMessageAttentionService(adapter, controls)` exposes:

- `listDirected({actorId,cursor?,limit?}) -> ConversationResult<AttentionPage>`. Cursor is opaque `(source created-at,eventId)`. Live joins return canonical body/author only after current access proof. Deleted/moved sources and lost membership disappear. Blocked DM history remains visible to entitled pair members; pending/declined/left members do not.
- `observe({actorId,eventIds,visibleRanges}) -> ConversationResult<{observedAt:number}>`. Limits each list to 100, accepts only the caller's currently accessible events/sources, monotonically sets source attention seen fields, and merges only the supplied disjoint rendered ranges. It cannot expose another reader's state.
- `markAllObserved({actorId}) -> ConversationResult<{observedAt:number,observedEvents:number}>`. In one write transaction, capture accessible event IDs and each accessible source/root high-water, then update exactly that capture. A concurrent commit waits and remains unread.
- `setScopePreference({actorId,kind,scopeId,muted})`, `setThreadFollow({actorId,kind,scopeId,rootId,following})`, and `renewVisibility({actorId,kind,scopeId,rootId?,sessionId})`. Each reauthorizes current access. Visibility expires after 45 seconds and is private operational state.
- `getUnreadSummary({actorId}) -> {unseenScopeCount:number}` for rail/mobile badges. Count distinct `(kind,scopeId)` having unseen directed events after access and mute filters, never message count or tasks owed.

Message and Task Discussion send/edit transactions call shared executor helpers in `attention.ts`. Roots authored by the actor, replies authored by the actor, and explicit mentions auto-follow the root; an explicit unfollow survives ordinary replies and is cleared only by a later explicit mention. Replies materialize followers plus mentions; DMs materialize the other participant; upsert one attention row and one outbox row per source/recipient, ORing reasons. Edits add newly warranted reasons, clear removed reasons, and never re-alert an unchanged reason. Tombstones remove attention and drop pending/leased work while preserving delivered records. Set `source_revision` to the current canonical revision whenever still-warranted pending work is recomputed.

## 0032, schema, and guards

Add receipt-backed `0032_message_attention_delivery.sql`, ledger entry, journal entry, receipt JSON, schema mirrors, and migration/contract tests.

- Add `source_revision` and `created_at_ms` to `conversation_attention`; backfill from its message. The planned task table already has source revision; add `created_at_ms` only if 0031 omits it. Treat each table's `id`/`event_id` as the immutable global event ID.
- Add `conversation_read_coverage(user_id,source_kind,scope_id,root_key,range_start,range_end,observed_at_ms)`. `root_key=''` means roots. Store disjoint inclusive ranges; merge only overlapping/adjacent verified ranges. This is ordinary unread state, not another directed-event seen flag.
- Add generic `message_scope_preferences(user_id,source_kind,scope_id,muted_at_ms,pin_rank,updated_at_ms)`, `message_thread_follows(user_id,source_kind,scope_id,root_id,state,explicit_unfollow,updated_at_ms)`, and expiring `message_visibility_leases(user_id,source_kind,scope_id,root_key,session_id,expires_at_ms)`.
- Extend `user_preferences` with `message_external_enabled INTEGER NOT NULL DEFAULT 0`, `quiet_start_minute`, and `quiet_end_minute` (both null or both 0..1439).
- Add body-free `message_deliveries(event_id,recipient_id,channel,provider_key,status,provider_receipt,delivered_at_ms,updated_at_ms)`, unique `(event_id,recipient_id,channel)`. It is attempt/result metadata, not a queue duplicate.
- Add insert/identity/source guards and FK-off cleanup for users, Projects, conversations, tasks, comments, attention, preferences, follows, ranges, leases and deliveries. Preserve source tables on flag rollback. No title, body, name, address, URL or snippet is allowed in attention/outbox/delivery/receipt/migration reports.

## Drain and environment behavior

Create `delivery.ts` with conditional batch claim from both source outboxes on the same queued adapter. Claim `pending` due rows or expired leases in a short transaction with a random token; release the transaction before any sink call. Before dispatch, re-read canonical source revision and tombstone state, current Project/task relation, recipient user/membership, DM participant/history/block state, audience epoch, unseen event, mute, visibility lease, validated zone/quiet interval, and current flags. Sends off or delivery off pauses the whole drain without changing rows. Revocation/deletion/mute drops the row; quiet hours and visibility return it to pending at a calculated retry time.

`MessageDeliverySink.deliver({eventId,recipientId,providerKey,channel,deepLink})` receives canonical IDs and an opaque authenticated deep link only. It returns `accepted(providerReceipt)`, `unknown`, or `failed(code,retryable)`. A deterministic capture sink proves inputs contain no private text. Missing/unconfigured sink returns 503 before claims and never writes delivered. Provider key remains stable across retries; only `UPDATE ... WHERE state='leased' AND lease_token=?` can acknowledge. After eight failures mark dropped/dead-letter by error code. Quiet calculation uses `Intl.DateTimeFormat.formatToParts` in the explicit IANA zone and searches to the next local interval boundary, with 23/25-hour Dublin DST tests.

## Exact integration files

New server files: `src/server/conversations/attention.ts`, `attention-http.ts`, `delivery.ts`, `quiet-hours.ts` and focused tests; `src/app/api/message-attention/route.ts`; `src/app/api/cron/conversation-delivery/route.ts`. Extend `src/server/conversations/runtime.ts` so conversation, task outcome, Task Discussion, attention and drain services share the same adapter/queue. Extend `src/lib/conversations/flags.ts`; no second client/connection. The cron route uses the existing constant-time `CRON_SECRET` pattern, but no `vercel.json` schedule or live provider is claimed in PC11.

Extend `src/server/conversations/service.ts` and the accepted Task Discussion service only at their executor-level attention calls. Extend `src/server/db/schema.ts`, `preferences.ts`, `src/server/actions/preferences.ts`, the notification settings page/form, `src/app/app/inbox/page.tsx`, `src/components/app/inbox/inbox-app.tsx`, Messages/task discussion clients, studio rail and mobile nav.

`/api/message-attention` supports GET `list`, `summary`, `preferences`; POST `observe`, `mark-all`, `mute`, `follow`, `visibility`. It uses strict Clerk-to-canonical actor resolution, no-store headers, same-origin JSON writes, 48 KB bounds, exact field allowlists and neutral failures. Reads and observe remain available when sends are off; new external work and drain do not.

Minimum acceptance: source commit with no worker still appears once; mention+follow and DM+mention dedupe; unfollow/remention; hidden reply and paginated root remain unread; Inbox and Messages share event seen state; mark-all concurrency and multi-device monotonic merge; reader state absent from author/owner/analytics/export; mute and visibility suppression; quiet intervals across both Dublin DST transitions; revoke/archive/block/tombstone after lease; expired lease reclaim and stale-token ack denial; timeout/idempotent provider retry; missing provider leaves pending and reports unavailable; deterministic sink contains no private content; sends-off pauses drain while reads/observe continue; fresh and upgraded 0014→0032 migration plus ledger checks.
