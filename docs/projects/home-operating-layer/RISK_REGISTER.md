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
