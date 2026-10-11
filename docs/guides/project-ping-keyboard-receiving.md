# Project Ping keyboard and recovery check

This guide records a narrow browser check for keyboard use and recovery in the isolated Project Ping fixture. It does not establish general accessibility conformance or readiness for real users. The owner-run evidence below is pinned to source `0205c23a4f13af86921bcf6d97e08bd45866ed7f`; the receipt was captured at base `7c3397de2e2e8932278439a12c2b9ed48f60ccde` before commit, then all 103 normalized source-input hashes were re-attested unchanged at the frozen source SHA. This is not independent receiving; root's integrated candidate still requires its own receiving.

## Run the check

Use the existing `experience/ping-voice-tasks/browser.mjs` receiving harness and its real Tasks provider/selection fixture. Keep the fixture synthetic. Preserve its receipt, SQL, executor-call and canonical-task assertions. Do not add a second harness or replace a native browser behavior with a stub and label it native evidence.

The owner-run command was `node --import tsx --import ./src/test/register-server-only.mjs experience/ping-voice-tasks/browser.mjs`. Its exact receipt is `experience/output/ping-voice-tasks/2026-10-06T07-01-27-004Z/receipt.json` in the source worktree. The receipt records 10/10 groups passed, three executor calls and three receipts. A separate source attestation rechecked all 103 normalized source-input hashes at the frozen SHA.

### Keyboard completion and recovery

1. Start the fixture with the exact build and test command recorded in the receiving artifact. Use the existing task row's supported roving-keyboard interaction to select the task, then Tab and Shift+Tab to reach typed Review/Apply and voice Start, Finish and Cancel. Activate native buttons with Enter or Space. Do not assume a row checkbox with `tabIndex=-1` is itself a Tab stop, and do not use `click()` for these actions.
2. Record the active element, its accessible name, disabled/connected state and visible focus treatment before and after each transition. In particular, observe what receives focus when Apply, Finish, Check original or Refresh current Tasks disappears. Do not assume that focus returning to `body` is useful, and do not move focus away from a user-controlled location while an operation is pending.
3. Complete one typed operation and one voice operation. Keep the existing exact executor-call count, one receipt per committed original and canonical rendered task checks. For original-result recovery, lose the Finish response after the executor has run, reload, then use **Check original** and **Refresh current Tasks** with the keyboard. Verify the same original command/receipt, unchanged executor and receipt counts, and current rendered row. Repeat recovery and confirm it does not invoke execution again.
4. Record each case's final result from the browser receipt: source SHA, case label, active-element observations, executor/receipt counts, SQL/canonical result, and any console or assertion failure. A polite `role="status"` and a clean axe run do not prove that assistive technology announced the update.

In the pinned owner run, keyboard activation covered Ping controls after task selection was prepared by the existing fixture helper. Finish, Check original and Refresh returned focus to a connected, enabled local control; typed Apply handed off to Check original, and acknowledged untouched Cancel returned focus to the typed input. When focus was deliberately moved to that input during a held Cancel response, the response preserved the user's new focus. The receipt observed visible 2px solid focus outlines without adding a preferred-style requirement. The panel axe check reported zero violations. The task-selection helper means this run does not claim that selecting a task itself was keyboard-only.

The same run covered lost Finish response followed by reload and original receipt recovery, failed refresh and later canonical repair, a held Begin with A→B→A selection change, Cancel during interpretation, and paused typed/voice refusal. Its fixture assertions recorded three actual executor calls and three receipts; they are construction evidence, not usage or real-user results.

### Native microphone permission denial

Use a separate browser context without the harness's automatic microphone grant. Deny microphone access through the installed browser's permission control, then verify the effective permission state and the native `getUserMedia` rejection from the browser artifact. Start the mounted panel using the keyboard. Record the terminal status and whether Cancel or retry remains reachable.

A server original may already exist when permission is denied. Reconcile or cancel that same original; do not mint a replacement to make the interface look idle. Verify zero uploaded PCM frames, commit/model calls, executor calls and receipts. If the runner cannot enforce and attest a real browser permission denial, mark this case **not run**. A mocked rejection is useful unit evidence but is not native permission evidence.

In the pinned owner run, full Chromium with context-specific CDP denial reported permission `denied`; the native request made one call and rejected with `NotAllowedError`. The same original was canceled, with zero upload, commit, model or execution. An earlier headless-shell attempt returned `NotSupportedError`; that is retained as a failed fixture observation, not a denial pass. The passing result came from installed full Chromium without an automatic microphone grant or a rejecting `getUserMedia` stub.

### Synthetic session-storage failures

These are controlled fixture faults, not browser storage security guarantees. Inject failure only for the existing scoped session-storage marker and record that the failure was injected.

1. Fail marker persistence at voice Start. Verify that no microphone capture or audio/model/executor work begins. Reconcile or Cancel the captured original and verify that keyboard retry remains available.
2. In a separate original, allow Start and capture, then fail only the marker update at Finish. Verify that no Finish/control request, commit, model or executor call follows. Cancel the same untouched original and verify keyboard controls remain usable. Restore storage before closing the fixture.

Do not clear an unknown original or claim rollback from a local abort. If storage behaves differently from the injected fixture path, report that case separately rather than broadening the test seam.

Both scoped synthetic storage cases passed in the pinned owner run. Start refusal performed no capture/audio/model/executor work and the same original required acknowledged `not_invoked` Cancel before a fresh Start identity could be used. Finish refusal sent no Finish, model or execute call; keyboard Cancel settled that same original. The storage retry case previously caught retired request-identity reuse; the final source only clears that retry identity after same-original authenticated `not_invoked` acknowledgement and current scope checks.

## Reading results

Attach the exact browser receipt and source SHA beside each observation. Separate keyboard completion, permission denial, storage-start failure, storage-Finish failure and original-result recovery; one passing group cannot stand in for another. Preserve failed first attempts and distinguish a test assertion from an observed user-facing status. Keep transcript text, task content, tokens, command hashes, actor/session identifiers and credentials out of shared logs.

The current protocol treats timeout, missing response or an absent receipt as unresolved unless authorized original-command evidence says otherwise. Never press Finish again, create a replacement command or infer that a physical executor/provider call stopped. Keep the original identity and use its authenticated recovery path. A denied status/receipt remains denied; do not switch identity or Project to work around it.

## What this check cannot establish

Keyboard behavior in one Chromium fixture does not establish human screen-reader usability, speech output quality, WCAG conformance, real-device microphone behavior, Safari/mobile compatibility, genuine Clerk identity, provider recognition quality or end-to-end latency. A scripted transcription provider is not a real provider evaluation. The CDP-controlled denial exercised the browser's native permission path in a controlled context, but does not test a user's hardware or a deployed permission experience; storage failures were synthetic injections. Real assistive-technology and device testing, provider/privacy review, authenticated pilot, spend controls, rollout/rollback and operating handoff remain separate evidence and gates.
