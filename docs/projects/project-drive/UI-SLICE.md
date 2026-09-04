# Project Drive UI slice · internal review

Branch: `feat/january-drive-ui`. Base: `7d4040cbd59f4611ca69a60967b34bd58181d4c5`.
Implementation date: 2026-09-04. Target programme: January 21 launch. This is
an internal review slice, not launch acceptance or a design gate.

## Delegated selection and reuse

The user approved the full programme and delegated design decisions. This
implementation selects **A · Custodian** as the proposed thesis under that
delegation. It is **not a founder-selected or founder-locked direction**.
The historical exploration lock remains a blank template, not approval.

Source exploration: sibling worktree
`../design-project-drive-connections/docs/design/labs/project-drive-connections-2026-09`;
`DIRECTIONS.md`, `brief.md`, `direction-a.html`, `foundation.css` and reference
shots describe the three already explored directions. No new directions
programme was run. The existing panel has no rounds; no scores are claimed.

Reuse: Custodian's named owner field, quiet indigo wash, explicit custody
consequences and subordinate quota. Access remains a separate live-evidence
section. Resources reuses the existing single Attach control and settled rows;
the existing resumable uploader supplies confirmed-byte progress. Reduced
motion inherits the existing Resources behavior; no new decorative motion.

Implementation evidence is in `src/components/app/settings/sections/connections-view.tsx`,
`resources-section.tsx` and `drive-upload-row.tsx`, with renders in `ui-evidence/`.
The exploration is a composition reference; its fictional provider claims
are not imported as production facts.

## Implemented boundary

- `NEXT_PUBLIC_PROJECT_DRIVE_UI=true` opts in at build time. Unset, false and
  every other value retain the native upload path and Storage tab. Rebuild
  to change this switch; it is not an immediate runtime kill switch. Existing
  backend worker flags remain independent and off.
- Settings replaces the Storage label with Connections only under the flag,
  retains Signal Studio quota below it, and names the current storage owner.
  Live Connections is owner-only; members see a clear access-management message.
- Connect/reconnect, separate board setup and confirmed own-account disconnect
  call existing actions. Disconnect states the affected board count and file
  consequences before confirmation. No handover mutation UI is exposed.
- A minimal status action requires explicit project management authority before
  reads and again before returning. Demo and flag-off return before the database,
  auth or provider dependency graph is imported. The service projects only owner,
  setup, own-account and live-access display fields. No root URLs, credentials,
  permission IDs, raw provider errors or session URLs enter this DTO.
- The existing Google `permissions.list` service supplies current named-user
  access. Exact normalized email matches are required; membership and grant
  receipts never prove Google access. Missing, deleted, changed-email and
  non-user permissions remain unconfirmed. Unmatched access is counted without
  exposing outsiders' identities. A folder/roster change during the Google read
  invalidates access evidence. The check is timestamped and refreshed on demand.
- Resources creates one browser UUID per file and keeps it through every retry.
  Existing create/finalize actions authorize and verify; the existing resumable
  browser uploader sends bytes. Only a confirmed finalize/adoption reports Drive
  success. Any lost reply, pause or expiry preserves the claim and never calls
  native upload. A server-declared pre-delegation fallback requires an explicit
  choice. Stop sending is not represented as deletion or proof of cancellation.
- Resource DTOs expose the stored storage discriminator. Drive uploads open
  trusted Google links in a new tab, never the native attachment download route.
  Pending claims are labelled unconfirmed and cannot be removed in this UI.
  Load failures and denied reads are distinct from an empty resource list.

The status read uses existing access-service token refresh and last-used/error
bookkeeping. It creates no folders, grants, journal work or new credential
logic. No live provider or production database was exercised during this task.

## Preview and tests

From this worktree in PowerShell:

```powershell
pnpm install --frozen-lockfile
$env:NEXT_PUBLIC_SIGNAL_ACCESS_MODE = 'review'
$env:SIGNAL_ACCESS_MODE = 'review'
$env:NEXT_PUBLIC_PROJECT_DRIVE_UI = 'true'
pnpm dev --hostname 127.0.0.1 --port 3127
```

Open `http://127.0.0.1:3127/app/settings`. Flag-on review starts on Connections.
Use **Review state** for connected, not connected, setup, access attention,
Google unavailable, loading and failure. Disconnect and setup controls modify
only fictional local state. Navigate to Board, open a task and use **Upload
review state** in Resources for progress, unconfirmed retry and explicit native
fallback. Attach remains the only file intake; review intake sends no file.
Direct Resources pointer: `http://127.0.0.1:3127/app/tasks?task=demo-t-01`.
The card-body click selected a task without opening its detail in this review;
the direct task query opens the existing production detail panel.

The server was started in exec session `50484`; stop that exact session with
Ctrl+C when review is complete. Do not stop unrelated listeners. No `.env`
file was read or copied; dependencies came from the frozen lockfile.

```powershell
pnpm test:project-drive-ui
pnpm typecheck
pnpm lint
pnpm experience:validate
pnpm first-contact:language
```

`test:project-drive-ui` sets a credential-free review posture and runs the
browser machine, resumable uploader, DTO isolation, redaction, email matching,
roster-race, flag and import-boundary tests. Service tests inject disposable
local SQLite; review fixtures themselves never call a database or Google.
Validation results and screenshots are recorded in `ui-evidence/README.md`.

## Deliberate gaps and next review

1. **Handover**: safe candidate listing, eligibility/connection availability,
   handover progress and retry UI are missing. No client member list is passed
   off as an eligible owner list. Existing files stay with their old owner.
2. **Recovery after closing the task/browser**: retry works while this attempt
   remains mounted. There is no pending-claim discovery/reselect-file contract
   for resuming after a reload. Persisted claims are shown as unconfirmed, with
   no destructive remove control. Do not claim killed-browser acceptance.
3. **Access repair/setup progress**: no individual repair action, operation-list
   UI or autonomous progress polling. Setup with no persisted folder cannot be
   reconstructed as progress from the existing status reader. Own Google-account
   emails differing from board emails are honestly unconfirmed. A page-long
   Google check is a snapshot, not a subscription; Check again refreshes it.
4. **Resource provenance**: storage provider is shown, but historical owner
   display names are not joined into Resources. Full native-upload retry behavior
   is inherited from the existing native path; this change prevents cross-provider
   retry after uncertain Drive success.
5. **Live acceptance**: OAuth, real connect/disconnect/handover, real permissions,
   50 MB upload, full Drive and provider failures remain unverified in-product.
   Lead owns independent browser/security review. No human usability, council,
   design gate, production launch or privacy approval is claimed.
6. **Integration**: no push/merge, deployment, workflows, Vercel settings, schema,
   cryptography, journal/membership backend, billing or invite code changed.
   Lead reports Linux base lint/typecheck/full tests/Drive lifecycle/build green;
   the shared 247.3 KB versus 247 KB perf finding belongs to a separate agent.
   This slice does not inherit those results as evidence for its new changes.
   HQ sync and the formal materiality/council review remain integration work.
