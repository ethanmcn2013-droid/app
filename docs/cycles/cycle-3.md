# Cycle 3 · Shared task store — make the app real

**Status:** in_progress · 2026-05-05

## Problem

Today every app route owns a local copy of `SEED_TASKS` and mutates
its own. Drag a card from "To do" to "In progress" on the board, then
visit list — it's still in "To do." The four views are four separate
apps that happen to share a sidebar. Every interaction we add (detail
panels, inline edits, add-task flows, command palette) will be
crippled by this unless we fix it first. This is the foundational
move that turns the project from "designed views" into "an app."

## Solution shape

Introduce a single `TasksProvider` (Context + `useReducer`, no new
dependency) that owns the `tasks` array and exposes typed action
dispatchers: `moveTask(id, lane)`, `reorderTask(id, fromIdx, toIdx)`,
`updateTask(id, patch)`, `addTask(input)`, `removeTask(id)`. Mount
the provider at `/app/layout.tsx` so all four routes read the same
state. Each view subscribes via a `useTasks()` hook. The board's
existing drag handler becomes a single `moveTask` dispatch instead
of local setState. List and timeline gain checkbox click → mark done
and (timeline) drag-to-move-startday. Calendar reads only. The seed
remains the initialState so first paint is identical to today.

## Success criteria

- Move a card on `/app/board`, switch to `/app/list` — the card is
  in its new section. Same for timeline / calendar.
- Mark a task done on list, switch to board — it's in the Done lane.
- Sidebar's "Inbox" badge (if present, otherwise add) reflects open
  task count from the shared store.
- Reload the page — state resets to seed (no persistence yet; that's
  a future cycle).
- 0 TS errors, 0 console errors, no "useState in two places" pattern
  for tasks anywhere in `src/app/app/` after the cycle.
- `prefers-reduced-motion` honored (carries forward).

## Out of scope

- Persistence (localStorage / IndexedDB / backend) — explicit cycle 4 candidate.
- Task detail panel / modal — cycle 4 or 5.
- Real-time multi-user sync — much later.
- Cinematic demo: it owns its own state machine and stays
  independent. The shared store is for `/app/*` only.
- Inbox / Search / My tasks routes — still placeholders.

## Architect notes

**New files** (`src/lib/tasks/`)
- `tasks-reducer.ts` — pure types + reducer + `initialTasksState(seed)`. No React.
- `tasks-context.tsx` (`"use client"`) — `TasksStateContext`, `TasksDispatchContext`, `TasksProvider`, hooks `useTasksState()` / `useTasksDispatch()` / `useTasks()`. Two contexts so dispatch-only consumers don't re-render on state change.
- `selectors.ts` — pure: `groupByLane(state)`, `openTaskCount(state)`, `tasksSortedByStartDay(state)`.

**Action set** — `move | reorder | update | add | remove | toggleComplete`. `toggleComplete` uses an in-state `previousLane: Record<id, LaneId>` so un-checking a done task restores its prior lane (Linear/Notion behavior). Cleared when task is moved/removed by other paths.

**ID strategy** — module-scoped `let nextId = 500;` counter in `tasks-context.tsx` (seed ids are 100s-400s). Deterministic per session, no dependency added. Cycle 4 swap to crypto.randomUUID when persistence comes.

**Boundary rule** — store owns task DATA; components own INTERACTION state (dragging, hover). Putting `draggingId`/`hoverLane` in the store would re-render every view on every dragover.

**Mount** — `/app/layout.tsx` stays a server component; imports `<TasksProvider>` (client) and wraps children. Cinematic demo on `/` is untouched (different tree, different state machine).

**Type guards** — TS at compile-time only this cycle. Runtime guards arrive with persistence in cycle 4.

**Build order** (each step leaves repo runnable):
1. tasks-reducer.ts (pure, no consumers yet)
2. selectors.ts
3. tasks-context.tsx
4. /app/layout.tsx — mount provider (dormant, views still use local state)
5. board-app.tsx — first consumer, drag handler dispatches `moveTask`
6. list-app.tsx — wire checkbox → `toggleComplete`; this validates cross-view propagation
7. timeline-app.tsx — read-only consumer
8. calendar-app.tsx — read-only consumer
9. sidebar.tsx — add open-task count badge using `openTaskCount` selector

**Test script** — drag card on board → navigate to list → confirm new lane → check checkbox → navigate to board → confirm Done lane → reload → state resets to seed.

**Rollback** — revert each consumer to local `useState` (one-line per file) + drop the `<TasksProvider>` wrapper. The new lib files become dead, no runtime impact.

## Design notes

Skipped — backend / state cycle, no UI direction needed. Visual surface unchanged.

## Design notes

(skipped — backend/state cycle, no UI direction needed)
