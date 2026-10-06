# Sidebar pass and one create button per screen (6 October 2026)

Branch `design/app-v3-sidebar`, PR #219. Based on `design/app-v3-home-overview` (PR #209) with `design/app-v3-automations-canvas` merged in, so this PR carries the Automations preview to main and PR #216 closes in its favour.

## What the founder asked for

"automations should be in the sidebar, the sidebar should also have some separators to look less cramped and the chat feature and functionality should also be in the sidebar." Earlier the same day: the chat front end back in the sidebar and collapsible, the rest of Initial setup deleted, Overview nested in Home as a tab, a Timeline row, a Projects section where each project has its own icon and a status mark, and one create button per screen.

## Data map

| Element | Source | Kept or dropped |
| --- | --- | --- |
| Home row, lit on Overview too | `shell-nav.ts`: Home owns `/app/home`, `/app/home/briefing`, `/app/signal` | Kept. The Overview row is removed. |
| Workspace rows | `WORKSPACE_DESTINATIONS` | Projects, Tasks, Timeline, Files, Analytics |
| Project rows | `loadSidebarProjectsAction`, which returns `loadProjectCatalogAction`'s rows: the same authorized catalog the shell, the chooser and the Projects page use | Kept, archived ones left out |
| Project tile colour and letter | `projectColor(id)` (the app's existing identity colour) and the catalog row's monogram | Kept |
| Status dot | The status its owner set and its target date, by the Projects console's own rule (`sidebarProjectMarks`, checked against `buildConsole` row for row in the unit test): late when the target date has passed and the project is not complete, else at risk when the owner set that | Shown only for late or at risk. No dot when fine, paused, complete or unset. |
| Open task count on a project row | Catalog row | Dropped from the row to make room for the dot; it is on the Projects page |
| Automations row, "Preview" | `AUTOMATIONS_APP_PATH`, `AUTOMATIONS_LABEL` | Kept |
| Whiteboard row, "Soon" | As before | Kept |
| Chat rows | The chat directory the shell already reads for the reader (`conversation-navigation-runtime.tsx`): the reader's project channels from `listProjects({ actorId })`, behind `canShowMessages()` | Kept: name, unread weight, count, Request tag, presence where the data has them |
| "New message" | `directory.newMessageHref`, non-null only when direct messages are on | Shown only then |
| Chat without access | `messagesEnabled` false | One row, "Conversations, Coming soon", not a link |
| Inbox, My tasks, Apps and tools rows | No longer rows | Inbox: the bell in the top bar. My tasks: Search or jump to. Apps and tools: the launcher in the top bar. All keep their paths and breadcrumbs. |

## New server read

`src/server/actions/sidebar-projects.ts`, `loadSidebarProjectsAction`. It calls `loadProjectCatalogAction` (flag gate, re-authentication and membership query unchanged), then makes one select on `meta` for two keys per project (status and target date), filtered to the ids that catalog returned, at most 200. Read only. A failed read means no dots, never a guessed one. Demo and Review touch no database and show no dots. No schema change. Chat needed no new read.

## What each group shows

- No projects: Projects group shows "No projects yet" with a quiet "Start one" link to the Projects page.
- One project: one row, tile and name; a dot only if late or at risk.
- Many projects: the first eight (five on the rail), then "All N projects".
- With Chat: "All conversations" with the unread count, then the reader's conversations; "No conversations yet" if there are none; a plus for New message only when direct messages are on.
- Without Chat: the Chat group with one quiet row marked "Coming soon"; on the rail the group is left out.
- Projects and Chat fold from their names; the choice is kept in `localStorage` (`signal:v3:sidebar-folded`, in try/catch).

## Create buttons removed

| Removed | Where the action lives now |
| --- | --- |
| Projects page header "New project" | Top bar "New project" on `/app/project` and `/app/archived`; it opens the same form and focus returns to it. From anywhere else: the arrow beside the top bar button, Project (arrives with `?create=project`). The Cards view keeps its "New project" tile as the in-page invitation. |
| Automations list header "New automation" | Top bar "New automation" on `/app/automations` and a draft's canvas; from anywhere else, the arrow, Automation (arrives with `?create=automation`). |
| Tasks, Home, Overview page buttons | Already removed on the branches this one is built on; the top bar's "New task" is the one button. |

Files and Analytics were checked and have no create button of their own. The project overview card keeps its "Add a task" text link and Home's empty state keeps its "New project" link: both are in-body invitations, not second buttons.

## Verification

Production build in review mode, served by `next start`, never `next dev`:

```
VERCEL_ENV=preview SIGNAL_ACCESS_MODE=review NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm build
node node_modules/next/dist/bin/next start -p 4452
node experience/sidebar/run.mjs --base http://localhost:4452 --capture <folder>
```

Expected result: `PASS sidebar: 240 checks across phone, tablet, desk and wide, dark and light`.

Screenshots are in the design lab, not this repository: `remote-redesign` on `design/landing-v3-directions`, `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-06-sidebar/`, named `<state>-<size>-<theme>.png`.

Review mode has one project with no status and a reader who has Chat. A reader without Chat, with no projects, with many projects, and a project with a dot are covered by unit tests and source contracts, not by a rendered fixture. That fixture is owed.

## Registry

`pnpm experience:validate` is clean with no reviewed hash changed, so there are no receipts in this folder. `experience/feature-tests/initial-setup-shell.spec.ts` and its config are retired: the group they tested no longer exists, and `experience/sidebar/run.mjs` replaces them.

## Gates, as run on 6 October

- `pnpm typecheck`: clean. ESLint on the changed files: clean.
- `pnpm test:suite-url-and-switcher` (shell nav, launcher, navigation and context contracts): 85 of 85. `sidebar-projects.test.ts` and `automations.test.ts`: 26 of 26. `pnpm test:conversations`: pass.
- Module boundaries, route manifest (91), suite switcher contract, first-contact language, tap targets, v3 tokens (source and built), tenant scope rules: all pass.
- `pnpm experience:validate` and the critical fixtures check: clean.
- `pnpm build` in review mode: pass. `experience/sidebar/run.mjs`: 240 of 240 on the final build. `experience/automations-canvas/run.mjs`: 386 of 386 on the final build. `experience/project-console/run.mjs`: 225 of 225.
- `pnpm test:settings-hydration`: 5 pass, 2 fail. Both failures are one assertion in `shell-surfaces.spec.ts`, "the card has a fill", on Home's next big day card (`[data-home-card="next"]`). The card's fill is a `background:` gradient, so its computed background colour is transparent. That is Home's own style, inherited from PR #209, whose `registry-and-drift` job was already failing; the sidebar assertions in the same test (ground, icon contrast in the Workspace group) pass before it. Owed, most likely in #209: give `.next` in `home.module.css` a `background-color: var(--v3-surface)` with the gradient as `background-image`, then rerun.
- Not run: the whole of `pnpm test`, the critical capture, `pnpm test:recipient-context:browser` (its sidebar selector was updated by reading, not by running) and the Home and Overview browser checks.

## Bundle

Total client JS measures 1110.3 KB gzip on the final review-mode build (Home and Overview 1082.1, plus Automations about 25.5, plus about 2.7 for this pass). The ceiling in `contracts/venue-surface-performance-budgets.v1.json` is 1113. The 936 target is unchanged.
