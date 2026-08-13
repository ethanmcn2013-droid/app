# Risk register — Home operating layer

Opened Wave 0. Every entry carries its evidence. Risks without evidence are not risks, they
are guesses, and belong in `BELOW_CUT.md` or nowhere.

Severity: **P0** would make the release unsafe or untruthful · **P1** would fail a gate ·
**P2** would cost significant rework.

---

## R-H01 · P0 · The shared-runtime budget has 0.9 KB of headroom

**Evidence.** `pnpm perf:budgets` at base `a849fc4`, run after a clean production build:

```
budget            measured        ceiling         target          state
shared_runtime    246.1 KB gzip   247 KB gzip     170 KB gzip     over-budget (ratcheted)
total_client_js   898.8 KB gzip   940 KB gzip     936 KB gzip     ok
largest_chunk     62.5 KB gzip     63 KB gzip      63 KB gzip     ok
```

**Why it matters.** `shared_runtime` is the floor every route pays. It is *already over its
target* and held only by a ratchet 0.9 KB above the current measurement. `largest_chunk` has
0.5 KB. This programme adds a Home shell, Home-local navigation, a scope control, a mobile
sheet, and four modes.

**Consequence, binding on Wave 4.** The Home shell must add approximately **nothing** to the
shared graph. Concretely: Home routes are Server Components by default; client islands stay
small and route-local; Analytics code must never enter the shared or eager dependency graph;
any new shared primitive must be paid for by removing something. A design direction that
requires a large always-loaded client shell is not implementable at this base and the lab
must know that before it draws.

**Owner.** Lead. Re-measured at every wave boundary; a ratchet raise to get green is an
automatic veto (brief §24).

---

## R-H02 · P0 · Two live lanes are writing the exact foundation this programme needs

**Evidence.** `lane/wp2-project-platform` is authoring `src/lib/projects/**` and modifying
`src/lib/product-urls.ts` uncommitted; `lane/wp1-timeline-safety` is rewriting Timeline
exact-Project resolution. Observed moving twice inside 25 minutes on 2026-08-12
(`d4d9295`→`78021c5`, `9aae0ae`→`d62a118`, dirty 2→9).

**Why it matters.** `src/lib/projects/**` is precisely the ProjectScope foundation Wave 1
§10.2 would otherwise create. Building a second one is an automatic veto.

**Mitigation.** Recorded in `COLLISION_REGISTER.md`. This programme consumes their
foundation and never authors it. Wave 1 ports from the **merged** result on `origin/main`,
never from a lane SHA. The register is re-taken at every wave boundary.

**Residual.** Their internal drift (WP0 exists at both `9880694` and `c598bd0`) is theirs to
resolve; we simply refuse to depend on either SHA.

---

## R-H03 · P1 · `experience:fixtures` already fails at base

**Evidence.** `node scripts/experience/critical-fixtures.mjs` exits 1 with
`registry coverage or materiality hashes are stale; run with --write` — reproduced on a
**pristine detached checkout of `a849fc4`** with no programme files present, so it is
pre-existing and not caused by this programme.

**Why it matters.** The materiality-hash cascade across the experience registry is a known
first-class work item, not a closing chore. Any Home surface added to the registry
re-triggers it. If this is still red when Wave 10 runs, the measured gate cannot pass.

**Owner.** Lead. Must be resolved on a merged base before Wave 10, and must not be resolved
by blanket `--write` without inspecting every material diff (brief §24).

---

## R-H04 · P1 · The harness cannot currently measure contrast without a running server

**Evidence.** `pnpm check:contrast` exits 1 at base: six surface/theme combinations report
`ERR_CONNECTION_REFUSED at http://localhost:3499`, summarised as
`0 contrast failure(s) … 6 unmeasurable surface(s)`.

**Why it matters.** This is *correct harness behaviour* — it refuses to report a pass on an
empty population, exactly as this programme requires. But it means every contrast claim
needs an orchestrated server, and the Wave 3 and Wave 10 evidence packages must budget for
that rather than assuming a static check.

**Note.** `perf:budgets` shows the same discipline: it exited 3 with
`Refusing to report a measurement of zero` until a production build existed. The repository's
existing "no empty-population pass" posture is stronger than assumed and should be adopted,
not replaced.

---

## R-H05 · P1 · Field performance is structurally unmeasurable today

**Evidence.** `perf:budgets` output at base explicitly declares, under
`NOT measured here, and not claimed as passing`: no RUM provider is wired — no
`@vercel/speed-insights`, no `@vercel/analytics`, no `web-vitals` dependency, no
`useReportWebVitals` call, and no Lighthouse CI job. It also records that Next 16 with
Turbopack no longer emits per-route First Load JS, so per-route client weight cannot be
derived from build output.

**Why it matters.** Wave 11 gates on field Core Web Vitals per route × device bucket. With
no RUM provider, that evidence cannot exist. Either a provider is wired during this
programme, or the rollout proceeds with field performance explicitly recorded as **unproven**
and promotion needs founder risk acceptance (brief §22.2).

**Owner.** Lead. Decision required before the first external cohort, not at Wave 11.

---

## R-H06 · P2 · The URL contract is locked and requires a paired Studio record

**Evidence.** `docs/SUITE_URL_AND_NAMING_CONTRACT.md` (status: locked) §"Implementation
authority" and §"Migration rule": the executable contract is
`src/lib/suite-contracts.v1.json`, `src/lib/product-urls.ts`, `src/proxy.ts`,
`next.config.ts`, and no new destination ships "without updating this contract and the
matching Studio decision record in the same release".

**Why it matters.** `/app/home/{inbox,my-work,analytics}` are new canonical destinations.
This makes a cross-repo Studio PR a **Wave 4 deliverable**, not a Wave 9 record-keeping
chore — and it must be authored from a clean Studio worktree, never through a dirty checkout
(brief §6, §19.5).

---

## R-H07 · P2 · The Home report's citations are stale

**Evidence.** The approved report cites `origin/main` at `3682bf7` and reads current-product
evidence out of `_wt-design-audit`. Our base is `a849fc4`, 138 commits later.

**Why it matters.** Its *architecture* conclusions are authoritative and carry forward. Its
*file:line citations* must be re-derived against our base before any of them is used to
justify an implementation decision. Wave 0's auditor reports supersede them.

---

## R-H08 · P0 · The 9.5 quality council cannot certify anything, and narrowing it is a founder decision

**Evidence.** `quality-council-gate.json:234` bars automation from awarding taste scores; the
gate needs 1,352 evidenced human scores plus 4 journey receipts. In CI it runs
`continue-on-error`. An open founder decision sits at
`studio/content/hq/operator-todos/rule-on-95-gate-scope.md`.

**Why it matters.** Wave 10 is specified against "the repository's exact measured gate". As
written that gate cannot return a pass, so Wave 10 cannot complete. **Raising or narrowing
a threshold to get green is an automatic veto (brief §24)** — so this cannot be solved
inside the programme.

**Owner.** Ethan. Needed before Wave 10, not at it. Until taken, "certified" is unavailable
as an outcome and the programme must say so rather than claim it.

---

## R-H09 · P1 · No visual-regression baseline exists

**Evidence.** `toHaveScreenshot` configured but never called; no `experience/baselines/`;
`approvedBaselineReference: null` on all 78 registry entries; approval declared founder-owned
(`critical-fixtures.json` `operatorBlocked`).

**Consequence.** Wave 2 must create and get approval for baselines, or no wave can prove it
did not regress an untouched surface.

---

## R-H10 · P0 · `/lab` has no authentication guard — verified, not inferred

**Evidence.** Four independent checks at base `78021c5`:

1. `/lab` is absent from the Clerk proxy matcher (`src/proxy.ts:280-298`), so Clerk middleware
   never runs for it — which also means `auth()` is not populated inside those routes.
2. No `/lab/**` page calls `requireAppAccess`, `auth()`, `currentUser` or `requireSignalUser`.
3. There is no `layout.tsx` anywhere under `src/app/lab/`.
4. Live: `GET /lab/timeline-a` → **HTTP 200**.

Six historical lab routes exist: `timeline-{a,b,w}`, `welcome-{a,b,w}`.

**Current exposure is mild.** Those six are static design mockups with
`robots: { index: false, follow: false }` and, by their own header comments, "no auth, no data
fetching". So today the mechanism leaks design, not customer data.

**Why it is still P0 for this programme.** The Home lab renders fixture data across four
directions × four modes × 13 scenarios, including permission-limited, partial and
guest-limited states. Dropping that onto a route family with **zero** access control would be
the review/live boundary violation the brief lists as an automatic veto. `noindex` is not
access control.

**The catch that shapes the fix.** A Server-Component layout guard alone is not sufficient,
because outside the proxy matcher Clerk never populates the session — so the guard would have
no identity to check. `/lab/:path*` has to enter the matcher *and* gain a fail-closed
server-side guard combining the review flag with a reviewer allowlist or a protected-preview
policy. Adding it to the matcher changes request handling for the six existing lab routes, so
that change is lead-owned and needs its own regression check.

**Owner.** Lead, Wave 2, before any Wave 3 deploy. Blocks Gate 3.

### Status 2026-08-12 21:5x — closed IN PART

Guard built and independently re-verified by the lead: `/lab/home-operating-layer` → **404**
with `robots: noindex, nofollow, nocache`; all six existing labs → **200**, no regression.
Contract at `contracts/LAB_ISOLATION.md`. Tests: 19 + 16 + 11 pass, scoped `tsc` and `eslint`
both exit 0.

Three corrections to what this entry originally claimed:

1. **Five of the six existing labs carry `noindex`, not six.** `src/app/lab/welcome-b/page.tsx`
   has no `robots` metadata and, being a `"use client"` page, cannot export any. Pinned by a
   characterisation test. Outside this programme's write boundary; not fixed.
2. **Adding `/lab/:path*` to the matcher alone would have broken things.** Traced through
   `productionProxy`, a signed-out request hits
   `if (!isPublicRoute(req)) await auth.protect(...)` — so the matcher entry alone would 307
   every signed-out visitor on every `/lab` route to `/sign-in`, breaking the six existing labs
   *and* making the protected route answer a redirect, which confirms it exists. The matcher
   entry is therefore paired with `/lab` + `/lab/(.*)` in `isPublicRoute`, so Clerk **populates**
   a session there without **enforcing** one.
3. **The flag convention mattered.** `src/lib/planning/flags.ts` defaults to
   `NODE_ENV !== "production"` — on by default in dev and test, which would have served the lab
   on any non-production build. The analytics convention was chosen instead: only literal
   `true`/`1` opens `HOME_REVIEW_LAB_ENABLED`; unset and unparseable both fail closed.

**Still open:** the real Clerk path has never been exercised. The local server runs `review`
mode, which bypasses Clerk, so the observed 404 comes from the flag-off branch, not an identity
check. No one has watched a genuinely signed-in non-reviewer receive a 404 from a real session.

---

## R-H16 · P0 · A layout-only guard does not prevent the page from rendering

**Evidence.** Measured, not inferred. With the lab guarded *only* from its `layout.tsx` calling
`notFound()`, the response was a correct **404** whose **25,717-byte body carried the complete
RSC flight payload of the page** — every heading and paragraph verbatim. Requiring every page to
await the guard itself fixed it: still 404, page copy absent, 24,939 bytes. Independently
re-verified by the lead.

**Why it matters well beyond the lab.** In Next 16 the layout and page render in parallel, so a
guard that throws in the layout does not stop the page component executing — and therefore does
not stop its server-side data fetching. `src/app/app/layout.tsx` guards the entire authenticated
app this way.

**Live consequence.** `task_1bf52417` is fixing the narrow-gate bug on `/app/home`,
`/app/home/briefing`, `/app/notes` and `/app/timeline`. This programme initially advised that
session to **delete** the page-level gates and rely on the layout. That advice has been
corrected in writing: keep a page-level gate and make it the *correct* one
(`requireAppAccessTasks`), rather than remove it.

**Honest limit.** The measurement was `notFound()`, not `redirect()`. The mechanism is the same
— both are thrown control-flow signals during render — but the redirect case has **not** been
measured here and is not asserted as fact.

**Owner.** Lead. Every Home route in Wave 4 asserts its own guard; no route relies on an
ancestor layout for access control. Whether the wider `/app/**` tree needs the same treatment is
a question for a separate sweep.

---

## R-H17 · P1 · A Vercel preview cannot show the protected lab as configured

**Evidence.** `src/lib/access-mode.ts:17-22`: a Vercel **preview** deployment falls back to
`review` mode, which binds a synthetic demo user and never queries the real database. The lab
guard requires a real Clerk identity plus a reviewer allowlist.

**Consequence for the founder pause.** The protected preview Ethan uses to select a direction
must either run with `SIGNAL_ACCESS_MODE=production` and real Clerk keys, or sit behind Vercel
deployment protection with the flag on. Neither is the default. This has to be settled in Wave 2,
not discovered at Wave 3 when the preview is due.

**Owner.** Lead, Wave 2.

---

## R-H11 · P0 · Home cannot mutate outside the active-workspace cookie

**Evidence.** `getActiveWorkspace()` binds tenant from the `tasks_active_ws` cookie across
**80 call sites in 24 action files**. A mutation targeting a different Project finds no row
and **silently no-ops** — it does not error.

**Consequence.** Workspace-parameterised actions are a hard prerequisite for My work
writeback (Wave 7) and every Inbox source action (Wave 6). Silent no-op is the worst possible
failure mode for a surface whose contract is "never show success before the source confirms".
Largest hidden cost in the programme.

---

## R-H12 · P1 · Inbox store, approval primitive and analytics history do not exist

**Evidence.** Inbox read state is client-only `localStorage` (`inbox-app.tsx:207-217`);
`notify()` early-returns without a `taskId` (`src/server/db/notifications.ts:40-47`);
`notifications.read_at` has no writer. No approval table, column or action anywhere in `src/`.
`captureWorkspaceSnapshots` has zero callers repo-wide.

**Consequence.** Waves 6 and 8 are **new schema** under expand → migrate → contract, not
migrations of an existing store. Re-plan those waves accordingly; the brief scoped them as
migrations.

---

## R-H13 · P1 · Four project identities and five membership seams

**Evidence.** Tasks `workspaces.id`; Timeline `(workspace_slug, slug)`; signal's slugified
task **tag**; Notes none. Membership resolved by in-process Drizzle, raw libsql SQL, an
owner-only Timeline table with no member concept, a read-only Tasks mirror, and an HMAC HTTP
loopback.

**Mitigation.** Adopt Tasks `workspaces.id` as canonical — which the live Project Truth ADR
concluded independently. Name one canonical membership seam in Wave 1 before any Home
contract is sealed.

---

## R-H14 · P1 · The Home data store has no production-drift alarm

**Evidence.** `db-migration-drift` covers the Tasks database only. Home's briefing data lives
in the legacy-named `SIGNAL_*` database, which has no drift alarm and no receipt-backed
runner (`DEPLOY.md:126-137`).

**Consequence.** A Home data-shape change has no production safety net. Wave 1's persistence
architecture must either bring that database under the receipt-backed runner or record
explicitly that it is unprotected.

---

## R-H15 · P2 · Two live production defects found in passing

Confirmed by reading, not runtime-verified. Neither belongs to this programme; both raised as
separate work so they are not silently absorbed. Detail in `REPOSITORY_TRUTH.md`.

1. Home, Briefing, Notes and Timeline re-run an allowlist-only gate beneath the
   membership-aware layout gate, bouncing invited and redeemed users to `/waitlist`.
2. `compileDailyDigest`'s mentions query is unscoped by workspace and reachable from both the
   Inbox page and the digest email cron.

---

## R-H08 update — 2026-08-13: independently confirmed by the other programme

The Project Truth programme reached the same conclusion from a different direction and recorded
it as **D-024, "The Quality Council gate is structurally broken and must be repaired before it can
certify anything"** (merged in #137, verified independently on `02e2206`).

Their findings add three facts this register did not have:

1. **`pnpm experience:council` exits 1, and has done since before either programme started.** It
   is not a threshold that is hard to meet. It is an instrument that does not run.
2. **`experience/council-reviews/journeys/` has never existed.** Only `baselines/` does.
3. **`registry-and-drift` reports green while the council check fails inside it.** So CI has been
   showing a passing signal over a gate that never ran. That is worse than a red gate: a red gate
   is a problem, a green one over a broken instrument is a false assurance.

Their decision, which this programme adopts rather than duplicating: repairing the instrument is
their Wave 8 work and a precondition of certification, and **until it is repaired no 9.5 claim may
be made by anyone**, including by citing a green required check.

### What changes for this programme

- **R-H08 is no longer a single-programme observation.** Two programmes, working separately,
  found the same broken instrument. That removes any argument that it is a misreading.
- **The repair now has an owner, and it is not this programme.** Home's Wave 10 depends on their
  Wave 8 landing. Recorded as an external dependency rather than duplicated work — building a
  second council would be the same mistake as building a second ProjectScope.
- **The founder decision this register asked for is narrower than it looked.** It was framed as
  "narrow the gate's scope". The real question is only whether Home's Wave 10 waits for the
  repaired instrument or ships behind a flag with certification explicitly recorded as unavailable.
- **Nothing in this programme may cite a green `registry-and-drift` as evidence of quality.** Any
  such claim already in this repository's records is void.

Their closing line is worth keeping: *the cheapest moment to discover a broken gate is several
waves before you need it.* Both programmes found it early, and separately.
