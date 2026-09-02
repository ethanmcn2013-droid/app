# Status — Project Drive

The only place a later session can learn what is actually done. Update it at
the end of every work package, before opening a PR. A `done` mark is a claim
that the package's acceptance criteria in `PROJECT.md` were met and the gates
listed there passed — not that the code was written.

**Last updated:** 2026-09-02 · WP-1 is complete against the owner and
`ethan@signalstudio.ie`, including real Drive-link access and exact revocation.
WP-2 is complete on the feature branch. WP-3, migration 0029's durable
operation journal, and the WP-4 connection lifecycle are staged and verified
locally. Production migration remains an explicit founder gate. WP-4 still
needs live connection acceptance, and WP-5 must wire exact grant revocation.

---

## Work packages

| WP | Package | Status | Notes |
|---|---|---|---|
| 0 | Fix the floor | **done** | Q1 answered: the token IS provisioned. A fifth, binding number was found (Vercel's 4.5 MB body cap) and uploads moved browser → Blob so 50 MB is real. Ten §2 rules ratcheted |
| 1 | Spike the Drive chain | **done** | Owner flow passed. Signed in as `ethan@signalstudio.ie`, the member opened the shared board folder and file, could not open the parent, then lost both child links after exact permission revocation. Member-token API 404 is documented separately from the real Drive-link path |
| 2 | Secrets substrate | **done on feature branch** | AES-256-GCM envelope, versioned key custody, log/Sentry redaction and token-custody contracts are in commit `ddbf7380` |
| 3 | Schema (migration 0028) | **staged locally** | Generation-aware SQL, Drizzle mirror, ledger, 42-proof review receipt and journal are green. Fresh local apply, no-op rerun and current status passed. Not applied to production; do not mark done before WP-1 acceptance and the founder's Q5 authorization |
| 4 | The connection | **staged on feature branch** | Authorized start/callback, exact deployment redirect, immutable connect/reconnect, private root, disconnect, own-user summary, and GDPR/export integration are implemented. Targeted and full branch gates are green. Not `done`: no live connection acceptance was run, and WP-5 must wire exact grant revocation before it creates grants |
| 5 | Folder and sharing | **in progress** | Durable operation journal is staged and fully contract-tested; folder, grant, token-resolution, and lifecycle services are being implemented |
| 6 | Upload | not started | |
| 7 | Surfaces | not started | `experience/registry.json` entries required |
| 8 | Resilience and launch | not started | Revoke repair pass needs a new cron |

---

## Open questions

Carried from planning. Each needs an owner and an answer before the package
that depends on it.

| # | Question | Blocks | Owner |
|---|---|---|---|
| ~~Q1~~ | ~~Is `BLOB_READ_WRITE_TOKEN` provisioned in production?~~ **Answered 2026-08-27: yes.** Present on the `app` project for Production, Preview and Development, created 24 days before. Uploads were live the whole time; the settings copy was simply false | — | closed |
| ~~Q2~~ | ~~Exact consent-screen wording shown for `drive.file`~~ **Answered 2026-08-27:** Google says Signal Studio can see, edit, create and delete only the specific Drive files used with the app. See `SPIKE-FINDINGS.md` Finding 8 | — | closed |
| ~~Q7~~ | ~~The second Google account to test sharing with — an email address, not a secret~~ **Answered and verified 2026-09-02:** `ethan@signalstudio.ie`; the complete live lifecycle is recorded in `SPIKE-FINDINGS.md` | — | closed |
| ~~Q3~~ | ~~CSP hosts needed for the Drive preview embed and the resumable PUT~~ **Answered 2026-09-02:** V1 opens `webViewLink` in a new tab, so no Drive frame host. Resumable PUT needs exact `connect-src https://www.googleapis.com` | — | closed |
| ~~Q4~~ | ~~Which single file-size number becomes the truth in WP-0~~ **Answered 2026-08-27 by the founder: 50 MB, made real by client-direct upload.** See D11 | — | closed |
| Q5 | Does the founder authorize migration 0028 against production, and when | WP-3 | founder |
| Q6 | Privacy-policy wording for files residing in a member's personal Drive | WP-8 | founder |

---

## Evidence and verification log

Record what was actually observed, with dates. Claims without evidence are not
status.

| Date | What was verified | How | Result |
|---|---|---|---|
| 2026-08-27 | `permissions.create` accepts `drive.file` | Drive API v3 discovery document, revision 20260823, vendored at `docs/drive-api-v3-discovery-20260823.json` | Confirmed — only `drive` and `drive.file` are listed |
| 2026-08-27 | Repo has no cryptography helper | `grep` for `createCipheriv` / `createDecipheriv` across `src` | Confirmed — none |
| 2026-08-27 | No scheduled background worker | `vercel.json` declares two crons; the outbox cron is not among them | Confirmed |
| 2026-08-27 | Server-action body limit is 8 MB | `next.config.ts` `experimental.serverActions.bodySizeLimit` | Confirmed, contradicts `SERVER_UPLOAD_LIMIT_BYTES` |
| 2026-08-27 | Settings claims uploads are inactive | `src/components/app/settings/sections/storage.tsx:87` | Confirmed — copy is unconditional, no demo branch, so every real customer saw it |
| 2026-08-27 | `BLOB_READ_WRITE_TOKEN` IS provisioned in production | `vercel env ls production` against `ethanmcn2013-1730s-projects/app` | Confirmed — Production, Preview and Development, created 24 days earlier. **Q1 closed.** The copy above was false, not merely stale |
| 2026-08-27 | Vercel caps a function request body at 4.5 MB | https://vercel.com/docs/functions/limitations (last_updated 2026-08-24) | Confirmed — `413 FUNCTION_PAYLOAD_TOO_LARGE`, not configurable. `bodySizeLimit: "8mb"` was therefore unreachable and a 5 MB PDF could not be attached at all. This is the fifth number, and the binding one |
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
| 2026-09-02 | WP-1 second-account lifecycle | Live Google Drive browser session as `ethan@signalstudio.ie`, with owner API grant/revoke and links opened before and after revocation | Complete. Board folder and uploaded file opened without a request-access step; the `Signal Studio` parent showed **You need access**; deleting the exact permission made both child links show **You need access**. The disposable root was moved to owner trash afterwards |
| 2026-09-02 | WP-2 secrets substrate | `src/server/crypto/secret-box.test.ts`, `src/server/provider-token-custody.test.ts`, plus full branch gates | AES-256-GCM round-trip, tamper/wrong-key/version handling and database/log/Sentry plaintext barriers are green on commit `ddbf7380` |
| 2026-09-02 | Migration 0028 contract | `pnpm db:contract` | 60/60 passed: ledger/receipt/journal parity, fresh apply/no-op, proof rollback, tamper/drift refusal, immutable A → B → A connection and folder generations, historical grants, storage coupling and `RESTRICT` deletion behavior |
| 2026-09-02 | Migration 0028 local rehearsal | disposable local SQLite database: `pnpm db:migrate` twice, then `pnpm db:status` | First run applied through `0028_project_drive`; second run returned `no-op`; status returned `current` with 29 registered SQL files. No remote or production database was contacted |
| 2026-09-02 | WP-3 branch gates | `pnpm typecheck`; `pnpm lint`; `pnpm test`; `node --test src/server/tenant-scope-rules.test.mjs` | Typecheck and the full test chain passed; lint passed with 68 pre-existing warnings and zero errors; tenant governance passed 21/21 for the three new tables |
| 2026-09-02 | WP-4 connection implementation | Focused OAuth-state, connection lifecycle, Project Drive hard-rule, account erasure/export and unified GDPR tests on `feat/project-drive-wp4` | Same-account rotation makes zero revoke calls; A → B → A preserves immutable roots/history; alternate Host origins return to the configured deployment; own-user isolation, disconnect fallback, ciphertext custody, exact-scope and fail-closed grant-receipt erasure contracts passed locally. No live Google mutation or production migration was performed |

---

## Follow-ups noticed but out of scope

Do not do these inside this project. Record them so they are not lost.

- `calendar_connections` (Notes module) stores its Google refresh token in
  plaintext. Once WP-2's `secret-box` exists, retrofitting it is small and
  obviously correct.
- `resources.thumbnail` is never written by any code path, and image thumbnails
  in `resources-section.tsx` stream the full original through
  `/api/attachments/[id]` to paint a 36-pixel square. Drive-backed files get
  Drive's own previews; Signal-native files still need this fixed.
- `removeResourceAction` derives an upload's backing row by stripping `res-`
  from the resource id, which only resolves for rows the `0017` backfill
  created. Dormant today; the first feature to write upload-kind `resources`
  rows directly will trip it.
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
- Migration 0029's operation journal is staged. Unified export and erasure must
  add explicit operation-row ordering before any Project, connection, or
  storage generation can be deleted; the journal is repair evidence and must
  not disappear by cascade.
