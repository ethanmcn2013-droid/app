# Lab isolation contract — the protected Home design lab

**Status:** implemented, verified in part · **Closes:** R-H10 (P0) · **Base:** `feat/home-operating-layer`, on `origin/main` @ `78021c5`
**Owner:** Lead · **Blocks:** Gate 3, and any Wave 3 deploy

The Home operating-layer design lab renders fixture data across four directions ×
four modes × 13 scenarios, including permission-limited, partial and guest-limited
states. This document is the contract for who may see it, the mechanism that
enforces that, and — stated as plainly as the mechanism — what has and has not
been proven.

---

## 1 · What `/lab` was, established from the code

Verified at base, not inferred.

- `/lab` was absent from `src/proxy.ts` `config.matcher`. Clerk middleware never ran
  for it.
- No `/lab/**` page called any auth function. There was no `layout.tsx` anywhere
  under `src/app/lab/`.
- `GET /lab/timeline-a` → HTTP 200, anonymous.

Six lab routes existed: `timeline-{a,b,w}`, `welcome-{a,b,w}`.

### The catch, and what adding `/lab` to the matcher actually changes

A Server-Component layout guard alone could not have worked. Outside the matcher
Clerk never populates a session, so `currentUser()` inside a `/lab` route has
nothing to read: the guard would have refused everyone, permanently, including the
reviewer. `/lab` had to enter the matcher.

But entering the matcher is not free. Traced through `src/proxy.ts` branch by
branch, for a request that is **not signed in**, in production access mode with
Clerk configured:

```
proxy()
  legacySignalRedirect      /lab is not /app/signal              → null
  isBareArtifactPath        /lab is not /s                       → false
  isDemoMode()              production                           → false
  clerkConfigured           true                                 → productionProxy
    isDemoMode()                                                 → false
    await auth()            userId = null
    productRootRedirect     pathname !== "/"                     → null
    marketingToAppRedirect  MARKETING_PATHS is {"/"} only        → null
    if (!isPublicRoute(req)) await auth.protect({ unauthenticatedUrl: "/sign-in" })
```

That last line is the whole consequence. **Adding `/lab/:path*` to the matcher
and nothing else would 307 every signed-out visitor on every `/lab` route to
`/sign-in`.** Two separate problems:

1. The six pre-existing labs stop serving anonymously. That is the regression
   R-H10 warned about, and it is real, not hypothetical.
2. `/lab/home-operating-layer` answers a **redirect**. A redirect to sign-in
   confirms the route exists. Objective 1 requires a genuine 404.

So the matcher entry is paired with an `isPublicRoute` entry. `/lab` is in the
matcher so Clerk **populates** a session, and public within it so Clerk does not
**enforce** one. Those are different jobs and the lab needs exactly the first.
The access decision is not in the proxy at all; it is the guard.

Nothing outside `/lab` changes. `auth.protect()` remains inside
`if (!isPublicRoute(req))`, asserted by test.

---

## 2 · The flag convention, and why this one

The repository has two conventions and they are not interchangeable.

| | `src/lib/planning/flags.ts` | `src/modules/signal/…/feature-flag.ts` |
|---|---|---|
| default | `NODE_ENV !== "production"` → **ON** in dev and test | **OFF** everywhere |
| explicit false | honoured | honoured, and always wins |
| unrecognised value | falls back to the default, which may be ON | closed |
| `server-only` | no | yes |

**Chosen: the analytics convention**, copied into
`src/lib/home-layer/lab/policy.ts`.

The planning convention is correct for progressive product features and wrong
here. `defaultEnabled = NODE_ENV !== "production"` means the flag is ON in
development and in test by default — so any non-production build would serve the
lab to whoever reached it, which is precisely the exposure R-H10 exists to close.
"Default-off" has to mean off in *every* environment, not off in one of them.

The flag is `HOME_REVIEW_LAB_ENABLED`. Only a literal `true` or `1` opens it.
Unset, empty, `yes`, `on`, `enabled`, `2` — all closed. This is asserted by test
across `NODE_ENV` values including `undefined`.

**Reviewer allowlist:** `HOME_REVIEW_LAB_REVIEWERS`, comma / space / newline
separated, matched case-insensitively against the signed-in user's **verified
primary** email. The founder is a source literal in `ALWAYS_REVIEWER`, mirroring
`src/lib/access-allowlist.ts`, because he is the named reviewer this lab exists
for and an unset env var must not lock him out of the surface he is required to
inspect. That is not a weakening: the flag is still default-off, so with
`HOME_REVIEW_LAB_ENABLED` unset the literal reaches nothing.

---

## 3 · The mechanism

```
src/proxy.ts                                     matcher + isPublicRoute entries
src/lib/home-layer/lab/policy.ts                 the rule, pure, imports nothing
src/lib/home-layer/lab/guard.ts                  server-only; resolves identity, calls notFound()
src/app/lab/home-operating-layer/layout.tsx      awaits the guard, force-dynamic, noindex
src/app/lab/home-operating-layer/page.tsx        awaits the guard (see §5)
```

The decision, in order. The flag is first, so when the lab is closed no identity
is resolved at all and a Clerk failure cannot turn a closed lab into a 500.

| # | condition | outcome |
|---|---|---|
| 1 | `HOME_REVIEW_LAB_ENABLED` not `true`/`1` | 404 |
| 2 | access mode is demo or review | 404 |
| 3 | no signed-in user, or `currentUser()` threw | 404 |
| 4 | primary email unverified, or absent from the allowlist | 404 |
| 5 | all of the above pass | render |

**Every refusal is the same 404.** Never a redirect, never a 403, never an
explanatory page. A 403 tells an authenticated non-reviewer that there is
something here to be refused; a 404 tells them nothing. `guard.ts` is asserted by
test to contain no `redirect(`, no `forbidden(`, no `403`.

### The seed-data refusal, and its cost

demo and review access modes bypass Clerk in the proxy and run a synthetic
identity. There is no real reviewer to check, so the guard refuses outright
rather than trusting a synthetic user.

**Recorded consequence, not hidden:** a Vercel preview defaults to `review` mode,
so a default preview cannot show this lab. The protected preview must run
`SIGNAL_ACCESS_MODE=production` with real Clerk keys, or sit behind Vercel
deployment protection. Local work on the lab needs the same: development access
mode, Clerk keys configured, a real signed-in session on the allowlist. That is
the price of the guard being real, and it is the right price.

---

## 4 · Cannot reach live data

`src/lib/home-layer/lab/lab-isolation-contract.test.mjs` walks the **transitive**
static import graph from every file under `src/app/lab/home-operating-layer/**`
and `src/lib/home-layer/lab/**`, following every local `@/` and relative import,
and fails on any of:

live DB client (`@/server/db`), server actions, provider or job modules
(`@/server/{email,storage,stripe,ai,admin,events,outbox}`), account export or
erasure, product module internals (`@/modules/**`), `drizzle-orm`, `@libsql/*`,
`stripe`, `resend`, `nodemailer`, `@vercel/blob`, `ai`, `@ai-sdk/*`,
`next/cache`. A `"use server"` directive anywhere in the family also fails.

Clerk and `next/navigation` are deliberately absent from that list: the guard
needs them, and auth is the point rather than the leak.

The walk fails loudly on an unresolvable local import rather than skipping it, so
it cannot pass by having looked at nothing. Its sensitivity was verified by
planting a two-hop probe (`probe-root.ts` → `probe-leaf.ts` → `@/server/db`); the
gate caught it and followed on into `src/server/db/{index,seed,schema}.ts`. The
probe files were removed.

---

## 5 · The finding that changed the design

**A layout guard withholds the rendered screen. It does not withhold the render.**

With `requireLabReviewer()` in the layout only, `GET /lab/home-operating-layer`
returned a correct HTTP 404 whose 25,717-byte body still carried the **complete
React Server Component flight payload of the page beneath it** — every heading
and paragraph, verbatim, inside the 404. The layout threw `notFound()`; the page
had already rendered beside it.

Measured, on the running server, at this exact code state. Not theorised.

Survivable for a placeholder. Not survivable for the actual lab, which renders
fixture data in permission-limited, partial and guest-limited states — the
payload would have carried all of it into a response that looks like a refusal.

**Fix:** every page in the family awaits the guard itself, so it never produces a
payload at all. Re-measured after the fix: still 404, zero occurrences of the page
copy, body 24,939 bytes of ordinary 404, `robots noindex, nofollow, nocache`
present. A contract test now requires `await requireLabReviewer()` in every
`page.tsx` under the family, because the next person to add a page will not know
this happened.

This generalises beyond the lab. Any route in this repository relying on a layout
guard alone to withhold *content* rather than *access* is worth re-checking.

---

## 6 · What is proven, and what is not

### Proven

| Objective | Evidence |
|---|---|
| 1 · flag off → genuine 404 | `guard.test.ts` executes the real guard: flag unset and flag `false` both throw `notFound()` even for a listed reviewer. Live: `GET /lab/home-operating-layer` → **HTTP 404** with the page copy absent from the body. |
| 2 · authenticated non-reviewer → 404, not 403 | `guard.test.ts` "THE NEGATIVE CASE": verified primary email, signed in, not on the list → `notFound()`. The `next/navigation` stand-in throws loudly from `redirect()` and `forbidden()`, so a guard that chose either fails with that message. |
| 3 · noindex | Layout metadata asserted by test; live response carries `robots noindex, nofollow, nocache`. |
| 4 · no live data | Transitive import-graph gate, sensitivity verified by planted probe. |
| 5 · six existing labs unaffected | Live, after the change: all six → **HTTP 200**. Tests assert they exist, gained no auth call, and that no `layout.tsx` was added at `/lab` (the one-directory-too-high mistake). |

### Not proven — read this before calling R-H10 closed

1. **The real Clerk path has never been exercised.** The local server runs
   `review` access mode, which bypasses Clerk entirely, so its 404 comes from the
   flag-off / seed-data branch and not from an identity check. The tests
   substitute `@clerk/nextjs/server` with a stand-in. **Nobody has yet watched a
   genuinely signed-in non-reviewer receive a 404 from a real Clerk session.**
   That needs a deployment in production access mode with real Clerk keys and two
   accounts, one on the allowlist and one not. Until then this contract is
   verified in part.
2. **The proxy change is asserted, not executed.** `createRouteMatcher` and
   `auth.protect()` are not run by any test here; the matcher and public-route
   entries are asserted as source. The six labs returning 200 was measured in
   review mode, where the proxy short-circuits before Clerk — so it confirms no
   regression *in that mode* and does not exercise the matcher.
3. **`pnpm build` was not run**, by instruction. `force-dynamic` is asserted in
   source; no production build has confirmed these routes are excluded from
   static prerendering.
4. **One-hop external imports are checked by name.** The transitive walk follows
   local modules only. A `node_modules` package that itself reaches a provider
   would not be caught, and no such package is imported today.

### Raised in passing, not fixed

`src/app/lab/welcome-b/page.tsx` has **no `robots` metadata**. R-H10 records all
six pre-existing labs as carrying noindex; five do. `welcome-b` is a
`"use client"` page, so it cannot export `metadata` at all. Found by a test
failing on the assumption rather than on the code. Not fixed here because fixing
it means editing one of the six routes this work is required to leave alone. It
is a static design mockup, so the exposure is design, not data. Recorded as a
characterisation test (`LAB_ROUTES_WITHOUT_NOINDEX`) that fails if the set
changes in either direction.

---

## 7 · Operating the lab

```
HOME_REVIEW_LAB_ENABLED=true
HOME_REVIEW_LAB_REVIEWERS=reviewer@example.com, second@example.com
SIGNAL_ACCESS_MODE=production          # demo/review are refused by design
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=…    # a real Clerk session is required
CLERK_SECRET_KEY=…
```

Leave `HOME_REVIEW_LAB_ENABLED` unset in production. That is the default and it
means the route family is absent.

To close the lab: remove the flag. Nothing else. The route family goes back to
returning 404 for everyone including the founder, and the six pre-existing lab
routes are untouched either way.

### Tests

```
node --test src/lib/home-layer/lab/lab-isolation-contract.test.mjs
node --import tsx --test src/lib/home-layer/lab/policy.test.ts
node --import tsx --import ./src/lib/home-layer/lab/testing/register-lab-stubs.mjs \
     --test src/lib/home-layer/lab/guard.test.ts
```

Not yet wired into the `pnpm test` chain — `package.json` is foreign-owned on
this branch. Adding these three commands to that chain is an open item for the
lead.
