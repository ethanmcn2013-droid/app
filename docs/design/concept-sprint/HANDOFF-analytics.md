# Analytics concept sprint: handoff

Cloud session, 25 September 2026. Branch `design/analytics-concepts` (pushed), cut from
`design/tasks-concepts`, so it carries the Tasks concepts and the production-build exclusion too.

## The six concepts

A creative director set six directions, and one builder per concept built it. Per the founder,
there was no critique or refine round.

| # | Title | Thesis | Commit |
|---|---|---|---|
| 1 | The Friday letter | Analytics as a short, warm letter from a good project manager, written fresh each week with small word-sized charts set right into the sentences, so the answer is read rather than decoded. | `fef662be` |
| 2 | Will we make it | One question answered with one picture: a forecast of when the remaining work lands against the big date, plus the few levers that would move it. | `5f7b21a2` |
| 3 | Who needs a hand | A people-first view that shows each person's coming weeks as something you can see is too full, and lets you rebalance by moving work between them. | `89a2b7d6` |
| 4 | Project replay | A time machine that replays the whole Project week by week, so you can watch how it got to where it is and see the moments that changed its course. | `441a9017` |
| 5 | Ask a question | A question-first page where you pick or type what you want to know and get back one plain sentence and the one chart that proves it. | `edb9520b` |
| 6 | All projects wall | A dense, calm wall of small multiples that puts every Project side by side on the same scales, for the owner who wants to compare everything. | `9148ed92` |

Code: `src/components/concepts/analytics/c1..c6/`, self-contained. Routes: `/app/concepts/analytics/1..6`
on the review dev server
(`NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port 3217`).

Claude's pick: **2, Will we make it**. It answers the question every planner has in one sentence
at the top, and the chart and switches underneath show what would change the answer.

## Gallery

- Self-contained page: `docs/design/concept-sprint/analytics-gallery.html` (all shots embedded, favourites
  picker). Published privately: https://claude.ai/artifact/LgCawNX32SUAxHci5UjAZx
- Screenshots: `docs/design/concept-sprint/shots/analytics/analytics-{1..6}-{light,dark,phone}.jpg`
  (1440x900 light and dark, 390x844 phone at 2x).

## Checks at handoff

- `pnpm exec tsc --noEmit -p .`: 0 errors.
- `pnpm exec eslint src/components/concepts/analytics`: 0 problems.
- `pnpm first-contact:language`: clean.
- No console or page errors on a clean load.

## Still open

- `node scripts/experience/validate.mjs` will report the concepts route's stale materiality hash
  (`tasks.page.app-concepts`), as on PR 202. The fix is the same: run
  `node scripts/experience/rebaseline-v3.mjs --date <today>`. The cloud session's permission check blocks it.
- The Apps and tools and Shared timeline sprint on this branch is paused. See `HANDOFF-apps-1-2.md`.
  Apps 3 and 4 are work in progress (4 lint errors), so `pnpm lint` on the whole branch fails until they are
  finished or removed.
