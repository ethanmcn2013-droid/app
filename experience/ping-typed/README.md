# Isolated typed Ping browser receiving

Run `pnpm test:ping-typed:browser` from the App repository. Uses the installed esbuild (through tsx) and Playwright Chromium; no Next dev server, new dependency, credential or provider request.

The runner mounts the actual TasksProvider, HybridWorkspace and PingTypedPanel. Requests pass through the actual Ping HTTP/session/executor into a disposable synthetic file database. Canonical refresh must hydrate the real provider and appear in its rendered view. Fixture-only boundaries are Next navigation, unrelated server actions, a labelled synthetic Clerk hook/auth adapter and a disabled EventSource. This does not certify genuine Next/Clerk admission.

Four finite cases check double Apply, committed response loss and reload recovery, failed refresh with repair, and selection A→B→A during a pending prepare. Persisted receipt/row assertions remain independent of UI text. Output records source inputs, actual execution/receipt counts, cases and desktop/phone captures under a fresh `experience/output/ping-typed/` directory, or `PING_TYPED_BROWSER_OUTPUT`.

Fixture clock for the command service is the current clock; the calendar display is explicitly pinned review context. Audio, provider conformance, hosted receiving, actual-use value and production rollout are separate acceptance work.
