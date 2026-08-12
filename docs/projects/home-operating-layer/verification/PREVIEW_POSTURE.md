# Preview posture — how Ethan actually sees the lab

**Status:** decision memo, nothing implemented · **Closes:** R-H17 (P1) when the lead decides
**Base:** `feat/home-operating-layer`, on `origin/main` @ `c592e83` · **Measured:** 2026-08-12
**Owner:** Lead · **Blocks:** the Wave 3 deploy and the founder pause

---

## The decision, first

**Recommended: run the founder pause on a branch-scoped preview in production access mode with
real Clerk keys, behind Vercel Authentication — option A+B below.** It is the only option that
exercises the real Clerk path, which is the single largest unproven claim in
`contracts/LAB_ISOLATION.md`, and it turns the founder pause into the evidence that closes it.

It costs Ethan roughly half an hour of console work and one throwaway second Clerk account, and
it depends on three facts nobody has checked yet (§7). If any of the three comes back wrong,
fall back to **option E — no deployment at all**, which costs nothing and exposes nothing.

**There is a second decision in this memo and it is not about the lab.** Preview deployments of
this repository are currently unprotected, and the repository is public. That is measured, not
inferred (§2). It wants a decision whatever happens to the lab.

---

## 1 · What was asked

R-H17 records that `src/lib/access-mode.ts` falls back to `review` for a Vercel preview, which
binds a synthetic demo user and never queries the real database, while the lab guard requires a
real Clerk identity plus a reviewer allowlist. The two cannot both be true, so the preview Ethan
uses to pick a direction cannot currently authenticate him.

That is correct, and it is narrower than the real problem.

---

## 2 · What is true today, measured

Four measurements, taken 2026-08-12 against the live account and the live deployments.

### 2.1 The repository is public

```
$ gh repo view ethanmcn2013-droid/app --json visibility,isPrivate,name
{"isPrivate":false,"name":"app","visibility":"PUBLIC"}
```

Every preview deployment URL is posted by the Vercel GitHub app onto a pull request in a public
repository. A preview URL is therefore not a secret and must never be treated as one.

### 2.2 There is no deployment protection on the `app` project

Vercel API, project `app` (`prj_C4rdqkS6wh9z4V0lku3tuphcNlkN`), team
`ethanmcn2013-1730s-projects` (`team_veMY72ml10cAawsR0CjN9k5y`):

```json
{
  "passwordProtection": { "enabled": false },
  "ssoProtection":      { "enabled": false },
  "trustedIps":         { "enabled": false }
}
```

`ssoProtection` is the API name for Vercel Authentication. All three are off.

### 2.3 Preview deployments serve the whole app anonymously

Anonymous `curl`, no cookies, against a current preview alias:

```
https://app-git-lane-wp3b-route-authz-…vercel.app/                → 200
https://app-git-lane-wp3b-route-authz-…vercel.app/lab/timeline-a  → 200
https://app-git-lane-wp3b-route-authz-…vercel.app/app/home        → 200
```

`/app/home` answering 200 anonymously is the access-mode fallback working exactly as designed:
the preview is in `review` mode, so there is no login wall and the data is in-memory seed. **No
customer data is exposed by this.** What is exposed is the entire unreleased product surface, to
anyone who reads a PR page.

### 2.4 Production serves the six old lab mockups anonymously, and refuses ours

```
https://app.signalstudio.ie/lab/timeline-a            → 200
https://app.signalstudio.ie/lab/home-operating-layer  → 404
```

The 404 is the flag-off branch of the guard, not an identity check. It is the correct answer and
it proves nothing about the identity path.

### 2.5 One documentation drift found in passing

`studio/docs/INFRASTRUCTURE.md` names the Vercel projects as `studio` and **`tasks`**. There is no
`tasks` project on the account; the app deploys through a project named **`app`**, which is what
`DEPLOY.md` says. Outside this programme's write boundary. Recorded so the next person does not
go looking for a project that is not there.

---

## 3 · Why the default preview cannot show the lab

The mechanism, in four lines of source.

| Step | Source | Effect |
|---|---|---|
| Vercel preview, no explicit mode | `access-mode.ts:66-67` | `getAccessMode()` returns `"review"` |
| review is a seed-data posture | `access-mode.ts:81-84` | `isDemoMode()` is true |
| guard refuses seed-data postures | `lab/guard.ts:86` | decision is `"seed-data-posture"` |
| every refusal is the same 404 | `lab/guard.ts:99-101` | `notFound()` |

The refusal is deliberate and correct. In review mode the proxy skips Clerk entirely and the auth
layer binds a synthetic constant, so there is no real reviewer for the guard to check. Trusting a
synthetic identity would make the guard theatre. `LAB_ISOLATION.md` §3 already records this
consequence in writing; this memo settles it rather than discovering it.

An explicit mode is honoured as-is: `access-mode.ts:52-54` downgrades only `demo` and `review` on
a production deployment. `SIGNAL_ACCESS_MODE=production` on a preview therefore yields
`production`, with no code change.

---

## 4 · The options

Six were considered. Each is stated with its mechanism, its cost, what it exposes when
misconfigured, and — the question that actually separates them — what it *proves*.

### Option A · Production access mode on a branch-scoped preview

**Mechanism.** Set on the Vercel Preview environment, scoped to the branch
`feat/home-operating-layer`:

```
SIGNAL_ACCESS_MODE=production
NEXT_PUBLIC_SIGNAL_ACCESS_MODE=production
HOME_REVIEW_LAB_ENABLED=true
HOME_REVIEW_LAB_REVIEWERS=<reviewer emails, optional; the founder is a source literal>
```

Clerk keys and the module database URLs must already be present on Preview, because
`src/env.ts:15-20` makes four of them fatal at boot the moment `isDemoMode()` is false:
`TASKS_DATABASE_URL`, `TASKS_AUTH_TOKEN`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
`INFRASTRUCTURE.md` says preview siblings exist for every module database, so the shape is right;
whether the variables are actually set on the Preview environment is unverified (§7).

**Cost.** Console work only, no code. Roughly 15 minutes, plus a redeploy.

**What it exposes if misconfigured.**

- *Scoped to the whole Preview environment instead of one branch:* every lane's preview stops
  being a no-login-wall review surface. Design review across the workspace depends on that
  posture, so this breaks other people's work, quietly, until someone notices.
- *Any of the four required variables missing on Preview:* the deployment does not boot. It
  throws at `instrumentation.register()` with a named list. Loud, immediate, safe — the good
  failure.
- *`HOME_REVIEW_LAB_ENABLED=true` set on Production by accident:* `/lab/home-operating-layer`
  becomes routable on `app.signalstudio.ie`. The guard still requires a signed-in user with a
  verified primary email on the allowlist, so the blast radius is the allowlist. Not a data leak;
  still an existence oracle for those identities, and still wrong. Mitigate by never setting the
  flag anywhere but Preview.

**What it proves.** The real Clerk path, end to end. `LAB_ISOLATION.md` §6 lists this as the
first of four things not proven, and says exactly what closes it: a deployment in production
access mode with real Clerk keys and two accounts, one on the allowlist and one not. This option
is that deployment. **Nothing else on this list proves it.**

### Option B · Vercel Deployment Protection (Vercel Authentication)

**Mechanism.** Turn on Vercel Authentication for preview deployments on the `app` project. Vercel
challenges every request at the edge and admits only members of the Vercel team. On this account
the team is one person, which is the reviewer.

**Cost.** One toggle. Zero code. Reversible instantly.

**What it exposes if misconfigured.** The dangerous setting is scope. If protection is applied to
**all deployments including production**, `app.signalstudio.ie` goes behind a Vercel login and
the live product is down for every customer. This is the one irreversible-feeling mistake in this
memo and the reason the change should be made deliberately and verified with an anonymous `curl`
against production immediately afterwards.

Second-order: the account is Hobby. Vercel Authentication admits team members, and a Hobby team
cannot invite anyone. If a second reviewer is ever needed, this option cannot serve them without
a plan change. For a founder pause with one reviewer, that limit does not bite.

**What it proves.** Nothing about the lab. Protection sits *in front of* the app, so the guard
never sees a different request. **On its own it does not work at all**: behind Vercel
Authentication the deployment is still in review mode, so `guard.ts:86` still returns 404. B is a
useful layer and a useless plan.

### Option A+B · Both — the recommendation

Production access mode makes the lab reachable by a real reviewer; Vercel Authentication makes
the unreleased product surface unreachable by anyone else. They solve different problems and
neither substitutes for the other.

### Option C · A reviewer bypass token in the application

**Mechanism.** A secret in a query parameter or cookie that the guard accepts in place of a Clerk
identity. Extend `labAccessDecision` with a fifth input.

**Cost.** Small code change inside this programme's own write boundary, plus a test, plus a
secret to manage.

**What it exposes if misconfigured.** A bearer secret in a URL is one paste away from being
public — in a screenshot, a browser history, a referrer header, a support message. The
repository is public, so the token can never be committed, and `.gitignore` already blocks
`.env*`. The exposure is bounded: the lab is fixture-only, statically proven to reach no database
or provider (`LAB_ISOLATION.md` §4). So the worst case is that the four unreleased directions
leak, not that data leaks.

**What it proves.** Nothing about identity. It also contradicts the contract this programme
wrote three days ago — "a 403 tells an authenticated non-reviewer that there is something here to
be refused" is an argument about *identity*, and a token has none. Adopting C means amending
`LAB_ISOLATION.md`, not slipping past it.

**Verdict:** viable, cheap, and a step backwards. Recommended only as a fallback if §7 rules out A.

### Option D · Vercel Protection Bypass for Automation

**Mechanism.** Vercel generates a project-level bypass secret, sent as
`x-vercel-protection-bypass`, or as `?x-vercel-set-bypass-cookie=true` to plant a cookie in a
human's browser.

**Cost.** One toggle, one secret.

**What it exposes if misconfigured.** The secret opens the **entire deployment**, not the lab. It
is option C with a larger blast radius and less control. Its real use is CI reaching a protected
preview, which this programme may want later for the Playwright harness — worth remembering for
that, not for this.

**What it proves.** Nothing about identity.

### Option E · No deployment at all — the local founder pause

**Mechanism.** Ethan runs the lab on this machine: `SIGNAL_ACCESS_MODE=development`, Clerk keys
configured, signed in as himself, `HOME_REVIEW_LAB_ENABLED=true`. Or the lab's 260 cells are
captured as static evidence and reviewed as a compare sheet.

**Cost.** Ethan runs one command, on the machine he is already sitting at. No new infrastructure,
no new secret, no new exposure. He cannot review from a phone or away from the desk.

**What it exposes if misconfigured.** Nothing beyond this machine.

**What it proves.** The lab renders. Not the Clerk path — `development` mode keeps the historical
keyless bypass, so this is a weaker identity story than A, though a stronger one than review
mode.

**Verdict:** the correct fallback, and genuinely a reasonable first choice. It is not the
recommendation only because it leaves R-H10's open item open, and that item will otherwise have
to be closed by a deployment later anyway.

### Option F · A separate protected host for the lab

**Mechanism.** A second Vercel project, or a static export served elsewhere.

**Cost.** Real. The lab is four directions inside one Next application; separating it means
either a second deployment of the same repository — with its own env matrix to keep in sync — or
a static export that stops being the real app, which is the one thing the lab must be to give an
honest read on implementation cost.

**Verdict:** rejected. Cost without a matching gain.

---

## 5 · Side by side

| | Lab reachable by Ethan | Blocks strangers | Proves the Clerk path | New secret | Code change | Founder time |
|---|---|---|---|---|---|---|
| **A** production mode, branch-scoped | yes | no | **yes** | no | no | ~15 min |
| **B** Vercel Authentication | **no** | yes | no | no | no | ~5 min |
| **A+B** *(recommended)* | yes | yes | **yes** | no | no | ~20–30 min |
| **C** app bypass token | yes | partly | no | yes | yes | ~5 min |
| **D** Vercel bypass secret | yes | partly | no | yes | no | ~5 min |
| **E** local only | yes | n/a | no | no | no | ~5 min |
| **F** separate host | yes | depends | no | no | yes | high |

"Blocks strangers" means the unreleased product surface, not the lab. The lab is guarded in every
row except E, where it never leaves the machine.

---

## 6 · If the lead takes the recommendation

In this order. Steps 1 and 2 are Ethan's; the rest can be done alongside.

1. **Turn on Vercel Authentication for preview deployments only.** Vercel → project `app` →
   Settings → Deployment Protection. Choose the scope that covers preview deployments and
   **not** production. Immediately verify with an anonymous request that
   `https://app.signalstudio.ie/` still answers 200 and a preview URL now answers a challenge.
2. **Confirm the Preview environment's variables** (§7.1 and §7.2) before anything else is set.
3. **Set the four branch-scoped variables** from option A on `feat/home-operating-layer`.
4. **Deploy the branch**, then check `/lab/home-operating-layer` as the signed-in founder: expect
   the lab. Sign in as a second, non-allowlisted account: expect **404, not 403, not a redirect**.
   That pair of observations is the evidence that closes item 1 of `LAB_ISOLATION.md` §6.
5. **Record the receipt** in this directory and update `LAB_ISOLATION.md` §6 from "verified in
   part" to verified, quoting both responses.
6. **After the founder pause, remove `HOME_REVIEW_LAB_ENABLED`.** Nothing else needs undoing; the
   route family returns to 404 for everyone.

---

## 7 · The three things nobody has checked

Any of these can sink option A on the day. All three are cheap to settle and none has been
settled here.

### 7.1 Which Clerk instance do the Preview keys belong to, and is the preview host allowed?

Clerk production instances are bound to their domain. A `pk_live` key issued for
`app.signalstudio.ie` is not expected to complete a sign-in on a `*.vercel.app` preview host
unless that host is configured as an allowed origin or satellite domain. The usual pattern is to
run previews on the Clerk **development** instance instead.

This is stated as a hazard, **not as a measured fact** — nothing in this repository configures a
Clerk domain, and no sign-in has been attempted on a preview. Settle it by reading
`vercel env ls preview` for the key prefix (`pk_live_` vs `pk_test_`) and checking that instance's
allowed origins in the Clerk dashboard.

If it fails, there are two fixes, in preference order: point the branch preview at a stable alias
such as `lab.signalstudio.ie` and register it with Clerk; or use development-instance keys on
Preview, in which case "a real Clerk identity" means a real session on the dev instance — the
guard checks a verified primary email, not which instance issued it, so the mechanism still holds
and the proof is slightly weaker.

### 7.2 Does the Preview environment carry the four boot-critical variables?

`src/env.ts` throws at boot without `TASKS_DATABASE_URL`, `TASKS_AUTH_TOKEN`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` once the mode is not demo/review. Until
now Preview never needed them, because review mode returns early at `env.ts:52-53`. Check before
flipping, not after.

### 7.3 What does Vercel Authentication cost on a Hobby account, and at what scope?

The API confirms all three protections are currently off. It does not tell us which the plan
allows. Password Protection is documented as requiring an eligible plan; Vercel Authentication is
the standard, widely available one. Confirm in the dashboard before promising it.

---

## 8 · What this memo does not settle

- **It does not make the lab safe to deploy on its own.** The guard is what does that, and
  `LAB_ISOLATION.md` §6 still lists four unproven items. This memo closes one of them if option A
  is taken.
- **It does not prove `review` mode leaks nothing.** It proves customer data is not reachable on
  that path by design; it does not re-verify that design.
- **The founder's email address is a source literal** in `src/lib/home-layer/lab/policy.ts:59`, in
  a public repository. That was a deliberate, recorded choice — an unset env var must not lock the
  reviewer out of the surface he is required to inspect — and the address is already public in
  every commit's author field. Noted, not raised as a defect.
- **Whether the wider `/app/**` preview posture should change** is a bigger question than this
  programme. §2.2 and §2.3 are facts about the whole repository, not about Home.

---

## 9 · Rollback

Every option here is a settings change with a one-step reverse.

| Change | Undo |
|---|---|
| Vercel Authentication on | Toggle off. Effective immediately, no redeploy. |
| `SIGNAL_ACCESS_MODE=production` on a branch | Delete the two variables; the branch falls back to `review`. |
| `HOME_REVIEW_LAB_ENABLED=true` | Delete it. The lab is 404 for everyone including the founder. |
| A bypass token (C or D) | Rotate or delete the secret. |

No migration, no schema, no data. The programme's rollback register is unaffected.

---

## Verified against the live Vercel account — 2026-08-12, by the lead

Answering the memo's open questions with facts rather than assumptions.

| Fact | Value |
|---|---|
| Team | `ethanmcn2013-1730's projects` (`team_veMY72ml10cAawsR0CjN9k5y`) |
| App project | `app` (`prj_C4rdqkS6wh9z4V0lku3tuphcNlkN`) |
| Password protection | **off** |
| Vercel Authentication (`ssoProtection`) | **off** |
| Trusted IPs | **off** |

So option A+B requires *enabling* Vercel Authentication, which is currently disabled entirely.

### Why the lead did not enable it

Two reasons, and the second is the binding one.

1. Changing deployment protection is an account-settings change. Standing approval to proceed
   with the programme is not approval to alter account configuration.
2. **It would hit the other live sessions.** Vercel Authentication is configured per project, and
   the natural setting covers *all* preview deployments of `app`. Several other sessions are
   opening PRs against this same project right now (#126, #130, #132 at the time of writing).
   Turning it on would silently put an auth wall in front of every one of their preview links.
   That is precisely the cross-session impact this programme is under instruction to avoid.

### The decision Ethan actually has

- **Enable Vercel Authentication on `app` previews.** Closes `R-H10`'s open item by exercising
  the real Clerk path, and is the only option that does. Cost: every other session's preview link
  starts requiring a Vercel login until it is turned off again.
- **Use a scoped alternative** — options C or D in the memo, an application bypass token or a
  Vercel bypass secret. Roughly five minutes, no effect on other sessions, but leaves the real
  Clerk path unproven and therefore leaves `R-H10` open into Wave 10.
- **Run the founder pause locally** — option E. Zero blast radius, no deployment at all, but Ethan
  reviews on the lead's machine rather than a shareable link, and it proves nothing about Clerk.

Recommendation stands at A+B, but **timed**: enable it when the other sessions' PRs have merged,
not while three of them are in flight.
