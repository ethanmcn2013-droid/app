# Template caller recovery evidence

The containing commit is the candidate; its parent is
`c163ab5897b8a1b1b1a488bfd4d183290c53084c`.
[manifest.json](manifest.json) binds the final runtime text, compiled fixture,
capture bytes and verification scope. Runtime files were not changed during
this evidence finish.

## Final existing-template confirmation

The actual OnboardingFlow component was exercised in the compiled local fixture
at `http://127.0.0.1:3146/?existing`, Chrome viewport 1920 x 897. From the initial
context step, choose **Skip this step**, then **Template loaded / Open wedding
planning**. The synthetic action rejects its acknowledgement. The same request
`3b6dbc13-d305-47f3-8597-0b82c0408a9c` and full input were then sent after **Allow
retry to succeed** and keyboard Enter on **Try again**.

- [Confirmation](existing-confirmation.jpg): existing starter ready to open.
- [Failed acknowledgement](existing-failed.jpg): original controls disabled and
  navigation unchanged; the error alert below the captured viewport is recorded
  in [the failure DOM](existing-failed-dom.txt).
- [Successful retry](existing-retried.jpg): confirmation controls enabled again.
  The fixture's explicit Project destination and both identical request payloads
  are recorded in [the retry DOM](existing-retried-dom.txt) and
  [browser result](existing-browser-result.json).

The visible synthetic starter-set count remained zero. Navigation was unchanged
after failure and became `/app/home?workspaceId=project-caller-review` only after
successful acknowledgement. The router is substituted, so the fixture itself
stays on its local URL. No browser warnings or errors were recorded.

The full-page failure screenshot timed out once; viewport captures succeeded.
Chrome returned JPEG bytes, retained without conversion as `.jpg`. Earlier
captures are PNGs. All six images are ordinary Git files, totaling 448,595 bytes;
no LFS rule or hook is added.

## Earlier component coverage

[Welcome desktop](welcome-desktop.png), [welcome mobile](welcome-mobile.png) and
[Settings desktop](settings-desktop.png) precede the final existing-template
action repair. They document template failure/retry and Settings recovery;
they are not rebound to the final confirmation source as fresh captures.
Welcome was additionally inspected at tablet and wide widths without horizontal
overflow. Settings retry retained one request; a deliberate later reseed used a
fresh request. Its domain-reset error exposed the exact recovery packet without
a generic retry button.

## Checks and reproduction

After the last runtime edits: **71 tests passed**, typecheck passed, and scoped
ESLint passed. The earlier 48 authorization regressions passed before the final
existing-template action repair; new confirmation authority/rollback/replay
coverage is included in the 71-test run. The 30 caller tests need registration
by the integration owner; package.json is unchanged here.

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/onboarding-completion.test.ts src/server/onboarding-callers.test.tsx src/lib/onboarding/retained-submission.test.ts src/server/db/apply-template.test.ts src/lib/template-anchor.test.ts src/lib/wedding-template-contract.test.ts
node --test src/server/tasks-security-regression.test.mjs src/server/actions/project-authz-contract.test.mjs src/server/projects/active-project-contract.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/server/actions/onboarding.ts src/server/onboarding-completion.ts src/server/onboarding-completion.test.ts src/server/onboarding-callers.test.tsx src/lib/onboarding/retained-submission.ts src/lib/onboarding/retained-submission.test.ts src/app/welcome/page.tsx src/components/welcome/onboarding-flow.tsx src/components/app/settings/sections/workspace.tsx scripts/check-ambient-workspace-ratchet.mjs
```

The fixture scripts below are unchanged copies of the already used capture
scripts. From the App checkout with its existing installed dependencies:

```powershell
$callerFixture = Join-Path $env:TEMP 'signal-template-caller-fixture'
node docs/guides/evidence/template-caller-recovery/build-fixture.mjs (Get-Location).Path $callerFixture
node docs/guides/evidence/template-caller-recovery/serve-fixture.mjs $callerFixture (Get-Location).Path 3146
```

Open `http://127.0.0.1:3146/?existing` for the captured confirmation,
`http://127.0.0.1:3146/` for normal welcome, or
`http://127.0.0.1:3146/?settings` for coordination changes. Stop with Ctrl+C.
No environment files are needed or copied. The local capture server was stopped
after this receipt. An authenticated final App render and combined build remain
the integration owner's separate work.

## Limits and ownership

This is component evidence with real caller source/application CSS and synthetic
actions, router, analytics, toast/dialog and surrounding layout. Browser counters
are not DB proof; the disposable database tests supply that proof. No provider,
production, authenticated Next/Clerk, full build, independent security or
quality-council acceptance is claimed. Registry coverage remains partial and the
old unrelated welcome materiality attestation was not reused as acceptance.

The lead owns the separate user-wide venue-welcome detection and contextual
redirect scope repair. Those helpers and planning code are unchanged. The
explicit URL/cookie disagreement cases pass the local route tests; fresh P2
verification remains independent. Settings whole-tab recovery and general
legacy domain-reset repair remain outside this slice; see the exact recovery
packet in [the caller guide](../../template-application.md).

## Portable runner correction

The original CommonJS runners are retained byte-for-byte as build-fixture.cjs.txt and serve-fixture.cjs.txt; manifest.json records their original names and hashes. The executable .mjs equivalents use standard ESM imports to satisfy the repository lint policy. No caller component, mock boundary, fixture content or original capture is changed by this runner correction.
