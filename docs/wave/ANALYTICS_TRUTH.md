# Signal Analytics — data-truth audit findings

**Audited:** `3682bf7`, read-only, static trace of `src/modules/signal/{lib,server}/analytics/**`
**Purpose:** close the "hard pre-design truth gate" before any high-fidelity Analytics UI.

**This audit materially amends the research report**
(`signal-analytics-research-and-product-direction-2026-08-12.md`). The report names
five gaps. Seven more exist, and it understates the central one. The report should not
be used to scope Phase 0 without reading this alongside it.

---

## The headline: what cannot be claimed today

1. **No analytics surface reaches any user, in any environment.** `/app/home` uses the
   legacy triggers engine (`home-data.ts:101`). `/app/home/briefing` renders the legacy
   briefing because the flag is off (`signal-brief-page.tsx:38`).
2. **"It works, it's just behind a flag" is false.** Behind the flag sit R1–R9 below —
   semantic defects, not missing polish.
3. **No metric has ever been verified against real data.** Zero tests import any
   provider, the service, the policy, or the snapshot layer. All 47 analytics test
   cases run over fixtures or source text.
4. **No trend or historical comparison is producible.** No snapshot writer is called;
   no cron exists.

---

## Release-blocking defects

### R1 · Three colliding Project id spaces (worse than the report says)

The report names one wrong id space. There are **three**, joined as if identical:

| Record | `projectId` actually is | Evidence |
|---|---|---|
| `TaskRecord.projectIds` | slugified `tasks.tags` | `providers/tasks.ts:145` |
| `NoteRecord.projectIds` | slugified tags of the *linked task* | `providers/notes.ts:151` |
| `MilestoneRecord.projectId` | Timeline `project_slug` | `providers/timeline.ts:206,217` |
| `TimelineDependencyRecord.projectId` | Timeline `project_slug` | `providers/timeline.ts:123` |
| `ProjectRecord.id` | slugified tag | `providers/tasks.ts:262-266` |

Unioned into one set at `lib/analytics/scope.ts:107-112`; joined at
`server/analytics/service.ts:566-571` (`milestone.projectId === project.id`) and
`:632`. A milestone's Timeline slug will almost never equal a tag slug, so the
"next milestone" per project row is a coincidence, not a fact.

Worse structurally: `contracts.ts:11-18` models `project` as a scope **nested inside**
`workspace`. Under D-011 (`Projects = workspaces`, `src/server/actions/project-overview.ts:6`)
that nesting is impossible, not merely mislabelled. And there is **no Program /
planning-period axis anywhere in the analytics domain** — the axis product truth
actually has.

### R2 · Blocked work is dead against live data

`providers/tasks.ts:128` — `explicitBlocking = row.lane === "blocked" || row.lane === "waiting"`.
`"blocked"` was never a lane (`src/lib/data.ts:1`), and migration
`drizzle/0024_retire_waiting_lane.sql:57-60` rewrote every `lane='waiting'` to
`lane='doing'` + `board_column_key='waiting'`. The analytics mirror schema has **no
`board_column_key` column** (`signal-tasks-db-schema.ts:14-42`).

So `blocked_work.explicitCount` (`metrics.ts:449`) is **always 0**. "Blocked work age"
is a named V1 metric family in the product direction. It does not work.

### R3 · Done is read with a different predicate from the rest of the app

`providers/tasks.ts:117,148` and `providers/notes.ts:105,154` call `isTaskDone(row, null)`.
A `null` config resolves `doneKeys = ["done"]` (`board-columns.ts:183-186`). A workspace
that renamed Done, or declared another column done-meaning, is read one way by the board,
digest, export and print — and another way by analytics. Completion, overdue, pace,
stalled and follow-up completion all inherit this. It is not disclosed as a coverage issue.

### R4 · Two of thirteen metrics can never be `available`

- `open_decisions` requires `decision_read`; the Notes provider declares only
  `["follow_up_read","cross_product_links"]` (`providers/notes.ts:173`).
- `milestone_movement` requires `milestone_date_history`, declared only when Timeline
  `activity` rows exist (`providers/timeline.ts:251`) — and **nothing in this repo ever
  writes that table** (`timeline-queries.ts` only reads it).

**Fixtures declare both** (`fixtures.ts:58-59`). So every green analytics test runs over
capabilities production does not have.

### R5 · Cross-product links are hardcoded empty

`providers/tasks.ts:162-163`, `providers/notes.ts:161`, `providers/timeline.ts:225`.
The only real edge is `milestone.linkedTaskIds` via the `ms-{workspaceId}-{taskId}`
convention (`providers/timeline.ts:266-270`). "Milestone exposure" — the report's #1 V1
metric family — is one-legged: it can see overdue/blocked linked *tasks*, never linked
*decisions*.

### R6 · Dead `/app/trends` links reach a real user surface

Built at `rules.ts:154`; used at `rules.ts:320,363,403,443,485,524,564`. `/app/trends`
does not exist.

The ledger boundary strips it (`ledger-contract.ts:137-148,363`) — but the **evidence
drawer does not**: `service.ts:549` returns actions unfiltered →
`evidence-drawer.tsx:266-271` → `action-link.tsx:11-14`, which has no allowlist. A
reader opening evidence sees a "See trend" button that 404s.

`rules.ts:485` is a **primary** action and the only action on `completion_pace_change`,
so that observation silently degrades to "Review in Tasks."

### R7 · No snapshot writer exists

Tables shipped (`drizzle-signal/0000_signal_baseline.sql:1-37`), readers wired
(`service.ts:414`), writer `captureWorkspaceSnapshots` (`snapshots.ts:244`) has **zero
callers**. `vercel.json` declares one cron and it is the digest. Trends always resolve
`insufficient_history`.

### R8 · Notes aggregates are viewer-scoped without disclosure

`providers/notes.ts:91` binds `WHERE user_id = <viewer>`. Two members of the same
workspace get **different follow-up counts from the same query**. The coverage issue
codes (`:178-189`) name three causes — none of them this one.

### R9 · Owner identity collision

`scope.ts:19-21` compares `scope.id` (a **Tasks** user id, normalized at `policy.ts:100`)
against `ownerIds`. But `MilestoneRecord.ownerIds` comes from Timeline's `assignee`
column (`providers/timeline.ts:226`), a different namespace. Under a `user` scope every
milestone and Timeline dependency is **silently dropped**.

### R10 · Unordered 2,000-row read

`providers/tasks.ts:58-62` — `LIMIT 2001` with no `ORDER BY`. Truncation is flagged
(`:178`) but *which* rows is undefined, so repeated reads can return different totals.

---

## What is genuinely good, and must be preserved

Not everything here is broken, and the working parts are the reason the direction is viable.

- **Private Note bodies never enter the analytics domain.** The query names its columns
  and never names `body` (`providers/notes.ts:84-85`), with the intent recorded at
  `:26-28` and enforced at contract level (`contracts.ts:122`, `NoteRecord.exposure:
  "approved_extract"`). `PersonRef` deliberately excludes email (`contracts.ts:82-83`).
  **This is exactly right and must survive the rebase.**
- **Missing sources degrade honestly.** Unset provider URLs yield `status: "unavailable"`
  rather than fabricated zero (`providers/timeline.ts:30-42`, `providers/notes.ts:36-46`).
- **The authorization chain is well built** — flag → identity → beta allowlist → live
  membership revalidation → self-scope → defence-in-depth re-filter
  (`policy.ts:44-108`, `scope.ts:63-142`).
- **The presentation boundary is genuinely certified.** `ledger-contract.test.ts` +
  `ledger-adapters.test.ts` (34 cases) prove DTO safety, URL allowlisting, opaque ids,
  and that partial/unavailable coverage never becomes a healthy empty day. That evidence
  carries over. It certifies nothing about data truth.

---

## Two isolation findings for the Wave 5 lab

1. **Fixtures fail closed in production, for a non-obvious reason.** `access-mode.ts:50-59`
   forces `demo`/`review` to `"production"` on a real production deployment, and
   `isProductionDeployment()` (`:71-78`) treats an absent `NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV`
   under `NODE_ENV=production` as production. Verified safe.
2. **But preview deployments serve synthetic data with no authentication.**
   `policy.ts:49-63` returns a synthetic principal `signal-${mode}` and **never calls
   `auth()`**. With the flag on, anyone holding a preview URL sees a fabricated
   portfolio. Currently masked only because the flag 404s first
   (`policy.ts:44`) and Playwright pins it off (`experience/playwright.config.ts:73`).

**Consequence for Wave 5:** the Analytics lab must add its own authentication and
reviewer allowlisting. It cannot inherit the fixture path's posture, which is
deny-by-default only by accident of the flag.

---

## Flag decision

`SIGNAL_ANALYTICS_V1_ENABLED` has exactly two consumers:
`signal-brief-page.tsx:38` (chooses **which briefing engine renders** at
`/app/home/briefing`) and `policy.ts:44` (the authorization gate for the whole
analytics domain).

It is **not an "analytics view" switch — it is a briefing-engine switch.** Turning it
on replaces a shipped, operator-visible surface. It gates no routes, no jobs, no
persistence, no exports, no telemetry (the only analytics writers have zero callers).

**Therefore a dedicated flag is required**, as the brief anticipated. Keep
`SIGNAL_ANALYTICS_V1_ENABLED` off as the engine flag; add `SIGNAL_HOME_ANALYTICS_ENABLED`
(default off) gating only the new view; split `policy.ts:44` so the domain gate accepts
either flag.
