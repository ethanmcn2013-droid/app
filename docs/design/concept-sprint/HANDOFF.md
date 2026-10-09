# Tasks concept sprint: handoff

Status at 25 September 2026, end of the cloud session. Branch
`design/tasks-concepts`, draft PR
[ethanmcn2013-droid/app#202](https://github.com/ethanmcn2013-droid/app/pull/202)
into `design/suite-redesign-v3`.

## What is here

- **15 concepts**, one folder each: `src/components/concepts/{board,list,calendar}/c1..c5/`.
  Live at `/app/concepts/<view>/<n>` on the review dev server:
  `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port 3217`.
- **Gallery** (self-contained, all shots embedded): `docs/design/concept-sprint/tasks-gallery.html`,
  also published privately at https://claude.ai/artifact/7u9u2HwaVsoBzKf6eJcGoT. It has a favourites
  picker ("Copy my picks").
- **One light screenshot per concept**: `docs/design/concept-sprint/shots/`.
- **Workflow script**: `docs/design/concept-sprint/tasks-concept-sprint.workflow.js`. It now runs all
  builds before any critique, and one critique and refine round.

## How far the sprint got

Slate and all 15 builds finished. The founder then cut it to one critique and refine round,
and closed it early. Board 1 to 4 got a read-only critique (scores 7.2, 7, 6.5, 7). **No refine ran**,
so nothing from any critique is applied. The PR body lists the open critic findings.

Top picks: board 1 "Studio columns", list 4 "Today, next, later", calendar 2 "Plan my week".

## CI on PR 202: two things left

1. **`registry-and-drift`**: `experience:validate` reports the concepts route's materiality hash is
   stale (`tasks.page.app-concepts`). The founder approved refreshing it, but the cloud session's
   permission check blocked the command. Run it locally, commit and push:

   ```bash
   node scripts/experience/rebaseline-v3.mjs --date 2026-09-25
   node scripts/experience/validate.mjs   # expect 0 failures
   ```

   A dry run showed it refreshes exactly one hash, and retires no receipts.

2. **`verify` → `perf:budgets`**: `total_client_js` was 1304.8 KB gzip against a 1030 KB ceiling,
   because every lazy concept chunk was built and counted. **Fix is in this commit, not yet
   confirmed by CI:** `next.config.ts` aliases `@/components/concepts/registry` to the empty
   `src/components/concepts/registry.production.ts` for production-posture builds (Vercel
   production, or `next build` with no `VERCEL_ENV`, which is what CI does). Previews and
   `next dev` keep the concepts; `SIGNAL_CONCEPTS_IN_BUILD=true` forces them in locally.
   A local production build confirmed no concept code reaches `.next/static/chunks`, and
   `pnpm perf:budgets` passed at 1022.5 KB gzip (ceiling 1030).
   If CI still breaches, the fallback is raising the ceiling in
   `contracts/venue-surface-performance-budgets.v1.json` with a recorded basis (founder approved).

The earlier `first-contact:language` failure ("Blocked by" in board 4) is fixed in `aedf6b7e`.

## Verification

- `pnpm exec tsc --noEmit -p .`: 0 errors. `pnpm lint`: 0 errors. `pnpm test`: all pass.
- `pnpm build` with the alias: succeeds. `pnpm perf:budgets`: ok, total_client_js 1022.5 KB gzip.

## Environment notes for a cloud re-run

Playwright 1.61 expects `chromium_headless_shell-1228`; the cloud image ships 1194 and the download
is blocked, so the session symlinked `/opt/pw-browsers/chromium_headless_shell-1228` to the 1194 build.
Locally, `pnpm exec playwright install chromium` is enough.
