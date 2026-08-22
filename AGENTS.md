# Signal Studio app — repo contract

Read the workspace contract at `../AGENTS.md` first (company, products,
autonomy, design register, record-keeping), then this file, then only
what the task needs.

## What this repo is

This is the unified signed-in Signal Studio app at `app.signalstudio.ie`
— one app with three products: **Notes** (capture), **Tasks** (execution),
and **Timeline** (direction). **Home** is the authenticated front door and
contains Today's Signal plus the Full Briefing; it is not a fourth product.
The GitHub repo is
named `app` (`ethanmcn2013-droid/app`); local clones should sit in a
matching `app/` directory.

## North star (set 2026-08 · operator re-derives ~every six months)

Three priorities govern everything front-facing, in this order:

1. **Experience.** Using the product should feel considered end to end,
   and in the right moments delightful. Delight is deliberate: candidate
   moments get an explicit animate-or-restrained verdict — never sprinkled
   ad hoc.
2. **Design.** Every front-facing surface ships at the standard of the
   best studios working today — spacing, type, motion, empty, loading,
   and error states, microcopy, all deliberate, nothing default. The bar
   is the design register plus the 9.5 gate
   (`experience/QUALITY_COUNCIL_EVIDENCE.md`).
3. **Utility.** Someone who has never used a project-management tool
   must be able to pick this up and understand it unaided — the
   first-contact test (`docs/FIRST_CONTACT_TEST.md`), whose automated
   half runs as `pnpm first-contact:language`. No jargon, no technical
   lock-out; a surface that needs explaining is not done.

When the three pull against each other, that order decides. The durable
record and the review date live in
`studio/content/hq/decisions/product-north-star.md`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## URL and naming contract

Full rules: `docs/SUITE_URL_AND_NAMING_CONTRACT.md`. Marketing:
`signalstudio.ie/{notes|tasks|timeline}` plus
`signalstudio.ie/features/daily-briefing`; signed-in:
`app.signalstudio.ie/app/{notes|tasks|timeline}` with Home at `/app/home`
and the Full Briefing at `/app/home/briefing`. Use the typed
constants in `src/lib/product-urls.ts` — never invent hostnames or
product names in components. `/app/board`, `/app/plan`, and `/app/brief`
are retired compatibility inputs; new UI, docs, analytics, and email
must never emit them. `/app/signal*` is a legacy redirect input only.

## Database release gate

Never run `drizzle-kit push` or `drizzle-kit migrate` directly against
production — the historical `0000`–`0013` chain is non-idempotent.
The only paths in are the receipt-backed runner (`pnpm db:migrate`) and
the `db-migrate` GitHub workflow (`command=execute`); `pnpm db:contract`
is the pre-flight gate. Full contract: `DEPLOY.md` §4 and
`drizzle/MIGRATIONS.md`.

## Signal HQ sync

Product-state changes here — feature scope, risk, decisions, campaigns,
cross-product flows, messaging, shipped work — feed Signal HQ, the
founder's source of truth, which lives in the `studio` repo. Open or
update a Studio PR against the matching source file in the same cycle:

| Change here | Source file in studio |
|---|---|
| feature scope, status, or impact | `content/hq/features/<id>.md` |
| risk surfaced or mitigation changed | `content/hq/risks/<id>.md` |
| decision on pricing, brand, GTM, product | `content/hq/decisions/<id>.md` |
| campaign goal, blocker, or progress | `content/hq/campaigns/<id>.md` |
| cross-product flow, data shape, cron schedule | `content/atlas/<slug>.md` (bump `lastVerified`) |
| messaging, hooks, pitches | `content/hq/messaging.md` |
| shipped operator-visible change | this repo's `CHANGELOG.md` |

Canonical rules live in `studio/AGENTS.md`.

## Collaboration surfaces

Before invite, sharing, guest access, template, or public-output work,
read `docs/COLLABORATION_LOOP.md`.

## Design

The design register lives in the workspace `../AGENTS.md` — do not
duplicate it here.

## History

The `log-cycle` / `check-cycles` scripts (leftovers from this codebase's
personal-portfolio origins) were retired 2026-07-30 and deleted
2026-07-31. A shipped cycle's only records are the dispatch entry in
this repo's `CHANGELOG.md` and the Signal HQ record in
`studio/content/hq/**`.
