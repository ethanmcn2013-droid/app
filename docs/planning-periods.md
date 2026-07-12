# Planning Periods in Signal Tasks

Tasks is the runtime authority for Planning Period, Workspace, and membership.
The Studio contract mirrors this catalog; product content remains owned by its
product. This document describes the Tasks v2 boundary.

## External v2 catalog

Notes and other suite consumers may read the signed server-to-server catalog at
`GET /api/internal/workspaces?contractVersion=2` using a short-lived
`signal-tasks.workspace-list` assertion signed with `NOTES_TO_TASKS_SECRET`.
The response contains only current-member, non-archived Workspaces. Planning
Period groups and dates are returned only for periods owned by the requesting
subject; shared Workspaces remain selectable without leaking another owner's
period metadata. The endpoint is private/no-store and fails closed on missing,
expired, replayed, or malformed assertions.

## Shape

```text
Account
└── PlanningPeriod
    └── Workspace
        └── Tasks
```

A Planning Period has a finite `start_date` and `end_date` in production v2,
an IANA timezone, and one of `school_year`, `semester`, `wedding_season`, or
`general`. The additive database columns remain nullable only for reversible
migration. Every create/update action requires both valid dates. The read DTO
also forward-fixes any preview-era null dates from `created_at` so consumers
never receive an open-ended period.

A Workspace has one of `class`, `module`, `wedding`, or `project`. Context
changes wording and onboarding, not account capabilities. The typed vocabulary
map is `src/lib/planning/context.ts`.

`workspace_members` remains the only content-access authority. Owning a
Planning Period does not bypass membership checks on a Workspace.

## Sponsorship is not access

`workspace_sponsorships` records an association only. It never creates a
membership, role, invitation, or content permission. Studio's shared sponsor
policy remains canonical; Tasks stores the local association needed to project
activation state.

The sponsor DTO contains an activation ID, optional sponsor-local reference,
state, and current expressly consented activation metadata. It does not return
the canonical Workspace ID. `activationLabel` and `primaryDate` are returned
only while the association is active, the consent receipt is present, and the
metadata version is supported. Revoked or expired rows immediately project
those optional fields as `null`. Tasks, Notes, Timeline content, people,
invitations, public links, and audit history are never sponsor metadata.

Venue activation consent is verified against the current user's redeemed venue
entitlement. The raw redemption code is not stored as the entitlement reference;
its SHA-256 digest is used.

## Lifecycle and duplication

The server actions cover create, update, rename, archive, and restore for
Planning Periods; bulk create, move, reorder, archive, and restore for
Workspaces; and reviewed Workspace/Planning Period duplication.

Duplication can include reusable Tasks, Timeline milestone structure,
collaborators, and a template reference. Completion is reset. It never copies:

- public links;
- pending invitations;
- activity or completion history;
- attachments;
- source-note provenance;
- sponsorship.

Dates never shift silently. Planning Period duplication requires the new finite
dates. Workspace primary dates remain visible and unchanged for review.

## Context handoff

The suite switcher adds only these navigation hints to sibling `/app` links:

```text
contextVersion=2
planningPeriodId=<canonical period id>
workspaceId=<canonical workspace id>
```

They are not authorization. Incoming Tasks hints pass through
`/api/suite-context`, which re-checks `workspace_members` and verifies that the
Workspace belongs to the hinted Planning Period before writing the active
cookie. The response is private and `no-store`. Note, Task, attachment, share,
and public-link identifiers never enter suite switcher links.

## Flags

New entry points and writes are server-controlled. Defaults are off in
production and on in test/development:

```text
SIGNAL_PLANNING_PERIODS_ENABLED
SIGNAL_CONTEXTUAL_ONBOARDING_ENABLED
SIGNAL_PERIOD_SIGNAL_ENABLED
SIGNAL_AUDIENCE_TIMELINE_ENABLED
SIGNAL_SCHOOL_PILOT_ENABLED
SIGNAL_LIFECYCLE_DUPLICATION_ENABLED
```

Disabling a flag hides the new entry point and rejects its new write actions.
It never blocks an existing Workspace, membership, board, list, calendar,
Timeline, or deep link.

## Onboarding and activation definitions

Teacher activation:

- created a finite school year;
- created at least two separate class Workspaces in one bulk commit;
- selected one class and opened its Tasks view.

No pupil name, email, identifier, or account is requested or stored.

Student activation:

- created a finite semester;
- created at least two separate module Workspaces;
- selected one module and opened its Tasks view.

The student price, payment mechanics, verification policy, and any free-workspace
limit are not defined by this implementation. They must come from a verified
commercial source.

Wedding activation:

- verified or selected the wedding context;
- created one private wedding Workspace owned by the couple;
- supplied the wedding date;
- entered the Workspace.

A venue-sponsored activation additionally requires explicit consent before the
venue receives the small activation projection. Sponsorship does not count as
content activation and never changes ownership.

## Acceptance receipts

- A: `planning-period-migration.test.ts` preserves legacy IDs, task content,
  share token, and groups unambiguous owners into one finite Active work period.
- B/C: `input.test.ts` proves six class names and four academic modules become
  distinct deduplicated inputs for one transactional action.
- D: catalog and sponsorship projection tests prove no membership/content grant.
- E: `suite-context-contract.test.mjs` proves outgoing hints and membership-
  validated incoming selection.
- G/H: `dates.test.ts` separates elapsed time and milestones and covers both
  Europe/Dublin daylight-saving boundaries.
- K: `planning-security-contract.test.mjs` locks the no-pupil-data contract.
- L: lifecycle duplication allowlists copyable fields and explicitly omits
  public links, invitations, history, attachments, provenance, and sponsorship.

## Migration and recovery

Apply `drizzle/0013_planning_periods.sql` only after a verified backup and an
isolated-copy dry run. The migration is additive: it creates new tables and
indexes and adds nullable/defaulted columns without rebuilding `workspaces`.
It preserves every Workspace ID, slug, content row, and share token.

Exactly one `owner` membership is required for automatic grouping. Ambiguous or
missing owners remain ungrouped and are recorded in
`planning_period_migration_report`; they are not guessed. The default horizon is
deterministic from the owner's earliest legacy Workspace `created_at` and lasts
one calendar year.

Post-migration checks:

```sql
SELECT * FROM planning_period_migration_report
WHERE disposition <> 'grouped';

SELECT COUNT(*)
FROM workspaces w
LEFT JOIN planning_periods p ON p.id = w.planning_period_id
WHERE w.planning_period_id IS NOT NULL AND p.id IS NULL;

SELECT COUNT(*)
FROM planning_periods
WHERE start_date IS NULL OR end_date IS NULL OR start_date > end_date;
```

Rollback is application-first: disable the production flags. Old Workspace
routes continue using the same IDs and membership rows. Do not drop the new
columns/tables under incident pressure. Forward-fix ambiguous report rows after
review by creating the correct finite period and assigning only the reviewed
Workspace IDs. A physical schema rollback requires a separate SQLite table
rebuild and is intentionally not part of the live incident path.

## Open share-token storage hardening

Share-link revocation is now uncached, invalidates the exact route, and requires
a current non-archived Workspace. Workspace deletion explicitly removes share
capabilities and Task roots before the Workspace row. Sentry redacts share,
invite, redeem, and OAuth bearer values.

The remaining storage risk is that the legacy `share_links.token` primary key is
still the raw bearer token. A safe hash cutover spans the manage-links UI,
email flow, visit foreign key, account export/erasure, and legacy dual-read. It
was not compressed into the Planning Period migration. The forward migration
must add a unique `token_hash`, keep the existing primary key as an opaque row
ID for new links, show a new raw token only once, resolve by SHA-256 with a
legacy raw-token fallback, migrate visit references, then remove the fallback
only after all active legacy links have rotated or expired.
