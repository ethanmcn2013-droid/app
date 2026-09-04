# Status — Project Drive

## UI slice update · 2026-09-04

`feat/january-drive-ui` starts at `7d4040cbd59f4611ca69a60967b34bd58181d4c5`.
The current user delegation supersedes the historical "awaiting founder choice"
implementation stop below: A · Custodian is the delegated proposed thesis,
not a founder selection/lock. The default-off Connections/Resources slice is
implemented for internal review; WP-7 acceptance is still incomplete.

Read `UI-SLICE.md`, `UI-MATERIALITY.md` and `ui-evidence/README.md` for the
changed scope, preview/test pointers, implementation evidence and gaps.
Handover candidates, full setup/repair visibility, killed-browser recovery and
real provider acceptance remain open. The lead independently reviews browser
and security behavior. No production state, schema, provider credentials,
billing/invite implementation or launch flags were changed.

The lead reports Linux base lint/typecheck/full tests/Drive lifecycle/build
passing. Shared perf 247.3 KB against 247 KB remains a separate agent's work.
Settings registry carries pending billing visual acceptance; after integration
consult `docs/execution/january-2027/BILLING-REHEARSAL.md`. No score or formal
materiality approval is asserted by these mechanical registry updates.

The older package log below is preserved as historical backend evidence and
must not override this dated UI update.

The durable execution record for a later Codex or Claude Code session. Read it
with `PROJECT.md` and `DECISIONS.md`; code, receipts and test output remain the
evidence behind every claim. Update it at the end of every work package and
before a PR state changes. A `done` mark means the acceptance criteria and
listed gates passed — not merely that code was written.

**Last updated:** 2026-09-03 · WP-0 and the two-account WP-1 Google sharing spike are
complete. WP-2 is integrated. Migrations 0028 and 0029 are staged behind the
production founder gate; both have recorded disposable local rehearsal
evidence below. The
WP-4–6 backend is assembled as a draft release candidate, including immutable
connections, durable folder and permission work, handover, exact access
coverage and direct Drive upload. WP-8's deletion, account-erasure and native
byte-custody controls are at final integration: the final integration commit,
complete gate counts and app PR CI are explicitly pending below. Nothing is
accepted or launched. Production UI still waits for the WP-7 founder design
choice; production migrations, privacy wording, deployment and all four worker
flags remain untouched or off.

---

## Work packages

| WP | Package | Status | Notes |
|---|---|---|---|
| 0 | Fix the floor | **done** | Q1 answered: the token IS provisioned. A fifth, binding number was found (Vercel's 4.5 MB body cap) and uploads moved browser → Blob so 50 MB is real. Ten §2 rules ratcheted |
| 1 | Spike the Drive chain | **done** | Owner flow passed. Signed in as `ethan@signalstudio.ie`, the member opened the shared board folder and file, could not open the parent, then lost both child links after exact permission revocation. This was a two-account Google sharing spike, not the still-pending in-product lifecycle; the member-token API 404 is documented separately from the real Drive-link path |
| 2 | Secrets substrate | **done on feature branch** | AES-256-GCM envelope, versioned key custody, log/Sentry redaction and token-custody contracts are in commit `ddbf7380` |
| 3 | Schema (migrations 0028 and 0029) | **staged, founder-gated** | Generation-aware storage, encrypted connection custody, exact grant receipts and the durable operation journal pass contract checks. Both migrations have fresh-apply/no-op evidence on disposable local databases. Neither migration has touched production; Q5 is open |
| 4 | The connection | **backend integrated; acceptance blocked** | Exact callback origin, immutable connect/reconnect, private root, disconnect, own-user summary and GDPR integration are implemented. Exact permission and credential revocation retain encrypted custody until confirmed. The Connections product surface and live in-product lifecycle have not run |
| 5 | Folder and sharing | **backend integrated; acceptance blocked** | Folder/grant execution, membership hooks, repair, handover, account fencing and exact current-email writer coverage are integrated. Not `done`: live in-product membership/access lifecycle and the selected visibility surface remain |
| 6 | Upload | **backend integrated; acceptance blocked** | Destination-bound resumable sessions, quota fallback, provider-result verification, erasure recovery and exact-coverage fallback are integrated. The Resources UI is not wired to this path and the live 50 MB, killed-browser, full-Drive and disconnect criteria have not run |
| 7 | Surfaces | **awaiting founder design choice** | Phase-2 exploration is complete: A · Custodian, B · Ledger and C · Threshold cover eight states at four viewports (96 frames, 202 assertions). Production UI for **Connections**, **Who can open this board's files** and **Resources** waits for one thesis plus any numbered zones to be selected and locked |
| 8 | Resilience and launch | **backend assembled; final integrated verification pending** | Four independent count-only repair paths are present and default off; interactive handover and durable deletion controls are implemented. Final account/native integration and complete app gates remain placeholders. Launch also waits for WP-7 UI/live acceptance, founder-authorized migrations 0028/0029, founder-approved privacy wording, deployment authorization and individual worker activation |

---

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
| Q8 | Which design thesis — A · Custodian, B · Ledger or C · Threshold — should become the production UI, and which numbered zones (1 chrome/hierarchy, 2 ownership story, 3 live access truth, 4 Resources/provenance, 5 motion/reassurance) should carry forward | WP-7 | founder |
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
| 2026-09-03 | Final account/native custody integration | **[FINAL INTEGRATION PLACEHOLDER — replace with the integrated commit hash and focused test counts]** | Pending. Do not mark WP-8 backend hardening complete until exact native claims in owned and surviving Projects are covered across erasure, rollback, storage failure and replay |
| 2026-09-03 | Final integrated release-candidate gates | **[FINAL GATES PLACEHOLDER — replace with command-by-command results and exact Project Drive assertion accounting]** | Pending: typecheck, lint, `test:project-drive`, full test, database contract, language, experience self-test/fixtures/validation, build, performance budgets, module boundaries and tenant rules |
| 2026-09-03 | Draft app PR CI | **[FINAL CI PLACEHOLDER — replace with PR head SHA and every required check result after the final push]** | Pending. Linux CI is the release authority for the known Windows libSQL teardown behaviour; production migration and deployment gates must remain intentionally closed |

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
