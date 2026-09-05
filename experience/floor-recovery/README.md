Floor recovery component fixture

Run from the App worktree root with its existing dependencies:

```sh
node experience/floor-recovery/browser.mjs --baseline --out=baseline-repeat
node experience/floor-recovery/browser.mjs --out=candidate-repeat
node scripts/design/extract-floor-css.mjs --check
node --test experience/floor-recovery/css-contract.test.mjs
node experience/floor-recovery/verify-evidence.mjs
```

Each browser run requires a fresh output label and returns a failing exit code for failed product assertions. The baseline loads every bundled frontend source file from immutable `4c88733fab3e0a89fff189a021e919f8c5ec492d`. Its original runner and task fixture are retained beside its receipt. Verification checks `scoped-baseline` and `scoped-candidate`, not the repeat labels.

The harness follows App's `experience/recipient-project-work/floor-theme-browser.mjs` pattern: real FloorWorkspace, FloorBoard, hooks, LabStoreProvider reducer, column/calendar models, global/module CSS and fonts. Next navigation, identity/context and the completion-notification side effect are synthetic ports. Floor uses CSS Modules; automatic Tailwind utility scanning is disabled in the fixture compiler. Global CSS imports and `@apply` still compile. Only an ephemeral loopback component bundle is served; browser and listener close in `finally`. This makes no production persistence, custom-column, physical-device or screen-reader certification claim.

Initial diagnostic runs (`baseline`, `candidate-1`, `candidate-final`) inherited the older harness's whole-checkout Tailwind scan and dependency hashing. They are preserved locally and excluded from Git, superseded by the bounded captures. No backend operation or held review was run; the overly broad automatic scan is a tooling limitation of those initial diagnostics.

CSS must be edited in `docs/design/labs/tasks-2026-08/floor.html` and regenerated with `node scripts/design/extract-floor-css.mjs`. The focused CSS contract explicitly allows the two disclosure geometry additions and verifies that all 252 earlier geometry rules retain their accepted digest. The older theme gate still expects exactly 252 total rules: principal owns reconciling that integration gate, package/CI/registry/HQ wiring and final S4 synthesis. Do not refresh its old digest blindly.

The 17 standing suite-lab findings remain source-based triage. This fixture supplies focused Floor evidence to the existing S4 register. Held Atlas/Drive/RC3 operations, backend lifecycle/authorization and the parallel Event/account-export/database lanes are outside this fixture.
