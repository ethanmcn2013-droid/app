# UI slice evidence · 2026-09-04

Source worktree: `C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-drive-ui`.
Branch: `feat/january-drive-ui`, base `7d4040cbd59f4611ca69a60967b34bd58181d4c5`.
Captures were made from the dirty implementation source submitted with this
record. The accompanying manifest hashes the implemented UI sources and PNGs;
the commit containing this record is the submitted source revision.

Preview: `http://127.0.0.1:3127/app/settings`, Connections selected by default
only when both review/demo and `NEXT_PUBLIC_PROJECT_DRIVE_UI=true` are active.
Resources: `http://127.0.0.1:3127/app/tasks?task=demo-t-01`.
Command: `pnpm dev --hostname 127.0.0.1 --port 3127`, worktree above, exec session
`50484`. Readiness and HTTP 200 were observed in the server output. Process
remains available for lead review; stop this session with Ctrl+C afterwards.

## Direct observations

- Connections rendered at 390×844, 768×1024, 1280×900 and 1440×960. Each
  `documentElement.scrollWidth` equalled viewport width. The owner was present
  in the rendered DOM at every size. Images are `connections-<width>.png`.
- On a fresh final-source Connections tab, captured console warnings/errors
  were empty. The final surface had no framework error overlay.
- Access attention showed an unconfirmed person; Google unavailable did not
  retain a confirmed roster. The fictional disconnect displayed the two-board
  consequence and Keep connected cancelled it. Setup/loading/failure fixtures
  are available but are not claimed as individually browser-asserted here.
- Resources had exactly one **Attach a file** button. The fixture's Stop sending
  exposed Retry same upload; retry produced a Drive-complete state. The fallback
  fixture required Use Signal Studio and then labelled that destination.
- Resources rendered at 1440×960 and 390×844. Mobile document width was exactly
  390; the fixture and intake remained readable. These controls are fictional;
  actual controller behavior is exercised with injected ports by the test suite.
- The browser inherited the dark appearance. A complete light-theme,
  keyboard-only, reduced-motion, screen-reader or human usability review was
  not performed. No score or formal browser/security acceptance is claimed.

Initial navigation to the existing Workspace Settings tab produced a locale
hydration mismatch (`4 Sept 2026` / `Sep 4, 2026`). The prior tab also recorded
a client-navigation script-tag warning. New Connections uses explicit UTC and
the fresh final-source Connections tab was clean; the broader inherited shell
investigation belongs to the lead (also reported as React #418 on billing).
Do not infer that this slice fixes the inherited warning throughout the app.

## Mechanical verification

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed; pnpm 11.9.0, Node 22.23.2, no lockfile change or `.env` copy |
| `pnpm test:project-drive-ui` | 27/27 passed; includes resumable uploader, retry/fallback/cancel controller, DTO isolation and fixture import barriers |
| `pnpm typecheck` | Passed on final implementation sources |
| `pnpm lint` | Passed: 0 errors, 71 warnings in unchanged files |
| `pnpm experience:validate` | Passed: 81 experiences, 436 required state variants, 324 breakpoint variants |
| `pnpm first-contact:language` | Passed: 348 TSX files, seven existing baseline occurrences |
| `node scripts/check-module-boundaries.mjs` | Passed |
| tenant-scope + project-authz contracts | 30/30 passed |
| Drive hard rules + upload-limit + attachment-client security contracts | 71/71 passed; see `upload-contracts.tap`. Browser callers must delegate to the audited server finalizer. The final test-only change also passed touched-file lint |
| Build, full product suite, bundle budgets on this new slice | Not run; lead's green Linux base is not evidence for changed UI |

`UI-MATERIALITY.md` records the materiality assessment and pending billing
acceptance. `UI-SLICE.md` records missing handover, repair visibility and
killed-browser recovery, as well as the exact live-provider boundaries.
