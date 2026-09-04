# Status — Project Drive

## January takeover · 2026-09-04

This task is accountable for Drive. The stopped Drive task and package evidence below remain provenance. User-owned work was preserved: unpublished changes committed in 1ea5dd8a, January dependency integration 24a59e72 and migration CI 7d4040cb. PR #165 now targets release/january-2027; PR #168 assembles Drive with the other January work. Nothing here authorizes production.

**Latest complete Linux checkpoint: 50f16575d298cd2e2b7eb30f845da385e48e46bb.** Verify run 33916021010 passed lint, typecheck, full declared tests, db:contract 62/62, disposable migration fresh/no-op rehearsal, Drive stages 11/11 + 20/20 + 332/332, build and performance ceilings. CI 33916020920 and experience 33916020941 also passed. Shared runtime was 246.2 KB gzip against the 247 KB ceiling; the 170 KB target is still unmet. The former published deletion-order assertion and bundle-ceiling failure are superseded by this checkpoint, not excused as Windows faults. Later candidate commits need receiving gates.

A built local demo at 50f16575 plus scoped copy changes subsequently committed in 450dda44 passed all 132 critical browser cases with Drive UI enabled. Direct synthetic owner-change and reload-state review is in experience/reviews/january-drive-copy-20260904/README.md. The critical fixture is regression context, not proof of every Drive state. No provider result or human comprehension is inferred.

Independent scoped security review of immutable 50f16575 found no validated new Drive UI finding: 38 existing UI tests and 12 additional action-boundary tests passed. Existing backend code was traced only as needed; this is not a fresh exhaustive backend audit or live-provider acceptance.

## Current work packages

| WP | Package | State and next acceptance |
|---|---|---|
| 0 | Fix the floor | Historical acceptance retained. Browser-direct storage and single MAX_UPLOAD_BYTES (50 MiB, displayed 50 MB) remain. Native free allowance remains lower. Live regression is required before launch. |
| 1 | Two-account sharing spike | Historical 2026-09-02 success retained. Separate full in-product lifecycle remains unobserved. |
| 2 | Secrets | Implemented in ddbf7380 and retained through candidate checks. Production key/rotation/restore receipts remain separate. |
| 3 | Schema | 0028/0029 rehearsed against disposable local DBs, including no-op rerun/integrity/FKs. Production remains unapplied and gated. |
| 4 | Connection | Backend plus default-off Connections UI implemented. Actual OAuth/reauth/disconnect lifecycle and final UI acceptance open. |
| 5 | Folder and sharing | Backend, live-permission DTO, exact-email display, owner choices and same-journal handover continuation implemented. Real two-account grant/revoke/handover and failure recovery open. |
| 6 | Upload | Resources wired to same-claim resumable browser bytes and verified finalize. Mounted retry and definitive pre-delegation native fallback tested. Closed-tab pending discovery blocks new intake; safe ordinary probe/adoption and reselected-byte recovery remain incomplete. Live 50 MB/interruption/quota tests open. |
| 7 | Surfaces | 5cb93f68 and cd0df47e implemented A Custodian under delegated authority. 450dda44 clarifies copy. No specific founder selection or seven-seat lock is claimed. Full responsive/accessibility/state quality acceptance open. |
| 8 | Resilience/release | Backend candidate passes Linux checkpoint; metadata/native custody, deletion and repair stages are tested. Four workers are independently default off. Final combined checks, feature-disable recovery, operator/provider rehearsal and release evidence remain open. |

The UI build flag NEXT_PUBLIC_PROJECT_DRIVE_UI is not a global backend kill switch. Feature disable and worker controls must be rehearsed according to their actual semantics. No UI may claim Google revocation complete while provider state is pending.

See PROJECT.md, DECISIONS.md, UI-SLICE.md, UI-FOLLOW-UP.md, UI-MATERIALITY.md and the owning Studio programme index. Prior package details below are dated historical receipts, not current override authority.

## Open questions

Carried from planning. Each needs an owner and an answer before the package
that depends on it.

| # | Question | Blocks | Owner |
|---|---|---|---|
| ~~Q1~~ | ~~Is `BLOB_READ_WRITE_TOKEN` provisioned in production?~~ **Answered 2026-08-27: yes.** Present on the `app` project for Production, Preview and Development, created 24 days before. Uploads were live the whole time; the settings copy was simply false | — | closed |
| ~~Q2~~ | ~~Exact consent-screen wording shown for `drive.file`~~ **Answered 2026-08-27:** Google says Signal Studio can see, edit, create and delete only the specific Drive files used with the app. See `SPIKE-FINDINGS.md` Finding 8 | — | closed |
| ~~Q7~~ | ~~The second Google account to test sharing with — an email address, not a secret~~ **Answered and verified 2026-09-02:** `ethan@signalstudio.ie`; the complete two-account Google sharing spike is recorded in `SPIKE-FINDINGS.md` | — | closed |
| ~~Q3~~ | ~~CSP hosts needed for the Drive preview embed and the resumable PUT~~ **Answered 2026-09-02:** V1 opens `webViewLink` in a new tab, so no Drive frame host. Resumable PUT needs exact `connect-src https://www.googleapis.com` | — | closed |
| ~~Q4~~ | ~~Which single file-size number becomes the truth in WP-0~~ **Answered 2026-08-27 by the founder: 50 MB, made real by client-direct upload.** See D11 | — | closed |
| Q5 | Does the founder authorize migrations 0028 and 0029 against production through the target-bound `tasks-migration-execution/1` receipt workflow, after a verified backup and isolated-copy rehearsal | WP-3 | founder |
| Q6 | Privacy-policy wording for files residing in a member's personal Drive | WP-8 | founder |
| Q8 | A Custodian is the delegated internal implementation direction. Formal final design/state acceptance remains open; a renewed routine founder pick is not required. | WP-7 acceptance | principal integrator |
| Q9 | After UI and live acceptance, does the founder authorize production deployment, and then the activation of each of the four repair flags as separate operational decisions | WP-8 | founder |

---

## Evidence and verification log

Record what was actually observed, with dates. Claims without evidence are not
status.

| Date | What was verified | How | Result |
|---|---|---|---|
| 2026-08-27 | `permissions.create` accepts `drive.file` | Drive API v3 discovery document, revision 20260823, vendored at `docs/drive-api-v3-discovery-20260823.json` | Confirmed — only `drive` and `drive.file` are listed |
| 2026-08-27 | Repo has no cryptography helper | `grep` for `createCipheriv` / `createDecipheriv` across `src` | Confirmed — none |
| 2026-08-27 | Historical baseline: no Project Drive background worker | `vercel.json` at the start of WP-8 | Confirmed then; resolved on the feature branch by one shared count-only cron with four independently disabled repair paths |
| 2026-08-27 | Historical WP-0 baseline: server-action body limit was 8 MB | `next.config.ts` at the start of WP-0 | Confirmed then and contradictory to the 50 MB product promise; resolved with a 4 MB framework limit and browser-direct bytes while preserving the exact 50 MB product limit |
| 2026-08-27 | Settings claims uploads are inactive | `src/components/app/settings/sections/storage.tsx:87` | Confirmed — copy is unconditional, no demo branch, so every real customer saw it |
| 2026-08-27 | `BLOB_READ_WRITE_TOKEN` IS provisioned in production | `vercel env ls production` against `ethanmcn2013-1730s-projects/app` | Confirmed — Production, Preview and Development, created 24 days earlier. **Q1 closed.** The copy above was false, not merely stale |
| 2026-08-27 | Historical WP-0 platform finding: Vercel caps a function request body at 4.5 MB | https://vercel.com/docs/functions/limitations (last_updated 2026-08-24) | Confirmed — `413 FUNCTION_PAYLOAD_TOO_LARGE`, not configurable. The old `bodySizeLimit: "8mb"` was therefore unreachable and a 5 MB PDF could not be attached. Resolved by moving Blob bytes browser-direct while retaining the exact 50 MB product limit |
| 2026-08-27 | A ~5 MB PDF writes to, and reads back from, the PRODUCTION store | `node scripts/verify-blob-store.mjs` against production credentials | 8/8 passed: written (2.7 s), size and type as sent, read back through the download route's own `get()` call, `%PDF-` magic number intact, whole 5 242 880 bytes retrievable, **anonymous HEAD refused with 403**, scratch object deleted and confirmed gone |
| 2026-08-27 | The four contradictory numbers now derive from one constant | `pnpm test` → `src/server/upload-limit-contract.test.ts` | 11/11 passed. The test asserts source text, not just values, so a re-introduced literal fails CI even if it happens to match |
| 2026-08-27 | The ten §2 hard rules are enforced, not just written | `pnpm test` → `src/server/project-drive-hard-rules.test.ts` | 18/18 passed. Two rules (§2.8, §2.10) have live targets in WP-0's own code; the other eight ratchet on the Drive surface and start asserting against real code the moment it appears |
| 2026-08-27 | Client-direct upload cannot be steered by the browser | `pnpm test` → `src/server/attachment-client-upload-security.test.ts` | 20/20 passed: pathname is server-composed and exactly matched, prefix/suffix/escaped-separator impostors refused, content re-sniffed from the store, declared-vs-stored size mismatch refused |
| 2026-08-27 | The presigned upload works end to end, in production | `node scripts/verify-blob-store.mjs` | 17/17 passed across both paths. The one that matters: **a URL signed for one pathname is refused (403) when repointed at another** — without that, a member could write into any board in the store |
| 2026-08-27 | The bundle ratchet is not breached | `pnpm perf:budgets` after `pnpm build` | Baseline 904.7 KB gzip; `@vercel/blob/client` took it to 941.4 KB, over the 940 KB ceiling — a real regression, caught by CI on PR #159. Replacing the client helper with a presigned URL and a bare `fetch` brings it to **905.4 KB**, +0.7 KB over baseline. The ceiling was NOT raised |
| 2026-08-27 | Google Cloud is configured for Project Drive | Driven directly in the founder's browser, screens verified after reload | Project `signal-studio-496621`. Drive API enabled. Consent screen already **In production** — Clerk's Google sign-in had required it, so the seven-day refresh-token trap never applied. Exactly one scope registered, `drive.file`, under *non-sensitive*; nothing sensitive or restricted. A **new** client `Signal Studio Drive` created alongside the untouched `Clerk production` |
| 2026-08-27 | The consent screen's scope list was EMPTY before this change | Read before editing | Clerk's `openid`/`email`/`profile` are basic scopes Google does not register here. The feared "clearing the list breaks sign-in" case did not exist — worth recording, because the guide had been written to avoid a hazard that was not there |
| 2026-08-27 | All three secrets are in Vercel, all three environments | `vercel env ls` | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (encrypted), `PROVIDER_TOKEN_KEY` (encrypted, generated locally and never written to disk) |
| 2026-08-27 | `lint`, `typecheck`, `test`, `build`, `perf:budgets` | all five, on the WP-0 branch | All green, exit 0. The one Turbopack NFT warning was reproduced on a build WITHOUT the change and is pre-existing |
| 2026-08-27 | WP-1 live Drive spike | `scripts/spike/drive-chain.mjs` against the owner and intended member accounts | 11/12 harness checks passed. The owner-side folder, named-user grant, resumable upload, idempotency stamp, exact `drive.file` request and unattended refresh were observed. The member open/revoke/parent-isolation lifecycle remains pending; the exposed scratch token was revoked and must be reminted before phase B |
| 2026-09-02 | WP-1 two-account Google sharing spike | Live Google Drive browser session as `ethan@signalstudio.ie`, with owner API grant/revoke and links opened before and after revocation | Complete. Board folder and uploaded file opened without a request-access step; the `Signal Studio` parent showed **You need access**; deleting the exact permission made both child links show **You need access**. The disposable root was moved to owner trash afterwards. This did not exercise the in-product customer lifecycle |
| 2026-09-02 | WP-2 secrets substrate | `src/server/crypto/secret-box.test.ts`, `src/server/provider-token-custody.test.ts`, plus full branch gates | AES-256-GCM round-trip, tamper/wrong-key/version handling and database/log/Sentry plaintext barriers are green on commit `ddbf7380` |
| 2026-09-02 | Migration 0028 contract | `pnpm db:contract` | 60/60 passed: ledger/receipt/journal parity, fresh apply/no-op, proof rollback, tamper/drift refusal, immutable A → B → A connection and folder generations, historical grants, storage coupling and `RESTRICT` deletion behavior |
| 2026-09-02 | Migration 0028 local rehearsal | disposable local SQLite database: `pnpm db:migrate` twice, then `pnpm db:status` | First run applied through `0028_project_drive`; second run returned `no-op`; status returned `current` with 29 registered SQL files. No remote or production database was contacted |
| 2026-09-02 | WP-3 branch gates | `pnpm typecheck`; `pnpm lint`; `pnpm test`; `node --test src/server/tenant-scope-rules.test.mjs` | Typecheck and the full test chain passed; lint passed with 68 pre-existing warnings and zero errors; tenant governance passed 21/21 for migration 0028's three new tables. Migration 0029 later adds the fourth, `project_drive_operations` |
| 2026-09-02 | WP-4 connection implementation | Focused OAuth-state, connection lifecycle, Project Drive hard-rule, account erasure/export and unified GDPR tests on `feat/project-drive-wp4` | Same-account rotation makes zero revoke calls; A → B → A preserves immutable roots/history; alternate Host origins return to the configured deployment; own-user isolation, disconnect fallback, ciphertext custody, exact-scope and fail-closed grant-receipt erasure contracts passed locally. No live Google mutation or production migration was performed |
| 2026-09-03 | WP-5 erasure and account-fenced journal checkpoint | Commits `3aa82cf8`, `81613320`, `7715301f`; exact grant revocation, strict refresh-token custody, erasure/journal race and account-lineage suites | Exact Drive permission deletion is receipt-bound and idempotent on 404; refresh-token ciphertext survives every ambiguous revocation failure; prepare, claim and manual requeue lose neutrally to a same-transaction account fence. Focused account + Drive suite passed 76/76 at this checkpoint, plus typecheck, touched lint and hard rules |
| 2026-09-03 | Unified erasure and identity-resurrection checkpoint | Commits `48139627`, `b46b7556`, `338d4595`; file-backed lifecycle tests, unified erasure tests and production-order source contract | Notes, Timeline, Signal and Tasks are all attempted; any failed product blocks Clerk deletion with a sanitized aggregate. A hashed durable tombstone prevents stale Clerk requests/webhooks from reprovisioning an erased account in either race ordering. Combined focused run passed 81/81 (18 account + 63 lifecycle/Drive), then full typecheck passed |
| 2026-09-03 | Handover and upload access readiness | Commits `1812bb0a`, `42ae19bc`; focused upload/folder/handover, hard-rule, tenant and module-boundary gates | A generation reports active and can receive Drive uploads only when every current non-owner member has an exact writer receipt for their current normalized email with no revocation pending. Focused checks passed 55/55, upload rerun 36/36, hard rules 29/29 and tenant rules 21/21 |
| 2026-09-03 | Cross-instance permission serialization | Commit `a3d9407e`; two-service create-versus-delete race, lease expiry/loss, generation isolation, hard-rule ratchet and full Project Drive gate | Every audited Google permission POST/DELETE takes a DB-clock, crash-expiring lease for the exact workspace and immutable storage generation. Provider requests are bounded to 30 seconds inside a 60-second lease; busy/lost/unavailable states become sanitized retryable failures. Focused checks passed 69/69 and the branch Project Drive gate passed 231/231 |
| 2026-09-03 | Durable folder-operation repair | Commit `face10eb`; bounded folder provision/rename worker, shared cron route, handover barriers and default-off flag | Interrupted folder work can resume without replaying storage handover or crossing a workspace boundary. The Project Drive gate passed 266/266; worker/route checks passed 9/9, hard rules 29/29 and tenant rules 21/21, with typecheck, lint and module boundaries green |
| 2026-09-03 | Project deletion tombstone and exact Drive cleanup | Commit `52c621e8`; authorization re-proof, project-wide mutation fence, named-user permission revocation, account-erasure precedence and share-contract checks | Deletion intent is durable before provider work and prevents later Project Drive mutations. Focused lifecycle checks passed 40/40, hard rules 31/31, share contract 3/3 and tenant rules 21/21. The isolated Windows run completed all 19 deletion assertions before the known libSQL process-teardown fault (`3221225477`); Linux CI remains the release authority |
| 2026-09-03 | Follow-on Drive upload deletion ordering | Commit `d7e53d9e`; post-claim marker adoption, delegated refresh, pre-mint, session-cipher persistence and provider finalize races | Every Drive upload writer now orders against the deletion tombstone in its exact transaction. A deletion win becomes a neutral request conflict, never Signal-native fallback, and an unpersisted Google session is never exposed. All 41 logical upload tests passed before the same Windows libSQL teardown fault; typecheck, touched lint and hard rules 32/32 passed |
| 2026-09-03 | Durable Signal-native byte custody | Integrated commits `196a8cb1` and `5a0240c8`; focused custody/deletion/storage, upload-security, hard-rule and tenant suites | Focused custody/deletion/storage passed 76/76, upload security 28/28, hard rules 32/32 and tenant rules 24/24. Across the full Project Drive run, all 278 logical assertions completed: 276 were reported as passing and two test files were reported failed only because of the known Windows libSQL teardown exit (`3221225477`); no logical assertion failed |
| 2026-09-03 | Blob delegation and finalize boundary | Commit `5a0240c8`; `attachment-client-upload-security.test.ts` and finalization contracts | 28/28 passed. Finalization accepts only exact trusted storage locators, permits only `*.blob.vercel-storage.com` without credentials or a custom port, refuses redirects, retains live cleanup markers on rejection and records repeated exact finalization idempotently |
| 2026-09-03 | Account/Project deletion precedence | Commits `2f85ce9a` and `43f09f69`; focused Project-deletion arbitration suite and typecheck on the authoritative fix branch | 42/42 passed and typecheck was green. The first conditional fence write is authoritative inside the batch, avoiding a second `unixepoch()` read that could cross a lease boundary; live Project deletion wins, non-live owned work may be subsumed, surviving tombstones are preserved and unrelated bystander operations survive |
| 2026-09-03 | Four-worker independence and count-only response | Commits `face10eb` and `196a8cb1`; `src/app/api/cron/project-drive-grant-repair/route.test.ts` rerun on the integrated worktree | 4/4 passed. Revocation, grant creation, folder provision/rename and exact native-byte cleanup use four literal flags, default off, and one selection cannot enable another; output contains counts only |
| 2026-09-03 | Connections design exploration | Branch `design/project-drive-connections-exploration`, commit `bc431a25`; deterministic comparison harness | A · Custodian, B · Ledger and C · Threshold each cover all eight brief states at 390, 768, 1280 and 1440 pixels: 96 frames total. Behaviour, overflow, accessible-name, focus and product-language review passed 202/202. Production implementation is intentionally paused for the founder selection gate |
| 2026-09-03 | Migration 0029 disposable rehearsal | Unique local file `signal-project-drive-migration-49d3adba7e0b4c5cb4ed509a17889bd2/tasks.db`; `node scripts/db/migrate.mjs migrate --database-url file:<disposable-db> --environment=local` twice, then `status`; `pnpm db:contract` | First run applied the 0014 baseline and 15 forwards through `0029_project_drive_operations`; every recorded postcondition passed, including integrity `ok` and zero foreign-key violations. The second run returned `no-op`; status returned `current`, 30 registered SQL files and zero pending. The content-addressed ledger/receipt/journal contract passed 62/62. No remote or production database was contacted, and this is not production authorization |
| 2026-09-03 | Final account/native custody integration | Superseded by Linux checkpoint 50f16575, run 33916021010 | Integrated Drive stages 11/11 + 20/20 + 332/332 pass. This replaces the unfilled September 3 checkpoint; final provider/production acceptance remains open |
| 2026-09-03 | Final integrated release-candidate gates | Superseded by 50f16575, runs 33916021010 / 33916020920 / 33916020941 | Declared Linux code/build/database/performance/experience gates passed at that exact checkpoint. Later integrated revisions require fresh checks; runtime target and live acceptance remain open |
| 2026-09-03 | Draft app PR CI | PR #168 at 50f16575; the three candidate checks above passed | PR #165 is retained as source lineage. January branches disable Git deployments. Production migration checks remain separate; 0028/0029 are intentionally unapplied |

---

## Follow-ups noticed but out of scope

Do not do these inside this project. Record them so they are not lost.

- `calendar_connections` (Notes module) still stores its Google refresh token
  in plaintext. WP-2's `secret-box` now exists, so retrofitting Notes can reuse
  that reviewed primitive, but it remains a separate module migration and is
  deliberately outside this project.
- `resources.thumbnail` is never written by any code path, and image thumbnails
  in `resources-section.tsx` stream the full original through
  `/api/attachments/[id]` to paint a 36-pixel square. Drive-backed files get
  Drive's own previews; Signal-native files still need this fixed.
- `resources.task_id` is `NOT NULL`. Making it nullable enables board-level
  document libraries but needs SQLite's twelve-step table rebuild.
- **Notes photo capture has the same defect WP-0 just fixed for attachments.**
  It base64-encodes an image into a server action, which inflates it by about
  1.37x, so a photo over roughly 2.9 MB now exceeds the body budget — and
  before WP-0 anything over roughly 3.2 MB was hitting Vercel's 4.5 MB cap and
  failing with an opaque platform error. The 8 MB `bodySizeLimit` that was
  supposed to clear a 5 MB photo never could. The fix is the same one: send
  the photo to the store from the browser. Not touched here because it is a
  Notes-module change and this package was scoped to attachments.
- `uploadAttachmentAction` remains as the fallback for a deployment with no
  blob store, and is now honestly capped at 3 MB. If local-disk deployments
  stop mattering, the whole path can retire.
- Autonomous storage-handover replay is deliberately absent. Interactive
  handover re-proves the signed-in actor, but actor authority is not a durable
  journal field; a scheduled worker must not invent that authority. If later
  product needs unattended handover recovery, model and review that authority
  explicitly before adding it to a cron.
