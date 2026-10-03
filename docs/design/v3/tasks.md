# Tasks (Board, List, Calendar, task sheet, new task): v3 spec

Stream: TASKS · worktree `worktrees/app/design-suite-redesign-v3` · 24 September 2026
Status: final spec. A delegated decision under the founder-approved v3 redesign sprint ("nuke it and bring it up to truly world class"). Section 13 lists the three boundary items the coordinator must confirm before the build.
Before evidence: `.playwright-mcp/v3/core/tasks-before-*.png` (workspace root). Reference for the suite's look: `tasks-ref-mytasks-light.png`, Home, Files, Analytics, Projects hub.

---

## 0. Which direction and why

Two concepts were drafted. **A ("One calm page that answers what's next, what's stuck and what's done", clarity first)** and **B ("An instrument you play", keyboard first).** Judged in north-star order:

| | A: clarity | B: power |
|---|---|---|
| 1. Experience | The page answers the day's question before you touch it: "5 of 13 done", then three pressable facts. One status vocabulary everywhere. Each empty place says what belongs there. It feels considered for someone at a venue with a phone in one hand. | Fast and satisfying for an expert. The motion is richer (lift, tilt, FLIP settle, a drawn tick), and the docked sheet keeps the board alive beside the task. Single-letter property keys feel like Linear. |
| 2. Design | Calm and consistent with Home and My tasks. Weaker in finish: a centred scrim over the board, done work only as rows, priority as a word. | Stronger craft: bar-style priority icon, drawn completion tick, non-modal sheet at wide sizes, sentence-case weekdays, months cut to the weeks they actually use. Heavier chrome: IDs on every card, a Views menu in the toolbar. |
| 3. First-time utility | Strong. Facts are filters with plain names, columns carry a one-line purpose, and there is one primary action in one place. | Weaker. IDs, saved views and letter keys are power features shown first. The phone default flips to List through a client redirect, which risks a board flash and a confusing "why did it change". |
| Honesty and risk | Board stays the default everywhere, so there is no hydration flip. Keeps the store and data attributes. | Correctly insists that quick filters live in room tools (so saved views capture them) and that column management must be ported before `options/**` is deleted. Retires more files at once. |

**Verdict: A is the spine.** It wins on utility, and its information architecture is right for the people Signal serves. It is weaker than B in craft and speed, so we graft B's best ideas. Each costs little and hides behind the calm first read:

1. **Docked, non-modal sheet at ≥1280px.** The board stays visible and usable next to the task, and the open card is highlighted. Below 1280px the sheet is modal with a scrim (A's framing). This is how Linear feels.
2. **Property keys on a focused task or selection:** S status, A assign, D due, P priority, L labels. Each opens its picker anchored to the card or row, filterable by typing. They are discoverable in menus and the shortcuts sheet, never required.
3. **Quick filters live in room tools** (`due: overdue | today | unscheduled`), not in Floor-local state, so facts, the filter menu, chips and saved views are one model.
4. **PriorityIcon** (three rising bars; urgent is a danger square with "!") with the word in the tooltip and accessible name, replacing the bare word "High".
5. **Craft motion:** the 180ms drawn tick, the 1.02 lift with a small velocity tilt, FLIP settle of siblings only, a 120ms rise for new cards. All transform and opacity; all removed under reduced motion.
6. **Calendar details:** sentence-case weekdays, only the weeks that intersect the month, chips that drag back to the tray to clear a date, milestones listed in the tray.
7. **Filter defaults feed creation:** with Assignee "Orla" active, a new task is pre-assigned to Orla. With a column's "+", the task lands in that column.
8. **Saved views**, kept, but inside the Filter menu's footer rather than as a fourth toolbar button.
9. **Header period fact** "Day 11 of 97, wedding season" when a planning period exists; omitted otherwise, never faked.
10. **A shared key guard** with a unit test, so single letters never fire inside inputs, dialogs, the palette or with modifiers.
11. **Stale task copy:** "This task was deleted or moved to another project." with Close, instead of the silent 1.2s auto-close.

**Rejected from B, with reasons.** Task IDs on every card: noise for first contact; the ID lives in the sheet breadcrumb and in a Display toggle "Show task numbers" (off by default). List as the phone default via client redirect: risks a flash and makes the same URL mean different things; Board stays default and the last view is remembered per device only through the view links the person chooses. Swipe-to-complete and swipe-to-menu on list rows: hidden gestures that fire by accident while scrolling; the glyph tap and the ⋯ menu do the same jobs visibly. Haptic `vibrate()`: unsupported on iOS and noisy on Android; the lift animation is the feedback. Column-header drag to reorder: fiddly next to card drag and inside a scrolling track; "Move left / Move right" in the column menu is reliable and keyboard accessible. Rejected from A: the 680px scrim sheet at all widths (it hides the work you are deciding about).

---

## 1. Goals

1. **Five-second understanding.** A first-time venue owner sees what is done, what is late and what needs a date, and knows what to press to add work, without a tour.
2. **One status vocabulary across the suite.** The glyphs from My tasks (empty ring, amber half, accent three-quarter, clock, green tick) read the same in Board, List, Calendar, the sheet and the composer.
3. **Nothing lost.** Every capability that exists today keeps working: create, inline and sheet edits, drag and reorder, keyboard carry, filters, search, bulk, custom columns, due dates, repeats, priority, assignees, labels, comments, resources, share, print, export and undo. The capabilities that exist in code but have no control (filter, search, column management) get one.
4. **Fast for the people who live here.** Every act is one key or one click from any view. Selection, filters and the open task survive a view switch.
5. **Schedule is gone.** Three views: Board, List, Calendar. `/app/tasks/timeline` redirects to `/app/tasks`.
6. **Feels like the rest of v3.** Same tokens, header grammar, 44px targets and page column as Home, My tasks and Files.

Non-goals: new server reads, schema changes, new dependencies, presence data, a new permission model.

---

## 2. Information architecture

```
/app/tasks              Board (default, all breakpoints)
/app/tasks/list         List
/app/tasks/calendar     Calendar (Month | Week | Agenda sub-mode, client state)
/app/tasks/timeline     server redirect → /app/tasks, keeps ?workspaceId and ?task
/app/task/[id]          Full-page task (same sections, two columns)
?task=<id>              Opens the task sheet over any view, survives view switches (floorViewHref)
?create=task            Opens the new-task composer (studio-chrome contract unchanged)
/print/{board|list|calendar}   Print; /print/timeline redirects to /print/board
```

Page anatomy, top to bottom: **context row** (project, collaborators, Share, ⋯, New task) → **title block** (h1 "Tasks", progress, facts) → **toolbar** (view switch, search, Filter, Display) → **active filter chips** (only when filters are on) → **first-run hint** (once) → **view canvas**. The task sheet sits over or beside the canvas. The bulk bar and undo toast float at the bottom.

Wedding-date strip and VenueWelcomeCard stay (page.tsx), restyled in v3 tokens and placed above the context row.

---

## 3. Layout per breakpoint

Breakpoints: phone ≤767px, tablet 768–1099px, desktop ≥1100px, wide ≥1280px (docked sheet).
Page column: max-width 1180px, padding 28px 32px 56px desktop, 20px 16px mobile. Header and toolbar sit in the column (left-aligned with it). Board and Calendar canvases are full-bleed with a 32px inner gutter (16px phone). List stays in the 1180px column.

### 3.1 Desktop 1440×900, Board

```
┌ shell sidebar ┬───────────────────────────────────────────────────────────────────────────────┐
│               │ Signal Studio / Tasks                          [Search ⌘K]  🔔  [+ New]  DO   │ shell top bar (unchanged)
│               ├───────────────────────────────────────────────────────────────────────────────┤
│               │ [T] The Orchard, events          (OR)(MD) 2    Share   ···   [+ New task  C]  │ context row, 44px
│               │ Tasks                                                                         │ h1 28/600
│               │ 5 of 13 done ▰▰▰▰▱▱▱▱▱  Day 11 of 97, wedding season                          │ 13px text-2, 120px meter
│               │ [● 1 overdue] [● 1 due today] [○ 5 need a date]                               │ fact toggles, aria-pressed
│               │ [▥ Board │ ≡ List │ ▦ Calendar]   [⌕ Find a task…        /]  [⚑ Filter] [☰ Display] │ toolbar 44px, sticky under top bar
│               │ Overdue ×   Assignee: Orla ×   Clear filters                                   │ chips row, only when filtered
│               │ Drag a card to the right as work moves along. Press ? for shortcuts.     ×    │ first-run hint, once
│               ├───────────────────────────────────────────────────────────────────────────────┤ full-bleed canvas, --v3-canvas
│               │ ○ To do 3     + ···│ ◐ In progress 3 + ···│ ◕ Review 2   + ···│ ◷ Waiting 0 ···│ ✓ Done 5   ···│ + Add column
│               │ Agreed and ready   │ In motion right now  │ Being checked      │ Held by a reply│ Finished work  │
│               │ ┌────────────────┐ │ ┌──────────────────┐ │ ┌────────────────┐ │┌ ─ ─ ─ ─ ─ ─ ┐│ ✓ Open day, ni…│
│               │ │○ Confirm marquee│ │ │◐ Menu tasting at │ │ │◕ Approve the   │ │ Nothing waiting│ ✓ Deposit invo…│
│               │ │  sides with the │ │ │  The Orchard     │ │ │  final seating │ │ on anyone. Drop│ ✓ Clear Sunday…│
│               │ │  hire company   │ │ │ 1 Aug  ▮▮▮       │ │ │ ▮▮▮  💬1       │ │ a task here    │ Show all 5     │
│               │ │ Mara & Finn     │ │ │ Mara & Finn  💬2 │ │ │ Mara & Finn (OR)│ │ when it waits  │                │
│               │ │ ▮▮▮        (OR) │ │ │ ◔ 2/5    (OR)(MD)│ │ └────────────────┘ │ on a reply.    │                │
│               │ └────────────────┘ │ └──────────────────┘ │ + Add a task       │└ ─ ─ ─ ─ ─ ─ ┘│                │
│               │ + Add a task       │ + Add a task         │                    │ + Add a task   │                │
│               │                            ┌────────────────────────────────────────────────┐                     │
│               │                            │ 3 selected  Move to ▾  Assign  Due  Priority  Mark done  Delete  ✕ │   bulk bar
│ ┌ Marked done · Undo ┐                     └────────────────────────────────────────────────┘                     │
└───────────────┴───────────────────────────────────────────────────────────────────────────────┘
```

- Columns: 288px default, min 272, max 340. "Fit columns" (existing `useFitColumns`) makes them share the width. Otherwise the track scrolls horizontally with a right edge fade.
- Lanes are `--v3-sunken` with `--v3-radius-lg`; cards are `--v3-surface` on a `--v3-border` hairline. Column headers are sticky inside each lane; each lane scrolls on its own.
- Done is compact by default: single-line rows, newest 3, then "Show all 5". Display offers "Show done in full" and "Collapse done" (a 44px vertical rail with name and count, persisted through `useCollapsedLanes`).

### 3.2 Desktop, List

```
│ [ ]  Task                                        Status        Assignee    Due         Priority │ sticky header, 13px text-2, sortable
│ ▾ ○ To do  3                                                                     + Add a task   │ sticky group header, 40px
│ [ ] ○ Confirm marquee sides with the hire company  ○ To do       (OR) Orla   —           ▮▮▮ High │ row 52px comfortable / 40px compact
│        Mara & Finn · Saturday, terrace plan if dry                                             │ one-line description, text-3
│ ▾ ◐ In progress  3                                                                             │
│ [ ] ◐ Build the Saturday run-sheet                  ◐ In progress (OR) Orla   Today       ▮▮▮ High │
│ [ ] ◐ Order tonic + the good olives                 ◐ In progress (OR) Orla   14 Jul, 2 days late │ due cell danger-soft
│ ▸ ✓ Done  5                                                                                    │ collapsed by default
```

- Title column flexes; property columns are fixed (Status 140, Assignee 140, Due 150, Priority 110). Nothing clips at 1180px. Optional columns through the existing `INITIAL_LIST_COLUMNS` model: Labels, Estimate, Amount, Updated.
- Checkbox shows on hover or focus, and always once anything is selected. The row opens the sheet; a cell opens its property popover.
- Group by: Status (default), Assignee, Priority, Due, None.

### 3.3 Desktop, Calendar

```
│ ‹  July 2026  ›   Today                          [Month │ Week │ Agenda]    Subscribe   │
│ Mon     Tue     Wed     Thu     Fri     Sat     Sun                    │ Needs a date  5          ⌃ │
│ 29      30      1       2       3       4       5                      │ Drag onto a day to date it │
│ 6       7       8       9       10      11      12                     │ ○ Confirm marquee sides…   │
│ 13      14 ◐Order tonic…    15      (16) ◐Build the Sat…   17 …      │ ○ Reprint the faded sign…  │
│ 20      21      22      23      24      25      26                     │ + 3 more                   │
│ 27      28      29      30      31      1       2                      │ Milestones                 │
│                                                                         │ ◆ Menu tasting, 1 Aug      │
│                                                                         │ ── Thu 16 Jul ──────────── │ selected day
│                                                                         │ ◐ Build the Saturday run…  │
│                                                                         │ + Add on this day          │
```

- Only the weeks that intersect the month render (5 or 6). Today's date is ringed in `--v3-accent`. Day cells show up to 3 chips (glyph + title), then "+2 more", which selects the day.
- The 320px right pane merges the Planning drawer's unscheduled list, milestones, and the selected day. The Planning drawer is retired.
- Week: seven columns, all chips visible, same drag. Agenda: dated tasks grouped by day, today first.

### 3.4 Task sheet

Wide (≥1280px): docked 560px sheet on the right, no scrim; the canvas shrinks by the sheet width (board track keeps scrolling) and the open card shows `--v3-row-selected` with an accent ring.
Desktop and tablet (<1280px): 600px sheet (tablet: 100% − 48px) over `--v3-scrim`, modal.

```
┌ [T] The Orchard, events › In progress › T-5        ↑  ↓   ⤢   ···   ✕ ┐  header 52px; Saved stamp appears here
│ ◐  Build the Saturday run-sheet                          [✓ Mark done] │  title 22/600, editable in place
│                                                                        │
│ Status       ◐ In progress                                             │  property rows 40px: label 120px text-2 | value button
│ Assignees    (OR) Orla   +                                             │
│ Due date     Today, Thu 16 Jul        Repeats never                    │
│ Priority     ▮▮▮ High                                                  │
│ Labels       [Mara & Finn]  +                                          │
│ Blocked by   Nothing                                                   │  only when a blocker exists or on hover "Add"
│ + Amount   + Contact   + Milestone                                     │  optional fields stay collapsed until used
│ ────────────────────────────────────────────────────────────────────── │
│ Ceremony 2pm orchard, drinks on the terrace…                           │  description, placeholder "Add a description"
│ Subtasks   2 of 5  ▰▰▱▱▱                                               │
│   ✓ Confirm band arrival   ○ Print copies   ○ …        + Add a subtask │
│ Files and links   2                                  Attach or paste a link │
│   ▣ run-sheet.pdf     ↗ Floor plan                                     │
│ Activity                                                               │
│   Orla created this · 3 days ago                                       │
│   (MD) Mara: Can we add the toast? · 1 hour ago                        │
│ ┌ Write a comment…                                        Send ⌘↵ ┐   │  composer pinned to the sheet bottom
└────────────────────────────────────────────────────────────────────────┘
```

Full page `/app/task/[id]`: same sections. Main column 1fr (max 720px), properties column 300px sticky on the right. Below 1100px the properties stack above the description.

### 3.5 Phone 390×844

```
┌──────────────────────────────┐
│ ☰  Tasks               ⌕  DO │ shell top bar
│ [T] The Orchard, e… (OR)(MD) ⋯│ context row; Share moves into ⋯
│ Tasks                        │ h1 24/600
│ 5 of 13 done ▰▰▰▰▱▱▱▱        │
│ [1 overdue][1 today][5 no d… │ facts scroll horizontally
│ [ Board │ List │ Calendar ]  │ full-width segmented, 44px
│ [⌕ Find a task      ] [⚑ 2]  │ Filter opens a bottom sheet
│ (To do 3)(In progress 3)(Rev │ sticky column pager, synced to scroll
├──────────────────────────────┤
│ ┌──────────────────────────┐┌│ column ≈ 100vw − 56px, next one peeks
│ │ ○ To do · Agreed and rea…││ scroll-snap-type: x mandatory
│ │ [card]                   ││ scroll-padding-inline: 16px
│ │ [card]                   ││
│ │ + Add a task             ││
│ └──────────────────────────┘└│
│                          (+) │ 56px New task FAB, above safe area
└──────────────────────────────┘
```

- List on phone: two-line rows, min 56px. Line 1 glyph + title; line 2 "Today · ▮▮▮ · Mara & Finn · (OR)". Sticky group headers. Property edits open bottom sheets.
- Calendar on phone: Agenda by default (client sub-mode rendered after mount; SSR renders the agenda skeleton, not the month, so there is no flash). A 7-day strip on top selects days. "Needs a date · 5" is a collapsible section at the top.
- Sheet on phone: full-screen with a sticky top bar (back, ↑ ↓, ⋯). Composer pinned above the keyboard (`visualViewport`).
- New task FAB: 56px accent circle, 16px from right, `calc(16px + env(safe-area-inset-bottom))` from bottom, hidden while the keyboard is open or the sheet is open.

### 3.6 Tablet 768–1099px

Board shows about 2.5 columns with `scroll-snap-type: x proximity`. Calendar day pane becomes a bottom drawer (collapsed to "Needs a date · 5" handle). Sheet is modal at 100% − 48px. Toolbar keeps one row; Display collapses into an icon button with label in its tooltip and accessible name.

---

## 4. Components

New UI lives in **`src/components/tasks/`** (CSS modules on `--v3-*` tokens only). Store, adapter and data logic in `src/components/hybrid/` are kept. Public data attributes are preserved on the new DOM: `data-board`, `data-lane`, `data-id`, `data-floor-head`, so the recipient browser tests keep their hooks.

### Host and data
1. **TasksWorkspace** (`tasks-workspace.tsx`). Replaces OptionHybrid, FloorWorkspace and PlanningRail. Mounted by `HybridWorkspace`, which still provides `HybridStoreProvider`, `WorkspaceBoardColumnsProvider`, the runtime people/label registries and room tools. New prop `readOnly` fed from `arrival.project.project.capabilities.createOrEditTasks` (already resolved in page.tsx) into `HybridStoreProvider readOnly`. Views are dynamically imported per route so Board does not ship List or Calendar.

### Header and toolbar
2. **TasksHeader**: ProjectContext (tile from `--v3-project-1..8` + `--v3-project-ink`, project name linking to the project overview), `TaskCollaborators`, Share (existing `ShareButton`, view-aware), ⋯ (`PageActionsOverflow`: Print, Copy as CSV, Copy as Markdown, Subscribe in a calendar, Keyboard shortcuts), NewTaskButton (accent, "New task" + `C` key hint). h1 "Tasks"; a "View only" badge beside it when read-only.
3. **TaskCollaborators**: thin wrapper over `AvatarStack` from `src/components/app/presence/avatar-stack.tsx` (consumed, never edited). Members from `useWorkspaceMembers()` mapped to `{ id, name, initials, colour: member.color }`; `max={3}` desktop, 2 phone; `size="md"`; `showCount`; `label="Project members"`; no `online` (no presence data). `onClick` opens a popover listing members with role and "Invite people" (opens the ShareButton invite flow; only when `manageProject`). Zero members resolved: the stack is hidden. One member: one face plus "Invite".
4. **ProgressFacts**: "5 of 13 done" + 120px meter (`role="progressbar"`, `--v3-success` on `--v3-fill`), optional period fact from `useRoomBrief`/`useCalendarFrame`. Three **FactToggle** buttons (aria-pressed, 44px): Overdue (danger-soft / danger-text), Due today (accent-soft / accent-text), Need a date (fill / text-2). Counts from `timeOf()` and the column `isDone` flag; pressing sets room tools `due` to `overdue | today | unscheduled` (one at a time; pressing the active one clears). A zero-count fact renders disabled with its count 0, so geometry is stable. All done: "All 13 done" with a success tick, facts hidden.
5. **ViewSwitch**: segmented `Link`s (Board, List, Calendar) with icons, `aria-current="page"`, hrefs from `floorViewHref` (keeps project and `?task`), keys 1/2/3, disabled while `viewSwitchBlocked`.
6. **SearchField**: bound to room tools `query`; `/` focuses, Esc clears then blurs. Matches in titles are wrapped in `<mark>` (accent-soft background, text colour unchanged). Placeholder "Find a task". Searches titles and descriptions.
7. **FilterMenu**: Radix dropdown (existing dependency). Facets: Status (columns), Assignee (members + Unassigned), Priority, Due (Any, Overdue, Today, This week, No date), Label. Each facet is keyboard filterable. Footer: "Saved views" list (apply, delete) and "Save this view…" (existing localStorage contract `saveCurrentView / applySavedView / deleteSavedView`). The trigger shows the active count ("Filter 2").
8. **DisplayMenu**: Density (Comfortable / Compact); Board: Fit columns, Show column notes, Done (Compact / Full / Collapsed), Show task numbers; List: Group by, Columns, Sort (Manual, Due date, Priority, Title, Updated); Calendar: Show weekends, Show done.
9. **FilterChips**: one removable chip per active filter plus "Clear filters". Replaces the Floor filter sentence.
10. **FirstRunHint**: one dismissible line under the toolbar, dismissal stored per viewer in localStorage (try/catch; absent storage means show).

### Shared task atoms
11. **StatusGlyph** (one SVG, 16px visual): to do empty ring (`--v3-text-3` stroke), in progress half (`--v3-warning-stroke`), review three-quarter (`--v3-accent`), waiting clock ring (`--v3-text-2`), done filled tick (`--v3-success`). Custom columns: dashed ring tinted by the column colour mapped to a `--v3-project-N` token (never raw hex text). Any column with `isDone` renders the tick. Matches My tasks' `StatusCheck` shapes; extract the shape map to `src/components/tasks/status-glyph.tsx` and leave My tasks untouched.
12. **CompleteToggle**: StatusGlyph inside a 44px hit area; `aria-pressed`, `aria-label="Mark "…" done"` / `"Mark "…" not done"` (names kept identical to My tasks for tests). Read-only renders the glyph as a non-interactive icon.
13. **PriorityIcon**: three rising bars (low 1, normal 2, high 3 filled; unfilled bars `--v3-border-strong`); urgent is a `--v3-danger` rounded square with "!". Cards show it for high and urgent only; List and sheet show it with the word.
14. **DueChip**: from `timeOf()`. Overdue "14 Jul, 2 days late" (danger-soft / danger-text); Today (warning-soft / warning-text); Tomorrow and dates (text-2); milestone ◆ in accent-text; done "Done 12 Jul" in text-3.
15. **LabelChip** (fill / text-2, 2 then "+n"), **SubtaskReceipt** (◔ 2/5 with a tiny ring), comment count, attachment count, **BlockedMark** (from `blockedByIds`, "Blocked" in warning-text).

### Board
16. **BoardCanvas**: horizontal track with edge fade and scroll shadow on sticky headers; `role="application"` with an `aria-roledescription="task board"` and a single roving tab stop; owns the pointer-drag controller and keyboard carry; live region bound to `store.announcement`.
17. **BoardColumn**: sticky header (glyph, name, count, "n / limit" when a work limit is set, `+`, `···`), column note (description or `LANE_NOTE`, toggle in Display), card stack, inline composer at the foot, **EmptyDropZone** (dashed `--v3-control-border`, lane sentence). `content-visibility: auto` on cards when a column holds more than 50.
18. **ColumnMenu**: ported from `hybrid/options/a/board-view.tsx` (the optimistic column-config logic is moved, not rewritten): Rename (inline in the header), Edit note, Colour (`COLUMN_PICKER_ORDER` swatches), Work limit, Counts as done, Move left, Move right, Delete column. Actions: `renameColumnAction`, `setColumnDescriptionAction`, `setColumnColorAction`, `setColumnLimitAction`, `setColumnDoneAction`, `reorderColumnsAction`, `deleteColumnAction`. Delete confirms and names where tasks go ("Its 2 tasks move to To do."). Shown only with `manageProject`.
19. **AddColumnButton**: at the end of the track; popover with a name field, Enter commits (`addColumnAction`). Disabled with a hint at `MAX_CUSTOM_COLUMNS`.
20. **TaskCard**: `article` with a button-role open target, 12px padding, `--v3-radius`, `--v3-border`, `--v3-shadow-1` on hover. Row 1: CompleteToggle + title (3-line clamp, `overflow-wrap: anywhere`). Row 2 (only when present): DueChip, PriorityIcon, up to 2 LabelChips, SubtaskReceipt, comments, attachments, BlockedMark. Assignees on the right (`AvatarStack size="sm" max={2}`). Comfortable density adds a one-line description. States: focused (2px accent ring via global `:focus-visible`), selected (`--v3-row-selected` + accent ring), carried (lift), recently placed (1.2s accent-soft wash via `recentlyPlacedId`), done (title text-2, no strike on the board; strike only in Done compact rows).
21. **DragLayer**: fixed-position ghost moved only with `transform`; 2px accent insertion bar; placeholder keeps the source card height.
22. **TaskMenu**: Radix context menu on right-click, the card's ⋯ (visible on hover and focus), or `.`: Open, Rename, Status ▸, Assign ▸, Due ▸, Priority ▸, Labels ▸, Move to ▸ (the no-drag path), Duplicate, Copy link, Archive, Delete. Reuses the actions from `shared/task-context-menu.tsx` then retires that file.

### List
23. **ListView**: ListHeaderRow (sortable, sentence case), GroupHeader (sticky, collapsible, glyph, name, count, "1 of 3 done", "+ Add a task"), ListRow (checkbox, glyph, title + one-line description, property cells), PropertyCell popovers (StatusPicker, AssigneePicker, DuePicker with `detail-panel/due-calendar.tsx`, PriorityPicker, LabelPicker), ColumnPicker on `INITIAL_LIST_COLUMNS / setColumns`.

### Calendar
24. **CalendarView**: CalendarToolbar (‹ month ›, Today, Month/Week/Agenda, Subscribe from the existing ICS link), MonthGrid, WeekGrid, AgendaList, DayPane (NeedsDateTray from `activeUnscheduledTasks` in `planning.ts`, Milestones, selected day list, "Add on this day"). Drag uses `scheduleOn`, `moveScheduleByDays`, `unscheduleTask`. Tray row menu: "Give it a day".

### Detail
25. **TaskSheet** (`src/components/app/detail-panel/task-sheet.tsx`, or `src/components/tasks/sheet/` if the boundary widens, section 13): replaces the centred `TaskFocusWindow` framing. Composes PanelHeader (breadcrumb, ↑ ↓ in visible order, ⤢, ⋯, ✕, EditedStamp "Saved"), TitleEditor, **PropertyRow** (new layout: 120px label in text-2, value is a button that opens a popover picker) wrapping the existing `field-rows.tsx` editors (status, assignees, due + `repeat-button.tsx`, priority, labels, `cents-editor.tsx`, `contact-editor.tsx`, milestone), `description-editor.tsx`, `subtasks-section.tsx`, `resources-section.tsx` (Drive uploads unchanged), Activity (merges `ExistingTaskHistory` and `ConversationFeed`, oldest first, composer pinned). `TaskDetailPanel` renders TaskSheet; `/app/task/[id]/task-focus-view.tsx` renders the same sections in the two-column page.
26. **SheetStates**: skeleton (title bar + 5 property rows), stale ("This task was deleted or moved to another project." + Close), scoped section notices ("Comments aren't available right now.").

### Create, bulk, feedback, states
27. **NewTaskComposer** (rebuild of `add-task/quick-create-dialog.tsx`, same create path through `useTasksDispatch().addTask({...})`): anchored popover under the New task button on desktop (480px), bottom sheet on phone. Large title input with live parse chips from `parseTaskInput` ("Due Fri 18 Jul", "Repeats weekly", "#venue" → label), each removable. Optional "Add details" description. Pill row: Status (all columns incl. custom), Assignee, Due, Priority, Labels. Defaults: the column whose "+" was used, else the first column; active filters pre-fill (assignee, label, priority). "Create more" switch. ↵ creates; ⌘/Ctrl+↵ creates and opens; Esc closes, confirming "Discard this task?" only when there is content.
28. **InlineComposer**: at the foot of each column and group; one-line textarea with the same parse highlighting. Enter adds and stays open, Esc closes. Calls the store `addTask(status, schedule?, title)` (titled adds never steal focus).
29. **BulkBar**: floating bottom centre, `--v3-surface`, `--v3-shadow-pop`: "3 selected · Move to ▾ · Assign · Due · Priority · Mark done · Delete · ✕". Uses `bulkStatus`, `bulkComplete`, `bulkDelete`; Assign, Due and Priority loop per id through `updateAssignees`, `scheduleTask`, `updatePriority` (no new server action). Delete is a two-step confirm in place ("Delete 3 tasks?" → "Delete").
30. **UndoToast**: one bottom-left toast from `useFloorUndo` (renamed `useTasksUndo`, same logic): "Marked done · Undo", "Moved to Review · Undo", "Added to To do · Open · Undo". 6s window, paused on hover or focus; ⌘/Ctrl+Z works after it hides.
31. **ShortcutsSheet** (`?`): grouped Navigate, Act, Views, Sheet. Rewrites `shared/shortcuts-dialog.tsx`.
32. **TasksEmpty**, **TasksSkeleton** (`loading.tsx`), **TasksError** (`error.tsx`).
33. **useSurfaceKeys** + `surface-keys.test.ts`: the shared key guard (section 6).

---

## 5. Interactions

### Create
- "New task", `C` or `?create=task` opens NewTaskComposer with the title focused. Typing "Call florist Friday #venue" shows "Due Fri 18 Jul" and "Venue" chips.
- ↵ creates. The card lands with the 1.2s accent-soft wash, the toast reads "Added to To do · Open · Undo".
- Column "+" or "Add a task" at a foot opens the InlineComposer: Enter adds and stays open for the next one, Esc closes.
- Clicking an empty calendar day selects it; its "+" (or Enter on a focused day) composes with that date.

### Complete
- Click the glyph: the tick draws (180ms `pathLength`), then the card flies to Done (existing `use-floor-flight`) or fades and collapses if Done is collapsed. Toast "Marked done · Undo". Clicking a done glyph reopens the task.

### Move (pointer drag, no new dependency)
- Mouse: drag starts after 4px of movement. Touch: 300ms long press (scrolling is never hijacked); `touch-action: pan-x pan-y` on cards until lifted.
- On lift: scale 1.02, `--v3-shadow-pop`, tilt up to 1° following horizontal velocity. The placeholder keeps the source height.
- At drag start every lane and card rect is measured once into a cache. `pointermove` only reads the cache and writes one `translate3d` per animation frame. The insertion index comes from cached midpoints plus the scroll delta. The cache refreshes only on track or lane scroll. No `getBoundingClientRect` per move.
- Edge auto-scroll on both axes: 64px hot zones, speed proportional to depth. Scroll snap is suspended while dragging.
- Siblings slide aside with FLIP transforms (only in the source and target columns).
- Drop into an `isDone` column counts as completion (tick draws, toast "Marked done"). Dropping at the origin is a non-event with no undo entry. A column over its work limit shows a warning outline while hovered and still accepts.
- Phone: carrying a card within 24px of the screen edge for 400ms pages to the next column. The card's ⋯ → Move to is the reliable path.

### Keyboard carry (existing contract, kept)
Space picks up; arrows move across and within columns; Space or Enter drops; Esc returns the task to where it was. Every step is announced: "Build the Saturday run-sheet, In progress, position 2 of 3".

### Edit
- `E` or double-click on a card title edits in place (Enter saves, Esc restores).
- Clicking a due chip, avatar or priority on a card or list cell opens that property's popover without opening the task.
- Sheet fields save on blur or selection; the header shows "Saved" (EditedStamp). Failed saves revert and toast "Couldn't save the due date. Try again".

### Navigate and select
- j/k or arrows move focus; on the Board, ←/→ move between columns keeping the row index. Enter opens the sheet.
- In the sheet, ↑/↓ and j/k move through the **current view's visible order** (behaviour change from raw store order). `e` or ⤢ opens `/app/task/[id]`.
- X toggles the focused task; Shift+click or Shift+↑/↓ extends a range (existing `TOGGLE_SELECTED` range logic); ⌘/Ctrl+click toggles; ⌘/Ctrl+A selects the focused column or group. Esc clears the selection.

### Filter and search
Facts, Filter menu and search combine with AND. Column counts read "2 of 3" while filtered. The live region announces "Showing 2 of 13 tasks". "Clear filters" resets everything except view and display prefs.

### Columns
`···` opens the ColumnMenu. Rename is inline in the header. "+ Add column" opens a name field that commits on Enter.

### Undo
⌘/Ctrl+Z anywhere on the surface reverses the last done, move or add through the same code path (so the card animates back). Delete is not undoable (no restore path exists); it confirms instead.

### Docked sheet (≥1280px)
The sheet is a labelled `complementary` region, not a focus trap. Opening moves focus to the sheet title; F6 moves focus between canvas and sheet; Esc closes and returns focus to the originating card. Clicking another card swaps the sheet's task. Below 1280px it is a modal dialog: focus trapped, scrim click closes, focus returns to the card.

### Keyboard map

| Key | Where | Action |
|---|---|---|
| `C` | anywhere (global) | New task |
| `⌘K` / `Ctrl+K` | anywhere (global) | Command palette |
| `1` `2` `3` | surface | Board, List, Calendar |
| `/` | surface | Focus search |
| `F` / `Shift+F` | surface | Open Filter / clear filters |
| `?` | surface | Shortcuts |
| `j` `k` `↑` `↓` `←` `→` | surface | Move focus |
| `Enter` | focused task | Open sheet |
| `E` | focused task | Rename in place |
| `Space` | focused card | Pick up / drop (carry) |
| `Esc` | anywhere | Cancel carry, clear search, close menu, close sheet, clear selection (innermost first) |
| `X` | focused task | Toggle selection |
| `⌘A` | surface | Select focused column or group |
| `S` `A` `D` `P` `L` | focused task or selection | Status, Assign, Due, Priority, Labels picker |
| `.` | focused task | Task menu |
| `⌘Enter` | focused task | Mark done or reopen |
| `⌘D` | focused task | Duplicate |
| `Delete` / `Backspace` | focused task or selection | Delete (confirm) |
| `⌘Z` | surface | Undo |
| `j` `k` `↑` `↓` | sheet | Previous / next task in view order |
| `e` | sheet | Open full page |
| `F6` | docked sheet | Move focus between canvas and sheet |
| `T` `←` `→` | calendar | Today, previous, next period |
| `↵` / `⌘↵` | composer | Create / create and open |

`⌘` means Ctrl on Windows and Linux; labels render the platform's key.

---

## 6. Key guard (useSurfaceKeys)

Single-letter and symbol keys fire only when: no modifier except Shift is held (except listed ⌘ combos); `event.target` is not an input, textarea, select or contenteditable; no Radix menu, popover or dialog other than the docked sheet is open; the command palette is closed; `event.isComposing` is false. The guard is one pure function (`shouldHandleSurfaceKey(event, state)`) with a unit test covering each exclusion. The global `C` and `⌘K` are not redefined here.

---

## 7. States

- **Loading** (`loading.tsx`, TasksSkeleton): header blocks, a toolbar, and per view: 4 columns with 3/2/2/1 card silhouettes, 8 list rows, or a month grid. `--v3-fill` shapes with a 1.2s shimmer, static under reduced motion. Geometry equals the final layout; the collaborators slot reserves 3 faces. Sheet: title bar + 5 property-row skeletons.
- **First run** (0 tasks): the real columns render with notes and dashed "Add a task" slots. A centred guide card over the first two columns: headline and body from `usePersonalization()`, an autofocused input "What needs doing first?", three example chips from personalization (click fills the input), and "Bring tasks in from a spreadsheet" linking to the existing import route when it exists. List shows the guide instead of rows; Calendar shows the month with the guide in the day pane. Ghost views and EmptyStateOverlay are retired.
- **Empty column**: "Nothing waiting on anyone. Drop a task here when it is held by a reply or a delivery." Done: "Finished work collects here." Custom column: its note, else "Drop a task here or add one."
- **Filtered to nothing**: "No tasks match Overdue and Orla." + [Clear filters]. Chrome stays; columns show "0 of 3".
- **Search, no results**: "Nothing matches "tonik" in titles or descriptions." + [Clear search].
- **Everything done**: "All 13 done" with a success tick; columns show their empty sentences; Done lists the work.
- **Calendar month empty**: "Nothing dated in July." + "5 tasks need a date" pointing at the tray.
- **Error** (`error.tsx`, TasksError): "Tasks didn't load. Your work is safe." [Try again] (`reset()`) [Go to Home].
- **Mutation failure**: optimistic dispatchers roll back; danger toast "Couldn't move "Order tonic…". It's back in In progress." [Try again].
- **Stale or missing task**: in-sheet message "This task was deleted or moved to another project." [Close]. No auto-close.
- **Read-only** (`createOrEditTasks` false; the server still re-authorises every action): "View only" badge by the h1 with tooltip "You can see this project but not change it. Ask an owner for edit access." Hidden: New task, FAB, composers, Add column, column menus, drag affordances, selection, bulk. Glyphs are icons. Property rows are text. Comments follow the conversation feed's own permission. Share, print and export remain.
- **Unverified project**: existing `TasksArrivalRefusal` with disabled view tabs.
- **Over a work limit**: "4 / 3" in warning-text with a warning-stroke underline; tooltip "Over the limit of 3". Informative, never blocking.
- **Overflow**: titles clamp (3 lines card, 1 line list row) with full text in `title` and the accessible name; labels 2 + "+n"; assignees 2 faces on cards, 3 in the header, then "+N" naming the rest; 50+ cards per column use `content-visibility: auto`; 9+ columns scroll with an edge fade (the Status filter doubles as a jump); calendar days show 3 then "+4 more"; project names over 60 characters truncate with a `title`.
- **Offline / reconnecting**: existing SSE reconciliation; a quiet "Reconnecting…" pill in the toolbar; edits queue as today.

---

## 8. Motion

All durations on `--v3-ease`. Only `transform` and `opacity` animate.

| Moment | Motion | Reduced motion |
|---|---|---|
| Complete | tick draws 180ms, glyph fills; card flight to Done (existing) or fade + collapse 200ms | instant fill, 120ms opacity |
| New card | rise 8px + fade 120ms, accent-soft wash fades over 1.2s | wash only, no rise |
| Drag lift | scale 1.02, shadow-pop, ≤1° tilt, 120ms | no scale, no tilt; shadow only |
| Siblings during drag | FLIP slide 160ms | instant |
| Drop settle | ghost to slot 180ms | instant |
| Sheet open | 16px slide + fade 200ms; docked sheet width 200ms | opacity 120ms |
| Composer / popovers | scale 0.98→1 from trigger corner + fade 140ms | opacity 100ms |
| Toast / bulk bar | 8px rise + fade 160ms | opacity 100ms |
| Column pager scroll | smooth | instant |
| Skeleton | shimmer 1.2s | static |
| Count change | 120ms crossfade of the number | none |

Delight verdict: the drawn tick and the lift are the two deliberate moments. Nothing else bounces.

---

## 9. Accessibility

- Text meets WCAG AA in light and dark; non-text UI (rings, glyph strokes, control borders, drop bars) meets 3:1 using `--v3-control-border`, `--v3-border-strong` and the tone tokens. Status is never colour alone: each glyph has a distinct shape and each card has an accessible status in its name.
- Targets are 44px (`min-h-[44px]` or module px values; never `min-h-11`). The card glyph is a 24px visual inside a 44px hit area.
- Board: one roving tab stop; arrows move within; carry announced through the polite live region. List: a `grid` with row and column headers and `aria-sort`. Calendar: a `grid` of days with `aria-selected` and labelled cells ("Thu 16 July, 1 task").
- Sheet: labelled by the task title; modal below 1280px (trap, Esc, focus return), complementary region when docked (F6, Esc, focus return). Escape yields to inner layers first.
- Facts and view switch: `aria-pressed` and `aria-current`. Menus: Radix semantics. Tooltips supplement, never carry, meaning.
- `prefers-reduced-motion` honoured throughout (section 8). The global `:focus-visible` ring is used as-is, not overridden.

---

## 10. Copy

Plain, active, sentence case, no exclamation marks, no uppercase tracked labels, no monospace labels. Never "workspace" in text or aria (the noun is "project"). No "WIP", "backlog", "sprint" (first-contact gate).

| Place | Copy |
|---|---|
| h1 | Tasks |
| Progress | 5 of 13 done · All 13 done |
| Facts | 1 overdue · 1 due today · 5 need a date (tooltip: "Show only overdue tasks. Press again to show everything.") |
| Search | Find a task |
| Primary | New task |
| Inline add | Add a task |
| Column notes | To do: Agreed and ready to start · In progress: In motion right now · Review: Being checked before it's finished · Waiting: Held by a reply or a delivery · Done: Finished work |
| First-run hint | Drag a card to the right as work moves along. Press ? for shortcuts. |
| First-run input | What needs doing first? |
| Work limit | Work limit · 4 / 3 · Over the limit of 3 |
| Delete column | Delete "Waiting"? Its 2 tasks move to To do. |
| Delete tasks | Delete 3 tasks? This can't be undone. |
| Toasts | Added to To do · Marked done · Moved to Review · Undo · Open |
| Failure | Couldn't move "Order tonic…". It's back in In progress. |
| Error page | Tasks didn't load. Your work is safe. |
| Stale task | This task was deleted or moved to another project. |
| Read-only | View only · You can see this project but not change it. Ask an owner for edit access. |
| Sheet sections | Description · Subtasks · Files and links · Activity |
| Composer | Write a comment… · Add a description |

---

## 11. Data needs

No new server reads, no schema change, no new dependency. Everything binds to:

- Store: `useLabStore()`, `useVisibleLabTasks()`, `useBoardColumns()`, `useCalendarFrame()`, `useRoomTools()`, `usePersonalization()`, `useRoomBrief()`, `useTasksDispatch()`; dispatchers `addTask`, `moveStatus`, `toggleComplete`, `toggleSelected`, `updatePriority`, `updateAssignees`, `scheduleTask`, `scheduleOn`, `unscheduleTask`, `moveScheduleByDays`, `bulkStatus`, `bulkComplete`, `bulkDelete`, `deleteTask`, `duplicateTask`, `archiveTask`.
- LabTask fields, `Task.comments`, `subtaskCount`, `subtaskDone`, `blockedByIds`.
- `useWorkspaceMembers()`, `useTagDefs()`, `useColumnConfig()`, `floorProjectName` / `useDomain`.
- Server actions in `@/server/actions/board.ts` (column management) and `tasks.ts` through the store.
- Prefs: `view-prefs.ts` (`useFitColumns`, `useShowStatusDescriptions`, `useCollapsedLanes`), localStorage for the first-run hint and saved views (try/catch).
- Review mode (`access-mode.ts`) never touches the database; the dense fixture (`fixtures-dataset` "dense") is used for overflow and multi-assignee screenshots.

---

## 12. What gets deleted

**Schedule, entirely:**
- `src/components/hybrid/options/a/timeline-view.tsx`, `options/b/schedule-tray.tsx`.
- `"timeline"` from `LAB_VIEWS` and `VIEW_LABELS` (`hybrid/types.ts`), `TasksViewId` and `TASKS_VIEW_PATHS` (`src/lib/product-urls.ts`; the Timeline product path `/app/timeline` is untouched).
- The "Schedule" tab entry in `src/components/app/page-header.tsx` and its mapping in `page-header-context.ts`; palette entries; `app-return.ts` allow-list rows (keep accepting the old path as input since it now redirects).
- `src/app/app/tasks/timeline/page.tsx` becomes `redirect()` to `/app/tasks` preserving `workspaceId` and `task`. `src/app/print/timeline` redirects to `/print/board`.
- Share: `ShareView` and `share-link-resolver` keep accepting `"timeline"` so minted links still resolve; rendering maps it to Board. New links never mint it (remove it from the Share UI).
- Tests and scripts that reference the view: `product-urls.test.ts`, `floor-view-href(.test).ts`, `project-url.test.ts`, `page-header-context.test.ts`, `suite-navigation-contract.test.mjs`, `route-authz-contract.test.mjs` (drop only the route row; keep its intent), `experience/registry.json`, `experience/critical-fixtures.json`, `experience/feature-tests/utility-navigation.spec.ts`, `experience/recipient-project-work/route-browser.mjs`, `scripts/check-route-manifest.mjs`, `scripts/design/{reference-shots,verify-tasks}.mjs`. Each is updated to assert the redirect and the absence of the tab.

**Floor and option UI (after porting):**
- `src/components/floor/**` (`use-floor-flight.ts`, `use-floor-place.ts`, `use-floor-undo.ts` move to `src/components/tasks/` with their logic intact).
- `src/components/hybrid/options/**` (a, b, c, hybrid) after column management and list/calendar logic are ported.
- `hybrid/shared/{lab-chrome,shortcuts-dialog,bulk-toolbar,task-ui,field-menu,task-context-menu}.tsx` and `shared.module.css` once nothing imports them; `hybrid/view-tools.tsx` if replaced by FilterMenu/DisplayMenu.
- `scripts/design/extract-floor-css.mjs`, its test, `scripts/design/floor-prod-check.mjs`; remove the `--check` step from the `test:floor-theme` and `test:recipient-golden` scripts in `package.json` (scripts only; no dependency changes).

**Kept:** `hybrid/store.tsx`, `hybrid-store.tsx`, `adapter.ts`, `dates.ts`, `planning.ts`, `fixtures*`, `columns-context.tsx`, `view-prefs.ts`, `selected-task-route.ts` and all their tests. (`option-contract.ts` went with the options folder once nothing imported it.)

**Browser tests rewritten to intent, not markup:** `test:reorder-pointer` (move persists, order persists, undo round-trips, keyboard carry works), `test:floor-calendar` (date by drag, clear by drag to tray), recipient route-browser capture. `data-board`, `data-lane`, `data-id`, `data-floor-head` stay. No authorization, tenant-scope or privacy test is weakened.

---

## 13. Boundary items for the coordinator

1. **`src/components/app/task-detail/**`** (`task-detail.tsx`, `metadata-rail.tsx`, `existing-task-history.tsx`) is the detail body today and only Tasks uses it. Recommendation: add it to the Tasks stream. Fallback: TaskSheet in `detail-panel/` composes those files read-only, and `task-detail.tsx` stays the full-page body.
2. **Schedule removal touches shared files** (`product-urls.ts`, `page-header.tsx`, `page-header-context.ts`, `app-return.ts`, `experience/**`, `scripts/**`, share types). Tasks edits are limited to removing the tasks-timeline view; the Timeline and Launcher streams' entries are untouched.
3. **`AvatarStack`** is owned by the Messages stream and consumed read-only.

---

## 14. Acceptance checklist

Experience and design
- [ ] At 1440×900 light and dark, Board, List, Calendar, sheet (docked and modal), composer, bulk bar, first run, filtered-empty and read-only are screenshotted from the real source and read as the same product as Home, My tasks and Files.
- [ ] Status glyphs are identical in shape and tone to My tasks.
- [ ] No uppercase tracked labels, no monospace labels, no "workspace", no exclamation marks; `vocabulary.test.ts` and `node scripts/check-first-contact-language.mjs` pass.
- [ ] Every colour is a `--v3-*` token; contrast AA for text and 3:1 for UI in both themes.

Function (parity)
- [ ] Create (composer, inline, calendar day, `?create=task`), inline rename, sheet edits for every field, repeats, amount, contact, milestone.
- [ ] Drag between columns and reorder within, on mouse and touch; keyboard carry with announcements and Esc restore.
- [ ] Search, Filter facets, facts, chips, saved views, Clear filters; counts show "n of m" when filtered.
- [ ] Bulk move, assign, due, priority, done, delete.
- [ ] Column add, rename, note, colour, limit, counts as done, move, delete (tasks reassigned as the confirm says), tested with the default "Waiting" and a custom column.
- [ ] Comments, subtasks, files and links (Drive uploads), share, print, export, subscribe.
- [ ] Undo for done, move and add by toast and ⌘/Ctrl+Z.
- [ ] Sheet ↑/↓ follows visible order; `?task` survives view switches; `/app/task/[id]` renders the same sections.

Schedule
- [ ] No Schedule tab anywhere; `/app/tasks/timeline?workspaceId=…&task=…` redirects to `/app/tasks` with both params; `/print/timeline` redirects; an existing "timeline" share link renders the board.

Mobile and tablet
- [ ] At 390×844: snapped board columns with peek and synced pager, FAB clear of the safe area, list two-line rows, calendar Agenda with no month flash, full-screen sheet; no horizontal page scroll except the board track; every target ≥44px.
- [ ] At 768×1024: 2.5 columns, calendar drawer, modal sheet.

Quality
- [ ] Drag of a card in a 100-card column holds 60fps in a performance trace with no layout reads per pointermove.
- [ ] Reduced motion removes transforms per section 8.
- [ ] Read-only mode hides every write affordance; server actions unchanged.
- [ ] `pnpm typecheck` clean for stream files, stream unit tests pass (incl. `surface-keys.test.ts`, glyph mapping, visible-order navigation), rewritten browser tests pass, no framework overlay or unexplained console errors on any Tasks route.
