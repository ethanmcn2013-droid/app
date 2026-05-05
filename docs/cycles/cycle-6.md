# Cycle 6 · Real comments — first full-stack feature

**Status:** in_progress · 2026-05-05

## Problem

The detail panel renders a deterministic-from-id seed thread that
looks live but isn't. Cycle 5's schema includes a `comments` table
that's empty. The natural first feature on the new full-stack
substrate: replace the seed with a real comment thread that
persists, optimistically renders, and posts via a server action.
Comments are also the pattern every future "thing that happens on a
task" (activity, mentions, reactions, attachments) will follow — get
the shape right once.

## Solution shape

Define `Comment` type in `src/lib/data.ts`. Add `getCommentsForTask`
query and `addCommentAction` / `removeCommentAction` server actions.
Seed a few comments per task on first boot so existing seed tasks
have realistic conversation depth (deterministic from task id, just
like the previous static thread). The detail panel's
`CommentThread` becomes a client component that receives
`initialComments` from a server-side fetch in the panel's layout
boundary, manages local state for optimistic add, and re-fetches via
`revalidatePath` after server confirms. The composer becomes a real
`<textarea>` with Enter-to-post (Shift+Enter for newline) and a
small avatar showing who's posting (David, the seeded current user).
Delete-on-hover for own comments.

## Backend deliverable

- `Comment` type in `src/lib/data.ts` (id, taskId, userId, body,
  createdAt). `CURRENT_USER` constant — David — for now.
- Schema: existing `comments` table is fine; verify FK cascade
  works on task delete.
- `src/server/db/queries.ts`:
  `getCommentsForTask(taskId): Promise<Comment[]>` ordered by
  createdAt asc.
- `src/server/db/seed.ts`: extend seed to insert ~3 comments per
  seed task using the existing deterministic hash strategy. So the
  first dev boot still feels populated.
- `src/server/actions/comments.ts`:
  `addCommentAction(taskId, body)` returns the new full
  `Comment[]` for the task. Generates id with crypto.randomUUID,
  uses CURRENT_USER. `revalidatePath('/app', 'layout')` for the
  task count badges; cycle 7 will add a more granular tag.
  `removeCommentAction(commentId)` returns the new comment list
  for that task (server look up taskId from row).

## Frontend deliverable

- `src/components/app/detail-panel/comment-thread.tsx` becomes
  client-state-aware: receives `initialComments` from the panel,
  manages local list with optimistic add. Uses the new
  `useTaskComments(taskId, initialComments)` hook colocated in
  `src/lib/tasks/use-task-comments.ts`.
- New composer with `<textarea>` (autoresize), Enter-to-post,
  Shift+Enter for newline. Disabled state when empty / posting.
  Avatar shows David (CURRENT_USER).
- `task-detail-panel.tsx` becomes async at the boundary that
  fetches comments, then passes through to the client thread.
  Since the detail panel already lives inside a `Suspense`, it can
  await the comments fetch when a task is selected.
- Delete affordance on hover for own comments — small X button at
  end of comment row.
- Empty state — "No comments yet. Start the conversation." instead
  of an empty thread.
- Reduced motion: optimistic insert appears instantly, no slide-in.

## Success criteria

- Click a card → panel opens → real comments render from DB
- Type in composer + Enter → comment appears immediately
  (optimistic) → server persists → reload page → comment still
  there
- Delete own comment → disappears optimistically → DB row gone
  on reload
- Switching task in panel re-fetches that task's comments
- `getCommentsForTask` is the only network call when opening the
  panel (verified in network tab)
- 0 TS errors, 0 console errors, type-clean server actions
- Cinematic demo on `/` is unaffected

## Out of scope

- @-mentions (cycle 7+ candidate alongside notifications)
- Comment editing (only add + remove for now)
- Markdown / rich text rendering
- Reactions on comments
- Real auth — CURRENT_USER stays a hard-coded seed user until auth
  arrives

## Architect notes

**Types** — `Comment` in `src/lib/data.ts`: `{id, taskId, userId: UserId, body, createdAt: Date}`. `CURRENT_USER: UserId = "david"`. `SEED_COMMENT_BODIES` array lifted from old comment-thread.tsx.

**Schema guard** — mirror `_SchemaCoversTask` with `_SchemaCoversComment` in `schema.ts`.

**Query** — `getCommentsForTask(taskId)` ordered `asc(createdAt)`; `rowToComment` pass-through.

**Seed extension** — inside same transaction, insert ~3 comments per task using `strHash(task.id)` to pick deterministic user + body. `id = c-<taskId>-<offset>`. `createdAt` staggered by `(3-offset)*3600` seconds. Independent count check (don't reseed if comments already populated).

**Actions** — `src/server/actions/comments.ts`: `addCommentAction(taskId, body)`, `removeCommentAction(commentId)`, `getCommentsForTaskAction(taskId)`. Each returns `Comment[]` for the task. Server actions for reads are blessed by Next 16 docs for client-driven fetches.

**Hook** — `src/lib/tasks/use-task-comments.ts`. `useState<Comment[]>(initialComments)` + `useTransition` for `isPending`. `useEffect` syncs when `taskId` or `initialComments` ref changes (panel switching tasks). Optimistic add/remove with revert via `setComments(prior)` on throw. Null taskId no-ops.

**Panel fetch** — option (b): client `useEffect` keyed on taskId calls `getCommentsForTaskAction` with stale-fetch guard (`ignore` flag in cleanup). Skeleton while loading. Cancel-stale-fetches on rapid task switches.

**File order** — data.ts → schema.ts guard → queries.ts → seed.ts → actions/comments.ts → use-task-comments.ts → comment-thread.tsx → task-detail-panel.tsx.

## Design notes

**Composer** — bare `<textarea>` (no frame, no rounded-input shape), avatar to left, placeholder **"Write a comment"** (kill "Reply…"), Enter-only post (no submit button), `⏎` kbd hint at right edge in `text-ink-faint` (50% empty, 100% typed, becomes a 10px brand spinner during the ~80ms post window). Autoresize 1 line → 8 lines max. Posting clears textarea, keeps focus.

**Optimistic comment** — pixel-identical to confirmed; never fade/italic. Animate in with 240ms ease-out-expo translateY(4→0) + opacity(0→1). On server failure: drop opacity to 0.5 and append `"couldn't send · retry"` (`text-[11px] text-ink-quiet`).

**Delete affordance** — 14px X at far right of comment row, baseline-aligned to name. Reveal on row hover via `opacity-0 group-hover:opacity-100 transition-opacity duration-150`. Click → row collapses height + fades 180ms; reappears reverse on server failure. No confirmation, no undo toast.

**Empty state** — left-aligned pure type. Two lines:
> No comments yet.
> Start the thread below.

13px ink-quiet + 12px ink-faint. No icon, illustration, or border.

**Loading skeleton** — 2 rows (not 3), 22px circle + two lines (60% / 40%). No shimmer, no pulse — static. Cross-fade 180ms when real data lands.

**Spacing** — `space-y-4` between comments (was `space-y-3`); `pb-6` before the composer's `border-t`.

**Hard nos** — no typing indicators, reactions, threaded replies, "edited" marks, markdown toolbar, @-autocomplete UI, read receipts.

**Time format** — relative + ticking (`just now` / `3m` / `2h` / `yesterday` / `May 2`), `tabular-nums`. Native `title` tooltip shows absolute. Implement via small `formatRelativeTime(date)` util; re-renders implicit when component re-renders.
