# Cycle 4 · Task detail panel

**Status:** in_progress · 2026-05-05

## Problem

Cards on every app view are read-only billboards. Click does nothing.
A real task workspace's most-used interaction is "open this task" —
fixing fields, leaving comments, checking history, setting
dependencies. Until clicking a card opens *something*, every other
feature we add (comments, AI nudges that link to a task, dependency
edges) has nowhere to live. This is the cycle that turns cards into
hyperlinks.

## Solution shape

URL-driven side panel. Clicking any card sets `?task=<id>` via
`router.replace` (no scroll jump, no full nav). A `TaskDetailPanel`
mounts when the search param is present, animating in from the right
(480px wide), dimming the canvas behind. Panel reads the task from
the shared store, exposes inline editing for title (blur to commit),
status, priority, assignees, due date. Status uses lane segmented
pills; priority uses pill row; assignees and due open mini popovers.
A "Comments" section renders a static seed thread for now (cycle 6
will make this real). Close: click overlay, hit ⎋, or click X →
clears the search param.

The panel mounts at the `/app/layout.tsx` level so navigating between
views with the panel open keeps it open (panel is owned by the layout
not the page). Browser back closes the panel for free.

## Success criteria

- Click any card on board / list / timeline / calendar → panel opens
  showing that task
- Title edit (click → focus → type → blur) dispatches `updateTask`
  and propagates everywhere
- Lane / priority change inside panel propagates to the underlying
  view (e.g., card moves between lanes on board)
- ⎋ closes; clicking overlay closes; X closes; URL clears `?task`
- Browser back from `?task=foo` closes the panel and stays on
  current view
- Deep-link works: load `/app/board?task=t-101` → panel pre-opened
- 0 TS errors, 0 console errors
- Reduced motion: panel transitions to instant
- Demo on `/` is untouched (boundary holds)

## Out of scope

- localStorage persistence (cycle 5)
- Real comment posting (cycle 6) — read-only seed thread is fine
- Dependency editing UI (cycle 7)
- Add-task flow (cycle 5)
- Task search inside panel
- Activity log / audit trail

## Architect notes

**New files**
- `src/lib/tasks/use-task-panel.ts` — `{ taskId, openTask, closeTask }`. Read via `useSearchParams`, write via `window.history.pushState` (open) / `replaceState` (close) so back-button closes for free. Native History API per Next 16 docs.
- `src/components/app/detail-panel/` — `task-detail-panel.tsx` (orchestrator), `panel-shell.tsx` (motion, focus trap, ⎋), `panel-header.tsx`, `field-rows.tsx`, `popover.tsx` (primitive), `comment-thread.tsx`.

**Routing pattern** — `useSearchParams` + native `history` API. Reject parallel-routes `@panel` slot — the panel is purely client (in-memory store), no server data, and parallel routes triple the moving pieces for zero benefit. Wrap `<TaskDetailPanel>` in `<Suspense fallback={null}>` per Next 16 `useSearchParams` SSR rules.

**Click wiring** — every card on board / list / timeline / calendar adds `onClick={() => openTask(task.id)}`. List checkbox needs `e.stopPropagation()` to not trigger panel. Drag-vs-click is browser-native (drag fires only on mousedown+move).

**Edit dispatch** — controlled `<input>` with onBlur commit. No debouncing — blur is the natural commit unit. Enter commits, Esc reverts.

**Field editors**
- Status: 4-pill segmented row (always visible — most-changed field)
- Priority: popover trigger (dot + label + numeric hotkey hint)
- Assignees: avatar stack with trailing "+" → popover with USERS list
- Due: simple `<input type="text">` for now; pretty parser is backlog

**Motion** — panel slide-in via spring `{stiffness: 380, damping: 38}` per design rec → ~280ms settle no overshoot. Overlay opacity 0→1 in 180ms. Reduced motion → instant.

**Selected state** — card inside view gets 1.5px `--brand` outline at `outlineOffset: -1` while panel shows it. Fades 200ms on close. No desaturation of others.

**Edge cases**
- `?task=invalid` → empty state with Close button + 1s auto-clear via setTimeout in useEffect
- Mid-edit nav: input blur fires synchronously when unmounted; cleanup useEffect double-checks dirty
- Touch hit area on calendar: bump pill min-h to 28px

**Boundary** — `useTaskPanel` is app-only. Showcase under `/` never imports it.

**Build order**: hook → primitive (popover) → comment-thread → field-rows → panel-header → panel-shell → orchestrator → mount in layout → wire onClicks (board / list / timeline / calendar in turn).

## Design notes

**Panel anatomy** (top→bottom): (a) thin meta strip — task ID `T-101` in mono tabular nums + breadcrumb + close X; (b) **title** as hero (Geist 22-24px, tight, two-line clamp, contenteditable on click); (c) inline meta row — status pill / priority / assignees / due, no labels, the chips ARE the controls; (d) description (13.5px ink-soft); (e) comments inline thread + sticky composer at bottom; (f) Activity collapsed at very bottom behind a single rule-line.

**Title affordance** — bare text at rest. Hover reveals a 1px `--line-soft` outline on bounding box (140ms fade in) and a 12px caret-shape glyph at 40%. Click → outline firms to `--brand`, caret blinks. No pencil icons. No "Edit" button.

**Visual character** — `--bg-elevated` white. **No header strip** — content begins at 24px padding, meta strip floats. Shadow on LEFT edge only via truncated `--shadow-float`: `-28px 0 60px -20px rgba(20,21,26,0.28)` + 1px `--line-soft` hairline. Reads as document, not drawer.

**Motion** — slide in: x from `+24px past final` to `0`, opacity 0→1, **480ms** `--ease-out-expo` (NOT a spring — springs feel toy-ish for working surface). Overlay: `bg-ink/12` opacity 0→1 same 480ms. Close: same curve, **240ms** (faster — closing should feel decisive). Reduced motion: instant toggle, opacity-only at 100ms.

**Card ring** — 1.5px `--brand` outline `outlineOffset: -1`, no halo, no scale. Don't desaturate other cards. Ring fades 200ms on close.

**Hard nos** — no save/cancel buttons (autosave on blur), no accordion sections, no tab strips inside the panel, no color-changing celebration on done, no avatar tooltips with hover-delay.

**Mobile** — bottom sheet peaking at 92vh, drag-to-dismiss past 30% threshold. Board behind stays partly visible. (Skipping mobile in this cycle — desktop-first; sheet behavior is backlog.)

**Earns-its-keep** — `T-101` in mono tabular-nums with copy-on-click → inline 600ms "copied" replacement. Tells the user "this team pastes task IDs into Slack."
