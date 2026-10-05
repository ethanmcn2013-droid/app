# Review, Sample data for operators

Branch `feat/sample-data-seeder` (PR #212), cut from `4ae930c1`, the source of the production deployment of 5 October 2026. An unshipped candidate. No deployment, promotion, database write, schema change or production change was made, no script was run against production, and no dependency was added.

## What it is

A section in Settings, Sample data, that an operator uses while signed in to add three invented sets of projects to their own account, and to remove them again. It is a product feature that ships through the normal reviewed release. It is not a script and it writes no SQL around the product.

| Set | Projects | Tasks | Steps | Big dates | Links |
|---|---|---|---|---|---|
| Secondary school teacher | 5 | 84 | 18 | 15 | 4 |
| Third level student | 6 | 84 | 16 | 24 | 2 |
| Couple planning a wedding | 4 | 70 | 16 | 13 | 3 |
| Total | 15 | 238 | 50 | 52 | 9 |

## Who can see it and run it

Operators only: the caller's user id must be in `ADMIN_USER_IDS` (`callerIsAdmin` in `src/server/admin.ts`, the gate the comp-code minter uses).

- The Settings page asks the server for the section's data. For anyone who is not an operator, and for everyone in review and demo mode, the answer is null and the shell renders no Operator group, no nav item and no section.
- Each of the three writing actions returns before reading anything in review and demo mode, then resolves the caller from the session and throws unless `callerIsAdmin` passes. The acting user is never an argument.
- `src/server/tasks-security-regression.test.mjs` pins that order in the source. `src/server/sample-data/seeder.test.ts` runs it: four non-operators are refused by every action with nothing written.

## Registry

- `tasks.settings.sample-data` is registered as a nested view of Settings.
- `tasks.page.app-settings` has a new materiality hash because the page now reads the section's data and passes it to the shell. Receipt: `receipts/tasks.page.app-settings-materiality.json`.

## Rendered checks

Screenshots are kept outside the repository, under the redesign worktree at `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-05-sample-data/` (38 files).

**Hidden in review mode, on a production build.** `pnpm build` with `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, served by `next start`, `/app/settings` at 1440 and 390 wide. The settings navigation lists General, Members, Storage, Danger zone, Notifications, Appearance, Security, Billing, Privacy and data. No Operator group, no Sample data button, and the words do not appear in the page. No console errors. Files: `review-mode-hidden--settings--1440-dark.png`, `review-mode-hidden--settings--390-dark.png`.

**Shown for an operator.** A production build cannot sign anyone in without Clerk keys, which this work does not read. The operator view was therefore driven on `next dev` against a scratch SQLite file outside the repository, where the development fallback identity is the operator. That override exists only in development and does not ship. Through the real page and the real actions:

- the empty section, the add confirmation, the section after one set and after all three, both remove confirmations: 1440 and 390 wide, dark and light, no horizontal overflow;
- adding all three sets took about one second each on the local file and wrote 15 projects, 288 task rows, 297 audit entries, 9 links, 28 status and target date rows, and 0 notifications and 0 outbox rows;
- Projects, a wedding board, project overview, Timeline, Analytics and Files, a student board, a teacher board, My tasks and Inbox, each with the sample data in it, dark and light;
- Remove all returned the database to the one project and two tasks it held before, with no sample row left.

Two things in those captures are local development tooling and not the product: the Next.js development badge and Clerk's keyless prompt are hidden before each capture. A React development warning about the theme script tag appears on every `/app` page in `next dev`, with or without this change. Home logged a failed query against the local Signal analytics database, which was never created for this scratch setup; it is unrelated to sample data.

## What is not seeded, and why

- **Completion history.** Tasks marked done are finished at the moment the set is added. No product path backdates a completion or an audit entry, so none is forged. Charts show the done tasks as completed on the day the set was added, and the section says so.
- **Other people.** Members must be real users. Assignees are the operator or nobody; invented people appear only as text.
- **Inbox notifications, comments and messages.** These exist only when another person mentions or replies, and their write paths queue email. None is created.
- **Uploaded files.** Links only, on the reserved `example.com` domain. Nothing is fetched.
- **Notes and the Timeline database.** Separate stores with their own write paths. The Timeline page reads the tasks' big dates and the target date directly, so it has material.
- **Planning periods.** Sample projects are ordinary projects with no period.

## Found on the way

Deleting a project does not remove its declared status or target date. Those two meta rows (`project-status:{id}`, `project-target-date:{id}`) sit outside the `board:` namespace that project deletion and account erasure clear. Sample data removes exactly those keys for a sample project it has just deleted. The same gap for ordinary projects is unchanged by this work and is worth its own fix.
