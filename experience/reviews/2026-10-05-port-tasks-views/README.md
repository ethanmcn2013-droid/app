# Tasks board, list and calendar: the approved design on the real pages

Branch `design/app-v3-tasks-views` (PR #211), cut from `4ae930c1`. The founder approved the integrated demo and asked for those designs on the real pages. This brings the Tasks demo designs onto `/app/tasks`, `/app/tasks/list` and `/app/tasks/calendar`. An unshipped candidate. No deployment, promotion, database write, schema change or production change was made, and no dependency was added.

The design source stays in `src/components/concepts/` in another worktree (uncommitted, read only): `board/c1/`, `final/tasks-list/`, `calendar/c2/` and the shared `tasks/`. Nothing in product code imports from it; the views were reworked in place under `src/components/tasks/`.

## Three founder instructions that changed the brief on 5 October

| Instruction | What was done |
|---|---|
| The board keeps its column model and drag behaviour | Restyled only. Columns, drag, touch lift, keyboard carry, column menus and the task panel are the same code paths; the repo's own behaviour check passes unchanged apart from its calendar step (below) |
| The calendar's "To plan" tray goes on the right, not the left as in the demo | The week grid takes the left and centre and the tray is a right-hand column. On a tablet it is a sheet at the foot of the screen; on a phone it folds at the top of the agenda. The browser check asserts the tray starts to the right of where the grid ends |
| One create button per screen, and it is the top bar's New | The header has no "New task" button and the phone's round button is gone. The C key opens the same composer as before (`add-task-context.tsx` owns it, untouched). The header's actions group carries `data-new-task-anchor`, so the composer still opens from the top right. The quiet "Add a task" rows in each board column, the list's inline add row, the calendar's per-day add and the empty states stay |

## What is where

| Piece | File |
|---|---|
| The header's figures and the stuck rule, as a pure model | `src/components/tasks/tasks-pulse.ts` (+ test) |
| The one header: title, project, summary line, stuck sentence, team, Stuck, Share, overflow | `src/components/tasks/header.tsx` |
| The tools row: view switch, Find a task, Filter, Display, filter chips | `src/components/tasks/toolbar.tsx` |
| Page frame and header styles | `src/components/tasks/workspace.module.css` |
| Figures, the stuck filter and the column names every view reads | `src/components/tasks/surface.tsx` |
| Board | `board-view.tsx`, `board.module.css` |
| List | `list-view.tsx`, `list.module.css` |
| Calendar | `calendar-view.tsx`, `calendar.module.css` |
| Labels, due chip, subtask steps, status glyph | `atoms.tsx`, `atoms.module.css`, `status-glyph-model.ts` |
| Loading skeletons | `skeletons.tsx`, `skeletons.module.css` |
| Busy, sparse, empty, view-only and loading fixture, and its browser check | `experience/tasks-views/` |

The header is one implementation: `TasksHeader` and `TasksToolbar` render once in `tasks-workspace.tsx` above whichever view is open. The browser check measures the title and the view switch on all three views at every size and fails if either moves.

## Each element and its source

No server read was added. Everything below is counted in the browser from data the page already loads: the project's tasks (`useLabStore`, `useTasksState`), its columns, its members and the calendar frame (the project's "today" and time zone).

### Shared header

| Element in the demo | Source | Kept or dropped |
|---|---|---|
| Title "Tasks" | Fixed | Kept |
| Project pill (dot, name) | The open project's name and the same colour the sidebar gives it. It links to the project page | Kept. The demo's "all projects" chooser is dropped: Tasks is one project at a time, and the shell's own chooser switches project |
| "N done this week" | Tasks whose `completedAt` falls in the seven days ending today, in the project's time zone | Kept. Seven days ending today, not Monday to Sunday, so it agrees with the Projects console and Analytics |
| "N open" | Tasks not in a done column | Kept |
| "N late" (a filter) | Open tasks with a due date before today. Pressing it sets the existing Due filter | Kept |
| The ring | Done of total | Kept |
| (not in the demo) "N due today", "N with no date" | The same counts the old header showed as three chips | Kept as quiet pressable facts, so nothing a person could do in the old header is lost |
| Stuck sentence: "X has waited 7 days on Fern and Furrow. Nudge" | Started work (not in the first column, not done) unchanged for four days or more, longest first. "Unchanged" is the task's `updatedAt` (or `idleDays` when the record carries it): the rule My tasks already uses for "needs attention" | Kept as "X has not changed in 9 days. Open it · 2 more stuck". "Waiting on <person>" is dropped: the board has no "held by" field. Nudge is dropped from the sentence: Open it leads to the task, where the existing actions are |
| Stuck N control | Count of the same set; a view filter for this visit, shown as a chip beside the other filters, never saved | Kept. Hidden when nothing is stuck. It lets go by itself when the last stuck task moves on |
| Team faces | Current project members (the existing members popover, with Invite people for a manager) | Kept |
| View switch, Find a task, Filter, Display | The existing controls and the existing filter model | Kept, restyled |
| New task (primary button) | | Dropped by the founder's instruction above |
| Replay, Group by Stage (board), sheets and the command line (list), Plan my week and Week at a glance (calendar) | No data or no such feature | Dropped |

### Board

| Element | Source | Kept or dropped |
|---|---|---|
| Columns | The project's own columns, in its order, with its names. The shipped "Review" reads "To check" until someone renames it | Kept |
| Column caption | The column's own note (the owner's words win; otherwise the shipped one-line note) | Kept. The demo's "55 new, 39 out" and its sparkline are dropped: there is no history of moves to count from |
| Card: title, due chip, priority, labels, subtask steps, comments, files, faces | The task | Kept. Labels with no colour of their own take a steady hue from their name. Faces take a steady hue from the person. Amber, orange, red and pink are never assigned |
| Card: "7 days" | Days unchanged, for stuck tasks only | Kept |
| Card: cover art, "Waiting on <person>", "Nudged today" | No such fields | Dropped |
| Done rail | Done is folded to a slim rail that counts finished work and opens when pressed. This is the existing "Collapsed" Done setting made the default; Compact and Full are still in Display | Kept |
| Work-in-progress limit | The column's own limit | Kept as before |

### List

| Element | Source | Kept or dropped |
|---|---|---|
| Grid with a mark per column, hairlines, editors in cells | The existing cells and pickers (status, assignee, due, priority, labels) | Kept |
| Group rows with "23 of 44 done" | Count of done tasks in the group | Kept when the group mixes done and open; otherwise the plain count |
| Grouping | Status, assignee, priority, due date, none (Display) | Kept |
| Stuck pill in the row | As on the board | Kept |
| Foot: "159 tasks · 11 late · Sum" | Count of rows shown, late among them, and Amount added up when that column is on | Kept. Amount is printed as the list already prints it, without a currency sign |
| Cost, Paid, Room, Supplier columns; sheets (All tasks, Suppliers, Budget); "3 hidden"; the command line | Only Amount exists | Dropped. Optional columns stay Labels, Subtasks and Amount, chosen from the plus at the end of the header row. Saved views stay in Filter |
| The record view | The task panel is the product's record view and is untouched | Not rebuilt |
| Phone layout | The existing two-line rows | Kept, restyled |

### Calendar

| Element | Source | Kept or dropped |
|---|---|---|
| Week view, one column a day | Tasks on the day they are due (ranges on each of their days, big dates marked) | Kept, and now the view it opens on |
| Hours down the side, timed blocks, meetings, "now" line | A task stores a date, not a time. No calendar events are read | Dropped |
| "11h 30m planned of 31h 30m", "2h of 6h" per day, "Friday is 1h over. Make Friday fit" | `tasks.estimate` exists in the schema but nothing in the product lets anyone enter one, and there is no capacity anywhere | Dropped. In their place: "3 due this week · 1 late" beside the week, and "2 due" under each day |
| "To plan" tray with Due soon, Late, No date | Open tasks due in the next seven days; open tasks past their date; open tasks with no date. Counted from the tasks the filters admit | Kept, on the right |
| Drag from the tray onto a day | The existing `scheduleOn` and `moveScheduleByDays`; dragging back to the tray uses `unscheduleTask` | Kept |
| Mon to Sat / Full week | "Show weekends" in Display | Kept there |
| Month and agenda | Existing | Kept behind the same switch |
| Big dates list, the selected day with "Add on this day" | Existing | Kept under the tray. In the week the selected-day list is hidden, because every day is already open in its column, and each day keeps its own add button |
| Subscribe | Existing | Kept |

## What an empty and a sparse account see

- **No tasks:** the header shows the title, the project, the team, Share and the overflow, and no figures (there is nothing to count). The board shows its columns full height with the existing "start your board" card and three examples. The list says "Nothing on the list yet" with one "Add the first task" action. The calendar shows the empty week with "Nothing due this week" and the tray reading "Every open task has a date".
- **Nine tasks in one project (the founder's own account):** "0 done this week · 9 open", plus late and no-date facts only when they are not zero. No Stuck control and no stuck sentence unless started work has really sat for four days. Columns with nothing in them say what they are for.
- **View only:** a "View only" tag beside the project, no add rows, no drag, pickers disabled.
- **Loading:** a skeleton with the header's geometry (title and project, the summary line, the tools row over its hairline) and the view's own shapes; the calendar's is now a week.
- **Error:** `src/app/app/tasks/error.tsx` is unchanged.

## Capabilities kept, and where

| Capability | Where it is now |
|---|---|
| Create a task | The top bar's New, or C. Also "Add a task" at the foot of each board column, "Add a task" on a list group, the plus on a calendar day, and the empty states |
| Quick filters: late, due today, no date | Pressable in the summary line; also Filter, Due date |
| Filter by status, assignee, priority, due date, label; clear; chips | Filter, unchanged |
| Saved views: save, apply, delete | Filter, unchanged |
| Density; fit columns; column notes; task numbers; Done column (Compact, Full, Collapsed); list grouping; order; calendar weekends and finished tasks | Display, unchanged |
| Optional list columns | The plus at the end of the list's header row |
| Share | Header, from 768px up as before |
| Print, copy as CSV, copy as Markdown, subscribe in a calendar, keyboard shortcuts | The overflow menu |
| Members and Invite people | The faces in the header |
| Board: drag, touch lift, keyboard carry, rename in place, column menu (rename, colour, note, limit, counts as done, fold, move, delete), add a column, the phone column pager | Unchanged |
| List: sort by a column, cell editors, select rows and the bulk bar | Unchanged |
| Calendar: month, week, agenda, drag to date and back, big dates | Unchanged; the week is now first |
| Every keyboard shortcut in the "?" sheet | Unchanged |

Removed on the founder's instruction: the header's "New task" button and the phone's round create button.

## Words changed

"Overdue" is "late" everywhere on these pages (filter, chips, list group, agenda, the spoken sentence on a due chip). "Review" is shown as "To check" unless a project has renamed the column. "Needs a date" is "To plan" (the tray) and "with no date" (the count). "Milestones" in the calendar pane is "Big dates". The in-progress mark is ink, not amber: amber is kept for stuck and over-limit, red for late. A due chip for today is accent, not amber.

## Tests changed, each deliberately

| Test | Change |
|---|---|
| `src/server/suite-navigation-contract.test.mjs` | "Tasks ... keeps its own Add task" becomes "leaves the one create button to the top bar": it now asserts the header has no primary button and the workspace no "New task" button, and still asserts `data-new-task-anchor` |
| `experience/tasks-board-behaviour-browser.mjs` | The calendar step picks Month (the calendar now opens on the week, which does not hold the 22nd), opens "To plan" instead of "Needs a date", and picks the No date tab. The assertions are the same |

No other contract string was changed. `time.ts` keeps its chip labels ("15 Jul, 1 day late"); only its spoken sentence dropped the word "overdue".

## Capture record

Screenshots are not kept in this repository (the release operator's diff limit). They are in the design lab repository (`remote-redesign`, branch `design/landing-v3-directions`) under `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-05-port-tasks-views/`:

- `before/`: a production build of `4ae930c1`, the three routes at 1440 dark and light and 390 dark.
- `review-mode/`: a production build of this branch (`next build`, then `next start`, `VERCEL_ENV=preview`, `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, `SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true`, port 4391, never `next dev`), the three real routes at 1920x1080, 1440x900, 768x1024 and 390x844, dark and light, reduced motion on. Names are `<view>-<width>-<theme>.png`. Review mode's sample project has 13 tasks and a clock pinned to 16 July 2026.
- `busy-account/`: the fixture, from the repo's own check, names `<view>-<state>-<size>-<theme>.png`:

```
pnpm test:tasks-views:browser                               # checks only
node experience/tasks-views/run.mjs --capture <directory>   # checks, then screenshots
```

Expected result: `PASS tasks views: 733 checks across wide, desk, tablet and phone, light and dark`. It bundles the real `TasksWorkspace` with the real styles and v3 tokens over the in-memory task store the design lab already uses (48 tasks, 8 people, pinned to 16 July 2026, with a venue's words), stubs only the seams that need a server or the shell, and adds no route. It checks, on every size in both themes and on all three views: the one header and its parts, that the title and the view switch do not move between views, no create button in the page, no sideways scroll, the banned word list and axe with no findings at any impact. Then: the Stuck control, sentence, filter and chip; the late filter; five columns, the Done rail and opening it; a mouse drag between columns; the keyboard walk, carry, Escape and Enter; the list's cell editor, group folding, sorting, grouping, adding a column and the bulk bar; the calendar opening on the week, the tray to the right of the grid, its three tabs by arrow keys, a drag from the tray onto a day and back; the tablet sheet and the phone agenda; sparse, empty, view-only and loading on each view; and nothing looping under reduced motion.

## Found and fixed while checking

- A board column long enough to scroll could not be scrolled from the keyboard (axe, serious). It now takes focus only when it overflows.
- The phone column pager's count sat under AA on the selected chip. It takes the chip's ink.
- The stuck check on a card tripped the first-contact language scan (the word `undefined` inside a template). Restated; the scan is clean.
- On a phone the project pill was squeezed to three letters beside the actions. It takes its own row.
- On a tablet the "Today" tag ran into the next day's name. Below 1100px the accent alone marks today.

## One decision this leaves open: the bundle ceiling

`pnpm perf:budgets` fails on this branch. Every client chunk, gzipped, measures 1044.2 KB against a ceiling of 1042. The same measurement on `4ae930c1`, built the same way on the same machine, is 1040.4, so these three views add 3.8 KB: the stuck model, the summary line, the calendar's tray tabs and week header, the list's foot. Dropping the Tasks views' import of the sidebar (for the project colour) moved it by 0.1 and was kept. Nothing else found was worth removing a feature for.

The check says raising a ceiling is a decision, not an edit, and three ports are landing at once, each adding its own. The ceiling was left alone here. It needs one decision when the three are integrated: raise it once for the redesign, as PR #201 did, or name what to cut.

## Registry and receipts

No registered source file changed: the three page files, `loading.tsx` and `error.tsx` under `src/app/app/tasks/` are untouched, and `experience:validate` and `experience:fixtures` are clean without a hash refresh. No receipt was needed, so this folder holds no `receipts/`.

## Checks

Run on this worktree, Windows. Every browser row ran against a production build (`next build`, then `next start`), never `next dev`.

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed |
| ESLint on the changed files | Passed, no errors (one warning that predates this branch, an unused constant in `suite-navigation-contract.test.mjs`) |
| `pnpm test:tasks-views` (the pulse model, status glyphs, view order, surface keys, display preferences) | 22 of 22 |
| `suite-navigation-contract.test.mjs` | 31 of 31 |
| `pnpm test:floor-theme`, `test:calendar-truth`, `test:floor-calendar`, `test:floor-context`, `test:suite-url-and-switcher`, `context-actions.test.ts` | 11, 16, 26, 4, 35 and 13, all passing |
| Module boundaries, first-contact language, tap-target scale, suite switcher contract | Passed |
| `pnpm build` in review mode and in demo mode, each with the token check | Passed: 67 tokens defined, none used and undefined |
| `pnpm test:tasks-views:browser` | 733 checks |
| `node experience/tasks-board-behaviour-browser.mjs` against the review build on port 4391 | 9 of 9 behaviours: mouse drag, drop at origin, touch lift, keyboard carry, complete and undo, cold-page j and Enter, calendar drag and back, the composer from C, no layout per pointer move |
| `experience:self-test`, `experience:fixtures`, `experience:validate` | Passed; 37 of 37 mapped; clean |
| `experience:test` critical capture, demo-mode production build served on port 4352 | 132 of 132, attested (`tasks-playwright-80b2f4d0f1c10e2ab2461d63`). Run on the tree one small commit before the head (the identity-hue helper, which changes no pixel). The first attempt timed out starting its own server on a busy machine; the build was then made separately and reused |
| `pnpm test:settings-hydration` (includes "the board's columns are surfaces") | 7 of 7 twice. The first run, on a server just started, failed that one board test once ("a board column has a fill") and passed when repeated; the column's computed fill was read directly in both themes and is opaque. Recorded as a flake, not explained |
| `pnpm perf:budgets` | **Failed**: 1044.2 KB gzip against 1042 (above) |
| Full `pnpm test`, `test:recipient-context:browser` | Not run locally. CI is the judge |

## Where this falls short of the approved design

- **No hours and no capacity on the calendar.** The demo's week is a time grid with a planned-of-capacity line and "Make Friday fit". The product stores a due date and nothing more, so the week is day columns of cards. This is the largest visible difference and it is deliberate.
- **Stuck is "unchanged for four days", not "waiting on someone for seven".** There is no record of who a task is waiting on or when it entered its column. `updatedAt` moves on any edit, so a task someone re-labelled yesterday is not stuck even if it has sat in the same column for a month.
- **No flow figures on the board** (new, out, the sparkline, Replay) and **no cover art on cards.**
- **The list has four fixed columns and three optional ones**, not the demo's typed columns, sheets and command line.
- **The page column is capped at 1320px** (`--v3-page-w`), where the demo runs the full width. At 1920 the board has wide margins.
- **Faces are the app's tinted avatars**, not the demo's solid discs: the avatar is a shared component (Messages uses it) and was left alone. They now take identity hues that never read as a warning.
- **The task panel still says "Review"** where the column is unrenamed: it is outside these surfaces and reads the shared column model.
- **Review mode has 13 tasks and none stuck**, so the busy account, the stuck sentence and the Stuck control are judged on the fixture, not on real data. Nothing here was seen on the founder's account.
- **The one-time tip row** under the tools (dismissible, existing) is not in the demo and was kept.
