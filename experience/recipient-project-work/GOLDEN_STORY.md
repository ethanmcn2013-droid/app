# Persisted recipient collaboration proof

Run from the App root with the pinned dependencies:

```sh
node experience/recipient-project-work/golden.cjs
```

This command creates four disposable file-backed SQLite stores from the committed
App, Notes, Timeline and Signal migrations. Only existing accounts and initialized
projects are prerequisites. Project B has no planning period. No task, note,
invite, accepted membership, Timeline, publication, briefing, entitlement or
sponsored-use result is seeded. Each named checkpoint asserts persisted output
from the actual application functions; a failed positive assertion exits nonzero.

The continuous sequence is:

1. Creator writes a private Note and sends only the approved selection through
   the real signed workspace catalog and extract HTTP handlers. Exact replay
   returns the durable receipt without another request or Task.
2. The actual task-focus page follows the Notes link to the Task's stored B with
   cookie A. Creator assigns it and creates a second private Task, then invites
   a collaborator through the actual action. The local email transport captures
   the invitation. Acceptance commits membership/audit and both B preferences;
   invite replay is refused.
3. With A active again, the actual My work page/component displays the undated
   assignment. The real completion action commits the task transition and its
   activity. Fresh SQL and page reads retain the completed work. The member
   then reopens, dates and marks it as a milestone.
4. The actual Timeline membership reader refuses member initialization with no
   Timeline row written. Creator initializes B and the real source reader,
   lease and sync transaction create the two milestones.
5. Creator publishes exactly one selected milestone. The actual unauthenticated
   token resolver returns the narrow DTO, excluding private Notes, unselected
   work and internal relations. Later edits/sync leave the publication frozen.
   Creator revocation makes the outsider token unusable.
6. Actual Home scope/catalog/source/ranking must return the persisted Task's
   exact link; the actual task-focus route must reopen B despite A. Removing
   membership then refuses the next page, action and Home read. This free
   collaborator story creates no entitlement or sponsored-use intent.

The ten named checkpoints are behavioral steps, not ten browser stories or a
count of every assertion. Notes, Tasks, Timeline and Home data is read through
their runtime code. There is no constructed success DTO or mocked catalog,
membership decision, action result, sync result, publication or ranking.

## Boundaries and evidence

Request identity/cookies/cache, UI contexts and email transport are adapters.
The App auth adapter supplies the current synthetic request actor; actual
project authorization reads membership from SQLite. Notes/Timeline Clerk
request identity is synthetic. Database handles point only to this run's exact
four SQLite paths. Service fetch becomes a local `Request` dispatched to the
actual signed handlers. External provider access is unavailable. UI contexts
render the real My work component from fresh authorized SQL rows, and this
runner invokes the real action; it does not claim a full Next/browser session.

Receipts, redacted publication DTO, first-view HTML, Home boundary and source
SHA-256 inventory are written under ignored
`experience/output/recipient-project-work/golden`. `RECIPIENT_OUTPUT` can select
another output directory. Source hashes normalize CRLF to LF and include loaded
runtime code, migrations, fixture code, package and lockfile. SQLite connections
close in `finally`; disposable files remain under `experience/output` because
Windows libSQL can retain a lock until process exit. There is no cleanup error
that replaces a primary assertion.

The first execution exposed two real production gaps. The Tasks page mapper
mismatch is fixed by `956a2e4f` with an actual-page regression. Home's successful
planning-period query drops true NULL loose projects (MODULE-REC-02, separately
owned). The pre-repair failure is retained in the task's
`outputs/recipient-project-work/before-home-repair`; it is not a pass. The Home
assertion remains unconditional, after the independent removal checks, so a
negative refusal cannot mask a missing positive journey.

This proves actual owner/member permissions, not strategy-only roles. It adds
no instrumentation. The S5 exact actor-owned grant/member boundary remains in
its existing separately registered regression suite. External auth/email
delivery, full browser journey continuity and human comprehension are unverified.

## Principal-owned registration

Package, lockfile, workflows and experience registry are unchanged in this lane.
The four server scenarios already run through the existing default
`src/server/projects/route-authz-contract.test.mjs` import. Selector tests remain
in the existing `src/lib/tasks/dayparts.test.ts` registration. Add the golden
command above to the receiving default gate after composing MODULE-REC-02;
retain the browser command below in the experience gate:

```sh
node --test experience/recipient-project-work/server.test.cjs
node experience/recipient-project-work/browser.mjs
node experience/recipient-project-work/golden.cjs
```

Material changed surface IDs: `tasks.page.app-my-tasks`,
`tasks.page.app-tasks`, `tasks.page.app-task-by-id`. The continuous proof also
traverses existing `tasks.page.app-notes`, `tasks.page.invite-by-token`,
`tasks.page.app-timeline`, `tasks.page.app-timeline-audience`,
`tasks.page.app-timeline-audience-by-publication-id` and `tasks.page.app-home`.
Those source-function checkpoints are not substitutes for browser captures of
each surface. Existing screenshots and the old 88 negative observations retain
their original limits.
