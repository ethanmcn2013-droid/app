# 07 · Redesign sprint plan (proposal: the new session should refine it)

**Goal:** a coherent, beautiful Signal Studio suite at the quality of the references. Wave 1 is the primary surfaces (shell, Home, Tasks, Projects, Overview, Messages, Files, Settings), live in production, with the backend untouched.

## Phase 0: Orientation and audit (first session; no UI code)
1. Read this package end to end, including `key-frames/` and the three reference videos.
2. **Capture the "before":** sign in to production as Ethan (or use local review mode) and screenshot every wave-1 surface at 1440×900 and 390×844, light and dark where available. Save them under `before/` in this package.
3. **Inventory:**
   - components per surface;
   - the data each surface already has (server actions and queries);
   - every file that encodes the old chrome (`sidebar.tsx`, `product-workspace-shell.tsx`, `suite-*`, `mobile-suite-nav.tsx`, `page-header*`, per-module headers);
   - the tests and checks that will fail when the chrome changes.
4. **Decide and write down** (as a short `DECISIONS.md` in this package and in the repo):
   - the build path: in-App `src/ds/` v3, or a new `signal-ds` major;
   - light-first or dark-first, with both shipped by the end of wave 1;
   - token names;
   - which old contracts get superseded, retired or updated, quoting the founder authority line in `06-…`.
5. Produce a **wave-1 plan** with PR slices, the order, and what "done" means per screen. Share it with Ethan as one page (an artifact is fine), then proceed. Don't wait for sign-off on routine choices.

## Phase 1: Foundations (the system and the shell)
- **Tokens:** colour (light and dark), type, space, radius, elevation and motion, from `03-design-system.md`, tuned against the key frames.
- **Primitives:** Button, Input, Chip, Status icon, Priority, Avatar, Badge, Tabs, Segmented control, Menu, Popover picker, Modal, Toast, Table row, Card, KPI tile, Progress, Skeleton, Empty state and Command palette.
- **App shell:** persistent sidebar (sections, projects with sub-views, collapse, density), top bar (breadcrumb, ⌘K, bell, + New, avatar), account menu with the theme switch, a mobile drawer, and **no auth-gate blank screen**.
- A **component gallery page** (dev-only route or Storybook-like page) showing every primitive in light and dark. It's the fastest review loop for Ethan.

## Phase 2: Primary screens, in this order
1. Home (merge Home and Briefing; KPIs, My tasks, Deadlines, Project progress, Signal card, Activity).
2. Tasks: List, then Board (restyle and keep), then the New task modal and task detail panel.
3. Projects: grid, the project page with tabs, and the archived and restricted states.
4. Overview (analytics).
5. Messages (two-pane chat).
6. Files (new aggregate page and its one read query).
7. Settings (second-level nav, Appearance with theme/accent/density/motion, Members, Connections, Notifications, Profile, Privacy).
8. Inbox and notifications feed.

Per screen:
- Build it.
- Screenshot desktop and mobile in light and dark, next to the matching reference key frame.
- Self-critique against `02-design-direction.md`, fix, then ship.

## Phase 3: Release and review
- Batch into releases through the guarded chain (`06-…`).
- After each release, post a short visual report to Ethan (before and after for each screen) so he can open production and critique it.
- Iterate on his notes.

## Phase 4 (wave 2)
Notes, Timeline (plan, share manager, artifact studio, public page), full-page Calendar, full-page Task detail, onboarding, invite and sign-in, the long-tail pages, and every empty, error and loading state. Mobile everywhere.

## Working rules for the sprint
- **Functionality is sacred.** Before merging a screen, click through its main actions in review mode or production. Existing server actions stay.
- **One system:** no page-local colours, spacing or one-off components. If a need isn't covered, extend the system.
- **Small PRs, fast merges.** CI must stay green (typecheck, tests, required checks). Update or retire obsolete design contracts in the same PR that makes them obsolete.
- **Show, don't tell:** every PR description carries rendered screenshots.
