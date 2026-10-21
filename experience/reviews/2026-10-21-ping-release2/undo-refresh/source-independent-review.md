# Independent review: Ping Undo task refresh

Date: 2026-10-21
Reviewer: `/root/r2_independent_review`

## Verdict

**Conditional approval of the narrow source fix.** At candidate `a1bbfa1daab3b70d735c722600350bb561c0c1ac`, changing the post-Undo refresh call from `operation: "read"` to `operation: "undo"` is the correct minimal fix. The refresh helper already has a guarded Undo path that emits the task snapshot invalidation only after a confirmed, completed, reversible task step has been reverted. This avoids treating an Undo response as an ordinary read, which was ignored by the helper.

The product line is bound to Git blob `af8863c9cbbc893b5502e112acf1fb50fa624da3b096f0bd7b2d53ef1eb8f922`; the candidate updates the critical-fixture and registry materiality hashes to this source. The receiving-script change adds an assertion that the event is emitted exactly once and separately verifies the fixture database rollback. It observes the event at the browser window; it does not mount the actual Tasks board or prove that a visible board refreshes without reload.

## Evidence and limits

- Focused client checks: 34/34 passed; typecheck and scoped lint exited 0. No provider calls. Evidence: `undo-refresh-capture/focused-checks-a1bb.json` (SHA256 `8f5d213811b9ac40736cd27d69beaf849624b0f63babcd7904cf76ad20d10f4b`).
- Broad local test run: 201/201 passed, including 100 isolated synthetic SQLite scenarios. The available record is a summary of tool output, not raw stdout (`broad-test-session-63929-summary.txt`, SHA256 begins `78f80f43`). Treat it as supporting test evidence, not a substitute for hosted CI.
- The overall synthetic receiving attempt remains **failed**: 12 checks and 9 screenshots were recorded before a later unrelated DM-source submission failed with connection refused/timeout. The scoped Undo assertions passed: exactly one invalidation event was observed and the synthetic database showed the task rollback. Preserve the failed-run status; do not call the full receiver green or claim visible board refresh from it. Failure receipt: `current-functional-undo-refresh-oct21/release2-failure.json`, SHA256 `a5297d9086c533b5be0f5bb7856f9db600d79dae90ff36e72b4bd5f7d29e5aec`.
- At review time the new candidate capture and required Verify/Design gates were pending, and Design had a stale-attestation failure. That is an evidence-binding/requalification blocker, not a reason to reject the one-line product fix. Candidate eligibility requires a fresh exact-head capture/rebind and all required CI checks green.

## Acceptance boundary

This review approves the code direction and the scoped synthetic Undo-event/database evidence only. Final acceptance still requires a real signed-in production-board canary after deployment: observe the owned task count move 2 → 3 → 2 immediately, without reload, and confirm no unrelated task changed. Until that receiving check succeeds, the visible-board behavior is unverified and release acceptance remains open.

No production changes, deployment, provider calls, or repository edits were made by this reviewer.