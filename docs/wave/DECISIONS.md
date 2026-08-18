# Project Truth & Analytics — decision record

Decisions made by the integration owner during execution. Each records the
evidence, the reasoning, and what it changes. Supersedes nothing in the two
authoritative plans; where a plan is wrong on current code, that is stated.

---

## D-001 · One programme, foundation-first

**Decision.** The Active Project wave and Signal Analytics run as one programme,
sequenced, not as two parallel programmes.

**Evidence.** Analytics' own hard pre-design truth gate ("the ported adapter derives
projects from task tags, while product truth defines Projects as canonical
workspaces") is a subset of Active Project WP0/WP2/WP9. Both briefs would edit
`src/modules/signal/**`, Home, Project Overview, and the Project catalog
concurrently. `projectIdFromTag` is confirmed at
`src/modules/signal/server/analytics/providers/tasks.ts:364` and is surfaced to
users as the literal word "Project" in four components.

**Changes.** Analytics folds in from Wave 4 as a consumer of Project truth. Its
design lab runs alongside the Active Project lab so both founder picks land in one
sitting. No scope is dropped.

---

## D-002 · WP1 must resolve a tension the plan does not acknowledge

**Status: material correction to the authoritative plan.**

**The plan says** (§10 WP1): *"Remove Timeline's 'open first existing Timeline' and
'provision primary workspace' fallbacks."*

**The repository says** those fallbacks are the fix to a real production incident.
`src/modules/timeline/server/timeline-provisioning-contract.test.mjs:5-20` records
it: `createWorkspaceAction` had zero callers, so `getCurrentWorkspace` returned null
forever and *"a couple's Timeline could not exist."* Test 2 (`:58-79`) pins the
second half: `if (!workspace || !current) return null;` *"collapsed two unrelated
states into one refusal… the owner met 'That workspace is not available.' looking at
their own Timeline."*

Four assertions pin the behaviour WP1 orders removed:

| Test | Line | Pins |
|---|---|---|
| `getCurrentWorkspace actually calls the provisioning path` | `:38-56` | `ensureTimelineWorkspaceForUser(` must be called |
| `a missing suite link is not treated as an access failure` | `:58-79` | `adoptTimelineForSuiteWorkspace(` must be called |
| `proved Tasks membership remains the only authorization boundary` | `:81-98` | membership refusal must precede adoption |
| `the provisioning path is only taken when the user has no workspace` | `:100-108` | `if (workspaces[0]) return workspaces[0];` must remain |

Plus `src/modules/timeline/lib/adopt-timeline.test.ts:62`, a behavioural test named
*"opening falls back to the owner's first Timeline"* — asserting the P0 defect as
intended behaviour.

**Both positions are correct.** Naive WP1 execution reintroduces a production
dead-end. Naive test preservation keeps the P0 wrong-Project substitution.

**Decision.** Neither. Implement plan §6.4's `resolveCanonicalTimeline` properly —
its valid outcomes are already *exact, provisioned, owner-reconciliation-required,
archived, denied, failed*, and *"open another Timeline is not a valid outcome."* So:

1. **Keep provisioning** — it prevents the dead end. But key it to the **exact
   requested Project**, never "the user's first workspace."
2. **Remove adoption-by-substitution** — replace with exact-evidence adoption
   (`legacy_exact`) and `owner-reconciliation-required` for ambiguity. The owner
   still has a route out of the dead end: an explicit choice, not a silent guess.
3. **Preserve test 3 unchanged.** "Membership refusal before adoption" is a genuine
   security invariant, not a defect pin.
4. **Rewrite tests 1, 2 and 4** with their justification comments updated to the new
   invariant: provisioning is keyed to the requested Project and does not run on
   every read. Rewrite `adopt-timeline.test.ts:62` to assert no-substitution.

A test rewrite here is a deliberate, evidenced contract change — recorded, never
silent. The incident these tests protect against must still be covered after the
rewrite.

---

## D-003 · Baseline and drift window

`origin/main` @ `3682bf7`. The plan's audited baseline `a1b66a7` is PR #122's merge
and `b3d7cba` is PR #121's; **only PR #123 landed after the plan was written**. Total
drift = 15 files, none in `src/server/actions/**`, `src/modules/{notes,timeline}/server/**`,
`src/lib/suite-context.ts`, `drizzle*/**`, or `docs/**`.

**The plan is far fresher than assumed.** Its architecture stands. Corrections are
narrow and recorded below.

---

## D-004 · Corrections to the plan's touchpoint map

| Plan claim | Reality |
|---|---|
| `src/lib/product-urls.ts` has `withSuiteContext()` callers | **FALSE.** Zero. The nine real callers are component files (`mobile-suite-nav`, `command-palette`, `sidebar`, `suite-command-root`, `suite-switcher-pills`, `metadata-rail`, `user-button-with-suite`, `studio-rail`). `product-urls.ts` is the *destination* builder. |
| `src/components/studio-bar/mobile-suite-nav.tsx` | **DRIFTED** → `src/components/app/mobile-suite-nav.tsx` |
| `src/modules/timeline/components/project-switcher.tsx` | **DRIFTED** → `src/modules/timeline/app/plan/[projectSlug]/_components/project-switcher.tsx`. Its location *inside* the `[projectSlug]` segment means WP7 is a route-topology change, not a component swap. |
| "104 call sites across 43 files" | **101** `getActiveWorkspace(` occurrences across **43** non-test source files. File count exact. |

Two migration classes exist, not one: `withSuiteContext()` callers **and** bare
product links (`home-view.tsx:240-242`, `studio-bar.tsx:111,137`).

---

## D-005 · A third ambient fallback the plan misses

`src/server/auth.ts:176-179` — when a user has no workspace membership,
`getActiveWorkspace()` returns a hard-coded `LEGACY_WORKSPACE_ID`:

```ts
if (first) return first.workspaceId;
// Legacy fallback for dev runs where the user isn't in any workspace yet …
return LEGACY_WORKSPACE_ID;
```

This hands out a workspace ID the caller has proved **no membership of**, and any of
the 101 call sites can receive it. The plan's §3.2 precedence table has no such case.

**Decision.** Treat as a WP2 resolver requirement and a WP3 audit target: the
resolver must return the product-specific empty/onboarding state here, never a
workspace ID. Add a regression test. Flagged to the authorization/privacy reviewer
in the Wave 8 independent review.

---

## D-006 · Notes period substitution is flag-gated — does not block sequencing

`src/modules/notes/server/tasks-personalization.ts:192-209` — an explicit but
unauthorized `workspaceId` falls through a `??` chain and silently selects another
workspace in the same Planning Period. Confirmed defect.

The path is gated by `SIGNAL_PLANNING_PERIODS_ENABLED`
(`src/modules/notes/app/page.tsx:76-78`), which defaults **off** — it requires
`"1"` or `"true"`.

**Decision.** The fail-closed fix is correct whether the flag is on or off, so this
does **not** block WP8 sequencing. The flag value only determines whether this is an
active or a latent production bug today. Worth confirming with the founder, but not
a gate.

---

## D-007 · The plan's day estimate does not account for the contract-guard wall

A wall of source-text contract guards surrounds the chrome WP2/WP6 replaces:
`src/server/suite-navigation-contract.test.mjs` (28 tests),
`scripts/check-suite-switcher-contract.mjs` (≥14 assertions including a
`sourceProduct` pin at `:119-125`), plus `check-chrome-contract.mjs`,
`check-route-manifest.mjs`, `check-loading-contract.mjs`,
`check-tap-target-scale.mjs`, `check-suiteloader-identity.mjs` — all inside
`pnpm test`.

Additionally `src/server/tasks-security-regression.test.mjs:542-555` (new in PR #123)
pins settings JSX by literal string, and `src/app/app/settings/page.tsx` +
`src/server/actions/settings.ts` (15 ambient calls) is the largest WP3 target. A
security-named test failing on a prop-list change will read as a boundary breach.

**Decision.** Every guard renegotiation is an explicit, evidenced commit with an
updated justification comment — never a deletion to make a build green. Budget for
this in Waves 2, 3 and 6. Recorded so a later reviewer does not read a rewritten
guard as a weakened one.

---

## D-008 · The registry materiality-hash cascade is a first-class deliverable

`experience/registry.json` holds 78 entries, each with a `materialityHash` bound to
source. PR #123 needed a hash rebind and an evidence-file rename for a *single* moved
wrapper. This wave touches nearly every registered surface. WP11's one-line "update
the registry" understates the work by an order of magnitude.

**Decision.** Treat rebinding as its own Wave 8 work item with a scripted procedure,
not a closing chore. Breakpoints already match the plan's four canonical viewports
exactly (`390×844, 768×1024, 1280×900, 1440×960`) — no change needed there.

---

## D-009 · Two harnesses and one migration runner are from-zero builds

- **No two-database (Tasks + Timeline) harness exists.** The repo says so in its own
  comment: `timeline-provisioning-contract.test.mjs:15-19`. WP4's entire gate depends
  on it.
- **No Tasks + Notes harness exists.**
- **No receipt-backed Timeline migration runner exists.** `drizzle-timeline/` holds
  one consolidated `0000` baseline and the only write paths are
  `timeline:db:push:unsafe` / `timeline:db:generate`. `drizzle.timeline.config.ts:5-10`
  confirms production runs a standalone `0000–0007` chain. WP4 deliverable 1 is a
  runner build **plus** a ledger-adoption operation — two tasks, not one.
- The existing `experience/timeline-switcher.playwright.config.ts` proves one Tasks
  workspace with three Timeline-local children. It does **not** prove an A/B Tasks
  Project journey. The plan states this and is **correct**.

---

## D-010 · The analytics "project" scope collapses into workspace

The analytics audit surfaced this as a possible founder decision: under D-011
(`Projects = workspaces`) the analytics `"project"` scope must either **(a)** collapse
into `"workspace"`, or **(b)** be re-pointed at Timeline `projects` as a genuine
sub-workspace grouping. The two produce different ledgers.

**Decision: (a).** This is not an open fork — current approved product truth already
answers it:

- ADR 0001 and `src/server/actions/project-overview.ts:6` (D-011): a Project **is** a
  workspace. Option (b) would reopen a question already closed.
- The Active Project plan §8.5 is explicit: *"`projectIdFromTag` is not a suite Project.
  Rename this analytical concept to Label or Workstream."*
- The Analytics research report's own ledger spec defines the Project field as
  *"Canonical workspace/project identity."*

Tag-derived identity survives **only as a Label/Workstream facet or breakdown**, never
as identity, and never labelled "Project" in the UI. Flagged to the founder as an
FYI, not a blocking question.

**Consequence:** `contracts.ts:11-18` must also gain the **Program (planning-period)
axis** the analytics domain currently lacks entirely, or explicitly record that it does
not carry one.

---

## D-011 · A dedicated Home Analytics flag is required

`SIGNAL_ANALYTICS_V1_ENABLED` is not an analytics-view switch — it is a **briefing-engine
switch**. Its only two consumers are `signal-brief-page.tsx:38` (chooses which briefing
renders at `/app/home/briefing`) and `policy.ts:44` (the authorization gate for the whole
analytics domain). Turning it on *replaces a shipped, operator-visible surface*.

**Decision.** Keep `SIGNAL_ANALYTICS_V1_ENABLED` off as the engine flag. Add
`SIGNAL_HOME_ANALYTICS_ENABLED`, default off, gating only the new view. Split
`policy.ts:44` so the domain gate accepts either flag. Confirms the Analytics brief's
own contingency.

---

## D-012 · Fixtures currently certify a world that does not exist

`fixtures.ts:58-59` declares `decision_read` and `milestone_date_history`. **No live
provider ever declares either** (`providers/notes.ts:173`; `providers/timeline.ts:251`,
which depends on Timeline `activity` rows that nothing in this repo writes).

Every green analytics test therefore runs over capabilities production does not have.

**Decision.** Aligning fixture capabilities to live provider declarations is a
**prerequisite** of the Analytics truth foundation, not a cleanup. Until it lands, no
analytics test result may be cited as evidence of live readiness. Add the first
live-provider test (fixture DB over `providers/tasks.ts`) in the same wave.

---

## D-013 · The Analytics lab must carry its own authentication

`policy.ts:49-63` returns a synthetic principal `signal-${mode}` and **never calls
`auth()`** on preview/review deployments. Fixtures fail closed in *production*
(`access-mode.ts:50-59,71-78` — verified), but **any preview URL would serve a fabricated
portfolio to an unauthenticated visitor** if the flag were on. It is deny-by-default only
by accident of the flag 404ing first.

**Decision.** The Wave 5 Analytics lab implements its own authentication and reviewer
allowlisting. It must not inherit the fixture path's posture. This satisfies the
Analytics brief's deny-by-default lab requirement, which the current code does not meet.

---

## D-014 · Home and Full Briefing evidence links are opposite defects

- **Home** never carries the Project (`home-data.ts:82-84` emits `/app/task/${id}`).
- **Full Briefing** *does* carry it (`ledger-task-target.ts:53-57`) — and **the
  destination discards it**. `src/app/app/tasks/page.tsx:18-22` reads only `welcome`;
  `tasks-runtime-shell.tsx:68` then falls back to ambient. The only route consuming
  `workspaceId` is `src/app/app/page.tsx:17-29`, which demands `contextVersion=2` that
  the ledger builder never sets.

**Decision.** Two separate WP3/WP9 work items. Bundling them would produce a fix that
appears to work on one surface and silently fails on the other.

---

## D-015 · WP3 scope extends into the Timeline and Notes modules

The inventory covered the Tasks active-workspace cookie. `src/modules/timeline/server/auth.ts:112`
`getCurrentWorkspace` and its `workspaces[0]` fallback at `:126` are the same class of
defect in the Timeline lane and were not audited.

**Decision.** WP3 is not complete at 95 Tasks call sites. The Timeline and Notes modules
get their own ambient inventory pass before the WP3 gate is claimed.

---

## D-016 · Analytics defects the research report does not name

The research report names five gaps. The audit found seven more, each release-blocking
and each recorded with evidence in `docs/wave/ANALYTICS_TRUTH.md`: R2 blocked-work dead
post-migration-0024 · R3 wrong done-predicate · R4 two metrics structurally unreachable ·
R5 cross-product link arrays hardcoded empty · R8 viewer-scoped Notes aggregates
undisclosed · R9 owner-identity collision · R10 unordered 2,000-row read. It also
understates R1: there are **three** colliding Project id spaces, not one.

**Decision.** `ANALYTICS_TRUTH.md` supersedes the research report's gap list. Phase 0 of
Analytics is scoped from the audit, not from the report alone.

---

## D-017 · The sole-owned pairing is accepted as a forced pairing, not an inference

WP1's exact Timeline resolver refuses to guess in every branch but one. The lane
correctly escalated it rather than deciding alone.

**The branch** (`src/modules/timeline/lib/adopt-timeline.ts:158-166`): adopt an unclaimed
Timeline only when **all three** hold — exactly one owned Timeline claims nothing, the
actor owns exactly **one** Tasks Project (`LIMIT 2` uniqueness proof), and the Project
requested **is** that Project.

**Decision: accept.** This cannot produce a wrong-Project answer, which is the entire
point of the P0:

- The failure mode being prevented is "requesting B returns A's Timeline." In this
  branch **there is no A** — the actor owns exactly one Project, and it is the one
  requested. There is no second pairing the evidence could support.
- Timelines bound to another Project are excluded from `unproven` before this branch is
  reached (`:151-154`), so a sibling Project's Timeline can never be adopted here.
- Provisioning is owner-only, so an unclaimed Timeline cannot belong to a Project the
  actor merely has membership of.

It is materially different from the defect it replaces: `open first existing Timeline`
required no uniqueness on either side. This requires uniqueness on **both**.

**The alternative is worse.** Removing this branch buys no safety — it cannot be wrong —
and costs real users: a single-Project couple who created a Timeline in-app would hit a
dead end until WP4 ships the reconciliation UI. That is exactly the production incident
these paths were built to fix. Rejected.

**Carried forward:** `owner-reconciliation-required` is returned, typed and tested, but
has no UI — it currently renders the existing "not available" state. That is a *refusal*
rather than a wrong answer, so it is safe to ship, but it is a dead end for owners with
two Projects and an unclaimed Timeline. Connect-existing / Start-new is WP4/WP5 and is
recorded as an open item, not silently deferred.

### D-017 amendment · the premise was not met by the implementation

Independent review refuted the reasoning above **as implemented**. The decision stands;
the code did not satisfy its stated premise.

`getSoleOwnedTasksWorkspaceIdForUser` counted only **non-archived** owned Projects. D-017
argued *"the actor owns exactly one Tasks Project… there is no second pairing the evidence
could support."* With archived and deleted siblings excluded from the count, there is one.

Reproduced: owner holds archived `ws_2024` and active `ws_2026`, plus one unclaimed in-app
Timeline created for 2024. A request for `ws_2026` returned `adopt` and bound the 2024 plan
to the 2026 Project **permanently** — `connectSuiteWorkspaceAction` refuses to rebind.

**Correction:** the uniqueness proof must count *all* owned Projects regardless of archive
state. The requested Project is already proven non-archived before this is consulted, so
counting archived rows makes the proof strictly stronger. Fixed and re-verified.

A second door to the same lockout was then found on the **adopt** branch, which had no
ownership gate at all: a co-owner promoted to `role:"owner"` on someone else's Project
could bind their own Timeline to it. The eligibility gate belongs on the branch, **not**
on the count — narrowing the count would reopen the archived-sibling hole, because a
co-owned Project is still a Project an unclaimed Timeline could belong to.

**Process note.** This was accepted on my own inspection and passed the lane's tests. It
took an adversarial reviewer with a reproduction to find it — twice. The lesson
generalises: a safety argument is only as good as the query implementing it, and "I read
the code" is not equivalent to "I tried to break it."

---

## D-018 · The defect class: authorization expressed as a row filter

WP1's blocker was one instance of a general class. Naming the class found seven more.

> **When a permission check lives inside `WHERE`, `EXISTS`, or a JOIN rather than as its
> own proof, "you may not read this" and "there is nothing here" become the same empty
> result.** Wherever that empty result then drives a destructive or state-changing
> decision, it is data loss waiting for the right account state.

**Decision.** Every lane from WP3 onward prefers an explicit membership/capability proof
*before* the query over adding another `AND workspaceId = ?`. Where an empty result gates
a delete, revoke, unpublish, erase, "all clear", or a count that gates an action, a
separate proof is **mandatory**, and the module must be self-sufficient rather than relying
on a caller's gate — a shield that lives in the caller breaks the moment a second caller
appears.

The repo already contains the discipline to copy: the Notes→Tasks outbox
(`src/modules/notes/server/actions/notes.ts:1238-1254`) uses `.returning()` and throws on
zero rows for every reservation, release and commit. Planning lifecycle mutations do the
same (`src/server/actions/planning.ts:526,557,1009`).

---

## D-019 · Two pre-existing erasure defects that report success without erasing

**Found by the WP1 auth-as-filter sweep. Outside this programme's scope, more serious than
anything inside it, and recorded here so they are not lost.**

Both read an empty scoping query as "there was nothing to erase", when it is equally
consistent with "the identity key did not match".

**1 · Timeline GDPR erasure** — `src/modules/timeline/server/timeline-gdpr.ts:157-161`

```ts
const ownedWorkspaces = await db.select(...).where(eq(workspaces.ownerUserId, clerkId));
if (ownedWorkspaces.length === 0) return { ok: true };
```

`workspaces.ownerUserId` is written from `requireUser()` — a Clerk subject in production,
but `"david"` under the dev fallback (`src/modules/timeline/server/auth.ts:54`) and a
fixture id in seeds. On any identity drift this returns `ok` having erased nothing.

**2 · Tasks account erasure** — `src/server/account-erasure.ts:69-74` returns early when no
`users` row matches `clerkId`. Its docblock justifies this for "nothing provisioned yet" —
but the schema names the other cause at `src/server/db/schema.ts:175-178`: a legacy user
whose `clerk_id` is null until the webhook claims them, or a re-signup mid-webhook. In that
state the user's entire Tasks corpus survives an erasure that reports success.

**Why this compounds into something irreversible.** `deleteUnifiedAccountDataWith`
(`src/server/account-unified-erasure.ts:88-98`) logs module failures but **never aborts**,
and the caller deletes the Clerk identity **last**. Once that subject is gone, the surviving
rows can never be matched to a data subject again.

**Decision.** Assigned to **WP10**, where the plan already requires durable per-module
erasure receipts before account identity deletion completes. Fix shape for both: return a
**count**, not a boolean, and have the orchestrator refuse to proceed to Clerk deletion when
a module erased zero rows for a subject Tasks proved exists.

**Deliberately not fixed opportunistically.** Erasure correctness deserves its own change,
tests and review — not a drive-by inside a Timeline safety wave. Flagged to the founder as
a legal/privacy item: GDPR erasure reporting success without erasing is a compliance
exposure, not merely a bug.

**Reachability unverified** — needs production data: how many `workspaces` rows have
`owner_user_id IS NULL`, and how many owners have `users.clerk_id IS NULL`.
---

## D-020 · The Active Project destination allowlist includes `your-work`

**Decision.** `switchActiveProjectAction`'s enum (plan §3.5 step 5) carries six
surfaces, not the five the plan lists: `tasks`, `timeline`, `notes`, `project`,
`home`, and **`your-work`**.

**Evidence.** `src/app/api/suite-context/route.ts:23,54` builds
`new URL("/app/your-work", request.url)` as its *only* destination, and
`src/app/app/page.tsx:29` redirects into that route. Every inbound suite
context link in production therefore lands on `/app/your-work`. The route
exists (`src/app/app/your-work/`) and is absent from the plan's enum.

**Reasoning.** An allowlist that cannot express the one destination production
actually uses is an allowlist that will be worked around. Adding it costs
nothing — it is a fixed path, built from a typed constant
(`YOUR_WORK_APP_PATH`), and carries only `workspaceId`.

**Consequence.** `/app/your-work` also keeps its local `projectId` parameter
through V3 canonicalisation, alone among the surfaces. That parameter is a
local filter over the caller's own catalog, not a suite identity; D-010 renames
the concept to Label/Workstream in WP9, and dropping it before then would
silently change what that page shows. Recorded here rather than left in a code
comment, per D-007's rule that renegotiations are recorded, never silent.

---

## D-021 · The legacy cookie has five writers, and one of them is a contextual link

**Status: an accepted, bounded contradiction with ADR 0001 §4. Not resolved.**

**The ADR says** (§4): "Following a contextual link does **not** rewrite the
cookie. Only an explicit Project selection does." It also says (§4 step 3) that
the resolver must "validate the legacy `tasks_active_ws` cookie during
migration."

**The repository says** those two cannot both be true today.
`src/app/api/suite-context/route.ts:60` is the inbound contextual-link handler
— `src/app/app/page.tsx:29` redirects into it — and it writes
`tasks_active_ws`. So while the resolver honours that cookie, following a
contextual link *does* change the future bare-entry preference.

`tasks_active_ws` has **five writers with four different attribute sets**:

| Writer | Attributes | Note |
|---|---|---|
| `src/app/api/suite-context/route.ts:60` | httpOnly, secure, maxAge, path, sameSite | the contextual-link handler |
| `src/server/actions/cross-workspace.ts:193` | **httpOnly: false**, maxAge, path, sameSite | readable by any script on the page; no `secure` |
| `src/server/actions/planning.ts:1252` | httpOnly, secure, maxAge, path, sameSite | |
| `src/server/actions/settings.ts:614` | maxAge, path, sameSite | **no httpOnly, no secure** |
| `src/server/actions/templates.ts:136` | httpOnly, path, sameSite | **no maxAge** — a session cookie |

**Decision.** Keep the legacy read, and pin the writers.

Dropping the legacy read would strand every existing user's last-active
preference at cutover, and the ADR mandates it during migration. Its blast
radius is bounded and small: the legacy cookie can only influence a
**bare-entry default**, never a rendered page, never a link, and never a
mutation — every one of those requires an explicit `workspaceId`, and the
resolver refuses to substitute. The worst case is that a user who followed a
contextual link to B, then later opened `/app` bare, lands in B rather than in
their last explicit choice.

`src/server/projects/active-project-contract.test.mjs` now enumerates all five
writers against a dated allowlist and pins their exact attribute sets, so a
sixth writer, or a changed attribute, fails the build. The unified
`signal_active_project` name is pinned to a single module for the same reason.

**Interface requests, not WP2 edits** (all five files are other lanes'):

1. ~~`cross-workspace.ts:193` — set `httpOnly: true` and `secure` in
   production.~~ **Accepted by the WP3 actions lane**; lands with WP3. A
   workspace preference readable by page script was the weakest link in the
   set.
2. `settings.ts:614` — add `httpOnly` and `secure`. **Still outstanding.**
3. ~~`templates.ts:136` — add the 30-day `maxAge` its four siblings all
   carry.~~ **Accepted by WP3**; lands with WP3. It should gain `secure` too,
   which is **still outstanding**.
4. `suite-context/route.ts` — stop writing the cookie on a contextual link, or
   ratify that inbound suite links count as explicit selection. This is the
   ADR contradiction and it needs a decision, not a patch. **Still open.**
5. All five — migrate to `writeActiveProjectCookie` once WP3/WP6 owns them.

The allowlist in `active-project-contract.test.mjs` names the two incoming
changes and their new pinned values, so the build failure that follows the WP3
merge is self-explanatory. Re-pin them; do not widen the assertion to accept
either shape.

**Consequence.** WP6 must not claim "one writer, one set of attributes" for the
last-active preference until items 1–5 land. WP2's writer is single; the cookie
the resolver reads is not.

---

## D-022 · The Tasks runtime must move from the layout into the pages

**Surfaced by WP3-B as a blocker it correctly refused to work around.**

`/app/tasks?workspaceId=B` **cannot render B's board** while `TasksRuntimeShell` is
fetched in a layout. It is mounted from nine `layout.tsx` files, and Next 16 does not
give layouts the URL:

- Next's own type generator declares `PageProps` **with** `searchParams` and
  `LayoutProps` **without** it (`next-types-plugin/index.js:128-136`).
- The bundled docs state the intent — reading the current URL from a Server Component
  is unsupported *"to support layout state being preserved across page navigations"*
  (`use-pathname.md:38`).
- `unstable_rootParams` was removed in 16.

**A header workaround is worse than unavailable.** Layouts are not re-rendered when
only the query string changes, so a header-derived Project would go stale on an A→B
switch and label the board with the Project it no longer showed — precisely the
inequality ADR §2 calls a release blocker.

**Interim behaviour, deliberate.** Where the URL names an authorized Project that
disagrees with what the layout resolved, `/app/tasks` **withholds the board and states
the disagreement**. Showing A's data under a URL saying B is the failure this programme
exists to eliminate; showing nothing is honest. Rendered and reviewed: the state is
correct but a dead end — it names a switcher that is not on screen and its only link
leads away from what the user asked for.

**Decision.** Move the Tasks runtime out of `layout.tsx` into the page boundaries, as
plan §3.4 already requires: *"load the membership-filtered Project Catalog and exact
Project in each page/server route boundary."* The plan said pages; the code has layouts.
Assigned to **WP6**, and it is a **precondition** for WP6's selector — a Project control
that cannot change the board it sits above is not a Project control. The mismatch state
disappears entirely when it lands.

---

## D-023 · `getActiveWorkspace()`'s ordering changed at WP3 integration, not in a lane

**Done.** The WP2 follow-up made `getActiveWorkspaceOrNull()` deterministic through
`firstMembershipByCatalogOrder`, shared with the catalog listing and the resolver's
`first-active` default. `getActiveWorkspace()` was deliberately left alone by that lane:
giving an arbitrary answer a *different* arbitrary answer moves which Project an existing
multi-membership user lands on at bare entry — a live change outside the flag across ~30
call sites.

The `ORDER BY` therefore landed in the **WP3 integration commit**, made by the
integration owner, where both lanes' migrations were visible together. Three accessors
now answer "first" identically; a bare entry can no longer land in one Project while the
chooser highlights another.

**Determinism is not authorization.** `seed.ts`'s two destructive paths keep requiring
`manageProject` rather than bare membership — a stable guess is still a guess — and that
is now asserted in code rather than left to a future reader's judgement.

---

## D-024 · The Quality Council gate is structurally broken and must be repaired before it can certify anything

**Found by the WP3-C lane; verified independently on `02e2206`.**

`pnpm experience:council` exits **1**, and has since before this programme started. Two
independent structural causes:

1. **`experience/council-reviews/journeys/` has never existed.** Only `baselines/` is
   present in the repo.
2. **The baselines pin stale source commits** — `d1af9ae` (2026-08-09) and `084085f`,
   both ancestors of current main. Their `sourceTreeSha256` was already stale before
   WP3-A, WP3-B and the ratchet landed, and every commit since widens the gap.

It is currently masked: the workflow marks the step `continue-on-error: true`, so
`registry-and-drift` reports green while the council check fails inside it.

**Why this matters more than it looks.** The plan's Definition of Done (§15) and WP11's
gate both require a **fail-closed 9.5 Quality Council** — raw ≥50/52, no dimension below
3, minimum not average, ≥3 independent reviews. That instrument cannot presently run. A
gate that always fails is indistinguishable from one that is never consulted, and a gate
marked `continue-on-error` is in practice the latter.

**Decision.** Repairing the instrument is **Wave 8 work and a precondition of
certification**, not a closing chore: create the missing journeys directory and its
schema, rebaseline against the certified commit, then run the gate for real. Until then
**no 9.5 claim may be made by anyone** — including by citing a green
`registry-and-drift`, which does not mean what it appears to mean while that flag is set.

Recorded several waves early, because the cheapest moment to discover a broken gate is
long before the release that depends on it.

---

## D-025 · The Active Project control is variant A, the Studio Bar anchor

**Selected by Ethan, 17 August 2026**, from the four-variant lab at `/lab/active-project`,
reviewed live rather than from screenshots.

One control in the permanent Studio Bar, in the same place on every product. This is the
direction the plan recommended, and the founder's selection is what makes it binding —
the recommendation was not.

**What this settles for WP6.** The selector is chrome, not content. It lives in the Studio
Bar and the mobile context strip, it is present on every product surface, and its position
does not move between Notes, Tasks and Timeline. The catalog, the guarded transition and
the accessibility semantics were locked by the lab and are shared across all four
variants, so nothing in those areas is reopened by this selection.

Two implementation facts the lab established and WP6 inherits:

- `globals.css` carries an unlayered `focus-visible` rule setting `border-radius: 6px`
  that beats every Tailwind radius utility, because utilities live in a cascade layer and
  that rule does not. WP6 will hit this.
- Under 8 active Projects the chooser is a listbox with character typeahead; at 8 or more
  it is a real combobox with debounced count announcements. That threshold is a lab
  finding, not a guess.

### Killed with A: what the other three proved

WP11 requires an explicit keep/kill verdict on every lab variant. These are kills, and
each one bought something.

**B · Product canvas band — KILLED.** The thesis was that the Project belongs to the
content rather than the frame, and that choosing one should open a room. It was built
further than felt safe on purpose. It proved that treating the Project as content makes
the Project ambiguous the moment a surface has no canvas of its own, which is most of
Tasks. Kept from it: the idea that arriving in a Project should feel like arrival, which
A can express in its transition without moving the control.

**C · Command-led hybrid — KILLED.** A quiet receipt you never click, plus Cmd/Ctrl+K for
everything else. The plan argued against it and it was built anyway to price the refusal
honestly. It proved the refusal was correct: a control that is only reachable by keyboard
fails the WP6 gate, which requires a newcomer to switch Project unaided. Kept from it: the
command-palette path is a legitimate accelerator, and WP9's unified palette should carry
Project switching as a secondary route.

**W · The deck — KILLED.** The wildcard, where every Project owns a colour and a monogram
so you recognise where you are before you read it. It proved that recognition-first works
only with a designed palette, not a computed one: hashing the Project id gave 8 distinct
colours across 13 Projects, and it took a designed twelve-colour palette assigned by
stable catalog order to make the idea function at all. Kept from it: nothing in V1.
Recorded because a future Project-identity treatment should start from that finding rather
than rediscover it.

---

## D-026 · The Home Analytics composition is 03, Plan Trace

**Selected by Ethan, 17 August 2026**, from the five-composition lab at
`/lab/signal-analytics`.

Dated commitments against the current state of the work behind them. All three truth
classes appear in one device and are told apart by shape and by word, never by colour
alone: REPORTED for the commitment date with its author, OBSERVED for each piece of linked
work at its own recorded date, INFERRED for the gap between them with its rule stated.

**This selection carries a known and material constraint, which the founder was shown
before selecting.** Plan Trace was briefed as accepted-plan-versus-current-plan — how a
commitment date moved. That device cannot be built today:

- `milestone_movement` requires `milestone_date_history`, which requires Timeline
  `activity` rows, and nothing in this repository writes that table (R4).
- `captureWorkspaceSnapshots` has zero callers and the only declared cron is the digest,
  so every trend resolves `insufficient_history` permanently (R7).

The lab version is therefore re-founded on the comparison that is real without any history
at all, and draws a dashed stub with a stated refusal where the movement line would go.
**That honest form is what ships**, and it does not wait for anything.

**Authorized alongside this selection (G2, Ethan, 17 August 2026):** both missing writers
are built now, ahead of the interface that consumes them, because plan history cannot be
backfilled and every day without them is a day that is gone. See the completion plan
Stage 1. This closes R4, R7 and D-012 as a side effect.

### Killed with 03: what the other four proved

**01 · Editorial Briefing — KILLED.** Numbers set as receipts inside the sentence they
support. It proved that a written read survives missing data more gracefully than any
tabular form, because a sentence can decline to make a claim where a cell cannot decline
to be empty. Kept from it: the refusal language. Plan Trace should state what it cannot
compare in prose, not in an empty cell.

**02 · Evidence Ledger — KILLED.** One table of every label with the three exceptions
lifted inside it rather than repeated above it. It proved the exceptions-inside-the-table
pattern is right and the whole-table form is wrong for one Project, where the row count is
too low to justify the furniture. Kept from it: exceptions live inside the structure they
qualify.

**04 · Hybrid — KILLED.** The written read, the fused ledger, and a third section spent on
what cannot be said. It scored well and lost on a narrow ground: it spends a full section
on absence, which reads as apology at this data volume. Kept from it: naming the gap is
mandatory, but it belongs inline where the reader would otherwise assume the opposite.

**W · The Wire — KILLED.** The wildcard: mono, warm paper, no indigo, paced rather than
scrolled. It proved that a paced reading changes what a reader takes away, and that the
house indigo is not load-bearing for legibility. Kept from it: nothing in V1. Recorded
because the paced form is the strongest candidate for a future digest or email surface,
where the reader cannot scroll.

---

## D-027 · The two programmes split Home by read and shell

**Ratified by Ethan's approval of the completion plan, 17 August 2026.**

Project Truth Wave 6 builds Home Analytics using the selected composition. The Home
operating layer's Analytics mode is that same surface, and its shell wave builds the frame
all four modes sit inside. Left alone, two programmes write the same route.

| Owns | Programme |
|---|---|
| The analytics **read** — providers, metric registry, truth classes, Plan Trace as a content component | Project Truth |
| The Home **shell** — routes, modes, navigation, chrome, the boundary contract | Home operating layer |

**The binding consequence:** Plan Trace is built as a shell-agnostic content component
that inherits its host's tokens. It is not built as a page. This is the only arrangement
that lets both programmes proceed without one waiting on the other, and it is the single
constraint most likely to be dropped under time pressure — building it as a page is
faster this week and costs a rewrite later.

A fitting pass is expected once the Home shell exists. That is bounded work, and only if
the component is built this way from the start.

Recorded in the Home programme as `D-H14`.

## D-028 · A contextual link is navigation, not selection

**Founder decision, 17 August 2026. Closes the D-021 writer #1 question, open since 12 August.**

`src/app/api/suite-context/route.ts` wrote the last-active Project cookie when someone
followed an inbound suite link. ADR 0001 §4 says only an explicit Project selection may
move that preference, and D-021 recorded the contradiction as a founder call rather than
patching it.

The call: **a link you were handed is not a choice you made.** A digest email, a shared
URL, a cross-product jump — each of those is someone else's decision about where you
should look. Glance at a notification about Project B, close the tab, open `/app`
tomorrow, and the old behaviour had you in B with no memory of choosing it. That is the
same wrong-Project substitution WP2 and WP3 spent two waves removing, arriving through
the one door nobody had closed.

So the Project travels in the URL. The handler still proves membership before it sends
anyone anywhere, the destination reauthorizes through the resolver's explicit
never-substitute branch, and the browser's preference is left exactly where the person
last put it.

**Removing the write alone would have been the worse bug.** Without the id in the URL the
link would have landed in the ambient Project — the substitution, restored by a fix meant
to remove it. The two halves are one change.

**Why this was takeable now and not in July.** The cookie write was the only thing making
a contextual link feel sticky. WP6 Lane A (D-025) puts an Active Project control in
permanent chrome on every surface, so a person who lands in B and wants to stay has a
visible, one-click way to say so — an explicit selection, which is exactly what ADR 0001
§4 asks for. The affordance had to exist before the implicit behaviour could be withdrawn.

Five legacy writers become four. The ratchet in `active-project-contract.test.mjs` fails
if this one returns, and the guard in `suite-context-contract.test.mjs` was renegotiated
rather than deleted: it now pins that nothing authorized reaches the caller before both
checks run, and that this route writes no cookie at all.

Outstanding, unchanged: migrating the remaining four onto `writeActiveProjectCookie`
(D-021 interface request 5).

## D-029 · The council gate publishes in every state, and goes red only when the instrument is wrong

**Founder decision, 17 August 2026. Answers F4 of the council repair specification.**

`continue-on-error: true` sat on the council step inside `registry-and-drift`, a required
check. It collapsed three different situations into one green tick: a validator that
cannot run, an honest NO-PASS, and a baseline whose review has aged out of the current
tree. D-024's complaint was exactly this — a gate that always fails is indistinguishable
from one that is never consulted.

The mask existed because the validator could not tell those states apart. Now it can, so
the mask is gone. `pnpm experience:council:ci` splits them:

| State | CI | Why |
|---|---|---|
| Certified (50/52 everywhere) | green | The instrument ran and the product cleared the bar. |
| Honest NO-PASS on the external baseline | green, verdict printed in full | True, expected until State B, and not a defect. |
| Not yet certified / baseline tree stale | green, every reason listed | Both happen by design; a stale baseline follows every source merge. |
| Anything else | **red** | Validator cannot run, contract hash rotated, receipt malformed or tampered, baseline edited. Believing the gate here would be a mistake. |

**The stale-baseline case is deliberately not red.** An external review describes the tree
it read; every `src/` merge moves the tree. Red there would mean no source change could
land without first commissioning a ten-director review — the gate would stop the product
to protect its own freshness. It is published loudly instead, naming both hashes.

Mutation-tested in both directions before landing: removing a director from the baseline
exits 1 with the structural errors named and the expected notes suppressed; restoring it
exits 0.

**A green tick on this check is never a 9.5 claim.** The not-certified output says so in
its own last line, because the failure mode this whole decision guards against is somebody
citing a green check as evidence of a bar that has not been cleared.

## D-030 · The gate does not move; capacity and baseline approval are the scheduled work

**Founder decision, 17 August 2026. Answers F3 and F5 together, as `VISUAL_BASELINES.md`
asked — they are one question and were asked once.**

State B needs 104 assessment units at 13 dimensions each: 1,352 evidenced dimension
scores, three genuinely independent reviewers per receipt, twelve artifacts per unit, and
an approved visual baseline for every one. Zero approved baselines exist. This exceeds
solo review capacity, which is what made it a founder question rather than an engineering
one.

**The gate does not narrow.** Not by unit count, not by dimension count, not by sampling,
not by "representative" units. R-H08 already makes narrowing inside a programme an
automatic veto, and the reason is worth restating plainly: a bar you clear by lowering it
certifies nothing. The instrument's only value is that it is the true standard, and the
first time it is adjusted to fit available capacity it stops being evidence and becomes
decoration.

What changes is the plan, not the measure. Certification is scheduled work with a named
capacity requirement, and until that capacity exists the honest answer is the one the gate
already gives: not certified.

**Visual baselines (F5) are approved per unit, at the moment that unit is first reviewed
— never in a batch.** A bulk approval of baselines nobody has looked at one by one is the
same falsification as a mechanical hash bump, performed on images instead of hashes. The
existing mechanic already enforces it: a unit whose `baselineStatus` is not `approved`
cannot certify, and that is left exactly as it is.

## D-031 · B0 is re-pinned in place, and never deleted

**Founder decision, 17 August 2026. Answers F2 now and F6 in advance.**

**F2 — the record is rewritten in place at `wave-0-b0`, not forked to `wave-0-b1`.** The
baseline's value is the finding: an external panel of ten held this product against a
9.5 floor and it did not pass. A fresh review updates that finding; it does not create a
second, competing one. Two baselines where the validator only ever consults one is how a
superseded record gets cited as current — and it would need a validator change to reach,
which rotates contract hashes and must land before any receipt, adding churn for a second
copy nobody should read. The superseded 2026-08-09 record stays in git history, which is
the durability mechanism this repository already relies on elsewhere, and the commit that
replaced it names what it replaced.

**F6 — on certification day, B0 is re-pinned against the certification release with a
fresh review. It is never deleted.** Deleting is permitted by the schema and would erase
the only external evidence of where this product started. A certification that also
destroys the record of the bar being missed is worth less than one that stands beside it.
This is recorded now, several waves early, because the cheapest moment to refuse a
tempting deletion is long before the release that makes it tempting.

## D-032 · The council baseline is re-reviewed, and State A is reached

**F1 executed under founder authorization, 17 August 2026.**

D-024 recorded that `pnpm experience:council` had exited 1 since before the programme
began, with nine raw errors and a `continue-on-error` mask hiding them inside a required
check. The council repair specification separated the two ways out: **State A**, the
designed honest NO-PASS, buyable with one authorized ten-director review; and **State B**,
a real exit 0, which needs 104 assessment units, 1,352 evidenced dimension scores and
three independent reviewers per receipt that have never existed.

State A is now reached. The single defect separating the raw nine-error state from the
designed one was the stale baseline tree hash — and the specification is explicit that a
mechanical bump would attach the 2026-08-09 director scores to a tree 391 files away from
what they reviewed, which "the validator would accept and which is falsification that only
record-keeping discipline prevents". So the review was re-run rather than the hash bumped.

**What was actually done.** Ten director lenses, the same ten seats as B0, each scoring all
seven surfaces independently and none able to see another's scores. Every director opened
every screenshot for a surface before scoring it. Evidence: 16 renders at 1440×900 and
390×844 from production builds of both the app and the marketing site, 16 axe-core WCAG
2.1 AA runs, console and HTTP capture on every render. The app was rendered with the
Active Project flag off, because that is what production serves.

**The result: NO PASS, unanimously, with no vetoes.**

| Surface | Index | Floor |
|---|---:|---:|
| Pricing | 7.34 | 6.8 |
| Tasks boards + views | 7.55 | 6.8 |
| Task cards + detail | 7.81 | 7.5 |
| Notes | 7.83 | 7.0 |
| Timeline owner + sharing | 7.97 | 7.5 |
| About | 8.03 | 6.9 |
| Landing | 8.07 | 7.2 |

Suite floor 6.8/10 against a 9.5 gate. Zero vetoes — nothing the panel found was
disqualifying on its own; the product is simply not at the bar yet, everywhere.

**Who reviewed, stated plainly.** The panel was ten independent agent lenses conducted by
Claude Opus 5, one per seat, orchestrated so that no seat could see another's scores. That
is what "external" means here — external to the build, holding the released artefact at
arm's length — and it is written into the evidence manifest rather than left for a reader
to infer. Each director's full review, with per-surface rationale naming the specific
elements it saw, is committed under `experience/council-evidence/wave-0-b0/directors/`,
and each file's SHA-256 is sealed into the baseline.

**The panel's own declared limits, which lowered scores rather than being waived.**
Captures are viewport-only, so below-fold layout is unassessed — including the Pricing plan
cards, the highest-risk responsive component on the marketing site. There is no
intermediate breakpoint between 390 and 1440. There is no motion, performance or native
assistive-technology evidence. The demo fixture carries only short, well-behaved content,
so nothing here tests long titles, deep subtasks or real comment threads. Directors were
instructed to give no optimism to what the evidence could not show, and several recorded
exactly where they had done so.

**Verification, both directions.** `pnpm experience:council` now exits 1 in
external-baseline mode — the score matrix, not the error list — which is the state the
specification names as State A. Any edit under `src/` flips it back to the stale-tree
error and reverting flips it back; that flip is the pin working, not a regression, and it
was exercised before this landed.

**What this does not buy.** Not certification. The seven certification receipts still do
not exist and cannot honestly be authored at current review capacity (D-030). No 9.5 claim
may be made on this basis by anyone, including by citing the now-green CI check — which is
why D-029's not-certified output says so in its own last line.

## D-033 · The baseline pins the commit that survives the merge, not the one that was rendered

**18 August 2026. State A lasted one commit.**

D-032 landed State A and verified it on the branch. It did not survive the merge. The
baseline pinned app commit `c02ddfa`, the pre-merge head of PR #151, and the squash-merge
that landed that PR on `main` as `ba2c905` left `c02ddfa` reachable only from the PR
branch. The reachability check D-029 unmasked — *a receipt pinned to a commit nobody can
find is not a receipt* — therefore failed on `main` from the moment the repair merged.
`experience:council --ci` reported `INSTRUMENT FAILURE`, correctly, and the required
Design quality check went red at `ba2c905` on step 14. PR #150 was blocked behind it.

This is the same defect the workflow comment predicted in D-029's own diff, one commit
earlier than expected: it noted the previous baseline's commit had been failing this check
every run, swallowed by the mask. Removing the mask surfaced it. Squash-merging then
recreated it immediately, because a squash always discards the sha the review names.

**The fix is the pin, not the check, and not the scores.** `sources.app.sourceGitCommitSha`
now reads `ba2c905`. That is honest and it is not a hash bump: all seven pinned integrity
inputs — `src`, `public`, `drizzle`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`,
`tsconfig.json` — resolve to **the same git tree objects** at `c02ddfa` and at `ba2c905`
(`src` at `1d3fec73`, `public` at `cf61c5e4`, `drizzle` at `ab6a865a`, the four files
identical blobs). The ten directors reviewed exactly the tree `main` now carries;
`sourceTreeSha256` never went stale, which is why the stale-tree error never appeared.
D-032's warning was about attaching scores to a tree 391 files away from what was read.
This attaches them to a byte-identical one.

**What was deliberately not touched.** The ten director reviews under `directors/` still
name `c02ddfa`, because that is the commit each of them actually read and a first-person
record is not rewritten to tidy a machine check. `evidence-manifest.json` likewise. Only
two files change: the baseline's pinned commit, and the report's provenance paragraph,
which now states both shas and the identical-tree proof — so the reader is told why the
two disagree rather than discovering it. The report's re-hash into
`artifacts[0].sha256` follows from editing the report, and no score, seat, veto or
decision moved.

**Verified both ways.** `experience:council` exits 1 printing the score matrix — State A,
the designed honest NO-PASS. `experience:council --ci` exits 0, `instrument healthy`, with
the seven surface indices printed and the gate restated. Still no pass, still no
certification, and still no 9.5 claim available to anyone citing the green check.

**The standing hazard.** Every future squash-merge of a PR that re-pins the baseline will
reintroduce this. The durable fix is to pin the baseline in a follow-up commit on `main`
after the merge, or to stop squashing the council PRs. Recorded here rather than solved
now, because the choice between those two is a repo-convention call.
