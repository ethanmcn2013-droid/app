# Synthetic assistant stress evidence

The owning harness is `src/server/ping/assistant/stress.test.ts`. Its default invocation creates 100 independent Node test processes, each running one numbered scenario against a fresh file-backed SQLite database. The parent checks every exit code, zero failures and skips, each exact ID, and 100 unique completed scenario IDs before emitting `summary.json`.

Run from the repository root:

```powershell
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/ping/assistant/stress.test.ts
```

Set `PING_ASSISTANT_STRESS_OUTPUT` to retain each child log and the aggregate summary in a chosen synthetic evidence directory. The optional `PING_ASSISTANT_STRESS_RANGE=1:1` runs only that bounded child range; it does not establish a 100-scenario result. `assistant-stress-summary.mjs` independently reads one complete isolated-process directory and rejects incomplete or duplicate evidence.

Coverage includes task creation up to 100, archive and exact restore up to 100 (including 90), field edits, draft/apply, cancellation, revoked membership and account-erasure fences, foreign selection, committed lost-response recovery, request conflicts, comments, chat, nudges, clarification, selector refusals, invitation transport outcomes, read/navigation actions, unpublished Timeline preparation, concurrent duplicate submissions, and project/create/open chains.

Fixture time is pinned to 2026-10-18 09:00 UTC; service durations use `performance.now()`. Reported spans include service operations and scenario SQL assertions, and exclude database creation/migrations. They are local synthetic server spans, not browser or provider latency. Planner output is scripted structured data; transport and Timeline preparation are injected. No model-quality, real delivery, real authentication, production performance, or publication claim is made.

Failed attempts are retained:

- `attempt-1-native-exit.log`: initial unbounded process stopped after 54 passing cases with child exit 3221225477 (`0xC0000005`), without a JavaScript assertion or stack. No native cause is attributed. The initial source was extended before the bounded run; this is preserved failed evidence, not a final-source pass.
- `attempt-2-nested-runner-marker.log`: the new runner initially inherited Node's internal test-worker marker, so Node refused to start nested `--test`; the parent rejected the missing child evidence. The harness now removes only that marker from the fresh child's environment.
- `batch-01.log`: a standalone ten-case probe, not counted again in the final aggregate.
- `attempt-3-parent.log` and `final-attempt-3/`: ten-case process isolation reached all 100 cases, with 95 passing and five simultaneous duplicate-submit cases failing `SQLITE_BUSY` at `createRun`. The parent correctly failed; the later production admission fix does not regrade this attempt.
- `attempt-4-fixed-concurrency.log`: the production admission helper passed all five concurrency cases and two project chains, then the process exited `3221225477` without a JavaScript stack. Ten-case isolation was insufficient; the final runner isolates each case.
- `attempt-5-parent.log` and `final-attempt-5/`: single-case isolation reached 16 zero-exit children. Case 17's scenario and summary assertions passed, then its test process exited `3221225477` during shutdown; the parent correctly failed and stopped. Single-case isolation did not establish a native runtime fix. No 100-scenario pass is claimed.

The final attempt is distinct from all probes and failures. Its result must be read from its own terminal parent log and 100 child logs; an incomplete directory establishes no full-suite pass. The local native-client process boundary does not qualify a remote production database runtime.
