# Recipient project work

This fixture repairs and verifies the two reproduced January recipient-entry
defects: authorized B was withheld by ambient A on the V3 Tasks route, and My work
hid later/undated assignments behind project setup.

Run from the App root with its pinned dependencies:

```sh
node --test experience/recipient-project-work/server.test.cjs
node --test src/server/projects/route-authz-contract.test.mjs
node experience/recipient-project-work/browser.mjs
```

The existing default `test` gate runs `route-authz-contract.test.mjs`, which imports
the three behavioral SQLite scenarios. Selector coverage is in the already
registered `src/lib/tasks/dayparts.test.ts`. No new package registration is needed.

The server scenarios execute the actual page functions, project resolver,
membership queries, explicit recovery action, both cookie writes, persisted task
read projection, My work component and empty overlay. The runtime mount is real;
its shell is a leaf adapter here, so its explicit project argument is checked,
not described as a complete Next request. Request identity, cookies and rendering
contexts are fixture adapters. Each test creates fresh file-backed SQLite from
the committed App migrations, under `work/`, and closes the connection. Files
remain disposable because Windows libSQL may retain a lock until process exit.

The browser command renders actual My work, empty overlay and recovery form with
the current App Tailwind/CSS/tokens at 1440 and 390 pixels. Its loopback server
executes real authorization, SQLite reads and the recovery POST. The header,
router and task contexts are explicit fixture adapters, and opening a detail is
recorded at the context boundary. External browser requests are blocked. Receipts,
input source hashes and screenshots go to ignored `experience/output/recipient-project-work`.
This is focused component evidence, not a full Next browser or human comprehension
test. Stage 2's continuous writer proof is separate.

Compatibility: contextual GETs remain cookie-free. V3 consumes explicit authorized
B; flag-off entry explains the mismatch and offers a deliberate, reauthorized
selection POST. Archived projects cannot become the active selection. My work's
empty-owner add-task intent is retained, while this personal projection never
offers the destructive project-reset starter pack. Other overlay callers retain
their existing behavior. No role or entitlement policy changes.

The original 88-check review and its bug-observation fixtures are retained in the
task's `outputs/final-journey-e9f10184` and
`outputs/final-journey-gap-assessment-e9f10184.md`; their assertions of the old
failure are not counted as successful journeys.
