# Cycle 8 · Editable description + last-edited stamp

**Status:** in_progress · 2026-05-05

## Problem

The detail panel's Description section renders an outdated
placeholder paragraph ("links, formatted lists, and inline media
land in cycle 6"). Cycle 7 added the `description` column so users
*could* persist real prose, but nothing in the UI captures it. Until
description is real, every other panel section feels like
scaffolding around a not-quite-document. Backend half: audit
`updatedAt` writes — actions are inconsistent, so we can't trust the
timestamp for "edited Xh ago" microcopy yet.

## Solution shape

**Frontend** — replace the static prose with a click-to-edit
contenteditable surface (or a textarea, depending on best UX).
At rest: shows the description rendered as plain text with
preserved newlines, or an empty-state line ("Add a description.")
when null. Click the area → focus a controlled `<textarea>`,
autoresize from a one-line minimum, blur to commit, Enter for
newlines (no submit shortcut — descriptions are prose, multi-line is
the default), Esc reverts. Pattern echoes the title editor in
`panel-header.tsx`. The committed value flows through the existing
`updateTask` dispatcher, persists via `updateTaskAction`.

**Backend** — every mutation in `src/server/actions/tasks.ts` and
`src/server/actions/comments.ts` must bump `tasks.updatedAt` for the
affected task (comments → bump parent task; comment add/remove
indicates engagement so the parent's `updatedAt` should reflect it).
Audit the existing `bump()` helper, ensure all paths use it, fix
gaps. Surface `updatedAt` in `getTasks()` and the `Task` type.
Render "edited Xh ago" in the panel header below the title using
the existing `formatRelativeTime` util.

## Backend deliverable

- Audit `bump()` usage in `src/server/actions/tasks.ts` — every
  update / move / toggle / addTask must include the `updatedAt`
  bump. Fix any path that doesn't.
- Comments touch the parent task: `addCommentAction` and
  `removeCommentAction` bump `tasks.updatedAt` for `taskId`.
- Add `updatedAt: Date` to the `Task` type in `src/lib/data.ts`.
- Update `rowToTask` in `queries.ts` to surface it.
- Update `_SchemaCoversTask` guard to include the new field.
- The `seed` already sets `updatedAt` via the column default.

## Frontend deliverable

- New `src/components/app/detail-panel/description-editor.tsx` —
  click-to-edit textarea with autoresize, blur-commit, Esc revert.
  At-rest renders as `<p>` with `whitespace-pre-wrap`. Empty state
  is a left-aligned ghost line "Add a description." that becomes
  the textarea on click.
- Replace the placeholder `<Description />` in `task-detail-panel.tsx`
  with the new editor; pass the live `task.description`.
- Add a small "edited 3h ago" line below the title in
  `panel-header.tsx`. Uses `formatRelativeTime(task.updatedAt)`.
  Hidden if updatedAt is within ~5s (don't flash "edited just now"
  on first render after a mutation).

## Success criteria

- Click description area → editor focuses → type → blur → text
  persists across reload
- Empty description renders the ghost prompt; click → textarea
  appears focused and empty
- Esc cancels the edit (reverts to prior value)
- "edited Xh ago" line appears under the title and updates after
  any mutation (panel re-renders since state changed)
- Mutations beyond description (lane, priority, assignees, comments
  add/remove) also bump the parent task's `updatedAt`
- 0 TS errors, 0 console errors, type-clean
- Cinematic demo on `/` is unaffected
- `prefers-reduced-motion` honored

## Out of scope

- Markdown rendering / rich text — plain text + newlines only
  this cycle. Cycle later.
- @-mentions inside description
- Live "X is editing" presence on description
- Activity log of who edited what — bigger; later cycle
- Comment count badge updates on cards (revalidatePath already
  fires; layout re-renders catch most of it)

## Architect notes

**bump() audit** — `moveTaskAction`, `toggleCompleteAction`, `updateTaskAction` PASS. `addTaskAction` doesn't (column default catches it but inconsistent — add explicit). Comments NEITHER bump parent task. Fix.

**Comments → parent touch** — two awaited `db.update` (no transaction; failure is harmless cosmetic drift). Inline in `addCommentAction` / `removeCommentAction`.

**Type alignment** — `Task.updatedAt: Date` (non-nullable; column has default). `rowToTask` surfaces it. Existing `_SchemaCoversTask` guard validates. SEED_TASKS gets staggered `updatedAt: new Date(Date.now() - i * 3600_000)` for realistic "edited Nh ago" gradient.

**Editor** — `<p>` ⇄ `<textarea>` swap (NOT contenteditable — IME / paste / selection complexity not worth it). Identical padding + line-height + font-size in both states so swap is sub-pixel. `key={task.id}` on the editor so React unmounts when switching tasks (fires blur → commits draft).

**Empty + clear handling** — committing empty string is treated as "no description" by the renderer (`task.description?.trim() ?? ghost`). The `cleaned` loop in `updateTaskAction` strips undefined; pass empty string explicitly when clearing.

**Optimistic** — reducer's `update` case sets `updatedAt: new Date()` when patch is non-empty so the stamp doesn't lag. Server hydrate corrects drift.

**Build order**:
1. data.ts: Task gains updatedAt; SEED_TASKS staggered
2. queries.ts: rowToTask surfaces updatedAt
3. actions/tasks.ts: addTaskAction sets bump explicitly
4. actions/comments.ts: both touch parent task updatedAt
5. tasks-reducer.ts: update case bumps optimistic updatedAt
6. tasks-context.tsx: addTask dispatcher constructs with updatedAt
7. description-editor.tsx (new)
8. task-detail-panel.tsx swaps placeholder for editor
9. panel-header.tsx adds "edited X ago" line in meta row

## Design notes

**At-rest** — `<p>` with `whitespace-pre-wrap`, 13.5px/1.6 `text-ink-soft`. NO outline. Multi-line content + outline = form field carnival; reserve frames for fields, never documents.

**Editing affordance** — hover anywhere over the block: ink-soft → ink over 120ms, cursor `text` (I-beam). NO glyph, NO border. Color promotion alone says "this is alive." `role="button"` + `tabIndex={0}` for keyboard; existing `:focus-visible` ring handles keyboard channel.

**Mid-edit** — bare textarea. Same 13.5px/1.6 + `text-ink`. NO size bump on focus (Notion-2019 trap). Min-height = one line at-rest so zero layout shift. Autoresize via `scrollHeight` like comment composer. NO max — panel scrolls.

**Empty state** — `"Add a description."` (sentence case + period — feels like a finished sentence, not a button label). `text-ink-faint`. Full-section click target (whole `px-6 py-5` block). Cursor `text`. Hover → ink-quiet. NO `+` icon, NO dashed border, NO "Click to add."

**Save / cancel signals** — nothing. Autosave on blur is a contract — every flash/check/toast erodes it. The "edited X ago" stamp ticking is the receipt. NO Esc-hint chrome — the title editor doesn't show one and no one's confused.

**Stamp placement** — beside the `T-101` chip in the meta row, separated by a middle dot. `text-[10.5px] tabular-nums text-ink-quiet`. Format: `"edited 3h ago"` (lowercase verb prefix; "3h ago" alone is ambiguous — created? commented? edited?). After 7d flips to `"edited May 1"`. Hide if `Date.now() - updatedAt < 5000`. NEVER under the title — title and description are the document hierarchy; metadata stays in the chip row.

**Hard nos** — no rich-text toolbar, no slash menu, no `/` triggers, no Editing… pips, no save spinner, no "Saved ✓" toast, no character counter, no Save/Cancel button row, no dashed border, no `+` icon.

**Caret behavior** — click in existing prose → caret at click position (browser default). Click empty prompt → caret at position 0. Keyboard entry (Tab+Enter/Space) → caret at end of existing text (the 80% case is appending). Three behaviors, one rule each, zero settings.
