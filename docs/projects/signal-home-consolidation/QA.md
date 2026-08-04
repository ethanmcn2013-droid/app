# QA — Signal → Home consolidation

Results recorded 2026-08-04 after the checks ran. ✓ pass (with basis) ·
◐ pass-by-construction (basis stated) · ✗ fail.

## Functional matrix

| # | Check | Result · basis |
|---|---|---|
| 1 | Existing user signs in and lands on Home | ✓ `/app` → 307 `/app/home` (proxy authed root → `/app`; fixture case "front door lands on Home", 4 breakpoints, attested run 8f5e9b1f) |
| 2 | New user completes onboarding and lands on Home | ✓ all six onboarding/picker completion paths `router.push("/app/home")`; returning-to-welcome redirects Home; venue-sponsor flow deliberately keeps its board landing (welcome card) |
| 3 | Direct Notes link opens Notes | ✓ attested case tasks.page.app-notes |
| 4 | Direct Tasks link opens Tasks | ✓ attested case tasks.page.app-tasks |
| 5 | Direct Timeline link opens Timeline | ✓ attested cases app-timeline / by-project-slug / audience |
| 6 | Direct Project link opens Project | ✓ rail + mobile tab target `/app/project` (existing D-011 surface); route in manifest (108 verified) |
| 7 | Old authed Signal route resolves safely | ✓ `/app/signal*` → 308 with query preserved (curl-verified headers + attested follow-through fixture cases ×3) |
| 8 | Old public Signal page resolves safely | ✓ browser-verified: `/signal` lands `/features/daily-briefing`; page titled and canonical |
| 9 | Today's Signal displays valid data | ✓ demo story renders tonic/run-sheet/menu-tasting with why+source+timing (screenshot + attested case app-home "populated") |
| 10 | Today's Signal exposes no inaccessible data | ✓ one authorization path: rows derive only from `buildBriefingForUser`'s scoped read (D5); no second query path exists |
| 11 | Briefing items link to correct sources | ✓ rows link `/app/task/{id}`; task route is active-workspace-scoped with a calm not-found (cross-workspace safe) |
| 12 | Full Briefing reachable from Home | ✓ "Open full briefing" → `/app/home/briefing` (attested case + fixture assertion) |
| 13 | Empty Home state works | ◐ all-clear composition implemented with engine's honest empty copy + read count; empty source = honest empty (get-source contract); not fixture-evidenced (demo story is populated) — recorded in remainingStates |
| 14 | Loading and failure states work | ✓ loading.tsx (canon tracing) + error.tsx registered as experiences; briefing keeps its module skeleton/error |
| 15 | Mobile nav: Home, Notes, Tasks, Timeline, Project | ✓ measured live: tabs "Home | Notes | Tasks | Timeline | Project"; More stays the top-bar account cluster (D4: 6th 44px tab breaks 375px) |
| 16 | Desktop rail contains intended destinations | ✓ measured live: `home* notes tasks timeline project more` with Home active on /app/home |
| 17 | Public shared artifacts unaffected | ✓ attested cases share-by-token, s-by-token, p-by-slug, embed-by-slug, print-* unchanged and green; no authed rail on any |
| 18 | Pricing no longer presents four products | ✓ browser-verified: "Three products. One subscription." + "And your daily signal." band; grep clean |
| 19 | Marketing product nav lists three products | ✓ header switcher + mega panel (3-up) + footer + pills — three products + briefing capability row |
| 20 | Audience pages free of Signal-product claims | ✓ agent sweeps + lead review; greps for enumerations/“four products” return no live hits in either repo |
| 21 | Sitemap + canonical metadata correct | ✓ studio sitemap swaps /signal → /features/daily-briefing; canonical on the feature page; app sitemap untouched (public routes unchanged) |
| 22 | No broken internal links | ✓ every retargeted link points at a route verified live (/features/daily-briefing, /app/home, /app/home/briefing); legacy paths 308/301; route-manifest contract ok |
| 23 | No blind replacements inside "Signal Studio" | ✓ brand names preserved (explicit rule in all sweeps; spot-checked greps) |
| 24 | Existing workspaces + licence records resolve | ✓ no entitlement/schema changes (D7); settings-plan/billing surfaces attested green; tier model untouched |
| 25 | Build, lint, type checks pass | ✓ app: tsc clean, eslint 0 errors (74 pre-existing warnings, new files 0), full battery fail 0; studio: tsc clean, contracts ok, build 49/49 pages |

## Command log (final states)

- app: `pnpm exec tsc --noEmit` ✓ · `pnpm test` fail 0 (all batteries + contracts) · `pnpm exec playwright test --config experience/playwright.config.ts` **144/144** (run 8f5e9b1f) · `experience:attest --write-record` + all 17 receipts rebound + `--verify-receipts` ✓ · `experience:validate` clean (88 experiences) · `experience:fixtures` clean (39/39, 36 cases × 4) · `ds:check` clean.
- studio: `pnpm test` all contracts ok · `tsc` ✓ · `pnpm build` ✓ 49/49 · `experience:validate` failure set == origin/main pre-existing baseline (detached-worktree measurement; this branch's 17 surfaces cleared, no other lane's entries touched).

## Visual review (screenshots in session record)

Home desktop + mobile (populated) · rail/wordmark/mobile tabs measured ·
briefing direct render · studio homepage hero + relay Act IV (Home) ·
pricing 3-up + briefing band · /features/daily-briefing · /signal
redirect follow.

## Known non-blockers (owned elsewhere)

- Studio experience gate carries pre-existing failures from sibling
  lanes' unmerged re-baselines (present on origin/main today; same
  state the venues PR merged with).
- Studio ds:check drift in 3 HQ/account files from other lanes' branch
  base commits (pre-existing, not touched here).
- App `db-migration-drift` red since 2026-08-03 (production data drift;
  separate chip task_c89f7b88).
