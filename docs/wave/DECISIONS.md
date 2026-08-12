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
