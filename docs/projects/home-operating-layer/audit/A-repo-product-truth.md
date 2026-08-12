# Audit A — repository and product truth

**What the authenticated app actually is today, route by route.**

| | |
|---|---|
| Worktree | `_wt-home-layer` |
| Branch | `feat/home-operating-layer` |
| Base SHA | `a849fc40e46787a39e499fc94b171a5dfb898821` (= `origin/main` at cut) |
| Cut taken | 2026-08-12 |
| Method | Static read of source only. No build, no dev server, no migration, no runtime observation. |
| Citation form | Repo-relative `path:line`. Anything not directly readable is labelled **INFERENCE**. |

Every claim below was read in the file cited. Nothing here is verified at runtime — where
behaviour depends on environment variables, flags or request ordering, that is stated
explicitly rather than asserted.

---

## 0. Headline

**Home is not cross-product today.** `/app/home` renders from one briefing build whose
production data source reads the Tasks database and nothing else, and stamps every row's
provenance as `Tasks · <workspace>` by string template. The genuinely cross-product
analytics stack (Tasks + Notes + Timeline providers) exists, is complete, and is mounted
**nowhere** — its shell, its trends and overview views, and its HTTP route helper all have
zero importers, and its feature flag is closed in every environment by default.

Six further facts change what the programme must plan for:

1. There is **no** `/app/trends` route and **no** `/app/home/analytics` route. Neither
   directory exists.
2. `/app/project` is fully orphaned — no navigation surface links to it.
3. `/app/your-work` is reachable only via `/api/suite-context`, and in production its own
   flag sends it straight to `/app/tasks`.
4. Four-product language survives in **user-facing** copy on the sign-in page, the
   marketing homepage, the suite command palette and the briefing notifications page.
5. `/app/home`, `/app/home/briefing`, `/app/notes` and `/app/timeline` call the
   **allowlist-only** access gate at page level, undoing the membership-aware gate the
   `/app` layout deliberately installed above them.
6. There are three separate notification-settings surfaces, on three different routes,
   reading three different stores.

---

## 1. The `/app` route tree

### 1.1 Shell topology

The suite layout `src/app/app/layout.tsx` wraps every `/app/*` route. It owns only shared
chrome and one access gate; it deliberately carries **no** product data.

| Element | File:line | What it does |
|---|---|---|
| `SharedAppGate` | `src/app/app/layout.tsx:49-63` | `await requireAppAccessTasks()` (`:61`) — allowlist **plus** a `workspace_members` fallback |
| `StudioBar` | `src/app/app/layout.tsx:104-106` | Top chrome, inside `SuiteChromeGate` |
| `StudioRail` | `src/app/app/layout.tsx:108-110` | Desktop product rail, `hidden md:flex` |
| `ProductWorkspaceShell` | `src/app/app/layout.tsx:113` | Called **without** `activeWorkspaceId`/`tree` at this level |
| `MobileSuiteNav` + `SuiteCommandRoot` | `src/app/app/layout.tsx:117-120` | Mobile tabs and the non-Tasks command palette |

`ProductWorkspaceShell` then forks on pathname
(`src/components/app/product-workspace-shell.tsx:9-19`):

```
isTasksSurface(pathname) === false  for  /app/notes, /app/timeline, /app/home, /app/signal
```

- **Non-Tasks surfaces** get the module canvas: a bare
  `<main id="app-main-content" data-product-canvas="module">`
  (`src/components/app/product-workspace-shell.tsx:45-60`). No sidebar, no Tasks providers.
- **Tasks surfaces** return `children` untouched at suite level
  (`:41-43`) and wait for the nested `TasksRuntimeShell` to re-enter
  `ProductWorkspaceShell` with real data (`src/components/app/tasks-runtime-shell.tsx:181-186`),
  which then renders `AppSidebar` + `<main data-product-canvas="tasks">` (`:66-78`).

`TasksRuntimeShell` (`src/components/app/tasks-runtime-shell.tsx:61-133`) is heavy: it
awaits eleven parallel reads (tasks, domain, current user, workspace row, workspace list,
room brief, projects tree, board name, column config, tag defs, members) and mounts nine
providers plus the task detail panel, cross-workspace overdue, cross-workspace search,
focus mode and the Tasks command palette (`:145-199`).

### 1.2 Which shell wraps which route

Determined by the presence and content of each segment's `layout.tsx`.

| Route | Route file | Shell | Renders | Reads | Data owner |
|---|---|---|---|---|---|
| `/app` | `src/app/app/page.tsx` | n/a (redirect) | `redirect(HOME_APP_PATH)` (`:34`); earlier branch redirects to `/api/suite-context` when `contextVersion=2` + `workspaceId` (`:17-30`) | search params only | — |
| `/app/home` | `src/app/app/home/page.tsx` | **suite `ProductWorkspaceShell`** (no `layout.tsx` in segment → module canvas) | `HomeView` / `HomeNewUser` (`:24-25`) | `loadHomeData()` → `buildBriefingForUser` | **Tasks DB only** (see §2) |
| `/app/home/briefing` | `src/app/app/home/briefing/page.tsx` | suite `ProductWorkspaceShell`; segment `layout.tsx` only imports `signal.css` (`src/app/app/home/briefing/layout.tsx:1-9`) | `SignalBriefPage` (`:18`) | flag fork — legacy briefing (Tasks DB) or progressive ledger (Tasks+Notes+Timeline) | Signal module |
| `/app/home/briefing/onboarding` | `src/app/app/home/briefing/onboarding/page.tsx` | same | `SignalOnboardingPage` | Signal analytics DB + Tasks DB workspace list | Signal module |
| `/app/home/briefing/settings/notifications` | `src/app/app/home/briefing/settings/notifications/page.tsx` | same | `SignalNotificationsPage` (`:12`) | nothing — static copy (`src/modules/signal/app/settings/notifications/signal-notifications-page.tsx:10-50`) | — |
| `/app/inbox` | `src/app/app/inbox/page.tsx` | **`TasksRuntimeShell`** (`src/app/app/inbox/layout.tsx:4`) | `AppPageHeader` + `InboxApp` (`:123-137`) | 8 parallel reads (`:92-120`) | Tasks DB |
| `/app/my-tasks` | `src/app/app/my-tasks/page.tsx` | **`TasksRuntimeShell`** (`src/app/app/my-tasks/layout.tsx:4`) | `AppPageHeader` + `MyWeekApp` (`:9-10`) | zero server reads — consumes `TasksProvider` from the shell | Tasks DB |
| `/app/your-work` | `src/app/app/your-work/page.tsx` | **`TasksRuntimeShell`** (`src/app/app/your-work/layout.tsx:4`) | `YourWorkView` (`:15`), after `redirect("/app/tasks")` when the planning flag is off (`:13`) | `listYourWorkForCurrentUser()` | Tasks DB (`planning_periods`, `workspaces`, `tasks`) |
| `/app/project` | `src/app/app/project/page.tsx` | **`TasksRuntimeShell`** (`src/app/app/project/layout.tsx:4`) | `ProjectOverview` (`:22`) | `getProjectOverviewData()` | Tasks DB (`meta`, `tasks`, `users`, `workspace_members`, `workspace_events`, `workspaces`, `planning_periods`) |
| `/app/signal` | `src/app/app/signal/page.tsx` | n/a | `permanentRedirect` → `/app/home/briefing` from **`generateMetadata`** (`:19-28`) and again in the component (`:30-39`) | — | — |
| `/app/signal/onboarding` | `src/app/app/signal/onboarding/page.tsx` | n/a | 308 → `/app/home/briefing/onboarding` | — | — |
| `/app/signal/settings/notifications` | `src/app/app/signal/settings/notifications/page.tsx` | n/a | 308 → `/app/home/briefing/settings/notifications` | — | — |
| `/app/trends` | **DOES NOT EXIST** | — | — | — | — |
| `/app/home/analytics` | **DOES NOT EXIST** | — | — | — | — |
| `/app/settings` | `src/app/app/settings/page.tsx` | **`TasksRuntimeShell`** (`src/app/app/settings/layout.tsx:4`) | `AppPageHeader` + `SettingsApp`, nine tabs (`src/components/app/settings/settings-app.tsx:59-68`) | 12 reads (`:107-154`) | Tasks DB + Clerk |
| `/settings` | `src/app/settings/page.tsx` | **outside `/app` entirely** | `redirect("/settings/profile")` (`:4`) | — | — |
| `/settings/profile` | `src/app/settings/profile/page.tsx` | `SettingsChrome` (`src/app/settings/layout.tsx:20-36`) — its own Clerk provider, no suite chrome | `ProfilePanel` (`:21`) | Clerk | Clerk |

Non-target `/app` routes, for completeness of the tree:

| Route | Shell | Note |
|---|---|---|
| `/app/tasks`, `/app/tasks/list`, `/app/tasks/timeline`, `/app/tasks/calendar` | `TasksRuntimeShell` (`src/app/app/tasks/layout.tsx:6`) | The board product |
| `/app/task/[id]` | `TasksRuntimeShell` (`src/app/app/task/layout.tsx:4`) | Single-task focus |
| `/app/archived` | `TasksRuntimeShell` (`src/app/app/archived/layout.tsx:4`) | |
| `/app/import` | `TasksRuntimeShell` (`src/app/app/import/layout.tsx:4`) | |
| `/app/notes` | suite module canvas | `src/app/app/notes/page.tsx:21` |
| `/app/timeline/**` | suite module canvas; segment layout only imports `timeline.css` (`src/app/app/timeline/layout.tsx:10-16`) | |

### 1.3 The access-gate inversion

`src/app/app/layout.tsx:52-60` records, in its own comment, that using the allowlist-only
`requireAppAccess()` at the outer gate "bounced every invited and every redeemed user to
`/waitlist` after their token had already been burned", and that the fix was to swap the
outer gate to the membership-aware `requireAppAccessTasks()`.

That fix is undone one level down. These page components each call the **allowlist-only**
gate, and each renders **inside** `SharedAppGate` as `children`:

| Route | Call site |
|---|---|
| `/app/home` | `src/app/app/home/page.tsx:17` |
| `/app/home/briefing` | `src/app/app/home/briefing/page.tsx:17` |
| `/app/notes` | `src/app/app/notes/page.tsx:21` |
| `/app/timeline` | `src/app/app/timeline/page.tsx:13` |
| `/app/timeline/[projectSlug]` | `src/app/app/timeline/[projectSlug]/page.tsx:11` |
| `/app/timeline/audience` | `src/app/app/timeline/audience/page.tsx:14` |

The two gates differ exactly in the membership fallback
(`src/server/app-access.ts:42-59` returns early for a user holding a `workspace_members`
row; `src/server/require-app-access.ts:32-34` redirects to `/waitlist` regardless).
`/app/tasks` is unaffected — it carries no page-level `requireAppAccess()`.

**INFERENCE (reading, not runtime):** a non-allowlisted user with a membership row passes
the layout gate and is then redirected to `/waitlist` by the Home page's own gate. This
would need a runtime check with a real non-allowlisted membership account to confirm.
It matters here because Home is the programme's front door and the redeemed-couple and
invited-collaborator paths are exactly the users Home is meant to greet.

---

## 2. Home composition — what Today's Signal / Coming up / Needs review actually read

### 2.1 The provider chain, exactly

```
src/app/app/home/page.tsx:23
  → loadHomeData({ clerkId })                    src/app/app/home/home-data.ts:101
    → buildBriefingForUser({ cadence:"daily", recordReadState:false })
                                                 src/modules/signal/home.ts:22-25
      → src/modules/signal/server/briefing/signal-build-for-user.ts:97
        ├─ demo branch  (isDemoMode)             :113-237   mock/fixture source
        └─ production branch                     :239-388
             source.getSignalsForUser            :302-341
               → dataSource.readMany(workspaceIds)
                 src/modules/signal/lib/data/source.ts:358  dataSource =
                   tasksDbConfigured ? tasksDbSource : mockSource
                     tasksDbSource.readMany      :283-306
                       → SELECT * FROM tasks WHERE workspace_id IN (…)
                         src/modules/signal/lib/data/source.ts:292-295
```

`getTasksDb()` binds to `TASKS_DATABASE_URL` with a read-only token
(`src/modules/signal/server/tasks-db/signal-tasks-db-client.ts:5-17`) — the same physical
Tasks database `@/server/db` writes (`src/server/db/index.ts:8-21`).

### 2.2 The read is Tasks-fed, not cross-product

Three independent pieces of evidence in the production branch:

1. **Only one table is queried.** `src/modules/signal/lib/data/source.ts:292-295` selects
   from `tasksTable` and nothing else. `WorkRead.events` is hardcoded `[]`
   (`:271-273`), and `projects` are *synthesised from task tags*, not read
   (`:233-264`) — the read-model comment says so at
   `src/modules/signal/lib/data/types.ts:24-31`.
2. **Provenance is a string template, not a resolved source.**
   `src/modules/signal/server/briefing/signal-build-for-user.ts:331` sets
   ``sourceLabel: `Tasks · ${workspaceNames.get(work.workspaceId) ?? "Workspace"}` ``.
   Every "Tasks · The Orchard, events" style line the reader sees on Home is that literal.
3. **The read-model type has no Notes or Timeline shape at all.**
   `src/modules/signal/lib/data/types.ts:85-93` — `WorkRead` is
   `{ workspaceId, snapshotAt, projects, tasks, events }`.

### 2.3 What each Home section is

Home takes **one** briefing build and slices it three ways
(`src/app/app/home/home-data.ts:104-192`).

| Home section | Source | Rule | Cap | Cite |
|---|---|---|---|---|
| **Today's Signal** | `briefing.needsAttention` ++ `briefing.quietRisks`, engine order preserved | Engine already selected and capped (≤3 across both) | ≤3 | `home-data.ts:130-133` |
| **All-clear state** | Rendered instead of rows when `signalRows.length === 0` | Body names `briefing.movingWell.length` when something shipped; `readLine` states `briefing.readCount` | — | `home-data.ts:176-192` |
| **Coming up** | Raw `signals` (the captured source rows), filtered `dueAt != null && lane !== "shipped" && !surfacedIds.has(id)`, `0 ≤ daysOut ≤ 14`, sorted by `dueAt` | Not engine-ranked — a plain date filter over the same Tasks rows | ≤4 | `home-data.ts:137-157`, window/caps at `:78-80` |
| **Needs review** | Raw `signals` filtered `lane === "review" && !surfacedIds.has(id)`, sorted by `idleDays` desc | `lane === "review"` derives from Tasks lane `review` → status `in-flight`, so `review` here comes from the engine's own lane mapping, not the Tasks lane directly | ≤3 | `home-data.ts:159-171` |

Every row's `href` is `/app/task/${id}` (`home-data.ts:82-84`) — Home links only into Tasks.

`signals` is not a second read: `captureSignals()` decorates the source and keeps the rows
the engine saw (`signal-build-for-user.ts:70-86`), so Home's three sections and the Full
Briefing share one read, one authorization path, one scope check.

**Recording posture:** Home passes `recordReadState: false` (`home-data.ts:107`), so
carry-over ages and trigger rotations are not advanced by a Home visit
(`signal-build-for-user.ts:100-106`, `:356-376`). The Full Briefing is the read of record.

### 2.4 The cross-product read that exists and is not mounted

A genuine three-product provider stack is complete in the repo:

| Provider | File | Reads |
|---|---|---|
| Tasks | `src/modules/signal/server/analytics/providers/tasks.ts:17-23` | Tasks DB `tasks`, `activities`, `users` |
| Notes | `src/modules/signal/server/analytics/providers/notes.ts:11-18` | `NOTES_DATABASE_URL` client + Tasks DB join |
| Timeline | `src/modules/signal/server/analytics/providers/timeline.ts:14-19` | `TIMELINE_DATABASE_URL` client |

It is gated by `isSignalAnalyticsEnabled()`, which returns `false` in every environment
unless `SIGNAL_ANALYTICS_V1_ENABLED` is explicitly set
(`src/modules/signal/server/analytics/feature-flag.ts:11-16`). The only consumer is
`/app/home/briefing`, which falls to `SignalLegacyBriefing` when the flag is off **or**
when a planning period is requested (`src/modules/signal/app/signal-brief-page.tsx:38-40`).
`SignalLegacyBriefing` goes back to `buildBriefingForUser` — i.e. the Tasks-only path
(`src/modules/signal/app/signal-legacy-briefing.tsx:48-52`).

`/app/home` never reaches the provider stack at all, under any flag.

---

## 3. Inbox — every content class and its source

`/app/inbox` renders `InboxApp` inside `TasksRuntimeShell`. The client component's own
header comment claims two surfaces (`src/components/app/inbox/inbox-app.tsx:32-41`); the
render body actually stacks **six**.

| # | Class | Rendered at | Data source | Read at | Owner |
|---|---|---|---|---|---|
| 1 | **Greeting banner** | `inbox-app.tsx:104-110` | `personalityPrefs.greeting`, `digest.dueToday.length`, `overdueCount` | `src/app/app/inbox/page.tsx:109` (`getOverdueTodayCount`), `:119` (`readPersonalityPrefs`) | Tasks DB |
| 2 | **Tip card** | `inbox-app.tsx:112` | `personalityPrefs.tips`, `context="inbox"` | `src/app/app/inbox/page.tsx:119` | Tasks DB (prefs) |
| 3 | **Nudges** ("what's stuck") | `inbox-app.tsx:114`, section at `:248-268` | `generateNudges(tasks, me, columnConfig)` — **pure rules over the task list**, seven kinds: `idle-doing`, `idle-review`, `past-due`, `blocker-cleared`, `review-pile`, `doing-empty`, `llm-narration` (`src/lib/nudges/generate-nudges.ts:5-19`) | `src/app/app/inbox/page.tsx:121` | Tasks DB, computed server-side |
| 4 | **Weekly recap** (LLM-narrated) | `inbox-app.tsx:116-118`, section at `:887-…` | `buildWeeklySnapshotFor(ws)` → `getTasks` + column config, computes `closedThisWeek`, `closedTitles`, `stillCirclingTitles`, `openCount` (`src/server/digest-narration.ts:39-73`); narration streamed by `weeklyDigestNarrationAction`; gated on `aiConfigured()` | `src/app/app/inbox/page.tsx:97`, `:130` | Tasks DB + AI provider |
| 5 | **Daily digest** — "Closed yesterday" / "Due today" | `inbox-app.tsx:120-165` | `compileDailyDigest(me, ws)`: tasks `lane='done'` updated in last 24h; tasks assigned to me with `dueAt` in next 24h (`src/server/db/daily-digest.ts:49-80`) | `src/app/app/inbox/page.tsx:95` | Tasks DB |
| 5b | **Mentions** (nested in the digest section) | `inbox-app.tsx:169`, component `:498-…` | `digest.mentions` — body snippets from the last 24h (`src/server/db/daily-digest.ts:20-27`) | same read as #5 | Tasks DB (`activities`) |
| 6 | **Direct alerts** | `inbox-app.tsx:173-193` | `getNotificationsForUser(me, ws)` — `notifications` table, workspace-scoped, `limit 50` (`src/server/db/queries.ts:579-598`); sentence renderer handles kinds `mention` and `nudge` (`inbox-app.tsx:627`, `:666`) | `src/app/app/inbox/page.tsx:94` | Tasks DB (`notifications`) |

Adjacent action affordances in the digest header, all Tasks-scoped:
`ShareThisWeekButton`, `CopySlackSummary`, `RollForwardButton` (`inbox-app.tsx:126-146`).

**Every one of the six classes is Tasks-owned.** There is no Notes event, no Timeline
event, no publication event, no account or billing event, and no membership/invite event in
this Inbox. Nudge dismissal is client-only `localStorage` under `tasks_dismissed_nudges`
(`inbox-app.tsx:207`, `:209-217`) — there is no server-side read/unread state machine.

---

## 4. My Tasks / My Week — coverage

`/app/my-tasks` performs **zero server reads** (`src/app/app/my-tasks/page.tsx:6-13`). It
renders `MyWeekApp`, which consumes `useTasksState()` — the `TasksProvider` the Tasks
runtime shell filled with `getTasks(workspaceId)`
(`src/components/app/tasks-runtime-shell.tsx:86`, `:163`).

Sections (`src/components/app/my-week/my-week-app.tsx:96-159`), bucketed by
`bucketMyWeek` (`src/lib/tasks/selectors.ts:120-181`):

| Section | Rule | Cite |
|---|---|---|
| Today | assigned to me, lane `todo`/`doing`, due before tomorrow (includes overdue) | `selectors.ts:151-159` |
| This evening | split out of Today only when an explicit evening time is typed | `my-week-app.tsx:53-56`, `:110-119` |
| Needs attention | lane `doing`, idle ≥ `ATTENTION_IDLE_DAYS` (= 4, `selectors.ts:109`) | `selectors.ts:161-165` |
| Waiting on you | lane `review`, any date | `selectors.ts:167-171` |
| This week | lane `todo`/`doing`, due in (tomorrow, +7d] | `selectors.ts:173-180` |
| Done this week | lane `done`, updated within 7 days | `selectors.ts:140-146` |
| Nudges rail | `generateNudges` recomputed client-side over the same list | `my-week-app.tsx:58-62`, `:158` |

**Coverage is Tasks-only, and narrower than that: it is `assignees.includes(currentUser)`
within one active workspace** (`selectors.ts:133`). It is not "my work across the suite" —
it is "tasks assigned to me on the board I currently have selected". Notes I own, Timeline
milestones I own, and tasks in my other workspaces are all absent.

It also **duplicates the Inbox's nudge surface verbatim** — same pure function, same seven
kinds, rendered twice on two routes (`my-week-app.tsx:58-62` vs `inbox-app.tsx:114`).
The `my-week-app.tsx:59-60` comment says so: "the proactive 'what's stuck' surface folded
in from the inbox."

Naming is already inconsistent in production: the route is `/app/my-tasks`, the component
is `MyWeekApp`, the page title is the shared `AppPageHeader`, and both navigation labels
say **"My work"** (`src/components/studio-bar/projects-sidebar.tsx:474`,
`src/components/app/sidebar.tsx:326`).

---

## 5. `/app/your-work` and `/app/project`

### 5.1 `/app/your-work` — a planning-period portfolio index

`src/app/app/your-work/page.tsx:12-16`. It is **not** a personal task list. It renders
`YourWorkView` over `listYourWorkForCurrentUser()`, which returns owned planning periods
plus every workspace the user is a member of, each with aggregate task/milestone counts and
a computed `nextTaskTitle` (`src/server/planning/queries.ts:67-123`). Metadata title:
`"Your work · Tasks"` (`page.tsx:8-10`).

**Gate.** Line 13: `if (!resolvePlanningFeatureFlags().planningPeriods) redirect("/app/tasks")`.
`planningPeriods` defaults to `NODE_ENV !== "production"`
(`src/lib/planning/flags.ts:33-35`), so **in production it is off unless
`SIGNAL_PLANNING_PERIODS_ENABLED` is set**, and the route is a redirect to the board.

**Who links to it.** Nothing in the shell. The complete inbound set:

| Caller | Cite |
|---|---|
| `/api/suite-context` — unconditional redirect target, both the unauthorized and authorized branches | `src/app/api/suite-context/route.ts:23`, `:54` |
| Contextual onboarding completion | `src/components/welcome/contextual-onboarding.tsx:176` |
| `revalidatePath` after a planning mutation | `src/server/actions/planning.ts:1263` |

`/api/suite-context` is the cross-product context handoff: `/app?contextVersion=2&workspaceId=…`
redirects into it (`src/app/app/page.tsx:17-30`), and it sets the active-workspace cookie
then 303s to `/app/your-work`. **In production that lands on a route that immediately
redirects to `/app/tasks`.** No navigation surface — rail, sidebar, mobile nav, either
command palette, account menu — offers `/app/your-work`.

### 5.2 `/app/project` — a live workspace overview nobody can reach

`src/app/app/project/page.tsx:20-23`, wrapped in `TasksRuntimeShell`. Its header comment
(`:7-19`) states it takes no slug: the active workspace comes from the cookie the shell
already resolved. `getProjectOverviewData()` returns purpose, owner, members, task stats
(total/complete/overdue/undated/progress), milestones, recent workspace events, declared
status, target date and the parent program
(`src/server/actions/project-overview.ts:183-240`; D-011 vocabulary "Projects = workspaces,
Programs = planning periods" at `:5-8`).

**Inbound links: none.** Exhaustive grep for `/app/project` across `src/` returns only the
route's own files, two `revalidatePath` calls
(`src/server/actions/project-overview.ts:452`, `:482`), and three comments recording that
the route was deliberately removed from navigation while staying routable
(`src/components/app/mobile-suite-nav.tsx:19`, `src/components/studio-bar/studio-rail.tsx:43`,
`src/server/suite-navigation-contract.test.mjs:117`).

It is a complete, tested, currently-unreachable surface holding exactly the workspace-level
truth the programme's Active Project scope will need.

---

## 6. Navigation — every registration of a suite destination

### 6.1 Desktop

| Surface | File:line | Destinations | Home present? |
|---|---|---|---|
| **Studio rail** (`hidden md:flex`) | `src/components/studio-bar/studio-rail.tsx:45-53` | Notes, Tasks, Timeline — **only the three products** | **No.** Comment at `:37-44`: Home "left the black rail (pass 4)". Enforced by `src/server/suite-navigation-contract.test.mjs:118` (`assert.doesNotMatch(studioRail, /\{ key: "home"/)`) |
| Rail utilities | `studio-rail.tsx:182-200` | "More" → `STUDIO_URL` (new tab); Inbox → `/app/inbox` | — |
| Rail help menu | `studio-rail.tsx:129-136` | `/app/settings` ("Project and team"), `/settings/profile` ("Account settings"), `mailto:` support | — |
| Rail account slot | `studio-rail.tsx:206-208` | `UserButtonWithSuite placement="rail"` | via menu |
| **Studio bar mark cell** | `src/components/studio-bar/studio-bar.tsx:104-116` | `HOME_APP_PATH`, `aria-label="Signal Studio Home"`, `hidden … md:flex` | **Yes** — a 44px unlabelled glyph, desktop only |
| **Studio bar identity cell** | `studio-bar.tsx:133-141` | Wordmark links to the active module's own home (`:92`) | Contextual |
| **Tasks projects sidebar → "Shortcuts"** | `src/components/studio-bar/projects-sidebar.tsx:441-476` | Home (`:447`), Inbox (`:456`), "My work" → `/app/my-tasks` (`:470`, label `:474`) | **Yes**, first row. Only rendered inside `TasksRuntimeShell`. |
| **Account menu** | `src/components/app/user-button-with-suite.tsx:51-60` | Open home, Open notes, Open tasks, Open timeline; Settings → `/settings/profile` (`:262-264`) | Yes |
| **Settings chrome suite pills** | `src/components/app/suite-switcher-pills.tsx:55-60`, mounted at `src/components/settings/settings-chrome.tsx:5` | home, notes, tasks, timeline (absolute URLs) | Yes |
| Settings chrome tabs | `settings-chrome.tsx:8-10` | `/settings/profile`, `/settings/notifications`, `/settings/plan`; back-link to `/app/tasks` (`:29`) | — |

**Consequence:** on desktop, outside the Tasks runtime, Home's only navigation affordance
is the unlabelled 44px glyph in the top-left of the Studio Bar. The Tasks sidebar shortcut
does not exist on `/app/notes`, `/app/timeline` or `/app/home` itself, because those routes
take the module canvas and never mount `AppSidebar`.

### 6.2 Mobile

| Surface | File:line | Destinations |
|---|---|---|
| `MobileSuiteNav` (`md:hidden`) | `src/components/app/mobile-suite-nav.tsx:22-31` | Home, Notes, Tasks, Timeline. Returns `null` when the active surface is Tasks (`:49`) |
| Tasks `MobileTabBar` | `src/components/app/sidebar.tsx:34-43`, rendered `:349-…` | Home, Notes, Tasks, Timeline + a fifth "views" menu button (`grid-cols-5`) |
| Tasks views menu → "Work" group | `sidebar.tsx:296-345` | Inbox (with open count), My work → `/app/my-tasks`, Search tasks (opens palette) |

### 6.3 Command palettes and keyboard shortcuts

Two palettes, mutually exclusive by surface.

**Tasks palette** — `src/components/app/palette/command-palette.tsx`, mounted only inside
`TasksRuntimeShell` (`src/components/app/tasks-runtime-shell.tsx:171`).

- Shortcut: `⌘K`/`Ctrl+K` and legacy `⌘P` (`command-palette.tsx:106-121`).
- "Jump to" block, `SUITE_JUMPS` (`:667-688`): **home**, **timeline**, **notes**,
  **briefing** (`BRIEFING_APP_PATH`). Rendered at `:689-712`.
- Note what is missing from the jump list: Inbox, My work, Project, Settings, and Tasks
  itself.

**Suite palette** — `src/components/app/suite-command-root.tsx`, mounted in the suite layout
and self-disabling on Tasks (`:78` `ownsCommand = activeProduct !== "tasks"`).

- Shortcut: `⌘K`/`Ctrl+K` (`:125-135`).
- Destinations (`:27-53`): Notes, Tasks, Timeline, **Home** — Home listed *last*.
- Home's search terms include `"signal"` (`:50-51`), so typing "signal" resolves to Home.

**Declared `aria-keyshortcuts` across the whole app** — three:

| Key | Where | Action |
|---|---|---|
| `Control+K Meta+K` | `src/components/studio-bar/studio-bar.tsx:224` | Search trigger → `STUDIO_PALETTE_EVENT` |
| `c` | `src/components/studio-bar/studio-bar.tsx:253` | Add task (Tasks only, `showCreate`) |
| `/` | `src/modules/notes/app/workspace/NotesWorkspace.tsx:1053` | Notes local find |

There is **no** shortcut that jumps to Home, Inbox, My work, Project or Analytics. There is
no `g`-prefix chord scheme anywhere.

The Studio Bar reserves an empty slot for a Home/Signal pulse:
`data-slot="signal-pulse"`, `aria-hidden="true"`, `className="ml-auto hidden w-10 flex-none xl:block"`
(`studio-bar.tsx:210-215`) — "deliberately empty, deliberately no bell". The contract test
asserts the slot exists (`src/server/suite-navigation-contract.test.mjs:153`).

---

## 7. Surviving "four products" language

The workspace contract says three (`AGENTS.md:12`: Home "is not a fourth product";
`docs/projects/signal-home-consolidation/DECISIONS.md:69` bans the phrases). The following
survive **in shipped code**, split by whether a user reads them.

### 7.1 User-visible copy — four items

| Surface | File:line | What renders |
|---|---|---|
| **Sign-in / sign-up stage** | `src/components/auth/auth-stage.tsx:42-46` + `:98-107` | A four-station spine rendering `station.name` as visible text: **notes · tasks · timeline · signal**, with `signal` as the resting station (`:45`). Every unauthenticated visitor sees it. The stylesheet comment at `src/components/auth/auth-stage.module.css:223` asserts the card "never lists the four products in words" — the spine does. |
| **Marketing homepage** | `src/components/suite-arrows.tsx:23-28`, mounted `src/app/page.tsx:20` | Prev/next suite arrows over four entries, the fourth `{ slug: "analytics", word: "signal", url: PRODUCT_MARKETING_URLS.signal }` → `signalstudio.ie/signal` |
| **Suite command palette** | `src/components/app/suite-command-root.tsx:263` | Input placeholder: `"Jump to Notes, Tasks, Timeline or Signal…"` — names a destination the list does not contain |
| | `src/components/app/suite-command-root.tsx:346` | Empty state: `"Try Notes, Tasks, Timeline or Signal."` |
| **Briefing notifications page** | `src/modules/signal/app/settings/notifications/signal-notifications-page.tsx:20` | Page kicker reads **"Settings · Signal"**; body prose says "Signal builds one short in-app read…" (`:33-36`) |

### 7.2 Code-level / contract-level

| Surface | File:line | Note |
|---|---|---|
| `ProductId` union | `src/lib/product-urls.ts:3` | `"notes" \| "tasks" \| "timeline" \| "signal"` |
| `PRODUCT_APP_PATHS.signal` | `src/lib/product-urls.ts:30` | `/app/signal` — now a 308 |
| `PRODUCT_APP_URLS.signal`, `PRODUCT_MARKETING_URLS.signal`, `SIGNAL_URL` | `:60`, `:22`, `:151` | Live exports |
| `productIdFromAppPath` | `:112` | Still resolves `"signal"` |
| Suite contract JSON | `src/lib/suite-contracts.v1.json:47-58` | `products.signal` with `surface: "attention"`, `appUrl: /app/signal` |
| `MODULE_LABELS.signal` | `src/components/studio-bar/studio-bar.tsx:85` | Comment says "kept for type completeness only" |
| `RailIconName` | `src/components/studio-bar/rail-icons.tsx:12` | includes `"signal"` and `"project"` |
| Suite-context product ids | `src/lib/suite-context.ts:51` | includes `"signal"` |
| Account export product tag | `src/server/account-unified-export.ts:65` | `product: "signal" as const` |
| Instrumentation type | `src/lib/account/instrumentation/event-schema.ts:14` | `SponsoredProduct` includes `"signal"` |
| Sponsored-journey contract | `contracts/sponsored-journey-coverage.v1.json:33` | "The four products the couple actually uses — Notes, Tasks, Timeline, Signal" |
| Decisions doc | `docs/decisions.md:105` | "Signal Studio is one app with four products" |
| Tenant-scope test header | `src/server/tenant-scope.test.mjs:2` | "all four products" |

---

## 8. Analytics — what exists, what is mounted

**`/app/home/analytics` does not exist.** No directory, no route file, no rewrite, no
redirect. `next.config.ts` `redirects()` (`:350-…`) contains no analytics or trends entry.
`scripts/check-route-manifest.mjs:36-58` does not list it — and notably does not list
`app/home`, `app/home/briefing` or `app/project` either, so the deletion gate does not
currently protect Home.

**What the signal module exposes today:**

| Layer | State | Cite |
|---|---|---|
| `@/modules/signal` barrel (wide) | Exports exactly three route components: `SignalBriefPage`, `SignalOnboardingPage`, `SignalNotificationsPage` | `src/modules/signal/index.ts:16-18` |
| `@/modules/signal/home` (narrow) | Exports `buildBriefingForUser`, `requireSignalUser`, `calendarDayDifference`, `localWeekday`, and four types. **This is Home's entire contract with Signal.** | `src/modules/signal/home.ts:22-36` |
| Analytics service | Supports three view names: `"briefing" \| "overview" \| "trends"` | `src/modules/signal/server/analytics/service.ts:86` |
| Analytics view called in production | **`"briefing"` only** | `src/modules/signal/app/signal-brief-page.tsx:44-49` |
| Analytics HTTP handler `runAnalyticsRoute` | **Zero importers** — not mounted as any API route | `src/modules/signal/server/analytics/route.ts:9` |

**Dead component subtree.** `SignalAppShell` has zero importers
(the only non-self references are a CSS comment at
`src/modules/signal/components/signal/signal.css:7` and a negative assertion at
`src/modules/signal/server/analytics/production-entry-contract.test.mjs:83`). Because it
is the sole root, everything below it is unreachable:

| Component | Reached only via |
|---|---|
| `overview-view.tsx` | nothing — 0 importers |
| `trends-view.tsx` | nothing — 0 importers |
| `trend-chart.tsx` | overview-view, trends-view |
| `project-status-table.tsx`, `action-queue.tsx`, `customize-mode.tsx`, `summary-row.tsx`, `observation-card.tsx` | overview-view |
| `context-sidebar.tsx`, `freshness-indicator.tsx`, `signal-context-controls.tsx`, `signal-view-tabs.tsx` | signal-app-shell |
| `data-coverage-notice.tsx`, `source-record-list.tsx` | overview/trends (+ evidence-drawer for source-record-list) |

Live components in the module: `quiet-briefing-ledger.tsx`, `scope-switcher.tsx`,
`evidence-drawer.tsx`, `format.ts`, `links.ts`, `action-link.tsx`.

**Evidence:** the analytics *engine*, *contracts*, *ledger*, *scope authorization*,
*coverage model* and *three real providers* are built and tested. The **presentation** of
anything beyond the briefing ledger is not wired. Analytics is a build problem, not a
research problem.

---

## 9. Classification

One class per row: **retain** · **decompose** · **migrate** · **redirect** · **retire** ·
**out-of-scope**.

### 9.1 Home modes and the surfaces that become them

| Route / section | Class | Reason |
|---|---|---|
| `/app/home` (route + shell placement) | **retain** | Already the front door, already on the module canvas, already outside the Tasks runtime. `/app` redirects here (`src/app/app/page.tsx:34`); welcome and onboarding push here (six call sites). The route is right; only its read scope and composition change. |
| `/app/home` → Today's Signal | **retain** | The engine slice is the intended Today. Charter locks Today and Full briefing to one ranking engine; `home-data.ts:130-133` already is that. |
| `/app/home` → Coming up | **decompose** | It is a date filter, not a ranked read (`home-data.ts:137-157`), and it overlaps My work's "This week" bucket (`selectors.ts:173-180`) over the same rows. Charter rule 10 forbids duplicate summaries. |
| `/app/home` → Needs review | **decompose** | Same rows as My work's "Waiting on you" (`selectors.ts:167-171`) rendered under a second name. Pick one owner. |
| `/app/home/briefing` | **retain** | Charter: depth from Today, not a fifth mode. Route already canonical, evidence hrefs already hardcoded to `/app/home/briefing` (`signal-brief-page.tsx:52`, `:62`), ledger contract already lists `/app/home` and `/app/home/briefing` as canonical product paths (`src/modules/signal/lib/analytics/ledger-contract.ts:141`, `:144`). |
| `/app/inbox` | **migrate** | Content classes stay, route moves to `/app/home/inbox`. It is the only event surface in the app and already carries mentions and alerts from a real `notifications` table. |
| `/app/inbox` → nudges section | **decompose** | Rendered twice today, identically, on `/app/inbox` (`inbox-app.tsx:114`) and `/app/my-tasks` (`my-week-app.tsx:158`). One owner only. |
| `/app/inbox` → daily digest cards ("Closed yesterday" / "Due today") | **decompose** | "Due today" is My work's Today bucket; "Closed yesterday" is My work's "Done this week". Charter rule 6/10 — Inbox is response-to-change, not a second task summary. |
| `/app/inbox` → weekly recap | **out-of-scope** *(for the shell work; revisit at content)* | Gated on `aiConfigured()` (`src/app/app/inbox/page.tsx:130`), streamed, client-cached. Charter rule 12 constrains what AI may claim; it does not decide where the recap lives. Flag, do not move blind. |
| `/app/my-tasks` | **migrate** | Becomes `/app/home/my-work`. The two nav labels already say "My work" (`projects-sidebar.tsx:473`, `sidebar.tsx:329`) — the route name is the outlier. |
| `/app/my-tasks` coverage model | **decompose** | Charter rule 7: My work is a read projection over source truth. Today it is `assignees.includes(me)` in one cookie-selected workspace (`selectors.ts:133`), which is neither cross-product nor cross-workspace. |
| `/app/home/analytics` | *(does not exist — build)* | Not a classification target. §8 establishes the engine and providers exist and the presentation does not. |
| `/app/trends` | *(does not exist)* | Not a classification target. The `"trends"` view name lives in the service (`service.ts:86`) with no route and no live caller. |

### 9.2 Overlapping and adjacent routes

| Route | Class | Reason |
|---|---|---|
| `/app/project` | **retain** *(as scope, not as a mode)* | Charter rule 5: Project is scope and mutation context, not a Home mode. The page already computes the exact workspace-level truth an Active Project header needs (`project-overview.ts:183-240`) and already has no navigation entry. **Collision:** `src/lib/projects/**` is being authored right now by `lane/wp2-project-platform`; consume theirs. |
| `/app/your-work` | **redirect** | It is a portfolio index behind a production-off flag (`your-work/page.tsx:13`, `flags.ts:33-35`) that no navigation surface links to. Its only live inbound is `/api/suite-context` (`route.ts:23`, `:54`) — point that at the Home entry instead and redirect the route. |
| `/api/suite-context` redirect target | **migrate** | `:23` and `:54` both hardcode `/app/your-work`. Cross-product context handoff must land on the operating layer, not a flagged planning index. Two-line change, but it is a **shared contract** — coordinate with `lane/wp2-project-platform`, which owns `src/lib/product-urls.ts`. |
| `/app/signal`, `/app/signal/onboarding`, `/app/signal/settings/notifications` | **retain** *(as 308s)* | Already permanent redirects that fire from `generateMetadata` so they beat the stream (`src/app/app/signal/page.tsx:19-28`). `docs/projects/signal-home-consolidation/MIGRATION.md` asks to keep them until settled. Retire later, deliberately, not in this programme. |
| `/app/settings` | **out-of-scope** | Workspace/team administration inside the Tasks runtime, nine tabs (`settings-app.tsx:59-68`). Charter rule 3 scopes Profile to identity; workspace administration is a separate axis. |
| `/settings`, `/settings/profile`, `/settings/notifications`, `/settings/plan` | **out-of-scope** | Account administration on its own layout outside `/app` (`src/app/settings/layout.tsx:12-39`). Charter rule 3. |
| Notification settings, all three surfaces | **decompose** *(flag; do not resolve here)* | Three routes, three stores: `/app/settings` tab 03 (workspace prefs — `dailyDigest`, `mentions`, `commentReplies`, `nudges`); `/settings/notifications` (account cadence — `dailySignalCadence`, `weeklySummary`, `timeZone`); `/app/home/briefing/settings/notifications` (static copy, no store). A user changing "what we send you" has three plausible destinations. |
| `/app/tasks/**`, `/app/task/[id]`, `/app/archived`, `/app/import`, `/app/notes`, `/app/timeline/**` | **out-of-scope** | Products. Home reads them; it does not absorb them. |
| Desktop Studio rail | **retain** | Three products, no Home, contract-tested (`suite-navigation-contract.test.mjs:118-124`). Changing it needs founder authority, not a design opinion. |
| Studio Bar mark cell (Home glyph) | **decompose** | Charter rule 2: Home may not be an unlabelled icon. Today, off the Tasks runtime, this 44px `hidden … md:flex` glyph (`studio-bar.tsx:104-116`) is the only desktop route to Home. |
| Tasks sidebar "Shortcuts" group (Home / Inbox / My work) | **migrate** | These three become Home modes. `projects-sidebar.tsx:441-476` is where they live and is Tasks-runtime-only, so today they vanish on Notes, Timeline and Home itself. |
| `SuiteCommandRoot` destination list + placeholder copy | **decompose** | List is Home-last (`:27-53`); placeholder and empty state name a product that no longer exists (`:263`, `:346`). Both are user-visible. |
| Tasks palette `SUITE_JUMPS` | **decompose** | Four jumps: home, timeline, notes, briefing (`command-palette.tsx:667-688`). No Inbox, no My work, no Analytics. |
| `auth-stage.tsx` four-station spine | **decompose** | `:42-46` + `:98-107` — visible four-product claim on every sign-in. |
| `suite-arrows.tsx` fourth entry | **decompose** | `:27` — visible four-product claim on the marketing homepage. |
| `signal-app-shell.tsx` + `overview-view` + `trends-view` + eight descendants | **retire** | Zero importers (§8). Dead weight that will otherwise be mistaken for the Analytics starting point. |
| `runAnalyticsRoute` | **retain** *(unmounted)* | Zero importers, but it is the tested envelope (auth → parse → calculate → `Server-Timing`) an Analytics route will need. Keep; do not treat its existence as an implemented API. |
| `MANIFEST` in `scripts/check-route-manifest.mjs` | **decompose** | Omits `app/home`, `app/home/briefing` and `app/project` (`:36-58`), so the anti-deletion gate does not currently protect the front door. |
| Page-level `requireAppAccess()` on Home, Briefing, Notes, Timeline | **decompose** *(defect)* | §1.3. Six call sites re-impose the allowlist-only gate the layout deliberately replaced. |

---

## 10. Facts the programme should treat as fixed inputs

1. **One briefing build serves Home and the Full Briefing.** `captureSignals`
   (`signal-build-for-user.ts:70-86`) already guarantees one read, one scope check, one
   ranking engine. Charter rule 9 is satisfied at the data layer today.
2. **`recordReadState` is the read-of-record switch.** Home passes `false`
   (`home-data.ts:107`). Any new Home mode that must not advance carry-over ages inherits
   this parameter rather than inventing a second flag.
3. **Scope authorization is centralised.** `authorizeSignalScope` +
   `listPlanningCatalogForUser` (`signal-build-for-user.ts:266-282`) is the only path to a
   `workspaceIds` list for the briefing. Home Read Scope should extend it, not bypass it.
4. **Provenance is currently a lie by template, not by design.** `sourceLabel` is written
   as `Tasks · <workspace>` at `signal-build-for-user.ts:331`. The moment a second product
   feeds Home, that line must be resolved from the record, not formatted.
5. **The three-provider stack is real and coverage-aware.** `providerCoverage`
   (`providers/coverage.ts:8-25`) already models status, capabilities, history window,
   staleness and issues — the exact vocabulary Charter rule 11 ("unknown stays unknown")
   needs. Build on it.
6. **Two `⌘K` owners already coexist safely.** `ownsCommand = activeProduct !== "tasks"`
   (`suite-command-root.tsx:78`), asserted at
   `src/server/suite-navigation-contract.test.mjs:203-244`. A Home palette must respect
   that single-owner invariant.

---

## 11. Collisions with the in-flight Project Truth lanes

Checked against `docs/projects/home-operating-layer/COLLISION_REGISTER.md`.

| Foreign path | Owner | Where this audit's findings touch it |
|---|---|---|
| `src/lib/product-urls.ts` (modified, uncommitted) | `lane/wp2-project-platform` | §7.2 lists five surviving `signal` exports here; §5.1 needs `/api/suite-context` retargeted through this file's constants. **Do not edit.** |
| `src/lib/projects/**` (untracked, being written now) | `lane/wp2-project-platform` | §5.2 classifies `/app/project` as Active Project scope. That is exactly the ProjectScope foundation being authored. **Consume, do not duplicate.** Path does not yet exist in this worktree. |
| `src/modules/timeline/**` | `lane/wp1-timeline-safety` | §8's Timeline analytics provider (`providers/timeline.ts`) reads `TIMELINE_DATABASE_URL` directly, not through `src/modules/timeline`. No direct file overlap found, but Analytics Project identity depends on their exact-Project resolution outcome. |
| `src/server/suite-context-contract.test.mjs` | `lane/wp1-timeline-safety` | §5.1's `/api/suite-context` retarget is contract-adjacent. **Do not edit the test.** |
| `docs/adr/**`, `docs/wave/**` | `feat/project-truth-wave` | Neither directory exists in this worktree at the base SHA. This audit writes only under `docs/projects/home-operating-layer/`. |

Not in the register but worth flagging as shared-surface: `src/server/suite-navigation-contract.test.mjs`
encodes the current rail/mobile-nav/palette shape as assertions
(`:108-145`, `:264-315`, `:339-368`). Several §9 classifications require those assertions
to change. Per the Charter's authority rule, classify each as **invariant**,
**compatibility** or **stale** before editing, with cited authority.

---

## 12. Limits of this audit

- Static read only. No build, no dev server, no request executed, no database queried.
- Environment-dependent behaviour is stated as a fork, not resolved:
  `SIGNAL_ANALYTICS_V1_ENABLED`, `SIGNAL_PLANNING_PERIODS_ENABLED`, `TASKS_DATABASE_URL`,
  `NOTES_DATABASE_URL`, `TIMELINE_DATABASE_URL`, `aiConfigured()`, `isDemoMode()`,
  `isProductionMode()`.
- The §1.3 access-gate finding is read-verified and marked **INFERENCE** for its runtime
  consequence; it needs a live non-allowlisted membership account to confirm.
- "Zero importers" claims come from repo-wide grep over `src/`, `e2e/` and `scripts/`.
  Dynamic imports by constructed string would not be caught; none were observed.
- Demo/review branches were read but not exercised. Every production claim above cites the
  non-demo branch.
