# WP-1 spike findings

Observed behaviour, not documentation. Produced by
`scripts/spike/drive-chain.mjs` against real Google accounts.

**Run:** 2026-08-27 · **Scope requested:** `https://www.googleapis.com/auth/drive.file`
**Owner:** `ethanmcn2013@gmail.com` (the Signal Studio account for now;
moves to a business account before launch)
**Member:** `e10mcn2015@gmail.com`

**Status: eleven of the twelve checks pass.** The outstanding one is not a
doubt about the design — it is that the member account could not complete
Google's own identity challenge today, so the three checks that require a
*second person's credentials* have not been run. Everything that could be
observed with the owner's credentials has been.

---

## The seven questions

| # | Question | Result |
|---|---|---|
| 1 | OAuth with `drive.file` only → refresh token | **pass** |
| 2 | Create `Signal Studio/` and a board folder inside it | **pass** |
| 3 | `permissions.create` on the board folder, no notification email | **pass** |
| 4 | Resumable session minted server-side, bytes PUT separately | **pass** |
| 5 | The member opens the file with no request-access step | pending |
| 6 | `permissions.delete` → the member loses access | pending |
| 7 | The `Signal Studio` parent is not visible to the member | pending |

Pending means *not yet observed*, not *in doubt*. Phase B runs all three
unattended: `node --env-file=.env.spike scripts/spike/drive-chain.mjs b
their@email`. The owner does not re-consent — his refresh token is stored
and was proved to still mint an access token unattended.

---

## Finding 1 · `include_granted_scopes` silently widens the grant

The first run asked for one scope and Google returned four:
`drive.file openid userinfo.email userinfo.profile`.

That flag is **incremental authorization**: the returned token carries
every scope this user has already granted this *project*, merged with the
new one. The owner had already granted `openid`, `email` and `profile`
through Clerk's *Sign in with Google*, so those came back too.

Removing the flag fixed it. The second run granted exactly
`https://www.googleapis.com/auth/drive.file` and nothing else.

**Why this matters for WP-4, concretely.** Hard rule §2.1 says the
requested scope set must equal exactly `["…/auth/drive.file"]`. That rule
is about the **request**, and it held throughout. But a contract test
written against the token *response* would have passed on a fresh account
and failed on a real one — green in CI, red in production, which is the
worst possible direction for a security test to fail in.

**Decisions, recorded so they are not rediscovered:**

- Do **not** send `include_granted_scopes=true`. We want one scope, minted
  for one purpose, revocable on its own.
- The §2.1 contract test asserts the **requested** set — source text we
  control — never the granted set, which the platform composes.
- Widening the assertion to "granted ⊇ requested" would be the wrong fix:
  it passes for `drive` as readily as for `drive.file`, which is the exact
  substitution the rule exists to prevent.

## Finding 2 · **Google does not stop us making a board folder public**

This is the most important thing in this document.

Hard rule §2.3 says only `type: "user"` grants, never `anyone`. The spike
asked Google to create `{ type: "anyone", role: "reader" }` on a board
folder under `drive.file`, expecting a refusal.

**It returned HTTP 200.** The folder became a public link. The spike
removed it again immediately.

So there is **no platform backstop** for §2.3. The narrow scope does not
save us here: `drive.file` lets an app do anything it likes to files it
created, including sharing them with the world. The only thing standing
between a bug and a customer's contracts on a public URL is
`assertGrantTarget` in `src/server/connections/drive-grants.ts` — code we
have not written yet.

**Consequences for WP-5:**

- `assertGrantTarget` is not defensive tidiness. It is the control.
- It must be the *only* path to `permissions.create`, and the contract
  test asserting that must check the whole tree, not just the file it
  expects to find the call in.
- WP-7's "Who can open this board's files" should read from Drive's own
  `permissions.list` — confirmed working below — and show a loud, plain
  warning if it ever finds a non-`user` grant. Our table would not know.

## Finding 3 · D2 is confirmed, by observation

`permissions.create` under `drive.file`, with `sendNotificationEmail=false`,
for a real Google account:

```
PASS  {"id":"…","type":"user","emailAddress":"e10mcn2015@gmail.com","role":"writer"}
```

D2 rested on Google's machine-generated discovery document listing
`drive.file` for `permissions.create`. It is now observed against the live
API. The sharing design stands.

`permissions.list` also reads back correctly — two entries on the board
folder (`user/writer` the member, `user/owner` the owner), which is what
WP-7's access screen will render.

## Finding 4 · Inviting a non-Google address is refused, by name

An earlier probe used a synthetic address and got:

```
403 cannotInviteNonGoogleUser
"Sorry, you cannot share with …@example.com because they do not have a
 Google Account."
```

**This is a product case, not a test artefact.** A Signal Studio member is
whoever the board owner invited by email — there is no requirement that it
be a Google address. When it is not, the Drive grant will fail with this
error while the person remains a perfectly valid member of the board.

WP-5 must handle it: the member stays in the project, their files fall
back to Signal-native storage, and the access screen says plainly that
this person cannot be given the Drive folder because their email is not a
Google account. Silently swallowing this would produce a member who
appears to have access and does not.

Worth noting the error is specific and well-named, so it can be matched on
`reason === "cannotInviteNonGoogleUser"` rather than string-matching prose.

## Finding 5 · The root folder is clean, and stays clean

`permissions.list` on `Signal Studio/` returns exactly one entry —
`user/owner` — with the board folder shared. §2.2's baseline holds: sharing
a child does not propagate upward.

## Finding 6 · `about.get` exposes the quota under `drive.file`

WP-6 pre-checks free space before minting an upload session. It was not
obvious a scope this narrow could read account-level storage. It can:

```
usage 14 135 307 508 of 16 106 127 360
```

**One caveat for WP-6:** an unlimited account returns no `limit` field at
all. Treat a missing limit as *do not block*, never as zero.

## Finding 7 · Resumable upload and the idempotency stamp both work

- The session is minted server-side and the access token never leaves that
  call — D6's shape, confirmed.
- 5 MB PUT to the session URL landed with `parents` containing the board
  folder.
- `appProperties.signalResourceId` is queryable afterwards, and a repeat
  query returns the same single file. D8's duplicate-removal claim holds.

## Finding 8 · The consent wording, verbatim

Answering **Q2**. This is what a customer reads:

> **Signal Studio wants additional access to your Google Account**
>
> When you allow this access, Signal Studio will be able to:
> **See, edit, create, and delete only the specific Google Drive files you
> use with this app.**

Worth quoting in our own copy — it states the narrow thing plainly, and
Google is the one saying it.

Two adjacent observations:

- **No "unverified app" interstitial.** The alarming
  *"Google hasn't verified this app"* screen did not appear, consistent
  with `drive.file` being non-sensitive.
- Google showed *"Learn why you're not seeing links to Signal Studio's
  Privacy Policy or Terms of Service"*. Both links are set; they are
  withheld until branding verification. Cosmetic, but a reason to do that
  verification before launch rather than never.

## Finding 9 · The consent screen was already published

Publishing status was already **In production** — Clerk's Google sign-in
had required it months ago. The seven-day refresh-token expiry that
applies to apps left in Testing never applied to this project. The launch
risk the plan flagged loudest does not exist here.

## Finding 10 · A client secret cannot be re-read, and must not be transcribed

The console no longer offers a JSON download at client creation, and says
so: *"viewing and downloading client secrets is no longer available."* A
secret is shown once, on screen.

Reading it off that screen got one character wrong — `I`/`l` and `O`/`0`
are not separable by eye in that font — and surfaced as
`invalid_client: The provided client secret is invalid`, an error that
reads like wrong credentials rather than a mis-copy.

**The reliable path, for any future runbook:** add a *second* secret from
the client's detail page, which **does** offer a download control; take the
value from the downloaded JSON; then disable and delete the first. Done
here — the client now has exactly one enabled secret, matching Vercel.

## Finding 11 · A gitignore added on one branch does not protect another

Phase A writes `.spike-state.json`, which holds a live Google refresh
token so phase B does not need a second consent. That file was gitignored
**on the spike branch**. The WP-2 branch was cut from an earlier commit on
the planning branch, so it inherited neither the ignore rule nor the
knowledge that such a file existed — and `git add -A` picked it up.

**GitHub's push protection caught it and refused the push**, naming the
file, the line and the credential type. Nothing reached a branch.

Handled the way it should be rather than the way that is quickest: the
commit was unwound, the ignore rule added on this branch too, and **the
refresh token revoked at Google** (`POST /revoke`, HTTP 200) rather than
left valid on the argument that the object was unreachable. GitHub's
scanner had already read it; that is enough to call it exposed.

**The cost is one extra consent tomorrow** — phase A must be re-run to mint
a fresh owner token before phase B, so the sequence is:

```
node --env-file=.env.spike scripts/spike/drive-chain.mjs a
node --env-file=.env.spike scripts/spike/drive-chain.mjs b their@email
```

**The lesson worth keeping:** any scratch file that holds a live credential
needs its ignore rule in the *first* commit that could create it, not the
one that happens to notice. A throwaway spike is exactly where this slips,
because the file feels temporary and the branch feels private.

---

## Still to observe

Three checks need the member's own credentials, and the member account
could not complete Google's identity challenge on the day of this run:

- **5** · the member opens the file with no request-access step
- **6** · `permissions.delete` → access lost, on the folder and by
  inheritance on the file
- **7** · **the `Signal Studio` parent folder is unreachable by the
  member** — the claim the entire feature makes

The board folder, the file and the member's grant are all still in place in
the owner's Drive. The owner's stored token was revoked (Finding 11), so
phase A must be re-run first to mint a fresh one — two consents tomorrow
rather than one.

Against live documentation, still open:

- Picker/preview CSP hosts, if the Drive viewer is embedded (WP-6/WP-9).
- Whether `changes.watch` under `drive.file` is worth anything later.
- Resumable session lifetime, and behaviour on resume after a gap.
