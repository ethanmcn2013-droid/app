# Status — Project Drive

The only place a later session can learn what is actually done. Update it at
the end of every work package, before opening a PR. A `done` mark is a claim
that the package's acceptance criteria in `PROJECT.md` were met and the gates
listed there passed — not that the code was written.

**Last updated:** 2026-08-27 · planning only, no implementation started.

---

## Work packages

| WP | Package | Status | Notes |
|---|---|---|---|
| 0 | Fix the floor | not started | Blocks everything. `BLOB_READ_WRITE_TOKEN` status unknown; 8 MB / 50 MB / 10 MB contradiction unresolved |
| 1 | Spike the Drive chain | not started | Output is `SPIKE-FINDINGS.md`. Publish the consent screen on day one |
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
| Q1 | Is `BLOB_READ_WRITE_TOKEN` provisioned in production? Settings currently tells every customer uploads are not active | WP-0 | founder / operator |
| Q2 | Exact consent-screen wording shown for `drive.file` | WP-1 | spike |
| Q3 | CSP hosts needed for the Drive preview embed and the resumable PUT | WP-1, WP-6 | spike |
| Q4 | Which single file-size number becomes the truth in WP-0 | WP-0 | founder |
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
| 2026-08-27 | Settings claims uploads are inactive | `src/components/app/settings/sections/storage.tsx:87`, rendered in demo mode | Confirmed — copy is unconditional, no demo branch |

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
