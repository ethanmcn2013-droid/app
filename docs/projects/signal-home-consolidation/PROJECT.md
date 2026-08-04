# Signal → Home consolidation

Launch simplification: Signal stops being presented as a fourth
standalone product. Its briefing, prioritisation and cross-product
intelligence are absorbed into **Home**, the authenticated front door.

> Remove Signal from the product line, not from the product.

## Objective

Ship a three-product launch model — **Notes, Tasks, Timeline** — with
Home as the default authenticated destination, **Today's Signal** as the
primary intelligence module inside Home, and **Full Briefing** as the
deeper cross-product view. No dead routes, no lost capability, no broken
links, entitlements or stored references.

## Product principles

- Notes captures. Tasks coordinates. Timeline communicates. Home
  prioritises. Connected surfaces, not a mandatory pipeline.
- Home answers one question: *what matters now?* Maximum three principal
  sections. Not a dashboard, not an activity feed.
- Signal remains the company, the brand, and the outcome the system
  produces — never "our fourth product".
- Calm, obvious, premium: Geist, black/white/indigo, the indigo dot as
  the only mark, no glow, no purple drift, restrained motion.
- The black application rail stays across authenticated areas; public
  shared artifacts never gain it.
- Launch stability beats architectural cleverness. Internal `signal`
  naming stays where renaming adds migration risk.

## Scope

- App repo (`app`, worktree `_wt-product-pass`, branch
  `signal-home-consolidation`): Home surface, Full Briefing move,
  `/app/signal*` redirects, nav (pills, mobile, command palette,
  sidebar), default-destination rewiring, contract scripts, experience
  registry/fixtures/receipts, tests.
- Studio repo (`studio`, branch `signal-home-consolidation`): homepage
  product architecture, header/mega-panel/footer nav, `/signal` product
  page migration + redirect, pricing, audience pages (students,
  teachers, weddings, venues, work), metadata/SEO/OG/JSON-LD, sitemap,
  emails, internal HQ enumerations (light touch).
- Launch-asset inventory for external creative (motion lane is Codex's;
  we inventory, we do not touch `signal-motion`).

## Out of scope

- Rewrites of Notes, Tasks, Timeline; design-system replacement; auth or
  database provider changes; new product scope (calendar, CRM, chat…).
- Wave-2 VEF work in the old `app/` tree — completely untouched.
- Repo-wide internal rename of `signal` identifiers, module paths, or DB
  values. Public architecture over aesthetic renames.
- Production deploys or production data mutation. Everything lands
  locally on branches.

## Target information architecture

| Surface | Route | Notes |
|---|---|---|
| Home | `/app/home` | Default authed destination. Today's Signal + Coming up + Needs review. |
| Full Briefing | `/app/home/briefing` | The existing Signal brief page, relocated intact. |
| Briefing onboarding | `/app/home/briefing/onboarding` | Relocated. |
| Briefing notifications | `/app/home/briefing/settings/notifications` | Relocated. |
| Legacy Signal | `/app/signal`, `/app/signal/onboarding`, `/app/signal/settings/notifications` | Permanent redirects to the new routes, query state preserved. |
| Products | `/app/notes`, `/app/tasks`, `/app/timeline` | Unchanged. |
| Project | `/app/project` | Existing workspace project overview; joins primary nav. |
| Marketing daily-briefing | `/features/daily-briefing` (studio) | New feature page carrying the old `/signal` story. `/signal` 301s to it. |

Primary authenticated nav (pills + mobile): **home · notes · tasks ·
timeline · project**. "More" remains the account/user cluster. Signal is
removed as a destination everywhere.

`/app` redirects to `/app/home` (suite-context branch preserved).
Sign-in and onboarding land on Home. Deep links unaffected.

## Workstreams

1. Audit + control docs (this commit).
2. App: Home + Full Briefing + intelligence reuse.
3. App: nav, redirects, compatibility, contracts, registry/evidence.
4. Studio: marketing migration.
5. Cleanup: copy, metadata, fixtures, docs, emails.
6. Verification: full battery + functional matrix + visual QA.

## Acceptance criteria / definition of done

The brief's 25-point functional matrix (QA.md) plus: both repos build
and pass all available checks; registry/evidence pipeline green; public
shared artifacts unchanged; marketing internally consistent on the
three-product model; launch assets updated or inventoried in
LAUNCH-ASSET-CHANGES.md; project docs complete.
