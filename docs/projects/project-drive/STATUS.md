# Status — Project Drive

The only place a later session can learn what is actually done. Update it at
the end of every work package, before opening a PR. A `done` mark is a claim
that the package's acceptance criteria in `PROJECT.md` were met and the gates
listed there passed — not that the code was written.

**Last updated:** 2026-08-27 · WP-0 done and merged. Google is configured; WP-1 needs one email address and two consent clicks.

---

## Work packages

| WP | Package | Status | Notes |
|---|---|---|---|
| 0 | Fix the floor | **done** | Q1 answered: the token IS provisioned. A fifth, binding number was found (Vercel's 4.5 MB body cap) and uploads moved browser → Blob so 50 MB is real. Ten §2 rules ratcheted |
| 1 | Spike the Drive chain | **ready to run** | Harness written (`scripts/spike/drive-chain.mjs`, branch `spike/drive-chain`). Google is configured and credentials are in Vercel. Needs the second account's address, and a human to press Allow twice |
| 2 | Secrets substrate | not started | No cryptography exists in this repo yet |
| 3 | Schema (migration 0028) | not started | Ledger entry + review receipt + journal, not just SQL |
| 4 | The connection | not started | |
| 5 | Folder and sharing | not started | The security-critical package |
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
| Q2 | Exact consent-screen wording shown for `drive.file` | WP-1 | spike |
| Q7 | The second Google account to test sharing with — an email address, not a secret | WP-1 | founder |
| Q3 | CSP hosts needed for the Drive preview embed and the resumable PUT | WP-1, WP-6 | spike |
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
