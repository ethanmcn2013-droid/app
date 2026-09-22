# PC11 deterministic fixture and race matrix

Scratch preparation only. Repository source remains unchanged. Baseline for the isolated implementation worktree is `856abd41b5dd9bb345c402ea6bbc9fb12f5ce38a`; Task Discussion/0031 files stay frozen until its correction is accepted.

## Fixture topology

Use one synthetic SQLite file and the single queued `ConversationDatabaseAdapter` shared by conversation, Task Discussion, attention, and drain services. Seed live canonical users `alice`, `bob`, `maya`, Projects `Project-alpha` and `Project-beta`, one active Project room, one active Alice/Bob DM, one task discussion, and one task root by Alice. Keep fixture builders parameterized by `nowMs`, generated lease token, and sink result. No ambient DB imports.

The capture sink stores only `{eventId,recipientId,providerKey,channel,deepLink}` and rejects any recursively discovered `body`, `title`, `name`, `email`, `snippet`, or `payload` property. A missing sink is represented by no sink dependency, not a sink that returns success.

## Quiet-hour clock vectors

Use `Europe/Dublin`, quiet interval `22:00` through `07:00`, and compare absolute retry instants. These values exercise 23-hour and 25-hour transition days:

| Case | Local now | UTC now ms | Expected local release | Expected UTC release ms | Delay |
|---|---:|---:|---:|---:|---:|
| Spring forward | 2026-03-28 22:30 | `1774737000000` | 2026-03-29 07:00 | `1774764000000` | 7h 30m |
| Spring after jump | 2026-03-29 00:30 | `1774744200000` | 2026-03-29 07:00 | `1774764000000` | 5h 30m |
| Autumn fallback | 2026-10-24 22:30 | `1792877400000` | 2026-10-25 07:00 | `1792911600000` | 9h 30m |
| Autumn before repeat | 2026-10-25 00:30 | `1792884600000` | 2026-10-25 07:00 | `1792911600000` | 7h 30m |

Also assert `[start,end)` boundaries: 21:59 is deliverable, 22:00 is quiet, 06:59 is quiet, 07:00 is deliverable. Equal start/end means quiet hours disabled. A null or invalid timezone makes external delivery ineligible and keeps the row pending with a typed configuration reason; it never assumes UTC.

## Claim and acknowledgement races

1. Seed due `pending` rows in both source outboxes. Claim at most the batch limit in a short write transaction. Assert every claimed row is `leased`, has the same returned lease token, and has `lease_until = now + leaseMs`; no sink call occurs before commit.
2. Start two claims against the same file through the shared adapter. The disjoint claimed event sets must have an empty intersection.
3. Seed an unexpired lease. A second worker claims nothing. Advance exactly past expiry; it can reclaim, increments `attempt_count`, and receives a new token.
4. Reclaim with token B, then acknowledge with stale token A. The conditional update affects zero rows and leaves token B/state intact.
5. Sink returns accepted, then simulate response loss before acknowledgement. Reclaim after expiry with the same stable `providerKey`; accepted acknowledgement inserts/upserts one delivery and marks one outbox row delivered. Repeated acknowledgement is idempotent.
6. Sink returns `unknown`. Leave recoverable work leased until expiry; never mark delivered. Retry uses the same provider key.
7. Eight retryable failures advance deterministic backoff and then drop with body-free error code. A nonretryable failure drops immediately.

## Recheck after claim

For each case, claim first, mutate canonical state in a later queued transaction, then drain. Assert the sink is never called and the stale token cannot override the resulting disposition.

- Delete/revoke the recipient's Project membership: drop.
- Delete the recipient user: drop through explicit cleanup even with `PRAGMA foreign_keys=OFF`.
- Archive the Project: pause or drop according to the accepted PC11 policy, but never deliver.
- Tombstone the message/comment or move/delete the Task Discussion source: drop.
- Edit away the mention/follow reason or change the source revision without an eligible reason: drop. An eligible recomputed revision may replace pending work only through the source transaction.
- Increment audience epoch: drop the stale leased row.
- Block or leave the DM: drop. A blocked pair's retained history does not authorize new delivery.
- Mute the source after claim: drop external work while preserving the directed Inbox event.
- Add a live visibility lease after claim: return to pending at lease expiry.
- Enter quiet hours after claim: return to pending at the exact local quiet-end instant.
- Disable sends or external delivery after claim: pause the drain and release/requeue without sink calls or terminal delivery writes.

## Attention and observation cases

- One Project mention produces one event. Mention plus followed reply and DM plus mention each produce one row/event with ORed reason bits.
- An ordinary reply to an explicitly unfollowed root creates no directed event. A later explicit mention restores follow and produces one event.
- Listing joins canonical source and author only after current access checks. Deleted/moved sources and revoked members disappear; blocked DM history is listable only under the accepted retained-history rule.
- `observe` updates only caller-owned accessible event IDs and merges only caller-supplied visible ranges. Replaying or overlapping ranges is monotonic and yields disjoint coverage.
- `markAllObserved` captures event IDs and per-root high-water inside one write transaction. A send queued after that capture remains unseen.
- Sends off still permits list, summary, observe, and mark-all. Missing provider leaves rows pending and makes drain unavailable.

## Migration assertions

Apply the accepted 0031 plus 0032 to both a fresh file and an upgraded 0014 lineage. Backfill conversation attention revision/time from canonical messages, classify existing DM rows as `DM`, retain Project mentions, and preserve Task Discussion reason bits. Run ledger/checksum verification. With foreign keys off, raw deletion of users, Projects, conversations, tasks, messages, comments, attention, preferences, follows, ranges, leases, and deliveries must leave no unauthorized readable item or deliverable row.
