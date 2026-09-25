# Apps and tools concepts 1 and 2: handoff

Cloud session, 25 September 2026. Branch `design/analytics-concepts` (pushed).

## The two finished concepts

| # | Title | Thesis | Commit | Route |
|---|---|---|---|---|
| 1 | Your tool shelf | Apps and tools becomes a home screen you arrange like a phone, where every tool that is on shows as a small live widget, so being on and being useful look like the same thing. | `77e1b6ef` | `/app/concepts/apps/1` |
| 2 | The shadow board | Each Project gets a workshop shadow board laid out for what it is, where tools that are on hang in place and tools that would help show only as a labelled outline, so what is missing is as visible as what is there. | `9355c52d` | `/app/concepts/apps/2` |

Signature moments:
- **1:** dragging a tool from the drawer and watching it unfold into a widget already showing your own numbers.
- **2:** dashed outlines that show which tools a wedding, a venue season or a class usually has, each with a reason pulled from your own Project ("You have 9 tasks about guests. A guest list would hold them.").

Code: `src/components/concepts/apps/c1/` and `src/components/concepts/apps/c2/`, self-contained (sample data, components and CSS module in each folder). Both were built with no critique round.

Checks at handoff: `tsc` 0 errors in both folders, `eslint` 0 problems in both, `pnpm first-contact:language` clean, no console errors on a clean load.

Gallery shots (JPEG, 1440x900 light and dark, 390x844 phone at 2x): `docs/design/concept-sprint/shots/apps/apps-{1,2}-{light,dark,phone}.jpg`.

## The rest of the Apps and tools and Shared timeline sprint (paused)

- The founder paused it. Workflow: `docs/design/concept-sprint/apps-share-concept-sprint.workflow.js`.
- Apps 3 and 4 were cut off mid-build and are committed as work in progress in `b71963f6`. `apps/c4/c4.module.css` is a placeholder, and eslint reports 4 errors across c3 and c4.
- Apps 5 and 6 and all six Shared timeline concepts have not been built; their folders hold stubs. The creative director slates for both views were finished in the cloud run but live only in that session's workflow journal, so a fresh local run re-slates.
- Concept infrastructure on this branch: the `apps` and `shared-timeline` views are registered in `src/components/concepts/{types,registry}.ts` and `/app/concepts`. Shared-timeline concepts are meant to cover the app shell (`position: fixed; inset: 0`), because the real page is a public link.
