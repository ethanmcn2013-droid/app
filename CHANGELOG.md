# Changelog

All notable changes to the Tasks product are recorded here. Each entry
corresponds to one autonomous PM/Architect cycle.

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
