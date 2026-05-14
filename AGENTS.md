<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Signal HQ sync

This repo is part of the Signal Studio suite. Signal HQ lives in the Studio repo at `ethanmcn2013-droid/studio` and is the internal source of truth for product, launch, growth, decisions, risks, metrics, and next actions.

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

After a cycle ships in Tasks (Vercel deploy succeeded, dispatch entry written in CHANGELOG.md per Studio BRAND.md §6.5, phase.md bumped), run:

```bash
node scripts/log-cycle.mjs \
  --cycle <N> \
  --title "<one-line headline>" \
  --date YYYY-MM-DD \
  --description "<one-paragraph what-and-why>"
```

This pushes a row into the shared Roadmap Turso DB so `ethanmcnamara.com/roadmap` stays accurate across all three products. The wrapper delegates to the canonical `log-cycle.ts` that lives alongside it in this repo's `scripts/` directory.

Don't pass `--project` — it's forced to `tasks` in the wrapper.
