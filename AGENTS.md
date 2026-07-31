<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Signal HQ sync

This repo is part of the Signal Studio suite. Signal HQ lives in the Studio repo at `ethanmcn2013-droid/studio` and is the internal source of truth for product, launch, growth, decisions, risks, metrics, and next actions.

## One app and four products

Signal Studio is one app containing Notes, Tasks, Timeline, and Signal. The load-bearing URL and naming rules are in `docs/SUITE_URL_AND_NAMING_CONTRACT.md`.

- Marketing uses `signalstudio.ie/{notes|tasks|timeline|signal}`.
- Signed-in product navigation uses
  `app.signalstudio.ie/app/{notes|tasks|timeline|signal}`.
- Product subdomains are narrow public/service compatibility surfaces, not separate apps or marketing homes.
- Use the typed constants in `src/lib/product-urls.ts`; do not invent hostnames, fragment destinations, or alternate product names in components.

Tasks views live beneath the Tasks product route: `/app/tasks`,
`/app/tasks/list`, `/app/tasks/timeline`, and `/app/tasks/calendar`.
`/app/board`, `/app/plan`, and `/app/brief` are retired compatibility inputs
and must never be emitted by new UI, documentation, analytics, or email.

When a change in Tasks affects product state, roadmap, launch readiness, GTM, messaging, campaigns, demos, templates, outreach, pilots, metrics, decisions, risks, or strategic learning, update Signal HQ before the task is complete.

Before invite, sharing, guest access, template, public-output, or collaborator-facing work, read `docs/COLLABORATION_LOOP.md`. Tasks owns the execution-clarity moment in the collaboration loop.

In practice, open or update a Studio PR that changes the right source file for the change you made:

| Change you made in Tasks                                          | Source file in studio                                            |
|-------------------------------------------------------------------|------------------------------------------------------------------|
| feature scope, status, or impact                                  | `content/hq/features/<id>.md`                                    |
| risk surfaced or mitigation changed                               | `content/hq/risks/<id>.md`                                       |
| a decision that affects pricing, brand, GTM, product             | `content/hq/decisions/<id>.md`                                   |
| campaign goal, blocker, or progress                               | `content/hq/campaigns/<id>.md`                                   |
| cross-product flow / data shape / cron schedule                   | `content/atlas/<slug>.md` — and bump `lastVerified`              |
| messaging, hooks, pitches                                         | `content/hq/messaging.md`                                        |
| shipped operator-visible change                                   | `CHANGELOG.md` — dispatch shape per Studio BRAND.md §6.5: `## YYYY-MM-DD · T·NN · verb · headline`, bold impact-lead sentence, then prose. Verbs: `ships / tightens / cuts / holds / reads`. |

The old rule (update `src/lib/hq/data.ts`) is superseded — that seed was emptied on 2026-05-14 (Studio dispatch `S·24`). The dashboard now reads from the markdown files above. Don't write to `data.ts` for migrated sections; the markdown is canonical.

Tasks-repo files referenced by atlas entries (e.g. `tasks/drizzle/`, `tasks/src/app/api/checkout/`, `tasks/docs/STRIPE_SETUP.md`) flag drift on the atlas via the pre-commit hook at `.githooks/pre-commit` (Studio dispatch `S·22`). Activate with `git config core.hooksPath .githooks` if you haven't. The hook never blocks commits — drift is a signal.

# End-of-cycle ritual

After a cycle ships in Tasks (Vercel deploy succeeded, dispatch entry written in
CHANGELOG.md per Studio BRAND.md §6.5, phase.md bumped), the cycle is recorded.
There is nothing further to run.

## Retired: `log-cycle`

The `log-cycle` and `check-cycles` scripts were **deleted in the 2026-07-31
data-layer reset** (retired 2026-07-30, removed the day after). They dated
from the personal portfolio site this codebase was extracted from:

- they wrote a `portfolio` workspace plus task and activity rows **straight
  into the production Tasks database**, with no staging
- they fed a `/roadmap` page on a personal domain that is not part of
  Signal Studio (the empty GTM `/roadmap` scaffolding and its three tables
  were removed in the same reset — migration 0023)

Signal Timeline was lifted out of that portfolio repo in Cycle 46
(`src/modules/timeline/server/db/timeline-schema.ts:12`), and the live Timeline
product now scopes by workspace and explicitly ignores the leftover portfolio
rows (`timeline-queries.ts:537`: "Ignores legacy null-workspace rows, those
belong to the personal portfolio").

The canonical records for a shipped cycle are the two that are already
contractual:

1. the dispatch entry in this repo's `CHANGELOG.md`
2. the Signal HQ record in `studio/content/hq/**`

`log-cycle` was a third, obsolete copy pointed at a surface nobody reads.
Retired 2026-07-30 after it was followed in good faith during T·114/T·115 and
found to target a domain the company does not own.
