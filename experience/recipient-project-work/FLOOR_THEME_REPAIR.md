# Floor and mobile Project-strip contrast

Base: `e2e4a0c8864408938529ccb8caf2d8e831481669`. The recipient branch fast-forwarded cleanly to that candidate. This is a color-role correction; layout, navigation, provider/auth behavior and the global DS token definitions are unchanged.

The Floor master now distinguishes its outer ground from content ink. In dark mode the ground follows canonical `--paper`, secondary ink and surface washes derive from canonical `--ink`, on-chrome text follows the light foreground, and accent labels/focus use the existing App accent roles. The Undo strip uses the same ground role so its text does not invert onto a light background. The unchecked control uses the existing 62% ink step instead of the decorative 28% step. The interactive More control keeps its declared on-chrome ink after the shared button reset. Light layout and concept are preserved; those two demonstrated light interactive contrast failures are intentionally corrected.

The mobile Project trigger inherits content ink on its paper strip at the control's existing 767px breakpoint. Desktop chrome retains its original roles. No control logic changed. This reproduces the source-backed cause of the parent's `tasks.page.app-my-tasks-stale-a-390.png`; it is not an inferred fixture-only mismatch.

## Generator preservation

The generator now treats keyframe steps as animation syntax, preserving the five corrected programs from `0562baeb` rather than emitting `.root from` or `.root 0%`. Its output is deterministic across LF/CRLF and supports a read-only `--check`.

Regeneration also exposed existing generated-only rules for mobile density and desktop fit-columns. They were restored to the master/generator without changing their production meaning. Tests compare all 252 canonicalized layout-rule declarations to the frozen candidate and verify the exact five keyframe programs. The final stylesheet has no unrelated substantive layout change. The unit oracle is recorded locally in the test so a shallow Linux CI checkout does not require historical Git objects.

## Commands and results

Run from the App worktree:

```sh
node scripts/design/extract-floor-css.mjs --check
node --test scripts/design/extract-floor-css.test.mjs
corepack pnpm typecheck
corepack pnpm exec eslint scripts/design/extract-floor-css.mjs scripts/design/extract-floor-css.test.mjs experience/recipient-project-work/floor-theme-browser.mjs
node scripts/check-module-boundaries.mjs
git diff --check
```

All pass; the focused unit suite is **6/6**. Parent registration needed: `node --test scripts/design/extract-floor-css.test.mjs` plus the read-only parity command if desired. No package, CI or registry edit is included.

The browser fixture requires the existing Playwright Chromium and pinned dependencies. Use fresh output directories. The following commands record the **original historical execution**, not a prerequisite for the normal gate. Explicit `--baseline` mode reads the two CSS blobs from the frozen base without changing any checkout; a new diagnostic capture does not replace the pinned original receipt.

```powershell
$env:FLOOR_THEME_OUTPUT='experience/output/recipient-project-work/floor-theme/before-final-verified'
node experience/recipient-project-work/floor-theme-browser.mjs --baseline
$env:FLOOR_THEME_BEFORE=$env:FLOOR_THEME_OUTPUT
$env:FLOOR_THEME_OUTPUT='experience/output/recipient-project-work/floor-theme/after-final-verified'
node experience/recipient-project-work/floor-theme-browser.mjs
```

Before mode records demonstrated failures and completes successfully as a reproduction. The final mode requires every in-scope check to pass and compares measured Floor geometry to the baseline. Results: **68 Floor checks** in four light/dark × desktop/mobile cases, and **12 Project-trigger checks** in verified/pending/archived × light/dark × desktop/mobile states. There are 20 screenshots per side (Floor rest/completed plus trigger states). Hidden controls are excluded, not called failures or passes. Interactive non-text UI uses a 3:1 threshold; text uses 4.5:1. Decorative marks and the brand wordmark are not certified as interactive controls.

| Measured element | Before | After |
| --- | ---: | ---: |
| Dark inactive navigation | 1.06:1 | 7.03:1 |
| Dark secondary note | 1.01:1 | 9.27:1 |
| Dark unchecked control | 1.01:1 | 7.06:1 |
| Dark milestone label | 2.89:1 | 6.10:1 |
| Light mobile Project name | 1.14:1 | 18.88:1 |
| Light mobile pending Project name | 2.53:1 | 10.44:1 |

The browser executes actual FloorWorkspace, FloorBoard, LabStoreProvider/reducer and active-project control source against synthetic task/context prerequisites, with the actual global/module CSS and local Geist fonts. It performs completion, Undo and keyboard focus. Next navigation, suite/project context and completion notifications are explicit adapters; the Project-strip fixture is the actual control in its two surface contexts, not a full My Work route. Color measurements composite computed alpha colors over ancestor backgrounds. All fixture listeners/servers close at the end. No parent server/build was reused or changed.

## Limits and parent follow-up

No full Next/Clerk session, provider, database action, physical-device test, final route capture, registry adoption or human comprehension is claimed. The saved parent screenshot is preserved separately as before evidence; after screenshots are this narrower actual-component fixture. Parent should capture the final composed `/app/tasks` and `/app/my-tasks` in light/dark on desktop/mobile, including the mobile Project label, Floor navigation, secondary text, unchecked/checked states, completion receipt and keyboard focus. The structural 68-route and 132-built checks alone are not contrast acceptance.

The Impeccable detector ran once and exited 2 in degraded regex mode because its HTML parser dependencies are unavailable. Its two warnings are the same pre-existing `transition: margin-right` rule in the master and generated CSS. That rule was verified in the base and left unchanged; this is not a clean detector-audit claim. Early fixture setup failures (missing browser `process.env` and eager theme assignment) were corrected in the fixture only and are retained as setup evidence, not product findings.

No RC-3 review was retried. Parent owns composition, final build/captures, greeting changes, commercial-copy integration, package/CI/registry and canonical HQ.

## Self-contained normal gate — 5 September follow-up

Historical first repair at `9b236a26`: the section below records its Windows proof. Its cross-platform geometry comparison is superseded by the same-browser method in the next section; the later Linux failure is retained, not counted as a pass.

The principal's declared invocation reached all 80 checks at `50918cdc` but then threw because `FLOOR_THEME_BEFORE` was unset. That failed run remains preserved at task output `outputs/recipient-project-work/floor-theme-50918cdc`; its receipt must not be promoted to a pass. This follow-up changes tooling and retains evidence only, with no runtime CSS/component or package/CI edits.

The normal command now loads `experience/reviews/january-recipient-2026-09-05/floor-theme-e2e4a0c8-before.json` directly from the checkout. This is an exact copy of the original `outputs/recipient-project-work/floor-theme-repair/before/receipt.json`, not a renewed capture. Its raw SHA-256 is `4d676b6f51493caa992a6074d66b268336ee636b530d30ea5e8ad11df57f1aa3`. The gate pins that same **LF-normalized SHA-256**, allowing only Git checkout CRLF differences. It additionally requires `head` and `cssBaselineRef` to equal `e2e4a0c8864408938529ccb8caf2d8e831481669`, `baseline: true`, and the original `status: "failed"`. Its historical contrast failures remain failures; only its measured geometry is the comparison reference.

Run from App root with no `FLOOR_THEME_BEFORE`:

```sh
node experience/recipient-project-work/floor-theme-browser.mjs
```

For a fresh local evidence directory, set only `FLOOR_THEME_OUTPUT`. The default destination remains `experience/output/recipient-project-work/floor-theme/after`, and existing receipts are never overwritten. An optional `FLOOR_THEME_BEFORE` directory must contain `receipt.json` with exactly the same pinned normalized bytes and expected identity; an arbitrary new after/baseline run cannot become the oracle. Normal execution uses the current Git HEAD for provenance but needs no historical Git objects. `--baseline` remains a separate diagnostic mode requiring the old CSS objects.

Baseline validation runs before bundling or launching Chromium. Every original geometry equality and text/UI contrast threshold remains enforced. The result records the retained baseline identity separately from the new result. Any thrown validation, build or browser error records `status: "failed"` and its error before propagating the nonzero exit. Browser and server cleanup are attempted on failure; cleanup failure is recorded without hiding an earlier gate error.

The bounded verification ran the actual normal command with `FLOOR_THEME_BEFORE` removed: **68 Floor +12 Project checks passed**, including unchanged geometry. Three subsequent explicit invalid-baseline controls (changed geometry, wrong HEAD, rewritten passed status) each exited1, saved a failed receipt, and stopped before bundling. Syntax and focused ESLint passed. Logs and the replay helper are retained under task output `outputs/recipient-project-work/floor-baseline-gate-repair`. These are verification-tooling checks, not a provider/security review, a full Next run or receiving Linux acceptance. Parent owns final integration and invocation registration.

## Same-browser CSS geometry comparison — Linux follow-up

The principal's App Design run at `313` passed three React cases and 68 route cases, then failed the Floor comparison. Its reported 1280px/light dock was `x:489.265625,width:383.46875`; the retained Windows dock was `x:489.4375,width:383.125`. Every other reported rectangle matched. This is an observed platform difference, not a proven font or browser root cause. The original log remains `work/app-313-design-linux-failure.txt`; a byte-identical copy accompanies this repair's output. The original missing-baseline failure and the failed Windows receipt are also retained unchanged.

The normal gate now renders **both CSS versions in one Chromium instance and environment**, through the same actual component fixture. It first uses the two original `e2e4a0c8864408938529ccb8caf2d8e831481669` stylesheet blobs, then current CSS. Both passes retain all existing contrast/behavior measurements; current CSS must still pass all 80 checks. Complete layout objects still use strict `assert.deepEqual`, including the content-sized dock. There is no tolerance, rounding, rectangle omission or new platform baseline.

The original stylesheet blobs are tracked under `experience/reviews/january-recipient-2026-09-05/floor-theme-e2e4a0c8/`. Their raw source bytes were copied directly from the immutable Git objects and verified against the original Windows receipt's `sourceInputs`. The runtime pins the following LF-normalized SHA-256 values (equal to the original raw hashes):

| Retained asset | Original source | SHA-256 |
| --- | --- | --- |
| `floor.module.css` | `src/components/floor/floor.module.css` | `9b5beabbb2622d1d897b5aa4ef8eb00f1d9dec734b6ae48a71ea107e0e0f3879` |
| `active-project.module.css` | `src/components/studio-bar/active-project/active-project.module.css` | `f821094c3483be7423ab5cff09421f3154c7a1629f51617af9fa69c43ad7c040` |

The old Windows receipt retains its pinned hash, head, CSS identity, `baseline:true` and `status:"failed"`. It establishes historical provenance and original CSS identity; its platform-specific coordinates are not today's numerical oracle. A new `comparison-before/receipt.json` and screenshots record the original-CSS render in the current environment, explicitly separate from `historicalBaseline`. Its failing contrast is not approved (`acceptance:false`). `geometryBaseline` points to this same-browser comparison. Current and original passes must also have identical fonts, global CSS, style dependencies, non-CSS source inputs, themes and viewports before strict layout equality is considered.

Invocation remains `node experience/recipient-project-work/floor-theme-browser.mjs`, with a fresh optional `FLOOR_THEME_OUTPUT` and no `FLOOR_THEME_BEFORE` required. An explicit `FLOOR_THEME_BEFORE` still validates the same immutable historical receipt; it cannot replace either pinned CSS source. `--baseline` now renders the retained static styles as a diagnostic only. Neither mode loads historical Git objects; current HEAD is recorded using `git rev-parse HEAD`.

This is CSS comparison in a shared environment, not a claim that every component change preserves historical layout. No runtime styles/components, package, registry, CI invocation, principal checkout or final capture changed. Windows and intentional compiled-CSS geometry-mutation results are retained under `outputs/recipient-project-work/floor-same-browser-gate-repair`; principal Linux CI remains the receiving proof. No provider or security review is claimed.

Observed on Node22.23.2 / Chromium149.0.7827.55 / Windows: the normal command with `FLOOR_THEME_BEFORE` unset passes all80 current checks and strict layout equality; the fresh original-CSS comparison retains failed contrast status. A scratch esbuild loader then adds only `margin-left:1px` to the current compiled dock, leaving repository CSS and the original-CSS pass untouched. All80 current checks still pass, but strict equality refuses `x:490.4375` versus `489.4375` and records a failed receipt with exit1. Syntax and focused ESLint pass. The staged diff check reports the original Floor CSS asset's blank line at EOF; its bytes are deliberately retained to preserve the required historical hash. No Linux rerun or root-cause finding is inferred from this Windows evidence.

## Floor calendar repair — 5 September

Base: `07d25138a965b95b6d10349e90d38bdcb2f0e7fd`; branch `fix/january-floor-calendar` in the existing dependency-equipped recipient worktree. The previous `fix/january-recipient-project-work` branch remains at `2123c595fb1af955fa225fe1513e0858d1625415`. This is the delegated bounded follow-up to the read-only date investigation, with user hooks preserved.

Floor's header, counts, card labels and Today/Overdue filters now consume the existing RoomBrief calendar frame. The project calendar day is used for date-only schedules; completed timestamps are converted to that frame's timezone before formatting. Invalid or absent completion timestamps produce no date fact. Completion and milestone precedence, range due dates and the existing label grammar are preserved. The obsolete client-mount date gate and once-only clock memos are removed. Updating the provider updates every Floor date fact; advancing the wall clock alone leaves the request snapshot consistent. No midnight service, new calendar authority, MyWork-selector change, CSS/master/generator change or wedding-date source change is included.

The original investigation remains at projectless task output `outputs/floor-calendar-07d25138/`: six actual-component observations plus a completion-timestamp probe. Its defects remain recorded as defects. It reproduced demo drift, project-day classification errors, UTC-midnight React hydration recovery, stale dates after a provider update and a completion-timezone error. The same-instant timezone-only control did not produce hydration recovery. No original fixture or historical baseline was rewritten.

The existing contrast fixture now supplies a real `RoomBriefProvider` with an explicit **review** frame for its existing January 21 scenario. Both original/current CSS passes receive that identical prerequisite. Its synthetic task dates, clock override, all 80 checks, strict full-rectangle equality, pinned original CSS bytes and failed historical Windows receipt are unchanged. This prevents the isolated July fallback from silently changing which contrast states the January fixture exercises.

### Reproducible commands and observed gates

From this App worktree, with existing pinned dependencies and Playwright Chromium:

```sh
node --test experience/recipient-project-work/floor-calendar.test.cjs
node experience/recipient-project-work/floor-calendar-browser.mjs
corepack pnpm test:calendar-truth
corepack pnpm test:floor-theme
corepack pnpm typecheck
corepack pnpm exec eslint src/components/floor/floor-board.tsx src/components/floor/floor-workspace.tsx src/components/floor/use-floor-place.ts experience/recipient-project-work/floor-calendar.test.cjs experience/recipient-project-work/floor-calendar-browser.mjs experience/recipient-project-work/floor-theme-browser.mjs
node experience/recipient-project-work/floor-theme-browser.mjs
git diff --check
```

Browser commands require fresh destinations. Set `FLOOR_CALENDAR_OUTPUT` and `FLOOR_THEME_OUTPUT` when retaining another run; neither fixture overwrites an existing receipt. No `FLOOR_THEME_BEFORE` is required. The normal gates need no historical Git objects. The new date suite imports the shared fixture builder without launching Chromium.

| Gate | This implementation's result |
| --- | --- |
| Exported date-function tests | **26/26**: due/range/milestone/done precedence, missing/invalid completions, UTC offsets, repeated DST hour, spring/fall/calendar boundaries, pinned demo and no live-clock reads |
| Actual calendar component browser | **16 cases /196 assertions** at 390×844 and 1280×900; 18 screenshots and six SSR HTML artifacts |
| Calendar truth | **16/16**, plus existing Hybrid calendar scanner |
| Floor theme | **6/6**, plus unchanged master/generated CSS parity |
| Typecheck / focused ESLint / diff whitespace | Pass |
| Normal paired theme browser | **68 Floor +12 Project checks**, strict geometry equality; fresh original-CSS comparison and historical baseline both retain failed contrast status |

Calendar browser cases execute actual FloorWorkspace/FloorBoard, RoomBriefProvider, LabStoreProvider/reducer, React SSR/hydration and global/module CSS. They cover a demo frame against a different wall clock, project days ahead/behind UTC, timezone-only and UTC-midnight hydration, DST hydration, provider day/timezone updates without remount, stable snapshot without a new frame, and Today/Overdue/intersected/cleared filters. Milestones and completed tasks remain excluded from due-today counts. Request navigation, suite metadata and completion notifications are explicit adapters; tasks are isolated synthetic prerequisites.

Evidence: `outputs/floor-calendar-repair/browser-final/receipt.json`, `theme-paired/receipt.json`, `theme-paired/comparison-before/receipt.json`, and `gates/` in the projectless task output. The first new browser run failed because the fixture omitted the real caller's Planning callback and incorrectly expected an undated button. That **fixture setup** failure is retained separately at `browser-initial/receipt.json`; supplying the callback and checking the actual `with no date` label corrected it. This was not an additional runtime defect.

Principal registration needed: the two new commands at the top of this section, respectively in the default test gate and browser/design gate. No package, CI, broad route-browser or registry edit is included. Existing material surface remains Tasks Board; header dates also surround List/Schedule/Calendar through the same FloorWorkspace. Final composed route source hashes/captures belong to principal and must be renewed rather than reusing the old receipt.

This is Windows component and tooling evidence, not a new Linux result or full Next/Clerk/provider acceptance. No real stores, production mutations, external provider calls, physical-device or human-comprehension proof are claimed. Council certification and the held independent/receiving reviews remain separate. Neither stopped RC3 nor Atlas work was retried or rerouted.
