# Node 24 stress attempts: incomplete, no full pass

These are new attempts using the existing bundled Node v24.19.0 binary, not regrades of the prior Node 22 failures. Each identity record pins the actual source, runtime binary hash, harness hash, and unchanged dependency lock. No dependency was installed or downloaded.

Attempt 6 used exact source `4a7438b9`. Its first scenario passed and its child exited zero, but Node 24 selected the `spec` reporter. The unchanged parent required TAP and correctly rejected that evidence. No native crash was recorded in this attempt.

Commit `39c1b761` adds only explicit `--test-reporter=tap` to the child invocation. It changes no assertions or oracle. Attempt 7 ran this source with `process.execPath` using Node 24 for every child. Children 1–31 exited cleanly. Case 32's scenario and summary assertions passed, then its Node test child exited `3221225477` (`0xC0000005`) during shutdown. The parent rejected that exit and stopped. Its machine summary is explicitly `complete: false`; 32 assertion samples do not mean 32 qualified child exits or 100 qualified scenarios.

The native cause is unattributed. Node 24 has not established a fix. All prior failures remain preserved separately. No further repeated local native runs were performed after attempt 7. Canonical Linux CI receiving remains required. No model quality, real provider/email, browser, production runtime, publication, or remote database qualification follows from these synthetic results.
