# WP-1 spike findings — partial

Observed behaviour, not documentation. Produced by
`scripts/spike/drive-chain.mjs` against real Google accounts.

**Run:** 2026-08-27 · **Scope requested:** `https://www.googleapis.com/auth/drive.file`
**Status:** proofs 1 and 1b observed. Proofs 2–7 blocked on account B's
sign-in, which needs a password and is therefore a human step.

---

## What was observed

| # | Question | Result | Observed |
|---|---|---|---|
| 1 | OAuth with `drive.file` only returns a refresh token | **pass** | Refresh token issued. `access_type=offline` + `prompt=consent` are both required; with either missing a re-authorization returns an access token only |
| 1b | The **granted** scope equals the **requested** scope | **fail — by design, see below** | Requested `drive.file`; granted `drive.file openid userinfo.email userinfo.profile` |
| 2–7 | Folder creation, sharing, resumable upload, member access, parent invisibility, revoke | not yet run | Blocked on account B |

---

## Finding 1 · `include_granted_scopes` makes the grant a superset

The spike asked for exactly one scope and Google returned four.

This is not Google widening our access unilaterally. The spike passes
`include_granted_scopes=true`, which is Google's **incremental
authorization** flag: the returned token carries every scope this user has
already granted this *project*, merged with the new one. Account A had
already granted `openid`, `email` and `profile` through Clerk's *Sign in
with Google*, so those came back too.

**Why this matters for WP-4, concretely.** Hard rule §2.1 says the
requested scope set must equal exactly `["…/auth/drive.file"]`. That rule
is about the **request** and it held. But a contract test written naively
against the token *response* would fail on a real account and pass only on
a fresh one — the worst kind of test, because it goes green in CI and red
in production.

**Decision for WP-4, recorded here so it is not rediscovered:**

- Do **not** send `include_granted_scopes=true`. We never want the merged
  grant; we want one scope, minted for one purpose, revocable on its own.
- The §2.1 contract test asserts the **requested** set, which is source
  text we control, not the granted set, which the platform composes.
- Widening the assertion to "granted ⊇ requested" would be the wrong fix.
  It would pass for `drive` as readily as for `drive.file`, which is the
  exact substitution the rule exists to prevent.

## Finding 2 · The consent wording is good, and it is this

Verbatim, on the screen a customer sees:

> **Signal Studio wants additional access to your Google Account**
>
> When you allow this access, Signal Studio will be able to:
> **See, edit, create, and delete only the specific Google Drive files you
> use with this app.**

That answers **Q2**. It is a sentence worth quoting in our own copy — it
says the narrow thing plainly, and it is Google saying it rather than us.

Two adjacent observations from the same screen:

- **No "unverified app" interstitial appeared.** The scary
  *"Google hasn't verified this app"* screen did not show, consistent with
  `drive.file` being non-sensitive.
- Google showed *"Learn why you're not seeing links to Signal Studio's
  Privacy Policy or Terms of Service"*. The links exist and are set; they
  are withheld until branding is verified. Cosmetic, not blocking — and a
  reason to do the branding verification before launch rather than never.

## Finding 3 · The consent screen was already published

Q1-adjacent, and it removes a launch risk the plan flagged loudly.
Publishing status was already **In production** — Clerk's Google sign-in
had required it months ago. The seven-day refresh-token expiry that
applies to apps left in Testing never applied to this project.

## Finding 4 · Secrets cannot be re-read, and must not be transcribed

The Google Cloud console no longer offers a JSON download at client
creation, and states plainly that *"viewing and downloading client secrets
is no longer available"*. A secret is shown once, on screen.

The first attempt read it off that screen and got one character wrong,
which surfaced as `invalid_client: The provided client secret is invalid`
— an error that reads like the credentials are wrong when in fact they had
been mis-copied. An `I`/`l` or `O`/`0` in a proportional font is not
recoverable by eye.

**The reliable path**, and the one to write into any future runbook: add a
*second* secret from the client's detail page, which does offer a download
control, take the value from the downloaded JSON, then disable and delete
the first. That was done here; the client now has exactly one enabled
secret, matching Vercel.

---

## Still to verify

Against live Google documentation and behaviour:

- Picker/preview CSP hosts, if the Drive viewer is embedded (WP-6/WP-9).
- Whether `changes.watch` under `drive.file` is worth anything later.
- Resumable session lifetime, and behaviour on resume after a gap.

Against the two accounts, once account B has signed in:

- 2 · `Signal Studio/` and a board folder inside it.
- 3 · `permissions.create` on the board folder, `sendNotificationEmail:
  false` — **the load-bearing assumption in D2.**
- 4 · Resumable session minted server-side, bytes PUT separately.
- 5 · Account B opens the file with no request-access step.
- 6 · `permissions.delete` → access lost, on the folder and by inheritance
  on the file.
- 7 · **The `Signal Studio` parent folder is not reachable by account B** —
  the claim the entire feature makes.

The harness runs all of these unattended once the sign-in completes.
