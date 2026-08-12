# B — Domain, identity, authorization and mutation audit

**Scope:** the real identity, authorization and mutation model underneath Notes,
Tasks, Timeline and the signal (analytics/briefing) module, established so the
Home contracts can be sealed against truth rather than assumption.

**Base:** `a849fc40e46787a39e499fc94b171a5dfb898821` (`feat/home-operating-layer`,
worktree `_wt-home-layer`, clean). Every path below is repo-relative to that
worktree. Every claim carries a `file:line`. Where I could not read a fact out of
the repository I have marked it **INFERENCE** and said so.

---

## 0. Document availability at this base

| Requested | Present at `a849fc4`? |
|---|---|
| `docs/adr/` | **ABSENT.** No such directory. |
| `docs/wave/` | **ABSENT.** No such directory. |
| `docs/SUITE_URL_AND_NAMING_CONTRACT.md` | **Present**, 124 lines, status `locked`, effective 2026-07-25, amended 2026-08-04 for the Signal→Home consolidation. |

`docs/projects/` contains only `signal-home-consolidation/` and the new
`home-operating-layer/`. So the ADR and wave records the brief anticipated are
still on an unmerged branch: **this audit was written without them, and nothing
here is reconciled against them.**

The one governing doc that *is* here is worth quoting for the contract work:
Home is "the authenticated front door", not a fourth product; `/app/home` is the
default authenticated destination and `/app/home/briefing` is the Full Briefing
(`docs/SUITE_URL_AND_NAMING_CONTRACT.md:12-24`, `:37-42`). The executable half of
that contract is named as `src/lib/suite-contracts.v1.json`,
`src/lib/product-urls.ts`, `src/proxy.ts`, `next.config.ts`
(`docs/SUITE_URL_AND_NAMING_CONTRACT.md:78-84`).

---

## 1. Project identity — four incompatible identity spaces

There is no single thing called a "project". There are four, and three of them
are not even the same *kind* of key.

### 1.1 Tasks — the canonical spine

The Tasks workspace is the only durable, id-keyed tenant in the estate.

- `workspaces` table: `id` text PK, `slug` text NOT NULL UNIQUE
  (`src/server/db/schema.ts:272-277`). The slug doubles as the public
  `/p/{slug}` path (`src/server/db/schema.ts:274-276`).
- `workspace_members` is the membership join, composite PK `(workspace_id,
  user_id)`, `role` is `"owner" | "member"` defaulting to `member`
  (`src/server/db/schema.ts:458-477`).
- `tasks.workspace_id` is the tenant boundary and is **still nullable** —
  "Nullable during the cutover; tightened to NOT NULL after the legacy backfill
  lands" (`src/server/db/schema.ts:38-41`). The same nullable-during-cutover note
  appears on `comments` (`:481`), `activities` (`:519`), `notifications` (`:570`),
  `attachments` (`:873-875`) and `shareLinks` (`:766-767`).
- Vocabulary note: **"Projects = workspaces, Programs = planning periods"** is
  recorded as decision D-011 in `src/server/actions/project-overview.ts:6-8`.
  So in Tasks, "project" is a `workspaces` row.
- The grouping layer above a project is `planning_periods`, owned by exactly one
  user (`owner_user_id` FK to `users`, cascade delete) —
  `src/server/db/schema.ts:217-261`. `workspaces.planning_period_id` is a
  nullable FK with `onDelete: "set null"` (`src/server/db/schema.ts:299-302`).

### 1.2 Timeline — slug-keyed, a *different* workspace table, owner-only

Timeline runs on its own libSQL database (`drizzle-timeline/`,
`drizzle.timeline.config.ts`) with its own `workspaces` and `projects` tables.

- Timeline `workspaces.slug` is the **primary key** — not an id
  (`src/modules/timeline/server/db/timeline-schema.ts:325-333`). `ownerUserId` is
  a Clerk user id (`:333`), and there is **no membership table in Timeline at
  all**.
- Timeline `projects` has a **composite PK `(workspace_slug, slug)`**
  (`src/modules/timeline/server/db/timeline-schema.ts:60-89`), so a Timeline
  project is identified by a slug pair, never by a UUID.
- The join back to Tasks is `workspaces.suite_workspace_id` — "Immutable Signal
  Tasks workspace id… the only suite-wide workspace join key", nullable, under a
  unique index (`src/modules/timeline/server/db/timeline-schema.ts:334-337`,
  `:381`).
- A Timeline *project* separately carries `source_tasks_workspace_id` —
  "Immutable Tasks workspace id this project syncs milestones from. NULL =
  manual-only" (`src/modules/timeline/server/db/timeline-schema.ts:79-84`).
- Timeline slugs are derived from the Tasks slug, clamped to 32 chars, suffixed
  on collision, and are also public path segments
  (`src/modules/timeline/lib/provision-slug.ts:1-60`).
- Synced milestone nodes get a synthetic fifth id:
  `` `ms-${tasksWorkspaceId}-${tasksTaskId}` ``
  (`src/modules/timeline/server/sync/tasks-milestone-source.ts:161`, documented at
  `src/modules/timeline/server/db/timeline-schema.ts:423-424`).

**So one Tasks workspace can map to: a Timeline workspace slug, one-or-more
Timeline project slugs, and N `ms-…` node ids.** The Timeline project switcher
routes on `projectSlug` and carries `workspaceId` in the query string as a
routing hint (`src/modules/timeline/lib/project-switcher-model.ts:17-38`).

### 1.3 signal / analytics — **projects are derived from task TAGS**

This is the finding that most directly threatens a Home "project" contract.

- The read-only Tasks mirror states it outright: *"JSON-encoded array of tag
  strings. Each unique tag becomes an Analytics 'project' (PRODUCT.md §6 mapping
  note)."* — `src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts:26-27`.
- The derivation is a slugify:
  `projectIdFromTag(tag)` NFKD-normalises, lowercases, replaces non-alphanumerics
  with `-`, truncates to 96 chars, and falls back to the literal string
  `"untagged"` — `src/modules/signal/server/analytics/providers/tasks.ts:365-374`.
- Projects are then *synthesised* by bucketing tasks by tag, with `state:
  "unknown"` and a deep link that points at the board root, not a project —
  `src/modules/signal/server/analytics/providers/tasks.ts:250-276`.
- Project-scope authorization is a `SELECT DISTINCT json_each.value FROM tasks,
  json_each(tasks.tags)` capped at 2 000 distinct values
  (`src/modules/signal/server/analytics/policy.ts:206-222`).
- The briefing data source does the same thing independently, in a *second* place:
  `projectSlugs: tags` and a per-tag `ProjectRead` synthesis
  (`src/modules/signal/lib/data/source.ts:218`, `:233-260`).

Two tags that slugify to the same value silently merge into one analytics
project; renaming a tag destroys its history; an untagged task belongs to a
project literally called `untagged`.

### 1.4 Notes — tenant is the *person*, workspace is a hint

- `notes.user_id` is the boundary. `notes.workspace_id` is explicitly *"Optional
  projection of the canonical Signal Tasks workspace id… Notes never owns or
  copies Workspace membership. A null value is the normal, durable 'Unfiled'
  state."* — `src/modules/notes/server/db/notes-schema.ts:54-62`.
- The tenant-scope gate encodes this: Notes' `tenantColumns` is `["user_id"]`,
  not `workspace_id` — `src/server/tenant-scope-rules.mjs:177-181`.

### 1.5 Where the identity spaces collide — precisely

| Collision | Evidence |
|---|---|
| Tasks project = UUID `workspaces.id`; Timeline project = `(workspace_slug, slug)` pair | `src/server/db/schema.ts:272-277` vs `src/modules/timeline/server/db/timeline-schema.ts:60-89` |
| signal project = slugified **task tag**, not a workspace at all | `src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts:26-27`; `src/modules/signal/server/analytics/providers/tasks.ts:365-374` |
| Notes has no project; `workspace_id` is a nullable, non-authoritative projection | `src/modules/notes/server/db/notes-schema.ts:54-62` |
| Two tables literally named `workspaces` in two databases with different PKs (`id` vs `slug`) | `src/server/db/schema.ts:272` vs `src/modules/timeline/server/db/timeline-schema.ts:325-328` |
| Two tables named `tasks` with unrelated shapes and a *different status enum* | `src/server/db/schema.ts:36` (lanes `todo/doing/review/done`) vs `src/modules/timeline/server/db/timeline-schema.ts:102-107` (`in-flight/next/shipped/refused/waiting`) |
| A third status vocabulary in signal | `src/modules/signal/lib/data/types.ts:16` — `"next" \| "in-flight" \| "blocked" \| "shipped" \| "refused"` |
| Tasks workspace `slug` is a public URL segment; Timeline workspace `slug` is a *different* public URL segment for the same underlying project | `src/server/db/schema.ts:274-276` vs `src/modules/timeline/lib/provision-slug.ts:1-13` |

**Consequence for Home:** any Home "project" object must be a Tasks
`workspaces.id`, and every other id in the estate must be treated as a
*projection* resolved from it. Home must never accept a Timeline slug or an
analytics tag-slug as a project identity, and must never present the four as
interchangeable.

---

## 2. Authorization — five membership seams, no single one

There is **no single seam**. Each module resolves membership its own way, against
the same `workspace_members` table, over four different transports.

### 2.1 Identity: Clerk → internal user

`getCurrentUser()` (`src/server/auth.ts:53-126`):
1. Demo short-circuit → `DEMO_USER_ID` (`:56`).
2. If Clerk env vars missing: **throws in production, returns `"david"` in dev**
   (`:58-67`). The same dev fallback is replicated verbatim in three more places:
   `src/modules/notes/server/notes-auth.ts:35`,
   `src/modules/timeline/server/auth.ts:51`,
   `src/modules/signal/server/signal-auth.ts:33`.
3. `auth()` → `clerkId`; calls `currentUser()` (a second Clerk round-trip) and
   `ensureUserProvisioned(clerkId, email, first, last)` on **every** authed
   request (`:93-105`).
4. Looks up `users.clerk_id → users.id`; if the webhook has not landed it
   **returns the raw Clerk id as the internal user id** (`:111-120`).

That last branch is the identity hazard: for a brief window the same person is
addressable as two different `UserId` values. `workspace_members.user_id` "equals
the Clerk id post-Phase-A" per `src/server/app-access.ts:54-56`, which makes the
two *usually* identical — but `signal`'s workspace lister hedges with
`or(eq(users.clerkId, clerkId), eq(users.id, clerkId))`
(`src/modules/signal/server/analytics/page-context.ts:161`), which is evidence
the equality is not universally trusted in the codebase.

### 2.2 The tenant boundary is a `WHERE` clause and nothing else

`src/server/db/tenant.ts:5-27` states it plainly: *"Tasks has NO row-level
security… The ONLY thing stopping workspace A from reading workspace B is a
`WHERE workspace_id = ?` predicate."* `byWorkspace()` throws on an empty
workspace id (`:28-43`). A static gate (`src/server/tenant-scope.test.mjs` over
`src/server/tenant-scope-rules.mjs`) is the enforcement.

### 2.3 The five seams

| # | Module | How membership is resolved | Evidence |
|---|---|---|---|
| 1 | **Tasks** | in-process Drizzle on `workspace_members`, gated by the `tasks_active_ws` cookie | `src/server/auth.ts:147-180` |
| 2 | **Timeline (authorization)** | opens its **own raw `@libsql/client`** against `TASKS_DATABASE_URL` and runs hand-written SQL joining `users → workspace_members → workspaces` | `src/modules/timeline/server/sync/tasks-workspace-context.ts:93-131` |
| 3 | **Timeline (ownership)** | its own `workspaces.owner_user_id`, **owner-only, no member concept** | `src/modules/timeline/server/db/timeline-queries.ts:158-170` |
| 4 | **signal** | a third Drizzle client over a read-only Tasks mirror schema | `src/modules/signal/server/analytics/policy.ts:152-204`; `src/modules/signal/lib/data/source.ts:164-202` |
| 5 | **Notes** | an **HTTP loopback** to `/api/internal/workspaces` carrying an HMAC-signed short-lived assertion | `src/modules/notes/server/tasks-personalization.ts:148-171`, `:181-190`; server side `src/app/api/internal/workspaces/route.ts:39-95` |

Seam 2 is the sharpest: Timeline reauthorises with raw SQL rather than the
shared query layer, and comments that the query-string id is "a routing hint
only" (`src/modules/timeline/server/sync/tasks-workspace-context.ts:11-15`).
Seam 5 is a network hop between two modules **inside the same Next app**, with a
2 s timeout that degrades to `"unavailable"`
(`src/modules/notes/server/tasks-personalization.ts:59`, `:166-171`).

### 2.4 Every function that returns a workspace/project set for a viewer

Tasks (in-process):
1. `getActiveWorkspace()` — one workspace; validates the cookie against
   membership, else first membership, else `LEGACY_WORKSPACE_ID` —
   `src/server/auth.ts:147-180`
2. `listMyWorkspaces()` — id/name/slug/role, membership join —
   `src/server/auth.ts:184-210`
3. `getProjectsTreeData()` — wraps `listMyWorkspaces`, groups by planning period,
   splits archived — `src/server/actions/projects-tree.ts:73-178`
4. `listYourWorkForUser(actorUserId)` — periods + workspaces + per-workspace task
   rollups, cross-workspace — `src/server/planning/queries.ts:67-137`
5. `getOverdueAcrossWorkspacesAction()` — cross-workspace overdue tasks —
   `src/server/actions/cross-workspace.ts:50-167`
6. `searchAcrossWorkspacesAction(query)` — cross-workspace title search —
   `src/server/actions/cross-workspace-search.ts:49+`
7. `viewerIsWorkspaceMember(workspaceId)` — boolean, never throws —
   `src/server/db/queries.ts:544-562`
8. `requireWorkspaceMember` / `requireWorkspaceOwner` /
   `requirePlanningPeriodOwner` — `src/server/planning/authorization.ts:14-72`,
   backed by `src/server/planning/security-boundary.ts:21-53`
9. `getWorkspaceMemberMeta(workspaceId)` — the roster (display only) —
   `src/server/db/members.ts:21-64`
10. `GET /api/internal/workspaces` — HMAC-gated catalog for Notes —
    `src/app/api/internal/workspaces/route.ts:39-95`

signal:
11. `listWorkspaceOptions(clerkId)` — union of owned + member —
    `src/modules/signal/server/analytics/page-context.ts:155-199`
12. `revalidateWorkspaceMembership(clerkId, workspaceId)` — owner-or-member —
    `src/modules/signal/server/analytics/policy.ts:152-204`
13. `resolveLinkedAnalyticsWorkspace(clerkId)` — the persisted single link —
    `src/modules/signal/server/analytics/policy.ts:114-119`
14. `_listForUserFromDb(db, identity)` / `tasksDbSource.listForUser` —
    `src/modules/signal/lib/data/source.ts:164-202`
15. `listPlanningCatalogForUser({clerkId, email})` — used by the briefing —
    `src/modules/signal/server/briefing/signal-build-for-user.ts:266-269`

Timeline:
16. `getWorkspacesForUser(userId)` — **owner only** —
    `src/modules/timeline/server/db/timeline-queries.ts:158-170`
17. `getWorkspaceForSuiteIdForUser(suiteWorkspaceId, ownerUserId)` — owner only —
    `src/modules/timeline/server/db/timeline-queries.ts:175-190`
18. `getCurrentTasksWorkspaceContext(clerkId, workspaceId)` — raw SQL —
    `src/modules/timeline/server/sync/tasks-workspace-context.ts:93-131`
19. `getPrimaryTasksWorkspaceForUser(clerkId)` — **owner only**, wedding-first
    tie-break — `src/modules/timeline/server/sync/tasks-workspace-context.ts:45-91`
20. `resolveTimelineContext(...)` / `getCurrentWorkspace(...)` —
    `src/modules/timeline/server/auth.ts:112-201`

Notes:
21. `fetchTasksWorkspaceCatalog(clerkId)` / `fetchTasksWorkspaces(clerkId)` /
    `authorizeTasksWorkspace(clerkId, workspaceId)` —
    `src/modules/notes/server/tasks-personalization.ts:148-190`

**Twenty-one functions.** Nine of them are cross-workspace. They disagree on
whether owner-only or owner-or-member, on whether archived workspaces are
excluded, and on which id space they speak.

### 2.5 The beta gate is inconsistent between Home and Tasks

- `src/app/app/layout.tsx:61` calls `requireAppAccessTasks()`, which admits a
  user on **either** the email allowlist **or** a `workspace_members` row —
  `src/server/app-access.ts:29-62`. Its header comment says the allowlist-only
  gate "bounced every invited and every redeemed user to `/waitlist` after their
  token had already been burned" (`src/app/app/layout.tsx:50-58`).
- But `src/app/app/home/page.tsx:17` calls the allowlist-only
  `requireAppAccess()` (`src/server/require-app-access.ts:21-35`). So do
  `src/app/app/home/briefing/page.tsx:17`, `src/app/app/notes/page.tsx:21`,
  `src/app/app/timeline/page.tsx:13`, `src/app/app/signal/page.tsx:24`.
  `/app/tasks` has no page-level gate of its own.

**In production mode an invited, non-allowlisted workspace member passes the
layout gate, can use `/app/tasks`, and is redirected to `/waitlist` the moment
they open Home, Notes, Timeline or the Briefing.** Home cannot be the front door
while it enforces a stricter gate than the product behind it.

---

## 3. Mutation inventory — what Home could write back to

Every Tasks mutation lives in `src/server/actions/` and is bound to the **active
workspace cookie**, not to a workspace argument. Eighty call sites of
`getActiveWorkspace()` across 24 action files.

### 3.1 Task state and assignment

| Mutation | Location | What it authorizes |
|---|---|---|
| `moveTaskAction(id, toLane)` | `src/server/actions/tasks.ts:106-155` | pre-reads the row with `eq(tasks.workspaceId, ws)`; foreign id is a silent no-op (`:118-122`) |
| `toggleCompleteAction(id)` | `src/server/actions/tasks.ts:157+` | same workspace guard (`:162-166`) |
| `updateTaskAction(id, patch)` | `src/server/actions/tasks.ts:386-492` | allowlist of patchable columns (`:365-384`); workspace guard on read (`:399-411`) and on write (`:445-448`) |
| `addTaskAction(input)` | `src/server/actions/tasks.ts:494-583` | inserts with `workspaceId: ws`; validates only the *parent* task's tenancy (`:531-550`) |
| `moveTaskToColumnAction` | `src/server/actions/board.ts:585+` | active workspace |
| `setTaskArchivedAction`, `removeTaskAction`, `duplicateTaskAction`, `setTaskMilestoneAction`, `reorderTaskAction` | `src/server/actions/tasks.ts:598`, `:655`, `:732`, `:792`, `:879` | active workspace |

**Authorization is membership-of-the-active-workspace and nothing finer. There is
no role check on any of them** — `grep` for `role === "owner"` / `eq(...role,
"owner")` in `src/server` returns hits only in `src/server/actions/planning.ts`,
`src/server/actions/security.ts`, `src/server/actions/settings.ts` (invites and
member management), and `src/server/planning/security-boundary.ts:30`, `:47`.

### 3.2 The board configuration — anyone can redefine "Done"

`setColumnDoneAction(columnKey, isDone)` writes the workspace's `doneKeys`
(`src/server/actions/board.ts:282-301`). It resolves `getActiveWorkspace()` and
performs **no role check**. The same is true of `renameColumnAction` (`:169`),
`addColumnAction` (`:325`), `deleteColumnAction` (`:465`),
`reorderColumnsAction` (`:402`) and `renameBoardAction` (`:130`). Config is a
`meta` key/value row — key `board:{workspaceId}:columns`
(`src/server/actions/board.ts:69-71`, `:91-103`).

Because `isTaskDone` is *the* done predicate for every surface
(`src/lib/board-columns.ts:188-208`), any single member can change what "done"
means for the whole workspace, and therefore for every Home number derived from
it.

### 3.3 Approvals — there is no approval primitive

There is no approvals table, no approval column, no approval action anywhere in
`src/server` or `src/modules`. The word appears only in Notes' *extract approval*
sense — the creator-authored `extract_body` that crosses to Tasks
(`src/modules/notes/server/db/notes-schema.ts:20-29`;
`src/server/db/schema.ts:103-113`) — and in the VEF programme docs, which live in
the `studio` repo, not here. **Home cannot write an approval; the primitive would
have to be built.**

### 3.4 Acknowledgements — three near-misses, none usable

1. **Notification read-state.** `notifications.read_at` exists
   (`src/server/db/schema.ts:585-586`) and is mapped on read
   (`src/server/db/queries.ts:574`). A repo-wide grep for `readAt` in
   `src/server` and `src/components/app/inbox` returns **only those two
   references — nothing ever writes it.** The Inbox has no mark-as-read.
2. **Nudge dismissal** is `localStorage` under the key
   `"tasks_dismissed_nudges"` — `src/components/app/inbox/inbox-app.tsx:207`,
   `:226-244`. Not durable, not cross-device.
3. **Briefing verdicts** *are* durable: `recordBriefingFeedback(itemKey, verdict,
   triggerId)` upserts into `briefing_feedback` on the signal analytics DB
   (`src/modules/signal/app/signal-feedback-actions.ts:17-55`), and
   `getDismissedKeys` reads `verdict = "not-useful"` back
   (`src/modules/signal/server/briefing/signal-read-state.ts:22-41`). This is the
   only working acknowledgement in the estate, and it lives in a **different
   database** from tasks.

### 3.5 The binding problem for Home

`moveTaskAction`, `toggleCompleteAction` and `updateTaskAction` all resolve their
tenant from `getActiveWorkspace()` (`src/server/actions/tasks.ts:114`, `:159`,
`:391`), which reads the `tasks_active_ws` cookie (`src/server/auth.ts:30`,
`:147-180`). **A cross-project Home surface cannot complete a task in project B
while the cookie says project A** — the pre-read returns no row and the action
silently no-ops. Switching the cookie is itself a mutation
(`selectWorkspaceAction`, `src/server/actions/cross-workspace.ts:177-202`) with a
30-day `maxAge` and `httpOnly: false` (`:193-200`).

Any Home write-back therefore needs either (a) new workspace-parameterised
actions, or (b) a cookie dance per write. (a) is the only safe answer.

---

## 4. Task assignment storage — JSON column, and no cross-project query exists

**Assignment is a JSON array column, not a relation.**

```
assignees: text("assignees", { mode: "json" })
  .$type<UserId[]>()
  .notNull()
  .default(sql`'[]'`),
```
— `src/server/db/schema.ts:53-56`

There is no `task_assignees` table anywhere in `src/server/db/schema.ts`, and no
index on `assignees` (the index list is `src/server/db/schema.ts:156-171`:
workspace_id, parent_task_id, (workspace_id, lane), due_at, (workspace_id,
is_milestone), source_note_id).

**Can you do an exact cross-project "assigned to me" query today? No. Three
separate reasons:**

1. **No such query exists.** The only assignee-scoped read is
   `getTasksForUser(userId, workspaceId)` — `src/server/db/queries.ts:320-343` —
   and it is **workspace-scoped by construction** (`byWorkspace(...)` at `:331`).
   It also has **zero callers**: a repo-wide grep for `getTasksForUser` returns
   only its own definition at `src/server/db/queries.ts:320`. It is dead code.
2. **The match is a `LIKE`, not an equality.** `like(tasks.assignees, `%"${escapedId}"%`)`
   — `src/server/db/queries.ts:335`, with a hand-rolled `escapeLike` for `%` `_`
   `\` at `:310-312`. The same pattern is duplicated in the digest
   (`src/server/db/daily-digest.ts:69-79`). This is a full-table scan per
   workspace, cannot use an index, and is exact only because of the surrounding
   double-quote convention.
3. **The shipped "my tasks" surface is single-project.** `/app/my-tasks` renders
   `MyWeekApp`, which reads the client `TasksContext`
   (`src/components/app/my-week/my-week-app.tsx:38`) — i.e. the active
   workspace's board, filtered client-side. `/app/your-work`
   (`src/server/planning/queries.ts:67-137`) *is* cross-workspace but groups by
   **project**, not by assignee — it never touches `assignees`.

To do this properly, SQLite can do it with `json_each` (the estate already uses
that idiom for tags at `src/modules/signal/server/analytics/policy.ts:213-216`),
but nothing does it for assignees today, and it would still be unindexed.

**One further hazard:** nothing validates that an assignee is a workspace member.
`assignees` is in `PATCHABLE_TASK_COLUMNS` (`src/server/actions/tasks.ts:370`)
and is written straight through (`:419-424`, `:445-448`); `addTaskAction` writes
`assignees: input.assignees ?? []` with no check
(`src/server/actions/tasks.ts:561`). `getWorkspaceMemberMeta`
(`src/server/db/members.ts:21-64`) is a *display* roster only. A Home "assigned
to me" list can therefore contain rows assigned to user ids that were never
members.

---

## 5. "Done" and "blocked/waiting" — configured per workspace, and three surfaces ignore the config

### 5.1 Done is per-workspace configuration

- `ColumnConfig.doneKeys: string[]`, default `["done"]` —
  `src/lib/board-config.ts:29-37`, `:48-58`.
- Stored as JSON in the global `meta` table under `board:{workspaceId}:columns` —
  `src/server/db/board-config-read.ts:22-27`.
- `resolveDoneKeys(config)` → `["done"]` when unset —
  `src/lib/board-columns.ts:183-186`.
- `isTaskDone(task, config)` is declared THE predicate: *"Every surface that asks
  'is this task finished' asks here — progress percentages, briefs, digests,
  exports, nudges, card strikethrough"* — `src/lib/board-columns.ts:188-208`.
- The effective column is `boardColumnKey || lane` —
  `src/lib/board-columns.ts:159-164`, matching the schema note "effective board
  column = COALESCE(boardColumnKey, lane)" (`src/server/db/schema.ts:116-117`).
- `tasks.completed_at` is stamped only on a real transition —
  `src/server/actions/tasks.ts:98-104`, column at `src/server/db/schema.ts:129-133`.

### 5.2 Waiting is a *default custom column*, not a lane

`LaneId` is exactly four values — `src/lib/data.ts:1` — and `LANE_ORDER` is
`["todo","doing","review","done"]` (`src/lib/data.ts:205`). "Waiting" is a
default **custom** column with key `"waiting"`
(`src/lib/board-columns.ts:49`, `:68-74`), and a task in it persists as
`lane: "doing", boardColumnKey: "waiting"`
(`src/lib/board-columns.ts:216-223`). Legacy pre-migration-0024 rows still hold
raw `lane = "waiting"` text and resolve to the same key
(`src/lib/board-columns.ts:23-25`). Owners can rename, recolour or delete it
(`:18-22`).

There is **no first-class "blocked" state.** Blocking is the `blockedBy` JSON
array (`src/server/db/schema.ts:67`).

### 5.3 The four places that disagree with the config

1. **signal's Tasks mirror has no `board_column_key` column and no `meta`
   table**, so it passes `null` config and always resolves `doneKeys = ["done"]`
   — stated in the code at
   `src/modules/signal/server/analytics/providers/tasks.ts:113-118` and
   `src/modules/signal/server/analytics/providers/notes.ts:101-105`. A workspace
   that renamed Done or added a second done column is measured wrongly by
   analytics, silently.
2. **The briefing maps lanes through a fixed table** —
   `LANE_TO_STATUS = { todo:"next", doing:"in-flight", review:"in-flight",
   done:"shipped" }` (`src/modules/signal/lib/data/source.ts:112-117`), with
   unknown lanes logged once and coerced to `"next"` (`:121-136`). `blocked` is
   derived only from `blockedBy.length > 0` (`:134`). A task parked in a custom
   Waiting column reads to the briefing as **in-flight**, because its `lane` is
   `"doing"`.
3. **`getOverdueAcrossWorkspacesAction` hardcodes `ne(tasks.lane, "done")`** —
   `src/server/actions/cross-workspace.ts:105`. It also filters neither
   `archived_at` nor `parent_task_id`, so archived tasks and subtasks appear in
   the cross-workspace overdue list, unlike every workspace-local read
   (`getTasks` filters both — `src/server/db/queries.ts:102-111`).
4. **`listYourWorkForUser` hardcodes `lane = 'done'`** in four separate SQL
   expressions — `src/server/planning/queries.ts:100`, `:102`, `:107` — and also
   does not filter `archived_at`.

**Every existing cross-project surface uses the literal, not the predicate.**
Home is a cross-project surface. If it reuses these, it inherits the divergence.

---

## 6. Notes privacy — one boundary, three sanctioned exits

### 6.1 What makes a Note private

`notes.user_id` and nothing else. The schema states the guardrail: *"body is
private to the owner. Collaborative views should store/read approved extracts,
never raw note rows. Only the extract_body (creator-authored, deliberate) ever
leaves Notes."* — `src/modules/notes/server/db/notes-schema.ts:19-22`.
Every read filters on it: `listNotes` (`src/modules/notes/server/actions/notes.ts:247-251`),
`searchNotes` (`:280-300`, with the same guardrail restated at `:272-275`).
The tenant gate governs Notes on `user_id` (`src/server/tenant-scope-rules.mjs:177-181`).

### 6.2 The three paths by which Note content reaches a shared surface

1. **The approved extract lands in the Tasks tenant, permanently.** The
   `/api/notes-extract/v2` route writes `sourceNoteExtractBody: body`
   (`src/app/api/notes-extract/v2/route.ts:215`) into the Tasks `tasks` row
   (`src/server/db/schema.ts:103-113`). It is mapped into the client `Task`
   (`src/server/db/row-mappers.ts:52`, type at `src/lib/data.ts:288`) and
   **rendered in the task detail panel** as `Approved wording: "…"` —
   `src/components/app/task-detail/metadata-rail.tsx:203-205`. Every workspace
   member sees it. This is by design and consented, but it is the one place where
   text a person wrote in their private notebook becomes team-visible.
2. **signal analytics reads approved extracts.** `NotesAnalyticsProvider`'s
   SELECT names `id, user_id, extract_body, promoted_task_id, created_at,
   updated_at` and **deliberately omits `body`**
   (`src/modules/signal/server/analytics/providers/notes.ts:84-92`, rationale at
   `:22-28`). It is doubly bounded: `WHERE user_id = ?` with the *requester's*
   Clerk id (`:86`, `:91`) **and** `promoted_task_id IN (…)` restricted to an
   already-authorised workspace (`:48-60`, `:88`). Records carry
   `exposure: "approved_extract"` (`:164`) and `deepLink: ""` (`:163`).
3. **Notes → Timeline promotion carries a projection, never a body.**
   `createTimelinePromotionCommand` builds *"the only payload Notes may offer to
   Timeline. There is no body, extractBody, user id, token, or free-form metadata
   slot"* — `src/modules/notes/lib/timeline-promotion.ts:31-56`.

Writes of `notes.workspace_id` are authorised against Tasks first —
`setNoteWorkspace` (`src/modules/notes/server/actions/notes.ts:388`) calls
`authorizeTasksWorkspace` at `:401` and refuses on `denied` or `unavailable`
(`:402-407`).

**Verdict:** the Notes boundary is the best-defended seam in the estate, and Home
must not weaken it. The only correct Home affordance is the approved extract, and
it must be labelled as such.

---

## 7. Notification / event storage, and snapshot storage

### 7.1 What exists for an Inbox

| Store | Shape | Fit for a cross-project Inbox |
|---|---|---|
| `notifications` | `id, workspace_id, user_id, kind, task_id (FK, cascade), payload, created_at, read_at` — `src/server/db/schema.ts:569-592` | **Blocked.** `notify()` *returns early* when the payload carries no `taskId` (`src/server/db/notifications.ts:40-47`), so nothing that is not a task can ever be stored. Reads are **workspace-scoped**, 50 rows, via `byWorkspace` (`src/server/db/queries.ts:579-598`). `read_at` has no writer (§3.4). Policy is deliberate: only mentions and blocks are inserted (`src/server/db/schema.ts:563-568`). |
| `workspace_events` | `id, workspace_id, user_id, kind, payload, created_at` — `src/server/db/schema.ts:988-1004` | Additive audit log added by migration 0019 because `activities.task_id` is NOT NULL and could not hold workspace-scoped events (`:979-987`). Today only `inviteSent` / `inviteAccepted`. Closest existing shape to a real event log. |
| `activities` | `id, workspace_id, task_id NOT NULL, user_id, kind, payload, created_at` — `src/server/db/schema.ts:518-542` | Task-bound only. |
| `suite_outbox` | durable cross-product queue with `event_id` unique, `delivered_at`, `attempts` — `src/server/db/schema.ts:191-210`; writer `src/server/db/outbox.ts:5-21`; drained by `/api/cron/outbox` (`src/server/db/outbox.ts:24-34`) | A delivery queue, not a user inbox. Explicitly marked `isolation-ok` cross-tenant (`src/server/db/outbox.ts:25-30`). |
| `tasksEvents` (SSE) | in-process `EventEmitter` on `globalThis`, `/api/events` — `src/server/events.ts:1-30` | Explicitly **single-process only**: *"production with multi-replica deployment needs Redis pubsub"* (`src/server/events.ts:9-13`). |

**Conclusion:** there is no durable, cross-project, read-state-carrying
notification store. Building Home's Inbox on `notifications` requires (a)
dropping the `taskId` requirement, (b) a cross-workspace read, and (c) a
mark-read mutation. None of the three exists.

### 7.2 Snapshot storage for Analytics history

The tables exist and are well shaped:
`analytics_metric_snapshots` (`workspace_id`, nullable `project_id`, `metric_key`,
`snapshot_at`, `numeric_value`, `aggregate_value`, `coverage`, `metric_version`,
three indexes) — `src/modules/signal/server/db/signal-analytics-schema.ts:133-174`;
`analytics_snapshot_runs` — `:176-201`; `analytics_schema_versions` — `:203-212`.

The reader is wired: `readMetricSnapshotHistory` is called from
`src/modules/signal/server/analytics/service.ts:414` (imported at `:48`).

**But nothing writes them.** `captureWorkspaceSnapshots` is defined at
`src/modules/signal/server/analytics/snapshots.ts:244` and a repo-wide grep
(excluding `node_modules`) returns **that definition and nothing else**. There is
no route, script or cron that calls it: `vercel.json` declares exactly one cron,
`/api/cron/digest?send=1` at `0 9 * * *`. `/api/analytics/capture` is **not** the
snapshot capturer — it is a PostHog event forwarder
(`src/app/api/analytics/capture/route.ts:12-15`, `:57-60`), a route named for a
job it does not do.

`listEligibleSnapshotWorkspaces` is also uncalled, and its eligibility boundary
is `analytics_users.linked_workspace_id IS NOT NULL`
(`src/modules/signal/server/analytics/snapshots.ts:57-66`) — i.e. one workspace
per user, not all of them.

**So Analytics history is a read path over an empty table.** Any Home trend line
is either empty or must be computed live.

---

## 8. Caching posture on authenticated routes

**Nothing in this repository uses `unstable_cache`, `"use cache"`, `cacheLife`,
`cacheTag`, or `revalidateTag`** — a repo-wide grep over `src/**/*.ts(x)` returns
zero hits for all six.

**Every `/app` route is `export const dynamic = "force-dynamic"`** — 22 files,
including `src/app/app/layout.tsx:21`, `src/app/app/home/page.tsx:8`,
`src/app/app/home/briefing/page.tsx:4`, `src/app/app/inbox/page.tsx:31`.

`next.config.ts`'s `headers()` block sets **no `Cache-Control` for `/app/*`** —
only the global `securityHeaders` on `/((?!embed/).*)`, plus embed, `/s`, `/p`
and `/share` entries (`next.config.ts:319-348`). `/app` privacy therefore rests
entirely on `force-dynamic`'s default response headers, which is a convention,
not an asserted contract. **INFERENCE:** I did not verify the exact headers Next
emits for a dynamic render at this version.

Explicit private/no-store *is* applied where someone thought about it:
`src/proxy.ts:57` (bare artifacts), `next.config.ts:106-108` (audience
artifacts), `src/app/api/suite-context/route.ts:25`, `:59`,
`src/app/api/internal/workspaces/route.ts:92`, `:172`,
`src/app/api/account/export/route.ts:33`,
`src/app/api/attachments/[id]/route.ts:82`,
`src/modules/signal/server/analytics/errors.ts:38`.

### Two exceptions worth naming

1. **`/api/calendar/[workspaceId]` serves a membership-gated payload with a
   shared-cache directive.** The route checks `getCurrentUserOrNull()` and a
   `workspace_members` row (`src/app/api/calendar/[workspaceId]/route.ts:41-57`),
   then returns every dated task's **title and tags**
   (`:69-86`) with:
   `"Cache-Control": "public, max-age=900, s-maxage=1800"`
   — `src/app/api/calendar/[workspaceId]/route.ts:99`.
   `public` + `s-maxage` explicitly invites CDN and intermediary caches to store
   a personalised, authorised response. The response carries no `Vary` on
   authorization. This is the clearest caching defect in the estate.
2. **`fetchTasksPersonalization` opts *into* the Next Data Cache on an
   authenticated cross-product fetch** — `next: { revalidate: 300 }` at
   `src/modules/notes/server/tasks-personalization.ts:248` (function at `:233`),
   while its sibling `fetchTasksWorkspaceCatalog` correctly uses
   `cache: "no-store"` (`:162`). **INFERENCE:** whether the per-user HMAC bearer
   enters Next's fetch-cache key is a framework-internal detail I did not verify
   from this repo. The assertion embeds a fresh `randomUUID()` jti and `iat` per
   call (`:213-221`), so in practice keys likely never collide — but the intent
   ("cache this personalised response for 5 minutes") is stated in the code and
   should be closed deliberately rather than left to a framework detail.

Public reads are cached as expected: `/p/[slug]` is `revalidate = 60`
(`src/app/p/[slug]/page.tsx:19`); `/s/[token]` and `/share/[token]` are
`revalidate = 0` (`src/app/s/[token]/page.tsx:8`,
`src/app/share/[token]/page.tsx:10`).

---

## 9. Cross-tenant reads found while tracing the above

Two are worth recording because Home's briefing sits directly on top of them.

### 9.1 The digest's mention scan is unscoped

`compileDailyDigest` resolves a user and a workspace
(`src/server/db/daily-digest.ts:43-44`), scopes its completed-tasks read
(`:53-60`) and its due-today read (`:69-81`) — and then scans `activities` with
**no workspace predicate at all**:

```
.from(activities)
.leftJoin(users, eq(activities.userId, users.id))
.where(and(eq(activities.kind, "commentAdd"), gte(activities.createdAt, dayStart)))
.limit(50)
```
— `src/server/db/daily-digest.ts:92-104`

It then admits any row whose comment snippet contains `@{userId}`
(`:111-112`) and looks up the task title with a second **unscoped** read
(`:113-116`). A comment in any other tenant that mentions the same handle
surfaces its snippet and its task title into this user's digest.

`compileDailyDigest` is called from `src/app/app/inbox/page.tsx:5` — it is a live
read path, not a dead one.

### 9.2 The static gate cannot see this

`classifyRead` searches for a scope token anywhere in the chain after `.from(`,
and `"userId"` is a **STRONG** token valid "anywhere in the chain after
`.from(`, joins included" (`src/server/tenant-scope-rules.mjs:56-86`, logic at
`:254-276`). The `leftJoin(users, eq(activities.userId, users.id))` above
therefore satisfies the gate — the exact join-is-not-a-restriction false negative
the file's own header says it was written to close
(`src/server/tenant-scope-rules.mjs:24-49`). The header closed it for `.id`; it
remains open for `userId` in a join.

I did not run the gate (no builds permitted). **This is a read of the detector's
logic against the read's text, not an executed result.**

---

## 10. What this forces the Home contracts to say

1. **One project identity: Tasks `workspaces.id`.** Everything else — Timeline
   slugs, analytics tag-slugs, `ms-…` node ids — is a projection resolved from
   it and must be labelled as such at the contract boundary.
2. **One membership seam, or the contract is fiction.** Five exist. Home must
   consume exactly one authorised-workspace-set function and must not add a
   sixth.
3. **Cross-project reads must use `isTaskDone`, never `lane = 'done'`.** All four
   existing cross-project reads violate this today.
4. **"Assigned to me" is new work, not a wiring job.** No query, no index, no
   caller, and no server-side membership validation on the values.
5. **Inbox and Analytics history are both green-field.** The tables look ready
   and are not: `notifications` cannot hold a non-task event and has no
   read-state writer; `analytics_metric_snapshots` has no writer at all.
6. **Home must not enforce a stricter beta gate than the product it fronts.**
7. **Write-back needs workspace-parameterised actions.** Every current mutation
   is cookie-bound to one active workspace.

---

*Compiled read-only at `a849fc40e46787a39e499fc94b171a5dfb898821`. No production
source was modified. No command with side effects was run. Nothing here is
verified beyond what was read.*
