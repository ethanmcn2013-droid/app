# Production review, dark default and the light theme

Branch `fix/app-v3-dark-default` (PR #208), cut from `6cd2d1d9`, the source of the production deployment of 5 October 2026. An unshipped candidate. No deployment, promotion, database write, schema change or production change was made, and no dependency was added.

## What production was actually showing

The founder's screenshots (light Home; then dark Home, Tasks and Analytics) show pages with no surfaces, borders, cards, chart bars or sidebar ground. That is not either theme. The stylesheet the deployment serves does not contain the v3 token layer.

| Evidence | Value |
|---|---|
| Deployment | `dpl_4ukmvpPSBFkS9a4X2ePWMfB2YEKY`, target production, source `cli`, commit `6cd2d1d9` |
| Deployed `src/ds/v3.css` and `src/app/globals.css` | byte-identical to the commit (same SHA-1 as `git show`) |
| Global stylesheet production serves (linked from `/sign-in`) | 173,553 bytes. `--v3-chrome:`, `--v3-canvas:` and every other v3 definition: 0. `html:root` blocks: 0. `data-shell` rules: 0. `var(--v3-*)` is used throughout |
| Same file, local `next build` of `6cd2d1d9` | 179,275 bytes, all 67 tokens defined |
| Same file, Linux CI `pnpm build` of this branch (run 37354734242) | all 67 tokens defined |
| Where the gap is | production's CSS goes from the end of `signal-ds/tokens.css` straight to `signal-ds/tailwind.css`. The contents of `../ds/v3.css`, which sit between them in every other build, are absent. Everything else, including utilities generated from the v3 components, is present |
| Reproduction | removing the v3 rules from a local production build of `6cd2d1d9` renders `/app/home` as the founder's screenshot: `before/SIMULATED-production-no-v3-tokens--home--1920-light-collapsed.png` |

**Cause, as far as it can be established from here.** Production's stylesheet is what compiling the previous `globals.css` (without the one line `6cd2d1d9` added, `@import "../ds/v3.css"`) against the new component sources would produce. Cold builds of the commit are correct on Windows and on Linux, with the same Tailwind and Lightning CSS. The only difference found is that Vercel restores `.next/cache` from the previous deployment, and Next 16.3 turned on Turbopack's on-disk cache for `next build` by default. A restored cache serving the old `globals.css` to the CSS transform explains every observation. It is **not proven**: the Vercel build log returned 403 from this session, and the condition could not be recreated locally.

**What this branch does about it.**

- `pnpm build` now runs `scripts/check-v3-tokens.mjs --built` after `next build` and fails if the emitted CSS lacks the tokens, whatever the cause. Against production's stylesheet the script reports 67 of 67 tokens missing.
- `next.config.ts` sets `experimental.turbopackFileSystemCacheForBuild: false`, so a production build does not read a restored cache. A delegated decision; it costs build time and should come out once a cached build is shown correct.
- The sidebar scopes its own ink ground and the frame carries a literal fallback, so the rail cannot render pale icons on white again.
- `pnpm test` compiles `globals.css` the way production does and checks the same thing; `experience/hydration-tests/shell-surfaces.spec.ts` reads computed styles on `next start` over the CI build, in both themes.

**What still needs a person with Vercel access.** Read the build log of `dpl_4ukmvpPSBFkS9a4X2ePWMfB2YEKY`; confirm the project's build command runs the `build` script; redeploy without the build cache. Until production's CSS has the tokens, neither theme can be judged there.

## Dark by default

The app no longer follows the device. The rule is in `src/lib/theme-mode.ts`: only `light` is light.

| Stored `user_preferences.themeMode` | Meaning now | Shows |
|---|---|---|
| `system` (the column default; never chose) | never chose | Dark |
| `dark` | chose Dark | Dark |
| `light` | chose Light | Light |

No schema change and no migration; nobody's row is rewritten. The server action still accepts the three values the column allows; the controls only ever send `dark` or `light`.

First paint: the inline resolver reads `data-theme-mode`, then this browser's copy of the choice (`localStorage` `signal:theme-mode`), and anything that is not `light` is dark. A never-chose user is dark from the first frame with no light flash. A returning Light chooser is light from the first frame. The saved preference streams in behind the shell, always resolved, and corrects both the attribute and the browser's copy. A Light chooser on a browser that has never seen the choice gets dark chrome first, then light; the sidebar and frame are ink in both themes.

Controls: the sidebar theme button switches between Dark and Light; Appearance in Settings is a two-option radio group, Dark first. "Match system" and "System" are removed. The phone browser bar is dark by default and the resolver keeps its own `theme-color` meta in step; `color-scheme` follows. Sign-in, shared links and public pages never carry `data-theme` and are unchanged.

## Defects found and what was done

Measured on a production build served by `next start` (review mode, `SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true`), not `next dev`.

| Sev | Where | Cause, measured | State |
|---|---|---|---|
| S0 | Production, every `/app` route, both themes | v3 token layer absent from the served CSS (above) | Guarded and mitigated here; production not fixed by this branch |
| S1 | Light, every route | Card and page both `#ffffff`; border `#e8e6e3` is 1.25:1. 650 card-like surfaces in the matrix had no fill step and a sub-1.26:1 border | Fixed: page `#f6f5f2`, card `#ffffff` (1.09:1, dark is 1.08:1), border `#dcd9d3` (1.30:1 on the page, 1.42:1 on a card). 91 remain, all inner dividers, as in dark |
| S1 | Dark, `/app/import` and other older surfaces | `bg-brand text-white`: white on `#8b87f8` is 3.03:1 (axe, critical capture) | Fixed: takes the on-accent ink in dark |
| S2 | Collapsed sidebar, both themes | Icons at 58% of `#ececec` on `#141414`, 5.8:1, with a 2px off-centre brand mark and no focus style on icon buttons | Fixed: 82%, 10.6:1; 36px rows on one centre line; hover, pressed, current, focus |
| S2 | Sidebar | Ground came from the root token while its text tokens were scoped: pale icons on white if the root layer is missing | Fixed: ground scoped with the rest |
| S2 | Top bar search | Nothing stopped the label wrapping when squeezed (it wrapped to two lines in the founder's screenshot) | Fixed: `nowrap` with an ellipsis; icon only from 900 to 1099px |
| S2 | Page column | 1180px on most pages, 1320px on Projects: 655px margins each side at 2560 and pages not sharing an edge | Fixed: one token, `--v3-page-w`, 1320px |
| S2 | Below 900px with the rail saved | The drawer hid its labels (the rail's rules applied inside the drawer) | Fixed: the drawer ignores the saved rail |
| S2 | Dark, chips and badges | Accent text on its own tint 3.7 to 4.05:1 (Active, Owner, Your plan, avatars); danger text on a selected row 4.2:1; In review pill 4.47:1; late chip 4.49:1 | Fixed: tone-text tokens; dark `--v3-accent-text` `#aaa7f8`, `--v3-danger-text` `#f48f93` |
| S2 | Light, chips | On track 3.96:1, Can be noisy 4.03:1, success icons 2.9:1, link kind icon 2.93:1 | Fixed: tone-text tokens; `--v3-kind-link` `#0c8c98` |
| S3 | My tasks | Unchecked ring on `--v3-border-strong`, under 3:1 | Fixed: `--v3-control-border` |
| S3 | Command palette | Current tag 3.95:1 light, 4.23:1 dark | Fixed |
| - | Sidebar, "Initial setup > Initial setup" reported from production | Not reproduced on a correct build in review mode: one label and its chevron, folded and open | Open: needs the screenshot or a signed-in look once production's CSS is right |
| - | Analytics bar value, My tasks tick | Audit false positives (a label above its bar; a tick that is transparent until done) | No change |

## Capture record

The screenshots are not in this repository (the release operator's diff buffer). They are in the design lab repository under `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-05-production-review/`:

- `before/`: a production build of `6cd2d1d9`. 374 PNGs and `audit.json`.
- `after/`: a production build of `84994388` (this branch before the build guard and two small contrast fixes; the app code that differs after it is one avatar colour and one palette tag). 372 PNGs and `audit.json`.

Names are `<route or state>--<width>-<theme>-<sidebar>.png`: 15 routes and each Settings tab at 2560, 1920, 1440 and 390; light and dark; sidebar open and collapsed; Initial setup folded and open; the New menu, Apps launcher, account menu target and command palette; the phone drawer. Before and after pairs share a name. `audit.json` holds, per shot, the resolved theme, the page column, the search trigger's size, every text or icon under AA and every card-like surface without a visible step.

Limits, stated plainly: review mode has one sample project and no sign-in, so nothing here was seen on the founder's account. The account menu did not open under automation in either set. Rail hover and focus were not captured as images; they are in the stylesheet and the focus ring is covered by the shell's `:focus-visible` rules. Not every one of the 746 images was opened by eye: the audit covers all of them, and Home, Tasks, Analytics, Notes, Settings and the phone layout were looked at in both sets.

## Registry refresh and receipts

Two registered sources changed, both loading skeletons taking the shared column width.

| Entry | Why | Receipt in `receipts/` |
|---|---|---|
| `tasks.state.app-project-loading` | 1180px branch now uses `--v3-page-w` | new hash `0682055fb87b5a68` |
| `tasks.state.app-tasks-loading` | 1180px now `--v3-page-w` | new hash `fa1c4e6a0ec76613` |

Schema `signal-materiality-review/2`, written by `pnpm experience:review` against the attestation `experience/evidence-runs/tasks-playwright-80b2f4d0f1c10e2ab2461d63-ea3946f98929a628.json`: 132 of 132 on a demo-mode production build of `6052d8c7`, port 4342. No mapped critical fixture changed, so `experience:fixtures:write` was not needed. The linked case is suite regression context; it does not hold a loading state on screen.

The first critical run on this branch was 128 of 132: `/app/import` failed axe colour contrast at all four sizes, the white-on-brand defect above, visible now that the capture renders dark. It was fixed and the run repeated in full.

## Checks

Run on this worktree, Windows, on `6052d8c7` unless a row says otherwise. Every browser row ran against a production build (`next build`, then `next start`), never `next dev`.

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed |
| ESLint on the changed files | Passed, no errors |
| `theme-resolver.test.ts`, `preferences-theme-allow-list.test.ts`, `appearance-radiogroup.test.ts` | 47 of 47 |
| `pnpm test:suite-url-and-switcher` (navigation contract, shell-nav, launcher catalog) | Passed |
| `pnpm test:floor-theme`; Projects console and hub model tests | 11 of 11; 26 of 26 |
| Module boundaries, tap-target scale, suite switcher contract, first-contact language | Passed |
| `node scripts/check-v3-tokens.mjs` (compiled) and `--built` | Passed here and on Linux CI (run 37354734242): 67 tokens defined, three blocks present, none used and undefined. Fails on production's stylesheet: 67 of 67 missing |
| `experience:self-test`, `experience:fixtures` | Passed; 37 of 37 mapped |
| `next build`, demo mode | Passed |
| `experience:test` critical capture | 132 of 132 (128 of 132 before the white-on-brand fix) |
| `experience:validate` | Two expected failures before the receipts (the two loading skeletons); clean after them. `attest --verify-receipts` passed |
| `pnpm test:settings-hydration`, now with the built-CSS gate and `shell-surfaces.spec.ts` | 7 of 7 |
| `pnpm test:recipient-context:browser` | Passed, including the Projects console, 225 checks in light and dark |
| `experience:test:timeline-switcher` | 8 of 8 |
| `test:notes-recovery:browser`, `test:project-recovery:browser`, `experience:council:prepare`, `experience:council:ci` | Passed. The council step reports no 9.5 claim, as designed |
| `test:event-export:browser` | **Failed here, three times**, with `EPERM: operation not permitted` writing its own downloaded `*-account.json` files under `experience/output/` (a different file each time). It bundles the profile export component, which this branch does not touch. Not resolved locally; CI is the judge |
| Full `pnpm test` | Not run locally in full. Linux CI ran it on `d789a7f9` (Verify Tasks, success), before the last three commits |
| Re-shoot of the matrix | Done on `84994388`; see the capture record |
