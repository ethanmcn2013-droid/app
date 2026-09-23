# S4 follow-up: Tasks view contrast and clean browser diagnosis

Branch: `fix/january-utility-navigation`.
Parent milestone: `4e4a356284c2fb028bb33000502b7e43327c7c61`.
Worktree: `C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-utility-navigation`.
Date: 2026-09-04. [Exact source and build manifest](source-manifest.json).

## Bounded implementation

The inactive Floor view links used the fixed `rgba(17,17,17,0.72)` secondary
ink even when their sheet inherited dark paper. An isolated Chrome test
reproduced **1.00997:1** for List against the actual composited dark background.
This supersedes the earlier uncertainty about the connected browser's rendering.
The faulty selector is in the **Floor** wrapper around the hybrid views.

Only `.segItem` now derives its 72% secondary step from `var(--ink)` using
`color-mix(in srgb, var(--ink) 72%, transparent)`. The light palette, active
state, hover state, type size, layout, links and project handling are unchanged.
No other canvas token or control was changed. This is the user's delegated
contrast repair, with no new design direction, motion or acceptance claim.

The design master `docs/design/labs/tasks-2026-08/floor.html` was edited and
`scripts/design/extract-floor-css.mjs` was run. Full regeneration exposed
pre-existing drift: it would remove the production fit-columns rule and
mobile density selectors, among other unrelated changes. Only the generated
`.segItem` block was retained in `src/components/floor/floor.module.css`.
The master and production block match; wider generator reconciliation remains
outside this repair. `FLOOR_PRESET` and the recorded Floor canon were retained.

## Measured render proof

Tests used new Playwright-managed Chrome contexts with extensions disabled,
not the user's connected profile. No profile, extension or browser preference
was changed. Desktop/mobile dimensions and locale/timezone come from the
existing browser contract; light/dark are explicit context color schemes.
The final config places reduced motion in `contextOptions`.

| Actual built surface | Inactive text contrast | Evidence |
| --- | --- | --- |
| Dark Board, mobile 390 × 844 | 9.23:1 | [image](mobile-dark-board.png) |
| Dark List, mobile 390 × 844 | 9.23:1 | [image](mobile-dark-list.png) |
| Dark Board, desktop 1280 × 900 | 9.23:1 | [image](desktop-dark-board.png) |
| Dark List, desktop 1280 × 900 | 9.23:1 | [image](desktop-dark-list.png) |
| Light Board and List, both sizes | 7.31:1 | [mobile Board](mobile-light-board.png), [mobile List](mobile-light-list.png), [desktop Board](desktop-light-board.png), [desktop List](desktop-light-list.png) |

The test reads computed text colour and every ancestor background, composites
alpha layers, and calculates relative luminance. It rejects gradients,
non-opaque ancestry and unsupported colour formats rather than inventing a
background. Every label must meet 4.5:1, remain inside the viewport, and retain
its expected name. It verifies Board/List active identity and enters List using
the keyboard. No horizontal document overflow was measured. Internal board
scrolling is preserved. [Built measurements and console results](built-results.json)
retain exact colours, rectangles, ratios, URLs and project names for all cases.

The negative baseline actually failed the same contrast assertion on the old
colour: [before image](before-mobile-dark.png), [isolated development failures](before-isolated-dev.json).
The baseline predates the test configuration's reduced-motion nesting correction;
its static colour measurement is independent of that correction.

## Console diagnosis, not suppression

**Connected-profile hydration errors:** the previous receipt records injected
`stndz-general-13` and `stndz-custom-css` styles. Those extension IDs are absent
in the new contexts. The isolated development run did not reproduce that
attribute mismatch. This class of noise is distinct from the finding below.

**App-owned development script warning remains open:** the isolated development
Board-to-List run reproduced `Encountered a script tag while rendering React
component` with no extensions and no request failures. The loading fallback
renders `ArrivalSettle` from `src/components/system/arrival-settle.tsx:136`,
whose client component returns a raw inline script. Its own comments explicitly
describe that script being inert on client navigation and the separate layout
effect cleanup handling that path. Next's bundled React development renderer
emits the observed diagnostic when it creates a script element. This is an
app-owned loading implementation warning, not extension interference, and is
not fixed by the contrast change. The component was not edited. It needs a
separate loading/arrival review that preserves cold-stream and client behavior.

**Actual production build:** all four isolated Board-to-List cases reported
zero console warnings/errors, zero page errors and zero HTTP error responses.
The requested List response returned 200 and its table rendered. The script
diagnostic did not appear in this build; production React omitting a development
diagnostic does not establish that the underlying inline-script design was fixed.
No console method, app error handling or warning filter was changed.

The test intentionally delays real List RSC responses by 600ms to exercise the
loading path. It retains **every** failed request. An initial strict network
assertion also caught Next cancelling speculative work during navigation.
The final test permits only `net::ERR_ABORTED` on a same-origin GET with an
`_rsc` parameter and the explicit `next-router-prefetch: 1` header. All other
request failures and every HTTP error still fail. The recorded runs contain
12, 16, 13 and 13 such cancellations respectively; they are preserved in
`built-results.json`, not discarded. This is a scoped console/navigation result,
not a claim of zero network cancellations or a complete app runtime audit.

## Validation and integration prerequisite

- `pnpm experience:test:utility-navigation`: **8/8 passed** against `next start`.
  Its separate config selects only `utility-navigation.spec.ts`; it imports no
  critical attestation config or old Settings hydration spec and writes no receipt
  to the critical registry.
- `pnpm test:suite-url-and-switcher`: **57/57 passed** (26 + 31).
- Focused ESLint on the new config and spec passed.
- `pnpm typecheck` and the complete `pnpm build` passed with the lead's exact
  `ffa60f4e` version of `src/lib/sentry-scrub.test.ts` temporarily overlaid.
  That existing integration prerequisite is test-only and does not enter the
  browser bundle. It was restored byte-for-byte before this commit, so this
  follow-up does not duplicate or replace the lead's fix. Retain the core fixture
  correction on integration; this older branch alone still has that known type
  error after restoration. The prerequisite hash is in the source manifest.
- `node scripts/experience/validate.mjs` passed. This validates the existing
  registry, not a new visual baseline or human acceptance.
- The build retained three Turbopack NFT tracing warnings through
  `next.config.ts` / `src/server/storage.ts`. No tracing, backend or build
  configuration was changed to hide them.

No production credentials, provider or database activity, writes, invitations,
publication, billing edits or Drive edits were involved. No full backend suite,
performance gate, critical attestation, actual browser zoom, screen-reader audit
or broad canvas contrast certification is claimed. Other existing fixed-ink
canvas controls are outside this explicitly bounded inactive-view repair.

## Reproduce and hand off

The owned **built** review server is at <http://127.0.0.1:3132/app/tasks> and
<http://127.0.0.1:3132/app/tasks/list>. HTTP preflight returned 200.
Exec session `48778`, Next launcher PID `4588` at capture time. The former dev
server on 3131 was stopped for the build. Lead preview 4350 was not touched.
Stop only the owned session with Ctrl+C after coordination; recheck process
identity if using a PID later.

Build and start from this worktree (after retaining the core Sentry prerequisite):

```powershell
$env:NEXT_PUBLIC_SIGNAL_ACCESS_MODE='review'
$env:SIGNAL_ACCESS_MODE='review'
$env:VERCEL_ENV='preview'
$env:NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV='preview'
$env:NEXT_PUBLIC_TASKS_FIRST_COMPLETION='off'
$env:SIGNAL_ANALYTICS_V1_ENABLED='false'
$env:SIGNAL_HOME_ANALYTICS_ENABLED='false'
$env:NEXT_TELEMETRY_DISABLED='1'
pnpm build
pnpm start --hostname 127.0.0.1 --port 3132
```

In a second terminal, run `pnpm experience:test:utility-navigation`. To inspect
the lead's declared review build instead, set `UTILITY_NAVIGATION_URL` to its
localhost URL first. The test runner starts isolated browsers, not a server.
No `.env` was copied; existing pinned dependencies were reused.

Cherry-pick only this follow-up after the `4e4a3562` milestone, retaining all
later core changes. No push or merge was performed here.
