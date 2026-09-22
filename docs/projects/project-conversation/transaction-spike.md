# PC-04 local transaction and revocation spike

12 September 2026 · Local synthetic evidence · Accepted integration code `85963f762fd07861608554e8f8bbd67413c75829`

## Disposition

The final integrated local-file EX-01 suite passes O01–O13: 17 tests passed, zero failed, exit 0, in 8,193.4299 ms. A fresh Astra reviewer accepted the frozen correction and inspected the final evidence without rerunning tests. This establishes bounded local feasibility of source/change/attention/outbox/receipt ordering, audience invalidation and same-snapshot authorization in one libSQL file database. It is not acceptance of a production schema or adapter. PC-03 remains the human gate before backend integration unless explicitly amended, and remote primary/replica evidence remains unavailable.

The spike is isolated to `scripts/conversations/`; `proposed-schema.sql` is deliberately outside the active Drizzle migration ledger. It imports no ambient database module, reads no `.env`, uses no credentials, and performs no network calls. Every identity and record is synthetic.

## Reproduction and environment

Command:

```powershell
$env:PC04_WORK_DIR='C:\Users\ethan\Documents\Codex\2026-09-12\plea\work\transaction-spike-accepted'
node --test scripts/conversations/transaction-spike.test.mjs
```

Final evidence: `C:\Users\ethan\Documents\Codex\2026-09-12\plea\work\transaction-spike-accepted\run-2026-09-12T10-44-59.459Z-22000\evidence.json`. The disposable run directory contains 18 uniquely named file databases. A durable JSON copy is committed as [transaction-result.json](evidence/transaction-result.json), alongside the executable tests and this record.

| Setting | Observed value |
|---|---|
| Runtime | Node v22.23.2, win32-x64 |
| Driver | `@libsql/client` 0.17.3, existing immutable install |
| Canonical fixture baseline | 14 sorted migrations, `0014_current_schema_baseline.sql` through `0027_share_link_token_hash.sql` |
| Independent clients | Two separately created clients per case |
| Journal | WAL |
| Foreign keys | OFF for the main suite; O11 repeated with OFF and ON |
| Busy timeout | 100 ms per client |
| Synchronous | 2 (`FULL`) |
| Locking mode | `normal` |
| Page size | 4096 bytes |
| External calls | 0 |

Installed source inspection found that `@libsql/core` 0.17.3 maps transaction mode `write` to `BEGIN IMMEDIATE`, and the local adapter's interactive transaction allocates a detached native database handle. The final local harness issues `BEGIN IMMEDIATE` and `BEGIN TRANSACTION READONLY` explicitly through the installed client on one persistent connection, with one queued operation per client and explicit commit/rollback. It never waits on network work while a transaction is open.

## Final observations

| Oracle | Result | Executed observation |
|---|---|---|
| O01 | Pass | Forced failure after source, change, attention, outbox and receipt. Each transaction rolled back to 0 source/change/attention/outbox/receipt rows; create sequence remained reusable. |
| O02 | Pass | Response dropped only after commit. The second client recovered the original receipt; cardinality was exactly 1/1/1/1/1. |
| O03 | Pass | 10,000 duplicate submissions used 40 logical submission workers queued across two clients, with at most one active transaction per client. One logical source and all effects remained. |
| O04 | Pass | CRLF/LF and sorted/deduplicated mentions recovered the same receipt. Changed body, root or mentions returned `request_conflict`. Same body with a different request ID created a second complete logical message. |
| O05 | Pass | Wrong Project, nonmember, cross-room root, reply-to-reply and invalid mention attempts returned neutral/invalid failures and inserted nothing. Malformed body input returned `invalid_input` rather than throwing. |
| O06 | Pass | Raw membership removal committed first. The second client refused send, read and receipt recovery, including the fast receipt path. |
| O07 | Pass | Send committed first and returned one receipt. Removal then prevented the departed sender's later reads/recovery while the remaining member retained the committed source. |
| O08 | Pass | Raw membership INSERT, role UPDATE, key UPDATE for a non-DM member, DELETE, account deletion, archive/restore, participant consent and DM state updates advanced matching epochs and wrote audience changes. Unrelated Project epochs stayed unchanged; stale send refused. Membership key mutation for a DM identity was rejected. |
| O09 | Pass | Block/leave prevented sends and confirmation, including after membership removal/rejoin. Both restrictive pair states survive churn. Normal rejoin resets both consents; one fresh confirmation does not reactivate, two do. Stale confirmation epochs and archived-room confirmation refuse. Membership loss denies departed history; unaffected entitled history remains readable. A third person remains unavailable. No owner-directed unblock operation is implemented in this spike. |
| O10 | Pass | Create/edit/delete kept one source ID with revisions 1/2/3. Stale revision refused. Duplicate, cursor-0 and reverse replay converged on revision 3 tombstone. The change ledger has no body column, the canonical message body is NULL, and no old body appeared in the response. |
| O11 | Pass | With foreign keys both OFF and ON, SQL guards rejected null/foreign tenants, missing/cross/reply roots, malformed/reversed/foreign DM pairs, participant identity mutation, third-member DM source/attention/outbox injection, bad revision change and bad receipt source. Explicit workspace cleanup removed all owned messaging rows with FK OFF. |
| O12 | Pass | Directed attention and pending outbox exist without a worker. An unmentioned Project member receives no directed event. Observing the root stream marks only the root event; the hidden reply remains unobserved. |
| O13 | Pass | The second client read one source before removal, then a new read transaction after removal returned only `unavailable` and no content. Authorization and content query ran in the same read snapshot. |

Final O03 measurements:

| Counter | Value |
|---|---:|
| Submissions | 10,000 |
| Logical submission workers | 40 |
| Maximum active transactions per client | 1 |
| Total time | 3,667.183 ms |
| Throughput | 2,726.89 submissions/s |
| Latency p50 | 6.271 ms |
| Latency p95 | 10.127 ms |
| Latency p99 | 14.551 ms |
| Maximum latency | 2,132.540 ms |
| Write transaction attempts | 3 |
| Explicit busy retries | 1 |
| Committed source/change/attention/outbox/receipt | 1 / 1 / 1 / 1 / 1 |

The maximum includes the first two-client write contention and queued wait. These retry timings are local process measurements, not the healthy durable-send target, deployed function latency, or a cost model.

## Driver finding and failed runs

The unbounded shape is unsafe with the installed native local adapter. A first 40-worker run using `client.transaction("write")` for every duplicate crashed Node with Windows access violation exit 3221225477 (`0xC0000005`) after 84.97 seconds; O01 and O02 had passed before the crash. Installed source shows each interactive transaction detaches a database handle, while `Sqlite3Transaction.close()` only rolls back an open transaction. This is evidence for a one-operation-per-client queue and duplicate read fast path; it is not evidence about the remote HTTP/WebSocket adapter.

Subsequent failed runs were retained as engineering evidence:

| Run | Pass/fail | Finding and correction |
|---|---:|---|
| Initial unbounded interactive run | 2 pass, 1 process failure | Native access violation under 40 simultaneous transaction users; stopped this configuration. |
| First bounded full run | 11 pass, 3 fail | O09 exposed reuse of the unaffected member's pre-loss consent; both consents now reset. Two O11 failures were incorrect expected counts for the unrelated Project's empty change ledger. |
| Schema correction run | 0 pass, 14 fail | Reserved alias `returning` caused setup syntax failure; renamed before further evidence. |
| Bounded interactive full run | 14 assertions passed, process exit failure | Native access violation occurred during teardown after all assertions, consistent with detached interactive handles. |
| First persistent-connection run | 13 pass, 1 fail | O03 duplicate transaction attempted `COMMIT` with a just-read statement in progress. The no-write duplicate branch now ends its snapshot with `ROLLBACK`. |
| Earlier worker run | 14 pass, 0 fail | Superseded by integrated attention and DM correction evidence. |
| Directed-attention regression | New test failed before correction | Unmentioned Project member received one directed event; recipient filtering corrected. Integrated suite then passed 15 tests. |
| DM correction red run | 0/3 O09 tests passed | Direct confirmation and membership churn could erase restrictive states; fresh-epoch/archive tests also introduced. |
| Final integrated run | 17 pass, 0 fail | Exit 0; no skipped, cancelled or todo tests. Block/left preservation, fresh consent and directed-attention regressions pass. |

Two review findings were also fixed before the first full suite: change rows initially duplicated message bodies, which could retain deleted text, and payload-derived source IDs collided for intentional same-body requests. The final ledger stores references only and joins current canonical state inside the authorized read snapshot; source/event IDs derive from conversation, actor and request ID while the separate payload hash detects conflicts.

## Reusable local interface

`transaction-store.mjs` exports `FIXTURE`, `createFreshSpikeDatabase`, `openConversationSpikeStore`, `mergeChangePage`, `LostResponseError`, `SeamFailureError`, and explicit baseline/schema/fixture helpers. A store exposes `send`, `lookupReceipt`, `readChanges`, `edit`, `tombstone`, `confirmDm`, `listAttention`, `markObserved`, `close`, plus diagnostic `client` and `counters` fields.

Receipt recovery is an authorized read. A committed receipt may be recovered after archive or with a stale draft epoch because it creates no write; a changed payload still conflicts, and a removed actor remains unavailable. Every new write rechecks exact current membership, archive state, DM state and expected audience epoch.

## Evidence boundary

This suite does not prove Turso primary forwarding, remote transaction timeouts, deployed replica freshness, multi-region ordering, Clerk session-revocation timing, Resend/provider acceptance, external delivery worker behavior, production performance, or provider cost. The separate accepted [EX-02](sync-spike.md) proves bounded cross-process local visibility and fixture HTTP cache headers. No remote or provider test ran. Local WAL locking is not evidence of Turso primary consistency; the designated remote environment remains a deployability gate. No production or real-data authorization follows from these results.
