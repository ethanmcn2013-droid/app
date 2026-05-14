<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Signal HQ sync

This repo is part of the Signal Studio suite. Signal HQ lives in the Studio repo at `ethanmcn2013-droid/studio` and is the internal source of truth for product, launch, growth, decisions, risks, metrics, and next actions.

When a change in Tasks affects product state, roadmap, launch readiness, GTM, messaging, campaigns, demos, templates, outreach, pilots, metrics, decisions, risks, or strategic learning, update Signal HQ before the task is complete.

Before invite, sharing, guest access, template, public-output, or collaborator-facing work, read `docs/COLLABORATION_LOOP.md`. Tasks owns the execution-clarity moment in the collaboration loop.

In practice, open or update a Studio PR that changes:

- `src/lib/hq/data.ts`
- `src/lib/hq/signals.ts` if derived signal logic changes
- relevant files under `signal-growth/`
- `CHANGELOG.md` for meaningful operator-visible changes — write entries in the dispatch shape (Studio BRAND.md §6.5): `## YYYY-MM-DD · T·NN · verb · headline`, then a bold impact-lead sentence, then prose. Verbs are `ships / tightens / cuts / holds / reads`.

Also bump `seedHqData.updatedAt` so `/hq` can detect newer repo-backed data.

# End-of-cycle ritual

After a cycle ships in Tasks (Vercel deploy succeeded, dispatch entry written in CHANGELOG.md per Studio BRAND.md §6.5, phase.md bumped), run:

```bash
node scripts/log-cycle.mjs \
  --cycle <N> \
  --title "<one-line headline>" \
  --date YYYY-MM-DD \
  --description "<one-paragraph what-and-why>"
```

This pushes a row into the shared Roadmap Turso DB so `ethanmcnamara.com/roadmap` stays accurate across all three products. The wrapper delegates to the canonical `log-cycle.ts` in `~/Projects/personal/ethanmcnamara`.

Don't pass `--project` — it's forced to `tasks` in the wrapper.
