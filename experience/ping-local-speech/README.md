# Internal guided Ping sessions

This fixture mounts the real Tasks view and Ping overlay beside a session guide.
It uses invented tasks and members in an explicitly marked local SQLite database.
It is not a production route or a speech provider. The private scenario manifest
is supplied by the session owner and never served to the browser.

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

Checks:

```powershell
corepack pnpm test:ping-session-guide
# Coordinator admits a new scripted output directory and the private manifest:
corepack pnpm test:ping-session-guide:browser
```

The browser check requires explicit `PING_GUIDED_BROWSER_RUN=1`,
`PING_GUIDED_BROWSER_OUTPUT` and `PING_GUIDED_MANIFEST` admission. Its failure
injection controls are in-process test hooks and have no HTTP endpoint.
