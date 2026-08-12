# Contract · Project scope

**Status:** Sealed (Wave 1). Binding on every Home surface, contract test and lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Adopts:** `docs/adr/0001-canonical-project-identity.md` (merged in PR #125, unamended)
**Consumes:** `src/lib/projects/**` — foreign-owned by `lane/wp2-project-platform`, **absent at this base**
**Revalidation:** `RECONCILIATION.md` §"Wave 1 revalidation"
**Decisions:** `DECISIONS.md` D-H01 … D-H13

Changing anything sealed here requires a new founder-approved ADR or a lead-owned
amendment recorded in `DECISIONS.md`. An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

It is the boundary between **Home** and **Project identity**. It says what a Project is,
which authority answers "may this person see it", how every other id in the estate maps
onto it, and what Home renders in each non-ideal state.

It is **not** an implementation. `src/lib/projects/**` does not exist at this base
(verified: no such directory) and neither do `ActiveProjectContextV3`, `ProjectRouteState`,
`switchActiveProjectAction` or `resolveCanonicalTimeline` (verified: zero occurrences
repo-wide across `src/` and `scripts/`). §11 states, as an interface, exactly what Home
requires of that foundation so the lead can check the landed work against it.

**The ADR and this contract agree.** Audit B concluded independently, at base `a849fc4`,
that the only defensible canonical identity is the Tasks `workspaces.id`
(`audit/B-domain-permissions.md:143-147`, `:676-678`); ADR 0001 §1 decided the same at
`3682bf7`. Two independent reads, one answer. That agreement is the strongest single
result in Wave 0 and this contract does not relitigate it.

---

## 1. Canonical Project identity

> **A Project is a Tasks `workspaces.id`.** One user-facing Project identity exists in
> Signal Studio. This is it.

| Fact | Evidence |
|---|---|
| `workspaces.id` is a text primary key on the Tasks database | `src/server/db/schema.ts:272-273` |
| `workspaces.slug` is a separate UNIQUE column and doubles as the public `/p/{slug}` path | `src/server/db/schema.ts:274-276` |
| `workspaces.archivedAt` exists and is nullable | `src/server/db/schema.ts:311` |
| `workspaces.planningPeriodId` is a nullable FK, `onDelete: "set null"` | `src/server/db/schema.ts:299-302` |
| The vocabulary is recorded in source: "Projects = workspaces, Programs = planning periods" (D-011) | `src/server/actions/project-overview.ts:6` |

**Ownership.** The Tasks database owns Project identity and lifecycle. No other module
creates, renames, archives or deletes a Project. Home **reads** Projects; Home never
mints one.

**Serialization.** The wire name is `workspaceId`, exactly as ADR 0001 §3 fixes it.
Home does not introduce `projectId` — that name is already taken by the ambiguous
`SuiteContextV2.projectId` (`src/lib/suite-context.ts:4`, emitted at `:30-31`, normalized
to `scope_id` at `:74-76`) and by the tag-derived analytics id space (§2.3). Reusing it
would re-create the ambiguity this contract exists to close.

**Branding.** Home code accepts a Project only as a branded `ProjectId`. A Planning
Period id, a Timeline slug, a Timeline slug pair, an `ms-…` node id, a note id or a
tag-derived Label id passed where a Project is required is a **compile error**, not a
runtime check. Home does not implement the brand — it consumes it from §11.

**Vocabulary.** `workspace` remains implementation vocabulary. Every user-facing string
says **Project**. Home ships no surface on which the word "workspace" is visible to a user.

---

## 2. The mapping — every other identity is a projection

Four incompatible identities exist today (`audit/B-domain-permissions.md:37-147`). Exactly
one is canonical. The other three are **projections resolved from it**, and Home labels
them as such at the contract boundary.

### 2.1 Tasks `workspaces.id` — canonical

The Project. Immutable across rename. Survives slug changes. The only value Home stores,
serializes, links with, or passes to a mutation.

### 2.2 Timeline — a slug pair, subordinate, one-way

| Timeline concept | Shape | Relationship to a Project |
|---|---|---|
| Timeline `workspaces.slug` | **primary key is the slug**, not an id | Hidden storage. 1:1 with a Project. Never a user Project. |
| Timeline `workspaces.suite_workspace_id` | nullable text, unique index | **The only join key back to a Project.** |
| Timeline `projects` | **composite PK `(workspace_slug, slug)`** | A *Timeline* — a subordinate artifact inside a Project. Never a Project. |
| Timeline `projects.source_tasks_workspace_id` | nullable text, stores `workspaces.id` | Sync source. NULL = manual-only. |
| Synced milestone node id | `` `ms-${tasksWorkspaceId}-${tasksTaskId}` `` | A fifth id space. Never a Project. |

Evidence: `src/modules/timeline/server/db/timeline-schema.ts:325-337` (slug PK, owner,
suite join key), `:78-88` (composite PK, `sourceTasksWorkspaceId`),
`src/modules/timeline/server/sync/tasks-milestone-source.ts:161` (`ms-…`).

**Rules.**
- Home resolves Project → Timeline. **Never the reverse.** Home never accepts a Timeline
  slug, a slug pair, or an `ms-…` id as an inbound Project identity.
- Resolution is delegated to `lane/wp1-timeline-safety`'s exact-Project resolver
  (`resolveCanonicalTimeline`, ADR 0001 §6). Home consumes its outcome and never
  substitutes. The valid outcomes are exactly **exact · provisioned ·
  owner-reconciliation-required · archived · denied · failed**.
- `owner-reconciliation-required` has **no UI** today (recorded at `docs/wave/DECISIONS.md`
  D-017, "Carried forward"). Home renders it as a named, honest refusal with a route
  onward — never as "no Timeline", never as an empty Timeline, never as another Timeline.
- A Project with no Timeline renders **"No Timeline yet"**, which is a distinguishable
  state from `failed` and from `denied`.

### 2.3 The tag-derived projection — a **Label**, never a Project

`projectIdFromTag()` slugifies a task tag and falls back to the literal string
`"untagged"` (`src/modules/signal/server/analytics/providers/tasks.ts:365-374`). It is
applied in six places (`providers/tasks.ts:68,120,145,184`, `providers/notes.ts:64,151`)
and gates project-scope authorization at `policy.ts:220`. The mirror schema states the
intent in a comment — "Each unique tag becomes an Analytics 'project'"
(`src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts:26-27`).

**Sealed.** This identity is renamed **Label** (interchangeably Workstream) and survives
only as a **facet or breakdown inside an already-authorized Project**. It is never an
identity, never an authorization input, never an Active Project value, and the word
"Project" never appears next to it in any Home surface. This ratifies `docs/wave/DECISIONS.md`
D-010 option (a) and ADR 0001 §1 row 4 without amendment.

Three properties make it unusable as identity, each of which Home must survive:
two tags that slugify identically **merge silently**; renaming a tag **destroys its
history**; and an untagged task is filed under a Label literally called `untagged`.
Home never renders `untagged` as a Label name. Untagged work is **unlabelled**, which is
a different statement (§6).

### 2.4 Notes — a private filing hint, never an ownership claim

`notes.user_id` is the tenant. `notes.workspace_id` is documented in schema as an
"Optional projection of the canonical Signal Tasks workspace id… Notes never owns or
copies Workspace membership. A null value is the normal, durable 'Unfiled' state."
(`src/modules/notes/server/db/notes-schema.ts:54-62`). The static tenant gate encodes the
same thing: Notes' `tenantColumns` is `["user_id"]`
(`src/server/tenant-scope-rules.mjs:177-181`).

**Rules.**
- A Note's Project is **filing and destination metadata only**. It never grants, implies
  or restricts access to the Note.
- Reading, editing and deleting a raw Note authorizes `note.userId === actor` and nothing
  else. Project membership is required only to **set** a non-null filing Project or to
  deliver content outward into Tasks or Timeline. This is ADR 0001 §2's first explicit
  exception, adopted verbatim.
- `workspaceId: null` is **Unfiled** — a durable, normal, first-class state. Home never
  renders Unfiled as an error, as zero, or as "no project".
- Home surfaces exactly one Note-derived text: the creator-authored approved extract, and
  it is labelled as such. Raw note bodies never reach Home. The boundary is the
  best-defended seam in the estate (`audit/B-domain-permissions.md:482-525`) and Home does
  not weaken it.

### 2.5 Planning Period — a grouping, never a scope of authority

`planning_periods` is owned by exactly one user (`owner_user_id` FK, cascade delete —
`src/server/db/schema.ts:217-261`). A Planning Period may **widen a local Read Scope**
(§5). It is never an Active Project, never an authorization boundary, and never a
mutation destination.

**Recorded defect this contract fails closed against.** `selectAuthorizedWorkspaceHint`
falls through a `??` chain and, when an explicit `workspaceId` is unauthorized, silently
selects a *different* Project sharing the Planning Period
(`src/modules/notes/server/tasks-personalization.ts:192-209`). Home never resolves a
Project by Planning Period membership. An explicit-but-unauthorized Project is
`unavailable` (§8), never a substitution.

---

## 3. Membership — one canonical seam, four subordinated

Five seams resolve membership today over four transports
(`audit/B-domain-permissions.md:189-202`). Twenty-one functions return a workspace set for
a viewer (`:204-261`); nine are cross-workspace and they disagree on owner-only vs
owner-or-member, on archived handling, and on which id space they speak.

**Home consumes exactly one. Home adds no sixth.**

| # | Seam | Transport | Disposition under this contract |
|---|---|---|---|
| **1** | **Tasks** — in-process Drizzle over `workspace_members` | in-process | **CANONICAL.** The sole authority. Definition: `src/server/db/schema.ts:458-477`; live resolver `src/server/auth.ts:147-180`. |
| 2 | Timeline authorization — raw `@libsql/client` against `TASKS_DATABASE_URL`, hand-written SQL joining `users → workspace_members → workspaces` | raw SQL over HTTP | **SUBORDINATE ADAPTER.** Reads the same table as seam 1 and must return the same answer. Owned by `lane/wp1-timeline-safety`. Home never calls it; Home never treats a disagreement between it and seam 1 as a tie. `src/modules/timeline/server/sync/tasks-workspace-context.ts:93-131`. |
| 3 | Timeline ownership — `workspaces.owner_user_id`, **owner-only, no member table exists in Timeline** | in-process (Timeline DB) | **NOT A MEMBERSHIP SEAM.** Demoted to an artifact-ownership fact. It cannot answer "may this person see this Project" because Timeline has no member concept. Home never uses it for access. `src/modules/timeline/server/db/timeline-queries.ts:158-170`. |
| 4 | signal / analytics — a third Drizzle client over a read-only Tasks mirror | mirror DB | **SUBORDINATE ADAPTER.** Revalidation only, never the primary grant. `src/modules/signal/server/analytics/policy.ts:152-204`. |
| 5 | Notes — HTTP loopback to `/api/internal/workspaces` with an HMAC-signed short-lived assertion, 2 s timeout | in-process HTTP hop | **SUBORDINATE ADAPTER, and the only one permitted to degrade.** On timeout it returns `"unavailable"` (`src/modules/notes/server/tasks-personalization.ts:59`, `:166-171`). Home renders that as **unavailable**, never as "no projects". `:148-171`, `:181-190`; server side `src/app/api/internal/workspaces/route.ts:39-95`. |

**Rules.**
1. Every Home read and every Home write authorizes through seam 1, reached only through
   the `src/lib/projects/**` facade (§11). Home imports no membership query directly.
2. A subordinate adapter may **narrow** but never **widen**. If an adapter returns a
   Project seam 1 does not grant, the request is denied and the disagreement is logged
   server-side.
3. **Seam 1 has three fallbacks, and Home permits one.** `getActiveWorkspace()` resolves
   cookie → first membership → `LEGACY_WORKSPACE_ID` (`src/server/auth.ts:151-179`, the
   legacy return at `:179`). The third hands out a Project the caller has proved **no
   membership of**. Home never receives it: the resolver Home consumes must return the
   empty/onboarding state instead. This ratifies `docs/wave/DECISIONS.md` D-005 as a
   **Home precondition**, not merely a WP2/WP3 target.
4. Home never adds a membership cache. Membership is revalidated per request. Revocation
   must take effect on the next request, not on the next deploy.

### 3.1 Role semantics

`workspace_members.role` is `"owner" | "member"`, NOT NULL, default `"member"`, composite
PK `(workspace_id, user_id)` (`src/server/db/schema.ts:458-477`). There is no third role,
no per-Project custom role, and no guest role.

| Role | What it means today |
|---|---|
| `owner` | Everything `member` can do, plus: invites and member management, Planning Period administration, Project deletion, security settings. Enforced only in `src/server/actions/{planning,security,settings}.ts` and `src/server/planning/security-boundary.ts:30,47`. |
| `member` | Full read and full write on every task, comment, attachment and **board configuration** in the Project. |

**Three consequences Home must state honestly rather than design around.**

1. **No task mutation carries a role check.** `moveTaskAction`, `toggleCompleteAction`,
   `updateTaskAction`, `addTaskAction` and their siblings authorize
   membership-of-the-active-Project and nothing finer
   (`src/server/actions/tasks.ts:106-155`, `:157+`, `:386-492`, `:494-583`;
   `audit/B-domain-permissions.md:289-305`). Home renders no capability distinction it
   cannot verify. Any Home affordance that implies "you can do this because you are an
   owner" must call a capability predicate, never infer from a label.
2. **Any member can redefine "Done" for the whole Project.** `setColumnDoneAction`
   resolves the ambient Project and performs no role check
   (`src/server/actions/board.ts:282-301`); the same is true of `renameColumnAction`,
   `addColumnAction`, `deleteColumnAction`, `reorderColumnsAction`, `renameBoardAction`.
   Because `isTaskDone` is *the* done predicate for every surface
   (`src/lib/board-columns.ts:188-208`), every Home completion number inherits a
   per-Project, member-editable definition. Home never presents a completion figure as a
   cross-Project comparable without disclosing that the definition is per-Project.
3. **Assignees are not validated against membership.** `assignees` is a JSON array column
   with no `task_assignees` table and no index (`src/server/db/schema.ts:53-56`, index
   list at `:156-171`); it is patchable straight through
   (`src/server/actions/tasks.ts:370`, `:419-424`, `:445-448`) and `addTaskAction` writes
   `input.assignees ?? []` unchecked (`:561`). A Home "assigned to me" list can therefore
   contain rows assigned to user ids that were never members. Home does not silently drop
   them and does not silently show them: the projection contract (My work, Wave 7) must
   state which it does and disclose it.

### 3.2 There is no organisation or account tier above a Project

No Clerk organisation concept exists in this repository (verified: zero `orgId` /
`organization` references in `src/server/auth.ts` and `src/proxy.ts`). The identity chain
is Clerk user → `users.id` → `workspace_members`. Home therefore has **no** account-level
"all projects in my company" concept. "All projects" means, exactly and only, the set of
Projects this actor is a member of (§5).

---

## 4. Active Project

**Active Project is the one exact Project that a product route renders and a mutation
targets.** It is global, one at a time, and changes only through an explicit selection.

### 4.1 Authority layers

Adopted from ADR 0001 §4 unamended, with Home's obligation added to each row.

| Layer | Role | Home's obligation |
|---|---|---|
| URL `workspaceId` | Current-tab truth for content, links, reload, history, new tabs | Home emits it on **every** contextual link it builds. Never trusts it for authorization. |
| Tasks membership query (seam 1) | Live read/write authority | Home authorizes here or not at all. Never infers from name, slug, period, position, or Timeline ownership. |
| HttpOnly cookie | Last explicitly selected Project, for a future **bare** entry | Home **never writes it** (§7) and never scopes a rendered page or a mutation by it when URL or object context exists. |
| Shared client provider | Chrome, contextual links, pending switch state, announcements | Never authorizes data. Never silently overrides the URL. |
| Product Server Component | Resolves and authorizes the exact route before loading data | Never silently substitutes another Project. |

### 4.2 Resolution precedence

1. Authenticate.
2. **`workspaceId` explicitly present** → validate shape → query current membership and
   Project state → return that exact `ready` or `archived` Project → otherwise
   `unavailable`. **Never choose a substitute.**
3. **Absent** → validate the unified cookie → validate legacy `tasks_active_ws` during
   migration → otherwise the first accessible active Project by deterministic ordering →
   replace-redirect to a canonical URL now carrying `workspaceId`.
4. **No accessible active Project** → the product-specific empty/onboarding state.
   **Never `LEGACY_WORKSPACE_ID`.**

"Deterministic ordering" is **not** defined by current code: `getActiveWorkspace()`'s
second fallback is an unordered `.limit(1)` over `workspace_members`
(`src/server/auth.ts:169-174`). Home requires the §11 facade to define and document a
stable total order. Until it does, the bare-entry default is **non-deterministic** and
Home may not describe it to a user as "your project".

### 4.3 Precedence against product-local filters

**Active Project is a ceiling, not a default.** A product-local filter — a Notes view, a
Tasks lane filter, a Label facet, a Timeline mode — may only **narrow** within the Active
Project. No product-local control may widen beyond it, and none may change it.

| Control | May narrow | May widen | May change Active Project |
|---|---|---|---|
| Product-local filter (lane, label, view, search) | yes | **no** | **no** |
| Home Read Scope (§5) | yes | yes, and it is labelled | **no** |
| Explicit Project selection | — | — | **yes**, and only this |

Selecting one specific Project from an aggregate Home view invokes the global switch.
Choosing an aggregate does not. Navigating to a product from an aggregate view preserves
the global Active Project.

---

## 5. All-projects behaviour — Read Scope is a second, independent axis

**Read Scope is what Home may read together. It is never what Home targets.** It is local
to Home surfaces and it never mutates Active Project. Conflating the two is a release
blocker.

```
HomeReadScope =
  | { kind: "current-project" }                              // default
  | { kind: "planning-period"; planningPeriodId: string }
  | { kind: "all-projects" }
```

Serialized as `briefingScope` on Home routes, alongside and independent of `workspaceId`
(ADR 0001 §8). Two parameters, two axes, never one.

**Rules.**

1. **Labelling is mandatory and literal.** Widened content carries an explicit visible
   label — `Across all projects`, `2026 school year`. The global Project trigger must
   never falsely imply that widened content is filtered to it.
2. **All-projects is not a Project.** It is never written to the cookie, never passed to a
   mutation, never accepted where a `ProjectId` is required, and never encoded as a
   sentinel value inside `workspaceId`.
3. **The set is the actor's membership set, resolved live** through seam 1 at request
   time. It is never a cached list, never "every Project in the account", and never
   derived from a Planning Period.
4. **Partial authorization is disclosed, never silently trimmed.** If N of M Projects
   resolve, Home says which count it read and that the rest were unavailable. It never
   renders M − N missing Projects as zero, as complete, or as all clear.
5. **Every cross-Project read uses `isTaskDone`, never `lane = 'done'`.** All four
   existing cross-Project reads violate this today and Home may not reuse them as-is:
   `getOverdueAcrossWorkspacesAction` hardcodes `ne(tasks.lane, "done")`
   (`src/server/actions/cross-workspace.ts:105`) and filters neither `archived_at` nor
   `parent_task_id`; `listYourWorkForUser` hardcodes `lane = 'done'` in four SQL
   expressions (`src/server/planning/queries.ts:100,102,107`) and also skips
   `archived_at`; the analytics providers pass a `null` config that always resolves
   `doneKeys = ["done"]` (`src/modules/signal/server/analytics/providers/tasks.ts:117,148`,
   `providers/notes.ts:105,154`, resolver at `src/lib/board-columns.ts:183-186`); and the
   briefing maps lanes through a fixed table
   (`src/modules/signal/lib/data/source.ts:112-117`).
6. **Mutations from an aggregate view carry an explicit Project.** No Home write may
   resolve its destination from Read Scope. See §9.
7. **Sources degrade per-Project, not globally.** One unavailable Project does not make
   the aggregate unavailable, and does not make it complete either. The existing
   `providerCoverage` model (`src/modules/signal/server/analytics/providers/coverage.ts:8-25`)
   already carries status, capabilities, history window, staleness and issues — Home
   extends that vocabulary rather than inventing a second one.

---

## 6. Unprojected work

Three distinct things are routinely collapsed into one. This contract keeps them apart,
and none of them is an error state.

| State | Where it exists | Home's rendering |
|---|---|---|
| **Unfiled** | `notes.workspace_id IS NULL` — the documented normal state (`src/modules/notes/server/db/notes-schema.ts:54-62`) | A named, reachable partition: **Unfiled**. Never "no project", never hidden, never counted into a Project. |
| **Unlabelled** | a task with no tags; the analytics projection files it under the literal Label `untagged` (`providers/tasks.ts:374`) | A named facet value: **Unlabelled**. The string `untagged` is never rendered. Never confused with Unfiled. |
| **Unprojectable** | a Tasks row whose `workspace_id` is NULL — still permitted by schema: "Nullable during the cutover; tightened to NOT NULL after the legacy backfill lands" (`src/server/db/schema.ts:38-41`; the same note is on `comments:481`, `activities:519`, `notifications:570`, `attachments:873-875`, `shareLinks:766-767`) | **Excluded from every Project-scoped count, and the exclusion is disclosed.** Never silently attributed to the Active Project, never counted into an all-projects total as if projected. |

**Sealed rule.** Unprojected work is never folded into a Project to make a number tidy,
and never dropped to make a number clean. A count that excludes it says so.

---

## 7. Persistence and reset

### 7.1 What Home may persist

**Nothing.** Home is a reader of Project context, not a writer of it.

- Home never writes the active-Project cookie.
- Home never persists Read Scope to the server. Read Scope lives in the URL
  (`briefingScope`) and dies with the URL.
- Following a Home contextual link **does not** change the Active Project unless the link
  is an explicit Project selection.

### 7.2 The cookie today — five writers, four attribute sets

This is a finding neither ADR 0001, `docs/wave/MUTATION_INVENTORY.md`, nor audit B
recorded. `MUTATION_INVENTORY.md:35-37` correctly states that exactly one `cookies()`
**read** resolves a workspace and that every other touch writes or deletes — but the
writes were never enumerated. Enumerated at this base, `tasks_active_ws` is written by
five paths with **four different attribute sets on the same cookie name**:

| Writer | `httpOnly` | `secure` | `maxAge` | Line |
|---|---|---|---|---|
| `selectWorkspaceAction` (the explicit switch) | **`false`** | absent | 30 d | `src/server/actions/cross-workspace.ts:193-200` |
| `GET /api/suite-context` (contextual-link handoff) | `true` | prod-only | 30 d | `src/app/api/suite-context/route.ts:60-66` |
| `selectWorkspaceCookie` (planning) | `true` | prod-only | 30 d | `src/server/actions/planning.ts:1252-1258` |
| template apply | `true` | absent | **absent — session cookie** | `src/server/actions/templates.ts:136-140` |
| invite redemption | **absent — defaults `false`** | absent | 30 d | `src/server/actions/settings.ts:614-618` |

Deletes: `src/server/actions/planning.ts:288-291` (delete-if-current, on Project delete)
and `src/server/actions/settings.ts:822` (on Project delete).

**Three consequences.**

1. The cookie's HttpOnly posture depends on **which path last wrote it**. ADR 0001 §4
   treats "HttpOnly cookie" as one authority layer; at this base it is not reliably
   HttpOnly. Home must never assume it is, and no Home client code may read it.
2. `/api/suite-context` **writes the cookie on a contextual-link handoff**
   (`route.ts:60`), directly contradicting ADR 0001 §4's rule that "following a contextual
   link does not rewrite the cookie". This is a **NEW CONFLICT**, recorded as D-H12, not
   silently reconciled.
3. `selectWorkspaceAction` returns `{ ok: true }` when membership is absent
   (`cross-workspace.ts:191`) — a refusal that is byte-identical to a success. Home may
   not build a switch affordance on an action whose refusal it cannot detect.

**Home requires exactly one writer**, HttpOnly, `secure` in production, `sameSite: "lax"`,
path `/`, with a typed refusal distinguishable from success, and with an archived-target
rejection (§8.3). Home does not write it and does not fix it; it is stated here as a
precondition on the §11 foundation.

### 7.3 Reset

- **Reset Read Scope** returns to `{ kind: "current-project" }` and is always one action
  away from any aggregate view.
- **Reset Active Project** is not a Home affordance. Only an explicit Project selection
  changes it.
- Clearing site data drops the cookie; the next bare entry falls to §4.2 step 3, which is
  currently non-deterministic (§4.2). Home discloses the resolved Project on bare entry —
  the user always sees which Project they landed in, named, before acting in it.

---

## 8. Non-ideal Project states

```
ProjectRouteState =
  | { kind: "ready";       project: ProjectSummary; source: "url" | "fallback" }
  | { kind: "archived";    project: ProjectSummary }
  | { kind: "unavailable" }        // missing | forbidden | deleted, collapsed
  | { kind: "empty" }
```

Adopted from ADR 0001 §3 unamended.

### 8.1 `unavailable` — missing, forbidden and deleted collapse

Client responses collapse the three into one neutral state. Detailed reason codes stay
**server-side only**: distinguishing "does not exist" from "you may not see it" is an
existence leak and a privacy defect.

Home's rendering of `unavailable`:
- names the state plainly, and does **not** guess why;
- offers a route onward — choose another Project, or return to Home at
  `{ kind: "all-projects" }`;
- **never** substitutes another Project, and never auto-switches;
- **never** renders as zero, empty, healthy, complete, or all clear. An unavailable
  Project is not an empty Project.

### 8.2 `empty` — a real Project with no content

Distinct from `unavailable`. The Project resolved, the actor is a member, there is nothing
in it yet. This is the onboarding state and it names the Project.

### 8.3 `archived` — a distinct state, read-only for Project-scoped operations

`workspaces.archivedAt` exists (`src/server/db/schema.ts:311`) and
`getProjectsTreeData` already partitions on it
(`src/server/actions/projects-tree.ts:109,121-122,143,150-151,177`).

- An archived Project opens **only** through a URL or an explicit link, always read-only
  for Project-scoped operations, and is always visibly labelled Archived.
- The Project switch action must **reject** an archived target and must never write it to
  the cookie. **It does not today** — `selectWorkspaceAction` checks membership only
  (`src/server/actions/cross-workspace.ts:182-191`) and there is no archived predicate
  anywhere in it. Recorded as a §11 precondition, not assumed.
- **Notes stays privately editable.** Archive prohibits new association and handoff *into*
  the Project. It does not prohibit an owner editing, deleting or refiling their own note
  *away* from it.
- If the last-active Project becomes archived, the next valid **active** Project becomes
  the bare-entry default.
- Existing bearer links remain manageable and revocable; new publishing is disabled.
- An archived Project is **excluded from `all-projects` by default and included on an
  explicit, labelled toggle.** It is never silently included — an archived Project's rows
  inflating a live cross-Project count is a truth defect.

### 8.4 Deleted

Project deletion is destructive and transactional (`src/server/actions/settings.ts:818-820`
deletes tasks then the workspace row; `src/server/actions/planning.ts:284-287` the same).
Both clear the cookie when it pointed at the dead Project. After deletion the Project is
`unavailable` — not "deleted" — on every client surface, per §8.1.

---

## 9. Mutation destination

Every Project-scoped write follows exactly one of two safe patterns (ADR 0001 §9, adopted):

- **Create / list** — accepts a branded `ProjectId` and freshly validates the required
  capability.
- **Object operation** — queries the target object, derives its stored Project, and
  verifies capability **in the same operation**; optionally compares an expected Project id
  to detect stale UI.

**Never** accept a client Project id and then mutate by object id without verifying they
belong together. **Never** authorize in the UI and trust the action. Reauthorize inside the
transaction wherever the database supports it.

**Home's hard precondition.** Home cannot write anything today. Every Tasks mutation binds
to the cookie, not to an argument: 101 `getActiveWorkspace(` occurrences across 43
non-test source files at this base (verified by count), classified in
`docs/wave/MUTATION_INVENTORY.md` as 95 ambient call sites across 39 files, of which **36
are critical** — the cookie is the sole write destination — and **40 high**. A cross-Project
Home surface cannot complete a task in Project B while the cookie says Project A: the
pre-read finds no row and the action **silently no-ops with a success return**
(`src/server/actions/tasks.ts:114,118-122`; the pattern is catalogued at
`MUTATION_INVENTORY.md:54-64`).

**Sealed.** No Home mutation ships until it takes an explicit `ProjectId`. A per-write
cookie dance is prohibited: it is a global state change to serve a local write, it races
with concurrent tabs, and it converts a Home action into an Active Project switch the user
did not ask for. `HOME_MUTATIONS_ENABLED` stays default-off until Home's write path is
parameterised. This ratifies risk `R-H11`.

---

## 10. Cross-account switching and return behaviour

### 10.1 Actor change

There are no organisations (§3.2), so "cross-account" means the signed-in **person**
changed: sign-out then sign-in as someone else, or a multi-session switch.

**Findings at this base.**
- No sign-out path clears `tasks_active_ws`. The only deletions are Project-delete
  (`planning.ts:290`, `settings.ts:823`) and full account deletion
  (`src/components/settings/profile/danger-zone.tsx:95`). The cookie is `path: "/"` with a
  30-day `maxAge` on four of its five writers, so it **survives an actor change**.
- The cookie value is not bound to the actor: nothing in the cookie records who selected it.

**Consequence.** After an actor change the cookie holds the *previous* person's Project id.
Seam 1 revalidates membership on every resolution (`src/server/auth.ts:154-165`), so this
is **not a data leak** — but it is a truth and privacy-of-inference defect: the new actor's
bare entry silently depends on the previous actor's selection, and a shared device leaks
the *existence* of a Project id through browser storage.

**Sealed rules.**
1. The persisted Project hint must be **bound to the actor** — either scoped per user id
   or cleared on every authentication transition. Home requires this of §11.
2. On any actor change, Read Scope resets to `{ kind: "current-project" }`. An aggregate
   view never persists across an actor change.
3. A `workspaceId` in the URL that the new actor is not a member of resolves to
   `unavailable` (§8.1) — never to a substitution, and never to a reason code that
   confirms the Project exists.
4. Home renders no cached content from a previous actor. Every `/app` route is
   `force-dynamic` today (22 files, including `src/app/app/layout.tsx:21`,
   `src/app/app/home/page.tsx:8`, `src/app/app/home/briefing/page.tsx:4`) and Home does not
   opt out. Home introduces no `unstable_cache`, `"use cache"`, `cacheLife`, `cacheTag` or
   `revalidateTag` — none exists anywhere in this repository today
   (`audit/B-domain-permissions.md:576-580`) and Home is not where that starts.

### 10.2 Back and return

Because Active Project and Read Scope are both **URL state**, browser history is the
mechanism, not a Home-specific memory.

| Action | History | Active Project | Read Scope |
|---|---|---|---|
| Explicit Project selection | **push** | changes | resets to `current-project` |
| Read Scope change on a Home surface | **replace** | unchanged | changes |
| Following a Home contextual link into a product | push | unchanged (carried in the link) | not applicable |
| Back from a product to Home | pop | restored from the URL | restored from the URL |
| Canonicalising redirect (§4.2 step 3) | **replace** | resolved | unchanged |

**Rules.**
- Read Scope changes use **replace**, so Back leaves the Home surface rather than walking
  a stack of filter states.
- Project selection uses **push**, so Back returns to the previously active Project, and
  the resolver re-authorizes it on arrival — a Project revoked in between resolves to
  `unavailable` rather than rendering from history.
- Home never restores a scroll position or a rendered list from `bfcache` without
  re-resolving Project state. A page restored from cache with a since-revoked Project is a
  stale-authorization render.
- **Every Home contextual link carries `workspaceId`.** Two opposite defects exist today
  and Home fixes neither by accident: Home's own evidence links **omit** the Project
  (`src/app/app/home/home-data.ts:82-84` emits `/app/task/${id}`), while the Full
  Briefing's links **carry** it and the destination **discards** it
  (`src/app/app/tasks/page.tsx:18-21` reads only `welcome`; `tasks-runtime-shell.tsx:68`
  then falls back to ambient; the only route consuming `workspaceId` is
  `src/app/app/page.tsx:17-29`, which demands `contextVersion=2` the ledger builder never
  sets). `/app/task/[id]` accepts no Project parameter at all and resolves ambiently
  (`src/app/app/task/[id]/page.tsx:15-17`, its own comment reading "Not found or wrong
  workspace"). Home's link contract is not satisfied until the destination consumes what
  the link carries.
- `/app/notes` already reads `params.workspaceId` as a hint
  (`src/modules/notes/app/page.tsx:79`) but resolves it through the Planning Period
  fall-through of §2.5. Carrying the parameter is necessary and not sufficient.

---

## 11. Required interface of `src/lib/projects/**`

`src/lib/projects/**` is being authored **right now** by `lane/wp2-project-platform` and
does not exist in this worktree. Home **consumes** it and will not build a second
ProjectScope foundation. This section is the acceptance surface: the lead can check the
landed work against it line by line.

### 11.1 Types Home requires

```ts
type ProjectId = Brand<string, "TasksWorkspaceId">;

type ProjectSummary = {
  id: ProjectId;
  name: string;
  slug: string;
  archivedAt: Date | null;
  planningPeriodId: string | null;
  role: "owner" | "member";
};

type ProjectRouteState =
  | { kind: "ready"; project: ProjectSummary; source: "url" | "fallback" }
  | { kind: "archived"; project: ProjectSummary }
  | { kind: "unavailable" }
  | { kind: "empty" };

type HomeReadScope =
  | { kind: "current-project" }
  | { kind: "planning-period"; planningPeriodId: string }
  | { kind: "all-projects" };

type ProjectSetResult = {
  projects: ProjectSummary[];
  /** Projects the actor holds membership of that could not be resolved. */
  unresolvedCount: number;
  /** Never inferred. "partial" and "unavailable" are distinct from an empty set. */
  coverage: "complete" | "partial" | "unavailable";
};
```

### 11.2 Functions Home requires

| Requirement | Why Home cannot proceed without it |
|---|---|
| `resolveProjectRoute(actor, explicitId?: string): Promise<ProjectRouteState>` — never substitutes; collapses missing/forbidden/deleted to `unavailable`; **never returns `LEGACY_WORKSPACE_ID`** | §4.2, §8.1, §3 rule 3 |
| `listAuthorizedProjects(actor): Promise<ProjectSetResult>` — seam 1 only; **distinguishes "no projects" from "could not resolve"** | §5 rules 3, 4, 7 |
| `assertProjectCapability(actor, id, capability): Promise<Result>` — typed refusal, never a boolean that collapses "denied" into "false" | §3.1, §9 |
| A **documented deterministic total order** for the bare-entry fallback | §4.2; today's `.limit(1)` is unordered (`src/server/auth.ts:169-174`) |
| A **single** active-Project cookie writer: HttpOnly, `secure` in production, `sameSite: "lax"`, path `/`, actor-bound or cleared on authentication transition | §7.2, §10.1 |
| That writer **rejects archived targets** and returns a refusal distinguishable from success | §8.3; today's `selectWorkspaceAction` does neither |
| Workspace-parameterised mutation entry points taking a branded `ProjectId` | §9 |
| Cross-Project reads that use `isTaskDone(task, config)` with the **real** per-Project config, and filter `archived_at` and `parent_task_id` consistently | §5 rule 5 |
| The brand `ProjectId` exported such that a Planning Period id, Timeline slug, `ms-…` id, note id or Label id is a **compile error** | §1 |

### 11.3 What Home will not accept

- A resolver that falls back to another Project when an explicit id is unauthorized.
- A boolean membership check with no distinction between denied and unavailable.
- A Project set that silently omits unresolved Projects.
- Any function that returns `LEGACY_WORKSPACE_ID`.
- Any API that accepts a bare `string` where a Project is required.
- Any API in which `all-projects` is expressible as a `ProjectId` value.

If the landed foundation diverges on any of these, the divergence is recorded in
`DECISIONS.md` as a new decision and escalated to the lead. It is never absorbed silently.

---

## 12. Executable assertions

Deliberately **specified here, not written as tests this wave** (D-H13): every natural home
for them sits inside `src/lib/projects/**` or `src/server/**` paths a live lane is editing,
and a colliding test file would be worse than a late one. Each assertion below is written
to be mechanical to implement once `src/lib/projects/**` lands.

| # | Assertion | Must fail today because |
|---|---|---|
| A1 | `resolveProjectRoute` with an unauthorized explicit id returns `{ kind: "unavailable" }` | no resolver exists |
| A2 | No code path reachable from Home returns `LEGACY_WORKSPACE_ID` | `src/server/auth.ts:179` still returns it |
| A3 | Exactly one source file writes `ACTIVE_WORKSPACE_COOKIE_NAME` | five do (§7.2) |
| A4 | Every writer of that cookie sets `httpOnly: true` | two do not (`cross-workspace.ts:196`, `settings.ts:614-618`) |
| A5 | The Project switch refuses an archived target with a typed refusal | no archived predicate exists in `selectWorkspaceAction` |
| A6 | `/app/task/[id]` accepts and honours an explicit `workspaceId` | it accepts no search params (`page.tsx:10-17`) |
| A7 | `/app/tasks` consumes `workspaceId` from the URL | it reads only `welcome` (`page.tsx:21`) |
| A8 | Home evidence links carry `workspaceId` | `home-data.ts:82-84` emits `/app/task/${id}` |
| A9 | No cross-Project read uses a `lane === "done"` literal | four do (§5 rule 5) |
| A10 | The word "workspace" appears in no user-facing Home string | not yet asserted anywhere |
| A11 | `all-projects` is not assignable to `ProjectId` | no brand exists |
| A12 | A Home mutation entry point requires an explicit `ProjectId` | no Home mutation exists; every Tasks mutation is cookie-bound |

---

## 13. Open, and owned elsewhere

Recorded so no lane treats silence as settlement.

1. **`src/lib/projects/**` has not landed.** §11 is an unverified acceptance surface until
   it does. Owner: `lane/wp2-project-platform`.
2. **Deterministic bare-entry ordering is undefined.** Needs a product answer (most
   recently active? alphabetical? explicit pin?), not just an `ORDER BY`. Owner: lead.
3. **The five-writer cookie consolidation** is unowned by any current lane (D-H12).
4. **`owner-reconciliation-required` has no UI** (`docs/wave/DECISIONS.md` D-017). Owner:
   `lane/wp1-timeline-safety` / WP4.
5. **Archived-in-all-projects default** is sealed here as excluded-by-default; if the
   founder wants archived included, that is an ADR amendment, not an implementation choice.
6. **Assignee-not-a-member rows** (§3.1 consequence 3) need a product answer before My work
   ships. Owner: Wave 7.
