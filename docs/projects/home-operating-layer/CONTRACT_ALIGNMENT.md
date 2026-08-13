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

## Pre-flight run — 2026-08-12 22:3x, against `c592e83`

Rather than defer them, all four were checked. Three of the four are **still open on current
main**, so the contract assertions stand as written.

| # | Claim | Verdict at `c592e83` |
|---|---|---|
| 1 | `LEGACY_WORKSPACE_ID` removed from Home-reachable paths (D-H03) | **STILL TRUE, unresolved.** `src/server/auth.ts:179` still ends `getActiveWorkspace()` with `return LEGACY_WORKSPACE_ID;`. ADR 0001 §1 describes it as "Removed" in the present tense; it is not. Remains a Home precondition. |
| 2 | Active-Project cookie cleared or actor-bound on sign-out (D-H09/D-H10) | **STILL TRUE, unresolved — and now sharper.** `clearActiveProjectCookie()` was added at `active-project-cookie.ts:85` and is correct, but `grep -rn` finds **zero callers**. `activeProjectCookieOptions()` still returns `path: "/"` with a 30-day `maxAge` and no actor binding. The capability was built and never wired. |
| 3 | Five-writer cookie divergence resolved (D-H12) | **STILL TRUE, unresolved.** The cookie is still written from `cross-workspace.ts`, `planning.ts`, `settings.ts`, `templates.ts` and `auth.ts`, with the canonical helper and `resolve.ts` added *alongside* them rather than replacing them. |
| 4 | Subordinate membership seams route through the new catalog (D-H02) | **Not established.** `src/server/projects/catalog.ts` exists; whether the Timeline raw-SQL, Timeline owner-only, signal mirror and Notes HMAC seams now defer to it was not traced. Carried forward. |

Items 1–3 were reported to the owning session rather than filed as competing work, since that
programme is active in exactly those files and item 2 is a gap in code it shipped hours ago.

**Effect on this programme:** none of the four blocks Waves 2 or 3. All four become Wave 4
entry conditions, and D-H03 in particular is a gate: Home must not be reachable while
`getActiveWorkspace()` can still substitute a legacy Project.

---

## Pre-flight re-run — 2026-08-13, against `0b112ab`

Five PRs merged and **no PR is open**. Re-ran the four Wave 4 entry conditions.

| # | Condition | Verdict at `0b112ab` | Change |
|---|---|---|---|
| 1 | Home access gate | **CLOSED.** `src/app/app/home/page.tsx:17`, `notes/page.tsx:28` and `timeline/page.tsx:13` all now call the membership-aware `requireAppAccessTasks()`. `notes/page.tsx:19` carries a comment naming the narrow gate as the bug. | was open |
| 2 | `LEGACY_WORKSPACE_ID` (D-H03) | **STILL OPEN.** `src/server/auth.ts:187` still ends `getActiveWorkspace()` with `return LEGACY_WORKSPACE_ID;` — moved line, same fallback. | unchanged |
| 3 | Active-Project cookie on sign-out (D-H09/D-H10) | **STILL OPEN.** `clearActiveProjectCookie()` still has zero callers. | unchanged |
| 4 | Cookie-bound mutations (R-H11) | **PARTLY CLOSED.** PR #134 took 65 server actions off the cookie; action files still calling `getActiveWorkspace()` fell from 24 to **18**. | improved |

### The advice correction landed, and it was right

This programme first told the access-gate session that deleting the page-level gates was probably
more correct, then retracted it after measuring that a layout-only guard does not stop a page
rendering (`R-H16`), recommending instead that the page keep a gate and fix it to the wide one.
That is exactly what shipped. The retraction was worth sending.

### Two consequences for sequencing

1. **Wave 4's blocker is cleared.** The Home route family was waiting on PR #130, which owned
   `src/app/app/home/page.tsx`. It has merged. Wave 4 may author those routes once Wave 3
   completes, building on the corrected gate rather than reintroducing the narrow one.
2. **The preview-posture timing condition is met.** `PREVIEW_POSTURE.md` recommended enabling
   Vercel Authentication *after* the other sessions' PRs merged, so their preview links would not
   suddenly demand a login. Zero PRs are open, so that objection is gone.

   The lead is still not enabling it unprompted. Deployment protection is an account-settings
   change on a live project, and standing approval to run the programme is not per-action approval
   to alter account configuration. It needs one word from Ethan, and takes about two minutes.
