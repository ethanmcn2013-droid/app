# ADR 0001 · Canonical Project identity

**Status:** Accepted (WP0 contract freeze)
**Date:** 2026-08-12
**Base:** `origin/main` @ `3682bf7`
**Supersedes:** the ambiguous `SuiteContextV2.projectId` field as a suite identity
**Related:** `docs/SUITE_URL_AND_NAMING_CONTRACT.md`, `docs/TIMELINE_OWNER_ARTIFACT_CONTRACT.md`, `docs/COLLABORATION_LOOP.md`, `docs/planning-periods.md`

---

## 1. Decision

> **A Project is a Tasks `workspaces.id`.** There is exactly one user-facing Project
> identity in Signal Studio, and this is it.

Everything that currently competes for the word *Project* is subordinate, and each is
named here so the ambiguity cannot return.

| Competing concept | Where it lives today | What it becomes |
|---|---|---|
| Planning Period | `SuiteContextV2.planningPeriodId` | A **grouping** of Projects that may widen a *local* Briefing Read Scope. Never an Active Project, never an authorization boundary. |
| Timeline database `workspace` | `drizzle-timeline` `workspaces` | **Hidden storage.** 1:1 bound to a Project. Never a user Project. |
| Timeline database `project` | `drizzle-timeline` `projects` | A **Timeline** — a subordinate artifact inside a Project. Never a suite Project key. |
| Tag-derived analytics scope | `projectIdFromTag()`, `src/modules/signal/server/analytics/providers/tasks.ts:364` | A **Label** (or Workstream). A filter/classification. Never enters Active Project context. |
| Note `workspaceId` | `src/modules/notes/server/db/notes-schema.ts:62` | Private **filing** and task-destination metadata. Never shared ownership or access. |
| `LEGACY_WORKSPACE_ID` fallback | `src/server/auth.ts:176-179` | **Removed** from resolution. Returning it hands out a workspace the caller has proved no membership of. |

**The word `workspace` remains implementation vocabulary. All user-facing copy says
Project.**

## 2. The invariant

For every **Project-scoped** operation:

```text
committed Project label
  = explicit URL workspaceId
  = freshly authorized Tasks workspace
  = Project-scoped page data
  = Project-scoped mutation destination
  = Timeline binding source
```

Any inequality is a release blocker.

**Explicit exceptions**, which are exceptions and not ambiguities:

- A **raw Note** read/edit/delete authorizes `note.userId === actor`. Project
  membership is required only to assign a non-null filing Project or to deliver
  content outward into Tasks/Timeline.
- **Home / Full Briefing** may use a clearly labelled aggregate **Read Scope**.
  Neither may silently change the Active Project or an outbound destination.

## 3. Types

```ts
type ProjectId = Brand<string, "TasksWorkspaceId">;

type ActiveProjectContextV3 = { version: 3; workspaceId: ProjectId };

type ProjectRouteState =
  | { kind: "ready"; project: ProjectSummary; source: "url" | "fallback" }
  | { kind: "archived"; project: ProjectSummary }
  | { kind: "unavailable" }   // missing | forbidden | deleted, collapsed
  | { kind: "empty" };

type NotesReadScope    = { kind: "all" } | { kind: "current-project" } | { kind: "unfiled" };
type BriefingReadScope = { kind: "current-project" }
                       | { kind: "planning-period"; planningPeriodId: string }
                       | { kind: "all-projects" };
type TimelineRef       = { workspaceId: ProjectId; timelineSlug: string };
```

`workspaceId` stays the serialized field name for this wave: it is established,
rename-safe, and avoids repurposing the ambiguous `SuiteContextV2.projectId`.

The brand exists to make a Planning Period id, a Timeline slug, a note id, or a
tag-derived Label id a **compile error** where a Project is required.

## 4. Authority layers

| Layer | Role | Explicit refusal |
|---|---|---|
| URL `workspaceId` | Current-tab truth for content, links, reload, history, new tabs | Never trusts itself for authorization |
| Tasks membership query | Live read/write authority | Never infers from name, slug, period, position, or local Timeline owner |
| HttpOnly cookie | Last explicitly selected Project, for a future **bare** entry | Never scopes a rendered page or a mutation when URL/object context exists |
| Shared client provider | Chrome, contextual links, pending switch state, announcements | Never authorizes data; never silently overrides the URL |
| Product Server Component | Resolves and authorizes the exact route before loading data | Never silently substitutes another Project |

### Resolution precedence

1. Authenticate.
2. **If `workspaceId` is explicitly present:** validate shape → query current
   membership and workspace state → return that exact active or archived Project →
   otherwise return neutral `unavailable`. **Never choose a substitute.**
3. **If absent:** validate the unified HttpOnly cookie → validate legacy
   `tasks_active_ws` during migration → otherwise choose the first accessible active
   Project by deterministic ordering → replace-redirect to a canonical URL now
   carrying `workspaceId`.
4. **If no accessible active Project:** return the product-specific empty/onboarding
   state. **Never `LEGACY_WORKSPACE_ID`.**

Following a contextual link does **not** rewrite the cookie. Only an explicit Project
selection does.

Client responses collapse *missing*, *forbidden*, and *deleted* into one neutral
`unavailable`. Detailed reason codes stay server-only — an existence leak is a
privacy defect.

## 5. Archived Projects

Openable only through a URL-only read-only flow or an explicit link, always read-only
for Project-scoped operations. `switchActiveProjectAction` rejects archived targets and
never writes them to the cookie. Notes stays privately editable — archive prohibits new
association and handoff *into* the Project, not owner-authorized note editing,
deletion, or refiling *away*. If the last-active Project becomes archived, the next
valid active Project becomes the future bare-entry default. Existing bearer links
remain manageable and revocable; new publishing is disabled.

## 6. Nested Timeline rule

One Project binds to one hidden Timeline workspace, which has **one primary Timeline**
that may synchronize all Tasks milestones. Additional children are optional **manual**
Timelines, never Projects. Hide the secondary control when only one exists. Do not
create multiple auto-synced children until Tasks owns a real subproject source scope.

Valid outcomes of `resolveCanonicalTimeline(actorUserId, requestedTasksWorkspaceId)`
are exactly: **exact · provisioned · owner-reconciliation-required · archived · denied
· failed**.

> **`open another Timeline` is not a valid outcome.**

See `docs/wave/DECISIONS.md` D-002: provisioning is *retained* (it prevents a real
production dead end) but is keyed to the **exact requested Project**, never "the user's
first workspace."

## 7. Active Project vs Read Scope

These are different things and the UI must never conflate them.

- **Active Project** is global, one at a time, encoded in the URL, and changes only
  through an explicit selection.
- **Read Scope** is local to Home / Full Briefing / Notes filters, and widens what is
  *read* without changing what is *targeted*.

Selecting a specific Project from an aggregate view invokes the global switch.
Choosing an aggregate does not. Widened content is labelled explicitly — `Across all
projects`, `2026 school year` — so the global Project trigger never falsely implies
filtering. Navigating to a product from an aggregate view preserves the global Active
Project.

## 8. URL contract

Existing product routes are preserved; one canonical parameter is appended.

```text
/app/tasks?workspaceId=…            /app/tasks/list?workspaceId=…
/app/tasks/timeline?workspaceId=…   /app/tasks/calendar?workspaceId=…
/app/notes?workspaceId=…&view=…&note=…
/app/timeline?workspaceId=…         /app/timeline/<slug>?workspaceId=…&mode=view|edit
/app/project?workspaceId=…
/app/home?workspaceId=…&briefingScope=…
/app/home/briefing?workspaceId=…&briefingScope=…
```

New V3 links must not emit `sourceProduct`, `contextVersion`, `planningPeriodId`, or a
global `projectId`. V2 inputs are accepted, validated, and replace-redirected to
canonical form for at least two stable releases.

**Constraint discovered in audit:** `scripts/check-suite-switcher-contract.mjs:119-125`
currently *requires* `sourceProduct` in `src/lib/suite-context.ts`. The V2 emitter is
therefore retained during migration (which §14.3 step 11 of the plan already mandates)
and the guard is renegotiated explicitly, with an updated justification, when the
emitter retires — never deleted to make a build green.

## 9. Mutation rule

Every Project-scoped server action follows one of exactly two safe patterns:

- **Create/list:** accepts a branded `projectId` and freshly validates the required
  capability.
- **Object operation:** queries the target object, derives its stored Project, and
  verifies capability **in the same operation**; optionally compares an expected
  Project ID to detect stale UI.

Never accept a client Project ID and then mutate only by object ID without verifying
they belong together. Never authorize in the UI and trust the action. Reauthorize
inside the transaction wherever the database supports it.

A CI source guard forbids new mutation-time ambient-workspace lookup outside a
documented compatibility allowlist. **The wave is not complete while any write can be
scoped solely by the ambient cookie.**

## 10. Consequences

**Accepted costs.** The 101 `getActiveWorkspace()` call sites across 43 files must be
classified and migrated (WP3) — the largest single workstream. A wall of source-text
contract guards around current chrome must be renegotiated explicitly (D-007). The
`experience/registry.json` materiality hashes will cascade (D-008).

**Rejected alternatives.**

- *Make Planning Period the active context.* Rejected: it is a grouping, and Projects
  must remain individually addressable and authorizable.
- *Introduce a new suite route hierarchy.* Rejected: it would break the locked URL
  contract, strand public artifacts, and create a third Project slug model.
- *Use the Project slug as identity.* Rejected: renames would break every saved link
  and require an alias table. The immutable ID survives renames.
- *Keep tag-derived analytics ids as "projects".* Rejected: it makes cross-project
  conclusions semantically false — the release-blocking defect named in the Analytics
  research report.
