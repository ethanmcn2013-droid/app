# Decisions — Project Drive

## D17 · Delegated Custodian implementation slice (2026-09-04)

The user approved the full January programme and delegated design decisions.
Under that delegation, A · Custodian is selected as the proposed implementation
thesis for the default-off Connections/Resources UI. This is not a
founder-selected direction or a completed founder design lock. Reuse the
existing three-direction exploration; do not start a new programme.

The materiality assessment, implementation evidence and exact incomplete
boundaries are in `UI-SLICE.md` and `UI-MATERIALITY.md`. Internal review only:
no provider/production changes, publication, design gate or human usability
claim. Handover selection and killed-browser upload recovery remain incomplete.
The feature flag is `NEXT_PUBLIC_PROJECT_DRIVE_UI`, literal `true` only;
flag-off retains native uploads. Formal review and launch gates remain open.

Decisions already taken. A session executing `PROJECT.md` should treat these as
settled and get on with building. If one turns out to be wrong, change it here
with a dated note rather than quietly diverging in code.

---

## D1 · Google Drive is the store, not just a source

**Decided 2026-08-27 by the founder**, overriding the connected-storage
review's recommendation to use Drive only for references.

The review argued that uploading project files into a personal Drive breaks
collaboration, because Drive ownership is per-person while a Signal Studio
board is shared. The founder's counter is that sharing the board's folder with
the board's members resolves exactly that, and that occasional request-access
friction is normal in their market rather than a product failure.

The counter is correct, and the review's verdict is superseded on this point.
Its map of the existing codebase stands.

## D2 · Scope is `drive.file`, permanently

As verified against Google's published classification on 2026-08-27,
`drive.file` is non-sensitive and did not require the sensitive/restricted-
scope verification path or its unverified-app user cap. Re-check Google's
current policy before any future scope change; this record is not a permanent
compliance or cost guarantee.

The blocking question was whether an app holding only `drive.file` may manage
sharing. Google's own machine-generated API description (Drive v3, revision
20260823, vendored at `docs/drive-api-v3-discovery-20260823.json`) lists
exactly two scopes for `permissions.create`: `drive` and `drive.file`. The same
is true of `permissions.delete` and `permissions.update`. `files.create`,
`get`, `list`, `update`, `delete` and `changes.watch` all accept it too.

Only `drives.list` requires a restricted scope, which is what puts Shared
Drives out of reach and confirms the My Drive path.

**This scope is also the primary security control.** Under `drive.file` the app
can reach files it created or the user explicitly opened with the app; it
cannot list or roam the rest of the user's Drive. That remainder is not "data
we promise not to read" — it is data the token cannot reach.

## D3 · Four new tables, not a parallel file system

The original brief proposed `Attachment`, `File`, `ExternalFile`,
`StorageProvider`, `ProviderConnection`, `ProjectFile`, `TaskAttachment`.

The system needs `provider_connections`, `workspace_storage`,
`drive_folder_grants` and `project_drive_operations`, plus three additive
columns on the existing `resources` table: `storage`,
`storage_generation_id` and `stored_path`. The table already carries `kind`,
`provider`, `external_id`, `access_state` and `counts_against_storage` from
migration `0017`, and was designed for exactly this. Exact Signal-native byte
cleanup receipts reuse `meta`; they do not add a fifth table.

`attachments` is left alone. Retiring it is a separate change and must not be
coupled to this one.

`drive_folder_grants` is not bookkeeping — it is the security control. Because
we store the `permission_id` Google returned against the immutable storage
generation that received it, removing a member revokes exactly what we granted
rather than guessing, and a handover cannot overwrite the old folder's repair
evidence.

## D4 · One current storage owner per board; one current Drive connection per person

A board nominates a **storage owner** — a member with `manageProject` who
connects their Drive. Every upload to that board, by any member, is written
with the storage owner's credential into the storage owner's folder. Other
members never see an OAuth screen.

The current row is not the history. Both provider credentials and board-folder
storage use immutable generated ids plus an `is_current` flag guarded by a
partial unique index. This handles owner A → B → A, reconnecting a different
Drive account, and replacing a deleted folder under the same connection
without rewriting the identity attached to old files or grants.

The alternative — each member connecting their own Drive — fails on the
platform's rules: a folder created under one user's `drive.file` grant is not
automatically visible under another's, so each member would have to locate it
through a picker before their first upload. That is a per-member setup tax for
no benefit.

**Consequences, all of which must be stated in the product, not buried:**
- Every file is owned by the storage owner and counts against *their* Drive.
- The storage owner can see everything anyone attaches to that board.
- If they leave, or revoke, or fill their Drive, the board loses its store —
  hence the handover flow and the permanent on-screen line naming them.

## D5 · Members get Drive `writer` by default

Least privilege would suggest `reader`, since all Signal-mediated writes go
through the storage owner's credential and a member never needs Drive write
access to attach a file.

`writer` wins anyway, because editing a shared Sheet or Doc in place is a large
part of why putting files in Drive is worth doing at all, and read-only access
would break exactly the workflow this feature exists to serve.

The blast radius is acceptable: a Drive `writer` cannot permanently delete
another user's file. Per the API description, only the owner may trash a file,
and other users retain access to it in the owner's trash until it is purged.

Reversible, and user-visible — confirm with the founder before changing.

## D6 · Bytes go browser → Google, never through our servers

Signal Studio mints a resumable upload session server-side and hands the
browser only the session URL. The access token stays on the server.

This is the design's largest practical win. Before WP-0 the native path posted
the whole file to a server action and could not reach the promised limit.
Configured Signal-native Blob and Drive uploads now both send bytes directly
from the browser; the server authorizes, binds and verifies metadata. The
no-Blob fallback remains a separate 3 MB server path. Drive supports
much larger files at the provider layer, but Signal Studio deliberately keeps
the founder-approved 50 MB product limit.

It also means **a client-supplied file id is never evidence**. On finalize the
server must verify with `files.get` that the file carries our
`appProperties.signalResourceId` *and* sits in this board's folder.

## D7 · Signal-native storage stays, as a live fallback

Not a legacy path to be retired. It is load-bearing:
- boards with no Drive connected;
- a disconnected, full, or unreachable Drive;
- anything needing tighter-than-board access, because Drive's inherited
  permissions **cannot be reduced on an individual item** — everything in a
  board folder is visible to everyone on that board.

The feature must be switchable off at any moment without a customer losing a
file. That is also why WP-0 exists: the fallback has to actually work first.

## D8 · Idempotency is `appProperties`, decided once

Every upload is stamped with a Signal-generated id in `appProperties` — a field
Google keeps private to the requesting app. Any retry queries for that id
before creating anything.

Retry safety never depends on a worker. The durable operation journal and
default-off repair route may resume interrupted work, but every provider call
is idempotent from its own immutable receipt. This one decision removes the
duplicate-file class even when scheduled repair is disabled.

## D9 · Naming

The user-facing frame is the one the product already uses. The task panel
section stays **Resources**. Settings gets **Connections**, with
**Connect Google Drive**. The access screen is
**"Who can open this board's files"**.

Not "Connected Storage" — that is an architecture term, and
`pnpm first-contact:language` exists precisely to keep phrases like it off the
surface. "Project Drive" is an internal project name and should not appear in
the product.

## D10 · Deferred, deliberately

Choosing existing Drive files via the Google Picker is genuinely valuable and
entirely additive — it needs no folder tree, no upload path and no quota. It is
deferred only because it requires a second Google component and would delay the
capability the founder actually asked for. It is the obvious next package once
this ships.

## D11 · The upload ceiling is 50 MB, and the bytes stop crossing our servers

**Decided 2026-08-27 by the founder**, answering Q4 in `STATUS.md`.

WP-0 was scoped to make four contradictory file-size numbers agree. Reading
Google's neighbours turned up a fifth that nobody had written down, and it was
the one that bound: **Vercel refuses any function request or response body over
4.5 MB** with `413 FUNCTION_PAYLOAD_TOO_LARGE`, before the framework or our code
sees it (`https://vercel.com/docs/functions/limitations`, observed 2026-08-27).

That made the package's own acceptance criterion impossible. `next.config.ts`
was set to `8mb`, which is above the platform cap and therefore never fired;
`SERVER_UPLOAD_LIMIT_BYTES` promised 50 MB; the free tier promised 10 MB; the
toast said 50 MB. Every one of them was unreachable, and *a ~5 MB PDF could not
be attached at all* — the exact thing WP-0 says must work in production.

Two answers were possible. Cap everything at 4 MB, which is honest, costs half
a day and no risk, but leaves the Signal-native fallback — the one D7 calls
load-bearing — able to carry almost nothing. Or move the bytes off the function
path entirely.

The founder chose the second. The browser now asks the server for a URL signed for one pathname, one size
and one content-type set, PUTs the bytes straight to the store, and calls a
finalize action that re-authorizes and inspects what actually landed. Nothing
but metadata crosses a function, so the 4.5 MB cap stops applying and 50 MB is
a number we can keep.

**A presigned URL rather than `@vercel/blob/client`.** The client helper does
the same job and costs 36.7 KB gzip in every browser that loads the app, which
breached the bundle ratchet — and that ratchet is a founder decision, not an
edit. Presigning leaves the browser a bare `fetch(url, { method: "PUT" })` and
no library at all: measured 941.4 KB with the helper, 905.4 KB without it,
against a 904.7 KB baseline. It is also the stronger posture. The client token
could not constrain the ACCESS MODE — the browser passed its own — so a
modified client could have written a private-by-policy attachment as a public
object at a pathname we already know. A presigned URL bakes `access: "private"`
in server-side, and the delegation is `put`-only, single-pathname and expiring.

The trade is multipart: one `PUT` carries the whole file, so a dropped
connection restarts rather than resumes. At a 50 MB ceiling that is a worse
minute, not a broken feature. WP-6 moves those files onto Drive's own resumable
sessions while preserving the same 50 MB customer promise.

**This is deliberately the same shape as WP-6.** Server mints a scoped session,
browser sends the bytes to the provider, server verifies at finalize and treats
the returned id as a claim rather than as evidence. WP-6 will do it against
Drive with `files.get`, `appProperties.signalResourceId` and `parents`; this
does it against Blob with a pathname comparison, an anonymous-read check and a
magic-number re-sniff. The work is not thrown away when Drive lands — the
pattern is already established and already tested.

**Consequences:**
- The single source is `src/lib/upload-limit.ts`. No byte count for an upload
  limit may appear anywhere else; `src/server/upload-limit-contract.test.ts`
  asserts the source text, not just the values, so a re-introduced literal
  fails CI even when it happens to match.
- `bodySizeLimit` is now 4 MB — *below* the platform cap on purpose. A body
  over our line gets a framework error naming the limit; a body over Vercel's
  gets an opaque 413. Failing on our own line first is the difference between
  a diagnosable error and a mystery.
- `uploadAttachmentAction` survives as the fallback for a deployment with no
  blob store, and is honestly capped at 3 MB.
- The free tier's 10 MB stays. It is a plan promise, not a transport one, and
  it is now reachable for the first time.
- Two properties the old path got for free had to be rebuilt: content
  validation is re-applied to the bytes read back out of the store, and a
  claim row abandoned by a killed browser is swept rather than left holding
  quota forever.
- `next.config.ts` `connect-src` now admits `vercel.com` and
  `*.blob.vercel-storage.com`. The browser originates two requests it never
  used to; without this an enforced policy would break every attachment.

## D12 · Drive identity and custody are generation-aware

**Corrected 2026-09-02 during WP-3 implementation.**

`provider_account_id` stores Drive's `about.user.permissionId`, not an OpenID
`sub`. `about.get(fields=user(permissionId,emailAddress))` is available under
the already-ratified `drive.file` scope; an OpenID `sub` would require widening
the OAuth request with identity scopes. D2 wins: scope is not widened for a
field Drive already exposes safely.

A connection id identifies one immutable credential generation. A storage id
identifies one immutable board-folder generation. They cannot be the same
identity: owner A → B → A and a replacement folder under owner A both reuse a
connection relationship while requiring a new folder generation. Resources
therefore store `storage_generation_id`; the connection is derived through
`workspace_storage`. Grants key on `(storage_generation_id, user_id)` and carry
the workspace in a composite foreign key so a permission receipt cannot be
moved to another board.

The database also enforces the storage pair: a Drive resource must name its
immutable storage generation, while a Signal-native resource must not name
one. SQLite cannot add a composite foreign key to the existing `resources`
table without rebuilding it, so matching insert/update guards enforce that the
generation belongs to the resource's workspace. Provider scope payloads must
be valid JSON; the exact one-scope allowlist is enforced by the application
contract because SQLite cannot safely encode the whole OAuth policy as a
generic JSON-shape constraint.

All custody foreign keys use `RESTRICT`. Account erasure, project deletion,
disconnect and handover must explicitly revoke and clean in the right order;
the database may not silently cascade or null the exact ids the repair path
needs. This is an integrity backstop, not a substitute for the hand-wired
libSQL lifecycle.

## D13 · An ambiguous upload failure keeps its claim and session

**Corrected 2026-09-02 after the live spike and WP-6 failure analysis.**

The original WP-6 prose copied the Signal-native rule that any failure deletes
the pending claim. That is unsafe after a resumable Drive session has reached
the browser. A connection loss or provider 5xx can happen after Google accepted
some or all bytes; deleting the claim also deletes the stable
`signalResourceId`, so a retry can create a duplicate while the first upload
finishes out of sight.

Before delegation, a failed mint may delete its claim. After delegation, the
session URL is a credential: store it encrypted, bound to the workspace,
storage generation and resource id; retain the pending claim on every ambiguous
outcome; probe and resume the same session. A replacement session is allowed
only after the old one returns a definitive 404 and an app-property search
finds no landed file. Neither uncertainty nor inconvenience is evidence that
it is safe to mint twice.

## D14 · Incomplete member coverage pauses new Drive uploads

**Decided 2026-09-02 from the live `cannotInviteNonGoogleUser` result.**

Signal Studio membership does not require a Google account, while a Drive
folder grant does. A member whose project email is not attached to Google must
remain a valid member; rolling back their invitation would make storage choose
who may collaborate. But continuing to put new files in Drive would knowingly
create files that one current member cannot open.

Therefore the current member set and current-generation grant receipts are an
upload precondition. If any non-owner member lacks a verified grant, new files
take the Signal-native path and the access screen names the gap. Existing Drive
files stay where they are and may remain unavailable to that member until the
project uses a Google-account address for them. The product must state this
plainly; neither a missing receipt nor a provider refusal may be presented as
full coverage.
## D15 · Consent rotation does not rewrite storage history

**Decided 2026-09-02 during WP-4 implementation.**

Every successful OAuth consent inserts a new immutable
`provider_connections` row. The previous generation is retired locally; it is
never updated in place. Connection generation and folder generation remain
separate identities:

- a same-account reconnect is recognized only by Drive
  `about.user.permissionId`, may reuse that account's app-marked
  `Signal Studio` root, and does not revoke the previous refresh token because
  Google's revocation is grant-level and can invalidate the newly issued
  token too;
- a different account gets a different root and cannot adopt the previous
  account's folder, even when the display email happens to match;
- A → B → A creates three credential generations. Returning to A may find A's
  app-marked root through A's `drive.file` grant, but does not rewrite either
  earlier row;
- a `workspace_storage.connection_id` remains immutable provenance. A later
  access helper must resolve the newest current credential in the same
  `(user_id, provider, provider_account_id)` lineage. It must not repoint old
  storage generations or resources to make a reconnect look simpler.

WP-4 creates only the private, unshared root. A Project-authorized connection
action proves who may begin consent, but it does not enable Drive for that
Project. Board folders, `workspace_storage` generations and named-user grants
begin in WP-5.

The callback is configured by one exact `GOOGLE_OAUTH_REDIRECT_URI` per
deployment. Its validated origin is also the return-redirect allowlist; an
incoming Host is not authority. Preview therefore returns to Preview without
making a canonical production URL part of OAuth identity.

External permission receipts have stricter erasure ordering than refresh
tokens. Google must confirm deletion of the exact `(folder_id, permission_id)`
before `drive_folder_grants` is deleted. The idempotent revoker, migration
0029 operation journal, export and erasure ordering are implemented on the
feature branch; production migration and launch remain founder-gated.

## D16 · Deletion authority and byte custody are durable

**Decided 2026-09-03 during release-candidate hardening.**

Project deletion records durable intent before provider work, and every Drive
or Signal-native writer orders its final database write against that intent
and both account-erasure fence layers. A browser's native write authority
remains fenced through its exact expiry plus a bounded in-flight drain margin.
Once that authority is certainly dead, rejected or abandoned Signal-owned
bytes move to an exact per-object cleanup receipt before their attachment row
or marker disappears. The leased cleanup worker may retry only that locator;
it cannot derive a prefix and never touches Drive-owned bytes.

Account erasure yields when a live leased Project deletion committed first.
Erasure may subsume a non-live deletion for a Project the account owns. For a
surviving Project it preserves the deletion tombstone, re-arms ambiguous or
expired work after the account fence lifts, and leaves unrelated bystander
operations untouched. This first-committer model is an availability choice and
a custody boundary, not an implementation convenience.
