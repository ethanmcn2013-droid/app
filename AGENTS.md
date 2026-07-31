# Signal Studio app — repo contract

Read the workspace contract at `../AGENTS.md` first (company, products,
autonomy, design register, record-keeping), then this file, then only
what the task needs.

## What this repo is

This is the unified signed-in Signal Studio app at `app.signalstudio.ie`
— one app, four modules: **Notes** (capture), **Tasks** (execution),
**Timeline** (direction), **Signal** (attention). The GitHub repo is
named `app` (`ethanmcn2013-droid/app`); the local directory rename is
pending.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## URL and naming contract

Full rules: `docs/SUITE_URL_AND_NAMING_CONTRACT.md`. Marketing:
`signalstudio.ie/{notes|tasks|timeline|signal}`; signed-in:
`app.signalstudio.ie/app/{notes|tasks|timeline|signal}`. Use the typed
constants in `src/lib/product-urls.ts` — never invent hostnames or
product names in components. `/app/board`, `/app/plan`, and `/app/brief`
are retired compatibility inputs; new UI, docs, analytics, and email
must never emit them.

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
