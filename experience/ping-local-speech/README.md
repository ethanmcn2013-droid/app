# Internal guided Ping sessions

This fixture mounts the real Tasks view and Ping overlay beside a session guide.
It uses invented tasks and members in an explicitly marked local SQLite database.
It is not a production route or a speech provider. The private scenario manifest
is supplied by the session owner and never served to the browser.
The fixture scopes the real product's body portals to its Tasks pane so its dock
cannot cover the guide and Pause can disable all mounted product controls.

From the owning clean App checkout, with Node 22 and existing dependencies:

```powershell
corepack pnpm ping:session-guide create 'D:/Codex-scratch/project-ping/my-guided-session' 'C:/private/ping-scenarios.json'
```

The new session directory must not already exist. The command opens an owned
Chrome window and prints its loopback URL. Source revision, source bytes, actor,
Project, manifest hash and evidence class are pinned for this session. The source
must remain unchanged while it is open.

Start a case in the guide, select its named tasks and operate Ping yourself.
Typing offers Review changes and Finish and apply or Cancel. Talking uses Finish
and run and may save immediately. The guide checks complete stored rows and the
original receipt separately from what the current Tasks view displays. It never
selects tasks or activates the microphone for you.

Pause and End stop mounted capture and disable the Tasks surface. Pause keeps
the session resumable; End preserves its summary and JSON/CSV downloads. Closing
the owned window, Ctrl+C, the eight-hour expiry, or creating a file named `STOP`
inside this exact session directory closes only this runner and retains data.
To resume a stopped process, remove that session's STOP file if present, then:

```powershell
corepack pnpm ping:session-guide reopen 'D:/Codex-scratch/project-ping/my-guided-session' 'C:/private/ping-scenarios.json'
```

Use Resume in the guide. Recovery checks the same original command; it never
replays Execute. An original that may have run blocks another mutation until its
outcome is known. An unsubmitted original lost at process restart may be retired
only after the runner's read-only checks prove the required custody and zero
effects. Mismatch or inaccessible evidence stops advancement. Preserve the
directory for diagnosis; do not reset it to obtain a pass.

The journal and exports contain IDs, hashes, categories and optional structured
feedback. They do not contain audio, transcripts, raw commands or raw tokens.
The incumbent product's private browser recovery marker is separate and is not
copied into runner records. Do not capture screenshots, HAR or traces of a human
session. Test screenshots are permitted only in an explicitly scripted session.

The planned case count is a target, not a quota. Started, observed, verified,
skipped and unresolved counts remain distinct. Scripted controls do not establish
genuine microphone recognition, founder experience, pilot use or programme gates.

Latency is recorded from the first guided tests. Server request checking and save
spans use a monotonic server clock. Browser round trips and Apply/Finish to the
mounted matching Tasks view use the page's monotonic clock. Exports retain each
sample and report count, median, nearest-rank p95 and maximum, split by input mode,
outcome and evidence class. Failed requests remain separate; missing or unfinished
spans are listed rather than replaced with zero. Page restarts are not combined
into an invented browser span. These are local guided-fixture measurements,
including observation overhead, not hosted production or genuine-speech benchmarks.
The `ping.guided.latency.v2` definition marks browser HTTP non-success responses
and transport errors as failed round trips. A server span measures completed
handler processing, including an intentional refusal. Earlier test packets keep
their original source-bound definitions and outcomes; do not silently regrade them.

Checks:

```powershell
corepack pnpm test:ping-session-guide
# Coordinator admits a new scripted output directory and the private manifest:
corepack pnpm test:ping-session-guide:browser
```

The browser check requires explicit `PING_GUIDED_BROWSER_RUN=1`,
`PING_GUIDED_BROWSER_OUTPUT` and `PING_GUIDED_MANIFEST` admission. Its failure
injection controls are in-process test hooks and have no HTTP endpoint.

Guided measurement extension `ping.guided.measurement.v1` adds metadata without
changing `ping.guided.latency.v2` boundaries or old packets. Page registrations
fence retired-page metadata, sequence replay is idempotent, and bounded registries
fail closed. Server and browser request samples share a span ID (and the original
request/generation IDs when available). A deliberate business refusal is completed
server handler processing; thrown handlers fail; deliberately dropped replies stay
labelled even when the handler completed. No request or mutation is replayed.

Durable gesture-start records expose missing completion per gesture, alongside
existing attempt coverage and raw unfinished samples. Observer delivery counters
are the last successfully reported page snapshot; a closed/crashed page can leave
later delivery unknown. Exported correlation lists unpaired observed spans and
never combines browser/server clocks. Matching Tasks model observation is not a
paint or physical-display measurement. Observation still adds overhead.

Exports include allowlisted Node/platform/architecture metadata. An optional
`benchmark` argument to `createGuidedRunner` pins a complete comparison receipt:
`runtime`, `platform`, `architecture`, `browser`, `viewport`, `buildMode`,
`cachePolicy`, `warmupPolicy`, `cohort`, `harnessSha256`,
`fixtureManifestSha256`, and `observerMode` (short strings; both hashes SHA-256).
The receipt is preserved in host config and must match on reopen. Do not include
paths, names, command content, audio or transcripts. Omission leaves `benchmark`
null and makes comparison ineligible. `compareGuidedResults` from
`guided-measurement.mjs` rejects incompatible or incomplete receipts, protocols,
statistics, planned cases or measured mode/evidence/outcome cohorts. It returns
raw denominator/coverage context plus median/p95 deltas; it does not declare a
speed win. Source revisions may differ intentionally while the harness and
measurement definitions remain fixed. Runtime metadata alone does not establish
matched machine load or cache state: record the actual benchmark conditions.

Run the extension's dependency-free regression tests with:

```powershell
node --test experience/ping-local-speech/guided-measurement.test.mjs
```
