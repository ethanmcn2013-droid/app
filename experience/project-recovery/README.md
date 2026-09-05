# Exact-project recovery prerequisite

2026-09-05. Delegated implementation on `feat/january-project-recovery`, isolated from exact base `a6293a82955d17bc414506ab89412f8667c1cd2f`. **Recovery prerequisite only. Event content denial is not enabled; sales remain unavailable.**

## Decisions and authority

- Independent `/settings/projects/[projectId]/recovery` avoids the normal `/app` membership admission and Tasks runtime/content loads. Its RSC page authenticates Clerk directly, does not provision an identity, and keys the panel by authenticated actor plus exact project. GET does not change active-project cookies.
- One existing project-settings DangerSection link carries its displayed project. No new catalog/navigation bulk. Existing `/settings/profile` retains account export and account deletion. DataPrivacy is reused unchanged; its JSON is not a byte archive.
- Tasks metadata/negative writes prove exact stored membership and account/project lifecycle locally. All current members may revoke Tasks links, including archived-project members under the prior deferred-archive revoke semantics. Only primary/co-owners unpublish the board; only the primary owner sees native-file recovery and can request deletion. No positive grant, restore, mint or rotate operation exists here.
- Project deletion delegates to the existing primary-owner service. Its fresh intent proof, provider-receipt policy and fences remain unchanged. No Drive connection/token/lifecycle files are edited.
- Timeline separately proves the local Timeline workspace's Clerk owner and the publication's stored source project inside the transaction. Tasks membership removal, project deletion or changed current Timeline binding does not itself erase that established negative-only authority. No frozen publication items or Tasks content are loaded to display it. Unknown/null historical source attribution is not inferred.
- Each of Tasks links, native files and Timeline publications is bounded to 20 visible records plus one lookahead. Independent exclusive-rowid cursors reach older records; scope is proved again on every page/action. A Tasks link handle combines rowid with an exact stored-row digest, so stale row reuse cannot target a replacement. Neither legacy bearer tokens nor token hashes/labels leave the store. Timeline revoke withdraws every active share version for the exact publication.
- Negative persistence is shared with the existing revoke/unpublish entry points. Short recovery transactions are scheduled per local client to avoid reproduced non-WAL libSQL contention; DB transactions remain the authorization boundary. Only SQLITE_BUSY is retried, at most four retries. No network/unknown-commit or project/provider deletion retry is added.
- Existing semantic styles and restrained feedback; no animation or new palette. Busy latch prevents duplicate synchronous clicks; failures remain visible, no optimistic deletion. Actual server readback replaces controls after a confirmed operation.

## Principal integration dependency

**The untouched module-boundary gate currently fails exactly one import.** Principal must approve/register the exact host bridge:
`src/server/project-recovery.ts` → `@/modules/timeline/server/project-recovery`.
Do not allow all host imports or route through unrelated GDPR interfaces. This patch does not edit scripts, package/default gates, CI, registry or HQ. It is not an all-gates-green candidate until the deliberate boundary allowance is composed.

Suggested mandatory serial command (30 tests):
```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/lib/projects/recovery-lock-retry.test.ts src/server/projects/recovery.test.ts src/modules/timeline/server/project-recovery.test.ts experience/project-recovery/route-action.test.mjs
```

Declared component preview/browser command (10 cases; fresh output):
```sh
node --import tsx --import ./src/test/register-server-only.mjs experience/project-recovery/browser.mjs
```
Optional `PROJECT_RECOVERY_OUTPUT` selects a **new** output directory. Server binds an unused loopback port and closes after the gate. No credentials/providers or full Next server.

Proposed registry surface for principal adoption: `settings.page.project-recovery`; changed existing entry `tasks.page.settings` DangerSection. Dependencies: route/action, ProjectRecoveryPanel, DataPrivacy, recovery model/host bridge/Tasks and Timeline stores, existing primary-owner deletion service and native attachment route, Settings layout and App styles/fonts. Principal owns final registry naming, registration, full-framework capture and receiving CI.

## Retained proof and limits

- 13 Tasks SQLite controls cover actual Event unknown/pending/active/naturally-expired/refunded/local-negative/shared-verification-unavailable outcomes; local recovery never manufactures commercial authority. They cover archived roles, transferred/removed/erased actor, paginated links/files, stale-row replacement and concurrent monotone revoke.
- 6 Timeline SQLite cases cover 25 exact-source publications, old current bindings, owner changes/deletion, all 26 active share versions, foreign source exclusion, transaction rollback and non-WAL concurrent requests.
- 2 lock controls cover non-retry of uncertain network commits, bounded lock retry and queue release/fresh evaluation after failure.
- 9 actual source route/action/native-HTTP cases use real local stores and writers with explicit Clerk/Next/store adapters. V3 ON/OFF is read from the actual flag function. They cover demo/no auth, no GET writes, removal/wrong account/malformed forms, late page reauthorization, old links, generic failures and partial-store availability. Existing primary-owner deletion really removes only B; native HTTP really streams synthetic local bytes for archived A while ambient B, and refuses freshly removed/foreign access before opening bytes.
- 37 existing service-lifecycle/archived-Timeline cases and 32 tenant/read/public-revalidation contracts passed. Typecheck and focused ESLint are clean. Language and route-manifest checks passed; module-boundary dependency above is unresolved.
- Browser: actual component/CSS/fonts, RSC page/action/controller and persisted readback through declared request/session/router adapters, 390×844 and 1440×960 light/dark, keyboard entry, member/unavailable/Timeline-only, failure/retry/duplicate click and older-link revocation. Not full Next/Flight/Clerk browser admission, provider behavior, physical device, human comprehension or council acceptance.
- Original failed receipts remain failures: SQLite contention; incorrect fixture migration path/state; per-connection total_changes observation; premature project-deletion retry expectation; a TS/CJS flag-import fixture issue and lint error. Corrections did not overwrite prior logs. The actual no-WAL regression is green after bounded scheduling.
- **Deletion limit:** an injected final project-delete SQL failure leaves the existing lifecycle intent/lease in progress. Immediate and 1.2-second retries are refused with generic failure and project retained; direct service returns `drive-work-in-progress`. Eventual completion after that existing lifecycle fence expires is **unverified** here. No lease rewriting, forced success, provider stub granting success, or held lifecycle review is performed.
- **Bytes/older-link limits:** local native-file HTTP and 21-file pagination are verified, not private Blob/Drive bytes, portable backup, or every native-browser error/download surface. 25-record older-link/publication pagination and exact persisted withdrawal are verified; no cross-request snapshot guarantee under simultaneous insertion/deletion, browser Back with concurrent list edits, full public-route/cache observation, or reconciliation of unbound historical publications is claimed. List entries expose creation date/state, not bearer strings or frozen titles.
- No content enforcement adapter, public/cache denial, historical mapping/backfill, schema/ledger migration, account-export change, new role/entitlement, or sales reopening. Personal Notes remains separate. These remain later milestones.

Evidence is retained in the unique LFS archive at `experience/reviews/january-recipient-2026-09-05/project-recovery-prerequisite.zip`, with normalized source hashes, original failure logs and final browser receipts. Principal/projectless handoff supplies exact commit and archive SHA. Evidence records base HEAD plus dirty source hashes; verify those hashes against the delivered commit, rather than treating the base HEAD as the changed runtime.
