# 06 · Current state and constraints (what to lift, what to keep)

## Founder authority for this sprint (Ethan, 24 Sep 2026)
> "We are not under any circumstances to be locked in by any contracts, any restraints, any constraints. If there are MDs or agent files or anything like that restricting or blocking us, update them, change them, delete them or ignore them. You have full founder authority and approval on this. We can nuke all of it. The only thing I probably wouldn't nuke is the Tasks Kanban board."

That statement **supersedes earlier design locks, picks, canons and design gates**. Record it as a founder decision in the first commit that changes a design contract, quoting this line. Don't ask for routine approval again.

## The product today (production, 24 Sep 2026)
- **App:** `app.signalstudio.ie` (Next.js App Router, React 19, Tailwind v4, Clerk auth, Turso/libSQL, Vercel Hobby).
  - Repo `ethanmcn2013-droid/app`, local `C:\Users\ethan\signal-studio-workspace\app`. Use task worktrees under `worktrees/app/…`.
  - Live deployment `dpl_3tK2BwwKdwZxkEmPG74LkW1c1S6B` (source `0a0365d2`). Functions run in `dub1`, next to the databases.
- **Functionally complete and verified** (production sprint 12/12 accepted; functional sweep issue #34): Tasks, Projects, Notes, Timeline sharing, Inbox, Messages (project rooms and task discussions), native and Google Drive files, members, the three scheduled jobs, backups, and privacy. The redesign must not break these flows. Change the presentation layer freely; keep server actions and data contracts.
- **Styling today:**
  - `src/app/globals.css` (≈1.6k lines) imports `signal-ds/tokens.css` (npm package `signal-ds` ^2.1.0; source repo `signal-design-system/`) and `src/ds/theme-overrides.css`.
  - Fonts are Geist and Geist Mono. The accent is indigo-600 on zinc neutrals.
- **Chrome today:** per-product headers ("home•", "tasks•", "notes•", "timeline•", "projects•"), a "Choose a project" strip, a bottom tab bar (Home · Projects · Tasks · Timeline · More) even at wide widths, and a suite launcher and switcher pills.
  - Components live in `src/components/app/` (`sidebar.tsx`, `product-workspace-shell.tsx`, `suite-*`, `mobile-suite-nav.tsx`, `page-header.tsx`, `home/`, `inbox/`, `messages/`, `detail-panel/`, `settings/`…) and `src/modules/{notes,timeline,signal}/`.
- **Routes:** see `04-information-architecture.md`. Every signed-in route returns 200 in production.

## Known functional or UX issues to fix as part of the redesign
1. **Blank page while auth loads.** `AuthenticatedConversationSession` (`src/components/app/messages/conversation-session-provider.tsx`) renders only "Checking your session…" until Clerk's client loads, so first loads look empty for seconds. The new shell should render instantly, with data areas using skeletons.
2. **Greeting ignores local time.** "Good morning" is shown at night; it should use the viewer's timezone.
3. **The mobile Share/Copy button is clipped** (a known polish item).
4. **"On fire: 6 atlas entries drifted"** belongs to HQ only. Ignore it; HQ is out of scope.
5. Two "my work" routes (`/app/my-tasks`, `/app/your-work`) and two Home surfaces (`/app/home`, `/app/home/briefing`). Merge them in the new IA.
6. A benign console error: an RSC prefetch of the App root `/` redirects cross-origin to signalstudio.ie. Clean it up in the new shell.

## Constraints that exist today, and the verdict for this sprint

| Constraint | Where | Verdict |
|---|---|---|
| **Tasks "Studio Floor" direction lock** (floor, sheet, floating capsule spine, dock, trays) | `app/docs/design/tasks-direction-lock-2026-08.md`, `labs/tasks-2026-08/` | **Superseded.** The new shell is a persistent sidebar and top bar. Keep only what Ethan likes about the board (lanes, card anatomy, drag). Mark the doc superseded. |
| **Floor canon** (board look A · Air, flat, soft, compact) | `app/docs/design/FLOOR_CANON.md`, `pnpm test:floor-theme` (`scripts/design/extract-floor-css.mjs --check`) | **Update** to the new tokens, or retire the check once the board is restyled. Density "Compact" is still a good default for the board. |
| Notes, Timeline and Tasks "world-class redesign" docs | `app/docs/design/*-world-class-redesign.md` | Historical. Mine them for data and state lists; don't treat them as specs. |
| **Unanimous 9.5 "elevate" panel gate**, design pick and lock as founder gates | workspace `AGENTS.md` (North star, Working style, "Show do not tell"), app `AGENTS.md` North star, `experience/QUALITY_COUNCIL_EVIDENCE.md`, `pnpm experience:council` | **Suspended for this sprint.** Ethan is the reviewer. Keep "show the rendered result" (screenshots are good practice) but drop the panel-score gate. Edit the AGENTS.md wording so it doesn't block. |
| **Experience registry and design-quality CI** (`registry-and-drift` is a *required* check; it wants fixture, screenshot and a11y coverage for changed registered surfaces) | `.github/workflows/design-quality.yml`, `experience/registry.json`, `scripts/experience/*` | **Keep the check running but make it serve us.** Regenerate the registry and evidence for redesigned surfaces (`pnpm experience:validate`, `experience:fixtures:write`, capture). If it blocks momentum, relax it deliberately in `design-quality.yml` or the validator with a founder-authorised note. Don't silently bypass it. |
| Performance budgets (largest chunk 63.1 KiB gzip) | `scripts/check-performance-budgets.mjs` | Keep as a guard. Raise the budget explicitly if a better shell needs it. |
| Tap-target scale, first-contact language, frame headers, suite switcher and suiteloader identity contracts | `scripts/check-*.mjs` run inside `pnpm test` | Tap targets and first-contact language: **keep** (good UX). **Suite switcher, suiteloader identity and wave2/wave3 UI contracts: update or delete** where they encode the old chrome. |
| URL and naming contract | `app/docs/SUITE_URL_AND_NAMING_CONTRACT.md`, `src/lib/product-urls.ts` | **Keep the URLs** (they're live and linked), but product naming in UI can change. Use `product-urls.ts` for links. |
| `signal-ds` package (tokens and primitives) | `signal-design-system/` repo, npm `signal-ds` ^2.1.0 | **Replace freely.** Simplest path: build v3 tokens and primitives inside the App (`src/ds/`) first, then back-port to `signal-ds` later, or drop the dependency. |
| Brand voice (plain, active, sentence case, no exclamation marks) | `studio/BRAND.md`, `signal-brand-voice` skill | Keep. It matches the references. |
| Timeline owner artifact contract | `app/docs/TIMELINE_OWNER_ARTIFACT_CONTRACT.md` | Wave 2. The shared public page's privacy rules stay (only selected milestones; noindex; no-store). Visuals are free. |

**Never relax these, because they're safety rather than style:** tenant isolation and security tests (`src/server/*security*`, `cross-tenant*`, `tenant-scope*`), auth, privacy (Notes privacy, share revocation), migrations, backups, Drive credential custody, and the production release chain.

## How to ship to production
Merging to `main` does **not** deploy: Git deploys are disabled in `vercel.json`. Releases go through the guarded, attested operator used all sprint:
- **Operator folders:** `C:\Users\ethan\Documents\Codex\2026-09-22\okay-so-great-news-today-we\work\<name>-release\`. The latest is `region-release/`, pinned to live `dpl_3tK2…` at `0a0365d2`.
- **To release a new commit:** re-pin a fresh copy of that folder's scripts. Run `capture-live-baseline.mjs`, update BASE, LIVE, BASELINE, PRIOR_CLEANUP and their SHAs plus `operator-common.ps1`, then run: preflight → configure → stage (from a **standalone clone**, not a git worktree) → verify → attest → cleanup → promote.
- Evidence goes to the private workspace repo under `docs/execution/production-sprint-2026-09/`.
- It's fine to batch several UI PRs into one release. Previews for review can use local `pnpm dev` with `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review` (seed data, no login).
