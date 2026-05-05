# Cycle 10 · My tasks route + real comment counts

**Status:** in_progress · 2026-05-05

## Problem

Two related gaps in app accuracy. (a) The sidebar's "My tasks"
link points to `/app/my-tasks` — a route that doesn't exist; the
badge count is calibrated to *all* open tasks, not the current
user's. (b) Cards display a `comments` integer, but it's a stale
seed field that doesn't track reality — adding a comment via the
panel doesn't change the number on the card. Both feel like the
app pretending to know things it doesn't.

## Solution shape

**Frontend** — add `/app/my-tasks` page, a filtered list view of
tasks where `CURRENT_USER` is in `assignees`. Reuse the existing
`ListApp` shell with a new "scope" prop or a sibling component
`MyTasksApp`. Sidebar's "My tasks" link works; the badge count
recalculates from the same filter on the client. Card display
unchanged.

**Backend** — drop the seeded static `comments` integer from the
`Task` shape (it's been a fiction since cycle 6). Compute the
count server-side in `getTasks()` via a `LEFT JOIN comments` +
`GROUP BY` so cards always show the real count. The schema's
`comments` column on the tasks table goes away entirely (it was
seed-only data, never written by any mutation).

## Backend deliverable

- Drop `comments: integer("comments")` from the `tasks` schema —
  manual `ALTER TABLE tasks DROP COLUMN comments` migration via
  drizzle-kit push.
- Update `Task` type: `comments?: number` becomes a *derived*
  field populated by `getTasks` (still optional in the type).
- Update `rowToTask` and `getTasks` to compute count via
  Drizzle subquery or LEFT JOIN GROUP BY.
- New `getTasksForUser(userId): Promise<Task[]>` query for the
  My tasks route; same shape but with `WHERE assignees LIKE
  '%"<userId>"%'` (JSON column, simple LIKE works for our scale).
- Update SEED_TASKS literals to remove the static `comments`
  field.

## Frontend deliverable

- New `src/app/app/my-tasks/page.tsx` server component fetching
  via `getTasksForUser(CURRENT_USER)` and passing to a client
  view.
- New `src/components/app/my-tasks/my-tasks-app.tsx` — list view
  scoped to the user's tasks; reuse the existing list-row rendering
  pattern but read from a passed-in array instead of the global
  store (since this view is user-filtered, the store's full list
  isn't right). Or: reuse the store but apply a client-side
  filter — simpler, keeps optimistic updates working. Recommend
  the latter.
- Sidebar's "My tasks" link now resolves; the badge count
  recalculates from the filter (open tasks where CURRENT_USER is
  in assignees).
- Update `openTaskCount` selector to optionally filter by user.
- Comment counts on cards now show the real count from the DB.

## Success criteria

- Click sidebar "My tasks" → `/app/my-tasks` renders a list of
  tasks where David is an assignee
- Sidebar badge count = count of David's OPEN tasks (not done)
- Toggle done from My tasks list → count drops; reload → state
  persists; card on board view also reflects done
- Add a comment via panel → reload → card shows updated count
  (was 11 before comment add, now 12)
- 0 TS errors, 0 console errors
- Cinematic demo on `/` is unaffected
- prefers-reduced-motion honored

## Out of scope

- Inbox route (sidebar "Inbox" link still placeholder — separate
  cycle; needs more thought about what "inbox" means)
- Filtering UI (just the per-user route this cycle)
- Real auth / user switcher — CURRENT_USER stays hard-coded
- Server-side aggregation pagination — list shows all
- Comment count badges in sidebar / list — only on cards

## Architect notes

**Schema** — drop `comments: integer("comments")` from tasks. Drizzle-kit push handles `ALTER TABLE DROP COLUMN` (SQLite 3.45+ via better-sqlite3 12.9). Widen `_SchemaCoversTask` guard to `Omit<Task, "comments">` since `Task.comments` is now derived.

**Type** — `Task.comments?: number` stays optional but semantics shift to "derived count from comments table". Strip `comments: <n>` literals from `_seedTaskInputs`.

**`getTasks` subquery** — Drizzle correlated subquery via `sql` template:
```ts
{ ...getTableColumns(tasks), commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.task_id = tasks.id)`.as("comment_count") }
```
`rowToTask` maps `commentCount: 0 → undefined` so existing truthy checks (`task.comments ?` in card renderers) keep hiding the chip on zero.

**`getTasksForUser(userId)`** — Same projection; `WHERE assignees LIKE '%"${userId}"%'`. Surrounding double-quotes guarantee exact-token match (current UserIds — chloe/david/alex/ada/marcus — are unique short strings, no overlap risk).

**Selector** — extend `openTaskCount(state, opts?: { user })` to filter by assignee inclusion. Extract `groupByLane(tasks)` to take a tasks array (existing `groupByLane(state)` delegates).

**My tasks page** — server page is a thin shell. Client `MyTasksApp` reads from `useTasksState()` and applies `assignees.includes(CURRENT_USER)` filter — preserves optimistic updates. NOT a separate provider with its own data fetch.

**Sidebar** — per-icon count: Inbox uses global `openTaskCount(state)`, My tasks uses `openTaskCount(state, { user: CURRENT_USER })`.

**Hydrate-on-prop-change** — `TasksProvider` currently reads `initialTasks` only on mount. When `revalidatePath` fires after a comment add, the layout re-renders the provider with fresh server tasks but the reducer state is stale. Add a `useEffect` that dispatches `hydrate` when the `initialTasks` reference changes. Safe (the dispatch only reconciles; doesn't lose optimistic state since the server data IS the truth).

**File order** — selectors → data.ts seed strip → queries → schema (then db:push) → sidebar → my-tasks-app → my-tasks page → tasks-context hydrate-on-prop-change effect

## Design notes

Skipped — visible surface reuses the existing list view. Header text "My tasks" should be derived from path/sidebar nav.
