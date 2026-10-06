# Demo store

One canonical sample world for every surface in `/demo`. Board, list,
calendar, overview, projects, analytics, files, whiteboard and the Ctrl K menu
all read the same tasks, so a count, an owner, a date or a status is the same
wherever it appears.

Today is Friday 25 September 2026, 11:40. The viewer ("you") is Orla. The
calendar shows the week of Mon 21 to Sun 27 Sep for one person at a time: the
viewer's own by default ("Your week"), or the person `?owner=` names. Aoife's
week (`CALENDAR_OWNER`) and Orla's are written down; anyone else gets a plain
working week and their own open tasks in the tray. Names,
hues, dates, health and leads of the seven main projects come from
`../world.ts`; this folder adds the work.

## Files

| File | What it holds | Where it runs |
|---|---|---|
| `types.ts` | Project, Person, Supplier, Task, Room, TaskEvent, ProjectEvent, ProjectUpdate, Block, FixedEvent, DayCapacity, FileRef, DemoState, Scope | Anywhere |
| `data.ts` | The canonical data: `PROJECTS`, `PEOPLE`, `TEAM`, `SUPPLIERS`, `TASKS`, `BLOCKS`, `FIXED_EVENTS`, `CAPACITY`, `FILES`, `TASK_HISTORY`, `PROJECT_EVENTS`, `PROJECT_UPDATES`, `INITIAL_STATE`, plus `projectById`, `personById`, `supplierById`, `fileById`, `nameOf` | Anywhere |
| `history.ts` | Builds the starting task history from each task's fields plus the written stories, and the project history and updates feed. Internal: read it through the selectors | Anywhere |
| `templates.ts` | `TEMPLATES`, `templateById`, `seedProject`: what a new project starts with | Anywhere |
| `dates.ts` | `TODAY`, `NOW`, `WEEK_DAYS`, `fmtDay` ("Fri 25 Sep"), `fmtDate` ("3 Oct"), `fmtRelative` ("in 8 days"), `fmtShortDue`, `fmtDuration`, `fmtEuro`, date arithmetic | Anywhere |
| `selectors.ts` | Pure reads: counts, late, stuck, forecast, search and the rest below | Anywhere |
| `index.ts` | Server-safe barrel of `types`, `data`, `dates`, `selectors` and `templates` | Anywhere |
| `client.ts` | `"use client"` live store: `useDemoStore`, mutations, undo, reset | Client components only |
| `consistency.test.ts` | The invariants | `node --import tsx --test src/components/concepts/demo/store/consistency.test.ts` |

## Selectors

Every selector takes the state first: `INITIAL_STATE` on the server, the live
state inside `useDemoStore`.

- **Tasks:** `tasksFor(s, project?)`, `tasksIn(s, scope?)`, `tasksForPerson(s, id)`, `myTasks(s)`, `openTasks`, `lateTasks`, `stuckTasks`, `waitingTasks`, `doneThisWeek`, `tasksDueBetween(s, from, to, scope?)`, `dueToday`, `byStatus`, `byWorkstream(s, project)`, `findTask(s, idOrTitle)`, `waitingOnName(task)`.
- **Single task:** `isOpen`, `isLate`, `daysLate`, `isStuck`, `ageInStatus`, `lastMoved`.
- **Counts:** `countsFor(s, project)` gives `{ total, done, open, late, stuck, waiting, review, pct }`; `countsIn(s, scope)`; `workspaceCounts(s)` adds project totals, `doneThisWeek` and `dueToday`.
- **Projects:** `projectsOf(s?)`, `projectIn(s, id)`, `activeProjects(s?)`, `canonProjects(s?)`, `wrappedProjects(s?)`, `projectHealth(s, id)`, `forecast(s, id)`, `milestonesFor(id?, s?)`, `nextMilestone(id, s?)`. Projects now live in the state, so pass the live state to see a lead's edits. Without it these read the canonical world, as before. `projectById(id)` stays the canonical record.
- **Task history:** `historyFor(s, id)` (or `historyFor(id)` for the canonical world) gives a task's events, oldest first. `statusOn(task, date, s?)` or `statusOn(s, taskOrId, date)` gives the status it had at the end of any day, undefined before it existed. `boardOn(s, date, scope?)` groups the tasks that existed that day by the status they had, for replays. `movedBetween(s, from, to, scope?)` lists `{ task, from, to, on, steps }` for tasks whose status changed in the window, most recent first. `cameIn(s, from, to, scope?)` lists tasks created in it.
- **Project history:** `projectHistory(s, id)` (or `projectHistory(id)`) gives a project's events, oldest first. `projectUpdates(s, id)` gives its updates feed, newest first. `healthOn(s, id, date)` gives its health on any day.
- **The lead stuck task:** `stuckByUrgency(s, scope?)`, `leadStuck(s, scope?)` and `stuckSentence(s, scope?)`. See Definitions.
- **Templates:** `TEMPLATES`, `templateById(id)`, `seedProject(input, existing, viewer)`. Surfaces call `addProject` instead.
- **People:** `peopleLoad(s, { project? })`.
- **Files:** `filesFor(project?)`, `filesForTask(id)`, `awaitingApproval(person?)`, `seriesOf("seating")`.
- **Calendar:** `capacityOf(person?)` (a person's week of hours), `capacityFor(day, person?)`, `blocksOn(s, day, person?)`, `blocksForTask`, `fixedOn(day, person?)`, `plannedMinutes`, `overCapacity`, `unscheduled(s, person?)` (the tray). `person` defaults to `CALENDAR_OWNER` everywhere, so older callers read Aoife's week as before. `BLOCKS` and `CAPACITY` are still Aoife's alone; `ORLA_BLOCKS` and `ORLA_CAPACITY` are Orla's; `ALL_BLOCKS` is what the state starts with; `STANDARD_CAPACITY` is the plain week. `state.blocks` holds every person's blocks, so filter by `person` (or use `blocksOn`).
- **Search:** `search(s, query, limit?)` over projects, people, tasks, suppliers and files, best first. This feeds the Ctrl K menu.

`Scope` is `{ project?, owner?, person? }`. `owner` means tasks the person owns. `person` means tasks they own or help with.

## Definitions

- **Late:** due before today and not done. Due today is not late.
- **Stuck:** In progress, Waiting or Review, with no movement for 5 days or more (`STUCK_DAYS`). Movement is `waitingOn.since` for Waiting, otherwise `since`, the day the task entered its status. To do is never stuck.
- **Done this week:** `doneOn` from Monday 21 Sep to today.
- **Health:** the lead sets and stores it (`project.health`, with `healthReason` when it is not On track). Surfaces show the stored value. `forecast()` is a helper for "1 day to spare" lines. It counts open work due by the date (or undated, leaving out `afterEvent` work), divided by the last 7 days' pace. When nothing finished in those 7 days, it uses the pace since the project began. Its verdicts are `ahead` (3+ days spare), `tight` (0 to 2), `behind`, `too_early` (Ada & Theo) and `done`.
- **Task history:** a `TaskEvent` is `{ taskId, on, kind, from?, to?, by?, note? }`. Kinds: `created` (its first status in `to`), `status` (`from` and `to`), `owner`, `due`, `priority` (old and new values), `waiting` (who in `to`), `nudged` (who in `to`), `note` (text in `note`) and `removed`. The starting history replays exactly to today's records: a task is created on `created`, starts on `start` when that falls before its current status, and enters its current status on `since`. Done tasks finish on `doneOn`. Waiting tasks go to Waiting on `waitingOn.since` and are nudged every 4 days (at most twice, never today). `since` is always the day of the last status event. Written stories add the rest: the final numbers slipped from 17 to 30 Sep on 18 Sep, the marquee sides from 24 to 28 Sep on 23 Sep, the barn slates from 16 to 30 Sep on 16 Sep, and the firelight shoot from 24 to 28 Sep on 22 Sep. The wet-weather plan moved from Aoife to Orla on 23 Sep. Every edit through the client appends its events dated today, by the viewer.
- **Project history:** a `ProjectEvent` is `{ projectId, on, kind, from?, to?, reason?, text?, by }`. Kinds: `created`, `health` (`from`, `to`, `reason`; equal `from` and `to` means only the reason changed), `lead`, `date`, `note`, `update` (the update's id in `to`, its text in `text`), `milestone`, `wrapped` and `unwrapped`. Each project's last health event matches its stored health and reason. Mara & Finn went At risk on 18 Sep ("Final numbers and the marquee sides are late"), and the reason was refreshed on 24 Sep. Barn roof went At risk on 16 Sep (the slates) and Off track on 23 Sep. Winter launch went At risk on 19 Sep and Off track on 24 Sep. Keane Legal went At risk on 22 Sep. Niamh took over the Christmas markets from Orla on 7 Sep. The food fair moved from 27 Nov to 4 Dec on 16 Sep.
- **Updates feed:** a `ProjectUpdate` is `{ id, projectId, on, by, text, kind }`, where kind is `update`, `health` (a health change posts its reason) or `wrapped`.
- **The lead stuck task:** stuck work ranked by urgency, not age. First by days until its project's day, soonest first. A season that has begun counts to its last day. Projects more than 60 days out (`NEAR_DAYS`) come last. Then by days stuck, longest first. Across the workspace it leads with "Chase florist deposit" (the wedding is 8 days out), then Farrell Build (35 days), then Mark's headcount (42), then the walled garden wall (66, so last). `stuckSentence` returns `{ task, days, waitingOn, actionLabel, more, moreCount, sentence }`. Waiting: "Chase florist deposit has waited 7 days on Fern and Furrow." with "Nudge Fern and Furrow". To check: "… has waited N days to be checked." In progress: "… has not moved in N days." The action is "Nudge" plus the owner's first name, or "Check it" or "Open it" when the viewer owns it. `more` is "3 more stuck", or "" when there is only one. Every surface uses these words. `stuckTasks` keeps its oldest-first order.
- **Estimates and rooms:** every open task has an `estimate` in minutes. Where the data gave none, the title decides: a chase or a check is 15, a send or a booking is 30, drafting and planning are 90, a tasting or a shoot is 120, and anything else is 60. `room` is one of Long barn, Orchard marquee, Walled garden, Terrace or Orchard hall, and sits on 24 event tasks. Dinner and the seating are in the long barn, the drinks reception is on the terrace, and the marquee work is in the orchard marquee.
- **Projects:** 15 are active: the 7 main ones from `world.ts` (`canon: true`) and 8 smaller Orchard projects that the projects ledger needs for density. 4 more are wrapped. Wrapped projects keep no task records. Their `wrapped.tasks` figure stands in, and `countsFor` reports it as all done. Workspace counts cover active projects only. A project wrapped during a review keeps its task records. `countsFor` counts them, and workspace selectors without a project in the scope leave them out. A surface that shows only the main projects uses `canonProjects()`, and must say "7 main projects", not "7 projects".

## Starting figures

These are derived, never stored, so they change as reviewers edit.

| Project | Health | Total | Done | Open | Late | Stuck | Forecast |
|---|---|---|---|---|---|---|---|
| Mara & Finn's wedding | At risk | 44 | 23 | 21 | 2 | 1 | tight, 1 day to spare |
| Harvest supper club | On track | 13 | 5 | 8 | 0 | 0 | ahead |
| Kavanagh 40th | On track | 14 | 4 | 10 | 0 | 0 | ahead |
| Barn roof and heating works | Off track | 15 | 4 | 11 | 3 | 1 | behind |
| Winter season launch | Off track | 14 | 2 | 12 | 4 | 0 | behind |
| Christmas markets at The Orchard | On track | 11 | 2 | 9 | 0 | 0 | ahead |
| Ada & Theo's winter micro-wedding | On track | 8 | 3 | 5 | 0 | 0 | too early |
| Keane Legal retreat | At risk | 6 | 2 | 4 | 2 | 1 | behind |
| Kinsale food fair in the barn | On track | 4 | 1 | 3 | 0 | 0 | ahead |
| Spring 2027 wedding open day | On track | 4 | 1 | 3 | 0 | 0 | ahead |
| Staff rota and training | On track | 6 | 2 | 4 | 0 | 0 | ahead |
| Website photo shoot | On track | 6 | 3 | 3 | 0 | 0 | ahead |
| Orchard wine list refresh | On track | 4 | 1 | 3 | 0 | 0 | ahead |
| Garden path lighting | On track | 4 | 3 | 1 | 0 | 0 | ahead |
| Venue upkeep | On track | 6 | 2 | 4 | 0 | 1 | ahead |
| 4 wrapped projects | Wrapped | 41, 36, 22, 18 | all | 0 | 0 | 0 | |

**Workspace:** 159 tasks, 58 done, 101 open, 11 late, 4 stuck, 8 waiting, 5 in review, 35 done this week, 2 due today. 15 active projects: 2 at risk, 2 off track.

**Stuck (4):** Repoint the walled garden wall (Kerr Stoneworks, 12 days), Chase the headcount from Mark (10), Chase florist deposit (Fern and Furrow, 7), Agree the revised schedule with Farrell Build (7).

**Aoife's Friday:** 8h planned against 7h, so "Make Friday fit" has 1h to move. Monday to Thursday fit. The Wednesday 15:30 block for "Stall pricing for the Christmas markets" was missed, and the task is still To do.

**Orla's Friday:** 6h 30m planned against 5h 30m (the menu tasting with Mara and Finn takes 16:00 to 17:30), so "Make Friday fit" has 1h to move on her week too: "Keep it secret: a separate thread with Sinéad" goes to Saturday at 11:00, after the walk round the grounds. Monday to Thursday hold only what she finished (the winter launch plan, the Kavanagh invitation, the rooms to shoot) beside her own meetings. "Chase the headcount from Mark" is late and has no time yet, so her tray's Late tab is not empty.

## Words (round 2, 2 October 2026)

The landing page promises plain words, so the demo uses them too. The status
key is still `review`, but it reads **To check** everywhere. A project's
health is labelled **How it is doing** (the values stay On track, At risk, Off
track). A milestone reads **Big date** ("Next big date"). Overview's lanes are
**Areas**. The daily fixed event is the **Morning catch-up**. A file waiting
for a yes says **Approve**. The supper club takes **bookings**, not tickets.

## Pace: one story

Every "N a week" is the forecast's window: tasks finished in the last 7 days,
today included (`paceStory(s, scope).last7`). For Mara & Finn that is 17. The
project home's "19 done and 18 added in 14 days" is `last14` and `added14`, and
it says "17 of the done in the last 7" so the two figures meet: the week before
held 2. Analytics counts calendar weeks: last week (Mon 14 to Sun 20 Sep) 9
finished across all projects, 4 of them in Mara & Finn; this week so far 35
(Home's "35 done this week"), 15 of them in Mara & Finn. The run-up week is the
busy one, and every surface says which window it means. The test "pace: one
story" holds these together.

## Resolved truths

Each contradiction from the design review now has one answer.

1. **Mara & Finn late:** two tasks. "Reprint the faded welcome sign" (Dara, due Tue 22 Sep, 3 days late) and "Order tonic and the good olives" (Dev, due Wed 23 Sep, In progress, 2 days late). The "final headcount" and "book the shuttle" rows are gone; see 7 and 8.
2. **Mara & Finn size:** 44 tasks, 23 done, 21 open. 17 of the open tasks are due by the day, and 4 follow it on purpose (`afterEvent`: return the marquee, pay The Lindens' balance, the thank-you card, ask for a few words online). 17 finished in the last 7 days, so at that pace the work finishes Fri 2 Oct, 1 day to spare.
3. **Workspace totals:** use `workspaceCounts`. The table above gives the starting figures.
4. **Project counts:** 15 active (7 main and 8 smaller) and 4 wrapped. See Definitions.
5. **Seating plan:** Aoife drafted v2 (10 Sep, long tables, Mara asked for rounds) and v3 (18 Sep). Mara approved v3 on 21 Sep: 118 guests at 15 tables. Aoife finished v4 on Thu 24 Sep: still 118 guests at 15 tables (guests are 118 everywhere; nothing says 120), with the Galway cousins seated together, Aunt Rose away from the speakers, the children's table by the doors and the wheelchair route to table 6. She sent it to Mara the same day. "Draft the seating plan" (mf-20) is Done on 24 Sep. "Approve the seating plan" (mf-21) is Waiting on Mara since 24 Sep, owned by Aoife, due Sat 26 Sep. The milestone "Seating plan approved" is Sat 26 Sep. In Files, v4 is awaiting Mara and v3 is the latest approved version. Nobody shows it as waiting on Orla, and nothing shows it as approved at v4. So "Which seating plan did Mara approve?" now answers: v3, on 21 Sep; v4 is with her now.
6. **Confirm marquee sides with Lawlor Hire** (mf-13): Aoife, To do, Urgent, due Mon 28 Sep. Aoife's calendar has a block for it Fri 13:00 to 14:00. Due and scheduled are different facts. Quote v3 (€3,850, down from €4,200) is awaiting Mara.
7. **Florist deposit:** one task, "Chase florist deposit" (mf-33). The Orchard paid the €300 deposit on 18 Sep; that is in the task's note, and the task carries no cost or paid flag, so no view puts a "Paid" chip on a task that is still waiting. Fern and Furrow have not confirmed it landed, so the task is Waiting on Fern and Furrow since 18 Sep (7 days, stuck, ready for a Nudge), due Mon 28 Sep. "Pay the florist deposit" no longer exists.
8. **Order prosecco for the drinks reception** (mf-6): Dev, due Tue 29 Sep, 10 cases and a magnum from Kinsale Wine Co, €1,180. Mara approved the order sheet on 25 Sep.
9. **Welcome sign:** "Reprint the faded welcome sign" only, Dara, PrintHaus Cork, €150.
10. **Harbour Coaches:** "Book the Harbour Coaches shuttle" was done on 2 Sep (Niamh, €1,140, 26 guests). "Confirm Harbour Coaches pick-up times" was done Wed 23 Sep. Nothing about the coaches is late.
11. **Final numbers:** one task, "Final numbers to the kitchen" (mf-7), Aoife with Dev, Urgent, due Wed 30 Sep, 118 guests. It goes once Mara approves v4.
12. **Menu tasting** is today at 16:00 (milestone Fri 25 Sep). It is not 29 Aug.
13. **Winter launch, Barn roof, Harvest:** every count is derived. Winter launch has 4 late: price list, winter menu, brochure copy, glassware. Barn roof has 3 late: manifold, Farrell Build schedule, telling the October couples. Harvest bookings open Mon 28 Sep at €65 a seat. Harvest is not "38 of 40 sold".
14. **Kavanagh 40th:** the host is Sinéad Kavanagh (Lena's sister). There is no "Ciara Kavanagh". The band is The Lindens, still to say yes. There is no DJ.

The other surfaces' extra projects map as follows. The ledger's `science-fair` is `food-fair`. Analytics' "Summer garden party" (finished 20 Sep) is `garden-parties`, wrapped 31 Aug. The overview's ids `wedding`, `winter`, `barn` and `ada` are `mara-finn`, `winter-launch`, `barn-roof` and `ada-theo`.

## Adopting it in a surface

1. **Initial render (server or client).** Read through the selectors on `INITIAL_STATE`:
   ```ts
   import { INITIAL_STATE, countsFor, lateTasks } from "@/components/concepts/demo/store";
   const c = countsFor(INITIAL_STATE, "mara-finn");
   ```
2. **Live state (client).** Read through `useDemoStore`, so an edit on the board shows on the list and the calendar:
   ```ts
   "use client";
   import { useDemoStore, updateTask, undo } from "@/components/concepts/demo/store/client";
   import { lateTasks } from "@/components/concepts/demo/store";
   const late = useDemoStore((s) => lateTasks(s, { project: "mara-finn" }));
   ```
   The selector can return new arrays: it reruns only when the state changes. The server snapshot is `INITIAL_STATE`, so hydration never mismatches. A saved session takes over right after.
3. **Edits.** Call mutations instead of keeping local copies of tasks or projects. Every edit, to a task or a project, is one step on the same undo stack and writes its history with today's date, by the viewer:
   - `updateTask(id, patch)` stamps `since` with today on a status change, sets `doneOn` on Done, and clears `doneOn` and `waitingOn` when the status leaves them.
   - `addTask({ title, project, ... })` returns the new id ("mf-45"). By default the task is To do, owned by the viewer, in the project's first workstream.
   - `removeTask(id)` also drops its blocks.
   - `scheduleBlock(block | block[])` and `unscheduleBlock(id | id[])` treat an array as one undo step, which suits "Make Friday fit".
   - `nudgeTask(id, note?)` records a nudge to whoever the task waits on, or to its owner. `noteTask(id, text)` adds a note to its history.
   - `updateProject(id, patch)` changes health, `healthReason`, lead, date, end, note or name. At risk and Off track need a reason. Without one in the patch (or already stored for that same health), the call is refused and returns `false`. On track clears the reason. A health change posts its reason to the updates feed.
   - `setMilestone(projectId, milestoneId, done)`, `addMilestone(projectId, { title, date })`, `postUpdate(projectId, text)`, `wrapProject(id, stat?)` and `unwrapProject(id)`.
   - `addProject({ name, date, template?, lead?, short?, hue?, note?, kind?, end? })` creates the project and seeds it from a template, as one undo step. The templates are `wedding` (12 tasks), `party` (8), `corporate` (8), `works` (6), `school` (6) and `campaign` (6), and "tpl-" ids work too. Owners come from the team by role. Due dates count back from the project's date and are squeezed into the days left when the date is near, so nothing starts late. It returns the new id: a slug of the name ("murphy-wedding"), typed as `ProjectId`. It starts On track and `tooEarly`.
   - `undo()`, `useCanUndo()`, `getDemoState()`, `resetDemo()`. `resetDemo()` clears tasks, blocks, history, projects, project history and updates.
4. **What persists.** State and the undo stack live in `sessionStorage` (`signal-demo-store`). The snapshots are packed: each record is stored once, and canonical records are never stored, so 40 undo steps stay small. They survive navigation and reload in that tab. Each tab starts fresh. A failed read or write falls back silently. Bump `DATA_VERSION` in `data.ts` whenever the canonical data changes, so stale sessions are dropped.
5. **Map, don't copy.** Map store fields to a surface's own shapes in that surface:
   - status `doing` → the whiteboard's "Doing", the list's `doing`
   - `owner` → the list's `owner` cell
   - `project` → the list's `event`
   - `waitingOn` → the board's `heldBy`; render it with `waitingOnName`
   - `estimate` → the calendar's estimate
   - `start` and `due` → the overview's bars

   Colours: use `project.hue` and `person.hue` as `--v3-project-n`. Several surfaces still carry old tones; for example, the wedding is now 9, not 8.
6. **Things a surface should not do.**
   - Don't hand-write counts.
   - Don't re-derive "late" with a different rule.
   - Don't keep a second task list for the same project.
   - Don't show "waiting on you" for the seating plan.
   - Don't keep project edits (health, lead, date, milestones, updates, new projects) in a surface's own layer. They live here now.
   - Don't rank stuck work yourself or word it differently. Use `stuckSentence`.
   - If a surface needs a fact that isn't here, add it to `data.ts`, extend the test, and say so in this file.
