# Project Drive — durable build and handoff record

**Let each board nominate a storage owner whose Google Drive holds that
board's files, so current members can open them without exposing anything else
in the storage owner's Drive.**

This began as the implementation plan. It is now the model-agnostic handoff
for any Codex or Claude Code session working in this repository. Read
`STATUS.md` first for the durable execution record, then `DECISIONS.md` for
the settled constraints, and use this document for the intended shape and
acceptance bar. Do **not** restart WP-0 or another completed package; continue
from the first unfinished acceptance gate recorded in `STATUS.md`.

Founder decision date: 2026-08-27. Founder-facing rationale:
`docs/PROJECT_FILES_IN_DRIVE.html`. Current-state map of the codebase:
`docs/CONNECTED_STORAGE_REVIEW.html`.

---

## 0 · Read before writing any code

In this order. Do not skip — several are non-obvious traps that will cost a
CI cycle or a production incident.

| File | Why |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | Repo contract, north star, HQ sync duty |
| `docs/adr/0001-canonical-project-identity.md` | **§9 governs every server action you write** |
| `docs/SPACING_SCALE_COLLISION.md` | Vendored tokens remap Tailwind spacing; `min-h-11` is 80px |
| `drizzle/MIGRATIONS.md` | The migration ledger contract. Migrations 0028 and 0029 are not just `.sql` files |
| `DEPLOY.md` §1, §4 | Env vars and the database release gate |
| `docs/COLLABORATION_LOOP.md` | Role vocabulary; who a "member" is |
| `src/server/actions/attachments.ts` | The claim-then-verify pattern you will reuse |
| `src/server/actions/project-authz.ts` | The authorization seam. Copy its shape exactly |
| `docs/projects/project-drive/DECISIONS.md` | Decisions already made. Do not re-litigate them |

---

## 1 · What we are building, in one paragraph

A board (a `workspaces` row) can nominate a **storage owner** — a member with
`manageProject` who connects their Google Drive. Signal Studio creates one
folder for that board inside a `Signal Studio` folder in their My Drive, and
shares *the board folder only* with every current non-owner member. Every upload to that
board, by any member, is written with the storage owner's credential into that
folder, and the browser sends the bytes straight to Google. Members never see
an OAuth screen. Signal Studio holds metadata and the relationship; Google
holds the bytes.

---

## 2 · Hard rules

These are invariants, not preferences. Each one should be enforced by code and
proved by a contract test, in the register this repo already uses
(`src/server/*-contract.test.ts`, `src/server/*-security*.test.ts`).

1. **The only scope ever requested is `drive.file`.** One exported constant,
   one contract test asserting the requested set equals exactly
   `["https://www.googleapis.com/auth/drive.file"]`. Adding `drive` or
   `drive.readonly` must fail CI, not a Google review nine months from now.
2. **Never create a permission on the `Signal Studio` root folder.** Sharing it
   exposes every board at once. Guard in code against
   `connection.rootFolderId`, and test it.
3. **Only `type: "user"`.** Never `anyone`, never `domain`, never `group` in
   v1. A future change must not be able to quietly turn a board folder into a
   public link.
4. **A grant is only ever created on the current
   `workspace_storage.folder_id` for the workspace being granted.** The
   generation and folder id come from the workspace row, never from client
   input or a function argument the caller chose.
5. **Share-link guests are never granted anything in Drive.** They are
   anonymous bearer tokens with no person behind them.
6. **Signal Studio never deletes a user's Drive file as a side effect.**
   Removing an attachment removes the row. Deleting from Drive is a separate,
   explicit, owner-only, confirmed action — and it trashes, never purges.
7. **Access tokens are never persisted.** Minted per request, held in memory,
   discarded. Refresh tokens are encrypted at rest.
8. **The requesting user's authorization is always proved first**, on the
   object's own Project, per ADR 0001 §9 — before any Drive call is made.
9. **Never trust a client-supplied Drive file id.** On finalize, verify with
   `files.get` that the file's `appProperties.signalResourceId` matches the
   claim row *and* its `parents` contains this board's folder.
10. **Every new server action early-returns under `isDemoMode()`.** Demo must
    never reach Google or the real database.

---

## 3 · Repo traps that will bite you

- **Migrations 0028 and 0029 are not just SQL.** Each needs its own ledger
  entry in `drizzle/migration-ledger.json` (ordinal, LF-canonical sha256,
  policy, receipt path and receipt sha256), a `tasks-migration-receipt/1`
  review receipt under `drizzle/receipts/`, and a
  `drizzle/meta/_journal.json` entry. `pnpm db:contract` is the gate. Both
  receipts remain **not authorized for production** until the founder approves
  the target-bound execution after backup and isolated-copy rehearsal.
- **`experience/registry.json` is a hard gate.** New surfaces must be
  registered with a full entry and a materiality review, or
  `pnpm experience:validate` fails. Read `scripts/experience/validate.mjs`
  before adding entries.
- **`pnpm first-contact:language`** scans `src/**/*.tsx` prose for jargon.
  Banned words include `config`, `endpoint`, `webhook`, `schema`. Write copy in
  plain language: **Connect Google Drive** and
  **Who can open this board's files**.
- **Historical WP-0 baseline, now resolved:** `bodySizeLimit` used to be
  `8mb`, above Vercel's binding 4.5 MB request limit, while the product said
  50 MB. The framework limit is now 4 MB; configured Blob and Drive paths send
  bytes browser-direct, while the no-Blob fallback remains a separate 3 MB
  server path. The founder-approved product limit remains exactly 50 MB. Do
  not reintroduce a server-mediated large-file path above that fallback limit.
- **libSQL over stateless HTTP**: FK cascades are unreliable and hand-wired.
  Write retries are deliberately absent (`src/server/db/retry.ts` is reads
  only). `db.transaction()` works and is used.
- **Module boundaries** (`scripts/check-module-boundaries.mjs`): this work is
  *core*, not a module. It belongs in `src/server/**`, `src/lib/**`,
  `src/components/app/**`. Do not put it under `src/modules/`.
- **Historical WP-8 baseline, now resolved in the release candidate:** there
  was no Project Drive worker. One shared count-only cron route now contains
  four independently gated repair paths: permission revocation, permission
  creation, folder provision/rename and exact Signal-native byte cleanup.
  Every flag defaults off. Storage handover is deliberately interactive
  because its actor authority is not durable worker state.

---

## 4 · Work packages

Dependency-ordered. Do not start a package until its predecessor's acceptance
criteria are met and recorded in `STATUS.md`.

### WP-0 · Fix the floor
*No Drive work. Ships on its own.*

**Current state:** complete. Keep this section as historical acceptance
evidence; do not restart it.

**Goal.** The Signal-native upload path — the fallback this entire design
leans on — must demonstrably work before anything is built on top of it.

**Do:**
- Resolved: `BLOB_READ_WRITE_TOKEN` was confirmed in all three Vercel
  environments and is in `RECOMMENDED_IN_PRODUCTION`, so absence warns at boot
  instead of first surfacing as an upload failure.
- Historical contradiction: `next.config.ts` capped server-action bodies at
  8 MB, `src/lib/storage-config.ts` said 50 MB, the free tier promised 10 MB
  and the product said 50 MB. WP-0 resolved this with one 50 MB product limit,
  a 4 MB framework body limit and browser-direct Signal-native Blob upload;
  WP-6 applies the same byte path shape to Drive.
- Resolved: the unconditional settings claim that uploads were inactive was
  removed; settings now tells the truth.

**Acceptance (met):** a real upload of a ~5 MB PDF succeeded against the
production Blob store and downloaded back through the route's own read path;
the size contract agrees and settings tells the truth. This verification did
not deploy Project Drive or change production configuration or schema; its
disposable verification object was removed.

**Gates:** `pnpm lint && pnpm typecheck && pnpm test`

---

### WP-1 · Spike the Drive chain
*Throwaway branch. Delete it afterwards. Output is a written findings note.*

**Goal.** Retire the remaining unknowns before committing to a shape.

**Prove, end to end, with two real Google accounts:**
1. OAuth with `drive.file` only → refresh token obtained.
2. Create `Signal Studio/` and a board folder inside it.
3. `permissions.create` on the board folder for account B,
   `sendNotificationEmail: false`. Confirm B can open it.
4. Mint a resumable upload session server-side; PUT bytes from a browser;
   confirm the file lands in the folder.
5. Confirm B can open that file **without requesting access**.
6. `permissions.delete` → confirm B loses access.
7. Confirm the `Signal Studio` parent folder is *not* visible to B.

**Also verify against live Google documentation** (blocked from the
environment this plan was written in — treat the table in
`docs/PROJECT_FILES_IN_DRIVE.html` as well-supported, not observed):
- Exact consent-screen wording for `drive.file`.
- Picker/preview CSP hosts, if you embed Drive's viewer.
- Whether `changes.watch` under `drive.file` is worth anything later.
- Current resumable-upload semantics and session lifetime.

**Publish the OAuth consent screen out of Testing on day one.** While it is in
Testing, Google expires refresh tokens after 7 days and caps you at 100 users;
that will otherwise look like a bug in our code for a week.

**Acceptance:** `docs/projects/project-drive/SPIKE-FINDINGS.md` exists,
answering all seven steps with observed behaviour and any surprises.

---

### WP-2 · Secrets substrate
*There is no cryptography anywhere in this repository today.*

**Goal.** Somewhere safe to put a refresh token.

**Files:**
- `src/server/crypto/secret-box.ts` — AES-256-GCM `seal()` / `open()`, key from
  `PROVIDER_TOKEN_KEY`, explicit `keyVersion` so rotation is possible later.
- `src/server/crypto/secret-box.test.ts` — round-trip, tamper detection,
  wrong-key rejection, version handling.
- `src/env.ts` — add `PROVIDER_TOKEN_KEY`.
- `src/lib/sentry-scrub.ts` — scrub token fields before anything leaves.
- `DEPLOY.md` — document the new variable and how to generate it.

**Note.** `calendar_connections` in the Notes module still stores its Google
refresh token in plaintext, relying on Turso at-rest encryption, and its own
comment flags this as a follow-up. The reviewed `secret-box` now exists, but a
Notes schema migration remains a separate module change — keep it in
`STATUS.md` and do not let it block this project.

**Acceptance:** tests pass; no plaintext token can reach the database, logs, or
Sentry.

---

### WP-3 · Schema and durable journal
**Goal.** Migrations 0028 and 0029, done the way this repo demands and held
behind the production founder gate.

**Tables** (see `DECISIONS.md` D3 for why these and not the six the original
brief proposed):

```sql
-- the person's Google grant. Per user, never per board.
CREATE TABLE provider_connections (
  id, user_id, provider,
  provider_account_id,      -- Drive User.permissionId; no OpenID scope needed
  provider_account_email,   -- display only, never a join key
  root_folder_id,           -- the "Signal Studio" folder. NEVER shared.
  refresh_token_cipher, key_version, scopes,
  status,                   -- active | needs_reauth | revoked
  is_current,               -- one current credential generation per user/provider
  connected_at, last_used_at, last_error_at
);
CREATE UNIQUE INDEX idx_provider_connections_current
  ON provider_connections (user_id, provider) WHERE is_current = 1;

-- one immutable folder generation; history survives handover/replacement.
CREATE TABLE workspace_storage (
  id PRIMARY KEY,           -- storage_generation_id
  workspace_id,
  connection_id,            -- the storage owner's grant
  folder_id,                -- the ONLY place this board's uploads may land
  folder_web_view_link,
  state,                    -- active | needs_reauth | folder_missing | quota_full
  is_current
);
CREATE UNIQUE INDEX idx_workspace_storage_current
  ON workspace_storage (workspace_id) WHERE is_current = 1;

-- THE SECURITY CONTROL. One row per generation/person we granted.
CREATE TABLE drive_folder_grants (
  storage_generation_id, workspace_id, user_id,
  permission_id,            -- returned by permissions.create
  granted_email, role,      -- 'writer' | 'reader'
  granted_at,
  revoke_pending,           -- set when a delete failed; WP-8 drains it
  PRIMARY KEY (storage_generation_id, user_id)
);

-- Durable intent and provider receipts across database/provider splits.
CREATE TABLE project_drive_operations (
  id, workspace_id, operation_kind, status, dedupe_key,
  connection_id, storage_generation_id, target_storage_generation_id,
  subject_user_id, grantee_email, grant_role, workspace_revision,
  provider_folder_id, provider_folder_web_view_link,
  provider_permission_id, attempt_count, last_attempt_at, next_attempt_at,
  lease_expires_at, last_error_code, created_at, updated_at, completed_at
);
```

Plus, additively on `resources`:
`storage` (`'signal' | 'drive'`, default `'signal'`), `external_id` already
exists, `storage_generation_id`, `stored_path`. The generation points to
`workspace_storage.id`; its connection is derived rather than duplicated. A
database check couples the pair: Drive requires a generation, Signal-native
requires none. Insert/update guards also require that the selected generation
belongs to the resource's workspace; this is the additive equivalent of the
composite foreign key SQLite cannot attach to an existing table.

`provider_connections.id` and `workspace_storage.id` are immutable generation
ids. This is necessary for owner A → B → A, reconnecting a different Drive
account, and creating a replacement folder under the same credential. Partial
unique indexes enforce one current credential per user/provider and one current
storage generation per workspace while preserving the old rows. All custody
foreign keys use `RESTRICT`: lifecycle code must revoke and clean explicitly
before deleting the evidence needed for repair.

**Do not** make `resources.task_id` nullable in this project. It needs
SQLite's twelve-step table rebuild and only buys project-level libraries, which
are out of scope.

Exact Signal-native byte cleanup receipts reuse `meta`. They are one immutable
receipt per object locator and do not create a fifth Project Drive table.

**Also:** mirror both migrations in `src/server/db/schema.ts`; give each its
own ledger entry, review receipt under `drizzle/receipts/` and journal entry.

**Acceptance:** `pnpm db:contract` passes; `pnpm db:status` against a disposable
local database reports current through 0029 after `pnpm db:migrate`; a second
run is a no-op. Neither migration reaches production without the founder's
separate authorization.

---

### WP-4 · The connection
**Goal.** A member with `manageProject` can connect and disconnect their Drive.

**Files:**
- `src/server/connections/google-drive-scopes.ts` — the constant, alone in its
  own file so the contract test has an unambiguous target.
- `src/server/connections/google-drive.ts` — auth URL, token exchange, refresh,
  revoke (`POST https://oauth2.googleapis.com/revoke`), `about.get`.
- `src/app/api/connections/google/start/route.ts` — signed, single-use `state`
  bound to the Clerk session via an httpOnly double-submit cookie, 10-minute
  expiry. Node runtime.
- `src/app/api/connections/google/callback/route.ts` — verify state, exchange,
  encrypt, store, create the `Signal Studio` root folder, redirect back.
- `src/server/actions/connections.ts` — connect/disconnect server actions.
- GDPR: `src/server/account-erasure.ts`, `account-unified-erasure.ts`
  (collect tokens → delete rows → revoke at Google, the order
  `notes-gdpr.ts` already establishes), `account-export.ts` (**tokens omitted**).

**Connection and Project boundary.** The consent belongs to the person, while
the route is authorized from one explicit Project. Every successful consent
inserts a new immutable connection generation. A same-account reconnect
(Drive `permissionId` unchanged) may reuse only that account's app-marked root
and must not revoke the old token — Google revocation is grant-level and can
invalidate the new generation too. A different account gets its own root and
cannot adopt the former account's folders. Disconnect affects every Project
using that person's account lineage and moves those Projects to the
Signal-native fallback.

WP-4 creates the private `Signal Studio` root only. It does **not** insert
`workspace_storage`, create a board folder, or grant a member; those are WP-5
operations. `GOOGLE_OAUTH_REDIRECT_URI` is the exact deployment callback and
the only allowed return origin, so branch Preview never jumps to production
and an alternate incoming Host cannot become an open redirect.

**GDPR boundary.** Refresh credentials are collected, local generations are
deleted explicitly in `RESTRICT` order, and tokens are revoked afterwards.
An exact folder grant is different: Google must confirm deletion of its stored
`permission_id` before that receipt disappears. The release candidate now
wires this executor into account erasure, arbitrates it against durable Project
deletion, and preserves encrypted custody on ambiguous provider results.
Signal-native claims are inspected transactionally before attachment or
Project rows can disappear; live or legacy-ambiguous writers block retryably,
while expired authority first becomes an exact byte-cleanup receipt.

**Contract tests:**
- Requested scope set is exactly `["…/auth/drive.file"]`.
- A forged or replayed `state` is rejected.
- A connection is only ever readable by its own user.
- Reconnecting a *different* Google account is detected via
  `provider_account_id` (Drive `about.user.permissionId`, not OpenID `sub`) and
  does not silently adopt old folders or widen the `drive.file` scope set.

**Acceptance:** connect, disconnect, reconnect all work; the token in the
database is ciphertext; erasure revokes at Google.

---

### WP-5 · Folder and sharing
*The heart of the feature, and where the security lives.*

**Goal.** One folder per board, shared with exactly that board's members.

**Files:**
- `src/server/connections/drive-folders.ts` — find-or-create root, create board
  folder, rename on board rename.
- `src/server/connections/drive-grants.ts` — grant, revoke, list, reconcile.
- Membership hooks at the four known mutation sites:
  `src/server/projects/service.ts:271`, `:596`, `:614` (creation, invite
  accept) and `src/server/actions/settings.ts` (`removeMemberAction`,
  `setMemberRoleAction`).

**The guard**, which must exist as a named function every grant path calls:

```ts
// Refuse before the API call, never after.
function assertGrantTarget(input: {
  fileId: string; workspaceFolderId: string; rootFolderId: string;
  type: string; role: string;
}) {
  if (input.fileId === input.rootFolderId) throw new Error("never grant on the root folder");
  if (input.fileId !== input.workspaceFolderId) throw new Error("grant target is not this board's folder");
  if (input.type !== "user") throw new Error("only named-user grants");
  if (input.role !== "writer" && input.role !== "reader") throw new Error("unsupported role");
}
```

**Contract tests** — these are the tests that matter most in the whole project:
- Root folder can never be a grant target.
- `type: "anyone"` and `type: "domain"` are refused.
- A grant for workspace A can never target workspace B's folder.
- Removing a member deletes exactly the stored `permission_id`.
- A share-link guest never produces a grant.

**Acceptance:** a second Google account added as a member can open the board's
files with no request-access step; removed, they lose access; the parent folder
was never shared. If a current member cannot receive a Google grant, membership
still succeeds, the access gap is visible, and new uploads use Signal-native
storage until coverage is complete.

---

### WP-6 · Upload
**Goal.** Bytes go browser → Google. They never touch our servers.

**Flow:**
1. `createDriveUploadSessionAction(taskId, { name, mimeType, size })`
   - `scopeForTask(taskId, me)` first — ADR 0001 §9 object operation.
   - Resolve the current `workspace_storage` generation for `scope.ws`. No
     current storage → caller falls back to the Signal-native path unchanged.
   - Pre-check `about.get` `storageQuota`; refuse politely if it will not fit.
   - **Idempotency:** query
     `files.list q="appProperties has {key='signalResourceId' and value='…'} and trashed=false"`
     before minting anything. A hit means an earlier attempt landed — adopt it.
   - Insert the claim row (`storage='drive'`, `storageGenerationId` set to the
     current generation, `accessState='pending'`), then
     mint the resumable session with metadata
     `{ name, parents: [folderId], appProperties: { signalResourceId } }`.
   - Return `{ resourceId, sessionUrl }` — **the access token never leaves the
     server.**
2. Client PUTs bytes to `sessionUrl` with `Content-Range`, resuming on failure.
3. `finalizeDriveUploadAction(resourceId, driveFileId)`
   - Re-authorize.
   - `files.get` and verify **both**: `appProperties.signalResourceId` equals
     the claim row's id, **and** `parents` contains this board's folder.
     A client-supplied id is not evidence of anything.
   - Update the row to `accessState='ok'` with real size, mime, `webViewLink`.
4. A failure **before** the session reaches the browser deletes the claim.
   Once the session has been delegated, an ambiguous timeout, 429 or 5xx keeps
   the pending claim and its encrypted session capability. Retry probes and
   reuses that session. Remint only after a definitive session 404 **and** an
   app-property search proves no file landed; otherwise deleting the claim
   would discard the idempotency key and permit a duplicate.

**Also:** `next.config.ts` CSP — `connect-src` needs
`https://www.googleapis.com`. V1 opens the provider's `webViewLink` in a new
tab; it does not embed Drive's viewer.

**Acceptance:** a file at the founder-approved 50 MB product limit attaches
successfully; killing the browser
mid-upload and retrying produces **one** Drive file, not two; a full Drive
falls back to Signal-native storage with a plain sentence.

---

### WP-7 · Surfaces
**2026-09-04 implementation update:** user-delegated selection of A · Custodian
allows the internal default-off UI slice to proceed. It is not a founder pick,
design lock or acceptance. `UI-SLICE.md` records reuse, evidence, verification
and remaining status/handover/recovery gaps. `UI-FOLLOW-UP.md` records the bounded
owner-handover controls and the missing content-binding prerequisite for safe
upload reselection after reload. The historical gate wording below
describes the prior exploration checkpoint, superseded for this delegated slice.

**Goal.** Attaching a file stays ordinary while storage ownership and live
access truth become easy to understand.

**Founder design gate:** Phase-2 exploration is complete. A · Custodian,
B · Ledger and C · Threshold each cover eight product states at 390, 768,
1280 and 1440 pixels: 96 rendered frames, with 202 behaviour, overflow,
accessible-name, focus and product-language assertions. Do not implement the
production surface until the founder selects one thesis and any numbered zones
to carry forward:

1. chrome and hierarchy;
2. ownership story;
3. live access truth;
4. Resources and provenance;
5. motion and reassurance.

- `src/components/app/detail-panel/resources-section.tsx` — "Attach" becomes a
  two-item menu (**Upload from computer** / **Add from Drive** is WP-9; for now
  the single upload path routes to Drive when the board has storage). Keep the
  existing one-control drop zone. Row states: in Signal Studio / in the board's
  Drive folder / unavailable.
- `src/components/app/settings/sections/connections.tsx` — new tab in
  `settings-app.tsx` `TABS` (renumber the eyebrows). Connect, disconnect with
  consequence copy stated *before* the confirm, and a permanent line naming the
  storage owner.
- **"Who can open this board's files"** — read live from `permissions.list`,
  not from our own table. This is the screen that makes the safety claim
  checkable, and it is the one you will want the first time somebody asks
  whether an ex-supplier still has the contract.
- `experience/registry.json` entries for the new surfaces, plus materiality
  review. Run `pnpm experience:validate` to learn exactly what it demands.

**Acceptance:** `pnpm first-contact:language` passes; `pnpm experience:validate`
passes; the selected thesis is verified in the running app and evidence is
captured at all four registry breakpoints. Existing Drive files open via
`webViewLink` in a new tab, never an embedded viewer.

---

### WP-8 · Resilience and launch
**Goal.** The things that are invisible and decide whether this is sellable.

- **Four repair paths.** The shared count-only cron independently drains exact
  permission revocations, permission creations, folder provision/rename work
  and Signal-native byte-cleanup receipts. All four flags default off and each
  requires an individual founder-controlled launch decision. No response or
  log exposes member emails, provider ids, operation ids or byte locators.
- **Storage-owner handover.** The backend blocks the storage owner from leaving
  without an authorized interactive handover. The worker must not replay
  handover because its actor authority is not durable journal state.
- **Deletion and erasure.** Durable Project deletion, Drive-writer fencing,
  Signal-native writer custody and account-erasure precedence are implemented
  as release-candidate backend controls. Their final integrated gate evidence
  belongs in `STATUS.md`.
- **Privacy copy.** Files now sit in a member's personal Drive; that is a real
  change to what you tell customers, and it affects account deletion — we can
  delete our rows but must not delete files that now belong to someone else.
  Founder task, not an engineering ticket.
- **HQ sync**, per `AGENTS.md`: feature record, the token-storage risk, and the
  decision record in the `studio` repo, same cycle.

**Still required before launch:** the selected WP-7 production UI and live
in-product acceptance; founder-approved privacy wording; founder-authorized
migrations 0028 and 0029 after backup and rehearsal; a separate production
deployment authorization; then deliberate activation and observation of each
repair flag.

### Release-candidate custody addendum

These rules were added during hardening and are now part of the acceptance
contract:

- Project deletion records durable intent before provider work. Every Drive or
  Signal-native writer orders its final database change against that intent in
  the same transaction.
- A native browser upload carries an exact writer marker and exact cleanup
  target. Deletion cannot outrun live authority. After the signed authority and
  bounded in-flight drain margin expire, the exact locator enters durable
  cleanup custody before its row or marker can disappear.
- Ambiguous or rejected native writes retain evidence. The byte worker may
  consume only the exact recorded Blob pathname, disk key or stored path; it
  never derives a prefix and never touches Drive-owned bytes.
- Account erasure and Project deletion use first-committer precedence. A live
  Project deletion proceeds; erasure may subsume non-live deletion for a
  Project the account owns. Surviving-Project tombstones are preserved and
  ambiguous work is re-armed after the account fence lifts. Unrelated
  bystander operations survive unchanged.
- Exact cleanup receipts are staged in the same immediate transaction as the
  rows they outlive. A storage failure leaves the receipt for idempotent replay;
  a process crash cannot turn a broad prefix or client URL into deletion
  authority.

---

## 5 · Out of scope

Do not build these, and do not let them creep in:

- Picking existing Drive files (the Google Picker). Genuinely useful, entirely
  additive, and it needs a second Google component. It is WP-9, later.
- Shared Drives. `drives.list` requires a restricted scope and they are a paid
  Workspace feature this market largely lacks.
- Two-way sync, `changes.watch`, any background reconciliation of file
  metadata. Refresh on open is enough.
- A folder per task. One per board is the unit people think in.
- OneDrive, SharePoint, Dropbox. The shape generalises; a second provider now
  doubles the surface for no learning.
- AI over document contents. It needs the bytes back through our servers — a
  separate decision with its own privacy story.
- Exposing any resource on a public, share, print or embed surface.
- Retiring the `attachments` table.

---

## 6 · Stop and ask the founder

Do not decide these alone:

1. Anything that would widen the OAuth scope beyond `drive.file`.
2. Any change from the founder-approved Drive `writer` default to `reader` or
   another role. It is reversible but user-visible.
3. Authorizing migrations 0028 and 0029 against production — both receipts
   must say *not authorized* until the founder approves a verified backup and
   isolated-copy rehearsal.
4. Any change to what the privacy policy says about where files live.
5. Whether to charge differently for Drive-backed boards.
6. Which WP-7 thesis — A · Custodian, B · Ledger or C · Threshold — and which
   numbered zones become the production design.
7. Authorizing the production deployment after the selected UI and live
   acceptance are complete.
8. Activating each of the four repair-worker flags. Treat each flag as a
   separate operational decision.

---

## 7 · Definition of done

- All hard rules in §2 enforced by code and proved by a contract test.
- `pnpm lint`, `pnpm typecheck`, `pnpm test:project-drive`, `pnpm test`,
  `pnpm db:contract`, `pnpm first-contact:language`,
  `pnpm experience:self-test`, `pnpm experience:fixtures`,
  `pnpm experience:validate`, `pnpm build` and `pnpm perf:budgets` all pass.
- `node scripts/check-module-boundaries.mjs` and
  `node --test src/server/tenant-scope-rules.test.mjs` pass; Linux CI is green.
- The selected production UI passes browser verification in the real app at
  all four registered breakpoints, including empty, loading, failure,
  disconnected, incomplete-access and repair-pending states.
- Two real Google accounts demonstrate the full lifecycle: connect → attach →
  second member opens → member removed → access lost.
- Signal-native storage still works with Drive disconnected. The feature can be
  switched off without a customer losing a file.
- `STATUS.md` reflects reality; `CHANGELOG.md` has a dispatch entry; the Studio
  HQ record is synchronized.
- Production remains unchanged until the founder separately approves privacy
  wording, migrations 0028/0029, deployment and each repair-worker activation.
