# Contract · MyWorkProjection

**Status:** Sealed (Wave 1). Binding on Wave 7, on every contract test, and on every lab
direction that draws this surface.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Adopts:** `contracts/PROJECT_SCOPE.md` (sealed Wave 1) and, through it,
`docs/adr/0001-canonical-project-identity.md`
**Decisions:** `DECISIONS.md` D-H14 … D-H23
**Failing contract tests:** `src/lib/home-layer/my-work/`

This contract does not define, redefine or extend Project identity. Every Project
statement here is a consumption of `PROJECT_SCOPE.md`. Where the two could be read as
disagreeing, `PROJECT_SCOPE.md` wins and the disagreement is a defect in this file.

Changing anything sealed here requires a new founder-approved ADR or a lead-owned amendment
recorded in `DECISIONS.md`. An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

**It is** the definition of the read projection behind `/app/home/my-work`: what a row is,
what makes a responsibility mine, which sources may contribute one, how rows are grouped,
how the list paginates, what it does when something is missing, and what a write from it is
allowed to look like.

**It is not** an implementation, and it is not a second task database. Charter decision 7
locks that: *"My work is a read projection over source truth. Never a second task
database."* Nothing in this contract stores a task, caches a task, or holds a copy of an
assignment. Every row is derived, per request, from the source that owns it.

**It is also not a write surface in V1.** §11 specifies the interface Wave 7 requires before
a single write ships. At this base the interface does not exist and `HOME_MUTATIONS_ENABLED`
stays default-off (`PROJECT_SCOPE.md` §9).

---

## 1. V1 coverage, and the receipt that keeps the name honest

### 1.1 The sealed scope

> **V1 is complete and truthful for assigned Tasks across the Projects the actor is
> authorized to read. Nothing else contributes a row.**

"Complete" is a claim about Tasks and only about Tasks: within the authorized Project set,
every task assigned to the actor appears, in exactly one group, or the shortfall is
disclosed with a count. It is not a claim about the actor's total responsibilities. Notes
and Timeline do not contribute, and §2 records exactly which gate each fails.

### 1.2 D-H14 · The view keeps the name "My work", and pays for it with a literal receipt

**Decision.** The mode keeps its charter name. Charter decision 4 locks four stable,
text-labelled, route-backed Home modes, and renaming one to "My tasks" for a wave would
either be reversed later (churn on a canonical route, against `R-H06`) or would quietly
narrow a locked product decision. Instead the name is paid for at the point of reading.

**The receipt is a permanent, always-rendered element of the view introduction.** It is not
a tooltip, not an info icon, not a dismissible banner, and not help-centre text. It sits
directly under the "My work" heading, above the first group, in every state including the
empty state, and it is present in the accessible name path of the region.

**Exact V1 copy, sealed:**

> **My work**
> Tasks assigned to you, across the projects you can open. Notes and Timeline are not
> included yet.

**Rules.**
1. The second sentence is removed only when a second source has genuinely passed all seven
   gates in §2 and shipped. It is not removed because a source is "coming".
2. The receipt is never rendered as an error, a warning, or a placeholder tone. It is a
   plain statement of scope.
3. No Home surface anywhere may describe My work as "everything you are responsible for",
   "all your work", or "your complete workload". Those are claims V1 cannot support.
4. The word "workspace" never appears in it (`PROJECT_SCOPE.md` §1, assertion A10).

**Rationale.** The charter's rule 11 forbids rendering partial data as complete. A view
called "My work" that silently reads one of three products is exactly that failure, and it
is undetectable by a reader. A visible one-line scope statement is the cheapest honest fix
and it survives the addition of sources without a redesign.

---

## 2. Join eligibility — the seven gates

Notes and Timeline join this projection **only** when the object they contribute passes all
seven gates. This is a structural test, applied per source, not per row, and it is the
mechanism by which the charter's rule 12 is enforced against a future wave that would
rather ship than qualify.

### 2.1 D-H15 · The gates

| # | Gate | What it requires |
|---|---|---|
| G1 | **Structured accountable object** | A row in a table whose responsibility is a persisted field, not derived from text, tone, or a model's reading of a body. |
| G2 | **Stable owner identity** | The responsibility field holds an identity that resolves to the same person across rename and re-login, and that is comparable to the actor id `PROJECT_SCOPE.md` §3 authorizes on. |
| G3 | **Canonical Project relation** | The object resolves to exactly one Tasks `workspaces.id` (`PROJECT_SCOPE.md` §1) by a stored relation, not by inference. |
| G4 | **Current authorization adapter** | Access is decided by seam 1 per request (`PROJECT_SCOPE.md` §3), through the `src/lib/projects/**` facade, with no cache and no source-local substitute. |
| G5 | **Date and state semantics** | The object exposes a date whose calendar meaning is defined, and a state whose done and waiting readings come from configuration, not from a display name. |
| G6 | **Source revision** | The object exposes a value that changes when anything this projection renders changes, so a stale render is detectable (§9). |
| G7 | **Source action receipt and return path** | Every action offered on the row is executed by the owning source and returns a receipt distinguishable from a refusal (§11), and the row links back to the object in its own product with the Project carried (`PROJECT_SCOPE.md` §10.2). |

### 2.2 Tasks — passes, with two gates conditional

| Gate | Status at this base | Evidence |
|---|---|---|
| G1 | **Pass.** `tasks.assignees` is a persisted column. | `src/server/db/schema.ts:53-56` |
| G2 | **Pass with a recorded hazard.** The column holds `users.id`. | `src/lib/members.ts:8`; see §3.3 for the hazard |
| G3 | **Pass, conditionally.** `tasks.workspace_id` is the canonical relation, but is still nullable: *"Nullable during the cutover; tightened to NOT NULL after the legacy backfill lands."* | `src/server/db/schema.ts:36-41` |
| G4 | **Pass on the facade.** Requires `src/lib/projects/**`, absent at this base. | `PROJECT_SCOPE.md` §11, §13 item 1 |
| G5 | **Pass for done. Incomplete for waiting.** `doneKeys` is configured; there is no `waitingKeys`. | `src/lib/board-config.ts:36`; `src/lib/board-columns.ts:183-208`; §7.3 |
| G6 | **FAIL as shipped.** `tasks.updatedAt` is not stamped by every write path. | `src/server/actions/board.ts` contains zero `updatedAt` references; §9 |
| G7 | **FAIL as shipped.** Mutations bind to the cookie and no-op silently. | `src/server/actions/tasks.ts:122`, `:166`, `:411`; §11 |

G6 and G7 are closed by this contract's own preconditions (§9.2, §11). Tasks is the V1
source because its remaining gaps are specifiable and owned. They are not waived.

### 2.3 Notes — fails G1, G2 and G3. Excluded from V1.

Notes has **no assignment concept at all**. The columns are `id, userId, body, createdAt,
updatedAt, extractBody, promotedTaskId, archivedAt, workspaceId` and a provenance marker
(`src/modules/notes/server/db/notes-schema.ts:40-62`). There is no assignee, no owner other
than the tenant, and no responsibility field.

- **G1 fails.** The only candidate signal is the note body, and the schema forbids reading
  it outward: *"body is private to the owner… Only the extract_body (creator-authored,
  deliberate) ever leaves Notes."* (`src/modules/notes/server/db/notes-schema.ts:19-22`).
- **G2 fails as a category error.** `notes.user_id` is the tenant, not an assignment. Every
  note a person owns would become a responsibility, which makes the projection meaningless.
- **G3 fails.** `notes.workspace_id` is documented as *"Optional projection… A null value is
  the normal, durable 'Unfiled' state"* (`:54-62`), and it is filing metadata that never
  grants or restricts access (`PROJECT_SCOPE.md` §2.4).

**Sealed.** Note ownership is never a responsibility. A note's `extract_body` is not a
responsibility either: it is creator-authored wording that already has a task if it was
promoted, and that task is the row. Surfacing the note as well would double-count the same
responsibility, which §6 forbids.

### 2.4 Timeline — fails G2 and G3. Excluded from V1.

Timeline **does** have an `assignee` column, and that is precisely the trap.

```
assignee: text("assignee").$type<AssigneeKind>().notNull().default("claude-code"),
```
— `src/modules/timeline/server/db/timeline-schema.ts:179` (tasks), `:245` (subtasks),
indexed at `:219`.

`AssigneeKind` is a closed set of **role personas**, not user identities: `"ethan"`,
`"creative-director"`, `"senior-engineer"`, `"qa"`, `"pm"`, `"architect"`, `"claude-code"`
and siblings (`:116-134`). The default on every row is `"claude-code"`.

- **G2 fails.** `"ethan"` is a label, not an identity. It does not resolve to a `users.id`,
  it is not comparable to the actor id seam 1 authorizes on, and it is identical for every
  workspace in the estate. Treating it as ownership would assign every unlabelled Timeline
  row in every Project to an agent persona, and every `"ethan"` row to whichever human is
  reading.
- **G3 fails.** A Timeline row's Project relation is the composite `(workspace_slug, slug)`
  (`:86-88`), which `PROJECT_SCOPE.md` §2.2 seals as **never a Project**. The only join key
  back to a Project is `projects.source_tasks_workspace_id`, which is nullable and means
  manual-only when null (`:80-84`).

**Sealed.** A Timeline label is never an ownership claim. Milestones already reach Home
through their Tasks origin when one exists: a promoted milestone is a Tasks row
(`tasks.isMilestone`, `src/server/db/schema.ts:140-146`) synced outward as
`` `ms-${tasksWorkspaceId}-${tasksTaskId}` `` (`src/modules/timeline/server/sync/tasks-milestone-source.ts:161`).
The Tasks row is the responsibility. The Timeline node is its projection, and projecting a
projection is how the same work gets counted twice.

### 2.5 D-H16 · Responsibility is assignment, and only assignment

None of the following ever creates, implies or upgrades a row in this projection. This list
is a prohibition, not a V1 deferral: a later wave that adds a source must pass §2.1's seven
gates, and no wave may reach a row by any of these routes.

| Excluded signal | Why |
|---|---|
| Prose in a task description, a comment, or a note body | Not structured. Charter rule 12: AI may phrase authorized facts, never invent ownership. |
| Any model output, summary, extraction or ranking | Charter rule 12. Ownership is read, never inferred. |
| A mention of the actor in a comment | A mention is an event for Inbox (Wave 6), not a responsibility. The mentions query is also cross-tenant unscoped at this base (`R-H15`, `src/server/db/daily-digest.ts:90-104`) and must not be built on. |
| Note ownership (`notes.user_id`) | §2.3. |
| Timeline `assignee` labels | §2.4. |
| Task authorship (`activities` "taskAdd", or any created-by reading) | Creating work is not being accountable for it. There is no `created_by` column on `tasks` to read even if it were. |
| Project ownership or `workspace_members.role = "owner"` | Membership is authorization (`PROJECT_SCOPE.md` §3.1), never assignment. |
| Watching, following, or having commented | No such relation exists, and none of them is accountability. |
| `tasks.externalContactName` / `externalContactEmail` | Explicitly an outside person who is not a member (`src/server/db/schema.ts:82-86`). |

---

## 3. Responsibility — the assignment truth

### 3.1 Assignment is a JSON column, not a relation

```
assignees: text("assignees", { mode: "json" })
  .$type<UserId[]>()
  .notNull()
  .default(sql`'[]'`),
```
— `src/server/db/schema.ts:53-56`

There is no `task_assignments` table and no `task_assignees` table in
`src/server/db/schema.ts`. The index list on `tasks` is
`idx_tasks_workspace_id`, `idx_tasks_parent_task_id`, `idx_tasks_ws_lane`,
`idx_tasks_due_at`, `idx_tasks_ws_milestone`, `idx_tasks_source_note_id`
(`src/server/db/schema.ts:156-171`). **Nothing indexes assignment.**

### 3.2 An exact cross-Project "assigned to me" query is not possible today

Four reasons, all verified at this base.

1. **No such query exists.** The only assignee-scoped read is
   `getTasksForUser(userId, workspaceId)` (`src/server/db/queries.ts:320-343`). It is
   workspace-scoped by construction (`byWorkspace(...)` at `:331`) and it has **zero
   callers** repo-wide. It is dead code.
2. **The match is a `LIKE`, not an equality.**
   `` like(tasks.assignees, `%"${escapedId}"%`) `` (`:335`), with a hand-rolled `escapeLike`
   for `%`, `_` and `\` at `:310-312`. The same pattern is duplicated in
   `src/server/db/daily-digest.ts:69-79`. It is a full-table scan per Project, it cannot use
   an index, and it is exact only because of a surrounding double-quote convention that no
   constraint enforces. Clerk ids contain `_`, which is a LIKE wildcard, which is why the
   escape exists at all.
3. **The shipped surfaces are the wrong shape.** `/app/my-tasks` renders `MyWeekApp` over the
   client `TasksContext` (`src/components/app/my-week/my-week-app.tsx:38`), i.e. the active
   Project's board filtered client-side. `listYourWorkForUser` *is* cross-Project
   (`src/server/planning/queries.ts:67-137`) but groups by **Project** and never touches
   `assignees`; it also hardcodes `lane = 'done'` (`:100`, `:102`, `:107`) and filters
   neither `archived_at` nor `parent_task_id`.
4. **Reading it cross-Project today would be unbounded.** `listYourWorkForUser` caps at
   `.limit(2000)` on Projects (`:135`) and `getTasksForUser` caps at `.limit(2000)` on rows
   (`queries.ts:339`). Both are unordered-relative-to-the-cap truncations. §10 forbids
   reusing that shape.

SQLite can express the query with `json_each`, and the estate already uses that idiom for
tags (`src/modules/signal/server/analytics/policy.ts:213-216`). It would still be unindexed.
That is not good enough for a cross-Project surface, so §4 specifies the relation.

### 3.3 Three hazards the projection must survive, not design around

1. **Assignees are never validated against membership.** `assignees` is in
   `PATCHABLE_TASK_COLUMNS` (`src/server/actions/tasks.ts:365-384`) and is written straight
   through (`:446-449`); `addTaskAction` writes `assignees: input.assignees ?? []` unchecked
   (`:561`). `getWorkspaceMemberMeta` is a display roster only (`src/server/db/members.ts:21-64`).
2. **Removal and erasure leave assignment behind.** `removeMemberAction` deletes the
   `workspace_members` row and touches `tasks` not at all
   (`src/server/actions/settings.ts:177-209`). Account erasure clears
   `sourceNoteId`, `sourceNoteExtractBody` and `sourceNoteExtractSha256` from tasks
   (`src/server/account-erasure.ts:189-202`) and deletes the membership row (`:204-206`),
   but never removes the erased id from `assignees`. Stale assignment is therefore normal
   and durable, not exceptional.
3. **The actor id is not always the stored id.** `getCurrentUser()` returns `users.id`
   normally, but returns the raw Clerk id when the provisioning webhook has not landed yet
   (`src/server/auth.ts:111-120`), and a dev fallback outside production (`:124`).

**How the projection survives them.** Hazards 1 and 2 are closed by authorization, not by
filtering: a row only appears if its Project is in the actor's live authorized set
(`PROJECT_SCOPE.md` §3 rule 4, revalidated per request). A person removed from a Project
stops seeing its rows on their next request, because the Project leaves the set. No
membership check is performed on the assignment itself, so a row assigned to a non-member is
never silently dropped and never silently shown to the wrong person.

Hazard 3 is closed by refusal, not by guessing. When the resolved actor id is a Clerk id
with no `users` row, the projection **does not run an assignment query**. It renders
`identity-unresolved` (§12) and says so. Matching on a provisional id would produce an empty
list that looks exactly like "nothing is assigned to you", which is the failure mode rule 11
exists to prevent.

---

## 4. D-H17 · The `task_assignments` migration

An exact, indexed, cross-Project "assigned to me" read is a hard prerequisite for this
projection. The JSON column cannot provide it (§3.2). This section specifies the additive
normalisation.

**Ownership.** The Tasks database and its migration ledger own this. This contract specifies
it; it does not author it. The highest registered migration at this base is `0027`
(`drizzle/migration-ledger.json`, last entry `ordinal: 27`, `id: "0027_share_link_token_hash"`),
so the file takes the next free forward ordinal at the time it is written, not a number
pinned here.

### 4.1 Shape

```sql
CREATE TABLE task_assignments (
  task_id      TEXT    NOT NULL,
  user_id      TEXT    NOT NULL,
  workspace_id TEXT,             -- denormalized from tasks.workspace_id; nullable
                                 -- for exactly as long as tasks.workspace_id is
                                 -- (schema.ts:36-41). NOT a second Project identity.
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX idx_task_assignments_user       ON task_assignments (user_id);
CREATE INDEX idx_task_assignments_user_ws    ON task_assignments (user_id, workspace_id);
CREATE INDEX idx_task_assignments_task       ON task_assignments (task_id);
```

**No foreign key to `users`.** Hazard 2 in §3.3 makes one unsafe: erasure deletes membership
without touching assignment, and a cascade would silently rewrite other people's history
during an erasure. The absence of the FK is deliberate and is the reason `user_id` may
reference an erased account. Rows in that state are reported by the backfill (§4.2) and are
never rendered to anyone, because their Project authorization is what gates them.

**No FK to `tasks` either, for the same reason the ledger's legacy chain is frozen:** a
cascade added in a later migration against a non-idempotent history is a production risk
(`AGENTS.md` "Database release gate"). Orphan rows are instead reported by the parity check
(§4.4) and excluded by the join.

### 4.2 Backfill, with malformed-row reporting and per-Project counts

The backfill reads every `tasks` row and expands `assignees`. It is **not** permitted to
skip a row it cannot parse. For each row it produces exactly one outcome:

| Outcome | Definition | Action |
|---|---|---|
| `expanded` | `assignees` parses as a JSON array of non-empty strings | one relation row per distinct id |
| `empty` | parses as `[]` | no relation rows, counted as `empty` |
| `malformed` | not valid JSON, or not an array, or contains a non-string, or contains an empty string | **no relation rows, and the row id is reported** |
| `duplicated` | the array contains the same id more than once | one relation row, and the duplication is reported |

The backfill emits a receipt containing, at minimum: total tasks read; counts of each
outcome; **per-Project counts of tasks read and assignment rows written, keyed by
`workspace_id` with a separate explicit bucket for `workspace_id IS NULL`**; and the
complete list of `malformed` and `duplicated` task ids. A backfill that reports zero
malformed rows without having counted them is not a receipt.

**The receipt is required to be non-empty on a populated database.** A run that reports
`0 tasks read` on a database with tasks fails, in the same posture the harness already
takes elsewhere: `perf:budgets` exits 3 with *"Refusing to report a measurement of zero"*
(`RISK_REGISTER.md` R-H04 note). This backfill adopts that refusal.

### 4.3 Additive, and JSON stays authoritative through the rollback window

Ordered, and no step may be merged with the next.

1. **Expand.** Create the table and indexes. Nothing reads it. `tasks.assignees` is
   unchanged and remains the only authority.
2. **Dual-write.** Every assignment write path writes both, transactionally (§4.5). Reads
   still come from JSON.
3. **Backfill.** Run §4.2 against production through the receipt-backed runner
   (`pnpm db:migrate`; `AGENTS.md` "Database release gate"). Never `drizzle-kit push`,
   never `drizzle-kit migrate`.
4. **Parity.** Prove §4.4 green, twice, on separate days, with the second run after at
   least one full day of live dual-writes.
5. **Read cutover.** The projection reads the relation. JSON is still written and still
   correct. This is the rollback point: reverting the read is a code change with no data
   change.
6. **Canonical write cutover.** Only after §4.4 has been green on two consecutive runs
   post-read-cutover does the relation become the write authority. JSON continues to be
   written for compatibility until a separate, later contract step retires it.

**JSON compatibility is retained through the entire rollback window and is not shortened for
convenience.** Six shipped paths read `assignees` directly and none of them is in scope
here: `src/lib/nudges/generate-nudges.ts:135`, `src/lib/tasks/selectors.ts:68` and `:133`,
`src/modules/signal/lib/data/source.ts:210-220`,
`src/modules/signal/server/analytics/providers/tasks.ts:69-71`, `:95`, `:126`, and
`src/modules/signal/server/analytics/providers/notes.ts:52`, `:66`, `:155`. The analytics
providers read a **separate mirror database** whose own schema carries `assignees`
(`src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts:24`), so the mirror must be
considered explicitly before JSON is retired. It is out of scope for this contract and is
recorded in §13.

### 4.4 Parity proof

A check, runnable on demand and in CI, that compares JSON and relation for every task and
fails on any difference. It reports, per Project:

- tasks whose JSON id set differs from their relation id set, with both sets;
- relation rows whose `task_id` has no `tasks` row (orphans);
- relation rows whose `workspace_id` disagrees with `tasks.workspace_id`;
- the count compared, and the count skipped, with the reason for every skip.

**A parity run that compared nothing reports `unmeasured`, never `pass`.** This mirrors
`check:contrast`, which reports `0 contrast failure(s) … 6 unmeasurable surface(s)` rather
than a pass on an empty population (`RISK_REGISTER.md` R-H04).

### 4.5 Transactional dual-write from every assignment mutation path

Every path below writes `tasks.assignees`. Each must write the relation **in the same
transaction as the JSON write**, and a failure of either must roll back both. A path that
writes JSON only is a parity break by construction. Enumerated and line-verified at this
base, and re-derived at implementation time.

| # | Path | Verified line | Shape |
|---|---|---|---|
| 1 | `updateTaskAction` (`assignees` is patchable) | allowlist `src/server/actions/tasks.ts:370`; write at `:446-449` | update |
| 2 | `addTaskAction` | `src/server/actions/tasks.ts:561` | insert |
| 3 | `duplicateTaskAction` **in `tasks.ts`** | `src/server/actions/tasks.ts:816` (parent) and `:847` (children) | insert |
| 4 | `duplicateTaskAction` **in its own module** | `src/server/actions/duplicate-task.ts:138`, insert at `:162` | insert; a second, separate duplication path |
| 5 | `importTasksAction` | `src/server/actions/import.ts:149`, inside `tx` | insert |
| 6 | Planning duplication | `src/server/actions/planning.ts:1158`, inside `tx`; member filter at `src/lib/planning/duplication.ts:61` | insert; already filters to copied members |
| 7 | Notes extract receivers | `src/app/api/notes-extract/route.ts:124`, `src/app/api/notes-extract/v2/route.ts:209` | insert with `assignees: []`; writes zero relation rows, and is still routed through the helper so the invariant is structural, not conditional |
| 8 | Template application | `src/server/actions/templates.ts:121`, `src/server/db/apply-template.ts:74` | insert with `assignees: []` |
| 9 | Seed paths | `src/server/db/seed-published-wedding.ts:102` (literal); `src/server/actions/seed.ts:106` and `src/server/db/seed.ts:106` write assignment through an **object spread**, so they carry no literal `assignees:` token | insert; fixtures that diverge from production make every fixture-backed test lie |

**Note on row 9.** The two spread-based seed paths are why a text scan for `assignees:` is a
lower bound, not the answer. The enumeration above is the answer; the scan is the guard that
catches a new literal path.

**Sealed.** No new code path may write `tasks.assignees` directly. All of them go through one
helper, `src/server/db/task-assignments.ts`, exporting `writeTaskAssignments`, which owns
both writes. This is the only mechanism that makes §4.4 provable rather than hopeful.

---

## 5. The time frame — time, and only time

`MyWorkTimeFrame` is the serialized time and locale frame the projection is evaluated
against. It carries no Project identity: Project context is `PROJECT_SCOPE.md`'s
`workspaceId` and `briefingScope`, and duplicating either here would recreate the ambiguity
D-H04 closed.

**Naming, and a recorded collision.** The programme brief called this "HomeContext". That
name is now taken: `contracts/HOME_CONTEXT.md`, sealed by a sibling Wave 1 lane, uses
`HomeContext` for the **authorization seam** (`authorizeHomeContext`, `HomeContextResult`,
`HomeContextView`, `HomeContextRefusal`). Two contracts using one name for an authorization
result and a time frame is exactly the ambiguity `PROJECT_SCOPE.md` §1 refused for
`projectId`. This lane renames its own type rather than argue for the name. The substance is
unchanged. **The overlap itself is recorded for the lead** (§13 item 8): that contract's
cache partition key already carries `locale + timezone`, so the two must agree on one
resolution order, and this section is this lane's answer to it.

```ts
type MyWorkTimeFrame = Readonly<{
  /** The instant the read was taken. */
  nowIso: string;
  /** Today's calendar date in `timeZone`. */
  today: CalendarDate;          // "YYYY-MM-DD"
  /** IANA zone the grouping is computed in. */
  timeZone: string;
  /** How `timeZone` was resolved. Rendered when it is not "preference". */
  timeZoneSource: "preference" | "fallback";
  locale: string;
}>;
```

### 5.1 D-H20 · Resolution, fallback and disclosure

1. `user_preferences.time_zone` when non-null and a valid IANA zone
   (`src/server/db/preferences.ts:15`, column at `src/server/db/schema.ts:717`, validated by
   `assertIanaTimeZone`, `src/lib/planning/dates.ts:41-50`) → `timeZoneSource: "preference"`.
2. Otherwise **UTC**, matching the column's own declared contract, *"IANA tz string.
   Optional, falls back to UTC when null"* (`src/server/db/schema.ts:717`) and
   `planning_periods.timezone`'s `NOT NULL DEFAULT 'UTC'` (`:229`)
   → `timeZoneSource: "fallback"`.

**When `timeZoneSource` is `"fallback"` the view says so, always, in the same permanent
position as the §1.2 receipt:**

> Dates are grouped in UTC. Set your time zone to see them in your own.

**Rules.**
- The projection **never reads the browser clock or the browser time zone** to group. It
  consumes the server frame, for the reason `CalendarFrame` already records: *"Client views
  must consume this frame instead of reading the browser clock, so SSR and hydration agree
  about 'today'"* (`src/lib/calendar-frame.ts:17-21`).
- A Planning Period's `timezone` is **not** used. A Planning Period may widen Read Scope and
  is never an authority (`PROJECT_SCOPE.md` §2.5); letting it set the grouping zone would
  make the same task fall in different groups depending on which scope is selected.
- The zone never varies between rows. One read, one zone, disclosed.

### 5.2 DST

Every boundary in §7 is a **calendar-date** comparison in `timeZone`, computed with the
existing helpers: `calendarDateInTimeZone` (`src/lib/planning/dates.ts:67-84`) to project an
instant onto a local date, and `calendarDaysBetween` / `daysUntil` (`:58-64`, `:86-95`),
which subtract calendar ordinals (`calendarOrdinal`, `:52-56`).

**Sealed.** The projection never computes a window by adding a fixed millisecond offset.
`+ 7 * 24 * 60 * 60 * 1000` is prohibited: across a DST transition it is 167 or 169 hours,
which silently moves a task between Next and Later on exactly two days of the year, in one
direction only, and no user can see why. Calendar arithmetic is DST-immune by construction,
which is why it is the only permitted form.

The spring-forward day has no 00:00–01:00 in some zones and the autumn day has 01:00–02:00
twice. Neither affects grouping, because grouping never reads a wall-clock time. A task's
group depends only on which local calendar date its `dueAt` instant falls on.

---

## 6. The row

Exactly one row per responsibility. Deduplication is by `taskId`: a task assigned to the
actor twice by a malformed JSON array (§4.2 `duplicated`) yields one row.

```ts
type MyWorkRow = Readonly<{
  // ── identity ──────────────────────────────────────────────────────────
  /** Source-qualified and stable. V1 is always `tasks:${taskId}`. */
  key: string;
  source: "tasks";                       // the only V1 value; §2
  taskId: string;
  /** Canonical Project. Branded; never a slug, never a Label. PROJECT_SCOPE §1. */
  workspaceId: ProjectId;
  projectName: string;                   // resolved from the record, never templated
  /** Per-Project display counter, or null. schema.ts:42-49 */
  seq: number | null;

  // ── content ───────────────────────────────────────────────────────────
  title: string;
  /** True when the task is a promoted milestone. schema.ts:140-146 */
  isMilestone: boolean;

  // ── responsibility ────────────────────────────────────────────────────
  /** Always includes the actor, or the row does not exist. */
  assigneeIds: readonly string[];
  /** How many others share it. Names are NOT resolved cross-Project in V1. */
  coAssigneeCount: number;

  // ── date ──────────────────────────────────────────────────────────────
  /** Structured instant, or null. schema.ts:61 */
  dueAtIso: string | null;
  /** dueAtIso projected onto the frame's timeZone, or null. */
  dueDate: CalendarDate | null;
  /** Verbatim human label. schema.ts:57 Rendered only as written. */
  dueLabel: string | null;
  /** Set when `dueLabel` exists, `dueAtIso` is null, and the label did not
   *  parse. The row is undated AND the reader is told a label exists. */
  dueUnparsed: boolean;

  // ── state ─────────────────────────────────────────────────────────────
  /** COALESCE(boardColumnKey, lane). board-columns.ts:155-164 */
  columnKey: string;
  /** The Project's display name for that column, resolved through its own
   *  config. Never used to decide anything. board-columns.ts:172-179 */
  columnLabel: string;
  /** isTaskDone against the Project's REAL config. board-columns.ts:200-208 */
  isDone: boolean;
  /** Ids in `blockedBy`. schema.ts:67 */
  blockedByIds: readonly string[];
  /** §7.3. "unknown" when the Project has no waiting signal available. */
  waiting: "blocked-by-dependency" | "in-waiting-column" | "no" | "unknown";

  // ── grouping ──────────────────────────────────────────────────────────
  group: "waiting" | "now" | "next" | "later";
  /** The single rule that placed it. Deterministic, and testable. §7.5 */
  groupReason: MyWorkGroupReason;

  // ── freshness and return path ─────────────────────────────────────────
  /** §9. Field-scoped, and honest about what it does not cover. */
  sourceRevision: string;
  /** The instant this row's source was read. */
  readAtIso: string;
  /** Carries workspaceId. PROJECT_SCOPE §10.2. */
  href: string;
  /** What the actor may do from here, verified, never inferred. §11.2 */
  capabilities: Readonly<{ complete: CapabilityState; reassign: CapabilityState }>;
}>;

type CapabilityState = "allowed" | "denied" | "unverified";
```

**Field rules.**

1. **`projectName` resolves from the record.** It is never templated. The existing briefing
   writes provenance as the literal `` `Tasks · ${workspaceName}` ``
   (`src/modules/signal/server/briefing/signal-build-for-user.ts:331`), which is the exact
   pattern `REPOSITORY_TRUTH.md` finding 1 requires to be replaced the moment a second
   product feeds Home.
2. **`href` always carries `workspaceId`.** Home's own evidence links omit it today
   (`src/app/app/home/home-data.ts:82-84` emits `/app/task/${id}`), and `/app/task/[id]`
   accepts no Project parameter at all (`src/app/app/task/[id]/page.tsx:15-17`). Assertions
   A6 and A8 in `PROJECT_SCOPE.md` §12 own the destination; this contract owns the emission,
   and both are required before the link is honest.
3. **`dueLabel` is rendered verbatim or not at all.** It is free text
   (`src/server/db/schema.ts:57`). It is never parsed for display and never used for
   grouping (§7.4).
4. **`coAssigneeCount` is a count, not names.** Resolving member names cross-Project needs a
   per-Project roster read (`src/server/db/members.ts:21-64`) whose ids may not be members
   (§3.3 hazard 1). V1 shows the count. Names arrive with a resolver that can distinguish
   "a member", "no longer a member" and "unknown", or they do not arrive.
5. **`capabilities` is never inferred from a role label** (`PROJECT_SCOPE.md` §3.1,
   D-H11). `"unverified"` is a real, renderable state and is never rendered as `"denied"`.
6. **No field is ever defaulted to a truthful-looking value.** `dueDate: null` means undated.
   `waiting: "unknown"` means unknown. Neither is rendered as "no".

---

## 7. Grouping

### 7.1 D-H18 · Four groups, one row, deterministic precedence

```
Waiting  >  Now  >  Next  >  Later / No date
```

**Every included row lands in exactly one group.** Precedence is evaluated top to bottom
and the first match wins. A row is never counted in two groups, never rendered twice, and
never omitted from all four.

### 7.2 Exact definitions

Let `T = ctx.today`, the calendar date in `ctx.timeZone` (§5). Let `D = row.dueDate`, the
row's `dueAtIso` projected onto the same zone, or `null`.

| Group | Definition | Reason code |
|---|---|---|
| **Waiting** | `row.waiting === "blocked-by-dependency"` or `row.waiting === "in-waiting-column"` | `blocked-by-dependency` · `in-waiting-column` |
| **Now** | not Waiting, and `D !== null` and `D <= T` | `overdue` when `D < T` · `due-today` when `D === T` |
| **Next** | not Waiting, and `D !== null` and `T < D <= T+7` | `within-seven-days` |
| **Later / No date** | everything else: `D > T+7`, or `D === null` | `beyond-window` · `no-date` |

**The window is exactly seven local calendar days: `T+1` through `T+7` inclusive.** Bounds
are computed by calendar-ordinal arithmetic (§5.2), not by instant arithmetic. `T+7` is in
Next; `T+8` is in Later.

**Within Later, order is dated rows first (ascending `D`), then undated rows.** Undated rows
carry a visible "No date" marker. They are one group for precedence and counting, and two
labelled partitions for reading, so a row is still in exactly one group.

### 7.3 D-H19 · Waiting comes from structure, never from a display name

**`row.waiting` is derived from exactly two signals, in this order.**

1. **`blockedByIds.length > 0`** → `"blocked-by-dependency"`. `blockedBy` is the only
   first-class blocking relation in the schema (`src/server/db/schema.ts:67`), and it is
   already the estate's blocked predicate: the briefing derives blocked from
   `blockedBy.length > 0` and nothing else (`src/modules/signal/lib/data/source.ts:134`).
2. **`columnKey === WAITING_COLUMN_KEY`** → `"in-waiting-column"`.
   `WAITING_COLUMN_KEY` is the literal `"waiting"` (`src/lib/board-columns.ts:49`). It is a
   **stable key**, and it is deliberately matched as a key.
3. Otherwise `"no"` — unless the Project has no waiting signal available, in which case
   `"unknown"` (below).

**Why this is keyed, and what it protects against.**

"Waiting" is a *default custom column*, not a lane. `LaneId` is exactly four values
(`src/lib/data.ts:1`) and `LANE_ORDER` is `["todo","doing","review","done"]` (`:205`). A task
in Waiting persists as `lane: "doing", boardColumnKey: "waiting"`
(`src/lib/board-columns.ts:216-223`). Legacy pre-0024 rows still hold raw `lane = "waiting"`
text and resolve to the same key through `effectiveColumnKey`
(`src/lib/board-columns.ts:23-25`, `:155-164`), so both worlds group identically. Owners can
rename, recolour or delete the column (`:18-22`).

Because the key is stable, **renaming the column to "Waiting on the venue" changes nothing**.
That is the point of keying on it.

**Sealed prohibition.** No other column contributes Waiting, whatever it is called. A custom
column named "Blocked", "On hold" or "Waiting on client", with a key of `blocked`,
`on-hold` or `waiting-on-client`, is **not** Waiting in V1. Nothing in `ColumnConfig`
declares those semantics, so reading them from the display name would be guessing, and
guessing wrong is invisible to the reader. `ColumnConfig` carries `system`, `custom`,
`order`, `colors`, `descriptions`, `limits` and `doneKeys`
(`src/lib/board-config.ts:29-37`) and there is **no `waitingKeys`**.

**`"unknown"`, and its receipt.** When a Project's stored config exists and contains no
column whose key is `"waiting"`, that Project has deleted its Waiting column and V1 has no
waiting signal for it. Its rows get `waiting: "unknown"` unless `blockedBy` fires, they are
grouped by date, and the view discloses it:

> Two projects have no Waiting column. Work held there is grouped by date instead.

They are **not** silently grouped as "no". "No waiting signal" and "not waiting" are
different statements and rule 11 requires them to stay different.

**Required extension, owned elsewhere.** A `waitingKeys: string[]` on `ColumnConfig`,
mirroring `doneKeys` exactly (parse at `src/lib/board-config.ts:141`, `:159`, `:184`,
resolver at `src/lib/board-columns.ts:183-186`), would close this properly. It is a Tasks
board-config change in `src/lib/board-config.ts` and `src/server/actions/board.ts`, owned by
the Tasks surface, not by Home. Recorded in §13.

### 7.4 Done, and undated work

**`isDone` is `isTaskDone(row, config)` against the Project's real config, always.**
`isTaskDone` is declared THE predicate for every surface — *"progress percentages, briefs,
digests, exports, nudges, card strikethrough"* (`src/lib/board-columns.ts:194-208`), with
`resolveDoneKeys` defaulting to `["done"]` only when the config is genuinely absent
(`:183-186`). The config is read per Project with `readWorkspaceColumnConfig`
(`src/server/db/board-config-read.ts:12-27`).

**Passing `null` config to get `["done"]` is prohibited.** Four existing cross-Project reads
do exactly that or worse (`PROJECT_SCOPE.md` §5 rule 5): `getOverdueAcrossWorkspacesAction`
hardcodes `ne(tasks.lane, "done")` (`src/server/actions/cross-workspace.ts:105`);
`listYourWorkForUser` hardcodes `lane = 'done'` four times
(`src/server/planning/queries.ts:100`, `:102`, `:107`); the analytics providers pass `null`
because their mirror has no `board_column_key` column and no `meta` table
(`src/modules/signal/server/analytics/providers/tasks.ts:113-118`,
`providers/notes.ts:101-105`); the briefing maps lanes through a fixed table
(`src/modules/signal/lib/data/source.ts:112-117`). A Project that renamed Done or marked a
second column done is measured wrongly by all four, silently. This projection reuses none of
them.

**Done rows are excluded from My work by default**, and the exclusion is stated as a filter
the reader can see and reverse, never as an absence. A completed task is not a
responsibility. When a Project's config is unreadable, its rows are **not** rendered as
not-done: the Project degrades to `source-unavailable` (§12) rather than contributing rows
whose done-ness was guessed.

**Undated work is Later, never Now.** A task with no date is not urgent and is not overdue.
`dueUnparsed` exists so a row carrying a human label that did not parse is visibly undated
rather than invisibly missing, and it never guesses the date. The two-branch parse heuristic
in `getOverdueAcrossWorkspacesAction` (`src/server/actions/cross-workspace.ts:108-140`) is
not reused: an ISO string recovered from free text is a guess, and a guess that moves a row
into Now is a false alarm the reader cannot audit.

### 7.5 Row filters, applied before grouping

Every filter below is structural. None is a heuristic.

| Filter | Rule | Evidence |
|---|---|---|
| Project authorization | Only Projects in the live authorized set for the current Read Scope | `PROJECT_SCOPE.md` §3, §5 |
| Archived Projects | Excluded by default; included only on an explicit, labelled toggle | `PROJECT_SCOPE.md` §8.3, D-H08 |
| Archived tasks | `archived_at IS NULL` | `src/server/db/schema.ts:143-149`; `getTasks` filters it, `src/server/db/queries.ts:102-111` |
| Subtasks | `parent_task_id IS NULL` | `src/server/db/schema.ts:76-82`; subtasks live under their parent, never in a list |
| Unprojectable rows | `workspace_id IS NULL` rows are excluded, **and the exclusion is disclosed with a count** | `PROJECT_SCOPE.md` §6, D-H05; nullability at `src/server/db/schema.ts:36-41` |
| Done | Excluded by default (§7.4) | `src/lib/board-columns.ts:200-208` |

`getOverdueAcrossWorkspacesAction` filters neither `archived_at` nor `parent_task_id`
(`src/server/actions/cross-workspace.ts:98-108`), and `listYourWorkForUser` filters neither
either. That divergence is the reason these filters are written down rather than inherited.

---

## 8. Pagination

### 8.1 D-H22 · A stable keyset cursor, and no unordered hard cap

**Sealed.** The projection paginates by an opaque keyset cursor over a **total order**. It
never applies an unordered `.limit(N)` to a set it then presents as the whole set.

The total order, applied identically to every group and to every page:

```
1. dueDate ASC, with NULL last
2. workspaceId ASC          (stable, canonical, and does not rename)
3. taskId ASC               (primary key; the tiebreak that makes the order total)
```

`position` is deliberately not in the order. It is a per-lane float within one board
(`src/server/db/schema.ts:70-74`) and has no meaning across Projects.

The cursor encodes the last row's `(dueDate, workspaceId, taskId)` tuple and the
`ctx.today` it was computed against. A cursor whose `today` differs from the current
`ctx.today` is **rejected**, not silently reused: the day rolled over, the groups moved, and
continuing would skip or repeat rows across the boundary. The rejection returns the first
page with an explicit `day-rolled-over` reason, never a silently different result set.

### 8.2 What the existing caps do, and why they are not reused

| Existing cap | Behaviour | Why it is prohibited here |
|---|---|---|
| `getTasksForUser` `.limit(2000)` | ordered by lane then position, per Project | Per-Project cap on a cross-Project read: one busy Project can exhaust it and the rest vanish with no signal (`src/server/db/queries.ts:337-339`) |
| `listYourWorkForUser` `.limit(2000)` on Projects, `.limit(200)` on periods | ordered by position | Truncates the Project set itself; a member of 2,001 Projects silently loses one (`src/server/planning/queries.ts:85`, `:135`) |
| `compileDailyDigest` global `.limit(50)` | applied **before** user filtering | The recorded live defect: a user's genuine mentions are dropped whenever other tenants are busier (`REPOSITORY_TRUTH.md` §"Two live production defects", `src/server/db/daily-digest.ts:90-104`) |

### 8.3 Counts

A group header count is the **count of rows in that group on the current page**, or the
**exact total for the group** when the total was actually computed. It is never the larger
of the two and never a page count presented as a total. When a total is not computed, the
header says how many are shown and does not imply a total.

**Sealed.** No count is ever rendered when its population was truncated, incomplete or
partially authorized, unless the same line carries the shortfall. Rule 11 applies to
integers first.

---

## 9. Source revision, and staleness

### 9.1 D-H21 · `tasks.updatedAt` is not a revision token — new finding at this base

**`src/server/actions/board.ts` contains zero references to `updatedAt`** (verified: the
identifier does not appear in the file). Two of its write paths change a task's effective
column without stamping it:

- `moveTaskToColumnAction` updates `lane`, `boardColumnKey` and `completedAt` with no
  `updatedAt` in either branch (`src/server/actions/board.ts:585-637`, writes at `:606-616`
  and `:624-633`).
- `deleteColumnAction` rewrites `lane` and `boardColumnKey` for every task in the deleted
  column, in three branches, with no `updatedAt` (`src/server/actions/board.ts:465-546`,
  writes at `:526-546`).

`bump()` returns `{ updatedAt: new Date(...) }` (`src/server/actions/tasks.ts:69-71`) and is
spread into twelve writes across `src/server/actions/*.ts`. `timeline-drag.ts` sets
`patch.updatedAt` by hand (`src/server/actions/timeline-drag.ts:73`). Neither reaches
`board.ts`.

**Consequence.** A task can move from To do into Waiting, or out of Waiting into a custom
Done column, with `updatedAt` unchanged. Those are precisely the transitions that move a row
between My work groups. `updatedAt` is therefore not a revision token, and there is no
`revision` column on `tasks`: `revision` exists on `planning_periods`
(`src/server/db/schema.ts:232`), `workspaces` (`:312`) and the planning-onboarding table
(`:426`), and on no task.

This is new. It is recorded by neither audit B, nor `docs/wave/MUTATION_INVENTORY.md`, nor
`PROJECT_SCOPE.md`.

### 9.2 What `sourceRevision` is instead

`sourceRevision` is a stable, deterministic digest over the **exact tuple the projection
reads**, in a fixed field order:

```
workspaceId · lane · boardColumnKey · completedAt · dueAt · due ·
assignees (sorted) · blockedBy (sorted) · archivedAt · parentTaskId · title
```

**What this detects.** Any change to a field this row renders or groups on, including the
two `board.ts` paths that skip `updatedAt`.

**What it does not detect, stated rather than glossed.**
- A change to a field outside the tuple. Such a change cannot alter this row, which is why
  the tuple is scoped to what is read.
- Two changes inside one read window that restore the original tuple exactly. The row is
  then genuinely identical to what was read, and no user-visible fact was lost.
- A change to the Project's `ColumnConfig`, which is not on the task. A config change can
  alter `isDone` and therefore group membership for many rows at once. The config's own
  revision is a separate token and is carried per Project, not per row.

**Precondition, recorded not designed around.** Until every task write path stamps a
monotonic marker, this projection's conflict detection is field-scoped and says so. Closing
it properly means stamping `updatedAt` in `src/server/actions/board.ts`, which is a Tasks
board change and is not this programme's to make. Recorded in §13.

### 9.3 Staleness

`readAtIso` is stamped per row at read time. The view never renders an age it did not
measure and never describes data as current. Where a Project's read failed, its rows are
absent and §12's disclosure carries the reason, rather than the surface showing older rows
as though they were fresh.

---

## 10. Non-ideal states

`unknown` is a first-class rendering everywhere below. None of these states may render as
zero, healthy, complete, empty, or all clear (charter rule 11).

```ts
type MyWorkProjection =
  | { kind: "ready";              rows: MyWorkRow[]; coverage: MyWorkCoverage; cursor: string | null }
  | { kind: "identity-unresolved" }                      // §3.3 hazard 3
  | { kind: "no-projects" }                              // authorized set is genuinely empty
  | { kind: "unavailable";        reason: "source-failed" | "scope-unresolved" };
```

`MyWorkCoverage` extends the estate's existing vocabulary rather than inventing a second
one, as `PROJECT_SCOPE.md` §5 rule 7 requires. `ProviderCoverageStatus` is
`"ready" | "partial" | "stale" | "unavailable" | "unsupported"`
(`src/modules/signal/lib/analytics/contracts.ts:227-232`) and `ProviderCoverage` already
carries status, capabilities, history window, `calculatedAt`, `staleAfter`,
`sourceRecordCount` and `issues` (`:234-245`).

```ts
type MyWorkCoverage = Readonly<{
  status: "ready" | "partial" | "unavailable";
  projectsRead: number;
  projectsAuthorized: number;
  /** Projects in the set that could not be read. Never folded into `projectsRead`. */
  projectsUnresolved: number;
  /** Projects whose ColumnConfig has no "waiting" key. §7.3 */
  projectsWithoutWaitingSignal: number;
  /** Rows excluded because workspace_id IS NULL. PROJECT_SCOPE §6 */
  unprojectableExcluded: number;
  issues: readonly string[];
}>;
```

**Sealed copy for the disclosure lines.** Each is rendered only when its condition holds,
in the same permanent position as the §1.2 receipt, and each states a number.

| Condition | Copy |
|---|---|
| `projectsUnresolved > 0` | "Read 4 of 5 projects. One did not answer, so this list is incomplete." |
| One Project failed entirely | "One project could not be read. Nothing from it is shown, and nothing from it is counted." |
| `projectsWithoutWaitingSignal > 0` | "Two projects have no Waiting column. Work held there is grouped by date instead." |
| `unprojectableExcluded > 0` | "Three tasks are not filed to a project. They are not counted here." |
| `timeZoneSource === "fallback"` | "Dates are grouped in UTC. Set your time zone to see them in your own." |
| `kind: "ready"` with zero rows | "Nothing is assigned to you in these projects." |
| `kind: "identity-unresolved"` | "Your account is still being set up. This list will fill in shortly." |

The zero-row line is deliberately not "You are all caught up" and not "All clear". V1 reads
one product; a completeness claim across three would be false, and it is the exact claim
rule 11 names.

---

## 11. Writeback — the central problem

### 11.1 What is broken, exactly

Every Tasks mutation binds its tenant to the `tasks_active_ws` cookie through
`getActiveWorkspace()`. Counted in this worktree at base `78021c5`: **101 occurrences across
43 non-test source files**, of which **80 occurrences across 23 files sit in
`src/server/actions/**`** — `settings.ts` 15, `tasks.ts` 11, `board.ts` 10, `share.ts` 5,
`ai.ts` 4, then nineteen files with three or fewer.

`REPOSITORY_TRUTH.md` finding 8 records "80 call sites in 24 action files"; the action-file
count at this base is 23. The occurrence count matches exactly. The divergence is recorded,
not reconciled. `docs/wave/MUTATION_INVENTORY.md` classifies 95 ambient call sites across 39
files, 36 of them critical (`PROJECT_SCOPE.md` §9).

`getActiveWorkspace()` resolves cookie → first membership (unordered `.limit(1)`) →
`LEGACY_WORKSPACE_ID` (`src/server/auth.ts:147-180`, legacy return at `:179`).

**The failure mode. Seven sites in `src/server/actions/tasks.ts`, not three.** Audit B named
three (`audit/B-domain-permissions.md:350-357`). Enumerated mechanically at this base, every
one of these returns `getTasks(ws)` — the caller's own board, unchanged — when the pre-read
finds no row in the cookie's Project:

| Action | Declared at | Silent no-op return |
|---|---|---|
| `moveTaskAction` | `:106` | `:122` |
| `toggleCompleteAction` | `:157` | `:166` |
| `updateTaskAction` | `:386` | `:411` |
| `reorderTaskAction` | `:598` | `:620` |
| `removeTaskAction` | `:655` | `:664` |
| `setTaskArchivedAction` | `:732` | `:744` |
| `duplicateTaskAction` | `:792` | `:800`, whose own comment reads "workspace guard / unknown id → no-op" |

`moveTaskAction` also returns a bare `[]` on invalid input (`:110`), which is byte-identical
to "this board is empty".

The count matters: **the two destructive operations are on the list.** `removeTaskAction` and
`setTaskArchivedAction` both report success-shaped state when nothing was removed or
archived. A Home surface that offered either would tell a reader their task was gone while it
was still open in another Project.

**Every one of these is a success-shaped return.** The caller receives a `Task[]`, no
exception is thrown, and there is nothing in the value that distinguishes "your change
landed" from "the row was in another Project so nothing happened". Home cannot complete or
reassign a task in Project B while the cookie says Project A, and it cannot tell.

### 11.2 D-H23 · Silent no-op is the sealed prohibition

> **A surface contracted never to show success before the source confirms cannot be built on
> an action whose refusal is indistinguishable from its success.**

This is the worst available failure mode for My work specifically, and worse here than
anywhere else in the estate, for three reasons.

1. **It is the one surface where the target Project is usually not the cookie's Project.**
   On a board, the two always agree. On a cross-Project list, disagreement is the normal
   case, so the defect fires on the common path rather than the rare one.
2. **The user's evidence says it worked.** The optimistic client updates
   (`src/lib/tasks/tasks-context.tsx:299` for assignees), the action returns without
   throwing, and the row visibly changes. The reader then stops thinking about a task that
   is still open in another Project. A visible error would cost a retry. This costs the
   thing the product exists to protect.
3. **It is undetectable afterwards.** No activity row is written on the no-op branch, so
   there is no record that anything was attempted. The user cannot audit it and neither can
   support.

**Sealed.**
- No Home write ships until it takes an explicit branded `ProjectId`
  (`PROJECT_SCOPE.md` §9, §11.2).
- **A per-write cookie dance is prohibited.** It is a global state change to serve a local
  write, it races with concurrent tabs, and it turns looking at a list into an Active Project
  switch the user did not ask for (D-H07).
- `HOME_MUTATIONS_ENABLED` stays default-off until §11.3 exists and is proven.
- Any action reachable from Home whose refusal is not distinguishable from its success is a
  release blocker, not a known issue.

### 11.3 The interface Wave 7 requires

```ts
type SourceReceipt<T> =
  | { ok: true;  applied: T; sourceRevision: string; appliedAtIso: string }
  | { ok: false; refusal:
        | "not-found"            // no such row in that Project
        | "not-authorized"       // membership absent or revoked
        | "project-archived"     // PROJECT_SCOPE §8.3
        | "revision-conflict"    // §9; carries the current revision
        | "capability-denied"
        | "source-unavailable";
      sourceRevision?: string }

completeTaskInProject(input: {
  actor: ActorId;
  workspaceId: ProjectId;        // explicit, branded, never ambient
  taskId: string;
  expectedRevision: string;      // §9.2
}): Promise<SourceReceipt<MyWorkRow>>;

reassignTaskInProject(input: {
  actor: ActorId;
  workspaceId: ProjectId;
  taskId: string;
  assigneeIds: readonly string[];
  expectedRevision: string;
}): Promise<SourceReceipt<MyWorkRow>>;
```

**Required properties, each of which the current actions violate.**

| # | Property | Violated today by |
|---|---|---|
| 1 | The Project comes from the argument. `getActiveWorkspace()` is never called on this path. | all three actions, `tasks.ts:114`, `:159`, `:391` |
| 2 | Membership is verified for `input.workspaceId` at call time, through seam 1 via the `src/lib/projects/**` facade. | — (no facade exists yet) |
| 3 | The row is read and written under `AND workspace_id = input.workspaceId`, and a zero-row write is a **typed refusal**, never a return of unchanged state. | `tasks.ts:122`, `:166`, `:411` |
| 4 | `expectedRevision` is compared inside the same statement. A mismatch is `revision-conflict` and carries the current revision. | no revision token exists (§9.1) |
| 5 | An archived Project refuses `project-archived`. | `selectWorkspaceAction` has no archived predicate (`PROJECT_SCOPE.md` §8.3) |
| 6 | The receipt returns the **re-read** row, not the caller's optimistic value. | actions return `getTasks(ws)`, the whole board of a possibly different Project |
| 7 | The action writes no cookie and changes no Active Project. | `/api/suite-context` rewrites it on a link handoff (D-H12) |
| 8 | `ok: false` renders as a named refusal with the row unchanged. Nothing is marked done in the UI. | optimistic client update, `tasks-context.tsx:299` |

**Sealed rendering rule.** The row shows the new state only after `ok: true`. An optimistic
state is permitted **only** if a refusal reverts it visibly and names what happened. A
revert that silently restores the old value teaches the reader their action was undone by
someone else, which is a different and false story.

**Copy for the refusals.**

| Refusal | Copy |
|---|---|
| `not-found` · `not-authorized` | "Not saved. You no longer have access to this project." |
| `project-archived` | "Not saved. This project is archived." |
| `revision-conflict` | "This changed somewhere else while you were reading. Reload to see it as it is now." |
| `capability-denied` | "Not saved. You cannot make this change in this project." |
| `source-unavailable` | "Not saved. The project did not answer. Try again." |

`not-found` and `not-authorized` share one line deliberately: distinguishing them to a
client is an existence leak (`PROJECT_SCOPE.md` §8.1). The distinction stays server-side.

---

## 12. Permission change, conflict, and failure

| Event | Behaviour | Never |
|---|---|---|
| **Membership revoked between renders** | The Project leaves the authorized set on the next request. Its rows disappear and `projectsAuthorized` drops. The count line reflects the smaller set. | Never rendered from cache. Every `/app` route is `force-dynamic` and Home adds no caching primitive (`PROJECT_SCOPE.md` §10.4) |
| **Membership revoked between render and write** | The write refuses `not-authorized`. | Never a silent no-op |
| **Actor changed** | Read Scope resets to `current-project`; nothing from the previous actor renders (`PROJECT_SCOPE.md` §10.1) | Never a cached list |
| **Restored from history or `bfcache`** | Project state and the authorized set are re-resolved before any row renders | Never a stale-authorization render |
| **One Project's read fails** | That Project degrades alone. Others render. `status` becomes `"partial"` and the count line names the shortfall | Never makes the aggregate `unavailable`, and never makes it complete (`PROJECT_SCOPE.md` §5 rule 7) |
| **A Project's `ColumnConfig` is unreadable** | That Project contributes no rows and is counted in `projectsUnresolved` | Never contributes rows whose done-ness was assumed |
| **All Projects fail** | `{ kind: "unavailable", reason: "source-failed" }` | Never `no-projects`, never zero rows |
| **The authorized set is genuinely empty** | `{ kind: "no-projects" }` | Never conflated with a failed read |
| **Day rolls over mid-session** | Cursor is rejected with `day-rolled-over` and the first page is returned (§8.1) | Never a silently reshuffled page |
| **Two writers, one task** | `revision-conflict` on the second, with the current revision returned | Never last-write-wins |

---

## 13. Open, and owned elsewhere

Recorded so no lane treats silence as settlement.

1. **`src/lib/projects/**` has not landed.** Every authorization statement here is an
   unverified acceptance surface until it does. Owner: `lane/wp2-project-platform`
   (`PROJECT_SCOPE.md` §13 item 1).
2. **`ColumnConfig` has no `waitingKeys`** (§7.3). Until it does, Waiting is keyed on the
   default `"waiting"` key and Projects that deleted the column report `unknown`. Owner:
   the Tasks board surface (`src/lib/board-config.ts`, `src/server/actions/board.ts`).
3. **`src/server/actions/board.ts` stamps no `updatedAt`** (§9.1). Until it does,
   conflict detection is field-scoped. Owner: the Tasks board surface. New finding; raise
   separately so it is not absorbed silently.
4. **Assignee-not-a-member rows** (`PROJECT_SCOPE.md` §3.1 consequence 3, §13 item 6). This
   contract answers it for the reader's own list: authorization gates the row, so the
   question does not arise for My work. It is **still open** for any surface that shows
   *other people's* assignment, which V1 does not. Owner: whichever wave ships that.
5. **The analytics mirror also carries `assignees`**
   (`src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts:24`). Retiring the JSON
   column requires a decision about the mirror. Out of scope here (§4.3). Owner: lead.
6. **The `SIGNAL_*` database has no drift alarm and no receipt-backed runner**
   (`RISK_REGISTER.md` R-H14). Not this contract's data, but it is the other half of Home's
   persistence story and remains unprotected.
7. **Member name resolution cross-Project** (§6 rule 4). V1 ships a count. A resolver that
   distinguishes member, former member and unknown is required before names ship.
8. **One time frame, or two.** `contracts/HOME_CONTEXT.md` was sealed by a sibling lane
   during this wave and uses the name `HomeContext` for the authorization seam, while its
   cache partition key carries `locale + timezone`. This contract renamed its own type to
   `MyWorkTimeFrame` (§5) to end the name clash, but the substantive question is open: does
   the authorization seam **produce** the time frame, or does Home resolve it separately and
   pass both? Until the lead settles it, §5.1's resolution order is this lane's answer and
   the two contracts must be diffed before Wave 4 freezes the shared boundary. Recorded, not
   reconciled.

---

## 14. Executable assertions

Written as failing contract tests under `src/lib/home-layer/my-work/`. All **49 assertions
fail at this base**, each for the reason stated, and the reason is the deliverable.

### 14.1 Module paths the tests bind to

The tests import by path, so the paths are part of the contract. Wave 7 creates these; a
different layout means editing this section, not the tests.

| Module | Owns |
|---|---|
| `src/lib/home-layer/my-work/grouping.ts` | `groupMyWorkRow`, `MY_WORK_GROUP_ORDER` (§7) |
| `src/lib/home-layer/my-work/projection.ts` | kinds, coverage, keyset cursor (§8, §10) |
| `src/lib/home-layer/my-work/read.ts` | `listAssignedTaskRows`, the exact relation read (§4.3, §7.4, §8) |
| `src/lib/home-layer/my-work/waiting.ts` | `resolveWaiting` (§7.3) |
| `src/lib/home-layer/my-work/revision.ts` | `sourceRevision`, `REVISION_FIELDS` (§9.2) |
| `src/lib/home-layer/my-work/writeback.ts` | `completeTaskInProject`, `reassignTaskInProject`, `SOURCE_REFUSALS` (§11.3) |
| `src/lib/home-layer/my-work/assignment-parity.ts` | `compareAssignmentParity`, `PARITY_UNMEASURED` (§4.4) |
| `src/server/db/task-assignments.ts` | `writeTaskAssignments`, the one dual-write helper (§4.5) |

`src/lib/home-layer/my-work/contract-support.ts` is test support, not implementation.

### 14.2 The assertions

| # | Assertion | Fails today because | Test file |
|---|---|---|---|
| M1 | A grouping module exists exporting the four-group precedence | it does not exist | `grouping.contract.test.ts` |
| M2 | Waiting outranks an overdue date | no grouping exists | `grouping.contract.test.ts` |
| M3 | `T+7` is Next and `T+8` is Later | no window exists | `grouping.contract.test.ts` |
| M4 | Every row lands in exactly one group | no grouping exists | `grouping.contract.test.ts` |
| M5 | Grouping is computed by calendar date, so a DST week still has a 7-day window | no grouping exists | `grouping.contract.test.ts` |
| M6 | An undated row is Later, never Now | no grouping exists | `grouping.contract.test.ts` |
| M7 | A projection module exists exporting `MyWorkProjection` | it does not exist | `projection.contract.test.ts` |
| M8 | `no-projects`, `unavailable` and a zero-row `ready` are three distinct values | none exist | `projection.contract.test.ts` |
| M9 | Coverage separates `projectsRead` from `projectsUnresolved` | none exists | `projection.contract.test.ts` |
| M10 | The cursor is rejected when `ctx.today` changed | no cursor exists | `projection.contract.test.ts` |
| M11 | A `task_assignments` table is declared in `src/server/db/schema.ts` | no such table | `assignment-storage.contract.test.ts` |
| M12 | `assignees` is not read by a `LIKE` in any cross-Project path | `src/server/db/queries.ts:335` and `src/server/db/daily-digest.ts:69-79` do | `assignment-storage.contract.test.ts` |
| M13 | Every `insert(tasks)` / assignment write goes through one dual-write helper | seven independent paths write `assignees` (§4.5) | `assignment-storage.contract.test.ts` |
| M14 | A workspace-parameterised `completeTaskInProject` exists | no such export | `writeback.contract.test.ts` |
| M15 | No Home-reachable mutation calls `getActiveWorkspace()` | 80 occurrences in 23 action files | `writeback.contract.test.ts` |
| M16 | The receipt names all six refusals, and no Tasks mutation returns unchanged source state on a foreign row | seven sites return `getTasks(ws)` unchanged (§11.1) | `writeback.contract.test.ts` |
| M17 | `src/server/actions/board.ts` stamps `updatedAt` on every task write | it contains zero `updatedAt` references | `writeback.contract.test.ts` |
| M18 | Waiting is never derived from a column's display name | no derivation exists | `waiting-semantics.contract.test.ts` |
| M19 | `ColumnConfig` declares `waitingKeys` | it declares only `doneKeys` | `waiting-semantics.contract.test.ts` |
| M20 | No My work read resolves done-ness from a `lane === "done"` literal or a `null` config | four cross-Project reads do (§7.4) | `waiting-semantics.contract.test.ts` |
