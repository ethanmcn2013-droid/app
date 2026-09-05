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

The principal's declared invocation reached all 80 checks at `50918cdc` but then threw because `FLOOR_THEME_BEFORE` was unset. That failed run remains preserved at task output `outputs/recipient-project-work/floor-theme-50918cdc`; its receipt must not be promoted to a pass. This follow-up changes tooling and retains evidence only, with no runtime CSS/component or package/CI edits.

The normal command now loads `experience/reviews/january-recipient-2026-09-05/floor-theme-e2e4a0c8-before.json` directly from the checkout. This is an exact copy of the original `outputs/recipient-project-work/floor-theme-repair/before/receipt.json`, not a renewed capture. Its raw SHA-256 is `4d676b6f51493caa992a6074d66b268336ee636b530d30ea5e8ad11df57f1aa3`. The gate pins that same **LF-normalized SHA-256**, allowing only Git checkout CRLF differences. It additionally requires `head` and `cssBaselineRef` to equal `e2e4a0c8864408938529ccb8caf2d8e831481669`, `baseline: true`, and the original `status: "failed"`. Its historical contrast failures remain failures; only its measured geometry is the comparison reference.

Run from App root with no `FLOOR_THEME_BEFORE`:

```sh
node experience/recipient-project-work/floor-theme-browser.mjs
```

For a fresh local evidence directory, set only `FLOOR_THEME_OUTPUT`. The default destination remains `experience/output/recipient-project-work/floor-theme/after`, and existing receipts are never overwritten. An optional `FLOOR_THEME_BEFORE` directory must contain `receipt.json` with exactly the same pinned normalized bytes and expected identity; an arbitrary new after/baseline run cannot become the oracle. Normal execution uses the current Git HEAD for provenance but needs no historical Git objects. `--baseline` remains a separate diagnostic mode requiring the old CSS objects.

Baseline validation runs before bundling or launching Chromium. Every original geometry equality and text/UI contrast threshold remains enforced. The result records the retained baseline identity separately from the new result. Any thrown validation, build or browser error records `status: "failed"` and its error before propagating the nonzero exit. Browser and server cleanup are attempted on failure; cleanup failure is recorded without hiding an earlier gate error.

The bounded verification ran the actual normal command with `FLOOR_THEME_BEFORE` removed: **68 Floor +12 Project checks passed**, including unchanged geometry. Three subsequent explicit invalid-baseline controls (changed geometry, wrong HEAD, rewritten passed status) each exited1, saved a failed receipt, and stopped before bundling. Syntax and focused ESLint passed. Logs and the replay helper are retained under task output `outputs/recipient-project-work/floor-baseline-gate-repair`. These are verification-tooling checks, not a provider/security review, a full Next run or receiving Linux acceptance. Parent owns final integration and invocation registration.
