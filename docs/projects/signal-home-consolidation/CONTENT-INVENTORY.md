# Content inventory — four-product references

Every surface that presents the four-product model. "signal-as-company"
hits (Signal Studio, signal-entitlements, dailySignal…) are excluded by
design.

> STATUS KEY: the tables below list the TARGET state per surface; the
> `done` marks are claims only once STATUS.md records verification as
> green. Until then read them as the migration plan per surface.

## App repo (`app`)

| Surface | File(s) | Status |
|---|---|---|
| Suite switcher pills (canonical) | `src/components/app/suite-switcher-pills.tsx` | done |
| Suite launcher popover | `src/components/app/suite-launcher.tsx` | done |
| Mobile suite nav | `src/components/app/mobile-suite-nav.tsx` | done |
| Product URL registry | `src/lib/product-urls.ts` (+ `suite-contracts.v1.json`) | done (signal kept as legacy id; HOME_APP_PATH added) |
| `/app` default redirect | `src/app/app/page.tsx` | done |
| Signal routes | `src/app/app/signal/*` | done (redirects) |
| Command palette | `src/components/app/palette/command-palette.tsx` | done |
| Sidebar product links | `src/components/app/sidebar.tsx` | done |
| About page | `src/app/about/page.tsx` | done |
| Web manifest | `src/app/manifest.ts` | done |
| Billing/plan copy | `src/components/app/settings/sections/billing.tsx`, `src/components/settings/plan/plan-view.tsx` | done |
| Trades audience page | `src/components/marketing/for-trades.tsx` | done |
| Suite contract tests | `src/modules/signal/signal-suite-context.test.ts`, `signal-public-url-contract.test.ts`, `scripts/check-suite-switcher-contract.mjs` | done |
| Experience registry + fixtures | `experience/registry.json`, `experience/critical-fixtures.json` | done (routes moved, home registered, receipts rebound) |
| Docs (contracts) | `docs/SUITE_URL_AND_NAMING_CONTRACT.md`, `README.md`, `docs/decisions.md` | done (contract + README; decisions.md is history, kept) |
| Dispatch history | `CHANGELOG.md` | kept — history is not rewritten; new T entry added |

## Studio repo (`studio`)

| Surface | File(s) | Status |
|---|---|---|
| Root metadata + JSON-LD | `src/app/layout.tsx` | done |
| Homepage reveal (4-product engine) | `src/components/reveal/reveal-engine.tsx`, `reveal-products.tsx` | done (three acts + Home coda) |
| Header product switcher | `src/components/layout/product-switcher.tsx` | done |
| Products mega panel | `src/components/layout/products-mega-panel.tsx` | done |
| Suite switcher copy | `src/components/layout/SuiteSwitcher.tsx` | done |
| Footer | `src/components/landing/site-footer.tsx` | done |
| `/signal` product page | `src/app/signal/page.tsx` | done (301 → /features/daily-briefing) |
| Product marketing definitions | `src/components/marketing/product-marketing-page.tsx` + product content map | done (pills → 3, signal def reused by feature page) |
| Pricing | `src/app/pricing/page.tsx` | done |
| Sitemap | `src/app/sitemap.ts` | done |
| About / press / proof / terms / work | `src/app/{about,press,proof,terms,work}/page.tsx` | done |
| Students / teachers | `src/app/students/page.tsx`, `src/app/teachers/*` | done |
| Weddings / venues | `src/app/weddings/*`, `src/app/venues/*` | done (venues commercial terms untouched — D-003..D-006) |
| Dispatch page chrome | `src/app/dispatch/page.tsx` | done (preamble only; entries are history) |
| Redeem flow copy | `src/app/redeem/[code]/page.tsx` | done |
| Email templates | `src/emails/templates/access-ready.tsx`, `dispatch-issue.tsx` | done |
| HQ internals (founder-facing) | `src/components/hq/*`, `src/lib/hq/*`, `src/features/atlas/*`, `src/features/org/org-intel.ts`, `src/lib/account/fixtures.ts` | inventoried — operator instrument; product-count claims updated where live, historical records kept |
| Compare page | `src/app/compare/*` | done |

## External / launch assets
See `LAUNCH-ASSET-CHANGES.md` (created in Phase 9).
