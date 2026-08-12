# Repository truth at base `a849fc4`

Synthesis of the four Wave 0 read-only audits. Full evidence, with file:line citations
throughout, lives in `audit/`:

| Report | Lens | Lines |
|---|---|---|
| `audit/A-repo-product-truth.md` | Routes, runtimes, data owners, current composition | 602 |
| `audit/B-domain-permissions.md` | Project identity, authorization, mutations, privacy | 697 |
| `audit/C-design-interaction.md` | Tokens, shells, primitives, motion, lab isolation | 1221 |
| `audit/D-baseline-release.md` | Harness, CI, gates, ratchets, flags, migrations | 568 |

Live structural capture of the running product is in
`design/current-product-evidence/` (30 route × viewport captures with ARIA snapshots and a
landmark/heading audit, taken against the local review-mode server).

---

## The eight findings that change the plan

### 1. Home is not cross-product. It is one SELECT against the Tasks database.

`buildBriefingForUser`'s non-demo branch queries exactly one table, synthesises "projects"
by slugifying **task tags**, hardcodes `events: []`, and writes provenance as the literal
template `` `Tasks · ${workspaceName}` ``.
`src/modules/signal/server/briefing/signal-build-for-user.ts:302-341`, `:331`;
`src/modules/signal/lib/data/source.ts:292-295`, `:233-264`, `:271-273`.

**Consequence.** Home Read Scope is a **build**, not a rewire. Every cross-product claim
Today's Signal currently makes is false. `sourceLabel` must resolve from the record the
moment a second product feeds Home.

### 2. A complete cross-product analytics engine already exists and is mounted nowhere.

Tasks, Notes and Timeline providers, a coverage model with status/capabilities/history/
staleness/issues, a ledger, and scope authorization — all present, all tested, zero route
reaches them. `runAnalyticsRoute` has **no importers**. The flag returns false everywhere
unless explicitly opted in.
`src/modules/signal/server/analytics/providers/{tasks,notes,timeline}.ts`;
`.../analytics/feature-flag.ts:11-16`; `.../analytics/route.ts:9`.

**Consequence.** Wave 8 is a presentation and truth-closure problem, not a research problem.
Build on this; do not re-derive it. Neither `/app/trends` nor `/app/home/analytics` exists at
all — Analytics is greenfield route work.

### 3. The 9.5 quality council cannot currently certify anything.

The gate requires **1,352 evidenced human taste scores** plus 4 journey receipts, and
automation is explicitly barred from awarding them (`quality-council-gate.json:234`). In CI
it is `continue-on-error`. Narrowing its scope is an **open founder decision** parked at
`studio/content/hq/operator-todos/rule-on-95-gate-scope.md`.

**Consequence.** The master brief's Wave 10 requirement — "the repository's exact measured
gate" — is **unachievable as written** until that decision is taken. Recorded as `R-H08`.
This is a founder decision, not something an implementation agent may narrow.

### 4. There is no visual-regression baseline anywhere in the repository.

`toHaveScreenshot` is configured but never called; no `experience/baselines/` exists;
`approvedBaselineReference` is `null` on all 78 registry entries, and approval is declared
founder-owned, not automatable.

**Consequence.** A design-direction wave cannot prove it did not regress an untouched
surface. Baseline creation and approval is Wave 2 work with a founder step in it.

### 5. `/lab` has no authentication guard at all.

It sits outside the Clerk proxy matcher entirely (`src/proxy.ts:280-298`). Anyone with the
URL reaches it.

**Consequence.** The protected preview the founder pause depends on **must be built before
Wave 3 deploys anything**. Authentication plus noindex is not protection, and right now
there is not even authentication.

### 6. Inbox and My work cannot be moved. They must be decomposed.

Both are wrapped in `TasksRuntimeShell`; their components call `useTaskPanel`, `useTasks`,
`useDomain`, `useColumnConfig`, `usePersonalization`, `useCalendarFrame`. Without the runtime
they break; with it, Home inherits the first-run redirect to `/welcome`
(`tasks-runtime-shell.tsx:69-71`). Separately, `scripts/check-route-manifest.mjs:44-45` pins
`app/inbox` and `app/my-tasks` as directories that must not disappear.

**Consequence.** Confirms the brief's warning: moving route files is not a migration.

### 7. The Inbox store, the approval primitive and analytics history do not exist.

- Inbox read state is **client-only `localStorage`** (`inbox-app.tsx:207-217`); there is no
  unread model; `notify()` returns early when the payload has no `taskId`
  (`src/server/db/notifications.ts:40-47`); `notifications.read_at` has **no writer anywhere**.
- **No approval primitive exists in `src/` at all** — no table, column or action.
- `captureWorkspaceSnapshots` has **zero callers repo-wide**, so Analytics history is a read
  path over an empty table.

**Consequence.** Waves 6 and 8 are new schema work under expand → migrate → contract, not
migrations of an existing store. This was not scoped as such in the brief.

### 8. Every Tasks mutation is bound to a cookie, not a workspace argument.

`getActiveWorkspace()` reads the `tasks_active_ws` cookie across **80 call sites in 24 action
files**. Home cannot complete or reassign a task in Project B while the cookie says Project A
— the pre-read finds no row and the action **silently no-ops**.

**Consequence.** Workspace-parameterised actions are a hard prerequisite for My work
writeback and for any Inbox source action. This is the single largest hidden cost in the
programme.

---

## Identity and authorization, precisely

A "project" has **four incompatible identities**: Tasks `workspaces.id` (UUID), Timeline's
`(workspace_slug, slug)` composite key, signal's slugified **task tag**, and Notes (none).
Authorization is resolved by **five separate membership seams over four transports** —
in-process Drizzle, raw `@libsql/client` SQL against the Tasks URL, an owner-only Timeline
table with no member concept, a read-only Tasks mirror, and an HMAC HTTP loopback.

The only defensible canonical identity is Tasks `workspaces.id`
(`src/server/db/schema.ts:272-277`) — which is exactly what the live Project Truth ADR
concluded independently. That agreement is the strongest signal in this audit.

---

## Two live production defects found in passing

Neither belongs to this programme. Both are confirmed by reading and are **not** runtime-
verified. Both have been raised as separate work.

1. **Home bounces invited and redeemed users to `/waitlist`.** `src/app/app/layout.tsx:61`
   deliberately uses the membership-aware `requireAppAccessTasks()`, with a comment recording
   that the allowlist-only gate "bounced every invited and every redeemed user to /waitlist
   after their token had already been burned". Four pages then re-run the narrow
   `requireAppAccess()` underneath it — `home/page.tsx:17`, `home/briefing/page.tsx:17`,
   `notes/page.tsx:21`, `timeline/page.tsx:13`. Members pass the layout and are bounced by
   the page. They can still use `/app/tasks`.

2. **Cross-tenant read in the daily digest.** `compileDailyDigest` receives a `workspaceId`
   but its mentions query (`src/server/db/daily-digest.ts:90-104`) filters only on
   `kind = "commentAdd"` and `createdAt >= dayStart` — no workspace predicate, though
   `activities.workspaceId` exists (`schema.ts:520`). The follow-up task-title lookup
   (`:113-116`) is also unscoped. Reachable from the live Inbox page
   (`src/app/app/inbox/page.tsx:95`) and from the digest **email** cron
   (`src/app/api/cron/digest/route.ts:130`). The static tenant-scope detector passes it
   because it treats `activities.userId` in a leftJoin ON clause as a strong scoping token
   (`src/server/tenant-scope-rules.mjs:56-86`).

   Cross-tenant exposure requires a snippet in another workspace containing this user's
   mention token, so exploitability depends on how globally unique that token is — establish
   that before rating it. A second consequence is certain regardless: the global `.limit(50)`
   is applied **before** user filtering, so a user's genuine mentions can be silently dropped
   whenever other tenants are busier.

---

## Four-product language still ships to unauthenticated visitors

`src/components/auth/auth-stage.tsx:42-46`, `:98-107` renders a visible four-station spine
ending in "signal" on the sign-in page. Also `src/components/suite-arrows.tsx:27` (mounted on
the marketing homepage), `src/components/app/suite-command-root.tsx:263`, `:346`, and
`.../signal-notifications-page.tsx:20`. The workspace contract and the consolidation decision
both ban this. These are copy fixes, not architecture — but they contradict the programme's
first locked decision, and every visitor sees one.

---

## Dead code a designer would mistake for a starting point

The entire `SignalAppShell` subtree is dead: zero importers for the shell, `overview-view`
and `trends-view`, plus ten descendant components reachable only through them. `/app/project`
is fully orphaned from navigation yet computes complete workspace-level truth — purpose,
owner, members, task stats, milestones, recent events, declared status, target date, parent
programme.

**Consequence.** Retire the dead shell before Wave 3, or a lab agent will build on it.
`/app/project` is the Active Project surface the charter needs and it already exists — which
is precisely why it collides with `src/lib/projects/**` being authored right now.
