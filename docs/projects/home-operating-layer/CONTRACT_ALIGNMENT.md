# Contract alignment — this programme's Wave 1 against the landed Project foundation

**Checked:** 2026-08-12 22:1x BST
**Their base:** `origin/main` @ `7ed2ed7` (PRs #127, #129, #131 merged after our base `78021c5`)
**Our contract:** `contracts/PROJECT_SCOPE.md` + `DECISIONS.md` D-H01…D-H12, sealed at `f49684f`

The Wave 1 `PROJECT_SCOPE` contract was written to **consume** `src/lib/projects/**` while that
module was still uncommitted in another session's worktree. It has now landed. This is the
check of whether the contract and the implementation actually agree — done before Wave 4
depends on it, not after.

## They agree, and it was reached independently

| Our contract requires | What landed | Verdict |
|---|---|---|
| Project = canonical Tasks `workspaces.id`, branded (D-H01) | `export type ProjectId = Brand<string, "TasksWorkspaceId">` — `project-ref.ts:26` | **match** |
| Planning Period, Timeline slug, Note id and tag-derived Label must be *separate* identity spaces, never interchangeable with Project (D-H01, D-H05) | Four distinct brands: `PlanningPeriodId`, `TimelineSlug`, `NoteId`, `LabelId` — `project-ref.ts:33-36` | **match** |
| Home Read Scope is `all \| project \| planning-period`, independent of Active Project (D-H04) | `BriefingReadScope = current-project \| planning-period \| all-projects` — `project-ref.ts:113-116` | **match** |
| `archived` is its own route state, never collapsed into unavailable or empty (D-H08) | `ProjectRouteState = ready \| archived \| unavailable \| empty` — `project-ref.ts:100-104` | **match** |
| Missing, forbidden and deleted collapse to **one** neutral client state, with the reason server-only | Same, and their own comment gives our reason: *"distinguishing them to the client is an existence leak"* — `project-ref.ts:97-99` | **match** |
| Unfiled work is a normal durable state, not an error (D-H05) | `NotesReadScope` carries an explicit `unfiled` kind — `project-ref.ts:106-110` | **match** |
| Capability must be asserted, never inferred from role, because any member can redefine Done (D-H11) | `ProjectCapabilities` type + `src/server/projects/capabilities.ts` | **match** |
| A typed URL builder/parser; `workspaceId` as the Project param (HOME_ROUTE_AND_RETURN_CONTEXT) | `PROJECT_URL_PARAM = "workspaceId"`, `buildProjectUrl`, `withActiveProject`, `canonicaliseProjectUrl` — `project-url.ts` | **match** |
| A server-side authorized-Project-set resolver behind one seam (D-H02) | `src/server/projects/{catalog,resolve,capabilities,request-scope,active-project-cookie}.ts` | **match** |
| A resolver that never substitutes another Project for an explicit unavailable one | PR #127's own title: *"one Project identity, one catalog, one resolver that never substitutes"* | **match** |

`ProjectRole` landed as `primary-owner | owner | member`, a third role beyond the
`owner | member` our audit found in the schema at `78021c5`. That is an extension, not a
conflict — but every capability check in our contracts must go through
`src/server/projects/capabilities.ts` rather than comparing role strings, which D-H11 already
required for a different reason.

## Why this matters more than a tick-list

Two programmes, working in separate worktrees without shared drafts, specified the same
foundation: the same brand for Project identity, the same four-state route model, the same
three-way read scope, and the same refusal to leak existence through a distinguishable error.
Our audit reached `workspaces.id` from the schema; their ADR reached it from the domain.

That convergence is the strongest evidence available short of a runtime proof that the
identity model is right. It also means **Wave 4 consumes a real, tested, merged foundation
instead of a contract's guess** — which was the whole point of registering
`src/lib/projects/**` as foreign-owned on day one rather than building a second one.

## What still has to be verified, not assumed

1. **Whether the landed resolver satisfies D-H02's "narrow but never widen" rule** for the four
   subordinate seams (Timeline raw SQL, Timeline owner-only, signal mirror, Notes HMAC
   loopback). The catalog exists; whether the other four now route through it is unchecked.
2. **D-H03 — `LEGACY_WORKSPACE_ID`.** Our contract makes its removal from any Home-reachable
   path a precondition. `src/server/auth.ts` changed in this delta; whether the third fallback
   of `getActiveWorkspace()` is gone is unverified.
3. **D-H09/D-H10 — the active-Project cookie is not cleared on sign-out.** Their delta adds
   `src/server/projects/active-project-cookie.ts`. Whether it fixes the actor-binding defect is
   unverified.
4. **D-H12 — the five-writer cookie divergence** was recorded as a NEW CONFLICT against
   ADR 0001 §4. Unknown whether PR #127 resolved it.

All four are read-only checks against the merged base, and all four belong in the Wave 4
pre-flight, not in a contract document. None blocks Waves 2 or 3.
