# Cycle 5 · DB foundation — persistence appears

**Status:** in_progress · 2026-05-05

## Problem

Every mutation today is in-memory. Reload the page → state resets to
seed. Until persistence exists, every feature we add (real comments,
activity log, search) is a sandcastle. The new directive mandates a
backend layer in every cycle, and the bootstrap rule requires this
specific cycle to lay the foundation: schema, queries, server
actions, and the wiring that hydrates the existing `TasksProvider`
from server-fetched data.

## Solution shape

**Stack decision: SQLite via better-sqlite3 + Drizzle.** Zero infra,
file-on-disk (`./tasks.db`, gitignored), sync API that suits this
app's scale. Trivially portable to Postgres later by swapping the
Drizzle driver. Schema in `src/server/db/schema.ts` defines `tasks`,
`users`, `comments` matching existing TypeScript shapes from
`src/lib/data.ts`. A `seed.ts` script populates from `SEED_TASKS` on
first boot if the table is empty. `getTasks()` query returns the
typed Task[]. A `moveTaskAction(id, lane)` server action mutates and
invalidates with `revalidatePath('/app')`. The `/app/layout.tsx`
becomes async — fetches initial tasks server-side, passes them as
`initialTasks` to the existing `TasksProvider` (which already
accepts that prop).

## Backend deliverable

- Drizzle schema for `tasks` (id PK, title, lane, priority,
  assigneesJson, due, estimate, tagsJson, comments INTEGER,
  idleDays, blockedByJson, startDay, durationDays). JSON fields hold
  the array shapes since SQLite has no native arrays. Drizzle's
  `text({ mode: 'json' })` handles round-trip.
- `users` table mirrors `USERS` (id, name, color, initials).
- `comments` table for cycle 6 (id, taskId FK, userId FK, body,
  createdAt). Empty in this cycle — schema only.
- `src/server/db/index.ts` — database connection (singleton).
- `src/server/db/queries.ts` — `getTasks()`, `getTaskById(id)`.
- `src/server/db/seed.ts` — populates from `SEED_TASKS` if empty.
- `src/server/actions/tasks.ts` — server actions: `moveTask`,
  `updateTask`, `addTask`, `removeTask`, `toggleComplete`. Each
  returns the patched Task[] so the client can reconcile.
- `drizzle.config.ts` at repo root.

## Frontend deliverable

- `/app/layout.tsx` becomes `async`, fetches `await getTasks()`,
  passes to `<TasksProvider initialTasks={tasks}>`.
- `TasksProvider`'s dispatcher methods now fire server actions
  optimistically: dispatch the local action immediately for
  responsiveness, then `await` the server action and reconcile
  (revert if it throws). For cycle 5 we wire the `move` and
  `toggleComplete` paths fully; the others get the same plumbing.
- Visual surface is unchanged. Reload the page after a move —
  state persists.

## Success criteria

- `npm run dev` boots; `tasks.db` is created with seed data
- Drag a card on board, reload page — card still in new lane
- Toggle done on list, reload — still done
- 0 TS errors, 0 console errors
- `drizzle-kit check` passes
- Cinematic demo on `/` is unaffected (no DB access from showcase)
- `prefers-reduced-motion` carries forward

## Out of scope

- Comments persistence (cycle 6 — comments table already in schema)
- Auth (later — single tenant for now)
- Migrations workflow beyond `drizzle-kit push` for dev
- Production-grade error rollback (cycle 6+ when comments arrive)
- Edge runtime compatibility (better-sqlite3 needs Node runtime —
  set `runtime = "nodejs"` if Next defaults to edge anywhere)
- DESIGN phase (skipped — visible surface unchanged per directive's
  bootstrap exception)

## Architect notes

**Deps** — `drizzle-orm` + `better-sqlite3` (prod); `drizzle-kit` + `@types/better-sqlite3` (dev). Scripts: `db:push`, `db:check`, `db:seed`. `dev` chains `drizzle-kit push --force && next dev` so cold start is zero-touch.

**Schema** — `tasks`, `users`, `comments` in `src/server/db/schema.ts`. JSON columns (`mode: 'json'`) for `assignees`, `tags`, `blockedBy`. `text` with `$type<LaneId>()` for `lane`/`priority` (narrows TS, no SQL check constraints). Integer unix-epoch `created_at`/`updated_at` with sql defaults — stripped in mapper. Comments table has FK cascade on task delete; empty this cycle.

**DB singleton** — `globalThis._sqlite ??= new Database("./tasks.db")` to survive HMR. WAL journal mode. `import "server-only"` guards.

**Seed** — auto-run in `db/index.ts` on first boot: read SEED_TASKS / USERS, transaction-insert if `count() === 0`. Also `tsx src/server/db/seed.ts` for explicit re-seed.

**Mapper** — `rowToTask(row)` converts NULL → undefined and is the single source of truth for client-server shape alignment. `Task` type stays hand-written; schema duplicates the shape; a `satisfies` assertion in `schema.ts` flags drift at compile.

**Server actions** — `moveTaskAction`, `toggleCompleteAction`, `updateTaskAction`, `addTaskAction`, `removeTaskAction`. Each returns full `Task[]` for one-round-trip reconciliation. `revalidatePath('/app', 'layout')` after every mutation. Skip `reorderTaskAction` until a UI consumer needs it. Server `toggleCompleteAction` always toggles to `"todo"` from `done` (no `previousLane` server-side this cycle); document divergence, plan reunification later.

**Optimistic flow** — Reducer gains `hydrate` action. Dispatcher pattern:
```
const prior = stateRef.current.tasks;
dispatch({ type: ..., ... });               // optimistic
startTransition(async () => {
  try { dispatch({ type: "hydrate", tasks: await action(...) }) }
  catch { dispatch({ type: "hydrate", tasks: prior }) }       // revert
});
```
`stateRef` keeps prior snapshot without re-creating dispatchers. Public dispatcher signatures unchanged — call sites untouched.

**Layout** — `/app/layout.tsx` becomes `async`, `await getTasks()`, passes via existing `initialTasks` prop. Provider already supports it.

**Edge runtime** — none in repo. Node default. `import "server-only"` enforces boundary; `"use server"` keeps actions out of client bundle.

**Cold-start flow** — file missing → SQLite creates it → `drizzle-kit push --force` (chained in `dev`) creates schema → seed runs (count=0) → 16 tasks land. No manual steps.

**Cinematic demo isolation** — confirmed: showcase imports nothing from `src/server/`. Boundary enforced by import graph + `"server-only"` directive.

**Build order**
1. `package.json` + `.gitignore` (deps + script + ignore tasks.db*)
2. `drizzle.config.ts`
3. `src/server/db/schema.ts`
4. `npm run db:push` to materialize
5. `src/server/db/seed.ts`
6. `src/server/db/index.ts` (with seedIfEmpty call)
7. `src/server/db/queries.ts`
8. `src/server/actions/tasks.ts`
9. `src/lib/tasks/tasks-reducer.ts` — add `hydrate`
10. `src/lib/tasks/tasks-context.tsx` — wire optimistic + actions
11. `src/app/app/layout.tsx` — async + getTasks
12. Smoke test (drag → reload → persists)

**Risks**
- `next build` might prerender app routes and complain about uncached DB access. Fallback: `export const dynamic = 'force-dynamic'` on `/app/layout.tsx`.
- Two-tab staleness — known limitation, cycle 8+ candidate.
- `addTask` id reconciliation — both client and server use `crypto.randomUUID()`-derived ids; client passes its id to server; server uses it. Hydrate replaces optimistic row.
