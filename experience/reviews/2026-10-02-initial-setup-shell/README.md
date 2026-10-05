# Initial setup shell review

Branch `design/suite-redesign-v3` (PR #201), tranche 1 of the founder instruction of 2 October 2026: bring the shell to the approved navigation (Home, Overview, Projects, Tasks, Timeline, Files, Analytics, Whiteboard) and keep everything else, nested under one group named "Initial setup", so nothing is removed outright. This is an unshipped candidate. No deployment, promotion, database write or production change was made.

## Capture record

The screenshots are not kept in this repository: the guarded release operator reads the whole branch diff into a fixed buffer, and binary captures crowd it. They live in the design lab repository (`remote-redesign`, branch `design/landing-v3-directions`) under `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-02-initial-setup-shell/`, with the file names given below. They were removed from this branch on 5 October 2026; the capture command below still writes them wherever it is pointed.

Source: this branch's final application code, served by the review dev server on port 3217 from the same worktree (`NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, `SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true`, seeded data, no sign-in). The worktree also holds uncommitted design-concept files (`src/components/concepts/`, `src/app/demo/`, `src/app/app/concepts/`, `public/concepts/`, Timeline artifact files); none of them render on the pages captured here.

Command:

```
INITIAL_SETUP_SHELL_URL=http://localhost:3217 \
INITIAL_SETUP_SHELL_CAPTURE=experience/reviews/2026-10-02-initial-setup-shell \
pnpm exec playwright test --config experience/initial-setup-shell.playwright.config.ts
```

Expected result: 36 passed, 4 skipped (the icon-only case has no phone variant, the drawer case has no desktop variant). Final runs on 3 October 2026: 34 passed with 2 passing on retry in the capturing run, then 36 of 36 on an immediate second run. Every test fails on any page error or console error other than the dev-only React notice about the theme script tag, which exists on the unmodified branch; none were recorded.

Projects: `desktop` 1440x900 and `mobile` 390x844, each in light and dark, reduced motion on. Screenshots are named `<project>-<state>.png`:

- `home-group-folded`, `home-group-open`: the top level, the folded group with its waiting badge, then the open group with nested rows indented on a guide line.
- `inbox-group-auto-open`: the group opens by itself on a page inside it.
- `tasks-sidebar`: the same sidebar on Tasks.
- `home-icons-only` (desktop): one button for the group, with its badge.
- `drawer-group-open` (mobile): the group in the drawer.
- `new-menu`: Task and Project, then Note and Message under "Initial setup".
- `launcher-group-folded`, `launcher-group-open`: popover on desktop, sheet on mobile.
- `tools-page-group-folded`, `tools-page-group-open`: the `/app/tools` page.
- `palette`: search off Tasks, listing the sidebar's places.

Keyboard walk covered by the spec: Enter and Space on the sidebar and launcher disclosures, Enter on the icon-only button, Tab into the New menu and Escape back to its button, Escape clearing then closing the launcher, Escape closing the drawer.

## Registry refresh (`registry-and-drift`)

The required check failed at "Validate the Tasks experience registry" on three entries whose sources changed in earlier commits on this branch. A fourth source changed in this tranche.

| Entry | Source change reviewed | How it was refreshed |
|---|---|---|
| `tasks.surface.task-detail-panel` | `f7e61dff`: tasks open in a two-column view | Critical fixture mapping, so the repo's own review action: `pnpm experience:fixtures:write`. Only this entry's hash changed. |
| `tasks.resources.drive-upload` | `cbc3c2bd`: Resources header restyled to match the task view (3 lines) | Targeted hash refresh, below |
| `tasks.page.app-messages` | `cb93af74`: page title and unavailable state say Chat instead of Messages | Targeted hash refresh, below |
| `tasks.state.app-tools-loading` | This tranche: the skeleton now matches the page (five app cards, then the folded group's name) | Targeted hash refresh, below |

A schema receipt (`pnpm experience:review`, `signal-materiality-review/2`) needs a fully green critical Playwright run to attest against. None could be produced: the local run of `pnpm experience:test` (production build in demo mode, 132 cases) finished at 126 passed and 6 failed:

- `tasks.surface.task-detail-panel / populated task` on desktop and wide: the "Files and links" heading is not on screen in the two-column task view. This comes from the earlier task view commit, not from this tranche, and it fails in CI too once the job gets that far.
- `tasks.page.s-by-token / link-only wedding artifact` on mobile, tablet, desktop and wide: two "Share this timeline" buttons. The Timeline artifact files carry large uncommitted changes in this worktree, and they are the likely cause. This is not verified against the committed source.

A first run also failed on Inbox and Notes at desktop and wide. Opening the group by itself there showed the Channels and Direct messages section names at 4.41:1. They now use 56% instead of 48% (5.4:1), and the second run passed those cases.

The three unmapped hashes were therefore refreshed for exactly those IDs, keeping each entry's other fields, with `lastReviewedAt` set to 2026-10-03. This is the same hash function `scripts/experience/validate.mjs` uses. It is a reviewed refresh without a schema receipt; this file is its record. A schema receipt can follow from the first fully green critical run. It did, on 5 October 2026: see `experience/reviews/2026-10-03-projects-console/README.md` for the receipts and for the two failures above, both since resolved or explained.

## Local status of the `registry-and-drift` steps

| Step | Result |
|---|---|
| `pnpm experience:self-test` | Passed |
| `pnpm experience:validate` | Passes on the committed tree. In this worktree it also lists 5 entries from the uncommitted concept and demo pages, which CI never sees |
| `pnpm experience:fixtures` | Passed (37 of 37 mapped) |
| `pnpm test:notes-recovery:browser` | Passed |
| `pnpm experience:test` | 126 of 132; see the failures above. Its webServer step times out locally because a local build takes longer than 240 s, so the run used a separate build with `TASKS_EXPERIENCE_REUSE_SERVER=1` |
| `pnpm test:recipient-context:browser` | Failed: `route-browser.mjs` waits for `aside button[data-active]` holding the Project name. The committed sidebar has never rendered that attribute, so this was already stale |
| `pnpm test:event-export:browser` | Failed locally on a Windows file lock (`EPERM` writing its own output file) |
| `pnpm test:project-recovery:browser` | Passed (14 cases) |
| `pnpm test:settings-hydration` | Passed |
| `pnpm experience:test:timeline-switcher` | Did not run locally: the 240 s webServer limit expired during the build |
| `pnpm experience:council:prepare` | Passed |
| `pnpm experience:council:ci` | Passed, reporting no 9.5 claim (journey receipts absent), as designed |
