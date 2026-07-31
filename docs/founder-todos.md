# Founder to-dos

Founder / operator follow-ups for the Tasks product. Items here are captured
for later; they are intentionally out of scope for the change that logged them.

> Note: strategic product/GTM state also lives in Signal HQ (the Studio repo).
> This file is the lightweight in-repo backlog for Tasks-specific follow-ups.

## Tasks Kanban follow-ups

1. **Programs hierarchy**
   Add a Settings option that lets advanced users or workspace administrators
   enable Programs. Programs and Projects should be available as optional
   hierarchy levels for users who need a more advanced organizational structure.

2. **Custom icon workflow**
   Create and maintain all remaining custom application icons in Claude Design,
   replacing generic icon-pack assets as approved custom icons become available.

3. **Nudge backend**
   Implement the Nudge backend, including persistence, permissions, recipient
   resolution, notification delivery, error handling, analytics, and connection
   to the completed Tasks-card Nudge UI.

4. **Attachment thumbnails**
   Add functionality so that when a file or image is dropped onto or attached to
   a task card, image attachments can be displayed as the task-card thumbnail.
   Define behaviour for multiple images, non-image files, replacement, removal,
   loading, access permissions, and failed previews.

## Board truth programme follow-ups (logged 2026-07-30)

Phases 1 and 4 shipped as T·114 to T·118; the four-view capability audit
(2026-07-31) then found the T·99 blast radius covered all four views plus the
filter, share and assignee layers. T·119 restored real members to the assign
path. T·121 shipped phase 2: items 5 and 6 below are done (migration 0024
applied to production with counts measured first). T·122 shipped phase 3:
item 7 is done (doneKeys + one isTaskDone predicate + tasks.completedAt via
migration 0025).
Full plan and root cause: `studio/content/hq/features/tasks-board-truth.md`.

5. **Done, T·121 — port the column system into the live board (Phase 2)**
   The board rendered at `/app/tasks` is the design-lab prototype
   (`components/hybrid/options/a/board-view.tsx`), whose columns come from a
   hardcoded five-value const in `components/hybrid/types.ts`. The real board,
   `components/app/board/board-app.tsx`, has full column management (add,
   rename, recolour, describe, reorder, delete-with-destination) and **nothing
   has imported it since 2026-07-20**, when T·99 ported the lab tree in and
   verified parity by side-by-side render rather than by capability.
   Port the config into the lab board, then delete `board-app.tsx` so there is
   one board. Includes: the header caret always visible rather than
   `opacity-0`; `+` adds a column rather than a task; a pinned add-column
   control outside the horizontal scroll track; WIP limits from config.

6. **Done, T·121 — retire the `waiting` raw-text lane at source (migration 0024)**
   The lab runs five statuses against a four-lane schema, so `adapter.ts`
   writes `waiting: "waiting" as LaneId` into a column typed
   `todo | doing | review | done`. T·116 taught share, print and embed to
   render it so guests stop losing that work, but the underlying value is
   still out of contract. Fixing it properly is a **live data migration that
   rewrites `lane` on existing rows**, plus seeding the column config for
   affected workspaces. Measure the production row count first.

7. **Done, T·122 — "done" is the config predicate (Phase 3)**
   `lane === "done"` is compared as a bare string in roughly twelve production
   modules, and progress % is computed in exactly one of them
   (`project-overview.ts:287`). Once columns are user-defined this is
   untenable: rename Done to "Handed over", add "Paid", and the brief
   disagrees with the board. Add `doneKeys` to the column config and one
   `isDone()` predicate, then refactor every literal site. Also add
   `tasks.completedAt`; Signal currently reconstructs completion time from the
   activity log and already reports
   `completion_timestamp_missing_for_terminal_tasks`.

8. **Money, narrowly (Phase 5)**
   `tasks.cents` already exists in production, is editable in the task panel,
   and is CSV-exported, but nothing sums it and the formatting is hardcoded
   `en-US`/USD, so a euro wedding renders as dollars. Fix currency first, then
   add `workspaces.budgetCents` and roll up. Lead with coverage, never a false
   total. **Boundary: Tasks may restate a number the operator entered; it must
   never compute, forecast, convert or publish a financial claim.** No
   invoicing, no payment status, no multi-currency, and not on share, print,
   embed or `/p/{slug}`.

9. **Widen the board Filter**
   Priority and assigned/unassigned only today. Wants date, owner-by-name and
   column. Deliberately deferred out of T·115, whose scope was subtraction
   only, and it needs the column dimension from item 5 to exist first.

10. **Retire the stale `log-cycle` ritual in the Timeline repo**
    Tasks PR #70 removed it from this repo's `AGENTS.md`. The Timeline repo's
    `AGENTS.md` still carries the same instruction and the same dead
    `~/Projects/personal/tasks` path. Same edit, other repo.
