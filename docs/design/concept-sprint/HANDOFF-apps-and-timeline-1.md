# Apps and tools 1 to 6 and Shared timeline 1: handoff

Cloud session, 25 September 2026. Branch `design/analytics-concepts` (pushed). Draft PR
[ethanmcn2013-droid/app#203](https://github.com/ethanmcn2013-droid/app/pull/203).
Supersedes `HANDOFF-apps-1-2.md`: apps 3 and 4 are now finished too.

Built from a creative director slate, one builder per concept, no critique or refine round.

## Apps and tools (all six finished)

| # | Title | Thesis | Commit |
|---|---|---|---|
| 1 | Your tool shelf | A home screen you arrange like a phone, where every tool that is on shows as a small live widget, so being on and being useful look like the same thing. | `77e1b6ef` |
| 2 | The shadow board | Each Project gets a workshop shadow board where tools that are on hang in place and tools that would help show as a labelled outline, so what is missing is as visible as what is there. | `9355c52d` |
| 3 | The field guide | A beautifully kept field guide where each tool is introduced through a short true story of how a team like yours used it, and every story can be tried on your own Project in place. | `607332b1` |
| 4 | Ask for a tool | You say what you need in your own words and the right tool assembles itself, previewed with your Project's own data, before you decide to keep it. | `eaffd149` |
| 5 | The workbench | Tools open as a second pane beside your tasks and timeline, you work across both at once, and save the arrangement as a bench you come back to. | `eda30e05` |
| 6 | How it all connects | A calm, living map of what talks to what, where email, WhatsApp, calendars, forms and files visibly feed your Projects. | `eae49efb` |

Routes: `/app/concepts/apps/1..6`. Code: `src/components/concepts/apps/c1..c6/`.

## Shared timeline (1 of 6 finished)

| # | Title | Thesis | Commit |
|---|---|---|---|
| 1 | The Road There | The shared timeline as a story read top to bottom, one chapter per milestone, with a sticky path that fills to today and a countdown that ends at the day. | `2c300a76` |

Route: `/app/concepts/shared-timeline/1`. Shared-timeline concepts cover the whole screen
(`position: fixed; inset: 0`) so the app sidebar and top bar never show, because the real page is a
public link opened without an account. Concept 1 has a "See it as Wedding / Launch / Class" switcher
and a preview-states menu.

**In progress in the cloud when this was written:** shared timelines 2 and 3. Timelines 4 and 5 come
next, then 6, one batch at a time on the founder's go.

## Screenshots

`docs/design/concept-sprint/shots/apps/apps-{1..6}-{light,dark,phone}.jpg` and
`docs/design/concept-sprint/shots/shared-timeline/shared-timeline-1-{light,dark,phone}.jpg`
(1440x900 light and dark, 390x844 phone at 2x).

## Checks at handoff

- `pnpm exec eslint src/components/concepts/apps src/components/concepts/shared-timeline/c1`: 0 problems
  (the 4 errors from the paused apps 3 and 4 work are fixed).
- `pnpm first-contact:language`: clean.
- Typecheck ran clean in each builder's own folder. The whole-project `tsc` may show errors from
  shared timelines 2 and 3 while they are mid-build in the cloud.

## For the local session

- Add these seven concepts to the local concept gallery. Each folder is self-contained. They need the `apps`
  and `shared-timeline` views registered in `src/components/concepts/{types,registry}.ts` and
  `src/app/app/concepts/page.tsx`, which is already done on this branch.
- The concepts route's experience materiality hash will be stale. Run
  `node scripts/experience/rebaseline-v3.mjs --date <today>` (approved by the founder), as for PRs 202 and 203.
- Workflow for the remaining builds: `docs/design/concept-sprint/apps-share-concept-sprint.workflow.js`
  (`args.only` picks a batch, for example `["shared-timeline-4", "shared-timeline-5"]`).
