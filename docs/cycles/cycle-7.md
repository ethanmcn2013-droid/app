# Cycle 7 · Add-task flow + description column

**Status:** in_progress · 2026-05-05

## Problem

Every "+ Add task" button on board, list, calendar, and the "New
task" header button literally does nothing. Until the user can
create tasks, the app is a fancy viewer of seeds. This is the next
most-used everyday interaction after toggling done. Backend half
also seeds the next cycle — adding a `description` column means the
panel's placeholder Description section can become editable in
cycle 8 with no second migration.

## Solution shape

Two complementary entry points. (a) **Inline composer** at the
bottom of each board lane (Linear / Things pattern): click "+ Add
task" → an inline row appears with a focused text input inside the
lane; Enter creates with that lane preselected, Esc cancels, blur
without text cancels. (b) **Quick-create dialog** triggered by the
header "+ New task" button (and by ⌘K- / 'c'-style shortcut later);
opens a small centered modal with a single-line title input plus
hidden-by-default lane / priority dropdowns. Both flows fire
`addTaskAction` (cycle 5) which now also sets a description column
and `createdBy: CURRENT_USER`.

## Backend deliverable

- Add nullable `description text` column to the `tasks` table.
  Drizzle-kit push handles the migration.
- Extend `Task` type with `description?: string`.
- Update `rowToTask` mapper to coerce NULL → undefined.
- Extend `addTaskAction` to accept optional `description`.
- Extend `updateTaskAction` to handle a description patch (already
  works via the generic patch shape, but verify).
- The `_SchemaCoversTask` guard catches drift.

## Frontend deliverable

- New `src/components/app/add-task/` folder with:
  - `inline-composer.tsx` — lane-bound inline row with text input.
    Renders inside each board lane below existing cards. Calls
    `addTask({ title, lane })` from the existing dispatcher.
  - `quick-create-dialog.tsx` — centered modal, focused input,
    Enter creates, Esc closes.
- Wire the header "+ New task" button (in `page-header.tsx`) to
  open the dialog.
- Wire each lane's "+ Add task" button in `board-app.tsx` to open
  its inline composer.
- Add a global keyboard shortcut: `c` (when not focused in an
  input) opens the quick-create dialog.
- New cards appear with optimistic + reconcile via the existing
  provider plumbing (cycle 5 already wired this for `addTask`).

## Success criteria

- Click "+ Add task" in a lane → input appears focused → type
  "New task title" → Enter → card appears in that lane → reload
  page → still there
- Click header "+ New task" → dialog opens → type title → Enter →
  card appears in default (To do) lane
- Press `c` anywhere on `/app/*` → dialog opens
- Esc closes dialog without creating; blank Enter no-ops
- 0 TS errors, 0 console errors
- Cinematic demo on `/` is unaffected
- `npm run db:check` passes; new column visible

## Out of scope

- Description editing inside the panel (cycle 8 — column lands
  this cycle so cycle 8 can build the editor)
- Lane / priority pickers in dialog beyond defaults (start with
  defaults; cycle later adds pickers if needed)
- Bulk add (paste 5 lines → 5 tasks) — backlog
- Auto-suggest based on title parsing ("Refactor #board p0
  @david") — backlog

## Architect notes

**Schema** — add `description: text("description")` (nullable) to `tasks`. Drizzle-kit push emits `ALTER TABLE tasks ADD COLUMN description TEXT` — non-destructive on existing rows. `_SchemaCoversTask` guard catches drift.

**Type + mapper** — `Task.description?: string`; `rowToTask` adds `description: row.description ?? undefined`.

**Server actions** — `addTaskAction` accepts + persists `description`; `updateTaskAction`'s sparse-patch loop already routes through. No new actions.

**State models** — Inline composer: single `composerLane: LaneId | null` in BoardApp (at-most-one-open). Dialog: `AddTaskRoot` provider in app layout exposing `{open, setOpen}`. Both surfaces orthogonal; dialog open closes the detail panel.

**Keyboard shortcut** — new `src/lib/use-keyboard-shortcut.ts`. Skip when target is input/textarea/contenteditable; skip with meta/ctrl/alt held. Bind `c` only — uppercase implies shift modifier we don't claim. Crucially: bind on `keydown` and `preventDefault` so the `c` doesn't bleed into the dialog input that's about to mount.

**Dialog primitive** — new `src/components/primitives/dialog.tsx`. Portal'd to body. Esc + click-outside close, focus first input, restore prior focus on close, role/aria-modal/labelledby.

**File order**
1. schema.ts + data.ts paired (keep `_SchemaCoversTask` green)
2. queries.ts mapper
3. actions/tasks.ts addTask passes description
4. tasks-context.tsx dispatcher type + optimistic builder
5. Run dev once → drizzle pushes column
6. primitives/dialog.tsx
7. lib/use-keyboard-shortcut.ts
8. add-task/inline-composer.tsx
9. add-task/quick-create-dialog.tsx + add-task-context.tsx
10. board-app.tsx wires inline composer
11. page-header.tsx + app/layout.tsx mount AddTaskRoot

## Design notes

**Inline composer** — lighter than a card. No white fill, no border, no shadow. Lane's tinted background deepened (drop `E6` alpha → full opacity), 1px inset top divider in `--line-soft`. Single-line input, 13px ink, ~30px row, glyph-flush left padding matching the existing "+ Add task" button. The white-card moment is reserved for *real* tasks.

**Composer motion** — In: 220ms ease-out-expo, height 0 → ~30px, opacity 0 → 1, 4px Y rise on caret. Button label cross-fades to placeholder over 140ms (single-element-resolving). Out (Esc/blur-empty): 160ms, height collapse + opacity, button label fades back. On submit: composer stays open, input clears 100ms — new card uses existing AnimatePresence rise. Reduced-motion: opacity only 120ms.

**Dialog character** — distinct from detail panel. 480px wide, 18/20 padding, 14px radius, `--shadow-float`, 1px `--line` border. Backdrop: dim only `rgba(20,21,26,0.32)` — NO blur. Title input is hero: 17px ink, no border/fill, placeholder `--ink-faint`. Below: quiet meta row (11.5px `--ink-quiet`) with default lane chip ("To do" + dot) and right-aligned `⏎ Create` kbd hint. No header bar — placeholder IS the label.

**Dialog motion** — center-growing, NOT slide-from-top. Open 260ms ease-out-expo: scale 0.96→1 + opacity + Y 6→0. Backdrop fades 200ms (leads slightly). Close 180ms ease-cinema: scale 1→0.98 + opacity → 0 + Y→4. Reduced-motion: opacity only 120ms.

**Empty / error** — empty Enter = silent no-op (kbd hint dims `ready` → `empty`). Server failure = inline error line below input, 12px ink-soft, "Couldn't save — try again." Draft text preserved.

**Microcopy** — inline placeholder `"What's next?"`. Dialog placeholder `"Name a task"`. Header button `"New task"` (drop the `+` glyph; differentiation: glyph = inline-write-here, no glyph = open-a-room).

**Single-active** — A collapse + B expand overlap by 100ms (A starts at t=0 with 160ms close, B starts at t=60ms with 220ms open). Per-lane drafts preserved in session memory. `c` while inline composer is open: open dialog, collapse composer (preserve draft).

**Hard nos** — no skeuomorphic sticky notes; no blue/brand-color Save buttons (Enter IS the action); no full-screen modals on desktop; no pulsing CTA (wordmark dot owns the only pulse); no "Task added!" toasts (the card appearing IS the confirmation); no autofocus jump-scroll (use `preventScroll: true`).

**Earns-its-keep** — when `c` opens the dialog, swallow the keystroke via `e.preventDefault()` on the keydown so it doesn't bleed into the about-to-mount input. The shortcut becomes invisible — the highest compliment a shortcut can receive.
