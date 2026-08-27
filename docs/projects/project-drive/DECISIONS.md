# Decisions — Project Drive

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

`drive.file` is non-sensitive: no CASA security assessment, no annual audit,
and the 100-user cap on unverified apps does not apply to it once the consent
screen is published.

The blocking question was whether an app holding only `drive.file` may manage
sharing. Google's own machine-generated API description (Drive v3, revision
20260823, vendored at `docs/drive-api-v3-discovery-20260823.json`) lists
exactly two scopes for `permissions.create`: `drive` and `drive.file`. The same
is true of `permissions.delete` and `permissions.update`. `files.create`,
`get`, `list`, `update`, `delete` and `changes.watch` all accept it too.

Only `drives.list` requires a restricted scope, which is what puts Shared
Drives out of reach and confirms the My Drive path.

**This scope is also the primary security control.** Under `drive.file` the app
cannot see, list or name anything it did not create. The rest of the user's
Drive is not "data we promise not to read" — it is data the token cannot reach.

## D3 · Three new tables, not six

The original brief proposed `Attachment`, `File`, `ExternalFile`,
`StorageProvider`, `ProviderConnection`, `ProjectFile`, `TaskAttachment`.

The system needs `provider_connections`, `workspace_storage` and
`drive_folder_grants`, plus four additive columns on the existing `resources`
table — which already carries `kind`, `provider`, `external_id`, `access_state`
and `counts_against_storage` from migration `0017`, and was designed for
exactly this.

`attachments` is left alone. Retiring it is a separate change and must not be
coupled to this one.

`drive_folder_grants` is not bookkeeping — it is the security control. Because
we store the `permission_id` Google returned, removing a member revokes exactly
what we granted rather than guessing, and we can reconcile our belief against
Drive's own answer.

## D4 · One connection per board, not one per person

A board nominates a **storage owner** — a member with `manageProject` who
connects their Drive. Every upload to that board, by any member, is written
with the storage owner's credential into the storage owner's folder. Other
members never see an OAuth screen.

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

This is the design's largest practical win. The current path posts the whole
file to a server action, which caps real uploads at about 8 MB
(`next.config.ts` `bodySizeLimit`) and buffers the entire file in memory.
Uploading direct to Drive removes the body limit, the memory pressure and the
egress at once, against a documented Drive maximum of 5 TB.

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

There is no queue or background worker in this repository, so retry safety
cannot be delegated to infrastructure. This one decision removes the entire
duplicate-file class.

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
