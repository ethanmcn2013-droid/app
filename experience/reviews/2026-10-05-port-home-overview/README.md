# Home and Overview port review

Branch `design/app-v3-home-overview` (PR #209), cut from `main` `4ae930c1`. The founder-approved demo designs for Home and Overview, on the real routes with real data, following the shared port brief of 5 October 2026. This is an unshipped candidate. No deployment, promotion, database write, schema change, migration or production change was made, and no dependency was added.

The design source stays in `src/components/concepts/` of the `design-suite-redesign-v3` worktree (uncommitted, read only). Nothing in product code imports from it.

Three founder instructions arrived during the work and are built in:

- **Overview is a tab of Home.** Both pages open with the same two tabs, Home and Overview: a real tablist, one tab stop, arrow keys, each tab also a plain link. The addresses are unchanged (`/app/home`, `/app/home/briefing`), so links, the URL contract and the redirects keep working. Switching is ordinary navigation; the tabs sit in the same place on both pages and on both loading states, so nothing jumps. The sidebar lights Home for both, through one added line in `activeDestinationId` (`shell-nav.ts`). The sidebar's own Overview row is left for the writer who owns the shell.
- **One create button per screen, and it is the top bar's New.** Neither page has a New task button. C still starts a task: where the add-task dialog is mounted it answers C itself; where it is not, Home takes the route the top bar's New takes (`/app/tasks?create=task`, on the Project Home would add to). The shell was not edited.
- The Overview button on Home is replaced by the tab.

## What is where

| Piece | File |
|---|---|
| Home's rows, counts and every word, as a pure model | `src/lib/home/home-board.ts` |
| Home's server read (read-only selects) | `src/server/home/home-board-read.ts` |
| Home, its ticks, Undo and Nudge | `src/components/app/home/home-board.tsx`, `home.module.css` |
| The Home and Overview tabs | `src/components/app/home/home-tabs.tsx` |
| Home's wrapper, no-read and first-run states | `src/components/app/home/home-view.tsx` |
| Home loading and error | `src/app/app/home/loading.tsx`, `error.tsx` |
| The week view's lanes, days and packing, as a pure model | `src/lib/home/overview-river.ts` |
| The week view's server read (read-only selects) | `src/server/home/overview-river-read.ts` |
| The week view, desk and phone | `src/components/app/home/overview/overview-river.tsx`, `.module.css` |
| The Overview page: tabs, week view, then what the briefing read | `src/modules/signal/components/overview/overview-view.tsx` |
| Overview loading and error | `src/modules/signal/app/signal-brief-loading.tsx`, `error.tsx` |
| Fixtures and browser checks | `src/lib/home/*.fixture.ts`, `experience/home-overview/` |

## Home: each element and its source

Home now reads every Project the reader can open (the chooser's own authorized list), not one saved scope.

| Element in the demo | Source in the app | Kept |
|---|---|---|
| Greeting and name | The reader's own name (first word). The hour is the browser's local hour; the server paints the hour in the reader's saved time zone until the browser loads. This fixes the open defect where the greeting followed UTC | Kept |
| Date pill | Today in the reader's saved time zone | Kept |
| "N things need you today" | Your open late and due-today tasks, plus tasks waiting to be checked. Follows a tick at once | Kept |
| "N late across the venue" | Sum of each Project's late count, the Projects page's own figure. Reads "across your projects", or "in <Project>" when there is one. Dropped when a count could not be read | Kept, reworded |
| "N done this week" | The Projects page's "This week": tasks finished in the last seven days | Kept |
| Stuck sentence | A task that has sat in the board's own Waiting column with no change for three days or more (the briefing's own quiet threshold), the longest first. "No change" is the time since the task last changed, the only timing the data holds. No sentence when no Project has a Waiting column or nothing has sat that long | Kept, on real data |
| "waited N days on X" | Nothing records who a task waits on | Dropped: the sentence says how long, not on whom |
| Nudge | `sendNudgeAction`, offered only when someone other than the reader, and still a member, is assigned. The toast names who was reached. Never offered in review mode | Kept |
| "N more stuck" | Other tasks that meet the same rule; opens that Project's tasks | Kept |
| Late, with a tick each | Your unfinished tasks dated before today | Kept |
| Due today, with "N done" | Your tasks dated today; ones finished today stay listed as done so a tick can be taken back | Kept |
| Tick and Undo | `toggleCompleteAction`, the board's own. The row shows what the server answered, never a guess; Undo calls the same action again. A repeating task comes round again, so it says so and offers no Undo. A refused write changes nothing on screen | Kept |
| Waiting on your approval (files) | No approval of files exists. The nearest real thing is the board's check column | Replaced by "Waiting to be checked": tasks in that column held by someone else or by nobody, longest quiet first. No tick, since they are someone else's to finish |
| You are waiting on | Your tasks in the Waiting column that are not late. A late one stays under Late and says "in Waiting" | Kept |
| Project dot and name on a row | The task's own Project. Shown only when there is more than one Project | Kept |
| Next big day card | The Projects page's nearest date still ahead: a task marked as a big date, else a Project's target date. Days to go, the day, how it is doing, open and late counts | Kept |
| "At this week's pace the work is done..." | No forecast exists | Dropped |
| See the timeline, Open its tasks | Real links carrying the Project | Kept |
| Projects list | Active Projects in the Projects page's order (trouble first, then by date), with its mark, its word when not simply on track, late count and next date | Kept |
| "See all N" | Opens Projects | Kept |
| Footnote | Tasks due today across the Projects read, and the late total | Kept |
| "Home shows what needs you" line with Got it | A first-visit line, remembered in the browser | Kept |
| New task button | Removed by the one-create-button rule; C still works | Dropped by instruction |

"Yours" is a task you are assigned to, or a task nobody current is assigned to in a Project you own. Without the second half a first account, where nothing is assigned, would read as empty.

Added, because the page it replaces had them: "Due this week" (your tasks in the next seven days, the old Upcoming deadlines) and a line counting your open tasks with no date, which opens Tasks.

## Overview: each element and its source

| Element in the demo | Source in the app | Kept |
|---|---|---|
| Project picker | The reader's own Project list; choosing one opens the Overview on it by address | Kept |
| How it is doing | The owner's status and target date, as the Projects page marks it | Kept |
| "8 days to ...", open and late | The Project's target date; open and late counted from the same tasks the river draws | Kept |
| Areas | A task's first label. A Project with no labels has no Areas view; its lanes are its board's columns in use instead ("Status") | Kept where labels exist |
| People | The first current member assigned to a task; "No one yet" for the rest | Kept |
| Bars from start to due | The product stores one date on a task, the day it is due | Every task is one day wide |
| Big dates as flags | Tasks marked as a big date in Tasks | Kept |
| The flag the river runs to | The Project's target date | Kept |
| How full each week is | Ahead: tasks due each week. Behind: tasks finished each week. "N finished in the last 7 days" | Kept |
| Amber when a week is over what the team can do | That is a forecast from one week's pace | Dropped: the band is neutral |
| Finished work settling | A dot under its lane on the day it was finished, for the last six months | Kept, as dots without labels |
| "No date yet" and "Pick one, then click the day it starts" | Undated open tasks. Pick one, then click the day it is due, or use the date field. Saved through `updateTaskAction` exactly as the task panel's calendar saves it, with Undo | Kept, as the day it is due |
| The week tray and its cards | The week's due tasks, who holds how many, earlier and later weeks | Kept |
| A picked task | Its lane, status, who, when; Open the task; Mark done through `toggleCompleteAction` with Undo | Kept |
| The late list | The late count opens it | Kept |
| Zoom and Today | Months, Weeks, Days | Kept |
| Minimap | | Dropped: the Today button and the scroll do its job at this size |
| Dragging the Today handle to replay the past or look ahead | No history of statuses or dates is kept, and there is no pace forecast | Dropped |
| "Spread" a crowded week | It moves many dates at once; not built | Dropped |
| Dragging a bar to another day | Not built; a task's date is changed in the task | Dropped |
| Date-slip marks, "waiting on", helpers, notes on the card | No data, or not read | Dropped |
| Phone: Done before today, Today, Late, No date yet, then week by week | The same tasks, top to bottom | Kept |

## Everything the old pages could do, and where it is now

Home:

- Open Overview: the Overview tab.
- New task: the top bar's New, or C.
- The four figures (open, due today, late, done this week): due today and late are the first two groups and the count line; done this week is in the count line; the open count per Project is on Projects and on the next big day card.
- My tasks and Open board: your tasks are the groups; "Open its tasks" on the card, each Project's name, and the late count all lead into Tasks.
- Upcoming deadlines and the Timeline link: "Due this week"; "See the timeline" on the next big day card.
- Needs review: "Waiting to be checked".
- First run and "Home is not ready yet": unchanged in behaviour, restyled.

Overview:

- Needs attention and At risk, with Why this, Evidence and Open in Tasks: below the week view, under "What needs attention", unchanged.
- The read time and the one-line verdict: the line under that heading.
- How this was read, and Briefing delivery: below the cards, unchanged.
- The coverage notice: above the week view.
- Progress, Dates ahead and Finished this week: the week view shows the same work (lane counts, the dates themselves, finished dots and the "finished in the last 7 days" line). When the week view cannot be read, the page falls back to exactly these cards.
- Open Tasks: "Open the task" on a picked task; "Open Tasks" at the foot on a phone; the fallback page keeps its button.
- The planning-period switcher, where that flag is on: beside the Project picker.
- Onboarding and notification settings routes: untouched.

## New server reads, and how each is scoped

All are plain selects. Nothing inserts, updates or deletes.

**Home** (`loadHomeBoard`): takes no ids from a request. The Project list is `loadProjectCatalogAction()` for the re-authenticated caller, the list the chooser and the Projects page read; every select is filtered to those ids.

- The Projects page's own two reads, reused: card stats (`readProjectCardStats`, now exported) and Console facts (`readConsoleFactsWith`).
- Column settings for those Projects (`meta`).
- Members of those Projects (`workspace_members` joined to `users`): the only people ever named.
- The reader's own name (`users`, by their id).
- Tasks of those Projects: top-level, unarchived, unfinished or finished in the last two days; ordered by date; at most 3,000. Past that the page says there is more than it reads.

**Overview** (`loadOverviewRiver`): the briefing route passes the Project ids it authorized (the legacy path's `authorizedScope.workspaces`, or the progressive path's proved membership). The read keeps only the ids that are also in the caller's own Project list, or, with that list switched off, the ids `resolveProjectForRoute` proves one by one. Anything else is dropped silently.

- Status, target date and column settings for those Projects (`meta`).
- Members of those Projects.
- Tasks of those Projects: top-level, unarchived, unfinished or finished in the last 190 days; at most 3,000.

Review mode touches no database in either read: it uses the same sample tasks and Project facts the board and the Projects page use, on the pinned review clock.

Both are proved against the real schema in a disposable in-memory database (`src/server/home/home-reads.test.ts`): another Project's task never comes back, archived tasks and subtasks are left out, a former member is never named, and a Project's own finished column counts as done.

## What each account sees

**No Projects at all.** Home: the greeting, no count line, "No projects yet" and one quiet New project link. (An account with no workspace still gets the first-run page, as before.)

**A Project with no tasks.** Home: "Nothing needs you today", "Nothing of yours is late.", "Nothing of yours is due today.", the "No big day is set" card and the Project in the list. Overview: "No target date set. 0 open.", an empty frame that says "No tasks yet", and "Nothing due."

**Sparse (one Project, nine tasks, none assigned, most undated: the founder's own account).** Home: "2 things need you today · 1 late in Test project · 1 done this week"; one row under Late, Due today and Due this week, each saying "no one assigned"; "5 of your open tasks have no date yet"; the "No big day is set" card; one Project. The groups for checking and waiting are not drawn when they are empty. Overview: Status and People (there are no labels, so no Areas); two lanes, To do and In progress; three tasks on the river; five in "No date yet"; "This week, 2 tasks due."

**Busy.** The fixtures: twelve Projects on Home, a nineteen-task wedding on the Overview.

**A read that failed.** Home with no task read says it could not read your work and offers Tasks. A figure whose own read failed is left out (no late total, no done-this-week, no next big day) and the rest draws. The Overview without its week view falls back to the plain summary.

## Tests that pinned the old pages, and what changed

- `src/app/app/home/home-data.test.tsx`, "rendered Home links tasks and the scoped Overview": Home is drawn from `HomeBoard` now, through a client component. The test renders `HomeView` over the busy fixture and still asserts the scoped Overview address, no synthetic id, and that a task link names its own Project (`/app/tasks?task=…&workspaceId=…`, where it was `/app/task/<id>`).
- `src/modules/signal/server/analytics/production-entry-contract.test.mjs`: the pinned `<OverviewView model={model} />` now carries `projectIds`, and the test pins exactly where those ids come from in both engines.
- `src/modules/signal/lib/overview/overview-model.test.ts`: `OverviewView` is an async server component, so the two render tests await it and stand in for its client parts; a third test covers the page with a week view (week view first, the briefing's cards and opaque ids kept, the summary cards stepped aside).
- `experience/critical-fixtures.json`: see "Registry and critical capture" below.

Contract strings that changed on screen: "Home isn’t ready yet." is "Home is not ready yet"; "Home didn’t load." is "Home did not load"; "The Overview didn’t load." is "The Overview did not load"; the Home headings "My tasks", "Upcoming deadlines" and "Needs review" are gone, replaced by "Late", "Due today", "Due this week", "Waiting to be checked" and "You are waiting on".

## Capture record

The screenshots are not kept in this repository (the release reads the whole branch diff into a fixed buffer). They live in the design lab (`remote-redesign`, branch `design/landing-v3-directions`) under `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-05-port-home-overview/`.

`fixture/`: from the repo's own checks, which bundle the real components, styles and v3 tokens, stub only the server actions, and add no route:

```
pnpm test:home-overview:browser
node experience/home-overview/home.mjs --capture <dir>
node experience/home-overview/overview.mjs --capture <dir>
```

Expected: `PASS home: 604 checks ...` and `PASS overview: 576 checks ...`, each across 1920x1080, 1440x900, 768x1024 and 390x844, dark and light, with axe reporting nothing at any impact in every state.

`production-build/`: the real pages from `next build` served by `next start` in review mode (see "Gates").

It checks, at 1920x1080, 1440x900, 768x1024 and 390x844 in dark and light: the theme, the selected tab, that the tabs sit at the same place on both pages, that Home is the lit sidebar row on the Overview tab, no sideways scroll, axe on the page's own panel, a quiet console, and the tab switch by arrow keys in both directions. Expected: `PASS production build: 92 checks ...`. File names are `<page>-<size>-<theme>.png`; `-full` is the whole document.

## Registry and critical capture

Two registered sources changed, and their hashes were refreshed with receipts (`receipts/`, schema `signal-materiality-review/2`) written by `pnpm experience:review`:

| Entry | Why | New hash |
|---|---|---|
| `tasks.state.app-home-loading` | The loading state traces the new Home | `9dcb7b09c5c2c254` |
| `tasks.state.app-home-error` | The error state uses the v3 tokens and offers Tasks | `94e95fe898bce26d` |

`src/app/app/home/page.tsx` and the three briefing route files did not change, so their entries did not move.

The critical fixtures that pinned the old pages were updated (`experience/critical-fixtures.json`, and one explicit wait in `experience/tests/critical-experiences.spec.ts`):

- "front door lands on Home" and "home front door": the heading is "Good morning, Orla" (it was "Good morning."), and the populated proof is the text "Next big day" (it was the heading "Upcoming deadlines").
- "legacy link lands on the briefing" and "overview": the heading "What needs attention" replaces the text "Thursday 16 July · Read at 09:00"; the heading "Overview" and the text "2 things need attention and 1 is at risk." are unchanged.

A receipt is bound to the fixture manifest it was reviewed under, so changing the manifest unbound the six receipts earlier reviews had written (`tasks.page.app-project`, `tasks.state.app-project-loading`, `tasks.state.app-tasks-loading`, `tasks.resources.drive-upload`, `tasks.page.app-messages`, `tasks.state.app-tools-loading`). Their sources and hashes are unchanged; each was re-attached to the new run with a receipt in this folder that carries the original review text. The earlier receipts stay where they were.

All eight receipts cite `experience/evidence-runs/tasks-playwright-0e2bc8442ee479567ad9023e-a82659b5ab911b3e.json`: the critical capture, 132 of 132, on a demo build of this branch (`next build` with the environment `experience/playwright.config.ts` sets, served by `next start` on port 4393). The run before it was 131 of 132: the first case on the cold server ("front door lands on Home", mobile) recorded one aborted favicon request. The same case passed on a second freshly started server and in the full run that followed, so it is recorded here as a cold-start flake, not hidden.

## Bundle ceiling

`total_client_js` measures 1059.4 KB gzip on the demo build, against a ceiling of 1042 set for the Projects console (1040.2 measured). Home and the week view are client code where the pages they replace were server-rendered. Two reductions were made and measured first (the week view no longer imports the task panel's calendar for one label rule; the browser reads small kit modules, not the server-side models). The ceiling is raised to 1062 in `contracts/venue-surface-performance-budgets.v1.json`, with the basis written there. This is a delegated decision under the same sprint authority the Projects console used ("raise the budget explicitly if a better shell needs it") and is the founder's to confirm or reverse. The 936 target is unchanged.

## Where this falls short of the approved design

- **Tasks are one day wide.** The demo draws bars from a start date to a due date. The product stores only a due date, so the river is marks on days, with the label beside each. The "Weeks" zoom is the default so labels have room.
- **No looking back or ahead.** Dragging the Today handle to replay earlier weeks or forecast later ones needs a history of statuses and dates and a pace forecast. Neither exists. The handle is a label.
- **No pace sentences.** "At this week's pace the work is done Fri 2 Oct" on Home, and amber weeks on the Overview, are forecasts. Dropped.
- **No "waiting on <name>".** The stuck sentence and the waiting rows say how long, not on whom.
- **Approvals are tasks to check, not files.** There is no file approval in the product.
- **The Overview scrolls as a page.** The demo fills the window with the river and pins the week tray to the foot. Here the river, the tray and what the briefing read sit one under another in the page column, so the briefing's cards stay reachable and the page shares its edge with the rest of the app.
- **Finished work is dots, not labelled chips,** and there is no minimap, no "Spread" and no dragging a task to another day.
- **Areas need labels.** A Project with no labels opens grouped by board column. The founder's own account will open that way until tasks carry labels.
- **Switching tabs is a navigation,** not an instant swap: the two views are two routes with their own server reads. The tabs do not move while it happens.
- **The sidebar still has an Overview row.** By instruction it is left for the writer who owns the shell; it no longer lights on its own page.
- **Home still makes the briefing read** to decide the Project the chrome names and the Overview address, though it no longer draws from it. Removing that read is its own change, with its own tests.
- Review mode has one Project, so the busy account is judged on the fixtures. The database reads are proved against the real schema in a disposable in-memory database, not against a live account.
- On a phone the review build's own "In development" notice floats over the page until dismissed. It belongs to the shell.
