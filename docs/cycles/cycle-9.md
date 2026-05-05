# Cycle 9 · Activity log — turn updatedAt into a story

**Status:** in_progress · 2026-05-05

## Problem

The detail panel's Activity section renders three hardcoded
placeholder lines ("David moved to In progress · 14:22"). Every
real mutation in the system already passes through a server action,
yet none of them record what happened. The "edited 3h ago" stamp
introduced last cycle is a single integer; it doesn't tell the user
*what* was edited or *who*. Activity is the next natural surface —
the audit trail that lets a workspace feel alive across sessions.

## Solution shape

New `activities` table records every mutation: lane move, complete
toggle, field update (title / description / priority / due /
assignees / tags), comment add/remove, task creation. Each row has
`{ id, taskId FK, userId FK (CURRENT_USER for now), kind, payload
JSON, createdAt }`. A small `recordActivity()` helper colocated in
the actions folder is called from every mutation. The Activity
section in the panel becomes a real renderer: ordered desc, with a
formatter per `kind` that produces a one-line human-readable
sentence ("David moved this from In progress to Done · 12m ago").
Newest activities surface at the top; the panel fetches via
`getActivitiesForTaskAction` (mirroring the comments fetch
pattern).

## Backend deliverable

- Schema: `activities` table in `src/server/db/schema.ts` with FK
  cascade on task delete. JSON `payload` column.
- `Activity` type in `src/lib/data.ts` with discriminated-union
  `kind` covering: `move`, `toggleComplete`, `update` (with
  `field` in payload), `commentAdd`, `commentRemove`, `taskAdd`.
- Schema guard `_SchemaCoversActivity`.
- `getActivitiesForTask(taskId): Promise<Activity[]>` query
  ordered desc by `createdAt`.
- `src/server/actions/activity.ts`:
  `getActivitiesForTaskAction` (read wrapper). No write actions —
  activity rows are emitted as side-effects of other actions, not
  user-driven.
- New `recordActivity(taskId, kind, payload)` helper in
  `src/server/db/activity.ts` (server-only utility, not a "use
  server" action). Called from every mutation point in
  `actions/tasks.ts` and `actions/comments.ts`.

## Frontend deliverable

- Replace static `ActivityPlaceholder` in `task-detail-panel.tsx`
  with real `<ActivityFeed>` component that renders fetched
  activities.
- `useTaskActivities(taskId)` hook (mirror of useTaskComments
  shape) — but read-only since activities don't mutate from
  client. Re-fetches on taskId change.
- `formatActivityLine(activity)` helper: per-kind sentence
  rendering. e.g. `kind: "move"` with payload `{from: "todo", to:
  "doing"}` → "moved this from To do to In progress".
- Render avatar + name + sentence + relative time, matching the
  comments visual rhythm.
- Skeleton during fetch (2 rows, same as comments pattern).
- Empty state — "No activity yet." in `text-ink-faint`.

## Success criteria

- Move a card on board → reopen panel → Activity shows "David
  moved this to In progress · just now"
- Toggle done from list → Activity shows the completion line
- Add a comment → Activity shows "commented" line
- Edit description → Activity shows "edited the description"
- Reload → Activity persists
- Activity ordered most-recent-first
- 0 TS errors, 0 console errors
- Cinematic demo on `/` is unaffected
- prefers-reduced-motion honored

## Out of scope

- Activity feed across all tasks (e.g. "what changed today" — a
  later cycle, useful when more than one user exists)
- Undo from activity entry (cycle 10+ candidate)
- Diffing content for description / title (just record which
  field; don't store before/after for rich diffs yet)
- Filtering activity by kind
- Activity in non-panel views (e.g. small "X" badge on cards)

## Architect notes

**Schema** — `activities` table: `id` PK, `taskId` FK cascade, `userId` FK, `kind` text, `payload` JSON, `createdAt` timestamp. `_SchemaCoversActivity` guard.

**Type** — discriminated `ActivityPayload` union over `kind`. `commentAdd` includes a 60-char snippet (self-contained — comment may later be deleted). `update` records only `field` (no before/after this cycle).

**`recordActivity`** — server-only utility (NOT a "use server" action) at `src/server/db/activity.ts`. Catches and console.warns on failure — activity is observability, not transactional. Defaults `userId` to `CURRENT_USER`.

**Emission points**
- `addTaskAction` → `{ kind: "taskAdd", lane }`
- `moveTaskAction` → pre-read prior lane; emit `{ kind: "move", from, to }`. Skip on no-op.
- `toggleCompleteAction` → already pre-reads; `{ kind: "toggleComplete", to: "done"|"open" }`.
- `updateTaskAction` → emit ONE activity PER changed field (`title`, `description`, `priority`, `due`, `assignees`, `tags`, `estimate`). Concurrent via `Promise.all`. Skip `idleDays`.
- `removeTaskAction` → NO activity (cascade kills them).
- `addCommentAction` → snippet from trimmed body; `{ kind: "commentAdd", commentId, snippet }`.
- `removeCommentAction` → `{ kind: "commentRemove", commentId }` using looked-up `taskId`.

**Query** — `getActivitiesForTask(taskId)` desc by `createdAt`, limit 50.

**Hook + component** — `useTaskActivities` read-only mirror of `useTaskComments`. `ActivityFeed` renders ordered list. Re-fetch on `task.updatedAt.getTime()` change so every mutation refreshes the feed (verified no infinite loop — depends on epoch number, not Date identity).

**File order**:
1. data.ts (Activity / ActivityKind / ActivityPayload)
2. schema.ts (activities table + guard)
3. db/activity.ts (recordActivity helper)
4. queries.ts (getActivitiesForTask + rowToActivity)
5. actions/activity.ts (server-action wrapper for read)
6. actions/tasks.ts + actions/comments.ts (wire emissions)
7. use-task-activities.ts (hook)
8. activity-feed.tsx (component)
9. task-detail-panel.tsx (replace ActivityPlaceholder, fetch on taskId+updatedAt)

## Design notes

**Anatomy** — 16px avatar (NOT 22; the size IS the signal of "supporting content"), 12px line, single baseline. Actor name `font-medium text-ink`, verb phrase `text-ink-soft`, ` · ` separator, relative time `text-ink-quiet tabular-nums`. No background, no border, no hover surface — these aren't interactive.

**Spacing** — `space-y-2` between rows; `pb-4` at section base.

**Sentence patterns** — third-person, past tense, lowercase verbs, "this" for the task. Specific copy:
- `taskAdd` — "created this task"
- `move` — "moved this from To do to In progress" (lane labels in `text-ink`, rest `text-ink-soft`)
- `toggleComplete` done → "marked this complete"; open → "reopened this"
- `update.title` — "renamed this" (don't quote new title)
- `update.description` — "edited the description"
- `update.priority` — "set priority to P1" (P-token `tabular-nums`)
- `update.due` — set: "set the due date to {value}"; cleared: "cleared the due date"
- `update.assignees` — N/A in formatter (don't try to diff arrays this cycle; show generic "updated assignees")
- `update.tags` — generic "updated tags" same reason
- `commentAdd` — "commented" (NO snippet rendered — comments are above, duplicating reads as noise; payload still stores it for cross-task feeds later)
- `commentRemove` — "deleted a comment"

**Hierarchy** — both Comments and Activity visible by default. Comments at 13px/22px, activity at 12px/16px — ~85% scale carries "supporting note" signal without exiling. NO toggle to hide; activity is the audit trail.

**Time** — same `formatRelativeTime` + native `title` tooltip as comments. **NO date headers** ("Today" / "Yesterday") — single-task feeds are typically 5-30 rows. Relative time + descending order does the work.

**Empty state** — single line `"No activity yet."` in `text-[12px] text-ink-faint`. No second line, no icon, no CTA — user can't author activity.

**Hard nos** — NO timeline dots/lines between rows (Jira tax); NO color-coded badges per kind (verb is the signal); NO filter-by-kind tabs (200-row solution to 20-row problem); NO real-time pulse on new rows (it's a record, not a notification); NO auto-ticking timestamps (battery + attention tax).

**Earns-its-keep** — ordering is desc by `createdAt`, which puts `taskAdd` at the bottom naturally. Be explicit about it in the renderer so backfilled data with weird timestamps still respects the foundation. Last line of every feed reads "Alex created this task · Mon" — the colophon.
