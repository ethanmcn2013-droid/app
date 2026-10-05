# Projects console review

Branch `design/suite-redesign-v3` (PR #201). The founder-approved Projects "Console" is now the default view of `/app/project`, with the earlier Cards grid behind a view switcher and the open project's overview below both. This is an unshipped candidate. No deployment, promotion, database write, schema change or production change was made, and no dependency was added.

The design source stays in `src/components/concepts/final/projects/` (uncommitted, read only). Nothing in product code imports from it; the Console was written again under `src/components/app/project/` and `src/lib/projects/`.

## What is where

| Piece | File |
|---|---|
| Rows, tabs, figures and every word, as a pure model | `src/lib/projects/project-console.ts` |
| The extra server reads (read-only selects) | `src/server/projects/project-console-facts.ts`, called from `loadProjectHub` |
| The Console, its row menu and empty states | `src/components/app/project/project-console.tsx`, `.module.css` |
| View switcher (Console, Cards) | `src/components/app/project/project-view-switch.tsx` |
| Page header, search, New project, both views | `src/components/app/project/projects-hub.tsx` |
| First run (no projects at all) | `src/components/app/project/projects-first-run.tsx` |
| Loading skeleton | `src/app/app/project/loading.tsx`, `project-console-skeleton.tsx` |
| Twelve-project fixture and browser check | `src/lib/projects/project-console.fixture.ts`, `experience/project-console/` |

## Each element and its source

| Element | Source |
|---|---|
| Project name | The authorized project catalog (the same list the chooser reads) |
| How it is doing (mark, group, line under the name) | The status its owner set (on track, at risk, paused, complete, or none), plus whether the target date has passed. A passed date outranks the status, so a project marked on track but past its date sits under "Needs a look" |
| Done, x of y, and "n still open" | Hub task counts (top-level, unarchived, the project's own done columns). The open project uses its overview figures |
| Late, count | Hub overdue count |
| Late, "Oldest: ..." | New read: the unfinished task furthest past its date |
| Next big date | New read: the earliest unfinished task marked as a big date in Tasks; otherwise the target date, labelled "Target date" |
| Lead (name and initials) | New read: the project's owner. "You" when the reader owns it. The line beneath is the reader's own role |
| Line under the name | The owner's status and the target date ("At risk · target 17 Oct"). Once the date has passed it leads with that ("Past its date · was due 28 Sep"), so the words never say "On track" beside a red mark; the owner's word stays only where it adds something ("At risk · past its date, was due 28 Sep", and the same for Paused). The group, the tab count and the summary line follow the same rule |
| Tabs and counts | All (not complete), Needs a look (at risk or past its date), Led by you (reader is the owner), Wrapped (status complete) |
| Card: Needs a look | Count and one segment per active project, from the same standing |
| Card: Next big date | The nearest date still ahead across active projects, with that project's done of total |
| Card: Late across your projects | Sum of the late counts, one segment per project, and the oldest late task overall |
| Card: This week | New read: tasks finished in the last seven days, per day, in the reader's time zone, with the seven days before. In review mode it reads the Analytics source; a test pins that both pages count the same two weeks |
| Summary line under the title | Active projects, how many need a look, open tasks, late tasks |
| Row menu | Open the project, Open its tasks, See the timeline (the guarded project switch), and Nudge through `sendNudgeAction` when someone other than the reader, and still a member, is assigned to the oldest such late task. Nudge is never offered in review mode |

Dropped, because no data exists for them: project kind (and its two tabs), the "likely done" forecast, and "Waiting on". The row is rebalanced to Done, Next big date, Late and Lead; Lead is drawn as a person (initials, name, role) instead of a fourth bar.

A figure whose read failed is dropped, not guessed: no finished-work read means no "This week" card; unread task counts mean no "Late across your projects" card; no owner read shows "Owner not shown". The overview below renders regardless.

## What an empty account sees

- Belongs to no project at all: "No projects yet", one plain sentence, and a New project button that opens a name field in place (`first-run-*`).
- Has projects, none active: the header with New project, zeroed tabs, and "No active projects. Start one with New project." (`no-active-projects-*`).
- An empty tab: a plain line and "See all projects" (`empty-tab-*`). A search with no match: the name searched for and "Clear the search" (`search-miss-*`).

## Capture record

Application code as of the commit that adds this folder. Plain PNGs.

`review-mode/`: the real page on the review dev server, port 3217, from this worktree (`NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, `SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true`, one sample project, no sign-in), at 1440x900 (`desk`), 1920x1080 (`wide`) and 390x844 (`phone`), dark and light, reduced motion on. Console, each tab, the row menu (no Nudge, as review never sends), the view menu, the Cards view and the New project form. On every size and theme: no console or page errors, no sideways scroll, nothing fixed over the list inside the page, and axe reports nothing on the Projects index.

`busy-account/`: the twelve-project fixture, from the repo's own check:

```
pnpm test:project-console:browser                      # checks only
node experience/project-console/run.mjs --capture experience/output/project-console
```

Expected result: `PASS projects console: 225 checks across desk, wide and phone, light and dark`. It bundles the real header, view switcher, search and Console with the real styles and v3 tokens, stubs only the server seams, and adds no route. It checks tab counts and rows on every tab, the four figures, the row menu and its place on screen, a keyboard walk (tabs by arrows; rows by arrows, j, k, Home and End; Tab to a row's actions; the menu by arrows, Enter and Escape with focus handed back), search, the view switcher, New project focus, both empty states, a failed extra read (`partial-*`), one project, none, first run, loading, the entrance animation off under reduced motion, tabular figures, the banned word list, and axe with no findings at any impact, in every state.

Screenshot names are `<state>-<size>-<theme>.png`; `-full` is the whole page.

## Found and fixed while checking

- Small print on a hovered row, card or menu item fell under AA on the hover ground. It now steps up one ink level there.
- The row's last column sized itself to its content, so "Viewing" pushed that row's columns out of line with the others. It has a fixed width.
- Month names came from `Intl`, which spells September "Sep" in one runtime and "Sept" in another. They are spelled in code, so the server and the browser cannot disagree.

## Where this falls short of the approved design

- Three things in the demo have no data and are not shown: kind, the forecast line under Done, and Waiting on. Done's caption is the plain remainder ("21 still open").
- The bar under Next big date shows how near the date is over the last 30 days, not the share of the wait elapsed since the previous big date: there is no reliable start date to measure from.
- "This week" is the last seven days ending today, not Monday to Sunday, so that it agrees with Analytics, which counts rolling weeks.
- No floating New project button on a phone, by instruction; the button sits beside the title.
- The page column is capped at 1320px (the demo runs the full width), so the Console and the overview below it share one edge with the rest of the app.
- Review mode has one project, so the busy account is judged on the fixture, not on real data. The database reads are proved against the real schema in a disposable in-memory database (`project-console-facts.test.ts`), not against a live account.
- On a phone the review build's own "In development" notice floats over the page until dismissed. It belongs to the shell, not to this page.

## PR 201 checks

Everything below ran on a clean export of `464b0db9` (a temporary `git worktree` under the system temp folder with its own install, removed afterwards), never on this worktree's uncommitted concept and Timeline files. The build is `next build` in demo mode with the environment `experience/playwright.config.ts` sets, served on port 4342.

| Check | Result |
|---|---|
| Module boundaries | Passed |
| `experience:self-test` | Passed (on `45a20d1f`; the scripts it tests did not change after) |
| `experience:fixtures` | Passed, 37 of 37 mapped |
| `next build`, demo mode | Passed |
| `experience:test` critical capture | 132 of 132 |
| Task detail, populated task, desktop and wide | Passed. The "Files and links" and "Subtasks" headings are found again (the fix in `bde54336`) |
| Shared Timeline, link-only wedding artifact | Passed at all four sizes: one Share button. The second button seen on 3 October comes only from the uncommitted Timeline artifact work in this worktree, not from committed code |
| `perf:budgets` | Passed at 1040.2 KB gzip against a ceiling raised from 1030 to 1042 (see below) |
| `test:recipient-context:browser` | Passed, including route-browser 76 of 76 and the Console check, 225 |
| `experience:test:timeline-switcher` | 8 of 8 after a fix (see below); 4 of 8 before it |
| `test:notes-recovery:browser`, `test:event-export:browser`, `test:project-recovery:browser`, `test:settings-hydration`, `experience:council:prepare`, `experience:council:ci` | Passed on `45a20d1f`. The council step reports no 9.5 claim, as designed |
| `experience:validate` | Two expected failures before the receipts (the Project page and its loading state); clean after them |

Three things were fixed so the required check can go green:

- `experience/recipient-project-work/route-browser.mjs` waited for a sidebar project button marked `data-active`, which the sidebar has never rendered; the open project is marked `data-current-project`. Since the 2 October shell the Projects list also sits inside the folded "Initial setup" group, so the step unfolds the group, reads the mark and folds it again.
- Timeline's project switcher menu did not take focus when opened, so its keyboard case failed at every size on a clean build. `src/components/app/portfolio/row-menu.tsx` now focuses the open item once the menu is shown and retries for a few frames.
- The bundle ceiling. CI measured 1029.9 KB gzip on the previous head, a tenth of a kilobyte under the 1030 ceiling; the Console adds about ten. The ceiling is now 1042, with the basis written into `contracts/venue-surface-performance-budgets.v1.json`. This is a delegated decision under the sprint authority in `docs/design/redesign-2026-09/06-current-state-and-constraints.md` ("raise the budget explicitly if a better shell needs it") and is the founder's to confirm or reverse. The 936 target is unchanged.

## Registry refresh and receipts

One commit follows the attested run: the one that adds this folder also changes the line under a project's name once its date has passed, and lets that line wrap to two lines (`project-console.ts`, its test, and `project-console.module.css`). It touches neither registered source file. The unit tests and the 225-check browser run were repeated on it, and the screenshots here were taken after it; the 132-case critical run was not repeated for it and CI runs it on the pushed head.

The critical run was fully green, so the refresh is complete with schema receipts (`signal-materiality-review/2`), written by `pnpm experience:review` against the attestation of that run, `experience/evidence-runs/tasks-playwright-80b2f4d0f1c10e2ab2461d63-099714516340c7a5.json` (132 of 132).

| Entry | Why | Receipt in `receipts/` |
|---|---|---|
| `tasks.page.app-project` | This change: view and tab from the address, first-run state | new hash `795236cc4236a32a` |
| `tasks.state.app-project-loading` | This change: the skeleton mirrors the Console | new hash `991a54006054ce55` |
| `tasks.resources.drive-upload` | Refreshed on 3 October without a receipt | same hash, receipt added |
| `tasks.page.app-messages` | Refreshed on 3 October without a receipt | same hash, receipt added |
| `tasks.state.app-tools-loading` | Refreshed on 3 October without a receipt | same hash, receipt added |

No mapped critical fixture changed, so `experience:fixtures:write` was not needed. The linked Playwright case in each receipt is suite regression context; no critical case opens `/app/project` itself, which is why the rendered evidence for this page is the two folders above.
