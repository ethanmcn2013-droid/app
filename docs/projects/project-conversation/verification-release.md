# Verification and release controls

12 September 2026 · The traceability matrix below originated during planning. Current executed results and milestone dispositions are in STATE, operations-local, backend-report and task-outcomes-report. Local PC-00–08 are accepted; full VS1/VS2, human, remote and release gates remain distinct. Historical statements that no implementation tests ran apply only to the initial planning checkpoint.

## Traceability: original tests

Original identifiers refer to report `02-product-ux-technical-plan.md` §16. PC tasks are in [delivery-backlog](delivery-backlog.md). VS1/VS2 are internal synthetic acceptance stages, G3 is real adult-team pilot, G4 guest, G5 optional AI. Each row states the independent invariant to assert.

| Test | Preserved scenario / oracle | Tasks / stage |
|---|---|---|
| T01 | Drop reply after DB commit: same request recovers same canonical message, one DB source/outbox effect | PC-04/06/07/09; VS1 |
| T02 | Double Send, client/worker retries: unique source and recipient/channel effect, no extra visible row | PC-04/06/10/11; VS1/VS2 |
| T03 | Two clients concurrent sends: committed order consistent and replay gap-free | PC-04/06/09; VS1 |
| T04 | Offline old-message edit/delete: revision/tombstone wins, no stale content resurrection | PC-06/10/13; VS1/VS2 |
| T05 | Remove member with room open: post-commit authorization denies future reads/writes; new post-revoke content absent | PC-04/05/09; VS1 |
| T06 | Stale subscriber/long-running client: no sensitive late payload. Polling has no content-push subscription; exercise stale response and optional broker separately | PC-05/09; VS1; broker only if selected |
| T07 | Delayed job after revocation: current recipient/source check drops event; no stored body sent | PC-11/20; VS2/G3 |
| T08 | Restricted work/file link to guest: no title/person/date/thumbnail/snippet, no grant | PC-16/17; G4 (internal card tests also PC-08) |
| T09 | Search/autocomplete after removal/deletion: zero restricted rows/snippets/informative counts | PC-13; VS2/G3, guest version G4 |
| T10 | Forwarded/scanned invite: GET/HEAD never grants/burns; only verified intended account explicitly accepts | PC-16; G4 |
| T11 | Wrong/expired/revoked/repeated accept: no broadening, stable same-actor receipt, generic rejection otherwise | PC-16; G4 |
| T12 | Audience changes during composition: epoch mismatch, text preserved for review, no surprise delivery | PC-01/04/07/10/16; all applicable |
| T13 | Hidden thread reply: opening main room does not mark it seen | PC-10/11; VS2 |
| T14 | Mention + followed reply: one canonical event with both reasons, one eligible delivery | PC-11; VS2 |
| T15 | Mute/quiet hours/DST/active screen/multiple devices: suppress interruptions correctly, retain message | PC-11; VS2 |
| T16 | Work creation acknowledgment lost: one task/note with stable receipt/link recovery | PC-08/12; VS1/VS2 |
| T17 | DM to wider work: explicit reviewed excerpt only, destination proof, restricted source preview | PC-08/10/12; VS1/VS2 |
| T18 | Malicious/oversized/active upload: reject/quarantine, never execute | PC-17; file gate only; no-file rejection in VS1 |
| T19 | Shared device account switch: prior drafts/history/responses cleared or discarded | PC-07/10/13; VS1/VS2 |
| T20 | Prompt injection/revoked AI source: no privilege expansion, disclosure or autonomous commitment | PC-18; G5 only |
| T21 | Archive/delete/recovery/export: current policy across sources, search, queues, links, derivatives | PC-13/20; G3; extend G4/G5 |
| T22 | Keyboard/screen reader/zoom/reduced motion/IME/mobile keyboard: no accidental send or inaccessible recovery | PC-02/03/07/14; every UI gate |
| T23 | Push denied/unavailable: usable in-app/configured fallback, no fictitious receipt | PC-11/16/19; G3/G4 |
| T24 | Rollback/queue outage: acknowledged sources retained, delivery replay idempotent and observable | PC-04/11/20; VS1/VS2/G3 |

T06 is adapted to the selected transport, not removed. Guest, file and AI tests hold their own release; they do not block unrelated safe synthetic internal work.

## Risks, packages and decisions

| Risk | Controlling tasks / owner / acceptance evidence |
|---|---|
| R01 another inbox | PC-03/11/15; founder/product; shared read-state and workflow interviews |
| R02 guest scope broadening | PC-01/16/19; technical lead + founder; negative ACL/history tests |
| R03 post-revoke disclosure | PC-04/05/11; technical lead; transaction barriers, delayed job, stale client |
| R04 duplicate/lost source/work | PC-04/06/08/12; technical lead; request cardinality and crash/replay receipts |
| R05 interruption fatigue | PC-02/11/15; product; deterministic policy plus pilot feedback |
| R06 missed replies | PC-10/11/15; design/product; hidden reply and return journey |
| R07 buried/forked work | PC-08/12; engineering; canonical task/note destination and source link |
| R08 guest entry/reachability | PC-16/19; founder/operations; wrong account, actual devices and unaided reply |
| R09 founder capacity | PC-00/15/20; founder; one slice, bounded work packets, support ceiling |
| R10 retention/derivatives | PC-13/17/18/20; founder/privacy reviewer; inventory/export/erasure/backup policy |
| R11 spam/harassment | PC-10/16/19; founder/operations; consent/block/rate limits/report resolution |
| R12 pupil audience | PC-00/15/19; founder; explicit exclusion and no accidental recruitment |
| R13 surveillance | PC-11/15/18; product/privacy; no presence/read receipts/reply scoring or body analytics |
| R14 provider/unit cost | PC-05/15/20; founder/technical; measured low/pilot/stress usage and provider decision |

| Original package | New tasks / treatment |
|---|---|
| WP01 charter | PC-00/01, decisions; pursuit approved, all build scope proposed |
| WP02 state inventory | PC-02 plus technical UX contracts |
| WP03 prototype | PC-02, frontend-only |
| WP04 study | PC-03, actual human evidence required |
| WP05 audit/spike | Audit now completed at stated source scope; PC-04/05 implemented experiments await gate. Sequencing deliberately split. |
| WP06 durability/authorization | PC-01/04/06/09 |
| WP07 project/DM/work UI | PC-07/08/10/12 |
| WP08 attention/search/operations | PC-05/11/13/20 |
| WP09 adult-team pilot | PC-14/15 |
| WP10 guest | PC-16/17/19, separate release and optional files |
| WP11 AI | PC-18, explicit expansion gate |
| WP12 release | PC-09/14/20 and each live stage |

| Original decision | Disposition / location |
|---|---|
| D01 pursue | Approved pursuit; README |
| D02 name | Messages proposed interface label; PC-02/03 |
| D03 navigation | Preserve current shell; optional prototype evaluation, D-PC05 |
| D04 contexts | VS1 project + Tasks, VS2 Project-scoped DM, canonical Discussion; broader workspace DMs require D-PC01 |
| D05 attention | Shared directed-conversation semantics, PC-11 |
| D06 guests | Fresh explicit shared room, PC-16; founder policy pending |
| D07 exclusions | Retained; no AI dependency, presence or sender-visible read receipts |
| D08 reuse/provider | Existing Clerk/libSQL first, PC-04/05, D-PC04 |
| D09 pricing | Pending before guest/AI activation; not inferred from current tier |
| D10 retention/admin/support | Founder/privacy gate before any real-data pilot |
| D11 capacity/provider/date | Relative backlog only; measured re-estimate after spikes; no launch promise |
| D12 pupil | Excluded; separate future assessment |

Additional audit cases:

| ID | New invariant / tasks |
|---|---|
| X01 | Forged author, workspace, root, destination, assignee and request hash never bypass explicit object authorization; PC-01/06/08 |
| X02 | No-matching-membership never uses legacy workspace/default actor; demo success never reaches authenticated chat; PC-06/07 |
| X03 | Raw SQL grant/remove, consent, block, leave, rejoin, erasure and role change all advance epoch; stale restore cannot resurrect guest/DM rights; PC-04/06/13 |
| X04 | Auth and content use one current primary snapshot; stale replica cannot disclose post-revoke content; PC-04/05 |
| X05 | New chat uses strict archive enforcement despite existing seam's defer default; PC-06/10 |
| X06 | Real Clerk users mentioned by IDs, not seed handle parser; no unauthorized mention candidate enumeration; PC-10/11 |
| X07 | Ordinary task due date is not published milestone; no user-private Notes become shared via filing; PC-08/12 |
| X08 | Two app replicas see same history; process-local SSE is irrelevant to success; PC-05/09 |
| X09 | Duplicate DM opening/pair reversal yields one conversation; no recipient consent or block bypass; PC-10 |
| X10 | Cross-DB Notes outcome survives each crash point, source/receipt mismatch fails, duplicate work not compensated by deletion; PC-12 |
| X11 | Unverified primary email fails despite existing invite comment; revoked inviter and consumed token race fail atomically; PC-16 |
| X12 | Absent email config/provider timeout is skipped/unknown, never delivered; expired worker lease cannot acknowledge another attempt; PC-11/20 |
| X13 | Chat duplication/export/deletion cannot leak DM or guest history via general Project operations; PC-13 |
| X14 | Late fetch after sign-out, cursor beyond max, pagination gaps and mark-all race cannot clear/read another session's content; PC-07/11 |
| X15 | Malformed Markdown, javascript/data URLs, oversized JSON, hostile mention spans and unsafe remote preview request fail safely; PC-06/13 |
| X16 | Committed project message/task comment has directed in-app attention even when external drain never runs; source/attention/outbox rollback together; PC-06/10/11 |
| X17 | Sender, owner, analytics and ordinary exports cannot query another person's seen timestamps/coverage; only reader's own state is exposed; PC-11/13 |

## Experiments with exit rules

| Experiment / accountable owner | Setup and rule | Dependents / failure disposition |
|---|---|---|
| **EX-01 durability/ACL** technical lead, Sol implement/Astra accept | Fresh file libSQL from supported migration baseline, two independent connections/processes, controlled commit barriers, event sink. Test before/after commit crashes, duplicate request payloads, sequence/tombstone, FK/trigger checks and revocation ordering. Then repeat remote-specific consistency in designated isolated Turso test DB with known auth mode. No lost acknowledged message, duplicate canonical effect or newly committed disclosure allowed. | PC-06/09 and every release. Remote target unavailable means remote acceptance blocked; never infer from local pass. |
| **EX-02 sync/cost** technical lead | Two Node instances sharing test DB; 10/50/200 visible clients, 10k corpus, named network profiles. Measure polling p95 latency, primary query count, lock wait, function duration, bandwidth. Healthy profile: same test region, 50ms round-trip baseline, 10ms jitter, no loss; degraded: 200ms+2% loss/60s disconnect. Log device and actual profile. | PC-06; if p95 remote visibility >1.5s or founder cost ceiling exceeded, choose approved opaque broker experiment or reshape before commitment. No hidden performance relaxation. |
| **EX-03 Notes recovery** Tasks/Notes integrator | Two isolated file databases, deterministic IDs/hash, crash after each store commit and before response/link completion. Exactly one note if destination committed; otherwise exact draft required or needs_review. Correct owner/filing, source edits/deletion/revocation at every crash point, no body reconstruction. | PC-12/14. No cross-store transaction assumption. |
| **EX-04 invite authority** technical lead + founder privacy reviewer | Clerk test identity fixtures for verified/unverified/changed primary/wrong account, scanner GET, two concurrent accepts, revoke inviter mid-flow, email sink. One authorized participant; zero new workspace memberships. | PC-16/19. Real device/account flow is separately required before guest release. |
| **EX-05 search/lifecycle** technical lead | Two Projects, one outsider, pair DM, shared guest, deleted/root/reply corpus; real FTS/LIKE and account export/delete, backups in isolated files. No restricted snippets/counts and p95 <=1s at 10k accessible messages. | PC-13/14. Falling back to LIKE still must meet the same scoped target. |

Recommended load assumptions are experiments, not observed traffic: small 10 visible clients, pilot 50, stress 200; do not adopt the stress case as an unlimited promise. Technical owner supplies evidence and founder accepts budget before choosing remote infrastructure.

## Test layers and execution safety

Unit tests assert independent state-machine transitions, exact audience/read rules, date/time-zone cases and merge idempotency; use existing `node --import tsx --test`. Integration tests use actual isolated libSQL databases and receiver/drain entrypoints, not SQL-string mirrors. Authorization tests enumerate actors and every read/output path in the permission matrix. Concurrency/fault tests use explicit barriers and durable DB counts, not sleep-only race tests.

Proposed runtime test paths: `src/server/conversations/conversation-service.test.ts`, `conversation-authorization.test.ts`, `conversation-concurrency.test.ts`, `conversation-delivery.test.ts`, `conversation-work-links.test.ts`; UI state test `src/lib/conversations/reducer.test.ts`; browser specs `e2e/conversations/*.spec.ts`. These files and commands targeting them do not exist yet. Extend existing CI test registration after implementation.

Execution startup must check test imports and every environment source before running them. Current `src/server/db/index.ts` can seed or connect remotely; do not import it against ambient developer `.env` values. Use dependency-injected local DB fixtures and no dotenv loader, private temporary paths under task `work/`, deny unexpected network, synthetic identity adapter unavailable in production. Clerk integration tests use designated test accounts only after environment authority; email always points at sink until outbound approval. Never run `pnpm test:smoke` blindly: its target must be examined first.

Candidate commands after safe harness setup:

```text
pnpm typecheck
pnpm lint
pnpm db:contract
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/conversations/conversation-service.test.ts
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/conversations/conversation-authorization.test.ts
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/conversations/conversation-concurrency.test.ts
pnpm exec playwright test e2e/conversations
pnpm first-contact:language
```

Add delivery/work tests and existing task, Notes, Timeline, tenant and suite-route regressions appropriate to edits. Before `pnpm test` inspect the full script/pretest chain: it includes parity checks needing `STUDIO_REPO_PATH`, source scanning and fixtures. CI `.github/workflows/ci.yml` checks out Studio for parity. Before `pnpm build`, inspect prerender/runtime imports and network/font requirements and use isolated configuration. Record why any unavailable full gate remains unverified. Do not disable a security test to pass the build.

Browser automation uses existing Playwright and axe. Deterministic checks run on a local synthetic server with documented port and browser versions; browser skill instructions apply when controlling the preview. No UI was built in this planning session, so screenshot evidence is appropriately absent. Visual inspection, founder direction approval, manual NVDA/screen-reader/IME checks and actual participant research are different evidence types.

### Short signature journey scripts

| Journey | Browser steps / observable result |
|---|---|
| A question → task | Open exact Project, explain audience, send, receive answer in second account, create task with explicit owner/date. Lose response after commit; retry returns same task/card. Check Tasks Schedule/Calendar and no accidental public milestone. |
| B task Discussion | Open task, discuss in canonical feed, leave via Project link, open directed reply deep link. Same comment ID/content, original context retained; no mirrored project post. |
| C decision → Notes | Select message, choose Save to my Notes, review text/private filing, save. Inject Notes receipt loss; recover same note, link pending is visible; another member cannot read private note. |
| D guest | Create fresh shared room in synthetic fixture; full address/scope/history review; scanner visit does nothing; wrong identity refused; verified correct account accepts once. Existing internal room remains invisible; revoke while open. |
| E catch-up | Root stream has quiet unread plus hidden followed reply. Open root only: reply remains unread. Open thread: corresponding Inbox event clears. Mute/quiet-hours/another device reproduce policy; no task marked complete. |
| F network recovery | Compose, disconnect before send and after commit; pending vs uncertain states honest. Reconnect original scope, reconcile same request; revoke/switch account during recovery, no auto-send or leaked draft. |

Each script runs keyboard-only, 1440×900 and 390×844, 320 CSS px reflow / 400% zoom, reduced motion, long/RTL/emoji content, and mobile keyboard/IME where applicable. Automated browser viewport emulation is not proof of real iOS push or physical touch behavior. Proposed performance targets retain report §15: local pending <100ms, healthy durable p95<=800ms, remote<=1.5s, warm open<=1s, search<=1s; record actual device/browser/region/corpus/network. No production SLA implied.

## Readiness and stop-line gates

- **G0 plan:** founder accepts scope/deviations and local-development envelope. Current work stops here. EXECUTE opens approved local tasks only.
- **G1 prototype:** accepted design and recorded formative results. No arbitrary score; dangerous audience confusion blocks backend integration until fixed or gate explicitly amended by founder.
- **G2 feasibility/VS1:** primary transaction, recovery, revocation and sync tests pass in their claimed environments; no known access defect or lost acknowledged message; no result says local proof equals production.
- **G3 adult-team pilot:** full VS2/integrated checks, policy/retention/operator/support and remote provider proof, cost ceiling, rollback rehearsal and explicit release/real-data permission. No invitation or production action follows merely from EXECUTE.
- **G4 guest:** G3 evidence review plus invite/history/block/report/device/file requirements and explicit external audience/privacy/commercial permission. No pupil participant.
- **G5 AI:** useful non-AI pilot, explicit product/spend approval, scoped/adversarial/factual tests and AI data handling review.

Stop the affected lane for unauthorized disclosure, lost acknowledged source, duplicate work after retry, audience ambiguity, cross-tenant fallback, unexplained migration drift, unverified production target, missing message-free operational logging, or exhausted approved capacity. Founder chooses material scope/budget changes. Guest/AI failures do not automatically invalidate already-proven unrelated internal features.

## Operations, cost and rollback

Feature-off is not schema rollback. Ship additive schema/capability detection first, code with flags off next, then isolated verification. Backfill/trigger/schema receipts must cover both fresh and upgraded synthetic DBs. Do not guess the next migration ID; integrator allocates from live ledger after resolving concurrent work. Active January release/Drive work has its own migration/operator gates. Messaging does not authorize or close them.

Outbox scheduling is an explicit deploy artifact and operator acceptance, not assumed from a route file. Use authenticated bounded drain, separate retry queue, metadata-only logs and oldest-age/failure metrics. Rehearse a stuck lease, provider timeout after acceptance, missing config, disable/re-enable and worker version rollback. Proposed diagnostic thresholds: >5-minute oldest due item warns operator; >30 minutes or sustained provider failure requires incident action. These thresholds need pilot calibration; they are not user notification cadence.

| Scenario | Assumptions / calculable demand (30-day illustration) |
|---|---|
| Small | 10 concurrently visible clients, 2h/day, one sync/s → 2.16m sync requests/month before multi-tab suppression |
| Pilot | 50 concurrently visible clients, same duty cycle → 10.8m sync requests/month |
| Stress | 200 concurrently visible clients, same duty cycle → 43.2m sync requests/month |

These deliberately expose polling cost. Count actual SQL statements per sync, response bytes, function durations and active-view hours in EX-02; no dollar cost is invented. Chat volume assumption 20 active Projects × 100 messages/day × 30 = 60,000 monthly messages; at 2 KiB body average about 117 MiB raw text before indexes/receipts/backups. A 20-recipient room can multiply attention/delivery fan-out by 20. Files and optional AI are separate and excluded from these text estimates. Compare measured cost with founder ceiling before pilot; if polling is uneconomic, broker decision is required. Product AI spend is not development-agent compute.

Monthly cost formula: DB read/write/storage + function/transport requests/duration + external notifications + observability/security + backup/retention + support hours + optional files/AI. Existing allowances/provisioning unknown; no assumption of free capacity or new payment. Limits must reject new sends explicitly before accepting, never discard acknowledged messages later.

Rollback rehearsal: stop new sends/guest invites; retain authenticated read-only history; pause external drain but preserve leases/attempts/request IDs; restore last compatible app version; verify old and new readers tolerate additive columns; replay pending events through current auth using original IDs; verify DB source counts, tombstone state and work receipts. If data integrity is suspect, stop writes and use a verified isolated backup restoration procedure under explicit production authorization. Never drop chat tables, erase idempotency receipts or send compensation deletes as an ordinary rollback. New guest/AI flags can be disabled independently.

Before live data, founder/privacy reviewer chooses retention period, author erasure/pseudonymization, backup expiry and restore deletion reapplication, permitted admin exports/support access and incident contact. No policy compliance certification is claimed. Private DMs are not E2EE. Delivered external notices and user downloads may survive revocation. Readable user policy must reflect those facts.

## Planning-package cross-check

One bounded cross-check will verify all 24 T, 14 R, 12 WP and 12 original D IDs, new task dependencies, file links, coherent scope and absence of product changes. Its final result is recorded in STATE. The technical review resolves known conflicts: Project=workspace; private Notes; milestone-only Timeline; no local SSE guarantee; strict archive policy; task comments preserved; no fake cross-store atomicity; provider configuration unverified; runtime model request distinguished from effective identity. Outstanding gates are explicit, not claimed passed.
