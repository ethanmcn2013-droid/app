# Changelog

All notable changes to the Tasks product are recorded here. Each entry
corresponds to one autonomous PM/Architect cycle.

## Cycle 9 · 2026-05-05 · Activity log — turn updatedAt into a story

The detail panel's Activity section rendered three hardcoded
placeholder lines. Cycle 8's "edited 3h ago" stamp was a single
integer. This cycle turns every server-side mutation into a typed,
persisted activity row, and the panel renders them as a real feed.

**Backend changes**
- New `activities` table — id PK, taskId FK cascade, userId FK,
  kind text, payload JSON, createdAt timestamp. `_SchemaCoversActivity`
  guard.
- `Activity` type with discriminated `ActivityPayload` union over
  `kind`: `taskAdd | move | toggleComplete | update | commentAdd
  | commentRemove`. Each payload variant carries the data needed
  for line rendering (e.g. `move` has `from` + `to`; `commentAdd`
  has a 60-char `snippet` so deleted comments still surface).
- New `recordActivity(taskId, payload)` helper at
  `src/server/db/activity.ts` — server-only utility (NOT a
  `"use server"` action). Catches and console.warns on failure;
  activity is observability, not transactional.
- `getActivitiesForTask(taskId)` query — desc by createdAt,
  limit 50.
- `getActivitiesForTaskAction` server-action wrapper for
  client-driven reads.
- Wired emissions into every mutation point:
  - `addTaskAction` → `taskAdd` with default lane
  - `moveTaskAction` → pre-reads prior lane, emits `move {from,to}`
  - `toggleCompleteAction` → emits `toggleComplete {to: done|open}`
  - `updateTaskAction` → emits ONE `update` PER tracked field
    changed (concurrent via Promise.all). Untracked fields like
    `idleDays` skipped.
  - `removeTaskAction` → no activity (cascade kills them anyway)
  - `addCommentAction` → emits `commentAdd` with snippet
  - `removeCommentAction` → emits `commentRemove`

**Frontend changes**
- New `src/lib/tasks/use-task-activities.ts` — read-only hook
  mirroring `useTaskComments` (no client mutation; activities
  are byproducts).
- New `src/components/app/detail-panel/activity-feed.tsx`:
  - 16px avatar (smaller than 22px comments — size IS the signal
    of "supporting content"; ~85% scale)
  - Single-line rows: actor name (`font-medium text-ink`) +
    sentence (`text-ink-soft`) + relative time (`tabular-nums
    text-ink-quiet`)
  - `formatActivityLine(payload)` switch with opinionated
    microcopy: "moved this from To do to In progress",
    "marked this complete", "edited the description",
    "commented", etc.
  - Empty state: single line "No activity yet."
- `task-detail-panel.tsx` now fetches activities alongside
  comments, both keyed on `[task?.id, task?.updatedAt?.getTime()]`
  so any mutation refreshes the feed automatically.
- Static `ActivityPlaceholder` removed; `ActivitySkeleton`
  introduced for loading state (2 rows, 16px circle + single
  pill bar — quieter than the 2-line comment skeleton).

**Verified end-to-end**
- Edited description on `t-202`, queried DB:
  `update | {"kind":"update","field":"description"}` row landed
  with current timestamp. Description value persisted to column.
  0 console errors. Type-clean.

**Backlog**
- Activity for assignee changes / tag changes currently renders
  as generic "updated assignees" / "updated tags" because we
  don't diff arrays this cycle. Specific copy ("assigned Chloe",
  "tagged design") needs payload extension (before/after) — later.
- "Show more" pagination for tasks with >50 activities.
- Cross-task feed (e.g. "what changed today") — useful when more
  than one user exists.



## Cycle 8 · 2026-05-05 · Editable description + last-edited stamp

The detail panel rendered an outdated "placeholder paragraph" in
its Description section (referencing cycle 6 plans that already
shipped). Cycle 7 added the column; cycle 8 makes it real, and
audits `updatedAt` so the panel can carry an "edited X ago" stamp
that reflects every kind of activity (lane moves, comments, field
edits).

**Backend changes**
- `bump()` audit: `addTaskAction` now sets `updatedAt` explicitly
  for symmetry; column default still safe-net.
- `addCommentAction` and `removeCommentAction` now touch the parent
  `tasks.updatedAt` via a new `touchTask(taskId)` helper. Comments
  count as engagement.
- `Task.updatedAt: Date` (non-nullable). `rowToTask` surfaces it.
- `SEED_TASKS` literals refactored into `_seedTaskInputs:
  Omit<Task, "updatedAt">[]` then mapped with staggered timestamps
  (`Date.now() - i * 3_600_000`) so the seed renders as a realistic
  "edited Nh ago" gradient on first boot.
- Reducer `update`, `move`, `toggleComplete` cases now bump
  `updatedAt` optimistically so the stamp doesn't lag the UI.

**Frontend changes**
- New `src/components/app/detail-panel/description-editor.tsx`:
  - At-rest: `<p>` with `whitespace-pre-wrap`, 13.5px/1.6
    `text-ink-soft`, NO outline (multi-line + outline = form
    field carnival, against the panel's "document not form" tone).
  - Editing: bare `<textarea>` (no frame), same size/leading as
    at-rest so the swap is sub-pixel. Autoresize via scrollHeight.
    Multi-line is the mode — Enter inserts newline; commit only
    happens on blur or Esc-revert.
  - Empty state: `"Add a description."` (sentence case + period —
    finished sentence, not button label) in `text-ink-faint`.
    Full-section click target. Cursor `text` (I-beam).
  - Hover: `text-ink-soft → text-ink` over 120ms — color promotion
    is the affordance, no glyph, no border.
  - Caret behaviors: click → at click position, keyboard entry →
    end of existing text (the "oh, one more thing" 80% case),
    empty prompt → position 0.
- `panel-header.tsx` — new `<EditedStamp>` rendered beside the
  `T-101` chip in the meta row, separated by a middle dot.
  `text-[10.5px] tabular-nums text-ink-quiet`. Format
  `"edited 3h ago"` (lowercase verb prefix; "3h ago" alone is
  ambiguous). Hidden if mutation < 5s ago. **Mounted-state pattern**
  to avoid SSR hydration mismatch between server and client clocks.
- Old static `<Description />` stub removed.

**Looped back to BUILD once**
- First TEST surfaced a hydration mismatch: server-rendered
  `formatRelativeTime` and `toLocaleString` produced different
  output than the client (clock skew + locale defaults). Fix:
  `EditedStamp` defers all rendering until `useEffect` flips
  `mounted = true` so server emits nothing, client hydrates to
  the actual stamp.

**Verified end-to-end**
- Opened `?task=t-202`, clicked "Add a description.", typed
  "Final cut review with director on Mon. Embed link.", tabbed
  away. DB row's `description` column reflects the typed value.
  0 console errors after the hydration fix.



## Cycle 7 · 2026-05-05 · Add-task flow + description column

Every "+ Add task" / "+ New task" button literally did nothing.
Until the user can create their own tasks, the app is a fancy
viewer of seeds. This cycle ships two complementary creation
surfaces and lays the description column groundwork for cycle 8.

**Backend changes**
- `tasks.description: text` column (nullable). `drizzle-kit push`
  ALTER TABLE non-destructive on existing rows.
- `Task.description?: string` and `rowToTask` mapper coerces NULL
  to undefined.
- `addTaskAction` accepts and persists `description`.
- `_SchemaCoversTask` guard catches type-vs-schema drift.

**Frontend changes**
- `src/components/primitives/dialog.tsx` — reusable dialog
  primitive. Portal'd to body, Esc/click-outside close, focus
  first input + restore prior focus on close, role/aria-modal/
  labelledby. Centered, scale 0.96 → 1 + Y 6 → 0 over 260ms
  ease-out-expo. Reduced-motion: opacity-only 120ms.
- `src/lib/use-keyboard-shortcut.ts` — generic shortcut hook,
  skips when target is editable, when modifiers are held, or
  when explicitly disabled.
- `src/components/app/add-task/`:
  - `add-task-context.tsx` — `<AddTaskRoot>` provider exposing
    `{open, openDialog, closeDialog}`. Mounts the dialog. Binds
    `c` shortcut globally (preventDefault on keydown so the
    keystroke doesn't bleed into the about-to-mount input).
    `openDialog` first calls `closeTask()` so dialog and detail
    panel never stack.
  - `quick-create-dialog.tsx` — 480px centered modal. 17px input
    "Name a task", default "To do" lane chip, `⏎ Create` kbd
    hint. Empty Enter is silent no-op (kbd hint dims `ready` →
    `empty`). On submit: dispatches `addTask`, clears, closes.
  - `inline-composer.tsx` — bare input on lane background (no
    card affordance — reserved for *real* tasks). 220ms ease-
    out-expo height-from-zero entry. Placeholder "What's next?".
    Enter creates and refocuses; Esc cancels; blur with empty
    cancels.
- `BoardApp` tracks at-most-one-open via `composerLane: LaneId | null`.
- `AppPageHeader` "New task" button gains a `C` kbd badge and
  fires `openDialog`.
- `/app/layout.tsx` mounts `<AddTaskRoot>` inside `<TasksProvider>`
  under the existing Suspense boundary.

**Caught during TEST (looped back to BUILD)**
- Initial implementation exposed an `onDraftChange` callback to
  preserve per-lane drafts across re-opens; the unmemoized callback
  identity caused a setState/useEffect infinite loop. Fix: dropped
  the draft-preservation feature for this cycle (logged to
  backlog). Quality gate held — re-tested with 0 console errors.

**Verified end-to-end**
- "+ New task" header button → dialog opens → typed "Created
  from cycle 7 dialog" → Enter → card visible in To do lane →
  DB row persisted (`t-8b065801`).
- Lane "+ Add task" → input focused → typed "Created from
  inline composer" → Enter → card visible → DB row persisted.
- 0 TS errors, 0 console errors.

**Backlog**
- Per-lane draft preservation across re-opens (lost in the
  infinite-loop fix; needs a stable callback pattern via ref).
- Lane / priority pickers in the dialog beyond defaults.
- Title auto-parser (`#tag`, `@user`, `p1`, `due:friday`).



## Cycle 6 · 2026-05-05 · Real comments — first full-stack feature

The detail panel rendered a static deterministic-from-id seed thread
that looked live but wasn't. This cycle replaces it with a real
thread that persists, optimistically renders, and posts via a server
action — the first full-stack feature on the new persistence
substrate. Sets the pattern every "thing that happens on a task"
(activity, mentions, attachments) will follow.

**Backend changes**
- New `Comment` type and `CURRENT_USER` constant in `src/lib/data.ts`.
  `SEED_COMMENT_BODIES` lifted from the static thread file so server
  seed and any future fixtures share one source.
- Schema gains `_SchemaCoversComment` compile-time guard mirroring
  the existing `_SchemaCoversTask` check.
- `getCommentsForTask(taskId)` query in `src/server/db/queries.ts`
  with `rowToComment` pass-through mapper.
- Seed extends to insert ~3 comments per task using deterministic
  hash → user/body picks; `createdAt` staggered so the order reads
  as a real conversation. Independent count check so existing
  comments don't get clobbered.
- New `src/server/actions/comments.ts` —
  `getCommentsForTaskAction`, `addCommentAction`, `removeCommentAction`.
  Each returns the full reconciled `Comment[]` for the task.
  `revalidatePath('/app', 'layout')` after writes.

**Frontend changes**
- New `src/lib/tasks/use-task-comments.ts` — optimistic +
  reconcile hook with `useTransition`. Optimistic comments use
  `temp-<uuid>` ids so removes that haven't reached the server are
  pure local-only.
- New `formatRelativeTime` util — `just now` / `3m` / `2h` /
  `yesterday` / `May 2` / dated. `tabular-nums` so digits don't
  dance.
- `comment-thread.tsx` rewritten:
  - Bare `<textarea>` composer (no frame, no rounded-input shape)
    with autoresize, Enter-to-post (Shift+Enter newline),
    `⏎` kbd hint that becomes a brand-color spinner while pending.
  - Each row reveals a hover-only X for own comments;
    optimistic delete with revert on failure.
  - Empty state: pure type, two lines.
- `task-detail-panel.tsx` fetches comments per task via a
  client-side `useEffect` calling the server action with a
  stale-fetch guard. Shows a 2-row static skeleton during fetch.

**Verified end-to-end**
- Posted "Verified end-to-end from the loop test" via the
  composer; comment renders immediately (optimistic), then
  reconciles with server-truth; row visible in DB query.
- Existing seed shows real authors with relative timestamps.

**Backlog**
- Concurrent multi-user comment updates — current impl re-syncs
  only on panel re-open. SSE / polling channel later cycle.
- Toast UX for server-action failures (still console-warn).
- Comment editing — explicit out-of-scope.



## Cycle 5 · 2026-05-05 · DB foundation — persistence appears

First cycle under the new full-stack directive. Every mutation
previously lived in memory; reload reset state. This is the
foundation that lets every subsequent feature actually persist.

**Backend changes**
- New deps: `drizzle-orm`, `better-sqlite3`, `drizzle-kit` (dev),
  `@types/better-sqlite3`, `tsx`.
- `drizzle.config.ts` at repo root; SQLite dialect, schema at
  `src/server/db/schema.ts`.
- Schema: `tasks`, `users`, `comments` tables. JSON columns
  (`mode: 'json'`) for `assignees`, `tags`, `blockedBy`. `text` with
  TS `$type<>` narrowing for `lane`/`priority`. Comments table has
  FK cascade on task delete; empty this cycle (table-only).
- `src/server/db/index.ts` — singleton via `globalThis._sqlite` so
  HMR doesn't spawn duplicate handles. WAL journal mode.
  `import "server-only"` enforces server boundary.
- `src/server/db/seed.ts` — idempotent transaction-wrapped seed
  from `SEED_TASKS` + `USERS`. Auto-runs on first DB-touching
  request; re-runnable via `npm run db:seed`.
- `src/server/db/queries.ts` — `getTasks()`, `getTaskById()` with a
  `rowToTask` mapper that NULL→undefined coerces (the client `Task`
  type uses optional, not nullable).
- `src/server/actions/tasks.ts` — `moveTaskAction`,
  `toggleCompleteAction`, `updateTaskAction`, `addTaskAction`,
  `removeTaskAction`. Each returns the full `Task[]` for one
  round-trip reconciliation. `revalidatePath('/app', 'layout')`
  after every mutation.
- New scripts: `db:push`, `db:check`, `db:seed`. `dev` chains
  `drizzle-kit push --force && next dev` for zero-touch cold-start.
- `tasks.db*` files added to `.gitignore`.

**Frontend changes**
- `src/lib/tasks/tasks-reducer.ts` — added `hydrate` action so the
  client can replace its task list with the server's authoritative
  result after a mutation.
- `src/lib/tasks/tasks-context.tsx` — dispatchers now do optimistic
  + reconcile via `withServerSync()`: dispatch local action for
  snappy UI, fire server action in `startTransition`, hydrate on
  success, revert via `hydrate(prior)` on failure. Console-warn on
  revert (toast UX arrives with the toast primitive).
- `src/app/app/layout.tsx` — now `async`, `await getTasks()`,
  passes server-fetched tasks to `<TasksProvider initialTasks={...}>`.
  `export const dynamic = 'force-dynamic'` so build doesn't try to
  prerender against an empty DB.
- ID generation moved from a module counter to `crypto.randomUUID()`
  per cycle 3 backlog item.

**Verified end-to-end**
- Toggle "Audit pricing" complete on `/app/list` → DB row is
  `lane='done'` → reload `/app/board` → card renders under Done.

**Backlog**
- `toggleCompleteAction` always sends to "todo" when un-checking
  (no server-side previousLane). Client reducer still has the map
  so optimistic UI behaves correctly; server hydrate creates
  micro-jitter only when un-toggling a task that wasn't originally
  in todo. Reunify in cycle 6.
- Two-tab staleness — server `revalidatePath` doesn't notify other
  tabs. SSE / polling channel later.
- Drizzle migrations workflow (currently `db:push` only).
- Toast UI for server-action failures (currently console-warn).



## Cycle 4 · 2026-05-05 · Task detail panel

Cards on every app view were read-only billboards. Click did nothing.
Until clicking a card opened *something*, every future feature
(comments, AI nudges, dependencies) had nowhere to live. This cycle
turns cards into hyperlinks.

**Added**
- `src/lib/tasks/use-task-panel.ts` — URL-driven open/close hook.
  `?task=<id>` opens the panel; absence closes. Uses native History
  API so browser-back closes for free.
- `src/components/app/detail-panel/` — slide-in panel with field
  editors:
  - `panel-shell.tsx` — overlay + slide animation + ⎋ handler.
    Spring-physics rejected per design rec; 480ms ease-out-expo
    feels working-surface, not toy.
  - `panel-header.tsx` — clickable monospace task ID with
    copy-on-click ("T-101 → copied" 1.1s flash); title input
    (blur to commit, Enter commits, Esc reverts).
  - `field-rows.tsx` — Status (segmented row, always visible
    because most-changed), Priority (popover), Assignees (avatar
    stack with "+" → user picker popover), Due (text input),
    Tags display.
  - `popover.tsx` — primitive with click-outside + ⎋ to dismiss.
  - `comment-thread.tsx` — deterministic seed thread per task
    (hash of id picks user/body/time consistently across opens).
- All four app views wire `onClick` on their card primitives.
  Selected card gets a `var(--brand)` outline at -1 offset; no
  desaturation of others.

**Changed**
- `/app/layout.tsx` mounts `<TaskDetailPanel>` under `<Suspense>`
  per Next 16 `useSearchParams` SSR rules. Panel survives view
  switches (lives in layout, not page).
- List checkbox now `e.stopPropagation()`s so it doesn't open the
  panel while toggling complete.
- Calendar pills became `<button>`s with `min-h-[28px]` for
  touch-friendly hit area.

**Notes**
- This is the last frontend-only cycle under the prior directive.
  Subsequent cycles ship full-stack per the new directive.
- Backlog: stale-id state currently shows briefly before auto-
  closing — UX is acceptable but could improve in cycle 6.



## Cycle 3 · 2026-05-05 · Shared task store — make the app real

Until this cycle, every app route owned its own copy of `SEED_TASKS`
and mutated locally. Drag a card on board, switch to list — still in
its old lane. Four views, four apps. This was the foundational move
that turns "designed views" into "an app."

**Added**
- New `src/lib/tasks/` directory with three pure-ish modules:
  - `tasks-reducer.ts` — pure reducer + types. Actions: `move`,
    `reorder`, `update`, `add`, `remove`, `toggleComplete`. The
    `toggleComplete` action keeps a `previousLane` map so unchecking
    a done task returns it to the lane it came from (Linear-style),
    not always to "todo."
  - `tasks-context.tsx` — client `TasksProvider` mounted in
    `/app/layout.tsx`. Two contexts (state + dispatch) so dispatch-
    only consumers don't re-render on state changes.
  - `selectors.ts` — `groupByLane`, `tasksByLane`, `openTaskCount`,
    `tasksSortedByStartDay`. Pure functions, no React.
- Sidebar now shows an open-task count badge next to Inbox / My
  tasks, computed from the shared store.

**Changed**
- All four app views (`board`, `list`, `timeline`, `calendar`)
  rewired to consume the store. Local `useState<Task[]>` + direct
  `SEED_TASKS` imports replaced.
- Board's drag-to-lane handler now dispatches `moveTask`. Drag UI
  state (`draggingId`, `hoverLane`) stays local — they're per-gesture
  ephemera, not data.
- List checkbox is now interactive: clicking dispatches
  `toggleComplete`; the row's title gets a strikethrough and the row
  reorders into the Done section. `aria-pressed` reflects state.

**Boundary held**
- The cinematic showcase demo on `/` keeps its own state machine
  and is unaffected. The `TasksProvider` is mounted only at
  `/app/layout.tsx`.

**Verified end-to-end** — toggle a task on `/app/list`, navigate via
sidebar to `/app/board` — task appears in Done lane, counts update
across the sidebar.

**Backlog merged into this cycle's followups (low-priority)**
- Swap module-counter id generation for `crypto.randomUUID()` when
  cycle 4 introduces persistence.
- Memoize Card components when task count grows beyond ~50.



## Cycle 2 · 2026-05-05 · Restraint — pacing + cursor labels

Two related defects in tone. Scene-to-scene transitions held for only
~700ms — every second was equally loud. And cursor name pills rode
each cursor permanently, drowning the cards with three constant
labels. The demo read chat-app-y when the brand demands concert-hall.

**Changed**
- Scene runner now inserts a `sceneSettle()` beat (~1600ms; 2000ms
  after the dependency reveal) between every pair of scenes. During
  settle, cursors gently drift toward random nearby points every
  ~700ms so the demo reads alive without firing scripted action.
  Burndown, activity feed, and last-state visuals hold.
- Cursor name labels are now signal, not skin. They appear only when
  a cursor is grabbing, reading a card, or in its 900ms post-arrival
  grace window. Otherwise the cursor is a quiet arrow.
- Per-cursor label fade-out is staggered (chloe 0ms · david 220ms ·
  alex 440ms) so the three labels don't pulse in unison — asynchrony
  reads as life.

**Priority shift**
- Per user direction at end of cycle 2: subsequent cycles focus on
  full app build (real interaction, primitives, depth in app routes)
  rather than further demo polish. Demo work moves to "improvement
  opportunistic" rather than the top of the heuristic.



## Cycle 1 · 2026-05-05 · View morph actually FLIPs

The cinematic showcase demo's view-morph scene previously crossfaded
via `AnimatePresence mode="wait"` — every card unmounted before the
next view mounted, so the shared `layoutId` had nothing to interpolate
between. Net effect: three abrupt fades instead of cards gliding from
column to row to gantt bar. The hero artifact's most ambitious moment
was unfulfilled.

**Changed**
- Replaced the `AnimatePresence mode="wait"` view swap with a unified
  `<DemoSurface>` (`src/components/showcase/demo-surface.tsx`) that
  keeps one set of motion cards mounted at all times. Switching `view`
  now changes the parent layout; motion's FLIP system tweens each card
  from its previous geometry to its new geometry over 720ms with
  ease-out-expo, all 16 cards in concert.
- Card body cross-fades in two stages with a 120ms hole between them,
  so the eye never sees both bodies at 50% (which would white-flash).
- Wrapper chrome (column backgrounds, list table header, gantt grid)
  trails the cards: faint at 15% throughout, rises 280ms starting at
  t=440ms — cards are protagonists, chrome is the room.
- Today indicator on entering timeline draws top-to-bottom over 320ms,
  then the pill snaps in via spring — a single brand-color punctuation.
- Added scene guards: carry no-ops outside board view; view-morph
  no-ops while a card is in flight.
- New `useMorphTransition` hook centralizes durations and respects
  `prefers-reduced-motion`.

**Fixed (during review pass)**
- Timeline geometry: replaced malformed
  `calc(% * (100% - 200px) / 100%)` with absolute positioning inside
  a 200px-gutter-aware track. Bars now land in the correct day cell.
- TodayMarker alignment: removed magic `0.985` fudge factor and
  duplicated 20px gutter; now computed against the same reference
  frame as the bars.
- Duplicated `data-lane` attributes (chrome + card-layer) collapsed
  to a single source on the card-layer column so `querySelector`
  returns the right element for the carry-scene celebration burst.

**Backlog** — see `docs/cycles/backlog.md` for deferred items
(TaskCard/MorphCard reunification, dead-code purge, useMemo on
transitions, stable ref callback).
